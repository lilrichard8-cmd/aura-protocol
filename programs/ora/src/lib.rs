use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};
// [audit fix C4.M-1 option-C] CPI dependency on the rewards program: the
// ORA mint authority lives on `rewards::reward_state` PDA, so every mint
// is issued via CPI into `rewards::mint_for_*`.
use rewards::cpi::accounts::MintForOra as RewardsMintForOra;
use rewards::program::AuraRewards;
use rewards::{self, RewardState};

declare_id!("Dq6fFo2yjSuiGPhc1hwDocKhEpsSam2X8PbzbhVzTHxN");

const ORA_DECIMALS: u8 = 9;
// [whitepaper-sync v1.1] INITIAL_SUPPLY synced to Whitepaper v1.1 §5.2 /
// Numbers Handbook §1: 1.1B ORA (was 1.05B in pre-v1.1 contract). Affects
// every downstream allocation %.
const INITIAL_SUPPLY: u64 = 1_100_000_000 * 1_000_000_000; // 1.1B with 9 decimals
// [whitepaper-sync v1.1] MAU_GROWTH_MINT_PER_10K synced to Whitepaper v1.1
// §5.10 / Numbers Handbook §3: 100k ORA per 10k MAU (was 500k — 5x too high).
// Cap remains at 75M total per audit/protocol guidance.
const MAU_GROWTH_MINT_PER_10K: u64 = 100_000 * 1_000_000_000; // 100k ORA per 10k MAU (WP §5.10)
const MAU_GROWTH_MINT_CAP: u64 = 75_000_000 * 1_000_000_000; // 75M ORA cap

// ──────────────────────────────────────────────────────────────────────
// [whitepaper-sync v1.1] §5.2 Initial Supply Allocation (1.1B)
//
// These constants are documentation/safety constants. Distribution to the
// individual buckets is performed off-chain (bucket multisigs / treasuries),
// but we surface the named amounts here so any future on-chain allocator
// can reference a single source of truth, and so the compile-time sum
// check below catches drift.
//
// Numbers Handbook §2:
//   Team                  150M  (Søren 50M / Iris 30M / Future 70M)
//   Community Incentives  500M  (managed by rewards program — see TOTAL_INCENTIVE_POOL)
//   Ecosystem DAO         200M
//   Launch Incentives     150M  (Million Plan 50M / Onboarding 50M / Rising Star 50M)
//   Liquidity & Bootstrap 100M
// ──────────────────────────────────────────────────────────────────────
pub const ALLOCATION_TEAM: u64 = 150_000_000 * 1_000_000_000;
pub const ALLOCATION_TEAM_SOREN: u64 = 50_000_000 * 1_000_000_000;
pub const ALLOCATION_TEAM_IRIS: u64 = 30_000_000 * 1_000_000_000;
pub const ALLOCATION_TEAM_FUTURE: u64 = 70_000_000 * 1_000_000_000;
pub const ALLOCATION_COMMUNITY: u64 = 500_000_000 * 1_000_000_000;
pub const ALLOCATION_ECOSYSTEM: u64 = 200_000_000 * 1_000_000_000;
pub const ALLOCATION_LAUNCH_INCENTIVES: u64 = 150_000_000 * 1_000_000_000;
pub const ALLOCATION_LIQUIDITY: u64 = 100_000_000 * 1_000_000_000;

// Compile-time sum checks. If any individual constant drifts, the build
// fails — preventing silent allocation-math regressions.
const _: () = {
    // Team sub-buckets sum to ALLOCATION_TEAM.
    assert!(
        ALLOCATION_TEAM_SOREN + ALLOCATION_TEAM_IRIS + ALLOCATION_TEAM_FUTURE
            == ALLOCATION_TEAM,
        "[whitepaper-sync v1.1] Team sub-buckets must sum to ALLOCATION_TEAM (150M)"
    );
    // All buckets sum to INITIAL_SUPPLY.
    assert!(
        ALLOCATION_TEAM
            + ALLOCATION_COMMUNITY
            + ALLOCATION_ECOSYSTEM
            + ALLOCATION_LAUNCH_INCENTIVES
            + ALLOCATION_LIQUIDITY
            == INITIAL_SUPPLY,
        "[whitepaper-sync v1.1] Allocation buckets must sum to INITIAL_SUPPLY (1.1B)"
    );
};

// ──────────────────────────────────────────────────────────────────────
// [whitepaper-sync v1.1] §5.5 Management Performance Pool
//
// 30M ORA / year × max 3 years = up to 90M ORA total. Independent of the
// 1.1B initial supply (this is an above-the-cap mint, gated to
// PROGRAM_ADMIN, year-bounded, and rate-limited to one approval per year).
// Unused tranches are forfeit by simply not approving (no on-chain burn
// required).
// ──────────────────────────────────────────────────────────────────────
pub const PERF_POOL_ANNUAL_BUDGET: u64 = 30_000_000 * 1_000_000_000;
pub const PERF_POOL_MAX_YEARS: u8 = 3;
pub const PERF_POOL_MAX_TOTAL: u64 = 90_000_000 * 1_000_000_000;
const _: () = assert!(
    (PERF_POOL_MAX_YEARS as u64) * PERF_POOL_ANNUAL_BUDGET == PERF_POOL_MAX_TOTAL,
    "[whitepaper-sync v1.1] PERF_POOL_MAX_TOTAL must equal PERF_POOL_MAX_YEARS * PERF_POOL_ANNUAL_BUDGET"
);

// ──────────────────────────────────────────────────────────────────────
// [whitepaper-sync v1.1] §5.8 Perpetual Annual Emission Schedule
//
// Whitepaper §5.8 / Handbook §3:
//   Y1 = 5% of current total supply
//   Y2 = 4%
//   Y3 = 3%
//   Y4+ = 2% (permanent floor)
// Split: 80% to creator-rewards pool destination, 20% to Ecosystem DAO.
// Tier I immutable: cannot be changed by governance.
// ──────────────────────────────────────────────────────────────────────
pub const ANNUAL_EMISSION_Y1_BPS: u16 = 500;   // 5%
pub const ANNUAL_EMISSION_Y2_BPS: u16 = 400;   // 4%
pub const ANNUAL_EMISSION_Y3_BPS: u16 = 300;   // 3%
pub const ANNUAL_EMISSION_FLOOR_BPS: u16 = 200; // 2% Y4+ permanent floor
pub const ANNUAL_EMISSION_CREATOR_SHARE_BPS: u16 = 8000; // 80% to creator rewards pool
pub const ANNUAL_EMISSION_DAO_SHARE_BPS: u16 = 2000;     // 20% to Ecosystem DAO
const _: () = assert!(
    ANNUAL_EMISSION_CREATOR_SHARE_BPS + ANNUAL_EMISSION_DAO_SHARE_BPS == 10_000,
    "[whitepaper-sync v1.1] annual emission creator/DAO shares must sum to 10000 bps"
);

/// Approximate seconds in one year. Used for rate-limiting `annual_emission_mint`
/// and bounding the Y1 emergency authority window.
pub const SECONDS_PER_YEAR: i64 = 365 * 24 * 60 * 60;

// ──────────────────────────────────────────────────────────────────────
// [whitepaper-sync v1.1] §3 Storage Emission framework (Handbook §7)
//
// Per-trigger cap: 3% of total supply (Tier I, immutable).
// Y1 emergency authority: single mint up to 1% of supply, auto-expires Y2.
// The actual storage-emission instruction is not in scope for this sync
// batch — we add the framework constants and the Y1 emergency-mint guard.
// ──────────────────────────────────────────────────────────────────────
pub const STORAGE_EMISSION_TRIGGER_CAP_BPS: u16 = 300; // 3% per trigger
pub const Y1_EMERGENCY_AUTHORITY_BPS: u16 = 100;       // 1% Y1 single mint
/// [audit fix E.M-1] Burn-floor numerator/denominator. The floor is computed
/// dynamically as `BURN_FLOOR_BPS * total_ever_minted / 10000`, so as the MAU
/// growth path adds new supply the floor scales with it. Previously the floor
/// was hardcoded at 30% of INITIAL_SUPPLY (315M ORA) and drifted to ~28% of
/// total supply after MAU growth; the dynamic floor restores the whitepaper's
/// "burn floor is 30% of supply ever minted" invariant.
pub const BURN_FLOOR_BPS: u64 = 3000; // 30% in bps
/// Hardcoded lower bound on the burn floor regardless of bookkeeping. If
/// `total_ever_minted` is somehow zero (pre-init bootstrap) we still refuse to
/// burn below 30% of the documented initial supply, matching the original
/// constant. This is the safety net the auditor recommended.
/// [whitepaper-sync v1.1] rescaled to 30% of 1.1B = 330M.
const BURN_FLOOR_MIN: u64 = 330_000_000 * 1_000_000_000; // 30% of 1.1B

