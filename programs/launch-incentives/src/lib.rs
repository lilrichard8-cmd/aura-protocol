// [whitepaper-sync v1.1] §5.6 launch-incentives
//! AURA Launch Incentives — three sub-programs anchored by Whitepaper §5.6
//! and the Numbers Handbook §4 (the authoritative spec):
//!
//!   • §4.1 Million Plan          (50M ORA — DAU milestone-unlocked rewards)
//!   • §4.2 Creator Onboarding    (50M ORA — 1 external follower = 1 ORA,
//!                                 12-month monthly vesting, activity gated)
//!   • §4.3 Rising Star Plan      (50M ORA — 1 AURA follower = 1 ORA,
//!                                 monthly cap 5K, 12-month duration)
//!
//! Total budget: 150M ORA, enforced by a const sum-check below.
//!
//! All ORA transfers go through program-owned vault PDAs via SPL CPI. The
//! ORA mint, vault PDAs, oracles and PROGRAM_ADMIN are pinned via hardcoded
//! constants (placeholders for now — see `⚠️ DO NOT DEPLOY` block).
//!
//! Track-routing enforcement: a creator with an active Onboarding grant
//! cannot register a Rising Star grant, and vice-versa (§5.6.3 mutual
//! exclusion).

// [whitepaper-sync v1.1] §5.6 launch-incentives — prelude / imports
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

// [whitepaper-sync v1.1] §5.6 launch-incentives — program id
declare_id!("GiqNJ5BbaebqvDPGep4QeK6JLNagk5zzW68pykb9eQEf");

// ──────────────────────────────────────────────────────────────────────
// [whitepaper-sync v1.1] §5.6 launch-incentives — hardcoded admin / oracles
// ⚠️ DO NOT DEPLOY — every Pubkey below is a system_program::ID placeholder
// and MUST be replaced with the real multisig / oracle / vault pubkeys
// before mainnet deploy.
// ──────────────────────────────────────────────────────────────────────

/// Program admin. Allowed to call all `initialize_*` and `register_*`
/// instructions (one-time setup) plus `trigger_milestone` for the Million
/// Plan. [whitepaper-sync v1.1] §5.6 launch-incentives
pub const PROGRAM_ADMIN: Pubkey = anchor_lang::solana_program::system_program::ID;

/// Oracle that signs OAuth-verified external follower counts for the
/// Creator Onboarding Program (§4.2). [whitepaper-sync v1.1] §5.6
/// launch-incentives
pub const ONBOARDING_OAUTH_ORACLE: Pubkey =
    anchor_lang::solana_program::system_program::ID;

/// Oracle that signs new-follower counts for the Rising Star Plan (§4.3).
/// [whitepaper-sync v1.1] §5.6 launch-incentives
pub const RISING_STAR_FOLLOWER_ORACLE: Pubkey =
    anchor_lang::solana_program::system_program::ID;

/// Oracle that signs DAU readings for the Million Plan (§4.1). May be
/// replaced post-Phase-1 with an on-chain DAU pipeline; until then admin
/// also satisfies this check via the `=` constraint in `trigger_milestone`.
/// [whitepaper-sync v1.1] §5.6 launch-incentives
pub const DAU_ORACLE: Pubkey = anchor_lang::solana_program::system_program::ID;

/// Canonical ORA SPL mint. Every vault and grant binds to this mint so
/// fake mints cannot be substituted at runtime.
/// [whitepaper-sync v1.1] §5.6 launch-incentives
pub const ORA_MINT: Pubkey = anchor_lang::solana_program::system_program::ID;

/// Million Plan vault token account (program-owned PDA at mainnet).
/// [whitepaper-sync v1.1] §5.6 launch-incentives
pub const MILLION_PLAN_VAULT: Pubkey =
    anchor_lang::solana_program::system_program::ID;

/// Creator Onboarding vault token account.
/// [whitepaper-sync v1.1] §5.6 launch-incentives
pub const ONBOARDING_VAULT: Pubkey =
    anchor_lang::solana_program::system_program::ID;

/// Rising Star Plan vault token account.
/// [whitepaper-sync v1.1] §5.6 launch-incentives
pub const RISING_STAR_VAULT: Pubkey =
    anchor_lang::solana_program::system_program::ID;

// ──────────────────────────────────────────────────────────────────────
// [whitepaper-sync v1.1] §5.6 launch-incentives — sub-pool budgets
// (Numbers Handbook §4; sum-check below)
// ──────────────────────────────────────────────────────────────────────

/// 50M ORA (9 decimals) — Handbook §4.1. [whitepaper-sync v1.1] §5.6
/// launch-incentives
pub const MILLION_PLAN_POOL: u64 = 50_000_000 * 1_000_000_000;
/// 50M ORA (9 decimals) — Handbook §4.2. [whitepaper-sync v1.1] §5.6
/// launch-incentives
pub const ONBOARDING_POOL: u64 = 50_000_000 * 1_000_000_000;
/// 50M ORA (9 decimals) — Handbook §4.3. [whitepaper-sync v1.1] §5.6
/// launch-incentives
pub const RISING_STAR_POOL: u64 = 50_000_000 * 1_000_000_000;
/// Total 150M ORA (9 decimals). [whitepaper-sync v1.1] §5.6 launch-incentives
pub const LAUNCH_INCENTIVE_TOTAL: u64 = 150_000_000 * 1_000_000_000;

// [whitepaper-sync v1.1] §5.6 launch-incentives — compile-time sum-check.
// Guarantees we cannot drift the three sub-pool budgets out of sync with
// the 150M ORA Launch Incentives allocation (Whitepaper §5.6 / Handbook §4).
const _: () = assert!(
    MILLION_PLAN_POOL + ONBOARDING_POOL + RISING_STAR_POOL == LAUNCH_INCENTIVE_TOTAL,
    "Launch incentive sub-pools must sum to 150M ORA"
);

// ──────────────────────────────────────────────────────────────────────
// [whitepaper-sync v1.1] §5.6 launch-incentives — Million Plan constants
// (Handbook §4.1)
// ──────────────────────────────────────────────────────────────────────

/// Total number of DAU milestones (100K, 250K, 500K, 1M).
/// [whitepaper-sync v1.1] §5.6 launch-incentives
pub const MILESTONE_COUNT: u8 = 4;

/// DAU thresholds, in DAU units (not lamports). [whitepaper-sync v1.1]
/// §5.6 launch-incentives — Handbook §4.1 table.
pub const MILESTONE_DAU_THRESHOLDS: [u64; 4] = [
    100_000,
    250_000,
    500_000,
    1_000_000,
];

/// Per-milestone release sizes (ORA base units). 5M / 5M / 10M / 30M = 50M.
/// [whitepaper-sync v1.1] §5.6 launch-incentives — Handbook §4.1 table.
pub const MILESTONE_RELEASES: [u64; 4] = [
    5_000_000 * 1_000_000_000,
    5_000_000 * 1_000_000_000,
    10_000_000 * 1_000_000_000,
    30_000_000 * 1_000_000_000,
];

// [whitepaper-sync v1.1] §5.6 launch-incentives — Million Plan sum-check:
// 4 milestone releases must sum to the 50M sub-pool budget.
const _: () = assert!(
    MILESTONE_RELEASES[0]
        + MILESTONE_RELEASES[1]
        + MILESTONE_RELEASES[2]
        + MILESTONE_RELEASES[3]
        == MILLION_PLAN_POOL,
    "Million Plan milestone releases must sum to 50M ORA"
);

/// Per-user per-milestone claim cap: 10,000 ORA. Handbook §4.1.
/// [whitepaper-sync v1.1] §5.6 launch-incentives
pub const MILESTONE_PER_USER_CAP: u64 = 10_000 * 1_000_000_000;

// ──────────────────────────────────────────────────────────────────────
// [whitepaper-sync v1.1] §5.6 launch-incentives — Onboarding constants
// (Handbook §4.2)
// ──────────────────────────────────────────────────────────────────────

