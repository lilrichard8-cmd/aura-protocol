use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};

pub mod sell_order;
pub mod buy_order;

pub use sell_order::*;
pub use buy_order::*;

declare_id!("5BTekjKRiY8pXqEr7eQsqhRFynN27CxfYnh1d5q27cLV");

/// [audit fix C-6/C-20] Hardcoded protocol fee pools.
/// ⚠️ DO NOT DEPLOY — placeholder = system program ID; replace with real protocol PDAs pre-mainnet.
pub const STAKING_REWARDS_POOL: Pubkey = anchor_lang::solana_program::system_program::ID;
pub const GAS_RESERVE_POOL: Pubkey = anchor_lang::solana_program::system_program::ID;
pub const OPS_TREASURY_POOL: Pubkey = anchor_lang::solana_program::system_program::ID;

#[program]
pub mod aura_market {
    use super::*;

    // ===== Existing NFT Marketplace =====

    pub fn create_listing(ctx: Context<CreateListing>, price: u64, listing_type: ListingType) -> Result<()> {
        require!(price > 0, ErrorCode::InvalidPrice);
        let listing = &mut ctx.accounts.listing;
        listing.seller = ctx.accounts.seller.key();
        listing.nft_mint = ctx.accounts.nft_mint.key();
        listing.price = price;
        listing.listing_type = listing_type;
        listing.created_at = Clock::get()?.unix_timestamp;
        listing.is_active = true;
        listing.bump = ctx.bumps.listing;
        Ok(())
    }

    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        ctx.accounts.listing.is_active = false;
        Ok(())
    }

    pub fn create_bounty(ctx: Context<CreateBounty>, title: String, description: String, reward_amount: u64, deadline: i64) -> Result<()> {
        require!(title.len() <= 100, ErrorCode::TitleTooLong);
        require!(description.len() <= 1000, ErrorCode::DescriptionTooLong);
        require!(reward_amount > 0, ErrorCode::InvalidAmount);
        let bounty = &mut ctx.accounts.bounty;
        bounty.creator = ctx.accounts.creator.key();
        bounty.title = title; bounty.description = description;
        bounty.reward_amount = reward_amount; bounty.deadline = deadline;
        bounty.status = BountyStatus::Open; bounty.submission_count = 0;
        bounty.winner = Pubkey::default(); bounty.created_at = Clock::get()?.unix_timestamp;
        bounty.bump = ctx.bumps.bounty;
        Ok(())
    }

    pub fn submit_bounty_work(ctx: Context<SubmitBountyWork>, submission_uri: String) -> Result<()> {
        require!(submission_uri.len() <= 200, ErrorCode::UriTooLong);
        let bounty = &mut ctx.accounts.bounty;
        require!(bounty.status == BountyStatus::Open, ErrorCode::BountyNotOpen);
        require!(Clock::get()?.unix_timestamp < bounty.deadline, ErrorCode::BountyExpired);
        bounty.submission_count = bounty.submission_count.checked_add(1).ok_or(ErrorCode::Overflow)?;
        Ok(())
    }

    pub fn award_bounty(ctx: Context<AwardBounty>) -> Result<()> {
        let bounty = &mut ctx.accounts.bounty;
        require!(bounty.status == BountyStatus::Open, ErrorCode::BountyNotOpen);
        bounty.status = BountyStatus::Completed;
        bounty.winner = ctx.accounts.winner.key();
        Ok(())
    }

    pub fn grant_license(ctx: Context<GrantLicense>, royalty_bps: u16) -> Result<()> {
        require!(royalty_bps <= 10000, ErrorCode::InvalidRoyalty);
        let license = &mut ctx.accounts.license;
        license.licensor = ctx.accounts.licensor.key();
        license.licensee = ctx.accounts.licensee.key();
        license.royalty_bps = royalty_bps;
        license.granted_at = Clock::get()?.unix_timestamp;
        license.is_active = true;
        license.bump = ctx.bumps.license;
        Ok(())
    }

    pub fn place_ad_bid(ctx: Context<PlaceAdBid>, bid_amount: u64, target_slot: u8) -> Result<()> {
        require!(bid_amount > 0, ErrorCode::InvalidAmount);
        let ad_bid = &mut ctx.accounts.ad_bid;
        ad_bid.bidder = ctx.accounts.bidder.key();
        ad_bid.bid_amount = bid_amount; ad_bid.target_slot = target_slot;
        ad_bid.is_active = true; ad_bid.created_at = Clock::get()?.unix_timestamp;
        ad_bid.bump = ctx.bumps.ad_bid;
        Ok(())
    }

    // ===== Sell Order (Task #2) =====

    pub fn init_sell_order_counter(ctx: Context<InitSellOrderCounterCtx>) -> Result<()> {
        let c = &mut ctx.accounts.sell_order_counter;
        c.coin_mint = ctx.accounts.coin_mint.key(); c.count = 0; c.bump = ctx.bumps.sell_order_counter;
        Ok(())
    }

    pub fn place_sell_order(ctx: Context<PlaceSellOrderCtx>, amount: u64, price_per_coin: u64) -> Result<()> {
        require!(amount > 0, SellOrderError::InvalidAmount);
        require!(price_per_coin > 0, SellOrderError::InvalidPrice);

        let counter = &mut ctx.accounts.sell_order_counter;
        let id = counter.count;
        counter.count = id.checked_add(1).ok_or(SellOrderError::Overflow)?;

        token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
            from: ctx.accounts.seller_token_account.to_account_info(),
            to: ctx.accounts.escrow_token_account.to_account_info(),
            authority: ctx.accounts.seller.to_account_info(),
        }), amount)?;

        let so = &mut ctx.accounts.sell_order;
        let slot = Clock::get()?.slot;
        so.id = id; so.coin_mint = ctx.accounts.coin_mint.key(); so.seller = ctx.accounts.seller.key();
        so.amount_remaining = amount; so.amount_original = amount;
        so.price_per_coin_lamports = price_per_coin; so.created_at_slot = slot;
        so.status = OrderStatus::Open; so.bump = ctx.bumps.sell_order;

        emit!(SellOrderPlaced { id, coin_mint: so.coin_mint, seller: so.seller, amount, price_per_coin_lamports: price_per_coin, slot });
        Ok(())
    }

    pub fn cancel_sell_order(ctx: Context<CancelSellOrderCtx>, order_id: u64) -> Result<()> {
        let coin_mint = ctx.accounts.sell_order.coin_mint;
        let id = ctx.accounts.sell_order.id;
        let bump = ctx.accounts.sell_order.bump;
        let amount_to_return = ctx.accounts.sell_order.amount_remaining;
        require!(ctx.accounts.sell_order.status == OrderStatus::Open, SellOrderError::OrderNotOpen);

        let id_bytes = id.to_le_bytes();
        let signer_seeds: &[&[u8]] = &[b"sell-order", coin_mint.as_ref(), id_bytes.as_ref(), &[bump]];
        let signer = &[signer_seeds];

        token::transfer(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), Transfer {
            from: ctx.accounts.escrow_token_account.to_account_info(),
            to: ctx.accounts.seller_token_account.to_account_info(),
            authority: ctx.accounts.sell_order.to_account_info(),
        }, signer), amount_to_return)?;

        let so = &mut ctx.accounts.sell_order;
        so.status = OrderStatus::Cancelled; so.amount_remaining = 0;

        let slot = Clock::get()?.slot;
        emit!(SellOrderCancelled { id, seller: so.seller, amount_returned: amount_to_return, slot });
        Ok(())
    }

    pub fn fill_sell_order(ctx: Context<FillSellOrderCtx>, order_id: u64, fill_amount: u64) -> Result<()> {
        let coin_mint = ctx.accounts.sell_order.coin_mint;
        let id = ctx.accounts.sell_order.id;
        let bump = ctx.accounts.sell_order.bump;
        let price = ctx.accounts.sell_order.price_per_coin_lamports;
        let remaining = ctx.accounts.sell_order.amount_remaining;
        require!(ctx.accounts.sell_order.status == OrderStatus::Open, SellOrderError::OrderNotOpen);
        require!(fill_amount > 0, SellOrderError::InvalidAmount);

        let actual_fill = fill_amount.min(remaining);
        require!(actual_fill > 0, SellOrderError::OrderFullyFilled);

        let total_cost = (actual_fill as u128).checked_mul(price as u128).ok_or(SellOrderError::Overflow)?
            .checked_div(1_000_000_000).ok_or(SellOrderError::Overflow)? as u64;

        let fee_total = total_cost.checked_mul(sell_order::FEE_BPS).ok_or(SellOrderError::Overflow)? / 10_000;
        let burn_amount = total_cost.checked_mul(sell_order::BURN_BPS).ok_or(SellOrderError::Overflow)? / 10_000;
        let staking_amount = total_cost.checked_mul(sell_order::STAKING_BPS).ok_or(SellOrderError::Overflow)? / 10_000;
        let gas_amount = total_cost.checked_mul(sell_order::GAS_BPS).ok_or(SellOrderError::Overflow)? / 10_000;
        let ops_amount = fee_total.saturating_sub(burn_amount).saturating_sub(staking_amount).saturating_sub(gas_amount);
        let seller_receives = total_cost.checked_sub(fee_total).ok_or(SellOrderError::Overflow)?;

        // Buyer pays seller 95%
        token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
            from: ctx.accounts.buyer_ora_account.to_account_info(),
            to: ctx.accounts.seller_ora_account.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        }), seller_receives)?;

        // 2% burn
        if burn_amount > 0 {
            token::burn(CpiContext::new(ctx.accounts.token_program.to_account_info(), Burn {
                mint: ctx.accounts.ora_mint.to_account_info(),
                from: ctx.accounts.buyer_ora_account.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            }), burn_amount)?;
        }
        // 2% staking
        if staking_amount > 0 {
            token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
                from: ctx.accounts.buyer_ora_account.to_account_info(),
                to: ctx.accounts.staking_rewards_account.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            }), staking_amount)?;
        }
        // 0.5% gas
        if gas_amount > 0 {
            token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
                from: ctx.accounts.buyer_ora_account.to_account_info(),
                to: ctx.accounts.gas_reserve_account.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            }), gas_amount)?;
        }
        // 0.5% ops
        if ops_amount > 0 {
            token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
                from: ctx.accounts.buyer_ora_account.to_account_info(),
                to: ctx.accounts.ops_treasury_account.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            }), ops_amount)?;
        }

        // Transfer CC from escrow → buyer
        let id_bytes = id.to_le_bytes();
        let signer_seeds: &[&[u8]] = &[b"sell-order", coin_mint.as_ref(), id_bytes.as_ref(), &[bump]];
        let signer = &[signer_seeds];
        token::transfer(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), Transfer {
            from: ctx.accounts.escrow_token_account.to_account_info(),
            to: ctx.accounts.buyer_token_account.to_account_info(),
            authority: ctx.accounts.sell_order.to_account_info(),
        }, signer), actual_fill)?;

        let so = &mut ctx.accounts.sell_order;
        so.amount_remaining = so.amount_remaining.checked_sub(actual_fill).ok_or(SellOrderError::Overflow)?;
        if so.amount_remaining == 0 { so.status = OrderStatus::Filled; }

        let slot = Clock::get()?.slot;
        let remaining_after = so.amount_remaining;
        let fully_filled = remaining_after == 0;
        emit!(SellOrderFilled { id, buyer: ctx.accounts.buyer.key(), fill_amount: actual_fill, total_cost, fee: fee_total, fully_filled, remaining_after, slot });
        Ok(())
    }

    // ===== Buy Order (Task #3) =====

    pub fn init_buy_order_counter(ctx: Context<InitBuyOrderCounterCtx>) -> Result<()> {
        let c = &mut ctx.accounts.buy_order_counter;
        c.coin_mint = ctx.accounts.coin_mint.key(); c.count = 0; c.bump = ctx.bumps.buy_order_counter;
        Ok(())
    }

    pub fn place_buy_order(ctx: Context<PlaceBuyOrderCtx>, amount_wanted: u64, price_per_coin: u64) -> Result<()> {
        require!(amount_wanted > 0, BuyOrderError::InvalidAmount);
        require!(price_per_coin > 0, BuyOrderError::InvalidPrice);

        let base_cost = (amount_wanted as u128).checked_mul(price_per_coin as u128).ok_or(BuyOrderError::Overflow)?
            .checked_div(1_000_000_000).ok_or(BuyOrderError::Overflow)? as u64;
        let ora_to_lock = base_cost.checked_mul(10_500).ok_or(BuyOrderError::Overflow)? / 10_000;

        let counter = &mut ctx.accounts.buy_order_counter;
        let id = counter.count;
        counter.count = id.checked_add(1).ok_or(BuyOrderError::Overflow)?;

        token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
            from: ctx.accounts.buyer_ora_account.to_account_info(),
            to: ctx.accounts.escrow_ora_account.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        }), ora_to_lock)?;

        let bo = &mut ctx.accounts.buy_order;
        let slot = Clock::get()?.slot;
        bo.id = id; bo.coin_mint = ctx.accounts.coin_mint.key(); bo.buyer = ctx.accounts.buyer.key();
        bo.amount_wanted = amount_wanted; bo.amount_filled = 0;
        bo.price_per_coin_lamports = price_per_coin; bo.ora_locked_lamports = ora_to_lock;
        bo.created_at_slot = slot; bo.status = OrderStatus::Open; bo.bump = ctx.bumps.buy_order;

        emit!(BuyOrderPlaced { id, coin_mint: bo.coin_mint, buyer: bo.buyer, amount_wanted, price_per_coin_lamports: price_per_coin, ora_locked: ora_to_lock, slot });
        Ok(())
    }

    pub fn cancel_buy_order(ctx: Context<CancelBuyOrderCtx>, order_id: u64) -> Result<()> {
        let coin_mint = ctx.accounts.buy_order.coin_mint;
        let id = ctx.accounts.buy_order.id;
        let bump = ctx.accounts.buy_order.bump;
        let ora_locked = ctx.accounts.buy_order.ora_locked_lamports;
        let amount_filled = ctx.accounts.buy_order.amount_filled;
        let price = ctx.accounts.buy_order.price_per_coin_lamports;
        require!(ctx.accounts.buy_order.status == OrderStatus::Open, BuyOrderError::OrderNotOpen);

        // [audit fix M-3] precise refund: actual cost = filled_amount × price × 1.05,
        // not a percentage approximation that loses precision on rounding.
        let used_base = (amount_filled as u128)
            .checked_mul(price as u128).ok_or(BuyOrderError::Overflow)?
            .checked_div(1_000_000_000).ok_or(BuyOrderError::Overflow)? as u64;
        let used = used_base
            .checked_mul(10_500).ok_or(BuyOrderError::Overflow)? / 10_000;
        let ora_to_return = ora_locked.saturating_sub(used);

        let id_bytes = id.to_le_bytes();
        let signer_seeds: &[&[u8]] = &[b"buy-order", coin_mint.as_ref(), id_bytes.as_ref(), &[bump]];
        let signer = &[signer_seeds];

        if ora_to_return > 0 {
            token::transfer(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), Transfer {
                from: ctx.accounts.escrow_ora_account.to_account_info(),
                to: ctx.accounts.buyer_ora_account.to_account_info(),
                authority: ctx.accounts.buy_order.to_account_info(),
            }, signer), ora_to_return)?;
        }

        let bo = &mut ctx.accounts.buy_order;
        bo.status = OrderStatus::Cancelled;

        let slot = Clock::get()?.slot;
        emit!(BuyOrderCancelled { id, buyer: bo.buyer, ora_returned: ora_to_return, slot });
        Ok(())
    }

    pub fn fill_buy_order(ctx: Context<FillBuyOrderCtx>, order_id: u64, fill_amount: u64) -> Result<()> {
        let coin_mint = ctx.accounts.buy_order.coin_mint;
        let id = ctx.accounts.buy_order.id;
        let bump = ctx.accounts.buy_order.bump;
        let price = ctx.accounts.buy_order.price_per_coin_lamports;
        let amount_wanted = ctx.accounts.buy_order.amount_wanted;
        let amount_filled = ctx.accounts.buy_order.amount_filled;
        require!(ctx.accounts.buy_order.status == OrderStatus::Open, BuyOrderError::OrderNotOpen);
        require!(fill_amount > 0, BuyOrderError::InvalidAmount);

        let remaining = amount_wanted.saturating_sub(amount_filled);
        let actual_fill = fill_amount.min(remaining);
        require!(actual_fill > 0, BuyOrderError::OrderFullyFilled);

        let total_cost = (actual_fill as u128).checked_mul(price as u128).ok_or(BuyOrderError::Overflow)?
            .checked_div(1_000_000_000).ok_or(BuyOrderError::Overflow)? as u64;
        let fee_total = total_cost.checked_mul(sell_order::FEE_BPS).ok_or(BuyOrderError::Overflow)? / 10_000;
        let burn_amount = total_cost.checked_mul(sell_order::BURN_BPS).ok_or(BuyOrderError::Overflow)? / 10_000;
        let staking_amount = total_cost.checked_mul(sell_order::STAKING_BPS).ok_or(BuyOrderError::Overflow)? / 10_000;
        let gas_amount = total_cost.checked_mul(sell_order::GAS_BPS).ok_or(BuyOrderError::Overflow)? / 10_000;
        let ops_amount = fee_total.saturating_sub(burn_amount).saturating_sub(staking_amount).saturating_sub(gas_amount);
        let seller_receives = total_cost.checked_sub(fee_total).ok_or(BuyOrderError::Overflow)?;

        // Seller provides CC → buyer
        token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
            from: ctx.accounts.seller_token_account.to_account_info(),
            to: ctx.accounts.buyer_token_account.to_account_info(),
            authority: ctx.accounts.seller.to_account_info(),
        }), actual_fill)?;

        // Escrow ORA → seller (95%)
        let id_bytes = id.to_le_bytes();
        let signer_seeds: &[&[u8]] = &[b"buy-order", coin_mint.as_ref(), id_bytes.as_ref(), &[bump]];
        let signer = &[signer_seeds];

        token::transfer(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), Transfer {
            from: ctx.accounts.escrow_ora_account.to_account_info(),
            to: ctx.accounts.seller_ora_account.to_account_info(),
            authority: ctx.accounts.buy_order.to_account_info(),
        }, signer), seller_receives)?;

        // 2% burn from escrow
        if burn_amount > 0 {
            token::burn(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), Burn {
                mint: ctx.accounts.ora_mint.to_account_info(),
                from: ctx.accounts.escrow_ora_account.to_account_info(),
                authority: ctx.accounts.buy_order.to_account_info(),
            }, signer), burn_amount)?;
        }
        if staking_amount > 0 {
            token::transfer(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), Transfer {
                from: ctx.accounts.escrow_ora_account.to_account_info(),
                to: ctx.accounts.staking_rewards_account.to_account_info(),
                authority: ctx.accounts.buy_order.to_account_info(),
            }, signer), staking_amount)?;
        }
        if gas_amount > 0 {
            token::transfer(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), Transfer {
                from: ctx.accounts.escrow_ora_account.to_account_info(),
                to: ctx.accounts.gas_reserve_account.to_account_info(),
                authority: ctx.accounts.buy_order.to_account_info(),
            }, signer), gas_amount)?;
        }
        if ops_amount > 0 {
            token::transfer(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), Transfer {
                from: ctx.accounts.escrow_ora_account.to_account_info(),
                to: ctx.accounts.ops_treasury_account.to_account_info(),
                authority: ctx.accounts.buy_order.to_account_info(),
            }, signer), ops_amount)?;
        }

        let bo = &mut ctx.accounts.buy_order;
        bo.amount_filled = bo.amount_filled.checked_add(actual_fill).ok_or(BuyOrderError::Overflow)?;
        if bo.amount_filled >= bo.amount_wanted { bo.status = OrderStatus::Filled; }

        let slot = Clock::get()?.slot;
        let remaining_after = bo.amount_wanted.saturating_sub(bo.amount_filled);
        let fully_filled = bo.amount_filled >= bo.amount_wanted;
        emit!(BuyOrderFilled { id, seller: ctx.accounts.seller.key(), fill_amount: actual_fill, total_cost, fee: fee_total, fully_filled, remaining_after, slot });
        Ok(())
    }
}

