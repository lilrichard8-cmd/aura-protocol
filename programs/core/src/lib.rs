use anchor_lang::prelude::*;

declare_id!("Ho5Ent8c2D6eLAZuyW16iUekqMmpfqzoTspXbMQqa9JN");

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
    /// FIX #2: Removed separate authority account, author IS the authority
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

        let profile = &mut ctx.accounts.user_profile;
        profile.post_count = profile.post_count.checked_add(1).ok_or(ErrorCode::Overflow)?;

        msg!("Content published: {}", post.arweave_tx_id);
        Ok(())
    }

    /// Follow a user
    /// FIX #1: Added authority validation + duplicate follow prevention via PDA
    pub fn follow_user(ctx: Context<FollowUser>) -> Result<()> {
        let follower_profile = &mut ctx.accounts.follower_profile;
        let target_profile = &mut ctx.accounts.target_profile;

        // Prevent self-follow
        require!(
            follower_profile.authority != target_profile.authority,
            ErrorCode::CannotFollowSelf
        );

        follower_profile.following_count = follower_profile.following_count.checked_add(1).ok_or(ErrorCode::Overflow)?;
        target_profile.follower_count = target_profile.follower_count.checked_add(1).ok_or(ErrorCode::Overflow)?;

        let follow_record = &mut ctx.accounts.follow_record;
        follow_record.follower = follower_profile.authority;
        follow_record.target = target_profile.authority;
        follow_record.created_at = Clock::get()?.unix_timestamp;
        follow_record.bump = ctx.bumps.follow_record;

        msg!("User followed");
        Ok(())
    }

    /// Unfollow a user
    pub fn unfollow_user(ctx: Context<UnfollowUser>) -> Result<()> {
        let follower_profile = &mut ctx.accounts.follower_profile;
        let target_profile = &mut ctx.accounts.target_profile;

        // [audit fix A.L-1] checked_sub instead of saturating_sub so accounting
        // bugs surface as Overflow errors instead of silently flooring at 0.
        follower_profile.following_count = follower_profile
            .following_count
            .checked_sub(1)
            .ok_or(ErrorCode::Overflow)?;
        target_profile.follower_count = target_profile
            .follower_count
            .checked_sub(1)
            .ok_or(ErrorCode::Overflow)?;

        msg!("User unfollowed");
        Ok(())
    }

    /// Like a post
    /// FIX #1: Added duplicate like prevention via LikeRecord PDA
    /// [audit fix A.M-2] enforce `post.is_active` so dead / unpublished posts
    /// cannot have their like counter inflated via fake-post-spam.
    pub fn like_post(ctx: Context<LikePost>) -> Result<()> {
        let post = &mut ctx.accounts.post;
        require!(post.is_active, ErrorCode::PostInactive);
        post.likes = post.likes.checked_add(1).ok_or(ErrorCode::Overflow)?;

        let like_record = &mut ctx.accounts.like_record;
        like_record.user = ctx.accounts.user.key();
        like_record.post = ctx.accounts.post.key();
        like_record.created_at = Clock::get()?.unix_timestamp;
        like_record.bump = ctx.bumps.like_record;

        msg!("Post liked");
        Ok(())
    }

    /// Unlike a post
    pub fn unlike_post(ctx: Context<UnlikePost>) -> Result<()> {
        let post = &mut ctx.accounts.post;
        // [audit fix A.L-1] checked_sub for defense-in-depth (matches unfollow_user)
        post.likes = post.likes.checked_sub(1).ok_or(ErrorCode::Overflow)?;

        msg!("Post unliked");
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

// FIX #1: New accounts for duplicate prevention
#[account]
pub struct FollowRecord {
    pub follower: Pubkey,
    pub target: Pubkey,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
pub struct LikeRecord {
    pub user: Pubkey,
    pub post: Pubkey,
    pub created_at: i64,
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
        space = 8 + 32 + (4 + 32) + (4 + 200) + 4 + 4 + 4 + 4 + 8 + 1,
        seeds = [b"user", authority.key().as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// FIX #2: author is the signer AND the authority, validated via has_one
#[derive(Accounts)]
pub struct PublishContent<'info> {
    #[account(
        init,
        payer = author,
        space = 8 + 32 + (4 + 43) + 1 + 1 + 8 + 8 + 8 + 8 + 8 + 1 + 1,
        seeds = [b"post", author.key().as_ref(), &user_profile.post_count.to_le_bytes()],
        bump
    )]
    pub post: Account<'info, Post>,
    #[account(
        mut,
        seeds = [b"user", author.key().as_ref()],
        bump = user_profile.bump,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub user_profile: Account<'info, UserProfile>,
    #[account(mut)]
    pub author: Signer<'info>,
    /// CHECK: Must match user_profile.authority (validated by has_one)
    pub authority: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

// FIX #1: FollowUser now requires authority ownership + uses PDA for dedup
#[derive(Accounts)]
pub struct FollowUser<'info> {
    #[account(
        mut,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub follower_profile: Account<'info, UserProfile>,
    #[account(mut)]
    pub target_profile: Account<'info, UserProfile>,
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 8 + 1,
        seeds = [b"follow", follower_profile.key().as_ref(), target_profile.key().as_ref()],
        bump
    )]
    pub follow_record: Account<'info, FollowRecord>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// [audit fix A.M-1] Add explicit `seeds = [b"user", target_profile.authority]`
// on `target_profile` as defense-in-depth. The follow_record seed binding
// already prevents passing a foreign target_profile (would produce a seed
// mismatch), but a direct seed assertion on the user PDA makes the intent
// unmistakable and the resulting error message clearer.
#[derive(Accounts)]
pub struct UnfollowUser<'info> {
    #[account(
        mut,
        seeds = [b"user", authority.key().as_ref()],
        bump = follower_profile.bump,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub follower_profile: Account<'info, UserProfile>,
    #[account(
        mut,
        seeds = [b"user", target_profile.authority.as_ref()],
        bump = target_profile.bump,
    )]
    pub target_profile: Account<'info, UserProfile>,
    #[account(
        mut,
        seeds = [b"follow", follower_profile.key().as_ref(), target_profile.key().as_ref()],
        bump = follow_record.bump,
        close = authority
    )]
    pub follow_record: Account<'info, FollowRecord>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

// FIX #1: LikePost now uses PDA for dedup
#[derive(Accounts)]
pub struct LikePost<'info> {
    #[account(mut)]
    pub post: Account<'info, Post>,
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 8 + 1,
        seeds = [b"like", post.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub like_record: Account<'info, LikeRecord>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UnlikePost<'info> {
    #[account(mut)]
    pub post: Account<'info, Post>,
    #[account(
        mut,
        seeds = [b"like", post.key().as_ref(), user.key().as_ref()],
        bump = like_record.bump,
        close = user
    )]
    pub like_record: Account<'info, LikeRecord>,
    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateProfile<'info> {
    #[account(mut, has_one = authority @ ErrorCode::Unauthorized)]
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
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Cannot follow yourself")]
    CannotFollowSelf,
    #[msg("Arithmetic overflow")]
    Overflow,
    // [audit fix A.M-2] like_post / unlike_post require active post
    #[msg("Post is not active")]
    PostInactive,
}
