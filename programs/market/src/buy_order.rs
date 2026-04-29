use anchor_lang::prelude::*;
use crate::sell_order::OrderStatus;

#[account]
pub struct BuyOrderCounter {
    pub coin_mint: Pubkey,
    pub count: u64,
    pub bump: u8,
}
impl BuyOrderCounter {
    pub const SIZE: usize = 8 + 32 + 8 + 1;
}

#[account]
pub struct BuyOrder {
    pub id: u64,
    pub coin_mint: Pubkey,
    pub buyer: Pubkey,
    pub amount_wanted: u64,
    pub amount_filled: u64,
    pub price_per_coin_lamports: u64,
    pub ora_locked_lamports: u64,
    pub created_at_slot: u64,
    pub status: OrderStatus,
    pub bump: u8,
}
impl BuyOrder {
    pub const SIZE: usize = 8 + 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 1;
}

// Events
#[event]
pub struct BuyOrderPlaced { pub id: u64, pub coin_mint: Pubkey, pub buyer: Pubkey, pub amount_wanted: u64, pub price_per_coin_lamports: u64, pub ora_locked: u64, pub slot: u64 }
#[event]
pub struct BuyOrderFilled {
    pub id: u64,
    pub seller: Pubkey,
    pub fill_amount: u64,
    pub total_cost: u64,
    pub fee: u64,
    /// [audit fix M-6] true when this fill closed out the order; false on partial fill
    pub fully_filled: bool,
    pub remaining_after: u64,
    pub slot: u64,
}
#[event]
pub struct BuyOrderCancelled { pub id: u64, pub buyer: Pubkey, pub ora_returned: u64, pub slot: u64 }

// Errors
#[error_code]
pub enum BuyOrderError {
    #[msg("Amount must be > 0")] InvalidAmount,
    #[msg("Price must be > 0")] InvalidPrice,
    #[msg("Order is not open")] OrderNotOpen,
    #[msg("Order is fully filled")] OrderFullyFilled,
    #[msg("Unauthorized")] Unauthorized,
    #[msg("Arithmetic overflow")] Overflow,
}
