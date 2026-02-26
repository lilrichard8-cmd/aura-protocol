use anchor_lang::prelude::*;

declare_id!("CoreProgram11111111111111111111111111111111");

#[program]
pub mod aura_core {
    use super::*;

    /// Register a new user profile
    pub fn register_user(
        ctx: Context<RegisterUser>,
        username: String,
        profile_uri: String,
    ) -> Result<()> {
        require!(username.len() <= 32, ErrorCode::UsernameTooLong);
        require!(profile_uri.len() <= 200, ErrorCode::ProfileUriTooLong);

        let profile = &mut ctx.accounts.user_profile;
        profile.authority = ctx.accounts.authority.key();
        profile.username = username;
        profile.profile_uri = profile_uri;
        profile.reputation_score = 0;
        profile.follower_count = 0;
        profile.following_count = 0;
        profile.post_count = 0;
        profile.created_at = Clock::get()?.unix_timestamp;
        profile.bump = ctx.bumps.user_profile;

        msg!("User registered: {}", profile.username);
        Ok(())
    }

    /// Publish new content
    pub fn publish_content(
        ctx: Context<PublishContent>,
        arweave_tx_id: String,
        content_type: ContentType,
        access_control: AccessControl,
        price: u64,
    ) -> Result<()> {
        require!(arweave_tx_id.len() == 43, ErrorCode::InvalidArweaveId);

        let post = &mut ctx.accounts.post;
        post.author = ctx.accounts.author.key();
        post.arweave_tx_id = arweave_tx_id;
        post.content_type = content_type;
        post.access_control = access_control;
        post.price = price;
        post.likes = 0;
        post.views = 0;
        post.tips_received = 0;
        post.created_at = Clock::get()?.unix_timestamp;
        post.is_active = true;
        post.bump = ctx.bumps.post;

        // Increment user's post count
        let profile = &mut ctx.accounts.user_profile;
        profile.post_count = profile.post_count.checked_add(1).unwrap();

        msg!("Content published: {}", post.arweave_tx_id);
        Ok(())
    }

    /// Follow a user
    pub fn follow_user(ctx: Context<FollowUser>) -> Result<()> {
        let follower_profile = &mut ctx.accounts.follower_profile;
        let target_profile = &mut ctx.accounts.target_profile;

        follower_profile.following_count = follower_profile.following_count.checked_add(1).unwrap();
        target_profile.follower_count = target_profile.follower_count.checked_add(1).unwrap();

        msg!("User followed");
        Ok(())
    }

    /// Like a post
    pub fn like_post(ctx: Context<LikePost>) -> Result<()> {
        let post = &mut ctx.accounts.post;
        post.likes = post.likes.checked_add(1).unwrap();

        msg!("Post liked");
        Ok(())
    }

    /// Update profile
    pub fn update_profile(
        ctx: Context<UpdateProfile>,
        new_profile_uri: String,
    ) -> Result<()> {
        require!(new_profile_uri.len() <= 200, ErrorCode::ProfileUriTooLong);

        let profile = &mut ctx.accounts.user_profile;
        profile.profile_uri = new_profile_uri;

        msg!("Profile updated");
        Ok(())
    }
}

// Account structures
#[account]
pub struct UserProfile {
    pub authority: Pubkey,
    pub username: String,
    pub profile_uri: String,
    pub reputation_score: u32,
    pub follower_count: u32,
    pub following_count: u32,
    pub post_count: u32,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
pub struct Post {
    pub author: Pubkey,
    pub arweave_tx_id: String,
    pub content_type: ContentType,
    pub access_control: AccessControl,
    pub price: u64,
    pub likes: u64,
    pub views: u64,
    pub tips_received: u64,
    pub created_at: i64,
    pub is_active: bool,
    pub bump: u8,
}

// Enums
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum ContentType {
    Text,
    Image,
    Video,
    Audio,
    Mixed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum AccessControl {
    Public,
    PayToView,
    BurnAfterReading,
}

// Context structures
#[derive(Accounts)]
#[instruction(username: String)]
pub struct RegisterUser<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 36 + 204 + 4 + 4 + 4 + 4 + 8 + 1,
        seeds = [b"user", authority.key().as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PublishContent<'info> {
    #[account(
        init,
        payer = author,
        space = 8 + 32 + 47 + 1 + 1 + 8 + 8 + 8 + 8 + 8 + 1 + 1,
        seeds = [b"post", author.key().as_ref(), &user_profile.post_count.to_le_bytes()],
        bump
    )]
    pub post: Account<'info, Post>,
    
    #[account(mut, has_one = authority)]
    pub user_profile: Account<'info, UserProfile>,
    
    #[account(mut)]
    pub author: Signer<'info>,
    
    /// CHECK: This is the authority of the user profile
    pub authority: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FollowUser<'info> {
    #[account(mut)]
    pub follower_profile: Account<'info, UserProfile>,
    
    #[account(mut)]
    pub target_profile: Account<'info, UserProfile>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct LikePost<'info> {
    #[account(mut)]
    pub post: Account<'info, Post>,
    
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateProfile<'info> {
    #[account(mut, has_one = authority)]
    pub user_profile: Account<'info, UserProfile>,
    
    pub authority: Signer<'info>,
}

// Error codes
#[error_code]
pub enum ErrorCode {
    #[msg("Username is too long (max 32 characters)")]
    UsernameTooLong,
    
    #[msg("Profile URI is too long (max 200 characters)")]
    ProfileUriTooLong,
    
    #[msg("Invalid Arweave transaction ID (must be 43 characters)")]
    InvalidArweaveId,
}
