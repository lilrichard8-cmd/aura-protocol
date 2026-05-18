use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("D1FvbNBVZRvjJYVHNSHZKE653PWCNjb2cfEjNgNxYvc8");

// [audit fix C-H1 / C-1 / C-2] Hardcoded admin / deposit authority.
// ⚠️ DO NOT DEPLOY — placeholder; replace with the real protocol multisig
// before mainnet deploy.
pub const POOL_INITIALIZER: Pubkey = anchor_lang::solana_program::system_program::ID;
pub const POOL_DEPOSITOR: Pubkey = anchor_lang::solana_program::system_program::ID;
pub const PROGRAM_ADMIN: Pubkey = anchor_lang::solana_program::system_program::ID;

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

#[program]
pub mod aura_curation {
    use super::*;

    /// Initialize a curation pool for a content
    /// [audit fix C-H1] gated to POOL_INITIALIZER
    /// [audit fix C-2] also initializes the reward_vault as a program-owned PDA
    /// [audit fix round2 C2.C-2] `content` is now UncheckedAccount + manual
    /// deserialization. Anchor's automatic Account<Post> owner check rejected
    /// the real core-owned Post and bricked this instruction; we now do the
    /// owner + discriminator + decode work ourselves so the program-owned
    /// CurationPool can read content.created_at from the canonical core Post.
    pub fn initialize_pool(ctx: Context<InitializePool>) -> Result<()> {
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

        msg!("Curation pool initialized for content: {}", pool.content_id);
        Ok(())
    }

    /// Curate content (record discovery time + curation weight)
    /// [audit fix C-H2] disallow self-curation (author cannot curate own content)
    /// [audit fix C-H3] removed cross-program mutation of `content.likes` —
    /// this program does NOT own the Post struct; the core program does. Anchor
    /// deserialization of a core-owned Post under the curation program ID would
    /// fail in any case. Off-chain indexers should aggregate likes from
    /// CurationRecord events.
    /// [audit fix round2 C2.C-2] `content` is now UncheckedAccount + manual
    /// deserialization. Self-curation check (C2.H-2 / C-H2) is re-implemented
    /// here against the manually decoded author field.
    pub fn curate(ctx: Context<Curate>) -> Result<()> {
        let clock = Clock::get()?;

        let pool = &mut ctx.accounts.curation_pool;
        let record = &mut ctx.accounts.curation_record;

        require!(!pool.is_settled, ErrorCode::PoolAlreadySettled);

        // [audit fix round2 C2.C-2 + C2.H-2] manually decode the core-owned Post
        // and re-check self-curation against the decoded author.
        let content_info = &ctx.accounts.content;
        let core_post = decode_core_post(content_info)?;
        require!(
            ctx.accounts.curator.key() != core_post.author,
            ErrorCode::SelfCurationForbidden
        );

        // Calculate time delta since content publication
        let time_delta_seconds = clock.unix_timestamp - pool.content_publish_time;
        require!(time_delta_seconds >= 0, ErrorCode::InvalidTimeDelta);

        // Calculate curation weight based on time decay
        let curation_weight = calculate_time_decay_weight(time_delta_seconds)?;

        // Update curation record
        record.curator = ctx.accounts.curator.key();
        record.content_id = content_info.key();
        record.curated_at = clock.unix_timestamp;
        record.content_publish_time = pool.content_publish_time;
        record.time_delta_seconds = time_delta_seconds;
        record.curation_weight = curation_weight;
        record.reward_claimed = 0;
        record.bump = ctx.bumps.curation_record;

        // Update pool statistics
        pool.total_weight = pool
            .total_weight
            .checked_add(curation_weight)
            .ok_or(ErrorCode::Overflow)?;
        pool.curators_count = pool
            .curators_count
            .checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        // [audit fix C-H3] DO NOT mutate content.likes here — Post is owned by
        // the core program; cross-program writes are not allowed via plain
        // Account<...> deserialization and would either fail at runtime or
        // corrupt state on a forked client. Aggregation is now an off-chain
        // concern keyed on the CurationRecord PDA.

        msg!(
            "Content curated by {} with weight {} (time delta: {}s)",
            record.curator,
            curation_weight,
            time_delta_seconds
        );
        Ok(())
    }

