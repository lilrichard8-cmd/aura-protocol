use anchor_lang::prelude::*;

/// Maximum number of benefits per creator coin
pub const MAX_BENEFITS: usize = 50;
/// Maximum URI length for benefit metadata
pub const MAX_URI_LEN: usize = 200;

// === Account Structures ===

#[account]
pub struct BenefitsList {
    pub coin_mint: Pubkey,          // 32
    pub creator: Pubkey,            // 32
    pub benefits: Vec<Benefit>,     // 4 + (N * Benefit::SIZE)
    pub next_id: u32,               // 4
    pub bump: u8,                   // 1
}

impl BenefitsList {
    /// Base space without benefits vec content
    pub const BASE_SIZE: usize = 8 + 32 + 32 + 4 + 4 + 1;
    /// Max space with 50 benefits
    pub const MAX_SIZE: usize = Self::BASE_SIZE + (MAX_BENEFITS * Benefit::SIZE);
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub struct Benefit {
    pub id: u32,                    // 4
    pub benefit_type: BenefitType,  // 1
    pub threshold: u64,             // 8 (hold = threshold; consumable = redemption cost)
    pub metadata_uri: String,       // 4 + MAX_URI_LEN
    pub metadata_hash: [u8; 32],    // 32
    pub is_active: bool,            // 1
}

impl Benefit {
    pub const SIZE: usize = 4 + 1 + 8 + (4 + MAX_URI_LEN) + 32 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum BenefitType {
    Holding,     // hold-to-enjoy: just hold >= threshold CC
    Consumable,  // pay-to-redeem: burn/consume threshold CC to get benefit
}

// === Events ===

#[event]
pub struct BenefitsListInitialized {
    pub coin_mint: Pubkey,
    pub creator: Pubkey,
    pub slot: u64,
}

#[event]
pub struct BenefitAdded {
    pub coin_mint: Pubkey,
    pub benefit_id: u32,
    pub benefit_type: BenefitType,
    pub threshold: u64,
    pub metadata_uri: String,
    pub slot: u64,
}

#[event]
pub struct BenefitUpdated {
    pub coin_mint: Pubkey,
    pub benefit_id: u32,
    pub slot: u64,
}

#[event]
pub struct BenefitDeactivated {
    pub coin_mint: Pubkey,
    pub benefit_id: u32,
    pub slot: u64,
}

// === Errors ===

#[error_code]
pub enum BenefitsError {
    #[msg("Invalid threshold (must be > 0)")]
    InvalidThreshold,
    #[msg("Metadata URI too long")]
    UriTooLong,
    #[msg("Maximum benefits limit reached (50)")]
    MaxBenefitsReached,
    #[msg("Benefit not found")]
    BenefitNotFound,
    #[msg("Benefit is already inactive")]
    BenefitInactive,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Arithmetic overflow")]
    Overflow,
}
