use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("Bfwu9gQFyYsaURqDSVYwsfB5VXwGgbTHbSgrzEhNtbuR");

// [audit fix C4.M-1 option-C] Hardcoded `aura_ora` program id. Only the
// `aura_ora` program is permitted to CPI into the `mint_for_*` wrappers
// below. This matches the `declare_id!` in `programs/ora/src/lib.rs`:
//     Dq6fFo2yjSuiGPhc1hwDocKhEpsSam2X8PbzbhVzTHxN
// Encoded inline as a byte array so it works regardless of Anchor's
// `pubkey!` macro re-export path (mirrors the pattern in
// `programs/curation/src/lib.rs`).
pub const ORA_PROGRAM_ID: Pubkey = Pubkey::new_from_array([
    190, 158, 133, 112, 131, 254, 139, 245, 33, 30, 24, 191, 243, 69, 192, 255,
    73, 84, 14, 33, 185, 105, 241, 77, 236, 148, 199, 174, 39, 227, 136, 235,
]);

/// [audit fix C4.M-1 option-C] Categorises ORA mints issued via the
/// `rewards::mint_for_ora` wrapper. Surfaces intent in logs/events; does not
/// itself enforce supply caps (those remain authoritative in `aura_ora`).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Debug)]
#[repr(u8)]
pub enum MintPurpose {
    /// Authority-only mint via `ora::mint_ora`
    AdHoc = 0,
    /// Reward distribution via `ora::distribute_reward`
    DistributeReward = 1,
    /// Initial 1.05B supply via `ora::mint_initial_supply`
    InitialSupply = 2,
}

/// Total community incentive allocation: 500M ORA (with 9 decimals)
pub const TOTAL_INCENTIVE_POOL: u64 = 500_000_000 * 1_000_000_000;
/// Incentive tax rate: 10% burned (Triple Burn mechanism #1)
pub const INCENTIVE_TAX_BPS: u64 = 1000; // 10%
/// MAU threshold for base reward change
pub const MAU_THRESHOLD: u64 = 500_000;
/// [audit fix D2.M-1] Per-call cap on a single distribution. Bounds the
/// damage if the REWARD_DISTRIBUTOR key is misused (or a CPI integration is
/// mis-wired) so no single transaction can drain a large fraction of the 500M
/// incentive pool. 100,000 ORA per call is comfortably above any organic
/// per-content reward but tiny vs. the 500M pool (0.02%).
pub const PER_CALL_DISTRIBUTION_CAP: u64 = 100_000 * 1_000_000_000;

// [audit fix D-C-1 / D-C-3] Hardcoded protocol reward distributor.
// ⚠️ DO NOT DEPLOY — placeholder; replace with the real protocol multisig
// before mainnet deploy. The distributor is the ONLY signer permitted to
// invoke `distribute_creation_reward` / `distribute_curation_reward`.
pub const REWARD_DISTRIBUTOR: Pubkey = anchor_lang::solana_program::system_program::ID;

#[program]
pub mod aura_rewards {
    use super::*;

    /// Initialize the rewards pool
    /// [audit fix D.M-3] verify that the ORA mint's `mint_authority` is the
    /// `reward_state` PDA. Without this, the deployment runbook could attach an
    /// ORA mint whose authority points elsewhere — every subsequent
    /// `distribute_*` CPI would then fail at runtime (cryptic SPL error). We
    /// surface that misconfiguration up front with a clean error code.
    pub fn initialize_rewards(
        ctx: Context<InitializeRewards>,
    ) -> Result<()> {
        // [audit fix D.M-3] mint-authority sanity check at init time.
        let mint = &ctx.accounts.ora_mint;
        let expected_authority = ctx.accounts.reward_state.key();
        match mint.mint_authority {
            anchor_lang::solana_program::program_option::COption::Some(actual)
                if actual == expected_authority => {}
            _ => return Err(ErrorCode::MintAuthorityMismatch.into()),
        }

        let state = &mut ctx.accounts.reward_state;
        state.authority = ctx.accounts.authority.key();
        state.ora_mint = ctx.accounts.ora_mint.key();
        state.total_distributed = 0;
        state.total_burned = 0;
        state.current_mau = 0;
        state.phase = RewardPhase::Phase1Creation100;
        state.creation_ratio_bps = 10000; // 100%
        state.curation_ratio_bps = 0;     // 0%
        state.bump = ctx.bumps.reward_state;

        msg!("Rewards initialized. Pool: 500M ORA");
        Ok(())
    }

