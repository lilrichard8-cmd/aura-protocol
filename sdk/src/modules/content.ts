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
  PublishContentParams,
  ContentLicense,
  Post,
  TransactionResult,
  AccessControl,
} from '../types';
import { SEEDS } from '../constants';

export class ContentModule {
  constructor(
    private connection: Connection,
    private wallet: WalletAdapter,
    private programId: PublicKey
  ) {}

  /**
   * Publish new content to AURA Protocol
   */
  async publish(params: PublishContentParams): Promise<TransactionResult> {
    try {
      if (!this.wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const {
        arweaveTxId,
        contentType,
        accessControl = AccessControl.Public,
        price = 0,
      } = params;

      // Validate Arweave TX ID
      if (arweaveTxId.length !== 43) {
        throw new Error('Invalid Arweave transaction ID (must be 43 characters)');
      }

      // Derive PDAs
      const [userProfilePda] = await PublicKey.findProgramAddress(
        [Buffer.from(SEEDS.USER_PROFILE), this.wallet.publicKey.toBuffer()],
        this.programId
      );

      // Get user profile to get post count
      const userProfile = await this.connection.getAccountInfo(userProfilePda);
      if (!userProfile) {
        throw new Error('User profile not found. Please register first.');
      }

      // Parse post count from user profile (at offset 8 + 32 + 36 + 204 + 4 + 4 + 4)
      const postCount = userProfile.data.readUInt32LE(8 + 32 + 36 + 204 + 4 + 4 + 4);

      const [postPda] = await PublicKey.findProgramAddress(
        [
          Buffer.from(SEEDS.POST),
          this.wallet.publicKey.toBuffer(),
          Buffer.from(new Uint8Array(new Uint32Array([postCount]).buffer)),
        ],
        this.programId
      );

      // Create instruction data
      const instructionData = Buffer.alloc(1 + 43 + 1 + 1 + 8);
      let offset = 0;

      // Instruction discriminator for publish_content (assuming it's instruction index 1)
      instructionData.writeUInt8(1, offset);
      offset += 1;

      // Arweave TX ID (43 bytes)
      instructionData.write(arweaveTxId, offset, 43);
      offset += 43;

      // Content type (1 byte)
      instructionData.writeUInt8(contentType, offset);
      offset += 1;

      // Access control (1 byte)
      instructionData.writeUInt8(accessControl, offset);
      offset += 1;

      // Price (8 bytes, little-endian u64)
      instructionData.writeBigUInt64LE(BigInt(price), offset);

      // Create instruction
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: postPda, isSigner: false, isWritable: true },
          { pubkey: userProfilePda, isSigner: false, isWritable: true },
          { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: this.wallet.publicKey, isSigner: false, isWritable: false },
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
   * Get content license information
   */
  async getLicense(contentId: PublicKey): Promise<ContentLicense | null> {
    try {
      // Derive content license PDA
      const [licensePda] = await PublicKey.findProgramAddress(
        [Buffer.from(SEEDS.CONTENT_LICENSE), contentId.toBuffer()],
        this.programId
      );

      const accountInfo = await this.connection.getAccountInfo(licensePda);
      if (!accountInfo) {
        return null;
      }

      // Parse license data (simplified - actual parsing depends on account structure)
      const data = accountInfo.data;
      let offset = 8; // Skip discriminator

      const licenseType = data.readUInt8(offset);
      offset += 1;

      const embedPrice = Number(data.readBigUInt64LE(offset));
      offset += 8;

      const remixRoyaltyBps = data.readUInt16LE(offset);
      offset += 2;

      const commercialAllowed = data.readUInt8(offset) === 1;
      offset += 1;

      const derivativesAllowed = data.readUInt8(offset) === 1;
      offset += 1;

      const attributionRequired = data.readUInt8(offset) === 1;

      return {
        contentId,
        licenseType,
        embedPrice,
        remixRoyaltyBps,
        commercialAllowed,
        derivativesAllowed,
        attributionRequired,
      };
    } catch (error) {
      console.error('Error fetching content license:', error);
      return null;
    }
  }

  /**
   * Get post details
   */
  async getPost(postPda: PublicKey): Promise<Post | null> {
    try {
      const accountInfo = await this.connection.getAccountInfo(postPda);
      if (!accountInfo) {
        return null;
      }

      const data = accountInfo.data;
      let offset = 8; // Skip discriminator

      // Parse post data
      const author = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;

      const arweaveTxIdLength = data.readUInt32LE(offset);
      offset += 4;
      const arweaveTxId = data.slice(offset, offset + arweaveTxIdLength).toString();
      offset += arweaveTxIdLength;

      const contentType = data.readUInt8(offset);
      offset += 1;

      const accessControl = data.readUInt8(offset);
      offset += 1;

      const price = Number(data.readBigUInt64LE(offset));
      offset += 8;

      const likes = Number(data.readBigUInt64LE(offset));
      offset += 8;

      const views = Number(data.readBigUInt64LE(offset));
      offset += 8;

      const tipsReceived = Number(data.readBigUInt64LE(offset));
      offset += 8;

      const createdAt = Number(data.readBigInt64LE(offset));
      offset += 8;

      const isActive = data.readUInt8(offset) === 1;

      return {
        author,
        arweaveTxId,
        contentType,
        accessControl,
        price,
        likes,
        views,
        tipsReceived,
        createdAt,
        isActive,
      };
    } catch (error) {
      console.error('Error fetching post:', error);
      return null;
    }
  }
}
