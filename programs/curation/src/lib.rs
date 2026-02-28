use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("CurationProgram111111111111111111111111111111");

#[program]
pub mod aura_curation {
    use super::*;

    /// Initialize a curation pool for a content
    pub fn initialize_pool(ctx: Context<InitializePool>) -> Result<()> {
        let pool = &mut ctx.accounts.curation_pool;
        pool.content_id = ctx.accounts.content.key();
        pool.content_publish_time = ctx.accounts.content.created_at;
        pool.total_pool = 0;
        pool.total_weight = 0;
        pool.curators_count = 0;
        pool.is_settled = false;
        pool.bump = ctx.bumps.curation_pool;

        msg!("Curation pool initialized for content: {}", pool.content_id);
        Ok(())
    }

    /// Curate content (like + record discovery time)
    pub fn curate(ctx: Context<Curate>) -> Result<()> {
        let pool = &mut ctx.accounts.curation_pool;
        let record = &mut ctx.accounts.curation_record;
        let clock = Clock::get()?;
        
        require!(!pool.is_settled, ErrorCode::PoolAlreadySettled);

        // Calculate time delta since content publication
        let time_delta_seconds = clock.unix_timestamp - pool.content_publish_time;
        require!(time_delta_seconds >= 0, ErrorCode::InvalidTimeDelta);

        // Calculate curation weight based on time decay
        let curation_weight = calculate_time_decay_weight(time_delta_seconds)?;

        // Update curation record
        record.curator = ctx.accounts.curator.key();
        record.content_id = ctx.accounts.content.key();
        record.curated_at = clock.unix_timestamp;
        record.content_publish_time = pool.content_publish_time;
        record.time_delta_seconds = time_delta_seconds;
        record.curation_weight = curation_weight;
        record.reward_claimed = 0;
        record.bump = ctx.bumps.curation_record;

        // Update pool statistics
        pool.total_weight = pool.total_weight.checked_add(curation_weight).ok_or(ErrorCode::Overflow)?;
        pool.curators_count = pool.curators_count.checked_add(1).ok_or(ErrorCode::Overflow)?;

        // Increment content likes
        let content = &mut ctx.accounts.content;
        content.likes = content.likes.checked_add(1).ok_or(ErrorCode::Overflow)?;

        msg!(
            "Content curated by {} with weight {} (time delta: {}s)",
            record.curator,
            curation_weight,
            time_delta_seconds
        );
        Ok(())
    }

    /// Deposit rewards to curation pool (5% of content revenue)
    pub fn deposit_to_pool(ctx: Context<DepositToPool>, amount: u64) -> Result<()> {
        let pool = &mut ctx.accounts.curation_pool;
        
        require!(!pool.is_settled, ErrorCode::PoolAlreadySettled);
        require!(amount > 0, ErrorCode::InvalidAmount);

        pool.total_pool = pool.total_pool.checked_add(amount).ok_or(ErrorCode::Overflow)?;

        msg!("Deposited {} tokens to curation pool", amount);
        Ok(())
    }

    /// Claim curation rewards
    /// FIX #7: Added actual SOL transfer from reward vault to curator
    pub fn claim_curation_reward(ctx: Context<ClaimCurationReward>) -> Result<()> {
        let pool = &ctx.accounts.curation_pool;
        let record = &mut ctx.accounts.curation_record;
        
        require!(pool.total_pool > 0, ErrorCode::NoRewardsAvailable);
        require!(pool.total_weight > 0, ErrorCode::NoWeightInPool);
        require!(record.reward_claimed == 0, ErrorCode::AlreadyClaimed);

        let reward_amount = (record.curation_weight as u128)
            .checked_mul(pool.total_pool as u128)
            .ok_or(ErrorCode::NoRewardsAvailable)?
            .checked_div(pool.total_weight as u128)
            .ok_or(ErrorCode::NoWeightInPool)? as u64;

        require!(reward_amount > 0, ErrorCode::NoRewardsAvailable);

        // Actual SOL transfer from reward vault to curator
        let vault_lamports = ctx.accounts.reward_vault.lamports();
        require!(vault_lamports >= reward_amount, ErrorCode::NoRewardsAvailable);

        **ctx.accounts.reward_vault.to_account_info().try_borrow_mut_lamports()? -= reward_amount;
        **ctx.accounts.curator.to_account_info().try_borrow_mut_lamports()? += reward_amount;

        record.reward_claimed = reward_amount;

        msg!(
            "Curator {} claimed {} tokens (weight: {}/{})",
            record.curator,
            reward_amount,
            record.curation_weight,
            pool.total_weight
        );
        Ok(())
    }

