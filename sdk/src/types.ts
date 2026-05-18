import { PublicKey } from '@solana/web3.js';
import { WalletAdapter } from '@solana/wallet-adapter-base';

/**
 * SDK Configuration
 */
export interface AuraClientConfig {
  network: 'mainnet' | 'devnet' | 'testnet' | 'localnet';
  wallet: WalletAdapter;
  rpcUrl?: string;
  /** Per-network market-module config (ORA mint + treasury pool accounts).
   *  Required for real bounty operations; omit for type-only / read-only use. */
  marketConfig?: {
    stakingRewardsPool: PublicKey;
    gasReservePool: PublicKey;
    opsTreasuryPool: PublicKey;
    oraMint: PublicKey;
  };
  /** [whitepaper-sync v1.1] §13 content-keys — Per-network content-keys
   *  module config (defaults to marketConfig pools when omitted). */
  contentKeysConfig?: {
    oraMint: PublicKey;
    stakingRewardsPool: PublicKey;
    gasReservePool: PublicKey;
    opsTreasuryPool: PublicKey;
  };
}

/**
 * Content Types
 */
export enum ContentType {
  Text = 0,
  Image = 1,
  Video = 2,
  Audio = 3,
  Mixed = 4,
}

export enum AccessControl {
  Public = 0,
  PayToView = 1,
  BurnAfterReading = 2,
}

export enum LicenseType {
  CC0 = 0,
  CCBY = 1,
  PayToEmbed = 2,
  PayToRemix = 3,
  Exclusive = 4,
}

export interface PublishContentParams {
  arweaveTxId: string;
  contentType: ContentType;
  accessControl?: AccessControl;
  price?: number;
  license?: LicenseType;
  embedPrice?: number;
  remixRoyaltyBps?: number;
  commercialAllowed?: boolean;
  derivativesAllowed?: boolean;
  attributionRequired?: boolean;
}

export interface ContentLicense {
  contentId: PublicKey;
  licenseType: LicenseType;
  embedPrice: number;
  remixRoyaltyBps: number;
  commercialAllowed: boolean;
  derivativesAllowed: boolean;
  attributionRequired: boolean;
}

export interface Post {
  author: PublicKey;
  arweaveTxId: string;
  contentType: ContentType;
  accessControl: AccessControl;
  price: number;
  likes: number;
  views: number;
  tipsReceived: number;
  createdAt: number;
  isActive: boolean;
}

/**
 * User Profile
 */
export interface UserProfile {
  authority: PublicKey;
  username: string;
  profileUri: string;
  reputationScore: number;
  followerCount: number;
  followingCount: number;
  postCount: number;
  createdAt: number;
}

/**
 * Creator Coin Types
 */
export enum CurveType {
  Linear = 0,
  Quadratic = 1,
  Cubic = 2,
}

export interface CreateCreatorCoinParams {
  symbol: string;
  curveType: CurveType;
  curveParamK: number;
  curveParamN: number;
  creatorFeeBps: number;
}

export interface CreatorCoin {
  creator: PublicKey;
  mint: PublicKey;
  symbol: string;
  totalSupply: number;
  reserveBalance: number;
  curveType: CurveType;
  curveParamK: number;
  curveParamN: number;
  creatorFeeBps: number;
  totalFeesCollected: number;
  createdAt: number;
}

export interface BuyCreatorCoinParams {
  creatorAddress: PublicKey;
  amount: number;
}

export interface SellCreatorCoinParams {
  creatorAddress: PublicKey;
  amount: number;
}

/**
 * Curation Types
 */
export interface CurationRecord {
  curator: PublicKey;
  contentId: PublicKey;
  curatedAt: number;
  contentPublishTime: number;
  timeDeltaSeconds: number;
  curationWeight: number;
  rewardClaimed: number;
}

export interface CurationPool {
  contentId: PublicKey;
  contentPublishTime: number;
  totalPool: number;
  totalWeight: number;
  curatorsCount: number;
  isSettled: boolean;
}

export interface CurateParams {
  contentId: PublicKey;
}

export interface ClaimCurationRewardParams {
  contentId: PublicKey;
}

/**
 * Reputation Types
 */
export interface ReputationSBT {
  creator: PublicKey;
  joinedAt: number;
  totalPosts: number;
  totalEarnings: number;
  followers: number;
  curationScore: number;
  reputationTier: ReputationTier;
  verifiedSkills: string[];
}

export enum ReputationTier {
  Bronze = 0,
  Silver = 1,
  Gold = 2,
  Platinum = 3,
  Diamond = 4,
}

/**
 * Transaction Response
 */
export interface TransactionResult {
  signature: string;
  success: boolean;
  error?: string;
}

/**
 * Program IDs
 */
export interface ProgramIds {
  core: PublicKey;
  creatorCoin: PublicKey;
  curation: PublicKey;
  governance: PublicKey;
  market: PublicKey;
  vault: PublicKey;
  contentLicense?: PublicKey;
  reputation?: PublicKey;
  socialGraph?: PublicKey;
}
