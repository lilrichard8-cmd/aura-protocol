use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

pub mod benefits;
pub mod gift;
pub mod redemption;

pub use benefits::*;
pub use gift::*;
pub use redemption::*;

declare_id!("B38n2DX7BR4tEait7Pn3SHUwB29WQt4U8jttCQgJZ57w");

/// Fixed supply per creator coin
const TOTAL_SUPPLY_RAW: u64 = 10_000 * 1_000_000_000; // 9 decimals
/// Initial unlocked supply
const INITIAL_SUPPLY_RAW: u64 = 2_000 * 1_000_000_000;
/// Locked supply
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
const MIN_MONTHLY_TRADES: u32 = 1;
const MIN_MONTHLY_INTERACTIONS: u32 = 20;
/// Trading fee: 5% (2.5% creator + 2.5% ORA burn)
const TRADING_FEE_BPS: u64 = 500;

#[program]
pub mod aura_creator_coin {
    use super::*;

    // ===== Core Instructions =====

    /// Create a Creator Coin — FREE, requires 100+ followers
    pub fn create_creator_coin(
        ctx: Context<CreateCreatorCoin>,
        symbol: String,
        initial_price: u64,
        activity_oracle: Pubkey,
    ) -> Result<()> {
        require!(symbol.len() <= 10, ErrorCode::SymbolTooLong);

        let profile = &ctx.accounts.creator_profile;
        require!(profile.follower_count >= MIN_FOLLOWERS, ErrorCode::InsufficientFollowers);

        let now = Clock::get()?.unix_timestamp;
        let creator_key = ctx.accounts.creator.key();
        let mint_key = ctx.accounts.creator_coin_mint.key();
        let bump = ctx.bumps.creator_coin;

        // Mint initial 2,000 to creator
        let seeds = &[b"creator_coin", creator_key.as_ref(), &[bump]];
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

        let coin = &mut ctx.accounts.creator_coin;
        coin.creator = creator_key;
        coin.mint = mint_key;
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
        // [audit fix C-7] persist activity oracle authority for unlock_monthly gating
        coin.activity_oracle = activity_oracle;
        coin.bump = bump;

        // [audit fix H-9] populate benefits_list atomically
        let bl_bump = ctx.bumps.benefits_list;
        let bl = &mut ctx.accounts.benefits_list;
        bl.coin_mint = mint_key;
        bl.creator = creator_key;
        bl.benefits = Vec::new();
        bl.next_id = 0;
        bl.bump = bl_bump;

        let slot = Clock::get()?.slot;
        emit!(CoinMinted { mint: mint_key, creator: creator_key, slot });

        msg!("Creator Coin '{}' created: 2000 minted, 8000 locked, benefits list initialized", symbol);
        Ok(())
    }

    /// [audit fix C-7] Monthly unlock: gated by activity oracle (NOT creator self-report)
    /// Restores 2026-04-10 security fix that the subagent reverted.
    /// Activity counts (posts/trades/interactions) are signed by the oracle authority
    /// stored on `creator_coin.activity_oracle`; only the oracle signer can call this.
    pub fn unlock_monthly(
        ctx: Context<UnlockMonthly>,
        monthly_posts: u32,
        monthly_trades: u32,
        monthly_interactions: u32,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let coin_ro = &ctx.accounts.creator_coin;
        let locked_supply = coin_ro.locked_supply;
        let months_unlocked = coin_ro.months_unlocked;
        let last_unlock_time = coin_ro.last_unlock_time;
        let creator_key = coin_ro.creator;
        let coin_bump = coin_ro.bump;
        let mint_key = coin_ro.mint;
        let initial_price = coin_ro.initial_price;
        // [audit fix C-7] verify oracle is the recorded one
        require!(
            ctx.accounts.activity_oracle.key() == coin_ro.activity_oracle,
            ErrorCode::Unauthorized
        );

        require!(locked_supply > 0, ErrorCode::FullyUnlocked);
        require!(months_unlocked < UNLOCK_MONTHS, ErrorCode::FullyUnlocked);
        require!(now - last_unlock_time >= MONTH_SECONDS, ErrorCode::UnlockTooEarly);

        let mut criteria_met: u8 = 0;
        if monthly_posts >= MIN_MONTHLY_POSTS { criteria_met += 1; }
        if monthly_trades >= MIN_MONTHLY_TRADES { criteria_met += 1; }
        if monthly_interactions >= MIN_MONTHLY_INTERACTIONS { criteria_met += 1; }
        require!(criteria_met >= 2, ErrorCode::InsufficientActivity);

        let unlock_amount = MONTHLY_UNLOCK.min(locked_supply);
        let seeds = &[b"creator_coin", creator_key.as_ref(), &[coin_bump]];
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

        let coin = &mut ctx.accounts.creator_coin;
        coin.locked_supply = coin.locked_supply.saturating_sub(unlock_amount);
        coin.circulating_supply = coin.circulating_supply.checked_add(unlock_amount).ok_or(ErrorCode::Overflow)?;
        coin.months_unlocked += 1;
        coin.last_unlock_time = now;

        let slot = Clock::get()?.slot;
        emit!(VestingBatchUnlocked { coin: mint_key, batch_index: coin.months_unlocked, batch_price: initial_price, slot });
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
        Ok(())
    }