    /// Deposit rewards to curation pool.
    /// [audit fix C-1] performs an ACTUAL System-program SOL transfer from the
    /// depositor signer into the program-owned `reward_vault` PDA, and gates
    /// the caller to POOL_DEPOSITOR so attackers cannot inflate `total_pool`
    /// without committing real lamports.
    pub fn deposit_to_pool(ctx: Context<DepositToPool>, amount: u64) -> Result<()> {
        let pool = &mut ctx.accounts.curation_pool;

        require!(!pool.is_settled, ErrorCode::PoolAlreadySettled);
        require!(amount > 0, ErrorCode::InvalidAmount);

        // [audit fix C-1] actual lamport transfer into the program-owned vault.
        // Without this, `total_pool` was a vanity counter anyone could inflate.
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.depositor.to_account_info(),
                to: ctx.accounts.reward_vault.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, amount)?;

        pool.total_pool = pool
            .total_pool
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        msg!(
            "Deposited {} lamports to curation pool vault (vault now {})",
            amount,
            ctx.accounts.reward_vault.lamports()
        );
        Ok(())
    }

    /// Claim curation rewards
    /// [audit fix C-2] reward_vault is now bound to program-owned PDA (see
    /// InitializePool / ClaimCurationReward contexts). The lamport mutation is
    /// safe because the vault is owned by this program.
    /// [audit fix round2 C2.C-1] Settlement gate added: claims are only valid
    /// AFTER `settle_pool` has run. Previously the first curator could race
    /// every late curator by claiming while `pool.total_weight` was still
    /// growing, draining the entire vault on a `weight_self / weight_self`
    /// share.
    /// [audit fix round2 C2.H-1] Rent-exempt floor enforced: the vault PDA
    /// must retain at least the rent-exempt minimum after each claim, so the
    /// Solana runtime cannot eventually garbage-collect it and brick future
    /// claims / deposits.
    pub fn claim_curation_reward(ctx: Context<ClaimCurationReward>) -> Result<()> {
        let pool = &mut ctx.accounts.curation_pool;
        let record = &mut ctx.accounts.curation_record;

        // [audit fix round2 C2.C-1] no early claims; total_weight must be frozen
        require!(pool.is_settled, ErrorCode::PoolNotSettled);

        require!(pool.total_pool > 0, ErrorCode::NoRewardsAvailable);
        require!(pool.total_weight > 0, ErrorCode::NoWeightInPool);
        require!(record.reward_claimed == 0, ErrorCode::AlreadyClaimed);

        // [audit fix round2 C2.M-1] Use the immutable `settle_total_pool`
        // snapshot as the divisor. This decouples per-curator share math from
        // the live `total_pool` field, which is decremented after each claim
        // (so off-chain UIs see remaining balance). Fall back to `total_pool`
        // for any pre-fix-deployed pool where `settle_total_pool == 0`.
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

        // [audit fix C-2] vault is program-owned (enforced by `owner = crate::ID`
        // on the context), so direct lamport mutation is permitted by the
        // Solana runtime.
        let vault_lamports = ctx.accounts.reward_vault.lamports();
        require!(vault_lamports >= reward_amount, ErrorCode::NoRewardsAvailable);

        // [audit fix round2 C2.H-1] enforce rent-exempt minimum on the vault
        // after deducting `reward_amount`. Vault was init'd with `space = 0`
        // so the rent-exempt floor is the minimum_balance for a 0-byte account.
        // If we ever let the vault drop below this, the runtime can garbage-
        // collect it and every subsequent claim / deposit fails.
        let rent_exempt_min = Rent::get()?.minimum_balance(0);
        let vault_after = vault_lamports
            .checked_sub(reward_amount)
            .ok_or(ErrorCode::NoRewardsAvailable)?;
        require!(vault_after >= rent_exempt_min, ErrorCode::VaultUnderRent);

        **ctx.accounts.reward_vault.to_account_info().try_borrow_mut_lamports()? -= reward_amount;
        **ctx.accounts.curator.to_account_info().try_borrow_mut_lamports()? += reward_amount;

        record.reward_claimed = reward_amount;

        // [audit fix round2 C2.M-1] decrement live `total_pool` so off-chain
        // UIs reading the field show the true remaining budget. Share math
        // still uses `settle_total_pool` (see above), so late claimers are
        // unaffected by this decrement.
        pool.total_pool = pool.total_pool.saturating_sub(reward_amount);

        msg!(
            "Curator {} claimed {} lamports (weight: {}/{})",
            record.curator,
            reward_amount,
            record.curation_weight,
            pool.total_weight
        );
        Ok(())
    }

    /// Settle pool (mark as final, no more curations allowed)
    /// [audit fix C-H4] permissionlessness is fine because the function is
    /// gated by a hard 72-hour timeout invariant; anyone observing that
    /// timeout can finalize. Adding an admin gate as defense-in-depth.
    /// [audit fix round2 C2.M-1] snapshot `total_pool` into `settle_total_pool`
    /// so per-curator share math is frozen at settle-time and unaffected by
    /// the live decrement applied in `claim_curation_reward`.
    pub fn settle_pool(ctx: Context<SettlePool>) -> Result<()> {
        let pool = &mut ctx.accounts.curation_pool;
        let clock = Clock::get()?;

        // Pool can be settled after 72 hours from content publication
        let time_elapsed = clock.unix_timestamp - pool.content_publish_time;
        let settlement_period: i64 = 72 * 60 * 60; // 72 hours

        require!(
            time_elapsed >= settlement_period,
            ErrorCode::SettlementPeriodNotReached
        );
        require!(!pool.is_settled, ErrorCode::PoolAlreadySettled);

        pool.is_settled = true;
        // [audit fix round2 C2.M-1] freeze the divisor for share math
        pool.settle_total_pool = pool.total_pool;

        msg!(
            "Curation pool settled for content: {} (settle_total_pool: {})",
            pool.content_id,
            pool.settle_total_pool
        );
        Ok(())
    }
}

