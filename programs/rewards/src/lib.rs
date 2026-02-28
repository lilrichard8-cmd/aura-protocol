use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("Bfwu9gQFyYsaURqDSVYwsfB5VXwGgbTHbSgrzEhNtbuR");

/// Total community incentive allocation: 500M ORA (with 9 decimals)
pub const TOTAL_INCENTIVE_POOL: u64 = 500_000_000 * 1_000_000_000;
/// Incentive tax rate: 10% burned (Triple Burn mechanism #1)
pub const INCENTIVE_TAX_BPS: u64 = 1000; // 10%
/// MAU threshold for base reward change
pub const MAU_THRESHOLD: u64 = 500_000;

#[program]
pub mod aura_rewards {
    use super::*;

    /// Initialize the rewards pool
    pub fn initialize_rewards(
        ctx: Context<InitializeRewards>,
    ) -> Result<()> {
        let state = &mut ctx.accounts.reward_state;
        state.authority = ctx.accounts.authority.key();
        state.ora_mint = ctx.accounts.ora_mint.key();
        state.total_distributed = 0;
        state.total_burned = 0;
        state.current_mau = 0;
        state.phase = RewardPhase::Phase1Creation100;
        state.creation_ratio_bps = 10000; // 100%
        state.curation_ratio_bps = 0;     // 0%
        state.bump = ctx.bumps.reward_state;

        msg!("Rewards initialized. Pool: 500M ORA");
        Ok(())
    }