/// External-followers eligibility floor: 10,000. Handbook §4.2.
/// [whitepaper-sync v1.1] §5.6 launch-incentives
pub const ONBOARDING_MIN_EXTERNAL_FOLLOWERS: u64 = 10_000;

/// 1 external follower = 1 ORA (in base units). Handbook §4.2.
/// [whitepaper-sync v1.1] §5.6 launch-incentives
pub const ONBOARDING_RATE_PER_FOLLOWER: u64 = 1_000_000_000;

/// Per-creator hard cap on total Onboarding allocation: 1,000,000 ORA.
/// Handbook §4.2. [whitepaper-sync v1.1] §5.6 launch-incentives
pub const ONBOARDING_PER_CREATOR_CAP: u64 = 1_000_000 * 1_000_000_000;

/// Number of unlock months (12). Handbook §4.2.
/// [whitepaper-sync v1.1] §5.6 launch-incentives
pub const ONBOARDING_UNLOCK_MONTHS: u8 = 12;

/// One unlock cadence (30 days, in seconds). [whitepaper-sync v1.1] §5.6
/// launch-incentives
pub const ONBOARDING_MONTH_SECS: i64 = 30 * 24 * 60 * 60;

/// Forfeit threshold: 3 consecutive months of failed activity gating →
/// reclaim remaining ORA to the Million Plan pool. Handbook §4.2.
/// [whitepaper-sync v1.1] §5.6 launch-incentives
pub const ONBOARDING_MAX_CONSECUTIVE_MISSES: u8 = 3;

// ──────────────────────────────────────────────────────────────────────
// [whitepaper-sync v1.1] §5.6 launch-incentives — Rising Star constants
// (Handbook §4.3)
// ──────────────────────────────────────────────────────────────────────

/// 1 new AURA follower = 1 ORA (in base units). Handbook §4.3.
/// [whitepaper-sync v1.1] §5.6 launch-incentives
pub const RISING_STAR_RATE_PER_FOLLOWER: u64 = 1_000_000_000;

/// Per-creator monthly cap: 5,000 ORA. Handbook §4.3.
/// [whitepaper-sync v1.1] §5.6 launch-incentives
pub const RISING_STAR_MONTHLY_CAP: u64 = 5_000 * 1_000_000_000;

/// Program duration: 12 months. Handbook §4.3.
/// [whitepaper-sync v1.1] §5.6 launch-incentives
pub const RISING_STAR_DURATION_MONTHS: u8 = 12;

// ──────────────────────────────────────────────────────────────────────
// [whitepaper-sync v1.1] §5.6 launch-incentives — program
// ──────────────────────────────────────────────────────────────────────

#[program]
pub mod aura_launch_incentives {
    use super::*;

    // ────────────────────────────────────────────────────────────────
    // [whitepaper-sync v1.1] §5.6 launch-incentives — global init
    // ────────────────────────────────────────────────────────────────

    /// Initialise the global Launch Incentives state. One-time, admin-only.
    /// Pre-allocates the four MilestoneState slots (does NOT trigger them).
    /// [whitepaper-sync v1.1] §5.6 launch-incentives
    pub fn initialize_launch_incentives(
        ctx: Context<InitializeLaunchIncentives>,
    ) -> Result<()> {
        // [whitepaper-sync v1.1] §5.6 launch-incentives
        let state = &mut ctx.accounts.state;
        state.admin = ctx.accounts.admin.key();
        state.ora_mint = ctx.accounts.ora_mint.key();
        state.million_plan_remaining = MILLION_PLAN_POOL;
        state.onboarding_remaining = ONBOARDING_POOL;
        state.rising_star_remaining = RISING_STAR_POOL;
        state.million_plan_forfeit_topup = 0;
        state.bump = ctx.bumps.state;
        msg!(
            "LaunchIncentives initialized: MP={} OB={} RS={} total={}",
            MILLION_PLAN_POOL,
            ONBOARDING_POOL,
            RISING_STAR_POOL,
            LAUNCH_INCENTIVE_TOTAL
        );
        Ok(())
    }

    // ────────────────────────────────────────────────────────────────
    // [whitepaper-sync v1.1] §5.6 launch-incentives — Million Plan
    // ────────────────────────────────────────────────────────────────

    /// Admin pre-creates each MilestoneState slot (one per milestone_id 0..3).
    /// Untriggered until `trigger_milestone` is called with sufficient DAU.
    /// [whitepaper-sync v1.1] §5.6 launch-incentives
    pub fn initialize_million_plan_state(
        ctx: Context<InitializeMilestoneState>,
        milestone_id: u8,
    ) -> Result<()> {
        // [whitepaper-sync v1.1] §5.6 launch-incentives
        require!(
            milestone_id < MILESTONE_COUNT,
            ErrorCode::InvalidMilestoneId
        );
        let milestone = &mut ctx.accounts.milestone;
        milestone.milestone_id = milestone_id;
        milestone.dau_threshold = MILESTONE_DAU_THRESHOLDS[milestone_id as usize];
        milestone.pool_size = MILESTONE_RELEASES[milestone_id as usize];
        milestone.total_contribution_weight = 0;
        milestone.triggered = false;
        milestone.triggered_at = 0;
        milestone.fully_distributed = false;
        // [audit fix R5 C-LI-1 / C-LI-2]
        milestone.claimed_amount = 0;
        milestone.final_total_weight = 0;
        milestone.finalized = false;
        milestone.bump = ctx.bumps.milestone;
        msg!(
            "Million Plan milestone {} initialised (threshold {} DAU, pool {})",
            milestone_id,
            milestone.dau_threshold,
            milestone.pool_size
        );
        Ok(())
    }

    /// Trigger a milestone once DAU oracle reports `dau_count` ≥ threshold.
    /// Phase-1 admin-supplied; Phase-2 a DAU oracle signature replaces the
    /// admin check. Idempotent (cannot retrigger).
    /// [whitepaper-sync v1.1] §5.6 launch-incentives
    pub fn trigger_milestone(
        ctx: Context<TriggerMilestone>,
        dau_count: u64,
    ) -> Result<()> {
        // [whitepaper-sync v1.1] §5.6 launch-incentives
        let milestone = &mut ctx.accounts.milestone;
        require!(!milestone.triggered, ErrorCode::MilestoneAlreadyTriggered);
        require!(
            dau_count >= milestone.dau_threshold,
            ErrorCode::DauBelowThreshold
        );
        // [audit fix R5 M-LI-2] enforce monotonic milestone progression:
        // milestone N can only be triggered if milestones 0..N-1 are
        // triggered. Previously this check was commented as a TODO but never
        // implemented — a 1M-DAU report could jump straight to milestone 3
        // (30M pool) without ever passing through 0/1/2 (5M+5M+10M).
        if milestone.milestone_id > 0 {
            let prior = &ctx.accounts.prior_milestone;
            require!(
                prior.milestone_id == milestone.milestone_id - 1,
                ErrorCode::MilestoneOutOfOrder
            );
            require!(
                prior.triggered,
                ErrorCode::MilestonePrerequisiteNotTriggered
            );
        }
        milestone.triggered = true;
        milestone.triggered_at = Clock::get()?.unix_timestamp;
        msg!(
            "Million Plan milestone {} triggered at DAU={}",
            milestone.milestone_id,
            dau_count
        );
        Ok(())
    }