/// [audit fix E.M-1] Dynamic burn floor: 30% of `total_ever_minted`, clamped
/// at minimum to the original 315M figure (30% of INITIAL_SUPPLY). This makes
/// the floor scale with supply as MAU growth adds tokens — the auditor’s
/// recommended fix.
fn dynamic_burn_floor(total_ever_minted: u64) -> u64 {
    let dynamic = (total_ever_minted as u128)
        .saturating_mul(BURN_FLOOR_BPS as u128)
        .saturating_div(10_000) as u64;
    if dynamic > BURN_FLOOR_MIN { dynamic } else { BURN_FLOOR_MIN }
}

// [audit fix E-C-2 / E-C-1] Hardcoded protocol admin + treasury accounts.
// Set to system_program::ID as placeholder; replace with real keys before mainnet deploy.
pub const PROGRAM_ADMIN: Pubkey = anchor_lang::solana_program::system_program::ID;
pub const OFFICIAL_STAKING_POOL: Pubkey = anchor_lang::solana_program::system_program::ID;
pub const OFFICIAL_PLATFORM: Pubkey = anchor_lang::solana_program::system_program::ID;
// [audit fix R5 H-O-1] / [whitepaper-sync v1.1] §5.7 fee split correction —
// process_fee now needs the gas-reserve and ops-treasury destinations to match
// the 40/40/10/10 split shared with content-keys / market / livestream /
// creator-coin. Placeholders here mirror the other programs; replace with real
// multisig-controlled ATAs before mainnet deploy.
pub const OFFICIAL_GAS_RESERVE: Pubkey = anchor_lang::solana_program::system_program::ID;
pub const OFFICIAL_OPS_TREASURY: Pubkey = anchor_lang::solana_program::system_program::ID;
// [audit fix round2 E2.H-2] Hardcoded growth-reserve destination. Without this
// binding the authority could mint up to 75M ORA via mau_growth_mint to any
// arbitrary token account. ⚠️ DO NOT DEPLOY — placeholder; replace with the
// real multisig-controlled ATA before mainnet deploy.
pub const OFFICIAL_GROWTH_RESERVE: Pubkey = anchor_lang::solana_program::system_program::ID;

#[program]
pub mod aura_ora {
    use super::*;

    /// Initialize ORA mint and config. Creates the mint PDA only.
    /// Call mint_initial_supply after creating a token account for the mint.
    ///
    /// [audit fix C4.M-1 option-C] The ORA mint authority is the `rewards`
    /// program's `reward_state` PDA (so the rewards init-time sanity check
    /// passes and so all subsequent mints flow through the unified
    /// `rewards::mint_for_*` wrappers). Deploy order:
    ///   1. `rewards::initialize_rewards`'s PDA is computable independent of
    ///      init order — we can derive its address here for `mint::authority`.
    ///   2. After this ix runs, the caller must invoke
    ///      `rewards::initialize_rewards` to register the mint with rewards.
    ///   3. Then `ora::mint_initial_supply` becomes callable (it CPI's back
    ///      into rewards).
    pub fn initialize_ora(ctx: Context<InitializeOra>) -> Result<()> {
        let config = &mut ctx.accounts.ora_config;
        config.authority = ctx.accounts.authority.key();
        config.mint = ctx.accounts.ora_mint.key();
        config.total_burned = 0;
        config.mau_growth_minted = 0;
        config.current_mau = 0;
        config.last_mau_checkpoint = 0;
        config.bump = ctx.bumps.ora_config;
        // initial_supply_minted defaults to false; total_ever_minted defaults to 0
        // (Anchor zeroes the account at init).

        // [whitepaper-sync v1.1] anchor program start time — used to bound
        // the Y1 emergency-mint authority window. All other v1.1 trackers
        // default to zero/false.
        config.program_init_ts = Clock::get()?.unix_timestamp;

        msg!("ORA initialized: mint created, call mint_initial_supply next");
        Ok(())
    }

    /// Mint the initial 1.1B supply to the authority's token account.
    /// [whitepaper-sync v1.1] re-synced to Whitepaper v1.1 §5.2 (was 1.05B).
    /// Must be called after initialize_ora and after creating a token account for the ORA mint.
    /// [audit fix E-C-5] Replay-protected via `initial_supply_minted` flag; can only run once.
    /// [audit fix round2 E2.H-1] cap check added: bootstrap ordering where
    /// mint_ora was called BEFORE mint_initial_supply could have inflated
    /// total_ever_minted past the ceiling; now both paths enforce the cap.
    /// [audit fix C4.M-1 option-C] mint authority is now `rewards.reward_state`
    /// PDA — minting goes through CPI into `rewards::mint_for_initial_supply`.
    pub fn mint_initial_supply(ctx: Context<MintInitialSupply>) -> Result<()> {
        // [audit fix E-C-5] enforce one-shot semantics — set the flag BEFORE
        // the mint_to CPI to defend against potential re-entrancy via the
        // token program (no current SPL Token CPI calls back, but defense-in-
        // depth costs us nothing).
        require!(
            !ctx.accounts.ora_config.initial_supply_minted,
            ErrorCode::AlreadyMinted
        );

        // [audit fix round2 E2.H-1] enforce supply cap on this path too
        let total_cap = INITIAL_SUPPLY
            .checked_add(MAU_GROWTH_MINT_CAP)
            .ok_or(ErrorCode::Overflow)?;
        let new_total = ctx
            .accounts
            .ora_config
            .total_ever_minted
            .checked_add(INITIAL_SUPPLY)
            .ok_or(ErrorCode::Overflow)?;
        require!(new_total <= total_cap, ErrorCode::SupplyCapExceeded);

        // [audit fix round2 E2.H-1] set the one-shot guard and bookkeeping
        // BEFORE the mint_to CPI to prevent any re-entrancy path.
        {
            let config = &mut ctx.accounts.ora_config;
            config.initial_supply_minted = true;
            config.total_ever_minted = new_total;
        }

        // [audit fix C4.M-1 option-C] CPI into rewards — the ORA mint
        // authority is `reward_state` PDA, so only the rewards program can
        // sign `token::mint_to`. We pass our own `ora_config` PDA as the
        // signer (with seeds) to satisfy the rewards-side caller gate.
        let config_bump = ctx.accounts.ora_config.bump;
        let ora_config_seeds: &[&[u8]] = &[b"ora_config".as_ref(), &[config_bump]];
        let signer_seeds = &[ora_config_seeds];
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.rewards_program.to_account_info(),
            RewardsMintForOra {
                reward_state: ctx.accounts.reward_state.to_account_info(),
                ora_mint: ctx.accounts.ora_mint.to_account_info(),
                destination_token_account: ctx.accounts.authority_token_account.to_account_info(),
                caller_ora_config: ctx.accounts.ora_config.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
            signer_seeds,
        );
        rewards::cpi::mint_for_initial_supply(cpi_ctx, INITIAL_SUPPLY)?;

        // [whitepaper-sync v1.1] message updated to reflect 1.1B initial supply
        msg!("ORA initial supply minted: 1.1B tokens (cumulative {})", new_total);
        Ok(())
    }

