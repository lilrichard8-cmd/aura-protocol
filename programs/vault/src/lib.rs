use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("9sefu7Jr4kAdASSro3AHpTp7XVcShveDntZWvPeJczNL");

// =============================================================================
// [audit fix C-V1 / H-V1 / C-V2] Hardcoded protocol authority + treasury.
// ⚠️ DO NOT DEPLOY — placeholders set to system_program::ID. Replace pre-mainnet
// with the real ORA multisig / treasury pubkeys.
// =============================================================================

/// Program admin allowed to initialise vault config. Prevents front-run init.
pub const PROGRAM_ADMIN: Pubkey = anchor_lang::solana_program::system_program::ID;

/// Hardcoded arbitration multisig — the only signer authorised to freeze /
/// unfreeze / seize. Set at deployment, can be rotated by `rotate_arbitration_authority`.
pub const INITIAL_ARBITRATION_AUTHORITY: Pubkey = anchor_lang::solana_program::system_program::ID;

/// Hardcoded protocol treasury that receives seized funds.
/// [audit fix C-V2] `seize_funds` can ONLY transfer to this address.
pub const TREASURY: Pubkey = anchor_lang::solana_program::system_program::ID;

/// Canonical ORA SPL mint. All vaults are restricted to this mint so creator
/// payouts cannot be denominated in attacker-controlled tokens.
/// [audit fix round2 R2-H-V1] `InitializeVault.ora_mint` is bound to this.
pub const ORA_MINT: Pubkey = anchor_lang::solana_program::system_program::ID;

/// Vesting period (7 days). Gates `claim_vested` AND `spend_pending`.
/// [audit fix round2 R2-C-V1] `spend_pending` shares the same vesting gate as
/// `claim_vested` so unvested funds cannot be exfiltrated.
pub const VESTING_PERIOD_SECS: i64 = 7 * 24 * 60 * 60;

/// [audit fix R2-M-V1] Deposits made in the final 24h of an existing vesting
/// clock are rejected. Without this guard, a third-party platform that
/// auto-deposits creator earnings could be raced into the "oldest-deposit
/// vested = everything claimable" window, letting a large fresh deposit
/// claim instantly. Forcing late deposits to wait for the next vesting cycle
/// gives them their own full 7-day vest.
pub const DEPOSIT_BLACKOUT_SECS: i64 = 24 * 60 * 60;

#[program]
pub mod aura_vault {
    use super::*;

    /// Initialize vault config (sets arbitration authority).
    /// [audit fix C-V1] Caller MUST equal hardcoded PROGRAM_ADMIN — prevents
    /// front-run init attack where an attacker becomes arbitration authority
    /// for every vault in the program.
    pub fn initialize_vault_config(ctx: Context<InitializeVaultConfig>) -> Result<()> {
        let config = &mut ctx.accounts.vault_config;
        config.admin = ctx.accounts.admin.key();
        config.arbitration_authority = INITIAL_ARBITRATION_AUTHORITY;
        config.bump = ctx.bumps.vault_config;
        msg!("Vault config initialized with arbitration authority = {}", config.arbitration_authority);
        Ok(())
    }

    /// [audit fix H-V2] Rotate the arbitration authority. Only PROGRAM_ADMIN
    /// can call this. Mirrors `rotate_official_authority` from market V2.
    pub fn rotate_arbitration_authority(
        ctx: Context<RotateArbitrationAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.vault_config;
        config.arbitration_authority = new_authority;
        msg!("Arbitration authority rotated to: {}", new_authority);
        Ok(())
    }