    /// [audit fix R5 C-LI-2] Once the off-chain DAU/contribution pipeline
    /// has aggregated the final sum of `user_contribution` across every
    /// eligible wallet for this milestone, the admin / DAU oracle calls
    /// this to snapshot the denominator into `final_total_weight`. After
    /// that, `claim_million_reward` uses this fixed total (not the live
    /// streaming counter), so all claimers get a correct pro-rata share:
    /// `claim = pool_size * uc / final_total_weight` (still capped at 10K
    /// ORA per user). Phase-2 will replace the admin signature with an
    /// oracle signature; structurally this is the same closed-window
    /// settlement model the WP describes.
    pub fn finalize_milestone_snapshot(
        ctx: Context<FinalizeMilestoneSnapshot>,
        milestone_id: u8,
        final_total_weight: u64,
    ) -> Result<()> {
        require!(
            milestone_id < MILESTONE_COUNT,
            ErrorCode::InvalidMilestoneId
        );
        require!(final_total_weight > 0, ErrorCode::InvalidAmount);
        let milestone = &mut ctx.accounts.milestone;
        require!(milestone.milestone_id == milestone_id, ErrorCode::InvalidMilestoneId);
        require!(milestone.triggered, ErrorCode::MilestoneNotTriggered);
        require!(!milestone.finalized, ErrorCode::MilestoneAlreadyFinalized);
        milestone.final_total_weight = final_total_weight;
        milestone.finalized = true;
        msg!(
            "Million Plan milestone {} finalized: total_weight={}",
            milestone_id,
            final_total_weight
        );
        Ok(())
    }

    /// User claims their pro-rata Million Plan reward for a triggered
    /// milestone. `user_contribution` is the caller's content + curation +
    /// interactions weight; Phase-1 accepts caller-supplied (admin signs the
    /// tx as oracle), Phase-2 will switch to an oracle-signed proof.
    /// [whitepaper-sync v1.1] §5.6 launch-incentives
    pub fn claim_million_reward(
        ctx: Context<ClaimMillionReward>,
        milestone_id: u8,
        user_contribution: u64,
    ) -> Result<()> {
        // [whitepaper-sync v1.1] §5.6 launch-incentives
        require!(
            milestone_id < MILESTONE_COUNT,
            ErrorCode::InvalidMilestoneId
        );
        let milestone = &mut ctx.accounts.milestone;
        require!(milestone.triggered, ErrorCode::MilestoneNotTriggered);
        require!(!milestone.fully_distributed, ErrorCode::MilestoneFullyDistributed);
        require!(user_contribution > 0, ErrorCode::InvalidAmount);
        // [audit fix R5 C-LI-2] require the milestone to be finalized
        // (closed-window snapshot) before any claim can be paid out. This
        // replaces the broken streaming pro-rata model with a true
        // closed-window settlement: every claimer divides by the SAME
        // `final_total_weight`, so shares actually add up to the pool.
        require!(milestone.finalized, ErrorCode::MilestoneNotFinalized);

        // [audit fix R5 C-LI-2] closed-window pro-rata: claim = pool * uc /
        // final_total_weight. user_contribution must not exceed
        // final_total_weight (it was part of the snapshot) — reject
        // pathological inputs that would otherwise overflow the cap math.
        require!(
            user_contribution <= milestone.final_total_weight,
            ErrorCode::ContributionExceedsSnapshot
        );
        let mut claim_amount: u64 = (milestone.pool_size as u128)
            .checked_mul(user_contribution as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(milestone.final_total_weight as u128)
            .ok_or(ErrorCode::Overflow)? as u64;
        if claim_amount > MILESTONE_PER_USER_CAP {
            claim_amount = MILESTONE_PER_USER_CAP;
        }
        require!(claim_amount > 0, ErrorCode::NothingToClaim);

        // [audit fix R5 C-LI-1] enforce the per-milestone pool ceiling.
        // Previously the handler only checked `state.million_plan_remaining`
        // (the 50M global pool), so ~5K users claiming the 10K cap could
        // drain the entire Million Plan against a single milestone. Now
        // each milestone has its own `claimed_amount` counter, and we
        // refuse claims that would exceed `pool_size`.
        let new_claimed = milestone
            .claimed_amount
            .checked_add(claim_amount)
            .ok_or(ErrorCode::Overflow)?;
        require!(
            new_claimed <= milestone.pool_size,
            ErrorCode::MilestoneFullyDistributed
        );

        // Mark this user's claim record. (One claim per user/milestone is
        // enforced by `init` on the MilestoneClaim PDA.)
        // [whitepaper-sync v1.1] §5.6 launch-incentives
        let claim = &mut ctx.accounts.claim;
        claim.user = ctx.accounts.user.key();
        claim.milestone_id = milestone_id;
        claim.contribution = user_contribution;
        claim.claim_amount = claim_amount;
        claim.claimed_at = Clock::get()?.unix_timestamp;
        claim.bump = ctx.bumps.claim;
        // [audit fix R5 C-LI-1] persist per-milestone running total and
        // close the milestone when fully consumed (allow <1-ORA dust
        // remainder to round down; the residual is unclaimable but bounded).
        milestone.claimed_amount = new_claimed;
        if milestone.pool_size.saturating_sub(milestone.claimed_amount)
            < 1_000_000_000
        {
            milestone.fully_distributed = true;
        }
        // Streaming counter kept for off-chain analytics only — no longer
        // used for payout math. [audit fix R5 C-LI-2]
        milestone.total_contribution_weight = milestone
            .total_contribution_weight
            .checked_add(user_contribution)
            .ok_or(ErrorCode::Overflow)?;

        // SPL CPI: transfer from program vault to user ATA. The vault token
        // account is owned by the program state PDA so signing requires the
        // state's PDA seeds.
        // [whitepaper-sync v1.1] §5.6 launch-incentives
        let state_key = ctx.accounts.state.key();
        let _ = state_key;
        let state_bump = ctx.accounts.state.bump;
        let seeds: &[&[u8]] = &[b"launch_incentives", &[state_bump]];
        let signer = &[seeds];
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.million_plan_vault.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.state.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi_ctx, claim_amount)?;

        let state = &mut ctx.accounts.state;
        state.million_plan_remaining = state
            .million_plan_remaining
            .checked_sub(claim_amount)
            .ok_or(ErrorCode::InsufficientPoolBalance)?;
        msg!(
            "Million Plan claim: user={} milestone={} amount={}",
            ctx.accounts.user.key(),
            milestone_id,
            claim_amount
        );
        Ok(())
    }

    // ────────────────────────────────────────────────────────────────
    // [whitepaper-sync v1.1] §5.6 launch-incentives — Creator Onboarding
    // ────────────────────────────────────────────────────────────────

    /// Register a creator into the Onboarding program. Oracle-gated:
    /// `verified_external_followers` must be signed off by
    /// `ONBOARDING_OAUTH_ORACLE`. Mutual-exclusion with Rising Star enforced
    /// by `init` on OnboardingGrant PDA (Anchor will fail re-init) plus a
    /// runtime `must_be_inactive` check against RisingStarGrant.
    /// [whitepaper-sync v1.1] §5.6 launch-incentives
    pub fn register_onboarding(
        ctx: Context<RegisterOnboarding>,
        verified_external_followers: u64,
    ) -> Result<()> {
        // [whitepaper-sync v1.1] §5.6 launch-incentives
        require!(
            verified_external_followers >= ONBOARDING_MIN_EXTERNAL_FOLLOWERS,
            ErrorCode::ExternalFollowersTooLow
        );
        // [audit fix R5 M-LI-1] strict track-routing check. The Rising Star
        // grant account is REQUIRED (not optional) and is manually parsed:
        //   - owner must be this program
        //   - the embedded discriminator must match the `RisingStarGrant`
        //     anchor discriminator (so admin can't pass a different
        //     program-owned PDA to bypass the check)
        //   - we read the `status` byte and only refuse on `Active`. A
        //     Forfeit/Completed/Suspended Rising Star grant can coexist
        //     with a fresh Onboarding registration.
        //
        // For the bootstrap case (creator has never been registered into
        // Rising Star, so no PDA exists yet) the SDK is expected to pass
        // the un-initialized PDA address; we accept owner=system_program
        // OR empty data as "no prior grant".
        check_no_active_rising_star(&ctx.accounts.rising_star_grant, ctx.program_id)?;

        // Compute grant size: 1 follower = 1 ORA, capped at
        // ONBOARDING_PER_CREATOR_CAP. [whitepaper-sync v1.1] §5.6
        // launch-incentives
        let raw = (verified_external_followers as u128)
            .checked_mul(ONBOARDING_RATE_PER_FOLLOWER as u128)
            .ok_or(ErrorCode::Overflow)?;
        let capped: u64 = if raw > ONBOARDING_PER_CREATOR_CAP as u128 {
            ONBOARDING_PER_CREATOR_CAP
        } else {
            raw as u64
        };

        let state = &mut ctx.accounts.state;
        require!(
            state.onboarding_remaining >= capped,
            ErrorCode::InsufficientPoolBalance
        );
        state.onboarding_remaining = state
            .onboarding_remaining
            .checked_sub(capped)
            .ok_or(ErrorCode::Overflow)?;

        let grant = &mut ctx.accounts.grant;
        grant.creator = ctx.accounts.creator.key();
        grant.external_followers = verified_external_followers;
        grant.total_amount = capped;
        grant.unlocked_amount = 0;
        grant.remaining_amount = capped;
        grant.consecutive_misses = 0;
        grant.start_at = Clock::get()?.unix_timestamp;
        grant.last_unlock_at = 0;
        grant.status = OnboardingStatus::Active;
        grant.bump = ctx.bumps.grant;

        msg!(
            "Onboarding registered: creator={} followers={} total={}",
            ctx.accounts.creator.key(),
            verified_external_followers,
            capped
        );
        Ok(())
    }

