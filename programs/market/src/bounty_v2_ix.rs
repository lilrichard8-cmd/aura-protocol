//! Instructions + Accounts contexts for Bounty V2.
//! Kept in its own file so lib.rs stays readable.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};

use crate::bounty_v2::*;
use crate::{
    ORA_MINT, USDC_MINT, PROGRAM_ADMIN,
    STAKING_REWARDS_POOL, GAS_RESERVE_POOL, OPS_TREASURY_POOL,
};
// USDC pool consts (STAKING_REWARDS_POOL_USDC etc.) are reserved for the
// USDC bounty pipeline (audit fix H-2) and currently unused; kept in
// lib.rs as placeholders for the post-v1 USDC enablement.

// ─── Helpers ────────────────────────────────────────────────────────────────

#[inline]
fn bps(amount: u64, bps_value: u64) -> Result<u64> {
    let v = (amount as u128)
        .checked_mul(bps_value as u128)
        .ok_or(BountyV2Error::Overflow)?
        / 10_000u128;
    Ok(v as u64)
}

/// Move tokens out of the bounty escrow PDA.
/// Caller passes pre-computed seeds. `bounty_key` is needed because
/// the escrow is owned by the bounty PDA itself.
fn escrow_signer_seeds<'a>(
    sponsor: &'a Pubkey,
    id_bytes: &'a [u8; 8],
    bump: &'a [u8; 1],
) -> [&'a [u8]; 4] {
    [BountyV2::SEED, sponsor.as_ref(), id_bytes.as_ref(), bump]
}

// ─── 1. Set / rotate official authority (admin only) ────────────────────────

pub fn init_official_authority(ctx: Context<InitOfficialAuthority>, authority: Pubkey) -> Result<()> {
    let cfg = &mut ctx.accounts.official_authority;
    cfg.authority = authority;
    cfg.admin = ctx.accounts.admin.key();
    cfg.bump = ctx.bumps.official_authority;
    msg!("OfficialBountyAuthority initialised: {}", authority);
    Ok(())
}

pub fn rotate_official_authority(ctx: Context<RotateOfficialAuthority>, new_authority: Pubkey) -> Result<()> {
    // [audit fix C-4] Context constraint already enforces admin == PROGRAM_ADMIN.
    let cfg = &mut ctx.accounts.official_authority;
    cfg.authority = new_authority;
    msg!("OfficialBountyAuthority rotated to: {}", new_authority);
    Ok(())
}

/// [audit fix C-4] admin must equal the hardcoded PROGRAM_ADMIN const,
/// preventing front-run init attacks where an attacker becomes admin first.
#[derive(Accounts)]
pub struct InitOfficialAuthority<'info> {
    #[account(
        init, payer = admin,
        space = OfficialBountyAuthority::SIZE,
        seeds = [OfficialBountyAuthority::SEED],
        bump
    )]
    pub official_authority: Account<'info, OfficialBountyAuthority>,
    #[account(mut, address = PROGRAM_ADMIN @ BountyV2Error::Unauthorized)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// [audit fix C-4] rotate also gates on hardcoded PROGRAM_ADMIN, not just the
/// stored admin field (which could have been set by an attacker pre-fix).
#[derive(Accounts)]
pub struct RotateOfficialAuthority<'info> {
    #[account(
        mut,
        seeds = [OfficialBountyAuthority::SEED],
        bump = official_authority.bump,
    )]
    pub official_authority: Account<'info, OfficialBountyAuthority>,
    #[account(address = PROGRAM_ADMIN @ BountyV2Error::Unauthorized)]
    pub admin: Signer<'info>,
}

// ─── 2. Init bounty counter (one-time per sponsor) ──────────────────────────

pub fn init_bounty_counter(ctx: Context<InitBountyCounter>) -> Result<()> {
    let c = &mut ctx.accounts.bounty_counter;
    c.sponsor = ctx.accounts.sponsor.key();
    c.count = 0;
    c.bump = ctx.bumps.bounty_counter;
    Ok(())
}