    /// Fill a sell order
    /// [audit fix C-16] fee split now matches whitepaper §5.6
    /// (2% burn + 2% staking + 0.5% gas + 0.5% ops). Old 50/50 burn/creator split
    /// violated the whitepaper and has been removed.
    pub fn fill_order(ctx: Context<FillOrder>, fill_amount: u64) -> Result<()> {
        let order = &mut ctx.accounts.order;
        require!(order.is_active, ErrorCode::OrderNotActive);
        require!(order.is_sell, ErrorCode::InvalidOrderType);

        let remaining = order.amount - order.filled;
        let actual_fill = fill_amount.min(remaining);
        require!(actual_fill > 0, ErrorCode::InvalidAmount);

        let total_cost = (actual_fill as u128)
            .checked_mul(order.price_per_token as u128).ok_or(ErrorCode::Overflow)?
            .checked_div(1_000_000_000).ok_or(ErrorCode::Overflow)? as u64;

        // [audit fix C-16] correct §5.6 fee split
        let total_fee = total_cost.checked_mul(500).ok_or(ErrorCode::Overflow)? / 10_000; // 5%
        let burn_fee = total_cost.checked_mul(200).ok_or(ErrorCode::Overflow)? / 10_000; // 2%
        let staking_fee = total_cost.checked_mul(200).ok_or(ErrorCode::Overflow)? / 10_000; // 2%
        let gas_fee = total_cost.checked_mul(50).ok_or(ErrorCode::Overflow)? / 10_000; // 0.5%
        let ops_fee = total_fee
            .saturating_sub(burn_fee).saturating_sub(staking_fee).saturating_sub(gas_fee);
        let seller_receives = total_cost.checked_sub(total_fee).ok_or(ErrorCode::Overflow)?;

        // 95% → seller
        token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
            from: ctx.accounts.buyer_ora_account.to_account_info(),
            to: ctx.accounts.seller_ora_account.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        }), seller_receives)?;
        // 2% burn
        if burn_fee > 0 {
            token::burn(CpiContext::new(ctx.accounts.token_program.to_account_info(), Burn {
                mint: ctx.accounts.ora_mint.to_account_info(),
                from: ctx.accounts.buyer_ora_account.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            }), burn_fee)?;
        }
        // 2% staking
        if staking_fee > 0 {
            token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
                from: ctx.accounts.buyer_ora_account.to_account_info(),
                to: ctx.accounts.staking_pool_account.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            }), staking_fee)?;
        }
        // 0.5% gas reserve
        if gas_fee > 0 {
            token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
                from: ctx.accounts.buyer_ora_account.to_account_info(),
                to: ctx.accounts.gas_reserve_account.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            }), gas_fee)?;
        }
        // 0.5% ops
        if ops_fee > 0 {
            token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
                from: ctx.accounts.buyer_ora_account.to_account_info(),
                to: ctx.accounts.ops_treasury_account.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            }), ops_fee)?;
        }

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

        order.filled = order.filled.checked_add(actual_fill).ok_or(ErrorCode::Overflow)?;
        if order.filled >= order.amount { order.is_active = false; }

        let coin = &mut ctx.accounts.creator_coin;
        coin.total_trading_volume = coin.total_trading_volume.checked_add(total_cost).ok_or(ErrorCode::Overflow)?;
        coin.total_fees_earned = coin.total_fees_earned.checked_add(total_fee).ok_or(ErrorCode::Overflow)?;
        Ok(())
    }

    /// Cancel an order
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
        Ok(())
    }

    // ===== Benefits Instructions (Task #5) =====

    pub fn init_benefits_list(ctx: Context<InitBenefitsListCtx>) -> Result<()> {
        let bl = &mut ctx.accounts.benefits_list;
        bl.coin_mint = ctx.accounts.coin_mint.key();
        bl.creator = ctx.accounts.creator.key();
        bl.benefits = Vec::new();
        bl.next_id = 0;
        bl.bump = ctx.bumps.benefits_list;

        let slot = Clock::get()?.slot;
        emit!(BenefitsListInitialized { coin_mint: bl.coin_mint, creator: bl.creator, slot });
        Ok(())
    }

    pub fn add_benefit(
        ctx: Context<ModifyBenefitsCtx>,
        benefit_type: BenefitType,
        threshold: u64,
        metadata_uri: String,
        metadata_hash: [u8; 32],
    ) -> Result<()> {
        require!(threshold > 0, BenefitsError::InvalidThreshold);
        require!(metadata_uri.len() <= benefits::MAX_URI_LEN, BenefitsError::UriTooLong);

        let bl = &mut ctx.accounts.benefits_list;
        require!(bl.benefits.len() < benefits::MAX_BENEFITS, BenefitsError::MaxBenefitsReached);

        let id = bl.next_id;
        bl.next_id = id.checked_add(1).ok_or(BenefitsError::Overflow)?;
        bl.benefits.push(Benefit {
            id,
            benefit_type: benefit_type.clone(),
            threshold,
            metadata_uri: metadata_uri.clone(),
            metadata_hash,
            is_active: true,
        });

        let slot = Clock::get()?.slot;
        emit!(BenefitAdded { coin_mint: bl.coin_mint, benefit_id: id, benefit_type, threshold, metadata_uri, slot });
        Ok(())
    }

    pub fn update_benefit(
        ctx: Context<ModifyBenefitsCtx>,
        benefit_id: u32,
        threshold: Option<u64>,
        metadata_uri: Option<String>,
        metadata_hash: Option<[u8; 32]>,
    ) -> Result<()> {
        let bl = &mut ctx.accounts.benefits_list;
        let benefit = bl.benefits.iter_mut().find(|b| b.id == benefit_id).ok_or(BenefitsError::BenefitNotFound)?;
        require!(benefit.is_active, BenefitsError::BenefitInactive);

        if let Some(t) = threshold { require!(t > 0, BenefitsError::InvalidThreshold); benefit.threshold = t; }
        if let Some(uri) = metadata_uri { require!(uri.len() <= benefits::MAX_URI_LEN, BenefitsError::UriTooLong); benefit.metadata_uri = uri; }
        if let Some(hash) = metadata_hash { benefit.metadata_hash = hash; }

        let slot = Clock::get()?.slot;
        emit!(BenefitUpdated { coin_mint: bl.coin_mint, benefit_id, slot });
        Ok(())
    }

    pub fn deactivate_benefit(ctx: Context<ModifyBenefitsCtx>, benefit_id: u32) -> Result<()> {
        let bl = &mut ctx.accounts.benefits_list;
        let benefit = bl.benefits.iter_mut().find(|b| b.id == benefit_id).ok_or(BenefitsError::BenefitNotFound)?;
        require!(benefit.is_active, BenefitsError::BenefitInactive);
        benefit.is_active = false;

        let slot = Clock::get()?.slot;
        emit!(BenefitDeactivated { coin_mint: bl.coin_mint, benefit_id, slot });
        Ok(())
    }

    // ===== Redemption Instructions (Task #1 + #7) =====

    pub fn init_redemption_counter(ctx: Context<InitRedemptionCounterCtx>) -> Result<()> {
        let counter = &mut ctx.accounts.redemption_counter;
        counter.coin_mint = ctx.accounts.coin_mint.key();
        counter.count = 0;
        counter.bump = ctx.bumps.redemption_counter;
        Ok(())
    }

    pub fn initiate_redemption(ctx: Context<InitiateRedemptionCtx>, benefit_id: u32, cost: u64) -> Result<()> {
        let bl = &ctx.accounts.benefits_list;
        let benefit = bl.benefits.iter().find(|b| b.id == benefit_id && b.is_active).ok_or(RedemptionError::BenefitNotFound)?;
        require!(benefit.benefit_type == BenefitType::Consumable, RedemptionError::NotConsumable);
        require!(benefit.threshold == cost, RedemptionError::CostMismatch);
        require!(cost > 0, RedemptionError::InvalidAmount);
        require!(ctx.accounts.buyer.key() != ctx.accounts.creator.key(), RedemptionError::CannotRedeemOwnCoin);

        let counter = &mut ctx.accounts.redemption_counter;
        let id = counter.count;
        counter.count = id.checked_add(1).ok_or(RedemptionError::Overflow)?;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_token_account.to_account_info(),
                    to: ctx.accounts.escrow_token_account.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            cost,
        )?;

        let slot = Clock::get()?.slot;
        let r = &mut ctx.accounts.redemption;
        r.id = id; r.coin_mint = bl.coin_mint; r.benefit_id = benefit_id; r.cost = cost;
        r.buyer = ctx.accounts.buyer.key(); r.creator = ctx.accounts.creator.key();
        r.status = RedemptionStatus::PendingDelivery; r.created_at_slot = slot;
        r.delivered_at_slot = None; r.confirmed_at_slot = None; r.disputed_at_slot = None;
        r.delivery_note_uri = String::new(); r.delivery_note_hash = [0u8; 32];
        r.dispute_reason_uri = String::new(); r.dispute_reason_hash = [0u8; 32];
        r.bump = ctx.bumps.redemption;

        emit!(RedemptionInitiated { id, coin_mint: r.coin_mint, buyer: r.buyer, benefit_id, cost, slot });
        Ok(())
    }

    pub fn mark_delivered(ctx: Context<MarkDeliveredCtx>, redemption_id: u64, note_uri: String, note_hash: [u8; 32]) -> Result<()> {
        require!(note_uri.len() <= redemption::MAX_URI_LEN, RedemptionError::UriTooLong);
        let r = &mut ctx.accounts.redemption;
        require!(r.status == RedemptionStatus::PendingDelivery, RedemptionError::InvalidStatusTransition);

        let slot = Clock::get()?.slot;
        r.status = RedemptionStatus::Delivered;
        r.delivered_at_slot = Some(slot);
        r.delivery_note_uri = note_uri.clone();
        r.delivery_note_hash = note_hash;

        emit!(RedemptionDelivered { id: r.id, note_uri, slot });
        Ok(())
    }

    pub fn confirm_receipt(ctx: Context<ConfirmReceiptCtx>, redemption_id: u64) -> Result<()> {
        let coin_mint = ctx.accounts.redemption.coin_mint;
        let id = ctx.accounts.redemption.id;
        let cost = ctx.accounts.redemption.cost;
        let bump = ctx.accounts.redemption.bump;
        require!(ctx.accounts.redemption.status == RedemptionStatus::Delivered, RedemptionError::InvalidStatusTransition);

        let id_bytes = id.to_le_bytes();
        let signer_seeds: &[&[u8]] = &[b"redemption", coin_mint.as_ref(), id_bytes.as_ref(), &[bump]];
        let signer = &[signer_seeds];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.creator_token_account.to_account_info(),
                    authority: ctx.accounts.redemption.to_account_info(),
                },
                signer,
            ),
            cost,
        )?;

        let slot = Clock::get()?.slot;
        let r = &mut ctx.accounts.redemption;
        r.status = RedemptionStatus::Confirmed;
        r.confirmed_at_slot = Some(slot);
        emit!(RedemptionConfirmed { id, by_auto: false, slot });
        Ok(())
    }

    pub fn auto_confirm(ctx: Context<AutoConfirmCtx>, redemption_id: u64) -> Result<()> {
        let coin_mint = ctx.accounts.redemption.coin_mint;
        let id = ctx.accounts.redemption.id;
        let cost = ctx.accounts.redemption.cost;
        let bump = ctx.accounts.redemption.bump;
        let delivered_slot = ctx.accounts.redemption.delivered_at_slot.ok_or(RedemptionError::InvalidStatusTransition)?;
        require!(ctx.accounts.redemption.status == RedemptionStatus::Delivered, RedemptionError::InvalidStatusTransition);

        let current_slot = Clock::get()?.slot;
        // [audit fix C-10] checked_add to prevent overflow on extreme slot values
        let auto_confirm_at = delivered_slot.checked_add(AUTO_CONFIRM_SLOTS).ok_or(RedemptionError::Overflow)?;
        require!(current_slot > auto_confirm_at, RedemptionError::AutoConfirmTooEarly);

        let id_bytes = id.to_le_bytes();
        let signer_seeds: &[&[u8]] = &[b"redemption", coin_mint.as_ref(), id_bytes.as_ref(), &[bump]];
        let signer = &[signer_seeds];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.creator_token_account.to_account_info(),
                    authority: ctx.accounts.redemption.to_account_info(),
                },
                signer,
            ),
            cost,
        )?;

        let r = &mut ctx.accounts.redemption;
        r.status = RedemptionStatus::Confirmed;
        r.confirmed_at_slot = Some(current_slot);
        emit!(RedemptionConfirmed { id, by_auto: true, slot: current_slot });
        Ok(())
    }

    pub fn dispute_redemption(ctx: Context<DisputeRedemptionCtx>, redemption_id: u64, reason_uri: String, reason_hash: [u8; 32]) -> Result<()> {
        require!(reason_uri.len() <= redemption::MAX_URI_LEN, RedemptionError::UriTooLong);
        let r = &mut ctx.accounts.redemption;
        require!(r.status == RedemptionStatus::Delivered, RedemptionError::InvalidStatusTransition);

        let slot = Clock::get()?.slot;
        r.status = RedemptionStatus::Disputed;
        r.disputed_at_slot = Some(slot);
        r.dispute_reason_uri = reason_uri.clone();
        r.dispute_reason_hash = reason_hash;
        emit!(RedemptionDisputed { id: r.id, reason_uri, slot });
        Ok(())
    }

    /// [audit fix H-1/C-6] execute_ruling supports three rulings per whitepaper §13.8:
    ///   - ReleaseToCreator: full escrow → creator
    ///   - RefundBuyer:      full escrow → buyer
    ///   - Split (bps):      creator_share_bps to creator, remainder to buyer
    /// `creator_share_bps == 10000` means full release to creator (== ReleaseToCreator);
    /// `0` means full refund (== RefundBuyer); any value 1..9999 is a true split.
    pub fn execute_ruling(ctx: Context<ExecuteRulingCtx>, redemption_id: u64, creator_share_bps: u16) -> Result<()> {
        require!(creator_share_bps <= 10_000, RedemptionError::InvalidAmount);
        let coin_mint = ctx.accounts.redemption.coin_mint;
        let id = ctx.accounts.redemption.id;
        let cost = ctx.accounts.redemption.cost;
        let bump = ctx.accounts.redemption.bump;
        require!(ctx.accounts.redemption.status == RedemptionStatus::Disputed, RedemptionError::InvalidStatusTransition);

        let id_bytes = id.to_le_bytes();
        let signer_seeds: &[&[u8]] = &[b"redemption", coin_mint.as_ref(), id_bytes.as_ref(), &[bump]];
        let signer = &[signer_seeds];

        // Compute split amounts with checked math
        let to_creator = (cost as u128)
            .checked_mul(creator_share_bps as u128).ok_or(RedemptionError::Overflow)?
            .checked_div(10_000).ok_or(RedemptionError::Overflow)? as u64;
        let to_buyer = cost.checked_sub(to_creator).ok_or(RedemptionError::Overflow)?;

        if to_creator > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.escrow_token_account.to_account_info(),
                        to: ctx.accounts.creator_token_account.to_account_info(),
                        authority: ctx.accounts.redemption.to_account_info(),
                    },
                    signer,
                ),
                to_creator,
            )?;
        }
        if to_buyer > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.escrow_token_account.to_account_info(),
                        to: ctx.accounts.buyer_token_account.to_account_info(),
                        authority: ctx.accounts.redemption.to_account_info(),
                    },
                    signer,
                ),
                to_buyer,
            )?;
        }

        let r = &mut ctx.accounts.redemption;
        r.status = RedemptionStatus::Confirmed;
        r.confirmed_at_slot = Some(Clock::get()?.slot);
        Ok(())
    }

    // ===== Gift Instructions (Task #4) =====

    pub fn gift_creator_coin(ctx: Context<GiftCreatorCoinCtx>, amount: u64, memo_uri: String) -> Result<()> {
        require!(amount > 0, GiftError::InvalidAmount);
        require!(memo_uri.len() <= gift::MAX_MEMO_URI_LEN, GiftError::MemoTooLong);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.sender_token_account.to_account_info(),
                    to: ctx.accounts.recipient_token_account.to_account_info(),
                    authority: ctx.accounts.sender.to_account_info(),
                },
            ),
            amount,
        )?;

        let slot = Clock::get()?.slot;
        emit!(GiftSent {
            coin_mint: ctx.accounts.coin_mint.key(),
            sender: ctx.accounts.sender.key(),
            recipient: ctx.accounts.recipient.key(),
            amount, memo_uri: memo_uri.clone(), slot,
        });
        Ok(())
    }

    // ===== Primary Issuance (Task #10) =====
    // Buy CC directly from creator at current batch price
    // Fee: 5% = 2% burn + 2% staking + 0.5% gas + 0.5% ops
    // Creator receives 95%

    pub fn primary_buy(ctx: Context<PrimaryBuyCtx>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        let price = ctx.accounts.creator_coin.initial_price;
        let creator_key = ctx.accounts.creator_coin.creator;
        let coin_bump = ctx.accounts.creator_coin.bump;

        // [audit fix C-8/C-9] enforce hard 10,000 supply cap
        let new_circulating = ctx.accounts.creator_coin.circulating_supply
            .checked_add(amount).ok_or(ErrorCode::Overflow)?;
        let max_unlocked = ctx.accounts.creator_coin.total_supply
            .checked_sub(ctx.accounts.creator_coin.locked_supply).ok_or(ErrorCode::Overflow)?;
        require!(new_circulating <= max_unlocked, ErrorCode::FullyUnlocked);

        // Calculate gross cost
        let gross_ora = (amount as u128).checked_mul(price as u128).ok_or(ErrorCode::Overflow)?
            .checked_div(1_000_000_000).ok_or(ErrorCode::Overflow)? as u64;
        require!(gross_ora > 0, ErrorCode::InvalidAmount);

        // Fee breakdown per §5.6
        let fee_total = gross_ora.checked_mul(500).ok_or(ErrorCode::Overflow)? / 10_000; // 5%
        let burn_amt = gross_ora.checked_mul(200).ok_or(ErrorCode::Overflow)? / 10_000; // 2%
        let staking_amt = gross_ora.checked_mul(200).ok_or(ErrorCode::Overflow)? / 10_000; // 2%
        let gas_amt = gross_ora.checked_mul(50).ok_or(ErrorCode::Overflow)? / 10_000; // 0.5%
        let ops_amt = fee_total.saturating_sub(burn_amt).saturating_sub(staking_amt).saturating_sub(gas_amt);
        let creator_receives = gross_ora.checked_sub(fee_total).ok_or(ErrorCode::Overflow)?;

        // Buyer pays creator 95%
        token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
            from: ctx.accounts.buyer_ora_account.to_account_info(),
            to: ctx.accounts.creator_ora_account.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        }), creator_receives)?;

        // 2% burn
        if burn_amt > 0 {
            token::burn(CpiContext::new(ctx.accounts.token_program.to_account_info(), Burn {
                mint: ctx.accounts.ora_mint.to_account_info(),
                from: ctx.accounts.buyer_ora_account.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            }), burn_amt)?;
        }
        // 2% staking
        if staking_amt > 0 {
            token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
                from: ctx.accounts.buyer_ora_account.to_account_info(),
                to: ctx.accounts.staking_pool_account.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            }), staking_amt)?;
        }
        // 0.5% gas
        if gas_amt > 0 {
            token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
                from: ctx.accounts.buyer_ora_account.to_account_info(),
                to: ctx.accounts.gas_reserve_account.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            }), gas_amt)?;
        }
        // 0.5% ops
        if ops_amt > 0 {
            token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
                from: ctx.accounts.buyer_ora_account.to_account_info(),
                to: ctx.accounts.ops_treasury_account.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            }), ops_amt)?;
        }

        // Mint CC to buyer from creator_coin PDA authority
        let seeds = &[b"creator_coin", creator_key.as_ref(), &[coin_bump]];
        let signer = &[&seeds[..]];
        token::mint_to(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), MintTo {
            mint: ctx.accounts.creator_coin_mint.to_account_info(),
            to: ctx.accounts.buyer_cc_account.to_account_info(),
            authority: ctx.accounts.creator_coin.to_account_info(),
        }, signer), amount)?;

        // [audit fix C-9] update circulating_supply tracking
        let coin_mint = ctx.accounts.creator_coin.mint;
        let buyer_key = ctx.accounts.buyer.key();
        {
            let coin = &mut ctx.accounts.creator_coin;
            coin.circulating_supply = new_circulating;
            coin.total_trading_volume = coin.total_trading_volume
                .checked_add(gross_ora).ok_or(ErrorCode::Overflow)?;
        }

        // Update burn tracker (#11)
        let bt = &mut ctx.accounts.burn_tracker;
        bt.total_burned_lamports = bt.total_burned_lamports.checked_add(burn_amt as u128).ok_or(ErrorCode::Overflow)?;
        bt.last_updated_slot = Clock::get()?.slot;

        let slot = Clock::get()?.slot;
        emit!(PrimaryIssuanceBuy { coin: coin_mint, buyer: buyer_key, amount, price, fee: fee_total, slot });
        emit!(BurnExecuted { amount: burn_amt, source: buyer_key, slot });
        Ok(())
    }

    // ===== Burn Tracker Init (Task #11) =====

    pub fn init_burn_tracker(ctx: Context<InitBurnTrackerCtx>) -> Result<()> {
        let bt = &mut ctx.accounts.burn_tracker;
        bt.total_burned_lamports = 0;
        bt.last_updated_slot = Clock::get()?.slot;
        bt.bump = ctx.bumps.burn_tracker;
        Ok(())
    }
}

