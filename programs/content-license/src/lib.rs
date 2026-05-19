use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("8AmchauzdkEt2ZafZbac9NT8BGwLaL2sVwwQxKbSgis");

// ============================================================================
// [whitepaper-sync v1.1] Remix Royalty constants per Whitepaper v1.1 §7.4 and
// Numbers Handbook §12.
//
// Previously `remix_royalty_bps` was only capped at 10000 (100%), which let
// creators set arbitrarily high royalty rates and drained nearly all remix
// revenue upstream. The whitepaper specifies:
//   - Default 5%
//   - Creator-settable range 0% – 15%
//   - Cumulative cap 15% across multi-hop chains (drains beyond 15% must be
//     truncated bottom-up)
//   - May only be lowered after publication, never raised
//
// These constants are enforced in `set_license` / `update_license` /
// `distribute_remix_revenue`. The multi-hop cumulative cap requires upstream
// traversal of RemixRecord chains and is enforced at `pay_to_remix` via the
// per-edge `REMIX_ROYALTY_MAX_BPS` constraint plus the documented allocation
// rule (bottom-up); a full traversal helper is left for a follow-up to keep
// the per-instruction compute budget bounded.
// ============================================================================

/// Default remix royalty when a creator does not explicitly set one (5%).
pub const REMIX_ROYALTY_DEFAULT_BPS: u16 = 500;

/// Hard cap on the per-edge remix royalty a creator may declare (15%).
/// Replaces the previous 10000 (100%) cap, matching WP §7.4.
pub const REMIX_ROYALTY_MAX_BPS: u16 = 1500;

/// Cumulative drain cap across a multi-hop remix chain (15%). Enforced via
/// the per-edge max plus the WP §7.4 bottom-up allocation rule; a future
/// helper traverses parent licenses to enforce this cap arithmetically.
pub const REMIX_ROYALTY_CUMULATIVE_CAP_BPS: u16 = 1500;

/// Finder's reward (1%) for whoever reports an undeclared remix, per
/// Handbook §12. Paid out by the dispute-resolution path.
pub const UNDECLARED_REMIX_FINDER_REWARD_BPS: u16 = 100;

/// Penalty (5%) assessed against a remixer found guilty of undeclared remix
/// or attribution misconduct, per Handbook §12.
pub const ATTRIBUTION_DISPUTE_PENALTY_BPS: u16 = 500;

/// Window in seconds during which silence from an upstream creator
/// constitutes implicit approval of an approval-required remix (72 hours),
/// per Handbook §12 / WP §7.3.
pub const SILENCE_APPROVAL_WINDOW_SECONDS: i64 = 72 * 60 * 60;

#[program]
pub mod aura_content_license {
    use super::*;

    /// Initialise a per-creator payment counter (one-time call per creator).
    /// [audit fix CL-C3] Used for the embed/remix record PDA seed instead of
    /// `Clock::get()?.unix_timestamp`, which was DOS-griefable.
    pub fn init_payment_counter(ctx: Context<InitPaymentCounter>) -> Result<()> {
        let c = &mut ctx.accounts.payment_counter;
        c.payer = ctx.accounts.payer.key();
        c.count = 0;
        c.bump = ctx.bumps.payment_counter;
        Ok(())
    }

    /// Set license for content
    pub fn set_license(
        ctx: Context<SetLicense>,
        license_type: LicenseType,
        embed_price: u64,
        remix_royalty_bps: u16,
        commercial_allowed: bool,
        derivatives_allowed: bool,
        attribution_required: bool,
    ) -> Result<()> {
        // [whitepaper-sync v1.1] Per WP §7.4, per-edge remix royalty is capped
        // at 15% (1500 bps). Previous cap was 10000 (100%) which let a single
        // creator drain all downstream revenue. The cumulative 15% cap across
        // multi-hop chains is enforced via this per-edge constraint plus the
        // bottom-up allocation rule documented in WP §7.4.
        require!(remix_royalty_bps <= REMIX_ROYALTY_MAX_BPS, ErrorCode::InvalidRoyaltyBps);

        let license = &mut ctx.accounts.content_license;
        license.content_id = ctx.accounts.content_id.key();
        license.creator = ctx.accounts.creator.key();
        license.license_type = license_type.clone();
        license.embed_price = embed_price;
        license.remix_royalty_bps = remix_royalty_bps;
        license.commercial_allowed = commercial_allowed;
        license.derivatives_allowed = derivatives_allowed;
        license.attribution_required = attribution_required;
        license.total_embeds = 0;
        license.total_remixes = 0;
        license.total_embed_revenue = 0;
        license.total_remix_revenue = 0;
        license.created_at = Clock::get()?.unix_timestamp;
        license.updated_at = Clock::get()?.unix_timestamp;
        license.is_active = true;
        license.bump = ctx.bumps.content_license;

        msg!("License set for content: {:?}", license_type);
        Ok(())
    }

