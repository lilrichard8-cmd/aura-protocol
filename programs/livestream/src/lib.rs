use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};

declare_id!("Bhni5CRZwqPGS9PhvUQtnKFpDs1vjZ4ckYaFayfNQeqH");

// =============================================================================
// [audit fix C-L1 / C-L2] Hardcoded protocol mint + treasury addresses.
// ⚠️ DO NOT DEPLOY — placeholders set to system_program::ID. Replace pre-mainnet
// with real ORA mint / staking-rewards / treasury pubkeys.
// =============================================================================

/// Canonical ORA SPL mint. All tips / subs / PPV payments must use this mint.
pub const ORA_MINT: Pubkey = anchor_lang::solana_program::system_program::ID;

/// Hardcoded staking-rewards pool (token account). 2% of tips flow here.
pub const STAKING_REWARDS_POOL: Pubkey = anchor_lang::solana_program::system_program::ID;

/// Hardcoded ops treasury (token account). 0.5% of tips + subscription
/// fees + PPV fees flow here (protocol operations leg).
/// [whitepaper-sync v1.1] renamed from PLATFORM_TREASURY; was a single 0.5%
/// leg, now split into ops (0.5%) + gas reserve (0.5%) per WP §5.7.
/// ⚠️ DO NOT DEPLOY — placeholder set to system_program::ID.
pub const PLATFORM_TREASURY: Pubkey = anchor_lang::solana_program::system_program::ID;

/// [whitepaper-sync v1.1] Hardcoded gas-reserve pool (token account).
/// 0.5% of every livestream-channel fee flows here, matching the WP §5.7
/// unified 5% = 2/2/0.5/0.5 split. The previous 3-way split silently
/// dropped the gas-reserve leg, starving the pool that pays Solana base
/// fees for new-user gas abstraction (WP §5.13).
/// ⚠️ DO NOT DEPLOY — placeholder set to system_program::ID.
pub const GAS_RESERVE_POOL: Pubkey = anchor_lang::solana_program::system_program::ID;

/// Hardcoded protocol oracle authorised to report off-chain stats (e.g.,
/// `peak_viewers`). [audit fix C-L4] Without this signature `end_stream`
/// cannot mutate viewer counts.
pub const PEAK_VIEWERS_ORACLE: Pubkey = anchor_lang::solana_program::system_program::ID;

/// [whitepaper-sync v1.1] Fee split: 5% total = 2% burn + 2% staking + 0.5%
/// gas reserve + 0.5% ops, matching Whitepaper v1.1 §5.7 and Numbers
/// Handbook §5 (40/40/10/10 of the 5% fee). Previous values were
/// BURN_BPS=250 / STAKING_BPS=200 / PLATFORM_BPS=50 (a 3-way 2.5/2/0.5
/// split that omitted the gas-reserve leg). All four legs are now routed
/// through dedicated transfers in tip_streamer / subscribe_to_creator /
/// renew_subscription / purchase_ppv.
const BURN_BPS: u64 = 200;
const STAKING_BPS: u64 = 200;
const GAS_BPS: u64 = 50;
const OPS_BPS: u64 = 50;
/// [whitepaper-sync v1.1] Kept for documentation: total = BURN + STAKING + GAS + OPS.
#[allow(dead_code)]
const FEE_BPS: u64 = 500;
const LARGE_TIP_THRESHOLD: u64 = 100_000_000; // 100 ORA (6 decimals)

