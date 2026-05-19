use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("DimxL8QLZ5xPrq4igyuZbU52cfL81eVzEoani45Z63h7");

// [audit fix C-H1 / C-1 / C-2] Hardcoded admin / deposit authority.
// ⚠️ DO NOT DEPLOY — placeholder; replace with the real protocol multisig
// before mainnet deploy.
// [local-deploy 2026-05-19] real address on localnet: DppCZV1QDh6D4hoUJvpQCjiZ5KCjV4YTokUGsu7m4bxP
pub const POOL_INITIALIZER: Pubkey = Pubkey::new_from_array([190, 139, 232, 217, 216, 167, 202, 133, 100, 57, 237, 31, 194, 128, 82, 13, 164, 131, 226, 139, 206, 103, 215, 221, 251, 39, 85, 246, 98, 109, 149, 76]);
// [local-deploy 2026-05-19] real address on localnet: DppCZV1QDh6D4hoUJvpQCjiZ5KCjV4YTokUGsu7m4bxP
pub const POOL_DEPOSITOR: Pubkey = Pubkey::new_from_array([190, 139, 232, 217, 216, 167, 202, 133, 100, 57, 237, 31, 194, 128, 82, 13, 164, 131, 226, 139, 206, 103, 215, 221, 251, 39, 85, 246, 98, 109, 149, 76]);
// [local-deploy 2026-05-19] real address on localnet: DppCZV1QDh6D4hoUJvpQCjiZ5KCjV4YTokUGsu7m4bxP
pub const PROGRAM_ADMIN: Pubkey = Pubkey::new_from_array([190, 139, 232, 217, 216, 167, 202, 133, 100, 57, 237, 31, 194, 128, 82, 13, 164, 131, 226, 139, 206, 103, 215, 221, 251, 39, 85, 246, 98, 109, 149, 76]);

/// [whitepaper-sync v1.1] Hardcoded ORA mint required for the per-curation
/// 1 ORA cost gate and the 100-ORA sybil-holding floor introduced by
/// Handbook §10. Placeholder = System Program ID until mainnet wiring.
/// PRE-MAINNET TODO: replace with the canonical aura_ora SPL mint.
// [local-deploy 2026-05-19] real address on localnet: AE2saLnjj8u9RGQyftYw4wLX5wR2HbJ3byb1t97CdF8s
pub const ORA_MINT: Pubkey = Pubkey::new_from_array([137, 15, 217, 121, 122, 4, 82, 92, 100, 203, 47, 28, 205, 45, 150, 226, 133, 111, 232, 149, 62, 3, 156, 144, 35, 103, 3, 130, 149, 120, 102, 80]);

/// [whitepaper-sync v1.1] Hardcoded ORA sink token account that receives the
/// 1-ORA-per-curation cost (Handbook §10 anti-sybil). At mainnet this should
/// be the protocol curator-reward pool ATA (the same account that funds the
/// 10,000 ORA / day Curator Reward Pool) so per-curation costs cycle directly
/// back into curator rewards. Placeholder = System Program ID until wired.
// [local-deploy 2026-05-19] real address on localnet: DppCZV1QDh6D4hoUJvpQCjiZ5KCjV4YTokUGsu7m4bxP
pub const CURATION_FEE_SINK: Pubkey = Pubkey::new_from_array([190, 139, 232, 217, 216, 167, 202, 133, 100, 57, 237, 31, 194, 128, 82, 13, 164, 131, 226, 139, 206, 103, 215, 221, 251, 39, 85, 246, 98, 109, 149, 76]);

