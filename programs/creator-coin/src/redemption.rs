use anchor_lang::prelude::*;

/// 7 days in slots (~400ms per slot): 7 * 24 * 60 * 60 * 1000 / 400 = 1,512,000
pub const AUTO_CONFIRM_SLOTS: u64 = 1_512_000;
/// Max URI length
pub const MAX_URI_LEN: usize = 200;

// === Account Structures ===

#[account]
pub struct RedemptionCounter {
    pub coin_mint: Pubkey,  // 32
    pub count: u64,         // 8
    pub bump: u8,           // 1
}

impl RedemptionCounter {
    pub const SIZE: usize = 8 + 32 + 8 + 1;
}

#[account]
pub struct Redemption {
    pub id: u64,                        // 8
    pub coin_mint: Pubkey,              // 32
    pub benefit_id: u32,                // 4
    pub cost: u64,                      // 8
    pub buyer: Pubkey,                  // 32
    pub creator: Pubkey,                // 32
    pub status: RedemptionStatus,       // 1
    pub created_at_slot: u64,           // 8
    pub delivered_at_slot: Option<u64>, // 1 + 8
    pub confirmed_at_slot: Option<u64>, // 1 + 8
    pub disputed_at_slot: Option<u64>,  // 1 + 8
    pub delivery_note_uri: String,      // 4 + 200
    pub delivery_note_hash: [u8; 32],   // 32
    pub dispute_reason_uri: String,     // 4 + 200
    pub dispute_reason_hash: [u8; 32],  // 32
    pub bump: u8,                       // 1
}

impl Redemption {
    pub const SIZE: usize = 8 + 8 + 32 + 4 + 8 + 32 + 32 + 1 + 8 + 9 + 9 + 9
        + (4 + MAX_URI_LEN) + 32 + (4 + MAX_URI_LEN) + 32 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum RedemptionStatus {
    PendingDelivery,
    Delivered,
    Confirmed,
    Disputed,
}

// === Events ===

#[event]
pub struct RedemptionInitiated {
    pub id: u64,
    pub coin_mint: Pubkey,
    pub buyer: Pubkey,
    pub benefit_id: u32,
    pub cost: u64,
    pub slot: u64,
}

#[event]
pub struct RedemptionDelivered {
    pub id: u64,
    pub note_uri: String,
    pub slot: u64,
}

#[event]
pub struct RedemptionConfirmed {
    pub id: u64,
    pub by_auto: bool,
    pub slot: u64,
}

#[event]
pub struct RedemptionDisputed {
    pub id: u64,
    pub reason_uri: String,
    pub slot: u64,
}

// === Errors ===

#[error_code]
pub enum RedemptionError {
    #[msg("Benefit not found or inactive")]
    BenefitNotFound,
    #[msg("Benefit is not consumable type")]
    NotConsumable,
    #[msg("Cost does not match benefit threshold")]
    CostMismatch,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Cannot redeem own creator coin")]
    CannotRedeemOwnCoin,
    #[msg("Invalid status transition")]
    InvalidStatusTransition,
    #[msg("Auto-confirm period not elapsed (7 days)")]
    AutoConfirmTooEarly,
    #[msg("URI too long")]
    UriTooLong,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Arithmetic overflow")]
    Overflow,
}