/// [audit fix C-L3 / L-L1] Subscription pricing bounds.
pub const MIN_SUBSCRIPTION_AMOUNT: u64 = 1_000_000;     // 1 ORA (6 decimals)
pub const MAX_SUBSCRIPTION_AMOUNT: u64 = 1_000_000_000_000; // 1M ORA

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

    /// End a livestream, record final stats.
    /// [audit fix C-L4] `peak_viewers` is supplied by the protocol oracle
    /// (PEAK_VIEWERS_ORACLE), NOT the creator.
    /// [audit fix round2 R2-H-L1] No longer requires `is_live`; the oracle
    /// can still record `peak_viewers` after a creator pre-closes the stream
    /// via `end_stream_creator`. If the stream is still live, this call also
    /// flips `is_live = false` to mark closure.
    pub fn end_stream(ctx: Context<EndStream>, peak_viewers: u64) -> Result<()> {
        let stream = &mut ctx.accounts.stream;

        // [audit fix round2 R2-H-L1] If stream is still live, flip it closed
        // and record end_time; if already closed by creator, only update peak.
        if stream.is_live {
            stream.is_live = false;
            stream.end_time = Clock::get()?.unix_timestamp;
        }
        stream.peak_viewers = peak_viewers;

        msg!(
            "Stream ended/peak-set (oracle-signed): '{}' tips={} peak={}",
            stream.title,
            stream.total_tips,
            peak_viewers,
        );
        Ok(())
    }

    /// [audit fix C-L4] Creator can close the stream without supplying
    /// peak_viewers — leaves the field at its current (oracle-set or zero)
    /// value. This means a creator cannot brag with a fake peak.
    pub fn end_stream_creator(ctx: Context<EndStreamCreator>) -> Result<()> {
        let stream = &mut ctx.accounts.stream;
        require!(stream.is_live, ErrorCode::StreamNotLive);
        stream.is_live = false;
        stream.end_time = Clock::get()?.unix_timestamp;
        msg!(
            "Stream closed by creator: '{}' duration={}s tips={}",
            stream.title,
            stream.end_time - stream.start_time,
            stream.total_tips,
        );
        Ok(())
    }

    /// Fan tips a streamer with ORA. 5% fee (2% burn + 2% staking + 0.5% gas
    /// reserve + 0.5% ops) per Whitepaper v1.1 §5.7.
    /// [audit fix C-L1] all token accounts + mint are constrained to canonical
    /// protocol addresses. [audit fix M-L2] tipping requires `stream.is_live`.
    /// [whitepaper-sync v1.1] split now 4-way; gas-reserve leg added.
    pub fn tip_streamer(ctx: Context<TipStreamer>, amount: u64, tip_nonce: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        // [audit fix M-L2] can only tip a live stream
        require!(ctx.accounts.stream.is_live, ErrorCode::StreamNotLive);

        let burn_amount = amount.checked_mul(BURN_BPS).ok_or(ErrorCode::Overflow)? / 10000;
        let staking_amount = amount.checked_mul(STAKING_BPS).ok_or(ErrorCode::Overflow)? / 10000;
        let gas_amount = amount.checked_mul(GAS_BPS).ok_or(ErrorCode::Overflow)? / 10000;
        let ops_amount = amount.checked_mul(OPS_BPS).ok_or(ErrorCode::Overflow)? / 10000;
        let creator_amount = amount
            .checked_sub(burn_amount)
            .ok_or(ErrorCode::Overflow)?
            .checked_sub(staking_amount)
            .ok_or(ErrorCode::Overflow)?
            .checked_sub(gas_amount)
            .ok_or(ErrorCode::Overflow)?
            .checked_sub(ops_amount)
            .ok_or(ErrorCode::Overflow)?;

        // Transfer to creator (95%)
        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.creator_token_account.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), creator_amount)?;

        // Transfer to staking pool (2%)
        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.staking_pool.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), staking_amount)?;

        // [whitepaper-sync v1.1] Transfer to gas reserve pool (0.5%)
        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.gas_reserve_pool.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), gas_amount)?;

        // Transfer to ops treasury (0.5%)
        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.platform_treasury.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), ops_amount)?;

        // Burn 2%
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
        stream.total_tips = stream.total_tips.checked_add(amount).ok_or(ErrorCode::Overflow)?;

        // Record tip
        let tip_record = &mut ctx.accounts.tip_record;
        tip_record.fan = ctx.accounts.fan.key();
        tip_record.creator = stream.creator;
        tip_record.stream = stream.key();
        tip_record.amount = amount;
        tip_record.timestamp = Clock::get()?.unix_timestamp;
        tip_record.is_large_tip = amount >= LARGE_TIP_THRESHOLD;
        tip_record.tip_nonce = tip_nonce;
        tip_record.bump = ctx.bumps.tip_record;

        msg!("Tip: {} ORA (burn={} staking={} gas={} ops={} creator={})",
            amount, burn_amount, staking_amount, gas_amount, ops_amount, creator_amount);
        Ok(())
    }

    /// [audit fix round2 R2-H-L2] Creator sets / updates their monthly
    /// subscription price. Fans cannot dictate the price anymore; both
    /// `subscribe_to_creator` and `renew_subscription` read from this PDA.
    pub fn set_subscription_price(
        ctx: Context<SetSubscriptionPrice>,
        monthly_amount: u64,
    ) -> Result<()> {
        require!(monthly_amount >= MIN_SUBSCRIPTION_AMOUNT, ErrorCode::InvalidAmount);
        require!(monthly_amount <= MAX_SUBSCRIPTION_AMOUNT, ErrorCode::InvalidAmount);
        let cfg = &mut ctx.accounts.subscription_config;
        cfg.creator = ctx.accounts.creator.key();
        cfg.monthly_amount = monthly_amount;
        cfg.is_set = true;
        cfg.bump = ctx.bumps.subscription_config;
        msg!("Subscription price set for {}: {} ORA/month", cfg.creator, monthly_amount);
        Ok(())
    }

    /// Monthly ORA subscription for ad-free + badges. 5% fee.
    /// [audit fix C-L2] same constraint pattern as tip_streamer.
    /// [audit fix round2 R2-H-L2] `monthly_amount` is no longer fan-supplied;
    /// it is read from the creator's `CreatorSubscriptionConfig` PDA. The
    /// creator must have called `set_subscription_price` first.
    pub fn subscribe_to_creator(
        ctx: Context<SubscribeToCreator>,
    ) -> Result<()> {
        // [audit fix round2 R2-H-L2] price is sourced from creator's config.
        require!(ctx.accounts.subscription_config.is_set, ErrorCode::SubscriptionPriceNotSet);
        let monthly_amount = ctx.accounts.subscription_config.monthly_amount;
        require!(monthly_amount >= MIN_SUBSCRIPTION_AMOUNT, ErrorCode::InvalidAmount);
        require!(monthly_amount <= MAX_SUBSCRIPTION_AMOUNT, ErrorCode::InvalidAmount);

        // [whitepaper-sync v1.1] 4-way fee split per WP §5.7
        // (2% burn / 2% staking / 0.5% gas / 0.5% ops).
        let burn_amount = monthly_amount.checked_mul(BURN_BPS).ok_or(ErrorCode::Overflow)? / 10000;
        let staking_amount = monthly_amount.checked_mul(STAKING_BPS).ok_or(ErrorCode::Overflow)? / 10000;
        let gas_amount = monthly_amount.checked_mul(GAS_BPS).ok_or(ErrorCode::Overflow)? / 10000;
        let ops_amount = monthly_amount.checked_mul(OPS_BPS).ok_or(ErrorCode::Overflow)? / 10000;
        let creator_amount = monthly_amount
            .checked_sub(burn_amount).ok_or(ErrorCode::Overflow)?
            .checked_sub(staking_amount).ok_or(ErrorCode::Overflow)?
            .checked_sub(gas_amount).ok_or(ErrorCode::Overflow)?
            .checked_sub(ops_amount).ok_or(ErrorCode::Overflow)?;

        // Transfer to creator (95%)
        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.creator_token_account.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), creator_amount)?;

        // 2% staking
        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.staking_pool.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), staking_amount)?;

        // 0.5% gas reserve
        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.gas_reserve_pool.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), gas_amount)?;

        // 0.5% ops
        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.platform_treasury.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), ops_amount)?;

        // 2% burn
        token::burn(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.ora_mint.to_account_info(),
                from: ctx.accounts.fan_token_account.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), burn_amount)?;

        let sub = &mut ctx.accounts.subscription;
        let now = Clock::get()?.unix_timestamp;
        sub.fan = ctx.accounts.fan.key();
        sub.creator = ctx.accounts.creator.key();
        sub.monthly_amount = monthly_amount;
        sub.started_at = now;
        sub.expires_at = now.checked_add(30 * 86400).ok_or(ErrorCode::Overflow)?;
        sub.is_active = true;
        sub.bump = ctx.bumps.subscription;

        msg!("Subscription: fan={} creator={} amount={} (burn={} staking={} gas={} ops={})",
            sub.fan, sub.creator, monthly_amount, burn_amount, staking_amount, gas_amount, ops_amount);
        Ok(())
    }

    /// Renew an existing subscription.
    /// [audit fix C-L3] monthly_amount is read from the stored subscription —
    /// the fan cannot pass a tiny amount to "cheap-renew". Also adds an
    /// explicit `is_active` check (no renewing an expired/cancelled sub).
    /// [audit fix round2 R2-H-L2] If the creator has raised the price via
    /// `set_subscription_price`, renewal charges the CURRENT creator price.
    pub fn renew_subscription(ctx: Context<RenewSubscription>) -> Result<()> {
        // [audit fix round2 R2-H-L2] use creator's current config price; the
        // stored sub price is only a historical record.
        require!(ctx.accounts.subscription_config.is_set, ErrorCode::SubscriptionPriceNotSet);
        let monthly_amount = ctx.accounts.subscription_config.monthly_amount;
        // [audit fix C-L3] (originally) rejected renewal of inactive subs.
        // [audit fix R3-M-L2] Removed the `is_active` gate. Combined with
        // R2-M-L1's `cancel_subscription`, the old check made cancel a one-way
        // door: the `subscription` PDA is `init` per (creator, fan), so a fan
        // who ever cancelled could never re-subscribe to that creator. Renew
        // is now also the path used to *re-activate* an inactive subscription;
        // `is_active` is explicitly set to true at the end of this function.
        require!(monthly_amount >= MIN_SUBSCRIPTION_AMOUNT, ErrorCode::InvalidAmount);
        require!(monthly_amount <= MAX_SUBSCRIPTION_AMOUNT, ErrorCode::InvalidAmount);

        // [whitepaper-sync v1.1] 4-way fee split per WP §5.7
        // (2% burn / 2% staking / 0.5% gas / 0.5% ops).
        let burn_amount = monthly_amount.checked_mul(BURN_BPS).ok_or(ErrorCode::Overflow)? / 10000;
        let staking_amount = monthly_amount.checked_mul(STAKING_BPS).ok_or(ErrorCode::Overflow)? / 10000;
        let gas_amount = monthly_amount.checked_mul(GAS_BPS).ok_or(ErrorCode::Overflow)? / 10000;
        let ops_amount = monthly_amount.checked_mul(OPS_BPS).ok_or(ErrorCode::Overflow)? / 10000;
        let creator_amount = monthly_amount
            .checked_sub(burn_amount).ok_or(ErrorCode::Overflow)?
            .checked_sub(staking_amount).ok_or(ErrorCode::Overflow)?
            .checked_sub(gas_amount).ok_or(ErrorCode::Overflow)?
            .checked_sub(ops_amount).ok_or(ErrorCode::Overflow)?;

        // Creator 95%
        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.creator_token_account.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), creator_amount)?;

        // 2% staking
        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.staking_pool.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), staking_amount)?;

        // 0.5% gas reserve
        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.gas_reserve_pool.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), gas_amount)?;

        // 0.5% ops
        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.platform_treasury.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), ops_amount)?;

        // 2% burn
        token::burn(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.ora_mint.to_account_info(),
                from: ctx.accounts.fan_token_account.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), burn_amount)?;

        let sub = &mut ctx.accounts.subscription;
        let now = Clock::get()?.unix_timestamp;
        // Extend from current expiry if still active, else from now
        let base_time = if sub.expires_at > now { sub.expires_at } else { now };
        sub.expires_at = base_time.checked_add(30 * 86400).ok_or(ErrorCode::Overflow)?;
        sub.is_active = true;
        // [audit fix round2 R2-H-L2] keep historical sub amount in sync with
        // creator-controlled price at renewal time.
        sub.monthly_amount = monthly_amount;

        msg!("Subscription renewed until {} amount={} (burn={} staking={} gas={} ops={})",
            sub.expires_at, monthly_amount, burn_amount, staking_amount, gas_amount, ops_amount);
        Ok(())
    }

    /// [audit fix R2-M-L1] Cancel an active subscription. The fan signs and
    /// flips `is_active = false`; expiration is left unchanged so the fan
    /// retains paid-for benefits until `expires_at`. Without this path,
    /// `is_active` was a dead field (always `true` after subscribe / renew).
    pub fn cancel_subscription(ctx: Context<CancelSubscription>) -> Result<()> {
        let sub = &mut ctx.accounts.subscription;
        require!(sub.is_active, ErrorCode::SubscriptionInactive);
        sub.is_active = false;
        msg!("Subscription cancelled: fan={} creator={}", sub.fan, sub.creator);
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

    /// [audit fix R2-L-L1] Creator closes a PPV event. Prevents new
    /// `purchase_ppv` calls while leaving existing access records intact.
    /// Without this path, `ppv_event.is_active` was a dead field (always
    /// `true` after create).
    pub fn close_ppv_event(ctx: Context<ClosePpvEvent>) -> Result<()> {
        let ppv = &mut ctx.accounts.ppv_event;
        require!(ppv.is_active, ErrorCode::EventNotActive);
        ppv.is_active = false;
        msg!("PPV event closed: id={}", ppv.ppv_id);
        Ok(())
    }

    /// Fan purchases access to a PPV stream. 5% fee.
    pub fn purchase_ppv(ctx: Context<PurchasePPV>) -> Result<()> {
        let ppv = &ctx.accounts.ppv_event;
        require!(ppv.is_active, ErrorCode::EventNotActive);

        let price = ppv.price;
        let ppv_id = ppv.ppv_id;

        // [whitepaper-sync v1.1] 4-way fee split per WP §5.7
        // (2% burn / 2% staking / 0.5% gas / 0.5% ops).
        let burn_amount = price.checked_mul(BURN_BPS).ok_or(ErrorCode::Overflow)? / 10000;
        let staking_amount = price.checked_mul(STAKING_BPS).ok_or(ErrorCode::Overflow)? / 10000;
        let gas_amount = price.checked_mul(GAS_BPS).ok_or(ErrorCode::Overflow)? / 10000;
        let ops_amount = price.checked_mul(OPS_BPS).ok_or(ErrorCode::Overflow)? / 10000;
        let creator_amount = price
            .checked_sub(burn_amount).ok_or(ErrorCode::Overflow)?
            .checked_sub(staking_amount).ok_or(ErrorCode::Overflow)?
            .checked_sub(gas_amount).ok_or(ErrorCode::Overflow)?
            .checked_sub(ops_amount).ok_or(ErrorCode::Overflow)?;

        // Creator 95%
        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.creator_token_account.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), creator_amount)?;

        // 2% staking
        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.staking_pool.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), staking_amount)?;

        // 0.5% gas reserve
        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.gas_reserve_pool.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), gas_amount)?;

        // 0.5% ops
        token::transfer(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.fan_token_account.to_account_info(),
                to: ctx.accounts.platform_treasury.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), ops_amount)?;

        // 2% burn
        token::burn(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.ora_mint.to_account_info(),
                from: ctx.accounts.fan_token_account.to_account_info(),
                authority: ctx.accounts.fan.to_account_info(),
            },
        ), burn_amount)?;

        // Record access
        let ppv_key = ctx.accounts.ppv_event.key();
        let access = &mut ctx.accounts.ppv_access;
        access.fan = ctx.accounts.fan.key();
        access.ppv_event = ppv_key;
        access.purchased_at = Clock::get()?.unix_timestamp;
        access.bump = ctx.bumps.ppv_access;

        // Update PPV stats
        let ppv = &mut ctx.accounts.ppv_event;
        ppv.total_purchases = ppv.total_purchases.checked_add(1).ok_or(ErrorCode::Overflow)?;
        ppv.total_revenue = ppv.total_revenue.checked_add(price).ok_or(ErrorCode::Overflow)?;

        msg!("PPV purchased: fan={} event={}", access.fan, ppv_id);
        Ok(())
    }

    /// Large tips (>100 ORA) trigger bonus Creator Coin interaction.
    /// [audit fix H-L1 / I-L1] caller MUST be the original tipping fan
    /// (verified via `tip_record.fan == fan.key()`), preventing third-party
    /// grief-creation of boost PDAs.
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
    pub stream: Pubkey,   // [audit fix H-L1] explicit stream binding
    pub amount: u64,
    pub timestamp: i64,
    pub is_large_tip: bool,
    pub tip_nonce: u64,
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

