use anchor_lang::prelude::*;

declare_id!("GxvZT4AX7FUCv6HJTVFYPaFciH4ktsDVmXTgGjTZFnUN");

#[program]
pub mod aura_social_graph {
    use super::*;

    /// Initialize a social graph NFT for a user
    pub fn initialize_social_graph(
        ctx: Context<InitializeSocialGraph>,
        graph_uri: String,
        portable: bool,
    ) -> Result<()> {
        require!(graph_uri.len() <= MAX_GRAPH_URI_LEN, ErrorCode::GraphUriTooLong);

        let social_graph = &mut ctx.accounts.social_graph_nft;
        social_graph.owner = ctx.accounts.owner.key();
        social_graph.following = Vec::new();
        social_graph.followers_count = 0;
        social_graph.graph_uri = graph_uri;
        social_graph.portable = portable;
        social_graph.created_at = Clock::get()?.unix_timestamp;
        social_graph.bump = ctx.bumps.social_graph_nft;

        msg!("Social Graph NFT initialized for owner: {}", social_graph.owner);
        Ok(())
    }

    /// [audit fix SG-C2] Lazy-init the target's social graph NFT so users can
    /// be followed even if they haven't initialised their own graph yet.
    /// Permissionlessly callable by the follower at follow-time via
    /// `follow_creator`; we expose this helper for explicit pre-init too.
    pub fn lazy_init_target_graph(
        ctx: Context<LazyInitTargetGraph>,
        target: Pubkey,
    ) -> Result<()> {
        let graph = &mut ctx.accounts.target_social_graph_nft;
        // If the account is freshly initialised by Anchor (via init_if_needed),
        // owner will be Pubkey::default() and we must set it.
        if graph.owner == Pubkey::default() {
            graph.owner = target;
            graph.following = Vec::new();
            graph.followers_count = 0;
            graph.graph_uri = String::new();
            graph.portable = false;
            graph.created_at = Clock::get()?.unix_timestamp;
            graph.bump = ctx.bumps.target_social_graph_nft;
        }
        Ok(())
    }

    /// Follow a creator. [audit fix SG-C1] Creates a `FollowEdge` PDA bound
    /// to (follower, target) so duplicate follows fail at PDA creation
    /// (not just an in-memory `following.contains()` check that resets on
    /// realloc shrink). [audit fix SG-C2] Target graph is lazy-initialised
    /// if needed.
    pub fn follow_creator(
        ctx: Context<FollowCreator>,
        creator: Pubkey,
    ) -> Result<()> {
        // [audit fix round2 R2-SG-M1] Reject self-follow up-front with a
        // clean error. Otherwise Anchor would have failed with a confusing
        // double-mut-borrow error (`social_graph_nft` and
        // `target_social_graph_nft` would derive to the same PDA when
        // owner == creator), and a self-follow FollowEdge at
        // `[b"follow_edge", owner, owner]` would be cosmetically dangerous
        // in the event of a future Anchor relaxation.
        require!(
            ctx.accounts.owner.key() != creator,
            ErrorCode::CannotFollowSelf
        );

        let social_graph = &mut ctx.accounts.social_graph_nft;

        // Check if already following (defensive — FollowEdge init also enforces this).
        require!(
            !social_graph.following.contains(&creator),
            ErrorCode::AlreadyFollowing
        );

        // Check following limit (prevent excessive list size)
        require!(
            social_graph.following.len() < MAX_FOLLOWING_COUNT,
            ErrorCode::FollowingLimitReached
        );

        // Add creator to following list
        social_graph.following.push(creator);

        // [audit fix SG-C1] Record the FollowEdge PDA — duplicate follows
        // are now blocked at the PDA layer (init fails on existing account)
        // even across follow/unfollow churn.
        let edge = &mut ctx.accounts.follow_edge;
        edge.follower = ctx.accounts.owner.key();
        edge.target = creator;
        edge.created_at = Clock::get()?.unix_timestamp;
        edge.bump = ctx.bumps.follow_edge;

        // [audit fix SG-C2] Lazy-init the target's graph if needed so any
        // creator can be followed before they themselves have initialised.
        let target_graph = &mut ctx.accounts.target_social_graph_nft;
        if target_graph.owner == Pubkey::default() {
            target_graph.owner = creator;
            target_graph.following = Vec::new();
            target_graph.followers_count = 0;
            target_graph.graph_uri = String::new();
            target_graph.portable = false;
            target_graph.created_at = Clock::get()?.unix_timestamp;
            target_graph.bump = ctx.bumps.target_social_graph_nft;
        }

        // Increment the target creator's follower count
        target_graph.followers_count = target_graph
            .followers_count
            .checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        msg!(
            "User {} now following creator {} (total: {})",
            social_graph.owner,
            creator,
            social_graph.following.len()
        );
        Ok(())
    }

