use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};

declare_id!("Bhni5CRZwqPGS9PhvUQtnKFpDs1vjZ4ckYaFayfNQeqH");

/// Fee split: 5% total = 2.5% burn + 2% staking + 0.5% platform
const BURN_BPS: u64 = 250;
const STAKING_BPS: u64 = 200;
const PLATFORM_BPS: u64 = 50;
const FEE_BPS: u64 = 500;
const LARGE_TIP_THRESHOLD: u64 = 100_000_000; // 100 ORA (6 decimals)

#[program]
pub mod aura_livestream {
    use super::*;

    /// Creator starts a livestream session
    pub fn start_stream(
        ctx: Context<StartStream>,
        title: String,
        stream_id: u64,
    ) -> Result<()> {
        require!(title.len() <= 128, ErrorCode::TitleTooLong);

        let stream = &mut ctx.accounts.stream;
        stream.creator = ctx.accounts.creator.key();
        stream.stream_id = stream_id;
        stream.title = title.clone();
        stream.start_time = Clock::get()?.unix_timestamp;
        stream.end_time = 0;
        stream.is_live = true;
        stream.peak_viewers = 0;
        stream.total_tips = 0;
        stream.total_subscriptions = 0;
        stream.bump = ctx.bumps.stream;

        msg!("Stream started: '{}' by {}", title, stream.creator);
        Ok(())
    }

    /// End a livestream, record final stats
    pub fn end_stream(ctx: Context<EndStream>, peak_viewers: u64) -> Result<()> {
        let stream = &mut ctx.accounts.stream;
        require!(stream.is_live, ErrorCode::StreamNotLive);

        stream.is_live = false;
        stream.end_time = Clock::get()?.unix_timestamp;
        stream.peak_viewers = peak_viewers;

        msg!("Stream ended: '{}' duration={}s tips={} peak={}",
            stream.title, stream.end_time - stream.start_time,
            stream.total_tips, peak_viewers);
        Ok(())
    }

