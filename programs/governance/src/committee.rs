// [whitepaper-sync v1.1] §15 elections
// =============================================================================
// Committee Seats, Semi-Annual Elections, and Recall (WP v1.1 §15.2 + §15.3-§15.4)
// =============================================================================
//
// Implements the on-chain skeleton for the AURA committee governance system
// described in Whitepaper v1.1 §15.2 and Numbers Handbook §14:
//
//   • 5 committees (Technical, Operations, Development, Content, Arbitration)
//   • 7 seats per committee → 35 total seats
//   • Semi-annual elections (every 6 months / TERM_LENGTH_SECS)
//   • Community-initiated recall with 2/3 supermajority (per WP §15.2 recall
//     paragraph; the WP cites 60%, but Søren's task spec mandates 2/3 / 6667
//     bps — RECALL_THRESHOLD_BPS is a configurable constant so the threshold
//     can be re-tuned without a contract redeploy when the Constitutional
//     Amendment Process clarifies the number).
//
// Phase gating (per WP §15.1 progressive decentralization):
//   • Year 1: PROGRAM_ADMIN gates `open_election`. Community calls revert.
//   • Year 2-3: PROGRAM_ADMIN flips `GovernanceConfig.elections_enabled = true`;
//     community can call open_election, but the 3-of-7 community / 4-of-7 admin
//     split for Development & Operations described in WP §15.2 is enforced
//     off-chain (the on-chain pipeline only ranks votes and seats the winner).
//   • Year 3+: same `elections_enabled = true` gate; full community elections.
//
// Vote-weight model (Phase 1):
//   The whitepaper specifies vote_weight = √(staked ORA) capped at 10,000
//   (mirrors `MAX_VOTE_WEIGHT` in `lib.rs`). The on-chain enforcement of that
//   formula requires a snapshot of the voter's `StakeAccount` from the staking
//   program at election open time. Doing that fully on-chain costs an extra
//   CPI into the staking program per vote and a snapshot account per
//   (election, voter); we punt that to Batch 6 (election-snapshot program).
//
//   For Phase 1 we accept caller-supplied `vote_weight` and rely on the
//   off-chain SDK to compute √(stake). Each `ElectionVote` PDA is recorded
//   so a future audit/slashing layer can re-verify against the staking
//   program's StakeAccount at `Election.opens_at`. This is the same pragmatic
//   approach used in `vote_on_proposal` (which already trusts the ATA balance
//   at vote time).
//
//   Candidacy minimum stake follows the same model: the candidate's
//   ORA-staked balance is verified by SDK / off-chain indexer at registration
//   time; on-chain we record `candidate.candidate_stake_at_registration` as a
//   self-declared snapshot, again awaiting Batch 6 for full enforcement.
//
// Audit-style invariants enforced on-chain (Phase 1):
//   • Election opens / closes / finalize are time-gated by `Clock`.
//   • One vote per (election, voter): `ElectionVote` PDA seeded by both.
//   • One recall vote per (proposal, voter): same pattern.
//   • Recalled seat cannot be voted on for additional recalls (`recalled` flag).
//   • `open_election` PROGRAM_ADMIN-gated until `elections_enabled` flips.
//
// All net-new code in this file is tagged `[whitepaper-sync v1.1] §15 elections`.
// =============================================================================

use anchor_lang::prelude::*;

use crate::{CommitteeType, ErrorCode, GovernanceConfig, PROGRAM_ADMIN};

// =============================================================================
// Constants
// =============================================================================

/// [whitepaper-sync v1.1] §15 elections — WP §15.2 mandates 5 committees.
pub const COMMITTEE_COUNT: u8 = 5;
/// [whitepaper-sync v1.1] §15 elections — WP §15.2 mandates 7 seats / committee.
pub const SEATS_PER_COMMITTEE: u8 = 7;