    /// Unfollow a creator. [audit fix SG-C1] Closes the FollowEdge PDA so a
    /// subsequent re-follow can re-init it cleanly (and is rate-limited by
    /// PDA rent re-payment).
    pub fn unfollow_creator(
        ctx: Context<UnfollowCreator>,
        creator: Pubkey,
    ) -> Result<()> {
        let social_graph = &mut ctx.accounts.social_graph_nft;

        // Find and remove creator from following list
        let position = social_graph.following.iter().position(|&x| x == creator);
        require!(position.is_some(), ErrorCode::NotFollowing);

        social_graph.following.remove(position.unwrap());

        // Decrement the target creator's follower count
        let target_graph = &mut ctx.accounts.target_social_graph_nft;
        target_graph.followers_count = target_graph
            .followers_count
            .checked_sub(1)
            .ok_or(ErrorCode::Overflow)?;

        msg!(
            "User {} unfollowed creator {} (remaining: {})",
            social_graph.owner,
            creator,
            social_graph.following.len()
        );
        Ok(())
    }

    /// Update graph URI (for storing complete graph on Arweave)
    pub fn update_graph_uri(
        ctx: Context<UpdateGraphUri>,
        new_graph_uri: String,
    ) -> Result<()> {
        require!(new_graph_uri.len() <= MAX_GRAPH_URI_LEN, ErrorCode::GraphUriTooLong);

        let social_graph = &mut ctx.accounts.social_graph_nft;
        social_graph.graph_uri = new_graph_uri;

        msg!("Graph URI updated for owner: {}", social_graph.owner);
        Ok(())
    }

    /// Toggle portable flag (allow/disallow cross-platform usage)
    pub fn toggle_portable(ctx: Context<TogglePortable>) -> Result<()> {
        let social_graph = &mut ctx.accounts.social_graph_nft;
        social_graph.portable = !social_graph.portable;

        msg!(
            "Portable flag toggled to {} for owner: {}",
            social_graph.portable,
            social_graph.owner
        );
        Ok(())
    }

    /// Get followers count (view function)
    pub fn get_followers_count(ctx: Context<GetFollowersCount>) -> Result<u32> {
        let social_graph = &ctx.accounts.social_graph_nft;
        msg!("Followers count for {}: {}", social_graph.owner, social_graph.followers_count);
        Ok(social_graph.followers_count)
    }

    /// Get following list (view function)
    pub fn get_following(ctx: Context<GetFollowing>) -> Result<Vec<Pubkey>> {
        let social_graph = &ctx.accounts.social_graph_nft;
        msg!(
            "Following count for {}: {}",
            social_graph.owner,
            social_graph.following.len()
        );
        Ok(social_graph.following.clone())
    }
}

// Constants
const MAX_FOLLOWING_COUNT: usize = 1000; // Maximum following list size

/// [audit fix SG-M2] Maximum graph_uri byte length. The on-chain account
/// always reserves space for this many bytes regardless of the URI's
/// current value — otherwise the `realloc=` expressions in FollowCreator/
/// UnfollowCreator would shrink the URI's reserved bytes down to the
/// current length, and a subsequent `update_graph_uri` to a longer URI
/// would fail with a Borsh out-of-bounds error.
const MAX_GRAPH_URI_LEN: usize = 200;

// Account structures
#[account]
pub struct SocialGraphNFT {
    pub owner: Pubkey,                  // User wallet address (32 bytes)
    pub following: Vec<Pubkey>,         // Following list (4 + 32*n bytes)
    pub followers_count: u32,           // Followers count (indexed off-chain) (4 bytes)
    pub graph_uri: String,              // Complete graph stored on Arweave (4 + 200 bytes)
    pub portable: bool,                 // Allow cross-platform usage (1 byte)
    pub created_at: i64,                // Creation timestamp (8 bytes)
    pub bump: u8,                       // PDA bump seed (1 byte)
}

/// [audit fix SG-C1] Per-(follower, target) edge PDA. Existence == "follower
/// currently follows target". Closed on unfollow.
#[account]
pub struct FollowEdge {
    pub follower: Pubkey,   // 32
    pub target: Pubkey,     // 32
    pub created_at: i64,    // 8
    pub bump: u8,           // 1
}

// Context structures
#[derive(Accounts)]
pub struct InitializeSocialGraph<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + 32 + (4 + 32*100) + 4 + (4 + 200) + 1 + 8 + 1,  // Allocate space for 100 initial following slots
        seeds = [b"social_graph", owner.key().as_ref()],
        bump
    )]
    pub social_graph_nft: Account<'info, SocialGraphNFT>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(target: Pubkey)]
pub struct LazyInitTargetGraph<'info> {
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + 32 + (4 + 32*100) + 4 + (4 + 200) + 1 + 8 + 1,
        seeds = [b"social_graph", target.as_ref()],
        bump
    )]
    pub target_social_graph_nft: Account<'info, SocialGraphNFT>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(creator: Pubkey)]