    /// Creator self-claims this month's unlock. Activity proof is signed
    /// off-chain by the OAuth oracle and submitted as a URI. We accept
    /// `activity_passed: bool` here (oracle signs the whole tx); a Phase-2
    /// upgrade will move this to an on-chain proof account.
    /// [whitepaper-sync v1.1] §5.6 launch-incentives
    pub fn claim_monthly_unlock(
        ctx: Context<ClaimMonthlyUnlock>,
        month_index: u8,
        activity_passed: bool,
        _activity_proof_uri: String,
    ) -> Result<()> {
        // [audit fix R5 H-LI-4] per-month idempotency. The handler used to
        // compute `month_index_raw` and throw it away (`let _ =
        // months_claimed;`), with NOTHING preventing 12 calls in the same
        // block draining the full 12-month vest. We now:
        //   1. Require the caller to specify which `month_index` they're
        //      claiming (0..ONBOARDING_UNLOCK_MONTHS-1).
        //   2. Allocate an `OnboardingMonthlyClaim` PDA seeded by
        //      `[b"ob_month", creator, month_index]` with `init` — a
        //      second call for the same (creator, month_index) reverts.
        //   3. Enforce `elapsed >= month_index * ONBOARDING_MONTH_SECS` so
        //      future months can't be pre-claimed.
        require!(
            month_index < ONBOARDING_UNLOCK_MONTHS,
            ErrorCode::MonthIndexOutOfRange
        );
        let grant = &mut ctx.accounts.grant;
        require!(
            grant.status == OnboardingStatus::Active,
            ErrorCode::GrantNotActive
        );
        let now = Clock::get()?.unix_timestamp;

        let elapsed = now
            .checked_sub(grant.start_at)
            .ok_or(ErrorCode::Overflow)?;
        require!(elapsed >= 0, ErrorCode::TooEarly);
        // [audit fix R5 H-LI-4] vesting cliff: month N can only be claimed
        // once N months have elapsed since start_at.
        let cliff = (month_index as i64)
            .checked_mul(ONBOARDING_MONTH_SECS)
            .ok_or(ErrorCode::Overflow)?;
        require!(elapsed >= cliff, ErrorCode::TooEarly);

        // Per-month tranche size (integer division of total over 12 months).
        // [whitepaper-sync v1.1] §5.6 launch-incentives
        let tranche = grant
            .total_amount
            .checked_div(ONBOARDING_UNLOCK_MONTHS as u64)
            .unwrap_or(0);
        require!(tranche > 0, ErrorCode::InvalidAmount);
        // Cap by remaining (last month gets any rounding dust).
        let amount = if tranche > grant.remaining_amount {
            grant.remaining_amount
        } else {
            tranche
        };

        // [audit fix R5 H-LI-4] record this monthly claim atomically. We
        // mark it whether or not activity passed — a failed activity check
        // still consumes the (month_index, creator) slot so the creator
        // can't retry the same month next block with a different oracle
        // signature.
        let monthly = &mut ctx.accounts.monthly_claim;
        monthly.creator = grant.creator;
        monthly.month_index = month_index;
        monthly.claimed_at = now;
        monthly.activity_passed = activity_passed;
        monthly.bump = ctx.bumps.monthly_claim;

        if !activity_passed {
            // [whitepaper-sync v1.1] §5.6 launch-incentives — paused & deferred
            grant.consecutive_misses = grant
                .consecutive_misses
                .checked_add(1)
                .ok_or(ErrorCode::Overflow)?;
            grant.last_unlock_at = now;
            monthly.amount_unlocked = 0;
            if grant.consecutive_misses >= ONBOARDING_MAX_CONSECUTIVE_MISSES {
                // Don't auto-forfeit here — `forfeit_pending_to_million_plan`
                // is a public entrypoint anyone can call once misses ≥ 3
                // (this keeps the gas path cleaner for self-claim).
                msg!(
                    "Onboarding miss limit reached: creator={} misses={}",
                    grant.creator,
                    grant.consecutive_misses
                );
            } else {
                msg!(
                    "Onboarding month deferred: creator={} misses={}",
                    grant.creator,
                    grant.consecutive_misses
                );
            }
            return Ok(());
        }

        // Activity met → reset miss counter, transfer tranche.
        // [whitepaper-sync v1.1] §5.6 launch-incentives
        grant.consecutive_misses = 0;
        grant.last_unlock_at = now;
        grant.unlocked_amount = grant
            .unlocked_amount
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        grant.remaining_amount = grant
            .remaining_amount
            .checked_sub(amount)
            .ok_or(ErrorCode::Overflow)?;
        monthly.amount_unlocked = amount; // [audit fix R5 H-LI-4]
        if grant.remaining_amount == 0 {
            grant.status = OnboardingStatus::Completed;
        }

        // SPL CPI: state PDA signs the transfer from the onboarding vault.
        // [whitepaper-sync v1.1] §5.6 launch-incentives
        let state_bump = ctx.accounts.state.bump;
        let seeds: &[&[u8]] = &[b"launch_incentives", &[state_bump]];
        let signer = &[seeds];
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.onboarding_vault.to_account_info(),
                to: ctx.accounts.creator_token_account.to_account_info(),
                authority: ctx.accounts.state.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi_ctx, amount)?;