// === Events ===

#[event]
pub struct CoinMinted { pub mint: Pubkey, pub creator: Pubkey, pub slot: u64 }

#[event]
pub struct VestingBatchUnlocked { pub coin: Pubkey, pub batch_index: u8, pub batch_price: u64, pub slot: u64 }

#[event]
pub struct PrimaryIssuanceBuy { pub coin: Pubkey, pub buyer: Pubkey, pub amount: u64, pub price: u64, pub fee: u64, pub slot: u64 }

#[event]
pub struct BurnExecuted { pub amount: u64, pub source: Pubkey, pub slot: u64 }

// === Account State ===

#[account]
pub struct CreatorCoin {
    pub creator: Pubkey, pub mint: Pubkey, pub symbol: String,
    pub initial_price: u64, pub total_supply: u64, pub circulating_supply: u64,
    pub locked_supply: u64, pub months_unlocked: u8, pub last_unlock_time: i64,
    pub created_at: i64, pub total_trading_volume: u64, pub total_fees_earned: u64,
    /// [audit fix C-7] Activity oracle authority — the only key allowed to call unlock_monthly
    pub activity_oracle: Pubkey,
    pub bump: u8,
}

#[account]
pub struct UserProfile {
    pub authority: Pubkey, pub username: String, pub profile_uri: String,
    pub reputation_score: u32, pub follower_count: u32, pub following_count: u32,
    pub post_count: u32, pub created_at: i64, pub bump: u8,
}

