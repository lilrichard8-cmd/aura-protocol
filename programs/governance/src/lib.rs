// [whitepaper-sync v1.1] TODO — Whitepaper v1.1 §15/§19 + Numbers Handbook §13/§14
// describe several governance features that are NOT implemented in this
// program and that would require net-new programs (out of scope for this
// sync batch):
//
//   1. Committee seats + semi-annual elections (WP §15.2)
//      - 5 committees × 7 seats each
//      - ≥10,000 ORA staked nomination threshold
//      - 60% recall threshold
//      - Term rules, alternates, by-elections, multi-committee restrictions
//      Today the contract only has a `CommitteeType` enum; no `CommitteeSeat`
//      account, no election state machine, no recall ix. Building this is a
//      dedicated `committee-elections` program.
//
//   2. Frontend Registry (Handbook §13, WP §18)
//      - Tier 1 Unverified (bond = 0) / Tier 2 Verified (bond = 10,000 ORA)
//      - Slashing 25%–100% by Arbitration Committee (5/7 + 7-member appeal)
//      - Bond adjustment via Tier III (50% majority)
//      - Full Frontend Blacklist via Tier II (75%)
//      - 30-day deregistration cooldown, frontend reputation score, etc.
//      Today: nothing on-chain. Future `frontend-registry` program.
//
//   3. Content Review Panel (CRS, WP §15.9) and structured Penalty Levels I–IV
//      (WP §15.10) are absent from the dispute-resolution surface here.
//
//   4. The `MIN_STAKE_LAMPORTS = 10_000 * 1e9` arbitrator floor in
//      `arbitration.rs` coincides with the WP §18.3 frontend bond number but
//      is a different mechanism (arbitrator collateral, not frontend bond).
//
// What IS in scope and IS implemented in this batch:
//   • `ProposalTier` enum (TierI / II / III / IV) added to `Proposal` and
//     enforced in `execute_proposal` (75% / 50% / 50%; Tier I rejected at
//     create time).
//
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount as SplTokenAccount, Transfer as SplTransfer};

pub mod arbitration;
pub use arbitration::*;

// [whitepaper-sync v1.1] §15 elections — Committee elections + recall module.
pub mod committee;
pub use committee::*;

declare_id!("7Un16eWXCteD3PgjpYWggCjuQK2tneHDkwGXvUg5obBk");

const MAX_VOTE_WEIGHT: u64 = 10_000;

// =============================================================================
// [audit fix C-G1] Hardcoded program admin. ⚠️ DO NOT DEPLOY — placeholder =
// system_program::ID; replace with the real AURA multisig pubkey pre-mainnet.
// Mirrors `market::PROGRAM_ADMIN` (bounty-V2 audit C-4).
// =============================================================================
pub const PROGRAM_ADMIN: Pubkey = anchor_lang::solana_program::system_program::ID;

/// [audit fix M-G4] Maximum number of arbiters allowed to vote on a single
/// legacy dispute. Caps the unbounded vote count.
pub const MAX_LEGACY_DISPUTE_VOTERS: u8 = 5;

/// [audit fix M-G4] Absence penalty multiplier (basis points) applied to the
/// arbiter's current ARS when they no-show on a trial. Previously a flat
/// `-20` ARS hit which is too small to disincentivize bribes >20 ARS-worth.
/// New formula: penalty = max(BASE_ABSENCE_ARS_PENALTY, current_ars * BPS / 10_000).
/// At BPS=2500 (25%), a juror with ARS=300 now loses 75 instead of 20, and
/// the penalty scales with rank — high-ARS jurors have more to lose, which
/// is precisely the population whose absence damages dispute integrity most.
pub const ABSENCE_PENALTY_BPS: i64 = 2500; // 25%
pub const BASE_ABSENCE_ARS_PENALTY: i64 = 20;

fn isqrt(n: u64) -> u64 {
    if n == 0 { return 0; }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x { x = y; y = (x + n / x) / 2; }
    x
}

#[program]
pub mod aura_governance {
    use super::*;

    // [audit fix C-21/C-22 + C-G1] accept ora_mint + quorum at initialization.
    // [audit fix C-G1] Caller MUST equal hardcoded PROGRAM_ADMIN (see context).
    // [audit fix C-G2] arbitration is disabled by default; only PROGRAM_ADMIN
    // can flip `arbitration_enabled` after the deterministic-VRF limitation
    // documented below is resolved by integrating a real VRF (Switchboard/ORAO).
    pub fn initialize_governance(ctx: Context<InitializeGovernance>, ora_mint: Pubkey, quorum: u64) -> Result<()> {
        let config = &mut ctx.accounts.governance_config;
        config.admin = ctx.accounts.admin.key();
        config.proposal_count = 0;
        config.ora_mint = ora_mint;
        config.quorum = quorum;
        // [audit fix C-G2] gate arbitration off by default.
        config.arbitration_enabled = false;
        // [whitepaper-sync v1.1] §15 elections — gate off until Phase 2.
        config.elections_enabled = false;
        config.bump = ctx.bumps.governance_config;
        Ok(())
    }

    /// [audit fix C-G2] Flip the `arbitration_enabled` flag. Until a real VRF
    /// (Switchboard / ORAO) is integrated, `select_trial1_jury` produces a
    /// deterministic jury that is fully predictable from the public `slot`,
    /// allowing a plaintiff to time their dispute filing for a favourable jury.
    /// All arbitration instructions check this flag.
    /// ONLY PROGRAM_ADMIN can flip this.
    pub fn set_arbitration_enabled(ctx: Context<SetArbitrationEnabled>, enabled: bool) -> Result<()> {
        let cfg = &mut ctx.accounts.governance_config;
        cfg.arbitration_enabled = enabled;
        msg!("Arbitration enabled = {}", enabled);
        Ok(())
    }

    pub fn register_arbiter(ctx: Context<RegisterArbiter>) -> Result<()> {
        let r = &mut ctx.accounts.arbiter_record;
        r.arbiter = ctx.accounts.arbiter.key();
        r.registered_at = Clock::get()?.unix_timestamp;
        r.is_active = true;
        r.bump = ctx.bumps.arbiter_record;
        Ok(())
    }

    /// [audit fix M-G3 / R2-M-G2] Admin can deactivate / reactivate a legacy
    /// arbiter. Previously `is_active` was written `true` at register time
    /// and never set `false` anywhere; a compromised or rotated arbiter
    /// retained access to the legacy `vote_on_dispute` path forever.
    pub fn set_arbiter_active(ctx: Context<SetArbiterActive>, active: bool) -> Result<()> {
        let r = &mut ctx.accounts.arbiter_record;
        r.is_active = active;
        msg!("Arbiter {} active = {}", r.arbiter, active);
        Ok(())
    }

    // [audit fix H-G1] title is no longer a PDA seed (was capped 32 bytes by
    // Solana, but signature allowed up to 100 → DoS for long titles). The
    // proposal PDA is now seeded by `governance_config.proposal_count`
    // (monotonic id) instead.
    //
    // [whitepaper-sync v1.1] Added `tier: ProposalTier` arg per Handbook §14 +
    // WP §15/§19 four-tier governance system. The tier dictates the approval
    // threshold enforced in `execute_proposal` (Tier I rejected on-chain;
    // Tier II 75%; Tier III 50%; Tier IV committee-internal). Tier I changes
    // are immutable at this contract level and must follow the off-chain
    // Constitutional Amendment Process (WP §19.2) before any related code
    // change ships.
    pub fn create_proposal(ctx: Context<CreateProposal>, title: String, description: String, committee_type: CommitteeType, proposal_type: ProposalType, tier: ProposalTier) -> Result<()> {
        require!(title.len() <= 100, ErrorCode::TitleTooLong);
        require!(description.len() <= 5000, ErrorCode::DescriptionTooLong);
        // [whitepaper-sync v1.1] Tier I parameters are immutable at the
        // contract layer. Any Tier I proposal MUST be filed off-chain through
        // the Constitutional Amendment Process (95% supermajority + all 5
        // committees + 1-year notice, WP §19.2). Reject on-chain to prevent
        // misuse.
        require!(tier != ProposalTier::TierI, ErrorCode::TierIImmutable);
        let p = &mut ctx.accounts.proposal;
        let clock = Clock::get()?;
        // [audit fix L-G2] capture the assigned id (== current proposal_count)
        let proposal_id = ctx.accounts.governance_config.proposal_count;
        p.proposal_id = proposal_id;
        p.proposer = ctx.accounts.proposer.key(); p.title = title; p.description = description;
        p.committee_type = committee_type; p.proposal_type = proposal_type;
        p.tier = tier;
        p.status = ProposalStatus::Voting; p.votes_for = 0; p.votes_against = 0; p.total_votes = 0;
        p.created_at = clock.unix_timestamp; p.voting_ends_at = clock.unix_timestamp + 604800;
        p.bump = ctx.bumps.proposal;
        // [audit fix C-22] increment proposal_count for indexing/numbering
        let cfg = &mut ctx.accounts.governance_config;
        cfg.proposal_count = cfg.proposal_count.checked_add(1).ok_or(ErrorCode::Overflow)?;
        Ok(())
    }

