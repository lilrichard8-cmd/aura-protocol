use anchor_lang::prelude::*;

declare_id!("MarketProgram111111111111111111111111111111");

#[program]
pub mod aura_market {
    use super::*;

    /// Create a marketplace listing
    pub fn create_listing(
        ctx: Context<CreateListing>,
        price: u64,
        listing_type: ListingType,
    ) -> Result<()> {
        require!(price > 0, ErrorCode::InvalidPrice);

        let listing = &mut ctx.accounts.listing;
        listing.seller = ctx.accounts.seller.key();
        listing.nft_mint = ctx.accounts.nft_mint.key();
        listing.price = price;
        listing.listing_type = listing_type;
        listing.created_at = Clock::get()?.unix_timestamp;
        listing.is_active = true;
        listing.bump = ctx.bumps.listing;

        msg!("Listing created with price: {}", price);
        Ok(())
    }

    /// Cancel a listing
    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        let listing = &mut ctx.accounts.listing;
        listing.is_active = false;

        msg!("Listing cancelled");
        Ok(())
    }

    /// Create a bounty
    pub fn create_bounty(
        ctx: Context<CreateBounty>,
        title: String,
        description: String,
        reward_amount: u64,
        deadline: i64,
    ) -> Result<()> {
        require!(title.len() <= 100, ErrorCode::TitleTooLong);
        require!(description.len() <= 1000, ErrorCode::DescriptionTooLong);
        require!(reward_amount > 0, ErrorCode::InvalidAmount);

        let bounty = &mut ctx.accounts.bounty;
        bounty.creator = ctx.accounts.creator.key();
        bounty.title = title;
        bounty.description = description;
        bounty.reward_amount = reward_amount;
        bounty.deadline = deadline;
        bounty.status = BountyStatus::Open;
        bounty.submission_count = 0;
        bounty.winner = Pubkey::default();
        bounty.created_at = Clock::get()?.unix_timestamp;
        bounty.bump = ctx.bumps.bounty;

        msg!("Bounty created with reward: {}", reward_amount);
        Ok(())
    }

    /// Submit work for bounty
    pub fn submit_bounty_work(
        ctx: Context<SubmitBountyWork>,
        submission_uri: String,
    ) -> Result<()> {
        require!(submission_uri.len() <= 200, ErrorCode::UriTooLong);

        let bounty = &mut ctx.accounts.bounty;
        
        require!(bounty.status == BountyStatus::Open, ErrorCode::BountyNotOpen);
        require!(
            Clock::get()?.unix_timestamp < bounty.deadline,
            ErrorCode::BountyExpired
        );

        bounty.submission_count = bounty.submission_count.checked_add(1).ok_or(ErrorCode::Overflow)?;

        msg!("Bounty submission received");
        Ok(())
    }

    /// Award bounty to winner
    pub fn award_bounty(ctx: Context<AwardBounty>) -> Result<()> {
        let bounty = &mut ctx.accounts.bounty;
        
        require!(bounty.status == BountyStatus::Open, ErrorCode::BountyNotOpen);
        
        bounty.status = BountyStatus::Completed;
        bounty.winner = ctx.accounts.winner.key();

        msg!("Bounty awarded to winner");
        Ok(())
    }

    /// Grant derivative license
    pub fn grant_license(
        ctx: Context<GrantLicense>,
        royalty_bps: u16,
    ) -> Result<()> {
        require!(royalty_bps <= 10000, ErrorCode::InvalidRoyalty);

        let license = &mut ctx.accounts.license;
        license.licensor = ctx.accounts.licensor.key();
        license.licensee = ctx.accounts.licensee.key();
        license.royalty_bps = royalty_bps;
        license.granted_at = Clock::get()?.unix_timestamp;
        license.is_active = true;
        license.bump = ctx.bumps.license;

        msg!("License granted with {}% royalty", royalty_bps as f64 / 100.0);
        Ok(())
    }

    /// Place ad bid
    pub fn place_ad_bid(
        ctx: Context<PlaceAdBid>,
        bid_amount: u64,
        target_slot: u8,
    ) -> Result<()> {
        require!(bid_amount > 0, ErrorCode::InvalidAmount);

        let ad_bid = &mut ctx.accounts.ad_bid;
        ad_bid.bidder = ctx.accounts.bidder.key();
        ad_bid.bid_amount = bid_amount;
        ad_bid.target_slot = target_slot;
        ad_bid.is_active = true;
        ad_bid.created_at = Clock::get()?.unix_timestamp;
        ad_bid.bump = ctx.bumps.ad_bid;

        msg!("Ad bid placed: {} for slot {}", bid_amount, target_slot);
        Ok(())
    }
}