#[account]
pub struct Order {
    pub coin_mint: Pubkey, pub maker: Pubkey, pub is_sell: bool,
    pub price_per_token: u64, pub amount: u64, pub filled: u64,
    pub is_active: bool, pub created_at: i64, pub nonce: u64, pub bump: u8,
}

/// Burn tracker: cumulative ORA burned across all transactions
#[account]
pub struct BurnTracker {
    pub total_burned_lamports: u128, // 16
    pub last_updated_slot: u64,      // 8
    pub bump: u8,                    // 1
}
impl BurnTracker { pub const SIZE: usize = 8 + 16 + 8 + 1; }

// === Instruction Contexts ===

#[derive(Accounts)]
#[instruction(symbol: String)]
pub struct CreateCreatorCoin<'info> {
    // [audit fix C-7] +32 for activity_oracle field
    #[account(init, payer = creator, space = 8 + 32 + 32 + 14 + 8 + 8 + 8 + 8 + 1 + 8 + 8 + 8 + 8 + 32 + 1,
        seeds = [b"creator_coin", creator.key().as_ref()], bump)]
    pub creator_coin: Account<'info, CreatorCoin>,
    #[account(init, payer = creator, mint::decimals = 9, mint::authority = creator_coin,
        seeds = [b"creator_coin_mint", creator.key().as_ref()], bump)]
    pub creator_coin_mint: Account<'info, Mint>,
    // [audit fix H-9] init benefits_list atomically with the coin so it cannot be frontrun
    #[account(init, payer = creator, space = BenefitsList::MAX_SIZE,
        seeds = [b"benefits", creator_coin_mint.key().as_ref()], bump)]
    pub benefits_list: Account<'info, BenefitsList>,
    #[account(mut)]
    pub creator_token_account: Account<'info, TokenAccount>,
    #[account(seeds = [b"user", creator.key().as_ref()], bump = creator_profile.bump,
        constraint = creator_profile.authority == creator.key() @ ErrorCode::Unauthorized)]
    pub creator_profile: Account<'info, UserProfile>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct UnlockMonthly<'info> {
    #[account(mut, seeds = [b"creator_coin", creator.key().as_ref()], bump = creator_coin.bump,
        has_one = creator @ ErrorCode::Unauthorized)]
    pub creator_coin: Account<'info, CreatorCoin>,
    #[account(mut, seeds = [b"creator_coin_mint", creator.key().as_ref()], bump)]
    pub creator_coin_mint: Account<'info, Mint>,
    #[account(mut)]
    pub creator_token_account: Account<'info, TokenAccount>,
    /// CHECK: pubkey-only — must equal creator_coin.activity_oracle
    pub creator: AccountInfo<'info>,
    /// [audit fix C-7] Activity oracle MUST sign — prevents creator self-report
    pub activity_oracle: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(amount: u64, price_per_token: u64, order_nonce: u64)]