/// [audit fix round2 C2.C-2] Manually deserialize a core-owned `Post`.
///
/// Anchor's `Account<T>` checks `account.owner == T::owner()` (where
/// `T::owner()` for an `#[account]` struct returns the program ID of the crate
/// that declared it). Since `Post` is declared in `aura_core`, an
/// `Account<Post>` declared in *this* crate would actually expect ownership by
/// `aura_curation::ID` — which is wrong (Posts are owned by `aura_core::ID`).
///
/// This helper performs the manual validation:
///   1. owner == AURA_CORE_PROGRAM_ID
///   2. data length is large enough to contain the discriminator + struct
///   3. discriminator matches sha256("account:Post")[..8]
///   4. decode the first two fields we care about (author, created_at) using
///      Anchor's borsh-derived layout.
fn decode_core_post(content: &UncheckedAccount) -> Result<DecodedPost> {
    require!(
        content.owner == &AURA_CORE_PROGRAM_ID,
        ErrorCode::InvalidContentOwner
    );

    let data = content.try_borrow_data()?;
    // 8 (discriminator) + 32 (author) + 4 (arweave_tx_id len prefix) is the
    // minimum length required before we touch any non-prefix bytes.
    require!(data.len() >= 8 + 32 + 4, ErrorCode::InvalidContentData);

    // [audit fix R3-C3-I-1] Anchor account discriminator = sha256("account:<TypeName>")[..8].
    // Computed at runtime via solana_program::hash; bytes match sha256("account:Post")[..8].
    // Computing at runtime (rather than hardcoding) avoids any hex transcription
    // mistake and the BPF runtime supports the sol_sha256 syscall cheaply.
    let computed = anchor_lang::solana_program::hash::hash(b"account:Post");
    let expected_disc = &computed.to_bytes()[..8];
    require!(
        &data[..8] == expected_disc,
        ErrorCode::InvalidContentDiscriminator
    );

    // Layout (matches core::Post):
    //   8  discriminator
    //  32  author : Pubkey
    //   4  arweave_tx_id length prefix
    //   N  arweave_tx_id bytes
    //   1  content_type (enum)
    //   1  access_control (enum)
    //   8  price : u64
    //   8  likes : u64
    //   8  views : u64
    //   8  tips_received : u64
    //   8  created_at : i64
    //   ...
    let mut author_bytes = [0u8; 32];
    author_bytes.copy_from_slice(&data[8..40]);
    let author = Pubkey::new_from_array(author_bytes);

    let str_len = u32::from_le_bytes(data[40..44].try_into().unwrap_or([0; 4])) as usize;
    // Position of created_at: 8 + 32 + 4 + str_len + 1 + 1 + 8 + 8 + 8 + 8
    let created_at_off = 8 + 32 + 4 + str_len + 1 + 1 + 8 + 8 + 8 + 8;
    require!(
        data.len() >= created_at_off + 8,
        ErrorCode::InvalidContentData
    );
    let mut ts_bytes = [0u8; 8];
    ts_bytes.copy_from_slice(&data[created_at_off..created_at_off + 8]);
    let created_at = i64::from_le_bytes(ts_bytes);

    // [audit fix R3-M-2] read `is_active: bool` (the byte immediately after
    // `created_at`) and reject if the core program has marked the post
    // inactive (e.g. moderation / DMCA / burn-after-reading). Defence in
    // depth so curation pools cannot form against, or pay out for, content
    // that the core program has already buried.
    let is_active_off = created_at_off + 8;
    require!(
        data.len() >= is_active_off + 1,
        ErrorCode::InvalidContentData
    );
    let is_active = data[is_active_off] != 0;
    require!(is_active, ErrorCode::ContentNotActive);

    Ok(DecodedPost { author, created_at })
}

