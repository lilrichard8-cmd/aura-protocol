// [whitepaper-sync v1.1] §13 content-keys — Encrypted Content with NFT Access.
// Implements the on-chain `content_key` program described in Whitepaper v1.1
// §13 ("Content Keys — Encrypted Content with NFT Access"):
//   - Creator publishes encrypted content (Arweave + Lit Protocol) → on-chain
//     `EncryptedContent` PDA stores the Arweave TX id, key price (in ORA
//     atomic units), per-edge royalty bps, and access type.
//   - Fans `buy_key` → pay ORA into the content's escrow ATA. 95% routes to
//     the creator's ATA, 5% routes to the protocol fee split (2% burn /
//     2% staking / 0.5% gas / 0.5% ops, matching WP §5.7 / Numbers Handbook
//     §5). Buyer receives a `ContentKey` PDA representing the NFT access
//     right. Off-chain (Lit Protocol) verifies the holder before decrypting.
//   - Holders can list keys on the secondary market (`list_key`), with the
//     listing's price stored on-chain. A buyer (`buy_listed_key`) pays the
//     seller 90%, the original creator 5% (royalty per WP §13 fee table),
//     and 5% to the protocol (split identically to the primary fee).
//   - `delist_key` cancels a listing, `update_content` lets the creator
//     publish a new Arweave blob (existing keys still work — WP §13 "How It
//     Works" step 6), and `deactivate_content` blocks new key sales while
//     preserving the validity of already-purchased keys for redemption
//     history.
//
// Pool / mint / admin pubkeys are hardcoded `system_program::ID` placeholders
// — DO NOT DEPLOY without replacing them. The `require_real_pools_configured`
// runtime guard surfaces this deploy-blocker as a clean error instead of
// Anchor's generic `AccountNotInitialized`.
//
// Wire-format conventions mirror `programs/market` (Bounty V2):
//   - Anchor 0.29, sha256("global:<snake_case_name>")[..8] instruction
//     discriminators.
//   - Per-PDA seeds documented inline on each `#[derive(Accounts)]` block.
//   - Token transfers strictly via SPL `token::transfer` / `token::burn`
//     CPI with the appropriate PDA signer seeds.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};

declare_id!("HCZyqzGVjmUKfUfztmL4ceeZkw3Pm5spdsBjWQ4yaHqT");

// ╔══════════════════════════════════════════════════════════════════════╗
// ║  ⚠️ ⚠️ ⚠️  DO NOT DEPLOY TO MAINNET  ⚠️ ⚠️ ⚠️                              ║
// ║                                                                      ║
// ║  All protocol-pool / mint / admin constants below are placeholders   ║
// ║  set to `system_program::ID`. Deploying with these placeholders      ║
// ║  bricks every revenue-generating instruction (`buy_key`,             ║
// ║  `buy_listed_key`) because the `address = ...` constraints can       ║
// ║  never be satisfied. Replace + retest before mainnet.                ║
// ╚══════════════════════════════════════════════════════════════════════╝

/// [whitepaper-sync v1.1] §13 content-keys — Program admin allowed to rotate
/// (future) protocol-controlled parameters. Mirrors market::PROGRAM_ADMIN.
/// ⚠️ DO NOT DEPLOY — placeholder = system program ID.
// [local-deploy 2026-05-19] real address on localnet: DppCZV1QDh6D4hoUJvpQCjiZ5KCjV4YTokUGsu7m4bxP
pub const PROGRAM_ADMIN: Pubkey = Pubkey::new_from_array([190, 139, 232, 217, 216, 167, 202, 133, 100, 57, 237, 31, 194, 128, 82, 13, 164, 131, 226, 139, 206, 103, 215, 221, 251, 39, 85, 246, 98, 109, 149, 76]);

/// [whitepaper-sync v1.1] §13 content-keys — Canonical ORA mint. All buys
/// and royalty payments are denominated in ORA atomic units.
/// ⚠️ DO NOT DEPLOY — placeholder = system program ID.
// [local-deploy 2026-05-19] real address on localnet: AE2saLnjj8u9RGQyftYw4wLX5wR2HbJ3byb1t97CdF8s
pub const ORA_MINT: Pubkey = Pubkey::new_from_array([137, 15, 217, 121, 122, 4, 82, 92, 100, 203, 47, 28, 205, 45, 150, 226, 133, 111, 232, 149, 62, 3, 156, 144, 35, 103, 3, 130, 149, 120, 102, 80]);

/// [whitepaper-sync v1.1] §13 content-keys — Protocol fee pools (ORA-only).
/// Identical pubkeys to `programs/market` so off-chain accounting stays
/// consistent across modules. ⚠️ DO NOT DEPLOY — placeholders.
// [local-deploy 2026-05-19] real address on localnet: 9byFYXdRziBe6huCRCsExz65eJMJRxkLPNReTYPzCiHS
pub const STAKING_REWARDS_POOL: Pubkey = Pubkey::new_from_array([127, 210, 216, 137, 107, 161, 33, 182, 172, 186, 167, 117, 190, 40, 215, 32, 84, 56, 69, 15, 197, 164, 130, 140, 59, 246, 11, 42, 77, 87, 94, 69]);
// [local-deploy 2026-05-19] real address on localnet: G9faGRWp35cDnGZdE38zwTisErASpYGoYcCKDvY3CPEE
pub const GAS_RESERVE_POOL: Pubkey = Pubkey::new_from_array([225, 23, 144, 204, 122, 29, 73, 91, 161, 241, 10, 117, 27, 233, 253, 109, 104, 15, 163, 59, 61, 24, 233, 119, 245, 67, 128, 29, 70, 173, 249, 143]);
// [local-deploy 2026-05-19] real address on localnet: FcpiWgjWuA39CMZfahxhDSMUGUavB4kVHjuovGvAxr1f
pub const OPS_TREASURY_POOL: Pubkey = Pubkey::new_from_array([217, 48, 229, 202, 178, 131, 49, 202, 84, 203, 0, 200, 144, 206, 29, 150, 143, 191, 101, 210, 58, 17, 161, 63, 138, 132, 39, 227, 12, 173, 122, 146]);

