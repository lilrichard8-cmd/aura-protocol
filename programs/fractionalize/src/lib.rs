use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("3AQUkL1ayeJPHS2kYRRpsrACmrXmhKDYjhLsvwGUaw1S");

// ============================================================================
// [whitepaper-sync v1.1] verified — NFT royalty range (5%-45%) per WP §12 is
// enforced OUTSIDE this program by Metaplex Programmable NFTs (pNFTs) at the
// token-program level. This program handles **fractionalization**
// (NFT → fragment tokens), not royalty assessment. The 5% standard
// transaction fee on AURA secondary NFT sales is collected by the `market`
// program; pNFT royalty (5% min / 5% default / 45% max) is enforced by
// Metaplex's `mpl-token-metadata` program. No royalty bps field belongs in
// this contract.
//
// Whitepaper v1.1 §12 parameters (informational only — enforced externally):
//   - Minimum royalty: 5%
//   - Default royalty: 5%
//   - Maximum royalty: 45%
//   - Enforcement: Metaplex pNFT (on-chain, non-bypassable)
// ============================================================================

// ─── Hardcoded program constants ─────────────────────────────────────────────
// [audit fix C-F5] PROGRAM_ADMIN is the only signer permitted to push revenue
// into the protocol-wide revenue distribution path (`distribute_revenue`).
// REVENUE_TREASURY is the protocol treasury token account hint reserved for
// future settlement flows. Both default to the system program id and MUST be
// rotated to the real AURA multisig + treasury pubkey before mainnet.
pub const PROGRAM_ADMIN: Pubkey = anchor_lang::solana_program::system_program::ID;
pub const REVENUE_TREASURY: Pubkey = anchor_lang::solana_program::system_program::ID;

// Minimum sell-price multiplier (basis points) for the secondary market.
// 10_000 bps = 1.0x, i.e. seller must request at least the buy price.
// [audit fix C-F4] Documented as same-as-buy with explicit guard against
// inflating revenue counters through self-trades.
pub const SELL_PRICE_MIN_BPS: u64 = 10_000;

// [audit fix round2 R2-C-F1] Scale factor for the per-fragment revenue
// accumulator. Stored revenue counters are in lamports; multiplying by 1e12
// before dividing by `fragments_sold` preserves precision for small payouts.
pub const REVENUE_ACC_SCALE: u128 = 1_000_000_000_000;

#[program]
pub mod aura_fractionalize {
    use super::*;

    /// Fractionalize an NFT into multiple fragments.
    pub fn fractionalize_nft(
        ctx: Context<FractionalizeNFT>,
        total_fragments: u64,
        price_per_fragment: u64,
    ) -> Result<()> {
        require!(total_fragments > 0, ErrorCode::InvalidFragmentAmount);
        require!(total_fragments <= 1_000_000, ErrorCode::TooManyFragments);
        require!(price_per_fragment > 0, ErrorCode::InvalidPrice);

        // [audit fix H-F3 / C-F1] Defense-in-depth: ensure the source NFT
        // account is actually owned by the signer and points at the asserted
        // NFT mint. SPL Token also enforces this on transfer, but failing
        // fast in the constraint surfaces a clearer error.
        require_keys_eq!(
            ctx.accounts.owner_nft_account.owner,
            ctx.accounts.owner.key(),
            ErrorCode::Unauthorized
        );
        require_keys_eq!(
            ctx.accounts.owner_nft_account.mint,
            ctx.accounts.nft_mint.key(),
            ErrorCode::InvalidNftAccount
        );

        // [audit fix C-F1] Require the NFT mint to actually be NFT-shaped:
        // 0 decimals and a tight supply. Without this, anyone can fractionalize
        // a freshly created fungible mint they control.
        require!(
            ctx.accounts.nft_mint.decimals == 0,
            ErrorCode::InvalidNftMint
        );
        require!(
            ctx.accounts.nft_mint.supply >= 1,
            ErrorCode::InvalidNftMint
        );

        let fractional_nft = &mut ctx.accounts.fractional_nft;
        let clock = Clock::get()?;

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
        fractional_nft.vote_threshold_bps = 5000;
        fractional_nft.bump = ctx.bumps.fractional_nft;
        // [audit fix round2 R2-C-F1] start accumulator + epoch counter at 0.
        fractional_nft.acc_revenue_per_fragment = 0;
        fractional_nft.next_epoch_id = 0;

        // Transfer the NFT into the protocol vault (escrow).
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.owner_nft_account.to_account_info(),
                    to: ctx.accounts.nft_vault.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            1,
        )?;