pub struct FollowCreator<'info> {
    #[account(
        mut,
        seeds = [b"social_graph", owner.key().as_ref()],
        bump = social_graph_nft.bump,
        has_one = owner,
        // [audit fix SG-M2] Reserve the full MAX_GRAPH_URI_LEN (200) bytes
        // for graph_uri regardless of its current value, so a subsequent
        // `update_graph_uri` call can grow the URI back up to the max
        // without needing its own realloc. Previously this used
        // `social_graph_nft.graph_uri.len()`, which silently shrank the
        // URI's reserved capacity on every follow.
        realloc = 8 + 32 + (4 + 32 * (social_graph_nft.following.len() + 1)) + 4 + (4 + 200) + 1 + 8 + 1,
        realloc::payer = owner,
        realloc::zero = false
    )]
    pub social_graph_nft: Account<'info, SocialGraphNFT>,

    // [audit fix SG-C2] init_if_needed so we can follow a creator who has
    // never initialised their own social graph.
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + 32 + (4 + 32*100) + 4 + (4 + 200) + 1 + 8 + 1,
        seeds = [b"social_graph", creator.as_ref()],
        bump
    )]
    pub target_social_graph_nft: Account<'info, SocialGraphNFT>,

    // [audit fix SG-C1] FollowEdge PDA — init fails if already following,
    // providing ground-truth dedup at the PDA layer (Sybil-resistant
    // proportional to the number of follower wallets actually paying rent).
    #[account(
        init,
        payer = owner,
        space = 8 + 32 + 32 + 8 + 1,
        seeds = [b"follow_edge", owner.key().as_ref(), creator.as_ref()],
        bump
    )]
    pub follow_edge: Account<'info, FollowEdge>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(creator: Pubkey)]
pub struct UnfollowCreator<'info> {
    #[account(
        mut,
        seeds = [b"social_graph", owner.key().as_ref()],
        bump = social_graph_nft.bump,
        has_one = owner,
        // [audit fix SG-M2] Same fix as FollowCreator — reserve the full
        // MAX_GRAPH_URI_LEN (200) bytes for graph_uri so unfollow cannot
        // silently shrink the URI capacity.
        realloc = 8 + 32 + (4 + 32 * (social_graph_nft.following.len().saturating_sub(1))) + 4 + (4 + 200) + 1 + 8 + 1,
        realloc::payer = owner,
        realloc::zero = false
    )]
    pub social_graph_nft: Account<'info, SocialGraphNFT>,

    #[account(
        mut,
        seeds = [b"social_graph", creator.as_ref()],
        bump = target_social_graph_nft.bump
    )]
    pub target_social_graph_nft: Account<'info, SocialGraphNFT>,

    // [audit fix SG-C1] Close the FollowEdge on unfollow; rent returns to
    // the follower. Re-following requires re-payment of rent, deterring
    // follow/unfollow churn.
    #[account(
        mut,
        close = owner,
        seeds = [b"follow_edge", owner.key().as_ref(), creator.as_ref()],
        bump = follow_edge.bump,
        has_one = follower @ ErrorCode::NotFollowing
    )]
    pub follow_edge: Account<'info, FollowEdge>,

    /// CHECK: must equal owner (used by FollowEdge.has_one = follower).
    #[account(address = owner.key() @ ErrorCode::NotFollowing)]
    pub follower: AccountInfo<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateGraphUri<'info> {
    #[account(
        mut,
        seeds = [b"social_graph", owner.key().as_ref()],
        bump = social_graph_nft.bump,
        has_one = owner
    )]
    pub social_graph_nft: Account<'info, SocialGraphNFT>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct TogglePortable<'info> {
    #[account(
        mut,
        seeds = [b"social_graph", owner.key().as_ref()],
        bump = social_graph_nft.bump,
        has_one = owner
    )]
    pub social_graph_nft: Account<'info, SocialGraphNFT>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct GetFollowersCount<'info> {
    #[account(
        seeds = [b"social_graph", social_graph_nft.owner.as_ref()],
        bump = social_graph_nft.bump
    )]
    pub social_graph_nft: Account<'info, SocialGraphNFT>,
}

#[derive(Accounts)]
pub struct GetFollowing<'info> {
    #[account(
        seeds = [b"social_graph", social_graph_nft.owner.as_ref()],
        bump = social_graph_nft.bump
    )]
    pub social_graph_nft: Account<'info, SocialGraphNFT>,
}

// Error codes
#[error_code]
pub enum ErrorCode {
    #[msg("Graph URI is too long (max 200 characters)")]
    GraphUriTooLong,

    #[msg("Already following this creator")]
    AlreadyFollowing,

    #[msg("Not following this creator")]
    NotFollowing,

    #[msg("Following limit reached (max 1000)")]
    FollowingLimitReached,

    #[msg("Arithmetic overflow")]
    Overflow,

    /// [audit fix round2 R2-SG-M1] Surfaced when a user tries to follow
    /// themselves. Previously this would fail with a generic Anchor
    /// double-mut-borrow error since the follower's graph and the target's
    /// graph derive to the same PDA.
    #[msg("Cannot follow yourself")]
    CannotFollowSelf,
}