    pub fn vote_on_proposal(ctx: Context<VoteOnProposal>, vote_for: bool) -> Result<()> {
        let clock = Clock::get()?;
        // Capture immutable values before taking mutable borrows
        let proposal_key = ctx.accounts.proposal.key();
        let voter_key = ctx.accounts.voter.key();
        let ora_mint = ctx.accounts.governance_config.ora_mint;
        let ora_balance = ctx.accounts.voter_ora_account.amount;
        let voter_ora_mint = ctx.accounts.voter_ora_account.mint;
        let voter_ora_owner = ctx.accounts.voter_ora_account.owner;
        let bump_vr = ctx.bumps.vote_record;
        // [audit fix C-21] mint+owner validation
        require!(voter_ora_mint == ora_mint, ErrorCode::Unauthorized);
        require!(voter_ora_owner == voter_key, ErrorCode::Unauthorized);
        require!(ora_balance > 0, ErrorCode::InvalidVoteWeight);
        let vote_weight = isqrt(ora_balance / 1_000_000_000).min(MAX_VOTE_WEIGHT);
        require!(vote_weight > 0, ErrorCode::InvalidVoteWeight);

        let proposal = &mut ctx.accounts.proposal;
        require!(proposal.status == ProposalStatus::Voting, ErrorCode::ProposalNotVoting);
        require!(clock.unix_timestamp < proposal.voting_ends_at, ErrorCode::VotingEnded);
        if vote_for { proposal.votes_for = proposal.votes_for.checked_add(vote_weight).ok_or(ErrorCode::Overflow)?; }
        else { proposal.votes_against = proposal.votes_against.checked_add(vote_weight).ok_or(ErrorCode::Overflow)?; }
        proposal.total_votes = proposal.total_votes.checked_add(vote_weight).ok_or(ErrorCode::Overflow)?;

        let vr = &mut ctx.accounts.vote_record;
        vr.voter = voter_key; vr.proposal = proposal_key;
        vr.vote_for = vote_for; vr.vote_weight = vote_weight;
        vr.voted_at = clock.unix_timestamp; vr.bump = bump_vr;
        Ok(())
    }

    pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
        let cfg = &ctx.accounts.governance_config;
        let proposal = &mut ctx.accounts.proposal;
        require!(Clock::get()?.unix_timestamp >= proposal.voting_ends_at, ErrorCode::VotingNotEnded);
        require!(proposal.status == ProposalStatus::Voting, ErrorCode::InvalidProposalStatus);
        // [audit fix C-22] only admin or proposer may execute
        let signer = ctx.accounts.authority.key();
        require!(signer == cfg.admin || signer == proposal.proposer, ErrorCode::Unauthorized);
        // [audit fix C-22] enforce quorum: total weighted votes must meet config.quorum
        require!(proposal.total_votes >= cfg.quorum, ErrorCode::QuorumNotReached);