/// [whitepaper-sync v1.1] §15 elections — semi-annual terms, ~6 months.
pub const TERM_LENGTH_SECS: i64 = 6 * 30 * 24 * 3600;
/// [whitepaper-sync v1.1] §15 elections — WP §15.2 voting window: 7 days.
pub const ELECTION_WINDOW_SECS: i64 = 7 * 24 * 3600;
/// [whitepaper-sync v1.1] §15 elections — WP §15.2 candidacy registration window: 3 days.
/// (WP cites 7-day nomination period; the task spec mandates 3 days. The
/// constant is named so the gap is auditable; tightening to 7 days is a
/// single-constant change.)
pub const CANDIDACY_WINDOW_SECS: i64 = 3 * 24 * 3600;

/// [whitepaper-sync v1.1] §15 elections — recall supermajority: 2/3 = 6667 bps.
/// WP §15.2 cites 60% (6000 bps); task spec mandates 6667 bps. Kept as a
/// constant so a future Tier I amendment can re-tune without a redeploy.
pub const RECALL_THRESHOLD_BPS: u16 = 6667;
/// [whitepaper-sync v1.1] §15 elections — recall voting window: 7 days.
pub const RECALL_VOTING_WINDOW_SECS: i64 = 7 * 24 * 3600;

/// [whitepaper-sync v1.1] §15 elections — minimum ORA stake (in raw lamports
/// with 9-decimal mint) required to register as a candidate or to initiate a
/// recall proposal. Mirrors `staking::MIN_STAKE_AMOUNT = 1_000 ORA` (Numbers
/// Handbook §14 staking floor). NOT the WP §15.2 ≥10,000 ORA nomination
/// threshold — that gate is enforced off-chain in Phase 1; the on-chain
/// floor here is a lighter "spam shield" pending the Batch-6 snapshot
/// integration.
pub const STAKING_MIN_FOR_CANDIDACY: u64 = 1_000u64 * 1_000_000_000;

// =============================================================================
// Account Structures
// =============================================================================

/// [whitepaper-sync v1.1] §15 elections — One on-chain record per
/// (committee, seat_index). Seeded by `[b"committee-seat", committee, seat_index]`
/// so the PDA is stable across elections and a single seat's history can be
/// indexed by anyone.
#[account]
pub struct CommitteeSeat {
    pub committee: CommitteeType,  // 1
    pub seat_index: u8,            // 1   (0..SEATS_PER_COMMITTEE)
    pub holder: Pubkey,            // 32  (default = vacant)
    pub elected_at: i64,           // 8
    pub term_ends_at: i64,         // 8
    pub recalled: bool,            // 1
    pub bump: u8,                  // 1
}

impl CommitteeSeat {
    pub const SIZE: usize = 8 + 1 + 1 + 32 + 8 + 8 + 1 + 1;
}

/// [whitepaper-sync v1.1] §15 elections — One election per `(committee, seat_index)`
/// per term. Each election has its own monotonic `election_id` to disambiguate
/// re-elections / by-elections on the same seat.
///
/// [audit fix R6-GE-1] Added `top_votes_candidate` (current leader's PDA) and
/// `secondary_top_stake` (lowest stake among candidates currently tied at
/// top_votes) so finalize can verify global-max + WP §15.2 tie-break
/// (lower stake wins) on-chain instead of trusting the caller.
#[account]
pub struct Election {
    pub election_id: u64,       // 8
    pub committee: CommitteeType, // 1
    pub seat_index: u8,         // 1
    pub opens_at: i64,          // 8  (candidacy opens)
    pub candidacy_closes_at: i64, // 8 (candidacy closes; voting opens)
    pub closes_at: i64,         // 8  (voting closes)
    pub candidates_count: u32,  // 4
    pub votes_total: u64,       // 8
    pub winner: Pubkey,         // 32 (default until finalize)
    pub top_votes: u64,         // 8  (running max for incremental tally)
    pub finalized: bool,        // 1
    pub bump: u8,               // 1
    // [audit fix R6-GE-1] global-max + tie-break support
    pub top_votes_candidate: Pubkey, // 32 — Candidate PDA currently at top_votes
    pub secondary_top_stake: u64,    // 8  — lowest stake among current top_votes-ties
}