#[derive(Accounts)]
pub struct InitBountyCounter<'info> {
    #[account(
        init, payer = sponsor,
        space = BountyCounter::SIZE,
        seeds = [BountyCounter::SEED, sponsor.key().as_ref()],
        bump
    )]
    pub bounty_counter: Account<'info, BountyCounter>,
    #[account(mut)]
    pub sponsor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// ─── 3. Create bounty (with deposit) ────────────────────────────────────────

pub fn create_bounty_v2(
    ctx: Context<CreateBountyV2>,
    total_reward: u64,
    max_winners: u8,
    deadline: i64,
    title: String,
    metadata_uri: String,
    is_official: bool,
) -> Result<()> {
    // ── Validation ──
    require!(total_reward > 0, BountyV2Error::InvalidReward);
    require!(
        max_winners >= 1 && max_winners <= MAX_BOUNTY_WINNERS,
        BountyV2Error::InvalidMaxWinners
    );
    require!(
        deadline > Clock::get()?.unix_timestamp,
        BountyV2Error::InvalidDeadline
    );
    require!(title.len() <= BOUNTY_TITLE_MAX, BountyV2Error::TitleTooLong);
    require!(
        metadata_uri.len() <= BOUNTY_URI_MAX,
        BountyV2Error::MetadataUriTooLong
    );

    // ── Mint enforcement [audit fix C-2] ──
    // Non-official path: payment_mint MUST be ORA.
    // Official path: payment_mint MUST be ORA or USDC.
    let payment_mint_key = ctx.accounts.payment_mint.key();
    if is_official {
        // The signer must equal `official_authority.authority` AND be a signer here.
        let oa = ctx
            .accounts
            .official_authority
            .as_ref()
            .ok_or(BountyV2Error::OfficialAuthorityRequired)?;
        require!(
            ctx.accounts.sponsor.key() == oa.authority,
            BountyV2Error::OfficialAuthorityRequired
        );
        require!(
            payment_mint_key == ORA_MINT || payment_mint_key == USDC_MINT,
            BountyV2Error::PaymentMintNotOra
        );
        // [audit fix H-2] USDC bounty fees require a separate USDC treasury
        // pipeline (USDC_STAKING_POOL etc. + USDC-denominated burn fallback).
        // The treasury pool constants exist as placeholders but until they
        // point at real accounts we explicitly block USDC bounties at
        // creation time. Switch this to an enabled state after the USDC
        // treasury accounts are funded and the consts updated.
        require!(
            payment_mint_key != USDC_MINT,
            BountyV2Error::UsdcNotYetSupported
        );
    } else {
        require!(
            payment_mint_key == ORA_MINT,
            BountyV2Error::PaymentMintNotOra
        );
    }

    // ── Allocate id from counter ──
    let counter = &mut ctx.accounts.bounty_counter;
    let id = counter.count;
    counter.count = id.checked_add(1).ok_or(BountyV2Error::Overflow)?;

    // ── Lock funds in escrow ──
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.sponsor_token_account.to_account_info(),
                to: ctx.accounts.escrow_token_account.to_account_info(),
                authority: ctx.accounts.sponsor.to_account_info(),
            },
        ),
        total_reward,
    )?;

    // ── Persist bounty ──
    let now = Clock::get()?.unix_timestamp;
    let b = &mut ctx.accounts.bounty;
    b.id = id;
    b.sponsor = ctx.accounts.sponsor.key();
    b.is_official = is_official;
    b.payment_mint = ctx.accounts.payment_mint.key();
    b.escrow_account = ctx.accounts.escrow_token_account.key();
    b.total_reward = total_reward;
    b.awarded_amount = 0;
    b.refunded_amount = 0;
    b.max_winners = max_winners;
    b.winners_awarded = 0;
    b.submission_count = 0;
    b.deadline = deadline;
    b.status = BountyStatus::Open;
    b.metadata_uri = metadata_uri;
    b.title = title;
    b.created_at = now;
    b.bump = ctx.bumps.bounty;

    emit!(BountyCreated {
        bounty: b.key(),
        sponsor: b.sponsor,
        is_official,
        payment_mint: b.payment_mint,
        total_reward,
        max_winners,
        deadline,
        slot: Clock::get()?.slot,
    });
    Ok(())
}