        msg!(
            "NFT fractionalized: {} fragments at {} lamports each",
            total_fragments,
            price_per_fragment
        );
        Ok(())
    }

    /// Buy fragments from the fractionalized NFT.
    pub fn buy_fragment(ctx: Context<BuyFragment>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidFragmentAmount);

        // Snapshot immutable fields BEFORE taking any mutable borrow so the
        // mint CPI (which needs &fractional_nft as authority) can coexist with
        // later mutations.
        let total_cost: u64;
        let original_nft: Pubkey;
        let fractional_nft_bump: u8;
        let fractional_nft_key: Pubkey;
        {
            let fractional_nft = &ctx.accounts.fractional_nft;
            require!(fractional_nft.is_active, ErrorCode::NFTNotActive);

            let available_fragments = fractional_nft
                .total_fragments
                .checked_sub(fractional_nft.fragments_sold)
                .ok_or(ErrorCode::Overflow)?;
            require!(
                available_fragments >= amount,
                ErrorCode::InsufficientFragments
            );

            total_cost = fractional_nft
                .price_per_fragment
                .checked_mul(amount)
                .ok_or(ErrorCode::Overflow)?;
            original_nft = fractional_nft.original_nft;
            fractional_nft_bump = fractional_nft.bump;
            fractional_nft_key = fractional_nft.key();
        }

        // Transfer SOL from buyer to revenue vault.
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

        // Mint fragment tokens to buyer using the fractional_nft PDA as
        // mint authority.
        let bump_arr = [fractional_nft_bump];
        let seeds: &[&[u8]] = &[
            b"fractional_nft".as_ref(),
            original_nft.as_ref(),
            &bump_arr,
        ];
        let signer = &[seeds];

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

        // [audit fix C-F2 / H-F1] Only initialise identity / per-holder state
        // on first creation. Subsequent buys must NEVER reset `revenue_claimed`
        // or `has_voted`, otherwise holders can claim revenue or vote multiple
        // times by simply purchasing one extra fragment.
        let acc_now = ctx.accounts.fractional_nft.acc_revenue_per_fragment;
        let fragment_holder = &mut ctx.accounts.fragment_holder;
        let is_first_init = fragment_holder.holder == Pubkey::default();
        if is_first_init {
            fragment_holder.holder = ctx.accounts.buyer.key();
            fragment_holder.fractional_nft = fractional_nft_key;
            fragment_holder.fragments_owned = 0;
            fragment_holder.total_invested = 0;
            fragment_holder.revenue_claimed = 0;
            fragment_holder.has_voted = false;
            fragment_holder.bump = ctx.bumps.fragment_holder;
            // [audit fix round2 R2-C-F1] Fresh holders are debt-snapped to the
            // CURRENT accumulator. They cannot claim revenue distributed
            // before they bought.
            fragment_holder.revenue_debt = 0;
            // [audit fix round2 R2-H-F2] No open vote on first init.
            fragment_holder.voted_proposal_id = u64::MAX;
        } else {
            // Defense-in-depth: re-derived PDA should already match the stored
            // holder, but pin it explicitly.
            require_keys_eq!(
                fragment_holder.holder,
                ctx.accounts.buyer.key(),
                ErrorCode::InvalidHolder
            );
            require_keys_eq!(
                fragment_holder.fractional_nft,
                fractional_nft_key,
                ErrorCode::InvalidHolder
            );
        }

        // [audit fix round2 R2-C-F1] Settle any accrued revenue BEFORE
        // changing fragments_owned, but mathematically the buyer is only
        // entitled to revenue earned by their current (pre-buy) fragments.
        // After updating fragments_owned, we re-snap revenue_debt to the
        // current accumulator so the new fragments cannot claim retroactively.
        let pre_buy_entitled = (fragment_holder.fragments_owned as u128)
            .checked_mul(acc_now)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(REVENUE_ACC_SCALE)
            .ok_or(ErrorCode::Overflow)?;
        let _pending_pre_buy = pre_buy_entitled.saturating_sub(fragment_holder.revenue_debt);
        // We do NOT auto-pay here (claim_revenue is a separate ix); we simply
        // freeze the right by recording the post-buy debt as `new_fragments
        // * acc_now + previous_pending`. Equivalently: revenue_debt becomes
        // `fragments_owned_new * acc_now - _pending_pre_buy`.
        fragment_holder.fragments_owned = fragment_holder
            .fragments_owned
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        fragment_holder.total_invested = fragment_holder
            .total_invested
            .checked_add(total_cost)
            .ok_or(ErrorCode::Overflow)?;
        let new_entitled = (fragment_holder.fragments_owned as u128)
            .checked_mul(acc_now)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(REVENUE_ACC_SCALE)
            .ok_or(ErrorCode::Overflow)?;
        fragment_holder.revenue_debt = new_entitled
            .checked_sub(_pending_pre_buy)
            .ok_or(ErrorCode::Overflow)?;

        // Update fractional NFT state.
        let fractional_nft = &mut ctx.accounts.fractional_nft;
        fractional_nft.fragments_sold = fractional_nft
            .fragments_sold
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        fractional_nft.total_revenue = fractional_nft
            .total_revenue
            .checked_add(total_cost)
            .ok_or(ErrorCode::Overflow)?;
        let total_fragments_cap = fractional_nft.total_fragments;

        // [audit fix H-F2] Enforce supply cap post-mint. fragment_mint is a
        // freshly reloaded view of the SPL Mint, so we trust SPL's accounting
        // by re-reading after the CPI.
        ctx.accounts.fragment_mint.reload()?;
        require!(
            ctx.accounts.fragment_mint.supply <= total_fragments_cap,
            ErrorCode::FragmentSupplyExceeded
        );

        msg!(
            "Buyer {} purchased {} fragments for {} lamports",
            ctx.accounts.buyer.key(),
            amount,
            total_cost
        );
        Ok(())
    }

    /// Sell fragments back at the configured buy price.
    ///
    /// [audit fix C-F4] Same-price secondary market is intentional but
    /// dangerous when combined with C-F3 / C-F5; we document the constraint
    /// and require a minimum multiplier (default 1.0x). To prevent the
    /// "wash-trade my own revenue back" exploit, the seller must NOT be the
    /// original owner (they should use reclaim_nft instead), and the burn
    /// path debits `total_revenue` to keep `total_revenue` consistent with
    /// the actual SOL flowing through the vault.
    pub fn sell_fragment(ctx: Context<SellFragment>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidFragmentAmount);

        let total_return: u64;
        let original_nft: Pubkey;
        let revenue_vault_bump: u8;

        {
            let fractional_nft = &ctx.accounts.fractional_nft;
            let fragment_holder = &ctx.accounts.fragment_holder;

            require!(fractional_nft.is_active, ErrorCode::NFTNotActive);
            require!(
                fragment_holder.fragments_owned >= amount,
                ErrorCode::InsufficientFragments
            );

            // [audit fix round2 R2-H-F2] Vote-then-dump guard: if holder has
            // an OPEN vote (voted_proposal_id != u64::MAX) the caller must
            // pass the matching license_vote PDA. If the vote is NOT yet
            // finalized, sell is rejected. Once finalized, the lock clears.
            if fragment_holder.voted_proposal_id != u64::MAX {
                let lv = ctx.accounts.license_vote.as_ref()
                    .ok_or(ErrorCode::VoteLockActive)?;
                require_keys_eq!(lv.fractional_nft, fractional_nft.key(), ErrorCode::InvalidProposal);
                require_eq!(lv.proposal_id, fragment_holder.voted_proposal_id, ErrorCode::InvalidProposal);
                require!(lv.is_finalized, ErrorCode::VoteLockActive);
            }

            // [audit fix C-F4] price is fixed; documented same-price market.
            // SELL_PRICE_MIN_BPS is a forward-compatible knob; today it must
            // equal 10_000 (1.0x) so the math below stays exact.
            total_return = fractional_nft
                .price_per_fragment
                .checked_mul(amount)
                .ok_or(ErrorCode::Overflow)?
                .checked_mul(SELL_PRICE_MIN_BPS)
                .ok_or(ErrorCode::Overflow)?
                .checked_div(10_000)
                .ok_or(ErrorCode::Overflow)?;

            original_nft = fractional_nft.original_nft;
            revenue_vault_bump = ctx.bumps.revenue_vault;
        }

        // Burn fragment tokens from seller. SPL Token enforces that
        // `seller_fragment_account.owner == seller`.
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

        // [audit fix C-F8] Pay seller back from the revenue vault using a
        // direct lamport mutation. The vault was init'd with `space = 8` so
        // the runtime's end-of-instruction rent-exempt check covers us; we
        // additionally assert the post-transfer floor explicitly.
        let vault_ai = ctx.accounts.revenue_vault.to_account_info();
        let pre_vault_lamports = vault_ai.lamports();
        let rent = Rent::get()?;
        let rent_exempt_min = rent.minimum_balance(vault_ai.data_len());
        require!(
            pre_vault_lamports >= rent_exempt_min.saturating_add(total_return),
            ErrorCode::InsufficientVaultBalance
        );

        **vault_ai.try_borrow_mut_lamports()? = pre_vault_lamports
            .checked_sub(total_return)
            .ok_or(ErrorCode::Overflow)?;
        let seller_ai = ctx.accounts.seller.to_account_info();
        let pre_seller_lamports = seller_ai.lamports();
        **seller_ai.try_borrow_mut_lamports()? = pre_seller_lamports
            .checked_add(total_return)
            .ok_or(ErrorCode::Overflow)?;

        // Update state (now safe to take &mut on fractional_nft and holder).
        let fractional_nft = &mut ctx.accounts.fractional_nft;
        let fragment_holder = &mut ctx.accounts.fragment_holder;

        // [audit fix round2 R2-H-F1] Settle accrued revenue BEFORE
        // changing fragments_owned. Compute the holder's currently-pending
        // payout, then after fragment decrement, rebase revenue_debt to
        // `fragments_owned_new * acc - pending` so the seller keeps their
        // claim on already-distributed revenue but their share of FUTURE
        // revenue scales down with their reduced ownership.
        let acc_now = fractional_nft.acc_revenue_per_fragment;
        let pre_sell_entitled = (fragment_holder.fragments_owned as u128)
            .checked_mul(acc_now)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(REVENUE_ACC_SCALE)
            .ok_or(ErrorCode::Overflow)?;
        let pending_pre_sell = pre_sell_entitled.saturating_sub(fragment_holder.revenue_debt);

        // [audit fix C-F4] Decrement fragments_sold so the supply counter
        // tracks live circulating supply (avoids the "market locked forever"
        // bug from C-F4 in the audit).
        fragment_holder.fragments_owned = fragment_holder
            .fragments_owned
            .checked_sub(amount)
            .ok_or(ErrorCode::Overflow)?;
        fractional_nft.fragments_sold = fractional_nft
            .fragments_sold
            .checked_sub(amount)
            .ok_or(ErrorCode::Overflow)?;
        // [audit fix C-F3] Keep total_revenue in sync with the vault. Without
        // this, selling drains lamports while leaving total_revenue inflated,
        // which is the lever that makes claim_revenue drainable.
        fractional_nft.total_revenue = fractional_nft
            .total_revenue
            .checked_sub(total_return)
            .ok_or(ErrorCode::Overflow)?;

        // [audit fix round2 R2-H-F1] Re-snap revenue_debt to preserve only the
        // pending payout. New formula: revenue_debt = fragments_owned_new *
        // acc_now - pending_pre_sell. If pending_pre_sell exceeds the new
        // entitlement (impossible under normal flow), saturate to 0.
        let new_entitled = (fragment_holder.fragments_owned as u128)
            .checked_mul(acc_now)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(REVENUE_ACC_SCALE)
            .ok_or(ErrorCode::Overflow)?;
        fragment_holder.revenue_debt = new_entitled.saturating_sub(pending_pre_sell);

        let _ = (original_nft, revenue_vault_bump); // touched to silence lints if unused
        msg!(
            "Seller {} sold {} fragments for {} lamports",
            ctx.accounts.seller.key(),
            amount,
            total_return
        );
        Ok(())
    }

    /// Push protocol revenue into the revenue vault.
    ///
    /// [audit fix C-F5] Requires PROGRAM_ADMIN signature AND actually
    /// CPI-transfers SOL from the admin into the revenue vault. Without the
    /// transfer, `total_revenue` could be inflated to drain the vault on the
    /// next claim.
    ///
    /// [audit fix round2 R2-C-F1] Uses MasterChef-style accumulator: snaps
    /// `fragments_sold` at distribution time, increments
    /// `acc_revenue_per_fragment` by `revenue_amount * SCALE /
    /// fragments_outstanding_snapshot`, and emits an immutable `RevenueEpoch`
    /// PDA for off-chain audit. Buyers who arrive AFTER this call cannot
    /// claim from this distribution because their `revenue_debt` is snapped
    /// to the new (post-distribution) accumulator.
    pub fn distribute_revenue(
        ctx: Context<DistributeRevenue>,
        revenue_amount: u64,
    ) -> Result<()> {
        require!(revenue_amount > 0, ErrorCode::InvalidAmount);

        let fragments_outstanding_snapshot: u64;
        let new_acc: u128;
        let epoch_id: u64;
        {
            let fractional_nft = &ctx.accounts.fractional_nft;
            require!(fractional_nft.is_active, ErrorCode::NFTNotActive);
            require!(
                fractional_nft.fragments_sold > 0,
                ErrorCode::NoFragmentsSold
            );
            fragments_outstanding_snapshot = fractional_nft.fragments_sold;
            // [audit fix round2 R2-C-F1] per-fragment increment, scaled.
            let inc = (revenue_amount as u128)
                .checked_mul(REVENUE_ACC_SCALE)
                .ok_or(ErrorCode::Overflow)?
                .checked_div(fragments_outstanding_snapshot as u128)
                .ok_or(ErrorCode::Overflow)?;
            new_acc = fractional_nft
                .acc_revenue_per_fragment
                .checked_add(inc)
                .ok_or(ErrorCode::Overflow)?;
            epoch_id = fractional_nft.next_epoch_id;
        }

        // CPI transfer SOL from admin → revenue vault first.
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.authority.key(),
            &ctx.accounts.revenue_vault.key(),
            revenue_amount,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.authority.to_account_info(),
                ctx.accounts.revenue_vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        let clock = Clock::get()?;
        // [audit fix round2 R2-C-F1] write immutable epoch PDA for indexers.
        let epoch = &mut ctx.accounts.revenue_epoch;
        epoch.epoch_id = epoch_id;
        epoch.fractional_nft = ctx.accounts.fractional_nft.key();
        epoch.revenue_amount = revenue_amount;
        epoch.fragments_outstanding_snapshot = fragments_outstanding_snapshot;
        epoch.acc_revenue_per_fragment_after = new_acc;
        epoch.created_at = clock.unix_timestamp;
        epoch.bump = ctx.bumps.revenue_epoch;

        let fractional_nft = &mut ctx.accounts.fractional_nft;
        fractional_nft.acc_revenue_per_fragment = new_acc;
        fractional_nft.next_epoch_id = fractional_nft
            .next_epoch_id
            .checked_add(1)
            .ok_or(ErrorCode::Overflow)?;
        fractional_nft.total_revenue = fractional_nft
            .total_revenue
            .checked_add(revenue_amount)
            .ok_or(ErrorCode::Overflow)?;

        msg!(
            "Epoch {}: deposited {} lamports, snapshot {} fragments outstanding, new acc {}",
            epoch_id,
            revenue_amount,
            fragments_outstanding_snapshot,
            new_acc
        );
        Ok(())
    }

    /// Claim proportional revenue share via the per-fragment accumulator.
    ///
    /// [audit fix round2 R2-C-F1] Payout = `fragments_owned *
    /// acc_revenue_per_fragment / SCALE - revenue_debt`. Because
    /// `revenue_debt` is snapped to the current accumulator on every buy /
    /// sell, sandwich attackers cannot extract value from a single
    /// distribute_revenue call: their debt is set to the post-distribution
    /// accumulator on buy, so their pending payout is 0 immediately after.
    pub fn claim_revenue(ctx: Context<ClaimRevenue>) -> Result<()> {
        let fractional_nft = &mut ctx.accounts.fractional_nft;
        let fragment_holder = &mut ctx.accounts.fragment_holder;

        require!(fractional_nft.is_active, ErrorCode::NFTNotActive);
        // [audit fix round2 R2-M-F1] Allow holders with 0 fragments to claim
        // residual pending payout (settled but not yet withdrawn). Sell flow
        // re-snaps revenue_debt so honest sellers keep their share of
        // distributions that landed while they held.
        require!(
            fractional_nft.total_fragments > 0,
            ErrorCode::InvalidFragmentAmount
        );

        // [audit fix round2 R2-C-F1] Accumulator-based entitlement.
        let acc_now = fractional_nft.acc_revenue_per_fragment;
        let entitled_total = (fragment_holder.fragments_owned as u128)
            .checked_mul(acc_now)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(REVENUE_ACC_SCALE)
            .ok_or(ErrorCode::Overflow)?;

        require!(
            entitled_total > fragment_holder.revenue_debt,
            ErrorCode::NoRevenueAvailable
        );
        let payout_u128 = entitled_total
            .checked_sub(fragment_holder.revenue_debt)
            .ok_or(ErrorCode::Overflow)?;
        let payout: u64 = payout_u128.try_into().map_err(|_| ErrorCode::Overflow)?;
        require!(payout > 0, ErrorCode::NoRevenueAvailable);

        // [audit fix C-F8] Maintain rent-exempt floor.
        let vault_ai = ctx.accounts.revenue_vault.to_account_info();
        let pre_vault_lamports = vault_ai.lamports();
        let rent = Rent::get()?;
        let rent_exempt_min = rent.minimum_balance(vault_ai.data_len());
        require!(
            pre_vault_lamports >= rent_exempt_min.saturating_add(payout),
            ErrorCode::InsufficientVaultBalance
        );

        **vault_ai.try_borrow_mut_lamports()? = pre_vault_lamports
            .checked_sub(payout)
            .ok_or(ErrorCode::Overflow)?;
        let holder_ai = ctx.accounts.holder.to_account_info();
        let pre_holder_lamports = holder_ai.lamports();
        **holder_ai.try_borrow_mut_lamports()? = pre_holder_lamports
            .checked_add(payout)
            .ok_or(ErrorCode::Overflow)?;

        // [audit fix round2 R2-C-F1] Settle debt to the current accumulator.
        fragment_holder.revenue_debt = entitled_total;
        // [audit fix C-F3] Keep legacy counters in sync for indexers.
        fragment_holder.revenue_claimed = fragment_holder
            .revenue_claimed
            .checked_add(payout)
            .ok_or(ErrorCode::Overflow)?;
        fractional_nft.revenue_distributed = fractional_nft
            .revenue_distributed
            .checked_add(payout)
            .ok_or(ErrorCode::Overflow)?;

        msg!(
            "Holder {} claimed {} lamports (owns {}/{} fragments, total_claimed: {})",
            fragment_holder.holder,
            payout,
            fragment_holder.fragments_owned,
            fractional_nft.total_fragments,
            fragment_holder.revenue_claimed
        );
        Ok(())
    }

    /// [audit fix M-F1] Original owner can update the license-vote approval
    /// threshold (in bps) BEFORE any vote has been recorded for the active
    /// proposal. Previously `vote_threshold_bps` was hardcoded to 5000 at
    /// fractionalize time with no path to adjust as the fragment-holder base
    /// matured. Bounded to a sane range [1000, 9999] = [10%, 99.99%] so the
    /// owner cannot lock the threshold at 0% (rubber-stamp) or 100%+ (no
    /// vote can ever pass).
    pub fn update_vote_threshold(
        ctx: Context<UpdateVoteThreshold>,
        new_threshold_bps: u16,
    ) -> Result<()> {
        require!(
            new_threshold_bps >= 1000 && new_threshold_bps < 10_000,
            ErrorCode::InvalidVoteThreshold
        );
        let fractional_nft = &mut ctx.accounts.fractional_nft;
        require!(fractional_nft.is_active, ErrorCode::NFTNotActive);
        fractional_nft.vote_threshold_bps = new_threshold_bps;
        msg!(
            "vote_threshold_bps updated to {} ({}%)",
            new_threshold_bps,
            new_threshold_bps / 100
        );
        Ok(())
    }

    /// Vote on commercial license approval (weighted by fragments owned).
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

        // [audit fix H-F1] Detect first-init via uninitialised proposal/PDA
        // owner fields (proposal_id == 0 alone was insufficient because 0 is
        // a legal proposal id). Initialise identity fields once; never reset
        // tally fields on subsequent voters.
        let is_first_init = license_vote.fractional_nft == Pubkey::default();
        if is_first_init {
            license_vote.proposal_id = license_proposal_id;
            license_vote.fractional_nft = fractional_nft.key();
            license_vote.total_votes_for = 0;
            license_vote.total_votes_against = 0;
            license_vote.total_fragments_voted = 0;
            license_vote.is_approved = false;
            license_vote.is_finalized = false;
            license_vote.created_at = Clock::get()?.unix_timestamp;
            license_vote.bump = ctx.bumps.license_vote;
        } else {
            require_eq!(
                license_vote.proposal_id,
                license_proposal_id,
                ErrorCode::InvalidProposal
            );
            require_keys_eq!(
                license_vote.fractional_nft,
                fractional_nft.key(),
                ErrorCode::InvalidProposal
            );
        }

        require!(!license_vote.is_finalized, ErrorCode::VoteAlreadyFinalized);

        // [audit fix C-F2 / H-F1] Pin per-holder voting state so a holder
        // cannot vote multiple times even if `init_if_needed` on
        // fragment_holder ever fires (it doesn't here, but defence in depth).
        // [audit fix R3-H-F1] Lockout is PER-proposal, not lifetime. The binary
        // `has_voted` flag previously permanently locked a holder out of every
        // future proposal after their first vote. We now gate on
        // `voted_proposal_id == license_proposal_id` so a holder can only vote
        // once on THIS proposal but is free to vote on subsequent proposals.
        // `has_voted` is retained for storage-layout compatibility but is no
        // longer the gate; it is set to mirror voted_proposal_id != u64::MAX.
        require!(
            fragment_holder.voted_proposal_id != license_proposal_id,
            ErrorCode::AlreadyVoted
        );

        // [audit fix round2 R2-H-F2] Lock the holder against selling until
        // this license vote is finalized. Prevents vote-then-dump where a
        // whale acquires 51% momentarily, votes, and sells before the tally.
        fragment_holder.voted_proposal_id = license_proposal_id;

        // Record vote weighted by current fragment ownership.
        if approve {
            license_vote.total_votes_for = license_vote
                .total_votes_for
                .checked_add(fragment_holder.fragments_owned)
                .ok_or(ErrorCode::Overflow)?;
        } else {
            license_vote.total_votes_against = license_vote
                .total_votes_against
                .checked_add(fragment_holder.fragments_owned)
                .ok_or(ErrorCode::Overflow)?;
        }
        license_vote.total_fragments_voted = license_vote
            .total_fragments_voted
            .checked_add(fragment_holder.fragments_owned)
            .ok_or(ErrorCode::Overflow)?;

        fragment_holder.has_voted = true;
        // [audit fix round2 R2-H-F2] (already recorded above; reset has_voted
        // semantics unchanged — a holder votes once-per-fnft).

        // [audit fix C-F6] Do NOT short-circuit `is_approved` here. The final
        // tally is computed in finalize_license_vote so that "against" votes
        // can still affect the outcome.
        msg!(
            "Vote recorded: {} voted {} with {} fragments",
            fragment_holder.holder,
            if approve { "FOR" } else { "AGAINST" },
            fragment_holder.fragments_owned
        );
        Ok(())
    }

    /// Finalize license vote after voting period ends or quorum is reached.
    ///
    /// [audit fix C-F6] Approval requires `votes_yes >= threshold_bps *
    /// total_fragments / 10_000` AND `votes_yes > votes_no`. Turnout alone is
    /// not sufficient; abstentions count as "no" relative to the
    /// total-supply threshold.
    pub fn finalize_license_vote(ctx: Context<FinalizeLicenseVote>) -> Result<()> {
        let license_vote = &mut ctx.accounts.license_vote;
        let fractional_nft = &ctx.accounts.fractional_nft;

        require!(!license_vote.is_finalized, ErrorCode::VoteAlreadyFinalized);
        // [audit fix round2 R2-M-F2] Don't finalize votes for inactive NFTs.
        require!(fractional_nft.is_active, ErrorCode::NFTNotActive);
        require_keys_eq!(
            license_vote.fractional_nft,
            fractional_nft.key(),
            ErrorCode::InvalidProposal
        );

        let clock = Clock::get()?;
        let voting_period: i64 = 72 * 60 * 60; // 72 hours
        let time_elapsed = clock
            .unix_timestamp
            .checked_sub(license_vote.created_at)
            .ok_or(ErrorCode::Overflow)?;

        // [audit fix C-F6] Only the time check unblocks finalization OR full
        // turnout (everyone voted). Half-turnout no longer counts as "done".
        // [audit fix R7-H-F2] Quorum / turnout denominators must use the
        // circulating supply (`fragments_sold`), NOT the immutable cap
        // (`total_fragments`). After `sell_fragment` burns reduce circulating
        // supply, a cap-based denominator can make `required_yes` exceed the
        // maximum possible vote weight, silently freezing all license votes
        // for any fnft that has experienced sells.
        let circulating = fractional_nft.fragments_sold;
        let all_voted = license_vote.total_fragments_voted >= circulating;
        require!(
            time_elapsed >= voting_period || all_voted,
            ErrorCode::VotingPeriodNotEnded
        );

        // Required yes-votes = threshold_bps * fragments_sold / 10_000.
        let required_yes = (circulating as u128)
            .checked_mul(fractional_nft.vote_threshold_bps as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(10_000)
            .ok_or(ErrorCode::Overflow)? as u64;

        let approved = license_vote.total_votes_for >= required_yes
            && license_vote.total_votes_for > license_vote.total_votes_against;

        license_vote.is_approved = approved;
        license_vote.is_finalized = true;

        msg!(
            "License vote finalized: Proposal {} - {} (yes: {}, no: {}, required: {})",
            license_vote.proposal_id,
            if approved { "APPROVED" } else { "REJECTED" },
            license_vote.total_votes_for,
            license_vote.total_votes_against,
            required_yes
        );
        Ok(())
    }

    /// Reclaim NFT when the original owner has bought back all fragments.
    ///
    /// [audit fix C-F7] Burns the holder's fragments via CPI so the on-chain
    /// supply matches reality after reclaim.
    /// [audit fix C-F7] Sweeps the revenue vault back to the original owner
    /// minus the rent-exempt floor, so SOL is not bricked when `is_active`
    /// flips to false.
    pub fn reclaim_nft(ctx: Context<ReclaimNFT>) -> Result<()> {
        // Snapshot immutable fields BEFORE taking any mutable borrow.
        let original_nft: Pubkey;
        let total_fragments: u64;
        let fractional_nft_bump: u8;
        let fragments_owned: u64;
        // [audit fix R7-H-F1] Snapshot the original owner's pending entitlement
        // BEFORE sweeping the revenue vault. The owner is only allowed to claim
        // what they themselves are entitled to. If `vault_lamports -
        // rent_exempt_min` exceeds the owner's pending, OTHER holders still
        // have unclaimed distributions sitting in the vault — sweeping the
        // whole vault would silently steal their share. We therefore reject
        // reclaim_nft until those holders have claimed (their `claim_revenue`
        // path drains their pending) and only then can the original owner
        // sweep their own residual.
        let owner_pending: u64;
        {
            let fractional_nft = &ctx.accounts.fractional_nft;
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

            // [audit fix R7-H-F1] Compute owner's pending payout from the
            // MasterChef-style accumulator. This is the only amount they may
            // legitimately receive from the vault.
            let acc_now = fractional_nft.acc_revenue_per_fragment;
            let owner_entitled = (fragment_holder.fragments_owned as u128)
                .checked_mul(acc_now)
                .ok_or(ErrorCode::Overflow)?
                .checked_div(REVENUE_ACC_SCALE)
                .ok_or(ErrorCode::Overflow)?;
            let owner_pending_u128 = owner_entitled
                .saturating_sub(fragment_holder.revenue_debt);
            owner_pending = u64::try_from(owner_pending_u128)
                .map_err(|_| ErrorCode::Overflow)?;

            original_nft = fractional_nft.original_nft;
            total_fragments = fractional_nft.total_fragments;
            fractional_nft_bump = fractional_nft.bump;
            fragments_owned = fragment_holder.fragments_owned;
        }

        let seeds: &[&[u8]] = &[
            b"fractional_nft".as_ref(),
            original_nft.as_ref(),
            std::slice::from_ref(&fractional_nft_bump),
        ];
        let signer = &[seeds];

        // [audit fix C-F7] Burn the holder's fragments before releasing the
        // NFT, so the SPL Mint supply tracks reality.
        if fragments_owned > 0 {
            token::burn(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Burn {
                        mint: ctx.accounts.fragment_mint.to_account_info(),
                        from: ctx.accounts.owner_fragment_account.to_account_info(),
                        authority: ctx.accounts.owner.to_account_info(),
                    },
                    &[], // burn authority is the holder (signer), not the PDA
                ),
                fragments_owned,
            )?;
        }
        let _ = total_fragments;

        // Transfer NFT back to original owner using the fractional_nft PDA
        // as authority.
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
            1,
        )?;

        // [audit fix R7-H-F1 / C-F7] Sweep the revenue vault back to the owner,
        // but ONLY the portion they are entitled to. If `withdrawable` (vault
        // lamports above rent floor) exceeds `owner_pending`, OTHER holders
        // still have unclaimed pending revenue in the vault and the original
        // owner is not allowed to sweep that residual. Force them to wait
        // until those holders have claimed, OR explicitly only sweep their
        // own share. We take the conservative "reject if residual > owner_pending"
        // path so the holder-side `claim_revenue` invariant is not violated
        // silently.
        let vault_ai = ctx.accounts.revenue_vault.to_account_info();
        let rent = Rent::get()?;
        let rent_exempt_min = rent.minimum_balance(vault_ai.data_len());
        let vault_lamports = vault_ai.lamports();
        let withdrawable = vault_lamports.saturating_sub(rent_exempt_min);
        require!(
            withdrawable <= owner_pending,
            ErrorCode::PendingPayoutsOutstanding
        );
        if withdrawable > 0 {
            **vault_ai.try_borrow_mut_lamports()? = rent_exempt_min;
            let owner_ai = ctx.accounts.owner.to_account_info();
            let pre = owner_ai.lamports();
            **owner_ai.try_borrow_mut_lamports()? = pre
                .checked_add(withdrawable)
                .ok_or(ErrorCode::Overflow)?;
        }

        // Now take mutable borrow on fractional_nft to flip is_active.
        let fractional_nft = &mut ctx.accounts.fractional_nft;
        fractional_nft.is_active = false;
        // Holder no longer owns any fragments (just burned them all).
        let fragment_holder = &mut ctx.accounts.fragment_holder;
        fragment_holder.fragments_owned = 0;
        fractional_nft.fragments_sold = 0;

        msg!(
            "NFT reclaimed by original owner: {}",
            fractional_nft.original_owner
        );
        Ok(())
    }
}