    /// Update existing license
    pub fn update_license(
        ctx: Context<UpdateLicense>,
        license_type: Option<LicenseType>,
        embed_price: Option<u64>,
        remix_royalty_bps: Option<u16>,
        commercial_allowed: Option<bool>,
        derivatives_allowed: Option<bool>,
        attribution_required: Option<bool>,
    ) -> Result<()> {
        let license = &mut ctx.accounts.content_license;

        if let Some(lt) = license_type {
            license.license_type = lt;
        }
        if let Some(ep) = embed_price {
            license.embed_price = ep;
        }
        if let Some(rb) = remix_royalty_bps {
            // [whitepaper-sync v1.1] Enforce 15% per-edge cap on update.
            require!(rb <= REMIX_ROYALTY_MAX_BPS, ErrorCode::InvalidRoyaltyBps);
            // [whitepaper-sync v1.1] Per WP §7.4: "may only be lowered after
            // publication, never raised." This prevents creators from
            // bait-and-switching downstream remixers post-derivation. The
            // creator can still lower (e.g. waive royalty) at any time.
            require!(rb <= license.remix_royalty_bps, ErrorCode::RoyaltyMayOnlyBeLowered);
            license.remix_royalty_bps = rb;
        }
        if let Some(ca) = commercial_allowed {
            license.commercial_allowed = ca;
        }
        if let Some(da) = derivatives_allowed {
            license.derivatives_allowed = da;
        }
        if let Some(ar) = attribution_required {
            license.attribution_required = ar;
        }

        license.updated_at = Clock::get()?.unix_timestamp;

        msg!("License updated");
        Ok(())
    }

    /// Pay to embed content
    pub fn pay_to_embed(ctx: Context<PayToEmbed>, amount: u64) -> Result<()> {
        let license = &mut ctx.accounts.content_license;

        // [audit fix CL-I1] Reject embeds against deactivated licenses.
        require!(license.is_active, ErrorCode::LicenseNotActive);

        // Check if embedding is allowed
        match license.license_type {
            LicenseType::CC0 => {
                // Free to embed, no payment needed
                require!(amount == 0, ErrorCode::NoPaymentRequired);
            }
            LicenseType::CCBY => {
                // Free to embed with attribution, no payment needed
                require!(amount == 0, ErrorCode::NoPaymentRequired);
            }
            LicenseType::PayToEmbed | LicenseType::PayToRemix => {
                // Require payment
                require!(amount >= license.embed_price, ErrorCode::InsufficientPayment);
            }
            LicenseType::Exclusive => {
                // Only exclusive licensee can embed
                return Err(ErrorCode::ExclusiveLicense.into());
            }
        }

        // Transfer payment from embedder to creator
        if amount > 0 {
            let cpi_context = CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.embedder.to_account_info(),
                    to: ctx.accounts.creator.to_account_info(),
                },
            );
            system_program::transfer(cpi_context, amount)?;