    /// Distribute creation reward with Model C formula
    /// Reward = Base + 18 / (1 + MAU / 50000)
    /// Base = 2 (MAU < 500k) or 1 (MAU >= 500k)
    /// 5 content tiers multiply the base reward
    pub fn distribute_creation_reward(
        ctx: Context<DistributeCreationReward>,
        content_tier: ContentTier,
    ) -> Result<()> {
        let current_mau = ctx.accounts.reward_state.current_mau;
        let creation_ratio_bps = ctx.accounts.reward_state.creation_ratio_bps;
        let bump = ctx.accounts.reward_state.bump;

        // Calculate raw reward using Model C formula (in ORA tokens with 9 decimals)
        // FIX #11: Use u128 throughout to prevent overflow
        let base: u64 = if current_mau < MAU_THRESHOLD { 2 } else { 1 };
        // Reward = Base + 18 / (1 + MAU / 50000)
        // = Base + 18 * 50000 / (50000 + MAU)  (all in ORA with 9 decimals)
        let decay_component = (18u128 * 1_000_000_000u128 * 50_000u128)
            .checked_div(50_000u128 + current_mau as u128)
            .unwrap_or(0) as u64;
        let base_reward = base
            .checked_mul(1_000_000_000)
            .ok_or(ErrorCode::PoolExhausted)?
            .checked_add(decay_component)
            .ok_or(ErrorCode::PoolExhausted)?;

        let tier_multiplier = match content_tier {
            ContentTier::Basic => 100,
            ContentTier::Standard => 150,
            ContentTier::Premium => 200,
            ContentTier::Professional => 300,
            ContentTier::Exceptional => 500,
        };
        let raw_reward = (base_reward as u128)
            .checked_mul(tier_multiplier as u128)
            .unwrap()
            .checked_div(100)
            .unwrap() as u64;

        let phase_reward = (raw_reward as u128)
            .checked_mul(creation_ratio_bps as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;

        let burn_amount = (phase_reward as u128)
            .checked_mul(INCENTIVE_TAX_BPS as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;
        let net_reward = phase_reward.checked_sub(burn_amount).unwrap();

        let seeds = &[b"reward_state".as_ref(), &[bump]];
        let signer = &[&seeds[..]];

        if net_reward > 0 {
            token::mint_to(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    MintTo {
                        mint: ctx.accounts.ora_mint.to_account_info(),
                        to: ctx.accounts.creator_token_account.to_account_info(),
                        authority: ctx.accounts.reward_state.to_account_info(),
                    },
                    signer,
                ),
                net_reward,
            )?;
        }

        let state = &mut ctx.accounts.reward_state;
        state.total_distributed = state.total_distributed.checked_add(net_reward).unwrap();
        state.total_burned = state.total_burned.checked_add(burn_amount).unwrap();

        msg!(
            "Creation reward: {} ORA (tier {:?}, burned {}, MAU {})",
            net_reward,
            content_tier,
            burn_amount,
            state.current_mau
        );
        Ok(())
    }

    /// Distribute curation reward (time-weighted: early discovery = more)
    pub fn distribute_curation_reward(
        ctx: Context<DistributeCurationReward>,
        curation_weight: u64,
        pool_total_weight: u64,
        pool_reward_amount: u64,
    ) -> Result<()> {
        require!(pool_total_weight > 0, ErrorCode::InvalidWeight);
        require!(curation_weight > 0, ErrorCode::InvalidWeight);

        let curation_ratio_bps = ctx.accounts.reward_state.curation_ratio_bps;
        let bump = ctx.accounts.reward_state.bump;

        // Calculate curator's share of the pool
        let raw_reward = (pool_reward_amount as u128)
            .checked_mul(curation_weight as u128)
            .unwrap()
            .checked_div(pool_total_weight as u128)
            .unwrap() as u64;

        let phase_reward = (raw_reward as u128)
            .checked_mul(curation_ratio_bps as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;

        let burn_amount = (phase_reward as u128)
            .checked_mul(INCENTIVE_TAX_BPS as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;
        let net_reward = phase_reward.checked_sub(burn_amount).unwrap();

        let seeds = &[b"reward_state".as_ref(), &[bump]];
        let signer = &[&seeds[..]];

        if net_reward > 0 {
            token::mint_to(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    MintTo {
                        mint: ctx.accounts.ora_mint.to_account_info(),
                        to: ctx.accounts.curator_token_account.to_account_info(),
                        authority: ctx.accounts.reward_state.to_account_info(),
                    },
                    signer,
                ),
                net_reward,
            )?;
        }

        let state = &mut ctx.accounts.reward_state;
        state.total_distributed = state.total_distributed.checked_add(net_reward).unwrap();
        state.total_burned = state.total_burned.checked_add(burn_amount).unwrap();

        msg!(
            "Curation reward: {} ORA (weight {}/{}, burned {})",
            net_reward,
            curation_weight,
            pool_total_weight,
            burn_amount
        );
        Ok(())
    }

    /// Transition reward phases: 100:0 → 70:30 → 50:50
    pub fn transition_phase(
        ctx: Context<TransitionPhase>,
        new_phase: RewardPhase,
    ) -> Result<()> {
        let state = &mut ctx.accounts.reward_state;
        require!(ctx.accounts.authority.key() == state.authority, ErrorCode::Unauthorized);

        match new_phase {
            RewardPhase::Phase1Creation100 => {
                state.creation_ratio_bps = 10000;
                state.curation_ratio_bps = 0;
            }
            RewardPhase::Phase2Split70_30 => {
                state.creation_ratio_bps = 7000;
                state.curation_ratio_bps = 3000;
            }
            RewardPhase::Phase3Split50_50 => {
                state.creation_ratio_bps = 5000;
                state.curation_ratio_bps = 5000;
            }
        }
        state.phase = new_phase.clone();

        msg!(
            "Phase transitioned to {:?} (creation {}bps, curation {}bps)",
            new_phase,
            state.creation_ratio_bps,
            state.curation_ratio_bps
        );
        Ok(())
    }

    /// Update MAU (Monthly Active Users) for formula calculations
    pub fn update_mau(
        ctx: Context<UpdateMAU>,
        new_mau: u64,
    ) -> Result<()> {
        let state = &mut ctx.accounts.reward_state;
        require!(ctx.accounts.authority.key() == state.authority, ErrorCode::Unauthorized);
        state.current_mau = new_mau;
        msg!("MAU updated to {}", new_mau);
        Ok(())
    }
}

// ============ Accounts ============

#[account]
pub struct RewardState {
    pub authority: Pubkey,         // 32
    pub ora_mint: Pubkey,          // 32
    pub total_distributed: u64,    // 8
    pub total_burned: u64,         // 8
    pub current_mau: u64,          // 8
    pub phase: RewardPhase,        // 1
    pub creation_ratio_bps: u16,   // 2
    pub curation_ratio_bps: u16,   // 2
    pub bump: u8,                  // 1
}

// ============ Enums ============

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
pub enum ContentTier {
    Basic,         // 1.0x
    Standard,      // 1.5x
    Premium,       // 2.0x
    Professional,  // 3.0x
    Exceptional,   // 5.0x
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
pub enum RewardPhase {
    Phase1Creation100,  // 100:0 creation:curation
    Phase2Split70_30,   // 70:30
    Phase3Split50_50,   // 50:50
}

// ============ Contexts ============

#[derive(Accounts)]
pub struct InitializeRewards<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 1 + 2 + 2 + 1,
        seeds = [b"reward_state"],
        bump
    )]
    pub reward_state: Account<'info, RewardState>,
    #[account(mut)]
    pub ora_mint: Account<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DistributeCreationReward<'info> {
    #[account(
        mut,
        seeds = [b"reward_state"],
        bump = reward_state.bump
    )]
    pub reward_state: Account<'info, RewardState>,
    #[account(mut)]
    pub ora_mint: Account<'info, Mint>,
    /// Creator's ORA token account
    #[account(mut)]
    pub creator_token_account: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct DistributeCurationReward<'info> {
    #[account(
        mut,
        seeds = [b"reward_state"],
        bump = reward_state.bump
    )]
    pub reward_state: Account<'info, RewardState>,
    #[account(mut)]
    pub ora_mint: Account<'info, Mint>,
    /// Curator's ORA token account
    #[account(mut)]
    pub curator_token_account: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct TransitionPhase<'info> {
    #[account(
        mut,
        seeds = [b"reward_state"],
        bump = reward_state.bump
    )]
    pub reward_state: Account<'info, RewardState>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateMAU<'info> {
    #[account(
        mut,
        seeds = [b"reward_state"],
        bump = reward_state.bump
    )]
    pub reward_state: Account<'info, RewardState>,
    pub authority: Signer<'info>,
}

// ============ Errors ============

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid weight")]
    InvalidWeight,
    #[msg("Reward pool exhausted")]
    PoolExhausted,
}