pub struct CreateOrder<'info> {
    #[account(seeds = [b"creator_coin", creator_coin.creator.as_ref()], bump = creator_coin.bump)]
    pub creator_coin: Account<'info, CreatorCoin>,
    #[account(init, payer = maker, space = 8 + 32 + 32 + 1 + 8 + 8 + 8 + 1 + 8 + 8 + 1,
        seeds = [b"order", maker.key().as_ref(), order_nonce.to_le_bytes().as_ref()], bump)]
    pub order: Account<'info, Order>,
    #[account(mut)]
    pub maker_coin_account: Account<'info, TokenAccount>,
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
    #[account(mut)]
    pub escrow_coin_account: Account<'info, TokenAccount>,
    // [audit fix C-17] CC destination owner == buyer; mint matches creator_coin.mint
    #[account(mut,
        constraint = buyer_coin_account.owner == buyer.key() @ ErrorCode::Unauthorized,
        constraint = buyer_coin_account.mint == creator_coin.mint @ ErrorCode::Unauthorized
    )]
    pub buyer_coin_account: Account<'info, TokenAccount>,
    // [audit fix C-17] buyer's ORA: owner+mint enforced
    #[account(mut,
        constraint = buyer_ora_account.owner == buyer.key() @ ErrorCode::Unauthorized,
        constraint = buyer_ora_account.mint == ora_mint.key() @ ErrorCode::Unauthorized
    )]
    pub buyer_ora_account: Account<'info, TokenAccount>,
    // [audit fix C-17] seller's ORA destination MUST match order.maker
    #[account(mut,
        constraint = seller_ora_account.owner == order.maker @ ErrorCode::Unauthorized,
        constraint = seller_ora_account.mint == ora_mint.key() @ ErrorCode::Unauthorized
    )]
    pub seller_ora_account: Account<'info, TokenAccount>,
    pub ora_mint: Account<'info, Mint>,
    // [audit fix C-17] fee buckets locked to protocol PDAs
    #[account(mut, address = STAKING_REWARDS_POOL @ ErrorCode::Unauthorized)]
    pub staking_pool_account: Account<'info, TokenAccount>,
    #[account(mut, address = GAS_RESERVE_POOL @ ErrorCode::Unauthorized)]
    pub gas_reserve_account: Account<'info, TokenAccount>,
    #[account(mut, address = OPS_TREASURY_POOL @ ErrorCode::Unauthorized)]
    pub ops_treasury_account: Account<'info, TokenAccount>,
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

