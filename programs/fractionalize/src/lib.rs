use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("FractionalizeProgram11111111111111111111111111");

#[program]
pub mod aura_fractionalize {
    use super::*;

    /// Fractionalize an NFT into multiple fragments
    pub fn fractionalize_nft(
        ctx: Context<FractionalizeNFT>,
        total_fragments: u64,
        price_per_fragment: u64,
    ) -> Result<()> {
        require!(total_fragments > 0, ErrorCode::InvalidFragmentAmount);
        require!(total_fragments <= 1_000_000, ErrorCode::TooManyFragments);
        require!(price_per_fragment > 0, ErrorCode::InvalidPrice);

        let fractional_nft = &mut ctx.accounts.fractional_nft;
        let clock = Clock::get()?;

        // Initialize fractional NFT account
        fractional_nft.original_nft = ctx.accounts.nft_mint.key();
        fractional_nft.original_owner = ctx.accounts.owner.key();
        fractional_nft.fragment_mint = ctx.accounts.fragment_mint.key();
        fractional_nft.total_fragments = total_fragments;
        fractional_nft.fragments_sold = 0;
        fractional_nft.price_per_fragment = price_per_fragment;
        fractional_nft.total_revenue = 0;
        fractional_nft.revenue_distributed = 0;
        fractional_nft.is_active = true;
        fractional_nft.created_at = clock.unix_timestamp;
        fractional_nft.vote_threshold_bps = 5000; // 50% threshold for license approval
        fractional_nft.bump = ctx.bumps.fractional_nft;

        // Transfer NFT from owner to vault (escrow)
        // Note: In production, this would use Metaplex NFT CPI
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.owner_nft_account.to_account_info(),
                    to: ctx.accounts.nft_vault.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            1, // Transfer 1 NFT
        )?;

