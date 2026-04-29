use anchor_lang::prelude::*;

declare_id!("GoBjYZJngPdQe2wEgzu4bE74PPDFa8XGKqVadFuM8pEg");

#[program]
pub mod aura_reputation {
    use super::*;

    /// Mint a new Reputation SBT for a creator
    pub fn mint_reputation_sbt(ctx: Context<MintReputationSBT>) -> Result<()> {
        let sbt = &mut ctx.accounts.reputation_sbt;
        let clock = Clock::get()?;

        sbt.creator = ctx.accounts.creator.key();
        sbt.joined_at = clock.unix_timestamp;
        sbt.total_posts = 0;
        sbt.total_earnings = 0;
        sbt.followers = 0;
        sbt.curation_score = 0;
        sbt.reputation_tier = ReputationTier::Bronze;
        sbt.is_transferable = false; // Soulbound - cannot be transferred
        sbt.last_updated = clock.unix_timestamp;
        sbt.bump = ctx.bumps.reputation_sbt;

        msg!(
            "Reputation SBT minted for creator: {} with tier: {:?}",
            sbt.creator,
            sbt.reputation_tier
        );
        Ok(())
    }

    /// Update reputation data and recalculate tier
    pub fn update_reputation(
        ctx: Context<UpdateReputation>,
        total_posts: u32,
        total_earnings: u64,
        followers: u32,
        curation_score: u64,
    ) -> Result<()> {
        let sbt = &mut ctx.accounts.reputation_sbt;
        let clock = Clock::get()?;

        // Update metrics
        sbt.total_posts = total_posts;
        sbt.total_earnings = total_earnings;
        sbt.followers = followers;
        sbt.curation_score = curation_score;
        sbt.last_updated = clock.unix_timestamp;

        // Calculate and update reputation tier
        let new_tier = calculate_reputation_tier(
            total_posts,
            total_earnings,
            followers,
            curation_score,
        )?;
        
        let old_tier = sbt.reputation_tier.clone();
        sbt.reputation_tier = new_tier.clone();

        msg!(
            "Reputation updated for creator: {} | Tier: {:?} -> {:?}",
            sbt.creator,
            old_tier,
            new_tier
        );
        msg!(
            "Stats: Posts={}, Earnings={}, Followers={}, Curation={}",
            total_posts,
            total_earnings,
            followers,
            curation_score
        );
        Ok(())
    }

    /// Verify that a reputation SBT cannot be transferred (enforcement)
    pub fn prevent_transfer(_ctx: Context<PreventTransfer>) -> Result<()> {
        // This function always fails, preventing any transfer attempts
        return Err(ErrorCode::SoulboundTransferNotAllowed.into());
    }

    /// Get reputation tier information (view function)
    pub fn get_reputation_tier(ctx: Context<GetReputationTier>) -> Result<()> {
        let sbt = &ctx.accounts.reputation_sbt;
        
        msg!("Creator: {}", sbt.creator);
        msg!("Reputation Tier: {:?}", sbt.reputation_tier);
        msg!("Total Posts: {}", sbt.total_posts);
        msg!("Total Earnings: {}", sbt.total_earnings);
        msg!("Followers: {}", sbt.followers);
        msg!("Curation Score: {}", sbt.curation_score);
        msg!("Joined At: {}", sbt.joined_at);
        msg!("Last Updated: {}", sbt.last_updated);
        
        Ok(())
    }
}