// ─── Fee constants (WP §5.7 / Numbers Handbook §5) ──────────────────────────

/// [whitepaper-sync v1.1] §13 content-keys — Primary sale total fee = 5%.
/// Buyer pays full price; creator nets 95%.
pub const PRIMARY_FEE_BPS: u64 = 500;
/// [whitepaper-sync v1.1] §13 content-keys — Primary burn portion (2%).
pub const PRIMARY_BURN_BPS: u64 = 200;
/// [whitepaper-sync v1.1] §13 content-keys — Primary staking-rewards portion (2%).
pub const PRIMARY_STAKING_BPS: u64 = 200;
/// [whitepaper-sync v1.1] §13 content-keys — Primary gas-reserve portion (0.5%).
pub const PRIMARY_GAS_BPS: u64 = 50;
/// [whitepaper-sync v1.1] §13 content-keys — Primary ops-treasury portion (0.5%).
pub const PRIMARY_OPS_BPS: u64 = 50;

/// [whitepaper-sync v1.1] §13 content-keys — Default secondary-market
/// creator royalty (5%). WP §13 "Fee Structure" table: creator earns the
/// stored `royalty_bps`, protocol earns a flat 5% on every resale.
pub const SECONDARY_ROYALTY_BPS: u64 = 500;
/// [whitepaper-sync v1.1] §13 content-keys — Secondary protocol fee (5%).
pub const SECONDARY_PROTOCOL_FEE_BPS: u64 = 500;

/// [audit fix M-CK-1] key resale = NFT secondary (45% cap per §12 decision)
///
/// Secondary-market resale of an encrypted-content NFT key is functionally an
/// NFT secondary sale, so the creator-settable royalty band must mirror the
/// §12 NFT royalty range (5–45%, default 5%) enforced in
/// `programs/market/src/royalty.rs`. Søren confirmed 2026-05-18 that key
/// resales follow the §12 NFT royalty schedule, NOT the §12 remix-revenue
/// 15% cap. The Metaplex pNFT 45% ceiling remains the upper bound.
///
/// `MIN_ROYALTY_BPS = 500`  (5%)
/// `MAX_ROYALTY_BPS = 4500` (45%)
pub const MIN_ROYALTY_BPS: u16 = 500;
pub const MAX_ROYALTY_BPS: u16 = 4500;

/// [audit fix M-CK-1] Backwards-compatible alias. Older SDK builds import
/// `ROYALTY_MAX_BPS`; keep the symbol so we don't break wire-format mirrors.
pub const ROYALTY_MAX_BPS: u16 = MAX_ROYALTY_BPS;

// ─── String length caps ─────────────────────────────────────────────────────

/// [whitepaper-sync v1.1] §13 content-keys — Arweave tx id length cap.
/// Arweave tx ids are 43 base64url chars; bump to 64 to leave room for
/// versioned tx-id schemes.
pub const ARWEAVE_TX_MAX: usize = 64;

// ─── Runtime guard ──────────────────────────────────────────────────────────

/// [whitepaper-sync v1.1] §13 content-keys — Aborts revenue-generating
/// instructions when the placeholder protocol-pool constants haven't been
/// replaced. Mirrors `market::require_real_pools_configured`.
fn require_real_pools_configured() -> Result<()> {
    let placeholder = anchor_lang::solana_program::system_program::ID;
    require!(
        STAKING_REWARDS_POOL != placeholder
            && GAS_RESERVE_POOL != placeholder
            && OPS_TREASURY_POOL != placeholder
            && ORA_MINT != placeholder,
        ContentKeysError::PlaceholderProtocolPools
    );
    Ok(())
}

// ─── Helpers ────────────────────────────────────────────────────────────────

#[inline]
fn bps(amount: u64, bps_value: u64) -> Result<u64> {
    // [whitepaper-sync v1.1] §13 content-keys — checked-arithmetic bps split
    // helper. Floor-divide so the fee rounds down; any rounding crumb stays
    // with the seller / creator (cannot become unaccounted dust).
    let v = (amount as u128)
        .checked_mul(bps_value as u128)
        .ok_or(ContentKeysError::Overflow)?
        / 10_000u128;
    Ok(v as u64)
}

// ─── Program ────────────────────────────────────────────────────────────────

#[program]
pub mod aura_content_keys {
    use super::*;

    /// [whitepaper-sync v1.1] §13 content-keys — Surface the placeholder-pools
    /// deploy-blocker as a clean error instead of `AccountNotInitialized`.
    pub fn assert_pools_configured(_ctx: Context<NoopCtx>) -> Result<()> {
        require_real_pools_configured()
    }

    /// [whitepaper-sync v1.1] §13 content-keys — One-time per creator. Mirrors
    /// `bounty-counter`: bumps a monotonic id so each creator can publish
    /// multiple distinct content blobs without title collisions.
    pub fn init_content_counter(ctx: Context<InitContentCounter>) -> Result<()> {
        let c = &mut ctx.accounts.content_counter;
        c.creator = ctx.accounts.creator.key();
        c.count = 0;
        c.bump = ctx.bumps.content_counter;
        Ok(())
    }

