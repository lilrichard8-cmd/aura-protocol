use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("CreatorCoinProgram11111111111111111111111111");

/// Fixed supply per creator coin
const TOTAL_SUPPLY: u64 = 10_000;
const TOTAL_SUPPLY_RAW: u64 = 10_000 * 1_000_000_000; // 9 decimals
/// Initial unlocked supply
const INITIAL_SUPPLY: u64 = 2_000;
const INITIAL_SUPPLY_RAW: u64 = 2_000 * 1_000_000_000;
/// Locked supply
const LOCKED_SUPPLY: u64 = 8_000;
const LOCKED_SUPPLY_RAW: u64 = 8_000 * 1_000_000_000;
/// Monthly unlock amount (8000 / 10 months = 800)
const MONTHLY_UNLOCK: u64 = 800 * 1_000_000_000;
/// Unlock period: 10 months
const UNLOCK_MONTHS: u8 = 10;
/// Seconds per month (30 days)
const MONTH_SECONDS: i64 = 30 * 24 * 60 * 60;
/// Minimum followers to mint
const MIN_FOLLOWERS: u32 = 100;
/// Activity thresholds (need any 2 of 3)
const MIN_MONTHLY_POSTS: u32 = 5;
const MIN_MONTHLY_TRADES: u32 = 1; // any trade happened
const MIN_MONTHLY_INTERACTIONS: u32 = 20;
/// Trading fee: 5% (2.5% creator + 2.5% ORA burn)
const TRADING_FEE_BPS: u64 = 500;

#[program]
pub mod aura_creator_coin {
    use super::*;

    /// Create a Creator Coin — FREE, requires 100+ followers
    /// Mints 2,000 to creator, locks 8,000 in vesting vault
    pub fn create_creator_coin(
        ctx: Context<CreateCreatorCoin>,
        symbol: String,
        initial_price: u64,
    ) -> Result<()> {
        require!(symbol.len() <= 10, ErrorCode::SymbolTooLong);

        // Verify follower count
        let profile = &ctx.accounts.creator_profile;
        require!(profile.follower_count >= MIN_FOLLOWERS, ErrorCode::InsufficientFollowers);

        let coin = &mut ctx.accounts.creator_coin;
        let now = Clock::get()?.unix_timestamp;

        coin.creator = ctx.accounts.creator.key();
        coin.mint = ctx.accounts.creator_coin_mint.key();
        coin.symbol = symbol.clone();
        coin.initial_price = initial_price;
        coin.total_supply = TOTAL_SUPPLY_RAW;
        coin.circulating_supply = INITIAL_SUPPLY_RAW;
        coin.locked_supply = LOCKED_SUPPLY_RAW;
        coin.months_unlocked = 0;
        coin.last_unlock_time = now;
        coin.created_at = now;
        coin.total_trading_volume = 0;
        coin.total_fees_earned = 0;
        coin.bump = ctx.bumps.creator_coin;

        // Mint initial 2,000 to creator
        let seeds = &[b"creator_coin", ctx.accounts.creator.key().as_ref(), &[coin.bump]];
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
            INITIAL_SUPPLY_RAW,
        )?;