    /// Mint ORA to a recipient (authority only).
    /// [audit fix E-C-4] Bookkeeping: every mint is recorded in `total_ever_minted`
    /// and capped to INITIAL_SUPPLY + MAU_GROWTH_MINT_CAP so this generic helper
    /// can never silently exceed the whitepaper supply ceiling.
    /// [audit fix C4.M-1 option-C] minting now happens via CPI into
    /// `rewards::mint_for_ora` (rewards holds the ORA mint authority).
    pub fn mint_ora(ctx: Context<MintOra>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        // [audit fix E-C-4] supply cap check (initial + growth budget)
        let total_cap = INITIAL_SUPPLY
            .checked_add(MAU_GROWTH_MINT_CAP)
            .ok_or(ErrorCode::Overflow)?;
        let new_total = ctx
            .accounts
            .ora_config
            .total_ever_minted
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        require!(new_total <= total_cap, ErrorCode::SupplyCapExceeded);

        // [audit fix C4.M-1 option-C] persist counter BEFORE CPI to guard
        // against any conceivable re-entrancy via a malicious program in the
        // future (SPL token never calls back, but defense-in-depth is cheap).
        ctx.accounts.ora_config.total_ever_minted = new_total;

        // [audit fix C4.M-1 option-C] CPI into rewards::mint_for_ora
        let config_bump = ctx.accounts.ora_config.bump;
        let ora_config_seeds: &[&[u8]] = &[b"ora_config".as_ref(), &[config_bump]];
        let signer_seeds = &[ora_config_seeds];
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.rewards_program.to_account_info(),
            RewardsMintForOra {
                reward_state: ctx.accounts.reward_state.to_account_info(),
                ora_mint: ctx.accounts.ora_mint.to_account_info(),
                destination_token_account: ctx.accounts.recipient_token_account.to_account_info(),
                caller_ora_config: ctx.accounts.ora_config.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
            signer_seeds,
        );
        // purpose=0 (AdHoc) — see rewards::MintPurpose
        rewards::cpi::mint_for_ora(cpi_ctx, amount, 0u8)?;

        msg!("Minted {} ORA (cumulative {})", amount, new_total);
        Ok(())
    }

    /// Burn ORA from user's account
    pub fn burn_ora(ctx: Context<BurnOra>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        // [audit fix E.M-1] burn floor is now dynamic against total_ever_minted
        let current_supply = ctx.accounts.ora_mint.supply;
        let floor = dynamic_burn_floor(ctx.accounts.ora_config.total_ever_minted);
        require!(
            current_supply.saturating_sub(amount) >= floor,
            ErrorCode::BurnFloorReached
        );

        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.ora_mint.to_account_info(),
                    from: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        // [audit fix E-H-1] use checked_add with explicit overflow error instead of .unwrap()
        let config = &mut ctx.accounts.ora_config;
        config.total_burned = config
            .total_burned
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        emit!(BurnEvent {
            burn_type: BurnType::IncentiveTax,
            amount,
            total_burned: config.total_burned,
            timestamp: Clock::get()?.unix_timestamp,
        });
        msg!("Burned {} ORA", amount);
        Ok(())
    }

    /// Triple burn: incentive tax (10% of rewards), tx fee burn (2.5% of 5% fee with MAU multiplier),
    /// and Type B feature burn (95% of feature payment)
    pub fn triple_burn(
        ctx: Context<TripleBurn>,
        burn_type: BurnType,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        // [audit fix E-H-2] all arithmetic via u128 with explicit overflow guards,
        // and final u128→u64 narrowing fails fast with `Overflow` instead of silent wrap.
        let burn_amount: u64 = match burn_type {
            BurnType::IncentiveTax => {
                // 10% of reward distribution gets burned
                let v = (amount as u128)
                    .checked_mul(10)
                    .ok_or(ErrorCode::Overflow)?
                    / 100u128;
                u64::try_from(v).map_err(|_| ErrorCode::Overflow)?
            }
            BurnType::TransactionFee => {
                // 2.5% of 5% unified fee → burned, with MAU multiplier (1.2x~1.5x)
                let base_burn = (amount as u128)
                    .checked_mul(25)
                    .ok_or(ErrorCode::Overflow)?
                    / 1000u128; // 2.5%
                let mau = ctx.accounts.ora_config.current_mau;
                let multiplier: u128 = if mau >= 1_000_000 {
                    1500u128
                } else {
                    1200u128 + (mau as u128 * 300 / 1_000_000)
                };
                let v = base_burn
                    .checked_mul(multiplier)
                    .ok_or(ErrorCode::Overflow)?
                    / 1000u128;
                u64::try_from(v).map_err(|_| ErrorCode::Overflow)?
            }
            BurnType::TypeBFeature => {
                // 95% of feature payments burned
                let v = (amount as u128)
                    .checked_mul(95)
                    .ok_or(ErrorCode::Overflow)?
                    / 100u128;
                u64::try_from(v).map_err(|_| ErrorCode::Overflow)?
            }
        };

        if burn_amount > 0 {
            // Burn floor check
            let current_supply = ctx.accounts.ora_mint.supply;
            // [audit fix E.M-1] dynamic burn floor
            let floor = dynamic_burn_floor(ctx.accounts.ora_config.total_ever_minted);
            let actual_burn = if current_supply.saturating_sub(burn_amount) < floor {
                current_supply.saturating_sub(floor) // burn only down to floor
            } else {
                burn_amount
            };

            if actual_burn > 0 {
                token::burn(
                    CpiContext::new(
                        ctx.accounts.token_program.to_account_info(),
                        Burn {
                            mint: ctx.accounts.ora_mint.to_account_info(),
                            from: ctx.accounts.source_token_account.to_account_info(),
                            authority: ctx.accounts.authority.to_account_info(),
                        },
                    ),
                    actual_burn,
                )?;
            }

            // [audit fix E-H-1] checked_add with explicit error
            let config = &mut ctx.accounts.ora_config;
            config.total_burned = config
                .total_burned
                .checked_add(actual_burn)
                .ok_or(ErrorCode::Overflow)?;
        }

        msg!("Triple burn ({:?}): {} ORA burned from {} input", burn_type, burn_amount, amount);
        Ok(())
    }

    /// Distribute reward using Model C dual-decay formula
    /// Reward = Base + 18 / (1 + MAU / 50000)
    /// Base = 2 ORA (MAU<500k) / 1 ORA (MAU>=500k)
    /// [audit fix round2 E2.M-1 / E2.M-3] every .unwrap() now returns Overflow,
    /// and net_reward is bookkept against total_ever_minted with cap enforcement
    /// (same source of truth as mint_ora / mau_growth_mint).
    pub fn distribute_reward(ctx: Context<DistributeReward>) -> Result<()> {
        let config = &ctx.accounts.ora_config;
        let mau = config.current_mau;

        // Base reward: 2 ORA if MAU < 500k, 1 ORA if >= 500k
        let base: u64 = if mau < 500_000 {
            2 * 1_000_000_000
        } else {
            1_000_000_000
        };

        // Bonus: 18 / (1 + MAU / 50000), in ORA with 9 decimals
        // = 18e9 / (1 + MAU/50000) = 18e9 * 50000 / (50000 + MAU)
        let bonus = (18u128 * 1_000_000_000 * 50_000)
            .checked_div(50_000u128 + mau as u128)
            .unwrap_or(0) as u64;

        // [audit fix round2 E2.M-1] graceful overflow handling
        let total_reward = base.checked_add(bonus).ok_or(ErrorCode::Overflow)?;

        // Burn 10% (incentive tax)
        let burn_amount = total_reward
            .checked_mul(10)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(100)
            .ok_or(ErrorCode::Overflow)?;
        let net_reward = total_reward
            .checked_sub(burn_amount)
            .ok_or(ErrorCode::Overflow)?;

        // [audit fix round2 E2.M-3] enforce the same supply cap on this mint
        // path. Previously `distribute_reward` minted ORA without updating
        // `total_ever_minted`, allowing it to bypass the ceiling enforced by
        // mint_ora. Unify on `total_ever_minted` as the single source of truth.
        let total_cap = INITIAL_SUPPLY
            .checked_add(MAU_GROWTH_MINT_CAP)
            .ok_or(ErrorCode::Overflow)?;
        let new_total = config
            .total_ever_minted
            .checked_add(net_reward)
            .ok_or(ErrorCode::Overflow)?;
        require!(new_total <= total_cap, ErrorCode::SupplyCapExceeded);

        let config_bump = config.bump;

        // [audit fix round2 E2.M-3 / C4.M-1 option-C] persist supply +
        // withhold trackers BEFORE the CPI (re-entrancy defense).
        {
            let config = &mut ctx.accounts.ora_config;
            config.total_ever_minted = new_total;
            config.total_burned = config
                .total_burned
                .checked_add(burn_amount)
                .ok_or(ErrorCode::Overflow)?;
        }

        // [audit fix C4.M-1 option-C] CPI into rewards::mint_for_ora to
        // issue the net reward (the ORA mint authority is reward_state).
        let ora_config_seeds: &[&[u8]] = &[b"ora_config".as_ref(), &[config_bump]];
        let signer_seeds = &[ora_config_seeds];
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.rewards_program.to_account_info(),
            RewardsMintForOra {
                reward_state: ctx.accounts.reward_state.to_account_info(),
                ora_mint: ctx.accounts.ora_mint.to_account_info(),
                destination_token_account: ctx.accounts.recipient_token_account.to_account_info(),
                caller_ora_config: ctx.accounts.ora_config.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
            signer_seeds,
        );
        // purpose=1 (DistributeReward)
        rewards::cpi::mint_for_ora(cpi_ctx, net_reward, 1u8)?;

        // [audit fix round2 E2.M-3] persist supply tracker (already done above)
        // [audit fix E.M-2] record the withheld amount under `total_burned` so
        // protocol metrics aren't a fiction: the 10% incentive tax is
        // accounted-for here even though no `token::burn` CPI fires (the
        // tokens are simply never minted). Naming retained as "burned" for
        // backward compatibility with downstream indexers; auditor noted this
        // is a known-and-now-tracked withhold accounting model.
        // (Persistence already happened pre-CPI above.)
        let config = &ctx.accounts.ora_config;

        msg!("Reward distributed: {} ORA (withheld {} incentive tax, cumulative minted {}, total_burned {})", net_reward, burn_amount, new_total, config.total_burned);
        Ok(())
    }