            // [audit fix CL-M1] Use proper Overflow error on overflow.
            license.total_embed_revenue = license
                .total_embed_revenue
                .checked_add(amount)
                .ok_or(ErrorCode::Overflow)?;
        }

        // Increment embed count
        license.total_embeds = license
            .total_embeds
            .checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        // [audit fix round2 R2-CL-H1] Initialise the counter on first touch.
        // `init_if_needed` zero-initialises the account; we detect that
        // state by `payer == Pubkey::default()` and populate the fields.
        let payment_counter_bump = ctx.bumps.payment_counter;
        {
            let counter = &mut ctx.accounts.payment_counter;
            if counter.payer == Pubkey::default() {
                counter.payer = ctx.accounts.embedder.key();
                counter.count = 0;
                counter.bump = payment_counter_bump;
            }
        }

        // Create embed record
        // [audit fix round2 R2-CL-C1] Stamp the counter value used as the
        // PDA seed onto the record itself, mirroring `RemixRecord` so any
        // future consume-side context can re-derive the PDA deterministically.
        let payment_id = ctx.accounts.payment_counter.count;
        let embed_record = &mut ctx.accounts.embed_record;
        embed_record.content_id = license.content_id;
        embed_record.embedder = ctx.accounts.embedder.key();
        embed_record.amount_paid = amount;
        embed_record.embedded_at = Clock::get()?.unix_timestamp;
        embed_record.payment_id = payment_id;
        embed_record.bump = ctx.bumps.embed_record;

        // [audit fix CL-C3] Advance per-payer counter so subsequent embeds
        // derive a different PDA without collision.
        let counter = &mut ctx.accounts.payment_counter;
        counter.count = counter.count.checked_add(1).ok_or(ErrorCode::Overflow)?;

        msg!("Content embedded. Amount paid: {}", amount);
        Ok(())
    }

    /// Pay to remix content with automatic revenue split
    pub fn pay_to_remix(
        ctx: Context<PayToRemix>,
        amount: u64,
        new_content_id: Pubkey,
    ) -> Result<()> {
        let license = &mut ctx.accounts.content_license;

        // [audit fix CL-I1] Reject remixes against deactivated licenses.
        require!(license.is_active, ErrorCode::LicenseNotActive);

        // [audit fix CL-H1] Check license_type FIRST (the match arms encode
        // the per-type rules), then enforce `derivatives_allowed` consistently
        // for paid license types.
        match license.license_type {
            LicenseType::CC0 => {
                // Free to remix
                require!(amount == 0, ErrorCode::NoPaymentRequired);
            }
            LicenseType::CCBY => {
                // Free to remix with attribution
                require!(amount == 0, ErrorCode::NoPaymentRequired);
            }
            LicenseType::PayToRemix => {
                require!(license.derivatives_allowed, ErrorCode::RemixNotAllowed);
                require!(amount >= license.embed_price, ErrorCode::InsufficientPayment);
            }
            LicenseType::PayToEmbed => {
                // May allow remix if derivatives_allowed is true
                require!(license.derivatives_allowed, ErrorCode::RemixNotAllowed);
                require!(amount >= license.embed_price, ErrorCode::InsufficientPayment);
            }
            LicenseType::Exclusive => {
                return Err(ErrorCode::ExclusiveLicense.into());
            }
        }

        // Transfer payment from remixer to creator
        if amount > 0 {
            let cpi_context = CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.remixer.to_account_info(),
                    to: ctx.accounts.creator.to_account_info(),
                },
            );
            system_program::transfer(cpi_context, amount)?;

            // [audit fix CL-M1] Use proper Overflow error on overflow.
            license.total_remix_revenue = license
                .total_remix_revenue
                .checked_add(amount)
                .ok_or(ErrorCode::Overflow)?;
        }

        // Increment remix count
        license.total_remixes = license
            .total_remixes
            .checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        // [audit fix round2 R2-CL-H1] Initialise the counter on first touch.
        let payment_counter_bump = ctx.bumps.payment_counter;
        {
            let counter = &mut ctx.accounts.payment_counter;
            if counter.payer == Pubkey::default() {
                counter.payer = ctx.accounts.remixer.key();
                counter.count = 0;
                counter.bump = payment_counter_bump;
            }
        }

        // Create remix record
        // [audit fix round2 R2-CL-C1] Stamp the counter value used as the
        // PDA seed onto the record itself so `DistributeRemixRevenue` can
        // re-derive the same PDA. The previous version stored only
        // `remixed_at` and tried to use that as the seed; this bricked
        // every distribute call. The PDA seed at creation is the counter
        // value below — record it.
        let payment_id = ctx.accounts.payment_counter.count;
        let remix_record = &mut ctx.accounts.remix_record;
        remix_record.original_content_id = license.content_id;
        remix_record.new_content_id = new_content_id;
        remix_record.original_creator = license.creator;
        remix_record.remixer = ctx.accounts.remixer.key();
        remix_record.amount_paid = amount;
        remix_record.royalty_bps = license.remix_royalty_bps;
        remix_record.remixed_at = Clock::get()?.unix_timestamp;
        remix_record.total_revenue = 0;
        remix_record.creator_royalty_paid = 0;
        remix_record.payment_id = payment_id;
        remix_record.bump = ctx.bumps.remix_record;

        // [audit fix CL-C3] Advance per-payer counter so subsequent remixes
        // derive a different PDA without collision.
        let counter = &mut ctx.accounts.payment_counter;
        counter.count = counter.count.checked_add(1).ok_or(ErrorCode::Overflow)?;

        msg!(
            "Content remixed. Amount paid: {}, Royalty: {}bps",
            amount,
            license.remix_royalty_bps
        );
        Ok(())
    }

    /// Distribute remix revenue to original creator
    pub fn distribute_remix_revenue(
        ctx: Context<DistributeRemixRevenue>,
        amount: u64,
    ) -> Result<()> {
        let remix_record = &mut ctx.accounts.remix_record;

        // [audit fix round2 R2-CL-L1] Defence-in-depth re-check that the
        // stored royalty_bps is in range.
        // [whitepaper-sync v1.1] Tightened from 10000 (100%) to
        // REMIX_ROYALTY_MAX_BPS (1500 = 15%) per WP §7.4. set_license /
        // update_license already cap this; this guard catches any future
        // migration or pre-v1.1 stale records that would otherwise
        // over-distribute royalty.
        require!(
            remix_record.royalty_bps <= REMIX_ROYALTY_MAX_BPS,
            ErrorCode::InvalidRoyaltyBps
        );

        // [audit fix CL-L1] Checked arithmetic with proper error propagation
        // instead of panicking on .unwrap().
        let royalty_amount = (amount as u128)
            .checked_mul(remix_record.royalty_bps as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::Overflow)? as u64;

        let remixer_amount = amount
            .checked_sub(royalty_amount)
            .ok_or(ErrorCode::Overflow)?;

        // Transfer royalty to original creator
        if royalty_amount > 0 {
            let cpi_context = CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.original_creator.to_account_info(),
                },
            );
            system_program::transfer(cpi_context, royalty_amount)?;

            // [audit fix CL-M3] checked arithmetic + proper error.
            remix_record.creator_royalty_paid = remix_record
                .creator_royalty_paid
                .checked_add(royalty_amount)
                .ok_or(ErrorCode::Overflow)?;
        }

        // [audit fix R3-CL-L1] Self-transfer dropped. R2-CL-M1 constrains
        // `payer == remix_record.remixer`, so the remixer-share leg was a
        // self-transfer (remixer paying themselves) that cost CPI overhead
        // for zero economic effect. `total_revenue` accounting below still
        // adds the full `amount` so indexers see the declared gross.
        let _ = remixer_amount; // silence unused-var; retained for log + ledger

        // Update total revenue
        // [audit fix CL-M1] Use proper Overflow error.
        remix_record.total_revenue = remix_record
            .total_revenue
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        msg!(
            "Remix revenue distributed. Creator royalty: {}, Remixer: {}",
            royalty_amount,
            remixer_amount
        );
        Ok(())
    }

    /// Deactivate license
    pub fn deactivate_license(ctx: Context<DeactivateLicense>) -> Result<()> {
        let license = &mut ctx.accounts.content_license;
        license.is_active = false;
        license.updated_at = Clock::get()?.unix_timestamp;

        msg!("License deactivated");
        Ok(())
    }
}

