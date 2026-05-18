//! Bounty V2 — on-chain bounty system with multi-winner support and dual-token escrow.
//!
//! Economic model (mirrors a buy-order in spirit):
//!   1. Sponsor (creator of the bounty) locks reward tokens into a PDA-owned escrow.
//!   2. Anyone may submit work (BountySubmission PDA, one per submitter).
//!   3. Sponsor awards 1..=MAX_WINNERS submissions, partial amounts allowed,
//!      total awarded ≤ total_reward. Each award routes 95% to winner and
//!      5% to protocol (2% burn / 2% staking / 0.5% gas / 0.5% ops).
//!   4. Unawarded remainder is refundable to sponsor after `close_bounty`
//!      or `refund_expired` (post-deadline, 100% refund, no protocol fee).
//!
//! Token modes:
//!   - **ORA mode** (any user): payment_token = ORA mint, full 5% fee split applies.
//!     Burn goes to ORA mint, others to ORA-denominated treasury accounts.
//!   - **USDC mode** (official authority only): payment_token = USDC mint.
//!     5% fee is split 0% burn / 4% staking / 0.5% gas / 0.5% ops
//!     (USDC cannot be burned by us; we keep the equivalent in staking).
//!
//! `is_official` is gated by the `OfficialBountyAuthority` PDA, which is
//! initialised once by the program admin and stores the trusted signer
//! (the AURA Foundation multisig at mainnet).

use anchor_lang::prelude::*;

// ─── Constants ──────────────────────────────────────────────────────────────

/// Max winners per bounty (product requirement).
pub const MAX_BOUNTY_WINNERS: u8 = 10;

/// Min award size. Set to 20 (=1/500 inverse of 5% fee bps) so the fee never
/// rounds to zero. [audit fix L-1] Previously was 1, which let dust awards
/// evade protocol fees entirely.
pub const MIN_AWARD_AMOUNT: u64 = 20;

/// [audit fix round2 R2-BV2-M1] Grace period (in seconds) added to `deadline`
/// before `refund_expired` can be called. Solana validator clock can drift
/// up to ~10 minutes from real time; this buffer absorbs the common case so
/// in-flight submissions landing right around the deadline aren't orphaned
/// by a refund-keeper race.
pub const REFUND_BUFFER_SECONDS: i64 = 60;

/// Title / metadata length caps.
pub const BOUNTY_TITLE_MAX: usize = 80;
pub const BOUNTY_URI_MAX: usize = 200;
pub const SUBMISSION_URI_MAX: usize = 200;

/// Protocol fee split — ORA mode (matches sell_order / buy_order).
/// 5% total = 200 burn + 200 staking + 50 gas + 50 ops bps.
pub const ORA_FEE_BPS: u64 = 500;
pub const ORA_BURN_BPS: u64 = 200;
pub const ORA_STAKING_BPS: u64 = 200;
pub const ORA_GAS_BPS: u64 = 50;
pub const ORA_OPS_BPS: u64 = 50;

/// Protocol fee split — USDC mode (no burn possible).
/// 5% total = 400 staking + 50 gas + 50 ops bps. Burn rerouted to staking.
pub const USDC_FEE_BPS: u64 = 500;
pub const USDC_STAKING_BPS: u64 = 400;
pub const USDC_GAS_BPS: u64 = 50;
pub const USDC_OPS_BPS: u64 = 50;

// ─── Accounts ───────────────────────────────────────────────────────────────

/// Singleton config. Stores the trusted authority allowed to create
/// official (USDC-denominated) bounties.
#[account]
pub struct OfficialBountyAuthority {
    /// Wallet (or multisig) that signs official bounties.
    pub authority: Pubkey,
    /// Program admin who set this authority. Can rotate via `set_official_authority`.
    pub admin: Pubkey,
    pub bump: u8,
}
impl OfficialBountyAuthority {
    pub const SIZE: usize = 8 + 32 + 32 + 1;
    pub const SEED: &'static [u8] = b"bounty-official-authority";
}

/// Per-bounty counter PDA, scoped by sponsor. Lets a sponsor create
/// multiple bounties without title collisions.
#[account]
pub struct BountyCounter {
    pub sponsor: Pubkey,
    pub count: u64,
    pub bump: u8,
}
impl BountyCounter {
    pub const SIZE: usize = 8 + 32 + 8 + 1;
    pub const SEED: &'static [u8] = b"bounty-counter";
}

#[account]
pub struct BountyV2 {
    /// Monotonic id within sponsor's counter.
    pub id: u64,
    /// Wallet that created and funded the bounty.
    pub sponsor: Pubkey,
    /// True iff created by `OfficialBountyAuthority` (USDC allowed).
    pub is_official: bool,
    /// Mint of the locked reward token (ORA or USDC).
    pub payment_mint: Pubkey,
    /// PDA-owned escrow ATA holding the locked reward.
    pub escrow_account: Pubkey,
    /// Original total reward locked at create time.
    pub total_reward: u64,
    /// Sum of award amounts already paid out (including protocol fees).
    /// Always increases, never decreases.
    pub awarded_amount: u64,
    /// Sum refunded to sponsor on close / expire (post-state).
    pub refunded_amount: u64,
    /// Max distinct submissions that may be awarded. 1..=MAX_BOUNTY_WINNERS.
    pub max_winners: u8,
    /// How many submissions have been awarded so far.
    pub winners_awarded: u8,
    /// Free-form submission count (informational, capped at u32::MAX).
    /// [audit fix L-2] Widened from u16 to u32.
    pub submission_count: u32,
    /// Unix-seconds deadline. After this, sponsor cannot award; anyone can refund.
    pub deadline: i64,
    pub status: BountyStatus,
    /// Off-chain metadata pointer (title, full brief, attachments).
    pub metadata_uri: String,
    /// Short title — convenience for indexers; full brief lives in metadata_uri.
    pub title: String,
    pub created_at: i64,
    pub bump: u8,
}
impl BountyV2 {
    // Discriminator(8) + id(8) + sponsor(32) + is_official(1) + payment_mint(32)
    // + escrow(32) + total(8) + awarded(8) + refunded(8) + max_winners(1)
    // + winners_awarded(1) + submission_count(4) + deadline(8) + status(1)
    // + metadata_uri (4 + 200) + title (4 + 80) + created_at(8) + bump(1)
    pub const SIZE: usize = 8 + 8 + 32 + 1 + 32 + 32 + 8 + 8 + 8 + 1 + 1 + 4
        + 8 + 1 + (4 + BOUNTY_URI_MAX) + (4 + BOUNTY_TITLE_MAX) + 8 + 1;
    pub const SEED: &'static [u8] = b"bounty-v2";
}

