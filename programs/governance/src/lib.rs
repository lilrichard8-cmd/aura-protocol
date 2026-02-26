use anchor_lang::prelude::*;

declare_id!("GovernanceProgram111111111111111111111111111");

#[program]
pub mod aura_governance {
    use super::*;

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
        proposal.status = ProposalStatus::UnderReview;
        proposal.votes_for = 0;
        proposal.votes_against = 0;
        proposal.total_votes = 0;
        proposal.created_at = clock.unix_timestamp;
        proposal.voting_ends_at = clock.unix_timestamp + (7 * 24 * 60 * 60); // 7 days
        proposal.bump = ctx.bumps.proposal;

        msg!("Proposal created: {}", proposal.title);
        Ok(())
    }

    /// Vote on a proposal
    pub fn vote_on_proposal(
        ctx: Context<VoteOnProposal>,
        vote_for: bool,
        vote_weight: u64,
    ) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        let clock = Clock::get()?;

        require!(
            proposal.status == ProposalStatus::Voting,
            ErrorCode::ProposalNotVoting
        );
        require!(
            clock.unix_timestamp < proposal.voting_ends_at,
            ErrorCode::VotingEnded
        );
        require!(vote_weight > 0, ErrorCode::InvalidVoteWeight);

        if vote_for {
            proposal.votes_for = proposal.votes_for.checked_add(vote_weight).unwrap();
        } else {
            proposal.votes_against = proposal.votes_against.checked_add(vote_weight).unwrap();
        }
        proposal.total_votes = proposal.total_votes.checked_add(vote_weight).unwrap();

        msg!("Voted on proposal with weight: {}", vote_weight);
        Ok(())
    }

    /// Execute a passed proposal
    pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        let clock = Clock::get()?;

        require!(
            clock.unix_timestamp >= proposal.voting_ends_at,
            ErrorCode::VotingNotEnded
        );
        require!(
            proposal.status == ProposalStatus::Voting,
            ErrorCode::InvalidProposalStatus
        );

        // Determine if proposal passed (simple majority)
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

    /// Vote on dispute (arbitration committee only)
    pub fn vote_on_dispute(
        ctx: Context<VoteOnDispute>,
        vote_guilty: bool,
    ) -> Result<()> {
        let dispute = &mut ctx.accounts.dispute;

        require!(
            dispute.status == DisputeStatus::UnderReview,
            ErrorCode::DisputeAlreadyResolved
        );

        if vote_guilty {
            dispute.votes_guilty = dispute.votes_guilty.checked_add(1).unwrap();
        } else {
            dispute.votes_innocent = dispute.votes_innocent.checked_add(1).unwrap();
        }

        // If 4 out of 7 votes reached, resolve dispute
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

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum CommitteeType {
    Development,
    Content,
    Operations,
    Arbitration,
    Technical,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum ProposalType {
    PolicyChange,
    BudgetAllocation,
    PartnershipApproval,
    CodeUpgrade,
    Other,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum ProposalStatus {
    UnderReview,
    Voting,
    Passed,
    Failed,
    Executed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum DisputeType {
    Copyright,
    Scam,
    Harassment,
    Other,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum DisputeStatus {
    UnderReview,
    Guilty,
    Innocent,
}

#[derive(Accounts)]
#[instruction(title: String)]
pub struct CreateProposal<'info> {
    #[account(
        init,
        payer = proposer,
        space = 8 + 32 + 104 + 5004 + 1 + 1 + 1 + 8 + 8 + 8 + 8 + 8 + 1,
        seeds = [b"proposal", proposer.key().as_ref(), title.as_bytes()],
        bump
    )]
    pub proposal: Account<'info, Proposal>,
    
    #[account(mut)]
    pub proposer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VoteOnProposal<'info> {
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,
    
    pub voter: Signer<'info>,
}

#[derive(Accounts)]
pub struct ExecuteProposal<'info> {
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,
    
    /// CHECK: Committee authority
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreateDispute<'info> {
    #[account(
        init,
        payer = plaintiff,
        space = 8 + 32 + 32 + 204 + 1 + 1 + 1 + 1 + 8 + 1,
        seeds = [b"dispute", plaintiff.key().as_ref(), target_user.key().as_ref()],
        bump
    )]
    pub dispute: Account<'info, Dispute>,
    
    #[account(mut)]
    pub plaintiff: Signer<'info>,
    
    /// CHECK: Target user being disputed
    pub target_user: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VoteOnDispute<'info> {
    #[account(mut)]
    pub dispute: Account<'info, Dispute>,
    
    /// CHECK: Arbitration committee member
    pub arbiter: Signer<'info>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Title is too long (max 100 characters)")]
    TitleTooLong,
    
    #[msg("Description is too long (max 5000 characters)")]
    DescriptionTooLong,
    
    #[msg("Proposal is not in voting status")]
    ProposalNotVoting,
    
    #[msg("Voting period has ended")]
    VotingEnded,
    
    #[msg("Voting period has not ended")]
    VotingNotEnded,
    
    #[msg("Invalid vote weight")]
    InvalidVoteWeight,
    
    #[msg("Invalid proposal status")]
    InvalidProposalStatus,
    
    #[msg("Evidence URI is too long")]
    EvidenceUriTooLong,
    
    #[msg("Dispute already resolved")]
    DisputeAlreadyResolved,
}