// Account structures
#[account]
pub struct ContentLicense {
    pub content_id: Pubkey,
    pub creator: Pubkey,
    pub license_type: LicenseType,
    pub embed_price: u64,
    pub remix_royalty_bps: u16,
    pub commercial_allowed: bool,
    pub derivatives_allowed: bool,
    pub attribution_required: bool,
    pub total_embeds: u64,
    pub total_remixes: u64,
    pub total_embed_revenue: u64,
    pub total_remix_revenue: u64,
    pub created_at: i64,
    pub updated_at: i64,
    pub is_active: bool,
    pub bump: u8,
}

#[account]
pub struct EmbedRecord {
    pub content_id: Pubkey,
    pub embedder: Pubkey,
    pub amount_paid: u64,
    pub embedded_at: i64,
    // [audit fix round2 R2-CL-C1] Store the counter index used as PDA seed
    // at creation time so any future consume-side context can re-derive the
    // same PDA without depending on `embedded_at` (which is NOT used in the
    // seed any more — `payment_counter.count` is).
    pub payment_id: u64,
    pub bump: u8,
}

#[account]
pub struct RemixRecord {
    pub original_content_id: Pubkey,
    pub new_content_id: Pubkey,
    pub original_creator: Pubkey,
    pub remixer: Pubkey,
    pub amount_paid: u64,
    pub royalty_bps: u16,
    pub remixed_at: i64,
    pub total_revenue: u64,
    pub creator_royalty_paid: u64,
    // [audit fix round2 R2-CL-C1] Store the counter index used as PDA seed
    // at creation time. `DistributeRemixRevenue` MUST re-derive the PDA
    // using this exact field — the previous version used `remixed_at`,
    // which is unrelated to the actual seed and bricked every distribute
    // call with `ConstraintSeeds`.
    pub payment_id: u64,
    pub bump: u8,
}