    /// Initialize a vesting vault for a user.
    /// [audit fix C-V2/C-V3] Each vault now has a backing token escrow PDA
    /// (`vault_token_account`) owned by the vault PDA. All deposits / claims /
    /// seizures move real SPL tokens through this escrow.
    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.owner = ctx.accounts.owner.key();
        vault.ora_mint = ctx.accounts.ora_mint.key();
        vault.pending_balance = 0;
        vault.locked_balance = 0;
        vault.total_earned = 0;
        vault.total_claimed = 0;
        vault.first_unvested_deposit_time = 0;
        vault.is_frozen = false;
        vault.bump = ctx.bumps.vault;
        msg!("Vault initialized for: {}", vault.owner);
        Ok(())
    }

    /// Deposit ORA into the vault. Transfers tokens to the escrow ATA.
    /// [audit fix C-V4] We track `first_unvested_deposit_time` (the timestamp
    /// of the OLDEST unclaimed deposit) instead of `last_deposit_time`. This
    /// means a new deposit no longer resets the vesting clock for tokens that
    /// were already in the vault — eliminating the "tip-to-stall" DoS.
    ///
    /// Trade-off: this is "pooled" vesting — the entire pending balance
    /// becomes claimable when the OLDEST deposit reaches the vest period.
    /// Once claimed, the clock restarts for the next deposit batch.
    pub fn deposit_earnings(ctx: Context<DepositEarnings>, amount: u64) -> Result<()> {
        require!(!ctx.accounts.vault.is_frozen, ErrorCode::VaultFrozen);
        require!(amount > 0, ErrorCode::InvalidAmount);

        let now = Clock::get()?.unix_timestamp;
        // [audit fix R2-M-V1] Reject deposits made in the final 24h of the
        // current vesting clock. The depositor must wait for the owner to
        // claim (which resets the clock to 0) so their tokens get a fresh
        // 7-day vest. Prevents "instant-claim" griefing where a fresh deposit
        // rides someone else's almost-complete vest.
        let first = ctx.accounts.vault.first_unvested_deposit_time;
        if first > 0 {
            let elapsed = now.checked_sub(first).ok_or(ErrorCode::Overflow)?;
            require!(
                elapsed < VESTING_PERIOD_SECS - DEPOSIT_BLACKOUT_SECS,
                ErrorCode::DepositBlackout
            );
        }

        // [audit fix C-V2] real SPL transfer into the vault escrow.
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.source_token_account.to_account_info(),
                    to: ctx.accounts.vault_token_account.to_account_info(),
                    authority: ctx.accounts.depositor.to_account_info(),
                },
            ),
            amount,
        )?;

        let vault = &mut ctx.accounts.vault;
        vault.pending_balance = vault.pending_balance.checked_add(amount).ok_or(ErrorCode::Overflow)?;
        vault.total_earned = vault.total_earned.checked_add(amount).ok_or(ErrorCode::Overflow)?;
        // [audit fix C-V4] only set on first-deposit-since-claim; never reset
        // by a subsequent deposit while pending_balance > previous.
        if vault.first_unvested_deposit_time == 0 {
            vault.first_unvested_deposit_time = now;
        }
        msg!("Deposited {} tokens to vault", amount);
        Ok(())
    }

    /// [audit fix round2 R2-C-V1] `spend_pending` now enforces the SAME
    /// 7-day vesting gate as `claim_vested`. Previously the only debit-path
    /// that bypassed vesting; that bypass let the owner route the entire
    /// pending_balance to their own ATA before the vest window, defeating
    /// the program's stated guarantee.
    ///
    /// The instruction still exists so vested funds can be spent on
    /// non-claim purposes (NFT mint, ad bid, etc.) without first round-
    /// tripping through the owner ATA. Vesting parity is the invariant.
    pub fn spend_pending(ctx: Context<SpendPending>, amount: u64, purpose: SpendPurpose) -> Result<()> {
        require!(!ctx.accounts.vault.is_frozen, ErrorCode::VaultFrozen);
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(ctx.accounts.vault.pending_balance >= amount, ErrorCode::InsufficientBalance);

        // [audit fix round2 R2-C-V1] gate on the same vesting clock as
        // claim_vested.
        let clock = Clock::get()?;
        let first = ctx.accounts.vault.first_unvested_deposit_time;
        require!(first > 0, ErrorCode::NothingToClaim);
        let time_elapsed = clock
            .unix_timestamp
            .checked_sub(first)
            .ok_or(ErrorCode::Overflow)?;
        require!(
            time_elapsed >= VESTING_PERIOD_SECS,
            ErrorCode::VestingPeriodNotEnded
        );

        let vault_key = ctx.accounts.vault.key();
        let bump = ctx.accounts.vault.bump;
        let owner_key = ctx.accounts.vault.owner;
        let owner_bytes = owner_key.to_bytes();
        let seeds: [&[u8]; 3] = [b"vault", owner_bytes.as_ref(), std::slice::from_ref(&bump)];
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.destination_token_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        let vault = &mut ctx.accounts.vault;
        vault.pending_balance = vault.pending_balance.checked_sub(amount).ok_or(ErrorCode::Overflow)?;
        // [audit fix round2 R2-C-V1] Any partial spend after vesting completes
        // resets the clock so leftover dust can't anchor a future deposit's
        // vesting timestamp to a long-past date. Only fresh deposits start a
        // new clock.
        vault.first_unvested_deposit_time = 0;
        msg!("Spent {} tokens (vault={}) for {:?}", amount, vault_key, purpose);
        Ok(())
    }

    /// Claim vested earnings.
    /// [audit fix C-V3] Performs a REAL SPL transfer from vault escrow to the
    /// owner's ATA — previously this was a counter no-op.
    pub fn claim_vested(ctx: Context<ClaimVested>) -> Result<()> {
        require!(!ctx.accounts.vault.is_frozen, ErrorCode::VaultFrozen);

        let clock = Clock::get()?;
        let first = ctx.accounts.vault.first_unvested_deposit_time;
        require!(first > 0, ErrorCode::NothingToClaim);
        let time_elapsed = clock.unix_timestamp.checked_sub(first).ok_or(ErrorCode::Overflow)?;
        require!(time_elapsed >= VESTING_PERIOD_SECS, ErrorCode::VestingPeriodNotEnded);
        let claimable = ctx.accounts.vault.pending_balance;
        require!(claimable > 0, ErrorCode::NothingToClaim);

        let bump = ctx.accounts.vault.bump;
        let owner_key = ctx.accounts.vault.owner;
        let owner_bytes = owner_key.to_bytes();
        let seeds: [&[u8]; 3] = [b"vault", owner_bytes.as_ref(), std::slice::from_ref(&bump)];
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.owner_token_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer,
            ),
            claimable,
        )?;

        let vault = &mut ctx.accounts.vault;
        vault.pending_balance = 0;
        vault.first_unvested_deposit_time = 0; // [audit fix C-V4] reset clock
        vault.total_claimed = vault.total_claimed.checked_add(claimable).ok_or(ErrorCode::Overflow)?;
        msg!("Claimed {} vested tokens", claimable);
        Ok(())
    }

    /// Freeze vault. Only the arbitration authority can call.
    pub fn freeze_vault(ctx: Context<ArbitrationAction>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.is_frozen = true;
        msg!("Vault frozen by arbitration");
        Ok(())
    }

    pub fn unfreeze_vault(ctx: Context<ArbitrationAction>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.is_frozen = false;
        msg!("Vault unfrozen by arbitration");
        Ok(())
    }

    /// Seize pending balance to the protocol TREASURY.
    /// [audit fix C-V2] Performs a real SPL transfer; the recipient is bound
    /// to the hardcoded TREASURY constant so the arbitration authority cannot
    /// redirect seized funds.
    pub fn seize_funds(ctx: Context<SeizeFunds>, amount: u64) -> Result<()> {
        require!(ctx.accounts.vault.pending_balance >= amount, ErrorCode::InsufficientBalance);

        let bump = ctx.accounts.vault.bump;
        let owner_key = ctx.accounts.vault.owner;
        let owner_bytes = owner_key.to_bytes();
        let seeds: [&[u8]; 3] = [b"vault", owner_bytes.as_ref(), std::slice::from_ref(&bump)];
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.treasury_token_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        let vault = &mut ctx.accounts.vault;
        vault.pending_balance = vault.pending_balance.checked_sub(amount).ok_or(ErrorCode::Overflow)?;
        if vault.pending_balance == 0 {
            vault.first_unvested_deposit_time = 0;
        }
        msg!("Seized {} tokens to treasury", amount);
        Ok(())
    }
}

