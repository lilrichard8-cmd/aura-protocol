use anchor_lang::prelude::*;

/// [whitepaper-sync v1.1] verified — 5% fee = 2%/2%/0.5%/0.5%, matches
/// Whitepaper v1.1 §5.7 and Numbers Handbook §5 (40/40/10/10 of the 5% fee).
/// `market/lib.rs` (sell_order::fill_order + buy_order::fill_order),
/// `market/bounty_v2.rs::award_*` (ORA mode), and `creator-coin::fill_order`
/// + `primary_buy` all read these constants directly. USDC bounty path
/// (bounty_v2.rs) routes 0/4/0.5/0.5 since USDC cannot be burned.
pub const FEE_BPS: u64 = 500;
pub const BURN_BPS: u64 = 200;
pub const STAKING_BPS: u64 = 200;
pub const GAS_BPS: u64 = 50;
pub const OPS_BPS: u64 = 50;

#[account]
pub struct SellOrderCounter {
    pub coin_mint: Pubkey,
    pub count: u64,
    pub bump: u8,
}
impl SellOrderCounter {
    pub const SIZE: usize = 8 + 32 + 8 + 1;
}

#[account]
pub struct SellOrder {
    pub id: u64,
    pub coin_mint: Pubkey,
    pub seller: Pubkey,
    pub amount_remaining: u64,
    pub amount_original: u64,
    pub price_per_coin_lamports: u64,
    pub created_at_slot: u64,
    pub status: OrderStatus,
    pub bump: u8,
}
impl SellOrder {
    pub const SIZE: usize = 8 + 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum OrderStatus { Open, Cancelled, Filled }

// Events
#[event]
pub struct SellOrderPlaced { pub id: u64, pub coin_mint: Pubkey, pub seller: Pubkey, pub amount: u64, pub price_per_coin_lamports: u64, pub slot: u64 }
#[event]
pub struct SellOrderFilled {
    pub id: u64,
    pub buyer: Pubkey,
    pub fill_amount: u64,
    pub total_cost: u64,
    pub fee: u64,
    /// [audit fix M-6] true when this fill closed out the order; false on partial fill
    pub fully_filled: bool,
    pub remaining_after: u64,
    pub slot: u64,
}
#[event]
pub struct SellOrderCancelled { pub id: u64, pub seller: Pubkey, pub amount_returned: u64, pub slot: u64 }

// Errors
#[error_code]
pub enum SellOrderError {
    #[msg("Amount must be > 0")] InvalidAmount,
    #[msg("Price must be > 0")] InvalidPrice,
    #[msg("Order is not open")] OrderNotOpen,
    #[msg("Order is fully filled")] OrderFullyFilled,
    #[msg("Unauthorized")] Unauthorized,
    #[msg("Arithmetic overflow")] Overflow,
}