#[account]
pub struct Listing {
    pub seller: Pubkey,
    pub nft_mint: Pubkey,
    pub price: u64,
    pub listing_type: ListingType,
    pub created_at: i64,
    pub is_active: bool,
    pub bump: u8,
}

#[account]
pub struct Bounty {
    pub creator: Pubkey,
    pub title: String,
    pub description: String,
    pub reward_amount: u64,
    pub deadline: i64,
    pub status: BountyStatus,
    pub submission_count: u16,
    pub winner: Pubkey,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
pub struct License {
    pub licensor: Pubkey,
    pub licensee: Pubkey,
    pub royalty_bps: u16,
    pub granted_at: i64,
    pub is_active: bool,
    pub bump: u8,
}

#[account]
pub struct AdBid {
    pub bidder: Pubkey,
    pub bid_amount: u64,
    pub target_slot: u8,
    pub is_active: bool,
    pub created_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum ListingType {
    FixedPrice,
    Auction,
    DutchAuction,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum BountyStatus {
    Open,
    Completed,
    Cancelled,
}

#[derive(Accounts)]
pub struct CreateListing<'info> {
    #[account(
        init,
        payer = seller,
        space = 8 + 32 + 32 + 8 + 1 + 8 + 1 + 1,
        seeds = [b"listing", nft_mint.key().as_ref()],
        bump
    )]
    pub listing: Account<'info, Listing>,
    
    #[account(mut)]
    pub seller: Signer<'info>,
    
    /// CHECK: NFT mint account
    pub nft_mint: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(mut, has_one = seller)]
    pub listing: Account<'info, Listing>,
    
    pub seller: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(title: String)]
pub struct CreateBounty<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + 32 + 104 + 1004 + 8 + 8 + 1 + 2 + 32 + 8 + 1,
        seeds = [b"bounty", creator.key().as_ref(), title.as_bytes()],
        bump
    )]
    pub bounty: Account<'info, Bounty>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitBountyWork<'info> {
    #[account(mut)]
    pub bounty: Account<'info, Bounty>,
    
    pub submitter: Signer<'info>,
}

#[derive(Accounts)]
pub struct AwardBounty<'info> {
    #[account(mut, has_one = creator)]
    pub bounty: Account<'info, Bounty>,
    
    pub creator: Signer<'info>,
    
    /// CHECK: Winner of the bounty
    pub winner: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct GrantLicense<'info> {
    #[account(
        init,
        payer = licensor,
        space = 8 + 32 + 32 + 2 + 8 + 1 + 1,
        seeds = [b"license", licensor.key().as_ref(), licensee.key().as_ref()],
        bump
    )]
    pub license: Account<'info, License>,
    
    #[account(mut)]
    pub licensor: Signer<'info>,
    
    /// CHECK: Licensee receiving the license
    pub licensee: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceAdBid<'info> {
    #[account(
        init,
        payer = bidder,
        space = 8 + 32 + 8 + 1 + 1 + 8 + 1,
        seeds = [b"ad_bid", bidder.key().as_ref(), &[target_slot]],
        bump
    )]
    pub ad_bid: Account<'info, AdBid>,
    
    #[account(mut)]
    pub bidder: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid price")]
    InvalidPrice,
    
    #[msg("Invalid amount")]
    InvalidAmount,
    
    #[msg("Title is too long")]
    TitleTooLong,
    
    #[msg("Description is too long")]
    DescriptionTooLong,
    
    #[msg("URI is too long")]
    UriTooLong,
    
    #[msg("Bounty is not open")]
    BountyNotOpen,
    
    #[msg("Bounty has expired")]
    BountyExpired,
    
    #[msg("Invalid royalty percentage")]
    InvalidRoyalty,
}
