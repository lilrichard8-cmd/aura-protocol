use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount as SplTokenAccount;

pub mod arbitration;
pub use arbitration::*;

declare_id!("7Un16eWXCteD3PgjpYWggCjuQK2tneHDkwGXvUg5obBk");

const MAX_VOTE_WEIGHT: u64 = 10_000;

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

    // [audit fix C-21/C-22] accept ora_mint + quorum at initialization
    pub fn initialize_governance(ctx: Context<InitializeGovernance>, ora_mint: Pubkey, quorum: u64) -> Result<()> {
        let config = &mut ctx.accounts.governance_config;
        config.admin = ctx.accounts.admin.key();
        config.proposal_count = 0;
        config.ora_mint = ora_mint;
        config.quorum = quorum;
        config.bump = ctx.bumps.governance_config;
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

    pub fn create_proposal(ctx: Context<CreateProposal>, title: String, description: String, committee_type: CommitteeType, proposal_type: ProposalType) -> Result<()> {
        require!(title.len() <= 100, ErrorCode::TitleTooLong);
        require!(description.len() <= 5000, ErrorCode::DescriptionTooLong);
        let p = &mut ctx.accounts.proposal;
        let clock = Clock::get()?;
        p.proposer = ctx.accounts.proposer.key(); p.title = title; p.description = description;
        p.committee_type = committee_type; p.proposal_type = proposal_type;
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
        proposal.status = if proposal.votes_for > proposal.votes_against { ProposalStatus::Passed } else { ProposalStatus::Failed };
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
    pub fn vote_on_dispute(ctx: Context<VoteOnDispute>, vote_guilty: bool) -> Result<()> {
        msg!("[DEPRECATED] vote_on_dispute: use submit_trial1_ruling / submit_trial2_ruling.");
        require!(ctx.accounts.arbiter_record.is_active, ErrorCode::ArbiterNotActive);
        let arbiter_key = ctx.accounts.arbiter.key();
        let dispute_key = ctx.accounts.dispute.key();
        let bump_dv = ctx.bumps.dispute_vote;
        let now_ts = Clock::get()?.unix_timestamp;
        let dispute = &mut ctx.accounts.dispute;
        require!(dispute.status == OldDisputeStatus::UnderReview, ErrorCode::DisputeAlreadyResolved);
        if vote_guilty { dispute.votes_guilty += 1; } else { dispute.votes_innocent += 1; }
        if (dispute.votes_guilty + dispute.votes_innocent) >= 4 {
            dispute.status = if dispute.votes_guilty > dispute.votes_innocent { OldDisputeStatus::Guilty } else { OldDisputeStatus::Innocent };
        }
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

    pub fn register_as_arbitrator(ctx: Context<RegisterAsArbitratorCtx>) -> Result<()> {
        let reg = &mut ctx.accounts.arbitrator_registry;
        let user_key = ctx.accounts.user.key();
        require!(!reg.arbitrators.iter().any(|a| a.user == user_key), ArbitrationError::AlreadyRegistered);
        require!(reg.arbitrators.len() < MAX_ARBITRATORS, ArbitrationError::RegistryFull);
        let stake = ctx.accounts.user_ora_account.amount;
        require!(stake >= MIN_STAKE_LAMPORTS, ArbitrationError::InsufficientStake);
        let slot = Clock::get()?.slot;
        reg.arbitrators.push(Arbitrator { user: user_key, ars: 0, staked_ora_lamports: stake, joined_at_slot: slot, is_in_other_committee: false, last_penalty_slot: None, excluded_until_slot: None });
        reg.total_pool_size += 1;
        emit!(ArbitratorRegistered { user: user_key, slot });
        Ok(())
    }

    pub fn file_arbitration_dispute(ctx: Context<FileArbitrationDisputeCtx>, redemption_id: u64, coin_mint: Pubkey, defendant: Pubkey) -> Result<()> {
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
        require!(reasoning_uri.len() <= 200, ArbitrationError::UriTooLong);
        let juror_key = ctx.accounts.juror.key();
        let d = &mut ctx.accounts.arb_dispute;
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
        let d = &mut ctx.accounts.arb_dispute;
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
        let d = &mut ctx.accounts.arb_dispute;
        require!(d.status == DisputeStatus::Trial1Concluded, ArbitrationError::InvalidDisputeStatus);
        let slot = Clock::get()?.slot;
        let deadline = d.appeal_deadline_slot.ok_or(ArbitrationError::InvalidDisputeStatus)?;
        require!(slot <= deadline, ArbitrationError::AppealWindowExpired);
        // Status stays Trial1Concluded, select_trial2_panel will advance it
        Ok(())
    }

    pub fn select_trial2_panel(ctx: Context<SelectTrial2PanelCtx>, dispute_id: u64) -> Result<()> {
        let d = &mut ctx.accounts.arb_dispute;
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
        require!(reasoning_uri.len() <= 200, ArbitrationError::UriTooLong);
        let juror_key = ctx.accounts.juror.key();
        let d = &mut ctx.accounts.arb_dispute;
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
        let d = &mut ctx.accounts.arb_dispute;
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

    pub fn dissolve_panel_for_absence(ctx: Context<DissolvePanelCtx>, dispute_id: u64) -> Result<()> {
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
                    arb.ars = arb.ars.saturating_sub(20);
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
#[account]
pub struct GovernanceConfig {
    pub admin: Pubkey,        // 32
    pub proposal_count: u64,  // 8
    pub ora_mint: Pubkey,     // 32 — voters' ORA token accounts must match this mint
    pub quorum: u64,          // 8 — minimum total_votes weight required to execute
    pub bump: u8,             // 1
}
#[account] pub struct ArbiterRecord { pub arbiter: Pubkey, pub registered_at: i64, pub is_active: bool, pub bump: u8 }
#[account] pub struct Proposal { pub proposer: Pubkey, pub title: String, pub description: String, pub committee_type: CommitteeType, pub proposal_type: ProposalType, pub status: ProposalStatus, pub votes_for: u64, pub votes_against: u64, pub total_votes: u64, pub created_at: i64, pub voting_ends_at: i64, pub bump: u8 }
#[account] pub struct VoteRecord { pub voter: Pubkey, pub proposal: Pubkey, pub vote_for: bool, pub vote_weight: u64, pub voted_at: i64, pub bump: u8 }
#[account] pub struct Dispute { pub plaintiff: Pubkey, pub target_user: Pubkey, pub evidence_uri: String, pub dispute_type: DisputeType, pub status: OldDisputeStatus, pub votes_guilty: u8, pub votes_innocent: u8, pub created_at: i64, pub bump: u8 }
#[account] pub struct DisputeVote { pub arbiter: Pubkey, pub dispute: Pubkey, pub vote_guilty: bool, pub voted_at: i64, pub bump: u8 }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)] pub enum CommitteeType { Development, Content, Operations, Arbitration, Technical }
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)] pub enum ProposalType { PolicyChange, BudgetAllocation, PartnershipApproval, CodeUpgrade, Other }
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)] pub enum ProposalStatus { UnderReview, Voting, Passed, Failed, Executed }
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)] pub enum DisputeType { Copyright, Scam, Harassment, Other }
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)] pub enum OldDisputeStatus { UnderReview, Guilty, Innocent }