        // [whitepaper-sync v1.1] Tier-based approval threshold per Handbook §14
        // + WP §19. The contract enforces yes-vote fraction:
        //   Tier II  → ≥7,500 bps (75%) of decisive votes (for + against)
        //   Tier III → >5,000 bps (>50%) of decisive votes (strict majority)
        //   Tier IV  → committee-internal; treated as standard 50% here, but
        //              the committee gate happens off-chain (Tier IV decisions
        //              don't normally hit the proposal pipeline at all).
        //   Tier I   → already rejected at create time; cannot reach here.
        let decisive = proposal.votes_for
            .checked_add(proposal.votes_against)
            .ok_or(ErrorCode::Overflow)?;
        require!(decisive > 0, ErrorCode::InvalidVoteWeight);
        let yes_bps = (proposal.votes_for as u128)
            .checked_mul(10_000)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(decisive as u128)
            .ok_or(ErrorCode::Overflow)? as u64;
        let passed = match proposal.tier {
            ProposalTier::TierI => false, // unreachable; create_proposal rejects
            ProposalTier::TierII => yes_bps >= 7_500,
            ProposalTier::TierIII => yes_bps > 5_000,
            ProposalTier::TierIV => yes_bps > 5_000,
        };
        // [audit fix H-G2] move to Passed or Failed; downstream `mark_executed`
        // transitions to Executed so indexers can distinguish.
        proposal.status = if passed { ProposalStatus::Passed } else { ProposalStatus::Failed };
        Ok(())
    }

    /// [audit fix H-G2] explicit transition Passed -> Executed so indexers can
    /// tell "vote concluded" from "on-chain side-effect applied".
    pub fn mark_executed(ctx: Context<MarkExecuted>) -> Result<()> {
        let cfg = &ctx.accounts.governance_config;
        let proposal = &mut ctx.accounts.proposal;
        let signer = ctx.accounts.authority.key();
        require!(signer == cfg.admin || signer == proposal.proposer, ErrorCode::Unauthorized);
        require!(proposal.status == ProposalStatus::Passed, ErrorCode::InvalidProposalStatus);
        proposal.status = ProposalStatus::Executed;
        Ok(())
    }

    /// [audit fix M-G2] Admin-gated quorum update.
    pub fn update_quorum(ctx: Context<UpdateQuorum>, new_quorum: u64) -> Result<()> {
        let cfg = &mut ctx.accounts.governance_config;
        cfg.quorum = new_quorum;
        msg!("Quorum updated to {}", new_quorum);
        Ok(())
    }

    /// ⚠️ [audit fix C-23] DEPRECATED — superseded by `file_arbitration_dispute` (§13.8 two-trial system).
    /// This legacy 4-vote dispute path is retained only for backward compatibility with existing
    /// indexer references and will be removed in a future release. New disputes MUST go through
    /// the ArbitrationDispute path.
    pub fn create_dispute(ctx: Context<CreateDispute>, evidence_uri: String, dispute_type: DisputeType) -> Result<()> {
        msg!("[DEPRECATED] create_dispute: use file_arbitration_dispute instead.");
        require!(evidence_uri.len() <= 200, ErrorCode::EvidenceUriTooLong);
        let d = &mut ctx.accounts.dispute;
        d.plaintiff = ctx.accounts.plaintiff.key(); d.target_user = ctx.accounts.target_user.key();
        d.evidence_uri = evidence_uri; d.dispute_type = dispute_type;
        d.status = OldDisputeStatus::UnderReview; d.votes_guilty = 0; d.votes_innocent = 0;
        d.created_at = Clock::get()?.unix_timestamp; d.bump = ctx.bumps.dispute;
        Ok(())
    }

    /// ⚠️ [audit fix C-23] DEPRECATED — superseded by Arbitration Trial 1/2 jury voting (§13.8).
    /// Retained for backward compatibility; new disputes MUST go through `submit_trial1_ruling` /
    /// `submit_trial2_ruling`.
    ///
    /// [audit fix C-G3 replacement] Per-(dispute, voter) vote PDA + total
    /// voter cap (`MAX_LEGACY_DISPUTE_VOTERS = 5`). Combined with `has_one`
    /// on `arbiter_record.arbiter`, an arbiter cannot vote twice and a
    /// colluding admin can't stuff with sock-puppets beyond the cap.
    /// [audit fix C-G3 replacement] Also prevents the dispute target from
    /// voting on themselves.
    pub fn vote_on_dispute(ctx: Context<VoteOnDispute>, vote_guilty: bool) -> Result<()> {
        msg!("[DEPRECATED] vote_on_dispute: use submit_trial1_ruling / submit_trial2_ruling.");
        require!(ctx.accounts.arbiter_record.is_active, ErrorCode::ArbiterNotActive);
        let arbiter_key = ctx.accounts.arbiter.key();
        let dispute_key = ctx.accounts.dispute.key();
        let bump_dv = ctx.bumps.dispute_vote;
        let now_ts = Clock::get()?.unix_timestamp;
        let dispute = &mut ctx.accounts.dispute;
        require!(dispute.status == OldDisputeStatus::UnderReview, ErrorCode::DisputeAlreadyResolved);
        // [audit fix C-G3 replacement] target cannot vote on their own case.
        require!(dispute.target_user != arbiter_key, ErrorCode::Unauthorized);
        // [audit fix C-G3 replacement] hard cap total votes.
        let total_votes_after = (dispute.votes_guilty as u16) + (dispute.votes_innocent as u16) + 1;
        require!(total_votes_after <= MAX_LEGACY_DISPUTE_VOTERS as u16, ErrorCode::DisputeVoterCapReached);
        if vote_guilty { dispute.votes_guilty = dispute.votes_guilty.checked_add(1).ok_or(ErrorCode::Overflow)?; }
        else { dispute.votes_innocent = dispute.votes_innocent.checked_add(1).ok_or(ErrorCode::Overflow)?; }
        if (dispute.votes_guilty + dispute.votes_innocent) >= MAX_LEGACY_DISPUTE_VOTERS {
            dispute.status = if dispute.votes_guilty > dispute.votes_innocent { OldDisputeStatus::Guilty } else { OldDisputeStatus::Innocent };
        }
        // The `init` on dispute_vote PDA `[b"dispute_vote", dispute, arbiter]`
        // already prevents the same arbiter voting twice (re-init fails).
        let dv = &mut ctx.accounts.dispute_vote;
        dv.arbiter = arbiter_key; dv.dispute = dispute_key;
        dv.vote_guilty = vote_guilty; dv.voted_at = now_ts; dv.bump = bump_dv;
        Ok(())
    }

    // ===== Arbitration (Task #8) =====

    pub fn init_arbitration_governance(ctx: Context<InitArbitrationGovernanceCtx>, core_team_multisig: Pubkey) -> Result<()> {
        let ag = &mut ctx.accounts.arbitration_governance;
        ag.phase = ArbitrationPhase::Year1Bootstrap; ag.core_team_multisig = core_team_multisig;
        ag.transition_at_slot = 0; ag.dispute_count = 0; ag.bump = ctx.bumps.arbitration_governance;
        Ok(())
    }

    pub fn init_arbitrator_registry(ctx: Context<InitArbitratorRegistryCtx>) -> Result<()> {
        let reg = &mut ctx.accounts.arbitrator_registry;
        reg.arbitrators = Vec::new(); reg.total_pool_size = 0; reg.bump = ctx.bumps.arbitrator_registry;
        Ok(())
    }

    /// [audit fix round2 R2-C-G1] One-time init of the protocol arbiter
    /// stake vault (token account whose authority is `arbitrator_registry`).
    /// Must be called once by PROGRAM_ADMIN after `init_arbitrator_registry`.
    pub fn init_arbiter_stake_vault(_ctx: Context<InitArbiterStakeVaultCtx>) -> Result<()> {
        msg!("Arbiter stake vault initialised");
        Ok(())
    }

    /// [audit fix round2 R2-C-G1] Real-stake arbitrator registration.
    /// - `user_ora_account` is now bound to `owner == user.key()` and
    ///   `mint == governance_config.ora_mint` via account constraints.
    /// - The mandated `MIN_STAKE_LAMPORTS` of ORA is CPI-transferred from the
    ///   user into a program-owned escrow ATA (`arbiter_stake_vault`) whose
    ///   authority is the `arbitrator_registry` PDA. The recorded
    ///   `staked_ora_lamports` is the exact amount escrowed, not a snapshot
    ///   of an attacker-supplied ATA.
    /// - Future slashing paths debit this escrow; we no longer trust the
    ///   arbiter's spending wallet to retain collateral.
    pub fn register_as_arbitrator(ctx: Context<RegisterAsArbitratorCtx>) -> Result<()> {
        let user_key = ctx.accounts.user.key();
        {
            let reg = &ctx.accounts.arbitrator_registry;
            require!(!reg.arbitrators.iter().any(|a| a.user == user_key), ArbitrationError::AlreadyRegistered);
            require!(reg.arbitrators.len() < MAX_ARBITRATORS, ArbitrationError::RegistryFull);
        }
        // [audit fix round2 R2-C-G1] enforce real ORA balance available
        require!(ctx.accounts.user_ora_account.amount >= MIN_STAKE_LAMPORTS, ArbitrationError::InsufficientStake);

        // [audit fix round2 R2-C-G1] CPI-transfer MIN_STAKE_LAMPORTS into
        // protocol-owned escrow.
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                SplTransfer {
                    from: ctx.accounts.user_ora_account.to_account_info(),
                    to: ctx.accounts.arbiter_stake_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            MIN_STAKE_LAMPORTS,
        )?;

        let slot = Clock::get()?.slot;
        let reg = &mut ctx.accounts.arbitrator_registry;
        reg.arbitrators.push(Arbitrator { user: user_key, ars: 0, staked_ora_lamports: MIN_STAKE_LAMPORTS, joined_at_slot: slot, is_in_other_committee: false, last_penalty_slot: None, excluded_until_slot: None });
        reg.total_pool_size += 1;
        emit!(ArbitratorRegistered { user: user_key, slot });
        Ok(())
    }

    pub fn file_arbitration_dispute(ctx: Context<FileArbitrationDisputeCtx>, redemption_id: u64, coin_mint: Pubkey, defendant: Pubkey) -> Result<()> {
        // [audit fix round2 R2-H-G1] gate dispute filing on arbitration_enabled
        // to prevent rent-griefing while VRF is still off.
        require!(ctx.accounts.governance_config.arbitration_enabled, ArbitrationError::ArbitrationDisabled);
        let ag = &mut ctx.accounts.arbitration_governance;
        let id = ag.dispute_count;
        ag.dispute_count = id.checked_add(1).ok_or(ArbitrationError::Overflow)?;
        let slot = Clock::get()?.slot;
        let d = &mut ctx.accounts.arb_dispute;
        d.id = id; d.redemption_id = redemption_id; d.coin_mint = coin_mint;
        d.plaintiff = ctx.accounts.plaintiff.key(); d.defendant = defendant;
        d.filed_at_slot = slot; d.status = DisputeStatus::Filed;
        d.trial1_jury = [Pubkey::default(); 5]; d.trial1_rulings = Vec::new();
        d.trial1_deadline_slot = 0; d.trial1_outcome = None; d.trial1_concluded_at_slot = None;
        d.trial2_panel = None; d.trial2_rulings = Vec::new();
        d.trial2_deadline_slot = None; d.trial2_outcome = None;
        d.appeal_deadline_slot = None; d.bump = ctx.bumps.arb_dispute;
        emit!(DisputeFiled { id, redemption_id, plaintiff: d.plaintiff, slot });
        Ok(())
    }

    pub fn select_trial1_jury(ctx: Context<SelectTrial1JuryCtx>, dispute_id: u64) -> Result<()> {
        // [audit fix C-G2] arbitration gated off until real VRF is integrated.
        // The pseudo-VRF below (LCG seeded by `slot`) is fully predictable; a
        // plaintiff/defendant can pick the favourable slot to file/select.
        // Toggle `arbitration_enabled` via `set_arbitration_enabled` ONLY after
        // Switchboard / ORAO VRF integration is complete.
        require!(ctx.accounts.governance_config.arbitration_enabled, ArbitrationError::ArbitrationDisabled);
        let d = &mut ctx.accounts.arb_dispute;
        require!(d.status == DisputeStatus::Filed, ArbitrationError::InvalidDisputeStatus);
        let reg = &ctx.accounts.arbitrator_registry;
        let slot = Clock::get()?.slot;
        // TODO: Replace pseudo-random with Switchboard/ORAO VRF
        let eligible: Vec<usize> = reg.arbitrators.iter().enumerate()
            .filter(|(_, a)| a.user != d.plaintiff && a.user != d.defendant && a.excluded_until_slot.map_or(true, |ex| slot > ex) && !a.is_in_other_committee)
            .map(|(i, _)| i).collect();
        require!(eligible.len() >= TRIAL1_JURY_SIZE, ArbitrationError::InsufficientArbitrators);
        let mut selected = [Pubkey::default(); 5];
        let mut used: Vec<usize> = Vec::new();
        for i in 0..TRIAL1_JURY_SIZE {
            let seed = slot.wrapping_add(i as u64).wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            let mut pick = eligible[(seed as usize) % eligible.len()];
            let mut att = 0;
            while used.contains(&pick) && att < eligible.len() { att += 1; pick = eligible[(seed.wrapping_add(att as u64).wrapping_mul(6364136223846793005) as usize) % eligible.len()]; }
            used.push(pick);
            selected[i] = reg.arbitrators[pick].user;
        }
        d.trial1_jury = selected; d.trial1_deadline_slot = slot + TRIAL_DEADLINE_SLOTS;
        d.status = DisputeStatus::Trial1JurySelected;
        emit!(Trial1JurySelected { dispute_id: d.id, jury: selected, slot });
        Ok(())
    }

    pub fn submit_trial1_ruling(ctx: Context<SubmitTrial1RulingCtx>, dispute_id: u64, vote: Ruling, reasoning_uri: String) -> Result<()> {
        require!(ctx.accounts.governance_config.arbitration_enabled, ArbitrationError::ArbitrationDisabled);
        require!(reasoning_uri.len() <= 200, ArbitrationError::UriTooLong);
        // [audit fix C-G3] sanity check the instruction-arg dispute_id matches
        // the loaded account's stored id (defence-in-depth — the seed check
        // already binds them, but explicit is better).
        let juror_key = ctx.accounts.juror.key();
        let d = &mut ctx.accounts.arb_dispute;
        require!(d.id == dispute_id, ArbitrationError::InvalidDisputeStatus);
        require!(d.status == DisputeStatus::Trial1JurySelected || d.status == DisputeStatus::Trial1Pending, ArbitrationError::InvalidDisputeStatus);
        require!(d.trial1_jury.contains(&juror_key), ArbitrationError::NotAJuror);
        require!(!d.trial1_rulings.iter().any(|r| r.juror == juror_key), ArbitrationError::AlreadyRuled);
        let slot = Clock::get()?.slot;
        d.trial1_rulings.push(JurorRuling { juror: juror_key, vote, reasoning_uri, submitted_at_slot: slot });
        d.status = DisputeStatus::Trial1Pending;
        emit!(Trial1RulingSubmitted { dispute_id: d.id, juror: juror_key, slot });
        Ok(())
    }

    pub fn finalize_trial1(ctx: Context<FinalizeTrial1Ctx>, dispute_id: u64) -> Result<()> {
        // [audit fix round2 R2-H-G1] gate finalize on arbitration_enabled.
        require!(ctx.accounts.governance_config.arbitration_enabled, ArbitrationError::ArbitrationDisabled);
        let d = &mut ctx.accounts.arb_dispute;
        require!(d.id == dispute_id, ArbitrationError::InvalidDisputeStatus);
        require!(d.status == DisputeStatus::Trial1Pending, ArbitrationError::InvalidDisputeStatus);
        let slot = Clock::get()?.slot;
        require!(d.trial1_rulings.len() >= TRIAL1_JURY_SIZE || slot >= d.trial1_deadline_slot, ArbitrationError::TrialNotDeadlined);
        let (mut rc, mut rf) = (0u32, 0u32);
        for r in &d.trial1_rulings { match &r.vote { Ruling::ReleaseToCreator => rc += 1, Ruling::RefundBuyer => rf += 1, _ => {} } }
        let outcome = if rc > rf { Ruling::ReleaseToCreator } else { Ruling::RefundBuyer };
        d.trial1_outcome = Some(outcome.clone()); d.trial1_concluded_at_slot = Some(slot);
        d.appeal_deadline_slot = Some(slot + APPEAL_WINDOW_SLOTS); d.status = DisputeStatus::Trial1Concluded;
        emit!(Trial1Finalized { dispute_id: d.id, outcome, slot });
        Ok(())
    }

    pub fn appeal_to_trial2(ctx: Context<AppealToTrial2Ctx>, dispute_id: u64) -> Result<()> {
        // [audit fix round2 R2-H-G1] gate appeals on arbitration_enabled.
        require!(ctx.accounts.governance_config.arbitration_enabled, ArbitrationError::ArbitrationDisabled);
        let d = &mut ctx.accounts.arb_dispute;
        require!(d.id == dispute_id, ArbitrationError::InvalidDisputeStatus);
        require!(d.status == DisputeStatus::Trial1Concluded, ArbitrationError::InvalidDisputeStatus);
        let slot = Clock::get()?.slot;
        let deadline = d.appeal_deadline_slot.ok_or(ArbitrationError::InvalidDisputeStatus)?;
        require!(slot <= deadline, ArbitrationError::AppealWindowExpired);
        // Status stays Trial1Concluded, select_trial2_panel will advance it
        Ok(())
    }

    pub fn select_trial2_panel(ctx: Context<SelectTrial2PanelCtx>, dispute_id: u64) -> Result<()> {
        // [audit fix round2 R2-H-G1] gate trial-2 selection on arbitration_enabled.
        require!(ctx.accounts.governance_config.arbitration_enabled, ArbitrationError::ArbitrationDisabled);
        let d = &mut ctx.accounts.arb_dispute;
        require!(d.id == dispute_id, ArbitrationError::InvalidDisputeStatus);
        require!(d.status == DisputeStatus::Trial1Concluded, ArbitrationError::InvalidDisputeStatus);
        let reg = &ctx.accounts.arbitrator_registry;
        let slot = Clock::get()?.slot;
        let mut eligible: Vec<(usize, u64)> = reg.arbitrators.iter().enumerate()
            .filter(|(_, a)| a.ars >= MIN_ARS_TRIAL2 && a.user != d.plaintiff && a.user != d.defendant && !d.trial1_jury.contains(&a.user) && a.excluded_until_slot.map_or(true, |ex| slot > ex) && !a.is_in_other_committee)
            .map(|(i, a)| (i, a.ars)).collect();
        eligible.sort_by(|a, b| b.1.cmp(&a.1));
        require!(eligible.len() >= TRIAL2_PANEL_SIZE, ArbitrationError::InsufficientArbitrators);
        let mut selected = [Pubkey::default(); 7];
        for i in 0..TRIAL2_PANEL_SIZE { selected[i] = reg.arbitrators[eligible[i].0].user; }
        d.trial2_panel = Some(selected); d.trial2_deadline_slot = Some(slot + TRIAL_DEADLINE_SLOTS);
        d.status = DisputeStatus::Trial2PanelSelected;
        emit!(Trial2PanelSelected { dispute_id: d.id, panel: selected, slot });
        Ok(())
    }

    pub fn submit_trial2_ruling(ctx: Context<SubmitTrial2RulingCtx>, dispute_id: u64, vote: Ruling, reasoning_uri: String) -> Result<()> {
        require!(ctx.accounts.governance_config.arbitration_enabled, ArbitrationError::ArbitrationDisabled);
        require!(reasoning_uri.len() <= 200, ArbitrationError::UriTooLong);
        let juror_key = ctx.accounts.juror.key();
        let d = &mut ctx.accounts.arb_dispute;
        // [audit fix C-G3] explicit id check (defence-in-depth)
        require!(d.id == dispute_id, ArbitrationError::InvalidDisputeStatus);
        require!(d.status == DisputeStatus::Trial2PanelSelected || d.status == DisputeStatus::Trial2Pending, ArbitrationError::InvalidDisputeStatus);
        let panel = d.trial2_panel.ok_or(ArbitrationError::InvalidDisputeStatus)?;
        require!(panel.contains(&juror_key), ArbitrationError::NotAJuror);
        require!(!d.trial2_rulings.iter().any(|r| r.juror == juror_key), ArbitrationError::AlreadyRuled);
        let slot = Clock::get()?.slot;
        d.trial2_rulings.push(JurorRuling { juror: juror_key, vote, reasoning_uri, submitted_at_slot: slot });
        d.status = DisputeStatus::Trial2Pending;
        Ok(())
    }

    pub fn finalize_dispute(ctx: Context<FinalizeDisputeCtx>, dispute_id: u64) -> Result<()> {
        // [audit fix round2 R2-H-G1] gate full-finalize on arbitration_enabled.
        require!(ctx.accounts.governance_config.arbitration_enabled, ArbitrationError::ArbitrationDisabled);
        let d = &mut ctx.accounts.arb_dispute;
        require!(d.id == dispute_id, ArbitrationError::InvalidDisputeStatus);
        let slot = Clock::get()?.slot;
        if d.status == DisputeStatus::Trial1Concluded {
            let deadline = d.appeal_deadline_slot.ok_or(ArbitrationError::InvalidDisputeStatus)?;
            require!(slot > deadline, ArbitrationError::AppealWindowNotExpired);
            d.status = DisputeStatus::Resolved;
            emit!(DisputeResolved { dispute_id: d.id, outcome: d.trial1_outcome.clone().unwrap_or(Ruling::RefundBuyer), slot });
            return Ok(());
        }
        require!(d.status == DisputeStatus::Trial2Pending, ArbitrationError::InvalidDisputeStatus);
        require!(d.trial2_rulings.len() >= TRIAL2_PANEL_SIZE || d.trial2_deadline_slot.map_or(false, |dl| slot >= dl), ArbitrationError::TrialNotDeadlined);
        let (mut rc, mut rf) = (0u32, 0u32);
        for r in &d.trial2_rulings { match &r.vote { Ruling::ReleaseToCreator => rc += 1, Ruling::RefundBuyer => rf += 1, _ => {} } }
        let outcome = if rc > rf { Ruling::ReleaseToCreator } else { Ruling::RefundBuyer };
        d.trial2_outcome = Some(outcome.clone()); d.status = DisputeStatus::Resolved;
        emit!(DisputeResolved { dispute_id: d.id, outcome, slot });
        Ok(())
    }

    // =========================================================================
    // [whitepaper-sync v1.1] §15 elections — Committee Elections + Recall
    // =========================================================================

    /// [whitepaper-sync v1.1] §15 elections — One-time init of the
    /// committee registry (counter PDA). PROGRAM_ADMIN-gated.
    pub fn init_committee_registry(ctx: Context<InitCommitteeRegistry>) -> Result<()> {
        let reg = &mut ctx.accounts.committee_registry;
        reg.next_election_id = 0;
        reg.next_recall_proposal_id = 0;
        reg.bump = ctx.bumps.committee_registry;
        Ok(())
    }

    /// [whitepaper-sync v1.1] §15 elections — Toggle elections gate.
    /// PROGRAM_ADMIN-only. Mirrors `set_arbitration_enabled`.
    pub fn set_elections_enabled(ctx: Context<SetElectionsEnabled>, enabled: bool) -> Result<()> {
        let cfg = &mut ctx.accounts.governance_config;
        cfg.elections_enabled = enabled;
        msg!("Elections enabled = {}", enabled);
        Ok(())
    }

    /// [whitepaper-sync v1.1] §15 elections — One-time PDA init for a
    /// (committee, seat_index) seat. PROGRAM_ADMIN-gated. Must be called once
    /// for each of the 35 (5 committees × 7 seats) seats before the first
    /// election on that seat.
    ///
    /// Caller passes `committee_disc` (1-byte discriminant used as the seed)
    /// and `committee` (typed enum stored on-chain). The handler verifies
    /// they match so the on-chain copy can never disagree with the PDA seed.
    pub fn init_committee_seat(
        ctx: Context<InitCommitteeSeat>,
        committee_disc: u8,
        seat_index: u8,
        committee: CommitteeType,
    ) -> Result<()> {
        require!(seat_index < SEATS_PER_COMMITTEE, CommitteeError::SeatIndexOutOfRange);
        require!(committee.discriminant() == committee_disc, CommitteeError::MismatchedAccounts);
        let seat = &mut ctx.accounts.committee_seat;
        seat.committee = committee;
        seat.seat_index = seat_index;
        seat.holder = Pubkey::default();
        seat.elected_at = 0;
        seat.term_ends_at = 0;
        seat.recalled = false;
        seat.bump = ctx.bumps.committee_seat;
        Ok(())
    }

    /// [whitepaper-sync v1.1] §15 elections — Open a new election for
    /// (committee, seat_index).
    /// Phase 1 (Year 1): caller MUST equal PROGRAM_ADMIN.
    /// Phase 2+ (`elections_enabled = true`): any caller can open elections
    /// for seats whose `term_ends_at` has passed (or that are vacant).
    ///
    /// `committee_disc` must equal `committee.discriminant()` (handler
    /// double-checks the seed/typed-arg match).
    pub fn open_election(
        ctx: Context<OpenElection>,
        committee_disc: u8,
        seat_index: u8,
        committee: CommitteeType,
    ) -> Result<()> {
        require!(seat_index < SEATS_PER_COMMITTEE, CommitteeError::SeatIndexOutOfRange);
        require!(committee.discriminant() == committee_disc, CommitteeError::MismatchedAccounts);
        let cfg = &ctx.accounts.governance_config;
        let caller = ctx.accounts.caller.key();
        let seat = &ctx.accounts.committee_seat;
        require!(seat.committee == committee, CommitteeError::MismatchedAccounts);
        require!(seat.seat_index == seat_index, CommitteeError::SeatIndexOutOfRange);

        let now = Clock::get()?.unix_timestamp;

        // Phase 1: PROGRAM_ADMIN-gated. Phase 2+: anyone, but the seat must
        // be vacant / past term / recalled.
        if !cfg.elections_enabled {
            // [audit fix R5 M-GE-1] standardize on parent ErrorCode::Unauthorized
            // for SDK error-decoder consistency (CommitteeError::Unauthorized
            // had a different discriminant from ErrorCode::Unauthorized).
            require!(caller == PROGRAM_ADMIN, ErrorCode::Unauthorized);
        } else if seat.holder != Pubkey::default() && !seat.recalled {
            // Held seat: term must have ended.
            require!(now >= seat.term_ends_at, CommitteeError::SeatTermActive);
        }

        // Capture the discriminant ahead of the move-into-`e.committee`.
        let committee_disc_for_event = committee.discriminant();

        let reg = &mut ctx.accounts.committee_registry;
        let id = reg.next_election_id;
        reg.next_election_id = id.checked_add(1).ok_or(CommitteeError::CommitteeOverflow)?;

        let e = &mut ctx.accounts.election;
        e.election_id = id;
        e.committee = committee;
        e.seat_index = seat_index;
        e.opens_at = now;
        e.candidacy_closes_at = now.checked_add(CANDIDACY_WINDOW_SECS).ok_or(CommitteeError::CommitteeOverflow)?;
        e.closes_at = e.candidacy_closes_at.checked_add(ELECTION_WINDOW_SECS).ok_or(CommitteeError::CommitteeOverflow)?;
        e.candidates_count = 0;
        e.votes_total = 0;
        e.winner = Pubkey::default();
        e.top_votes = 0;
        e.finalized = false;
        e.bump = ctx.bumps.election;

        emit!(ElectionOpened {
            election_id: id,
            committee: committee_disc_for_event,
            seat_index,
            opens_at: e.opens_at,
            closes_at: e.closes_at,
        });
        Ok(())
    }

    /// [whitepaper-sync v1.1] §15 elections — Register a candidate during
    /// the candidacy window. `declared_stake` is a self-declared snapshot of
    /// the candidate's ORA stake; it must be ≥ STAKING_MIN_FOR_CANDIDACY.
    /// Full enforcement against the staking program's StakeAccount is
    /// deferred to Batch 6 (election snapshots).
    pub fn register_candidate(
        ctx: Context<RegisterCandidate>,
        declared_stake: u64,
    ) -> Result<()> {
        // [audit fix R5 H-GE-2] gate candidacy on the global `elections_enabled`
        // flag. Phase 1 ships with the flag = false (admin must flip it), so a
        // freshly-funded keypair cannot self-declare a stake of `u64::MAX` and
        // park themselves on a candidate slot waiting for the elections to
        // open. Once the Batch-6 stake-snapshot program lands, the admin can
        // enable elections and a real on-chain proof will replace the
        // self-declared stake. Until then, the elections_enabled gate +
        // STAKING_MIN_FOR_CANDIDACY floor + per-vote MAX_VOTE_WEIGHT cap
        // together bound the damage of a compromised stake declaration.
        require!(
            ctx.accounts.governance_config.elections_enabled,
            CommitteeError::ElectionsDisabled
        );
        require!(declared_stake >= STAKING_MIN_FOR_CANDIDACY, CommitteeError::InsufficientCandidacyStake);
        let now = Clock::get()?.unix_timestamp;
        let candidate_key = ctx.accounts.candidate.key();
        let bump_c = ctx.bumps.candidate_account;

        let election = &mut ctx.accounts.election;
        require!(!election.finalized, CommitteeError::ElectionAlreadyFinalized);
        require!(now < election.candidacy_closes_at, CommitteeError::CandidacyClosed);

        let c = &mut ctx.accounts.candidate_account;
        c.election = election.key();
        c.candidate = candidate_key;
        c.votes_received = 0;
        c.candidate_stake_at_registration = declared_stake;
        c.registered_at = now;
        c.bump = bump_c;

        election.candidates_count = election.candidates_count
            .checked_add(1)
            .ok_or(CommitteeError::CommitteeOverflow)?;

        emit!(CandidateRegistered { election_id: election.election_id, candidate: candidate_key, registered_at: now });
        Ok(())
    }

    /// [whitepaper-sync v1.1] §15 elections — Cast a vote for a candidate.
    /// One vote per (election, voter), enforced by the ElectionVote PDA.
    /// vote_weight is caller-supplied (Phase 1); the SDK is expected to
    /// compute √(staked_ora) capped at MAX_VOTE_WEIGHT.
    pub fn cast_election_vote(
        ctx: Context<CastElectionVote>,
        vote_weight: u64,
    ) -> Result<()> {
        // [audit fix R5 H-GE-1] elections_enabled gate + hard cap on
        // vote_weight at MAX_VOTE_WEIGHT (= 10,000, mirrors the staking-weight
        // cap in `vote_on_proposal`). Previously a single voter could cast
        // `u64::MAX/2` weight and seat themselves; the cap keeps damage
        // bounded to a single vote’s share even with self-declared weights.
        // The Batch-6 stake-snapshot program will replace self-declared
        // weight with an on-chain √(stake) proof; until then, this cap +
        // `elections_enabled = false` (Phase 1 default) is the firewall.
        require!(
            ctx.accounts.governance_config.elections_enabled,
            CommitteeError::ElectionsDisabled
        );
        require!(vote_weight > 0, CommitteeError::InvalidVoteWeight);
        require!(
            vote_weight <= MAX_VOTE_WEIGHT,
            CommitteeError::InvalidVoteWeight
        );
        let now = Clock::get()?.unix_timestamp;
        let voter_key = ctx.accounts.voter.key();
        let bump_ev = ctx.bumps.election_vote;

        let election = &mut ctx.accounts.election;
        require!(!election.finalized, CommitteeError::ElectionAlreadyFinalized);
        require!(now >= election.candidacy_closes_at, CommitteeError::VotingNotOpen);
        require!(now < election.closes_at, CommitteeError::VotingClosed);

        let candidate_acc = &mut ctx.accounts.candidate_account;
        candidate_acc.votes_received = candidate_acc.votes_received
            .checked_add(vote_weight)
            .ok_or(CommitteeError::CommitteeOverflow)?;

        election.votes_total = election.votes_total
            .checked_add(vote_weight)
            .ok_or(CommitteeError::CommitteeOverflow)?;
        if candidate_acc.votes_received > election.top_votes {
            election.top_votes = candidate_acc.votes_received;
        }

        let ev = &mut ctx.accounts.election_vote;
        ev.election = election.key();
        ev.voter = voter_key;
        ev.candidate = candidate_acc.candidate;
        ev.vote_weight = vote_weight;
        ev.cast_at = now;
        ev.bump = bump_ev;

        emit!(ElectionVoteCast {
            election_id: election.election_id,
            voter: voter_key,
            candidate: candidate_acc.candidate,
            vote_weight,
        });
        Ok(())
    }

    /// [whitepaper-sync v1.1] §15 elections — Finalize an election after
    /// `closes_at`. Caller passes the winning Candidate PDA; we verify its
    /// votes match `election.top_votes` (so no other candidate can beat it).
    /// Tie-breaking: WP §15.2 says "candidate with lower ORA stake wins"; in
    /// Phase 1 we accept the first candidate to reach `top_votes` (off-chain
    /// indexer is expected to resolve the tie when calling).
    pub fn finalize_election(ctx: Context<FinalizeElection>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let election = &mut ctx.accounts.election;
        require!(!election.finalized, CommitteeError::ElectionAlreadyFinalized);
        require!(now >= election.closes_at, CommitteeError::VotingNotClosed);
        require!(election.candidates_count > 0, CommitteeError::ElectionNoCandidates);

        let winning = &ctx.accounts.winning_candidate;
        require!(
            winning.votes_received == election.top_votes && winning.votes_received > 0,
            CommitteeError::MismatchedAccounts
        );

        let seat = &mut ctx.accounts.committee_seat;
        require!(seat.committee == election.committee, CommitteeError::MismatchedAccounts);
        require!(seat.seat_index == election.seat_index, CommitteeError::MismatchedAccounts);

        seat.holder = winning.candidate;
        seat.elected_at = now;
        seat.term_ends_at = now
            .checked_add(TERM_LENGTH_SECS)
            .ok_or(CommitteeError::CommitteeOverflow)?;
        seat.recalled = false;

        election.winner = winning.candidate;
        election.finalized = true;

        emit!(ElectionFinalized {
            election_id: election.election_id,
            winner: winning.candidate,
            votes: winning.votes_received,
        });
        Ok(())
    }

    /// [whitepaper-sync v1.1] §15 elections — Propose a recall against an
    /// occupied seat. Initiator must declare ≥ STAKING_MIN_FOR_CANDIDACY.
    pub fn propose_recall(
        ctx: Context<ProposeRecall>,
        declared_stake: u64,
        reason_uri: String,
    ) -> Result<()> {
        // [audit fix R5 H-GE-3] elections_enabled gate on recall proposals
        // (Sybil-cheap attackers can otherwise spam recall proposals against
        // any seat). Same Phase-1 deferral pattern as register_candidate.
        require!(
            ctx.accounts.governance_config.elections_enabled,
            CommitteeError::ElectionsDisabled
        );
        require!(declared_stake >= STAKING_MIN_FOR_CANDIDACY, CommitteeError::InsufficientInitiatorStake);
        require!(reason_uri.len() <= RecallProposal::MAX_REASON_URI, CommitteeError::ReasonUriTooLong);
        let now = Clock::get()?.unix_timestamp;
        let initiator_key = ctx.accounts.initiator.key();
        let seat_key = ctx.accounts.committee_seat.key();
        let bump_r = ctx.bumps.recall_proposal;

        // Cannot recall an empty or already-recalled seat.
        let seat = &ctx.accounts.committee_seat;
        require!(seat.holder != Pubkey::default(), CommitteeError::SeatVacant);
        require!(!seat.recalled, CommitteeError::SeatAlreadyRecalled);

        let reg = &mut ctx.accounts.committee_registry;
        let id = reg.next_recall_proposal_id;
        reg.next_recall_proposal_id = id.checked_add(1).ok_or(CommitteeError::CommitteeOverflow)?;

        let p = &mut ctx.accounts.recall_proposal;
        p.proposal_id = id;
        p.committee_seat = seat_key;
        p.initiator = initiator_key;
        p.opens_at = now;
        p.closes_at = now.checked_add(RECALL_VOTING_WINDOW_SECS).ok_or(CommitteeError::CommitteeOverflow)?;
        p.votes_for_recall = 0;
        p.votes_against = 0;
        p.finalized = false;
        p.recall_threshold_bps = RECALL_THRESHOLD_BPS;
        p.reason_uri = reason_uri;
        p.bump = bump_r;

        emit!(RecallProposed { proposal_id: id, committee_seat: seat_key, initiator: initiator_key });
        Ok(())
    }

    /// [whitepaper-sync v1.1] §15 elections — Vote on a recall proposal.
    pub fn vote_recall(
        ctx: Context<VoteRecall>,
        support: bool,
        vote_weight: u64,
    ) -> Result<()> {
        // [audit fix R5 H-GE-1] cap vote_weight at MAX_VOTE_WEIGHT.
        require!(vote_weight > 0, CommitteeError::InvalidVoteWeight);
        require!(
            vote_weight <= MAX_VOTE_WEIGHT,
            CommitteeError::InvalidVoteWeight
        );
        let now = Clock::get()?.unix_timestamp;
        let voter_key = ctx.accounts.voter.key();
        let bump_rv = ctx.bumps.recall_vote;

        let p = &mut ctx.accounts.recall_proposal;
        require!(!p.finalized, CommitteeError::RecallAlreadyFinalized);
        require!(now < p.closes_at, CommitteeError::RecallClosed);

        if support {
            p.votes_for_recall = p.votes_for_recall.checked_add(vote_weight).ok_or(CommitteeError::CommitteeOverflow)?;
        } else {
            p.votes_against = p.votes_against.checked_add(vote_weight).ok_or(CommitteeError::CommitteeOverflow)?;
        }

        let rv = &mut ctx.accounts.recall_vote;
        rv.proposal = p.key();
        rv.voter = voter_key;
        rv.support = support;
        rv.vote_weight = vote_weight;
        rv.cast_at = now;
        rv.bump = bump_rv;

        emit!(RecallVoteCast { proposal_id: p.proposal_id, voter: voter_key, support, vote_weight });
        Ok(())
    }

    /// [whitepaper-sync v1.1] §15 elections — Finalize a recall. If
    /// for/total ≥ RECALL_THRESHOLD_BPS, flip `committee_seat.recalled = true`.
    pub fn finalize_recall(ctx: Context<FinalizeRecall>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let p = &mut ctx.accounts.recall_proposal;
        require!(!p.finalized, CommitteeError::RecallAlreadyFinalized);
        require!(now >= p.closes_at, CommitteeError::RecallNotClosed);

        let total = p.votes_for_recall.checked_add(p.votes_against).ok_or(CommitteeError::CommitteeOverflow)?;
        let recall_passed = if total == 0 {
            false
        } else {
            let for_bps = (p.votes_for_recall as u128)
                .checked_mul(10_000)
                .ok_or(CommitteeError::CommitteeOverflow)?
                .checked_div(total as u128)
                .ok_or(CommitteeError::CommitteeOverflow)? as u16;
            for_bps >= p.recall_threshold_bps
        };

        if recall_passed {
            let seat = &mut ctx.accounts.committee_seat;
            seat.recalled = true;
            // NOTE: holder field is preserved as a historical record; future
            // `open_election` on this seat re-fills it. seat.term_ends_at is
            // not zeroed — indexers can still read "the seat was held by X
            // until recalled at now".
        }

        p.finalized = true;
        emit!(RecallFinalized {
            proposal_id: p.proposal_id,
            recalled: recall_passed,
            votes_for: p.votes_for_recall,
            votes_against: p.votes_against,
        });
        Ok(())
    }

    pub fn dissolve_panel_for_absence(ctx: Context<DissolvePanelCtx>, dispute_id: u64) -> Result<()> {
        // [audit fix round2 R2-H-G1] gate absence-slashing on arbitration_enabled
        // so honest jurors are not penalised when the gate was flipped mid-flow.
        require!(ctx.accounts.governance_config.arbitration_enabled, ArbitrationError::ArbitrationDisabled);
        require!(ctx.accounts.arb_dispute.id == dispute_id, ArbitrationError::InvalidDisputeStatus);
        let slot = Clock::get()?.slot;
        let status = ctx.accounts.arb_dispute.status.clone();
        let deadline = if status == DisputeStatus::Trial1Pending { ctx.accounts.arb_dispute.trial1_deadline_slot }
            else { ctx.accounts.arb_dispute.trial2_deadline_slot.unwrap_or(0) };
        require!(status == DisputeStatus::Trial1Pending || status == DisputeStatus::Trial2Pending, ArbitrationError::InvalidDisputeStatus);
        require!(slot >= deadline, ArbitrationError::TrialNotDeadlined);

        let jurors: Vec<Pubkey> = if status == DisputeStatus::Trial1Pending { ctx.accounts.arb_dispute.trial1_jury.to_vec() }
            else { ctx.accounts.arb_dispute.trial2_panel.map_or(Vec::new(), |p| p.to_vec()) };
        let ruled: Vec<Pubkey> = if status == DisputeStatus::Trial1Pending { ctx.accounts.arb_dispute.trial1_rulings.iter().map(|r| r.juror).collect() }
            else { ctx.accounts.arb_dispute.trial2_rulings.iter().map(|r| r.juror).collect() };

        let reg = &mut ctx.accounts.arbitrator_registry;
        for juror in &jurors {
            if *juror == Pubkey::default() { continue; }
            if !ruled.contains(juror) {
                if let Some(arb) = reg.arbitrators.iter_mut().find(|a| a.user == *juror) {
                    // [audit fix M-G4] scaled absence penalty (max of flat
                    // base or `current_ars * 25%`) — disincentivises bribes
                    // > 20 ARS-worth and scales with the juror's rank.
                    let scaled = (arb.ars as i64)
                        .saturating_mul(ABSENCE_PENALTY_BPS)
                        .saturating_div(10_000);
                    let penalty = scaled.max(BASE_ABSENCE_ARS_PENALTY) as u64;
                    arb.ars = arb.ars.saturating_sub(penalty);
                    arb.excluded_until_slot = Some(slot + ABSENCE_PENALTY_SLOTS);
                    arb.last_penalty_slot = Some(slot);
                }
            }
        }
        ctx.accounts.arb_dispute.status = DisputeStatus::Dissolved;
        Ok(())
    }
}

