use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Token, TokenAccount, Transfer};

declare_id!("2Y6gMW2CRePALFRfJ4RCBTtQmJb2YHt4B5b9cHgDt9Kw");

/// 95% burned, 5% to platform treasury
const BURN_BPS: u64 = 9500;
const PLATFORM_BPS: u64 = 500;

#[program]
pub mod aura_type_b {
    use super::*;

    /// Boost content visibility. 95% burned, 5% platform.
    pub fn boost_content(
        ctx: Context<TypeBPayment>,
        amount: u64,
        content_id: [u8; 32],
    ) -> Result<()> {
        process_type_b_payment(&ctx, amount)?;

        let record = &mut ctx.accounts.payment_record;
        record.payer = ctx.accounts.payer.key();
        record.amount = amount;
        record.burned = amount.checked_mul(BURN_BPS).unwrap() / 10000;
        record.platform_fee = amount.checked_mul(PLATFORM_BPS).unwrap() / 10000;
        record.feature_type = FeatureType::BoostContent;
        record.content_id = content_id;
        record.timestamp = Clock::get()?.unix_timestamp;
        record.bump = ctx.bumps.payment_record;

        msg!("Content boosted: burned={} platform={}", record.burned, record.platform_fee);
        Ok(())
    }

    /// Pin content to profile/feed top. 95% burned, 5% platform.
    pub fn pin_content(
        ctx: Context<TypeBPayment>,
        amount: u64,
        content_id: [u8; 32],
    ) -> Result<()> {
        process_type_b_payment(&ctx, amount)?;

        let record = &mut ctx.accounts.payment_record;
        record.payer = ctx.accounts.payer.key();
        record.amount = amount;
        record.burned = amount.checked_mul(BURN_BPS).unwrap() / 10000;
        record.platform_fee = amount.checked_mul(PLATFORM_BPS).unwrap() / 10000;
        record.feature_type = FeatureType::PinContent;
        record.content_id = content_id;
        record.timestamp = Clock::get()?.unix_timestamp;
        record.bump = ctx.bumps.payment_record;

        msg!("Content pinned: burned={} platform={}", record.burned, record.platform_fee);
        Ok(())
    }

    /// Buy profile cosmetics/badges. 95% burned, 5% platform.
    pub fn purchase_cosmetic(
        ctx: Context<TypeBPayment>,
        amount: u64,
        content_id: [u8; 32],
    ) -> Result<()> {
        process_type_b_payment(&ctx, amount)?;

        let record = &mut ctx.accounts.payment_record;
        record.payer = ctx.accounts.payer.key();
        record.amount = amount;
        record.burned = amount.checked_mul(BURN_BPS).unwrap() / 10000;
        record.platform_fee = amount.checked_mul(PLATFORM_BPS).unwrap() / 10000;
        record.feature_type = FeatureType::Cosmetic;
        record.content_id = content_id;
        record.timestamp = Clock::get()?.unix_timestamp;
        record.bump = ctx.bumps.payment_record;

        msg!("Cosmetic purchased: burned={} platform={}", record.burned, record.platform_fee);
        Ok(())
    }

    /// Pay for AI features. 95% burned, 5% platform.
    pub fn ai_feature_payment(
        ctx: Context<TypeBPayment>,
        amount: u64,
        content_id: [u8; 32],
    ) -> Result<()> {
        process_type_b_payment(&ctx, amount)?;

        let record = &mut ctx.accounts.payment_record;
        record.payer = ctx.accounts.payer.key();
        record.amount = amount;
        record.burned = amount.checked_mul(BURN_BPS).unwrap() / 10000;
        record.platform_fee = amount.checked_mul(PLATFORM_BPS).unwrap() / 10000;
        record.feature_type = FeatureType::AIFeature;
        record.content_id = content_id;
        record.timestamp = Clock::get()?.unix_timestamp;
        record.bump = ctx.bumps.payment_record;

        msg!("AI feature paid: burned={} platform={}", record.burned, record.platform_fee);
        Ok(())
    }
}

/// Core payment processing: burn 95%, send 5% to platform
fn process_type_b_payment(ctx: &Context<TypeBPayment>, amount: u64) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);

    let burn_amount = amount.checked_mul(BURN_BPS).unwrap() / 10000;
    let platform_amount = amount.checked_sub(burn_amount).unwrap();

    // Burn 95%
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.ora_mint.to_account_info(),
                from: ctx.accounts.payer_token_account.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
            },
        ),
        burn_amount,
    )?;

    // Transfer 5% to platform
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.payer_token_account.to_account_info(),
                to: ctx.accounts.platform_treasury.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
            },
        ),
        platform_amount,
    )?;

    Ok(())
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub enum FeatureType {
    BoostContent,
    PinContent,
    Cosmetic,
    AIFeature,
}

#[account]
pub struct TypeBPaymentRecord {
    pub payer: Pubkey,             // 32
    pub amount: u64,               // 8
    pub burned: u64,               // 8
    pub platform_fee: u64,         // 8
    pub feature_type: FeatureType, // 1+1 = 2
    pub content_id: [u8; 32],     // 32
    pub timestamp: i64,            // 8
    pub bump: u8,                  // 1
}

#[derive(Accounts)]
#[instruction(amount: u64, content_id: [u8; 32])]  // FIX #14: timestamp in seeds allows repeat payments
pub struct TypeBPayment<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 8 + 8 + 8 + 2 + 32 + 8 + 1,
        seeds = [b"type_b", payer.key().as_ref(), content_id.as_ref(), &Clock::get()?.unix_timestamp.to_le_bytes()],
        bump
    )]
    pub payment_record: Account<'info, TypeBPaymentRecord>,

    #[account(mut)]
    pub payer_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub platform_treasury: Account<'info, TokenAccount>,
    #[account(mut)]
    pub ora_mint: Account<'info, anchor_spl::token::Mint>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}


#[event]
pub struct TypeBBurnEvent {
    pub payer: Pubkey,
    pub feature_type: FeatureType,
    pub amount: u64,
    pub burned: u64,
    pub platform_fee: u64,
    pub timestamp: i64,
}
#[error_code]
pub enum ErrorCode {
    #[msg("Invalid amount")]
    InvalidAmount,
}