// === Contexts ===
#[derive(Accounts)] pub struct InitializeGovernance<'info> {
    // [audit fix C-21/C-22] expanded space for ora_mint + quorum
    #[account(init, payer = admin, space = 8+32+8+32+8+1, seeds = [b"governance_config"], bump)]
    pub governance_config: Account<'info, GovernanceConfig>,
    #[account(mut)] pub admin: Signer<'info>, pub system_program: Program<'info, System>,
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
#[derive(Accounts)] #[instruction(title: String)] pub struct CreateProposal<'info> {
    #[account(mut, seeds = [b"governance_config"], bump = governance_config.bump)]
    pub governance_config: Account<'info, GovernanceConfig>,
    #[account(init, payer = proposer, space = 8+32+104+5004+1+1+1+8+8+8+8+8+1, seeds = [b"proposal", proposer.key().as_ref(), title.as_bytes()], bump)]
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
#[derive(Accounts)] pub struct RegisterAsArbitratorCtx<'info> {
    #[account(mut, seeds = [b"arb-registry"], bump = arbitrator_registry.bump)]
    pub arbitrator_registry: Account<'info, ArbitratorRegistry>,
    pub user_ora_account: Account<'info, SplTokenAccount>,
    #[account(mut)] pub user: Signer<'info>,
}
#[derive(Accounts)] #[instruction(redemption_id: u64, coin_mint: Pubkey, defendant: Pubkey)]
pub struct FileArbitrationDisputeCtx<'info> {
    #[account(mut, seeds = [b"arb-governance"], bump = arbitration_governance.bump)]
    pub arbitration_governance: Account<'info, ArbitrationGovernance>,
    #[account(init, payer = plaintiff, space = ArbitrationDispute::SIZE, seeds = [b"arb-dispute", arbitration_governance.dispute_count.to_le_bytes().as_ref()], bump)]
    pub arb_dispute: Account<'info, ArbitrationDispute>,
    #[account(mut)] pub plaintiff: Signer<'info>, pub system_program: Program<'info, System>,
}
#[derive(Accounts)] #[instruction(dispute_id: u64)] pub struct SelectTrial1JuryCtx<'info> {
    #[account(mut, seeds = [b"arb-dispute", dispute_id.to_le_bytes().as_ref()], bump = arb_dispute.bump)]
    pub arb_dispute: Account<'info, ArbitrationDispute>,
    #[account(seeds = [b"arb-registry"], bump = arbitrator_registry.bump)]
    pub arbitrator_registry: Account<'info, ArbitratorRegistry>,
    pub caller: Signer<'info>,
}
#[derive(Accounts)] #[instruction(dispute_id: u64)] pub struct SubmitTrial1RulingCtx<'info> {
    #[account(mut, seeds = [b"arb-dispute", dispute_id.to_le_bytes().as_ref()], bump = arb_dispute.bump)]
    pub arb_dispute: Account<'info, ArbitrationDispute>,
    pub juror: Signer<'info>,
}
#[derive(Accounts)] #[instruction(dispute_id: u64)] pub struct FinalizeTrial1Ctx<'info> {
    #[account(mut, seeds = [b"arb-dispute", dispute_id.to_le_bytes().as_ref()], bump = arb_dispute.bump)]
    pub arb_dispute: Account<'info, ArbitrationDispute>,
    pub caller: Signer<'info>,
}
#[derive(Accounts)] #[instruction(dispute_id: u64)] pub struct AppealToTrial2Ctx<'info> {
    #[account(mut, seeds = [b"arb-dispute", dispute_id.to_le_bytes().as_ref()], bump = arb_dispute.bump)]
    pub arb_dispute: Account<'info, ArbitrationDispute>,
    pub appellant: Signer<'info>,
}
#[derive(Accounts)] #[instruction(dispute_id: u64)] pub struct SelectTrial2PanelCtx<'info> {
    #[account(mut, seeds = [b"arb-dispute", dispute_id.to_le_bytes().as_ref()], bump = arb_dispute.bump)]
    pub arb_dispute: Account<'info, ArbitrationDispute>,
    #[account(seeds = [b"arb-registry"], bump = arbitrator_registry.bump)]
    pub arbitrator_registry: Account<'info, ArbitratorRegistry>,
    pub caller: Signer<'info>,
}
#[derive(Accounts)] #[instruction(dispute_id: u64)] pub struct SubmitTrial2RulingCtx<'info> {
    #[account(mut, seeds = [b"arb-dispute", dispute_id.to_le_bytes().as_ref()], bump = arb_dispute.bump)]
    pub arb_dispute: Account<'info, ArbitrationDispute>,
    pub juror: Signer<'info>,
}
#[derive(Accounts)] #[instruction(dispute_id: u64)] pub struct FinalizeDisputeCtx<'info> {
    #[account(mut, seeds = [b"arb-dispute", dispute_id.to_le_bytes().as_ref()], bump = arb_dispute.bump)]
    pub arb_dispute: Account<'info, ArbitrationDispute>,
    pub caller: Signer<'info>,
}
#[derive(Accounts)] #[instruction(dispute_id: u64)] pub struct DissolvePanelCtx<'info> {
    #[account(mut, seeds = [b"arb-dispute", dispute_id.to_le_bytes().as_ref()], bump = arb_dispute.bump)]
    pub arb_dispute: Account<'info, ArbitrationDispute>,
    #[account(mut, seeds = [b"arb-registry"], bump = arbitrator_registry.bump)]
    pub arbitrator_registry: Account<'info, ArbitratorRegistry>,
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
}