/// [audit fix round2 R2-H-L2] Creator-controlled subscription price. Each
/// creator owns one PDA seeded by their pubkey; only the creator can update.
#[account]
pub struct CreatorSubscriptionConfig {
    pub creator: Pubkey,
    pub monthly_amount: u64,
    pub is_set: bool,
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

// [audit fix C-L4] EndStream now requires the protocol oracle signature.
#[derive(Accounts)]
pub struct EndStream<'info> {
    #[account(mut,
        seeds = [b"stream", stream.creator.as_ref(), stream.stream_id.to_le_bytes().as_ref()],
        bump = stream.bump
    )]
    pub stream: Account<'info, LiveStream>,
    /// [audit fix C-L4] only the hardcoded oracle can set peak_viewers.
    #[account(address = PEAK_VIEWERS_ORACLE @ ErrorCode::Unauthorized)]
    pub oracle: Signer<'info>,
}

#[derive(Accounts)]
pub struct EndStreamCreator<'info> {
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
        space = 8 + 32 + 32 + 32 + 8 + 8 + 1 + 8 + 1,
        seeds = [b"tip", stream.key().as_ref(), fan.key().as_ref(), tip_nonce.to_le_bytes().as_ref()],
        bump
    )]
    pub tip_record: Account<'info, TipRecord>,

    /// [audit fix C-L1] fan_token must be ORA-denominated, owned by the fan.
    #[account(mut,
        constraint = fan_token_account.owner == fan.key() @ ErrorCode::Unauthorized,
        constraint = fan_token_account.mint == ORA_MINT @ ErrorCode::Unauthorized,
    )]
    pub fan_token_account: Account<'info, TokenAccount>,

    /// [audit fix C-L1] creator_token must be ORA-denominated and OWNED by the
    /// stream's creator — the fan can't "refund themselves" by passing their
    /// own ATA.
    #[account(mut,
        constraint = creator_token_account.owner == stream.creator @ ErrorCode::Unauthorized,
        constraint = creator_token_account.mint == ORA_MINT @ ErrorCode::Unauthorized,
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    /// [audit fix C-L1] hardcoded protocol staking-rewards pool.
    #[account(mut, address = STAKING_REWARDS_POOL @ ErrorCode::Unauthorized)]
    pub staking_pool: Account<'info, TokenAccount>,

    /// [whitepaper-sync v1.1] hardcoded protocol gas-reserve pool (0.5% leg).
    #[account(mut, address = GAS_RESERVE_POOL @ ErrorCode::Unauthorized)]
    pub gas_reserve_pool: Account<'info, TokenAccount>,

    /// [audit fix C-L1] hardcoded protocol platform treasury (now ops leg).
    #[account(mut, address = PLATFORM_TREASURY @ ErrorCode::Unauthorized)]
    pub platform_treasury: Account<'info, TokenAccount>,

    /// [audit fix C-L1] only the canonical ORA mint can be burned.
    #[account(mut, address = ORA_MINT @ ErrorCode::Unauthorized)]
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

    /// [audit fix round2 R2-H-L2] Creator-controlled price PDA.
    #[account(
        seeds = [b"sub_config", creator.key().as_ref()],
        bump = subscription_config.bump,
        constraint = subscription_config.creator == creator.key() @ ErrorCode::Unauthorized,
    )]
    pub subscription_config: Account<'info, CreatorSubscriptionConfig>,

    /// [audit fix C-L2] ORA-denominated, fan-owned.
    #[account(mut,
        constraint = fan_token_account.owner == fan.key() @ ErrorCode::Unauthorized,
        constraint = fan_token_account.mint == ORA_MINT @ ErrorCode::Unauthorized,
    )]
    pub fan_token_account: Account<'info, TokenAccount>,

    /// [audit fix C-L2] ORA, owned by the creator key passed in.
    #[account(mut,
        constraint = creator_token_account.owner == creator.key() @ ErrorCode::Unauthorized,
        constraint = creator_token_account.mint == ORA_MINT @ ErrorCode::Unauthorized,
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    /// [whitepaper-sync v1.1] hardcoded protocol staking-rewards pool (2% leg).
    #[account(mut, address = STAKING_REWARDS_POOL @ ErrorCode::Unauthorized)]
    pub staking_pool: Account<'info, TokenAccount>,

    /// [whitepaper-sync v1.1] hardcoded protocol gas-reserve pool (0.5% leg).
    #[account(mut, address = GAS_RESERVE_POOL @ ErrorCode::Unauthorized)]
    pub gas_reserve_pool: Account<'info, TokenAccount>,

    /// [audit fix C-L2] hardcoded platform treasury (now 0.5% ops leg).
    #[account(mut, address = PLATFORM_TREASURY @ ErrorCode::Unauthorized)]
    pub platform_treasury: Account<'info, TokenAccount>,

    /// [whitepaper-sync v1.1] canonical ORA mint for burning the 2% leg.
    #[account(mut, address = ORA_MINT @ ErrorCode::Unauthorized)]
    pub ora_mint: Account<'info, Mint>,

    /// CHECK: creator pubkey — used as a seed AND to bind the creator_token_account.
    pub creator: UncheckedAccount<'info>,
    #[account(mut)]
    pub fan: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// [audit fix round2 R2-H-L2] Creator opens / updates their subscription
