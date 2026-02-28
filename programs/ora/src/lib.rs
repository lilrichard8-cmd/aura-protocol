use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("Dq6fFo2yjSuiGPhc1hwDocKhEpsSam2X8PbzbhVzTHxN");

const ORA_DECIMALS: u8 = 9;
const INITIAL_SUPPLY: u64 = 1_050_000_000 * 1_000_000_000; // 1.05B with 9 decimals
const MAU_GROWTH_MINT_PER_10K: u64 = 500_000 * 1_000_000_000; // 500k ORA per 10k MAU
const MAU_GROWTH_MINT_CAP: u64 = 75_000_000 * 1_000_000_000; // 75M ORA cap

#[program]
pub mod aura_ora {
    use super::*;

    /// Initialize ORA mint and config. Creates the mint PDA only.
    /// Call mint_initial_supply after creating a token account for the mint.
    pub fn initialize_ora(ctx: Context<InitializeOra>) -> Result<()> {
        let config = &mut ctx.accounts.ora_config;
        config.authority = ctx.accounts.authority.key();
        config.mint = ctx.accounts.ora_mint.key();
        config.total_burned = 0;
        config.mau_growth_minted = 0;
        config.current_mau = 0;
        config.last_mau_checkpoint = 0;
        config.bump = ctx.bumps.ora_config;

        msg!("ORA initialized: mint created, call mint_initial_supply next");
        Ok(())
    }