    /// [audit fix R5 H-O-1] / [whitepaper-sync v1.1] §5.7 fee split correction —
    /// Unified 5% fee handler with the WP-v1.1 / Handbook §5 split:
    ///   2% burn + 2% staking rewards + 0.5% gas reserve + 0.5% ops treasury
    /// (= 40/40/10/10 of the 5% protocol fee). Previously this handler shipped
    /// the pre-v1.1 50/40/10 split which was missed during the wp-sync batches;
    /// content-keys / market / livestream / creator-coin already use 40/40/10/10.
    pub fn process_fee(ctx: Context<ProcessFee>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        // 5% protocol fee
        let fee = amount.checked_mul(5).ok_or(ErrorCode::Overflow)?.checked_div(100).ok_or(ErrorCode::Overflow)?; // 5%
        // [audit fix R5 H-O-1] 40/40/10/10 split — was 50/40/10
        let burn_portion    = fee.checked_mul(40).ok_or(ErrorCode::Overflow)?.checked_div(100).ok_or(ErrorCode::Overflow)?; // 2% of total = 40% of fee
        let staking_portion = fee.checked_mul(40).ok_or(ErrorCode::Overflow)?.checked_div(100).ok_or(ErrorCode::Overflow)?; // 2% of total = 40% of fee
        let gas_portion     = fee.checked_mul(10).ok_or(ErrorCode::Overflow)?.checked_div(100).ok_or(ErrorCode::Overflow)?; // 0.5% of total = 10% of fee
        // Ops portion = residual (carries any rounding dust) — matches
        // content-keys / livestream / creator-coin residual pattern.
        let ops_portion = fee
            .checked_sub(burn_portion).ok_or(ErrorCode::Overflow)?
            .checked_sub(staking_portion).ok_or(ErrorCode::Overflow)?
            .checked_sub(gas_portion).ok_or(ErrorCode::Overflow)?; // 0.5%

        // Burn portion (with burn floor check)
        // [audit fix E.M-1] dynamic burn floor
        let floor = dynamic_burn_floor(ctx.accounts.ora_config.total_ever_minted);
        let actual_burn_portion = if ctx.accounts.ora_mint.supply.saturating_sub(burn_portion) < floor {
            ctx.accounts.ora_mint.supply.saturating_sub(floor)
        } else {
            burn_portion
        };
        if actual_burn_portion > 0 {
            token::burn(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Burn {
                        mint: ctx.accounts.ora_mint.to_account_info(),
                        from: ctx.accounts.fee_source_account.to_account_info(),
                        authority: ctx.accounts.payer.to_account_info(),
                    },
                ),
                actual_burn_portion,
            )?;
        }