// Benefits contexts
#[derive(Accounts)]
pub struct InitBenefitsListCtx<'info> {
    // [audit fix C-18] enforce creator owns the CreatorCoin record AND coin_mint matches
    #[account(seeds = [b"creator_coin", creator.key().as_ref()], bump = creator_coin.bump,
        constraint = creator_coin.creator == creator.key() @ BenefitsError::Unauthorized,
        constraint = creator_coin.mint == coin_mint.key() @ BenefitsError::Unauthorized
    )]
    pub creator_coin: Account<'info, CreatorCoin>,
    #[account(init, payer = creator, space = BenefitsList::MAX_SIZE,
        seeds = [b"benefits", coin_mint.key().as_ref()], bump)]
    pub benefits_list: Account<'info, BenefitsList>,
    pub coin_mint: Account<'info, Mint>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ModifyBenefitsCtx<'info> {
    #[account(mut, seeds = [b"benefits", benefits_list.coin_mint.as_ref()], bump = benefits_list.bump,
        has_one = creator @ BenefitsError::Unauthorized)]
    pub benefits_list: Account<'info, BenefitsList>,
    pub creator: Signer<'info>,
}

// Redemption contexts
#[derive(Accounts)]
pub struct InitRedemptionCounterCtx<'info> {
    #[account(init, payer = payer, space = RedemptionCounter::SIZE,
        seeds = [b"redemption-counter", coin_mint.key().as_ref()], bump)]
    pub redemption_counter: Account<'info, RedemptionCounter>,
    /// CHECK: Coin mint
    pub coin_mint: AccountInfo<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(benefit_id: u32, cost: u64)]