// [audit fix round2 C2.C-2] Hardcoded core-program ID used to validate that
// `content` AccountInfos passed in are actual `Post` accounts owned by the
// AURA core program. This decouples curation from Anchor's automatic
// Account<T> owner-check (which would reject cross-program owned accounts).
//
// The bytes below are the base58 decoding of the core program's declared id
// `Ho5Ent8c2D6eLAZuyW16iUekqMmpfqzoTspXbMQqa9JN`. Encoded inline as a byte
// array so this works on every Anchor version regardless of the `pubkey!`
// macro re-export path.
pub const AURA_CORE_PROGRAM_ID: Pubkey = Pubkey::new_from_array([
    249, 136, 127, 236, 233, 91, 129, 129, 249, 148, 44, 109, 143, 101, 137, 184,
    67, 172, 164, 42, 73, 138, 152, 181, 220, 26, 81, 60, 26, 27, 110, 151,
]);

// ─── Whitepaper §10 / Handbook §10 constants ────────────────────────────
// [whitepaper-sync v1.1] Replaces the previous time-decay model
// (10x / 5x / 2x / 1x / 0.1x at 1h / 6h / 24h / 72h / 72h+) with the
// canonical Handbook §10 two-factor model: discovery weight × curator-rank
// weight. All weights are scaled by `WEIGHT_SCALE = 100` so we can keep
// integer arithmetic and represent fractional multipliers like 1.5×.
//
//  Curation Score = follower_multiplier × curator_rank_multiplier
//  Theoretical max combined:  5 × 5 = 25× (1st curator on <100-follower creator)
//  Theoretical min:           0.5×        (501st+ on >100K-follower creator,
//                                          per Handbook §10 — "0.5×" is the
//                                          published floor; combined math
//                                          actually yields 0.25× but
//                                          Handbook wins per audit memo)

pub const WEIGHT_SCALE: u64 = 100;

/// Per-curation cost (Handbook §10 — anti-sybil). 1 ORA = 1 * 10^9 base units.
/// Charged in ORA SPL tokens, transferred from the curator's ATA to
/// `CURATION_FEE_SINK`. Tier-III adjustable per WP §19.5.
pub const PER_CURATION_COST_RAW: u64 = 1_000_000_000;

/// Minimum ORA balance a wallet must hold to curate (Handbook §10 sybil
/// threshold = 100 ORA). Checked against the curator's ATA balance at
/// `curate` time. Tier-II per WP §19.4.
pub const MIN_CURATOR_HOLDING_RAW: u64 = 100 * 1_000_000_000;

/// Daily reward-pool sizes (documented for indexers / off-chain settlement
/// driver — these are NOT enforced by this program because the curation
/// reward pool is funded externally via `deposit_to_pool`. Handbook §10).
pub const CURATOR_DAILY_POOL_ORA: u64 = 10_000 * 1_000_000_000;
pub const CREATOR_DAILY_POOL_ORA: u64 = 10_000 * 1_000_000_000;

#[program]
pub mod aura_curation {
    use super::*;