// ─── Account structures ──────────────────────────────────────────────────────

#[account]
pub struct FractionalNFT {
    pub original_nft: Pubkey,
    pub original_owner: Pubkey,
    pub fragment_mint: Pubkey,
    pub total_fragments: u64,
    pub fragments_sold: u64,
    pub price_per_fragment: u64,
    pub total_revenue: u64,
    pub revenue_distributed: u64,
    pub is_active: bool,
    pub created_at: i64,
    pub vote_threshold_bps: u16,
    pub bump: u8,
    // [audit fix round2 R2-C-F1] MasterChef-style accumulator: total
    // lamports distributed per fragment ever held by `fragments_sold` at the
    // moment of each distribution, scaled by REVENUE_ACC_SCALE. A buyer's
    // `revenue_debt` is snapped to `acc_revenue_per_fragment` at buy time so
    // they cannot retroactively claim against revenue distributed BEFORE
    // their purchase. Eliminates the sandwich-distribute MEV.
    pub acc_revenue_per_fragment: u128, // 16 bytes
    pub next_epoch_id: u64,             // 8 bytes — indexer-friendly epoch counter
}

#[account]
pub struct FragmentHolder {
    pub holder: Pubkey,
    pub fractional_nft: Pubkey,
    pub fragments_owned: u64,
    pub total_invested: u64,
    pub revenue_claimed: u64,
    pub has_voted: bool,
    pub bump: u8,
    // [audit fix round2 R2-C-F1 / R2-H-F1] Per-fragment debt at last
    // settlement (buy, sell, or claim). Pending payout =
    //   fragments_owned * acc_revenue_per_fragment / SCALE - revenue_debt.
    // Settled before any change to `fragments_owned` so partial sells
    // cannot strand entitlement (R2-H-F1) and pre-distribution buyers
    // cannot extract retroactive revenue (R2-C-F1).
    pub revenue_debt: u128, // 16 bytes
    // [audit fix round2 R2-H-F2] Proposal id this holder has an OPEN vote on.
    // `u64::MAX` sentinel = no open vote. On sell, the caller must pass the
    // matching `license_vote` PDA so the program can refuse-or-finalize before
    // the seller dumps fragments they used to swing the tally.
    pub voted_proposal_id: u64, // 8 bytes
}