    /// Mint the initial 1.05B supply to the authority's token account.
    /// Must be called after initialize_ora and after creating a token account for the ORA mint.
    pub fn mint_initial_supply(ctx: Context<MintInitialSupply>) -> Result<()> {
        let config = &ctx.accounts.ora_config;
        let seeds = &[b"ora_config".as_ref(), &[config.bump]];
        let signer = &[&seeds[..]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.ora_mint.to_account_info(),
                    to: ctx.accounts.authority_token_account.to_account_info(),
                    authority: ctx.accounts.ora_config.to_account_info(),
                },
                signer,
            ),
            INITIAL_SUPPLY,
        )?;

        msg!("ORA initial supply minted: 1.05B tokens");
        Ok(())
    }

    /// Mint ORA to a recipient (authority only)
    pub fn mint_ora(ctx: Context<MintOra>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let config = &ctx.accounts.ora_config;
        let seeds = &[b"ora_config".as_ref(), &[config.bump]];
        let signer = &[&seeds[..]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.ora_mint.to_account_info(),
                    to: ctx.accounts.recipient_token_account.to_account_info(),
                    authority: ctx.accounts.ora_config.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        msg!("Minted {} ORA", amount);
        Ok(())
    }

    /// Burn ORA from user's account
    pub fn burn_ora(ctx: Context<BurnOra>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.ora_mint.to_account_info(),
                    from: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        let config = &mut ctx.accounts.ora_config;
        config.total_burned = config.total_burned.checked_add(amount).unwrap();

        emit!(BurnEvent {
            burn_type: BurnType::IncentiveTax,
            amount,
            total_burned: config.total_burned,
            timestamp: Clock::get()?.unix_timestamp,
        });
        msg!("Burned {} ORA", amount);
        Ok(())
    }

    /// Triple burn: incentive tax (10% of rewards), tx fee burn (2.5% of 5% fee with MAU multiplier),
    /// and Type B feature burn (95% of feature payment)
    pub fn triple_burn(
        ctx: Context<TripleBurn>,
        burn_type: BurnType,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let burn_amount = match burn_type {
            BurnType::IncentiveTax => {
                // 10% of reward distribution gets burned
                amount.checked_mul(10).unwrap().checked_div(100).ok_or(ErrorCode::Overflow)?
            }
            BurnType::TransactionFee => {
                // 2.5% of 5% unified fee → burned, with MAU multiplier (1.2x~1.5x)
                let base_burn = amount.checked_mul(25).unwrap().checked_div(1000).unwrap(); // 2.5%
                let mau = ctx.accounts.ora_config.current_mau;
                // Multiplier: 1.2x at 0 MAU, scales to 1.5x at 1M+ MAU
                // Using fixed point: 1200 to 1500 (divide by 1000)
                let multiplier = if mau >= 1_000_000 {
                    1500u64
                } else {
                    1200 + (mau as u128 * 300 / 1_000_000) as u64
                };
                (base_burn as u128)
                    .checked_mul(multiplier as u128)
                    .unwrap()
                    .checked_div(1000)
                    .unwrap() as u64
            }
            BurnType::TypeBFeature => {
                // 95% of feature payments burned
                amount.checked_mul(95).unwrap().checked_div(100).ok_or(ErrorCode::Overflow)?
            }
        };

        if burn_amount > 0 {
            token::burn(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Burn {
                        mint: ctx.accounts.ora_mint.to_account_info(),
                        from: ctx.accounts.source_token_account.to_account_info(),
                        authority: ctx.accounts.authority.to_account_info(),
                    },
                ),
                burn_amount,
            )?;

            let config = &mut ctx.accounts.ora_config;
            config.total_burned = config.total_burned.checked_add(burn_amount).unwrap();
        }

        msg!("Triple burn ({:?}): {} ORA burned from {} input", burn_type, burn_amount, amount);
        Ok(())
    }

    /// Distribute reward using Model C dual-decay formula
    /// Reward = Base + 18 / (1 + MAU / 50000)
    /// Base = 2 ORA (MAU<500k) / 1 ORA (MAU>=500k)
    pub fn distribute_reward(ctx: Context<DistributeReward>) -> Result<()> {
        let config = &ctx.accounts.ora_config;
        let mau = config.current_mau;

        // Base reward: 2 ORA if MAU < 500k, 1 ORA if >= 500k
        let base: u64 = if mau < 500_000 {
            2 * 1_000_000_000
        } else {
            1_000_000_000
        };

        // Bonus: 18 / (1 + MAU / 50000), in ORA with 9 decimals
        // = 18e9 / (1 + MAU/50000) = 18e9 * 50000 / (50000 + MAU)
        let bonus = (18u128 * 1_000_000_000 * 50_000)
            .checked_div(50_000u128 + mau as u128)
            .unwrap_or(0) as u64;

        let total_reward = base.checked_add(bonus).unwrap();

        // Burn 10% (incentive tax)
        let burn_amount = total_reward.checked_mul(10).unwrap().checked_div(100).ok_or(ErrorCode::Overflow)?;
        let net_reward = total_reward.checked_sub(burn_amount).unwrap();

        let config_bump = config.bump;
        let seeds = &[b"ora_config".as_ref(), &[config_bump]];
        let signer = &[&seeds[..]];

        // Mint net reward to recipient
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.ora_mint.to_account_info(),
                    to: ctx.accounts.recipient_token_account.to_account_info(),
                    authority: ctx.accounts.ora_config.to_account_info(),
                },
                signer,
            ),
            net_reward,
        )?;

        msg!("Reward distributed: {} ORA (burned {} incentive tax)", net_reward, burn_amount);
        Ok(())
    }

    /// Unified 5% fee handler: 2.5% burn + 2% staking rewards + 0.5% platform
    pub fn process_fee(ctx: Context<ProcessFee>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let fee = amount.checked_mul(5).ok_or(ErrorCode::Overflow)?.checked_div(100).ok_or(ErrorCode::Overflow)?; // 5%
        let burn_portion = fee.checked_mul(50).ok_or(ErrorCode::Overflow)?.checked_div(100).ok_or(ErrorCode::Overflow)?; // 2.5% of total = 50% of fee
        let staking_portion = fee.checked_mul(40).ok_or(ErrorCode::Overflow)?.checked_div(100).ok_or(ErrorCode::Overflow)?; // 2% of total = 40% of fee
        let platform_portion = fee.checked_sub(burn_portion).ok_or(ErrorCode::Overflow)?.checked_sub(staking_portion).ok_or(ErrorCode::Overflow)?; // 0.5%

        // Burn portion
        if burn_portion > 0 {
            token::burn(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Burn {
                        mint: ctx.accounts.ora_mint.to_account_info(),
                        from: ctx.accounts.fee_source_account.to_account_info(),
                        authority: ctx.accounts.payer.to_account_info(),
                    },
                ),
                burn_portion,
            )?;
        }

        // Transfer staking portion
        if staking_portion > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.fee_source_account.to_account_info(),
                        to: ctx.accounts.staking_pool_account.to_account_info(),
                        authority: ctx.accounts.payer.to_account_info(),
                    },
                ),
                staking_portion,
            )?;
        }

        // Transfer platform portion
        if platform_portion > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.fee_source_account.to_account_info(),
                        to: ctx.accounts.platform_account.to_account_info(),
                        authority: ctx.accounts.payer.to_account_info(),
                    },
                ),
                platform_portion,
            )?;
        }

        let config = &mut ctx.accounts.ora_config;
        config.total_burned = config.total_burned.checked_add(burn_portion).unwrap();

        msg!("Fee processed: {} total, burn={}, staking={}, platform={}", fee, burn_portion, staking_portion, platform_portion);
        Ok(())
    }

    /// MAU growth mint: per 10k new MAU → +500k ORA minted, cap 75M total
    pub fn mau_growth_mint(ctx: Context<MauGrowthMint>, new_mau: u64) -> Result<()> {
        let current_mau = ctx.accounts.ora_config.current_mau;
        let mau_growth_minted = ctx.accounts.ora_config.mau_growth_minted;
        let config_bump = ctx.accounts.ora_config.bump;

        require!(new_mau > current_mau, ErrorCode::MauNotIncreased);

        let mau_increase = new_mau.checked_sub(current_mau).unwrap();
        let checkpoints = mau_increase.checked_div(10_000).unwrap();

        if checkpoints == 0 {
            ctx.accounts.ora_config.current_mau = new_mau;
            msg!("MAU updated to {}, no mint threshold reached", new_mau);
            return Ok(());
        }

        let mint_amount = checkpoints.checked_mul(MAU_GROWTH_MINT_PER_10K).ok_or(ErrorCode::Overflow)?;
        let remaining_cap = MAU_GROWTH_MINT_CAP.saturating_sub(mau_growth_minted);
        let actual_mint = mint_amount.min(remaining_cap);

        if actual_mint > 0 {
            let seeds = &[b"ora_config".as_ref(), &[config_bump]];
            let signer = &[&seeds[..]];

            token::mint_to(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    MintTo {
                        mint: ctx.accounts.ora_mint.to_account_info(),
                        to: ctx.accounts.growth_reserve_account.to_account_info(),
                        authority: ctx.accounts.ora_config.to_account_info(),
                    },
                    signer,
                ),
                actual_mint,
            )?;
        }

        let config = &mut ctx.accounts.ora_config;
        config.mau_growth_minted = mau_growth_minted.checked_add(actual_mint).unwrap();
        config.current_mau = new_mau;
        config.last_mau_checkpoint = new_mau / 10_000 * 10_000;

        msg!("MAU growth mint: {} ORA for {} new MAU (total minted: {})", actual_mint, mau_increase, config.mau_growth_minted);
        Ok(())
    }
}