// === Existing Account Structures ===
#[account] pub struct Listing { pub seller: Pubkey, pub nft_mint: Pubkey, pub price: u64, pub listing_type: ListingType, pub created_at: i64, pub is_active: bool, pub bump: u8 }
#[account] pub struct Bounty { pub creator: Pubkey, pub title: String, pub description: String, pub reward_amount: u64, pub deadline: i64, pub status: BountyStatus, pub submission_count: u16, pub winner: Pubkey, pub created_at: i64, pub bump: u8 }
#[account] pub struct License { pub licensor: Pubkey, pub licensee: Pubkey, pub royalty_bps: u16, pub granted_at: i64, pub is_active: bool, pub bump: u8 }
#[account] pub struct AdBid { pub bidder: Pubkey, pub bid_amount: u64, pub target_slot: u8, pub is_active: bool, pub created_at: i64, pub bump: u8 }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)] pub enum ListingType { FixedPrice, Auction, DutchAuction }
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)] pub enum BountyStatus { Open, Completed, Cancelled }

// === Existing Contexts ===
#[derive(Accounts)] pub struct CreateListing<'info> {
    #[account(init, payer = seller, space = 8+32+32+8+1+8+1+1, seeds = [b"listing", nft_mint.key().as_ref()], bump)]
    pub listing: Account<'info, Listing>,
    #[account(mut)] pub seller: Signer<'info>,
    /// CHECK: NFT mint
    pub nft_mint: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)] pub struct CancelListing<'info> {
    #[account(mut, has_one = seller)] pub listing: Account<'info, Listing>,
    pub seller: Signer<'info>,
}
#[derive(Accounts)] #[instruction(title: String)] pub struct CreateBounty<'info> {
    #[account(init, payer = creator, space = 8+32+104+1004+8+8+1+2+32+8+1, seeds = [b"bounty", creator.key().as_ref(), title.as_bytes()], bump)]
    pub bounty: Account<'info, Bounty>,
    #[account(mut)] pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)] pub struct SubmitBountyWork<'info> { #[account(mut)] pub bounty: Account<'info, Bounty>, pub submitter: Signer<'info> }