/// pricing. `init_if_needed` lets the same handler do both create and update.
#[derive(Accounts)]
pub struct SetSubscriptionPrice<'info> {
    #[account(
        init_if_needed,
        payer = creator,
        space = 8 + 32 + 8 + 1 + 1,
        seeds = [b"sub_config", creator.key().as_ref()],
        bump,
    )]
    pub subscription_config: Account<'info, CreatorSubscriptionConfig>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}


/// [audit fix R2-M-L1] Fan cancels their own subscription. PDA seeds bind
/// the subscription to the (creator, fan) pair so a third party cannot
/// cancel someone else's sub.
#[derive(Accounts)]
pub struct CancelSubscription<'info> {
    #[account(
        mut,
        seeds = [b"subscription", subscription.creator.as_ref(), fan.key().as_ref()],
        bump = subscription.bump,
        constraint = subscription.fan == fan.key() @ ErrorCode::Unauthorized,
    )]
    pub subscription: Account<'info, Subscription>,
    pub fan: Signer<'info>,
}

#[derive(Accounts)]
pub struct RenewSubscription<'info> {
    #[account(
        mut,
        seeds = [b"subscription", creator.key().as_ref(), fan.key().as_ref()],
        bump = subscription.bump,
        constraint = subscription.fan == fan.key() @ ErrorCode::Unauthorized,
        constraint = subscription.creator == creator.key() @ ErrorCode::Unauthorized,
    )]
    pub subscription: Account<'info, Subscription>,

    /// [audit fix round2 R2-H-L2] Creator-controlled price PDA for renewal.
    #[account(
        seeds = [b"sub_config", creator.key().as_ref()],
        bump = subscription_config.bump,
        constraint = subscription_config.creator == creator.key() @ ErrorCode::Unauthorized,
    )]
    pub subscription_config: Account<'info, CreatorSubscriptionConfig>,

    #[account(mut,
        constraint = fan_token_account.owner == fan.key() @ ErrorCode::Unauthorized,
        constraint = fan_token_account.mint == ORA_MINT @ ErrorCode::Unauthorized,
    )]
    pub fan_token_account: Account<'info, TokenAccount>,

    #[account(mut,
        constraint = creator_token_account.owner == creator.key() @ ErrorCode::Unauthorized,
        constraint = creator_token_account.mint == ORA_MINT @ ErrorCode::Unauthorized,
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    /// [whitepaper-sync v1.1] hardcoded protocol staking-rewards pool (2% leg).
    #[account(mut, address = STAKING_REWARDS_POOL @ ErrorCode::Unauthorized)]
    pub staking_pool: Account<'info, TokenAccount>,

    /// [whitepaper-sync v1.1] hardcoded protocol gas-reserve pool (0.5% leg).
    #[account(mut, address = GAS_RESERVE_POOL @ ErrorCode::Unauthorized)]
    pub gas_reserve_pool: Account<'info, TokenAccount>,

    /// 0.5% ops leg.
    #[account(mut, address = PLATFORM_TREASURY @ ErrorCode::Unauthorized)]
    pub platform_treasury: Account<'info, TokenAccount>,

    /// [whitepaper-sync v1.1] canonical ORA mint for burning the 2% leg.
    #[account(mut, address = ORA_MINT @ ErrorCode::Unauthorized)]
    pub ora_mint: Account<'info, Mint>,

    /// CHECK: creator pubkey (matches subscription.creator + token-account owner).
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