        // Transfer staking portion
        if staking_portion > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.fee_source_account.to_account_info(),
                        to: ctx.accounts.staking_pool_account.to_account_info(),
                        authority: ctx.accounts.payer.to_account_info(),
                    },
                ),
                staking_portion,
            )?;
        }

        // [audit fix R5 H-O-1] Transfer gas reserve portion
        if gas_portion > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.fee_source_account.to_account_info(),
                        to: ctx.accounts.gas_reserve_account.to_account_info(),
                        authority: ctx.accounts.payer.to_account_info(),
                    },
                ),
                gas_portion,
            )?;
        }

        // [audit fix R5 H-O-1] Transfer ops treasury portion (was "platform")
        if ops_portion > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.fee_source_account.to_account_info(),
                        to: ctx.accounts.ops_treasury_account.to_account_info(),
                        authority: ctx.accounts.payer.to_account_info(),
                    },
                ),
                ops_portion,
            )?;
        }

        // [audit fix round2 E2.M-2] graceful overflow instead of panicking .unwrap()
        let config = &mut ctx.accounts.ora_config;
        config.total_burned = config
            .total_burned
            .checked_add(actual_burn_portion)
            .ok_or(ErrorCode::Overflow)?;

        // [audit fix R5 H-O-1] emit 4-way fee breakdown for off-chain accounting
        emit!(FeeProcessedEvent {
            fee_total: fee,
            burn: actual_burn_portion,
            staking: staking_portion,
            gas: gas_portion,
            ops: ops_portion,
        });
        msg!(
            "Fee processed: {} total, burn={}, staking={}, gas={}, ops={}",
            fee, burn_portion, staking_portion, gas_portion, ops_portion
        );
        Ok(())
    }

    /// MAU growth mint: per 10k new MAU → +100k ORA minted, cap 75M total.
    /// [whitepaper-sync v1.1] synced to Whitepaper v1.1 §5.10 / Handbook §3
    /// (was 500k per 10k MAU; corrected to 100k).
    /// [audit fix E-H-3] when actual_mint is zero (cap exhausted or sub-10k tick),
    /// we now reject the call instead of silently advancing the MAU counter, so the
    /// off-chain caller cannot "burn" growth ticks without ever crediting tokens.
    pub fn mau_growth_mint(ctx: Context<MauGrowthMint>, new_mau: u64) -> Result<()> {
        let current_mau = ctx.accounts.ora_config.current_mau;
        let mau_growth_minted = ctx.accounts.ora_config.mau_growth_minted;
        let config_bump = ctx.accounts.ora_config.bump;

        require!(new_mau > current_mau, ErrorCode::MauNotIncreased);

        // [audit fix E-H-1] no .unwrap() on subtraction (already guarded by check above,
        // but use checked_sub for defense-in-depth)
        let mau_increase = new_mau
            .checked_sub(current_mau)
            .ok_or(ErrorCode::Overflow)?;
        let checkpoints = mau_increase / 10_000;

        if checkpoints == 0 {
            ctx.accounts.ora_config.current_mau = new_mau;
            msg!("MAU updated to {}, no mint threshold reached", new_mau);
            return Ok(());
        }

        let mint_amount = checkpoints
            .checked_mul(MAU_GROWTH_MINT_PER_10K)
            .ok_or(ErrorCode::Overflow)?;
        let remaining_cap = MAU_GROWTH_MINT_CAP.saturating_sub(mau_growth_minted);
        let actual_mint = mint_amount.min(remaining_cap);

        // [audit fix E-H-3] reject zero-mint when caller asked for a real checkpoint:
        // if cap is exhausted but caller still passed a checkpoint-worth of MAU growth,
        // surface MauGrowthCapReached instead of silently bumping current_mau.
        require!(actual_mint > 0, ErrorCode::MauGrowthCapReached);

        // [audit fix round2 E2.C-1] unify supply ceiling on `total_ever_minted`.
        // Previously mau_growth_mint only checked its own mau_growth_minted
        // counter, so it could mint up to 75M ORA on top of whatever mint_ora
        // had already credited — yielding 1.20B vs the 1.125B cap. Now both
        // paths enforce `total_ever_minted + actual_mint <= INITIAL_SUPPLY +
        // MAU_GROWTH_MINT_CAP`.
        let total_cap = INITIAL_SUPPLY
            .checked_add(MAU_GROWTH_MINT_CAP)
            .ok_or(ErrorCode::Overflow)?;
        let new_total = ctx
            .accounts
            .ora_config
            .total_ever_minted
            .checked_add(actual_mint)
            .ok_or(ErrorCode::Overflow)?;
        require!(new_total <= total_cap, ErrorCode::SupplyCapExceeded);

        // [audit fix C4.M-1 option-C] persist all bookkeeping BEFORE CPI to
        // guard against re-entrancy.
        {
            let config = &mut ctx.accounts.ora_config;
            // [audit fix E-H-1] checked_add on cumulative trackers
            config.mau_growth_minted = mau_growth_minted
                .checked_add(actual_mint)
                .ok_or(ErrorCode::Overflow)?;
            config.total_ever_minted = new_total;
            config.current_mau = new_mau;
            // [audit fix E-L-1 partial] checkpoint anchored to growth budget actually consumed
            config.last_mau_checkpoint = config
                .last_mau_checkpoint
                .checked_add(checkpoints.checked_mul(10_000).ok_or(ErrorCode::Overflow)?)
                .ok_or(ErrorCode::Overflow)?;
        }

        // [audit fix C4.M-1 option-C] CPI into rewards::mint_for_growth.
        let ora_config_seeds: &[&[u8]] = &[b"ora_config".as_ref(), &[config_bump]];
        let signer_seeds = &[ora_config_seeds];
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.rewards_program.to_account_info(),
            RewardsMintForOra {
                reward_state: ctx.accounts.reward_state.to_account_info(),
                ora_mint: ctx.accounts.ora_mint.to_account_info(),
                destination_token_account: ctx.accounts.growth_reserve_account.to_account_info(),
                caller_ora_config: ctx.accounts.ora_config.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
            signer_seeds,
        );
        rewards::cpi::mint_for_growth(cpi_ctx, actual_mint)?;

        let config = &ctx.accounts.ora_config;
        msg!("MAU growth mint: {} ORA for {} new MAU (total minted: {})", actual_mint, mau_increase, config.mau_growth_minted);
        Ok(())
    }

    // ──────────────────────────────────────────────────────────────────────
    // [whitepaper-sync v1.1] §5.5 Management Performance Pool
    //
    // `request_performance_pool(year, amount)` mints up to
    // `PERF_POOL_ANNUAL_BUDGET` ORA per year, capped at `PERF_POOL_MAX_YEARS`
    // (3 years) and `PERF_POOL_MAX_TOTAL` (90M) cumulative. Gated to
    // PROGRAM_ADMIN. Each (year_index) tranche is one-shot via the year
    // bitmap; year-end unused tranches are forfeit by simply not approving.
    //
    // This is an above-the-cap mint (independent of INITIAL_SUPPLY + MAU
    // growth budget) per Handbook §5. We deliberately do NOT add it to
    // `total_ever_minted` (which gates initial + growth supply).
    // ──────────────────────────────────────────────────────────────────────
    pub fn request_performance_pool(
        ctx: Context<RequestPerformancePool>,
        year_index: u8,
        amount: u64,
    ) -> Result<()> {
        // year_index is 1-indexed (1, 2, 3)
        require!(year_index >= 1 && year_index <= PERF_POOL_MAX_YEARS, ErrorCode::PerfPoolInvalidYear);
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(amount <= PERF_POOL_ANNUAL_BUDGET, ErrorCode::PerfPoolBudgetExceeded);

        let cfg = &ctx.accounts.ora_config;
        let bit = 1u8 << (year_index - 1);
        require!(
            (cfg.perf_pool_year_approved_bitmap & bit) == 0,
            ErrorCode::PerfPoolYearAlreadyApproved
        );

        let new_total = cfg
            .perf_pool_total_approved
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        require!(new_total <= PERF_POOL_MAX_TOTAL, ErrorCode::PerfPoolBudgetExceeded);

        let config_bump = cfg.bump;

        // Persist before CPI (re-entrancy defense).
        {
            let cfg = &mut ctx.accounts.ora_config;
            cfg.perf_pool_total_approved = new_total;
            cfg.perf_pool_last_year_approved = year_index;
            cfg.perf_pool_year_approved_bitmap |= bit;
        }

        // CPI into rewards::mint_for_ora (purpose=0 AdHoc; perf pool mints
        // go to PROGRAM_ADMIN-controlled destination via the caller-chosen
        // recipient_token_account, mint-bound to ORA).
        let ora_config_seeds: &[&[u8]] = &[b"ora_config".as_ref(), &[config_bump]];
        let signer_seeds = &[ora_config_seeds];
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.rewards_program.to_account_info(),
            RewardsMintForOra {
                reward_state: ctx.accounts.reward_state.to_account_info(),
                ora_mint: ctx.accounts.ora_mint.to_account_info(),
                destination_token_account: ctx.accounts.perf_pool_destination.to_account_info(),
                caller_ora_config: ctx.accounts.ora_config.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
            signer_seeds,
        );
        rewards::cpi::mint_for_ora(cpi_ctx, amount, 0u8)?;

        msg!(
            "[whitepaper-sync v1.1] Performance Pool mint: year={} amount={} cumulative={}",
            year_index, amount, new_total
        );
        Ok(())
    }

    // ──────────────────────────────────────────────────────────────────────
    // [whitepaper-sync v1.1] §5.8 Annual Perpetual Emission
    //
    // `annual_emission_mint(year_index)` mints the perpetual emission for
    // the given protocol year:
    //   Y1 = 5% of current_supply
    //   Y2 = 4%
    //   Y3 = 3%
    //   Y4+ = 2% (permanent floor)
    // Split 80% to creator-rewards pool destination / 20% to Ecosystem DAO.
    //
    // Rate-limited to one call per year via a year bitmap and a
    // `SECONDS_PER_YEAR` minimum delta against `annual_emission_last_ts`.
    // Gated to PROGRAM_ADMIN. Above-the-cap mint, not counted in
    // `total_ever_minted`.
    // ──────────────────────────────────────────────────────────────────────
    pub fn annual_emission_mint(
        ctx: Context<AnnualEmissionMint>,
        year_index: u16,
    ) -> Result<()> {
        require!(year_index >= 1 && year_index <= 16, ErrorCode::AnnualEmissionInvalidYear);

        let cfg = &ctx.accounts.ora_config;
        let bit = 1u16 << (year_index - 1);
        require!(
            (cfg.annual_emission_year_bitmap & bit) == 0,
            ErrorCode::AnnualEmissionYearAlreadyEmitted
        );

        // Determine the emission rate for the requested year.
        let emission_bps: u16 = match year_index {
            1 => ANNUAL_EMISSION_Y1_BPS,
            2 => ANNUAL_EMISSION_Y2_BPS,
            3 => ANNUAL_EMISSION_Y3_BPS,
            _ => ANNUAL_EMISSION_FLOOR_BPS,
        };

        // Rate-limit: at least ~1 year since the last successful emission.
        // Year 1 is allowed at any time after init; subsequent years require
        // the time delta.
        let now = Clock::get()?.unix_timestamp;
        if cfg.annual_emission_last_ts > 0 {
            require!(
                now.saturating_sub(cfg.annual_emission_last_ts) >= SECONDS_PER_YEAR,
                ErrorCode::AnnualEmissionTooSoon
            );
        }

        // Compute mint amount against current_supply (ora_mint.supply).
        let current_supply = ctx.accounts.ora_mint.supply as u128;
        let total_emission_amount: u64 = current_supply
            .checked_mul(emission_bps as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(10_000)
            .ok_or(ErrorCode::Overflow)?
            .try_into()
            .map_err(|_| ErrorCode::Overflow)?;
        require!(total_emission_amount > 0, ErrorCode::InvalidAmount);

        // 80% creator-rewards pool / 20% Ecosystem DAO
        let creator_amount: u64 = (total_emission_amount as u128)
            .checked_mul(ANNUAL_EMISSION_CREATOR_SHARE_BPS as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(10_000)
            .ok_or(ErrorCode::Overflow)?
            .try_into()
            .map_err(|_| ErrorCode::Overflow)?;
        let dao_amount = total_emission_amount
            .checked_sub(creator_amount)
            .ok_or(ErrorCode::Overflow)?;

        let config_bump = cfg.bump;
        let new_cum = cfg
            .annual_emission_total
            .checked_add(total_emission_amount)
            .ok_or(ErrorCode::Overflow)?;

        // Persist BEFORE CPIs (re-entrancy defense).
        {
            let cfg = &mut ctx.accounts.ora_config;
            cfg.annual_emission_year_bitmap |= bit;
            cfg.annual_emission_last_ts = now;
            cfg.annual_emission_total = new_cum;
        }

        let ora_config_seeds: &[&[u8]] = &[b"ora_config".as_ref(), &[config_bump]];
        let signer_seeds = &[ora_config_seeds];

        // 1) 80% to creator rewards destination
        if creator_amount > 0 {
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.rewards_program.to_account_info(),
                RewardsMintForOra {
                    reward_state: ctx.accounts.reward_state.to_account_info(),
                    ora_mint: ctx.accounts.ora_mint.to_account_info(),
                    destination_token_account: ctx
                        .accounts
                        .creator_rewards_destination
                        .to_account_info(),
                    caller_ora_config: ctx.accounts.ora_config.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
                signer_seeds,
            );
            rewards::cpi::mint_for_ora(cpi_ctx, creator_amount, 0u8)?;
        }

        // 2) 20% to Ecosystem DAO destination
        if dao_amount > 0 {
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.rewards_program.to_account_info(),
                RewardsMintForOra {
                    reward_state: ctx.accounts.reward_state.to_account_info(),
                    ora_mint: ctx.accounts.ora_mint.to_account_info(),
                    destination_token_account: ctx.accounts.dao_destination.to_account_info(),
                    caller_ora_config: ctx.accounts.ora_config.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
                signer_seeds,
            );
            rewards::cpi::mint_for_ora(cpi_ctx, dao_amount, 0u8)?;
        }

        msg!(
            "[whitepaper-sync v1.1] Annual emission Y{}: total={} (creator={} / dao={}) bps={} cumulative={}",
            year_index, total_emission_amount, creator_amount, dao_amount, emission_bps, new_cum
        );
        Ok(())
    }

    // ──────────────────────────────────────────────────────────────────────
    // [whitepaper-sync v1.1] §3 Y1 Emergency Mint Authority (Handbook §3)
    //
    // Single Y1 emergency mint up to 1% of total supply. Gated to
    // PROGRAM_ADMIN. Auto-expires at `program_init_ts + SECONDS_PER_YEAR`.
    // One-shot via `emergency_mint_y1_used` flag.
    // ──────────────────────────────────────────────────────────────────────
    pub fn emergency_mint_y1(
        ctx: Context<EmergencyMintY1>,
        amount: u64,
    ) -> Result<()> {
        let cfg = &ctx.accounts.ora_config;
        require!(!cfg.emergency_mint_y1_used, ErrorCode::EmergencyMintAlreadyUsed);
        require!(amount > 0, ErrorCode::InvalidAmount);

        let now = Clock::get()?.unix_timestamp;
        let deadline = cfg
            .program_init_ts
            .checked_add(SECONDS_PER_YEAR)
            .ok_or(ErrorCode::Overflow)?;
        require!(now < deadline, ErrorCode::EmergencyMintWindowExpired);

        // Cap at 1% of current supply.
        let max_amount: u64 = (ctx.accounts.ora_mint.supply as u128)
            .checked_mul(Y1_EMERGENCY_AUTHORITY_BPS as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(10_000)
            .ok_or(ErrorCode::Overflow)?
            .try_into()
            .map_err(|_| ErrorCode::Overflow)?;
        require!(amount <= max_amount, ErrorCode::EmergencyMintCapExceeded);

        let config_bump = cfg.bump;

        // Persist BEFORE CPI.
        {
            let cfg = &mut ctx.accounts.ora_config;
            cfg.emergency_mint_y1_used = true;
            cfg.emergency_mint_y1_amount = amount;
        }

        let ora_config_seeds: &[&[u8]] = &[b"ora_config".as_ref(), &[config_bump]];
        let signer_seeds = &[ora_config_seeds];
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.rewards_program.to_account_info(),
            RewardsMintForOra {
                reward_state: ctx.accounts.reward_state.to_account_info(),
                ora_mint: ctx.accounts.ora_mint.to_account_info(),
                destination_token_account: ctx.accounts.emergency_destination.to_account_info(),
                caller_ora_config: ctx.accounts.ora_config.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
            signer_seeds,
        );
        rewards::cpi::mint_for_ora(cpi_ctx, amount, 0u8)?;

        msg!(
            "[whitepaper-sync v1.1] Y1 emergency mint: {} ORA (cap was {}, init+1yr deadline)",
            amount, max_amount
        );
        Ok(())
    }
}

// === Account Structures ===

#[account]
pub struct OraConfig {
    pub authority: Pubkey,            // 32
    pub mint: Pubkey,                 // 32
    pub total_burned: u64,            // 8
    pub mau_growth_minted: u64,       // 8
    pub current_mau: u64,             // 8
    pub last_mau_checkpoint: u64,     // 8
    pub bump: u8,                     // 1
    // [audit fix E-C-5] one-shot guard for `mint_initial_supply`
    pub initial_supply_minted: bool,  // 1
    // [audit fix E-C-4] cumulative supply ever minted (initial + growth + ad-hoc)
    pub total_ever_minted: u64,       // 8
    // [whitepaper-sync v1.1] §5.5 Performance Pool tracker.
    pub perf_pool_total_approved: u64,   // 8 — cumulative mints approved
    pub perf_pool_last_year_approved: u8,// 1 — last year index approved (0 = none)
    pub perf_pool_year_approved_bitmap: u8, // 1 — bit i = year i+1 approved
    // [whitepaper-sync v1.1] §5.8 Perpetual Annual Emission tracker.
    pub annual_emission_last_ts: i64,    // 8 — last successful annual_emission_mint timestamp
    pub annual_emission_year_bitmap: u16,// 2 — bit i (0..=15) marks year i+1 already emitted
    pub annual_emission_total: u64,      // 8 — cumulative perpetual emission minted (creator + DAO portions)
    // [whitepaper-sync v1.1] §3 Storage / Y1 emergency authority tracker.
    pub program_init_ts: i64,            // 8 — set on initialize_ora; bounds Y1 emergency window
    pub emergency_mint_y1_used: bool,    // 1 — Y1 1% emergency mint one-shot guard
    pub emergency_mint_y1_amount: u64,   // 8 — amount actually minted (for audit)
}


// FIX #19: Events for chain indexing
#[event]
pub struct BurnEvent {
    pub burn_type: BurnType,
    pub amount: u64,
    pub total_burned: u64,
    pub timestamp: i64,
}

#[event]
pub struct RewardEvent {
    pub recipient: Pubkey,
    pub net_reward: u64,
    pub burn_amount: u64,
    pub mau: u64,
    pub timestamp: i64,
}

// [audit fix R5 H-O-1] 4-way breakdown matching content-keys / livestream
// (burn / staking / gas / ops). The legacy `platform_portion` field collapsed
// gas + ops into one; off-chain accounting needs to see them separately to
// match the other programs' indexers.
#[event]
pub struct FeeProcessedEvent {
    pub fee_total: u64,
    pub burn: u64,
    pub staking: u64,
    pub gas: u64,
    pub ops: u64,
}

#[event]
pub struct MauGrowthMintEvent {
    pub old_mau: u64,
    pub new_mau: u64,
    pub minted: u64,
    pub total_growth_minted: u64,
}
// === Enums ===

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum BurnType {
    IncentiveTax,
    TransactionFee,
    /// [whitepaper-sync v1.1] NOTE: TypeBFeature (95% burn) does NOT appear
    /// in Whitepaper v1.1 §5.9 "Dual Burn Mechanism". Retained here pending
    /// review of `programs/type-b/` usage. **Verify usage before next
    /// mainnet review** — if no consumer exercises this variant, mark for
    /// removal in the next sync pass.
    TypeBFeature,
}

// === Context Structures ===

#[derive(Accounts)]
pub struct InitializeOra<'info> {
    // [audit fix E-C-4 / E-C-5] +1 (initial_supply_minted bool) +8 (total_ever_minted u64)
    // [whitepaper-sync v1.1] +8+1+1+8+2+8+8+1+8 = 45 bytes for v1.1 trackers:
    //   perf_pool_total_approved u64 (8)
    //   perf_pool_last_year_approved u8 (1)
    //   perf_pool_year_approved_bitmap u8 (1)
    //   annual_emission_last_ts i64 (8)
    //   annual_emission_year_bitmap u16 (2)
    //   annual_emission_total u64 (8)
    //   program_init_ts i64 (8)
    //   emergency_mint_y1_used bool (1)
    //   emergency_mint_y1_amount u64 (8)
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 1 + 8
            + 8 + 1 + 1 + 8 + 2 + 8 + 8 + 1 + 8,
        seeds = [b"ora_config"],
        bump
    )]
    pub ora_config: Account<'info, OraConfig>,

    // [audit fix C4.M-1 option-C] Mint authority is the rewards program's
    // `reward_state` PDA (NOT `ora_config`). This is what unblocks the
    // deploy deadlock — `rewards::initialize_rewards` requires this exact
    // mint authority, and every subsequent ORA mint flows through
    // `rewards::mint_for_*` CPI wrappers.
    #[account(
        init,
        payer = authority,
        mint::decimals = 9,
        mint::authority = reward_state_pda,
        seeds = [b"ora_mint"],
        bump
    )]
    pub ora_mint: Account<'info, Mint>,

    /// CHECK: This is the rewards program's `reward_state` PDA used only as
    /// the ORA mint authority. We assert its address derives from
    /// [b"reward_state"] under the rewards program id (the rewards crate's
    /// `declare_id!`), so even though no `RewardState` account exists yet
    /// (rewards is initialized in a later transaction), the mint authority
    /// is locked to the eventual PDA.
    #[account(
        seeds = [b"reward_state"],
        bump,
        seeds::program = rewards::ID,
    )]
    pub reward_state_pda: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

