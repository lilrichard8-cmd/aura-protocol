import {
  Connection,
  PublicKey,
} from '@solana/web3.js';
import { WalletAdapter } from '@solana/wallet-adapter-base';
import { ReputationSBT, ReputationTier } from '../types';
import { SEEDS } from '../constants';

export class ReputationModule {
  constructor(
    private connection: Connection,
    private wallet: WalletAdapter,
    private programId: PublicKey
  ) {}

  /**
   * Get reputation SBT for a user
   */
  async get(userAddress: PublicKey): Promise<ReputationSBT | null> {
    try {
      const [reputationSbtPda] = await PublicKey.findProgramAddress(
        [Buffer.from(SEEDS.REPUTATION_SBT), userAddress.toBuffer()],
        this.programId
      );

      const accountInfo = await this.connection.getAccountInfo(reputationSbtPda);
      if (!accountInfo) {
        return null;
      }

      const data = accountInfo.data;
      let offset = 8; // Skip discriminator

      // Parse reputation SBT
      const creator = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;

      const joinedAt = Number(data.readBigInt64LE(offset));
      offset += 8;

      const totalPosts = data.readUInt32LE(offset);
      offset += 4;

      const totalEarnings = Number(data.readBigUInt64LE(offset));
      offset += 8;

      const followers = data.readUInt32LE(offset);
      offset += 4;

      const curationScore = Number(data.readBigUInt64LE(offset));
      offset += 8;

      const reputationTier = data.readUInt8(offset) as ReputationTier;
      offset += 1;

      // Parse verified skills (array of strings)
      const skillsCount = data.readUInt32LE(offset);
      offset += 4;
      
      const verifiedSkills: string[] = [];
      for (let i = 0; i < skillsCount; i++) {
        const skillLength = data.readUInt32LE(offset);
        offset += 4;
        const skill = data.slice(offset, offset + skillLength).toString();
        offset += skillLength;
        verifiedSkills.push(skill);
      }

      return {
        creator,
        joinedAt,
        totalPosts,
        totalEarnings,
        followers,
        curationScore,
        reputationTier,
        verifiedSkills,
      };
    } catch (error) {
      console.error('Error fetching reputation SBT:', error);
      return null;
    }
  }

  /**
   * Calculate reputation tier based on metrics
   */
  calculateTier(
    totalPosts: number,
    totalEarnings: number,
    followers: number,
    curationScore: number
  ): ReputationTier {
    // Calculate weighted score
    const score = 
      totalPosts * 1 +
      totalEarnings / 1000 +
      followers * 2 +
      curationScore / 100;

    if (score >= 10000) return ReputationTier.Diamond;
    if (score >= 5000) return ReputationTier.Platinum;
    if (score >= 1000) return ReputationTier.Gold;
    if (score >= 100) return ReputationTier.Silver;
    return ReputationTier.Bronze;
  }

  /**
   * Get reputation tier name
   */
  getTierName(tier: ReputationTier): string {
    const tierNames = {
      [ReputationTier.Bronze]: 'Bronze',
      [ReputationTier.Silver]: 'Silver',
      [ReputationTier.Gold]: 'Gold',
      [ReputationTier.Platinum]: 'Platinum',
      [ReputationTier.Diamond]: 'Diamond',
    };
    return tierNames[tier] || 'Unknown';
  }

  /**
   * Check if user has reputation SBT
   */
  async hasReputation(userAddress: PublicKey): Promise<boolean> {
    try {
      const reputation = await this.get(userAddress);
      return reputation !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get reputation stats summary
   */
  async getStats(userAddress: PublicKey): Promise<{
    tier: string;
    totalPosts: number;
    totalEarnings: number;
    followers: number;
    curationScore: number;
  } | null> {
    try {
      const reputation = await this.get(userAddress);
      if (!reputation) {
        return null;
      }

      return {
        tier: this.getTierName(reputation.reputationTier),
        totalPosts: reputation.totalPosts,
        totalEarnings: reputation.totalEarnings,
        followers: reputation.followers,
        curationScore: reputation.curationScore,
      };
    } catch (error) {
      console.error('Error fetching reputation stats:', error);
      return null;
    }
  }
}
