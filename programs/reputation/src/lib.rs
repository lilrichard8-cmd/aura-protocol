use anchor_lang::prelude::*;

declare_id!("EoTfniRTgWhRD58bjUBSLk1rGR98tzfGZdVZuJXh8es8");

// ╔═════════════════════════════════════════════════════════════════════╗
// ║  ⚠️ ⚠️ ⚠️  DO NOT DEPLOY TO MAINNET  ⚠️ ⚠️ ⚠️                            ║
// ║                                                                  ║
// ║  `MINT_AUTHORITY` below is set to `system_program::ID` as a       ║
// ║  placeholder. Deploying with this placeholder bricks               ║
// ║  `update_reputation` permanently — no human can sign as the        ║
// ║  System Program, so the `address = MINT_AUTHORITY` constraint     ║
// ║  will never be satisfied. [audit fix round2 R2-R-H1]               ║
// ║                                                                  ║
// ║  Before mainnet:                                                  ║
// ║    1. Replace `MINT_AUTHORITY` with the real reputation-oracle    ║
// ║       multisig pubkey.                                            ║
// ║    2. Confirm `assert_mint_authority_configured` passes from your ║
// ║       deploy script (otherwise `update_reputation` will revert    ║
// ║       with `PlaceholderMintAuthority`).                            ║
// ╚═════════════════════════════════════════════════════════════════════╝

/// [audit fix R-C1] Hardcoded reputation oracle authority. Only this signer
/// may call `update_reputation`. Indexer-driven reputation systems require a
/// trusted, off-chain-computed source for the score; this constant pins it.
///
/// ⚠️ DO NOT DEPLOY — placeholder = system_program::ID. Replace with the
/// real AURA reputation oracle multisig pubkey before mainnet.
// [local-deploy 2026-05-19] real address on localnet: DppCZV1QDh6D4hoUJvpQCjiZ5KCjV4YTokUGsu7m4bxP
pub const MINT_AUTHORITY: Pubkey = Pubkey::new_from_array([190, 139, 232, 217, 216, 167, 202, 133, 100, 57, 237, 31, 194, 128, 82, 13, 164, 131, 226, 139, 206, 103, 215, 221, 251, 39, 85, 246, 98, 109, 149, 76]);

/// [audit fix round2 R2-R-H1] Runtime guard that aborts `update_reputation`
/// with a clear `PlaceholderMintAuthority` error when the constant above is
/// still the `system_program::ID` placeholder. Belt-and-suspenders — the
/// `address = MINT_AUTHORITY` constraint also blocks this path, but it
/// surfaces a generic `UnauthorizedUpdate` that conflates "wrong signer"
/// with "constants not yet replaced for deploy".
fn require_real_mint_authority_configured() -> Result<()> {
    let placeholder = anchor_lang::solana_program::system_program::ID;
    require!(
        MINT_AUTHORITY != placeholder,
        ErrorCode::PlaceholderMintAuthority
    );
    Ok(())
}

#[program]
pub mod aura_reputation {
    use super::*;

    /// Mint a new Reputation SBT for a creator.
    ///
    /// The SBT PDA is seeded on the signer's own pubkey, so each wallet can
    /// only ever mint its own SBT — no proxy minting. Non-transferability is
    /// guaranteed by the SBT being a program-owned PDA (Solana program
    /// accounts cannot be transferred between owners through SPL Token).
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
        // [audit fix R-C2] is_transferable is now a hard invariant: the SBT
        // is a program-owned PDA and cannot be transferred. We keep the
        // field for compatibility with off-chain indexers.
        sbt.is_transferable = false;
        sbt.last_updated = clock.unix_timestamp;
        sbt.bump = ctx.bumps.reputation_sbt;