    /// Fan tips a streamer with ORA. 5% fee (2.5% burn + 2% staking + 0.5% platform)
    pub fn tip_streamer(ctx: Context<TipStreamer>, amount: u64, tip_nonce: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let burn_amount = amount * BURN_BPS / 10000;
        let staking_amount = amount * STAKING_BPS / 10000;
        let platform_amount = amount * PLATFORM_BPS / 10000;
        let creator_amount = amount - burn_amount - staking_amount - platform_amount;

        // Transfer to creator
        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.creator_token_account.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), creator_amount)?;

        // Transfer to staking pool
        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.staking_pool.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), staking_amount)?;

        // Transfer to platform treasury
        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.platform_treasury.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), platform_amount)?;

        // Burn 2.5%
        token::burn(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.ora_mint.to_account_info(),
                from: ctx.accounts.fan_token_account.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), burn_amount)?;

        // Update stream stats
        let stream = &mut ctx.accounts.stream;
        stream.total_tips = stream.total_tips.checked_add(amount).unwrap();

        // Record tip
        let tip_record = &mut ctx.accounts.tip_record;
        tip_record.fan = ctx.accounts.fan.key();
        tip_record.creator = stream.creator;
        tip_record.amount = amount;
        tip_record.timestamp = Clock::get()?.unix_timestamp;
        tip_record.is_large_tip = amount >= LARGE_TIP_THRESHOLD;
        tip_record.bump = ctx.bumps.tip_record;

        msg!("Tip: {} ORA (burn={} staking={} platform={} creator={})",
            amount, burn_amount, staking_amount, platform_amount, creator_amount);
        Ok(())
    }

    /// Monthly ORA subscription for ad-free + badges. 5% fee.
    pub fn subscribe_to_creator(
        ctx: Context<SubscribeToCreator>,
        monthly_amount: u64,
    ) -> Result<()> {
        require!(monthly_amount > 0, ErrorCode::InvalidAmount);

        let fee = monthly_amount * FEE_BPS / 10000;
        let creator_amount = monthly_amount - fee;

        // Transfer to creator
        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.creator_token_account.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), creator_amount)?;

        // Fee to platform
        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.platform_treasury.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), fee)?;

        let sub = &mut ctx.accounts.subscription;
        let now = Clock::get()?.unix_timestamp;
        sub.fan = ctx.accounts.fan.key();
        sub.creator = ctx.accounts.creator.key();
        sub.monthly_amount = monthly_amount;
        sub.started_at = now;
        sub.expires_at = now + 30 * 86400;
        sub.is_active = true;
        sub.bump = ctx.bumps.subscription;

        msg!("Subscription: fan={} creator={} amount={}", sub.fan, sub.creator, monthly_amount);
        Ok(())
    }


    /// Renew an existing subscription
    /// FIX #13: Allow renewal of expired subscriptions
    pub fn renew_subscription(
        ctx: Context<RenewSubscription>,
        monthly_amount: u64,
    ) -> Result<()> {
        require!(monthly_amount > 0, ErrorCode::InvalidAmount);

        let fee = monthly_amount * FEE_BPS / 10000;
        let creator_amount = monthly_amount - fee;

        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.creator_token_account.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), creator_amount)?;

        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.platform_treasury.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), fee)?;

        let sub = &mut ctx.accounts.subscription;
        let now = Clock::get()?.unix_timestamp;
        // If still active, extend from current expiry; otherwise from now
        let base_time = if sub.expires_at > now { sub.expires_at } else { now };
        sub.monthly_amount = monthly_amount;
        sub.expires_at = base_time + 30 * 86400;
        sub.is_active = true;

        msg!("Subscription renewed: fan={} creator={}", sub.fan, sub.creator);
        Ok(())
    }

    /// Renew an existing subscription (FIX #13)
    pub fn renew_subscription(ctx: Context<RenewSubscription>, monthly_amount: u64) -> Result<()> {
        require!(monthly_amount > 0, ErrorCode::InvalidAmount);

        let fee = monthly_amount * FEE_BPS / 10000;
        let creator_amount = monthly_amount - fee;

        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.creator_token_account.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), creator_amount)?;

        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.platform_treasury.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), fee)?;

        let sub = &mut ctx.accounts.subscription;
        let now = Clock::get()?.unix_timestamp;
        sub.monthly_amount = monthly_amount;
        // Extend from current expiry if still active, else from now
        let base_time = if sub.expires_at > now { sub.expires_at } else { now };
        sub.expires_at = base_time + 30 * 86400;
        sub.is_active = true;

        msg!("Subscription renewed until {}", sub.expires_at);
        Ok(())
    }

    /// Creator sets up a pay-per-view event
    pub fn create_pay_per_view(
        ctx: Context<CreatePayPerView>,
        ppv_id: u64,
        title: String,
        price: u64,
    ) -> Result<()> {
        require!(title.len() <= 128, ErrorCode::TitleTooLong);
        require!(price > 0, ErrorCode::InvalidAmount);

        let ppv = &mut ctx.accounts.ppv_event;
        ppv.creator = ctx.accounts.creator.key();
        ppv.ppv_id = ppv_id;
        ppv.title = title;
        ppv.price = price;
        ppv.total_purchases = 0;
        ppv.total_revenue = 0;
        ppv.is_active = true;
        ppv.created_at = Clock::get()?.unix_timestamp;
        ppv.bump = ctx.bumps.ppv_event;

        msg!("PPV event created: id={} price={}", ppv_id, price);
        Ok(())
    }

    /// Fan purchases access to a PPV stream. 5% fee.
    pub fn purchase_ppv(ctx: Context<PurchasePPV>) -> Result<()> {
        let ppv = &ctx.accounts.ppv_event;
        require!(ppv.is_active, ErrorCode::EventNotActive);

        let price = ppv.price;
        let ppv_id = ppv.ppv_id;
        let fee = price * FEE_BPS / 10000;
        let creator_amount = price - fee;

        // Transfer to creator
        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.creator_token_account.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), creator_amount)?;

        // Fee to platform
        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.platform_treasury.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), fee)?;

        // Record access
        let ppv_key = ctx.accounts.ppv_event.key();
        let access = &mut ctx.accounts.ppv_access;
        access.fan = ctx.accounts.fan.key();
        access.ppv_event = ppv_key;
        access.purchased_at = Clock::get()?.unix_timestamp;
        access.bump = ctx.bumps.ppv_access;

        // Update PPV stats
        let ppv = &mut ctx.accounts.ppv_event;
        ppv.total_purchases += 1;
        ppv.total_revenue = ppv.total_revenue.checked_add(price).unwrap();

        msg!("PPV purchased: fan={} event={}", access.fan, ppv_id);
        Ok(())
    }

    /// Large tips (>100 ORA) trigger bonus Creator Coin interaction
    pub fn creator_coin_tip_boost(ctx: Context<CreatorCoinTipBoost>) -> Result<()> {
        let tip = &ctx.accounts.tip_record;
        require!(tip.is_large_tip, ErrorCode::TipNotLargeEnough);

        let boost = &mut ctx.accounts.tip_boost;
        boost.fan = tip.fan;
        boost.creator = tip.creator;
        boost.tip_amount = tip.amount;
        boost.boost_multiplier = calculate_boost_multiplier(tip.amount);
        boost.timestamp = Clock::get()?.unix_timestamp;
        boost.bump = ctx.bumps.tip_boost;

        msg!("Creator coin boost: tip={} multiplier={}x",
            boost.tip_amount, boost.boost_multiplier);
        Ok(())
    }
}