        msg!(
            "NFT fractionalized: {} fragments at {} lamports each",
            total_fragments,
            price_per_fragment
        );
        Ok(())
    }

    /// Buy fragments from the fractionalized NFT
    pub fn buy_fragment(ctx: Context<BuyFragment>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidFragmentAmount);

        let fractional_nft = &mut ctx.accounts.fractional_nft;
        require!(fractional_nft.is_active, ErrorCode::NFTNotActive);

        let available_fragments = fractional_nft
            .total_fragments
            .checked_sub(fractional_nft.fragments_sold)
            .unwrap();
        require!(available_fragments >= amount, ErrorCode::InsufficientFragments);

        // Calculate total cost
        let total_cost = fractional_nft
            .price_per_fragment
            .checked_mul(amount)
            .unwrap();

        // Transfer SOL from buyer to revenue vault
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.buyer.key(),
            &ctx.accounts.revenue_vault.key(),
            total_cost,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.revenue_vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Mint fragment tokens to buyer
        let seeds = &[
            b"fractional_nft",
            fractional_nft.original_nft.as_ref(),
            &[fractional_nft.bump],
        ];
        let signer = &[&seeds[..]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.fragment_mint.to_account_info(),
                    to: ctx.accounts.buyer_fragment_account.to_account_info(),
                    authority: ctx.accounts.fractional_nft.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        // Update or create fragment holder record
        let fragment_holder = &mut ctx.accounts.fragment_holder;
        fragment_holder.holder = ctx.accounts.buyer.key();
        fragment_holder.fractional_nft = fractional_nft.key();
        fragment_holder.fragments_owned = fragment_holder
            .fragments_owned
            .checked_add(amount)
            .unwrap();
        fragment_holder.total_invested = fragment_holder
            .total_invested
            .checked_add(total_cost)
            .unwrap();
        fragment_holder.revenue_claimed = 0;
        fragment_holder.has_voted = false;
        fragment_holder.bump = ctx.bumps.fragment_holder;

        // Update fractional NFT state
        fractional_nft.fragments_sold = fractional_nft
            .fragments_sold
            .checked_add(amount)
            .unwrap();
        fractional_nft.total_revenue = fractional_nft
            .total_revenue
            .checked_add(total_cost)
            .unwrap();

        msg!(
            "Buyer {} purchased {} fragments for {} lamports",
            ctx.accounts.buyer.key(),
            amount,
            total_cost
        );
        Ok(())
    }

    /// Sell fragments back (secondary market)
    pub fn sell_fragment(ctx: Context<SellFragment>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidFragmentAmount);

        let fractional_nft = &ctx.accounts.fractional_nft;
        let fragment_holder = &mut ctx.accounts.fragment_holder;

        require!(fractional_nft.is_active, ErrorCode::NFTNotActive);
        require!(
            fragment_holder.fragments_owned >= amount,
            ErrorCode::InsufficientFragments
        );

        // Calculate sell price (same as buy price for simplicity)
        let total_return = fractional_nft
            .price_per_fragment
            .checked_mul(amount)
            .unwrap();

        // Burn fragment tokens from seller
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.fragment_mint.to_account_info(),
                    from: ctx.accounts.seller_fragment_account.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            amount,
        )?;

        // Transfer SOL from revenue vault to seller
        let seeds = &[
            b"revenue_vault",
            fractional_nft.original_nft.as_ref(),
            &[ctx.bumps.revenue_vault],
        ];
        let signer = &[&seeds[..]];

        **ctx
            .accounts
            .revenue_vault
            .to_account_info()
            .try_borrow_mut_lamports()? -= total_return;
        **ctx
            .accounts
            .seller
            .to_account_info()
            .try_borrow_mut_lamports()? += total_return;

        // Update fragment holder record
        fragment_holder.fragments_owned = fragment_holder
            .fragments_owned
            .checked_sub(amount)
            .unwrap();

        msg!(
            "Seller {} sold {} fragments for {} lamports",
            ctx.accounts.seller.key(),
            amount,
            total_return
        );
        Ok(())
    }

    /// Distribute revenue to fragment holders proportionally
    pub fn distribute_revenue(ctx: Context<DistributeRevenue>, revenue_amount: u64) -> Result<()> {
        require!(revenue_amount > 0, ErrorCode::InvalidAmount);

        let fractional_nft = &mut ctx.accounts.fractional_nft;
        require!(fractional_nft.is_active, ErrorCode::NFTNotActive);
        require!(
            fractional_nft.fragments_sold > 0,
            ErrorCode::NoFragmentsSold
        );

        // Add revenue to total pool
        fractional_nft.total_revenue = fractional_nft
            .total_revenue
            .checked_add(revenue_amount)
            .unwrap();

        msg!(
            "Deposited {} lamports to revenue pool. Total pool: {}",
            revenue_amount,
            fractional_nft.total_revenue
        );
        Ok(())
    }

    /// Claim proportional revenue share
    pub fn claim_revenue(ctx: Context<ClaimRevenue>) -> Result<()> {
        let fractional_nft = &ctx.accounts.fractional_nft;
        let fragment_holder = &mut ctx.accounts.fragment_holder;

        require!(fractional_nft.is_active, ErrorCode::NFTNotActive);
        require!(
            fragment_holder.fragments_owned > 0,
            ErrorCode::NoFragmentsOwned
        );

        let undistributed_revenue = fractional_nft
            .total_revenue
            .checked_sub(fractional_nft.revenue_distributed)
            .unwrap();
        require!(undistributed_revenue > 0, ErrorCode::NoRevenueAvailable);

        // Calculate holder's share: (fragments_owned / total_fragments) * undistributed_revenue
        let holder_share = (fragment_holder.fragments_owned as u128)
            .checked_mul(undistributed_revenue as u128)
            .unwrap()
            .checked_div(fractional_nft.total_fragments as u128)
            .unwrap() as u64;

        require!(holder_share > 0, ErrorCode::NoRevenueAvailable);

        // Transfer revenue from vault to holder
        let seeds = &[
            b"revenue_vault",
            fractional_nft.original_nft.as_ref(),
            &[ctx.bumps.revenue_vault],
        ];
        let signer = &[&seeds[..]];

        **ctx
            .accounts
            .revenue_vault
            .to_account_info()
            .try_borrow_mut_lamports()? -= holder_share;
        **ctx
            .accounts
            .holder
            .to_account_info()
            .try_borrow_mut_lamports()? += holder_share;

        // Update records
        fragment_holder.revenue_claimed = fragment_holder
            .revenue_claimed
            .checked_add(holder_share)
            .unwrap();

        msg!(
            "Holder {} claimed {} lamports (owns {}/{} fragments)",
            fragment_holder.holder,
            holder_share,
            fragment_holder.fragments_owned,
            fractional_nft.total_fragments
        );
        Ok(())
    }

    /// Vote on commercial license approval
    pub fn vote_on_license(
        ctx: Context<VoteOnLicense>,
        license_proposal_id: u64,
        approve: bool,
    ) -> Result<()> {
        let fractional_nft = &ctx.accounts.fractional_nft;
        let fragment_holder = &mut ctx.accounts.fragment_holder;
        let license_vote = &mut ctx.accounts.license_vote;

        require!(fractional_nft.is_active, ErrorCode::NFTNotActive);
        require!(
            fragment_holder.fragments_owned > 0,
            ErrorCode::NoFragmentsOwned
        );
        require!(!fragment_holder.has_voted, ErrorCode::AlreadyVoted);

        // Initialize or update license vote record
        if license_vote.proposal_id == 0 {
            license_vote.proposal_id = license_proposal_id;
            license_vote.fractional_nft = fractional_nft.key();
            license_vote.total_votes_for = 0;
            license_vote.total_votes_against = 0;
            license_vote.total_fragments_voted = 0;
            license_vote.is_approved = false;
            license_vote.is_finalized = false;
            license_vote.created_at = Clock::get()?.unix_timestamp;
            license_vote.bump = ctx.bumps.license_vote;
        }

        // Record vote
        if approve {
            license_vote.total_votes_for = license_vote
                .total_votes_for
                .checked_add(fragment_holder.fragments_owned)
                .unwrap();
        } else {
            license_vote.total_votes_against = license_vote
                .total_votes_against
                .checked_add(fragment_holder.fragments_owned)
                .unwrap();
        }

        license_vote.total_fragments_voted = license_vote
            .total_fragments_voted
            .checked_add(fragment_holder.fragments_owned)
            .unwrap();

        fragment_holder.has_voted = true;

        // Check if voting threshold reached (50% or more voted in favor)
        let approval_percentage = (license_vote.total_votes_for as u128)
            .checked_mul(10000)
            .unwrap()
            .checked_div(fractional_nft.total_fragments as u128)
            .unwrap() as u16;

        if approval_percentage >= fractional_nft.vote_threshold_bps {
            license_vote.is_approved = true;
        }

        msg!(
            "Vote recorded: {} voted {} with {} fragments (approval: {}%)",
            fragment_holder.holder,
            if approve { "FOR" } else { "AGAINST" },
            fragment_holder.fragments_owned,
            approval_percentage / 100
        );
        Ok(())
    }

    /// Finalize license vote
    pub fn finalize_license_vote(ctx: Context<FinalizeLicenseVote>) -> Result<()> {
        let license_vote = &mut ctx.accounts.license_vote;
        let fractional_nft = &ctx.accounts.fractional_nft;

        require!(!license_vote.is_finalized, ErrorCode::VoteAlreadyFinalized);

        // Check if enough votes collected (e.g., 72 hours passed or >50% voted)
        let clock = Clock::get()?;
        let voting_period: i64 = 72 * 60 * 60; // 72 hours
        let time_elapsed = clock.unix_timestamp - license_vote.created_at;

        require!(
            time_elapsed >= voting_period
                || license_vote.total_fragments_voted >= fractional_nft.total_fragments / 2,
            ErrorCode::VotingPeriodNotEnded
        );

        license_vote.is_finalized = true;

        msg!(
            "License vote finalized: Proposal {} - {}",
            license_vote.proposal_id,
            if license_vote.is_approved {
                "APPROVED"
            } else {
                "REJECTED"
            }
        );
        Ok(())
    }

    /// Reclaim NFT (if all fragments are bought back by original owner)
    pub fn reclaim_nft(ctx: Context<ReclaimNFT>) -> Result<()> {
        let fractional_nft = &mut ctx.accounts.fractional_nft;
        let fragment_holder = &ctx.accounts.fragment_holder;

        require!(fractional_nft.is_active, ErrorCode::NFTNotActive);
        require!(
            fragment_holder.holder == fractional_nft.original_owner,
            ErrorCode::NotOriginalOwner
        );
        require!(
            fragment_holder.fragments_owned == fractional_nft.total_fragments,
            ErrorCode::MustOwnAllFragments
        );

        // Transfer NFT back to original owner
        let seeds = &[
            b"fractional_nft",
            fractional_nft.original_nft.as_ref(),
            &[fractional_nft.bump],
        ];
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.nft_vault.to_account_info(),
                    to: ctx.accounts.owner_nft_account.to_account_info(),
                    authority: ctx.accounts.fractional_nft.to_account_info(),
                },
                signer,
            ),
            1, // Transfer 1 NFT back
        )?;

        // Mark as inactive
        fractional_nft.is_active = false;

        msg!(
            "NFT reclaimed by original owner: {}",
            fractional_nft.original_owner
        );
        Ok(())
    }
}

