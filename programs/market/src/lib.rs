// [whitepaper-sync v1.1] verified — sell_order::fill_order and
// buy_order::fill_order route the 5% fee through sell_order::{BURN, STAKING,
// GAS, OPS}_BPS = 200/200/50/50, matching Whitepaper v1.1 §5.7 (2% burn /
// 2% staking / 0.5% gas / 0.5% ops) and Numbers Handbook §5. Creator-coin
// secondary-trade pay path (`creator-coin::fill_order`) is fee-bearing in
// ORA; the same-CC fee-free path described in WP §5.7 ("if a fan pays a
// creator with the creator's own Creator Coin, the creator receives 100%")
// is implemented as the consumable-benefit redemption path
// (`creator-coin::initiate_redemption` → `confirm_receipt`): the buyer
// transfers CC into escrow at `cost`, the creator receives the full `cost`
// of CC on confirmation, no fee assessed. The 5% Creator Coin secondary-sale
// fee was already collected at issuance (`primary_buy`).
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};

pub mod sell_order;
pub mod buy_order;
pub mod bounty_v2;
pub mod bounty_v2_ix;
// [whitepaper-sync v1.1] §12 NFT Royalty enforcement (see royalty.rs).
pub mod royalty;

pub use sell_order::*;
pub use buy_order::*;
pub use bounty_v2::*;
pub use bounty_v2_ix::*;
pub use royalty::*;

declare_id!("9YgDaCgqqHhztHEr8TDBmX3ffrdHw9nMXt2tZXjBA2sc");

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  ⚠️ ⚠️ ⚠️  DO NOT DEPLOY TO MAINNET  ⚠️ ⚠️ ⚠️                              ║
// ║                                                                      ║
// ║  All of the protocol-pool / mint / admin constants below are         ║
// ║  placeholders set to `system_program::ID`. Deploying the program    ║
// ║  with these placeholders bricks ALL revenue-generating instructions  ║
// ║  (fill_sell_order, fill_buy_order, award_submission, …) because the ║
// ║  `address = ...` constraints can never be satisfied.                ║
// ║                                                                      ║
// ║  Before mainnet:                                                     ║
// ║    1. Replace every constant below with the real protocol pubkey.   ║
// ║    2. Confirm `cargo test --features mainnet-check` (see             ║
// ║       `require_real_pools_configured` runtime guard) passes locally. ║
// ║    3. Audit retest required.                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

/// [audit fix C-6/C-20] Hardcoded protocol fee pools (ORA-denominated).
/// ⚠️ DO NOT DEPLOY — placeholder = system program ID; replace with real protocol PDAs pre-mainnet.
// [local-deploy 2026-05-19] real address on localnet: 9byFYXdRziBe6huCRCsExz65eJMJRxkLPNReTYPzCiHS
pub const STAKING_REWARDS_POOL: Pubkey = Pubkey::new_from_array([127, 210, 216, 137, 107, 161, 33, 182, 172, 186, 167, 117, 190, 40, 215, 32, 84, 56, 69, 15, 197, 164, 130, 140, 59, 246, 11, 42, 77, 87, 94, 69]);
// [local-deploy 2026-05-19] real address on localnet: G9faGRWp35cDnGZdE38zwTisErASpYGoYcCKDvY3CPEE
pub const GAS_RESERVE_POOL: Pubkey = Pubkey::new_from_array([225, 23, 144, 204, 122, 29, 73, 91, 161, 241, 10, 117, 27, 233, 253, 109, 104, 15, 163, 59, 61, 24, 233, 119, 245, 67, 128, 29, 70, 173, 249, 143]);
// [local-deploy 2026-05-19] real address on localnet: FcpiWgjWuA39CMZfahxhDSMUGUavB4kVHjuovGvAxr1f
pub const OPS_TREASURY_POOL: Pubkey = Pubkey::new_from_array([217, 48, 229, 202, 178, 131, 49, 202, 84, 203, 0, 200, 144, 206, 29, 150, 143, 191, 101, 210, 58, 17, 161, 63, 138, 132, 39, 227, 12, 173, 122, 146]);

