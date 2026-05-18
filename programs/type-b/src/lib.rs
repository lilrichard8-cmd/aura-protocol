use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Token, TokenAccount, Transfer};

declare_id!("2Y6gMW2CRePALFRfJ4RCBTtQmJb2YHt4B5b9cHgDt9Kw");

/// 95% burned, 5% to platform treasury
const BURN_BPS: u64 = 9500;
const PLATFORM_BPS: u64 = 500;

/// [audit fix TB-H2] Canonical ORA mint. Replaces the previous
/// "any-mint-accepted" hole that let payers boost on memecoins to inflate
/// indexer-recorded ORA spend.
///
/// ⚠️ DO NOT DEPLOY — placeholder = system_program::ID. Replace with the
/// real ORA mint pubkey before mainnet.
pub const ORA_MINT: Pubkey = anchor_lang::solana_program::system_program::ID;

/// [audit fix TB-H1] Canonical platform-fee treasury (ORA-denominated).
/// Forces the 5% platform fee to the protocol's actual treasury account.
///
/// ⚠️ DO NOT DEPLOY — placeholder = system_program::ID. Replace with the
/// real ORA treasury pubkey before mainnet.
pub const PLATFORM_TREASURY: Pubkey = anchor_lang::solana_program::system_program::ID;

/// [audit fix TB-C1 / per-task PROGRAM_ADMIN convention]
/// Reserved for future admin-gated operations (rotating treasury, etc.).
/// Not currently consumed by any instruction.
///
/// ⚠️ DO NOT DEPLOY — placeholder. Replace with real multisig pubkey
/// pre-mainnet if/when admin-gated instructions are added.
pub const PROGRAM_ADMIN: Pubkey = anchor_lang::solana_program::system_program::ID;

/// [audit fix round2 R2-TB-M1] Runtime guard that aborts revenue-bearing
/// instructions when `ORA_MINT` or `PLATFORM_TREASURY` are still set to the
/// `system_program::ID` placeholder. Mirrors `market::require_real_pools_configured`.
///
/// Without this, deploying with the placeholders would surface the
/// `address = ...` constraint failure as a generic `Unauthorized` error,
/// which conflates "wrong account passed" with "constants not yet replaced".
fn require_real_consts_configured() -> Result<()> {
    let placeholder = anchor_lang::solana_program::system_program::ID;
    require!(
        ORA_MINT != placeholder && PLATFORM_TREASURY != placeholder,
        ErrorCode::PlaceholderConstsNotReplaced
    );
    Ok(())
}

#[program]
pub mod aura_type_b {
    use super::*;

    /// Initialise a per-payer payment counter (one-time call per payer).
    /// [audit fix TB-C1] Used for the payment_record PDA seed instead of
    /// `Clock::get()?.unix_timestamp`, which was DOS-griefable for the
    /// (very high-frequency) content-boost flow.
    pub fn init_payment_counter(ctx: Context<InitPaymentCounter>) -> Result<()> {
        let c = &mut ctx.accounts.payment_counter;
        c.payer = ctx.accounts.payer.key();
        c.count = 0;
        c.bump = ctx.bumps.payment_counter;
        Ok(())
    }

    /// [audit fix round2 R2-TB-M1] SDK-callable no-op that surfaces the
    /// placeholder-consts deploy-blocker as a clean error before any
    /// payment is attempted. Mirrors `market::assert_pools_configured`.
    pub fn assert_consts_configured(_ctx: Context<NoopCtx>) -> Result<()> {
        require_real_consts_configured()
    }

    /// Boost content visibility. 95% burned, 5% platform.
    pub fn boost_content(
        ctx: Context<TypeBPayment>,
        amount: u64,
        content_id: [u8; 32],
    ) -> Result<()> {
        process_and_record(ctx, amount, content_id, FeatureType::BoostContent)
    }

    /// Pin content to profile/feed top. 95% burned, 5% platform.
    pub fn pin_content(
        ctx: Context<TypeBPayment>,
        amount: u64,
        content_id: [u8; 32],
    ) -> Result<()> {
        process_and_record(ctx, amount, content_id, FeatureType::PinContent)
    }

    /// Buy profile cosmetics/badges. 95% burned, 5% platform.
    pub fn purchase_cosmetic(
        ctx: Context<TypeBPayment>,
        amount: u64,
        content_id: [u8; 32],
    ) -> Result<()> {
        process_and_record(ctx, amount, content_id, FeatureType::Cosmetic)
    }

    /// Pay for AI features. 95% burned, 5% platform.
    pub fn ai_feature_payment(
        ctx: Context<TypeBPayment>,
        amount: u64,
        content_id: [u8; 32],
    ) -> Result<()> {
        process_and_record(ctx, amount, content_id, FeatureType::AIFeature)
    }
}

