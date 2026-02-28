use anchor_lang::prelude::*;

declare_id!("VaultProgram1111111111111111111111111111111");

#[program]
pub mod aura_vault {
    use super::*;

    /// Initialize vault config (sets arbitration authority)
    pub fn initialize_vault_config(ctx: Context<InitializeVaultConfig>) -> Result<()> {
        let config = &mut ctx.accounts.vault_config;
        config.arbitration_authority = ctx.accounts.authority.key();
        config.bump = ctx.bumps.vault_config;
        msg!("Vault config initialized");
        Ok(())
    }

    /// Initialize a vesting vault for a user
    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.owner = ctx.accounts.owner.key();
        vault.pending_balance = 0;
        vault.locked_balance = 0;
        vault.total_earned = 0;
        vault.total_claimed = 0;
        vault.last_deposit_time = 0;
        vault.is_frozen = false;
        vault.bump = ctx.bumps.vault;
        msg!("Vault initialized for: {}", vault.owner);
        Ok(())
    }

    pub fn deposit_earnings(ctx: Context<DepositEarnings>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(!vault.is_frozen, ErrorCode::VaultFrozen);
        require!(amount > 0, ErrorCode::InvalidAmount);
        vault.pending_balance = vault.pending_balance.checked_add(amount).ok_or(ErrorCode::Overflow)?;
        vault.total_earned = vault.total_earned.checked_add(amount).ok_or(ErrorCode::Overflow)?;
        vault.last_deposit_time = Clock::get()?.unix_timestamp;
        msg!("Deposited {} tokens to vault", amount);
        Ok(())
    }

    pub fn spend_pending(ctx: Context<SpendPending>, amount: u64, purpose: SpendPurpose) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(!vault.is_frozen, ErrorCode::VaultFrozen);
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(vault.pending_balance >= amount, ErrorCode::InsufficientBalance);
        vault.pending_balance = vault.pending_balance.checked_sub(amount).ok_or(ErrorCode::Overflow)?;
        msg!("Spent {} tokens for {:?}", amount, purpose);
        Ok(())
    }

    pub fn claim_vested(ctx: Context<ClaimVested>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let clock = Clock::get()?;
        require!(!vault.is_frozen, ErrorCode::VaultFrozen);
        let vesting_period: i64 = 7 * 24 * 60 * 60;
        let time_elapsed = clock.unix_timestamp - vault.last_deposit_time;
        require!(time_elapsed >= vesting_period, ErrorCode::VestingPeriodNotEnded);
        require!(vault.pending_balance > 0, ErrorCode::NothingToClaim);
        let claimable = vault.pending_balance;
        vault.pending_balance = 0;
        vault.total_claimed = vault.total_claimed.checked_add(claimable).ok_or(ErrorCode::Overflow)?;
        msg!("Claimed {} vested tokens", claimable);
        Ok(())
    }

    /// FIX #5: Freeze vault - requires verified arbitration authority
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

    pub fn seize_funds(ctx: Context<SeizeFunds>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(vault.pending_balance >= amount, ErrorCode::InsufficientBalance);
        vault.pending_balance = vault.pending_balance.checked_sub(amount).ok_or(ErrorCode::Overflow)?;
        msg!("Seized {} tokens by arbitration", amount);
        Ok(())
    }
}

#[account]
pub struct VaultConfig {
    pub arbitration_authority: Pubkey,
    pub bump: u8,
}

#[account]
pub struct VestingVault {
    pub owner: Pubkey,
    pub pending_balance: u64,
    pub locked_balance: u64,
    pub total_earned: u64,
    pub total_claimed: u64,
    pub last_deposit_time: i64,
    pub is_frozen: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub enum SpendPurpose { MintNFT, AdBid, Boost, Other }

#[derive(Accounts)]
pub struct InitializeVaultConfig<'info> {
    #[account(init, payer = authority, space = 8 + 32 + 1, seeds = [b"vault_config"], bump)]
    pub vault_config: Account<'info, VaultConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(init, payer = owner, space = 8 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 1, seeds = [b"vault", owner.key().as_ref()], bump)]
    pub vault: Account<'info, VestingVault>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositEarnings<'info> {
    #[account(mut, has_one = owner @ ErrorCode::Unauthorized)]
    pub vault: Account<'info, VestingVault>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct SpendPending<'info> {
    #[account(mut, has_one = owner @ ErrorCode::Unauthorized)]
    pub vault: Account<'info, VestingVault>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimVested<'info> {
    #[account(mut, has_one = owner @ ErrorCode::Unauthorized)]
    pub vault: Account<'info, VestingVault>,
    #[account(mut)]
    pub owner: Signer<'info>,
}

// FIX #5: ArbitrationAction validates authority against VaultConfig
#[derive(Accounts)]
pub struct ArbitrationAction<'info> {
    #[account(mut)]
    pub vault: Account<'info, VestingVault>,
    #[account(
        seeds = [b"vault_config"],
        bump = vault_config.bump,
        has_one = arbitration_authority @ ErrorCode::Unauthorized
    )]
    pub vault_config: Account<'info, VaultConfig>,
    pub arbitration_authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SeizeFunds<'info> {
    #[account(mut)]
    pub vault: Account<'info, VestingVault>,
    #[account(
        seeds = [b"vault_config"],
        bump = vault_config.bump,
        has_one = arbitration_authority @ ErrorCode::Unauthorized
    )]
    pub vault_config: Account<'info, VaultConfig>,
    pub arbitration_authority: Signer<'info>,
    /// CHECK: Recipient of seized funds
    pub recipient: AccountInfo<'info>,
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
}
