use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("6h1sZi8cG3WNB2r9FqTkgoMLBBUPZWbyWPQ3mRsSPyAv");

const SECONDS_PER_DAY: i64 = 86400;

#[program]
pub mod aura_staking {
    use super::*;

    /// Initialize the staking pool
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

    /// Stake ORA tokens with a lockup tier
    pub fn stake_ora(
        ctx: Context<StakeOra>,
        amount: u64,
        lockup_tier: LockupTier,
        stake_nonce: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let now = Clock::get()?.unix_timestamp;
        let (lockup_days, multiplier_bps) = lockup_tier.params();

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
        stake.stake_nonce = stake_nonce;
        stake.amount = amount;
        stake.lockup_tier = lockup_tier;
        stake.staked_at = now;
        stake.unlock_at = now + (lockup_days as i64 * SECONDS_PER_DAY);
        stake.multiplier_bps = multiplier_bps;
        stake.reward_debt = (amount as u128)
            .checked_mul(multiplier_bps as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap()
            .checked_mul(ctx.accounts.staking_pool.accumulated_reward_per_weight as u128)
            .unwrap()
            .checked_div(1_000_000_000)
            .unwrap() as u64;
        stake.claimed_rewards = 0;
        stake.bump = ctx.bumps.stake_account;

        let weighted = (amount as u128)
            .checked_mul(multiplier_bps as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;

        let pool = &mut ctx.accounts.staking_pool;
        pool.total_staked = pool.total_staked.checked_add(amount).ok_or(ErrorCode::Overflow)?;
        pool.total_weighted_stake = pool.total_weighted_stake.checked_add(weighted).ok_or(ErrorCode::Overflow)?;

        msg!("Staked {} ORA with {:?} lockup (multiplier {}bps)", amount, stake.lockup_tier, multiplier_bps);
        Ok(())
    }

    /// Unstake ORA. Early unstake incurs a 20% penalty.
    pub fn unstake_ora(ctx: Context<UnstakeOra>) -> Result<()> {
        let stake = &ctx.accounts.stake_account;
        let now = Clock::get()?.unix_timestamp;
        let amount = stake.amount;
        let multiplier_bps = stake.multiplier_bps;

        let is_early = now < stake.unlock_at;
        let penalty = if is_early {
            amount.checked_mul(20).unwrap().checked_div(100).unwrap() // 20% penalty
        } else {
            0
        };
        let withdraw_amount = amount.checked_sub(penalty).unwrap();

        let pool_bump = ctx.accounts.staking_pool.bump;
        let seeds = &[b"staking_pool".as_ref(), &[pool_bump]];
        let signer = &[&seeds[..]];

        // Transfer from vault to user
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
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;

        let pool = &mut ctx.accounts.staking_pool;
        pool.total_staked = pool.total_staked.saturating_sub(amount);
        pool.total_weighted_stake = pool.total_weighted_stake.saturating_sub(weighted);

        // Zero out stake (effectively closing it)
        let stake_mut = &mut ctx.accounts.stake_account;
        stake_mut.amount = 0;

        msg!("Unstaked {} ORA (penalty: {}, early: {})", withdraw_amount, penalty, is_early);
        Ok(())
    }

    /// Claim staking rewards
    pub fn claim_staking_reward(ctx: Context<ClaimStakingReward>) -> Result<()> {
        let pool = &ctx.accounts.staking_pool;
        let stake = &ctx.accounts.stake_account;

        let weighted = (stake.amount as u128)
            .checked_mul(stake.multiplier_bps as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap();

        let pending = weighted
            .checked_mul(pool.accumulated_reward_per_weight as u128)
            .unwrap()
            .checked_div(1_000_000_000)
            .unwrap()
            .checked_sub(stake.reward_debt as u128)
            .unwrap_or(0) as u64;

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

        msg!("Claimed {} ORA staking rewards", pending);
        Ok(())
    }

    /// Update daily rewards — called daily to add new rewards from 2% fee pool
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
                .unwrap()
                .checked_div(pool.total_weighted_stake as u128)
                .unwrap() as u64;

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

// === Enums ===

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub enum LockupTier {
    OneDay,
    ThirtyDays,
    NinetyDays,
    OneEightyDays,
}

impl LockupTier {
    /// Returns (lockup_days, multiplier_bps)
    pub fn params(&self) -> (u32, u16) {
        match self {
            LockupTier::OneDay => (1, 10000),        // 1x
            LockupTier::ThirtyDays => (30, 12500),   // 1.25x
            LockupTier::NinetyDays => (90, 17500),   // 1.75x
            LockupTier::OneEightyDays => (180, 25000), // 2.5x
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

#[account]
pub struct StakeAccount {
    pub owner: Pubkey,          // 32
    pub stake_nonce: u64,       // 8 - FIX #12: allows multiple stakes per user
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

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct StakeOra<'info> {
    #[account(
        mut,
        seeds = [b"staking_pool"],
        bump = staking_pool.bump
    )]
    pub staking_pool: Account<'info, StakingPool>,

    #[account(
        init,
        payer = user,
        space = 8 + 32 + 8 + 8 + 1 + 8 + 8 + 2 + 8 + 8 + 1,  // +8 for nonce
seeds = [b"stake", user.key().as_ref(), &Clock::get()?.unix_timestamp.to_le_bytes()],
        bump
    )]
    pub stake_account: Account<'info, StakeAccount>,

    /// Vault PDA token account (authority = staking_pool PDA)
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct UnstakeOra<'info> {
    #[account(
        mut,
        seeds = [b"staking_pool"],
        bump = staking_pool.bump
    )]
    pub staking_pool: Account<'info, StakingPool>,

    #[account(
        mut,
seeds = [b"stake", user.key().as_ref(), &Clock::get()?.unix_timestamp.to_le_bytes()],
        bump = stake_account.bump,
        has_one = owner @ ErrorCode::Unauthorized,
        constraint = stake_account.amount > 0 @ ErrorCode::NothingStaked
    )]
    pub stake_account: Account<'info, StakeAccount>,

    /// Vault PDA token account
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    /// CHECK: owner field validated by has_one
    pub owner: AccountInfo<'info>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimStakingReward<'info> {
    #[account(
        seeds = [b"staking_pool"],
        bump = staking_pool.bump
    )]
    pub staking_pool: Account<'info, StakingPool>,

    #[account(
        mut,
seeds = [b"stake", user.key().as_ref(), &Clock::get()?.unix_timestamp.to_le_bytes()],
        bump = stake_account.bump,
        constraint = stake_account.amount > 0 @ ErrorCode::NothingStaked
    )]
    pub stake_account: Account<'info, StakeAccount>,

    /// Reward vault
    #[account(mut)]
    pub reward_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
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

    #[account(mut)]
    pub reward_source: Account<'info, TokenAccount>,

    #[account(mut)]
    pub reward_vault: Account<'info, TokenAccount>,

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
}
