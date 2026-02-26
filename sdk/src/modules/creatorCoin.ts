import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { WalletAdapter } from '@solana/wallet-adapter-base';
import {
  BuyCreatorCoinParams,
  SellCreatorCoinParams,
  CreatorCoin,
  TransactionResult,
} from '../types';
import { SEEDS } from '../constants';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';

export class CreatorCoinModule {
  constructor(
    private connection: Connection,
    private wallet: WalletAdapter,
    private programId: PublicKey
  ) {}

  /**
   * Buy creator coins
   */
  async buy(params: BuyCreatorCoinParams): Promise<TransactionResult> {
    try {
      if (!this.wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const { creatorAddress, amount } = params;

      if (amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      // Derive PDAs
      const [creatorCoinPda] = await PublicKey.findProgramAddress(
        [Buffer.from(SEEDS.CREATOR_COIN), creatorAddress.toBuffer()],
        this.programId
      );

      const [creatorCoinMintPda] = await PublicKey.findProgramAddress(
        [Buffer.from(SEEDS.CREATOR_COIN_MINT), creatorAddress.toBuffer()],
        this.programId
      );

      const [reserveVaultPda] = await PublicKey.findProgramAddress(
        [Buffer.from(SEEDS.RESERVE_VAULT), creatorAddress.toBuffer()],
        this.programId
      );

      // Get or create buyer's token account
      const buyerTokenAccount = await getAssociatedTokenAddress(
        creatorCoinMintPda,
        this.wallet.publicKey
      );

      // Create instruction data
      const instructionData = Buffer.alloc(1 + 8);
      instructionData.writeUInt8(1, 0); // Instruction discriminator for buy_creator_coin
      instructionData.writeBigUInt64LE(BigInt(amount), 1);

      // Create instruction
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: creatorCoinPda, isSigner: false, isWritable: true },
          { pubkey: creatorCoinMintPda, isSigner: false, isWritable: true },
          { pubkey: reserveVaultPda, isSigner: false, isWritable: true },
          { pubkey: buyerTokenAccount, isSigner: false, isWritable: true },
          { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: creatorAddress, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: this.programId,
        data: instructionData,
      });

      // Create and send transaction
      const transaction = new Transaction().add(instruction);
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.wallet.publicKey;

      const signature = await this.wallet.sendTransaction(transaction, this.connection);
      await this.connection.confirmTransaction(signature);

      return {
        signature,
        success: true,
      };
    } catch (error) {
      return {
        signature: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Sell creator coins
   */
  async sell(params: SellCreatorCoinParams): Promise<TransactionResult> {
    try {
      if (!this.wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const { creatorAddress, amount } = params;

      if (amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      // Derive PDAs
      const [creatorCoinPda] = await PublicKey.findProgramAddress(
        [Buffer.from(SEEDS.CREATOR_COIN), creatorAddress.toBuffer()],
        this.programId
      );

      const [creatorCoinMintPda] = await PublicKey.findProgramAddress(
        [Buffer.from(SEEDS.CREATOR_COIN_MINT), creatorAddress.toBuffer()],
        this.programId
      );

      const [reserveVaultPda] = await PublicKey.findProgramAddress(
        [Buffer.from(SEEDS.RESERVE_VAULT), creatorAddress.toBuffer()],
        this.programId
      );

      // Get seller's token account
      const sellerTokenAccount = await getAssociatedTokenAddress(
        creatorCoinMintPda,
        this.wallet.publicKey
      );

      // Create instruction data
      const instructionData = Buffer.alloc(1 + 8);
      instructionData.writeUInt8(2, 0); // Instruction discriminator for sell_creator_coin
      instructionData.writeBigUInt64LE(BigInt(amount), 1);

      // Create instruction
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: creatorCoinPda, isSigner: false, isWritable: true },
          { pubkey: creatorCoinMintPda, isSigner: false, isWritable: true },
          { pubkey: reserveVaultPda, isSigner: false, isWritable: true },
          { pubkey: sellerTokenAccount, isSigner: false, isWritable: true },
          { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: creatorAddress, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: this.programId,
        data: instructionData,
      });

      // Create and send transaction
      const transaction = new Transaction().add(instruction);
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.wallet.publicKey;

      const signature = await this.wallet.sendTransaction(transaction, this.connection);
      await this.connection.confirmTransaction(signature);

      return {
        signature,
        success: true,
      };
    } catch (error) {
      return {
        signature: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get creator coin information
   */
  async getCreatorCoin(creatorAddress: PublicKey): Promise<CreatorCoin | null> {
    try {
      const [creatorCoinPda] = await PublicKey.findProgramAddress(
        [Buffer.from(SEEDS.CREATOR_COIN), creatorAddress.toBuffer()],
        this.programId
      );

      const accountInfo = await this.connection.getAccountInfo(creatorCoinPda);
      if (!accountInfo) {
        return null;
      }

      const data = accountInfo.data;
      let offset = 8; // Skip discriminator

      // Parse creator coin data
      const creator = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;

      const mint = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;

      const symbolLength = data.readUInt32LE(offset);
      offset += 4;
      const symbol = data.slice(offset, offset + symbolLength).toString();
      offset += symbolLength;

      const totalSupply = Number(data.readBigUInt64LE(offset));
      offset += 8;

      const reserveBalance = Number(data.readBigUInt64LE(offset));
      offset += 8;

      const curveType = data.readUInt8(offset);
      offset += 1;

      const curveParamK = Number(data.readBigUInt64LE(offset));
      offset += 8;

      const curveParamN = data.readUInt32LE(offset);
      offset += 4;

      const creatorFeeBps = data.readUInt16LE(offset);
      offset += 2;

      const totalFeesCollected = Number(data.readBigUInt64LE(offset));
      offset += 8;

      const createdAt = Number(data.readBigInt64LE(offset));

      return {
        creator,
        mint,
        symbol,
        totalSupply,
        reserveBalance,
        curveType,
        curveParamK,
        curveParamN,
        creatorFeeBps,
        totalFeesCollected,
        createdAt,
      };
    } catch (error) {
      console.error('Error fetching creator coin:', error);
      return null;
    }
  }

  /**
   * Calculate buy price for a given amount
   */
  async calculateBuyPrice(
    creatorAddress: PublicKey,
    amount: number
  ): Promise<number | null> {
    try {
      const creatorCoin = await this.getCreatorCoin(creatorAddress);
      if (!creatorCoin) {
        return null;
      }

      // Simplified price calculation (actual calculation uses bonding curve integration)
      // Price = k * Supply^n
      const { totalSupply, curveParamK, curveParamN } = creatorCoin;
      
      // Calculate integral: ∫ k * x^n dx from supply to supply+amount
      const endSupply = totalSupply + amount;
      const nPlus1 = curveParamN + 1;
      
      const endValue = (curveParamK * Math.pow(endSupply, nPlus1)) / nPlus1;
      const startValue = totalSupply === 0 ? 0 : (curveParamK * Math.pow(totalSupply, nPlus1)) / nPlus1;
      
      const totalCost = endValue - startValue;
      
      return Math.floor(totalCost);
    } catch (error) {
      console.error('Error calculating buy price:', error);
      return null;
    }
  }

  /**
   * Calculate sell price for a given amount
   */
  async calculateSellPrice(
    creatorAddress: PublicKey,
    amount: number
  ): Promise<number | null> {
    try {
      const creatorCoin = await this.getCreatorCoin(creatorAddress);
      if (!creatorCoin) {
        return null;
      }

      const { totalSupply, curveParamK, curveParamN } = creatorCoin;
      
      if (totalSupply < amount) {
        return null;
      }
      
      const newSupply = totalSupply - amount;
      const nPlus1 = curveParamN + 1;
      
      const endValue = (curveParamK * Math.pow(totalSupply, nPlus1)) / nPlus1;
      const startValue = newSupply === 0 ? 0 : (curveParamK * Math.pow(newSupply, nPlus1)) / nPlus1;
      
      const totalReturn = endValue - startValue;
      
      return Math.floor(totalReturn);
    } catch (error) {
      console.error('Error calculating sell price:', error);
      return null;
    }
  }
}
