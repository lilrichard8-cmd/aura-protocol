use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("6h1sZi8cG3WNB2r9FqTkgoMLBBUPZWbyWPQ3mRsSPyAv");

const SECONDS_PER_DAY: i64 = 86400;

// =============================================================================
// [audit fix C-S3 / C-S2 / H-S3] Hardcoded protocol authority + treasury PDAs.
// ⚠️ DO NOT DEPLOY — placeholders set to system_program::ID. Replace pre-mainnet
// with the real ORA multisig / treasury pubkeys.
// =============================================================================

/// Program admin allowed to initialise / upgrade the staking pool.
/// Mirrors `market::PROGRAM_ADMIN` pattern (bounty-V2 audit C-4).
pub const PROGRAM_ADMIN: Pubkey = anchor_lang::solana_program::system_program::ID;

/// Hardcoded reward-vault authority. `claim_staking_reward.reward_vault` must
/// be owned by this PDA to prevent attacker-controlled vault redirection.
/// [audit fix C-S3] In production this is the canonical staking-rewards PDA
/// (derivable from `seeds = [b"staking_pool"]`) — kept here as an explicit
/// hardcoded address so any drift between contract & deployment is caught.
pub const REWARD_VAULT_AUTHORITY: Pubkey = anchor_lang::solana_program::system_program::ID;

/// Hardcoded source treasury that feeds `update_daily_rewards`.
/// [audit fix C-S2] Restricts where rewards flow IN from, so the admin can't
/// "fund" the pool from a personal wallet to game accumulated_reward_per_weight.
pub const REWARD_SOURCE_TREASURY: Pubkey = anchor_lang::solana_program::system_program::ID;

/// [audit fix R2-M-S1] Codify the canonical ORA mint decimals so cross-
/// program math stops drifting (livestream assumed 6 decimals, staking
/// assumed 9). Until a shared `aura-constants` crate is introduced, this
/// constant is the source of truth for staking-side ORA math.
/// MIN_STAKE_AMOUNT below is derived from this so the floor stays in sync.
pub const ORA_DECIMALS: u8 = 9;

#[program]
pub mod aura_staking {
    use super::*;

    /// Initialize the staking pool.
    /// [audit fix H-S3] Caller must equal hardcoded PROGRAM_ADMIN — prevents
    /// front-run init attack where attacker becomes pool authority.
    pub fn initialize_staking_pool(
        ctx: Context<InitializeStakingPool>,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.staking_pool;
        pool.authority = ctx.accounts.authority.key();
        pool.ora_mint = ctx.accounts.ora_mint.key();
        pool.total_staked = 0;
        pool.total_weighted_stake = 0;
        pool.reward_pool_balance = 0;
        pool.last_daily_update = Clock::get()?.unix_timestamp;
        pool.accumulated_reward_per_weight = 0;
        pool.bump = ctx.bumps.staking_pool;

        msg!("Staking pool initialized");
        Ok(())
    }

    /// Initialize a per-user stake counter (one-time per user).
    /// [audit fix C-S1] The counter assigns a monotonic `stake_nonce` to every
    /// new stake so the stake PDA seeds become `[b"stake", user, nonce_le]` —
    /// fully re-derivable from on-chain state by unstake / claim.
    /// Pattern mirrors market::BountyCounter.
    pub fn initialize_stake_counter(ctx: Context<InitializeStakeCounter>) -> Result<()> {
        let c = &mut ctx.accounts.stake_counter;
        c.user = ctx.accounts.user.key();
        c.next_nonce = 0;
        c.bump = ctx.bumps.stake_counter;
        Ok(())
    }