// === Account Structures ===

#[account]
pub struct OraConfig {
    pub authority: Pubkey,        // 32
    pub mint: Pubkey,             // 32
    pub total_burned: u64,        // 8
    pub mau_growth_minted: u64,   // 8
    pub current_mau: u64,         // 8
    pub last_mau_checkpoint: u64, // 8
    pub bump: u8,                 // 1
}


// FIX #19: Events for chain indexing
#[event]
pub struct BurnEvent {
    pub burn_type: BurnType,
    pub amount: u64,
    pub total_burned: u64,
    pub timestamp: i64,
}

#[event]
pub struct RewardEvent {
    pub recipient: Pubkey,
    pub net_reward: u64,
    pub burn_amount: u64,
    pub mau: u64,
    pub timestamp: i64,
}

#[event]
pub struct FeeProcessedEvent {
    pub amount: u64,
    pub burn_portion: u64,
    pub staking_portion: u64,
    pub platform_portion: u64,
    pub timestamp: i64,
}

#[event]
pub struct MauGrowthMintEvent {
    pub old_mau: u64,
    pub new_mau: u64,
    pub minted: u64,
    pub total_growth_minted: u64,
}
// === Enums ===

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum BurnType {
    IncentiveTax,
    TransactionFee,
    TypeBFeature,
}

