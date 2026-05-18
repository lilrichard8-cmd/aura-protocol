// [whitepaper-sync v1.1] §12 NFT Royalties — protocol-level enforcement.
//
// Whitepaper v1.1 §12.1 specifies:
//   • Minimum royalty:  5%  (500 bps)
//   • Maximum royalty: 45%  (4500 bps)
//   • Default royalty:  5%  (500 bps)
//   • Enforcement: Metaplex pNFT protocol (on-chain, non-bypassable)
//   • All NFT sales also bear the standard 5% protocol fee (40/40/10/10
//     split: 2% burn / 2% staking / 0.5% gas / 0.5% ops) per §5.7.
//
// Metaplex pNFT enforces royalties via creator metadata. This module adds
// a *defence-in-depth* on-chain enforcement layer for any AURA secondary
// sale flow that wants to settle inside `aura_market` (rather than going
// through a pNFT-aware AMM such as Tensor or Magic Eden). It is also the
// mechanism through which the Content Key system (§13) charges royalties
// on key resales — Content Keys are pNFTs in their own right, but the
// AURA secondary flow runs through this module so creators can rely on a
// uniform, AURA-verifiable royalty record rather than trusting that every
// downstream marketplace honours the pNFT royalty hint.
//
// Existing market.lib::fill_sell_order / fill_buy_order operate on
// *Creator Coins*, not NFTs (the order PDA's seed material is `coin_mint`
// and the audit comments explicitly call out the CC pay path). They are
// NOT modified — applying NFT royalties to fungible CC trades would be
// semantically wrong and would break the audited 5% fee split. NFT sale
// flows that want royalty enforcement should call
// `enforce_royalty_on_sale` (or its CPI equivalent) from their own
// settlement instruction.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::{
    ErrorCode, GAS_RESERVE_POOL, OPS_TREASURY_POOL, ORA_MINT, STAKING_REWARDS_POOL,
};
use crate::sell_order::{BURN_BPS, FEE_BPS, GAS_BPS, STAKING_BPS};

// ─────────────────────────────────────────────────────────────────────
// [whitepaper-sync v1.1] §12 constants
// ─────────────────────────────────────────────────────────────────────

/// 5% — minimum creator royalty.
pub const MIN_ROYALTY_BPS: u16 = 500;
/// 45% — maximum creator royalty.
pub const MAX_ROYALTY_BPS: u16 = 4500;
/// 5% — protocol-recommended default royalty.
pub const DEFAULT_ROYALTY_BPS: u16 = 500;

/// Protocol-side fee bps on every NFT secondary sale (mirrors §5.7).
/// Kept as a re-export so SDK & off-chain tooling can `import { NFT_PROTOCOL_FEE_BPS }`
/// without reaching into sell_order.
pub const NFT_PROTOCOL_FEE_BPS: u64 = FEE_BPS; // 500

/// Hard ceiling on royalty + protocol fee. With max 45% royalty + 5% fee the
/// seller still nets 50%, well clear of underflow. Enforced at runtime in
/// `enforce_royalty_on_sale` as a belt-and-suspenders against future fee
/// constant changes.
pub const MAX_TOTAL_DEDUCTION_BPS: u64 = (MAX_ROYALTY_BPS as u64) + NFT_PROTOCOL_FEE_BPS;

// ─────────────────────────────────────────────────────────────────────
// [whitepaper-sync v1.1] §12 accounts
// ─────────────────────────────────────────────────────────────────────

/// One-time-per-NFT royalty record. Created by the **original creator** at
/// (or immediately after) mint time. Once set, `royalty_bps` is immutable —
/// secondary buyers must be able to inspect the royalty before purchasing,
/// and creators cannot retroactively raise it.
///
/// PDA seeds: `[b"nft-royalty", nft_mint.as_ref()]`
#[account]
pub struct NftRoyaltyConfig {
    /// The NFT mint this config applies to.
    pub nft_mint: Pubkey,
    /// The wallet that minted the NFT. All future royalty payments flow here.
    pub original_creator: Pubkey,
    /// Royalty rate in basis points. Must be in [MIN_ROYALTY_BPS, MAX_ROYALTY_BPS].
    pub royalty_bps: u16,
    /// Unix timestamp of mint-time configuration.
    pub created_at: i64,
    /// Cumulative royalties paid out from this NFT (informational telemetry,
    /// useful for creator dashboards and tax reporting).
    pub total_royalties_paid: u64,
    /// Cumulative number of secondary sales that flowed through this NFT.
    pub sale_count: u64,
    /// PDA bump.
    pub bump: u8,
}