        msg!("Creator Coin '{}' created: 2000 minted, 8000 locked for 10-month vesting", symbol);
        Ok(())
    }

    /// Monthly unlock: creator claims 800 tokens if active
    /// Activity = any 2 of 3: (5+ posts, any trade, 20+ interactions)
    pub fn unlock_monthly(
        ctx: Context<UnlockMonthly>,
        monthly_posts: u32,
        monthly_trades: u32,
        monthly_interactions: u32,
    ) -> Result<()> {
        let coin = &mut ctx.accounts.creator_coin;
        let now = Clock::get()?.unix_timestamp;

        // Check still has locked tokens
        require!(coin.locked_supply > 0, ErrorCode::FullyUnlocked);
        require!(coin.months_unlocked < UNLOCK_MONTHS, ErrorCode::FullyUnlocked);

        // Check 30 days passed since last unlock
        let time_since_last = now - coin.last_unlock_time;
        require!(time_since_last >= MONTH_SECONDS, ErrorCode::UnlockTooEarly);

        // Check activity: need any 2 of 3 criteria
        let mut criteria_met: u8 = 0;
        if monthly_posts >= MIN_MONTHLY_POSTS { criteria_met += 1; }
        if monthly_trades >= MIN_MONTHLY_TRADES { criteria_met += 1; }
        if monthly_interactions >= MIN_MONTHLY_INTERACTIONS { criteria_met += 1; }
        require!(criteria_met >= 2, ErrorCode::InsufficientActivity);

        // Mint 800 tokens to creator
        let unlock_amount = MONTHLY_UNLOCK.min(coin.locked_supply);
        
        let creator_key = coin.creator;
        let seeds = &[b"creator_coin", creator_key.as_ref(), &[coin.bump]];
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
            unlock_amount,
        )?;

        coin.locked_supply = coin.locked_supply.saturating_sub(unlock_amount);
        coin.circulating_supply = coin.circulating_supply.checked_add(unlock_amount).ok_or(ErrorCode::Overflow)?;
        coin.months_unlocked += 1;
        coin.last_unlock_time = now;

        msg!(
            "Unlocked {} tokens (month {}/{}). Remaining locked: {}",
            unlock_amount / 1_000_000_000,
            coin.months_unlocked,
            UNLOCK_MONTHS,
            coin.locked_supply / 1_000_000_000
        );
        Ok(())
    }

    /// Place a sell order (挂单卖出)
    pub fn create_sell_order(
        ctx: Context<CreateOrder>,
        amount: u64,
        price_per_token: u64,
        order_nonce: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(price_per_token > 0, ErrorCode::InvalidPrice);

        // Transfer coins from seller to escrow
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.maker_coin_account.to_account_info(),
                    to: ctx.accounts.escrow_coin_account.to_account_info(),
                    authority: ctx.accounts.maker.to_account_info(),
                },
            ),
            amount,
        )?;

        let order = &mut ctx.accounts.order;
        order.coin_mint = ctx.accounts.creator_coin.mint;
        order.maker = ctx.accounts.maker.key();
        order.is_sell = true;
        order.price_per_token = price_per_token;
        order.amount = amount;
        order.filled = 0;
        order.is_active = true;
        order.created_at = Clock::get()?.unix_timestamp;
        order.nonce = order_nonce;
        order.bump = ctx.bumps.order;

        msg!("Sell order: {} tokens @ {} each", amount / 1_000_000_000, price_per_token);
        Ok(())
    }

    /// Fill a sell order (买家吃卖单)
    /// Fee: 5% total — 2.5% to creator, 2.5% burned as ORA
    pub fn fill_order(ctx: Context<FillOrder>, fill_amount: u64) -> Result<()> {
        let order = &mut ctx.accounts.order;
        require!(order.is_active, ErrorCode::OrderNotActive);
        require!(order.is_sell, ErrorCode::InvalidOrderType);

        let remaining = order.amount - order.filled;
        let actual_fill = fill_amount.min(remaining);
        require!(actual_fill > 0, ErrorCode::InvalidAmount);

        // Calculate total cost in ORA
        let total_cost = (actual_fill as u128)
            .checked_mul(order.price_per_token as u128).ok_or(ErrorCode::Overflow)?
            .checked_div(1_000_000_000).ok_or(ErrorCode::Overflow)? as u64; // per whole token

        // Fee: 5% of total cost
        let total_fee = total_cost.checked_mul(TRADING_FEE_BPS).ok_or(ErrorCode::Overflow)? / 10000;
        let creator_fee = total_fee / 2;  // 2.5%
        let burn_fee = total_fee - creator_fee; // 2.5%
        let seller_receives = total_cost.checked_sub(total_fee).ok_or(ErrorCode::Overflow)?;

        // Buyer pays ORA → seller
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

        // Buyer pays 2.5% fee → creator
        if creator_fee > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.buyer_ora_account.to_account_info(),
                        to: ctx.accounts.creator_ora_account.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                ),
                creator_fee,
            )?;
        }

        // Buyer pays 2.5% → burn ORA
        if burn_fee > 0 {
            token::burn(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Burn {
                        mint: ctx.accounts.ora_mint.to_account_info(),
                        from: ctx.accounts.buyer_ora_account.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                ),
                burn_fee,
            )?;
        }

        // Transfer coins from escrow → buyer
        let creator_key = ctx.accounts.creator_coin.creator;
        let coin_bump = ctx.accounts.creator_coin.bump;
        let seeds = &[b"creator_coin", creator_key.as_ref(), &[coin_bump]];
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_coin_account.to_account_info(),
                    to: ctx.accounts.buyer_coin_account.to_account_info(),
                    authority: ctx.accounts.creator_coin.to_account_info(),
                },
                signer,
            ),
            actual_fill,
        )?;

        // Update order
        order.filled = order.filled.checked_add(actual_fill).ok_or(ErrorCode::Overflow)?;
        if order.filled >= order.amount {
            order.is_active = false;
        }

        // Update stats
        let coin = &mut ctx.accounts.creator_coin;
        coin.total_trading_volume = coin.total_trading_volume.checked_add(total_cost).ok_or(ErrorCode::Overflow)?;
        coin.total_fees_earned = coin.total_fees_earned.checked_add(creator_fee).ok_or(ErrorCode::Overflow)?;

        msg!("Filled {} tokens, cost {} ORA (fee: {} creator + {} burned)", 
            actual_fill / 1_000_000_000, total_cost, creator_fee, burn_fee);
        Ok(())
    }

    /// Cancel an order and return escrowed tokens
    pub fn cancel_order(ctx: Context<CancelOrder>) -> Result<()> {
        let order = &mut ctx.accounts.order;
        require!(order.is_active, ErrorCode::OrderNotActive);
        require!(order.maker == ctx.accounts.maker.key(), ErrorCode::Unauthorized);

        let unfilled = order.amount - order.filled;

        if unfilled > 0 && order.is_sell {
            let creator_key = ctx.accounts.creator_coin.creator;
            let coin_bump = ctx.accounts.creator_coin.bump;
            let seeds = &[b"creator_coin", creator_key.as_ref(), &[coin_bump]];
            let signer = &[&seeds[..]];

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.escrow_coin_account.to_account_info(),
                        to: ctx.accounts.maker_coin_account.to_account_info(),
                        authority: ctx.accounts.creator_coin.to_account_info(),
                    },
                    signer,
                ),
                unfilled,
            )?;
        }

        order.is_active = false;
        msg!("Order cancelled, {} tokens returned", unfilled / 1_000_000_000);
        Ok(())
    }
}

