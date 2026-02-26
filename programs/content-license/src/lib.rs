use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("LicenseProgram111111111111111111111111111111");

#[program]
pub mod aura_content_license {
    use super::*;

    /// Set license for content
    pub fn set_license(
        ctx: Context<SetLicense>,
        license_type: LicenseType,
        embed_price: u64,
        remix_royalty_bps: u16,
        commercial_allowed: bool,
        derivatives_allowed: bool,
        attribution_required: bool,
    ) -> Result<()> {
        require!(remix_royalty_bps <= 10000, ErrorCode::InvalidRoyaltyBps);

        let license = &mut ctx.accounts.content_license;
        license.content_id = ctx.accounts.content_id.key();
        license.creator = ctx.accounts.creator.key();
        license.license_type = license_type;
        license.embed_price = embed_price;
        license.remix_royalty_bps = remix_royalty_bps;
        license.commercial_allowed = commercial_allowed;
        license.derivatives_allowed = derivatives_allowed;
        license.attribution_required = attribution_required;
        license.total_embeds = 0;
        license.total_remixes = 0;
        license.total_embed_revenue = 0;
        license.total_remix_revenue = 0;
        license.created_at = Clock::get()?.unix_timestamp;
        license.updated_at = Clock::get()?.unix_timestamp;
        license.is_active = true;
        license.bump = ctx.bumps.content_license;

        msg!("License set for content: {:?}", license_type);
        Ok(())
    }

    /// Update existing license
    pub fn update_license(
        ctx: Context<UpdateLicense>,
        license_type: Option<LicenseType>,
        embed_price: Option<u64>,
        remix_royalty_bps: Option<u16>,
        commercial_allowed: Option<bool>,
        derivatives_allowed: Option<bool>,
        attribution_required: Option<bool>,
    ) -> Result<()> {
        let license = &mut ctx.accounts.content_license;

        if let Some(lt) = license_type {
            license.license_type = lt;
        }
        if let Some(ep) = embed_price {
            license.embed_price = ep;
        }
        if let Some(rb) = remix_royalty_bps {
            require!(rb <= 10000, ErrorCode::InvalidRoyaltyBps);
            license.remix_royalty_bps = rb;
        }
        if let Some(ca) = commercial_allowed {
            license.commercial_allowed = ca;
        }
        if let Some(da) = derivatives_allowed {
            license.derivatives_allowed = da;
        }
        if let Some(ar) = attribution_required {
            license.attribution_required = ar;
        }

        license.updated_at = Clock::get()?.unix_timestamp;

        msg!("License updated");
        Ok(())
    }

    /// Pay to embed content
    pub fn pay_to_embed(ctx: Context<PayToEmbed>, amount: u64) -> Result<()> {
        let license = &mut ctx.accounts.content_license;

        // Check if embedding is allowed
        match license.license_type {
            LicenseType::CC0 => {
                // Free to embed, no payment needed
                require!(amount == 0, ErrorCode::NoPaymentRequired);
            }
            LicenseType::CCBY => {
                // Free to embed with attribution, no payment needed
                require!(amount == 0, ErrorCode::NoPaymentRequired);
            }
            LicenseType::PayToEmbed | LicenseType::PayToRemix => {
                // Require payment
                require!(amount >= license.embed_price, ErrorCode::InsufficientPayment);
            }
            LicenseType::Exclusive => {
                // Only exclusive licensee can embed
                return Err(ErrorCode::ExclusiveLicense.into());
            }
        }

        // Transfer payment from embedder to creator
        if amount > 0 {
            let cpi_context = CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.embedder.to_account_info(),
                    to: ctx.accounts.creator.to_account_info(),
                },
            );
            system_program::transfer(cpi_context, amount)?;