#[derive(Accounts)]
#[instruction(total_reward: u64, max_winners: u8, deadline: i64, title: String, metadata_uri: String, is_official: bool)]
pub struct CreateBountyV2<'info> {
    #[account(
        mut,
        seeds = [BountyCounter::SEED, sponsor.key().as_ref()],
        bump = bounty_counter.bump,
        has_one = sponsor @ BountyV2Error::Unauthorized,
    )]
    pub bounty_counter: Account<'info, BountyCounter>,

    #[account(
        init, payer = sponsor,
        space = BountyV2::SIZE,
        seeds = [
            BountyV2::SEED,
            sponsor.key().as_ref(),
            bounty_counter.count.to_le_bytes().as_ref(),
        ],
        bump
    )]
    pub bounty: Account<'info, BountyV2>,

    /// Reward mint — ORA for normal users, ORA or USDC for official authority.
    /// The runtime check is in the instruction body (we don't know which mint
    /// is "the canonical ORA mint" at compile-time; it's a deploy-time
    /// constant the SDK must pass in via `payment_mint`).
    pub payment_mint: Account<'info, Mint>,

    /// Sponsor's source token account, must match payment_mint and be owned by sponsor.
    #[account(
        mut,
        constraint = sponsor_token_account.mint == payment_mint.key() @ BountyV2Error::Unauthorized,
        constraint = sponsor_token_account.owner == sponsor.key() @ BountyV2Error::Unauthorized,
    )]
    pub sponsor_token_account: Account<'info, TokenAccount>,

    /// PDA-owned escrow token account. Initialised externally (SDK is
    /// expected to create it via `create_associated_token_account` with
    /// the bounty PDA as owner) BEFORE calling create_bounty_v2.
    /// We verify: mint matches payment_mint, owner is the bounty PDA itself.
    #[account(
        mut,
        constraint = escrow_token_account.mint == payment_mint.key() @ BountyV2Error::Unauthorized,
        constraint = escrow_token_account.owner == bounty.key() @ BountyV2Error::Unauthorized,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// Optional official-authority PDA. Only required (and verified) when
    /// `is_official = true`. We pass it as an `Option`-ish UncheckedAccount
    /// via the body check above.
    #[account(seeds = [OfficialBountyAuthority::SEED], bump = official_authority.bump)]
    pub official_authority: Option<Account<'info, OfficialBountyAuthority>>,

    #[account(mut)]
    pub sponsor: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

// ─── 4. Submit work ─────────────────────────────────────────────────────────

pub fn submit_to_bounty(ctx: Context<SubmitToBounty>, content_uri: String) -> Result<()> {
    require!(
        content_uri.len() <= SUBMISSION_URI_MAX,
        BountyV2Error::SubmissionUriTooLong
    );

    let bounty = &mut ctx.accounts.bounty;
    require!(bounty.status == BountyStatus::Open, BountyV2Error::BountyNotOpen);
    require!(
        Clock::get()?.unix_timestamp < bounty.deadline,
        BountyV2Error::BountyExpired
    );

    let s = &mut ctx.accounts.submission;
    s.bounty = bounty.key();
    s.submitter = ctx.accounts.submitter.key();
    s.content_uri = content_uri;
    s.submitted_at = Clock::get()?.unix_timestamp;
    s.status = SubmissionStatus::Pending;
    s.awarded_amount = 0;
    s.bump = ctx.bumps.submission;

    bounty.submission_count = bounty.submission_count.saturating_add(1);

    emit!(BountySubmissionPosted {
        bounty: bounty.key(),
        submission: s.key(),
        submitter: s.submitter,
        slot: Clock::get()?.slot,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct SubmitToBounty<'info> {
    /// [audit fix M-3] add seed verification for defense-in-depth, mirroring
    /// the other instructions in this module.
    #[account(
        mut,
        seeds = [
            BountyV2::SEED,
            bounty.sponsor.as_ref(),
            bounty.id.to_le_bytes().as_ref(),
        ],
        bump = bounty.bump,
    )]
    pub bounty: Account<'info, BountyV2>,

    #[account(
        init, payer = submitter,
        space = BountySubmission::SIZE,
        seeds = [
            BountySubmission::SEED,
            bounty.key().as_ref(),
            submitter.key().as_ref(),
        ],
        bump
    )]
    pub submission: Account<'info, BountySubmission>,

    #[account(mut)]
    pub submitter: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// ─── 5. Award a submission ──────────────────────────────────────────────────