/// Process the payment + write the record + emit the burn event.
/// [audit fix TB-M1] Records the platform_fee using the actual transferred
/// amount (= amount - burned), not the recomputed `amount * 500 / 10000`,
/// so on-chain accounting matches the executed math even on dust amounts.
/// [audit fix TB-I1] Emits the `TypeBBurnEvent` (was previously dead code).
fn process_and_record<'info>(
    ctx: Context<TypeBPayment<'info>>,
    amount: u64,
    content_id: [u8; 32],
    feature_type: FeatureType,
) -> Result<()> {
    let mut ctx = ctx;
    require!(amount > 0, ErrorCode::InvalidAmount);

    // [audit fix round2 R2-TB-M1] Surface placeholder-consts deploy-blocker
    // with a distinct error so ops can disambiguate it from a real auth
    // failure (`Unauthorized`).
    require_real_consts_configured()?;

    let burn_amount = amount
        .checked_mul(BURN_BPS)
        .ok_or(ErrorCode::Overflow)?
        .checked_div(10_000)
        .ok_or(ErrorCode::Overflow)?;
    let platform_amount = amount
        .checked_sub(burn_amount)
        .ok_or(ErrorCode::Overflow)?;

    // Burn 95% — payer-authorized burn against their own ORA token account.
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

    // Transfer 5% to platform treasury.
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

    // Write the payment record.
    let bump = ctx.bumps.payment_record;
    let acc = &mut ctx.accounts.payment_record;
    acc.payer = ctx.accounts.payer.key();
    acc.amount = amount;
    acc.burned = burn_amount;
    // [audit fix TB-M1] use actual transferred amount, not recomputed.
    acc.platform_fee = platform_amount;
    acc.feature_type = feature_type.clone();
    acc.content_id = content_id;
    acc.timestamp = Clock::get()?.unix_timestamp;
    acc.bump = bump;

    // [audit fix TB-C1] Advance the per-payer counter so subsequent
    // payments derive a different PDA without timestamp-collision DOS.
    let counter = &mut ctx.accounts.payment_counter;
    counter.count = counter
        .count
        .checked_add(1)
        .ok_or(ErrorCode::Overflow)?;

    // [audit fix TB-I1] Emit the burn event for indexers.
    emit!(TypeBBurnEvent {
        payer: ctx.accounts.payer.key(),
        feature_type,
        amount,
        burned: burn_amount,
        platform_fee: platform_amount,
        timestamp: acc.timestamp,
    });

    msg!(
        "type-b payment: burned={} platform={} feature={:?}",
        burn_amount,
        platform_amount,
        acc.feature_type
    );
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
    pub content_id: [u8; 32],      // 32
    pub timestamp: i64,            // 8
    pub bump: u8,                  // 1
}

/// [audit fix TB-C1] Per-payer monotonic counter, replacing the
/// timestamp-based PDA seed.
#[account]
pub struct PaymentCounter {
    pub payer: Pubkey,
    pub count: u64,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct InitPaymentCounter<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 8 + 1,
        seeds = [b"type_b_counter", payer.key().as_ref()],
        bump
    )]
    pub payment_counter: Account<'info, PaymentCounter>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64, content_id: [u8; 32])]
pub struct TypeBPayment<'info> {
    // [audit fix TB-C1] PDA seed now uses a per-payer monotonic counter
    // (`payment_counter.count`) instead of `Clock::get()?.unix_timestamp`.
    #[account(
        mut,
        seeds = [b"type_b_counter", payer.key().as_ref()],
        bump = payment_counter.bump
    )]
    pub payment_counter: Account<'info, PaymentCounter>,

    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 8 + 8 + 8 + 2 + 32 + 8 + 1,
        seeds = [
            b"type_b",
            payer.key().as_ref(),
            content_id.as_ref(),
            &payment_counter.count.to_le_bytes()
        ],
        bump
    )]
    pub payment_record: Account<'info, TypeBPaymentRecord>,

    // [audit fix R3-TB-M1] Bind payer_token_account to the signer + ORA mint.
    // Funds were not at risk before (SPL Token CPI enforces owner+mint), but
    // the error surface was generic SPL `OwnerMismatch`/`MintMismatch`; this
    // brings type-b into constraint-parity with market's PlaceSell/PlaceBuy.
    #[account(
        mut,
        constraint = payer_token_account.owner == payer.key() @ ErrorCode::Unauthorized,
        constraint = payer_token_account.mint == ORA_MINT @ ErrorCode::Unauthorized,
    )]
    pub payer_token_account: Account<'info, TokenAccount>,

    // [audit fix TB-H1] Platform treasury is hard-pinned to the canonical
    // PLATFORM_TREASURY pubkey — payer can no longer divert the 5% fee.
    #[account(
        mut,
        address = PLATFORM_TREASURY @ ErrorCode::Unauthorized
    )]
    pub platform_treasury: Account<'info, TokenAccount>,

    // [audit fix TB-H2] ORA mint is hard-pinned. Previously any mint could
    // be passed, allowing memecoin burns to spoof recorded "ORA spend".
    #[account(
        mut,
        address = ORA_MINT @ ErrorCode::Unauthorized
    )]
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

    #[msg("Arithmetic overflow")]
    Overflow,

    /// [audit fix TB-H1/H2] Surfaced when the caller supplies a non-canonical
    /// ORA mint or non-canonical platform treasury.
    #[msg("Unauthorized account or mint")]
    Unauthorized,

    /// [audit fix round2 R2-TB-M1] Surfaced when `ORA_MINT` or
    /// `PLATFORM_TREASURY` are still the `system_program::ID` placeholder.
    /// Distinct from `Unauthorized` so ops can tell deploy-not-configured
    /// apart from a real auth failure.
    #[msg("ORA_MINT / PLATFORM_TREASURY constants are placeholders — do not deploy")]
    PlaceholderConstsNotReplaced,
}

/// [audit fix round2 R2-TB-M1] No-op context used by `assert_consts_configured`.
#[derive(Accounts)] pub struct NoopCtx {}