// Account structures
#[account]
pub struct FractionalNFT {
    pub original_nft: Pubkey,        // 32 - Original NFT mint
    pub original_owner: Pubkey,      // 32 - Original owner who fractionalized
    pub fragment_mint: Pubkey,       // 32 - SPL token mint for fragments
    pub total_fragments: u64,        // 8  - Total number of fragments
    pub fragments_sold: u64,         // 8  - Number of fragments sold
    pub price_per_fragment: u64,     // 8  - Price per fragment in lamports
    pub total_revenue: u64,          // 8  - Total revenue from fragment sales
    pub revenue_distributed: u64,    // 8  - Total revenue distributed
    pub is_active: bool,             // 1  - Whether NFT is still fractionalized
    pub created_at: i64,             // 8  - Creation timestamp
    pub vote_threshold_bps: u16,     // 2  - Voting threshold in basis points (e.g., 5000 = 50%)
    pub bump: u8,                    // 1  - PDA bump
}

#[account]
pub struct FragmentHolder {
    pub holder: Pubkey,           // 32 - Fragment holder address
    pub fractional_nft: Pubkey,   // 32 - Associated fractional NFT
    pub fragments_owned: u64,     // 8  - Number of fragments owned
    pub total_invested: u64,      // 8  - Total amount invested in lamports
    pub revenue_claimed: u64,     // 8  - Total revenue claimed
    pub has_voted: bool,          // 1  - Whether holder has voted on current proposal
    pub bump: u8,                 // 1  - PDA bump
}

