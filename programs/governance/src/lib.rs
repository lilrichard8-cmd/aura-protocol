use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount as SplTokenAccount;

declare_id!("GovernanceProgram111111111111111111111111111");

/// Square root voting: vote_weight = √(ORA balance), capped at 10,000
const MAX_VOTE_WEIGHT: u64 = 10_000;

/// Integer square root (Newton's method)
fn isqrt(n: u64) -> u64 {
    if n == 0 { return 0; }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}

#[program]
pub mod aura_governance {
    use super::*;

    /// Initialize governance config (sets admin who can register arbiters)
    pub fn initialize_governance(ctx: Context<InitializeGovernance>) -> Result<()> {
        let config = &mut ctx.accounts.governance_config;
        config.admin = ctx.accounts.admin.key();
        config.proposal_count = 0;
        config.bump = ctx.bumps.governance_config;
        msg!("Governance initialized");
        Ok(())
    }

    /// Register an arbiter (admin only)
    pub fn register_arbiter(ctx: Context<RegisterArbiter>) -> Result<()> {
        let arbiter_record = &mut ctx.accounts.arbiter_record;
        arbiter_record.arbiter = ctx.accounts.arbiter.key();
        arbiter_record.registered_at = Clock::get()?.unix_timestamp;
        arbiter_record.is_active = true;
        arbiter_record.bump = ctx.bumps.arbiter_record;
        msg!("Arbiter registered: {}", arbiter_record.arbiter);
        Ok(())
    }

    /// Create a new proposal
    pub fn create_proposal(
        ctx: Context<CreateProposal>,
        title: String,
        description: String,
        committee_type: CommitteeType,
        proposal_type: ProposalType,
    ) -> Result<()> {
        require!(title.len() <= 100, ErrorCode::TitleTooLong);
        require!(description.len() <= 5000, ErrorCode::DescriptionTooLong);

        let proposal = &mut ctx.accounts.proposal;
        let clock = Clock::get()?;
        
        proposal.proposer = ctx.accounts.proposer.key();
        proposal.title = title;
        proposal.description = description;
        proposal.committee_type = committee_type;
        proposal.proposal_type = proposal_type;
        proposal.status = ProposalStatus::Voting;
        proposal.votes_for = 0;
        proposal.votes_against = 0;
        proposal.total_votes = 0;
        proposal.created_at = clock.unix_timestamp;
        proposal.voting_ends_at = clock.unix_timestamp + (7 * 24 * 60 * 60);
        proposal.bump = ctx.bumps.proposal;

        msg!("Proposal created: {}", proposal.title);
        Ok(())
    }

    /// Vote on a proposal
    /// FIX #3: Added VoteRecord PDA to prevent duplicate votes
    /// Vote on proposal with √ORA voting power, capped at 10,000
    pub fn vote_on_proposal(
        ctx: Context<VoteOnProposal>,
        vote_for: bool,
    ) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        let clock = Clock::get()?;

        require!(proposal.status == ProposalStatus::Voting, ErrorCode::ProposalNotVoting);
        require!(clock.unix_timestamp < proposal.voting_ends_at, ErrorCode::VotingEnded);

        // Calculate vote weight: √(ORA token balance), capped at 10,000
        let ora_balance = ctx.accounts.voter_ora_account.amount;
        require!(ora_balance > 0, ErrorCode::InvalidVoteWeight);

        // ORA has 9 decimals, so divide first to get whole tokens
        let whole_tokens = ora_balance / 1_000_000_000;
        let sqrt_weight = isqrt(whole_tokens);
        let vote_weight = sqrt_weight.min(MAX_VOTE_WEIGHT);
        require!(vote_weight > 0, ErrorCode::InvalidVoteWeight);

        let vote_record = &mut ctx.accounts.vote_record;
        vote_record.voter = ctx.accounts.voter.key();
        vote_record.proposal = ctx.accounts.proposal.key();
        vote_record.vote_for = vote_for;
        vote_record.vote_weight = vote_weight;
        vote_record.voted_at = clock.unix_timestamp;
        vote_record.bump = ctx.bumps.vote_record;

        if vote_for {
            proposal.votes_for = proposal.votes_for.checked_add(vote_weight).ok_or(ErrorCode::Overflow)?;
        } else {
            proposal.votes_against = proposal.votes_against.checked_add(vote_weight).ok_or(ErrorCode::Overflow)?;
        }
        proposal.total_votes = proposal.total_votes.checked_add(vote_weight).ok_or(ErrorCode::Overflow)?;