#[account]
pub struct VaultConfig {
    pub admin: Pubkey,                  // 32 — set to PROGRAM_ADMIN at init
    pub arbitration_authority: Pubkey,  // 32
    pub bump: u8,                       // 1
}

impl VaultConfig {
    pub const SIZE: usize = 8 + 32 + 32 + 1;
}

#[account]
pub struct VestingVault {
    pub owner: Pubkey,                       // 32
    pub ora_mint: Pubkey,                    // 32
    pub pending_balance: u64,                // 8
    pub locked_balance: u64,                 // 8 (reserved)
    pub total_earned: u64,                   // 8
    pub total_claimed: u64,                  // 8
    pub first_unvested_deposit_time: i64,    // 8 — [audit fix C-V4]
    pub is_frozen: bool,                     // 1
    pub bump: u8,                            // 1
}

impl VestingVault {
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum SpendPurpose { MintNFT, AdBid, Boost, Other }

#[derive(Accounts)]
pub struct InitializeVaultConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = VaultConfig::SIZE,
        seeds = [b"vault_config"],
        bump,
    )]
    pub vault_config: Account<'info, VaultConfig>,
    // [audit fix C-V1] hardcoded admin gate prevents front-run.
    #[account(mut, address = PROGRAM_ADMIN @ ErrorCode::Unauthorized)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RotateArbitrationAuthority<'info> {
    #[account(
        mut,
        seeds = [b"vault_config"],
        bump = vault_config.bump,
    )]
    pub vault_config: Account<'info, VaultConfig>,
    // [audit fix H-V2] only the hardcoded PROGRAM_ADMIN can rotate (NOT the
    // stored cfg.admin, which could have been set by an attacker pre-fix).
    #[account(address = PROGRAM_ADMIN @ ErrorCode::Unauthorized)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = owner,
        space = VestingVault::SIZE,
        seeds = [b"vault", owner.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, VestingVault>,

    /// [audit fix C-V2/C-V3] the escrow ATA owned by the vault PDA. All
    /// deposits / claims / seizures CPI-transfer through this account.
    #[account(
        init,
        payer = owner,
        token::mint = ora_mint,
        token::authority = vault,
        seeds = [b"vault_token", owner.key().as_ref()],
        bump,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    // [audit fix round2 R2-H-V1] Pin ora_mint to the canonical ORA mint so
    // fake mints cannot back "vaults" and mislead off-chain indexers.
    #[account(address = ORA_MINT @ ErrorCode::Unauthorized)]
    pub ora_mint: Account<'info, anchor_spl::token::Mint>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct DepositEarnings<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.owner.as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, VestingVault>,

    #[account(
        mut,
        seeds = [b"vault_token", vault.owner.as_ref()],
        bump,
        constraint = vault_token_account.owner == vault.key() @ ErrorCode::Unauthorized,
        constraint = vault_token_account.mint == vault.ora_mint @ ErrorCode::Unauthorized,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = source_token_account.owner == depositor.key() @ ErrorCode::Unauthorized,
        constraint = source_token_account.mint == vault.ora_mint @ ErrorCode::Unauthorized,
    )]
    pub source_token_account: Account<'info, TokenAccount>,

    /// Anyone can deposit earnings to a vault (creator earnings come from the
    /// protocol). Authority for the token transfer is `depositor`.
    pub depositor: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SpendPending<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ ErrorCode::Unauthorized,
    )]
    pub vault: Account<'info, VestingVault>,

    #[account(
        mut,
        seeds = [b"vault_token", vault.owner.as_ref()],
        bump,
        constraint = vault_token_account.owner == vault.key() @ ErrorCode::Unauthorized,
        constraint = vault_token_account.mint == vault.ora_mint @ ErrorCode::Unauthorized,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = destination_token_account.mint == vault.ora_mint @ ErrorCode::Unauthorized,
    )]
    pub destination_token_account: Account<'info, TokenAccount>,

    pub owner: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimVested<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ ErrorCode::Unauthorized,
    )]
    pub vault: Account<'info, VestingVault>,

    #[account(
        mut,
        seeds = [b"vault_token", vault.owner.as_ref()],
        bump,
        constraint = vault_token_account.owner == vault.key() @ ErrorCode::Unauthorized,
        constraint = vault_token_account.mint == vault.ora_mint @ ErrorCode::Unauthorized,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = owner_token_account.owner == owner.key() @ ErrorCode::Unauthorized,
        constraint = owner_token_account.mint == vault.ora_mint @ ErrorCode::Unauthorized,
    )]
    pub owner_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// [audit fix H-V1] ArbitrationAction validates the signer matches