            license.total_embed_revenue = license.total_embed_revenue.checked_add(amount).unwrap();
        }

        // Increment embed count
        license.total_embeds = license.total_embeds.checked_add(1).unwrap();

        // Create embed record
        let embed_record = &mut ctx.accounts.embed_record;
        embed_record.content_id = license.content_id;
        embed_record.embedder = ctx.accounts.embedder.key();
        embed_record.amount_paid = amount;
        embed_record.embedded_at = Clock::get()?.unix_timestamp;
        embed_record.bump = ctx.bumps.embed_record;

        msg!("Content embedded. Amount paid: {}", amount);
        Ok(())
    }

    /// Pay to remix content with automatic revenue split
    pub fn pay_to_remix(
        ctx: Context<PayToRemix>,
        amount: u64,
        new_content_id: Pubkey,
    ) -> Result<()> {
        let license = &mut ctx.accounts.content_license;

        // Check if remixing is allowed
        require!(license.derivatives_allowed, ErrorCode::RemixNotAllowed);

        match license.license_type {
            LicenseType::CC0 => {
                // Free to remix
                require!(amount == 0, ErrorCode::NoPaymentRequired);
            }
            LicenseType::CCBY => {
                // Free to remix with attribution
                require!(amount == 0, ErrorCode::NoPaymentRequired);
            }
            LicenseType::PayToRemix => {
                // Require payment
                require!(amount >= license.embed_price, ErrorCode::InsufficientPayment);
            }
            LicenseType::PayToEmbed => {
                // May allow remix if derivatives_allowed is true
                require!(amount >= license.embed_price, ErrorCode::InsufficientPayment);
            }
            LicenseType::Exclusive => {
                return Err(ErrorCode::ExclusiveLicense.into());
            }
        }

        // Transfer payment from remixer to creator
        if amount > 0 {
            let cpi_context = CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.remixer.to_account_info(),
                    to: ctx.accounts.creator.to_account_info(),
                },
            );
            system_program::transfer(cpi_context, amount)?;

            license.total_remix_revenue = license.total_remix_revenue.checked_add(amount).unwrap();
        }

        // Increment remix count
        license.total_remixes = license.total_remixes.checked_add(1).unwrap();

        // Create remix record
        let remix_record = &mut ctx.accounts.remix_record;
        remix_record.original_content_id = license.content_id;
        remix_record.new_content_id = new_content_id;
        remix_record.original_creator = license.creator;
        remix_record.remixer = ctx.accounts.remixer.key();
        remix_record.amount_paid = amount;
        remix_record.royalty_bps = license.remix_royalty_bps;
        remix_record.remixed_at = Clock::get()?.unix_timestamp;
        remix_record.total_revenue = 0;
        remix_record.creator_royalty_paid = 0;
        remix_record.bump = ctx.bumps.remix_record;

        msg!(
            "Content remixed. Amount paid: {}, Royalty: {}bps",
            amount,
            license.remix_royalty_bps
        );
        Ok(())
    }

    /// Distribute remix revenue to original creator
    pub fn distribute_remix_revenue(
        ctx: Context<DistributeRemixRevenue>,
        amount: u64,
    ) -> Result<()> {
        let remix_record = &mut ctx.accounts.remix_record;

        // Calculate royalty for original creator
        let royalty_amount = (amount as u128)
            .checked_mul(remix_record.royalty_bps as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;

        let remixer_amount = amount.checked_sub(royalty_amount).unwrap();

        // Transfer royalty to original creator
        if royalty_amount > 0 {
            let cpi_context = CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.original_creator.to_account_info(),
                },
            );
            system_program::transfer(cpi_context, royalty_amount)?;

            remix_record.creator_royalty_paid = remix_record
                .creator_royalty_paid
                .checked_add(royalty_amount)
                .unwrap();
        }

        // Transfer remaining to remixer
        if remixer_amount > 0 {
            let cpi_context = CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.remixer.to_account_info(),
                },
            );
            system_program::transfer(cpi_context, remixer_amount)?;
        }

        // Update total revenue
        remix_record.total_revenue = remix_record.total_revenue.checked_add(amount).unwrap();

        msg!(
            "Remix revenue distributed. Creator royalty: {}, Remixer: {}",
            royalty_amount,
            remixer_amount
        );
        Ok(())
    }

    /// Deactivate license
    pub fn deactivate_license(ctx: Context<DeactivateLicense>) -> Result<()> {
        let license = &mut ctx.accounts.content_license;
        license.is_active = false;
        license.updated_at = Clock::get()?.unix_timestamp;

        msg!("License deactivated");
        Ok(())
    }
}

// Account structures
#[account]
pub struct ContentLicense {
    pub content_id: Pubkey,
    pub creator: Pubkey,
    pub license_type: LicenseType,
    pub embed_price: u64,
    pub remix_royalty_bps: u16,
    pub commercial_allowed: bool,
    pub derivatives_allowed: bool,
    pub attribution_required: bool,
    pub total_embeds: u64,
    pub total_remixes: u64,
    pub total_embed_revenue: u64,
    pub total_remix_revenue: u64,
    pub created_at: i64,
    pub updated_at: i64,
    pub is_active: bool,
    pub bump: u8,
}

