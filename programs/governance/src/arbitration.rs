use anchor_lang::prelude::*;

/// Max arbitrators in the registry
pub const MAX_ARBITRATORS: usize = 200;
/// Min ORA stake to be an arbitrator (10,000 ORA with 9 decimals)
pub const MIN_STAKE_LAMPORTS: u64 = 10_000 * 1_000_000_000;
/// Trial 1 jury size
pub const TRIAL1_JURY_SIZE: usize = 5;
/// Trial 2 panel size
pub const TRIAL2_PANEL_SIZE: usize = 7;
/// Appeal window: 7 days in slots
pub const APPEAL_WINDOW_SLOTS: u64 = 1_512_000;
/// Trial deadline: 14 days in slots
pub const TRIAL_DEADLINE_SLOTS: u64 = 3_024_000;
/// Absence penalty: 30 days in slots
pub const ABSENCE_PENALTY_SLOTS: u64 = 6_480_000;
/// Earnings escrow: 60 days in slots
pub const EARNINGS_ESCROW_SLOTS: u64 = 12_960_000;
/// Min ARS for trial 2
pub const MIN_ARS_TRIAL2: u64 = 100;

// === Account Structures ===

#[account]
pub struct ArbitratorRegistry {
    pub arbitrators: Vec<Arbitrator>,
    pub total_pool_size: u32,
    pub bump: u8,
}

impl ArbitratorRegistry {
    pub const MAX_SIZE: usize = 8 + 4 + (MAX_ARBITRATORS * Arbitrator::SIZE) + 4 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Arbitrator {
    pub user: Pubkey,                       // 32
    pub ars: u64,                           // 8 (Arbitration Reputation Score)
    pub staked_ora_lamports: u64,           // 8
    pub joined_at_slot: u64,               // 8
    pub is_in_other_committee: bool,       // 1
    pub last_penalty_slot: Option<u64>,    // 9
    pub excluded_until_slot: Option<u64>,  // 9
}

impl Arbitrator {
    pub const SIZE: usize = 32 + 8 + 8 + 8 + 1 + 9 + 9;
}

#[account]
pub struct ArbitrationDispute {
    pub id: u64,
    pub redemption_id: u64,
    pub coin_mint: Pubkey,
    pub plaintiff: Pubkey,
    pub defendant: Pubkey,
    pub filed_at_slot: u64,
    pub status: DisputeStatus,

    pub trial1_jury: [Pubkey; 5],
    pub trial1_rulings: Vec<JurorRuling>,
    pub trial1_deadline_slot: u64,
    pub trial1_outcome: Option<Ruling>,
    pub trial1_concluded_at_slot: Option<u64>,

    pub trial2_panel: Option<[Pubkey; 7]>,
    pub trial2_rulings: Vec<JurorRuling>,
    pub trial2_deadline_slot: Option<u64>,
    pub trial2_outcome: Option<Ruling>,