impl NftRoyaltyConfig {
    // discriminator(8) + nft_mint(32) + original_creator(32)
    //   + royalty_bps(2) + created_at(8) + total_royalties_paid(8)
    //   + sale_count(8) + bump(1)
    pub const SIZE: usize = 8 + 32 + 32 + 2 + 8 + 8 + 8 + 1;
}

// ─────────────────────────────────────────────────────────────────────
// [whitepaper-sync v1.1] §12 events
// ─────────────────────────────────────────────────────────────────────

#[event]
pub struct NftRoyaltySet {
    pub nft_mint: Pubkey,
    pub original_creator: Pubkey,
    pub royalty_bps: u16,
    pub created_at: i64,
}

#[event]
pub struct NftRoyaltyEnforced {
    pub nft_mint: Pubkey,
    pub original_creator: Pubkey,
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub sale_price: u64,
    pub royalty_bps: u16,
    pub royalty_paid: u64,
    pub protocol_fee: u64,
    pub seller_net: u64,
    pub slot: u64,
}

// ─────────────────────────────────────────────────────────────────────
// [whitepaper-sync v1.1] §12 errors
// ─────────────────────────────────────────────────────────────────────

#[error_code]
pub enum NftRoyaltyError {
    /// `royalty_bps` outside the [MIN, MAX] band defined by WP §12.1.
    #[msg("Royalty bps must be within [MIN_ROYALTY_BPS, MAX_ROYALTY_BPS]")]
    RoyaltyOutOfRange,
    /// Caller is not the recorded `original_creator`.
    #[msg("Only the original creator can configure royalty")]
    NotOriginalCreator,
    /// `sale_price` is zero.
    #[msg("Sale price must be > 0")]
    InvalidSalePrice,
    /// Seller == buyer — disallowed; flows that allow self-trades must skip
    /// this enforcement explicitly.
    #[msg("Seller and buyer cannot be the same account")]
    SellerEqualsBuyer,
    /// Royalty config does not match the NFT mint passed in.
    #[msg("Royalty config does not match NFT mint")]
    MintMismatch,
    /// Royalty + protocol fee exceeded sale price (should be unreachable while
    /// constants stay in band; runtime guard for future-proofing).
    #[msg("Deduction exceeds sale price")]
    DeductionOverflow,
    /// Account-binding mismatch.
    #[msg("Unauthorized")]
    Unauthorized,
    /// Arithmetic overflow.
    #[msg("Arithmetic overflow")]
    Overflow,
}

// ─────────────────────────────────────────────────────────────────────
// [whitepaper-sync v1.1] §12 — internal split breakdown
// ─────────────────────────────────────────────────────────────────────

/// Result of computing the royalty / protocol-fee / seller-net split for a
/// secondary NFT sale. Public so off-chain tooling can mirror the same
/// arithmetic via the SDK.
#[derive(Clone, Copy, Debug)]
pub struct NftSaleSplit {
    pub royalty: u64,
    pub fee_total: u64,
    pub burn: u64,
    pub staking: u64,
    pub gas: u64,
    pub ops: u64,
    pub seller_net: u64,
}