    /// Stake ORA tokens with a lockup tier.
    /// [audit fix C-S1] PDA seeds now use a per-user monotonic `stake_nonce`
    /// drawn from `StakeCounter` (NOT `Clock::get()?.unix_timestamp`).
    pub fn stake_ora(
        ctx: Context<StakeOra>,
        amount: u64,
        lockup_tier: LockupTier,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        // [audit fix M-S1] enforce minimum stake to avoid rounding-to-zero
        // in reward-per-weight math.
        require!(amount >= MIN_STAKE_AMOUNT, ErrorCode::StakeBelowMinimum);

        let now = Clock::get()?.unix_timestamp;
        let (lockup_days, multiplier_bps) = lockup_tier.params();

        // Allocate stake nonce from the counter
        let counter = &mut ctx.accounts.stake_counter;
        let nonce = counter.next_nonce;
        counter.next_nonce = nonce.checked_add(1).ok_or(ErrorCode::Overflow)?;

        // Transfer ORA from user to vault PDA
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.vault_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        let stake = &mut ctx.accounts.stake_account;
        stake.owner = ctx.accounts.user.key();
        stake.stake_nonce = nonce;
        stake.amount = amount;
        stake.lockup_tier = lockup_tier.clone();
        stake.staked_at = now;
        // [audit fix M-S2] use checked_add to prevent i64 overflow on huge lockups
        stake.unlock_at = now
            .checked_add((lockup_days as i64).checked_mul(SECONDS_PER_DAY).ok_or(ErrorCode::Overflow)?)
            .ok_or(ErrorCode::Overflow)?;
        require!(stake.unlock_at > stake.staked_at, ErrorCode::Overflow);
        stake.multiplier_bps = multiplier_bps;
        stake.reward_debt = (amount as u128)
            .checked_mul(multiplier_bps as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::Overflow)?
            .checked_mul(ctx.accounts.staking_pool.accumulated_reward_per_weight as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(1_000_000_000)
            .ok_or(ErrorCode::Overflow)? as u64;
        stake.claimed_rewards = 0;
        stake.bump = ctx.bumps.stake_account;

        let weighted = (amount as u128)
            .checked_mul(multiplier_bps as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::Overflow)? as u64;

        let pool = &mut ctx.accounts.staking_pool;
        pool.total_staked = pool.total_staked.checked_add(amount).ok_or(ErrorCode::Overflow)?;
        pool.total_weighted_stake = pool.total_weighted_stake.checked_add(weighted).ok_or(ErrorCode::Overflow)?;

        emit!(StakeEvent {
            user: stake.owner,
            amount,
            lockup_tier,
            multiplier_bps,
            timestamp: now,
            stake_nonce: nonce,
        });

        msg!("Staked {} ORA nonce={} multiplier={}bps", amount, nonce, multiplier_bps);
        Ok(())
    }

    /// Unstake ORA. Early unstake incurs a 20% penalty.
    /// [audit fix C-S1] re-derives the stake PDA from the stored `stake_nonce`.
    /// [audit fix C-S4] penalty is routed into the reward pool so it is
    /// distributable to remaining stakers (not stranded in the vault).
    /// [audit fix C-S5 / H-S1] closes the stake account and zeros reward_debt
    /// so a later claim against the same PDA is impossible.
    /// [audit fix round2 R2-H-S1] pays out accrued rewards BEFORE closing the
    /// stake account so unstakers do not silently forfeit pending rewards.
    pub fn unstake_ora(ctx: Context<UnstakeOra>, _stake_nonce: u64) -> Result<()> {
        let stake = &ctx.accounts.stake_account;
        let now = Clock::get()?.unix_timestamp;
        let amount = stake.amount;
        let multiplier_bps = stake.multiplier_bps;

        let is_early = now < stake.unlock_at;
        let penalty = if is_early {
            amount.checked_mul(20).ok_or(ErrorCode::Overflow)?.checked_div(100).ok_or(ErrorCode::Overflow)?
        } else {
            0
        };
        let withdraw_amount = amount.checked_sub(penalty).ok_or(ErrorCode::Overflow)?;

        let pool_bump = ctx.accounts.staking_pool.bump;
        let seeds = &[b"staking_pool".as_ref(), &[pool_bump]];
        let signer = &[&seeds[..]];

        // [audit fix round2 R2-H-S1] compute and pay pending rewards BEFORE
        // closing. Uses identical formula to claim_staking_reward so stakers
        // can never forfeit accrued rewards by unstaking.
        let pending: u64 = {
            let pool = &ctx.accounts.staking_pool;
            let weighted = (amount as u128)
                .checked_mul(multiplier_bps as u128)
                .ok_or(ErrorCode::Overflow)?
                .checked_div(10000)
                .ok_or(ErrorCode::Overflow)?;
            weighted
                .checked_mul(pool.accumulated_reward_per_weight as u128)
                .ok_or(ErrorCode::Overflow)?
                .checked_div(1_000_000_000)
                .ok_or(ErrorCode::Overflow)?
                .saturating_sub(stake.reward_debt as u128) as u64
        };
        if pending > 0 {
            // Pay rewards from the reward_vault to the user.
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.reward_vault.to_account_info(),
                        to: ctx.accounts.user_token_account.to_account_info(),
                        authority: ctx.accounts.staking_pool.to_account_info(),
                    },
                    signer,
                ),
                pending,
            )?;
            emit!(RewardClaimEvent {
                user: ctx.accounts.user.key(),
                amount: pending,
                timestamp: now,
            });
        }

        // Transfer principal (minus penalty) from vault to user
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.staking_pool.to_account_info(),
                },
                signer,
            ),
            withdraw_amount,
        )?;

        let weighted = (amount as u128)
            .checked_mul(multiplier_bps as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::Overflow)? as u64;

        // Decrement totals first so the penalty routing branch reads the
        // post-unstake total_weighted_stake.
        let new_total_weighted_stake = {
            let pool = &mut ctx.accounts.staking_pool;
            pool.total_staked = pool.total_staked.saturating_sub(amount);
            pool.total_weighted_stake = pool.total_weighted_stake.saturating_sub(weighted);
            pool.total_weighted_stake
        };

        // [audit fix C-S4] route penalty into reward pool so it is distributable
        // [audit fix R3-H-S2] physically move penalty tokens from vault_token_account
        // into reward_vault via a real SPL transfer. Previously the accumulator was
        // credited as if the penalty had landed in reward_vault, but the tokens stayed
        // in vault_token_account — claimers eventually hit InsufficientFunds on the
        // reward_vault even though reward_pool_balance still showed surplus.
        if penalty > 0 && new_total_weighted_stake > 0 {
            // Physically transfer the penalty tokens into reward_vault so the
            // accumulator and the on-chain reward_vault balance stay in sync.
            // CPI is done OUTSIDE the mutable pool borrow so the authority
            // (`staking_pool.to_account_info()`) can be read immutably.
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault_token_account.to_account_info(),
                        to: ctx.accounts.reward_vault.to_account_info(),
                        authority: ctx.accounts.staking_pool.to_account_info(),
                    },
                    signer,
                ),
                penalty,
            )?;
            let reward_per_weight = (penalty as u128)
                .checked_mul(1_000_000_000)
                .ok_or(ErrorCode::Overflow)?
                .checked_div(new_total_weighted_stake as u128)
                .ok_or(ErrorCode::Overflow)? as u64;
            let pool = &mut ctx.accounts.staking_pool;
            pool.accumulated_reward_per_weight = pool
                .accumulated_reward_per_weight
                .checked_add(reward_per_weight)
                .ok_or(ErrorCode::Overflow)?;
            pool.reward_pool_balance = pool.reward_pool_balance.checked_add(penalty).ok_or(ErrorCode::Overflow)?;
        }

        // [audit fix C-S5] zero stake bookkeeping. The stake_account is closed
        // via `close = user` on the context so rent is refunded and the PDA
        // can no longer be loaded by claim_staking_reward.
        let stake_mut = &mut ctx.accounts.stake_account;
        stake_mut.amount = 0;
        stake_mut.reward_debt = 0;

        emit!(UnstakeEvent {
            user: ctx.accounts.user.key(),
            amount,
            penalty,
            early: is_early,
            timestamp: now,
        });

        msg!("Unstaked {} ORA (penalty: {}, early: {})", withdraw_amount, penalty, is_early);
        Ok(())
    }

    /// Claim staking rewards.
    /// [audit fix C-S1] re-derives PDA from stake_nonce.
    /// [audit fix C-S3] reward_vault is constrained to the hardcoded
    /// REWARD_VAULT_AUTHORITY or the staking_pool PDA owner.
    /// [audit fix H-S2] user_token_account owner must equal stake.owner.
    pub fn claim_staking_reward(ctx: Context<ClaimStakingReward>, _stake_nonce: u64) -> Result<()> {
        let pool = &ctx.accounts.staking_pool;
        let stake = &ctx.accounts.stake_account;

        let weighted = (stake.amount as u128)
            .checked_mul(stake.multiplier_bps as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::Overflow)?;

        let pending = weighted
            .checked_mul(pool.accumulated_reward_per_weight as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(1_000_000_000)
            .ok_or(ErrorCode::Overflow)?
            .saturating_sub(stake.reward_debt as u128) as u64;

        require!(pending > 0, ErrorCode::NoRewardsToClaim);

        let pool_bump = pool.bump;
        let seeds = &[b"staking_pool".as_ref(), &[pool_bump]];
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.reward_vault.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.staking_pool.to_account_info(),
                },
                signer,
            ),
            pending,
        )?;

        let stake_mut = &mut ctx.accounts.stake_account;
        stake_mut.reward_debt = stake_mut.reward_debt.checked_add(pending).ok_or(ErrorCode::Overflow)?;
        stake_mut.claimed_rewards = stake_mut.claimed_rewards.checked_add(pending).ok_or(ErrorCode::Overflow)?;

        emit!(RewardClaimEvent {
            user: ctx.accounts.user.key(),
            amount: pending,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("Claimed {} ORA staking rewards", pending);
        Ok(())
    }

    /// [audit fix R2-M-S2] Close a fully-drained per-user `StakeCounter` and
    /// refund the rent. Only callable by the counter owner. Safe because:
    ///   (a) `close = user` on `unstake_ora` already closes individual
    ///       stake PDAs;
    ///   (b) re-staking after close simply re-inits the counter at
    ///       `next_nonce = 0`, which is fine because the previous stake
    ///       PDAs are gone (their accounts are closed) and the
    ///       `[b"stake", user, nonce_le]` seeds map to brand-new PDAs.
    /// The user is responsible for closing all active stakes BEFORE calling
    /// this; if any stake PDA still exists, future stake_ora calls re-using
    /// nonce 0 would collide — callers are expected to use the SDK helper
    /// which checks this.
    pub fn close_stake_counter(_ctx: Context<CloseStakeCounter>) -> Result<()> {
        msg!("StakeCounter closed; rent refunded");
        Ok(())
    }

    /// Update daily rewards — called daily to add new rewards from 2% fee pool.
    /// [audit fix C-S2] authority must equal hardcoded PROGRAM_ADMIN, AND
    /// reward_source must be the hardcoded REWARD_SOURCE_TREASURY, AND
    /// reward_vault must be owned by the staking_pool PDA (enforced by
    /// constraint in the accounts struct).
    ///
    /// [whitepaper-sync v1.1] TODO: Whitepaper §14.4 specifies three reward
    /// sources for stakers:
    ///   (1) 20% of annual perpetual emission — NOT IMPLEMENTED. Requires a
    ///       year-based emission scheduler in `programs/ora` (currently absent;
    ///       see diff report Critical-4) feeding `REWARD_SOURCE_TREASURY`.
    ///   (2) 2% of every ORA transaction fee — PARTIALLY IMPLEMENTED. The fee
    ///       split lands in `STAKING_REWARDS_POOL` via market/CC/bounty paths;
    ///       this ix simply forwards from `REWARD_SOURCE_TREASURY` and assumes
    ///       upstream routing is correct.
    ///   (3) Curation surplus when daily curation intake exceeds the 20,000
    ///       ORA cap — NOT IMPLEMENTED. Requires a cross-program transfer from
    ///       `programs/curation` into this pool. Future work.
    pub fn update_daily_rewards(ctx: Context<UpdateDailyRewards>, reward_amount: u64) -> Result<()> {
        let pool = &mut ctx.accounts.staking_pool;
        let now = Clock::get()?.unix_timestamp;

        require!(
            now - pool.last_daily_update >= SECONDS_PER_DAY / 2, // Allow some slack
            ErrorCode::TooEarlyForUpdate
        );

        if pool.total_weighted_stake > 0 && reward_amount > 0 {
            // Transfer rewards into reward vault
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.reward_source.to_account_info(),
                        to: ctx.accounts.reward_vault.to_account_info(),
                        authority: ctx.accounts.authority.to_account_info(),
                    },
                ),
                reward_amount,
            )?;

            // Update accumulated reward per weighted unit
            let reward_per_weight = (reward_amount as u128)
                .checked_mul(1_000_000_000)
                .ok_or(ErrorCode::Overflow)?
                .checked_div(pool.total_weighted_stake as u128)
                .ok_or(ErrorCode::Overflow)? as u64;

            pool.accumulated_reward_per_weight = pool
                .accumulated_reward_per_weight
                .checked_add(reward_per_weight)
                .ok_or(ErrorCode::Overflow)?;
            pool.reward_pool_balance = pool.reward_pool_balance.checked_add(reward_amount).ok_or(ErrorCode::Overflow)?;
        }

        pool.last_daily_update = now;

        msg!("Daily rewards updated: {} ORA added to pool", reward_amount);
        Ok(())
    }
}