/// [audit fix round2 C2.C-2] Minimal decoded view of a core::Post, owned by
/// the curation program logic so we don't have to re-derive `#[account]` and
/// risk a discriminator collision with core::Post (see C2.M-2).
struct DecodedPost {
    pub author: Pubkey,
    pub created_at: i64,
}

/// Calculate time decay weight based on discovery time
/// - First 1 hour discovery: 10x
/// - 1-6 hours: 5x
/// - 6-24 hours: 2x
/// - 24-72 hours: 1x
/// - After 72 hours: 0.1x
fn calculate_time_decay_weight(time_delta_seconds: i64) -> Result<u64> {
    const HOUR: i64 = 60 * 60;
    const BASE_WEIGHT: u64 = 1000; // Use 1000 as base for better precision

    let weight = if time_delta_seconds < HOUR {
        // First hour: 10x
        BASE_WEIGHT * 10
    } else if time_delta_seconds < 6 * HOUR {
        // 1-6 hours: 5x
        BASE_WEIGHT * 5
    } else if time_delta_seconds < 24 * HOUR {
        // 6-24 hours: 2x
        BASE_WEIGHT * 2
    } else if time_delta_seconds < 72 * HOUR {
        // 24-72 hours: 1x
        BASE_WEIGHT
    } else {
        // After 72 hours: 0.1x
        BASE_WEIGHT / 10
    };

    Ok(weight)
}

// Account structures
#[account]
pub struct CurationRecord {
    pub curator: Pubkey,
    pub content_id: Pubkey,
    pub curated_at: i64,
    pub content_publish_time: i64,
    pub time_delta_seconds: i64,
    pub curation_weight: u64,
    pub reward_claimed: u64,
    pub bump: u8,
}