pub fn award_submission(ctx: Context<AwardSubmission>, gross_amount: u64) -> Result<()> {
    let payment_mint_key = ctx.accounts.payment_mint.key();
    let is_official = ctx.accounts.bounty.is_official;
    let sponsor_key = ctx.accounts.bounty.sponsor;
    let bounty_id = ctx.accounts.bounty.id;
    let bounty_bump = ctx.accounts.bounty.bump;
    let total_reward = ctx.accounts.bounty.total_reward;

    // Snapshot fields we need before borrowing &mut
    {
        let bounty = &ctx.accounts.bounty;
        require!(bounty.status == BountyStatus::Open, BountyV2Error::BountyNotOpen);
        require!(
            Clock::get()?.unix_timestamp < bounty.deadline,
            BountyV2Error::BountyExpired
        );
        require!(
            bounty.winners_awarded < bounty.max_winners,
            BountyV2Error::WinnerSlotsExhausted
        );
        require!(gross_amount >= MIN_AWARD_AMOUNT, BountyV2Error::AwardTooSmall);

        // Submission must belong to this bounty and be Pending.
        let s = &ctx.accounts.submission;
        require!(s.bounty == bounty.key(), BountyV2Error::SubmissionBountyMismatch);
        require!(
            s.status == SubmissionStatus::Pending,
            BountyV2Error::SubmissionAlreadyFinalised
        );

        // Token-account mint guards
        require!(
            ctx.accounts.escrow_token_account.mint == payment_mint_key
                && ctx.accounts.escrow_token_account.owner == bounty.key(),
            BountyV2Error::Unauthorized
        );
        require!(
            ctx.accounts.winner_token_account.mint == payment_mint_key,
            BountyV2Error::Unauthorized
        );

        // Remaining ≥ gross_amount
        let remaining = total_reward
            .checked_sub(bounty.awarded_amount)
            .ok_or(BountyV2Error::Overflow)?;
        require!(gross_amount <= remaining, BountyV2Error::RewardExhausted);
    }

    // ── Compute fee split ──
    // [audit fix H-2] v1 supports ORA bounties only (official and non-official
    // alike). USDC bounties are blocked at create_bounty time, so by the
    // time we get here payment_mint is always ORA and is_official is
    // informational only. Once USDC pipeline is enabled we'll branch here
    // on payment_mint key.
    let _ = is_official;
    let burn_amt = bps(gross_amount, ORA_BURN_BPS)?;
    let staking_amt = bps(gross_amount, ORA_STAKING_BPS)?;
    let gas_amt = bps(gross_amount, ORA_GAS_BPS)?;
    let ops_amt = bps(gross_amount, ORA_OPS_BPS)?;
    let fee_total = burn_amt
        .checked_add(staking_amt)
        .and_then(|v| v.checked_add(gas_amt))
        .and_then(|v| v.checked_add(ops_amt))
        .ok_or(BountyV2Error::Overflow)?;
    let net_to_winner = gross_amount
        .checked_sub(fee_total)
        .ok_or(BountyV2Error::Overflow)?;

    // Signer seeds for the bounty PDA (which owns the escrow ATA).
    let id_bytes = bounty_id.to_le_bytes();
    let bump_arr = [bounty_bump];
    let seeds: [&[u8]; 4] = escrow_signer_seeds(&sponsor_key, &id_bytes, &bump_arr);
    let signer: &[&[&[u8]]] = &[&seeds];

    // ── 1) escrow → winner (net_to_winner) ──
    if net_to_winner > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.winner_token_account.to_account_info(),
                    authority: ctx.accounts.bounty.to_account_info(),
                },
                signer,
            ),
            net_to_winner,
        )?;
    }

    // ── 2) Burn (ORA only) ──
    if burn_amt > 0 {
        token::burn(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.payment_mint.to_account_info(),
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    authority: ctx.accounts.bounty.to_account_info(),
                },
                signer,
            ),
            burn_amt,
        )?;
    }

    // ── 3) Staking pool ──
    if staking_amt > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.staking_pool_account.to_account_info(),
                    authority: ctx.accounts.bounty.to_account_info(),
                },
                signer,
            ),
            staking_amt,
        )?;
    }

    // ── 4) Gas reserve ──
    if gas_amt > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.gas_reserve_account.to_account_info(),
                    authority: ctx.accounts.bounty.to_account_info(),
                },
                signer,
            ),
            gas_amt,
        )?;
    }

    // ── 5) Ops treasury ──
    if ops_amt > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.ops_treasury_account.to_account_info(),
                    authority: ctx.accounts.bounty.to_account_info(),
                },
                signer,
            ),
            ops_amt,
        )?;
    }

    // ── Persist state changes ──
    let bounty = &mut ctx.accounts.bounty;
    bounty.awarded_amount = bounty
        .awarded_amount
        .checked_add(gross_amount)
        .ok_or(BountyV2Error::Overflow)?;
    bounty.winners_awarded = bounty
        .winners_awarded
        .checked_add(1)
        .ok_or(BountyV2Error::Overflow)?;

    // Auto-close if either constraint hit.
    let remaining_after = bounty
        .total_reward
        .checked_sub(bounty.awarded_amount)
        .ok_or(BountyV2Error::Overflow)?;
    let auto_closed = bounty.winners_awarded >= bounty.max_winners || remaining_after == 0;
    if auto_closed {
        bounty.status = BountyStatus::FullyAwarded;
    }
    let bounty_key = bounty.key();

    let s = &mut ctx.accounts.submission;
    s.status = SubmissionStatus::Awarded;
    s.awarded_amount = net_to_winner;

    // [audit fix round2 R2-BV2-L2] Emit `BountyClosed { reason: 3 }` when the
    // bounty auto-closes via FullyAwarded (winner slots filled or reward
    // exhausted). Off-chain consumers watching for BountyClosed to detect
    // the final state would otherwise miss this transition. `refunded` is
    // 0 because no refund occurs on auto-close (sponsor must explicitly
    // call `close_bounty` to reclaim any unawarded remainder).
    if auto_closed {
        emit!(BountyClosed {
            bounty: bounty_key,
            refunded: 0,
            reason: 3,
            slot: Clock::get()?.slot,
        });
    }

    emit!(BountyAwarded {
        bounty: bounty.key(),
        submission: s.key(),
        winner: s.submitter,
        gross_amount,
        net_to_winner,
        burn_amount: burn_amt,
        staking_amount: staking_amt,
        gas_amount: gas_amt,
        ops_amount: ops_amt,
        winners_so_far: bounty.winners_awarded,
        remaining_reward: remaining_after,
        slot: Clock::get()?.slot,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct AwardSubmission<'info> {
    #[account(
        mut,
        seeds = [
            BountyV2::SEED,
            bounty.sponsor.as_ref(),
            bounty.id.to_le_bytes().as_ref(),
        ],
        bump = bounty.bump,
        has_one = sponsor @ BountyV2Error::Unauthorized,
    )]
    pub bounty: Account<'info, BountyV2>,

    #[account(
        mut,
        seeds = [
            BountySubmission::SEED,
            bounty.key().as_ref(),
            submission.submitter.as_ref(),
        ],
        bump = submission.bump,
    )]
    pub submission: Account<'info, BountySubmission>,

    /// Reward mint (ORA in v1; USDC reserved). Must equal `bounty.payment_mint`.
    #[account(
        constraint = payment_mint.key() == bounty.payment_mint @ BountyV2Error::Unauthorized
    )]
    pub payment_mint: Account<'info, Mint>,

    /// [audit fix H-1] Escrow must be the bounty's recorded escrow_account.
    /// Also owned by the bounty PDA and mint matches payment_mint.
    #[account(
        mut,
        constraint = escrow_token_account.key() == bounty.escrow_account @ BountyV2Error::EscrowAccountMismatch,
        constraint = escrow_token_account.owner == bounty.key() @ BountyV2Error::Unauthorized,
        constraint = escrow_token_account.mint == bounty.payment_mint @ BountyV2Error::Unauthorized,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    /// [audit fix C-1] Winner token account MUST be owned by the submitter.
    /// Sponsor cannot redirect the payout to themselves or any third party.
    #[account(
        mut,
        constraint = winner_token_account.owner == submission.submitter @ BountyV2Error::WinnerOwnerMismatch,
        constraint = winner_token_account.mint == bounty.payment_mint @ BountyV2Error::Unauthorized,
    )]
    pub winner_token_account: Account<'info, TokenAccount>,

    /// [audit fix C-3] Protocol fee destinations bound to hardcoded protocol
    /// pools. Mirrors sell_order / buy_order pattern. The actual pool used
    /// depends on `bounty.is_official` (ORA vs USDC). v1 is ORA-only so we
    /// hardcode the ORA pools here; when USDC is enabled an additional
    /// instruction (`award_submission_usdc`) will be added with USDC pools.
    #[account(mut, address = STAKING_REWARDS_POOL @ BountyV2Error::Unauthorized)]
    pub staking_pool_account: Account<'info, TokenAccount>,
    #[account(mut, address = GAS_RESERVE_POOL @ BountyV2Error::Unauthorized)]
    pub gas_reserve_account: Account<'info, TokenAccount>,
    #[account(mut, address = OPS_TREASURY_POOL @ BountyV2Error::Unauthorized)]
    pub ops_treasury_account: Account<'info, TokenAccount>,

    pub sponsor: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// ─── 6. Reject a submission (sponsor-only, optional) ────────────────────────