// === Account Structures ===
// [audit fix C-21/C-22] add ora_mint + quorum to GovernanceConfig
// [whitepaper-sync v1.1] §15 elections — `elections_enabled` flag added (Phase 1: false).
#[account]
pub struct GovernanceConfig {
    pub admin: Pubkey,             // 32
    pub proposal_count: u64,       // 8
    pub ora_mint: Pubkey,          // 32 — voters' ORA token accounts must match this mint
    pub quorum: u64,               // 8 — minimum total_votes weight required to execute
    pub arbitration_enabled: bool, // 1 — [audit fix C-G2] gate flag
    pub elections_enabled: bool,   // 1 — [whitepaper-sync v1.1] §15 elections — Phase 1 gate
    pub bump: u8,                  // 1
}
#[account] pub struct ArbiterRecord { pub arbiter: Pubkey, pub registered_at: i64, pub is_active: bool, pub bump: u8 }
// [whitepaper-sync v1.1] Added `tier: ProposalTier` field per Handbook §14 +
// WP §15/§19 four-tier governance system. Stored alongside the existing
// committee_type/proposal_type metadata so `execute_proposal` can pick the
// correct supermajority threshold.
#[account] pub struct Proposal { pub proposal_id: u64, pub proposer: Pubkey, pub title: String, pub description: String, pub committee_type: CommitteeType, pub proposal_type: ProposalType, pub tier: ProposalTier, pub status: ProposalStatus, pub votes_for: u64, pub votes_against: u64, pub total_votes: u64, pub created_at: i64, pub voting_ends_at: i64, pub bump: u8 }
#[account] pub struct VoteRecord { pub voter: Pubkey, pub proposal: Pubkey, pub vote_for: bool, pub vote_weight: u64, pub voted_at: i64, pub bump: u8 }
#[account] pub struct Dispute { pub plaintiff: Pubkey, pub target_user: Pubkey, pub evidence_uri: String, pub dispute_type: DisputeType, pub status: OldDisputeStatus, pub votes_guilty: u8, pub votes_innocent: u8, pub created_at: i64, pub bump: u8 }
#[account] pub struct DisputeVote { pub arbiter: Pubkey, pub dispute: Pubkey, pub vote_guilty: bool, pub voted_at: i64, pub bump: u8 }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)] pub enum CommitteeType { Development, Content, Operations, Arbitration, Technical }
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)] pub enum ProposalType { PolicyChange, BudgetAllocation, PartnershipApproval, CodeUpgrade, Other }
/// [whitepaper-sync v1.1] Governance tier per Handbook §14 + WP §19.
/// - **TierI** (Constitutional, immutable): cannot be modified through normal
///   on-chain process; `create_proposal` rejects them. Off-chain
///   Constitutional Amendment Process required (95% + all 5 committees + 1yr).
/// - **TierII** (Supermajority): 75% approval + all 5 committees + 90-day
///   implementation. The contract enforces the 75% yes-bps threshold; the
///   five-committee sign-off is off-chain (no on-chain committee-seat
///   machinery exists yet — see TODO at top of file).
/// - **TierIII** (Standard): strict 50% majority.
/// - **TierIV** (Committee-internal): committees rule directly; on-chain
///   threshold treated as 50% for the rare case a Tier IV proposal flows
///   through this contract, but typical Tier IV ops bypass `create_proposal`
///   entirely.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)] pub enum ProposalTier { TierI, TierII, TierIII, TierIV }
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)] pub enum ProposalStatus { UnderReview, Voting, Passed, Failed, Executed }
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)] pub enum DisputeType { Copyright, Scam, Harassment, Other }
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)] pub enum OldDisputeStatus { UnderReview, Guilty, Innocent }