    /// [whitepaper-sync v1.1] §13 content-keys — Creator publishes encrypted
    /// content. WP §13 "How It Works" steps 1-2: the encrypted blob is
    /// already on Arweave under `arweave_tx_id` and the Lit Protocol access
    /// conditions reference the resulting `ContentKey` PDA. This instruction
    /// just records the metadata + price + royalty on-chain so `buy_key`
    /// can route payments correctly.
    pub fn publish_content(
        ctx: Context<PublishContent>,
        content_id: u64,
        arweave_tx_id: String,
        key_price_lamports: u64,
        royalty_bps: u16,
        access_type: AccessType,
    ) -> Result<()> {
        // [whitepaper-sync v1.1] §13 content-keys — Input validation:
        require!(
            arweave_tx_id.len() <= ARWEAVE_TX_MAX,
            ContentKeysError::ArweaveTxTooLong
        );
        require!(key_price_lamports > 0, ContentKeysError::InvalidPrice);
        // [audit fix M-CK-1] key resale = NFT secondary (45% cap per §12 decision)
        // — enforce the same 500..=4500 bps band as `market::royalty`. Creator
        // MUST pick a royalty in [5%, 45%]; 0%/<5% is no longer allowed because
        // §12 mandates a creator floor on secondary content NFT sales.
        require!(
            royalty_bps >= MIN_ROYALTY_BPS && royalty_bps <= MAX_ROYALTY_BPS,
            ContentKeysError::InvalidRoyaltyBps
        );
        // [whitepaper-sync v1.1] §13 content-keys — Burn-after-reading keys
        // are single-use; subscription keys carry an expiry; permanent keys
        // never expire. Subscription duration must be > 0.
        if let AccessType::Subscription { duration_secs } = access_type {
            require!(duration_secs > 0, ContentKeysError::InvalidSubscriptionDuration);
        }

        // [whitepaper-sync v1.1] §13 content-keys — counter must agree with
        // the passed `content_id`. Defence-in-depth against the SDK building
        // a stale tx after another publish landed first.
        let counter = &mut ctx.accounts.content_counter;
        require!(counter.count == content_id, ContentKeysError::ContentIdMismatch);
        counter.count = counter.count.checked_add(1).ok_or(ContentKeysError::Overflow)?;

        let now = Clock::get()?.unix_timestamp;
        let c = &mut ctx.accounts.content;
        c.content_id = content_id;
        c.creator = ctx.accounts.creator.key();
        c.arweave_tx_id = arweave_tx_id;
        c.key_price_lamports = key_price_lamports;
        c.royalty_bps = royalty_bps;
        c.access_type = access_type;
        c.total_keys_minted = 0;
        c.is_active = true;
        c.created_at = now;
        c.bump = ctx.bumps.content;

        emit!(ContentPublished {
            content: c.key(),
            creator: c.creator,
            content_id,
            key_price_lamports,
            royalty_bps,
            slot: Clock::get()?.slot,
        });
        Ok(())
    }

    /// [whitepaper-sync v1.1] §13 content-keys — Creator updates the
    /// underlying encrypted blob (WP §13 "How It Works" step 6: "Existing
    /// keys remain valid — holders automatically get the updated version").
    /// Only the `arweave_tx_id` is mutable; price + royalty + access type
    /// are locked at publish time to avoid bait-and-switch on holders.
    pub fn update_content(
        ctx: Context<UpdateContent>,
        new_arweave_tx_id: String,
    ) -> Result<()> {
        require!(
            new_arweave_tx_id.len() <= ARWEAVE_TX_MAX,
            ContentKeysError::ArweaveTxTooLong
        );
        let c = &mut ctx.accounts.content;
        // [whitepaper-sync v1.1] §13 content-keys — Even deactivated content
        // may be updated (e.g. to publish a final read-only archive blob)
        // since existing keys are still valid.
        c.arweave_tx_id = new_arweave_tx_id;

        emit!(ContentUpdated {
            content: c.key(),
            creator: c.creator,
            slot: Clock::get()?.slot,
        });
        Ok(())
    }

    /// [whitepaper-sync v1.1] §13 content-keys — Creator removes content
    /// from new sales. Existing keys remain valid for decryption history /
    /// secondary trades (WP §13 — keys are *ownership of access*, not a
    /// revocable license). Idempotent — calling twice is a no-op.
    pub fn deactivate_content(ctx: Context<DeactivateContent>) -> Result<()> {
        let c = &mut ctx.accounts.content;
        c.is_active = false;

        emit!(ContentDeactivated {
            content: c.key(),
            creator: c.creator,
            slot: Clock::get()?.slot,
        });
        Ok(())
    }