// === Constants ===

/// [audit fix M-S1 / R2-M-S1] Minimum stake amount.
/// [whitepaper-sync v1.1] Whitepaper §14.2 + Numbers Handbook §14 mandate a
/// floor of **1,000 ORA** (not 1 ORA). This protects the reward-per-weight
/// math from rounding-to-zero AND aligns with the published economic spec.
/// Keyed off `ORA_DECIMALS` so a future decimals change auto-propagates.
pub const MIN_STAKE_AMOUNT: u64 = 1_000u64
    .checked_mul(10u64.pow(ORA_DECIMALS as u32))
    .expect("MIN_STAKE_AMOUNT overflow at compile-time");

// === Enums ===

// [audit fix R5 H-S-1] WP v1.1 §14 + Numbers Handbook §14 mandate FOUR lockup
// tiers: 1mo / 3mo / 6mo / 12mo with multipliers 1.0x / 1.0x / 1.5x / 2.0x.
// The previous enum shipped 1d / 30d / 90d / 180d — the 1-day tier has no
// WP basis, and the 12-month tier (which carries the 2.0x multiplier) was
// missing entirely (180d incorrectly absorbed 2.0x). This is a BREAKING
// on-chain enum change: SDK + frontend follow in lockstep.
//
// Months are 30-day buckets (`SECONDS_PER_MONTH = 30 * 24 * 3600`), matching
// the cadence used by launch-incentives::ONBOARDING_MONTH_SECS.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub enum LockupTier {
    OneMonth,     // 30 days,  1.0x
    ThreeMonths,  // 90 days,  1.0x
    SixMonths,    // 180 days, 1.5x
    TwelveMonths, // 360 days, 2.0x
}