#[account]
pub struct LicenseVote {
    pub proposal_id: u64,           // 8  - Unique proposal ID
    pub fractional_nft: Pubkey,     // 32 - Associated fractional NFT
    pub total_votes_for: u64,       // 8  - Total fragments voted in favor
    pub total_votes_against: u64,   // 8  - Total fragments voted against
    pub total_fragments_voted: u64, // 8  - Total fragments that have voted
    pub is_approved: bool,          // 1  - Whether proposal is approved
    pub is_finalized: bool,         // 1  - Whether vote is finalized
    pub created_at: i64,            // 8  - Vote creation timestamp
    pub bump: u8,                   // 1  - PDA bump
}

// Context structures
#[derive(Accounts)]
pub struct FractionalizeNFT<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 8 + 2 + 1,
        seeds = [b"fractional_nft", nft_mint.key().as_ref()],
        bump
    )]
    pub fractional_nft: Account<'info, FractionalNFT>,

    /// Original NFT mint
    pub nft_mint: Account<'info, Mint>,

    /// Fragment SPL token mint
    #[account(
        init,
        payer = owner,
        mint::decimals = 0,
        mint::authority = fractional_nft,
        seeds = [b"fragment_mint", nft_mint.key().as_ref()],
        bump
    )]
    pub fragment_mint: Account<'info, Mint>,

    /// NFT vault to hold the original NFT
    #[account(
        init,
        payer = owner,
        token::mint = nft_mint,
        token::authority = fractional_nft,
        seeds = [b"nft_vault", nft_mint.key().as_ref()],
        bump
    )]
    pub nft_vault: Account<'info, TokenAccount>,

    /// Revenue vault to hold SOL from fragment sales
    #[account(
        init,
        payer = owner,
        space = 8,
        seeds = [b"revenue_vault", nft_mint.key().as_ref()],
        bump
    )]
    /// CHECK: This is a PDA that holds SOL
    pub revenue_vault: AccountInfo<'info>,

    /// Owner's NFT token account
    #[account(mut)]
    pub owner_nft_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct BuyFragment<'info> {
    #[account(
        mut,
        seeds = [b"fractional_nft", fractional_nft.original_nft.as_ref()],
        bump = fractional_nft.bump
    )]
    pub fractional_nft: Account<'info, FractionalNFT>,

    #[account(
        mut,
        seeds = [b"fragment_mint", fractional_nft.original_nft.as_ref()],
        bump
    )]
    pub fragment_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"revenue_vault", fractional_nft.original_nft.as_ref()],
        bump
    )]
    /// CHECK: This is a PDA that holds SOL
    pub revenue_vault: AccountInfo<'info>,

    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 1 + 1,
        seeds = [b"fragment_holder", fractional_nft.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub fragment_holder: Account<'info, FragmentHolder>,

    /// Buyer's token account to receive fragments
    #[account(mut)]
    pub buyer_fragment_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SellFragment<'info> {
    #[account(
        seeds = [b"fractional_nft", fractional_nft.original_nft.as_ref()],
        bump = fractional_nft.bump
    )]
    pub fractional_nft: Account<'info, FractionalNFT>,

    #[account(
        mut,
        seeds = [b"fragment_mint", fractional_nft.original_nft.as_ref()],
        bump
    )]
    pub fragment_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"revenue_vault", fractional_nft.original_nft.as_ref()],
        bump
    )]
    /// CHECK: This is a PDA that holds SOL
    pub revenue_vault: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"fragment_holder", fractional_nft.key().as_ref(), seller.key().as_ref()],
        bump = fragment_holder.bump,
        has_one = seller @ ErrorCode::InvalidHolder
    )]
    pub fragment_holder: Account<'info, FragmentHolder>,

    /// Seller's token account to burn fragments from
    #[account(mut)]
    pub seller_fragment_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub seller: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DistributeRevenue<'info> {
    #[account(
        mut,
        seeds = [b"fractional_nft", fractional_nft.original_nft.as_ref()],
        bump = fractional_nft.bump
    )]
    pub fractional_nft: Account<'info, FractionalNFT>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimRevenue<'info> {
    #[account(
        seeds = [b"fractional_nft", fractional_nft.original_nft.as_ref()],
        bump = fractional_nft.bump
    )]
    pub fractional_nft: Account<'info, FractionalNFT>,

    #[account(
        mut,
        seeds = [b"fragment_holder", fractional_nft.key().as_ref(), holder.key().as_ref()],
        bump = fragment_holder.bump,
        has_one = holder @ ErrorCode::InvalidHolder
    )]
    pub fragment_holder: Account<'info, FragmentHolder>,

    #[account(
        mut,
        seeds = [b"revenue_vault", fractional_nft.original_nft.as_ref()],
        bump
    )]
    /// CHECK: This is a PDA that holds SOL
    pub revenue_vault: AccountInfo<'info>,

    #[account(mut)]
    pub holder: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(license_proposal_id: u64)]
