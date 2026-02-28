use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("CreatorCoinProgram11111111111111111111111111");

/// Fixed supply per creator coin
const FIXED_SUPPLY: u64 = 10_000 * 1_000_000_000; // 10,000 tokens (9 decimals)
/// Minimum followers to mint
const MIN_FOLLOWERS_TO_MINT: u32 = 100;
/// Trading fee: 5% unified (2.5% burn + 2% staking + 0.5% platform)
const TRADING_FEE_BPS: u64 = 500; // 5%
const BURN_BPS: u64 = 250;   // 2.5%
const STAKING_BPS: u64 = 200; // 2%
const PLATFORM_BPS: u64 = 50; // 0.5%

#[program]
pub mod aura_creator_coin {
    use super::*;

    /// Mint a Creator Coin — FREE, but requires 100+ followers
    /// Fixed supply: 10,000 tokens, all go to creator initially
    pub fn create_creator_coin(
        ctx: Context<CreateCreatorCoin>,
        symbol: String,
    ) -> Result<()> {
        require!(symbol.len() <= 10, ErrorCode::SymbolTooLong);

        // Verify follower count from UserProfile
        let profile = &ctx.accounts.creator_profile;
        require!(
            profile.follower_count >= MIN_FOLLOWERS_TO_MINT,
            ErrorCode::InsufficientFollowers
        );

        let creator_coin = &mut ctx.accounts.creator_coin;
        creator_coin.creator = ctx.accounts.creator.key();
        creator_coin.mint = ctx.accounts.creator_coin_mint.key();
        creator_coin.symbol = symbol.clone();
        creator_coin.total_supply = FIXED_SUPPLY;
        creator_coin.total_trading_volume = 0;
        creator_coin.total_burned = 0;
        creator_coin.created_at = Clock::get()?.unix_timestamp;
        creator_coin.bump = ctx.bumps.creator_coin;

        // Mint all 10,000 tokens to creator
        let seeds = &[
            b"creator_coin",
            ctx.accounts.creator.key().as_ref(),
            &[creator_coin.bump],
        ];
        let signer = &[&seeds[..]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.creator_coin_mint.to_account_info(),
                    to: ctx.accounts.creator_token_account.to_account_info(),
                    authority: ctx.accounts.creator_coin.to_account_info(),
                },
                signer,
            ),
            FIXED_SUPPLY,
        )?;

        msg!("Creator Coin '{}' minted: 10,000 tokens to {}", symbol, creator_coin.creator);
        Ok(())
    }

    /// Buy creator coins on secondary market (P2P via orderbook/AMM)
    /// 5% fee: 2.5% burn + 2% staking + 0.5% platform
    pub fn trade_with_fee(
        ctx: Context<TradeWithFee>,
        amount: u64,
        price_lamports: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(price_lamports > 0, ErrorCode::InvalidPrice);

        let total_cost = price_lamports;

        // Calculate fee split
        let burn_amount = total_cost.checked_mul(BURN_BPS).ok_or(ErrorCode::Overflow)? / 10000;
        let staking_amount = total_cost.checked_mul(STAKING_BPS).ok_or(ErrorCode::Overflow)? / 10000;
        let platform_amount = total_cost.checked_mul(PLATFORM_BPS).ok_or(ErrorCode::Overflow)? / 10000;
        let seller_receives = total_cost
            .checked_sub(burn_amount).ok_or(ErrorCode::Overflow)?
            .checked_sub(staking_amount).ok_or(ErrorCode::Overflow)?
            .checked_sub(platform_amount).ok_or(ErrorCode::Overflow)?;

        // Transfer Creator Coins: seller → buyer
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.seller_coin_account.to_account_info(),
                    to: ctx.accounts.buyer_coin_account.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            amount,
        )?;

        // Transfer ORA: buyer → seller (minus fees)
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_ora_account.to_account_info(),
                    to: ctx.accounts.seller_ora_account.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            seller_receives,
        )?;

        // Burn 2.5%
        if burn_amount > 0 {
            token::burn(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Burn {
                        mint: ctx.accounts.ora_mint.to_account_info(),
                        from: ctx.accounts.buyer_ora_account.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                ),
                burn_amount,
            )?;
        }

        // Staking pool 2%
        if staking_amount > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.buyer_ora_account.to_account_info(),
                        to: ctx.accounts.staking_pool.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                ),
                staking_amount,
            )?;
        }

        // Platform 0.5%
        if platform_amount > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.buyer_ora_account.to_account_info(),
                        to: ctx.accounts.platform_treasury.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                ),
                platform_amount,
            )?;
        }

        // Update stats
        let creator_coin = &mut ctx.accounts.creator_coin;
        creator_coin.total_trading_volume = creator_coin.total_trading_volume
            .checked_add(total_cost).ok_or(ErrorCode::Overflow)?;
        creator_coin.total_burned = creator_coin.total_burned
            .checked_add(burn_amount).ok_or(ErrorCode::Overflow)?;

        msg!(
            "Trade: {} coins for {} ORA (burn={} staking={} platform={})",
            amount, total_cost, burn_amount, staking_amount, platform_amount
        );
        Ok(())
    }
}