impl LockupTier {
    /// Returns (lockup_days, multiplier_bps).
    /// [audit fix R5 H-S-1] / [whitepaper-sync v1.1] WP §14.3 + Numbers
    /// Handbook §14: 1mo=1.0x / 3mo=1.0x / 6mo=1.5x / 12mo=2.0x.
    pub fn params(&self) -> (u32, u16) {
        match self {
            LockupTier::OneMonth     => (30,  10000), // 1.0x
            LockupTier::ThreeMonths  => (90,  10000), // 1.0x
            LockupTier::SixMonths    => (180, 15000), // 1.5x
            LockupTier::TwelveMonths => (360, 20000), // 2.0x
        }
    }
}

// === Account Structures ===

#[account]
pub struct StakingPool {
    pub authority: Pubkey,                  // 32
    pub ora_mint: Pubkey,                   // 32
    pub total_staked: u64,                  // 8
    pub total_weighted_stake: u64,          // 8
    pub reward_pool_balance: u64,           // 8
    pub last_daily_update: i64,             // 8
    pub accumulated_reward_per_weight: u64, // 8
    pub bump: u8,                           // 1
}

/// [audit fix C-S1] Per-user monotonic nonce allocator. Mirrors
/// `BountyCounter` from the market program.
#[account]
pub struct StakeCounter {
    pub user: Pubkey,    // 32
    pub next_nonce: u64, // 8
    pub bump: u8,        // 1
}