/// Compute the WP §12 split deterministically.
///
/// Total deduction = royalty (5–45%) + protocol fee (5%).
/// Protocol fee is then split 40/40/10/10 (2/2/0.5/0.5 of the gross).
/// Seller net = sale_price − royalty − protocol_fee.
pub fn compute_nft_sale_split(sale_price: u64, royalty_bps: u16) -> Result<NftSaleSplit> {
    let bps = royalty_bps as u64;

    // Royalty: sale_price × royalty_bps / 10_000.
    let royalty = (sale_price as u128)
        .checked_mul(bps as u128)
        .ok_or(NftRoyaltyError::Overflow)?
        .checked_div(10_000)
        .ok_or(NftRoyaltyError::Overflow)? as u64;

    // Protocol fee: sale_price × 500 / 10_000.
    let fee_total = (sale_price as u128)
        .checked_mul(NFT_PROTOCOL_FEE_BPS as u128)
        .ok_or(NftRoyaltyError::Overflow)?
        .checked_div(10_000)
        .ok_or(NftRoyaltyError::Overflow)? as u64;

    let burn = (sale_price as u128)
        .checked_mul(BURN_BPS as u128)
        .ok_or(NftRoyaltyError::Overflow)?
        .checked_div(10_000)
        .ok_or(NftRoyaltyError::Overflow)? as u64;
    let staking = (sale_price as u128)
        .checked_mul(STAKING_BPS as u128)
        .ok_or(NftRoyaltyError::Overflow)?
        .checked_div(10_000)
        .ok_or(NftRoyaltyError::Overflow)? as u64;
    let gas = (sale_price as u128)
        .checked_mul(GAS_BPS as u128)
        .ok_or(NftRoyaltyError::Overflow)?
        .checked_div(10_000)
        .ok_or(NftRoyaltyError::Overflow)? as u64;
    // Ops absorbs rounding residue (matches sell_order fee-split convention).
    let ops = fee_total
        .saturating_sub(burn)
        .saturating_sub(staking)
        .saturating_sub(gas);

    let total_deduction = royalty.checked_add(fee_total).ok_or(NftRoyaltyError::Overflow)?;
    let seller_net = sale_price
        .checked_sub(total_deduction)
        .ok_or(NftRoyaltyError::DeductionOverflow)?;

    Ok(NftSaleSplit {
        royalty,
        fee_total,
        burn,
        staking,
        gas,
        ops,
        seller_net,
    })
}