impl Election {
    pub const SIZE: usize =
        8 + 8 + 1 + 1 + 8 + 8 + 8 + 4 + 8 + 32 + 8 + 1 + 1
        + 32 // top_votes_candidate
        + 8; // secondary_top_stake
}

/// [whitepaper-sync v1.1] §15 elections — One per (election, candidate).
#[account]
pub struct Candidate {
    pub election: Pubkey,                       // 32
    pub candidate: Pubkey,                      // 32
    pub votes_received: u64,                    // 8
    pub candidate_stake_at_registration: u64,   // 8  (self-declared snapshot)
    pub registered_at: i64,                     // 8
    pub bump: u8,                               // 1
}

impl Candidate {
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 1;
}

/// [whitepaper-sync v1.1] §15 elections — One per (election, voter); prevents
/// double-voting (the `init` constraint reverts on re-submission).
#[account]
pub struct ElectionVote {
    pub election: Pubkey,    // 32
    pub voter: Pubkey,       // 32
    pub candidate: Pubkey,   // 32
    pub vote_weight: u64,    // 8
    pub cast_at: i64,        // 8
    pub bump: u8,            // 1
}

impl ElectionVote {
    pub const SIZE: usize = 8 + 32 + 32 + 32 + 8 + 8 + 1;
}

/// [whitepaper-sync v1.1] §15 elections — Community-initiated recall.
#[account]
pub struct RecallProposal {
    pub proposal_id: u64,        // 8
    pub committee_seat: Pubkey,  // 32
    pub initiator: Pubkey,       // 32
    pub opens_at: i64,           // 8
    pub closes_at: i64,          // 8
    pub votes_for_recall: u64,   // 8
    pub votes_against: u64,      // 8
    pub finalized: bool,         // 1
    pub recall_threshold_bps: u16, // 2 (snapshot at proposal open time)
    pub reason_uri: String,      // 4 + ≤200
    pub bump: u8,                // 1
}

impl RecallProposal {
    /// 200 bytes is the same `reason_uri` cap used by `Dispute.evidence_uri`.
    pub const MAX_REASON_URI: usize = 200;
    pub const SIZE: usize = 8 + 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 2 + 4 + Self::MAX_REASON_URI + 1;
}

/// [whitepaper-sync v1.1] §15 elections — One vote per (recall_proposal, voter).
#[account]
pub struct RecallVote {
    pub proposal: Pubkey,    // 32
    pub voter: Pubkey,       // 32
    pub support: bool,       // 1  (true = recall, false = keep)
    pub vote_weight: u64,    // 8
    pub cast_at: i64,        // 8
    pub bump: u8,            // 1
}

impl RecallVote {
    pub const SIZE: usize = 8 + 32 + 32 + 1 + 8 + 8 + 1;
}

/// [whitepaper-sync v1.1] §15 elections — Per-program counters for monotonic
/// election_id / recall proposal_id allocation. Lives at a single PDA.
#[account]
pub struct CommitteeRegistry {
    pub next_election_id: u64,        // 8
    pub next_recall_proposal_id: u64, // 8
    pub bump: u8,                     // 1
}

impl CommitteeRegistry {
    pub const SIZE: usize = 8 + 8 + 8 + 1;
}

// =============================================================================
// Errors (committee-scoped, additive — does not perturb existing ErrorCode)
// =============================================================================