    /// [whitepaper-sync v1.1] §13 content-keys — Fan buys a key.
    /// Pays `content.key_price_lamports` ORA. Routes 95% to creator's ATA,
    /// 5% across burn / staking / gas / ops (matching WP §5.7 split).
    /// Mints a `ContentKey` PDA seeded by (content, buyer, serial) so a
    /// single buyer can hold multiple keys for the same content (useful for
    /// gifting / resale inventory).
    pub fn buy_key(ctx: Context<BuyKey>, content_id: u64) -> Result<()> {
        require_real_pools_configured()?;

        // [audit fix R5 M-CK-2] defensive pre-check on the `total_keys_minted
        // + 1` PDA seed expression. Anchor evaluates that expression BEFORE
        // the handler runs `checked_add`, so a u64::MAX value would panic at
        // seed-derivation time (hard-revert nuisance). Economically
        // infeasible (18 quintillion sales of one content) but mechanically
        // possible; this short-circuits with a clean error instead.
        require!(
            ctx.accounts.content.total_keys_minted < u64::MAX,
            ContentKeysError::KeySerialOverflow
        );

        let price = ctx.accounts.content.key_price_lamports;
        require!(ctx.accounts.content.is_active, ContentKeysError::ContentInactive);
        require!(
            ctx.accounts.content.content_id == content_id,
            ContentKeysError::ContentIdMismatch
        );
        require!(price > 0, ContentKeysError::InvalidPrice);

        // [whitepaper-sync v1.1] §13 content-keys — Token accounts must hold
        // ORA. We defend in depth via constraints on the Accounts context;
        // restated here for clarity in the error path.
        require!(
            ctx.accounts.buyer_ora_account.mint == ORA_MINT
                && ctx.accounts.creator_ora_account.mint == ORA_MINT
                && ctx.accounts.ora_mint.key() == ORA_MINT,
            ContentKeysError::WrongMint
        );

        // ── Fee split (WP §5.7) ──
        let burn_amt = bps(price, PRIMARY_BURN_BPS)?;
        let staking_amt = bps(price, PRIMARY_STAKING_BPS)?;
        let gas_amt = bps(price, PRIMARY_GAS_BPS)?;
        let ops_amt = bps(price, PRIMARY_OPS_BPS)?;
        let protocol_total = burn_amt
            .checked_add(staking_amt)
            .and_then(|v| v.checked_add(gas_amt))
            .and_then(|v| v.checked_add(ops_amt))
            .ok_or(ContentKeysError::Overflow)?;
        let to_creator = price
            .checked_sub(protocol_total)
            .ok_or(ContentKeysError::Overflow)?;

        // ── 1) buyer → creator (95%) ──
        if to_creator > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.buyer_ora_account.to_account_info(),
                        to: ctx.accounts.creator_ora_account.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                ),
                to_creator,
            )?;
        }

        // ── 2) buyer → burn (2%) ──
        if burn_amt > 0 {
            token::burn(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Burn {
                        mint: ctx.accounts.ora_mint.to_account_info(),
                        from: ctx.accounts.buyer_ora_account.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                ),
                burn_amt,
            )?;
        }

        // ── 3) buyer → staking pool (2%) ──
        if staking_amt > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.buyer_ora_account.to_account_info(),
                        to: ctx.accounts.staking_pool_account.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                ),
                staking_amt,
            )?;
        }

        // ── 4) buyer → gas reserve (0.5%) ──
        if gas_amt > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.buyer_ora_account.to_account_info(),
                        to: ctx.accounts.gas_reserve_account.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                ),
                gas_amt,
            )?;
        }

        // ── 5) buyer → ops treasury (0.5%) ──
        if ops_amt > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.buyer_ora_account.to_account_info(),
                        to: ctx.accounts.ops_treasury_account.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                ),
                ops_amt,
            )?;
        }

        // ── 6) Persist key + bump counters ──
        let now = Clock::get()?.unix_timestamp;
        let content = &mut ctx.accounts.content;
        let serial = content
            .total_keys_minted
            .checked_add(1)
            .ok_or(ContentKeysError::Overflow)?;
        content.total_keys_minted = serial;

        let key = &mut ctx.accounts.key;
        key.content_id = content_id;
        key.key_owner = ctx.accounts.buyer.key();
        key.purchased_at = now;
        key.purchase_price = price;
        key.key_serial = serial;
        key.is_active = true;
        key.bump = ctx.bumps.key;

        emit!(KeyPurchased {
            content: content.key(),
            key: key.key(),
            buyer: key.key_owner,
            creator: content.creator,
            content_id,
            key_serial: serial,
            gross_price: price,
            net_to_creator: to_creator,
            burn_amount: burn_amt,
            staking_amount: staking_amt,
            gas_amount: gas_amt,
            ops_amount: ops_amt,
            slot: Clock::get()?.slot,
        });
        Ok(())
    }

    /// [whitepaper-sync v1.1] §13 content-keys — Owner lists a key for resale.
    /// Listing is non-custodial (the seller retains the `ContentKey` PDA;
    /// transfer happens atomically inside `buy_listed_key`). This matches
    /// the WP §13 "Secondary Market" flow where the original creator still
    /// earns a royalty on every resale.
    pub fn list_key(
        ctx: Context<ListKey>,
        _content_id: u64,
        list_price_lamports: u64,
    ) -> Result<()> {
        require!(list_price_lamports > 0, ContentKeysError::InvalidPrice);
        require!(ctx.accounts.key.is_active, ContentKeysError::KeyInactive);
        require!(
            ctx.accounts.key.key_owner == ctx.accounts.seller.key(),
            ContentKeysError::Unauthorized
        );

        let now = Clock::get()?.unix_timestamp;
        let l = &mut ctx.accounts.listing;
        l.key = ctx.accounts.key.key();
        l.seller = ctx.accounts.seller.key();
        l.list_price_lamports = list_price_lamports;
        l.listed_at = now;
        l.is_active = true;
        l.bump = ctx.bumps.listing;

        emit!(KeyListed {
            key: l.key,
            listing: l.key(),
            seller: l.seller,
            list_price_lamports,
            slot: Clock::get()?.slot,
        });
        Ok(())
    }

    /// [whitepaper-sync v1.1] §13 content-keys — Seller delists. Idempotent
    /// via `is_active` flag.
    // [audit fix R6-CK-H1] close listing on delist for relistability.
    // Previously delist_key flipped is_active=false but kept the PDA alive;
    // since list_key uses `init` (not `init_if_needed`) on a PDA seeded only
    // by [b"listing", key.key()], the seller was permanently locked out of
    // re-listing the same key (Anchor reverts AccountAlreadyInitialized).
    // Now the listing account is closed (`close = seller` in DelistKey ctx)
    // so rent is refunded and a fresh `init` succeeds on subsequent list_key.
    pub fn delist_key(ctx: Context<DelistKey>) -> Result<()> {
        require!(
            ctx.accounts.listing.seller == ctx.accounts.seller.key(),
            ContentKeysError::Unauthorized
        );
        let l = &mut ctx.accounts.listing;
        l.is_active = false;

        emit!(KeyDelisted {
            listing: l.key(),
            seller: l.seller,
            slot: Clock::get()?.slot,
        });
        Ok(())
    }

    /// [whitepaper-sync v1.1] §13 content-keys — Secondary purchase.
    /// WP §13 "Fee Structure" / "How It Works" step 5:
    ///   - 90% to seller
    ///   - `royalty_bps` (default 5%, max 45%) to original creator
    ///   - 5% to protocol (split 40/40/10/10 across burn/staking/gas/ops)
    /// Ownership of the `ContentKey` PDA transfers to the buyer atomically.
    pub fn buy_listed_key(
        ctx: Context<BuyListedKey>,
        _content_id: u64,
    ) -> Result<()> {
        require_real_pools_configured()?;

        let listing = &ctx.accounts.listing;
        require!(listing.is_active, ContentKeysError::ListingInactive);
        // [audit fix R6-CK-H2] reject self-buy wash trading.
        // Mirrors market::royalty::enforce_royalty_on_sale's SellerEqualsBuyer
        // guard. Without this a seller could buy their own listing to inflate
        // KeyResold volume / staking-pool inflows / creator royalty receipts.
        require!(
            ctx.accounts.buyer.key() != listing.seller,
            ContentKeysError::SelfBuyForbidden
        );
        require!(
            listing.key == ctx.accounts.key.key(),
            ContentKeysError::ListingKeyMismatch
        );
        require!(
            listing.seller == ctx.accounts.key.key_owner,
            ContentKeysError::ListingKeyMismatch
        );
        require!(
            ctx.accounts.content.creator == ctx.accounts.creator_ora_account.owner,
            ContentKeysError::CreatorRoyaltyMismatch
        );
        require!(
            ctx.accounts.content.content_id == ctx.accounts.key.content_id,
            ContentKeysError::ContentIdMismatch
        );

        let price = listing.list_price_lamports;
        require!(price > 0, ContentKeysError::InvalidPrice);

        // Mint guards (defence in depth — Accounts context also checks).
        require!(
            ctx.accounts.buyer_ora_account.mint == ORA_MINT
                && ctx.accounts.seller_ora_account.mint == ORA_MINT
                && ctx.accounts.creator_ora_account.mint == ORA_MINT
                && ctx.accounts.ora_mint.key() == ORA_MINT,
            ContentKeysError::WrongMint
        );

        // ── Fee split ── [audit fix M-CK-1] key resale = NFT secondary (§12 schedule)
        // royalty_bps is stored per-content at publish-time, banded by
        // [MIN_ROYALTY_BPS, MAX_ROYALTY_BPS] = [500, 4500] (5%–45%) to mirror
        // the §12 NFT royalty schedule. Protocol fee is a flat 5%, split into
        // burn / staking / gas / ops at the same 40/40/10/10 ratio as the
        // primary fee. Seller nets price − 5% protocol − royalty_bps/100%
        // (so seller_net ranges 50% at royalty=45% up to 90% at royalty=5%).
        let royalty_amt = bps(price, ctx.accounts.content.royalty_bps as u64)?;
        let burn_amt = bps(price, PRIMARY_BURN_BPS)?;
        let staking_amt = bps(price, PRIMARY_STAKING_BPS)?;
        let gas_amt = bps(price, PRIMARY_GAS_BPS)?;
        let ops_amt = bps(price, PRIMARY_OPS_BPS)?;
        let protocol_total = burn_amt
            .checked_add(staking_amt)
            .and_then(|v| v.checked_add(gas_amt))
            .and_then(|v| v.checked_add(ops_amt))
            .ok_or(ContentKeysError::Overflow)?;
        let combined_fees = royalty_amt
            .checked_add(protocol_total)
            .ok_or(ContentKeysError::Overflow)?;
        require!(combined_fees <= price, ContentKeysError::FeesExceedPrice);
        let to_seller = price
            .checked_sub(combined_fees)
            .ok_or(ContentKeysError::Overflow)?;

        // ── 1) buyer → seller ──
        if to_seller > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.buyer_ora_account.to_account_info(),
                        to: ctx.accounts.seller_ora_account.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                ),
                to_seller,
            )?;
        }

        // ── 2) buyer → original creator (royalty) ──
        if royalty_amt > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.buyer_ora_account.to_account_info(),
                        to: ctx.accounts.creator_ora_account.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                ),
                royalty_amt,
            )?;
        }

        // ── 3) Protocol fee: burn ──
        if burn_amt > 0 {
            token::burn(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Burn {
                        mint: ctx.accounts.ora_mint.to_account_info(),
                        from: ctx.accounts.buyer_ora_account.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                ),
                burn_amt,
            )?;
        }

        // ── 4) Protocol fee: staking ──
        if staking_amt > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.buyer_ora_account.to_account_info(),
                        to: ctx.accounts.staking_pool_account.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                ),
                staking_amt,
            )?;
        }

        // ── 5) Protocol fee: gas ──
        if gas_amt > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.buyer_ora_account.to_account_info(),
                        to: ctx.accounts.gas_reserve_account.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                ),
                gas_amt,
            )?;
        }

        // ── 6) Protocol fee: ops ──
        if ops_amt > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.buyer_ora_account.to_account_info(),
                        to: ctx.accounts.ops_treasury_account.to_account_info(),
                        authority: ctx.accounts.buyer.to_account_info(),
                    },
                ),
                ops_amt,
            )?;
        }

        // ── 7) Transfer key ownership + close listing ──
        // [audit fix R6-CK-H1] listing PDA is closed via `close = seller`
        // in BuyListedKey ctx so re-listing is possible. We still mark
        // is_active = false for any downstream snapshotters that pluck the
        // pre-close state from logs.
        let key = &mut ctx.accounts.key;
        key.key_owner = ctx.accounts.buyer.key();

        let l = &mut ctx.accounts.listing;
        l.is_active = false;
        let listing_key_for_event = l.key();
        let listing_seller_for_event = l.seller;

        emit!(KeyResold {
            content: ctx.accounts.content.key(),
            key: key.key(),
            listing: listing_key_for_event,
            seller: listing_seller_for_event,
            buyer: key.key_owner,
            list_price_lamports: price,
            seller_proceeds: to_seller,
            creator_royalty: royalty_amt,
            burn_amount: burn_amt,
            staking_amount: staking_amt,
            gas_amount: gas_amt,
            ops_amount: ops_amt,
            slot: Clock::get()?.slot,
        });
        Ok(())
    }
}