pub fn reject_submission(ctx: Context<RejectSubmission>) -> Result<()> {
    require!(
        ctx.accounts.bounty.status == BountyStatus::Open,
        BountyV2Error::BountyNotOpen
    );
    require!(
        ctx.accounts.submission.status == SubmissionStatus::Pending,
        BountyV2Error::SubmissionAlreadyFinalised
    );
    // [audit fix R3-BV2-M1] Set Rejected before close (Anchor closes after
    // instruction body; the status flip is mostly cosmetic at this point
    // since the account is about to be zeroed, but keeps event logs honest).
    ctx.accounts.submission.status = SubmissionStatus::Rejected;
    Ok(())
}

#[derive(Accounts)]
pub struct RejectSubmission<'info> {
    #[account(
        seeds = [
            BountyV2::SEED,
            bounty.sponsor.as_ref(),
            bounty.id.to_le_bytes().as_ref(),
        ],
        bump = bounty.bump,
        has_one = sponsor @ BountyV2Error::Unauthorized,
    )]
    pub bounty: Account<'info, BountyV2>,

    // [audit fix R3-BV2-M1] Close the submission PDA back to the submitter on
    // reject so they recover the ~0.002 SOL rent they paid. Without this,
    // submitters were stranded paying rent for rejected work — an asymmetric
    // cost-of-participation tax that disadvantaged submitters vs. sponsors.
    #[account(
        mut,
        seeds = [
            BountySubmission::SEED,
            bounty.key().as_ref(),
            submission.submitter.as_ref(),
        ],
        bump = submission.bump,
        constraint = submitter.key() == submission.submitter @ BountyV2Error::Unauthorized,
        close = submitter,
    )]
    pub submission: Account<'info, BountySubmission>,

    /// CHECK: rent recipient; constrained above to equal submission.submitter.
    #[account(mut)]
    pub submitter: UncheckedAccount<'info>,

    pub sponsor: Signer<'info>,
}