    /// Initialize a curation pool for a content.
    ///
    /// [whitepaper-sync v1.1] now takes `creator_follower_count` so the pool
    /// can pre-compute the canonical Handbook §10 "Discovery Weight" tier
    /// once at init time (instead of the previous time-since-publish model).
    /// The follower count is captured at pool-init time and intentionally
    /// frozen for the life of the pool — this is the "burst at publish" the
    /// Handbook §10 model rewards.
    ///
    /// [audit fix C-H1] gated to POOL_INITIALIZER.
    /// [audit fix C-2] also initializes the reward_vault as a program-owned PDA.
    /// [audit fix round2 C2.C-2] `content` is UncheckedAccount + manual decode.
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        creator_follower_count: u64,
    ) -> Result<()> {
        // [audit fix round2 C2.C-2] manually decode the core-owned Post
        let content_info = &ctx.accounts.content;
        let core_post = decode_core_post(content_info)?;

        let pool = &mut ctx.accounts.curation_pool;
        pool.content_id = content_info.key();
        pool.content_publish_time = core_post.created_at;
        pool.total_pool = 0;
        pool.total_weight = 0;
        pool.curators_count = 0;
        pool.is_settled = false;
        pool.bump = ctx.bumps.curation_pool;
        // [audit fix round2 C2.M-1] settle_total_pool is set during settle_pool
        pool.settle_total_pool = 0;
        // [whitepaper-sync v1.1] follower count drives the discovery-weight tier
        pool.creator_follower_count = creator_follower_count;
        pool.creator_author = core_post.author;

        msg!(
            "Curation pool initialized for content: {} (creator followers: {})",
            pool.content_id,
            creator_follower_count
        );
        Ok(())
    }

    /// Curate content.
    ///
    /// [whitepaper-sync v1.1] **Replaces the time-decay model with the
    /// Handbook §10 two-factor model**:
    ///   Curation Score = Discovery Weight (by follower count)
    ///                  × Curator Rank Weight (order of curation)
    /// Also enforces:
    ///   - Per-curation cost of 1 ORA (transferred to CURATION_FEE_SINK)
    ///   - Sybil floor: curator's ORA ATA balance ≥ 100 ORA
    ///
    /// [audit fix C-H2] disallow self-curation
    /// [audit fix C-H3] no cross-program mutation of `content.likes`
    /// [audit fix round2 C2.C-2] `content` is UncheckedAccount + manual decode
    pub fn curate(ctx: Context<Curate>) -> Result<()> {
        let clock = Clock::get()?;

        let pool = &mut ctx.accounts.curation_pool;
        let record = &mut ctx.accounts.curation_record;

        require!(!pool.is_settled, ErrorCode::PoolAlreadySettled);

        // [audit fix round2 C2.C-2 + C2.H-2] decode core-owned Post + self-curation check
        let content_info = &ctx.accounts.content;
        let core_post = decode_core_post(content_info)?;
        require!(
            ctx.accounts.curator.key() != core_post.author,
            ErrorCode::SelfCurationForbidden
        );

        // [whitepaper-sync v1.1] enforce 100-ORA sybil holding floor
        let curator_token = &ctx.accounts.curator_ora_account;
        require!(
            curator_token.mint == ORA_MINT,
            ErrorCode::InvalidOraMint
        );
        require!(
            curator_token.owner == ctx.accounts.curator.key(),
            ErrorCode::InvalidOraOwner
        );
        require!(
            curator_token.amount >= MIN_CURATOR_HOLDING_RAW,
            ErrorCode::BelowSybilThreshold
        );

        // [whitepaper-sync v1.1] charge 1 ORA per curation (anti-sybil).
        // Transferred to CURATION_FEE_SINK (typically the curator-reward
        // pool ATA so costs recycle into rewards).
        let fee_sink = &ctx.accounts.curation_fee_sink;
        require!(
            fee_sink.key() == CURATION_FEE_SINK,
            ErrorCode::InvalidFeeSink
        );
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: curator_token.to_account_info(),
                    to: fee_sink.to_account_info(),
                    authority: ctx.accounts.curator.to_account_info(),
                },
            ),
            PER_CURATION_COST_RAW,
        )?;

        // [whitepaper-sync v1.1] curator rank = 1-indexed position in this pool
        let curator_rank = pool
            .curators_count
            .checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        // Compute Handbook §10 weight = discovery × curator-rank (× WEIGHT_SCALE^2 / WEIGHT_SCALE)
        let discovery_w = discovery_weight(pool.creator_follower_count);
        let rank_w = curator_rank_weight(curator_rank);
        // weight = discovery_w * rank_w / WEIGHT_SCALE  (one descale; the
        // remaining factor of 100 is the on-chain integer precision).
        let curation_weight = (discovery_w as u128)
            .checked_mul(rank_w as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(WEIGHT_SCALE as u128)
            .ok_or(ErrorCode::Overflow)? as u64;
        require!(curation_weight > 0, ErrorCode::ZeroWeight);

        // Update curation record
        record.curator = ctx.accounts.curator.key();
        record.content_id = content_info.key();
        record.curated_at = clock.unix_timestamp;
        record.content_publish_time = pool.content_publish_time;
        // [whitepaper-sync v1.1] field repurposed: stores curator rank (was time_delta)
        record.curator_rank = curator_rank;
        record.curation_weight = curation_weight;
        record.reward_claimed = 0;
        record.bump = ctx.bumps.curation_record;

        // Update pool statistics
        pool.total_weight = pool
            .total_weight
            .checked_add(curation_weight)
            .ok_or(ErrorCode::Overflow)?;
        pool.curators_count = curator_rank;

        msg!(
            "Curated by {} rank #{} (discovery {}× rank {}× / scaled {})",
            record.curator,
            curator_rank,
            discovery_w,
            rank_w,
            curation_weight
        );
        Ok(())
    }

    /// Deposit rewards to curation pool.
    /// [audit fix C-1] real ORA token transfer.
    /// [audit fix M-CR-1] SOL→ORA pool denomination per Handbook §10 — the
    /// 10K + 10K daily curator/creator reward pools are denominated in ORA,
    /// not SOL. Deposits now flow from the depositor's ORA ATA into a
    /// program-owned ORA TokenAccount PDA via SPL `token::transfer`.
    pub fn deposit_to_pool(ctx: Context<DepositToPool>, amount: u64) -> Result<()> {
        let pool = &mut ctx.accounts.curation_pool;

        require!(!pool.is_settled, ErrorCode::PoolAlreadySettled);
        require!(amount > 0, ErrorCode::InvalidAmount);

        // [audit fix M-CR-1] mint binding defense-in-depth. The Accounts
        // context already constrains the depositor + vault to the ORA mint;
        // re-check here in case future refactors loosen one constraint.
        require!(
            ctx.accounts.depositor_ora_account.mint == ORA_MINT
                && ctx.accounts.reward_vault.mint == ORA_MINT,
            ErrorCode::InvalidOraMint
        );
        require!(
            ctx.accounts.depositor_ora_account.owner == ctx.accounts.depositor.key(),
            ErrorCode::InvalidOraOwner
        );

        // [audit fix M-CR-1] SPL token transfer (was system_program::Transfer).
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.depositor_ora_account.to_account_info(),
                    to: ctx.accounts.reward_vault.to_account_info(),
                    authority: ctx.accounts.depositor.to_account_info(),
                },
            ),
            amount,
        )?;

        pool.total_pool = pool
            .total_pool
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        msg!(
            "Deposited {} ORA atomic units to curation pool vault (pool total now {})",
            amount,
            pool.total_pool
        );
        Ok(())
    }

    /// Claim curation rewards.
    /// [audit fix C-2 / round2 C2.C-1 / C2.H-1 / C2.M-1] see comments below.
    /// [audit fix M-CR-1] SOL→ORA pool denomination per Handbook §10. Claims
    /// now move ORA from the program-owned reward_vault token account to the
    /// curator's ORA ATA via SPL `token::transfer` signed by the vault PDA.
    pub fn claim_curation_reward(ctx: Context<ClaimCurationReward>) -> Result<()> {
        let pool = &mut ctx.accounts.curation_pool;
        let record = &mut ctx.accounts.curation_record;

        require!(pool.is_settled, ErrorCode::PoolNotSettled);
        require!(pool.total_pool > 0, ErrorCode::NoRewardsAvailable);
        require!(pool.total_weight > 0, ErrorCode::NoWeightInPool);
        require!(record.reward_claimed == 0, ErrorCode::AlreadyClaimed);

        let denom_pool = if pool.settle_total_pool > 0 {
            pool.settle_total_pool
        } else {
            pool.total_pool
        };
        let reward_amount = (record.curation_weight as u128)
            .checked_mul(denom_pool as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(pool.total_weight as u128)
            .ok_or(ErrorCode::NoWeightInPool)? as u64;

        require!(reward_amount > 0, ErrorCode::NoRewardsAvailable);

        // [audit fix M-CR-1] vault balance check on the ORA TokenAccount.
        let vault_balance = ctx.accounts.reward_vault.amount;
        require!(vault_balance >= reward_amount, ErrorCode::NoRewardsAvailable);

        // [audit fix M-CR-1] curator destination ATA must be ORA + owned by curator.
        require!(
            ctx.accounts.curator_ora_account.mint == ORA_MINT,
            ErrorCode::InvalidOraMint
        );
        require!(
            ctx.accounts.curator_ora_account.owner == ctx.accounts.curator.key(),
            ErrorCode::InvalidOraOwner
        );

        // Persist state BEFORE the CPI (re-entrancy hardening, matches
        // ora::mint_ora / staking::claim_staking_reward patterns).
        record.reward_claimed = reward_amount;
        pool.total_pool = pool.total_pool.saturating_sub(reward_amount);

        // PDA signer for the program-owned reward_vault token account.
        let content_key = ctx.accounts.content.key();
        let vault_bump = ctx.bumps.reward_vault;
        let seeds: &[&[u8]] = &[b"reward_vault", content_key.as_ref(), &[vault_bump]];
        let signer = &[seeds];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.reward_vault.to_account_info(),
                    to: ctx.accounts.curator_ora_account.to_account_info(),
                    authority: ctx.accounts.reward_vault.to_account_info(),
                },
                signer,
            ),
            reward_amount,
        )?;

        msg!(
            "Curator {} (rank {}) claimed {} ORA atomic units (weight: {}/{})",
            record.curator,
            record.curator_rank,
            reward_amount,
            record.curation_weight,
            pool.total_weight
        );
        Ok(())
    }

    /// Settle pool (mark as final).
    /// Settlement can run after 72 hours from content publication — Handbook §10
    /// calls for daily protocol-wide settlement, but per-content 72-hr settlement
    /// remains the on-chain finalization gate so a single late-arriving curator
    /// cannot reshape the weight distribution after the discovery window closes.
    pub fn settle_pool(ctx: Context<SettlePool>) -> Result<()> {
        let pool = &mut ctx.accounts.curation_pool;
        let clock = Clock::get()?;

        let time_elapsed = clock.unix_timestamp - pool.content_publish_time;
        let settlement_period: i64 = 72 * 60 * 60; // 72 hours

        require!(
            time_elapsed >= settlement_period,
            ErrorCode::SettlementPeriodNotReached
        );
        require!(!pool.is_settled, ErrorCode::PoolAlreadySettled);

        pool.is_settled = true;
        pool.settle_total_pool = pool.total_pool;

        msg!(
            "Curation pool settled for content: {} (settle_total_pool: {})",
            pool.content_id,
            pool.settle_total_pool
        );
        Ok(())
    }
}