// === Contexts ===
#[derive(Accounts)] pub struct InitializeGovernance<'info> {
    // [audit fix C-21/C-22 + C-G2] expanded space for ora_mint + quorum + arbitration_enabled
    // [whitepaper-sync v1.1] §15 elections — +1 byte for `elections_enabled` flag.
    #[account(init, payer = admin, space = 8+32+8+32+8+1+1+1, seeds = [b"governance_config"], bump)]
    pub governance_config: Account<'info, GovernanceConfig>,
    // [audit fix C-G1] caller MUST equal hardcoded PROGRAM_ADMIN.
    #[account(mut, address = PROGRAM_ADMIN @ ErrorCode::Unauthorized)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)] pub struct SetArbitrationEnabled<'info> {
    #[account(mut, seeds = [b"governance_config"], bump = governance_config.bump)]
    pub governance_config: Account<'info, GovernanceConfig>,
    // [audit fix C-G2] only the hardcoded PROGRAM_ADMIN can flip the gate.
    #[account(address = PROGRAM_ADMIN @ ErrorCode::Unauthorized)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)] pub struct UpdateQuorum<'info> {
    #[account(mut, seeds = [b"governance_config"], bump = governance_config.bump,
        has_one = admin @ ErrorCode::Unauthorized)]
    pub governance_config: Account<'info, GovernanceConfig>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)] pub struct MarkExecuted<'info> {
    #[account(seeds = [b"governance_config"], bump = governance_config.bump)]
    pub governance_config: Account<'info, GovernanceConfig>,
    #[account(mut)] pub proposal: Account<'info, Proposal>,
    pub authority: Signer<'info>,
}
#[derive(Accounts)] pub struct RegisterArbiter<'info> {
    #[account(seeds = [b"governance_config"], bump = governance_config.bump, has_one = admin @ ErrorCode::Unauthorized)]
    pub governance_config: Account<'info, GovernanceConfig>,
    #[account(init, payer = admin, space = 8+32+8+1+1, seeds = [b"arbiter", arbiter.key().as_ref()], bump)]
    pub arbiter_record: Account<'info, ArbiterRecord>,
    /// CHECK: Arbiter
    pub arbiter: AccountInfo<'info>,
    #[account(mut)] pub admin: Signer<'info>, pub system_program: Program<'info, System>,
}