// `vault_config.arbitration_authority` (which is hardcoded at init and only
// rotatable by PROGRAM_ADMIN).
#[derive(Accounts)]
pub struct ArbitrationAction<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.owner.as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, VestingVault>,
    #[account(
        seeds = [b"vault_config"],
        bump = vault_config.bump,
        constraint = vault_config.arbitration_authority == arbitration_authority.key() @ ErrorCode::Unauthorized
    )]
    pub vault_config: Account<'info, VaultConfig>,
    pub arbitration_authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SeizeFunds<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.owner.as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, VestingVault>,

    #[account(
        mut,
        seeds = [b"vault_token", vault.owner.as_ref()],
        bump,
        constraint = vault_token_account.owner == vault.key() @ ErrorCode::Unauthorized,
        constraint = vault_token_account.mint == vault.ora_mint @ ErrorCode::Unauthorized,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"vault_config"],
        bump = vault_config.bump,
        constraint = vault_config.arbitration_authority == arbitration_authority.key() @ ErrorCode::Unauthorized
    )]
    pub vault_config: Account<'info, VaultConfig>,

    pub arbitration_authority: Signer<'info>,

    /// [audit fix C-V2] seized funds MUST go to the hardcoded TREASURY token
    /// account. The arbitration authority can't redirect to themselves.
    #[account(
        mut,
        address = TREASURY @ ErrorCode::Unauthorized,
        constraint = treasury_token_account.mint == vault.ora_mint @ ErrorCode::Unauthorized,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Vault is frozen")] VaultFrozen,
    #[msg("Invalid amount")] InvalidAmount,
    #[msg("Insufficient balance")] InsufficientBalance,
    #[msg("Vesting period not ended (7 days)")] VestingPeriodNotEnded,
    #[msg("Nothing to claim")] NothingToClaim,
    #[msg("Unauthorized")] Unauthorized,
    #[msg("Overflow")] Overflow,
    /// [audit fix R2-M-V1] Deposit rejected because the vault is within the
    /// final 24h of its current vesting clock. Wait for the owner to claim.
    #[msg("Deposit blackout: vault is within the final 24h of vest")] DepositBlackout,
}