#[derive(Accounts)]
pub struct AwardBounty<'info> {
    #[account(mut, has_one = creator)]
    pub bounty: Account<'info, Bounty>,
    pub creator: Signer<'info>,
    /// CHECK: Winner address only; rewards are distributed off this pubkey.
    pub winner: AccountInfo<'info>,
}
#[derive(Accounts)] pub struct GrantLicense<'info> {
    #[account(init, payer = licensor, space = 8+32+32+2+8+1+1, seeds = [b"license", licensor.key().as_ref(), licensee.key().as_ref()], bump)]
    pub license: Account<'info, License>,
    #[account(mut)] pub licensor: Signer<'info>,
    /// CHECK: Licensee
    pub licensee: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
#[instruction(bid_amount: u64, target_slot: u8)]
pub struct PlaceAdBid<'info> {
    #[account(init, payer = bidder, space = 8+32+8+1+1+8+1, seeds = [b"ad_bid", bidder.key().as_ref(), &[target_slot]], bump)]
    pub ad_bid: Account<'info, AdBid>,
    #[account(mut)] pub bidder: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// === Sell Order Contexts ===
#[derive(Accounts)] pub struct InitSellOrderCounterCtx<'info> {
    #[account(init, payer = payer, space = SellOrderCounter::SIZE, seeds = [b"sell-order-counter", coin_mint.key().as_ref()], bump)]
    pub sell_order_counter: Account<'info, SellOrderCounter>,
    /// CHECK: Coin mint
    pub coin_mint: AccountInfo<'info>,
    #[account(mut)] pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)] #[instruction(amount: u64, price_per_coin: u64)]