// ─── 7. Cancel (no submissions yet) ─────────────────────────────────────────

pub fn cancel_bounty(ctx: Context<CloseBountyCommon>) -> Result<()> {
    {
        let b = &ctx.accounts.bounty;
        require!(b.status == BountyStatus::Open, BountyV2Error::BountyNotOpen);
        // [audit fix H-3] Drop `submission_count == 0` requirement; a griefer
        // submitting junk would otherwise lock the sponsor out of the
        // Cancelled end-state forever. The meaningful invariant is
        // "no awards yet made", which `winners_awarded == 0` enforces.
        require!(b.winners_awarded == 0, BountyV2Error::CannotCancelAfterAward);
    }
    refund_and_close(ctx, BountyStatus::Cancelled, 2)
}

// ─── 8. Close early (sponsor, no more awards) ───────────────────────────────

pub fn close_bounty(ctx: Context<CloseBountyCommon>) -> Result<()> {
    // [audit fix M-4] Accept either Open OR FullyAwarded.
    // FullyAwarded with leftover reward (when awards summed to less than
    // total_reward) needs a path to refund the remainder to the sponsor.
    let st = &ctx.accounts.bounty.status;
    require!(
        *st == BountyStatus::Open || *st == BountyStatus::FullyAwarded,
        BountyV2Error::BountyTerminalState
    );
    refund_and_close(ctx, BountyStatus::Closed, 0)
}