        msg!(
            "Onboarding unlock: creator={} amount={} remaining={}",
            grant.creator,
            amount,
            grant.remaining_amount
        );
        Ok(())
    }

    /// Public entrypoint — once a grant has hit
    /// `ONBOARDING_MAX_CONSECUTIVE_MISSES` consecutive missed months,
    /// anyone may call this to forfeit all remaining ORA back to the Million
    /// Plan pool. Handbook §4.2. [whitepaper-sync v1.1] §5.6 launch-incentives
    pub fn forfeit_pending_to_million_plan(
        ctx: Context<ForfeitOnboarding>,
    ) -> Result<()> {
        // [whitepaper-sync v1.1] §5.6 launch-incentives
        let grant = &mut ctx.accounts.grant;
        require!(
            grant.status == OnboardingStatus::Active,
            ErrorCode::GrantNotActive
        );
        require!(
            grant.consecutive_misses >= ONBOARDING_MAX_CONSECUTIVE_MISSES,
            ErrorCode::ForfeitThresholdNotMet
        );
        let amount = grant.remaining_amount;
        require!(amount > 0, ErrorCode::NothingToClaim);

        // SPL CPI: state PDA signs the forfeit transfer onboarding→million plan.
        // [whitepaper-sync v1.1] §5.6 launch-incentives
        let state_bump = ctx.accounts.state.bump;
        let seeds: &[&[u8]] = &[b"launch_incentives", &[state_bump]];
        let signer = &[seeds];
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.onboarding_vault.to_account_info(),
                to: ctx.accounts.million_plan_vault.to_account_info(),
                authority: ctx.accounts.state.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi_ctx, amount)?;

        grant.remaining_amount = 0;
        grant.status = OnboardingStatus::Forfeit;

        // Bookkeeping on the global state: subtract from onboarding bucket,
        // and credit a "topup" counter on the million plan side (the actual
        // tokens already live in the million plan vault now).
        // [whitepaper-sync v1.1] §5.6 launch-incentives
        let state = &mut ctx.accounts.state;
        // (onboarding_remaining already reduced at register-time; no change
        // here. We track the forfeit topup separately for indexers.)
        state.million_plan_forfeit_topup = state
            .million_plan_forfeit_topup
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;
        state.million_plan_remaining = state
            .million_plan_remaining
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        msg!(
            "Onboarding forfeit: creator={} reclaimed={}",
            grant.creator,
            amount
        );
        Ok(())
    }

    // ────────────────────────────────────────────────────────────────
    // [whitepaper-sync v1.1] §5.6 launch-incentives — Rising Star
    // ────────────────────────────────────────────────────────────────

    /// Register a creator into Rising Star. Admin-gated (Phase 1) to allow
    /// off-chain ML/screening before slot allocation. Mutual-exclusion with
    /// Onboarding enforced same way as in `register_onboarding`.
    /// [whitepaper-sync v1.1] §5.6 launch-incentives
    pub fn register_rising_star(ctx: Context<RegisterRisingStar>) -> Result<()> {
        // [audit fix R5 M-LI-1] strict track-routing check (see
        // `register_onboarding` for full rationale). The onboarding grant
        // account is REQUIRED and parsed for the typed status field.
        check_no_active_onboarding(&ctx.accounts.onboarding_grant, ctx.program_id)?;

        let grant = &mut ctx.accounts.grant;
        grant.creator = ctx.accounts.creator.key();
        grant.start_at = Clock::get()?.unix_timestamp;
        grant.months_completed = 0;
        grant.total_claimed = 0;
        grant.status = RisingStarStatus::Active;
        grant.bump = ctx.bumps.grant;
        msg!("RisingStar registered: creator={}", grant.creator);
        Ok(())
    }

    /// Oracle records a creator's verified new-AURA-followers for a given
    /// month. Caps applied here (5,000/month). Idempotent per (creator,
    /// month_index): re-recording fails because RisingStarMonth is
    /// `init`-only via Anchor.
    /// [whitepaper-sync v1.1] §5.6 launch-incentives
    pub fn record_monthly_followers(
        ctx: Context<RecordMonthlyFollowers>,
        month_index: u8,
        new_followers: u64,
    ) -> Result<()> {
        // [whitepaper-sync v1.1] §5.6 launch-incentives
        require!(
            month_index < RISING_STAR_DURATION_MONTHS,
            ErrorCode::MonthIndexOutOfRange
        );
        require!(
            ctx.accounts.grant.status == RisingStarStatus::Active,
            ErrorCode::GrantNotActive
        );
        // [audit fix R5 M-LI-3] bind `month_index` to elapsed wall-clock time.
        // Previously the oracle could front-load all 12 months at registration
        // (e.g. record_monthly_followers(0..11) in a single tx), letting the
        // creator immediately drain their full 60K cap on day 1. Now we
        // require N months to have elapsed since `grant.start_at` before
        // month N can be recorded.
        let now = Clock::get()?.unix_timestamp;
        let elapsed = now
            .checked_sub(ctx.accounts.grant.start_at)
            .ok_or(ErrorCode::Overflow)?;
        let cliff = (month_index as i64)
            .checked_mul(ONBOARDING_MONTH_SECS) // re-use 30-day buckets
            .ok_or(ErrorCode::Overflow)?;
        require!(elapsed >= cliff, ErrorCode::TooEarly);

        // 1 follower = 1 ORA, capped at 5,000 ORA / month.
        // [whitepaper-sync v1.1] §5.6 launch-incentives
        let raw = (new_followers as u128)
            .checked_mul(RISING_STAR_RATE_PER_FOLLOWER as u128)
            .ok_or(ErrorCode::Overflow)?;
        let amount: u64 = if raw > RISING_STAR_MONTHLY_CAP as u128 {
            RISING_STAR_MONTHLY_CAP
        } else {
            raw as u64
        };

        let month = &mut ctx.accounts.month;
        month.creator = ctx.accounts.grant.creator;
        month.month_index = month_index;
        month.new_followers = new_followers;
        month.claim_amount = amount;
        month.claimed = false;
        month.bump = ctx.bumps.month;
        msg!(
            "RisingStar month recorded: creator={} month={} followers={} amount={}",
            month.creator,
            month_index,
            new_followers,
            amount
        );
        Ok(())
    }

    /// Creator claims their recorded monthly amount.
    /// [whitepaper-sync v1.1] §5.6 launch-incentives
    pub fn claim_rising_star_monthly(
        ctx: Context<ClaimRisingStarMonthly>,
        month_index: u8,
    ) -> Result<()> {
        // [whitepaper-sync v1.1] §5.6 launch-incentives
        require!(
            month_index < RISING_STAR_DURATION_MONTHS,
            ErrorCode::MonthIndexOutOfRange
        );
        let month = &mut ctx.accounts.month;
        require!(month.month_index == month_index, ErrorCode::MonthIndexMismatch);
        require!(!month.claimed, ErrorCode::AlreadyClaimed);
        require!(month.claim_amount > 0, ErrorCode::NothingToClaim);

        let grant = &mut ctx.accounts.grant;
        require!(
            grant.status == RisingStarStatus::Active,
            ErrorCode::GrantNotActive
        );

        let state = &mut ctx.accounts.state;
        require!(
            state.rising_star_remaining >= month.claim_amount,
            ErrorCode::InsufficientPoolBalance
        );

        // SPL CPI: state PDA signs the transfer.
        // [whitepaper-sync v1.1] §5.6 launch-incentives
        let state_bump = state.bump;
        let seeds: &[&[u8]] = &[b"launch_incentives", &[state_bump]];
        let signer = &[seeds];
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.rising_star_vault.to_account_info(),
                to: ctx.accounts.creator_token_account.to_account_info(),
                authority: state.to_account_info(),
            },
            signer,
        );
        token::transfer(cpi_ctx, month.claim_amount)?;

        month.claimed = true;
        grant.total_claimed = grant
            .total_claimed
            .checked_add(month.claim_amount)
            .ok_or(ErrorCode::Overflow)?;
        grant.months_completed = grant
            .months_completed
            .checked_add(1)
            .ok_or(ErrorCode::Overflow)?;
        if grant.months_completed >= RISING_STAR_DURATION_MONTHS {
            grant.status = RisingStarStatus::Completed;
        }
        state.rising_star_remaining = state
            .rising_star_remaining
            .checked_sub(month.claim_amount)
            .ok_or(ErrorCode::Overflow)?;
        msg!(
            "RisingStar claim: creator={} month={} amount={}",
            grant.creator,
            month_index,
            month.claim_amount
        );
        Ok(())
    }
}

// ──────────────────────────────────────────────────────────────────────
// [whitepaper-sync v1.1] §5.6 launch-incentives — account types
// ──────────────────────────────────────────────────────────────────────

#[account]
pub struct LaunchIncentivesState {
    // [whitepaper-sync v1.1] §5.6 launch-incentives
    pub admin: Pubkey,                       // 32
    pub ora_mint: Pubkey,                    // 32
    pub million_plan_remaining: u64,         // 8
    pub onboarding_remaining: u64,           // 8
    pub rising_star_remaining: u64,          // 8
    pub million_plan_forfeit_topup: u64,     // 8 — cumulative reclaimed from §4.2 forfeits
    pub bump: u8,                            // 1
}
impl LaunchIncentivesState {
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1;
}