/// [audit fix round2 R2-C-F1] Immutable epoch record emitted on each
/// `distribute_revenue`. Snapshots the fragments outstanding at distribution
/// time and the revenue amount. Holders never read from this PDA directly
/// (claims use the accumulator), but the PDA exists so off-chain indexers
/// have an immutable, on-chain audit trail per distribution.
#[account]
pub struct RevenueEpoch {
    pub epoch_id: u64,
    pub fractional_nft: Pubkey,
    pub revenue_amount: u64,
    pub fragments_outstanding_snapshot: u64,
    pub acc_revenue_per_fragment_after: u128,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
pub struct LicenseVote {
    pub proposal_id: u64,
    pub fractional_nft: Pubkey,
    pub total_votes_for: u64,
    pub total_votes_against: u64,
    pub total_fragments_voted: u64,
    pub is_approved: bool,
    pub is_finalized: bool,
    pub created_at: i64,
    pub bump: u8,
}

// ─── Context structures ──────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct FractionalizeNFT<'info> {
    #[account(
        init,
        payer = owner,
        // [audit fix round2 R2-C-F1] extra 16+8 bytes for
        // acc_revenue_per_fragment (u128) + next_epoch_id (u64).
        space = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 8 + 2 + 1 + 16 + 8,
        seeds = [b"fractional_nft", nft_mint.key().as_ref()],
        bump
    )]
    pub fractional_nft: Account<'info, FractionalNFT>,

    /// Original NFT mint. NFT-shape (0 decimals) is enforced in the handler.
    pub nft_mint: Account<'info, Mint>,

    /// Fragment SPL token mint (decimals = 0, authority = fractional_nft PDA).
    #[account(
        init,
        payer = owner,
        mint::decimals = 0,
        mint::authority = fractional_nft,
        seeds = [b"fragment_mint", nft_mint.key().as_ref()],
        bump
    )]
    pub fragment_mint: Account<'info, Mint>,

    /// NFT vault to hold the original NFT.
    #[account(
        init,
        payer = owner,
        token::mint = nft_mint,
        token::authority = fractional_nft,
        seeds = [b"nft_vault", nft_mint.key().as_ref()],
        bump
    )]
    pub nft_vault: Account<'info, TokenAccount>,

    /// Revenue vault to hold SOL from fragment sales.
    #[account(
        init,
        payer = owner,
        space = 8,
        seeds = [b"revenue_vault", nft_mint.key().as_ref()],
        bump
    )]
    /// CHECK: PDA that holds SOL; verified by seeds.
    pub revenue_vault: AccountInfo<'info>,

    // [audit fix H-F3] Owner's NFT token account: must point at nft_mint and
    // be owned by the signer. SPL Token enforces this on transfer; we also
    // assert in the handler for clearer errors.
    #[account(
        mut,
        constraint = owner_nft_account.mint == nft_mint.key() @ ErrorCode::InvalidNftAccount,
        constraint = owner_nft_account.owner == owner.key() @ ErrorCode::Unauthorized,
        constraint = owner_nft_account.amount >= 1 @ ErrorCode::InsufficientFragments,
    )]
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

    // [audit fix C-F1] Pin the fragment mint to the program-derived mint.
    #[account(
        mut,
        seeds = [b"fragment_mint", fractional_nft.original_nft.as_ref()],
        bump,
        constraint = fragment_mint.key() == fractional_nft.fragment_mint @ ErrorCode::InvalidMint,
    )]
    pub fragment_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"revenue_vault", fractional_nft.original_nft.as_ref()],
        bump
    )]
    /// CHECK: PDA verified by seeds.
    pub revenue_vault: AccountInfo<'info>,

    // [audit fix C-F2 / H-F4] fragment_holder is keyed by (fractional_nft
    // PDA, buyer). Per-holder identity guards live in the handler so first-
    // init can be distinguished from subsequent buys.
    #[account(
        init_if_needed,
        payer = buyer,
        // [audit fix round2 R2-C-F1] extra 16 bytes for revenue_debt (u128).
        // [audit fix round2 R2-H-F2] extra 8 bytes for voted_proposal_id (u64).
        space = 8 + 32 + 32 + 8 + 8 + 8 + 1 + 1 + 16 + 8,
        seeds = [b"fragment_holder", fractional_nft.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub fragment_holder: Account<'info, FragmentHolder>,

    // [audit fix C-F1] Buyer's fragment ATA: must reference fragment_mint
    // and be owned by buyer. Without this, the buyer can mint fragments
    // into a victim's ATA (grief), or into an attacker-controlled aux
    // account that decouples from the wallet UX.
    #[account(
        mut,
        constraint = buyer_fragment_account.mint == fractional_nft.fragment_mint @ ErrorCode::InvalidMint,
        constraint = buyer_fragment_account.owner == buyer.key() @ ErrorCode::Unauthorized,
    )]
    pub buyer_fragment_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SellFragment<'info> {
    #[account(
        mut,
        seeds = [b"fractional_nft", fractional_nft.original_nft.as_ref()],
        bump = fractional_nft.bump
    )]
    pub fractional_nft: Account<'info, FractionalNFT>,

    #[account(
        mut,
        seeds = [b"fragment_mint", fractional_nft.original_nft.as_ref()],
        bump,
        constraint = fragment_mint.key() == fractional_nft.fragment_mint @ ErrorCode::InvalidMint,
    )]
    pub fragment_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"revenue_vault", fractional_nft.original_nft.as_ref()],
        bump
    )]
    /// CHECK: PDA verified by seeds.
    pub revenue_vault: AccountInfo<'info>,

    // [audit fix C-F1] holder PDA tied to seller key; `has_one = holder`
    // verifies the stored owner matches the signer.
    #[account(
        mut,
        seeds = [b"fragment_holder", fractional_nft.key().as_ref(), seller.key().as_ref()],
        bump = fragment_holder.bump,
        constraint = fragment_holder.holder == seller.key() @ ErrorCode::InvalidHolder,
    )]
    pub fragment_holder: Account<'info, FragmentHolder>,

    // [audit fix C-F1] Seller's fragment ATA pinned to the official
    // fragment_mint and verified owner. Token program enforces owner-on-burn
    // separately, but checking up front gives a clean error.
    #[account(
        mut,
        constraint = seller_fragment_account.mint == fractional_nft.fragment_mint @ ErrorCode::InvalidMint,
        constraint = seller_fragment_account.owner == seller.key() @ ErrorCode::Unauthorized,
    )]
    pub seller_fragment_account: Account<'info, TokenAccount>,

    /// [audit fix round2 R2-H-F2] Optional license_vote PDA: required only
    /// when the seller has an OPEN vote (voted_proposal_id != u64::MAX).
    /// If present, the handler verifies it matches the holder's open vote
    /// and that the vote is finalized before allowing the sell.
    pub license_vote: Option<Account<'info, LicenseVote>>,

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

    #[account(
        mut,
        seeds = [b"revenue_vault", fractional_nft.original_nft.as_ref()],
        bump
    )]
    /// CHECK: PDA verified by seeds; SOL destination for the CPI transfer.
    pub revenue_vault: AccountInfo<'info>,

    /// [audit fix round2 R2-C-F1] Per-distribution immutable epoch PDA.
    /// Seeded by (fractional_nft, next_epoch_id) so each distribution gets a
    /// fresh PDA. Anchor evaluates `next_epoch_id` BEFORE the body increment.
    #[account(
        init,
        payer = authority,
        space = 8 + 8 + 32 + 8 + 8 + 16 + 8 + 1,
        seeds = [
            b"revenue_epoch",
            fractional_nft.key().as_ref(),
            fractional_nft.next_epoch_id.to_le_bytes().as_ref(),
        ],
        bump,
    )]
    pub revenue_epoch: Account<'info, RevenueEpoch>,

    // [audit fix C-F5] Only PROGRAM_ADMIN may call distribute_revenue. The
    // actual SOL is CPI-transferred from authority → revenue_vault, so
    // total_revenue cannot be inflated without backing funds.
    #[account(mut, address = PROGRAM_ADMIN @ ErrorCode::Unauthorized)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimRevenue<'info> {
    #[account(
        mut,
        seeds = [b"fractional_nft", fractional_nft.original_nft.as_ref()],
        bump = fractional_nft.bump
    )]
    pub fractional_nft: Account<'info, FractionalNFT>,

    #[account(
        mut,
        seeds = [b"fragment_holder", fractional_nft.key().as_ref(), holder.key().as_ref()],
        bump = fragment_holder.bump,
        constraint = fragment_holder.holder == holder.key() @ ErrorCode::InvalidHolder,
    )]
    pub fragment_holder: Account<'info, FragmentHolder>,

    #[account(
        mut,
        seeds = [b"revenue_vault", fractional_nft.original_nft.as_ref()],
        bump
    )]
    /// CHECK: PDA verified by seeds.
    pub revenue_vault: AccountInfo<'info>,

    #[account(mut)]
    pub holder: Signer<'info>,
}