// [audit fix C4.M-1 option-C] MintInitialSupply now CPI's into rewards;
// additional accounts: reward_state (PDA in rewards) and rewards_program.
#[derive(Accounts)]
pub struct MintInitialSupply<'info> {
    // [audit fix E-C-5] config is now mutated (initial_supply_minted = true) → `mut`
    #[account(
        mut,
        seeds = [b"ora_config"],
        bump = ora_config.bump,
        has_one = authority
    )]
    pub ora_config: Account<'info, OraConfig>,

    #[account(
        mut,
        seeds = [b"ora_mint"],
        bump
    )]
    pub ora_mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority_token_account: Account<'info, TokenAccount>,

    // [audit fix C4.M-1 option-C] rewards `reward_state` PDA (mint authority)
    #[account(
        seeds = [b"reward_state"],
        bump = reward_state.bump,
        seeds::program = rewards::ID,
    )]
    pub reward_state: Account<'info, RewardState>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    /// CHECK: address pinned to the rewards program id; used as CPI target.
    pub rewards_program: Program<'info, AuraRewards>,
}

// [audit fix C4.M-1 option-C] MintOra now CPIs into rewards::mint_for_ora
#[derive(Accounts)]
pub struct MintOra<'info> {
    // [audit fix E-C-4] mut to persist total_ever_minted bookkeeping
    #[account(
        mut,
        seeds = [b"ora_config"],
        bump = ora_config.bump,
        has_one = authority
    )]
    pub ora_config: Account<'info, OraConfig>,

    #[account(
        mut,
        seeds = [b"ora_mint"],
        bump
    )]
    pub ora_mint: Account<'info, Mint>,

    #[account(mut)]
    pub recipient_token_account: Account<'info, TokenAccount>,

    // [audit fix C4.M-1 option-C] rewards `reward_state` PDA (mint authority)
    #[account(
        seeds = [b"reward_state"],
        bump = reward_state.bump,
        seeds::program = rewards::ID,
    )]
    pub reward_state: Account<'info, RewardState>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub rewards_program: Program<'info, AuraRewards>,
}

