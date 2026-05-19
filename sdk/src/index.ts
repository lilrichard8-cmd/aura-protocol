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

export {
  CreatorCoinModule,
  CREATOR_COIN_SEEDS,
  CREATOR_COIN_LIMITS,
  CREATOR_COIN_FEE_BPS,
  BenefitType,
  RedemptionStatus,
  INITIAL_SUPPLY_RAW,
  TOTAL_SUPPLY_RAW,
  LOCKED_SUPPLY_RAW,
  MONTHLY_UNLOCK_RAW,
  UNLOCK_MONTHS,
  MONTH_SECONDS,
  CREATOR_COIN_DISC,
  ORDER_DISC,
  BENEFITS_LIST_DISC,
  REDEMPTION_DISC,
  REDEMPTION_COUNTER_DISC,
  BURN_TRACKER_DISC,
} from './modules/creatorCoin';
export type {
  CreatorCoinPdas,
  CreatorCoinOnChain,
  BurnTrackerOnChain,
  CreateCreatorCoinV2Params,
  UnlockMonthlyParams,
  CreateSellOrderParams,
  FillOrderParams,
  CancelOrderParams,
  AddBenefitParams,
  UpdateBenefitParams,
  DeactivateBenefitParams,
  InitiateRedemptionParams,
  MarkDeliveredParams,
  ConfirmReceiptParams,
  AutoConfirmParams,
  DisputeRedemptionParams,
  ExecuteRulingParams,
  GiftCreatorCoinParams,
  PrimaryBuyParams,
} from './modules/creatorCoin';

export {
  CurationModule,
  CURATION_SEEDS,
  BASE_WEIGHT,
  SETTLEMENT_PERIOD_SECONDS,
} from './modules/curation';
export type {
  CurationPdas,
  CurationRecordOnChain,
  CurationPoolOnChain,
  InitializeCurationPoolParams,
  DepositToPoolParams,
  SettlePoolParams,
} from './modules/curation';

export { ReputationModule, REPUTATION_SEEDS, REPUTATION_TIER_ORDER } from './modules/reputation';
export type { ReputationSbtOnChain, UpdateReputationParams } from './modules/reputation';

export {
  StakingModule,
  STAKING_SEEDS,
  LockupTier,
  LOCKUP_PARAMS,
  EARLY_UNSTAKE_PENALTY_BPS,
} from './modules/staking';
export type {
  StakingPdas,
  InitializeStakingPoolParams,
  StakeOraParams,
  UnstakeOraParams,
  ClaimStakingRewardParams,
  UpdateDailyRewardsParams,
  StakingPoolOnChain,
  StakeAccountOnChain,
} from './modules/staking';

export {
  RewardsModule,
  REWARDS_SEEDS,
  TOTAL_INCENTIVE_POOL,
  INCENTIVE_TAX_BPS,
  MAU_THRESHOLD,
  ContentTier,
  CONTENT_TIER_MULTIPLIER,
  RewardPhase,
  PHASE_RATIO_BPS,
} from './modules/rewards';
export type {
  RewardsPdas,
  InitializeRewardsParams,
  DistributeCreationRewardParams,
  DistributeCurationRewardParams,
  TransitionPhaseParams,
  UpdateMauParams,
  RewardStateOnChain,
} from './modules/rewards';

export {
  LivestreamModule,
  LIVESTREAM_SEEDS,
  LIVESTREAM_FEE_BPS,
  LIVESTREAM_LIMITS,
  calculateBoostMultiplier,
} from './modules/livestream';
export type {
  LiveStreamOnChain,
  TipRecordOnChain,
  SubscriptionOnChain,
  PpvEventOnChain,
  PpvAccessOnChain,
  TipBoostOnChain,
  StartStreamParams,
  EndStreamParams,
  TipStreamerParams,
  SubscribeParams,
  CreatePpvParams,
  PurchasePpvParams,
} from './modules/livestream';