#[account]
pub struct CurationPool {
    pub content_id: Pubkey,
    pub content_publish_time: i64,
    /// Total lamports remaining in the pool (decremented on each claim).
    /// [audit fix round2 C2.M-1] off-chain UIs reading this field now see the
    /// *remaining* balance, not the cumulative ever-deposited amount.
    pub total_pool: u64,
    pub total_weight: u64,
    pub curators_count: u32,
    pub is_settled: bool,
    pub bump: u8,
    /// [audit fix round2 C2.M-1] Snapshot of `total_pool` at settle-time.
    /// Used as the immutable denominator for pro-rata share calculation
    /// (weight_self / total_weight * settle_total_pool). This decouples
    /// the share math from `total_pool` so we can safely decrement it on
    /// every claim without breaking late claimers.
    pub settle_total_pool: u64,
}

// [audit fix round2 C2.C-2 / C2.M-2] Removed the local `#[account] pub struct
// Post {...}` redeclaration. Decoding is now done in `decode_core_post` via
// manual byte slicing, and the discriminator-collision footgun with
// `aura_core::Post` is eliminated.

// Context structures

// [audit fix C-H1] only POOL_INITIALIZER may bootstrap a pool.
// [audit fix C-2] initialize the reward_vault as a program-owned PDA atomically,
// so it has a known owner from the very first instruction.
// [audit fix round2 C2.M-1] +8 bytes for settle_total_pool field
#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 8 + 8 + 4 + 1 + 1 + 8,
        seeds = [b"curation_pool", content.key().as_ref()],
        bump
    )]
    pub curation_pool: Account<'info, CurationPool>,

    /// CHECK: Core-program-owned Post account; validated manually in body via
    /// `decode_core_post` (owner == AURA_CORE_PROGRAM_ID + discriminator match).
    /// [audit fix round2 C2.C-2] cannot use Account<T> here because T's owner
    /// would be inferred as `aura_curation::ID` and Anchor would reject a real
    /// core-owned Post at deserialization.
    pub content: UncheckedAccount<'info>,

    /// CHECK: Reward vault PDA, program-owned, created atomically with the pool.
    /// [audit fix C-2] this is a SystemAccount with space=0 so it can hold
    /// lamports; ownership is set to this program via the init seed.
    #[account(
        init,
        payer = authority,
        space = 0,
        seeds = [b"reward_vault", content.key().as_ref()],
        bump,
        owner = crate::ID,
    )]
    pub reward_vault: AccountInfo<'info>,

    // [audit fix C-H1] gate caller to the protocol pool-initializer
    #[account(mut, address = POOL_INITIALIZER @ ErrorCode::Unauthorized)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Curate<'info> {
    #[account(
        init,
        payer = curator,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1,
        seeds = [b"curation_record", content.key().as_ref(), curator.key().as_ref()],
        bump
    )]
    pub curation_record: Account<'info, CurationRecord>,

    #[account(mut, seeds = [b"curation_pool", content.key().as_ref()], bump = curation_pool.bump)]
    pub curation_pool: Account<'info, CurationPool>,

    /// CHECK: Core-program-owned Post account; validated manually in body via
    /// `decode_core_post`. We must NOT use Account<Post> because the real Post
    /// is owned by aura_core, not aura_curation, so Anchor's owner check
    /// would reject every call. See round-2 audit C2.C-2.
    pub content: UncheckedAccount<'info>,

    #[account(mut)]
    pub curator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// [audit fix C-1] depositor MUST be POOL_DEPOSITOR and MUST sign a real SOL
