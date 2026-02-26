import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { WalletAdapter } from '@solana/wallet-adapter-base';
import { TransactionResult, UserProfile } from '../types';
import { SEEDS } from '../constants';

export class SocialModule {
  constructor(
    private connection: Connection,
    private wallet: WalletAdapter,
    private programId: PublicKey
  ) {}

  /**
   * Follow a creator
   */
  async follow(creatorAddress: PublicKey): Promise<TransactionResult> {
    try {
      if (!this.wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      if (this.wallet.publicKey.equals(creatorAddress)) {
        throw new Error('Cannot follow yourself');
      }

      // Derive user profile PDAs
      const [followerProfilePda] = await PublicKey.findProgramAddress(
        [Buffer.from(SEEDS.USER_PROFILE), this.wallet.publicKey.toBuffer()],
        this.programId
      );

      const [targetProfilePda] = await PublicKey.findProgramAddress(
        [Buffer.from(SEEDS.USER_PROFILE), creatorAddress.toBuffer()],
        this.programId
      );

      // Check if profiles exist
      const followerProfile = await this.connection.getAccountInfo(followerProfilePda);
      const targetProfile = await this.connection.getAccountInfo(targetProfilePda);

      if (!followerProfile) {
        throw new Error('Follower profile not found. Please register first.');
      }

      if (!targetProfile) {
        throw new Error('Target user profile not found.');
      }

      // Create instruction data (instruction discriminator for follow_user, assuming index 2)
      const instructionData = Buffer.alloc(1);
      instructionData.writeUInt8(2, 0);

      // Create instruction
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: followerProfilePda, isSigner: false, isWritable: true },
          { pubkey: targetProfilePda, isSigner: false, isWritable: true },
          { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
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
   * Unfollow a creator
   */
  async unfollow(creatorAddress: PublicKey): Promise<TransactionResult> {
    try {
      if (!this.wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      if (this.wallet.publicKey.equals(creatorAddress)) {
        throw new Error('Cannot unfollow yourself');
      }

      // Derive user profile PDAs
      const [followerProfilePda] = await PublicKey.findProgramAddress(
        [Buffer.from(SEEDS.USER_PROFILE), this.wallet.publicKey.toBuffer()],
        this.programId
      );

      const [targetProfilePda] = await PublicKey.findProgramAddress(
        [Buffer.from(SEEDS.USER_PROFILE), creatorAddress.toBuffer()],
        this.programId
      );

      // Create instruction data (assuming unfollow has a separate instruction)
      const instructionData = Buffer.alloc(1);
      instructionData.writeUInt8(6, 0); // Assuming unfollow is instruction index 6

      // Create instruction
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: followerProfilePda, isSigner: false, isWritable: true },
          { pubkey: targetProfilePda, isSigner: false, isWritable: true },
          { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
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
   * Get user profile
   */
  async getUserProfile(userAddress: PublicKey): Promise<UserProfile | null> {
    try {
      const [userProfilePda] = await PublicKey.findProgramAddress(
        [Buffer.from(SEEDS.USER_PROFILE), userAddress.toBuffer()],
        this.programId
      );

      const accountInfo = await this.connection.getAccountInfo(userProfilePda);
      if (!accountInfo) {
        return null;
      }

      const data = accountInfo.data;
      let offset = 8; // Skip discriminator

      // Parse user profile
      const authority = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;

      const usernameLength = data.readUInt32LE(offset);
      offset += 4;
      const username = data.slice(offset, offset + usernameLength).toString();
      offset += usernameLength;

      const profileUriLength = data.readUInt32LE(offset);
      offset += 4;
      const profileUri = data.slice(offset, offset + profileUriLength).toString();
      offset += profileUriLength;

      const reputationScore = data.readUInt32LE(offset);
      offset += 4;

      const followerCount = data.readUInt32LE(offset);
      offset += 4;

      const followingCount = data.readUInt32LE(offset);
      offset += 4;

      const postCount = data.readUInt32LE(offset);
      offset += 4;

      const createdAt = Number(data.readBigInt64LE(offset));

      return {
        authority,
        username,
        profileUri,
        reputationScore,
        followerCount,
        followingCount,
        postCount,
        createdAt,
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  /**
   * Like a post
   */
  async like(postPda: PublicKey): Promise<TransactionResult> {
    try {
      if (!this.wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      // Create instruction data (instruction discriminator for like_post, assuming index 3)
      const instructionData = Buffer.alloc(1);
      instructionData.writeUInt8(3, 0);

      // Create instruction
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: postPda, isSigner: false, isWritable: true },
          { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
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
}