// ─── Accounts ───────────────────────────────────────────────────────────────

/// [whitepaper-sync v1.1] §13 content-keys — Per-creator monotonic content id.
/// One PDA per creator, seeded by `b"content-counter" || creator.key()`.
#[account]
pub struct ContentCounter {
    pub creator: Pubkey,
    pub count: u64,
    pub bump: u8,
}
impl ContentCounter {
    pub const SIZE: usize = 8 + 32 + 8 + 1;
    pub const SEED: &'static [u8] = b"content-counter";
}

/// [whitepaper-sync v1.1] §13 content-keys — Stores Arweave tx id, encrypted-
/// content metadata, price (ORA), per-edge royalty bps, and access policy.
/// PDA seeded by `b"content" || creator.key() || content_id.to_le_bytes()`.
#[account]
pub struct EncryptedContent {
    pub content_id: u64,
    pub creator: Pubkey,
    pub arweave_tx_id: String, // current encrypted blob — replaceable via update_content
    pub key_price_lamports: u64, // ORA atomic units
    pub royalty_bps: u16, // secondary market royalty in [MIN_ROYALTY_BPS, MAX_ROYALTY_BPS]
    pub access_type: AccessType,
    pub total_keys_minted: u64,
    pub is_active: bool,
    pub created_at: i64,
    pub bump: u8,
}
impl EncryptedContent {
    // discriminator(8) + content_id(8) + creator(32)
    // + arweave_tx_id (4 + ARWEAVE_TX_MAX) + key_price(8) + royalty_bps(2)
    // + access_type (1 + 8 worst-case for Subscription duration) + minted(8)
    // + is_active(1) + created_at(8) + bump(1)
    pub const SIZE: usize = 8 + 8 + 32 + (4 + ARWEAVE_TX_MAX) + 8 + 2 + (1 + 8) + 8 + 1 + 8 + 1;
    pub const SEED: &'static [u8] = b"content";
}