// ─── Weight helpers (Handbook §10) ──────────────────────────────────────

/// [whitepaper-sync v1.1] Discovery Weight by creator follower count
/// (Handbook §10 / WP v1.1 §8.4.2). Returned scaled by `WEIGHT_SCALE = 100`:
///   <100        → 500  (5.0×)
///   100–1,000   → 300  (3.0×)
///   1K–10K      → 150  (1.5×)
///   10K–100K    → 100  (1.0×)
///   >100K       → 50   (0.5×)
fn discovery_weight(follower_count: u64) -> u64 {
    if follower_count < 100 {
        500
    } else if follower_count < 1_000 {
        300
    } else if follower_count < 10_000 {
        150
    } else if follower_count < 100_000 {
        100
    } else {
        50
    }
}

/// [whitepaper-sync v1.1] Curator Rank Weight by order of curation
/// (Handbook §10 / WP v1.1 §8.4.1). Handbook lists:
///   1st curator: 5×
///   2nd–10th:    declining (interpolated below)
///   11th–50th:   2×
///   51st–200th:  1.5×
///   201st–500th: 1.2×
///   501st+:      0.5× (Handbook published floor — supersedes the "1×"
///                       value in earlier WP §8.4.1 drafts)
/// Returned scaled by `WEIGHT_SCALE = 100`.
fn curator_rank_weight(rank: u32) -> u64 {
    match rank {
        1 => 500,
        2 => 450,
        3 => 420,
        4 => 400,
        5 => 380,
        6 => 360,
        7 => 340,
        8 => 320,
        9 => 310,
        10 => 300,
        11..=50 => 200,
        51..=200 => 150,
        201..=500 => 120,
        _ => 50,
    }
}