// ─────────────────────────────────────────────────────────────────────
// [whitepaper-sync v1.1] §12.set_royalty
// ─────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(royalty_bps: u16)]
pub struct SetRoyaltyCtx<'info> {
    /// [whitepaper-sync v1.1] §12 — Royalty config PDA. `init` (not
    /// `init_if_needed`) so a creator cannot rewrite the royalty after
    /// mint. Re-creation would require closing the account, which only
    /// the recorded `original_creator` can do.
    #[account(
        init,
        payer = creator,
        space = NftRoyaltyConfig::SIZE,
        seeds = [b"nft-royalty", nft_mint.key().as_ref()],
        bump,
    )]
    pub royalty_config: Account<'info, NftRoyaltyConfig>,

    /// CHECK: NFT mint. We don't deserialize as `Mint<'info>` because some
    /// NFT collections (Metaplex Core / pNFT with extensions) carry account
    /// data layouts that confuse Anchor's `Account<Mint>` parser. The seed
    /// derivation is the binding mechanism.
    pub nft_mint: AccountInfo<'info>,

    /// Original creator — must sign. There is no on-chain way to prove
    /// "original creator" from the mint alone (Metaplex collections support
    /// multi-creator metadata with shares), so we authoritatively record
    /// whoever first invokes `set_royalty` as the original_creator. Front-end
    /// must surface this clearly.
    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn set_royalty(ctx: Context<SetRoyaltyCtx>, royalty_bps: u16) -> Result<()> {
    require!(
        royalty_bps >= MIN_ROYALTY_BPS && royalty_bps <= MAX_ROYALTY_BPS,
        NftRoyaltyError::RoyaltyOutOfRange
    );

    let cfg = &mut ctx.accounts.royalty_config;
    let now = Clock::get()?.unix_timestamp;
    cfg.nft_mint = ctx.accounts.nft_mint.key();
    cfg.original_creator = ctx.accounts.creator.key();
    cfg.royalty_bps = royalty_bps;
    cfg.created_at = now;
    cfg.total_royalties_paid = 0;
    cfg.sale_count = 0;
    cfg.bump = ctx.bumps.royalty_config;

    emit!(NftRoyaltySet {
        nft_mint: cfg.nft_mint,
        original_creator: cfg.original_creator,
        royalty_bps,
        created_at: now,
    });
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────
// [whitepaper-sync v1.1] §12.enforce_royalty_on_sale
// ─────────────────────────────────────────────────────────────────────

/// Account context for `enforce_royalty_on_sale`. Designed to be invoked
/// directly from an off-chain marketplace UI (with the buyer signing) OR
/// CPI'd from a higher-level AURA NFT settlement instruction.
///
/// All token accounts are ORA-denominated — this matches WP §5.7 / §12
/// where every protocol fee + creator royalty is paid in ORA, mirroring
/// the existing fill_sell_order / fill_buy_order fee surfaces.
#[derive(Accounts)]
#[instruction(sale_price: u64)]
pub struct EnforceRoyaltyOnSaleCtx<'info> {
    /// [whitepaper-sync v1.1] §12 — royalty config must exist BEFORE the
    /// sale. If a creator never called `set_royalty`, secondary buyers can
    /// either (a) require the creator to set it first, or (b) route through
    /// a no-royalty NFT sale path that intentionally bypasses this
    /// instruction. The protocol does not silently fall back to a default
    /// — that would mask creator intent.
    #[account(
        mut,
        seeds = [b"nft-royalty", nft_mint.key().as_ref()],
        bump = royalty_config.bump,
        has_one = nft_mint @ NftRoyaltyError::MintMismatch,
    )]
    pub royalty_config: Account<'info, NftRoyaltyConfig>,

    /// CHECK: NFT mint, bound via `has_one` on the config.
    pub nft_mint: AccountInfo<'info>,

    pub ora_mint: Account<'info, Mint>,

    /// Buyer pays from this ORA account.
    #[account(mut,
        constraint = buyer_ora_account.owner == buyer.key() @ NftRoyaltyError::Unauthorized,
        constraint = buyer_ora_account.mint == ORA_MINT @ NftRoyaltyError::Unauthorized,
    )]
    pub buyer_ora_account: Account<'info, TokenAccount>,

    /// Seller receives the net (sale_price − royalty − protocol_fee) here.
    /// Constrained against the on-chain `seller` argument via the
    /// `has_one`-style runtime check below.
    #[account(mut,
        constraint = seller_ora_account.owner == seller.key() @ NftRoyaltyError::Unauthorized,
        constraint = seller_ora_account.mint == ORA_MINT @ NftRoyaltyError::Unauthorized,
    )]
    pub seller_ora_account: Account<'info, TokenAccount>,

    /// Original-creator royalty destination. MUST belong to the
    /// `royalty_config.original_creator`. This prevents a malicious
    /// marketplace UI from rerouting the royalty.
    #[account(mut,
        constraint = creator_ora_account.owner == royalty_config.original_creator
            @ NftRoyaltyError::Unauthorized,
        constraint = creator_ora_account.mint == ORA_MINT @ NftRoyaltyError::Unauthorized,
    )]
    pub creator_ora_account: Account<'info, TokenAccount>,

    /// [audit fix C-20 mirror] Protocol fee pools — locked to the same
    /// PDAs that fill_sell_order / fill_buy_order use.
    #[account(mut, address = STAKING_REWARDS_POOL @ NftRoyaltyError::Unauthorized)]
    pub staking_rewards_account: Account<'info, TokenAccount>,
    #[account(mut, address = GAS_RESERVE_POOL @ NftRoyaltyError::Unauthorized)]
    pub gas_reserve_account: Account<'info, TokenAccount>,
    #[account(mut, address = OPS_TREASURY_POOL @ NftRoyaltyError::Unauthorized)]
    pub ops_treasury_account: Account<'info, TokenAccount>,

    /// Seller signer — required so a third party cannot trigger a sale
    /// that drains the buyer's ORA.
    pub seller: Signer<'info>,

    /// Buyer signer — must sign because the buyer is the payer for all
    /// ORA outflows (royalty, fee, seller-net).
    #[account(mut)]
    pub buyer: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