// === Context Structures ===

#[derive(Accounts)]
pub struct InitializeOra<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1,
        seeds = [b"ora_config"],
        bump
    )]
    pub ora_config: Account<'info, OraConfig>,

    #[account(
        init,
        payer = authority,
        mint::decimals = 9,
        mint::authority = ora_config,
        seeds = [b"ora_mint"],
        bump
    )]
    pub ora_mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintInitialSupply<'info> {
    #[account(
        seeds = [b"ora_config"],
        bump = ora_config.bump,
        has_one = authority
    )]
    pub ora_config: Account<'info, OraConfig>,

    #[account(
        mut,
        seeds = [b"ora_mint"],
        bump
    )]
    pub ora_mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority_token_account: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct MintOra<'info> {
    #[account(
        seeds = [b"ora_config"],
        bump = ora_config.bump,
        has_one = authority
    )]
    pub ora_config: Account<'info, OraConfig>,

    #[account(
        mut,
        seeds = [b"ora_mint"],
        bump
    )]
    pub ora_mint: Account<'info, Mint>,

    #[account(mut)]
    pub recipient_token_account: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BurnOra<'info> {
    #[account(
        mut,
        seeds = [b"ora_config"],
        bump = ora_config.bump
    )]
    pub ora_config: Account<'info, OraConfig>,

    #[account(
        mut,
        seeds = [b"ora_mint"],
        bump
    )]
    pub ora_mint: Account<'info, Mint>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct TripleBurn<'info> {
    #[account(
        mut,
        seeds = [b"ora_config"],
        bump = ora_config.bump
    )]
    pub ora_config: Account<'info, OraConfig>,

    #[account(
        mut,
        seeds = [b"ora_mint"],
        bump
    )]
    pub ora_mint: Account<'info, Mint>,

    #[account(mut)]
    pub source_token_account: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct DistributeReward<'info> {
    // FIX #20: validate authority
    #[account(
        seeds = [b"ora_config"],
        bump = ora_config.bump,
        has_one = authority @ ErrorCode::InvalidAmount
    )]
    pub ora_config: Account<'info, OraConfig>,

    #[account(
        mut,
        seeds = [b"ora_mint"],
        bump
    )]
    pub ora_mint: Account<'info, Mint>,

    #[account(mut)]
    pub recipient_token_account: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ProcessFee<'info> {
    #[account(
        mut,
        seeds = [b"ora_config"],
        bump = ora_config.bump
    )]
    pub ora_config: Account<'info, OraConfig>,

    #[account(
        mut,
        seeds = [b"ora_mint"],
        bump
    )]
    pub ora_mint: Account<'info, Mint>,

    #[account(mut)]
    pub fee_source_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub staking_pool_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub platform_account: Account<'info, TokenAccount>,

    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct MauGrowthMint<'info> {
    #[account(
        mut,
        seeds = [b"ora_config"],
        bump = ora_config.bump,
        has_one = authority
    )]
    pub ora_config: Account<'info, OraConfig>,

    #[account(
        mut,
        seeds = [b"ora_mint"],
        bump
    )]
    pub ora_mint: Account<'info, Mint>,

    #[account(mut)]
    pub growth_reserve_account: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// === Error Codes ===

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("MAU has not increased")]
    MauNotIncreased,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("MAU growth mint cap reached")]
    MauGrowthCapReached,

    #[msg("Unauthorized")]
    Unauthorized,
}