/// [audit fix M-G3 / R2-M-G2] Admin-gated activation toggle for the legacy
/// arbiter record. Mirrors the `has_one = admin` pattern used by
/// `register_arbiter` so only the governance admin can deactivate legacy
/// arbiters.
#[derive(Accounts)] pub struct SetArbiterActive<'info> {
    #[account(seeds = [b"governance_config"], bump = governance_config.bump, has_one = admin @ ErrorCode::Unauthorized)]
    pub governance_config: Account<'info, GovernanceConfig>,
    #[account(mut, seeds = [b"arbiter", arbiter_record.arbiter.as_ref()], bump = arbiter_record.bump)]
    pub arbiter_record: Account<'info, ArbiterRecord>,
    pub admin: Signer<'info>,
}
#[derive(Accounts)] pub struct CreateProposal<'info> {
    #[account(mut, seeds = [b"governance_config"], bump = governance_config.bump)]
    pub governance_config: Account<'info, GovernanceConfig>,
    // [audit fix H-G1] PDA seeded by monotonic `proposal_count` (NOT title).
    // Anchor evaluates `governance_config.proposal_count` at constraint time,
    // BEFORE the function body increments it. So a fresh proposal uses the
    // current counter value as its id, and the next call sees the incremented
    // value.
    // [whitepaper-sync v1.1] +1 byte for the new `tier` field on Proposal
    // (ProposalTier is a 4-variant enum → 1-byte discriminant).
    #[account(init, payer = proposer,
        space = 8+8+32+104+5004+1+1+1+1+8+8+8+8+8+1,
        seeds = [b"proposal", governance_config.proposal_count.to_le_bytes().as_ref()],
        bump)]
    pub proposal: Account<'info, Proposal>,
    #[account(mut)] pub proposer: Signer<'info>, pub system_program: Program<'info, System>,
}
#[derive(Accounts)] pub struct VoteOnProposal<'info> {
    // [audit fix C-21] read-only governance_config to enforce ora_mint
    #[account(seeds = [b"governance_config"], bump = governance_config.bump)]
    pub governance_config: Account<'info, GovernanceConfig>,
    #[account(mut)] pub proposal: Account<'info, Proposal>,
    #[account(init, payer = voter, space = 8+32+32+1+8+8+1, seeds = [b"vote", proposal.key().as_ref(), voter.key().as_ref()], bump)]
    pub vote_record: Account<'info, VoteRecord>,
    pub voter_ora_account: Account<'info, SplTokenAccount>,
    #[account(mut)] pub voter: Signer<'info>, pub system_program: Program<'info, System>,
}
#[derive(Accounts)] pub struct ExecuteProposal<'info> {
    #[account(seeds = [b"governance_config"], bump = governance_config.bump)]
    pub governance_config: Account<'info, GovernanceConfig>,
    #[account(mut)] pub proposal: Account<'info, Proposal>,
    pub authority: Signer<'info>,
}
#[derive(Accounts)] pub struct CreateDispute<'info> {
    #[account(init, payer = plaintiff, space = 8+32+32+204+1+1+1+1+8+1, seeds = [b"dispute", plaintiff.key().as_ref(), target_user.key().as_ref()], bump)]
    pub dispute: Account<'info, Dispute>,
    #[account(mut)] pub plaintiff: Signer<'info>,
    /// CHECK: Target
    pub target_user: AccountInfo<'info>, pub system_program: Program<'info, System>,
}
#[derive(Accounts)] pub struct VoteOnDispute<'info> {
    #[account(mut)] pub dispute: Account<'info, Dispute>,
    #[account(seeds = [b"arbiter", arbiter.key().as_ref()], bump = arbiter_record.bump, constraint = arbiter_record.arbiter == arbiter.key() @ ErrorCode::Unauthorized)]
    pub arbiter_record: Account<'info, ArbiterRecord>,
    #[account(init, payer = arbiter, space = 8+32+32+1+8+1, seeds = [b"dispute_vote", dispute.key().as_ref(), arbiter.key().as_ref()], bump)]
    pub dispute_vote: Account<'info, DisputeVote>,
    #[account(mut)] pub arbiter: Signer<'info>, pub system_program: Program<'info, System>,
}