export {
  ContentLicenseModule,
  CONTENT_LICENSE_SEEDS,
  CONTENT_LICENSE_LIMITS,
} from './modules/contentLicense';
export type {
  ContentLicenseOnChain,
  EmbedRecordOnChain,
  RemixRecordOnChain,
  SetLicenseParams,
  UpdateLicenseParams,
  PayToEmbedParams,
  PayToRemixParams,
} from './modules/contentLicense';

export {
  SocialGraphModule,
  SOCIAL_GRAPH_SEEDS,
  SOCIAL_GRAPH_LIMITS,
} from './modules/socialGraph';
export type {
  SocialGraphOnChain,
  InitializeSocialGraphParams,
} from './modules/socialGraph';

export {
  GovernanceModule,
  GOVERNANCE_SEEDS,
  GOVERNANCE_LIMITS,
  CommitteeType,
  ProposalType,
  ProposalStatus,
  DisputeType,
  OldDisputeStatus,
  DisputeStatus,
  GOVERNANCE_CONFIG_DISC,
  PROPOSAL_DISC,
  ARBITRATION_GOVERNANCE_DISC,
  ARBITRATOR_REGISTRY_DISC,
  ARBITRATION_DISPUTE_DISC,
} from './modules/governance';
export type {
  GovernancePdas,
  GovernanceConfigOnChain,
  Ruling,
  InitializeGovernanceParams,
  RegisterArbiterParams,
  CreateProposalParams,
  VoteOnProposalParams,
  ExecuteProposalParams,
  CreateDisputeParams,
  VoteOnDisputeParams,
  InitArbitrationGovernanceParams,
  RegisterAsArbitratorParams,
  FileArbitrationDisputeParams,
  DisputeIdParam,
  SubmitRulingParams,
} from './modules/governance';

export {
  FractionalizeModule,
  FRACTIONALIZE_SEEDS,
  FRACTIONALIZE_LIMITS,
  FRACTIONAL_NFT_DISC,
  FRAGMENT_HOLDER_DISC,
  LICENSE_VOTE_DISC,
} from './modules/fractionalize';
export type {
  FractionalizePdas,
  FractionalNftOnChain,
  FragmentHolderOnChain,
  FractionalizeNftParams,
  BuyFragmentParams,
  SellFragmentParams,
  DistributeRevenueParams,
  ClaimRevenueParams,
  VoteOnLicenseParams,
  FinalizeLicenseVoteParams,
  ReclaimNftParams,
} from './modules/fractionalize';
export {
  MarketModule,
  BountyStatus,
  SubmissionStatus,
  BOUNTY_V2_SEEDS,
  BOUNTY_V2_LIMITS,
  BOUNTY_V2_FEE_BPS,
  computeWinnerNet,
  // NFT royalty (whitepaper §12)
  NFT_ROYALTY_SEEDS,
  NFT_ROYALTY_BPS,
  NFT_PROTOCOL_FEE_BPS,
  NFT_MAX_TOTAL_DEDUCTION_BPS,
  computeNftSaleSplit,
  deriveNftRoyaltyConfig,
} from './modules/market';
export type {
  MarketModuleConfig,
  CreateBountyParams,
  SubmitWorkParams,
  AwardSubmissionParams,
  BountyOnChain,
  SubmissionOnChain,
  BountyV2Pdas,
  // NFT royalty types
  NftSaleSplit,
  NftRoyaltyConfigOnChain,
  SetRoyaltyParams,
  EnforceRoyaltyParams,
} from './modules/market';

export {
  CoreModule,
  CORE_SEEDS,
  CORE_LIMITS,
  ContentTypeCore,
  AccessControlCore,
  USER_PROFILE_DISC,
  POST_DISC,
  FOLLOW_RECORD_DISC,
  LIKE_RECORD_DISC,
} from './modules/core';
export type {
  CorePdas,
  RegisterUserParams,
  PublishContentCoreParams,
  UpdateProfileParams,
  UserProfileOnChain,
  PostOnChain,
  FollowRecordOnChain,
  LikeRecordOnChain,
} from './modules/core';