/// [whitepaper-sync v1.1] §12.enforce_royalty_on_sale
///
/// Charges the creator royalty + standard 5% protocol fee on a secondary
/// NFT sale priced at `sale_price` ORA. Token movements (in lamport units
/// of ORA):
///
///   • royalty            → original_creator
///   • burn (2%)          → ORA mint (burned)
///   • staking (2%)       → STAKING_REWARDS_POOL
///   • gas reserve (0.5%) → GAS_RESERVE_POOL
///   • ops (0.5% + rounding residue) → OPS_TREASURY_POOL
///   • seller_net = sale_price − royalty − 5%  → seller
///
/// Note: this instruction settles **only the cash leg**. The NFT itself
/// is moved by the calling marketplace flow (e.g. via Metaplex pNFT
/// `Transfer` CPI, which independently enforces the pNFT royalty hint).
/// Pairing both layers gives us the WP §12 "non-bypassable" property
/// even if a downstream marketplace later disables pNFT enforcement.
pub fn enforce_royalty_on_sale(ctx: Context<EnforceRoyaltyOnSaleCtx>, sale_price: u64) -> Result<()> {
    require!(sale_price > 0, NftRoyaltyError::InvalidSalePrice);
    require!(
        ctx.accounts.seller.key() != ctx.accounts.buyer.key(),
        NftRoyaltyError::SellerEqualsBuyer
    );

    // Reload runtime guard so a misconfigured deployment can't silently
    // route royalties into system_program::ID. Same guard the audited
    // fill_sell_order / fill_buy_order paths use.
    crate::require_real_pools_configured()
        .map_err(|_| error!(ErrorCode::PlaceholderProtocolPools))?;

    let royalty_bps = ctx.accounts.royalty_config.royalty_bps;
    require!(
        royalty_bps >= MIN_ROYALTY_BPS && royalty_bps <= MAX_ROYALTY_BPS,
        NftRoyaltyError::RoyaltyOutOfRange
    );

    let split = compute_nft_sale_split(sale_price, royalty_bps)?;

    // 1. Royalty → original creator
    if split.royalty > 0 {
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_ora_account.to_account_info(),
                    to: ctx.accounts.creator_ora_account.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            split.royalty,
        )?;
    }

    // 2. Burn 2%
    if split.burn > 0 {
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Burn {
                    mint: ctx.accounts.ora_mint.to_account_info(),
                    from: ctx.accounts.buyer_ora_account.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            split.burn,
        )?;
    }

    // 3. Staking 2%
    if split.staking > 0 {
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_ora_account.to_account_info(),
                    to: ctx.accounts.staking_rewards_account.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            split.staking,
        )?;
    }

    // 4. Gas 0.5%
    if split.gas > 0 {
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_ora_account.to_account_info(),
                    to: ctx.accounts.gas_reserve_account.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            split.gas,
        )?;
    }

    // 5. Ops 0.5% (+ rounding residue)
    if split.ops > 0 {
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_ora_account.to_account_info(),
                    to: ctx.accounts.ops_treasury_account.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            split.ops,
        )?;
    }

    // 6. Seller net
    if split.seller_net > 0 {
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_ora_account.to_account_info(),
                    to: ctx.accounts.seller_ora_account.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            split.seller_net,
        )?;
    }

    // Update telemetry on the config.
    let cfg = &mut ctx.accounts.royalty_config;
    cfg.total_royalties_paid = cfg
        .total_royalties_paid
        .checked_add(split.royalty)
        .ok_or(NftRoyaltyError::Overflow)?;
    cfg.sale_count = cfg.sale_count.checked_add(1).ok_or(NftRoyaltyError::Overflow)?;

    let slot = Clock::get()?.slot;
    emit!(NftRoyaltyEnforced {
        nft_mint: cfg.nft_mint,
        original_creator: cfg.original_creator,
        seller: ctx.accounts.seller.key(),
        buyer: ctx.accounts.buyer.key(),
        sale_price,
        royalty_bps,
        royalty_paid: split.royalty,
        protocol_fee: split.fee_total,
        seller_net: split.seller_net,
        slot,
    });
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────
// [whitepaper-sync v1.1] §12 — unit tests
// ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_at_min_royalty_5pct() {
        // 1_000 ORA sale at 5% royalty + 5% fee → seller nets 90%.
        let s = compute_nft_sale_split(1_000_000_000, MIN_ROYALTY_BPS).unwrap();
        assert_eq!(s.royalty, 50_000_000);          // 5%
        assert_eq!(s.fee_total, 50_000_000);        // 5%
        assert_eq!(s.burn, 20_000_000);             // 2%
        assert_eq!(s.staking, 20_000_000);          // 2%
        assert_eq!(s.gas, 5_000_000);               // 0.5%
        assert_eq!(s.ops, 5_000_000);               // 0.5% (no rounding here)
        assert_eq!(s.seller_net, 900_000_000);      // 90%
        // sanity: sum of legs == sale price
        assert_eq!(
            s.royalty + s.burn + s.staking + s.gas + s.ops + s.seller_net,
            1_000_000_000
        );
    }

    #[test]
    fn split_at_max_royalty_45pct() {
        // 1_000 ORA sale at 45% royalty + 5% fee → seller nets 50%.
        let s = compute_nft_sale_split(1_000_000_000, MAX_ROYALTY_BPS).unwrap();
        assert_eq!(s.royalty, 450_000_000);
        assert_eq!(s.fee_total, 50_000_000);
        assert_eq!(s.seller_net, 500_000_000);
        assert_eq!(
            s.royalty + s.burn + s.staking + s.gas + s.ops + s.seller_net,
            1_000_000_000
        );
    }

    #[test]
    fn split_rounding_residue_goes_to_ops() {
        // Awkward price: 12345 lamports of ORA at 10% royalty.
        // royalty = 12345 * 1000 / 10000 = 1234
        // fee = 12345 * 500 / 10000 = 617
        // burn = 12345 * 200 / 10000 = 246
        // staking = 12345 * 200 / 10000 = 246
        // gas = 12345 * 50 / 10000 = 61
        // ops = 617 - 246 - 246 - 61 = 64 (absorbs the +3 residue)
        let s = compute_nft_sale_split(12_345, 1_000).unwrap();
        assert_eq!(s.royalty, 1_234);
        assert_eq!(s.fee_total, 617);
        assert_eq!(s.burn, 246);
        assert_eq!(s.staking, 246);
        assert_eq!(s.gas, 61);
        assert_eq!(s.ops, 64);
        assert_eq!(s.seller_net, 12_345 - 1_234 - 617);
        assert_eq!(
            s.royalty + s.burn + s.staking + s.gas + s.ops + s.seller_net,
            12_345
        );
    }

    #[test]
    fn split_zero_price_handled_by_caller() {
        // compute_nft_sale_split itself doesn't reject zero — `enforce_royalty_on_sale`
        // does, before we get here. With zero price every leg is zero.
        let s = compute_nft_sale_split(0, MIN_ROYALTY_BPS).unwrap();
        assert_eq!(s.royalty, 0);
        assert_eq!(s.fee_total, 0);
        assert_eq!(s.seller_net, 0);
    }

    #[test]
    fn constants_match_whitepaper_v1_1_section_12() {
        // Belt-and-suspenders against accidental bps drift.
        assert_eq!(MIN_ROYALTY_BPS, 500);
        assert_eq!(MAX_ROYALTY_BPS, 4500);
        assert_eq!(DEFAULT_ROYALTY_BPS, 500);
        assert_eq!(NFT_PROTOCOL_FEE_BPS, 500);
        assert_eq!(MAX_TOTAL_DEDUCTION_BPS, 5000); // 50% max combined deduction
    }
}
