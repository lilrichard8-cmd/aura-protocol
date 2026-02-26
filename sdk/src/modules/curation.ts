import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import { WalletAdapter } from '@solana/wallet-adapter-base';
import {
  CurateParams,
  ClaimCurationRewardParams,
  CurationRecord,
  CurationPool,
  TransactionResult,
} from '../types';
import { SEEDS } from '../constants';

export class CurationModule {
  constructor(
    private connection: Connection,
    private wallet: WalletAdapter,
    private programId: PublicKey
  ) {}

  /**
   * Curate content (like + record discovery time)
   */
  async curate(params: CurateParams): Promise<TransactionResult> {
    try {
      if (!this.wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const { contentId } = params;

      // Derive PDAs
      const [curationPoolPda] = await PublicKey.findProgramAddress(
        [Buffer.from(SEEDS.CURATION_POOL), contentId.toBuffer()],
        this.programId
      );

      const [curationRecordPda] = await PublicKey.findProgramAddress(
        [
          Buffer.from(SEEDS.CURATION_RECORD),
          contentId.toBuffer(),
          this.wallet.publicKey.toBuffer(),
        ],
        this.programId
      );

      // Check if curation pool exists
      const poolInfo = await this.connection.getAccountInfo(curationPoolPda);
      if (!poolInfo) {
        throw new Error('Curation pool not found. Please initialize pool first.');
      }

      // Check if user already curated this content
      const recordInfo = await this.connection.getAccountInfo(curationRecordPda);
      if (recordInfo) {
        throw new Error('You have already curated this content.');
      }

      // Create instruction data
      const instructionData = Buffer.alloc(1);
      instructionData.writeUInt8(1, 0); // Instruction discriminator for curate

      // Create instruction
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: curationRecordPda, isSigner: false, isWritable: true },
          { pubkey: curationPoolPda, isSigner: false, isWritable: true },
          { pubkey: contentId, isSigner: false, isWritable: true },
          { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
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
   * Claim curation rewards
   */
  async claimReward(params: ClaimCurationRewardParams): Promise<TransactionResult> {
    try {
      if (!this.wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const { contentId } = params;

      // Derive PDAs
      const [curationPoolPda] = await PublicKey.findProgramAddress(
        [Buffer.from(SEEDS.CURATION_POOL), contentId.toBuffer()],
        this.programId
      );

      const [curationRecordPda] = await PublicKey.findProgramAddress(
        [
          Buffer.from(SEEDS.CURATION_RECORD),
          contentId.toBuffer(),
          this.wallet.publicKey.toBuffer(),
        ],
        this.programId
      );

      // Check if curation record exists
      const recordInfo = await this.connection.getAccountInfo(curationRecordPda);
      if (!recordInfo) {
        throw new Error('You have not curated this content.');
      }

      // Create instruction data
      const instructionData = Buffer.alloc(1);
      instructionData.writeUInt8(3, 0); // Instruction discriminator for claim_curation_reward

      // Create instruction
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: curationRecordPda, isSigner: false, isWritable: true },
          { pubkey: curationPoolPda, isSigner: false, isWritable: false },
          { pubkey: contentId, isSigner: false, isWritable: false },
          { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
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
   * Get curation record
   */
  async getCurationRecord(
    contentId: PublicKey,
    curatorAddress: PublicKey
  ): Promise<CurationRecord | null> {
    try {
      const [curationRecordPda] = await PublicKey.findProgramAddress(
        [
          Buffer.from(SEEDS.CURATION_RECORD),
          contentId.toBuffer(),
          curatorAddress.toBuffer(),
        ],
        this.programId
      );

      const accountInfo = await this.connection.getAccountInfo(curationRecordPda);
      if (!accountInfo) {
        return null;
      }

      const data = accountInfo.data;
      let offset = 8; // Skip discriminator

      // Parse curation record
      const curator = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;

      const parsedContentId = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;

      const curatedAt = Number(data.readBigInt64LE(offset));
      offset += 8;

      const contentPublishTime = Number(data.readBigInt64LE(offset));
      offset += 8;

      const timeDeltaSeconds = Number(data.readBigInt64LE(offset));
      offset += 8;

      const curationWeight = Number(data.readBigUInt64LE(offset));
      offset += 8;

      const rewardClaimed = Number(data.readBigUInt64LE(offset));

      return {
        curator,
        contentId: parsedContentId,
        curatedAt,
        contentPublishTime,
        timeDeltaSeconds,
        curationWeight,
        rewardClaimed,
      };
    } catch (error) {
      console.error('Error fetching curation record:', error);
      return null;
    }
  }

  /**
   * Get curation pool
   */
  async getCurationPool(contentId: PublicKey): Promise<CurationPool | null> {
    try {
      const [curationPoolPda] = await PublicKey.findProgramAddress(
        [Buffer.from(SEEDS.CURATION_POOL), contentId.toBuffer()],
        this.programId
      );

      const accountInfo = await this.connection.getAccountInfo(curationPoolPda);
      if (!accountInfo) {
        return null;
      }

      const data = accountInfo.data;
      let offset = 8; // Skip discriminator

      // Parse curation pool
      const parsedContentId = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;

      const contentPublishTime = Number(data.readBigInt64LE(offset));
      offset += 8;

      const totalPool = Number(data.readBigUInt64LE(offset));
      offset += 8;

      const totalWeight = Number(data.readBigUInt64LE(offset));
      offset += 8;

      const curatorsCount = data.readUInt32LE(offset);
      offset += 4;

      const isSettled = data.readUInt8(offset) === 1;

      return {
        contentId: parsedContentId,
        contentPublishTime,
        totalPool,
        totalWeight,
        curatorsCount,
        isSettled,
      };
    } catch (error) {
      console.error('Error fetching curation pool:', error);
      return null;
    }
  }

  /**
   * Calculate potential reward for curator
   */
  async calculatePotentialReward(
    contentId: PublicKey,
    curatorAddress: PublicKey
  ): Promise<number | null> {
    try {
      const pool = await this.getCurationPool(contentId);
      const record = await this.getCurationRecord(contentId, curatorAddress);

      if (!pool || !record) {
        return null;
      }

      if (pool.totalWeight === 0 || pool.totalPool === 0) {
        return 0;
      }

      // Calculate reward: (curator_weight / total_weight) * total_pool
      const reward = Math.floor((record.curationWeight * pool.totalPool) / pool.totalWeight);
      
      return reward;
    } catch (error) {
      console.error('Error calculating potential reward:', error);
      return null;
    }
  }
}