pub struct PlaceSellOrderCtx<'info> {
    #[account(mut, seeds = [b"sell-order-counter", coin_mint.key().as_ref()], bump = sell_order_counter.bump)]
    pub sell_order_counter: Account<'info, SellOrderCounter>,
    #[account(init, payer = seller, space = SellOrder::SIZE, seeds = [b"sell-order", coin_mint.key().as_ref(), sell_order_counter.count.to_le_bytes().as_ref()], bump)]
    pub sell_order: Account<'info, SellOrder>,
    /// CHECK: Coin mint
    pub coin_mint: AccountInfo<'info>,
    #[account(mut, constraint = seller_token_account.owner == seller.key() @ SellOrderError::Unauthorized)]
    pub seller_token_account: Account<'info, TokenAccount>,
    #[account(mut)] pub escrow_token_account: Account<'info, TokenAccount>,
    #[account(mut)] pub seller: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)] #[instruction(order_id: u64)]
pub struct CancelSellOrderCtx<'info> {
    #[account(mut, seeds = [b"sell-order", sell_order.coin_mint.as_ref(), order_id.to_le_bytes().as_ref()], bump = sell_order.bump, has_one = seller @ SellOrderError::Unauthorized)]
    pub sell_order: Account<'info, SellOrder>,
    #[account(mut)] pub escrow_token_account: Account<'info, TokenAccount>,
    #[account(mut)] pub seller_token_account: Account<'info, TokenAccount>,
    pub seller: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)] #[instruction(order_id: u64, fill_amount: u64)]
