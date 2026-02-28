use anchor_lang::prelude::*;

declare_id!("SocialGraphProgram1111111111111111111111111111");

#[program]
pub mod aura_social_graph {
    use super::*;

    /// Initialize a social graph NFT for a user
    pub fn initialize_social_graph(
        ctx: Context<InitializeSocialGraph>,
        graph_uri: String,
        portable: bool,
    ) -> Result<()> {
        require!(graph_uri.len() <= 200, ErrorCode::GraphUriTooLong);

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

    /// Follow a creator (updates user's NFT, not platform database)
    pub fn follow_creator(
        ctx: Context<FollowCreator>,
        creator: Pubkey,
    ) -> Result<()> {
        let social_graph = &mut ctx.accounts.social_graph_nft;
        
        // Check if already following
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

        // Increment the target creator's follower count
        let target_graph = &mut ctx.accounts.target_social_graph_nft;
        target_graph.followers_count = target_graph.followers_count.checked_add(1).ok_or(ErrorCode::Overflow)?;

        msg!(
            "User {} now following creator {} (total: {})",
            social_graph.owner,
            creator,
            social_graph.following.len()
        );
        Ok(())
    }

    /// Unfollow a creator
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
        target_graph.followers_count = target_graph.followers_count.checked_sub(1).ok_or(ErrorCode::Overflow)?;

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
        require!(new_graph_uri.len() <= 200, ErrorCode::GraphUriTooLong);

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
#[instruction(creator: Pubkey)]
pub struct FollowCreator<'info> {
    #[account(
        mut,
        seeds = [b"social_graph", owner.key().as_ref()],
        bump = social_graph_nft.bump,
        has_one = owner,
        realloc = 8 + 32 + (4 + 32*(social_graph_nft.following.len() + 1)) + 4 + (4 + social_graph_nft.graph_uri.len()) + 1 + 8 + 1,
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
        realloc = 8 + 32 + (4 + 32*(social_graph_nft.following.len().saturating_sub(1))) + 4 + (4 + social_graph_nft.graph_uri.len()) + 1 + 8 + 1,
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
}