        msg!(
            "Reputation SBT minted for creator: {} with tier: {:?}",
            sbt.creator,
            sbt.reputation_tier
        );
        Ok(())
    }

    /// Update reputation data and recalculate tier.
    ///
    /// [audit fix R-C1] Only the hardcoded `MINT_AUTHORITY` (reputation
    /// oracle) may call this. Previously any signer could update any
    /// creator's SBT — total trust failure.
    /// [audit fix round2 R2-R-H1] Reject if the placeholder constant is
    /// still in place — emits a distinct error so ops can tell deploy-not-
    /// configured apart from wrong-signer.
    pub fn update_reputation(
        ctx: Context<UpdateReputation>,
        total_posts: u32,
        total_earnings: u64,
        followers: u32,
        curation_score: u64,
    ) -> Result<()> {
        require_real_mint_authority_configured()?;

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

    /// Reject any attempt to transfer a Reputation SBT.
    ///
    /// [audit fix R-C2] Non-transferability is enforced structurally by the
    /// SBT being a program-owned PDA. This instruction exists purely as a
    /// belt-and-suspenders defence — if someone in v2 tries to add a
    /// transfer flow, calling this first will always abort.
    pub fn prevent_transfer(_ctx: Context<PreventTransfer>) -> Result<()> {
        Err(ErrorCode::SoulboundTransferNotAllowed.into())
    }

    /// [audit fix round2 R2-R-H1] SDK-callable no-op that surfaces the
    /// placeholder-mint-authority deploy-blocker as a clean error. Useful
    /// for ops scripts to pre-flight check before submitting `update_reputation`.
    pub fn assert_mint_authority_configured(_ctx: Context<NoopCtx>) -> Result<()> {
        require_real_mint_authority_configured()
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

/// Calculate reputation tier based on creator metrics.
///
/// [audit fix R-M1] Uses checked arithmetic with proper Overflow error
/// propagation instead of `.unwrap()` panics.
fn calculate_reputation_tier(
    total_posts: u32,
    total_earnings: u64,
    followers: u32,
    curation_score: u64,
) -> Result<ReputationTier> {
    let posts_score = (total_posts as u64)
        .checked_mul(10)
        .ok_or(ErrorCode::TierCalculationFailed)?;

    let earnings_score = total_earnings
        .checked_div(10000)
        .unwrap_or(0);

    let followers_score = (followers as u64)
        .checked_mul(5)
        .ok_or(ErrorCode::TierCalculationFailed)?;

    let curation_score_weighted = curation_score
        .checked_div(100)
        .unwrap_or(0);

    let total_score = posts_score
        .checked_add(earnings_score)
        .ok_or(ErrorCode::TierCalculationFailed)?
        .checked_add(followers_score)
        .ok_or(ErrorCode::TierCalculationFailed)?
        .checked_add(curation_score_weighted)
        .ok_or(ErrorCode::TierCalculationFailed)?;

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

    /// Soulbound property — informational. Non-transferability is enforced
    /// by the SBT being a program-owned PDA.
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
    /// The SBT being updated. Bound by seed to its own `creator` field.
    #[account(
        mut,
        seeds = [b"reputation_sbt", reputation_sbt.creator.as_ref()],
        bump = reputation_sbt.bump
    )]
    pub reputation_sbt: Account<'info, ReputationSBT>,

    // [audit fix R-C1] Only the hardcoded MINT_AUTHORITY (reputation oracle)
    // can update reputation. Anyone-signer was the original Critical vuln.
    #[account(address = MINT_AUTHORITY @ ErrorCode::UnauthorizedUpdate)]
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

/// [audit fix round2 R2-R-H1] No-op context used by
/// `assert_mint_authority_configured`. Mirrors market's `NoopCtx` pattern.
#[derive(Accounts)] pub struct NoopCtx {}

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

    /// [audit fix round2 R2-R-H1] Surfaced when `MINT_AUTHORITY` is still
    /// the `system_program::ID` placeholder. Distinct from
    /// `UnauthorizedUpdate` so ops can tell deploy-not-configured apart
    /// from a real authorization failure.
    #[msg("MINT_AUTHORITY constant is a placeholder — do not deploy")]
    PlaceholderMintAuthority,
}