#[derive(Accounts)]
pub struct BurnOra<'info> {
    #[account(
        mut,
        seeds = [b"ora_config"],
        bump = ora_config.bump
    )]
    pub ora_config: Account<'info, OraConfig>,

    #[account(
        mut,
        seeds = [b"ora_mint"],
        bump
    )]
    pub ora_mint: Account<'info, Mint>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// [audit fix E-C-1] triple_burn now gated to PROGRAM_ADMIN. Without this, anyone
// who controls a token account can call triple_burn to pollute on-chain burn
// counters with synthetic Type-B / fee-tax categories.
#[derive(Accounts)]
pub struct TripleBurn<'info> {
    #[account(
        mut,
        seeds = [b"ora_config"],
        bump = ora_config.bump,
        has_one = authority @ ErrorCode::Unauthorized
    )]
    pub ora_config: Account<'info, OraConfig>,

    #[account(
        mut,
        seeds = [b"ora_mint"],
        bump
    )]
    pub ora_mint: Account<'info, Mint>,

    // [audit fix E-C-1] enforce ORA mint binding on the burn source
    #[account(
        mut,
        constraint = source_token_account.mint == ora_mint.key() @ ErrorCode::Unauthorized
    )]
    pub source_token_account: Account<'info, TokenAccount>,

    // [audit fix E-C-1] authority MUST equal the stored config authority
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// [audit fix C4.M-1 option-C] DistributeReward now CPIs into rewards.
#[derive(Accounts)]
pub struct DistributeReward<'info> {
    // FIX #20: validate authority
    // [audit fix round2 E2.M-3 / E.M-2] needs `mut` so the cap counter
    // (`total_ever_minted`) and the withhold tracker (`total_burned`) actually
    // persist on-chain. Without `mut` Anchor would drop the post-CPI writeback.
    #[account(
        mut,
        seeds = [b"ora_config"],
        bump = ora_config.bump,
        has_one = authority @ ErrorCode::InvalidAmount
    )]
    pub ora_config: Account<'info, OraConfig>,

    #[account(
        mut,
        seeds = [b"ora_mint"],
        bump
    )]
    pub ora_mint: Account<'info, Mint>,

    #[account(mut)]
    pub recipient_token_account: Account<'info, TokenAccount>,

    // [audit fix C4.M-1 option-C] rewards `reward_state` PDA
    #[account(
        seeds = [b"reward_state"],
        bump = reward_state.bump,
        seeds::program = rewards::ID,
    )]
    pub reward_state: Account<'info, RewardState>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub rewards_program: Program<'info, AuraRewards>,
}