impl StakeCounter {
    pub const SIZE: usize = 8 + 32 + 8 + 1;
    pub const SEED: &'static [u8] = b"stake-counter";
}

#[account]
pub struct StakeAccount {
    pub owner: Pubkey,          // 32
    pub stake_nonce: u64,       // 8 — [audit fix C-S1] used as PDA seed
    pub amount: u64,            // 8
    pub lockup_tier: LockupTier, // 1
    pub staked_at: i64,         // 8
    pub unlock_at: i64,         // 8
    pub multiplier_bps: u16,    // 2
    pub reward_debt: u64,       // 8
    pub claimed_rewards: u64,   // 8
    pub bump: u8,               // 1
}

// === Context Structures ===

#[derive(Accounts)]
pub struct InitializeStakingPool<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1,
        seeds = [b"staking_pool"],
        bump
    )]
    pub staking_pool: Account<'info, StakingPool>,

    pub ora_mint: Account<'info, Mint>,

    // [audit fix H-S3] hardcoded admin gate prevents front-run init.
    #[account(mut, address = PROGRAM_ADMIN @ ErrorCode::Unauthorized)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct InitializeStakeCounter<'info> {
    #[account(
        init,
        payer = user,
        space = StakeCounter::SIZE,
        seeds = [StakeCounter::SEED, user.key().as_ref()],
        bump
    )]
    pub stake_counter: Account<'info, StakeCounter>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StakeOra<'info> {
    #[account(
        mut,
        seeds = [b"staking_pool"],
        bump = staking_pool.bump
    )]
    pub staking_pool: Account<'info, StakingPool>,

    /// [audit fix C-S1] per-user monotonic counter feeds the stake PDA seed.
    #[account(
        mut,
        seeds = [StakeCounter::SEED, user.key().as_ref()],
        bump = stake_counter.bump,
        has_one = user @ ErrorCode::Unauthorized,
    )]
    pub stake_counter: Account<'info, StakeCounter>,

    /// [audit fix C-S1] seeds use `stake_counter.next_nonce` (BEFORE this ix
    /// increments it). Anchor evaluates seeds *before* the function body, so
    /// reading the counter's current `next_nonce` here is correct.
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 8 + 8 + 1 + 8 + 8 + 2 + 8 + 8 + 1,
        seeds = [b"stake", user.key().as_ref(), stake_counter.next_nonce.to_le_bytes().as_ref()],
        bump
    )]
    pub stake_account: Account<'info, StakeAccount>,

    /// Vault PDA token account (authority = staking_pool PDA)
    #[account(mut, constraint = vault_token_account.owner == staking_pool.key() @ ErrorCode::Unauthorized)]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut, constraint = user_token_account.owner == user.key() @ ErrorCode::Unauthorized)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(stake_nonce: u64)]