        msg!("Voted with √ORA weight: {} (balance: {} ORA)", vote_weight, whole_tokens);
        Ok(())
    }

    /// Execute a passed proposal
    pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        let clock = Clock::get()?;

        require!(clock.unix_timestamp >= proposal.voting_ends_at, ErrorCode::VotingNotEnded);
        require!(proposal.status == ProposalStatus::Voting, ErrorCode::InvalidProposalStatus);

        if proposal.votes_for > proposal.votes_against {
            proposal.status = ProposalStatus::Passed;
            msg!("Proposal passed and executed");
        } else {
            proposal.status = ProposalStatus::Failed;
            msg!("Proposal failed");
        }

        Ok(())
    }

    /// Create a dispute
    pub fn create_dispute(
        ctx: Context<CreateDispute>,
        evidence_uri: String,
        dispute_type: DisputeType,
    ) -> Result<()> {
        require!(evidence_uri.len() <= 200, ErrorCode::EvidenceUriTooLong);

        let dispute = &mut ctx.accounts.dispute;
        dispute.plaintiff = ctx.accounts.plaintiff.key();
        dispute.target_user = ctx.accounts.target_user.key();
        dispute.evidence_uri = evidence_uri;
        dispute.dispute_type = dispute_type;
        dispute.status = DisputeStatus::UnderReview;
        dispute.votes_guilty = 0;
        dispute.votes_innocent = 0;
        dispute.created_at = Clock::get()?.unix_timestamp;
        dispute.bump = ctx.bumps.dispute;

        msg!("Dispute created");
        Ok(())
    }

    /// Vote on dispute (verified arbitration committee member only)
    /// FIX #4: Added arbiter_record verification + dispute vote dedup
    pub fn vote_on_dispute(
        ctx: Context<VoteOnDispute>,
        vote_guilty: bool,
    ) -> Result<()> {
        let dispute = &mut ctx.accounts.dispute;
        require!(dispute.status == DisputeStatus::UnderReview, ErrorCode::DisputeAlreadyResolved);
        require!(ctx.accounts.arbiter_record.is_active, ErrorCode::ArbiterNotActive);

        // Record vote
        let dispute_vote = &mut ctx.accounts.dispute_vote;
        dispute_vote.arbiter = ctx.accounts.arbiter.key();
        dispute_vote.dispute = ctx.accounts.dispute.key();
        dispute_vote.vote_guilty = vote_guilty;
        dispute_vote.voted_at = Clock::get()?.unix_timestamp;
        dispute_vote.bump = ctx.bumps.dispute_vote;

        if vote_guilty {
            dispute.votes_guilty = dispute.votes_guilty.checked_add(1).ok_or(ErrorCode::Overflow)?;
        } else {
            dispute.votes_innocent = dispute.votes_innocent.checked_add(1).ok_or(ErrorCode::Overflow)?;
        }

        // Auto-resolve at 4/7 votes
        let total_votes = dispute.votes_guilty + dispute.votes_innocent;
        if total_votes >= 4 {
            if dispute.votes_guilty > dispute.votes_innocent {
                dispute.status = DisputeStatus::Guilty;
            } else {
                dispute.status = DisputeStatus::Innocent;
            }
        }

        msg!("Dispute vote recorded");
        Ok(())
    }
}

// === Account Structures ===

#[account]
pub struct GovernanceConfig {
    pub admin: Pubkey,
    pub proposal_count: u64,
    pub bump: u8,
}

#[account]
pub struct ArbiterRecord {
    pub arbiter: Pubkey,
    pub registered_at: i64,
    pub is_active: bool,
    pub bump: u8,
}

#[account]
pub struct Proposal {
    pub proposer: Pubkey,
    pub title: String,
    pub description: String,
    pub committee_type: CommitteeType,
    pub proposal_type: ProposalType,
    pub status: ProposalStatus,
    pub votes_for: u64,
    pub votes_against: u64,
    pub total_votes: u64,
    pub created_at: i64,
    pub voting_ends_at: i64,
    pub bump: u8,
}

// FIX #3: VoteRecord for dedup
#[account]
pub struct VoteRecord {
    pub voter: Pubkey,
    pub proposal: Pubkey,
    pub vote_for: bool,
    pub vote_weight: u64,
    pub voted_at: i64,
    pub bump: u8,
}

#[account]
pub struct Dispute {
    pub plaintiff: Pubkey,
    pub target_user: Pubkey,
    pub evidence_uri: String,
    pub dispute_type: DisputeType,
    pub status: DisputeStatus,
    pub votes_guilty: u8,
    pub votes_innocent: u8,
    pub created_at: i64,
    pub bump: u8,
}

// FIX #4: DisputeVote for arbiter dedup
#[account]
pub struct DisputeVote {
    pub arbiter: Pubkey,
    pub dispute: Pubkey,
    pub vote_guilty: bool,
    pub voted_at: i64,
    pub bump: u8,
}