// ─── Post decoder (unchanged from prior audit fix) ──────────────────────

fn decode_core_post(content: &UncheckedAccount) -> Result<DecodedPost> {
    require!(
        content.owner == &AURA_CORE_PROGRAM_ID,
        ErrorCode::InvalidContentOwner
    );

    let data = content.try_borrow_data()?;
    require!(data.len() >= 8 + 32 + 4, ErrorCode::InvalidContentData);

    let computed = anchor_lang::solana_program::hash::hash(b"account:Post");
    let expected_disc = &computed.to_bytes()[..8];
    require!(
        &data[..8] == expected_disc,
        ErrorCode::InvalidContentDiscriminator
    );

    let mut author_bytes = [0u8; 32];
    author_bytes.copy_from_slice(&data[8..40]);
    let author = Pubkey::new_from_array(author_bytes);

    let str_len = u32::from_le_bytes(data[40..44].try_into().unwrap_or([0; 4])) as usize;
    let created_at_off = 8 + 32 + 4 + str_len + 1 + 1 + 8 + 8 + 8 + 8;
    require!(
        data.len() >= created_at_off + 8,
        ErrorCode::InvalidContentData
    );
    let mut ts_bytes = [0u8; 8];
    ts_bytes.copy_from_slice(&data[created_at_off..created_at_off + 8]);
    let created_at = i64::from_le_bytes(ts_bytes);

    let is_active_off = created_at_off + 8;
    require!(
        data.len() >= is_active_off + 1,
        ErrorCode::InvalidContentData
    );
    let is_active = data[is_active_off] != 0;
    require!(is_active, ErrorCode::ContentNotActive);

    Ok(DecodedPost { author, created_at })
}