#[account]
pub struct MilestoneState {
    // [whitepaper-sync v1.1] §5.6 launch-incentives — Handbook §4.1
    pub milestone_id: u8,                    // 1 — 0=100K, 1=250K, 2=500K, 3=1M
    pub dau_threshold: u64,                  // 8
    pub pool_size: u64,                      // 8
    pub total_contribution_weight: u64,      // 8
    pub triggered: bool,                     // 1
    pub triggered_at: i64,                   // 8
    pub fully_distributed: bool,             // 1
    pub bump: u8,                            // 1
    // [audit fix R5 C-LI-1] running counter of ORA already paid out from this
    // milestone. Every successful claim increments it; once this equals
    // `pool_size` (minus residual <1 ORA dust) we flip `fully_distributed = true`.
    pub claimed_amount: u64,                 // 8
    // [audit fix R5 C-LI-2] closed-window snapshot of the final
    // `total_contribution_weight`. While the milestone window is open this
    // stays at 0 and claims revert. Admin calls `finalize_milestone_snapshot`
    // once the off-chain DAU pipeline publishes the final sum, after which
    // claim payouts use this denominator (so all claimers get correct pro-rata
    // shares instead of the broken streaming approximation).
    pub final_total_weight: u64,             // 8
    pub finalized: bool,                     // 1
}
impl MilestoneState {
    // 8 (discriminator) + 1 + 8 + 8 + 8 + 1 + 8 + 1 + 1 + 8 + 8 + 1
    pub const SIZE: usize = 8 + 1 + 8 + 8 + 8 + 1 + 8 + 1 + 1 + 8 + 8 + 1;
}

#[account]
pub struct MilestoneClaim {
    // [whitepaper-sync v1.1] §5.6 launch-incentives — one PDA per (user, milestone)
    pub user: Pubkey,                        // 32
    pub milestone_id: u8,                    // 1
    pub contribution: u64,                   // 8
    pub claim_amount: u64,                   // 8
    pub claimed_at: i64,                     // 8
    pub bump: u8,                            // 1
}
impl MilestoneClaim {
    pub const SIZE: usize = 8 + 32 + 1 + 8 + 8 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Debug)]
pub enum OnboardingStatus {
    // [whitepaper-sync v1.1] §5.6 launch-incentives — Handbook §4.2
    Active = 0,
    Paused = 1,
    Forfeit = 2,
    Completed = 3,
}

#[account]
pub struct OnboardingGrant {
    // [whitepaper-sync v1.1] §5.6 launch-incentives — Handbook §4.2
    pub creator: Pubkey,                     // 32
    pub external_followers: u64,             // 8
    pub total_amount: u64,                   // 8
    pub unlocked_amount: u64,                // 8
    pub remaining_amount: u64,               // 8
    pub consecutive_misses: u8,              // 1
    pub start_at: i64,                       // 8
    pub last_unlock_at: i64,                 // 8
    pub status: OnboardingStatus,            // 1 (enum repr)
    pub bump: u8,                            // 1
}
impl OnboardingGrant {
    pub const SIZE: usize = 8 + 32 + 8 + 8 + 8 + 8 + 1 + 8 + 8 + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Debug)]
pub enum RisingStarStatus {
    // [whitepaper-sync v1.1] §5.6 launch-incentives — Handbook §4.3
    Active = 0,
    Completed = 1,
    Suspended = 2,
}

#[account]
pub struct RisingStarGrant {
    // [whitepaper-sync v1.1] §5.6 launch-incentives — Handbook §4.3
    pub creator: Pubkey,                     // 32
    pub start_at: i64,                       // 8
    pub months_completed: u8,                // 1
    pub total_claimed: u64,                  // 8
    pub status: RisingStarStatus,            // 1
    pub bump: u8,                            // 1
}
impl RisingStarGrant {
    pub const SIZE: usize = 8 + 32 + 8 + 1 + 8 + 1 + 1;
}

#[account]
pub struct RisingStarMonth {
    // [whitepaper-sync v1.1] §5.6 launch-incentives — Handbook §4.3
    pub creator: Pubkey,                     // 32
    pub month_index: u8,                     // 1
    pub new_followers: u64,                  // 8
    pub claim_amount: u64,                   // 8
    pub claimed: bool,                       // 1
    pub bump: u8,                            // 1
}
impl RisingStarMonth {
    pub const SIZE: usize = 8 + 32 + 1 + 8 + 8 + 1 + 1;
}

/// [audit fix R5 H-LI-4] One PDA per (creator, month_index) for Onboarding
/// monthly claims. `init`-only → a second claim against the same month
/// reverts at the account level, guaranteeing the 12-month vest can't be
/// drained in a single block.
#[account]
pub struct OnboardingMonthlyClaim {
    pub creator: Pubkey,       // 32
    pub month_index: u8,       // 1
    pub amount_unlocked: u64,  // 8 (0 if activity_passed=false)
    pub activity_passed: bool, // 1
    pub claimed_at: i64,       // 8
    pub bump: u8,              // 1
}
impl OnboardingMonthlyClaim {
    pub const SIZE: usize = 8 + 32 + 1 + 8 + 1 + 8 + 1;
}

// ──────────────────────────────────────────────────────────────────────
// [whitepaper-sync v1.1] §5.6 launch-incentives — accounts contexts
// ──────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeLaunchIncentives<'info> {
    // [whitepaper-sync v1.1] §5.6 launch-incentives
    #[account(
        init,
        payer = admin,
        space = LaunchIncentivesState::SIZE,
        seeds = [b"launch_incentives"],
        bump,
    )]
    pub state: Account<'info, LaunchIncentivesState>,
    /// CHECK: pinned by `address` to the canonical ORA mint. We don't
    /// deserialise into `Account<Mint>` because keeping this as a raw info
    /// shaves IDL bloat for a constant-address gate.
    #[account(address = ORA_MINT @ ErrorCode::Unauthorized)]
    pub ora_mint: AccountInfo<'info>,
    #[account(mut, address = PROGRAM_ADMIN @ ErrorCode::Unauthorized)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(milestone_id: u8)]
pub struct InitializeMilestoneState<'info> {
    // [whitepaper-sync v1.1] §5.6 launch-incentives
    #[account(
        seeds = [b"launch_incentives"],
        bump = state.bump,
    )]
    pub state: Account<'info, LaunchIncentivesState>,
    #[account(
        init,
        payer = admin,
        space = MilestoneState::SIZE,
        seeds = [b"milestone".as_ref(), &[milestone_id][..]],
        bump,
    )]
    pub milestone: Account<'info, MilestoneState>,
    #[account(mut, address = PROGRAM_ADMIN @ ErrorCode::Unauthorized)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TriggerMilestone<'info> {
    // [whitepaper-sync v1.1] §5.6 launch-incentives
    #[account(
        seeds = [b"launch_incentives"],
        bump = state.bump,
    )]
    pub state: Account<'info, LaunchIncentivesState>,
    #[account(
        mut,
        seeds = [b"milestone".as_ref(), &[milestone.milestone_id][..]],
        bump = milestone.bump,
    )]
    pub milestone: Account<'info, MilestoneState>,
    /// [audit fix R5 M-LI-2] required predecessor milestone PDA used by the
    /// handler to enforce monotonic progression (milestone N requires N-1
    /// already-triggered). For milestone 0 the SDK passes the same PDA as
    /// `milestone` and the handler skips the check.
    #[account(
        seeds = [b"milestone".as_ref(), &[prior_milestone.milestone_id][..]],
        bump = prior_milestone.bump,
    )]
    pub prior_milestone: Account<'info, MilestoneState>,
    /// DAU oracle OR program admin. Phase-1 we accept admin signature so
    /// the platform can trigger milestones manually before the on-chain DAU
    /// oracle ships; Phase-2 switches this to a strict oracle key match.
    /// [whitepaper-sync v1.1] §5.6 launch-incentives
    #[account(
        constraint = (
            oracle.key() == DAU_ORACLE || oracle.key() == PROGRAM_ADMIN
        ) @ ErrorCode::Unauthorized
    )]
    pub oracle: Signer<'info>,
}