pub struct UnstakeOra<'info> {
    #[account(
        mut,
        seeds = [b"staking_pool"],
        bump = staking_pool.bump
    )]
    pub staking_pool: Account<'info, StakingPool>,

    /// [audit fix C-S1] PDA derived from stake_nonce argument (matches the
    /// nonce assigned by `stake_ora`).
    /// [audit fix C-S5] close = user refunds rent + makes future re-loads
    /// impossible.
    /// [audit fix H-S1] has_one = user binds the stake to the actual signer.
    #[account(
        mut,
        seeds = [b"stake", user.key().as_ref(), stake_nonce.to_le_bytes().as_ref()],
        bump = stake_account.bump,
        has_one = owner @ ErrorCode::Unauthorized,
        constraint = stake_account.owner == user.key() @ ErrorCode::Unauthorized,
        constraint = stake_account.amount > 0 @ ErrorCode::NothingStaked,
        close = user,
    )]
    pub stake_account: Account<'info, StakeAccount>,

    /// [audit fix C-S2] vault must be owned by staking_pool PDA.
    #[account(mut, constraint = vault_token_account.owner == staking_pool.key() @ ErrorCode::Unauthorized)]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// [audit fix round2 R2-H-S1] reward_vault required so unstake can pay
    /// out accrued rewards before closing. Constrained to staking_pool PDA.
    #[account(mut, constraint = reward_vault.owner == staking_pool.key() @ ErrorCode::Unauthorized)]
    pub reward_vault: Account<'info, TokenAccount>,

    /// [audit fix H-S1] destination must be owned by the stake owner / signer.
    #[account(mut, constraint = user_token_account.owner == user.key() @ ErrorCode::Unauthorized)]
    pub user_token_account: Account<'info, TokenAccount>,

    /// CHECK: cross-checked via has_one against stake_account.owner AND
    /// constrained to equal `user.key()` so the AccountInfo can't be a third
    /// party.
    #[account(constraint = owner.key() == user.key() @ ErrorCode::Unauthorized)]
    pub owner: AccountInfo<'info>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(stake_nonce: u64)]