/// [Bounty V2 audit fix C-2] Canonical token mints.
/// ⚠️ DO NOT DEPLOY — placeholders. Replace with real ORA/USDC mints pre-mainnet.
// [local-deploy 2026-05-19] real address on localnet: AE2saLnjj8u9RGQyftYw4wLX5wR2HbJ3byb1t97CdF8s
pub const ORA_MINT: Pubkey = Pubkey::new_from_array([137, 15, 217, 121, 122, 4, 82, 92, 100, 203, 47, 28, 205, 45, 150, 226, 133, 111, 232, 149, 62, 3, 156, 144, 35, 103, 3, 130, 149, 120, 102, 80]);
// [local-deploy 2026-05-19] real address on localnet: 7zLE5iNcfw6xAR7BxhU1yZMk6Sz7TYQir8U1xUe72Jp1
pub const USDC_MINT: Pubkey = Pubkey::new_from_array([103, 213, 247, 79, 209, 140, 32, 112, 73, 146, 150, 30, 157, 32, 182, 221, 206, 78, 239, 59, 111, 37, 236, 101, 201, 224, 81, 36, 225, 148, 14, 242]);

/// [Bounty V2 audit fix C-4] Program admin allowed to initialise / rotate
/// the OfficialBountyAuthority. Prevents front-run init attacks.
/// ⚠️ DO NOT DEPLOY — placeholder. Replace with real multisig pubkey pre-mainnet.
// [local-deploy 2026-05-19] real address on localnet: DppCZV1QDh6D4hoUJvpQCjiZ5KCjV4YTokUGsu7m4bxP
pub const PROGRAM_ADMIN: Pubkey = Pubkey::new_from_array([190, 139, 232, 217, 216, 167, 202, 133, 100, 57, 237, 31, 194, 128, 82, 13, 164, 131, 226, 139, 206, 103, 215, 221, 251, 39, 85, 246, 98, 109, 149, 76]);

/// [Bounty V2 audit fix H-2] USDC-denominated protocol fee pools.
/// Separate from ORA pools because token accounts hold one mint each.
/// ⚠️ DO NOT DEPLOY — placeholders. Replace with real USDC treasury accounts.
// [local-deploy 2026-05-19] real address on localnet: CUaHXgXyr7TCCYE2svaLm1LMEUGH6LYjBXm6nwrAKY5q
pub const STAKING_REWARDS_POOL_USDC: Pubkey = Pubkey::new_from_array([170, 128, 223, 156, 178, 145, 31, 107, 68, 126, 45, 193, 227, 174, 161, 47, 130, 11, 147, 107, 231, 246, 33, 33, 208, 98, 252, 41, 214, 235, 183, 116]);
// [local-deploy 2026-05-19] real address on localnet: 8fQer3FEnA9uBSb6PnEMn5n1VjNq5zyqszdZyPSnoq4s
pub const GAS_RESERVE_POOL_USDC: Pubkey = Pubkey::new_from_array([113, 216, 159, 138, 109, 91, 51, 188, 114, 170, 98, 203, 191, 245, 22, 174, 135, 166, 113, 241, 93, 122, 194, 147, 145, 206, 82, 227, 73, 239, 132, 192]);
// [local-deploy 2026-05-19] real address on localnet: FrhNsvGjLd3Z8PAmkjLG8AJonrKRkyhY5U2qcvaJ21ad
pub const OPS_TREASURY_POOL_USDC: Pubkey = Pubkey::new_from_array([220, 190, 187, 52, 49, 46, 221, 218, 90, 91, 251, 180, 89, 209, 68, 189, 234, 150, 206, 28, 29, 215, 196, 136, 59, 105, 83, 250, 69, 168, 170, 54]);