struct DecodedPost {
    pub author: Pubkey,
    pub created_at: i64,
}

// ─── Account structures ─────────────────────────────────────────────────

#[account]
pub struct CurationRecord {
    pub curator: Pubkey,
    pub content_id: Pubkey,
    pub curated_at: i64,
    pub content_publish_time: i64,
    /// [whitepaper-sync v1.1] curator rank at time of curation (was `time_delta_seconds`).
    /// 1-indexed position in the pool's curation order.
    pub curator_rank: u32,
    pub curation_weight: u64,
    pub reward_claimed: u64,
    pub bump: u8,
}

#[account]
pub struct CurationPool {
    pub content_id: Pubkey,
    pub content_publish_time: i64,
    /// Total lamports remaining in the pool (decremented on each claim).
    pub total_pool: u64,
    pub total_weight: u64,
    pub curators_count: u32,
    pub is_settled: bool,
    pub bump: u8,
    /// Snapshot of `total_pool` at settle-time (frozen denominator).
    pub settle_total_pool: u64,
    /// [whitepaper-sync v1.1] creator follower count at pool-init time.
    /// Drives the Discovery Weight tier. Captured once, never updated.
    pub creator_follower_count: u64,
    /// [whitepaper-sync v1.1] cached `core::Post.author` so we don't have to
    /// re-decode the core-owned Post on every settle/inspect call.
    pub creator_author: Pubkey,
}