pub struct FillSellOrderCtx<'info> {
    #[account(mut, seeds = [b"sell-order", sell_order.coin_mint.as_ref(), order_id.to_le_bytes().as_ref()], bump = sell_order.bump)]
    pub sell_order: Account<'info, SellOrder>,
    // [audit fix C-5/C-6] PDA-owned escrow + mint == sell_order.coin_mint
    #[account(mut,
        constraint = escrow_token_account.owner == sell_order.key() @ SellOrderError::Unauthorized,
        constraint = escrow_token_account.mint == sell_order.coin_mint @ SellOrderError::Unauthorized
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    // [audit fix] CC destination is buyer's account; mint must match
    #[account(mut,
        constraint = buyer_token_account.owner == buyer.key() @ SellOrderError::Unauthorized,
        constraint = buyer_token_account.mint == sell_order.coin_mint @ SellOrderError::Unauthorized
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,
    // [audit fix] buyer pays from their own ORA
    #[account(mut,
        constraint = buyer_ora_account.owner == buyer.key() @ SellOrderError::Unauthorized,
        constraint = buyer_ora_account.mint == ora_mint.key() @ SellOrderError::Unauthorized
    )]
    pub buyer_ora_account: Account<'info, TokenAccount>,
    // [audit fix C-5] seller's ORA destination MUST belong to sell_order.seller (not buyer-supplied)
    #[account(mut,
        constraint = seller_ora_account.owner == sell_order.seller @ SellOrderError::Unauthorized,
        constraint = seller_ora_account.mint == ora_mint.key() @ SellOrderError::Unauthorized
    )]
    pub seller_ora_account: Account<'info, TokenAccount>,
    pub ora_mint: Account<'info, Mint>,
    // [audit fix C-6] fee buckets locked to protocol PDAs
    #[account(mut, address = STAKING_REWARDS_POOL @ SellOrderError::Unauthorized)]
    pub staking_rewards_account: Account<'info, TokenAccount>,
    #[account(mut, address = GAS_RESERVE_POOL @ SellOrderError::Unauthorized)]
    pub gas_reserve_account: Account<'info, TokenAccount>,
    #[account(mut, address = OPS_TREASURY_POOL @ SellOrderError::Unauthorized)]
    pub ops_treasury_account: Account<'info, TokenAccount>,
    #[account(mut)] pub buyer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// === Buy Order Contexts ===