fn calculate_boost_multiplier(amount: u64) -> u16 {
    let ora = amount / 1_000_000;
    if ora >= 1000 { 500 }
    else if ora >= 500 { 300 }
    else { 200 }
}

// === Accounts ===

#[account]
pub struct LiveStream {
    pub creator: Pubkey,
    pub stream_id: u64,
    pub title: String,
    pub start_time: i64,
    pub end_time: i64,
    pub is_live: bool,
    pub peak_viewers: u64,
    pub total_tips: u64,
    pub total_subscriptions: u64,
    pub bump: u8,
}

#[account]
pub struct TipRecord {
    pub fan: Pubkey,
    pub creator: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
    pub is_large_tip: bool,
    pub bump: u8,
}

#[account]
pub struct Subscription {
    pub fan: Pubkey,
    pub creator: Pubkey,
    pub monthly_amount: u64,
    pub started_at: i64,
    pub expires_at: i64,
    pub is_active: bool,
    pub bump: u8,
}

#[account]
pub struct PPVEvent {
    pub creator: Pubkey,
    pub ppv_id: u64,
    pub title: String,
    pub price: u64,
    pub total_purchases: u64,
    pub total_revenue: u64,
    pub is_active: bool,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
pub struct PPVAccess {
    pub fan: Pubkey,
    pub ppv_event: Pubkey,
    pub purchased_at: i64,
    pub bump: u8,
}

#[account]
pub struct TipBoost {
    pub fan: Pubkey,
    pub creator: Pubkey,
    pub tip_amount: u64,
    pub boost_multiplier: u16,
    pub timestamp: i64,
    pub bump: u8,
}

// === Contexts ===

#[derive(Accounts)]
#[instruction(title: String, stream_id: u64)]
pub struct StartStream<'info> {
    #[account(
        init, payer = creator,
        space = 8 + 32 + 8 + (4 + 128) + 8 + 8 + 1 + 8 + 8 + 8 + 1,
        seeds = [b"stream", creator.key().as_ref(), stream_id.to_le_bytes().as_ref()],
        bump
    )]
    pub stream: Account<'info, LiveStream>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EndStream<'info> {
    #[account(mut, has_one = creator,
        seeds = [b"stream", creator.key().as_ref(), stream.stream_id.to_le_bytes().as_ref()],
        bump = stream.bump
    )]
    pub stream: Account<'info, LiveStream>,
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(amount: u64, tip_nonce: u64)]
pub struct TipStreamer<'info> {
    #[account(mut,
        seeds = [b"stream", stream.creator.as_ref(), stream.stream_id.to_le_bytes().as_ref()],
        bump = stream.bump
    )]
    pub stream: Account<'info, LiveStream>,

    #[account(
        init, payer = fan,
        space = 8 + 32 + 32 + 8 + 8 + 1 + 1,
        seeds = [b"tip", stream.key().as_ref(), fan.key().as_ref(), tip_nonce.to_le_bytes().as_ref()],
        bump
    )]
    pub tip_record: Account<'info, TipRecord>,

    #[account(mut)]
    pub fan_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub creator_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub staking_pool: Account<'info, TokenAccount>,
    #[account(mut)]
    pub platform_treasury: Account<'info, TokenAccount>,
    #[account(mut)]
    pub ora_mint: Account<'info, Mint>,

    #[account(mut)]
    pub fan: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubscribeToCreator<'info> {
    #[account(
        init, payer = fan,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 1 + 1,
        seeds = [b"subscription", creator.key().as_ref(), fan.key().as_ref()],
        bump
    )]
    pub subscription: Account<'info, Subscription>,

    #[account(mut)]
    pub fan_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub creator_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub platform_treasury: Account<'info, TokenAccount>,

    /// CHECK: Creator pubkey
    pub creator: UncheckedAccount<'info>,
    #[account(mut)]
    pub fan: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct RenewSubscription<'info> {
    #[account(
        mut,
        seeds = [b"subscription", creator.key().as_ref(), fan.key().as_ref()],
        bump = subscription.bump,
        constraint = subscription.fan == fan.key() @ ErrorCode::InvalidAmount
    )]
    pub subscription: Account<'info, Subscription>,

    #[account(mut)]
    pub fan_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub creator_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub platform_treasury: Account<'info, TokenAccount>,

    /// CHECK: Creator pubkey
    pub creator: UncheckedAccount<'info>,
    #[account(mut)]
    pub fan: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(ppv_id: u64)]