    /// Distribute creation reward with Model C formula
    /// Reward = Base + 18 / (1 + MAU / 50000)
    /// Base = 2 (MAU < 500k) or 1 (MAU >= 500k)
    /// 5 content tiers multiply the base reward
    pub fn distribute_creation_reward(
        ctx: Context<DistributeCreationReward>,
        content_tier: ContentTier,
    ) -> Result<()> {
        let current_mau = ctx.accounts.reward_state.current_mau;
        let creation_ratio_bps = ctx.accounts.reward_state.creation_ratio_bps;
        let bump = ctx.accounts.reward_state.bump;

        // Calculate raw reward using Model C formula (in ORA tokens with 9 decimals)
        // FIX #11: Use u128 throughout to prevent overflow
        let base: u64 = if current_mau < MAU_THRESHOLD { 2 } else { 1 };
        // Reward = Base + 18 / (1 + MAU / 50000)
        // = Base + 18 * 50000 / (50000 + MAU)  (all in ORA with 9 decimals)
        let decay_component = (18u128 * 1_000_000_000u128 * 50_000u128)
            .checked_div(50_000u128 + current_mau as u128)
            .unwrap_or(0) as u64;
        let base_reward = base
            .checked_mul(1_000_000_000)
            .ok_or(ErrorCode::PoolExhausted)?
            .checked_add(decay_component)
            .ok_or(ErrorCode::PoolExhausted)?;

        let tier_multiplier = match content_tier {
            ContentTier::Basic => 100,
            ContentTier::Standard => 150,
            ContentTier::Premium => 200,
            ContentTier::Professional => 300,
            ContentTier::Exceptional => 500,
        };
        let raw_reward = (base_reward as u128)
            .checked_mul(tier_multiplier as u128)
            .unwrap()
            .checked_div(100)
            .unwrap() as u64;

        let phase_reward = (raw_reward as u128)
            .checked_mul(creation_ratio_bps as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;

        let burn_amount = (phase_reward as u128)
            .checked_mul(INCENTIVE_TAX_BPS as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;
        let net_reward = phase_reward.checked_sub(burn_amount).ok_or(ErrorCode::Overflow)?;

        let seeds = &[b"reward_state".as_ref(), &[bump]];
        let signer = &[&seeds[..]];

        if net_reward > 0 {
            token::mint_to(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    MintTo {
                        mint: ctx.accounts.ora_mint.to_account_info(),
                        to: ctx.accounts.creator_token_account.to_account_info(),
                        authority: ctx.accounts.reward_state.to_account_info(),
                    },
                    signer,
                ),
                net_reward,
            )?;
        }

        let state = &mut ctx.accounts.reward_state;
        // [audit fix D-M-2] enforce hard 500M cumulative cap; cannot mint past
        // the whitepaper-promised community incentive pool.
        let new_total = state
            .total_distributed
            .checked_add(net_reward)
            .ok_or(ErrorCode::PoolExhausted)?;
        require!(new_total <= TOTAL_INCENTIVE_POOL, ErrorCode::PoolExhausted);
        state.total_distributed = new_total;
        state.total_burned = state
            .total_burned
            .checked_add(burn_amount)
            .ok_or(ErrorCode::Overflow)?;

        msg!(
            "Creation reward: {} ORA (tier {:?}, burned {}, MAU {})",
            net_reward,
            content_tier,
            burn_amount,
            state.current_mau
        );
        Ok(())
    }

    /// Distribute curation reward (time-weighted: early discovery = more)
    /// [audit fix D-C-3] the trio of `curation_weight` / `pool_total_weight` /
    /// `pool_reward_amount` are still caller-supplied, but the caller is now
    /// pinned to REWARD_DISTRIBUTOR (see context). In a future iteration, this
    /// should be replaced by a CPI from the curation program reading a
    /// program-owned CurationRecord PDA directly. For Phase 1
    /// (curation_ratio_bps = 0) no curation rewards are minted anyway.
    pub fn distribute_curation_reward(
        ctx: Context<DistributeCurationReward>,
        curation_weight: u64,
        pool_total_weight: u64,
        pool_reward_amount: u64,
    ) -> Result<()> {
        require!(pool_total_weight > 0, ErrorCode::InvalidWeight);
        require!(curation_weight > 0, ErrorCode::InvalidWeight);
        // [audit fix D-C-3] sanity bound — curator can never weigh more than
        // the pool's claimed total weight, otherwise the math is nonsensical.
        require!(
            curation_weight <= pool_total_weight,
            ErrorCode::InvalidWeight
        );

        let curation_ratio_bps = ctx.accounts.reward_state.curation_ratio_bps;
        let bump = ctx.accounts.reward_state.bump;

        // [audit fix D-L-2] replaced `.unwrap()` chains with `.ok_or(Overflow)?`
        // so a corrupt caller-supplied value surfaces a clean Anchor error
        // instead of a BPF panic.
        // Calculate curator's share of the pool
        let raw_reward = (pool_reward_amount as u128)
            .checked_mul(curation_weight as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(pool_total_weight as u128)
            .ok_or(ErrorCode::Overflow)? as u64;

        let phase_reward = (raw_reward as u128)
            .checked_mul(curation_ratio_bps as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::Overflow)? as u64;

        let burn_amount = (phase_reward as u128)
            .checked_mul(INCENTIVE_TAX_BPS as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::Overflow)? as u64;
        let net_reward = phase_reward
            .checked_sub(burn_amount)
            .ok_or(ErrorCode::Overflow)?;

        // [audit fix D2.M-1] hard per-call cap so a single distribution
        // (caller-supplied pool_reward_amount) cannot drain a large fraction
        // of the protocol's 500M ORA pool in one transaction.
        require!(
            net_reward <= PER_CALL_DISTRIBUTION_CAP,
            ErrorCode::PerCallCapExceeded
        );

        let seeds = &[b"reward_state".as_ref(), &[bump]];
        let signer = &[&seeds[..]];

        if net_reward > 0 {
            token::mint_to(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    MintTo {
                        mint: ctx.accounts.ora_mint.to_account_info(),
                        to: ctx.accounts.curator_token_account.to_account_info(),
                        authority: ctx.accounts.reward_state.to_account_info(),
                    },
                    signer,
                ),
                net_reward,
            )?;
        }

        let state = &mut ctx.accounts.reward_state;
        // [audit fix D-M-2] enforce hard 500M cumulative cap
        let new_total = state
            .total_distributed
            .checked_add(net_reward)
            .ok_or(ErrorCode::PoolExhausted)?;
        require!(new_total <= TOTAL_INCENTIVE_POOL, ErrorCode::PoolExhausted);
        state.total_distributed = new_total;
        state.total_burned = state
            .total_burned
            .checked_add(burn_amount)
            .ok_or(ErrorCode::Overflow)?;

        msg!(
            "Curation reward: {} ORA (weight {}/{}, burned {})",
            net_reward,
            curation_weight,
            pool_total_weight,
            burn_amount
        );
        Ok(())
    }

    /// Transition reward phases: 100:0 → 70:30 → 50:50
    /// [audit fix D.M-1] phases are now strictly monotonic forward. Going
    /// backwards (e.g. Phase3 → Phase1) is rejected; the authority can only
    /// advance the phase or no-op to the current phase. This prevents an
    /// authority key from rolling back curator ratio commitments mid-program.
    pub fn transition_phase(
        ctx: Context<TransitionPhase>,
        new_phase: RewardPhase,
    ) -> Result<()> {
        let state = &mut ctx.accounts.reward_state;
        require!(ctx.accounts.authority.key() == state.authority, ErrorCode::Unauthorized);

        // [audit fix D.M-1] enforce monotonic advancement (or self-transition)
        let current_ord = phase_ord(&state.phase);
        let new_ord = phase_ord(&new_phase);
        require!(new_ord >= current_ord, ErrorCode::PhaseRollbackForbidden);

        match new_phase {
            RewardPhase::Phase1Creation100 => {
                state.creation_ratio_bps = 10000;
                state.curation_ratio_bps = 0;
            }
            RewardPhase::Phase2Split70_30 => {
                state.creation_ratio_bps = 7000;
                state.curation_ratio_bps = 3000;
            }
            RewardPhase::Phase3Split50_50 => {
                state.creation_ratio_bps = 5000;
                state.curation_ratio_bps = 5000;
            }
        }
        state.phase = new_phase.clone();

        msg!(
            "Phase transitioned to {:?} (creation {}bps, curation {}bps)",
            new_phase,
            state.creation_ratio_bps,
            state.curation_ratio_bps
        );
        Ok(())
    }

    /// Update MAU (Monthly Active Users) for formula calculations
    pub fn update_mau(
        ctx: Context<UpdateMAU>,
        new_mau: u64,
    ) -> Result<()> {
        let state = &mut ctx.accounts.reward_state;
        require!(ctx.accounts.authority.key() == state.authority, ErrorCode::Unauthorized);
        state.current_mau = new_mau;
        msg!("MAU updated to {}", new_mau);
        Ok(())
    }

    // ────────────────────────────────────────────────────────────────
    // [audit fix C4.M-1 option-C] CPI wrappers used by `aura_ora`.
    //
    // Because the ORA mint authority is `reward_state` PDA (so
    // `rewards::initialize_rewards`'s mint-authority sanity check
    // succeeds), `aura_ora` cannot mint ORA directly any more. It calls
    // into one of the wrappers below; this program signs `token::mint_to`
    // with the `reward_state` PDA on its behalf.
    //
    // Authorisation model (defense in depth):
    //   1. The caller must pass its own `ora_config` PDA as a Signer
    //      (the `aura_ora` program signs this PDA via CPI seeds).
    //   2. The Anchor accounts struct validates that PDA derives from
    //      `ORA_PROGRAM_ID` with seeds [b"ora_config"]. This means only
    //      the deployed `aura_ora` program (whose id is hard-coded above)
    //      can ever produce a valid signer here.
    //   3. Supply cap / one-shot / bookkeeping enforcement remains in
    //      `aura_ora` — these wrappers are pure mint primitives.
    // ────────────────────────────────────────────────────────────────

    /// [audit fix C4.M-1 option-C] CPI-only ORA mint primitive.
    ///
    /// Mints `amount` ORA to `destination_token_account`, signed by the
    /// `reward_state` PDA. Intended caller: `aura_ora` program
    /// (mint_ora / distribute_reward).
    pub fn mint_for_ora(
        ctx: Context<MintForOra>,
        amount: u64,
        purpose: u8,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        let bump = ctx.accounts.reward_state.bump;
        let seeds = &[b"reward_state".as_ref(), &[bump]];
        let signer = &[&seeds[..]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.ora_mint.to_account_info(),
                    to: ctx.accounts.destination_token_account.to_account_info(),
                    authority: ctx.accounts.reward_state.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        msg!(
            "mint_for_ora: {} ORA minted via CPI (purpose={})",
            amount,
            purpose,
        );
        Ok(())
    }

    /// [audit fix C4.M-1 option-C] CPI-only ORA mint primitive for the
    /// MAU growth reserve. Functionally identical to `mint_for_ora` but
    /// emits a distinct log line so on-chain indexers can tag growth
    /// emissions separately. Per-call supply cap and MAU bookkeeping
    /// remain in `aura_ora::mau_growth_mint`.
    pub fn mint_for_growth(
        ctx: Context<MintForOra>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        let bump = ctx.accounts.reward_state.bump;
        let seeds = &[b"reward_state".as_ref(), &[bump]];
        let signer = &[&seeds[..]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.ora_mint.to_account_info(),
                    to: ctx.accounts.destination_token_account.to_account_info(),
                    authority: ctx.accounts.reward_state.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        msg!("mint_for_growth: {} ORA minted via CPI (MAU growth reserve)", amount);
        Ok(())
    }

    /// [audit fix C4.M-1 option-C] CPI-only ORA mint primitive for the
    /// 1.05B initial supply path. Same shape as `mint_for_ora`; kept as a
    /// distinct entry point so the deploy runbook is explicit and audit
    /// logs disambiguate the bootstrap mint. One-shot semantics are
    /// enforced in `aura_ora::mint_initial_supply` via
    /// `OraConfig.initial_supply_minted`.
    pub fn mint_for_initial_supply(
        ctx: Context<MintForOra>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        let bump = ctx.accounts.reward_state.bump;
        let seeds = &[b"reward_state".as_ref(), &[bump]];
        let signer = &[&seeds[..]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.ora_mint.to_account_info(),
                    to: ctx.accounts.destination_token_account.to_account_info(),
                    authority: ctx.accounts.reward_state.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        msg!("mint_for_initial_supply: {} ORA minted via CPI (1.05B bootstrap)", amount);
        Ok(())
    }
}

// ============ Accounts ============

#[account]
pub struct RewardState {
    pub authority: Pubkey,         // 32
    pub ora_mint: Pubkey,          // 32
    pub total_distributed: u64,    // 8
    pub total_burned: u64,         // 8
    pub current_mau: u64,          // 8
    pub phase: RewardPhase,        // 1
    pub creation_ratio_bps: u16,   // 2
    pub curation_ratio_bps: u16,   // 2
    pub bump: u8,                  // 1
}

// ============ Enums ============

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
pub enum ContentTier {
    Basic,         // 1.0x
    Standard,      // 1.5x
    Premium,       // 2.0x
    Professional,  // 3.0x
    Exceptional,   // 5.0x
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
pub enum RewardPhase {
    Phase1Creation100,  // 100:0 creation:curation
    Phase2Split70_30,   // 70:30
    Phase3Split50_50,   // 50:50
}

// ============ Contexts ============

// [audit fix D-C-1] initialize is also gated to REWARD_DISTRIBUTOR so the
// stored authority cannot be set to an attacker-controlled key at init time.
#[derive(Accounts)]
pub struct InitializeRewards<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 1 + 2 + 2 + 1,
        seeds = [b"reward_state"],
        bump
    )]
    pub reward_state: Account<'info, RewardState>,
    #[account(mut)]
    pub ora_mint: Account<'info, Mint>,
    // [audit fix D-C-1] only REWARD_DISTRIBUTOR can bootstrap rewards
    #[account(mut, address = REWARD_DISTRIBUTOR @ ErrorCode::Unauthorized)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// [audit fix D-C-1] WITHOUT this `has_one`, anyone signing as `authority`
// could mint up to ~45 ORA per call indefinitely — this is the headline
// infinite-mint vulnerability flagged in the audit.
// [audit fix D-C-1 follow-up] also pin `authority` to REWARD_DISTRIBUTOR so
// a compromised on-chain `reward_state.authority` cannot drain the pool.
// [audit fix D-C-2] bind `creator_token_account.mint` to `ora_mint` so the
// destination cannot be a non-ORA token account.
#[derive(Accounts)]
pub struct DistributeCreationReward<'info> {
    #[account(
        mut,
        seeds = [b"reward_state"],
        bump = reward_state.bump,
        has_one = authority @ ErrorCode::Unauthorized,
        has_one = ora_mint @ ErrorCode::Unauthorized,
    )]
    pub reward_state: Account<'info, RewardState>,
    #[account(mut)]
    pub ora_mint: Account<'info, Mint>,
    /// Creator's ORA token account
    // [audit fix D-C-2] mint binding
    #[account(
        mut,
        constraint = creator_token_account.mint == ora_mint.key() @ ErrorCode::Unauthorized,
    )]
    pub creator_token_account: Account<'info, TokenAccount>,
    // [audit fix D-C-1] authority pinned to REWARD_DISTRIBUTOR const
    #[account(address = REWARD_DISTRIBUTOR @ ErrorCode::Unauthorized)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// [audit fix D-C-1] same authority gate as DistributeCreationReward.