#[error_code]
pub enum CommitteeError {
    #[msg("Elections are not enabled (Phase 1: PROGRAM_ADMIN gated)")]
    ElectionsDisabled,
    #[msg("Seat index out of range (must be < SEATS_PER_COMMITTEE)")]
    SeatIndexOutOfRange,
    #[msg("Existing seat term has not ended yet")]
    SeatTermActive,
    #[msg("Candidacy window has closed")]
    CandidacyClosed,
    #[msg("Voting window has not opened")]
    VotingNotOpen,
    #[msg("Voting window has closed")]
    VotingClosed,
    #[msg("Voting window has not closed")]
    VotingNotClosed,
    #[msg("Election is already finalized")]
    ElectionAlreadyFinalized,
    #[msg("Election has no candidates to seat")]
    ElectionNoCandidates,
    #[msg("Candidate stake below STAKING_MIN_FOR_CANDIDACY")]
    InsufficientCandidacyStake,
    #[msg("Initiator stake below STAKING_MIN_FOR_CANDIDACY")]
    InsufficientInitiatorStake,
    #[msg("Vote weight must be non-zero")]
    InvalidVoteWeight,
    #[msg("Committee seat is already recalled")]
    SeatAlreadyRecalled,
    #[msg("Committee seat is vacant; nothing to recall")]
    SeatVacant,
    #[msg("Recall proposal voting window has closed")]
    RecallClosed,
    #[msg("Recall proposal voting window has not closed")]
    RecallNotClosed,
    #[msg("Recall proposal is already finalized")]
    RecallAlreadyFinalized,
    #[msg("Reason URI exceeds 200 bytes")]
    ReasonUriTooLong,
    #[msg("Mismatched election/candidate/seat references")]
    MismatchedAccounts,
    #[msg("Arithmetic overflow")]
    CommitteeOverflow,
    // [audit fix M-GE-1 verified] `Unauthorized` removed from CommitteeError
    // — callers use parent ErrorCode::Unauthorized for SDK error-decoder
    // consistency across modules (single discriminant for "unauthorized
    // caller" everywhere in governance).
}

// =============================================================================
// Events
// =============================================================================

#[event] pub struct ElectionOpened    { pub election_id: u64, pub committee: u8, pub seat_index: u8, pub opens_at: i64, pub closes_at: i64 }
#[event] pub struct CandidateRegistered { pub election_id: u64, pub candidate: Pubkey, pub registered_at: i64 }
#[event] pub struct ElectionVoteCast  { pub election_id: u64, pub voter: Pubkey, pub candidate: Pubkey, pub vote_weight: u64 }
#[event] pub struct ElectionFinalized { pub election_id: u64, pub winner: Pubkey, pub votes: u64 }
#[event] pub struct RecallProposed    { pub proposal_id: u64, pub committee_seat: Pubkey, pub initiator: Pubkey }
#[event] pub struct RecallVoteCast    { pub proposal_id: u64, pub voter: Pubkey, pub support: bool, pub vote_weight: u64 }
#[event] pub struct RecallFinalized   { pub proposal_id: u64, pub recalled: bool, pub votes_for: u64, pub votes_against: u64 }

// =============================================================================
// Context structs
// =============================================================================

/// [whitepaper-sync v1.1] §15 elections — One-time init of the program's
/// election/recall counter PDA. PROGRAM_ADMIN-gated.
#[derive(Accounts)]
pub struct InitCommitteeRegistry<'info> {
    #[account(
        init,
        payer = admin,
        space = CommitteeRegistry::SIZE,
        seeds = [b"committee-registry"],
        bump,
    )]
    pub committee_registry: Account<'info, CommitteeRegistry>,
    #[account(mut, address = PROGRAM_ADMIN @ ErrorCode::Unauthorized)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// [whitepaper-sync v1.1] §15 elections — Toggle the `elections_enabled` gate.
/// Mirrors `set_arbitration_enabled`. PROGRAM_ADMIN-only.
#[derive(Accounts)]
pub struct SetElectionsEnabled<'info> {
    #[account(mut, seeds = [b"governance_config"], bump = governance_config.bump)]
    pub governance_config: Account<'info, GovernanceConfig>,
    #[account(address = PROGRAM_ADMIN @ ErrorCode::Unauthorized)]
    pub admin: Signer<'info>,
}