#[account]
pub struct EmbedRecord {
    pub content_id: Pubkey,
    pub embedder: Pubkey,
    pub amount_paid: u64,
    pub embedded_at: i64,
    pub bump: u8,
}

#[account]
pub struct RemixRecord {
    pub original_content_id: Pubkey,
    pub new_content_id: Pubkey,
    pub original_creator: Pubkey,
    pub remixer: Pubkey,
    pub amount_paid: u64,
    pub royalty_bps: u16,
    pub remixed_at: i64,
    pub total_revenue: u64,
    pub creator_royalty_paid: u64,
    pub bump: u8,
}

// Enums
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
pub enum LicenseType {
    CC0,          // Completely open, no restrictions
    CCBY,         // Attribution required
    PayToEmbed,   // Pay to embed
    PayToRemix,   // Pay to remix/derivative
    Exclusive,    // Exclusive license
}

// Context structures
#[derive(Accounts)]
pub struct SetLicense<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + 32 + 32 + 1 + 8 + 2 + 1 + 1 + 1 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 1,
        seeds = [b"license", content_id.key().as_ref()],
        bump
    )]
    pub content_license: Account<'info, ContentLicense>,

    /// CHECK: Content ID (PDA or account)
    pub content_id: AccountInfo<'info>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateLicense<'info> {
    #[account(
        mut,
        has_one = creator,
        seeds = [b"license", content_license.content_id.as_ref()],
        bump = content_license.bump
    )]
    pub content_license: Account<'info, ContentLicense>,

    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct PayToEmbed<'info> {
    #[account(
        mut,
        seeds = [b"license", content_license.content_id.as_ref()],
        bump = content_license.bump
    )]
    pub content_license: Account<'info, ContentLicense>,

    #[account(
        init,
        payer = embedder,
        space = 8 + 32 + 32 + 8 + 8 + 1,
        seeds = [b"embed", content_license.content_id.as_ref(), embedder.key().as_ref(), &Clock::get()?.unix_timestamp.to_le_bytes()],
        bump
    )]
    pub embed_record: Account<'info, EmbedRecord>,

    #[account(mut)]
    pub embedder: Signer<'info>,

    /// CHECK: Creator receives payment
    #[account(mut)]
    pub creator: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PayToRemix<'info> {
    #[account(
        mut,
        seeds = [b"license", content_license.content_id.as_ref()],
        bump = content_license.bump
    )]
    pub content_license: Account<'info, ContentLicense>,

    #[account(
        init,
        payer = remixer,
        space = 8 + 32 + 32 + 32 + 32 + 8 + 2 + 8 + 8 + 8 + 1,
        seeds = [b"remix", content_license.content_id.as_ref(), remixer.key().as_ref(), &Clock::get()?.unix_timestamp.to_le_bytes()],
        bump
    )]
    pub remix_record: Account<'info, RemixRecord>,

    #[account(mut)]
    pub remixer: Signer<'info>,

    /// CHECK: Creator receives payment
    #[account(mut)]
    pub creator: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DistributeRemixRevenue<'info> {
    #[account(
        mut,
        seeds = [b"remix", remix_record.original_content_id.as_ref(), remix_record.remixer.as_ref(), &remix_record.remixed_at.to_le_bytes()],
        bump = remix_record.bump
    )]
    pub remix_record: Account<'info, RemixRecord>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Original creator receives royalty
    #[account(mut)]
    pub original_creator: AccountInfo<'info>,

    /// CHECK: Remixer receives remaining amount
    #[account(mut)]
    pub remixer: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DeactivateLicense<'info> {
    #[account(
        mut,
        has_one = creator,
        seeds = [b"license", content_license.content_id.as_ref()],
        bump = content_license.bump
    )]
    pub content_license: Account<'info, ContentLicense>,

    pub creator: Signer<'info>,
}

// Error codes
#[error_code]
pub enum ErrorCode {
    #[msg("Invalid royalty basis points (must be <= 10000)")]
    InvalidRoyaltyBps,

    #[msg("Insufficient payment amount")]
    InsufficientPayment,

    #[msg("No payment required for this license type")]
    NoPaymentRequired,

    #[msg("Content has exclusive license")]
    ExclusiveLicense,

    #[msg("Remix/derivatives not allowed for this content")]
    RemixNotAllowed,

    #[msg("License is not active")]
    LicenseNotActive,
}