/// [audit fix R5 C-LI-2] One-shot context: admin / DAU oracle publishes the
/// final aggregated `total_contribution_weight` for a milestone after its
/// claim window closes off-chain. Sets `final_total_weight` + `finalized=true`.
#[derive(Accounts)]
#[instruction(milestone_id: u8)]
pub struct FinalizeMilestoneSnapshot<'info> {
    #[account(
        seeds = [b"launch_incentives"],
        bump = state.bump,
    )]
    pub state: Account<'info, LaunchIncentivesState>,
    #[account(
        mut,
        seeds = [b"milestone".as_ref(), &[milestone_id][..]],
        bump = milestone.bump,
    )]
    pub milestone: Account<'info, MilestoneState>,
    /// DAU oracle OR program admin (Phase-1 admin-OK pattern).
    #[account(
        constraint = (
            oracle.key() == DAU_ORACLE || oracle.key() == PROGRAM_ADMIN
        ) @ ErrorCode::Unauthorized
    )]
    pub oracle: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(milestone_id: u8)]
pub struct ClaimMillionReward<'info> {
    // [whitepaper-sync v1.1] §5.6 launch-incentives
    #[account(
        mut,
        seeds = [b"launch_incentives"],
        bump = state.bump,
    )]
    pub state: Account<'info, LaunchIncentivesState>,
    #[account(
        mut,
        seeds = [b"milestone".as_ref(), &[milestone_id][..]],
        bump = milestone.bump,
    )]
    pub milestone: Account<'info, MilestoneState>,
    /// [whitepaper-sync v1.1] §5.6 launch-incentives — one claim per
    /// (user, milestone). Anchor's `init` enforces single-claim by erroring
    /// on re-init of the same PDA.
    #[account(
        init,
        payer = user,
        space = MilestoneClaim::SIZE,
        seeds = [b"million_claim".as_ref(), user.key().as_ref(), &[milestone_id][..]],
        bump,
    )]
    pub claim: Account<'info, MilestoneClaim>,
    /// Million Plan vault — must match hardcoded `MILLION_PLAN_VAULT`.
    /// [whitepaper-sync v1.1] §5.6 launch-incentives
    #[account(
        mut,
        constraint = million_plan_vault.key() == MILLION_PLAN_VAULT
            @ ErrorCode::Unauthorized,
    )]
    pub million_plan_vault: Account<'info, TokenAccount>,
    /// User ATA receiving the payout. Mint pinned to canonical ORA.
    /// [whitepaper-sync v1.1] §5.6 launch-incentives
    #[account(
        mut,
        constraint = user_token_account.owner == user.key()
            @ ErrorCode::Unauthorized,
        constraint = user_token_account.mint == state.ora_mint
            @ ErrorCode::Unauthorized,
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    /// Oracle that signed the user_contribution. Phase-1 admin OK.
    /// [whitepaper-sync v1.1] §5.6 launch-incentives
    #[account(
        constraint = (
            contribution_oracle.key() == DAU_ORACLE
                || contribution_oracle.key() == PROGRAM_ADMIN
        ) @ ErrorCode::Unauthorized
    )]
    pub contribution_oracle: Signer<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterOnboarding<'info> {
    // [whitepaper-sync v1.1] §5.6 launch-incentives
    #[account(
        mut,
        seeds = [b"launch_incentives"],
        bump = state.bump,
    )]
    pub state: Account<'info, LaunchIncentivesState>,
    #[account(
        init,
        payer = admin,
        space = OnboardingGrant::SIZE,
        seeds = [b"onboarding", creator.key().as_ref()],
        bump,
    )]
    pub grant: Account<'info, OnboardingGrant>,
    /// [audit fix R5 C-LI-3] The creator MUST co-sign their own
    /// registration. Previously this was `AccountInfo`, allowing a
    /// compromised admin key to register arbitrary wallets into the
    /// Onboarding track and stake them out via the forfeit → Million Plan
    /// reclaim path. Admin still signs in lockstep (one-time setup gate);
    /// without creator consent the call now reverts at the Signer check.
    #[account(mut)]
    pub creator: Signer<'info>,
    /// [audit fix R5 M-LI-1] Track-routing partner PDA — REQUIRED, not
    /// optional. Seeded by `[b"rising_star", creator]` so the SDK derives
    /// the address whether or not the account exists yet. Handler manually
    /// inspects ownership + discriminator + status byte (see
    /// `check_no_active_rising_star`). Refuses registration if the Rising
    /// Star grant exists with `status == Active`.
    /// CHECK: manually parsed in handler.
    pub rising_star_grant: AccountInfo<'info>,
    /// OAuth oracle signs the verified follower count.
    /// [whitepaper-sync v1.1] §5.6 launch-incentives
    #[account(
        constraint = (
            oauth_oracle.key() == ONBOARDING_OAUTH_ORACLE
                || oauth_oracle.key() == PROGRAM_ADMIN
        ) @ ErrorCode::Unauthorized
    )]
    pub oauth_oracle: Signer<'info>,
    #[account(mut, address = PROGRAM_ADMIN @ ErrorCode::Unauthorized)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(month_index: u8)]
pub struct ClaimMonthlyUnlock<'info> {
    // [whitepaper-sync v1.1] §5.6 launch-incentives
    #[account(
        seeds = [b"launch_incentives"],
        bump = state.bump,
    )]
    pub state: Account<'info, LaunchIncentivesState>,
    #[account(
        mut,
        seeds = [b"onboarding", grant.creator.as_ref()],
        bump = grant.bump,
        has_one = creator @ ErrorCode::Unauthorized,
    )]
    pub grant: Account<'info, OnboardingGrant>,
    /// [audit fix R5 H-LI-4] One PDA per (creator, month_index) —
    /// `init` ensures a single claim attempt per month and prevents the
    /// previous 12-call same-block drain.
    #[account(
        init,
        payer = creator,
        space = OnboardingMonthlyClaim::SIZE,
        seeds = [b"ob_month", creator.key().as_ref(), &[month_index][..]],
        bump,
    )]
    pub monthly_claim: Account<'info, OnboardingMonthlyClaim>,
    #[account(mut)]
    pub creator: Signer<'info>,
    /// Activity proof oracle (OAuth API attestation).
    /// [whitepaper-sync v1.1] §5.6 launch-incentives
    #[account(
        constraint = (
            activity_oracle.key() == ONBOARDING_OAUTH_ORACLE
                || activity_oracle.key() == PROGRAM_ADMIN
        ) @ ErrorCode::Unauthorized
    )]
    pub activity_oracle: Signer<'info>,
    #[account(
        mut,
        constraint = onboarding_vault.key() == ONBOARDING_VAULT
            @ ErrorCode::Unauthorized,
    )]
    pub onboarding_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = creator_token_account.owner == creator.key()
            @ ErrorCode::Unauthorized,
        constraint = creator_token_account.mint == state.ora_mint
            @ ErrorCode::Unauthorized,
    )]
    pub creator_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ForfeitOnboarding<'info> {
    // [whitepaper-sync v1.1] §5.6 launch-incentives
    #[account(
        mut,
        seeds = [b"launch_incentives"],
        bump = state.bump,
    )]
    pub state: Account<'info, LaunchIncentivesState>,
    #[account(
        mut,
        seeds = [b"onboarding", grant.creator.as_ref()],
        bump = grant.bump,
    )]
    pub grant: Account<'info, OnboardingGrant>,
    #[account(
        mut,
        constraint = onboarding_vault.key() == ONBOARDING_VAULT
            @ ErrorCode::Unauthorized,
    )]
    pub onboarding_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = million_plan_vault.key() == MILLION_PLAN_VAULT
            @ ErrorCode::Unauthorized,
    )]
    pub million_plan_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    /// Anyone can call (no admin signer required).
    /// [whitepaper-sync v1.1] §5.6 launch-incentives
    pub caller: Signer<'info>,
}