// transfer into reward_vault. No more vanity counter inflation.
#[derive(Accounts)]
pub struct DepositToPool<'info> {
    #[account(mut, seeds = [b"curation_pool", content.key().as_ref()], bump = curation_pool.bump)]
    pub curation_pool: Account<'info, CurationPool>,

    /// CHECK: Content account (only used as a seed for the vault PDA)
    pub content: AccountInfo<'info>,

    /// CHECK: Program-owned reward vault PDA. Lamports are added via System
    /// program transfer; the program owns the account so it can later move
    /// lamports out in `claim_curation_reward`.
    #[account(
        mut,
        seeds = [b"reward_vault", content.key().as_ref()],
        bump,
        owner = crate::ID @ ErrorCode::Unauthorized,
    )]
    pub reward_vault: AccountInfo<'info>,

    // [audit fix C-1] gate to POOL_DEPOSITOR (typically the protocol revenue
    // splitter / a fee-handler PDA from another program). Only this party is
    // allowed to credit `total_pool`.
    #[account(mut, address = POOL_DEPOSITOR @ ErrorCode::Unauthorized)]
    pub depositor: Signer<'info>,

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

    // [audit fix R3-M-1] `mut` added so the `pool.total_pool` decrement at the
    // bottom of `claim_curation_reward` is actually persisted. Without `mut`,
    // Anchor never re-serializes the account on Exit and the C2.M-1 fix silently
    // no-ops (or fails with ReadonlyDataModified on stricter runtimes).
    #[account(mut, seeds = [b"curation_pool", content.key().as_ref()], bump = curation_pool.bump)]
    pub curation_pool: Account<'info, CurationPool>,

    /// CHECK: Content account
    pub content: AccountInfo<'info>,

    /// CHECK: Reward vault PDA holding SOL. Program-owned (enforced).
    /// [audit fix C-2] explicit `owner = crate::ID` so a wrong-owner account
    /// passed here is rejected before the lamport mutation is attempted.
    #[account(
        mut,
        seeds = [b"reward_vault", content.key().as_ref()],
        bump,
        owner = crate::ID @ ErrorCode::Unauthorized,
    )]
    pub reward_vault: AccountInfo<'info>,

    #[account(mut)]
    pub curator: Signer<'info>,
}

// [audit fix C-H4] gate settle to PROGRAM_ADMIN as defense-in-depth. The
// 72-hour timeout already makes the call safe to invoke by anyone, but
// admin-gating keeps the social-graph clean and prevents speculative early
// settlements via grief-time-warps in test forks.
#[derive(Accounts)]
pub struct SettlePool<'info> {
    #[account(mut, seeds = [b"curation_pool", content.key().as_ref()], bump = curation_pool.bump)]
    pub curation_pool: Account<'info, CurationPool>,

    /// CHECK: Content account (key used as pool seed)
    pub content: AccountInfo<'info>,

    #[account(address = PROGRAM_ADMIN @ ErrorCode::Unauthorized)]
    pub authority: Signer<'info>,
}

// Error codes
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

    // [audit fix C-H2]
    #[msg("Author cannot curate their own content")]
    SelfCurationForbidden,

    // [audit fix C-1 / C-H1 / C-H4]
    #[msg("Unauthorized")]
    Unauthorized,

    // [audit fix C-1 / curate / claim — overflow paths]
    #[msg("Arithmetic overflow")]
    Overflow,

    // [audit fix round2 C2.C-1] claim before settlement
    #[msg("Curation pool has not been settled yet")]
    PoolNotSettled,

    // [audit fix round2 C2.H-1] vault would drop below rent-exempt minimum
    #[msg("Reward vault would drop below rent-exempt minimum")]
    VaultUnderRent,

    // [audit fix round2 C2.C-2] manual Post deserialization failures
    #[msg("Content account is not owned by the AURA core program")]
    InvalidContentOwner,

    #[msg("Content account data is too short / malformed")]
    InvalidContentData,

    #[msg("Content account discriminator does not match core::Post")]
    InvalidContentDiscriminator,

    // [audit fix R3-M-2] core::Post.is_active is false (post is moderated /
    // deactivated / burned). Curation must not form pools against, or pay
    // out for, content the core program has marked inactive.
    #[msg("Content has been deactivated by the core program")]
    ContentNotActive,
}