/// Calculate reputation tier based on creator metrics
/// 
/// Tier calculation algorithm considers:
/// - Total posts: Consistency and productivity
/// - Total earnings: Economic impact and value creation
/// - Followers: Community size and influence
/// - Curation score: Quality of content (early discovery rewards)
/// 
/// Scoring formula:
/// score = (posts * 10) + (earnings / 10000) + (followers * 5) + (curation_score / 100)
fn calculate_reputation_tier(
    total_posts: u32,
    total_earnings: u64,
    followers: u32,
    curation_score: u64,
) -> Result<ReputationTier> {
    // Calculate weighted score
    let posts_score = (total_posts as u64)
        .checked_mul(10)
        .unwrap();
    
    let earnings_score = total_earnings
        .checked_div(10000)
        .unwrap_or(0);
    
    let followers_score = (followers as u64)
        .checked_mul(5)
        .unwrap();
    
    let curation_score_weighted = curation_score
        .checked_div(100)
        .unwrap_or(0);
    
    let total_score = posts_score
        .checked_add(earnings_score)
        .unwrap()
        .checked_add(followers_score)
        .unwrap()
        .checked_add(curation_score_weighted)
        .unwrap();

    // Determine tier based on total score
    // Bronze: 0-999
    // Silver: 1000-4999
    // Gold: 5000-19999
    // Platinum: 20000-49999
    // Diamond: 50000+
    let tier = if total_score >= 50000 {
        ReputationTier::Diamond
    } else if total_score >= 20000 {
        ReputationTier::Platinum
    } else if total_score >= 5000 {
        ReputationTier::Gold
    } else if total_score >= 1000 {
        ReputationTier::Silver
    } else {
        ReputationTier::Bronze
    };

    msg!(
        "Reputation calculation: score={} (posts={}, earnings={}, followers={}, curation={})",
        total_score,
        posts_score,
        earnings_score,
        followers_score,
        curation_score_weighted
    );

    Ok(tier)
}

// Account structures
#[account]
pub struct ReputationSBT {
    /// Creator's wallet address
    pub creator: Pubkey,
    
    /// Timestamp when creator joined AURA
    pub joined_at: i64,
    
    /// Total number of posts created
    pub total_posts: u32,
    
    /// Total earnings in lamports (USDC equivalent)
    pub total_earnings: u64,
    
    /// Total number of followers
    pub followers: u32,
    
    /// Accumulated curation score from early content discovery
    pub curation_score: u64,
    
    /// Current reputation tier
    pub reputation_tier: ReputationTier,
    
    /// Soulbound property - cannot be transferred
    pub is_transferable: bool,
    
    /// Last time the reputation was updated
    pub last_updated: i64,
    
    /// PDA bump seed
    pub bump: u8,
}

// Enums
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
pub enum ReputationTier {
    Bronze,    // Entry level: 0-999 score
    Silver,    // Active creator: 1000-4999 score
    Gold,      // Established creator: 5000-19999 score
    Platinum,  // Top creator: 20000-49999 score
    Diamond,   // Elite creator: 50000+ score
}

// Context structures
#[derive(Accounts)]
pub struct MintReputationSBT<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + 32 + 8 + 4 + 8 + 4 + 8 + 1 + 1 + 8 + 1,
        seeds = [b"reputation_sbt", creator.key().as_ref()],
        bump
    )]
    pub reputation_sbt: Account<'info, ReputationSBT>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateReputation<'info> {
    #[account(
        mut,
        seeds = [b"reputation_sbt", creator.key().as_ref()],
        bump = reputation_sbt.bump,
        has_one = creator
    )]
    pub reputation_sbt: Account<'info, ReputationSBT>,
    
    /// CHECK: This is the creator's authority
    pub creator: AccountInfo<'info>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct PreventTransfer<'info> {
    #[account(
        seeds = [b"reputation_sbt", reputation_sbt.creator.as_ref()],
        bump = reputation_sbt.bump
    )]
    pub reputation_sbt: Account<'info, ReputationSBT>,
    
    pub from: Signer<'info>,
    
    /// CHECK: Any destination (will be rejected)
    pub to: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct GetReputationTier<'info> {
    #[account(
        seeds = [b"reputation_sbt", creator.key().as_ref()],
        bump = reputation_sbt.bump
    )]
    pub reputation_sbt: Account<'info, ReputationSBT>,
    
    /// CHECK: Creator whose reputation we're querying
    pub creator: AccountInfo<'info>,
}

// Error codes
#[error_code]
pub enum ErrorCode {
    #[msg("Soulbound token cannot be transferred")]
    SoulboundTransferNotAllowed,
    
    #[msg("Invalid reputation metrics")]
    InvalidReputationMetrics,
    
    #[msg("Unauthorized reputation update")]
    UnauthorizedUpdate,
    
    #[msg("Reputation tier calculation failed")]
    TierCalculationFailed,


    #[msg("Arithmetic overflow")]
    Overflow,
}