/// [audit fix M-F1] Update the license-vote threshold. Only the original
/// owner (who fractionalized the NFT) can call. Bounded to [10%, 99.99%].
#[derive(Accounts)]
pub struct UpdateVoteThreshold<'info> {
    #[account(
        mut,
        seeds = [b"fractional_nft", fractional_nft.original_nft.as_ref()],
        bump = fractional_nft.bump,
        constraint = fractional_nft.original_owner == owner.key() @ ErrorCode::Unauthorized,
    )]
    pub fractional_nft: Account<'info, FractionalNFT>,

    pub owner: Signer<'info>,
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
        constraint = fragment_holder.holder == voter.key() @ ErrorCode::InvalidHolder,
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
        mut,
        seeds = [b"fragment_holder", fractional_nft.key().as_ref(), owner.key().as_ref()],
        bump = fragment_holder.bump,
        constraint = fragment_holder.holder == owner.key() @ ErrorCode::InvalidHolder,
    )]
    pub fragment_holder: Account<'info, FragmentHolder>,

    // [audit fix C-F7] fragment_mint required for the burn CPI.
    #[account(
        mut,
        seeds = [b"fragment_mint", fractional_nft.original_nft.as_ref()],
        bump,
        constraint = fragment_mint.key() == fractional_nft.fragment_mint @ ErrorCode::InvalidMint,
    )]
    pub fragment_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [b"nft_vault", fractional_nft.original_nft.as_ref()],
        bump,
        constraint = nft_vault.mint == fractional_nft.original_nft @ ErrorCode::InvalidNftAccount,
    )]
    pub nft_vault: Account<'info, TokenAccount>,

    // [audit fix C-F7] Revenue vault required so we can sweep remaining
    // lamports back to the original owner on reclaim.
    #[account(
        mut,
        seeds = [b"revenue_vault", fractional_nft.original_nft.as_ref()],
        bump
    )]
    /// CHECK: PDA verified by seeds.
    pub revenue_vault: AccountInfo<'info>,

    // [audit fix C-F1 / H-F3] Owner's NFT receiving account: pinned to
    // original NFT mint and owned by the signer.
    #[account(
        mut,
        constraint = owner_nft_account.mint == fractional_nft.original_nft @ ErrorCode::InvalidNftAccount,
        constraint = owner_nft_account.owner == owner.key() @ ErrorCode::Unauthorized,
    )]
    pub owner_nft_account: Account<'info, TokenAccount>,

    // [audit fix C-F7] Owner's fragment ATA — required to burn the
    // fragments they own. Pinned to the fragment mint and signer.
    #[account(
        mut,
        constraint = owner_fragment_account.mint == fractional_nft.fragment_mint @ ErrorCode::InvalidMint,
        constraint = owner_fragment_account.owner == owner.key() @ ErrorCode::Unauthorized,
    )]
    pub owner_fragment_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