    /// Settle pool (mark as final, no more curations allowed)
    pub fn settle_pool(ctx: Context<SettlePool>) -> Result<()> {
        let pool = &mut ctx.accounts.curation_pool;
        let clock = Clock::get()?;
        
        // Pool can be settled after 72 hours from content publication
        let time_elapsed = clock.unix_timestamp - pool.content_publish_time;
        let settlement_period: i64 = 72 * 60 * 60; // 72 hours
        
        require!(time_elapsed >= settlement_period, ErrorCode::SettlementPeriodNotReached);
        require!(!pool.is_settled, ErrorCode::PoolAlreadySettled);

        pool.is_settled = true;

        msg!("Curation pool settled for content: {}", pool.content_id);
        Ok(())
    }
}

/// Calculate time decay weight based on discovery time
/// - 前 1 小时发现: 10x
/// - 1-6 小时: 5x  
/// - 6-24 小时: 2x
/// - 24-72 小时: 1x
/// - 72 小时后: 0.1x
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
    pub total_pool: u64,
    pub total_weight: u64,
    pub curators_count: u32,
    pub is_settled: bool,
    pub bump: u8,
}

// External account reference (from core program)
#[account]
pub struct Post {
    pub author: Pubkey,
    pub arweave_tx_id: String,
    pub content_type: u8,
    pub access_control: u8,
    pub price: u64,
    pub likes: u64,
    pub views: u64,
    pub tips_received: u64,
    pub created_at: i64,
    pub is_active: bool,
    pub bump: u8,
}

// Context structures
#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 8 + 8 + 4 + 1 + 1,
        seeds = [b"curation_pool", content.key().as_ref()],
        bump
    )]
    pub curation_pool: Account<'info, CurationPool>,
    
    /// CHECK: Content account from core program
    pub content: Account<'info, Post>,
    
    #[account(mut)]
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
    
    #[account(mut)]
    pub content: Account<'info, Post>,
    
    #[account(mut)]
    pub curator: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositToPool<'info> {
    #[account(mut, seeds = [b"curation_pool", content.key().as_ref()], bump = curation_pool.bump)]
    pub curation_pool: Account<'info, CurationPool>,
    
    /// CHECK: Content account
    pub content: AccountInfo<'info>,
    
    pub authority: Signer<'info>,
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
    
    #[account(seeds = [b"curation_pool", content.key().as_ref()], bump = curation_pool.bump)]
    pub curation_pool: Account<'info, CurationPool>,
    
    /// CHECK: Content account
    pub content: AccountInfo<'info>,

    /// CHECK: Reward vault PDA holding SOL
    #[account(
        mut,
        seeds = [b"reward_vault", content.key().as_ref()],
        bump
    )]
    pub reward_vault: AccountInfo<'info>,
    
    #[account(mut)]
    pub curator: Signer<'info>,
}

#[derive(Accounts)]
pub struct SettlePool<'info> {
    #[account(mut, seeds = [b"curation_pool", content.key().as_ref()], bump = curation_pool.bump)]
    pub curation_pool: Account<'info, CurationPool>,
    
    /// CHECK: Content account
    pub content: AccountInfo<'info>,
    
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
}