// [audit fix E-C-2] process_fee was completely permissionless and routed
// staking/platform fee portions to caller-chosen accounts. Now: config gated to
// authority, all token accounts mint-bound to ORA, and treasury destinations
// hardcoded to OFFICIAL_STAKING_POOL / OFFICIAL_PLATFORM consts.
#[derive(Accounts)]
pub struct ProcessFee<'info> {
    // [audit fix E-C-2] payer must equal stored config.authority
    #[account(
        mut,
        seeds = [b"ora_config"],
        bump = ora_config.bump,
        constraint = ora_config.authority == payer.key() @ ErrorCode::Unauthorized
    )]
    pub ora_config: Account<'info, OraConfig>,

    #[account(
        mut,
        seeds = [b"ora_mint"],
        bump
    )]
    pub ora_mint: Account<'info, Mint>,

    // [audit fix E-M-4 / E-C-2] fee source must carry the ORA mint
    #[account(
        mut,
        constraint = fee_source_account.mint == ora_mint.key() @ ErrorCode::Unauthorized
    )]
    pub fee_source_account: Account<'info, TokenAccount>,

    // [audit fix E-C-2] hardcoded staking pool destination + mint binding
    #[account(
        mut,
        address = OFFICIAL_STAKING_POOL @ ErrorCode::Unauthorized,
        constraint = staking_pool_account.mint == ora_mint.key() @ ErrorCode::Unauthorized
    )]
    pub staking_pool_account: Account<'info, TokenAccount>,

    // [audit fix E-C-2] hardcoded platform treasury destination + mint binding.
    // Retained as the "ops" residual destination under the new 40/40/10/10
    // split (carries any rounding dust). [audit fix R5 H-O-1]
    #[account(
        mut,
        address = OFFICIAL_PLATFORM @ ErrorCode::Unauthorized,
        constraint = platform_account.mint == ora_mint.key() @ ErrorCode::Unauthorized
    )]
    pub platform_account: Account<'info, TokenAccount>,

    // [audit fix R5 H-O-1] gas-reserve destination, hardcoded + mint-bound.
    // 0.5% of every protocol fee lands here under the WP v1.1 40/40/10/10 split.
    #[account(
        mut,
        address = OFFICIAL_GAS_RESERVE @ ErrorCode::Unauthorized,
        constraint = gas_reserve_account.mint == ora_mint.key() @ ErrorCode::Unauthorized
    )]
    pub gas_reserve_account: Account<'info, TokenAccount>,

    // [audit fix R5 H-O-1] ops-treasury destination, hardcoded + mint-bound.
    // 0.5% of every protocol fee lands here (residual carries rounding dust).
    #[account(
        mut,
        address = OFFICIAL_OPS_TREASURY @ ErrorCode::Unauthorized,
        constraint = ops_treasury_account.mint == ora_mint.key() @ ErrorCode::Unauthorized
    )]
    pub ops_treasury_account: Account<'info, TokenAccount>,

    // [audit fix E-C-2] payer must equal config.authority (admin-gated fee handler).
    // The signer is now `payer` (kept for IDL/ABI back-compat) and is checked via has_one.
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// [audit fix C4.M-1 option-C] MauGrowthMint now CPIs into rewards::mint_for_growth.
#[derive(Accounts)]
pub struct MauGrowthMint<'info> {
    #[account(
        mut,
        seeds = [b"ora_config"],
        bump = ora_config.bump,
        has_one = authority
    )]
    pub ora_config: Account<'info, OraConfig>,

    #[account(
        mut,
        seeds = [b"ora_mint"],
        bump
    )]
    pub ora_mint: Account<'info, Mint>,

    // [audit fix round2 E2.H-2] hardcoded growth-reserve destination + mint binding
    #[account(
        mut,
        address = OFFICIAL_GROWTH_RESERVE @ ErrorCode::Unauthorized,
        constraint = growth_reserve_account.mint == ora_mint.key() @ ErrorCode::Unauthorized,
    )]
    pub growth_reserve_account: Account<'info, TokenAccount>,

    // [audit fix C4.M-1 option-C] rewards `reward_state` PDA (mint authority)
    #[account(
        seeds = [b"reward_state"],
        bump = reward_state.bump,
        seeds::program = rewards::ID,
    )]
    pub reward_state: Account<'info, RewardState>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub rewards_program: Program<'info, AuraRewards>,
}

// [whitepaper-sync v1.1] §5.5 Performance Pool request context.
//
// Gated to PROGRAM_ADMIN. perf_pool_destination is caller-supplied (PROGRAM_ADMIN
// chooses where the tranche lands — typically a treasury multisig ATA), but
// the mint binding is enforced.
#[derive(Accounts)]
pub struct RequestPerformancePool<'info> {
    #[account(
        mut,
        seeds = [b"ora_config"],
        bump = ora_config.bump,
        has_one = authority @ ErrorCode::Unauthorized,
    )]
    pub ora_config: Account<'info, OraConfig>,

    #[account(
        mut,
        seeds = [b"ora_mint"],
        bump
    )]
    pub ora_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = perf_pool_destination.mint == ora_mint.key() @ ErrorCode::Unauthorized,
    )]
    pub perf_pool_destination: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"reward_state"],
        bump = reward_state.bump,
        seeds::program = rewards::ID,
    )]
    pub reward_state: Account<'info, RewardState>,

    // [whitepaper-sync v1.1] Gated to PROGRAM_ADMIN. The const is currently
    // a placeholder (system_program::ID) — ⚠️ DO NOT DEPLOY without replacing.
    #[account(address = PROGRAM_ADMIN @ ErrorCode::Unauthorized)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub rewards_program: Program<'info, AuraRewards>,
}

// [whitepaper-sync v1.1] §5.8 Annual perpetual emission context.
//
// Two destination accounts: 80% to creator_rewards_destination, 20% to
// dao_destination. Both mint-bound to ORA. Gated to PROGRAM_ADMIN.
#[derive(Accounts)]
pub struct AnnualEmissionMint<'info> {
    #[account(
        mut,
        seeds = [b"ora_config"],
        bump = ora_config.bump,
        has_one = authority @ ErrorCode::Unauthorized,
    )]
    pub ora_config: Account<'info, OraConfig>,

    #[account(
        mut,
        seeds = [b"ora_mint"],
        bump
    )]
    pub ora_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = creator_rewards_destination.mint == ora_mint.key() @ ErrorCode::Unauthorized,
    )]
    pub creator_rewards_destination: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = dao_destination.mint == ora_mint.key() @ ErrorCode::Unauthorized,
    )]
    pub dao_destination: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"reward_state"],
        bump = reward_state.bump,
        seeds::program = rewards::ID,
    )]
    pub reward_state: Account<'info, RewardState>,

    // [whitepaper-sync v1.1] Gated to PROGRAM_ADMIN.
    #[account(address = PROGRAM_ADMIN @ ErrorCode::Unauthorized)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub rewards_program: Program<'info, AuraRewards>,
}

// [whitepaper-sync v1.1] §3 Y1 emergency mint context.
#[derive(Accounts)]
pub struct EmergencyMintY1<'info> {
    #[account(
        mut,
        seeds = [b"ora_config"],
        bump = ora_config.bump,
        has_one = authority @ ErrorCode::Unauthorized,
    )]
    pub ora_config: Account<'info, OraConfig>,

    #[account(
        mut,
        seeds = [b"ora_mint"],
        bump
    )]
    pub ora_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = emergency_destination.mint == ora_mint.key() @ ErrorCode::Unauthorized,
    )]
    pub emergency_destination: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"reward_state"],
        bump = reward_state.bump,
        seeds::program = rewards::ID,
    )]
    pub reward_state: Account<'info, RewardState>,

    // [whitepaper-sync v1.1] Gated to PROGRAM_ADMIN.
    #[account(address = PROGRAM_ADMIN @ ErrorCode::Unauthorized)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub rewards_program: Program<'info, AuraRewards>,
}

// === Error Codes ===

// [audit fix E-C-3] removed duplicate `Unauthorized` variant (compilation blocker).
// Added `Overflow`, `AlreadyMinted`, `SupplyCapExceeded` for the new fix paths.
#[error_code]
pub enum ErrorCode {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("MAU has not increased")]
    MauNotIncreased,
    #[msg("Burn floor reached: circulating supply at 30% minimum")]
    BurnFloorReached,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("MAU growth mint cap reached")]
    MauGrowthCapReached,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Initial supply already minted")]
    AlreadyMinted,
    #[msg("Total supply cap exceeded")]
    SupplyCapExceeded,
    // [whitepaper-sync v1.1] §5.5 Performance Pool errors
    #[msg("Performance pool: invalid year index (must be 1..=3)")]
    PerfPoolInvalidYear,
    #[msg("Performance pool: annual budget or cumulative cap exceeded")]
    PerfPoolBudgetExceeded,
    #[msg("Performance pool: this year tranche already approved")]
    PerfPoolYearAlreadyApproved,
    // [whitepaper-sync v1.1] §5.8 Annual emission errors
    #[msg("Annual emission: invalid year index")]
    AnnualEmissionInvalidYear,
    #[msg("Annual emission: this year already emitted")]
    AnnualEmissionYearAlreadyEmitted,
    #[msg("Annual emission: at least 1 year must elapse between emissions")]
    AnnualEmissionTooSoon,
    // [whitepaper-sync v1.1] §3 Y1 emergency mint errors
    #[msg("Y1 emergency mint already used")]
    EmergencyMintAlreadyUsed,
    #[msg("Y1 emergency mint window expired (auto-expires Y2)")]
    EmergencyMintWindowExpired,
    #[msg("Y1 emergency mint amount exceeds 1% of current supply")]
    EmergencyMintCapExceeded,
}