// === Account Structures ===

#[account]
pub struct CreatorCoin {
    pub creator: Pubkey,              // 32
    pub mint: Pubkey,                 // 32
    pub symbol: String,               // 4 + 10
    pub total_supply: u64,            // 8
    pub total_trading_volume: u64,    // 8
    pub total_burned: u64,            // 8
    pub created_at: i64,              // 8
    pub bump: u8,                     // 1
}

/// Reference to core::UserProfile (read-only for follower check)
#[account]
pub struct UserProfile {
    pub authority: Pubkey,
    pub username: String,
    pub profile_uri: String,
    pub reputation_score: u32,
    pub follower_count: u32,
    pub following_count: u32,
    pub post_count: u32,
    pub created_at: i64,
    pub bump: u8,
}

// === Contexts ===

#[derive(Accounts)]
#[instruction(symbol: String)]
pub struct CreateCreatorCoin<'info> {
    #[account(
        init, payer = creator,
        space = 8 + 32 + 32 + (4 + 10) + 8 + 8 + 8 + 8 + 1,
        seeds = [b"creator_coin", creator.key().as_ref()],
        bump
    )]
    pub creator_coin: Account<'info, CreatorCoin>,

    #[account(
        init, payer = creator,
        mint::decimals = 9,
        mint::authority = creator_coin,
        seeds = [b"creator_coin_mint", creator.key().as_ref()],
        bump
    )]
    pub creator_coin_mint: Account<'info, Mint>,

    /// Creator's token account to receive initial supply
    #[account(mut)]
    pub creator_token_account: Account<'info, TokenAccount>,

    /// Creator's UserProfile (to check follower_count >= 100)
    #[account(
        seeds = [b"user", creator.key().as_ref()],
        bump = creator_profile.bump,
        constraint = creator_profile.authority == creator.key() @ ErrorCode::Unauthorized
    )]
    pub creator_profile: Account<'info, UserProfile>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct TradeWithFee<'info> {
    #[account(
        mut,
        seeds = [b"creator_coin", creator_coin.creator.as_ref()],
        bump = creator_coin.bump
    )]
    pub creator_coin: Account<'info, CreatorCoin>,

    // Seller's creator coin account
    #[account(mut)]
    pub seller_coin_account: Account<'info, TokenAccount>,
    // Buyer's creator coin account
    #[account(mut)]
    pub buyer_coin_account: Account<'info, TokenAccount>,
    // Buyer's ORA account (pays)
    #[account(mut)]
    pub buyer_ora_account: Account<'info, TokenAccount>,
    // Seller's ORA account (receives)
    #[account(mut)]
    pub seller_ora_account: Account<'info, TokenAccount>,
    // Staking pool
    #[account(mut)]
    pub staking_pool: Account<'info, TokenAccount>,
    // Platform treasury
    #[account(mut)]
    pub platform_treasury: Account<'info, TokenAccount>,
    // ORA mint (for burn)
    #[account(mut)]
    pub ora_mint: Account<'info, Mint>,

    pub seller: Signer<'info>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// === Errors ===

#[error_code]
pub enum ErrorCode {
    #[msg("Symbol too long (max 10)")] SymbolTooLong,
    #[msg("Need 100+ followers to mint Creator Coin")] InsufficientFollowers,
    #[msg("Invalid amount")] InvalidAmount,
    #[msg("Invalid price")] InvalidPrice,
    #[msg("Unauthorized")] Unauthorized,
    #[msg("Overflow")] Overflow,
}