/// [audit fix M-C4] Runtime guard that aborts revenue-generating instructions
/// when the placeholder protocol-pool constants haven't been replaced with real
/// pubkeys. Belt-and-suspenders: the `address = ...` constraints already block
/// this path, but a clear `PlaceholderProtocolPools` error beats Anchor's
/// generic `AccountNotInitialized`.
fn require_real_pools_configured() -> Result<()> {
    let placeholder = anchor_lang::solana_program::system_program::ID;
    require!(
        STAKING_REWARDS_POOL != placeholder
            && GAS_RESERVE_POOL != placeholder
            && OPS_TREASURY_POOL != placeholder
            && ORA_MINT != placeholder,
        ErrorCode::PlaceholderProtocolPools
    );
    Ok(())
}

#[program]
pub mod aura_market {
    use super::*;
    use crate::bounty_v2_ix::{
        InitOfficialAuthority, RotateOfficialAuthority, InitBountyCounter,
        CreateBountyV2, SubmitToBounty, AwardSubmission, RejectSubmission,
        CloseBountyCommon, RefundExpiredCtx,
    };

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

    // [audit fix M-C1] DELETED: old `create_bounty` / `submit_bounty_work` /
    // `award_bounty` stubs. They recorded a bounty + winner on-chain but
    // NEVER escrowed or transferred any tokens — a working scam-by-default.
    // All bounty flows now go through `bv2_*` instructions below, which
    // properly escrow funds and run the audited 5% protocol-fee split.
    //
    // [audit fix M-C2] DELETED: old `grant_license`. It allowed any licensor
    // to mint an on-chain "license" naming any wallet as licensee with no
    // licensee signature — an identity-squatting / on-chain-spam vector.
    // License agreements should be tracked off-chain or via a new instruction
    // that requires `licensee: Signer<'info>`.
    //
    // [audit fix M-C3] DELETED: old `place_ad_bid`. It recorded a bid amount
    // on-chain without escrowing any tokens — a Potemkin auction. Re-add
    // later with real ORA escrow + a `settle_ad_bid` finalisation step
    // mirroring `bounty_v2_ix::refund_and_close`.