/// [whitepaper-sync v1.1] §13 content-keys — Per-key access record (the
/// on-chain NFT-key representation). PDA seeded by
/// `b"content-key" || content.key() || key_serial.to_le_bytes()` so the
/// PDA address is content-scoped and serially indexable.
#[account]
pub struct ContentKey {
    pub content_id: u64,
    pub key_owner: Pubkey,
    pub purchased_at: i64,
    pub purchase_price: u64,
    pub key_serial: u64,
    pub is_active: bool,
    pub bump: u8,
}
impl ContentKey {
    pub const SIZE: usize = 8 + 8 + 32 + 8 + 8 + 8 + 1 + 1;
    pub const SEED: &'static [u8] = b"content-key";
}

/// [whitepaper-sync v1.1] §13 content-keys — Secondary market listing PDA.
/// One per (key) at a time; closed (`is_active = false`) on sale or delist.
#[account]
pub struct KeyListing {
    pub key: Pubkey,
    pub seller: Pubkey,
    pub list_price_lamports: u64,
    pub listed_at: i64,
    pub is_active: bool,
    pub bump: u8,
}
impl KeyListing {
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 8 + 1 + 1;
    pub const SEED: &'static [u8] = b"key-listing";
}

// ─── Enums ──────────────────────────────────────────────────────────────────

/// [whitepaper-sync v1.1] §13 content-keys — Three access policies, per
/// WP §13 supported content types (permanent purchase, subscription-style
/// expiry, single-use burn-after-reading).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum AccessType {
    Permanent,
    Subscription { duration_secs: i64 },
    BurnAfterReading,
}

// ─── Events ─────────────────────────────────────────────────────────────────

#[event]
pub struct ContentPublished {
    pub content: Pubkey,
    pub creator: Pubkey,
    pub content_id: u64,
    pub key_price_lamports: u64,
    pub royalty_bps: u16,
    pub slot: u64,
}

#[event]
pub struct ContentUpdated {
    pub content: Pubkey,
    pub creator: Pubkey,
    pub slot: u64,
}

#[event]
pub struct ContentDeactivated {
    pub content: Pubkey,
    pub creator: Pubkey,
    pub slot: u64,
}

#[event]
pub struct KeyPurchased {
    pub content: Pubkey,
    pub key: Pubkey,
    pub buyer: Pubkey,
    pub creator: Pubkey,
    pub content_id: u64,
    pub key_serial: u64,
    pub gross_price: u64,
    pub net_to_creator: u64,
    pub burn_amount: u64,
    pub staking_amount: u64,
    pub gas_amount: u64,
    pub ops_amount: u64,
    pub slot: u64,
}