// [audit fix D-C-3] caller-supplied weights still flow through here, but only
// REWARD_DISTRIBUTOR may sign — see function-level comment for the
// medium-term plan to fold this into a curation-program CPI.
#[derive(Accounts)]
pub struct DistributeCurationReward<'info> {
    #[account(
        mut,
        seeds = [b"reward_state"],
        bump = reward_state.bump,
        has_one = authority @ ErrorCode::Unauthorized,
        has_one = ora_mint @ ErrorCode::Unauthorized,
    )]
    pub reward_state: Account<'info, RewardState>,
    #[account(mut)]
    pub ora_mint: Account<'info, Mint>,
    /// Curator's ORA token account
    // [audit fix D-C-2] mint binding (same as creation reward path)
    #[account(
        mut,
        constraint = curator_token_account.mint == ora_mint.key() @ ErrorCode::Unauthorized,
    )]
    pub curator_token_account: Account<'info, TokenAccount>,
    // [audit fix D-C-1] authority pinned to REWARD_DISTRIBUTOR const
    #[account(address = REWARD_DISTRIBUTOR @ ErrorCode::Unauthorized)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// [audit fix D-H-1] `has_one = authority` replaces the body-level
// `require!(authority.key() == state.authority)` check (cheaper + cleaner
// error). Authority must additionally be REWARD_DISTRIBUTOR for defense-in-
// depth — phase transitions are protocol-critical.
#[derive(Accounts)]
pub struct TransitionPhase<'info> {
    #[account(
        mut,
        seeds = [b"reward_state"],
        bump = reward_state.bump,
        has_one = authority @ ErrorCode::Unauthorized,
    )]
    pub reward_state: Account<'info, RewardState>,
    #[account(address = REWARD_DISTRIBUTOR @ ErrorCode::Unauthorized)]
    pub authority: Signer<'info>,
}

