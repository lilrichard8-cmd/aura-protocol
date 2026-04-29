use anchor_lang::prelude::*;

/// Maximum memo URI length
pub const MAX_MEMO_URI_LEN: usize = 200;

// === Events ===

#[event]
pub struct GiftSent {
    pub coin_mint: Pubkey,
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub memo_uri: String,
    pub slot: u64,
}

// === Errors ===

#[error_code]
pub enum GiftError {
    #[msg("Amount must be greater than 0")]
    InvalidAmount,
    #[msg("Memo URI too long")]
    MemoTooLong,
    #[msg("Token mint mismatch")]
    MintMismatch,
    #[msg("Unauthorized")]
    Unauthorized,
}
