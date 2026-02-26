/**
 * AURA Protocol SDK
 * 
 * TypeScript SDK for interacting with AURA Protocol on Solana
 * 
 * @packageDocumentation
 */

// Main client
export { AuraClient } from './client';

// Modules
export { ContentModule } from './modules/content';
export { SocialModule } from './modules/social';
export { CreatorCoinModule } from './modules/creatorCoin';
export { CurationModule } from './modules/curation';
export { ReputationModule } from './modules/reputation';

// Types
export {
  // Config
  AuraClientConfig,
  
  // Content
  ContentType,
  AccessControl,
  LicenseType,
  PublishContentParams,
  ContentLicense,
  Post,
  
  // User
  UserProfile,
  
  // Creator Coin
  CurveType,
  CreateCreatorCoinParams,
  CreatorCoin,
  BuyCreatorCoinParams,
  SellCreatorCoinParams,
  
  // Curation
  CurationRecord,
  CurationPool,
  CurateParams,
  ClaimCurationRewardParams,
  
  // Reputation
  ReputationSBT,
  ReputationTier,
  
  // Common
  TransactionResult,
  ProgramIds,
} from './types';

// Constants
export { PROGRAM_IDS, RPC_ENDPOINTS, SEEDS } from './constants';

// Re-export Solana types for convenience
export { PublicKey, Connection } from '@solana/web3.js';
export type { WalletAdapter } from '@solana/wallet-adapter-base';