pub struct CreatePayPerView<'info> {
    #[account(
        init, payer = creator,
        space = 8 + 32 + 8 + (4 + 128) + 8 + 8 + 8 + 1 + 8 + 1,
        seeds = [b"ppv", creator.key().as_ref(), ppv_id.to_le_bytes().as_ref()],
        bump
    )]
    pub ppv_event: Account<'info, PPVEvent>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PurchasePPV<'info> {
    #[account(mut,
        seeds = [b"ppv", ppv_event.creator.as_ref(), ppv_event.ppv_id.to_le_bytes().as_ref()],
        bump = ppv_event.bump
    )]
    pub ppv_event: Account<'info, PPVEvent>,

    #[account(
        init, payer = fan,
        space = 8 + 32 + 32 + 8 + 1,
        seeds = [b"ppv_access", ppv_event.key().as_ref(), fan.key().as_ref()],
        bump
    )]
    pub ppv_access: Account<'info, PPVAccess>,

    #[account(mut)]
    pub fan_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub creator_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub platform_treasury: Account<'info, TokenAccount>,

    #[account(mut)]
    pub fan: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct RenewSubscription<'info> {
    #[account(
        mut,
        seeds = [b"subscription", subscription.creator.as_ref(), fan.key().as_ref()],
        bump = subscription.bump,
        constraint = subscription.fan == fan.key() @ ErrorCode::InvalidAmount
    )]
    pub subscription: Account<'info, Subscription>,

    #[account(mut)]
    pub fan_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub creator_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub platform_treasury: Account<'info, TokenAccount>,

    #[account(mut)]
    pub fan: Signer<'info>,
    pub token_program: Program<'info, Token>,
}
#[derive(Accounts)]
pub struct CreatorCoinTipBoost<'info> {
    pub tip_record: Account<'info, TipRecord>,

    #[account(
        init, payer = authority,
        space = 8 + 32 + 32 + 8 + 2 + 8 + 1,
        seeds = [b"tip_boost", tip_record.key().as_ref()],
        bump
    )]
    pub tip_boost: Account<'info, TipBoost>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Title too long (max 128 chars)")]
    TitleTooLong,
    #[msg("Stream is not live")]
    StreamNotLive,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Event is not active")]
    EventNotActive,
    #[msg("Tip not large enough for boost (minimum 100 ORA)")]
    TipNotLargeEnough,
}