// ─── 9. Refund expired (anyone, post-deadline) ──────────────────────────────

pub fn refund_expired(ctx: Context<RefundExpiredCtx>) -> Result<()> {
    {
        let b = &ctx.accounts.bounty;
        require!(b.status == BountyStatus::Open, BountyV2Error::BountyNotOpen);
        // [audit fix round2 R2-BV2-M1] Apply a `REFUND_BUFFER_SECONDS`
        // grace period beyond `deadline` so a late-arriving submission
        // (e.g. submitted at `deadline - epsilon` validator-clock time)
        // doesn't get orphaned by a keeper racing the refund_expired call.
        // Solana validator clock can drift up to ~10 minutes; 60 seconds is
        // enough to absorb the common case while keeping the refund path
        // responsive.
        require!(
            Clock::get()?.unix_timestamp >= b.deadline.saturating_add(REFUND_BUFFER_SECONDS),
            BountyV2Error::BountyNotYetExpired
        );
    }

    let sponsor_key = ctx.accounts.bounty.sponsor;
    let bounty_id = ctx.accounts.bounty.id;
    let bounty_bump = ctx.accounts.bounty.bump;

    let id_bytes = bounty_id.to_le_bytes();
    let bump_arr = [bounty_bump];
    let seeds: [&[u8]; 4] = escrow_signer_seeds(&sponsor_key, &id_bytes, &bump_arr);
    let signer: &[&[&[u8]]] = &[&seeds];

    let remaining = ctx.accounts.escrow_token_account.amount;
    if remaining > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.sponsor_token_account.to_account_info(),
                    authority: ctx.accounts.bounty.to_account_info(),
                },
                signer,
            ),
            remaining,
        )?;
    }

    let bounty = &mut ctx.accounts.bounty;
    bounty.refunded_amount = bounty
        .refunded_amount
        .checked_add(remaining)
        .ok_or(BountyV2Error::Overflow)?;
    bounty.status = BountyStatus::Expired;

    emit!(BountyClosed {
        bounty: bounty.key(),
        refunded: remaining,
        reason: 1,
        slot: Clock::get()?.slot,
    });
    Ok(())
}