#[account]
pub struct BountySubmission {
    pub bounty: Pubkey,
    pub submitter: Pubkey,
    pub content_uri: String,
    pub submitted_at: i64,
    pub status: SubmissionStatus,
    /// Net amount transferred to submitter when awarded (95% of award_amount).
    pub awarded_amount: u64,
    pub bump: u8,
}
impl BountySubmission {
    pub const SIZE: usize = 8 + 32 + 32 + (4 + SUBMISSION_URI_MAX) + 8 + 1 + 8 + 1;
    pub const SEED: &'static [u8] = b"bounty-submission";
}

// ─── Enums ──────────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum BountyStatus {
    /// Accepting submissions and awards.
    Open,
    /// Sponsor closed early; remaining funds refunded.
    Closed,
    /// All `max_winners` slots filled OR total_reward exhausted.
    FullyAwarded,
    /// Deadline passed, no awards made, refunded to sponsor.
    Expired,
    /// Sponsor cancelled before any submission. Full refund.
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum SubmissionStatus {
    Pending,
    Awarded,
    Rejected,
}

// ─── Events ─────────────────────────────────────────────────────────────────

#[event]
pub struct BountyCreated {
    pub bounty: Pubkey,
    pub sponsor: Pubkey,
    pub is_official: bool,
    pub payment_mint: Pubkey,
    pub total_reward: u64,
    pub max_winners: u8,
    pub deadline: i64,
    pub slot: u64,
}

#[event]
pub struct BountySubmissionPosted {
    pub bounty: Pubkey,
    pub submission: Pubkey,
    pub submitter: Pubkey,
    pub slot: u64,
}

#[event]
pub struct BountyAwarded {
    pub bounty: Pubkey,
    pub submission: Pubkey,
    pub winner: Pubkey,
    pub gross_amount: u64,
    pub net_to_winner: u64,
    pub burn_amount: u64,
    pub staking_amount: u64,
    pub gas_amount: u64,
    pub ops_amount: u64,
    pub winners_so_far: u8,
    pub remaining_reward: u64,
    pub slot: u64,
}

#[event]
pub struct BountyClosed {
    pub bounty: Pubkey,
    pub refunded: u64,
    pub reason: u8, // 0=closed_by_sponsor, 1=expired_refund, 2=cancelled, 3=fully_awarded
    pub slot: u64,
}

// ─── Errors ─────────────────────────────────────────────────────────────────

#[error_code]
pub enum BountyV2Error {
    #[msg("Reward must be > 0")] InvalidReward,
    #[msg("max_winners must be in 1..=10")] InvalidMaxWinners,
    #[msg("Deadline must be in the future")] InvalidDeadline,
    #[msg("Title exceeds 80 chars")] TitleTooLong,
    #[msg("Metadata URI exceeds 200 chars")] MetadataUriTooLong,
    #[msg("Submission URI exceeds 200 chars")] SubmissionUriTooLong,
    #[msg("Bounty is not open")] BountyNotOpen,
    #[msg("Bounty deadline has passed")] BountyExpired,
    #[msg("Bounty deadline has not yet passed")] BountyNotYetExpired,
    #[msg("All winner slots are filled")] WinnerSlotsExhausted,
    #[msg("Award would exceed total reward")] RewardExhausted,
    #[msg("Payment mint mismatch (non-official bounties must use ORA)")] PaymentMintNotOra,
    #[msg("USDC bounties are not yet supported in this release")] UsdcNotYetSupported,
    #[msg("Bounty escrow account does not match the bounty's stored escrow")] EscrowAccountMismatch,
    #[msg("Winner token account owner must match submission.submitter")] WinnerOwnerMismatch,
    #[msg("Cannot operate on a terminal-state bounty")] BountyTerminalState,
    #[msg("Bounty is not in FullyAwarded state")] BountyNotFullyAwarded,
    #[msg("Award amount below minimum")] AwardTooSmall,
    #[msg("Submission already finalised")] SubmissionAlreadyFinalised,
    #[msg("Cannot cancel: submissions already exist")] CannotCancelWithSubmissions,
    #[msg("Awards already made — must close instead of cancel")] CannotCancelAfterAward,
    #[msg("USDC bounties require the official authority signature")] OfficialAuthorityRequired,
    #[msg("Submission's bounty mismatch")] SubmissionBountyMismatch,
    #[msg("Unauthorized")] Unauthorized,
    #[msg("Arithmetic overflow")] Overflow,
}