pub struct InitiateRedemptionCtx<'info> {
    #[account(seeds = [b"benefits", benefits_list.coin_mint.as_ref()], bump = benefits_list.bump)]
    pub benefits_list: Account<'info, BenefitsList>,
    #[account(mut, seeds = [b"redemption-counter", benefits_list.coin_mint.as_ref()], bump = redemption_counter.bump)]
    pub redemption_counter: Account<'info, RedemptionCounter>,
    #[account(init, payer = buyer, space = Redemption::SIZE,
        seeds = [b"redemption", benefits_list.coin_mint.as_ref(), redemption_counter.count.to_le_bytes().as_ref()], bump)]
    pub redemption: Account<'info, Redemption>,
    // [audit fix C-4] enforce mint matches coin_mint AND owner == buyer
    #[account(mut,
        constraint = buyer_token_account.owner == buyer.key() @ RedemptionError::Unauthorized,
        constraint = buyer_token_account.mint == benefits_list.coin_mint @ RedemptionError::Unauthorized
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,
    // [audit fix C-4] escrow must be owned by the redemption PDA AND match coin mint
    #[account(mut,
        constraint = escrow_token_account.owner == redemption.key() @ RedemptionError::Unauthorized,
        constraint = escrow_token_account.mint == benefits_list.coin_mint @ RedemptionError::Unauthorized
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    /// CHECK: Creator pubkey persisted into Redemption.creator; subsequent calls validate has_one
    pub creator: AccountInfo<'info>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(redemption_id: u64)]
pub struct MarkDeliveredCtx<'info> {
    #[account(mut, seeds = [b"redemption", redemption.coin_mint.as_ref(), redemption_id.to_le_bytes().as_ref()],
        bump = redemption.bump, has_one = creator @ RedemptionError::Unauthorized)]
    pub redemption: Account<'info, Redemption>,
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(redemption_id: u64)]
pub struct ConfirmReceiptCtx<'info> {
    #[account(mut, seeds = [b"redemption", redemption.coin_mint.as_ref(), redemption_id.to_le_bytes().as_ref()],
        bump = redemption.bump, has_one = buyer @ RedemptionError::Unauthorized)]
    pub redemption: Account<'info, Redemption>,
    // [audit fix C-1] escrow must be PDA-owned + mint must match
    #[account(mut,
        constraint = escrow_token_account.owner == redemption.key() @ RedemptionError::Unauthorized,
        constraint = escrow_token_account.mint == redemption.coin_mint @ RedemptionError::Unauthorized
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    // [audit fix C-1] destination MUST be the creator's account, not buyer-supplied
    #[account(mut,
        constraint = creator_token_account.owner == redemption.creator @ RedemptionError::Unauthorized,
        constraint = creator_token_account.mint == redemption.coin_mint @ RedemptionError::Unauthorized
    )]
    pub creator_token_account: Account<'info, TokenAccount>,
    pub buyer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(redemption_id: u64)]
pub struct AutoConfirmCtx<'info> {
    #[account(mut, seeds = [b"redemption", redemption.coin_mint.as_ref(), redemption_id.to_le_bytes().as_ref()],
        bump = redemption.bump)]
    pub redemption: Account<'info, Redemption>,
    // [audit fix C-2] escrow must be PDA-owned + mint matches
    #[account(mut,
        constraint = escrow_token_account.owner == redemption.key() @ RedemptionError::Unauthorized,
        constraint = escrow_token_account.mint == redemption.coin_mint @ RedemptionError::Unauthorized
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    // [audit fix C-2] auto-confirm always releases to the creator; lock destination to creator's ATA
    #[account(mut,
        constraint = creator_token_account.owner == redemption.creator @ RedemptionError::Unauthorized,
        constraint = creator_token_account.mint == redemption.coin_mint @ RedemptionError::Unauthorized
    )]
    pub creator_token_account: Account<'info, TokenAccount>,
    pub keeper: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(redemption_id: u64)]
pub struct DisputeRedemptionCtx<'info> {
    #[account(mut, seeds = [b"redemption", redemption.coin_mint.as_ref(), redemption_id.to_le_bytes().as_ref()],
        bump = redemption.bump, has_one = buyer @ RedemptionError::Unauthorized)]
    pub redemption: Account<'info, Redemption>,
    pub buyer: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(redemption_id: u64)]
pub struct ExecuteRulingCtx<'info> {
    #[account(mut, seeds = [b"redemption", redemption.coin_mint.as_ref(), redemption_id.to_le_bytes().as_ref()],
        bump = redemption.bump)]
    pub redemption: Account<'info, Redemption>,
    // [audit fix C-3] escrow must be PDA-owned + correct mint
    #[account(mut,
        constraint = escrow_token_account.owner == redemption.key() @ RedemptionError::Unauthorized,
        constraint = escrow_token_account.mint == redemption.coin_mint @ RedemptionError::Unauthorized
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    // [audit fix C-3] both potential destinations are validated against the redemption record
    #[account(mut,
        constraint = creator_token_account.owner == redemption.creator @ RedemptionError::Unauthorized,
        constraint = creator_token_account.mint == redemption.coin_mint @ RedemptionError::Unauthorized
    )]
    pub creator_token_account: Account<'info, TokenAccount>,
    #[account(mut,
        constraint = buyer_token_account.owner == redemption.buyer @ RedemptionError::Unauthorized,
        constraint = buyer_token_account.mint == redemption.coin_mint @ RedemptionError::Unauthorized
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,
    // [audit fix C-3] authority MUST be the configured arbitration_authority PDA from governance.
    // For now: constrain via arbitration_authority account whose key is stored on Redemption (TODO).
    // Until governance CPI integration is wired, only the documented protocol authority key may sign.
    // PROTOCOL_AUTHORITY is hardcoded below and will be replaced by governance program PDA after audit fix Phase 3.
    #[account(constraint = authority.key() == PROTOCOL_AUTHORITY @ RedemptionError::Unauthorized)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