/// [audit fix M-1] On expiry-refund, the bounty PDA is closed and its rent
/// is returned to the original sponsor (NOT to the caller, even though the
/// caller is some random keeper). This preserves rent ownership.
#[derive(Accounts)]
pub struct RefundExpiredCtx<'info> {
    /// CHECK: sponsor pubkey only; we credit rent back to them.
    /// Validated via `bounty.sponsor == sponsor_rent_recipient.key()`.
    #[account(
        mut,
        constraint = sponsor_rent_recipient.key() == bounty.sponsor @ BountyV2Error::Unauthorized,
    )]
    pub sponsor_rent_recipient: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [
            BountyV2::SEED,
            bounty.sponsor.as_ref(),
            bounty.id.to_le_bytes().as_ref(),
        ],
        bump = bounty.bump,
        close = sponsor_rent_recipient,
    )]
    pub bounty: Account<'info, BountyV2>,

    #[account(
        mut,
        constraint = escrow_token_account.key() == bounty.escrow_account @ BountyV2Error::Unauthorized,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = sponsor_token_account.mint == bounty.payment_mint @ BountyV2Error::Unauthorized,
        constraint = sponsor_token_account.owner == bounty.sponsor @ BountyV2Error::Unauthorized,
    )]
    pub sponsor_token_account: Account<'info, TokenAccount>,

    /// Anyone can trigger this; no signer requirement on sponsor.
    #[account(mut)]
    pub caller: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

/// Shared helper: returns remaining escrow balance to sponsor and finalises state.
fn refund_and_close(ctx: Context<CloseBountyCommon>, new_status: BountyStatus, reason: u8) -> Result<()> {
    let sponsor_key = ctx.accounts.bounty.sponsor;
    let bounty_id = ctx.accounts.bounty.id;
    let bounty_bump = ctx.accounts.bounty.bump;

    let id_bytes = bounty_id.to_le_bytes();
    let bump_arr = [bounty_bump];
    let seeds: [&[u8]; 4] = escrow_signer_seeds(&sponsor_key, &id_bytes, &bump_arr);
    let signer: &[&[&[u8]]] = &[&seeds];

    let remaining = ctx.accounts.escrow_token_account.amount;

    if remaining > 0 {
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.sponsor_token_account.to_account_info(),
                    authority: ctx.accounts.bounty.to_account_info(),
                },
                signer,
            ),
            remaining,
        )?;
    }

    let bounty = &mut ctx.accounts.bounty;
    bounty.refunded_amount = bounty
        .refunded_amount
        .checked_add(remaining)
        .ok_or(BountyV2Error::Overflow)?;
    bounty.status = new_status;

    emit!(BountyClosed {
        bounty: bounty.key(),
        refunded: remaining,
        reason,
        slot: Clock::get()?.slot,
    });
    Ok(())
}

/// [audit fix M-1] On terminal close, the bounty PDA is closed and its
/// rent is returned to the sponsor. This avoids accumulating dead PDAs.
/// `cancel_bounty` / `close_bounty` require sponsor signature.
#[derive(Accounts)]
pub struct CloseBountyCommon<'info> {
    #[account(
        mut,
        seeds = [
            BountyV2::SEED,
            bounty.sponsor.as_ref(),
            bounty.id.to_le_bytes().as_ref(),
        ],
        bump = bounty.bump,
        has_one = sponsor @ BountyV2Error::Unauthorized,
        close = sponsor,
    )]
    pub bounty: Account<'info, BountyV2>,

    #[account(
        mut,
        constraint = escrow_token_account.key() == bounty.escrow_account @ BountyV2Error::Unauthorized,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = sponsor_token_account.mint == bounty.payment_mint @ BountyV2Error::Unauthorized,
        constraint = sponsor_token_account.owner == bounty.sponsor @ BountyV2Error::Unauthorized,
    )]
    pub sponsor_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub sponsor: Signer<'info>,
    pub token_program: Program<'info, Token>,
}