// [audit fix D-H-2] same as D-H-1.
#[derive(Accounts)]
pub struct UpdateMAU<'info> {
    #[account(
        mut,
        seeds = [b"reward_state"],
        bump = reward_state.bump,
        has_one = authority @ ErrorCode::Unauthorized,
    )]
    pub reward_state: Account<'info, RewardState>,
    #[account(address = REWARD_DISTRIBUTOR @ ErrorCode::Unauthorized)]
    pub authority: Signer<'info>,
}

// [audit fix C4.M-1 option-C] CPI mint primitive — accounts struct shared by
// `mint_for_ora` / `mint_for_growth` / `mint_for_initial_supply`.
//
// Authorisation:
//   - `caller_ora_config` MUST be the `aura_ora` program's `ora_config` PDA
//     (seeds = [b"ora_config"], program = ORA_PROGRAM_ID) and MUST be a
//     Signer (the ora program signs via CPI seeds). This is the only path
//     by which non-rewards code can request a mint.
//   - `ora_mint` is pinned via `has_one = ora_mint` on `reward_state`.
//   - `destination_token_account.mint` must be the ORA mint.
//
// Supply-cap / one-shot / per-purpose enforcement stays in `aura_ora`.
#[derive(Accounts)]
pub struct MintForOra<'info> {
    #[account(
        seeds = [b"reward_state"],
        bump = reward_state.bump,
        has_one = ora_mint @ ErrorCode::Unauthorized,
    )]
    pub reward_state: Account<'info, RewardState>,

    #[account(mut)]
    pub ora_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = destination_token_account.mint == ora_mint.key() @ ErrorCode::Unauthorized,
    )]
    pub destination_token_account: Account<'info, TokenAccount>,

    /// CHECK: This is the `aura_ora` program's `ora_config` PDA. The Anchor
    /// `seeds` + `seeds::program` constraint cryptographically asserts the
    /// address is the deterministic PDA owned by ORA_PROGRAM_ID; the
    /// `Signer` requirement means only that program (via its CPI invocation
    /// signing with the PDA seeds) can produce it. Together these two
    /// constraints fully gate the CPI to the deployed `aura_ora` program.
    #[account(
        seeds = [b"ora_config"],
        seeds::program = ORA_PROGRAM_ID,
        bump,
    )]
    pub caller_ora_config: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

/// [audit fix D.M-1] helper for monotonic phase ordering.
fn phase_ord(p: &RewardPhase) -> u8 {
    match p {
        RewardPhase::Phase1Creation100 => 1,
        RewardPhase::Phase2Split70_30 => 2,
        RewardPhase::Phase3Split50_50 => 3,
    }
}

// ============ Errors ============

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid weight")]
    InvalidWeight,
    #[msg("Reward pool exhausted")]
    PoolExhausted,
    #[msg("Arithmetic overflow")]
    Overflow,
    // [audit fix C4.M-1 option-C] CPI mint primitives reject zero amount.
    #[msg("Invalid amount: must be > 0")]
    InvalidAmount,
    // [audit fix D.M-1] phase can only advance forward (or be a no-op)
    #[msg("Phase transition cannot move backward")]
    PhaseRollbackForbidden,
    // [audit fix D.M-3] mint authority mismatch detected at init
    #[msg("ORA mint authority is not the reward_state PDA")]
    MintAuthorityMismatch,
    // [audit fix D2.M-1] single-call cap to prevent one-shot drain by distributor
    #[msg("Per-call distribution cap exceeded")]
    PerCallCapExceeded,
}