#[event]
pub struct KeyListed {
    pub key: Pubkey,
    pub listing: Pubkey,
    pub seller: Pubkey,
    pub list_price_lamports: u64,
    pub slot: u64,
}

#[event]
pub struct KeyDelisted {
    pub listing: Pubkey,
    pub seller: Pubkey,
    pub slot: u64,
}

#[event]
pub struct KeyResold {
    pub content: Pubkey,
    pub key: Pubkey,
    pub listing: Pubkey,
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub list_price_lamports: u64,
    pub seller_proceeds: u64,
    pub creator_royalty: u64,
    pub burn_amount: u64,
    pub staking_amount: u64,
    pub gas_amount: u64,
    pub ops_amount: u64,
    pub slot: u64,
}

// ─── Errors ─────────────────────────────────────────────────────────────────

#[error_code]
pub enum ContentKeysError {
    #[msg("Arweave tx id exceeds 64 chars")] ArweaveTxTooLong,
    #[msg("Price must be > 0")] InvalidPrice,
    #[msg("Royalty bps out of band — must be within [5%, 45%] per §12")] InvalidRoyaltyBps,
    #[msg("Subscription duration must be > 0")] InvalidSubscriptionDuration,
    #[msg("content_id does not match counter / content")] ContentIdMismatch,
    #[msg("Content is inactive — new key purchases blocked")] ContentInactive,
    #[msg("Listing is inactive")] ListingInactive,
    #[msg("Listing's key does not match the supplied key account")] ListingKeyMismatch,
    #[msg("Key is inactive (consumed or revoked)")] KeyInactive,
    #[msg("Creator-royalty ATA owner does not match content.creator")] CreatorRoyaltyMismatch,
    #[msg("Combined royalty + protocol fee exceeds list price")] FeesExceedPrice,
    #[msg("Token account / mint mismatch — must be ORA")] WrongMint,
    #[msg("Unauthorized")] Unauthorized,
    #[msg("Arithmetic overflow")] Overflow,
    #[msg("Protocol pools are still placeholders — abort revenue-bearing tx")] PlaceholderProtocolPools,
    // [audit fix R5 M-CK-2]
    #[msg("total_keys_minted at u64::MAX — cannot derive next serial PDA")] KeySerialOverflow,
    // [audit fix R6-CK-H2]
    #[msg("Self-buy forbidden — buyer cannot equal listing.seller (wash trading)")] SelfBuyForbidden,
}

// ─── Account contexts ───────────────────────────────────────────────────────

/// [whitepaper-sync v1.1] §13 content-keys — Empty noop context for
/// `assert_pools_configured`.
#[derive(Accounts)]
pub struct NoopCtx<'info> {
    /// CHECK: signer only used to attribute the runtime assertion.
    pub caller: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitContentCounter<'info> {
    #[account(
        init, payer = creator,
        space = ContentCounter::SIZE,
        seeds = [ContentCounter::SEED, creator.key().as_ref()],
        bump
    )]
    pub content_counter: Account<'info, ContentCounter>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// [whitepaper-sync v1.1] §13 content-keys — Accounts context for
/// publish_content.
#[derive(Accounts)]
#[instruction(content_id: u64)]
pub struct PublishContent<'info> {
    #[account(
        mut,
        seeds = [ContentCounter::SEED, creator.key().as_ref()],
        bump = content_counter.bump,
        has_one = creator @ ContentKeysError::Unauthorized,
    )]
    pub content_counter: Account<'info, ContentCounter>,

    #[account(
        init, payer = creator,
        space = EncryptedContent::SIZE,
        seeds = [
            EncryptedContent::SEED,
            creator.key().as_ref(),
            content_id.to_le_bytes().as_ref(),
        ],
        bump
    )]
    pub content: Account<'info, EncryptedContent>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct UpdateContent<'info> {
    #[account(
        mut,
        seeds = [
            EncryptedContent::SEED,
            content.creator.as_ref(),
            content.content_id.to_le_bytes().as_ref(),
        ],
        bump = content.bump,
        has_one = creator @ ContentKeysError::Unauthorized,
    )]
    pub content: Account<'info, EncryptedContent>,
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct DeactivateContent<'info> {
    #[account(
        mut,
        seeds = [
            EncryptedContent::SEED,
            content.creator.as_ref(),
            content.content_id.to_le_bytes().as_ref(),
        ],
        bump = content.bump,
        has_one = creator @ ContentKeysError::Unauthorized,
    )]
    pub content: Account<'info, EncryptedContent>,
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(content_id: u64)]
pub struct BuyKey<'info> {
    #[account(
        mut,
        seeds = [
            EncryptedContent::SEED,
            content.creator.as_ref(),
            content_id.to_le_bytes().as_ref(),
        ],
        bump = content.bump,
    )]
    pub content: Account<'info, EncryptedContent>,

    /// PDA seeded by (content, serial). `serial = content.total_keys_minted + 1`
    /// so the SDK must read the content account before building this ix.
    #[account(
        init, payer = buyer,
        space = ContentKey::SIZE,
        seeds = [
            ContentKey::SEED,
            content.key().as_ref(),
            (content.total_keys_minted + 1).to_le_bytes().as_ref(),
        ],
        bump
    )]
    pub key: Account<'info, ContentKey>,

    /// ORA mint. Must equal `ORA_MINT` const.
    #[account(address = ORA_MINT @ ContentKeysError::WrongMint)]
    pub ora_mint: Account<'info, Mint>,

    /// Buyer's ORA ATA (debited for the full price).
    #[account(
        mut,
        constraint = buyer_ora_account.mint == ORA_MINT @ ContentKeysError::WrongMint,
        constraint = buyer_ora_account.owner == buyer.key() @ ContentKeysError::Unauthorized,
    )]
    pub buyer_ora_account: Account<'info, TokenAccount>,

    /// Creator's ORA ATA (credited 95%).
    #[account(
        mut,
        constraint = creator_ora_account.mint == ORA_MINT @ ContentKeysError::WrongMint,
        constraint = creator_ora_account.owner == content.creator @ ContentKeysError::CreatorRoyaltyMismatch,
    )]
    pub creator_ora_account: Account<'info, TokenAccount>,

    /// [audit fix C-6/C-20] Hardcoded staking-rewards pool ATA.
    #[account(
        mut,
        address = STAKING_REWARDS_POOL @ ContentKeysError::PlaceholderProtocolPools,
    )]
    pub staking_pool_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = GAS_RESERVE_POOL @ ContentKeysError::PlaceholderProtocolPools,
    )]
    pub gas_reserve_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = OPS_TREASURY_POOL @ ContentKeysError::PlaceholderProtocolPools,
    )]
    pub ops_treasury_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub buyer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(content_id: u64, list_price_lamports: u64)]