/// [whitepaper-sync v1.1] §15 elections — Open a new election for a given
/// (committee, seat_index). Phase 1: PROGRAM_ADMIN-only. Phase 2+: any caller
/// once `governance_config.elections_enabled = true`. The caller passes the
/// committee discriminant byte for PDA seeding alongside the typed enum
/// value; the handler cross-checks `committee_disc ==
/// committee.discriminant()` and `committee_seat.committee == committee`.
#[derive(Accounts)]
#[instruction(committee_disc: u8, seat_index: u8)]
pub struct OpenElection<'info> {
    #[account(mut, seeds = [b"committee-registry"], bump = committee_registry.bump)]
    pub committee_registry: Account<'info, CommitteeRegistry>,
    #[account(seeds = [b"governance_config"], bump = governance_config.bump)]
    pub governance_config: Account<'info, GovernanceConfig>,
    #[account(
        init,
        payer = caller,
        space = Election::SIZE,
        seeds = [b"election", committee_registry.next_election_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub election: Account<'info, Election>,
    /// The CommitteeSeat PDA must already exist (created via
    /// `init_committee_seat`). Seed binds (discriminant_byte, seat_index).
    #[account(
        seeds = [b"committee-seat".as_ref(), &[committee_disc][..], &[seat_index][..]],
        bump = committee_seat.bump,
        constraint = committee_seat.seat_index == seat_index @ CommitteeError::SeatIndexOutOfRange,
    )]
    pub committee_seat: Account<'info, CommitteeSeat>,
    #[account(mut)] pub caller: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// [whitepaper-sync v1.1] §15 elections — One-time PDA init for each
/// (committee, seat_index). PROGRAM_ADMIN gated. Caller supplies the 1-byte
/// committee discriminant directly so Anchor can use it inline as a PDA seed.
#[derive(Accounts)]
#[instruction(committee_disc: u8, seat_index: u8)]
pub struct InitCommitteeSeat<'info> {
    #[account(
        init,
        payer = admin,
        space = CommitteeSeat::SIZE,
        seeds = [b"committee-seat".as_ref(), &[committee_disc][..], &[seat_index][..]],
        bump,
    )]
    pub committee_seat: Account<'info, CommitteeSeat>,
    #[account(mut, address = PROGRAM_ADMIN @ ErrorCode::Unauthorized)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// [whitepaper-sync v1.1] §15 elections — Register a candidate during the
/// candidacy window.
#[derive(Accounts)]
#[instruction(declared_stake: u64)]
pub struct RegisterCandidate<'info> {
    #[account(mut)] pub election: Account<'info, Election>,
    // [audit fix R5 H-GE-2] governance_config required so the handler can
    // assert `elections_enabled = true` before any self-declared stake is
    // accepted into a candidate slot.
    #[account(seeds = [b"governance_config"], bump = governance_config.bump)]
    pub governance_config: Account<'info, GovernanceConfig>,
    #[account(
        init,
        payer = candidate,
        space = Candidate::SIZE,
        seeds = [b"candidate", election.key().as_ref(), candidate.key().as_ref()],
        bump,
    )]
    pub candidate_account: Account<'info, Candidate>,
    #[account(mut)] pub candidate: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// [whitepaper-sync v1.1] §15 elections — Cast a vote for a candidate. Vote
/// weight is caller-supplied in Phase 1; see module-level note on the
/// Batch-6 snapshot plan.
#[derive(Accounts)]
#[instruction(vote_weight: u64)]
pub struct CastElectionVote<'info> {
    #[account(mut)] pub election: Account<'info, Election>,
    // [audit fix R5 H-GE-1] governance_config required so the handler can
    // gate vote casting on `elections_enabled = true`.
    #[account(seeds = [b"governance_config"], bump = governance_config.bump)]
    pub governance_config: Account<'info, GovernanceConfig>,
    #[account(
        mut,
        seeds = [b"candidate", election.key().as_ref(), candidate_account.candidate.as_ref()],
        bump = candidate_account.bump,
        constraint = candidate_account.election == election.key() @ CommitteeError::MismatchedAccounts,
    )]
    pub candidate_account: Account<'info, Candidate>,
    #[account(
        init,
        payer = voter,
        space = ElectionVote::SIZE,
        seeds = [b"election-vote", election.key().as_ref(), voter.key().as_ref()],
        bump,
    )]
    pub election_vote: Account<'info, ElectionVote>,
    #[account(mut)] pub voter: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// [whitepaper-sync v1.1] §15 elections — Close voting, declare winner, seat them.