    /// Helper that any front-end can call before the first revenue-bearing
    /// instruction to surface the placeholder-pools deploy-blocker as a
    /// clean error instead of `AccountNotInitialized`. [audit fix M-C4]
    pub fn assert_pools_configured(_ctx: Context<NoopCtx>) -> Result<()> {
        require_real_pools_configured()
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
        // [audit fix M-C4] surface the placeholder-pools deploy-blocker as a
        // clean error so off-chain ops catch it before tx submission.
        require_real_pools_configured()?;

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
        // [audit fix M-C4] same guard as in place_sell_order.
        require_real_pools_configured()?;

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

    // ===== Bounty V2 (multi-winner escrow, ORA + USDC) =====
    // All logic lives in bounty_v2_ix.rs; these are program-entry wrappers.

    pub fn bv2_init_official_authority(ctx: Context<InitOfficialAuthority>, authority: Pubkey) -> Result<()> {
        bounty_v2_ix::init_official_authority(ctx, authority)
    }
    pub fn bv2_rotate_official_authority(ctx: Context<RotateOfficialAuthority>, new_authority: Pubkey) -> Result<()> {
        bounty_v2_ix::rotate_official_authority(ctx, new_authority)
    }
    pub fn bv2_init_bounty_counter(ctx: Context<InitBountyCounter>) -> Result<()> {
        bounty_v2_ix::init_bounty_counter(ctx)
    }
    pub fn bv2_create_bounty(
        ctx: Context<CreateBountyV2>,
        total_reward: u64,
        max_winners: u8,
        deadline: i64,
        title: String,
        metadata_uri: String,
        is_official: bool,
    ) -> Result<()> {
        bounty_v2_ix::create_bounty_v2(ctx, total_reward, max_winners, deadline, title, metadata_uri, is_official)
    }
    pub fn bv2_submit_to_bounty(ctx: Context<SubmitToBounty>, content_uri: String) -> Result<()> {
        bounty_v2_ix::submit_to_bounty(ctx, content_uri)
    }
    pub fn bv2_award_submission(ctx: Context<AwardSubmission>, gross_amount: u64) -> Result<()> {
        bounty_v2_ix::award_submission(ctx, gross_amount)
    }
    pub fn bv2_reject_submission(ctx: Context<RejectSubmission>) -> Result<()> {
        bounty_v2_ix::reject_submission(ctx)
    }
    pub fn bv2_cancel_bounty(ctx: Context<CloseBountyCommon>) -> Result<()> {
        bounty_v2_ix::cancel_bounty(ctx)
    }
    pub fn bv2_close_bounty(ctx: Context<CloseBountyCommon>) -> Result<()> {
        bounty_v2_ix::close_bounty(ctx)
    }
    pub fn bv2_refund_expired(ctx: Context<RefundExpiredCtx>) -> Result<()> {
        bounty_v2_ix::refund_expired(ctx)
    }

    // ===== NFT Royalties (Whitepaper v1.1 §12) =====
    // [whitepaper-sync v1.1] §12 — protocol-level creator royalty
    // enforcement layered on top of Metaplex pNFT. See royalty.rs for the
    // full WP §12 mapping (min 5% / max 45% / default 5%) and the WP §5.7
    // protocol-fee split (40/40/10/10 of 5%).
    //
    // Existing CC trade paths (fill_sell_order / fill_buy_order) are NOT
    // modified — they operate on Creator Coins, not NFTs, and applying NFT
    // royalties to fungible CC trades would be semantically wrong and
    // would break the audited 5% fee split. NFT sale flows that want
    // royalty enforcement should call `enforce_royalty_on_sale` (or its
    // CPI equivalent) from their own settlement instruction.

    pub fn set_royalty(ctx: Context<SetRoyaltyCtx>, royalty_bps: u16) -> Result<()> {
        royalty::set_royalty(ctx, royalty_bps)
    }

    pub fn enforce_royalty_on_sale(
        ctx: Context<EnforceRoyaltyOnSaleCtx>,
        sale_price: u64,
    ) -> Result<()> {
        royalty::enforce_royalty_on_sale(ctx, sale_price)
    }
}

// === Account Structures ===
//
// [audit fix M-C1/M-C2/M-C3] DELETED account structures: `Bounty`,
// `License`, `AdBid`, and the old `BountyStatus` enum. These backed the
// old escrow-less stubs that have been removed from the program.
//
// NOTE: `Listing` / `ListingType` are kept for now because nothing
// downstream pulls value through them, but per audit M-H2 the listing
// flow is decorative — the NFT is never escrowed and there is no
// buy/settle instruction. Treat these listings as off-chain memos only.
#[account] pub struct Listing { pub seller: Pubkey, pub nft_mint: Pubkey, pub price: u64, pub listing_type: ListingType, pub created_at: i64, pub is_active: bool, pub bump: u8 }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)] pub enum ListingType { FixedPrice, Auction, DutchAuction }

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

/// [audit fix M-C4] No-op context used by `assert_pools_configured`.
#[derive(Accounts)] pub struct NoopCtx {}

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
    // [audit fix round2 R2-M-M1] Also constrain `mint == coin_mint` here so
    // the SPL Token program's MintMismatch surface is replaced with a clean
    // Anchor `Unauthorized` error.
    #[account(mut,
        constraint = seller_token_account.owner == seller.key() @ SellOrderError::Unauthorized,
        constraint = seller_token_account.mint == coin_mint.key() @ SellOrderError::Unauthorized,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,
    // [audit fix M-C5] escrow must be PDA-owned (sell_order PDA signs all
    // future cancel/fill transfers) and denominated in the order's coin.
    // The escrow ATA must be pre-created externally with the sell_order PDA
    // set as `authority` and `coin_mint` set as `mint` BEFORE invoking
    // place_sell_order, then this constraint will pass.
    #[account(mut,
        constraint = escrow_token_account.owner == sell_order.key() @ SellOrderError::Unauthorized,
        constraint = escrow_token_account.mint == coin_mint.key() @ SellOrderError::Unauthorized
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    #[account(mut)] pub seller: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)] #[instruction(order_id: u64)]
pub struct CancelSellOrderCtx<'info> {
    #[account(mut, seeds = [b"sell-order", sell_order.coin_mint.as_ref(), order_id.to_le_bytes().as_ref()], bump = sell_order.bump, has_one = seller @ SellOrderError::Unauthorized)]
    pub sell_order: Account<'info, SellOrder>,
    // [audit fix round2 R2-M-H1] Bind escrow ownership/mint to the
    // sell_order PDA + coin_mint, matching the constraint pattern already
    // applied to PlaceSellOrderCtx/FillSellOrderCtx in round 1. Without
    // this, defence-in-depth was missing on the cancel path — only the
    // CPI signer-seed mismatch was protecting funds.
    #[account(mut,
        constraint = escrow_token_account.owner == sell_order.key() @ SellOrderError::Unauthorized,
        constraint = escrow_token_account.mint == sell_order.coin_mint @ SellOrderError::Unauthorized,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    // [audit fix round2 R2-M-H1] Bind refund destination to the seller and
    // require mint match so a malicious wallet UI can't redirect the
    // refund to a third party.
    #[account(mut,
        constraint = seller_token_account.owner == seller.key() @ SellOrderError::Unauthorized,
        constraint = seller_token_account.mint == sell_order.coin_mint @ SellOrderError::Unauthorized,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,
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
    // [audit fix round2 R2-M-M1] Constrain `mint == ORA_MINT` so the SPL
    // Token program's MintMismatch surface is replaced with a clean Anchor
    // `Unauthorized` error.
    #[account(mut,
        constraint = buyer_ora_account.owner == buyer.key() @ BuyOrderError::Unauthorized,
        constraint = buyer_ora_account.mint == ORA_MINT @ BuyOrderError::Unauthorized,
    )]
    pub buyer_ora_account: Account<'info, TokenAccount>,
    // [audit fix M-C5b] escrow must be PDA-owned (buy_order PDA signs all
    // future cancel/fill transfers) and denominated in ORA. Must be
    // pre-created externally with the buy_order PDA as `authority` and the
    // canonical ORA mint as `mint` before invoking place_buy_order.
    #[account(mut,
        constraint = escrow_ora_account.owner == buy_order.key() @ BuyOrderError::Unauthorized,
        constraint = escrow_ora_account.mint == ORA_MINT @ BuyOrderError::Unauthorized
    )]
    pub escrow_ora_account: Account<'info, TokenAccount>,
    #[account(mut)] pub buyer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)] #[instruction(order_id: u64)]