    pub appeal_deadline_slot: Option<u64>,
    pub bump: u8,
}

impl ArbitrationDispute {
    // Approximate max size
    pub const SIZE: usize = 8 + 8 + 8 + 32 + 32 + 32 + 8 + 1
        + (32 * 5)  // trial1_jury
        + 4 + (5 * JurorRuling::SIZE) // trial1_rulings vec
        + 8 // trial1_deadline
        + (1 + Ruling::SIZE) // trial1_outcome Option
        + 9 // trial1_concluded_at Option
        + (1 + 32 * 7) // trial2_panel Option
        + 4 + (7 * JurorRuling::SIZE) // trial2_rulings vec
        + 9 // trial2_deadline Option
        + (1 + Ruling::SIZE) // trial2_outcome Option
        + 9 // appeal_deadline Option
        + 1; // bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct JurorRuling {
    pub juror: Pubkey,          // 32
    pub vote: Ruling,           // varies
    pub reasoning_uri: String,  // 4 + 200
    pub submitted_at_slot: u64, // 8
}

impl JurorRuling {
    pub const SIZE: usize = 32 + Ruling::SIZE + (4 + 200) + 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum Ruling {
    ReleaseToCreator,
    RefundBuyer,
    Split { creator_share_bps: u16 },
}

impl Ruling {
    pub const SIZE: usize = 1 + 2; // enum discriminant + max variant data
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum DisputeStatus {
    Filed,
    Trial1JurySelected,
    Trial1Pending,
    Trial1Concluded,
    Trial2PanelSelected,
    Trial2Pending,
    Resolved,
    Dissolved,
    EarningsAutoReleased,
}

#[account]
pub struct ArbitrationGovernance {
    pub phase: ArbitrationPhase,
    pub core_team_multisig: Pubkey,
    pub transition_at_slot: u64,
    pub dispute_count: u64,
    pub bump: u8,
}

impl ArbitrationGovernance {
    pub const SIZE: usize = 8 + 1 + 32 + 8 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum ArbitrationPhase {
    Year1Bootstrap,
    FullCommunity,
}

// === Weight function per whitepaper ===

/// Weight function for jury selection (VRF weighted random)
pub fn arbitrator_weight(ars: u64) -> u64 {
    if ars < 50 {
        1
    } else if ars <= 200 {
        ars / 50
    } else {
        // 4 + ln(ars - 200) — integer approximation
        let excess = ars.saturating_sub(200);
        if excess == 0 { return 4; }
        // Simple integer log approximation: log2(x) / log2(e) ≈ log2(x) * 0.693
        let log2_val = 63u64.saturating_sub(excess.leading_zeros() as u64);
        4 + log2_val
    }
}

// === ARS rewards/penalties ===
pub const ARS_TRIAL1_COMPLETE: i64 = 10;
pub const ARS_RULING_WITH_MAJORITY: i64 = 5;
pub const ARS_TRIAL2_COMPLETE: i64 = 15;
pub const ARS_TRIAL2_NOT_OVERTURNED: i64 = 10;
pub const ARS_CONFLICT_HIDDEN: i64 = -50;
pub const ARS_ABSENCE: i64 = -20;
pub const ARS_OBVIOUS_BIAS: i64 = -30;

// === Errors ===

#[error_code]
pub enum ArbitrationError {
    #[msg("Insufficient ORA stake (min 10,000)")] InsufficientStake,
    #[msg("Already registered as arbitrator")] AlreadyRegistered,
    #[msg("Not registered as arbitrator")] NotRegistered,
    #[msg("Arbitrator is excluded")] ArbitratorExcluded,
    #[msg("Arbitrator is in another committee")] InOtherCommittee,
    #[msg("Registry full")] RegistryFull,
    #[msg("Invalid dispute status")] InvalidDisputeStatus,
    #[msg("Not a juror for this trial")] NotAJuror,
    #[msg("Already submitted ruling")] AlreadyRuled,
    #[msg("Appeal window expired")] AppealWindowExpired,
    #[msg("Appeal window not expired")] AppealWindowNotExpired,
    #[msg("Trial deadline not reached")] TrialNotDeadlined,
    #[msg("Insufficient arbitrators for panel")] InsufficientArbitrators,
    #[msg("Unauthorized")] Unauthorized,
    #[msg("Overflow")] Overflow,
    #[msg("URI too long")] UriTooLong,
}

// === Events ===

#[event] pub struct ArbitratorRegistered { pub user: Pubkey, pub slot: u64 }
#[event] pub struct DisputeFiled { pub id: u64, pub redemption_id: u64, pub plaintiff: Pubkey, pub slot: u64 }
#[event] pub struct Trial1JurySelected { pub dispute_id: u64, pub jury: [Pubkey; 5], pub slot: u64 }
#[event] pub struct Trial1RulingSubmitted { pub dispute_id: u64, pub juror: Pubkey, pub slot: u64 }
#[event] pub struct Trial1Finalized { pub dispute_id: u64, pub outcome: Ruling, pub slot: u64 }
#[event] pub struct Trial2PanelSelected { pub dispute_id: u64, pub panel: [Pubkey; 7], pub slot: u64 }
#[event] pub struct DisputeResolved { pub dispute_id: u64, pub outcome: Ruling, pub slot: u64 }