// === Accounts ===

#[account]
pub struct CreatorCoin {
    pub creator: Pubkey,           // 32
    pub mint: Pubkey,              // 32
    pub symbol: String,            // 4+10
    pub initial_price: u64,        // 8
    pub total_supply: u64,         // 8
    pub circulating_supply: u64,   // 8
    pub locked_supply: u64,        // 8
    pub months_unlocked: u8,       // 1
    pub last_unlock_time: i64,     // 8
    pub created_at: i64,           // 8
    pub total_trading_volume: u64, // 8
    pub total_fees_earned: u64,    // 8
    pub bump: u8,                  // 1
}

/// Reference to core::UserProfile
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

#[account]
pub struct Order {
    pub coin_mint: Pubkey,       // 32
    pub maker: Pubkey,           // 32
    pub is_sell: bool,           // 1
    pub price_per_token: u64,    // 8
    pub amount: u64,             // 8
    pub filled: u64,             // 8
    pub is_active: bool,         // 1
    pub created_at: i64,         // 8
    pub nonce: u64,              // 8
    pub bump: u8,                // 1
}

// === Contexts ===

#[derive(Accounts)]
#[instruction(symbol: String)]
pub struct CreateCreatorCoin<'info> {
    #[account(
        init, payer = creator,
        space = 8 + 32 + 32 + (4+10) + 8 + 8 + 8 + 8 + 1 + 8 + 8 + 8 + 8 + 1,
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
    #[account(mut)]
    pub creator_token_account: Account<'info, TokenAccount>,
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
pub struct UnlockMonthly<'info> {
    #[account(
        mut,
        seeds = [b"creator_coin", creator.key().as_ref()],
        bump = creator_coin.bump,
        has_one = creator @ ErrorCode::Unauthorized
    )]
    pub creator_coin: Account<'info, CreatorCoin>,
    #[account(
        mut,
        seeds = [b"creator_coin_mint", creator.key().as_ref()],
        bump
    )]
    pub creator_coin_mint: Account<'info, Mint>,
    #[account(mut)]
    pub creator_token_account: Account<'info, TokenAccount>,
    pub creator: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(amount: u64, price_per_token: u64, order_nonce: u64)]
pub struct CreateOrder<'info> {
    #[account(
        seeds = [b"creator_coin", creator_coin.creator.as_ref()],
        bump = creator_coin.bump
    )]
    pub creator_coin: Account<'info, CreatorCoin>,
    #[account(
        init, payer = maker,
        space = 8 + 32 + 32 + 1 + 8 + 8 + 8 + 1 + 8 + 8 + 1,
        seeds = [b"order", maker.key().as_ref(), order_nonce.to_le_bytes().as_ref()],
        bump
    )]
    pub order: Account<'info, Order>,
    #[account(mut)]
    pub maker_coin_account: Account<'info, TokenAccount>,
    /// Escrow: PDA-owned token account for escrowed coins
    #[account(mut)]
    pub escrow_coin_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub maker: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FillOrder<'info> {
    #[account(mut)]
    pub creator_coin: Account<'info, CreatorCoin>,
    #[account(mut, constraint = order.is_active @ ErrorCode::OrderNotActive)]
    pub order: Account<'info, Order>,
    // Coin accounts
    #[account(mut)]
    pub escrow_coin_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub buyer_coin_account: Account<'info, TokenAccount>,
    // ORA accounts
    #[account(mut)]
    pub buyer_ora_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub seller_ora_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub creator_ora_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub ora_mint: Account<'info, Mint>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelOrder<'info> {
    pub creator_coin: Account<'info, CreatorCoin>,
    #[account(mut)]
    pub order: Account<'info, Order>,
    #[account(mut)]
    pub escrow_coin_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub maker_coin_account: Account<'info, TokenAccount>,
    pub maker: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// === Errors ===

#[error_code]
pub enum ErrorCode {
    #[msg("Symbol too long (max 10)")] SymbolTooLong,
    #[msg("Need 100+ followers")] InsufficientFollowers,
    #[msg("All tokens already unlocked")] FullyUnlocked,
    #[msg("Must wait 30 days between unlocks")] UnlockTooEarly,
    #[msg("Insufficient activity: need 2 of 3 (5 posts / any trade / 20 interactions)")] InsufficientActivity,
    #[msg("Invalid amount")] InvalidAmount,
    #[msg("Invalid price")] InvalidPrice,
    #[msg("Order not active")] OrderNotActive,
    #[msg("Invalid order type")] InvalidOrderType,
    #[msg("Unauthorized")] Unauthorized,
    #[msg("Overflow")] Overflow,
}
