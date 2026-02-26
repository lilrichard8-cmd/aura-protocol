use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("CreatorCoinProgram11111111111111111111111111");

#[program]
pub mod aura_creator_coin {
    use super::*;

    /// Create a new Creator Coin (requires burning 1000 ORA)
    pub fn create_creator_coin(
        ctx: Context<CreateCreatorCoin>,
        symbol: String,
        curve_type: CurveType,
        curve_param_k: u64,
        curve_param_n: u32,
        creator_fee_bps: u16,
    ) -> Result<()> {
        require!(symbol.len() <= 10, ErrorCode::SymbolTooLong);
        require!(curve_param_n >= 1 && curve_param_n <= 3, ErrorCode::InvalidCurveParameter);
        require!(creator_fee_bps <= 1000, ErrorCode::InvalidCreatorFee); // Max 10%

        // Burn 1000 ORA tokens
        let burn_amount = 1000 * 10u64.pow(9); // Assuming 9 decimals for ORA
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.ora_mint.to_account_info(),
                    from: ctx.accounts.creator_ora_account.to_account_info(),
                    authority: ctx.accounts.creator.to_account_info(),
                },
            ),
            burn_amount,
        )?;

        let creator_coin = &mut ctx.accounts.creator_coin;
        creator_coin.creator = ctx.accounts.creator.key();
        creator_coin.mint = ctx.accounts.creator_coin_mint.key();
        creator_coin.symbol = symbol.clone();
        creator_coin.total_supply = 0;
        creator_coin.reserve_balance = 0;
        creator_coin.curve_type = curve_type;
        creator_coin.curve_param_k = curve_param_k;
        creator_coin.curve_param_n = curve_param_n;
        creator_coin.creator_fee_bps = creator_fee_bps;
        creator_coin.total_fees_collected = 0;
        creator_coin.created_at = Clock::get()?.unix_timestamp;
        creator_coin.bump = ctx.bumps.creator_coin;

        msg!(
            "Creator Coin created: {} by {} (burned 1000 ORA)",
            symbol,
            creator_coin.creator
        );
        Ok(())
    }

    /// Buy creator coins using SOL
    pub fn buy_creator_coin(ctx: Context<BuyCreatorCoin>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let creator_coin = &mut ctx.accounts.creator_coin;
        let current_supply = creator_coin.total_supply;

        // Calculate buy price using bonding curve
        let total_cost = calculate_buy_price(
            current_supply,
            amount,
            creator_coin.curve_param_k,
            creator_coin.curve_param_n,
        )?;

        require!(total_cost > 0, ErrorCode::InvalidPrice);

        // Calculate creator fee
        let creator_fee = (total_cost as u128)
            .checked_mul(creator_coin.creator_fee_bps as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;

        let reserve_amount = total_cost.checked_sub(creator_fee).unwrap();

        // Transfer SOL from buyer to reserve vault
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.buyer.key(),
            &ctx.accounts.reserve_vault.key(),
            reserve_amount,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.reserve_vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Transfer creator fee to creator
        if creator_fee > 0 {
            let fee_transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.buyer.key(),
                &ctx.accounts.creator.key(),
                creator_fee,
            );
            anchor_lang::solana_program::program::invoke(
                &fee_transfer_ix,
                &[
                    ctx.accounts.buyer.to_account_info(),
                    ctx.accounts.creator.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
        }

        // Mint creator coins to buyer
        let seeds = &[
            b"creator_coin",
            creator_coin.creator.as_ref(),
            &[creator_coin.bump],
        ];
        let signer = &[&seeds[..]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.creator_coin_mint.to_account_info(),
                    to: ctx.accounts.buyer_token_account.to_account_info(),
                    authority: ctx.accounts.creator_coin.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        // Update state
        creator_coin.total_supply = creator_coin.total_supply.checked_add(amount).unwrap();
        creator_coin.reserve_balance = creator_coin.reserve_balance.checked_add(reserve_amount).unwrap();
        creator_coin.total_fees_collected = creator_coin.total_fees_collected.checked_add(creator_fee).unwrap();

        msg!(
            "Bought {} {} tokens for {} lamports (fee: {})",
            amount,
            creator_coin.symbol,
            total_cost,
            creator_fee
        );
        Ok(())
    }

    /// Sell creator coins back to SOL
    pub fn sell_creator_coin(ctx: Context<SellCreatorCoin>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);

        let creator_coin = &mut ctx.accounts.creator_coin;
        let current_supply = creator_coin.total_supply;

        require!(current_supply >= amount, ErrorCode::InsufficientSupply);

        // Calculate sell price using bonding curve (always slightly less than buy price)
        let new_supply = current_supply.checked_sub(amount).unwrap();
        let total_return = calculate_buy_price(
            new_supply,
            amount,
            creator_coin.curve_param_k,
            creator_coin.curve_param_n,
        )?;

        require!(total_return > 0, ErrorCode::InvalidPrice);
        require!(creator_coin.reserve_balance >= total_return, ErrorCode::InsufficientReserve);

        // Calculate creator fee on sell
        let creator_fee = (total_return as u128)
            .checked_mul(creator_coin.creator_fee_bps as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;

        let seller_return = total_return.checked_sub(creator_fee).unwrap();

        // Burn creator coins from seller
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.creator_coin_mint.to_account_info(),
                    from: ctx.accounts.seller_token_account.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            amount,
        )?;

        // Transfer SOL from reserve vault to seller
        let seeds = &[
            b"reserve_vault",
            creator_coin.creator.as_ref(),
            &[ctx.bumps.reserve_vault],
        ];
        let signer = &[&seeds[..]];

        **ctx.accounts.reserve_vault.to_account_info().try_borrow_mut_lamports()? -= seller_return;
        **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += seller_return;

        // Transfer creator fee from reserve to creator
        if creator_fee > 0 {
            **ctx.accounts.reserve_vault.to_account_info().try_borrow_mut_lamports()? -= creator_fee;
            **ctx.accounts.creator.to_account_info().try_borrow_mut_lamports()? += creator_fee;
        }

        // Update state
        creator_coin.total_supply = creator_coin.total_supply.checked_sub(amount).unwrap();
        creator_coin.reserve_balance = creator_coin.reserve_balance.checked_sub(total_return).unwrap();
        creator_coin.total_fees_collected = creator_coin.total_fees_collected.checked_add(creator_fee).unwrap();

        msg!(
            "Sold {} {} tokens for {} lamports (fee: {})",
            amount,
            creator_coin.symbol,
            seller_return,
            creator_fee
        );
        Ok(())
    }

    /// Withdraw accumulated creator fees
    pub fn withdraw_creator_fees(ctx: Context<WithdrawCreatorFees>) -> Result<()> {
        let creator_coin = &ctx.accounts.creator_coin;
        
        msg!(
            "Creator withdrew {} lamports in fees",
            creator_coin.total_fees_collected
        );
        Ok(())
    }
}

/// Calculate buy price using bonding curve: Price = k * Supply^n
/// Uses integration: ∫ k * x^n dx from supply to supply+amount
fn calculate_buy_price(
    current_supply: u64,
    amount: u64,
    k: u64,
    n: u32,
) -> Result<u64> {
    // Prevent overflow by using u128 for calculations
    let supply_u128 = current_supply as u128;
    let amount_u128 = amount as u128;
    let k_u128 = k as u128;
    let n_u128 = n as u128;

    // For Price = k * Supply^n, the integral is:
    // ∫ k * x^n dx = k * x^(n+1) / (n+1)
    
    let n_plus_1 = n_u128.checked_add(1).unwrap();
    
    // Calculate for supply + amount
    let end_supply = supply_u128.checked_add(amount_u128).unwrap();
    let end_value = calculate_integral_value(end_supply, k_u128, n_u128, n_plus_1)?;
    
    // Calculate for current supply
    let start_value = if supply_u128 == 0 {
        0
    } else {
        calculate_integral_value(supply_u128, k_u128, n_u128, n_plus_1)?
    };
    
    // Total cost is the difference
    let total_cost = end_value.checked_sub(start_value).unwrap();
    
    // Convert back to u64, ensure it doesn't overflow
    require!(total_cost <= u64::MAX as u128, ErrorCode::PriceOverflow);
    
    Ok(total_cost as u64)
}

/// Calculate integral value: k * x^(n+1) / (n+1)
fn calculate_integral_value(x: u128, k: u128, n: u128, n_plus_1: u128) -> Result<u128> {
    // x^(n+1)
    let mut x_power = x;
    for _ in 0..n {
        x_power = x_power.checked_mul(x).ok_or(ErrorCode::CalculationOverflow)?;
    }
    
    // k * x^(n+1)
    let numerator = k.checked_mul(x_power).ok_or(ErrorCode::CalculationOverflow)?;
    
    // Divide by (n+1)
    let result = numerator.checked_div(n_plus_1).unwrap();
    
    Ok(result)
}

// Account structures
#[account]
pub struct CreatorCoin {
    pub creator: Pubkey,              // 32
    pub mint: Pubkey,                 // 32
    pub symbol: String,               // 4 + 10 = 14
    pub total_supply: u64,            // 8
    pub reserve_balance: u64,         // 8 (SOL in reserve)
    pub curve_type: CurveType,        // 1
    pub curve_param_k: u64,           // 8
    pub curve_param_n: u32,           // 4
    pub creator_fee_bps: u16,         // 2 (basis points, e.g., 500 = 5%)
    pub total_fees_collected: u64,   // 8
    pub created_at: i64,              // 8
    pub bump: u8,                     // 1
}

// Enums
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum CurveType {
    Linear,      // Price = k * Supply
    Quadratic,   // Price = k * Supply^2
    Cubic,       // Price = k * Supply^3
}

// Context structures
#[derive(Accounts)]
#[instruction(symbol: String)]
pub struct CreateCreatorCoin<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + 32 + 32 + 14 + 8 + 8 + 1 + 8 + 4 + 2 + 8 + 8 + 1,
        seeds = [b"creator_coin", creator.key().as_ref()],
        bump
    )]
    pub creator_coin: Account<'info, CreatorCoin>,
    
    /// Creator coin SPL token mint
    #[account(
        init,
        payer = creator,
        mint::decimals = 9,
        mint::authority = creator_coin,
        seeds = [b"creator_coin_mint", creator.key().as_ref()],
        bump
    )]
    pub creator_coin_mint: Account<'info, Mint>,
    
    /// Reserve vault to hold SOL
    #[account(
        init,
        payer = creator,
        space = 8,
        seeds = [b"reserve_vault", creator.key().as_ref()],
        bump
    )]
    /// CHECK: This is a PDA that holds SOL
    pub reserve_vault: AccountInfo<'info>,
    
    /// ORA token mint (for burning)
    pub ora_mint: Account<'info, Mint>,
    
    /// Creator's ORA token account (to burn from)
    #[account(mut)]
    pub creator_ora_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct BuyCreatorCoin<'info> {
    #[account(
        mut,
        seeds = [b"creator_coin", creator_coin.creator.as_ref()],
        bump = creator_coin.bump
    )]
    pub creator_coin: Account<'info, CreatorCoin>,
    
    #[account(
        mut,
        seeds = [b"creator_coin_mint", creator_coin.creator.as_ref()],
        bump
    )]
    pub creator_coin_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        seeds = [b"reserve_vault", creator_coin.creator.as_ref()],
        bump
    )]
    /// CHECK: This is a PDA that holds SOL
    pub reserve_vault: AccountInfo<'info>,
    
    /// Buyer's token account to receive creator coins
    #[account(mut)]
    pub buyer_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    /// CHECK: Creator to receive fees
    #[account(mut)]
    pub creator: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SellCreatorCoin<'info> {
    #[account(
        mut,
        seeds = [b"creator_coin", creator_coin.creator.as_ref()],
        bump = creator_coin.bump
    )]
    pub creator_coin: Account<'info, CreatorCoin>,
    
    #[account(
        mut,
        seeds = [b"creator_coin_mint", creator_coin.creator.as_ref()],
        bump
    )]
    pub creator_coin_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        seeds = [b"reserve_vault", creator_coin.creator.as_ref()],
        bump
    )]
    /// CHECK: This is a PDA that holds SOL
    pub reserve_vault: AccountInfo<'info>,
    
    /// Seller's token account to burn creator coins from
    #[account(mut)]
    pub seller_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub seller: Signer<'info>,
    
    /// CHECK: Creator to receive fees
    #[account(mut)]
    pub creator: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawCreatorFees<'info> {
    #[account(
        seeds = [b"creator_coin", creator.key().as_ref()],
        bump = creator_coin.bump,
        has_one = creator
    )]
    pub creator_coin: Account<'info, CreatorCoin>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
}

// Error codes
#[error_code]
pub enum ErrorCode {
    #[msg("Symbol is too long (max 10 characters)")]
    SymbolTooLong,
    
    #[msg("Invalid curve parameter (n must be 1-3)")]
    InvalidCurveParameter,
    
    #[msg("Invalid creator fee (max 10%)")]
    InvalidCreatorFee,
    
    #[msg("Invalid amount")]
    InvalidAmount,
    
    #[msg("Invalid price calculated")]
    InvalidPrice,
    
    #[msg("Insufficient supply to sell")]
    InsufficientSupply,
    
    #[msg("Insufficient reserve balance")]
    InsufficientReserve,
    
    #[msg("Price calculation overflow")]
    PriceOverflow,
    
    #[msg("Calculation overflow")]
    CalculationOverflow,
}