/// [audit fix R2-L-L1] Creator-only close path for a PPV event.
#[derive(Accounts)]
pub struct ClosePpvEvent<'info> {
    #[account(
        mut,
        has_one = creator @ ErrorCode::Unauthorized,
        seeds = [b"ppv", creator.key().as_ref(), ppv_event.ppv_id.to_le_bytes().as_ref()],
        bump = ppv_event.bump,
    )]
    pub ppv_event: Account<'info, PPVEvent>,
    pub creator: Signer<'info>,
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

    #[account(mut,
        constraint = fan_token_account.owner == fan.key() @ ErrorCode::Unauthorized,
        constraint = fan_token_account.mint == ORA_MINT @ ErrorCode::Unauthorized,
    )]
    pub fan_token_account: Account<'info, TokenAccount>,

    #[account(mut,
        constraint = creator_token_account.owner == ppv_event.creator @ ErrorCode::Unauthorized,
        constraint = creator_token_account.mint == ORA_MINT @ ErrorCode::Unauthorized,
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    /// [whitepaper-sync v1.1] hardcoded protocol staking-rewards pool (2% leg).
    #[account(mut, address = STAKING_REWARDS_POOL @ ErrorCode::Unauthorized)]
    pub staking_pool: Account<'info, TokenAccount>,

    /// [whitepaper-sync v1.1] hardcoded protocol gas-reserve pool (0.5% leg).
    #[account(mut, address = GAS_RESERVE_POOL @ ErrorCode::Unauthorized)]
    pub gas_reserve_pool: Account<'info, TokenAccount>,

    /// 0.5% ops leg.
    #[account(mut, address = PLATFORM_TREASURY @ ErrorCode::Unauthorized)]
    pub platform_treasury: Account<'info, TokenAccount>,

    /// [whitepaper-sync v1.1] canonical ORA mint for burning the 2% leg.
    #[account(mut, address = ORA_MINT @ ErrorCode::Unauthorized)]
    pub ora_mint: Account<'info, Mint>,

    #[account(mut)]
    pub fan: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}



#[derive(Accounts)]
pub struct CreatorCoinTipBoost<'info> {
    /// [audit fix H-L1] tip_record must reference the calling `fan`.
    #[account(
        constraint = tip_record.fan == fan.key() @ ErrorCode::Unauthorized,
    )]
    pub tip_record: Account<'info, TipRecord>,

    #[account(
        init, payer = fan,
        space = 8 + 32 + 32 + 8 + 2 + 8 + 1,
        seeds = [b"tip_boost", tip_record.key().as_ref()],
        bump
    )]
    pub tip_boost: Account<'info, TipBoost>,

    #[account(mut)]
    pub fan: Signer<'info>,
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
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Overflow")]
    Overflow,
    #[msg("Subscription is not active")]
    SubscriptionInactive,
    #[msg("Subscription price has not been set by the creator")]
    SubscriptionPriceNotSet,
}