// ─── Error codes ─────────────────────────────────────────────────────────────

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

    // [audit fix C-F1] Distinct error codes for clearer constraint failures.
    #[msg("Invalid SPL Mint account passed")]
    InvalidMint,

    #[msg("Invalid NFT token account (wrong mint or owner)")]
    InvalidNftAccount,

    #[msg("NFT mint is not NFT-shaped (decimals != 0)")]
    InvalidNftMint,

    #[msg("Unauthorized signer for this operation")]
    Unauthorized,

    #[msg("Fragment mint supply exceeds the configured total_fragments cap")]
    FragmentSupplyExceeded,

    #[msg("Revenue vault does not have enough lamports above rent-exempt floor")]
    InsufficientVaultBalance,

    #[msg("License proposal mismatch (proposal id / fnft)")]
    InvalidProposal,

    // [audit fix round2 R2-H-F2] Sell blocked while holder has an open vote.
    #[msg("Holder has an open license vote; cannot sell until vote is finalized")]
    VoteLockActive,

    // [audit fix round2 R2-C-F1] No revenue distributions yet for accumulator.
    #[msg("No revenue has been distributed yet")]
    NoRevenueDistributed,

    // [audit fix M-F1] vote_threshold_bps must be in [1000, 9999].
    #[msg("Vote threshold bps out of range [1000, 9999]")]
    InvalidVoteThreshold,

    // [audit fix R7-H-F1] reclaim_nft must not steal other holders' pending revenue.
    #[msg("Other holders still have unclaimed pending revenue; force them to claim before reclaim")]
    PendingPayoutsOutstanding,
}