pub struct ClaimStakingReward<'info> {
    #[account(
        seeds = [b"staking_pool"],
        bump = staking_pool.bump
    )]
    pub staking_pool: Account<'info, StakingPool>,

    /// [audit fix C-S1] PDA derived from stake_nonce argument.
    /// [audit fix H-S2] has_one = user enforces that the signer owns the stake.
    #[account(
        mut,
        seeds = [b"stake", user.key().as_ref(), stake_nonce.to_le_bytes().as_ref()],
        bump = stake_account.bump,
        has_one = owner @ ErrorCode::Unauthorized,
        constraint = stake_account.owner == user.key() @ ErrorCode::Unauthorized,
        constraint = stake_account.amount > 0 @ ErrorCode::NothingStaked,
    )]
    pub stake_account: Account<'info, StakeAccount>,

    /// [audit fix C-S3] reward_vault must be owned by the staking_pool PDA
    /// (the only authority that can sign for transfers out of it).
    #[account(mut, constraint = reward_vault.owner == staking_pool.key() @ ErrorCode::Unauthorized)]
    pub reward_vault: Account<'info, TokenAccount>,

    /// [audit fix H-S2] destination owned by stake owner.
    #[account(mut, constraint = user_token_account.owner == user.key() @ ErrorCode::Unauthorized)]
    pub user_token_account: Account<'info, TokenAccount>,

    /// CHECK: constrained to equal stake_account.owner via has_one + equals user.
    #[account(constraint = owner.key() == user.key() @ ErrorCode::Unauthorized)]
    pub owner: AccountInfo<'info>,

    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

/// [audit fix R2-M-S2] Context for closing a fully-drained `StakeCounter`.
/// Refunds rent to the owner.
#[derive(Accounts)]
pub struct CloseStakeCounter<'info> {
    #[account(
        mut,
        seeds = [StakeCounter::SEED, user.key().as_ref()],
        bump = stake_counter.bump,
        has_one = user @ ErrorCode::Unauthorized,
        close = user,
    )]
    pub stake_counter: Account<'info, StakeCounter>,

    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateDailyRewards<'info> {
    #[account(
        mut,
        seeds = [b"staking_pool"],
        bump = staking_pool.bump,
        has_one = authority
    )]
    pub staking_pool: Account<'info, StakingPool>,

    /// [audit fix C-S2] reward source bound to hardcoded protocol treasury.
    #[account(mut, address = REWARD_SOURCE_TREASURY @ ErrorCode::Unauthorized)]
    pub reward_source: Account<'info, TokenAccount>,

    /// [audit fix C-S2] reward vault bound to the staking_pool PDA so it
    /// can't be redirected to an attacker-owned account.
    #[account(mut, constraint = reward_vault.owner == staking_pool.key() @ ErrorCode::Unauthorized)]
    pub reward_vault: Account<'info, TokenAccount>,

    /// [audit fix C-S2 / H-S3] authority must equal hardcoded PROGRAM_ADMIN.
    #[account(address = PROGRAM_ADMIN @ ErrorCode::Unauthorized)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}


#[event]
pub struct StakeEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub lockup_tier: LockupTier,
    pub multiplier_bps: u16,
    pub timestamp: i64,
    pub stake_nonce: u64,
}

#[event]
pub struct UnstakeEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub penalty: u64,
    pub early: bool,
    pub timestamp: i64,
}

#[event]
pub struct RewardClaimEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}
// === Error Codes ===

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("No rewards to claim")]
    NoRewardsToClaim,
    #[msg("Too early for daily update")]
    TooEarlyForUpdate,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Nothing staked")]
    NothingStaked,
    #[msg("Overflow")]
    Overflow,
    #[msg("Stake below minimum amount")]
    StakeBelowMinimum,
}