// Enums
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum CommitteeType { Development, Content, Operations, Arbitration, Technical }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum ProposalType { PolicyChange, BudgetAllocation, PartnershipApproval, CodeUpgrade, Other }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum ProposalStatus { UnderReview, Voting, Passed, Failed, Executed }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum DisputeType { Copyright, Scam, Harassment, Other }

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum DisputeStatus { UnderReview, Guilty, Innocent }

// === Contexts ===

#[derive(Accounts)]
pub struct InitializeGovernance<'info> {
    #[account(
        init, payer = admin,
        space = 8 + 32 + 8 + 1,
        seeds = [b"governance_config"],
        bump
    )]
    pub governance_config: Account<'info, GovernanceConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterArbiter<'info> {
    #[account(
        seeds = [b"governance_config"],
        bump = governance_config.bump,
        has_one = admin @ ErrorCode::Unauthorized
    )]
    pub governance_config: Account<'info, GovernanceConfig>,
    #[account(
        init, payer = admin,
        space = 8 + 32 + 8 + 1 + 1,
        seeds = [b"arbiter", arbiter.key().as_ref()],
        bump
    )]
    pub arbiter_record: Account<'info, ArbiterRecord>,
    /// CHECK: Arbiter being registered
    pub arbiter: AccountInfo<'info>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(title: String)]
pub struct CreateProposal<'info> {
    #[account(
        init, payer = proposer,
        space = 8 + 32 + (4 + 100) + (4 + 5000) + 1 + 1 + 1 + 8 + 8 + 8 + 8 + 8 + 1,
        seeds = [b"proposal", proposer.key().as_ref(), title.as_bytes()],
        bump
    )]
    pub proposal: Account<'info, Proposal>,
    #[account(mut)]
    pub proposer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// FIX #3: VoteRecord PDA prevents double voting
#[derive(Accounts)]
pub struct VoteOnProposal<'info> {
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,
    #[account(
        init, payer = voter,
        space = 8 + 32 + 32 + 1 + 8 + 8 + 1,
        seeds = [b"vote", proposal.key().as_ref(), voter.key().as_ref()],
        bump
    )]
    pub vote_record: Account<'info, VoteRecord>,
    /// Voter's ORA token account (to read balance for √ voting)
    pub voter_ora_account: Account<'info, anchor_spl::token::TokenAccount>,
    #[account(mut)]
    pub voter: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteProposal<'info> {
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreateDispute<'info> {
    #[account(
        init, payer = plaintiff,
        space = 8 + 32 + 32 + (4 + 200) + 1 + 1 + 1 + 1 + 8 + 1,
        seeds = [b"dispute", plaintiff.key().as_ref(), target_user.key().as_ref()],
        bump
    )]
    pub dispute: Account<'info, Dispute>,
    #[account(mut)]
    pub plaintiff: Signer<'info>,
    /// CHECK: Target user
    pub target_user: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

// FIX #4: Arbiter must be registered + dispute vote PDA for dedup
#[derive(Accounts)]
pub struct VoteOnDispute<'info> {
    #[account(mut)]
    pub dispute: Account<'info, Dispute>,
    #[account(
        seeds = [b"arbiter", arbiter.key().as_ref()],
        bump = arbiter_record.bump,
        constraint = arbiter_record.arbiter == arbiter.key() @ ErrorCode::Unauthorized
    )]
    pub arbiter_record: Account<'info, ArbiterRecord>,
    #[account(
        init, payer = arbiter,
        space = 8 + 32 + 32 + 1 + 8 + 1,
        seeds = [b"dispute_vote", dispute.key().as_ref(), arbiter.key().as_ref()],
        bump
    )]
    pub dispute_vote: Account<'info, DisputeVote>,
    #[account(mut)]
    pub arbiter: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Title is too long (max 100)")] TitleTooLong,
    #[msg("Description is too long (max 5000)")] DescriptionTooLong,
    #[msg("Proposal is not in voting status")] ProposalNotVoting,
    #[msg("Voting period has ended")] VotingEnded,
    #[msg("Voting period has not ended")] VotingNotEnded,
    #[msg("Invalid vote weight")] InvalidVoteWeight,
    #[msg("Invalid proposal status")] InvalidProposalStatus,
    #[msg("Evidence URI is too long")] EvidenceUriTooLong,
    #[msg("Dispute already resolved")] DisputeAlreadyResolved,
    #[msg("Unauthorized")] Unauthorized,
    #[msg("Arbiter is not active")] ArbiterNotActive,
    #[msg("Overflow")] Overflow,
}