pub struct VoteOnLicense<'info> {
    #[account(
        seeds = [b"fractional_nft", fractional_nft.original_nft.as_ref()],
        bump = fractional_nft.bump
    )]
    pub fractional_nft: Account<'info, FractionalNFT>,

    #[account(
        mut,
        seeds = [b"fragment_holder", fractional_nft.key().as_ref(), voter.key().as_ref()],
        bump = fragment_holder.bump,
        has_one = voter @ ErrorCode::InvalidHolder
    )]
    pub fragment_holder: Account<'info, FragmentHolder>,

    #[account(
        init_if_needed,
        payer = voter,
        space = 8 + 8 + 32 + 8 + 8 + 8 + 1 + 1 + 8 + 1,
        seeds = [b"license_vote", fractional_nft.key().as_ref(), license_proposal_id.to_le_bytes().as_ref()],
        bump
    )]
    pub license_vote: Account<'info, LicenseVote>,

    #[account(mut)]
    pub voter: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FinalizeLicenseVote<'info> {
    #[account(
        seeds = [b"fractional_nft", fractional_nft.original_nft.as_ref()],
        bump = fractional_nft.bump
    )]
    pub fractional_nft: Account<'info, FractionalNFT>,

    #[account(
        mut,
        seeds = [b"license_vote", fractional_nft.key().as_ref(), license_vote.proposal_id.to_le_bytes().as_ref()],
        bump = license_vote.bump
    )]
    pub license_vote: Account<'info, LicenseVote>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ReclaimNFT<'info> {
    #[account(
        mut,
        seeds = [b"fractional_nft", fractional_nft.original_nft.as_ref()],
        bump = fractional_nft.bump
    )]
    pub fractional_nft: Account<'info, FractionalNFT>,

    #[account(
        seeds = [b"fragment_holder", fractional_nft.key().as_ref(), owner.key().as_ref()],
        bump = fragment_holder.bump
    )]
    pub fragment_holder: Account<'info, FragmentHolder>,

    #[account(
        mut,
        seeds = [b"nft_vault", fractional_nft.original_nft.as_ref()],
        bump
    )]
    pub nft_vault: Account<'info, TokenAccount>,

    /// Owner's NFT token account to receive the NFT back
    #[account(mut)]
    pub owner_nft_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

// Error codes
#[error_code]
pub enum ErrorCode {
    #[msg("Invalid fragment amount")]
    InvalidFragmentAmount,

    #[msg("Too many fragments (max 1,000,000)")]
    TooManyFragments,

    #[msg("Invalid price")]
    InvalidPrice,

    #[msg("NFT is not active")]
    NFTNotActive,

    #[msg("Insufficient fragments available")]
    InsufficientFragments,

    #[msg("Invalid amount")]
    InvalidAmount,

    #[msg("No fragments have been sold yet")]
    NoFragmentsSold,

    #[msg("No fragments owned")]
    NoFragmentsOwned,

    #[msg("No revenue available to claim")]
    NoRevenueAvailable,

    #[msg("Already voted on this proposal")]
    AlreadyVoted,

    #[msg("Vote has already been finalized")]
    VoteAlreadyFinalized,

    #[msg("Voting period has not ended yet")]
    VotingPeriodNotEnded,

    #[msg("Not the original owner")]
    NotOriginalOwner,

    #[msg("Must own all fragments to reclaim NFT")]
    MustOwnAllFragments,

    #[msg("Invalid holder")]
    InvalidHolder,


    #[msg("Arithmetic overflow")]
    Overflow,
}