pub struct CancelBuyOrderCtx<'info> {
    #[account(mut, seeds = [b"buy-order", buy_order.coin_mint.as_ref(), order_id.to_le_bytes().as_ref()], bump = buy_order.bump, has_one = buyer @ BuyOrderError::Unauthorized)]
    pub buy_order: Account<'info, BuyOrder>,
    // [audit fix round2 R2-M-H1] Bind escrow ownership/mint to the
    // buy_order PDA + ORA_MINT (symmetric to CancelSellOrderCtx).
    #[account(mut,
        constraint = escrow_ora_account.owner == buy_order.key() @ BuyOrderError::Unauthorized,
        constraint = escrow_ora_account.mint == ORA_MINT @ BuyOrderError::Unauthorized,
    )]
    pub escrow_ora_account: Account<'info, TokenAccount>,
    // [audit fix round2 R2-M-H1] Bind refund destination to the buyer.
    #[account(mut,
        constraint = buyer_ora_account.owner == buyer.key() @ BuyOrderError::Unauthorized,
        constraint = buyer_ora_account.mint == ORA_MINT @ BuyOrderError::Unauthorized,
    )]
    pub buyer_ora_account: Account<'info, TokenAccount>,
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
    #[msg("Invalid royalty")] InvalidRoyalty,
    #[msg("Overflow")] Overflow,
    /// [audit fix M-C4] Surfaced when placeholder protocol-pool constants
    /// haven't been replaced with real pubkeys. Blocks revenue-bearing
    /// instructions from running with `system_program::ID` placeholders.
    #[msg("Protocol pool constants are placeholders — do not deploy")] PlaceholderProtocolPools,
}