// === Arbitration Contexts ===
#[derive(Accounts)] pub struct InitArbitrationGovernanceCtx<'info> {
    #[account(init, payer = admin, space = ArbitrationGovernance::SIZE, seeds = [b"arb-governance"], bump)]
    pub arbitration_governance: Account<'info, ArbitrationGovernance>,
    #[account(mut)] pub admin: Signer<'info>, pub system_program: Program<'info, System>,
}
#[derive(Accounts)] pub struct InitArbitratorRegistryCtx<'info> {
    #[account(init, payer = admin, space = ArbitratorRegistry::MAX_SIZE, seeds = [b"arb-registry"], bump)]
    pub arbitrator_registry: Account<'info, ArbitratorRegistry>,
    #[account(mut)] pub admin: Signer<'info>, pub system_program: Program<'info, System>,
}
// [audit fix round2 R2-C-G1] Stake-escrow context: bind user_ora_account by
// owner+mint, require an arbiter_stake_vault PDA owned by the registry, and
// thread the canonical governance_config so `ora_mint` is enforced.
#[derive(Accounts)] pub struct RegisterAsArbitratorCtx<'info> {
    #[account(mut, seeds = [b"arb-registry"], bump = arbitrator_registry.bump)]
    pub arbitrator_registry: Account<'info, ArbitratorRegistry>,
    #[account(seeds = [b"governance_config"], bump = governance_config.bump)]
    pub governance_config: Account<'info, GovernanceConfig>,
    /// [audit fix round2 R2-C-G1] user's source ORA ATA — must be owned by
    /// the signer and match the canonical ORA mint.
    #[account(
        mut,
        constraint = user_ora_account.owner == user.key() @ ArbitrationError::Unauthorized,
        constraint = user_ora_account.mint == governance_config.ora_mint @ ArbitrationError::Unauthorized,
    )]
    pub user_ora_account: Account<'info, SplTokenAccount>,
    /// [audit fix round2 R2-C-G1] Protocol-owned escrow ATA. Authority is the
    /// `arbitrator_registry` PDA so only this program can move funds out
    /// (e.g., on slashing). Mint pinned to ora_mint.
    #[account(
        mut,
        seeds = [b"arb-stake-vault"],
        bump,
        constraint = arbiter_stake_vault.owner == arbitrator_registry.key() @ ArbitrationError::Unauthorized,
        constraint = arbiter_stake_vault.mint == governance_config.ora_mint @ ArbitrationError::Unauthorized,
    )]
    pub arbiter_stake_vault: Account<'info, SplTokenAccount>,
    #[account(mut)] pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// [audit fix round2 R2-C-G1] one-time init of the protocol arbiter stake