pub struct ListKey<'info> {
    /// Content metadata — read-only here; we just need the address for
    /// listing-PDA scoping and event emission.
    #[account(
        seeds = [
            EncryptedContent::SEED,
            content.creator.as_ref(),
            content_id.to_le_bytes().as_ref(),
        ],
        bump = content.bump,
    )]
    pub content: Account<'info, EncryptedContent>,

    /// Existing key the seller owns.
    #[account(
        mut,
        seeds = [
            ContentKey::SEED,
            content.key().as_ref(),
            key.key_serial.to_le_bytes().as_ref(),
        ],
        bump = key.bump,
    )]
    pub key: Account<'info, ContentKey>,

    /// Listing PDA — one per key at a time.
    #[account(
        init, payer = seller,
        space = KeyListing::SIZE,
        seeds = [KeyListing::SEED, key.key().as_ref()],
        bump
    )]
    pub listing: Account<'info, KeyListing>,

    #[account(mut)]
    pub seller: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct DelistKey<'info> {
    // [audit fix R6-CK-H1] `close = seller` refunds rent and frees the PDA
    // so the seller can re-list the same key via standard `init` next time.
    #[account(
        mut,
        seeds = [KeyListing::SEED, listing.key.as_ref()],
        bump = listing.bump,
        has_one = seller @ ContentKeysError::Unauthorized,
        close = seller,
    )]
    pub listing: Account<'info, KeyListing>,
    #[account(mut)]
    pub seller: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(content_id: u64)]
pub struct BuyListedKey<'info> {
    /// Original content (for royalty + creator lookup).
    #[account(
        seeds = [
            EncryptedContent::SEED,
            content.creator.as_ref(),
            content_id.to_le_bytes().as_ref(),
        ],
        bump = content.bump,
    )]
    pub content: Account<'info, EncryptedContent>,

    /// The key being transferred. `key_owner` updated to `buyer` on success.
    #[account(
        mut,
        seeds = [
            ContentKey::SEED,
            content.key().as_ref(),
            key.key_serial.to_le_bytes().as_ref(),
        ],
        bump = key.bump,
    )]
    pub key: Account<'info, ContentKey>,

    /// Listing — closed atomically on success (rent refunded to seller).
    /// [audit fix R6-CK-H1] `close = seller` so the new owner (buyer) can
    /// re-list the same key later via standard `init` (no AccountAlreadyInitialized).
    #[account(
        mut,
        seeds = [KeyListing::SEED, key.key().as_ref()],
        bump = listing.bump,
        has_one = seller @ ContentKeysError::Unauthorized,
        close = seller,
    )]
    pub listing: Account<'info, KeyListing>,

    /// CHECK: seller pubkey is verified via listing.has_one = seller above.
    /// Receives rent refund on listing close.
    #[account(mut, address = listing.seller @ ContentKeysError::Unauthorized)]
    pub seller: UncheckedAccount<'info>,

    #[account(address = ORA_MINT @ ContentKeysError::WrongMint)]
    pub ora_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = buyer_ora_account.mint == ORA_MINT @ ContentKeysError::WrongMint,
        constraint = buyer_ora_account.owner == buyer.key() @ ContentKeysError::Unauthorized,
    )]
    pub buyer_ora_account: Account<'info, TokenAccount>,

    /// Seller's ORA ATA (credited 90%).
    #[account(
        mut,
        constraint = seller_ora_account.mint == ORA_MINT @ ContentKeysError::WrongMint,
        constraint = seller_ora_account.owner == listing.seller @ ContentKeysError::Unauthorized,
    )]
    pub seller_ora_account: Account<'info, TokenAccount>,

    /// Original creator's ORA ATA (credited royalty %).
    #[account(
        mut,
        constraint = creator_ora_account.mint == ORA_MINT @ ContentKeysError::WrongMint,
    )]
    pub creator_ora_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        address = STAKING_REWARDS_POOL @ ContentKeysError::PlaceholderProtocolPools,
    )]
    pub staking_pool_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = GAS_RESERVE_POOL @ ContentKeysError::PlaceholderProtocolPools,
    )]
    pub gas_reserve_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = OPS_TREASURY_POOL @ ContentKeysError::PlaceholderProtocolPools,
    )]
    pub ops_treasury_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub buyer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}