export {
  OraModule,
  ORA_SEEDS,
  ORA_DECIMALS,
  ORA_INITIAL_SUPPLY,
  ORA_MAU_GROWTH_MINT_PER_10K,
  ORA_MAU_GROWTH_MINT_CAP,
  ORA_BURN_FLOOR,
  ORA_CONFIG_DISC,
  BurnType,
} from './modules/ora';
export type {
  OraPdas,
  OraConfigOnChain,
} from './modules/ora';

export {
  VaultModule,
  VAULT_SEEDS,
  VAULT_VESTING_PERIOD_SECS,
  VAULT_CONFIG_DISC,
  VESTING_VAULT_DISC,
  SpendPurpose,
} from './modules/vault';
export type {
  VaultPdas,
  VaultConfigOnChain,
  VestingVaultOnChain,
} from './modules/vault';

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

// [whitepaper-sync v1.1] §13 content-keys — encrypted content with NFT access.
export {
  ContentKeysModule,
  CONTENT_KEYS_SEEDS,
  CONTENT_KEYS_FEE_BPS,
  CONTENT_KEYS_LIMITS,
  AccessKind,
  computeCreatorNetPrimary,
  computeSellerProceedsSecondary,
} from './modules/contentKeys';
export type {
  ContentKeysPdas,
  ContentKeysModuleConfig,
  AccessType,
  PublishContentParams as PublishContentKeysParams,
  UpdateContentParams as UpdateContentKeysParams,
  BuyKeyParams,
  ListKeyParams,
  BuyListedKeyParams,
  ContentOnChain as EncryptedContentOnChain,
  ContentKeyOnChain,
  KeyListingOnChain,
} from './modules/contentKeys';

// [whitepaper-sync v1.1] §5.6 launch-incentives — three sub-programs (Million Plan / Onboarding / Rising Star).
export {
  LaunchIncentivesModule,
  LAUNCH_INCENTIVES_SEEDS,
  MILLION_PLAN_POOL,
  ONBOARDING_POOL,
  RISING_STAR_POOL,
  LAUNCH_INCENTIVE_TOTAL,
  MILESTONE_COUNT,
  MILESTONE_DAU_THRESHOLDS,
  MILESTONE_RELEASES,
  MILESTONE_PER_USER_CAP,
  ONBOARDING_MIN_EXTERNAL_FOLLOWERS,
  ONBOARDING_RATE_PER_FOLLOWER,
  ONBOARDING_PER_CREATOR_CAP,
  ONBOARDING_UNLOCK_MONTHS,
  ONBOARDING_MONTH_SECS,
  ONBOARDING_MAX_CONSECUTIVE_MISSES,
  RISING_STAR_RATE_PER_FOLLOWER,
  RISING_STAR_MONTHLY_CAP,
  RISING_STAR_DURATION_MONTHS,
  OnboardingStatus,
  RisingStarStatus,
  deriveMilestonePda,
  deriveMillionClaimPda,
  deriveOnboardingGrantPda,
  deriveRisingStarGrantPda,
  deriveRisingStarMonthPda,
} from './modules/launchIncentives';
export type {
  LaunchIncentivesPdas,
  LaunchIncentivesStateOnChain,
  MilestoneStateOnChain,
  OnboardingGrantOnChain,
  RisingStarGrantOnChain,
  InitializeLaunchIncentivesParams,
  InitializeMilestoneStateParams,
  TriggerMilestoneParams,
  ClaimMillionRewardParams,
  RegisterOnboardingParams,
  ClaimMonthlyUnlockParams,
  ForfeitOnboardingParams,
  RegisterRisingStarParams,
  RecordMonthlyFollowersParams,
  ClaimRisingStarMonthlyParams,
} from './modules/launchIncentives';

// Constants
export { PROGRAM_IDS, RPC_ENDPOINTS, SEEDS } from './constants';

// Re-export Solana types for convenience
export { PublicKey, Connection } from '@solana/web3.js';
export type { WalletAdapter } from '@solana/wallet-adapter-base';