/// [audit fix C-3] Hardcoded protocol authority for arbitration ruling execution.
/// ⚠️ DO NOT DEPLOY: this is the System Program ID as a build-time placeholder so the
/// program compiles. PRE-MAINNET TODO: replace with the real Year 1 multisig pubkey
/// (5/7) and after Phase 3 with a governance program PDA via CPI.
pub const PROTOCOL_AUTHORITY: Pubkey = anchor_lang::solana_program::system_program::ID;

// Gift context
#[derive(Accounts)]
pub struct GiftCreatorCoinCtx<'info> {
    // [audit fix M-1] strongly typed Mint instead of bare AccountInfo
    pub coin_mint: Account<'info, Mint>,
    #[account(mut, constraint = sender_token_account.mint == coin_mint.key() @ GiftError::MintMismatch,
        constraint = sender_token_account.owner == sender.key() @ GiftError::Unauthorized)]
    pub sender_token_account: Account<'info, TokenAccount>,
    #[account(init_if_needed, payer = sender, associated_token::mint = coin_mint, associated_token::authority = recipient)]
    pub recipient_token_account: Account<'info, TokenAccount>,
    /// CHECK: Recipient
    pub recipient: AccountInfo<'info>,
    #[account(mut)]
    pub sender: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// Primary Issuance context (#10)
#[derive(Accounts)]
pub struct PrimaryBuyCtx<'info> {
    #[account(mut, seeds = [b"creator_coin", creator_coin.creator.as_ref()], bump = creator_coin.bump)]
    pub creator_coin: Box<Account<'info, CreatorCoin>>,
    #[account(mut, seeds = [b"creator_coin_mint", creator_coin.creator.as_ref()], bump)]
    pub creator_coin_mint: Box<Account<'info, Mint>>,
    // [audit fix] buyer's ORA account: owner+mint enforced
    #[account(mut,
        constraint = buyer_ora_account.owner == buyer.key() @ ErrorCode::Unauthorized,
        constraint = buyer_ora_account.mint == ora_mint.key() @ ErrorCode::Unauthorized
    )]
    pub buyer_ora_account: Box<Account<'info, TokenAccount>>,
    // [audit fix C-8] creator's ORA destination MUST belong to creator_coin.creator
    #[account(mut,
        constraint = creator_ora_account.owner == creator_coin.creator @ ErrorCode::Unauthorized,
        constraint = creator_ora_account.mint == ora_mint.key() @ ErrorCode::Unauthorized
    )]
    pub creator_ora_account: Box<Account<'info, TokenAccount>>,
    pub ora_mint: Box<Account<'info, Mint>>,
    // [audit fix] fee buckets locked to protocol PDAs
    #[account(mut, address = STAKING_REWARDS_POOL @ ErrorCode::Unauthorized)]
    pub staking_pool_account: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = GAS_RESERVE_POOL @ ErrorCode::Unauthorized)]
    pub gas_reserve_account: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = OPS_TREASURY_POOL @ ErrorCode::Unauthorized)]
    pub ops_treasury_account: Box<Account<'info, TokenAccount>>,
    // [audit fix] buyer's CC ATA: owner+mint enforced
    #[account(mut,
        constraint = buyer_cc_account.owner == buyer.key() @ ErrorCode::Unauthorized,
        constraint = buyer_cc_account.mint == creator_coin_mint.key() @ ErrorCode::Unauthorized
    )]
    pub buyer_cc_account: Box<Account<'info, TokenAccount>>,
    #[account(mut, seeds = [b"burn-tracker"], bump = burn_tracker.bump)]
    pub burn_tracker: Box<Account<'info, BurnTracker>>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

/// [audit fix C-8] Hardcoded protocol fee pools for creator-coin program.
/// ⚠️ DO NOT DEPLOY — placeholders; replace with real protocol PDAs pre-mainnet.
pub const STAKING_REWARDS_POOL: Pubkey = anchor_lang::solana_program::system_program::ID;
pub const GAS_RESERVE_POOL: Pubkey = anchor_lang::solana_program::system_program::ID;
pub const OPS_TREASURY_POOL: Pubkey = anchor_lang::solana_program::system_program::ID;

// Burn Tracker context (#11)
#[derive(Accounts)]
pub struct InitBurnTrackerCtx<'info> {
    #[account(init, payer = payer, space = BurnTracker::SIZE, seeds = [b"burn-tracker"], bump)]
    pub burn_tracker: Account<'info, BurnTracker>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// === Errors ===

#[error_code]
pub enum ErrorCode {
    #[msg("Symbol too long (max 10)")] SymbolTooLong,
    #[msg("Need 100+ followers")] InsufficientFollowers,
    #[msg("All tokens already unlocked")] FullyUnlocked,
    #[msg("Must wait 30 days between unlocks")] UnlockTooEarly,
    #[msg("Insufficient activity")] InsufficientActivity,
    #[msg("Invalid amount")] InvalidAmount,
    #[msg("Invalid price")] InvalidPrice,
    #[msg("Order not active")] OrderNotActive,
    #[msg("Invalid order type")] InvalidOrderType,
    #[msg("Unauthorized")] Unauthorized,
    #[msg("Overflow")] Overflow,
}