#[derive(Accounts)]
pub struct RegisterRisingStar<'info> {
    // [whitepaper-sync v1.1] §5.6 launch-incentives
    #[account(
        seeds = [b"launch_incentives"],
        bump = state.bump,
    )]
    pub state: Account<'info, LaunchIncentivesState>,
    #[account(
        init,
        payer = admin,
        space = RisingStarGrant::SIZE,
        seeds = [b"rising_star", creator.key().as_ref()],
        bump,
    )]
    pub grant: Account<'info, RisingStarGrant>,
    /// [audit fix R5 C-LI-3] The creator MUST co-sign their own
    /// registration. Previously this was `AccountInfo`, allowing a
    /// compromised admin to lock arbitrary wallets out of the Onboarding
    /// track via the mutual-exclusion path.
    #[account(mut)]
    pub creator: Signer<'info>,
    /// [audit fix R5 M-LI-1] Track-routing partner PDA — REQUIRED.
    /// Manually parsed in handler for ownership + discriminator + status.
    /// CHECK: manually parsed.
    pub onboarding_grant: AccountInfo<'info>,
    #[account(mut, address = PROGRAM_ADMIN @ ErrorCode::Unauthorized)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(month_index: u8)]
pub struct RecordMonthlyFollowers<'info> {
    // [whitepaper-sync v1.1] §5.6 launch-incentives
    #[account(
        seeds = [b"launch_incentives"],
        bump = state.bump,
    )]
    pub state: Account<'info, LaunchIncentivesState>,
    #[account(
        seeds = [b"rising_star", grant.creator.as_ref()],
        bump = grant.bump,
    )]
    pub grant: Account<'info, RisingStarGrant>,
    #[account(
        init,
        payer = oracle,
        space = RisingStarMonth::SIZE,
        seeds = [b"rs_month".as_ref(), grant.creator.as_ref(), &[month_index][..]],
        bump,
    )]
    pub month: Account<'info, RisingStarMonth>,
    /// Rising Star follower oracle (Phase-1 admin OK).
    /// [whitepaper-sync v1.1] §5.6 launch-incentives
    #[account(
        mut,
        constraint = (
            oracle.key() == RISING_STAR_FOLLOWER_ORACLE
                || oracle.key() == PROGRAM_ADMIN
        ) @ ErrorCode::Unauthorized
    )]
    pub oracle: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(month_index: u8)]
pub struct ClaimRisingStarMonthly<'info> {
    // [whitepaper-sync v1.1] §5.6 launch-incentives
    #[account(
        mut,
        seeds = [b"launch_incentives"],
        bump = state.bump,
    )]
    pub state: Account<'info, LaunchIncentivesState>,
    #[account(
        mut,
        seeds = [b"rising_star", creator.key().as_ref()],
        bump = grant.bump,
        has_one = creator @ ErrorCode::Unauthorized,
    )]
    pub grant: Account<'info, RisingStarGrant>,
    #[account(
        mut,
        seeds = [b"rs_month".as_ref(), creator.key().as_ref(), &[month_index][..]],
        bump = month.bump,
    )]
    pub month: Account<'info, RisingStarMonth>,
    #[account(
        mut,
        constraint = rising_star_vault.key() == RISING_STAR_VAULT
            @ ErrorCode::Unauthorized,
    )]
    pub rising_star_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = creator_token_account.owner == creator.key()
            @ ErrorCode::Unauthorized,
        constraint = creator_token_account.mint == state.ora_mint
            @ ErrorCode::Unauthorized,
    )]
    pub creator_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// ──────────────────────────────────────────────────────────────────────
// [whitepaper-sync v1.1] §5.6 launch-incentives — error codes
// ──────────────────────────────────────────────────────────────────────

#[error_code]
pub enum ErrorCode {
    // [whitepaper-sync v1.1] §5.6 launch-incentives
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Overflow")]
    Overflow,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Insufficient pool balance")]
    InsufficientPoolBalance,
    #[msg("Invalid milestone id (must be 0..3)")]
    InvalidMilestoneId,
    #[msg("Milestone already triggered")]
    MilestoneAlreadyTriggered,
    #[msg("Milestone has not been triggered yet")]
    MilestoneNotTriggered,
    #[msg("Milestone fully distributed")]
    MilestoneFullyDistributed,
    #[msg("DAU below milestone threshold")]
    DauBelowThreshold,
    #[msg("Nothing to claim")]
    NothingToClaim,
    #[msg("External followers below 10,000 threshold")]
    ExternalFollowersTooLow,
    #[msg("Track conflict: creator has an active grant in the other program")]
    TrackConflict,
    #[msg("Grant is not active")]
    GrantNotActive,
    #[msg("Forfeit threshold (3 consecutive misses) not met")]
    ForfeitThresholdNotMet,
    #[msg("Month index out of range")]
    MonthIndexOutOfRange,
    #[msg("Month index mismatch")]
    MonthIndexMismatch,
    #[msg("Already claimed")]
    AlreadyClaimed,
    #[msg("Too early")]
    TooEarly,
    // [audit fix R5 C-LI-2]
    #[msg("Milestone has not been finalized (snapshot not published)")]
    MilestoneNotFinalized,
    #[msg("Milestone is already finalized")]
    MilestoneAlreadyFinalized,
    #[msg("user_contribution exceeds finalized total weight snapshot")]
    ContributionExceedsSnapshot,
    // [audit fix R5 M-LI-2]
    #[msg("Milestone triggered out-of-order; prior milestone must be triggered first")]
    MilestoneOutOfOrder,
    #[msg("Prior milestone has not been triggered")]
    MilestonePrerequisiteNotTriggered,
}

// ──────────────────────────────────────────────────────────────────────
// [audit fix R5 M-LI-1] track-routing helpers
// Manually inspect a sibling-track grant account for ownership,
// discriminator, and `status == Active`. Treats a system-program-owned or
// empty-data PDA as "no prior grant" (bootstrap case).
// ──────────────────────────────────────────────────────────────────────

// Anchor account discriminator = SHA-256(`account:<StructName>`)[0..8].
// Anchor's `#[account]` macro auto-implements the `Discriminator` trait on
// each account struct, exposing `Self::DISCRIMINATOR` as a const. We read
// that at call time so the handler can reject foreign program-owned PDAs
// that happen to be passed in to bypass the track-routing check.

fn check_no_active_rising_star(
    info: &AccountInfo<'_>,
    program_id: &Pubkey,
) -> Result<()> {
    // Bootstrap: account doesn't exist yet → owned by system_program, no data.
    if info.owner != program_id {
        return Ok(());
    }
    let data = info.try_borrow_data()?;
    if data.len() < 8 {
        return Ok(());
    }
    let expected = <RisingStarGrant as anchor_lang::Discriminator>::DISCRIMINATOR;
    require!(data[..8] == expected, ErrorCode::TrackConflict);
    // RisingStarGrant layout: 8 disc + 32 creator + 8 start_at + 1
    // months_completed + 8 total_claimed + 1 status + 1 bump = 59 bytes.
    // status byte offset = 8 + 32 + 8 + 1 + 8 = 57.
    if data.len() >= 58 {
        let status_byte = data[57];
        // 0 = Active (see RisingStarStatus enum).
        require!(status_byte != 0, ErrorCode::TrackConflict);
    }
    Ok(())
}

fn check_no_active_onboarding(
    info: &AccountInfo<'_>,
    program_id: &Pubkey,
) -> Result<()> {
    if info.owner != program_id {
        return Ok(());
    }
    let data = info.try_borrow_data()?;
    if data.len() < 8 {
        return Ok(());
    }
    let expected = <OnboardingGrant as anchor_lang::Discriminator>::DISCRIMINATOR;
    require!(data[..8] == expected, ErrorCode::TrackConflict);
    // OnboardingGrant layout: 8 disc + 32 creator + 8 ext_followers + 8
    // total + 8 unlocked + 8 remaining + 1 misses + 8 start_at + 8
    // last_unlock + 1 status + 1 bump = 91. status offset = 89.
    if data.len() >= 91 {
        let status_byte = data[89];
        // 0 = Active.
        require!(status_byte != 0, ErrorCode::TrackConflict);
    }
    Ok(())
}