#[derive(Accounts)]
pub struct FinalizeElection<'info> {
    #[account(mut)] pub election: Account<'info, Election>,
    /// The Candidate PDA whose `votes_received == election.top_votes`. Caller
    /// is responsible for selecting and passing the winning candidate; the
    /// instruction verifies the votes match `top_votes` (no other candidate
    /// can beat the running max).
    #[account(
        seeds = [b"candidate", election.key().as_ref(), winning_candidate.candidate.as_ref()],
        bump = winning_candidate.bump,
        constraint = winning_candidate.election == election.key() @ CommitteeError::MismatchedAccounts,
    )]
    pub winning_candidate: Account<'info, Candidate>,
    /// The seat PDA matching `(election.committee, election.seat_index)`.
    /// We can't pre-derive its seed inside `seeds = […]` (Anchor doesn't
    /// expand method calls), so the handler verifies
    /// `seat.committee == election.committee && seat.seat_index == election.seat_index`.
    #[account(mut)]
    pub committee_seat: Account<'info, CommitteeSeat>,
    pub caller: Signer<'info>,
}

/// [whitepaper-sync v1.1] §15 elections — Propose a recall against an
/// occupied seat. Initiator must declare ≥ STAKING_MIN_FOR_CANDIDACY stake.
#[derive(Accounts)]
#[instruction(declared_stake: u64, reason_uri: String)]
pub struct ProposeRecall<'info> {
    #[account(mut, seeds = [b"committee-registry"], bump = committee_registry.bump)]
    pub committee_registry: Account<'info, CommitteeRegistry>,
    // [audit fix R5 H-GE-3] governance_config required so the handler can
    // gate recall proposals on `elections_enabled = true`.
    #[account(seeds = [b"governance_config"], bump = governance_config.bump)]
    pub governance_config: Account<'info, GovernanceConfig>,
    pub committee_seat: Account<'info, CommitteeSeat>,
    #[account(
        init,
        payer = initiator,
        space = RecallProposal::SIZE,
        seeds = [b"recall", committee_registry.next_recall_proposal_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub recall_proposal: Account<'info, RecallProposal>,
    #[account(mut)] pub initiator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// [whitepaper-sync v1.1] §15 elections — Vote on an active recall proposal.
#[derive(Accounts)]
#[instruction(support: bool, vote_weight: u64)]
pub struct VoteRecall<'info> {
    #[account(mut)] pub recall_proposal: Account<'info, RecallProposal>,
    #[account(
        init,
        payer = voter,
        space = RecallVote::SIZE,
        seeds = [b"recall-vote", recall_proposal.key().as_ref(), voter.key().as_ref()],
        bump,
    )]
    pub recall_vote: Account<'info, RecallVote>,
    #[account(mut)] pub voter: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// [whitepaper-sync v1.1] §15 elections — Finalize a recall. If the 2/3
/// supermajority threshold is met, the targeted `CommitteeSeat.recalled` is
/// flipped to true. Re-election (open_election) re-fills the seat.
#[derive(Accounts)]
pub struct FinalizeRecall<'info> {
    #[account(mut)] pub recall_proposal: Account<'info, RecallProposal>,
    #[account(
        mut,
        constraint = committee_seat.key() == recall_proposal.committee_seat @ CommitteeError::MismatchedAccounts,
    )]
    pub committee_seat: Account<'info, CommitteeSeat>,
    pub caller: Signer<'info>,
}

// =============================================================================
// Helpers
// =============================================================================

impl CommitteeType {
    /// [whitepaper-sync v1.1] §15 elections — stable 1-byte discriminant for
    /// PDA seeding. Anchor enums' to_le_bytes is not stable; this keeps the
    /// committee->seat PDA seed deterministic.
    pub fn discriminant(&self) -> u8 {
        match self {
            CommitteeType::Development  => 0,
            CommitteeType::Content      => 1,
            CommitteeType::Operations   => 2,
            CommitteeType::Arbitration  => 3,
            CommitteeType::Technical    => 4,
        }
    }
}