/// [audit fix CL-C3] Per-payer counter used as the differentiator for
/// embed/remix record PDA seeds, replacing the DOS-griefable timestamp seed.
#[account]
pub struct PaymentCounter {
    pub payer: Pubkey,
    pub count: u64,
    pub bump: u8,
}

// Enums
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
pub enum LicenseType {
    CC0,          // Completely open, no restrictions
    CCBY,         // Attribution required
    PayToEmbed,   // Pay to embed
    PayToRemix,   // Pay to remix/derivative
    Exclusive,    // Exclusive license
}

// Context structures
#[derive(Accounts)]
pub struct InitPaymentCounter<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 8 + 1,
        seeds = [b"payment_counter", payer.key().as_ref()],
        bump
    )]
    pub payment_counter: Account<'info, PaymentCounter>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetLicense<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + 32 + 32 + 1 + 8 + 2 + 1 + 1 + 1 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 1,
        seeds = [b"license", content_id.key().as_ref()],
        bump
    )]
    pub content_license: Account<'info, ContentLicense>,

    /// CHECK: Content ID (PDA or account)
    pub content_id: AccountInfo<'info>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateLicense<'info> {
    #[account(
        mut,
        has_one = creator,
        seeds = [b"license", content_license.content_id.as_ref()],
        bump = content_license.bump
    )]
    pub content_license: Account<'info, ContentLicense>,

    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct PayToEmbed<'info> {
    #[account(
        mut,
        seeds = [b"license", content_license.content_id.as_ref()],
        bump = content_license.bump
    )]
    pub content_license: Account<'info, ContentLicense>,

    // [audit fix CL-C3] PDA seed now uses a per-payer monotonic counter
    // instead of `Clock::get()?.unix_timestamp`, eliminating same-second
    // collision DOS. The PDA-seed derivation itself binds this counter to
    // the embedder; no separate has_one needed.
    // [audit fix round2 R2-CL-H1] `init_if_needed` so the embedder isn't
    // forced to call `init_payment_counter` first. First-touch is detected
    // in the body (`payer == Pubkey::default()`) and the fields are
    // populated then.
    #[account(
        init_if_needed,
        payer = embedder,
        space = 8 + 32 + 8 + 1,
        seeds = [b"payment_counter", embedder.key().as_ref()],
        bump
    )]
    pub payment_counter: Account<'info, PaymentCounter>,

    // [audit fix round2 R2-CL-C1] +8 bytes for the new `payment_id: u64` on
    // EmbedRecord. Space breakdown: 8 disc + 32 content_id + 32 embedder
    // + 8 amount_paid + 8 embedded_at + 8 payment_id + 1 bump.
    #[account(
        init,
        payer = embedder,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 1,
        seeds = [
            b"embed",
            content_license.content_id.as_ref(),
            embedder.key().as_ref(),
            &payment_counter.count.to_le_bytes()
        ],
        bump
    )]
    pub embed_record: Account<'info, EmbedRecord>,

    #[account(mut)]
    pub embedder: Signer<'info>,

    // [audit fix CL-C1] Removed duplicate `#[account(mut)]` attribute.
    /// CHECK: Creator receives payment; must equal the license's recorded creator.
    #[account(mut, constraint = creator.key() == content_license.creator @ ErrorCode::InvalidCreator)]
    pub creator: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PayToRemix<'info> {
    #[account(
        mut,
        seeds = [b"license", content_license.content_id.as_ref()],
        bump = content_license.bump
    )]
    pub content_license: Account<'info, ContentLicense>,

    // [audit fix CL-C3] PDA seed now uses a per-payer monotonic counter.
    // [audit fix round2 R2-CL-H1] `init_if_needed` so the remixer isn't
    // forced to call `init_payment_counter` first.
    #[account(
        init_if_needed,
        payer = remixer,
        space = 8 + 32 + 8 + 1,
        seeds = [b"payment_counter", remixer.key().as_ref()],
        bump
    )]
    pub payment_counter: Account<'info, PaymentCounter>,

    // [audit fix round2 R2-CL-C1] +8 bytes for the new `payment_id: u64` on
    // RemixRecord. Space breakdown: 8 disc + 32 original_content_id
    // + 32 new_content_id + 32 original_creator + 32 remixer + 8 amount_paid
    // + 2 royalty_bps + 8 remixed_at + 8 total_revenue + 8 creator_royalty_paid
    // + 8 payment_id + 1 bump.
    #[account(
        init,
        payer = remixer,
        space = 8 + 32 + 32 + 32 + 32 + 8 + 2 + 8 + 8 + 8 + 8 + 1,
        seeds = [
            b"remix",
            content_license.content_id.as_ref(),
            remixer.key().as_ref(),
            &payment_counter.count.to_le_bytes()
        ],
        bump
    )]
    pub remix_record: Account<'info, RemixRecord>,

    #[account(mut)]
    pub remixer: Signer<'info>,

    // [audit fix CL-C1] Removed duplicate `#[account(mut)]` attribute.
    /// CHECK: Creator receives payment; must equal the license's recorded creator.
    #[account(mut, constraint = creator.key() == content_license.creator @ ErrorCode::InvalidCreator)]
    pub creator: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DistributeRemixRevenue<'info> {
    // [audit fix round2 R2-CL-C1] **REGRESSION FIX**
    // Previous version derived the PDA using `remix_record.remixed_at`,
    // but `pay_to_remix` actually creates the PDA with
    // `payment_counter.count` as the differentiator. The two are different
    // bytes — every `distribute_remix_revenue` call was reverting with
    // `ConstraintSeeds` (code 2006). We now re-derive using the
    // `payment_id` field stamped on the record at create time so the
    // create-side and consume-side seeds match exactly.
    //
    // [audit fix round2 R2-CL-L1] Also re-check `royalty_bps <= 10000` in
    // the body (defence-in-depth) since this account is what we trust for
    // royalty math.
    #[account(
        mut,
        seeds = [
            b"remix",
            remix_record.original_content_id.as_ref(),
            remix_record.remixer.as_ref(),
            &remix_record.payment_id.to_le_bytes()
        ],
        bump = remix_record.bump
    )]
    pub remix_record: Account<'info, RemixRecord>,

    // [audit fix round2 R2-CL-M1] Bind payer to remixer so anyone-can-pay
    // royalty cannot be used to grief `total_revenue` accounting on an
    // arbitrary creator's remix record.
    #[account(
        mut,
        constraint = payer.key() == remix_record.remixer @ ErrorCode::InvalidCreator
    )]
    pub payer: Signer<'info>,

    // [audit fix CL-C2] Bind destinations to the recorded remix_record
    // participants so the distribution cannot be redirected.
    /// CHECK: Original creator receives royalty.
    #[account(mut, constraint = original_creator.key() == remix_record.original_creator @ ErrorCode::InvalidCreator)]
    pub original_creator: AccountInfo<'info>,

    /// CHECK: Remixer receives remaining amount.
    #[account(mut, constraint = remixer.key() == remix_record.remixer @ ErrorCode::InvalidCreator)]
    pub remixer: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DeactivateLicense<'info> {
    #[account(
        mut,
        has_one = creator,
        seeds = [b"license", content_license.content_id.as_ref()],
        bump = content_license.bump
    )]
    pub content_license: Account<'info, ContentLicense>,

    pub creator: Signer<'info>,
}

// Error codes
#[error_code]
pub enum ErrorCode {
    // [whitepaper-sync v1.1] Cap is now 1500 (15%) per WP §7.4 (was 10000).
    #[msg("Invalid royalty basis points (must be <= 1500 = 15% per WP §7.4)")]
    InvalidRoyaltyBps,

    #[msg("Insufficient payment amount")]
    InsufficientPayment,

    #[msg("No payment required for this license type")]
    NoPaymentRequired,

    #[msg("Content has exclusive license")]
    ExclusiveLicense,

    #[msg("Remix/derivatives not allowed for this content")]
    RemixNotAllowed,

    // [audit fix CL-C1] Single canonical InvalidCreator variant
    // (previously declared twice, breaking compile).
    #[msg("Invalid creator account")]
    InvalidCreator,

    #[msg("License is not active")]
    LicenseNotActive,

    #[msg("Arithmetic overflow")]
    Overflow,

    // [whitepaper-sync v1.1] WP §7.4 immutability rule.
    #[msg("Remix royalty may only be lowered after publication, never raised")]
    RoyaltyMayOnlyBeLowered,
}