// ─── Contexts ───────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = authority,
        // discriminator(8) + content_id(32) + publish_time(8) + total_pool(8)
        // + total_weight(8) + curators_count(4) + is_settled(1) + bump(1)
        // + settle_total_pool(8) + creator_follower_count(8) + creator_author(32)
        space = 8 + 32 + 8 + 8 + 8 + 4 + 1 + 1 + 8 + 8 + 32,
        seeds = [b"curation_pool", content.key().as_ref()],
        bump
    )]
    pub curation_pool: Account<'info, CurationPool>,

    /// CHECK: Core-program-owned Post account; validated manually.
    pub content: UncheckedAccount<'info>,

    /// [audit fix M-CR-1] SOL→ORA: reward_vault is now an SPL TokenAccount
    /// PDA holding ORA, with authority = vault itself (the PDA signs its
    /// own outbound transfers). Mint pinned to `ORA_MINT`.
    #[account(
        init,
        payer = authority,
        seeds = [b"reward_vault", content.key().as_ref()],
        bump,
        token::mint = ora_mint,
        token::authority = reward_vault,
    )]
    pub reward_vault: Account<'info, TokenAccount>,

    /// [audit fix M-CR-1] ORA mint must equal the hardcoded `ORA_MINT` const.
    #[account(address = ORA_MINT @ ErrorCode::InvalidOraMint)]
    pub ora_mint: Account<'info, Mint>,

    #[account(mut, address = POOL_INITIALIZER @ ErrorCode::Unauthorized)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Curate<'info> {
    #[account(
        init,
        payer = curator,
        // discriminator(8) + curator(32) + content_id(32) + curated_at(8)
        // + content_publish_time(8) + curator_rank(4) + curation_weight(8)
        // + reward_claimed(8) + bump(1)
        space = 8 + 32 + 32 + 8 + 8 + 4 + 8 + 8 + 1,
        seeds = [b"curation_record", content.key().as_ref(), curator.key().as_ref()],
        bump
    )]
    pub curation_record: Account<'info, CurationRecord>,

    #[account(mut, seeds = [b"curation_pool", content.key().as_ref()], bump = curation_pool.bump)]
    pub curation_pool: Account<'info, CurationPool>,

    /// CHECK: Core-program-owned Post account; validated manually.
    pub content: UncheckedAccount<'info>,

    #[account(mut)]
    pub curator: Signer<'info>,

    /// [whitepaper-sync v1.1] Curator's ORA SPL token account. Used to:
    ///   1. enforce the 100-ORA sybil holding floor (`amount >= 100 ORA`)
    ///   2. debit the 1-ORA per-curation cost via `token::transfer`
    /// `mint`/`owner` are re-checked in the body against ORA_MINT and the
    /// curator signer key.
    #[account(mut)]
    pub curator_ora_account: Account<'info, TokenAccount>,

    /// [whitepaper-sync v1.1] ORA fee sink — receives the 1-ORA per-curation
    /// cost. At mainnet this is the curator-reward pool ATA so the cost
    /// recycles into the 10K ORA / day Curator Reward Pool (Handbook §10).
    /// Hardcoded address check in the body against `CURATION_FEE_SINK`.
    /// CHECK: address-checked in body; mint compatibility enforced by
    /// `token::transfer` (CPI would fail on mismatched mint anyway).
    #[account(mut)]
    pub curation_fee_sink: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositToPool<'info> {
    #[account(mut, seeds = [b"curation_pool", content.key().as_ref()], bump = curation_pool.bump)]
    pub curation_pool: Account<'info, CurationPool>,

    /// CHECK: Content account (only used as a seed for the vault PDA)
    pub content: AccountInfo<'info>,

    /// [audit fix M-CR-1] Program-owned reward vault as an ORA TokenAccount
    /// PDA. Mint + authority constraints validate it was created by
    /// `initialize_pool` (same seed derivation).
    #[account(
        mut,
        seeds = [b"reward_vault", content.key().as_ref()],
        bump,
        token::mint = ora_mint,
        token::authority = reward_vault,
    )]
    pub reward_vault: Account<'info, TokenAccount>,

    /// [audit fix M-CR-1] Depositor's ORA token account. Mint + owner are
    /// also re-checked in the handler body.
    #[account(
        mut,
        constraint = depositor_ora_account.mint == ORA_MINT @ ErrorCode::InvalidOraMint,
        constraint = depositor_ora_account.owner == depositor.key() @ ErrorCode::InvalidOraOwner,
    )]
    pub depositor_ora_account: Account<'info, TokenAccount>,

    #[account(address = ORA_MINT @ ErrorCode::InvalidOraMint)]
    pub ora_mint: Account<'info, Mint>,

    #[account(mut, address = POOL_DEPOSITOR @ ErrorCode::Unauthorized)]
    pub depositor: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimCurationReward<'info> {
    #[account(
        mut,
        seeds = [b"curation_record", content.key().as_ref(), curator.key().as_ref()],
        bump = curation_record.bump,
        has_one = curator
    )]
    pub curation_record: Account<'info, CurationRecord>,

    #[account(mut, seeds = [b"curation_pool", content.key().as_ref()], bump = curation_pool.bump)]
    pub curation_pool: Account<'info, CurationPool>,

    /// CHECK: Content account
    pub content: AccountInfo<'info>,

    /// [audit fix M-CR-1] Reward vault PDA holding ORA (was SOL).
    /// Seed + mint + token::authority pin it to the curation program PDA.
    #[account(
        mut,
        seeds = [b"reward_vault", content.key().as_ref()],
        bump,
        token::mint = ora_mint,
        token::authority = reward_vault,
    )]
    pub reward_vault: Account<'info, TokenAccount>,

    /// [audit fix M-CR-1] Curator's ORA destination ATA. Mint + owner also
    /// rechecked in the handler body.
    #[account(
        mut,
        constraint = curator_ora_account.mint == ORA_MINT @ ErrorCode::InvalidOraMint,
        constraint = curator_ora_account.owner == curator.key() @ ErrorCode::InvalidOraOwner,
    )]
    pub curator_ora_account: Account<'info, TokenAccount>,

    #[account(address = ORA_MINT @ ErrorCode::InvalidOraMint)]
    pub ora_mint: Account<'info, Mint>,

    #[account(mut)]
    pub curator: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SettlePool<'info> {
    #[account(mut, seeds = [b"curation_pool", content.key().as_ref()], bump = curation_pool.bump)]
    pub curation_pool: Account<'info, CurationPool>,

    /// CHECK: Content account (key used as pool seed)
    pub content: AccountInfo<'info>,

    #[account(address = PROGRAM_ADMIN @ ErrorCode::Unauthorized)]
    pub authority: Signer<'info>,
}