// vault. PROGRAM_ADMIN-gated so an attacker cannot pre-create the vault with
// a hostile authority.
#[derive(Accounts)] pub struct InitArbiterStakeVaultCtx<'info> {
    #[account(seeds = [b"arb-registry"], bump = arbitrator_registry.bump)]
    pub arbitrator_registry: Account<'info, ArbitratorRegistry>,
    #[account(seeds = [b"governance_config"], bump = governance_config.bump)]
    pub governance_config: Account<'info, GovernanceConfig>,
    #[account(address = governance_config.ora_mint @ ArbitrationError::Unauthorized)]
    pub ora_mint: Account<'info, anchor_spl::token::Mint>,
    #[account(
        init,
        payer = admin,
        token::mint = ora_mint,
        token::authority = arbitrator_registry,
        seeds = [b"arb-stake-vault"],
        bump,
    )]
    pub arbiter_stake_vault: Account<'info, SplTokenAccount>,
    #[account(mut, address = PROGRAM_ADMIN @ ErrorCode::Unauthorized)]
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
#[derive(Accounts)] #[instruction(redemption_id: u64, coin_mint: Pubkey, defendant: Pubkey)]
pub struct FileArbitrationDisputeCtx<'info> {
    #[account(mut, seeds = [b"arb-governance"], bump = arbitration_governance.bump)]
    pub arbitration_governance: Account<'info, ArbitrationGovernance>,
    #[account(init, payer = plaintiff, space = ArbitrationDispute::SIZE, seeds = [b"arb-dispute", arbitration_governance.dispute_count.to_le_bytes().as_ref()], bump)]
    pub arb_dispute: Account<'info, ArbitrationDispute>,
    // [audit fix round2 R2-H-G1] arbitration_enabled gate.
    #[account(seeds = [b"governance_config"], bump = governance_config.bump)]
    pub governance_config: Account<'info, GovernanceConfig>,
    #[account(mut)] pub plaintiff: Signer<'info>, pub system_program: Program<'info, System>,
}
#[derive(Accounts)] #[instruction(dispute_id: u64)] pub struct SelectTrial1JuryCtx<'info> {
    #[account(mut, seeds = [b"arb-dispute", dispute_id.to_le_bytes().as_ref()], bump = arb_dispute.bump)]
    pub arb_dispute: Account<'info, ArbitrationDispute>,
    #[account(seeds = [b"arb-registry"], bump = arbitrator_registry.bump)]
    pub arbitrator_registry: Account<'info, ArbitratorRegistry>,
    // [audit fix C-G2] arbitration_enabled gate.
    #[account(seeds = [b"governance_config"], bump = governance_config.bump)]
    pub governance_config: Account<'info, GovernanceConfig>,
    pub caller: Signer<'info>,
}
#[derive(Accounts)] #[instruction(dispute_id: u64)] pub struct SubmitTrial1RulingCtx<'info> {
    #[account(mut, seeds = [b"arb-dispute", dispute_id.to_le_bytes().as_ref()], bump = arb_dispute.bump)]
    pub arb_dispute: Account<'info, ArbitrationDispute>,
    // [audit fix C-G2] arbitration_enabled gate.
    #[account(seeds = [b"governance_config"], bump = governance_config.bump)]
    pub governance_config: Account<'info, GovernanceConfig>,
    pub juror: Signer<'info>,
}
#[derive(Accounts)] #[instruction(dispute_id: u64)] pub struct FinalizeTrial1Ctx<'info> {
    #[account(mut, seeds = [b"arb-dispute", dispute_id.to_le_bytes().as_ref()], bump = arb_dispute.bump)]
    pub arb_dispute: Account<'info, ArbitrationDispute>,
    // [audit fix round2 R2-H-G1] arbitration_enabled gate.
    #[account(seeds = [b"governance_config"], bump = governance_config.bump)]
    pub governance_config: Account<'info, GovernanceConfig>,
    pub caller: Signer<'info>,
}
#[derive(Accounts)] #[instruction(dispute_id: u64)] pub struct AppealToTrial2Ctx<'info> {
    #[account(mut, seeds = [b"arb-dispute", dispute_id.to_le_bytes().as_ref()], bump = arb_dispute.bump)]
    pub arb_dispute: Account<'info, ArbitrationDispute>,
    // [audit fix round2 R2-H-G1] arbitration_enabled gate.
    #[account(seeds = [b"governance_config"], bump = governance_config.bump)]
    pub governance_config: Account<'info, GovernanceConfig>,
    pub appellant: Signer<'info>,
}
#[derive(Accounts)] #[instruction(dispute_id: u64)] pub struct SelectTrial2PanelCtx<'info> {
    #[account(mut, seeds = [b"arb-dispute", dispute_id.to_le_bytes().as_ref()], bump = arb_dispute.bump)]
    pub arb_dispute: Account<'info, ArbitrationDispute>,
    #[account(seeds = [b"arb-registry"], bump = arbitrator_registry.bump)]
    pub arbitrator_registry: Account<'info, ArbitratorRegistry>,
    // [audit fix round2 R2-H-G1] arbitration_enabled gate.
    #[account(seeds = [b"governance_config"], bump = governance_config.bump)]
    pub governance_config: Account<'info, GovernanceConfig>,
    pub caller: Signer<'info>,
}
#[derive(Accounts)] #[instruction(dispute_id: u64)] pub struct SubmitTrial2RulingCtx<'info> {
    #[account(mut, seeds = [b"arb-dispute", dispute_id.to_le_bytes().as_ref()], bump = arb_dispute.bump)]
    pub arb_dispute: Account<'info, ArbitrationDispute>,
    // [audit fix C-G2] arbitration_enabled gate.
    #[account(seeds = [b"governance_config"], bump = governance_config.bump)]
    pub governance_config: Account<'info, GovernanceConfig>,
    pub juror: Signer<'info>,
}
#[derive(Accounts)] #[instruction(dispute_id: u64)] pub struct FinalizeDisputeCtx<'info> {
    #[account(mut, seeds = [b"arb-dispute", dispute_id.to_le_bytes().as_ref()], bump = arb_dispute.bump)]
    pub arb_dispute: Account<'info, ArbitrationDispute>,
    // [audit fix round2 R2-H-G1] arbitration_enabled gate.
    #[account(seeds = [b"governance_config"], bump = governance_config.bump)]
    pub governance_config: Account<'info, GovernanceConfig>,
    pub caller: Signer<'info>,
}
#[derive(Accounts)] #[instruction(dispute_id: u64)] pub struct DissolvePanelCtx<'info> {
    #[account(mut, seeds = [b"arb-dispute", dispute_id.to_le_bytes().as_ref()], bump = arb_dispute.bump)]
    pub arb_dispute: Account<'info, ArbitrationDispute>,
    #[account(mut, seeds = [b"arb-registry"], bump = arbitrator_registry.bump)]
    pub arbitrator_registry: Account<'info, ArbitratorRegistry>,
    // [audit fix round2 R2-H-G1] arbitration_enabled gate.
    #[account(seeds = [b"governance_config"], bump = governance_config.bump)]
    pub governance_config: Account<'info, GovernanceConfig>,
    pub caller: Signer<'info>,
}

// === Errors ===
#[error_code]
pub enum ErrorCode {
    #[msg("Title too long")] TitleTooLong,
    #[msg("Description too long")] DescriptionTooLong,
    #[msg("Proposal not in voting")] ProposalNotVoting,
    #[msg("Voting ended")] VotingEnded,
    #[msg("Voting not ended")] VotingNotEnded,
    #[msg("Invalid vote weight")] InvalidVoteWeight,
    #[msg("Invalid proposal status")] InvalidProposalStatus,
    #[msg("Evidence URI too long")] EvidenceUriTooLong,
    #[msg("Dispute already resolved")] DisputeAlreadyResolved,
    #[msg("Unauthorized")] Unauthorized,
    #[msg("Arbiter not active")] ArbiterNotActive,
    #[msg("Overflow")] Overflow,
    #[msg("Quorum not reached")] QuorumNotReached,
    #[msg("Legacy dispute voter cap reached")] DisputeVoterCapReached,
    // [whitepaper-sync v1.1] Tier I parameters are constitutional/immutable;
    // the on-chain proposal pipeline rejects them.
    #[msg("Tier I parameters are immutable; use the off-chain Constitutional Amendment Process")] TierIImmutable,
}