#[derive(Accounts)] pub struct InitBuyOrderCounterCtx<'info> {
    #[account(init, payer = payer, space = BuyOrderCounter::SIZE, seeds = [b"buy-order-counter", coin_mint.key().as_ref()], bump)]
    pub buy_order_counter: Account<'info, BuyOrderCounter>,
    /// CHECK: Coin mint
    pub coin_mint: AccountInfo<'info>,
    #[account(mut)] pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)] #[instruction(amount_wanted: u64, price_per_coin: u64)]
pub struct PlaceBuyOrderCtx<'info> {
    #[account(mut, seeds = [b"buy-order-counter", coin_mint.key().as_ref()], bump = buy_order_counter.bump)]
    pub buy_order_counter: Account<'info, BuyOrderCounter>,
    #[account(init, payer = buyer, space = BuyOrder::SIZE, seeds = [b"buy-order", coin_mint.key().as_ref(), buy_order_counter.count.to_le_bytes().as_ref()], bump)]
    pub buy_order: Account<'info, BuyOrder>,
    /// CHECK: Coin mint
    pub coin_mint: AccountInfo<'info>,
    #[account(mut, constraint = buyer_ora_account.owner == buyer.key() @ BuyOrderError::Unauthorized)]
    pub buyer_ora_account: Account<'info, TokenAccount>,
    #[account(mut)] pub escrow_ora_account: Account<'info, TokenAccount>,
    #[account(mut)] pub buyer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)] #[instruction(order_id: u64)]