// ─── Errors ─────────────────────────────────────────────────────────────

#[error_code]
pub enum ErrorCode {
    #[msg("Curation pool has already been settled")]
    PoolAlreadySettled,

    #[msg("Invalid time delta (content published in the future?)")]
    InvalidTimeDelta,

    #[msg("Invalid amount")]
    InvalidAmount,

    #[msg("No rewards available to claim")]
    NoRewardsAvailable,

    #[msg("No weight in pool")]
    NoWeightInPool,

    #[msg("Reward already claimed")]
    AlreadyClaimed,

    #[msg("Settlement period not reached (72 hours required)")]
    SettlementPeriodNotReached,

    #[msg("Author cannot curate their own content")]
    SelfCurationForbidden,

    #[msg("Unauthorized")]
    Unauthorized,

    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Curation pool has not been settled yet")]
    PoolNotSettled,

    #[msg("Reward vault would drop below rent-exempt minimum")]
    VaultUnderRent,

    #[msg("Content account is not owned by the AURA core program")]
    InvalidContentOwner,

    #[msg("Content account data is too short / malformed")]
    InvalidContentData,

    #[msg("Content account discriminator does not match core::Post")]
    InvalidContentDiscriminator,

    #[msg("Content has been deactivated by the core program")]
    ContentNotActive,

    // [whitepaper-sync v1.1] new error codes for Handbook §10 enforcement
    #[msg("Curator ORA token account uses the wrong mint")]
    InvalidOraMint,

    #[msg("Curator ORA token account is not owned by the curator signer")]
    InvalidOraOwner,

    #[msg("Curator does not hold the 100-ORA sybil-threshold minimum")]
    BelowSybilThreshold,

    #[msg("Curation fee sink address does not match the protocol constant")]
    InvalidFeeSink,

    #[msg("Computed curation weight is zero (refusing to record)")]
    ZeroWeight,
}