pub struct CancelBuyOrderCtx<'info> {
    #[account(mut, seeds = [b"buy-order", buy_order.coin_mint.as_ref(), order_id.to_le_bytes().as_ref()], bump = buy_order.bump, has_one = buyer @ BuyOrderError::Unauthorized)]
    pub buy_order: Account<'info, BuyOrder>,
    #[account(mut)] pub escrow_ora_account: Account<'info, TokenAccount>,
    #[account(mut)] pub buyer_ora_account: Account<'info, TokenAccount>,
    pub buyer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)] #[instruction(order_id: u64, fill_amount: u64)]
pub struct FillBuyOrderCtx<'info> {
    #[account(mut, seeds = [b"buy-order", buy_order.coin_mint.as_ref(), order_id.to_le_bytes().as_ref()], bump = buy_order.bump)]
    pub buy_order: Account<'info, BuyOrder>,
    // [audit fix] PDA-owned ORA escrow + ORA mint match
    #[account(mut,
        constraint = escrow_ora_account.owner == buy_order.key() @ BuyOrderError::Unauthorized,
        constraint = escrow_ora_account.mint == ora_mint.key() @ BuyOrderError::Unauthorized
    )]
    pub escrow_ora_account: Account<'info, TokenAccount>,
    // seller provides CC; mint must match
    #[account(mut,
        constraint = seller_token_account.owner == seller.key() @ BuyOrderError::Unauthorized,
        constraint = seller_token_account.mint == buy_order.coin_mint @ BuyOrderError::Unauthorized
    )]
    pub seller_token_account: Account<'info, TokenAccount>,
    // [audit fix C-19] buyer destination MUST be the buyer recorded on the order
    #[account(mut,
        constraint = buyer_token_account.owner == buy_order.buyer @ BuyOrderError::Unauthorized,
        constraint = buyer_token_account.mint == buy_order.coin_mint @ BuyOrderError::Unauthorized
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,
    // seller's ORA receiving account; mint must match ORA
    #[account(mut,
        constraint = seller_ora_account.owner == seller.key() @ BuyOrderError::Unauthorized,
        constraint = seller_ora_account.mint == ora_mint.key() @ BuyOrderError::Unauthorized
    )]
    pub seller_ora_account: Account<'info, TokenAccount>,
    pub ora_mint: Account<'info, Mint>,
    // [audit fix C-20] fee buckets locked to protocol PDAs
    #[account(mut, address = STAKING_REWARDS_POOL @ BuyOrderError::Unauthorized)]
    pub staking_rewards_account: Account<'info, TokenAccount>,
    #[account(mut, address = GAS_RESERVE_POOL @ BuyOrderError::Unauthorized)]
    pub gas_reserve_account: Account<'info, TokenAccount>,
    #[account(mut, address = OPS_TREASURY_POOL @ BuyOrderError::Unauthorized)]
    pub ops_treasury_account: Account<'info, TokenAccount>,
    #[account(mut)] pub seller: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// === Errors ===
#[error_code]
pub enum ErrorCode {
    #[msg("Invalid price")] InvalidPrice,
    #[msg("Invalid amount")] InvalidAmount,
    #[msg("Title too long")] TitleTooLong,
    #[msg("Description too long")] DescriptionTooLong,
    #[msg("URI too long")] UriTooLong,
    #[msg("Bounty not open")] BountyNotOpen,
    #[msg("Bounty expired")] BountyExpired,
    #[msg("Invalid royalty")] InvalidRoyalty,
    #[msg("Overflow")] Overflow,
}
