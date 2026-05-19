import { createContext, useContext, useState, useRef, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { iris, users, posts as seedPosts } from '@/data/mock';

// --- Types ---
export interface FeeBreakdown {
  total: number;
  burn: number;
  staking: number;
  gasReserve: number;
  ops: number;
}

/**
 * Structured per-transaction breakdown so the wallet history can
 * re-open the exact line items at any time. Every line is a (label,
 * amount, optional sub) tuple. Total inflow/outflow plus the protocol
 * fee allocation are first-class fields.
 *
 * For an inbound reward, e.g.:
 *   gross         = +49.0588 ORA  (Activity Reward formula)
 *   vaultDeposit  = -14.7176 ORA  (30% auto-vested into Creator Vault)
 *   net           = +34.3412 ORA  (lands in spendable balance)
 *
 * For an outbound trade, fee.totalFee carries the protocol fee with
 * the 4-way split fields used by FeeBreakdown.
 */
export interface TransactionBreakdown {
  /** Free-form line items shown in order. */
  items: Array<{
    label: string;
    amount: number; // positive = inflow, negative = outflow
    sub?: string; // optional one-line subtitle
    tone?: 'default' | 'positive' | 'negative' | 'muted';
  }>;
  /** Optional protocol-fee allocation (only when a fee was charged). */
  fee?: {
    totalFee: number;
    burn?: number;
    staking?: number;
    gasReserve?: number;
    ops?: number;
  };
  /** Settlement summary line shown at the bottom ("You received", etc.). */
  settlement?: {
    label: string;
    amount: number;
    tone?: 'positive' | 'negative' | 'muted';
  };
  /** Optional human note explaining the formula. */
  note?: string;
}

export interface Transaction {
  id: string;
  type: 'airdrop' | 'publish' | 'reward' | 'mint_coin' | 'buy_coin' | 'sell_coin' | 'curate' | 'buy_key' | 'send' | 'stake' | 'unstake' | 'send_cc' | 'redeem_cc';
  amount: number;
  timestamp: number;
  txHash: string;
  details: string;
  /** Structured breakdown shown in the Wallet history expandable row.
   *  Optional for legacy txs; new txs should always populate this. */
  breakdown?: TransactionBreakdown;
}

// --- Wallet-page additions (2026-04-30) ---
export type StakeLockDays = 1 | 30 | 90 | 180;

export interface StakeEntry {
  id: string;
  amount: number;
  lockDays: StakeLockDays;
  multiplier: number;        // 1.0 / 1.0 / 1.5 / 2.0
  startedAt: number;         // ms timestamp
  unlocksAt: number;         // ms timestamp
}

export interface CurationStats {
  todayCount: number;
  todayOraSpent: number;
  totalScore: number;
  totalRewards: number;
}

/**
 * Pending-curation record (round 4, 2026-04-30): a curation action whose
 * reward outcome has not yet settled. Real mock-chain wiring is intentionally
 * NOT seeded with fake entries — the array stays `[]` until a future curation
 * pipeline pushes real records. UI must treat empty as the empty-state.
 */
export interface PendingCuration {
  contentId: string;
  contentTitle: string;
  creatorName: string;
  curatedAt: number; // ms timestamp
  expectedScore?: number;
}

export interface CreatorCoinRedemption {
  coinSymbol: string;
  tierName: string;
  redeemedAt: number;
}

export type SolanaNetwork = 'devnet' | 'testnet' | 'mainnet-beta';

export function multiplierForLock(lockDays: StakeLockDays): number {
  switch (lockDays) {
    case 1: return 1.0;
    case 30: return 1.0;
    case 90: return 1.5;
    case 180: return 2.0;
    default: return 1.0;
  }
}

export interface CoinBenefit {
  id: string;
  type: 'hold' | 'consume';
  title: string;
  description: string;
  threshold: number; // hold: min coins to enjoy; consume: coins burned per redemption
}

export type RedemptionStatus = 'pending_delivery' | 'delivered' | 'confirmed' | 'disputed';

/**
 * Generic in-app notification stream — likes, follows, comments,
 * curation rewards, governance alerts. Coin trades and redemption
 * events have their own typed streams (CoinTradeNotification /
 * RedemptionNotification) for richer payload data; this stream is for
 * the simpler fan-out cases driven by user actions on the protocol.
 */
export type InAppNotificationType = 'like' | 'comment' | 'follow' | 'curation_reward' | 'governance';

/**
 * Persisted comment authored by a wallet on a post. We store these on the
 * mockChain (rather than `useState` in PostDetailPage) so they survive
 * navigation, refreshes, and tab switches. Production replaces this
 * with the on-chain comment contract.
 */
export interface PostComment {
  id: string;
  postId: string;
  authorWallet: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
  content: string;
  timestamp: number;
  /** id of the parent comment if this is a reply */
  replyTo?: string;
  /** Snapshot of the parent comment when this is a reply — used to
   * render an inline quote block above the reply. We snapshot the values
   * (rather than only storing replyTo) so the UI can render even if the
   * parent is later edited or removed.
   */
  quotedAuthor?: string;
  quotedUsername?: string;
  quotedContent?: string;
}

export interface InAppNotification {
  id: string;
  type: InAppNotificationType;
  /** Display name of the actor ("Iris", "@sakura_lens", "Governance") */
  actorName: string;
  actorUsername?: string;
  actorAvatar?: string;
  /** Short headline, e.g. "liked your post" */
  message: string;
  /** Optional second-line detail */
  detail?: string;
  /** Optional post id for click-through navigation */
  postId?: string;
  /** Optional governance proposal id for click-through */
  proposalId?: string;
  timestamp: number;
  isRead: boolean;
}

export type RedemptionEventKind = 'initiated' | 'delivered' | 'confirmed' | 'auto_confirmed' | 'disputed';

/** Committee election application submitted by a user during the
 *  nomination phase. Persisted across reloads so the demo can show
 *  "already applied" state. Only the most recent application per
 *  (committee, electionCycleId) is kept (re-submitting overwrites).
 */
export interface ElectionApplication {
  id: string;
  /** Wallet that submitted. */
  applicantWallet: string;
  /** Committee id, e.g. 'development-committee'. */
  committee: string;
  /** Cycle id (ISO date YYYY-MM-DD of cycle start) so applications
   *  carry across the persistence boundary without colliding. */
  electionCycleId: string;
  /** Public statement — "goals" per whitepaper §15. */
  goals: string;
  /** Public statement — "qualifications" per whitepaper §15. */
  qualifications: string;
  /** Optional tagline shown in candidate cards. */
  tagline?: string;
  /** ORA staked at submission time (resolves at vote tally). */
  stakedAtSubmit: number;
  /** Submission timestamp (ms). */
  submittedAt: number;
  /** Last edit timestamp (ms). Equals submittedAt initially. */
  updatedAt: number;
  /** Withdrawn flag (kept for audit trail rather than hard-deleted). */
  withdrawn?: boolean;
}

export interface RedemptionNotification {
  id: string;
  kind: RedemptionEventKind;
  redemptionId: string;
  symbol: string;
  benefitTitle: string;
  cost: number;
  /** Counterparty (buyer for creator-side events, creator for buyer-side events) */
  who: string;
  whoAvatar?: string;
  /** Audience: 'buyer' = notification for the redeemer, 'creator' = for the coin issuer. */
  audience: 'buyer' | 'creator';
  timestamp: number;
  isRead: boolean;
}

export interface RedemptionRequest {
  id: string;
  /** CC ticker, e.g. "$IRIS" */
  symbol: string;
  /** Benefit identifier from CoinBenefit. */
  benefitId: string;
  benefitTitle: string;
  benefitDescription: string;
  /** CC amount locked in protocol escrow. */
  cost: number;
  /** "buyer" = the redeemer (CC holder spending coins). */
  buyerName: string;
  buyerAvatar?: string;
  /** "creator" = the CC issuer (will receive CC after confirm). */
  creatorName: string;
  creatorAvatar?: string;
  /** Demo perspective — 'me_as_buyer' if the local user initiated, 'me_as_creator' if the local user is the issuer of this CC. */
  perspective: 'me_as_buyer' | 'me_as_creator';
  status: RedemptionStatus;
  createdAt: number;
  deliveredAt?: number;
  confirmedAt?: number;
  /** Free-form delivery message from the creator (link, code, note...). */
  deliveryNote?: string;
  /** When the buyer disputes (rejects) the delivery. */
  disputedAt?: number;
  /** Buyer's reason for dispute. */
  disputeReason?: string;
}

export interface OwnCoinExternalTrade {
  id: string;
  type: 'buy' | 'sell';
  userName: string;
  userAvatar: string;
  userUsername: string;
  amount: number;
  price: number;
  total: number;
  timestamp: number;
}

export interface OwnCoinExternalHolder {
  id: string;
  name: string;
  avatar: string;
  username: string;
  amount: number;
}

export interface CoinTradeNotification {
  id: string;
  marketType: 'primary' | 'secondary';
  buyerName: string;
  buyerAvatar: string;
  buyerUsername: string;
  amount: number;
  price: number;
  total: number;
  proceeds: number;
  symbol: string;
  timestamp: number;
  isRead: boolean;
}

export interface CreatorCoinHolding {
  name: string;
  symbol: string;
  amount: number;
  logoUrl?: string;
  benefits?: CoinBenefit[];
  /** Creator-set initial price for the 2,000 unlocked supply (USD per coin). */
  initialPrice?: number;
  /** Per-batch launch price plan for the 10 vesting batches. Index 0 = batch 1. */
  batchPrices?: number[];
  /** Realized prices for already-unlocked vesting batches. */
  unlockedBatchPrices?: number[];
  /** Mint timestamp (ms). Used by Marketplace "New Mints" tab. */
  mintedAt?: number;
  /** CC reserved (escrowed) backing open sell orders. Counted as owned, not spendable. */
  reservedAmount?: number;
}

export interface OwnedKey {
  contentId: string;
  title: string;
  price: number;
  keyId: string;
}

/** A non-fractional NFT the user owns. Includes auction wins, fixed-price buys,
 *  and mystery-box reveals. Fractional NFT holdings live in `fractionalizedNfts.ownedFragments`. */
export interface OwnedNft {
  /** References an entry in src/data/nfts.ts (NftRecord.id). For mystery-box reveals
 *  this is the *revealed* nft id, not the box id. */
  nftId: string;
  name: string;
  pricePaid: number;
  /** auction = won via bid; fixed = bought outright; mystery = revealed from box. */
  acquisitionType: 'auction' | 'fixed' | 'mystery';
  acquiredAt: number;
  txHash?: string;
  /** Optional cover image / emoji for inventory cards. */
  coverImage?: string;
  coverEmoji?: string;
}

export interface ListedKey {
  keyId: string;
  contentId: string;
  title: string;
  askPrice: number;
  seller: string;
}

export interface License {
  embedPrice: number;
  remixPrice: number;
  remixShareBps: number;
}

export interface RemixRecord {
  id: string;
  originalId: string;
  remixerId: string;
  revenueSplit: number;
  title: string;
  createdAt: number;
}

export interface MockChainState {
  mode: 'mock' | 'localnet';
  rpcUrl: string;
  connected: boolean;
  publicKey: string | null;
  oraBalance: number;
  solBalance: number;
  creatorCoins: CreatorCoinHolding[];
  connectWallet: (realAddress?: string) => Promise<{ isFirstTime: boolean }>;
  disconnectWallet: () => void;
  publishContent: (content: any) => Promise<{ txHash: string; reward: number }>;
  mintCreatorCoin: (symbol?: string, name?: string, opts?: { logoUrl?: string; benefits?: CoinBenefit[]; initialPrice?: number }) => Promise<{ success: boolean; amount: number; symbol: string; initialPrice: number }>;
  // Mock helper: simulate another platform user (e.g. Iris) buying the freshly-minted coin.
  simulateExternalCoinBuy: (symbol: string, amount: number, pricePerCoin: number, buyer: { name: string; avatar: string; username: string; id?: string }, marketType?: 'primary' | 'secondary') => void;
  // Mock: another user fills the creator's marketplace BUY order — they sell, creator gains coins, pays ORA.
  simulateExternalCoinSellToMe: (symbol: string, amount: number, pricePerCoin: number, seller: { name: string; avatar: string; username: string; id?: string }) => void;
  redeemCoinBenefit: (symbol: string, benefitId: string, cost: number, title: string) => Promise<void>;
  // Gift CC directly to another user (no fee, no escrow — like a transfer/red packet).
  giftCreatorCoin: (symbol: string, amount: number, recipient: { name: string; username: string; avatar: string; id?: string }, message?: string) => void;
  // Sell-order escrow: lock CC when listing, refund on cancel, settle ORA on fill.
  reserveSellOrder: (symbol: string, amount: number) => void;
  releaseSellOrder: (symbol: string, amount: number) => void;
  fillExternalSellOrder: (symbol: string, amount: number, pricePerCoin: number, buyer: { name: string; avatar: string; username: string; id?: string }) => void;
  // Escrowed redemption flow (Taobao-style)
  redemptions: RedemptionRequest[];
  initiateRedemption: (symbol: string, benefit: { id: string; title: string; description: string; threshold: number }, opts?: { creatorName?: string; creatorAvatar?: string }) => Promise<RedemptionRequest>;
  markRedemptionDelivered: (id: string, note?: string) => Promise<void>;
  confirmRedemptionReceipt: (id: string) => Promise<void>;
  disputeRedemption: (id: string, reason?: string) => Promise<void>;
  redemptionNotifications: RedemptionNotification[];
  markRedemptionNotificationsRead: () => void;
  inAppNotifications: InAppNotification[];
  markInAppNotificationsRead: () => void;
  markInAppNotificationRead: (id: string) => void;
  /** All comments authored on the protocol, persisted across sessions. */
  postComments: PostComment[];
  /** Add a comment to a post. Returns the persisted record. */
  addPostComment: (args: {
    postId: string;
    authorWallet: string;
    authorName: string;
    authorUsername: string;
    authorAvatar: string;
    content: string;
    replyTo?: string;
    quotedAuthor?: string;
    quotedUsername?: string;
    quotedContent?: string;
  }) => PostComment;
  /** Release the next 800-coin vesting batch.
   *
   *  `newBenefits` (optional) lets the creator add fresh holder benefits
   *  alongside the unlock. They APPEND to existing benefits — we never
   *  edit or remove old ones, since a benefit is an on-chain promise to
   *  current holders. (Whitepaper §6.4 "benefit immutability".) */
  unlockNextVestingBatch: (symbol: string, batchPrice: number, newBenefits?: CoinBenefit[]) => Promise<void>;
  setCreatorCoinBatchPrice: (symbol: string, batchIndex: number, price: number) => void;
  setCreatorCoinTgePrice: (symbol: string, price: number) => void;
  setCreatorCoinRealizedBatchPrice: (symbol: string, batchIndex: number, price: number) => void;
  // Foreign creators' primary-issuance batch remaining (mock). When 0, primary buys are sold out.
  foreignCoinPrimaryRemaining: Record<string, number>;
  ownCoinTrades: OwnCoinExternalTrade[];
  ownCoinHolders: OwnCoinExternalHolder[];
  coinTradeNotifications: CoinTradeNotification[];
  markCoinNotificationsRead: () => void;
  buyCreatorCoin: (symbol: string, amount: number) => Promise<{ fee: number; breakdown: FeeBreakdown }>;
  sellCreatorCoin: (symbol: string, amount: number, pricePerCoin: number) => Promise<{ proceeds: number; fee: number; breakdown: FeeBreakdown }>;
  curateContent: (contentId: string) => Promise<{ cost: number; weight: string }>;
  buyContentKey: (contentId: string, price: number) => Promise<{ keyId: string }>;
  listContentKey: (keyId: string, price: number) => void;
  buyListedKey: (keyId: string) => Promise<{ fee: number }>;
  totalBurned: number;
  totalStaked: number;
  dailyCreationCount: number;
  transactions: Transaction[];
  // Creator Coin minting state
  hasCreatorCoin: boolean;
  creatorCoinSymbol: string | null;
  creatorCoinBalance: number;
  creatorCoinLocked: number;
  creatorCoinVestingMonth: number;
  // Content Keys
  ownedKeys: OwnedKey[];
  listedKeys: ListedKey[];
  // Non-fractional NFTs (auction wins, fixed buys, mystery-box reveals)
  ownedNfts: OwnedNft[];
  // Curation tracking
  curatedContentIds: string[];
  // type-b: Boost / Pin
  boostedContentIds: string[];
  pinnedContentIds: string[];
  boostContent: (contentId: string, amount: number) => Promise<void>;
  pinContent: (contentId: string) => void;
  // vault
  vaultBalance: number;
  vestedAmount: number;
  claimedAmount: number;
  claimVested: () => Promise<void>;
  // content-license
  licenses: Record<string, License>;
  setLicense: (contentId: string, embedPrice: number, remixPrice: number) => void;
  payToEmbed: (contentId: string) => Promise<void>;
  payToRemix: (contentId: string) => Promise<void>;
  embeddedContentIds: string[];
  remixLicensedContentIds: string[];
  // remix
  remixes: RemixRecord[];
  createRemix: (originalContentId: string, originalAuthor: string) => Promise<void>;
  remixRevenue: number;
  // social-graph
  followingIds: string[];
  followUser: (userId: string) => void;
  unfollowUser: (userId: string) => void;
  // staking (legacy fields kept for compatibility — derived from stakes[])
  stakedOra: number;
  stakingRewards: number;
  stakeOra: (amount: number) => Promise<void>;
  unstakeOra: (amount: number) => Promise<void>;
  claimStakingReward: () => Promise<void>;
  sendOra: (recipient: string, amount: number) => Promise<{ txHash: string }>;
  /** Buy ORA on the platform.
   *  - `source: 'protocol'`  → fixed TGE price ($0.02/ORA), pays SOL, no slippage.
   *  - `source: 'market'`    → secondary market with simulated mid-price + slippage.
   *  Deducts the SOL cost and credits the ORA amount in one atomic update.
   *  Returns the on-chain-style txHash + effective price for the receipt. */
  buyOra: (oraAmount: number, source: 'protocol' | 'market', opts?: { effectivePrice?: number; slippagePct?: number }) => Promise<{ txHash: string; solSpent: number; effectivePrice: number }>;
  /** Acquire a non-fractional NFT (auction win, fixed-price buy, mystery-box reveal).
   *  Deducts the price from oraBalance and adds an OwnedNft record. Returns the new tx hash. */
  acquireNft: (input: {
    nftId: string;
    name: string;
    price: number;
    acquisitionType: 'auction' | 'fixed' | 'mystery';
    coverImage?: string;
    coverEmoji?: string;
  }) => Promise<{ txHash: string }>;
  // Wallet-page additions (2026-04-30)
  walletAddress: string;
  network: SolanaNetwork;
  setNetwork: (n: SolanaNetwork) => void;
  stakes: StakeEntry[];
  curationStats: CurationStats;
  pendingCurations: PendingCuration[];
  creatorCoinRedemptions: CreatorCoinRedemption[];
  myCoinHolders: number;
  stakeOraWithTier: (amount: number, lockDays: StakeLockDays) => Promise<void>;
  unstakeFromTier: (stakeId: string) => Promise<void>;
  sendCreatorCoin: (coinSymbol: string, recipient: string, amount: number) => Promise<void>;
  performCuration: (creatorAddress: string) => Promise<void>;
  redeemCreatorCoinTier: (coinSymbol: string, tierName: string) => Promise<void>;
  // governance
  proposals: Proposal[];
  myVotes: Record<string, 'for' | 'against'>;
  voteOnProposal: (proposalId: string, vote: 'for' | 'against') => Promise<void>;
  createProposal: (title: string, description: string, opts?: { committee?: string; tier?: Proposal['tier'] }) => Promise<void>;
  // ── Committee elections (whitepaper §15) ─────────────────────────
  electionApplications: ElectionApplication[];
  submitElectionApplication: (input: {
    committee: string;
    electionCycleId: string;
    goals: string;
    qualifications: string;
    tagline?: string;
  }) => Promise<void>;
  withdrawElectionApplication: (committee: string, electionCycleId: string) => Promise<void>;
  // Profile customization (2026-05-09)
  /** User-uploaded banner image (data URL or remote URL). When unset, the
   *  ProfilePage falls back to a default Unsplash banner. */
  profileBannerUrl: string | null;
  setProfileBannerUrl: (url: string | null) => void;
  /** Persisted post-like state. Toggling a like adds/removes the post id;
   *  ProfilePage's "Liked" tab + PostDetailPage's heart both read this. */
  likedPostIds: string[];
  toggleLikePost: (postId: string) => void;
  /**
   * Demo helper: when the current user comments under someone else's post,
   * simulate the post's author engaging back — a like and then a reply on
   * the user's comment, surfaced as inbound notifications. The reply is
   * also persisted as a real comment row, with the user's original text
   * captured as a quote block (so the post detail page can render the
   * back-and-forth thread).
   */
  simulateAuthorReplyToComment: (args: {
    postId: string;
    postTitle?: string;
    postAuthor: { id: string; displayName: string; username: string; avatar: string };
    commenterUsername: string;
    commenterDisplayName: string;
    commentText: string;
  }) => void;
  /** Surface an inbound follow event (from Supabase wallet_follows) as
   * an in-app notification. Idempotent on followKey — dedupes if the
   * same edge fires twice (e.g. polling + Realtime double-tap).
   */
  notifyInboundFollow: (args: {
    followerWallet: string;
    followerDisplayName: string;
    followerUsername: string;
    followerAvatar: string;
  }) => void;
  // livestream
  subscribedCreators: string[];
  tipCreator: (creatorId: string, amount: number) => Promise<void>;
  subscribeToCreator: (creatorId: string, price: number) => Promise<void>;
  purchasePPV: (streamId: string, price: number) => Promise<void>;
  setMode: (mode: 'mock' | 'localnet') => void;
  setRpcUrl: (url: string) => void;
  // fractionalize
  fractionalizedNfts: FractionalizedNft[];
  buyFragment: (nftId: string, count: number) => Promise<void>;
  sellFragment: (nftId: string, count: number) => Promise<void>;
  claimFragmentRevenue: (nftId: string) => Promise<number>;
  /** Mint a fractional NFT for a piece of content the user owns.
   *
   *  Called from the Composer when the creator ticks the
   *  “Fractionalize this work” toggle on a freshly-published post.
   *  Splits the work into N fragments at price P (ORA per fragment).
   *  The creator keeps all fragments at mint time — fans buy them on
   *  the marketplace.
   *
   *  Returns the canonical NFT id so the caller can deep-link to
   *  /marketplace/fraction/:id. */
  fractionalizeContent: (input: {
    contentId: string;
    title: string;
    coverEmoji?: string;
    coverImage?: string;
    totalFragments: number;
    pricePerFragment: number;
  }) => Promise<{ id: string }>;
  // reputation
  reputationScore: number;
  reputationTier: string;
  // market / bounty
  bounties: BountyItem[];
  /** Submissions the local user has filed against bounties posted by others.
   *  Powers the “Bounties · I submitted” tab in Studio. */
  mySubmissions: BountySubmission[];
  createBounty: (title: string, description: string, reward: number) => Promise<void>;
  submitBountyWork: (bountyId: string, workUrl: string, note?: string) => Promise<void>;
  awardBounty: (bountyId: string) => Promise<void>;
  adBids: AdBid[];
  reloadState?: () => void;
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  /** Reviewing committee id (e.g. 'development-committee'). Required for
   * new proposals; legacy seed proposals may omit it (UI shows "—"). */
  committee?: string;
  /** Tier per whitepaper §19: tier-1 (immutable, never accepted),
   * tier-2 (75% supermajority + 5 committees), tier-3 (50% standard,
   * default), tier-4 (committee-only). Defaults to tier-3. */
  tier?: 'tier-1' | 'tier-2' | 'tier-3' | 'tier-4';
  votesFor: number;
  votesAgainst: number;
  status: 'voting' | 'passed' | 'rejected';
  deadline: string;
  /** Wallet address of the proposer (for legacy seed: 'aura-team'). */
  proposer?: string;
  /** Unix ms timestamp when the proposal was created. */
  createdAt?: number;
}

// 2026-05-09 update: per whitepaper §13.1 Phase 1 (Foundation, Year 1)
// the protocol is centralized — "All committees managed by core team;
// community proposals accepted but team has final decision authority."
//
// Showing fake community proposals here would lie about the current
// governance state. We start with an empty proposal list and let the
// real data populate organically as the team submits proposals (or as
// the demo user uses the Create Proposal flow).
const MOCK_PROPOSALS: Proposal[] = [];

const MockChainContext = createContext<MockChainState | null>(null);

// --- Helpers ---
const STORAGE_KEY = 'aura_mock_chain_v9'; // bumped 2026-05-11: mock cleanup + welcome airdrop + ownedNfts (non-fractional NFT inventory)

const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function randomBase58(len: number): string {
  let r = '';
  for (let i = 0; i < len; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}

function randomHex(len: number): string {
  let r = '';
  const h = '0123456789abcdef';
  for (let i = 0; i < len; i++) r += h[Math.floor(Math.random() * 16)];
  return r;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Activity Reward: Base(2) + 48 / (1 + MAU/50000), mock MAU = 1000
function calcActivityReward(): number {
  const base = 2;
  const mau = 1000;
  return base + 48 / (1 + mau / 50000);
}

// --- Fractionalize / Reputation / Market types & defaults ---
export interface FractionalizedNft {
  id: string; title: string; coverEmoji: string;
  /** Optional image URL used as the card cover (data URL or remote URL).
   *  Populated when a content-backed fractional NFT is minted via
   *  fractionalizeContent (Composer > “Fractionalize this work”). */
  coverImage?: string;
  /** Optional source content id when this NFT was minted from a post. */
  contentId?: string;
  totalFragments: number; soldFragments: number; ownedFragments: number;
  pricePerFragment: number; revenue: number; creator: string;
}
export interface BountyItem {
  id: string; title: string; description: string; reward: number;
  deadline: string; submissionCount: number; status: 'active' | 'completed' | 'expired'; creator: string;
}

/** Tracks a single bounty submission by the local user, so the Studio
 *  Bounties tab can render “I submitted” alongside “I posted”. Stored
 *  in mock chain state (mirrors what the on-chain program would emit). */
export interface BountySubmission {
  id: string;
  bountyId: string;
  bountyTitle: string;
  workUrl: string;
  /** Free-form note attached when submitting. */
  note?: string;
  submittedAt: number;
  /** Snapshot of the bounty reward at submission time, for display. */
  rewardSnapshot: number;
  status: 'pending' | 'won' | 'lost';
}
export interface AdBid { id: string; bidder: string; amount: number; slot: string; status: 'active' | 'won' | 'outbid'; }

export function getReputationTier(score: number): string {
  if (score >= 500) return 'Diamond';
  if (score >= 300) return 'Platinum';
  if (score >= 200) return 'Gold';
  if (score >= 150) return 'Silver';
  if (score >= 100) return 'Bronze';
  // 2026-05-11: scores < 100 are unranked — new users haven't earned a badge yet.
  return 'Unranked';
}

// 2026-05-11 — cleared all seeded "global protocol" mock entries. The platform
// now shows honest empty states for marketplace fractionalized NFTs, bounties,
// and ad bids until real users (judges + future creators) post into them.
const DEFAULT_FRACTIONALIZED_NFTS: FractionalizedNft[] = [];
const DEFAULT_BOUNTIES: BountyItem[] = [];
const DEFAULT_AD_BIDS: AdBid[] = [];

interface PersistedState {
  connected: boolean;
  publicKey: string | null;
  oraBalance: number;
  solBalance: number;
  creatorCoins: CreatorCoinHolding[];
  totalBurned: number;
  totalStaked: number;
  dailyCreationCount: number;
  dailyCreationDate: string;
  transactions: Transaction[];
  hasReceivedAirdrop: boolean;
  mode: 'mock' | 'localnet';
  rpcUrl: string;
  // Creator Coin minting
  hasCreatorCoin: boolean;
  creatorCoinSymbol: string | null;
  creatorCoinBalance: number;
  creatorCoinLocked: number;
  creatorCoinVestingMonth: number;
  // Content Keys
  ownedKeys: OwnedKey[];
  listedKeys: ListedKey[];
  // Non-fractional NFTs (auction wins, fixed buys, mystery-box reveals)
  ownedNfts: OwnedNft[];
  // Curation tracking
  curatedContentIds: string[];
  // type-b
  boostedContentIds: string[];
  pinnedContentIds: string[];
  // vault
  vaultBalance: number;
  vestedAmount: number;
  claimedAmount: number;
  // content-license
  licenses: Record<string, License>;
  embeddedContentIds: string[];
  remixLicensedContentIds: string[];
  // remix
  remixes: RemixRecord[];
  remixRevenue: number;
  // own-coin marketplace activity (other users buying/selling MY minted coin)
  ownCoinTrades: OwnCoinExternalTrade[];
  ownCoinHolders: OwnCoinExternalHolder[];
  coinTradeNotifications: CoinTradeNotification[];
  // Foreign creators' primary-issuance batch remaining
  foreignCoinPrimaryRemaining: Record<string, number>;
  // social-graph
  followingIds: string[];
  // staking
  stakedOra: number;
  stakingRewards: number;
  stakes: StakeEntry[];
  // wallet-page (2026-04-30)
  walletAddress: string;
  network: SolanaNetwork;
  curationStats: CurationStats;
  pendingCurations: PendingCuration[];
  creatorCoinRedemptions: CreatorCoinRedemption[];
  myCoinHolders: number;
  // governance
  myVotes: Record<string, 'for' | 'against'>;
  proposals: Proposal[];
  // livestream
  subscribedCreators: string[];
  // fractionalize
  fractionalizedNfts: FractionalizedNft[];
  // reputation
  reputationScore: number;
  // market
  bounties: BountyItem[];
  /** Local user's submissions to bounties posted by other creators. */
  mySubmissions: BountySubmission[];
  adBids: AdBid[];
  // escrowed redemptions
  redemptions: RedemptionRequest[];
  redemptionNotifications: RedemptionNotification[];
  // generic in-app notifications (likes / comments / follows / governance / curation reward)
  inAppNotifications: InAppNotification[];
  // user-authored comments on protocol posts (persisted)
  postComments: PostComment[];
  // committee elections (whitepaper §15)
  electionApplications: ElectionApplication[];
  /** User-uploaded profile banner. Stored as a data URL so it persists
   *  through the same localStorage path the rest of the chain uses. */
  profileBannerUrl: string | null;
  /** Persisted likes — array of post ids. */
  likedPostIds: string[];
}

const defaultState: PersistedState = {
  connected: false,
  publicKey: null,
  oraBalance: 0,
  solBalance: 1.5,
  creatorCoins: [],
  totalBurned: 0,
  totalStaked: 0,
  dailyCreationCount: 0,
  dailyCreationDate: todayKey(),
  transactions: [],
  hasReceivedAirdrop: false,
  mode: 'mock',
  rpcUrl: 'http://localhost:8899',
  hasCreatorCoin: false,
  creatorCoinSymbol: null,
  creatorCoinBalance: 0,
  creatorCoinLocked: 0,
  creatorCoinVestingMonth: 0,
  ownedKeys: [],
  listedKeys: [],
  ownedNfts: [],
  curatedContentIds: [],
  boostedContentIds: [],
  pinnedContentIds: [],
  vaultBalance: 0,
  vestedAmount: 0,
  claimedAmount: 0,
  licenses: {},
  embeddedContentIds: [],
  remixLicensedContentIds: [],
  remixes: [],
  remixRevenue: 0,
  ownCoinTrades: [],
  ownCoinHolders: [],
  coinTradeNotifications: [],
  // Foreign creator's primary issuance batch — follows AURA tokenomics:
  // mint 10,000 → 2,000 initial unlocked (creator wallet, available to sell)
  // → 8,000 locked in vesting vault (releases 800/month over 10 months).
  foreignCoinPrimaryRemaining: { '$IRIS': 2000 },
  followingIds: ['iris'],
  stakedOra: 0,
  stakingRewards: 0,
  stakes: [],
  walletAddress: 'AURADemo1111111111111111111111111111119xZ4567',
  network: 'devnet',
  curationStats: { todayCount: 0, todayOraSpent: 0, totalScore: 0, totalRewards: 0 },
  pendingCurations: [],
  creatorCoinRedemptions: [],
  myCoinHolders: 0, // Real value derived from ownCoinHolders.length when surfaced.
  myVotes: {},
  proposals: MOCK_PROPOSALS,
  subscribedCreators: [],
  fractionalizedNfts: DEFAULT_FRACTIONALIZED_NFTS,
  // 2026-05-11: new users start with 0 reputation — they earn it by
  // curating, contributing, holding tokens, etc. Bronze badge is auto-derived
  // by getReputationTier() when score >= 100.
  reputationScore: 0,
  bounties: DEFAULT_BOUNTIES,
  mySubmissions: [],
  adBids: DEFAULT_AD_BIDS,
  redemptions: [],
  redemptionNotifications: [],
  inAppNotifications: [],
  postComments: [],
  electionApplications: [],
  profileBannerUrl: null,
  likedPostIds: [],
};

function purgeStaleKeys() {
  try {
    // 2026-05-11 R2: when bumping STORAGE_KEY, migrate balance/holdings from the
    // most recent prior version so users don't lose their ORA / NFTs / stakes
    // every time we change schema. We only migrate when the *new* key has no
    // data yet (first load after the version bump); otherwise the existing
    // current-version state wins.
    const PRIOR_KEYS = [
      'aura_mock_chain_v8',
      'aura_mock_chain_v7',
      'aura_mock_chain_v6',
      'aura_mock_chain_v5',
      'aura_mock_chain_v4',
      'aura_mock_chain_v3',
      'aura_mock_chain_v2',
      'aura_mock_chain',
    ];
    const currentRaw = localStorage.getItem(STORAGE_KEY);
    if (!currentRaw) {
      // Find the freshest prior state and copy it under the new key. The
      // schema is mostly additive (we add fields each version), so spreading
      // it into defaultState in load() will backfill any new fields safely.
      for (const k of PRIOR_KEYS) {
        const v = localStorage.getItem(k);
        if (v) {
          // eslint-disable-next-line no-console
          console.info(`[mockChain] migrating state from ${k} → ${STORAGE_KEY}`);
          localStorage.setItem(STORAGE_KEY, v);
          break;
        }
      }
    }
    // Now remove all legacy/stale aura_mock_chain* keys except the current.
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith('aura_mock_chain') && k !== STORAGE_KEY) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

function load(): PersistedState {
  purgeStaleKeys();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      // Strict sanitisation: drop any "50 IRIS" or other seeded mock holdings that may have
      // been persisted before the 2026-04-28 cleanup.
      const cleanCoins = Array.isArray(parsed.creatorCoins)
        ? parsed.creatorCoins.filter(c => {
            // Keep coins the user actually minted (matches their creatorCoinSymbol)
            // Drop $IRIS holdings that match the legacy seed (amount: 50, no real trade history)
            if (c.symbol === '$IRIS' && c.amount === 50 && (!parsed.transactions || !parsed.transactions.some(t => t.type === 'buy_coin' && (t.details || '').includes('$IRIS')))) {
              return false;
            }
            return true;
          }).map(c => {
            // Backfill mintedAt for coins persisted before the field existed.
            // Use the original mint_coin tx timestamp when available; fallback to now.
            if (c.mintedAt) return c;
            const mintTx = (parsed.transactions || []).find(t => t.type === 'mint_coin' && (t.details || '').includes(c.symbol));
            return { ...c, mintedAt: mintTx?.timestamp ?? Date.now() };
          })
        : [];
      // Also drop legacy mock transactions (jtx2-jtx5 from the old judge seed)
      const cleanTxs = Array.isArray(parsed.transactions)
        ? parsed.transactions.filter(t => !['jtx2', 'jtx3', 'jtx4', 'jtx5'].includes(t.id))
        : [];
      // Migration: foreignCoinPrimaryRemaining[$IRIS] used to default to 8500
      // (legacy bug). Per AURA tokenomics, Iris's primary issuance batch is 2,000.
      // Clamp legacy values — her remaining = 2000 − (whatever the judge already holds).
      const judgeIrisHolding = cleanCoins.find(c => c.symbol === '$IRIS')?.amount ?? 0;
      const fixedForeign = { ...(parsed.foreignCoinPrimaryRemaining || {}) };
      if ((fixedForeign['$IRIS'] ?? 0) > 2000 - judgeIrisHolding) {
        fixedForeign['$IRIS'] = Math.max(0, 2000 - judgeIrisHolding);
      }
      const merged: PersistedState = {
        ...defaultState,
        ...parsed,
        creatorCoins: cleanCoins,
        transactions: cleanTxs,
        foreignCoinPrimaryRemaining: fixedForeign,
        stakes: Array.isArray((parsed as any).stakes) ? (parsed as any).stakes : [],
        curationStats: (parsed as any).curationStats || { ...defaultState.curationStats },
        pendingCurations: Array.isArray((parsed as any).pendingCurations) ? (parsed as any).pendingCurations : [],
        creatorCoinRedemptions: Array.isArray((parsed as any).creatorCoinRedemptions) ? (parsed as any).creatorCoinRedemptions : [],
        walletAddress: (parsed as any).walletAddress || defaultState.walletAddress,
        network: (parsed as any).network || defaultState.network,
        myCoinHolders: typeof (parsed as any).myCoinHolders === 'number' ? (parsed as any).myCoinHolders : defaultState.myCoinHolders,
      };
      // Migration: if legacy stakedOra > 0 but no stakes[], synthesize a flexible bucket
      if ((!merged.stakes || merged.stakes.length === 0) && (merged.stakedOra || 0) > 0) {
        merged.stakes = [{
          id: `stk_legacy_${Date.now()}`,
          amount: merged.stakedOra,
          lockDays: 30,
          multiplier: 1.0,
          startedAt: Date.now() - 5 * 86400000,
          unlocksAt: Date.now() + 25 * 86400000,
        }];
      }
      if (merged.dailyCreationDate !== todayKey()) {
        merged.dailyCreationCount = 0;
        merged.dailyCreationDate = todayKey();
      }
      // 2026-04-30: clear any persisted mock-accrued staking rewards
      merged.stakingRewards = 0;

      // 2026-05-09 R2: Proposal seed cleanup. Per whitepaper §13.1 we are
      // in Phase 1 (Foundation, Year 1) — there is no community governance
      // yet. The old seeded p1–p4 proposals were demo data; drop them
      // entirely and keep only proposals that the user actually created
      // through the Create Proposal flow.
      const LEGACY_SEED_IDS = new Set(['p1', 'p2', 'p3', 'p4']);
      merged.proposals = (merged.proposals || []).filter(p => !LEGACY_SEED_IDS.has(p.id));

      // 2026-05-11: post-migration self-heal. If a logged-in user ended up
      // with 0 ORA and no welcome airdrop in history (likely because a prior
      // schema bump wiped their state), restore the welcome airdrop. This
      // is idempotent: once `hasReceivedAirdrop` is true OR a welcome tx is
      // present, we leave the state alone.
      try {
        if (typeof window !== 'undefined' && localStorage.getItem('aura_auth')) {
          const hasWelcomeTx = (merged.transactions || []).some(t =>
            t.id === 'welcome_airdrop' || t.id === 'welcome_airdrop_restored' || t.id === 'jtx1'
          );
          const isJudge = merged.publicKey === 'JuDgE7xKp4mN2qR9vBcAuRa2026HaCkAtHoN';
          if (!isJudge && !merged.hasReceivedAirdrop && !hasWelcomeTx && (merged.oraBalance || 0) === 0) {
            merged.connected = true;
            merged.publicKey = merged.publicKey || ('AURA' + Math.random().toString(36).slice(2, 10).toUpperCase() + 'Restore');
            merged.oraBalance = 10;
            merged.hasReceivedAirdrop = true;
            merged.transactions = [
              {
                id: 'welcome_airdrop_restored',
                type: 'airdrop',
                amount: 10,
                timestamp: Date.now(),
                txHash: 'restore' + Math.random().toString(36).slice(2, 10),
                details: 'Welcome airdrop: 10 ORA (restored after migration)',
                breakdown: {
                  items: [{ label: 'Welcome airdrop', amount: 10, sub: 'AURA onboarding grant', tone: 'positive' }],
                  settlement: { label: 'Credited to ORA balance', amount: 10, tone: 'positive' },
                  note: 'Restored after a state migration cleared the previous wallet snapshot.',
                },
              },
              ...(merged.transactions || []),
            ];
          }
        }
      } catch { /* ignore */ }

      return merged;
    }
  } catch { /* ignore */ }

  // No prior state at all. If the user is already authenticated (aura_auth exists)
  // but they have no chain state, they're a registered user whose state got wiped
  // by a schema migration. Restore the welcome airdrop so they're not at 0 ORA.
  // 2026-05-11 self-heal: triggered when v8→v9 migration didn't find prior data.
  try {
    if (typeof window !== 'undefined' && localStorage.getItem('aura_auth')) {
      const restored: PersistedState = {
        ...defaultState,
        connected: true,
        publicKey: 'AURA' + Math.random().toString(36).slice(2, 10).toUpperCase() + 'Restore',
        oraBalance: 10,
        hasReceivedAirdrop: true,
        transactions: [
          {
            id: 'welcome_airdrop_restored',
            type: 'airdrop',
            amount: 10,
            timestamp: Date.now(),
            txHash: 'restore' + Math.random().toString(36).slice(2, 10),
            details: 'Welcome airdrop: 10 ORA (restored after migration)',
            breakdown: {
              items: [
                { label: 'Welcome airdrop', amount: 10, sub: 'AURA onboarding grant', tone: 'positive' },
              ],
              settlement: { label: 'Credited to ORA balance', amount: 10, tone: 'positive' },
              note: 'Restored after a state migration cleared the previous wallet snapshot. Future migrations preserve balances.',
            },
          },
        ],
      };
      return restored;
    }
  } catch { /* ignore */ }

  return { ...defaultState };
}

function save(s: PersistedState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// Fresh-account starter state — what every new registered user gets on signup.
// Per tokenomics: every new account receives a 10 ORA welcome airdrop so they can
// immediately try curation, tipping, and other ORA-gated actions without having to
// connect a wallet first. Wallet connection later issues a *separate* on-chain airdrop
// to the real Solana address.
export const NEW_ACCOUNT_STARTER_STATE: PersistedState = {
  ...defaultState,
  // New accounts are considered "connected" once they finish signup — we hand them
  // a custodial-style mock wallet immediately so the rest of the UI works without
  // requiring them to install Phantom/Solflare first. Real on-chain wallet linking
  // happens later via /settings or the Wallet page connect button.
  connected: true,
  publicKey: 'AURA' + Math.random().toString(36).slice(2, 10).toUpperCase() + 'NewAcct',
  oraBalance: 10,
  hasReceivedAirdrop: true,
  transactions: [
    {
      id: 'welcome_airdrop',
      type: 'airdrop',
      amount: 10,
      timestamp: Date.now(),
      txHash: 'welcome' + Math.random().toString(36).slice(2, 10),
      details: 'Welcome airdrop: 10 ORA',
      breakdown: {
        items: [
          { label: 'Welcome airdrop', amount: 10, sub: 'AURA onboarding grant for new accounts', tone: 'positive' },
        ],
        settlement: { label: 'Credited to ORA balance', amount: 10, tone: 'positive' },
        note: 'Every new account receives 10 ORA on signup to explore the protocol — curate posts, tip creators, vote on proposals.',
      },
    },
  ],
};

// Pre-populated judge demo state — rich account for hackathon evaluators
export const JUDGE_DEMO_STATE: PersistedState = {
  ...defaultState,
  connected: true,
  publicKey: 'JuDgE7xKp4mN2qR9vBcAuRa2026HaCkAtHoN',
  oraBalance: 10000,
  solBalance: 5.0,
  hasReceivedAirdrop: true,
  // Evaluator hasn't minted yet — walks through Mint flow on Profile page
  hasCreatorCoin: false,
  creatorCoinSymbol: '',
  creatorCoinBalance: 0,
  creatorCoinLocked: 0,
  creatorCoinVestingMonth: 0,
  stakedOra: 100,
  // 2026-04-30: pending rewards always 0 (no mocked accrual). UI shows formula instead.
  stakingRewards: 0,
  stakes: [
    {
      id: 'jstk1',
      amount: 100,
      lockDays: 30,
      multiplier: 1.0,
      startedAt: Date.now() - 5 * 86400000,
      unlocksAt: Date.now() + 25 * 86400000,
    },
  ],
  walletAddress: 'AURADemo1111111111111111111111111111119xZ4567',
  network: 'devnet',
  curationStats: { todayCount: 0, todayOraSpent: 0, totalScore: 0, totalRewards: 0 },
  // Round 4 (2026-04-30): no mocked pending curations — UI shows empty state until real chain data arrives.
  pendingCurations: [],
  creatorCoinRedemptions: [],
  myCoinHolders: 0, // Honest seed — holders accumulate as users actually buy CC.
  reputationScore: 0,
  followingIds: ['iris'],
  creatorCoins: [],
  ownedKeys: [],
  ownedNfts: [],
  curatedContentIds: [],
  transactions: [
    {
      id: 'jtx1', type: 'airdrop', amount: 10000,
      timestamp: Date.now() - 86400000 * 3,
      txHash: 'a1b2c3d4e5f6',
      details: 'Evaluator welcome grant: 10000 ORA',
      breakdown: {
        items: [
          { label: 'Evaluator welcome grant', amount: 10000, sub: 'AURA hackathon evaluator allowance', tone: 'positive' },
        ],
        settlement: { label: 'Credited to ORA balance', amount: 10000, tone: 'positive' },
        note: 'Hackathon evaluators receive 10000 ORA on login to explore every protocol feature end-to-end.',
      },
    },
  ],
};

// --- Provider ---
export function MockChainProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(load);
  // Mirror state in a ref for sync reads inside async callbacks (avoids throwing in setState updaters).
  const stateRef = useRef(state);
  stateRef.current = state;

  // Persist on every state change
  useEffect(() => { save(state); }, [state]);

  const connectWallet = useCallback(async (realAddress?: string): Promise<{ isFirstTime: boolean }> => {
    await new Promise(r => setTimeout(r, 400));
    // Real wallet flow: treat the connecting wallet as a brand-new user.
    //   - Reset all user-private state (balances, content, followers, coins,
    //     stakes, keys, curations, etc.) back to defaultState
    //   - Issue the 10 ORA welcome airdrop (per tokenomics: every new wallet)
    //   - Keep global protocol-level data (proposals, bounties, ad bids,
    //     fractionalized NFTs) so the platform still has content to browse
    // Per-address localStorage fingerprint prevents double-airdrop across
    // sessions for the same wallet.
    if (realAddress) {
      const seenKey = `aura_seen:${realAddress}`;
      const seenBefore = localStorage.getItem(seenKey) === '1';
      const isFirst = !seenBefore;
      if (isFirst) localStorage.setItem(seenKey, '1');

      setState(prev => {
        const txs: typeof prev.transactions = [];
        let bal = 0;
        if (isFirst) {
          bal = 10;
          txs.unshift({
            id: crypto.randomUUID(),
            type: 'airdrop',
            amount: 10,
            timestamp: Date.now(),
            txHash: randomHex(64),
            details: `Welcome airdrop: 10 ORA (to ${realAddress.slice(0, 4)}...${realAddress.slice(-4)})`,
            breakdown: {
              items: [
                { label: 'Welcome airdrop', amount: 10, sub: 'AURA onboarding grant', tone: 'positive' },
              ],
              settlement: { label: 'Credited to ORA balance', amount: 10, tone: 'positive' },
              note: 'New wallets get 10 ORA on first connect to try the protocol. No fee, no vesting.',
            },
          });
        }
        return {
          ...defaultState,
          // Keep global, non-user-specific data
          proposals: prev.proposals,
          bounties: prev.bounties,
          adBids: prev.adBids,
          fractionalizedNfts: prev.fractionalizedNfts,
          // User-specific state for the connecting wallet
          connected: true,
          publicKey: realAddress,
          walletAddress: realAddress,
          oraBalance: bal,
          hasReceivedAirdrop: isFirst,
          transactions: txs,
          // Empty social graph — no following, no followers, no content
          followingIds: [],
        };
      });
      return { isFirstTime: isFirst };
    }

    const seenBefore = state.hasReceivedAirdrop;
    const isFirst = !seenBefore;
    setState(prev => {
      const pk = prev.publicKey || randomBase58(44);
      const txs = [...prev.transactions];
      let bal = prev.oraBalance;
      if (isFirst) {
        bal += 10;
        txs.unshift({
          id: crypto.randomUUID(),
          type: 'airdrop',
          amount: 10,
          timestamp: Date.now(),
          txHash: randomHex(64),
          details: 'Welcome airdrop: 10 ORA',
          breakdown: {
            items: [
              { label: 'Welcome airdrop', amount: 10, sub: 'AURA onboarding grant', tone: 'positive' },
            ],
            settlement: { label: 'Credited to ORA balance', amount: 10, tone: 'positive' },
            note: 'New wallets get 10 ORA on first connect to try the protocol. No fee, no vesting.',
          },
        });
      }
      return {
        ...prev,
        connected: true,
        publicKey: pk,
        oraBalance: bal,
        hasReceivedAirdrop: true,
        transactions: txs,
      };
    });
    return { isFirstTime: isFirst };
  }, [state.hasReceivedAirdrop]);

  const disconnectWallet = useCallback(() => {
    setState(prev => ({ ...prev, connected: false }));
  }, []);

  const publishContent = useCallback(async (_content: any): Promise<{ txHash: string; reward: number }> => {
    await new Promise(r => setTimeout(r, 600));
    const today = todayKey();
    const count = state.dailyCreationDate === today ? state.dailyCreationCount : 0;
    const hasReward = count < 2;
    const reward = !hasReward ? 0 : parseFloat(calcActivityReward().toFixed(4));
    const txHash = randomHex(64);
    setState(prev => {
      const txs = [...prev.transactions];
      // Auto-deposit 30% of reward to Creator Vault (linear vesting).
      // The remaining 70% lands directly in the spendable ORA balance.
      const vaultDeposit = parseFloat((reward * 0.3).toFixed(4));
      const spendable = parseFloat((reward - vaultDeposit).toFixed(4));
      txs.unshift({
        id: crypto.randomUUID(),
        type: 'publish',
        amount: 0,
        timestamp: Date.now(),
        txHash,
        details: 'Content published to Arweave',
        breakdown: {
          items: [
            { label: 'Storage', amount: 0, sub: 'Arweave permaweb', tone: 'muted' },
          ],
          note: 'Content stored permanently on Arweave — no protocol fee for publishing.',
        },
      });
      txs.unshift({
        id: crypto.randomUUID(),
        type: 'reward',
        amount: spendable,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `Activity Reward: +${spendable.toFixed(4)} ORA spendable, +${vaultDeposit.toFixed(4)} ORA vested`,
        breakdown: {
          items: [
            { label: 'Activity Reward (gross)', amount: reward, sub: 'Base 2 + 48/(1 + MAU/50000)', tone: 'positive' },
            { label: 'Auto-deposit to Creator Vault (30%)', amount: -vaultDeposit, sub: 'Linear vesting release', tone: 'muted' },
          ],
          settlement: { label: 'Spendable in ORA balance', amount: spendable, tone: 'positive' },
          note: '30% of every creator reward is auto-vested into the Creator Vault as a forced-savings + dump-and-run protection (whitepaper §5).',
        },
      });
      return {
        ...prev,
        oraBalance: prev.oraBalance + spendable,
        dailyCreationCount: (prev.dailyCreationDate === today ? prev.dailyCreationCount : 0) + 1,
        dailyCreationDate: today,
        transactions: txs,
        vaultBalance: prev.vaultBalance + vaultDeposit,
        vestedAmount: prev.vestedAmount + vaultDeposit,
      };
    });
    return { txHash, reward };
  }, [state.dailyCreationCount, state.dailyCreationDate]);

  const mintCreatorCoin = useCallback(async (rawSymbol?: string, name?: string, opts?: { logoUrl?: string; benefits?: CoinBenefit[]; initialPrice?: number }): Promise<{ success: boolean; amount: number; symbol: string; initialPrice: number }> => {
    await new Promise(r => setTimeout(r, 500));
    const totalSupply = 10000;
    const initialRelease = 2000;
    const locked = 8000;
    // Normalize symbol: strip $, uppercase, max 6 chars, fallback $MYCOIN
    const cleaned = (rawSymbol || 'MYCOIN').replace(/^\$/, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'MYCOIN';
    const symbol = '$' + cleaned;
    const coinName = name?.trim() || `${cleaned} Creator Coin`;
    const initialPrice = Math.max(0.01, opts?.initialPrice ?? 1.00);
    setState(prev => {
      const existing = prev.creatorCoins.find(c => c.symbol === symbol);
      const nowTs = Date.now();
      const coins = existing
        ? prev.creatorCoins.map(c => c.symbol === symbol ? { ...c, amount: c.amount + initialRelease, logoUrl: opts?.logoUrl ?? c.logoUrl, benefits: opts?.benefits ?? c.benefits, initialPrice, mintedAt: c.mintedAt ?? nowTs } : c)
        : [...prev.creatorCoins, { name: coinName, symbol, amount: initialRelease, logoUrl: opts?.logoUrl, benefits: opts?.benefits, initialPrice, mintedAt: nowTs }];
      const txs = [...prev.transactions];
      txs.unshift({
        id: crypto.randomUUID(),
        type: 'mint_coin',
        amount: totalSupply,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `Minted ${totalSupply} ${symbol} (${initialRelease} released, ${locked} locked)`,
      });
      return {
        ...prev,
        creatorCoins: coins,
        transactions: txs,
        hasCreatorCoin: true,
        creatorCoinSymbol: symbol,
        creatorCoinBalance: initialRelease,
        creatorCoinLocked: locked,
        creatorCoinVestingMonth: 0,
        // Reset own-coin market activity for the new coin
        ownCoinTrades: [],
        ownCoinHolders: [],
      };
    });
    return { success: true, amount: totalSupply, symbol, initialPrice };
  }, []);

  const simulateExternalCoinBuy = useCallback((_symbol: string, amount: number, pricePerCoin: number, buyer: { name: string; avatar: string; username: string; id?: string }, marketType: 'primary' | 'secondary' = 'primary') => {
    setState(prev => {
      // External buyer pays ORA = amount * price; 5% fee deducted (Type A: creator receives 95%).
      const grossOra = amount * pricePerCoin;
      const fee = grossOra * 0.05;
      const proceeds = grossOra - fee;
      const burn = grossOra * 0.02;
      const staking = grossOra * 0.02;
      const newTrade: OwnCoinExternalTrade = {
        id: crypto.randomUUID(),
        type: 'buy',
        userName: buyer.name,
        userAvatar: buyer.avatar,
        userUsername: buyer.username,
        amount,
        price: pricePerCoin,
        total: parseFloat(grossOra.toFixed(4)),
        timestamp: Date.now(),
      };
      const buyerId = buyer.id || buyer.username;
      const existingHolder = prev.ownCoinHolders.find(h => h.id === buyerId);
      const newHolders: OwnCoinExternalHolder[] = existingHolder
        ? prev.ownCoinHolders.map(h => h.id === buyerId ? { ...h, amount: h.amount + amount } : h)
        : [...prev.ownCoinHolders, { id: buyerId, name: buyer.name, avatar: buyer.avatar, username: buyer.username, amount }];
      // Creator's own holding (the 2,000 unlocked supply) decreases by what was sold to the buyer.
      const creatorSymbol = prev.creatorCoinSymbol;
      const newCreatorBalance = Math.max(0, prev.creatorCoinBalance - amount);
      const updatedCreatorCoins = creatorSymbol
        ? prev.creatorCoins.map(c => c.symbol === creatorSymbol ? { ...c, amount: Math.max(0, c.amount - amount) } : c)
        : prev.creatorCoins;
      const txs = [...prev.transactions];
      const gasReserve = grossOra * 0.005;
      const opsShare = grossOra * 0.005;
      txs.unshift({
        id: crypto.randomUUID(),
        type: 'sell_coin',
        amount: proceeds,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `${buyer.name} bought ${amount} ${creatorSymbol || ''} — received ${proceeds.toFixed(4)} ORA (fee: ${fee.toFixed(4)} ORA)`,
        breakdown: {
          items: [
            { label: `${amount.toLocaleString()} ${creatorSymbol || ''} × ${pricePerCoin.toFixed(4)} ORA`, amount: grossOra, sub: 'Gross trade size', tone: 'positive' },
            { label: 'Protocol fee (5%)', amount: -fee, sub: 'Deducted from gross', tone: 'negative' },
          ],
          fee: {
            totalFee: parseFloat(fee.toFixed(4)),
            burn: parseFloat(burn.toFixed(4)),
            staking: parseFloat(staking.toFixed(4)),
            gasReserve: parseFloat(gasReserve.toFixed(4)),
            ops: parseFloat(opsShare.toFixed(4)),
          },
          settlement: { label: 'You received', amount: parseFloat(proceeds.toFixed(4)), tone: 'positive' },
          note: `${buyer.name} bought ${amount} ${creatorSymbol || 'CC'} from your ${marketType === 'primary' ? 'primary issuance' : 'marketplace order'}.`,
        },
      });
      const notification: CoinTradeNotification = {
        id: crypto.randomUUID(),
        marketType,
        buyerName: buyer.name,
        buyerAvatar: buyer.avatar,
        buyerUsername: buyer.username,
        amount,
        price: pricePerCoin,
        total: parseFloat(grossOra.toFixed(4)),
        proceeds: parseFloat(proceeds.toFixed(4)),
        symbol: creatorSymbol || '',
        timestamp: Date.now(),
        isRead: false,
      };
      return {
        ...prev,
        creatorCoinBalance: newCreatorBalance,
        creatorCoins: updatedCreatorCoins,
        oraBalance: prev.oraBalance + proceeds,
        totalBurned: prev.totalBurned + burn,
        totalStaked: prev.totalStaked + staking,
        transactions: txs,
        ownCoinTrades: [newTrade, ...prev.ownCoinTrades].slice(0, 50),
        ownCoinHolders: newHolders,
        coinTradeNotifications: [notification, ...prev.coinTradeNotifications].slice(0, 50),
      };
    });
  }, []);

  const simulateExternalCoinSellToMe = useCallback((_symbol: string, amount: number, pricePerCoin: number, seller: { name: string; avatar: string; username: string; id?: string }) => {
    setState(prev => {
      const grossOra = amount * pricePerCoin;
      const fee = grossOra * 0.05;
      const totalCost = grossOra + fee;
      if (prev.oraBalance < totalCost) {
        // Not enough ORA — silently skip; in real system buy order would just sit unfilled.
        return prev;
      }
      const burn = grossOra * 0.02;
      const staking = grossOra * 0.02;
      const creatorSymbol = prev.creatorCoinSymbol;
      const newTrade: OwnCoinExternalTrade = {
        id: crypto.randomUUID(),
        type: 'sell',
        userName: seller.name,
        userAvatar: seller.avatar,
        userUsername: seller.username,
        amount,
        price: pricePerCoin,
        total: parseFloat(grossOra.toFixed(4)),
        timestamp: Date.now(),
      };
      const updatedCoins = creatorSymbol
        ? prev.creatorCoins.map(c => c.symbol === creatorSymbol ? { ...c, amount: c.amount + amount } : c)
        : prev.creatorCoins;
      const txs = [...prev.transactions];
      txs.unshift({
        id: crypto.randomUUID(),
        type: 'buy_coin',
        amount: -totalCost,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `${seller.name} filled your buy order — bought ${amount} ${creatorSymbol || ''} for ${totalCost.toFixed(2)} ORA (fee: ${fee.toFixed(4)})`,
      });
      const notification: CoinTradeNotification = {
        id: crypto.randomUUID(),
        marketType: 'secondary',
        buyerName: seller.name,
        buyerAvatar: seller.avatar,
        buyerUsername: seller.username,
        amount,
        price: pricePerCoin,
        total: parseFloat(grossOra.toFixed(4)),
        proceeds: parseFloat((-totalCost).toFixed(4)),
        symbol: creatorSymbol || '',
        timestamp: Date.now(),
        isRead: false,
      };
      return {
        ...prev,
        oraBalance: prev.oraBalance - totalCost,
        creatorCoinBalance: prev.creatorCoinBalance + amount,
        creatorCoins: updatedCoins,
        totalBurned: prev.totalBurned + burn,
        totalStaked: prev.totalStaked + staking,
        transactions: txs,
        ownCoinTrades: [newTrade, ...prev.ownCoinTrades].slice(0, 50),
        coinTradeNotifications: [notification, ...prev.coinTradeNotifications].slice(0, 50),
      };
    });
  }, []);

  /**
   * Legacy direct-redeem (kept for compatibility — NOT used by the new escrow flow).
   * @deprecated Use initiateRedemption instead.
   */
  const redeemCoinBenefit = useCallback(async (_symbol: string, _benefitId: string, _cost: number, _title: string): Promise<void> => {
    throw new Error('redeemCoinBenefit is deprecated. Use initiateRedemption to enter the escrowed redemption flow.');
  }, []);

  // ---------------------------------------------------------------------------
  // Escrowed Redemption Flow (Taobao-style)
  // ---------------------------------------------------------------------------
  // Step 1: initiateRedemption  — buyer locks CC into protocol escrow
  // Step 2: markRedemptionDelivered — creator marks the perk as delivered (+ optional note)
  // Step 3: confirmRedemptionReceipt — buyer confirms receipt; CC released to creator

  const initiateRedemption = useCallback(async (
    rawSymbol: string,
    benefit: { id: string; title: string; description: string; threshold: number },
    opts?: { creatorName?: string; creatorAvatar?: string }
  ): Promise<RedemptionRequest> => {
    await new Promise(r => setTimeout(r, 300));
    // Normalize: callers may pass "IRIS" or "$IRIS"; storage always uses "$IRIS".
    const symbol = rawSymbol.startsWith('$') ? rawSymbol : '$' + rawSymbol;
    // Pre-validate against the latest state snapshot (so we don't throw inside setState
    // and trigger a render-phase crash).
    const snapshot = stateRef.current;
    if (snapshot.creatorCoinSymbol === symbol) {
      throw new Error("You can't redeem your own coin's benefits.");
    }
    const holdingNow = snapshot.creatorCoins.find(c => c.symbol === symbol);
    const cost = benefit.threshold;
    if (!holdingNow || holdingNow.amount < cost) {
      throw new Error(`Insufficient ${symbol} balance — need ${cost}, you have ${holdingNow?.amount ?? 0}.`);
    }
    let created: RedemptionRequest | null = null;
    setState(prev => {
      const holding = prev.creatorCoins.find(c => c.symbol === symbol);
      if (!holding || holding.amount < cost) return prev; // race-safe no-op
      // Lock CC into escrow (deduct from buyer's holding).
      const updatedCoins = prev.creatorCoins.map(c =>
        c.symbol === symbol ? { ...c, amount: c.amount - cost } : c
      );
      const req: RedemptionRequest = {
        id: crypto.randomUUID(),
        symbol,
        benefitId: benefit.id,
        benefitTitle: benefit.title,
        benefitDescription: benefit.description,
        cost,
        buyerName: 'You',
        buyerAvatar: undefined,
        creatorName: opts?.creatorName || symbol.replace(/^\$/, ''),
        creatorAvatar: opts?.creatorAvatar,
        perspective: 'me_as_buyer',
        status: 'pending_delivery',
        createdAt: Date.now(),
      };
      created = req;
      const txs = [...prev.transactions];
      txs.unshift({
        id: crypto.randomUUID(),
        type: 'buy_key',
        amount: 0,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `Redemption initiated: ${benefit.title} · ${cost} ${symbol} held in escrow`,
      });
      const notif: RedemptionNotification = {
        id: crypto.randomUUID(),
        kind: 'initiated',
        redemptionId: req.id,
        symbol,
        benefitTitle: benefit.title,
        cost,
        who: req.buyerName,
        whoAvatar: req.buyerAvatar,
        audience: 'creator',
        timestamp: Date.now(),
        isRead: false,
      };
      return {
        ...prev,
        creatorCoins: updatedCoins,
        transactions: txs,
        redemptions: [req, ...prev.redemptions],
        redemptionNotifications: [notif, ...prev.redemptionNotifications].slice(0, 100),
      };
    });
    if (!created) throw new Error('Failed to initiate redemption.');
    return created;
  }, []);

  // Mock: auto-confirm window after delivery (30s for demo; production = 7 days).
  const AUTO_CONFIRM_MS = 30_000;

  const markRedemptionDelivered = useCallback(async (id: string, note?: string): Promise<void> => {
    await new Promise(r => setTimeout(r, 250));
    setState(prev => {
      const target = prev.redemptions.find(r => r.id === id);
      if (!target) throw new Error('Redemption not found.');
      if (target.status !== 'pending_delivery') {
        throw new Error(`Cannot mark as delivered — current status: ${target.status}.`);
      }
      const updated = prev.redemptions.map(r =>
        r.id === id ? { ...r, status: 'delivered' as const, deliveredAt: Date.now(), deliveryNote: note } : r
      );
      const txs = [...prev.transactions];
      txs.unshift({
        id: crypto.randomUUID(),
        type: 'buy_key',
        amount: 0,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `Marked as delivered: ${target.benefitTitle} (${target.symbol})`,
      });
      const notif: RedemptionNotification = {
        id: crypto.randomUUID(),
        kind: 'delivered',
        redemptionId: id,
        symbol: target.symbol,
        benefitTitle: target.benefitTitle,
        cost: target.cost,
        who: target.creatorName,
        whoAvatar: target.creatorAvatar,
        audience: 'buyer',
        timestamp: Date.now(),
        isRead: false,
      };
      return {
        ...prev,
        redemptions: updated,
        transactions: txs,
        redemptionNotifications: [notif, ...prev.redemptionNotifications].slice(0, 100),
      };
    });
    // Schedule auto-confirm after the timeout window.
    setTimeout(() => {
      const current = stateRef.current.redemptions.find(r => r.id === id);
      if (current && current.status === 'delivered') {
        setState(prev => {
          const stillDelivered = prev.redemptions.find(r => r.id === id);
          if (!stillDelivered || stillDelivered.status !== 'delivered') return prev;
          const updated = prev.redemptions.map(r =>
            r.id === id ? { ...r, status: 'confirmed' as const, confirmedAt: Date.now() } : r
          );
          const txs = [...prev.transactions];
          txs.unshift({
            id: crypto.randomUUID(),
            type: 'buy_key',
            amount: 0,
            timestamp: Date.now(),
            txHash: randomHex(64),
            details: `Auto-confirmed after timeout: ${stillDelivered.benefitTitle} · ${stillDelivered.cost} ${stillDelivered.symbol} released`,
          });
          const notifBuyer: RedemptionNotification = {
            id: crypto.randomUUID(),
            kind: 'auto_confirmed',
            redemptionId: id,
            symbol: stillDelivered.symbol,
            benefitTitle: stillDelivered.benefitTitle,
            cost: stillDelivered.cost,
            who: stillDelivered.creatorName,
            whoAvatar: stillDelivered.creatorAvatar,
            audience: 'buyer',
            timestamp: Date.now(),
            isRead: false,
          };
          const notifCreator: RedemptionNotification = {
            ...notifBuyer,
            id: crypto.randomUUID(),
            who: stillDelivered.buyerName,
            whoAvatar: stillDelivered.buyerAvatar,
            audience: 'creator',
          };
          return {
            ...prev,
            redemptions: updated,
            transactions: txs,
            redemptionNotifications: [notifCreator, notifBuyer, ...prev.redemptionNotifications].slice(0, 100),
          };
        });
      }
    }, AUTO_CONFIRM_MS);
  }, []);

  const confirmRedemptionReceipt = useCallback(async (id: string): Promise<void> => {
    await new Promise(r => setTimeout(r, 250));
    setState(prev => {
      const target = prev.redemptions.find(r => r.id === id);
      if (!target) throw new Error('Redemption not found.');
      if (target.status !== 'delivered') {
        throw new Error(`Cannot confirm receipt — current status: ${target.status}.`);
      }
      const updated = prev.redemptions.map(r =>
        r.id === id ? { ...r, status: 'confirmed' as const, confirmedAt: Date.now() } : r
      );
      // Release CC from escrow.
      //
      // Pay-to-redeem benefits transfer the CC to the CREATOR's wallet —
      // they are NOT burned. Per whitepaper §6.4: the creator becomes
      // the new holder of the redeemed coins (they can re-list, gift,
      // or hold them). When the local user IS the creator (i.e. the
      // redemption.symbol matches their own minted coin), credit the
      // CC back to their own balance. Otherwise the CC moves to the
      // foreign creator's wallet which the demo does not model.
      const isLocalUserTheCreator = prev.creatorCoinSymbol === target.symbol;
      const updatedCreatorCoins = isLocalUserTheCreator
        ? prev.creatorCoins.map(c =>
            c.symbol === target.symbol ? { ...c, amount: c.amount + target.cost } : c
          )
        : prev.creatorCoins;
      const updatedCreatorCoinBalance = isLocalUserTheCreator
        ? prev.creatorCoinBalance + target.cost
        : prev.creatorCoinBalance;
      const txs = [...prev.transactions];
      txs.unshift({
        id: crypto.randomUUID(),
        type: 'redeem_cc',
        amount: 0,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `Receipt confirmed: ${target.benefitTitle} · ${target.cost} ${target.symbol} transferred to creator${isLocalUserTheCreator ? ' (you)' : ` ${target.creatorName}`}`,
        breakdown: {
          items: [
            { label: `Benefit: ${target.benefitTitle}`, amount: 0, sub: target.benefitDescription, tone: 'muted' },
            { label: `Released from escrow`, amount: -target.cost, sub: `${target.cost} ${target.symbol}`, tone: 'muted' },
            {
              label: isLocalUserTheCreator
                ? `Credited to your ${target.symbol} balance (you are the creator)`
                : `Transferred to creator ${target.creatorName} (${target.symbol})`,
              amount: target.cost,
              sub: 'Pay-to-redeem benefits transfer to the creator — not burned',
              tone: 'positive',
            },
          ],
          settlement: {
            label: isLocalUserTheCreator
              ? `Net balance change: +${target.cost} ${target.symbol}`
              : `Net: ${target.cost} ${target.symbol} sent to ${target.creatorName}`,
            amount: 0,
            tone: 'muted',
          },
          note: `Pay-to-redeem benefits transfer Creator Coins back to the creator's wallet (whitepaper §6.4). The creator can re-list, gift, or hold them — the coins are NOT burned.`,
        },
      });
      const notif: RedemptionNotification = {
        id: crypto.randomUUID(),
        kind: 'confirmed',
        redemptionId: id,
        symbol: target.symbol,
        benefitTitle: target.benefitTitle,
        cost: target.cost,
        who: target.buyerName,
        whoAvatar: target.buyerAvatar,
        audience: 'creator',
        timestamp: Date.now(),
        isRead: false,
      };
      return {
        ...prev,
        redemptions: updated,
        creatorCoins: updatedCreatorCoins,
        creatorCoinBalance: updatedCreatorCoinBalance,
        transactions: txs,
        redemptionNotifications: [notif, ...prev.redemptionNotifications].slice(0, 100),
      };
    });
  }, []);

  // Buyer disputes a delivered redemption — CC stays in escrow (out of both wallets)
  // pending arbitration. In production this would trigger a DAO vote.
  const disputeRedemption = useCallback(async (id: string, reason?: string): Promise<void> => {
    await new Promise(r => setTimeout(r, 250));
    setState(prev => {
      const target = prev.redemptions.find(r => r.id === id);
      if (!target) throw new Error('Redemption not found.');
      if (target.status !== 'delivered') {
        throw new Error(`Cannot dispute — current status: ${target.status}.`);
      }
      const updated = prev.redemptions.map(r =>
        r.id === id ? { ...r, status: 'disputed' as const, disputedAt: Date.now(), disputeReason: reason } : r
      );
      const txs = [...prev.transactions];
      txs.unshift({
        id: crypto.randomUUID(),
        type: 'buy_key',
        amount: 0,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `Disputed: ${target.benefitTitle} · ${target.cost} ${target.symbol} held pending arbitration`,
      });
      const notif: RedemptionNotification = {
        id: crypto.randomUUID(),
        kind: 'disputed',
        redemptionId: id,
        symbol: target.symbol,
        benefitTitle: target.benefitTitle,
        cost: target.cost,
        who: target.buyerName,
        whoAvatar: target.buyerAvatar,
        audience: 'creator',
        timestamp: Date.now(),
        isRead: false,
      };
      return {
        ...prev,
        redemptions: updated,
        transactions: txs,
        redemptionNotifications: [notif, ...prev.redemptionNotifications].slice(0, 100),
      };
    });
  }, []);

  // Gift CC directly to another user (free transfer, no escrow, no fee).
  const giftCreatorCoin = useCallback((rawSymbol: string, amount: number, recipient: { name: string; username: string; avatar: string; id?: string }, message?: string) => {
    const symbol = rawSymbol.startsWith('$') ? rawSymbol : '$' + rawSymbol;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Gift amount must be a positive number.');
    }
    const snap = stateRef.current;
    const isOwn = snap.creatorCoinSymbol === symbol;
    const heldAmount = isOwn
      ? (snap.creatorCoinBalance ?? 0)
      : (snap.creatorCoins.find(c => c.symbol === symbol)?.amount ?? 0);
    if (heldAmount < amount) {
      throw new Error(`Insufficient ${symbol} — you have ${heldAmount}, can't gift ${amount}.`);
    }
    setState(prev => {
      const txs = [...prev.transactions];
      const note = message ? ` “${message}”` : '';
      txs.unshift({
        id: crypto.randomUUID(),
        type: 'sell_coin',
        amount: 0,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `Gifted ${amount} ${symbol} to @${recipient.username}${note}`,
      });
      // Decrement sender's balance.
      const updatedCoins = prev.creatorCoins.map(c =>
        c.symbol === symbol ? { ...c, amount: Math.max(0, c.amount - amount) } : c
      );
      // For OWN coin: track recipient in ownCoinHolders so the public page reflects it.
      if (isOwn) {
        const buyerId = recipient.id || recipient.username;
        const existing = prev.ownCoinHolders.find(h => h.id === buyerId);
        const newHolders = existing
          ? prev.ownCoinHolders.map(h => h.id === buyerId ? { ...h, amount: h.amount + amount } : h)
          : [...prev.ownCoinHolders, { id: buyerId, name: recipient.name, avatar: recipient.avatar, username: recipient.username, amount }];
        const newTrade: OwnCoinExternalTrade = {
          id: crypto.randomUUID(),
          type: 'buy', // recorded as receive
          userName: recipient.name,
          userAvatar: recipient.avatar,
          userUsername: recipient.username,
          amount,
          price: 0, // gifted, no price
          total: 0,
          timestamp: Date.now(),
        };
        return {
          ...prev,
          creatorCoinBalance: Math.max(0, prev.creatorCoinBalance - amount),
          creatorCoins: updatedCoins,
          ownCoinHolders: newHolders,
          ownCoinTrades: [newTrade, ...prev.ownCoinTrades].slice(0, 50),
          transactions: txs,
        };
      }
      return { ...prev, creatorCoins: updatedCoins, transactions: txs };
    });
  }, []);

  const markRedemptionNotificationsRead = useCallback(() => {
    setState(prev => ({
      ...prev,
      redemptionNotifications: prev.redemptionNotifications.map(n => ({ ...n, isRead: true })),
    }));
  }, []);

  // ---------------------------------------------------------------------------
  // In-app notifications (likes / comments / follows / curation_reward / governance)
  // ---------------------------------------------------------------------------
  /** Push a new in-app notification onto the front of the stream. */
  const pushInAppNotification = useCallback((n: Omit<InAppNotification, 'id' | 'timestamp' | 'isRead'> & { id?: string; timestamp?: number; isRead?: boolean }) => {
    setState(prev => ({
      ...prev,
      inAppNotifications: [
        {
          id: n.id ?? `iapn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: n.timestamp ?? Date.now(),
          isRead: n.isRead ?? false,
          type: n.type,
          actorName: n.actorName,
          actorUsername: n.actorUsername,
          actorAvatar: n.actorAvatar,
          message: n.message,
          detail: n.detail,
          postId: n.postId,
          proposalId: n.proposalId,
        },
        ...prev.inAppNotifications,
      ].slice(0, 200),
    }));
  }, []);

  const markInAppNotificationsRead = useCallback(() => {
    setState(prev => ({
      ...prev,
      inAppNotifications: prev.inAppNotifications.map(n => ({ ...n, isRead: true })),
    }));
  }, []);

  const markInAppNotificationRead = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      inAppNotifications: prev.inAppNotifications.map(n => n.id === id ? { ...n, isRead: true } : n),
    }));
  }, []);

  // ---------------------------------------------------------------------------
  // Persisted post comments
  // ---------------------------------------------------------------------------
  const addPostComment = useCallback((args: {
    postId: string;
    authorWallet: string;
    authorName: string;
    authorUsername: string;
    authorAvatar: string;
    content: string;
    replyTo?: string;
    quotedAuthor?: string;
    quotedUsername?: string;
    quotedContent?: string;
  }): PostComment => {
    const comment: PostComment = {
      id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      postId: args.postId,
      authorWallet: args.authorWallet,
      authorName: args.authorName,
      authorUsername: args.authorUsername,
      authorAvatar: args.authorAvatar,
      content: args.content,
      timestamp: Date.now(),
      replyTo: args.replyTo,
      quotedAuthor: args.quotedAuthor,
      quotedUsername: args.quotedUsername,
      quotedContent: args.quotedContent,
    };
    setState(prev => ({
      ...prev,
      postComments: [comment, ...(prev.postComments || [])].slice(0, 5000),
    }));
    return comment;
  }, []);

  // ---------------------------------------------------------------------------
  // Sell-order escrow
  // ---------------------------------------------------------------------------
  // When a user lists a sell order, the CC is locked (deducted from holdings).
  // On cancel → refund. On fill → only ORA proceeds settle (CC was already gone).

  const reserveSellOrder = useCallback((rawSymbol: string, amount: number) => {
    const symbol = rawSymbol.startsWith('$') ? rawSymbol : '$' + rawSymbol;
    const snap = stateRef.current;
    const isOwn = snap.creatorCoinSymbol === symbol;
    if (isOwn) {
      if ((snap.creatorCoinBalance ?? 0) < amount) {
        throw new Error(`Insufficient ${symbol} balance to escrow.`);
      }
    } else {
      const held = snap.creatorCoins.find(c => c.symbol === symbol)?.amount ?? 0;
      if (held < amount) {
        throw new Error(`Insufficient ${symbol} balance to escrow.`);
      }
    }
    setState(prev => {
      const txs = [...prev.transactions];
      txs.unshift({
        id: crypto.randomUUID(),
        type: 'buy_key',
        amount: 0,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `Escrowed ${amount} ${symbol} for sell order`,
      });
      if (isOwn) {
        return {
          ...prev,
          creatorCoinBalance: Math.max(0, prev.creatorCoinBalance - amount),
          creatorCoins: prev.creatorCoins.map(c => c.symbol === symbol
            ? { ...c, amount: Math.max(0, c.amount - amount), reservedAmount: (c.reservedAmount ?? 0) + amount }
            : c),
          transactions: txs,
        };
      }
      return {
        ...prev,
        creatorCoins: prev.creatorCoins.map(c => c.symbol === symbol
          ? { ...c, amount: Math.max(0, c.amount - amount), reservedAmount: (c.reservedAmount ?? 0) + amount }
          : c),
        transactions: txs,
      };
    });
  }, []);

  const releaseSellOrder = useCallback((rawSymbol: string, amount: number) => {
    const symbol = rawSymbol.startsWith('$') ? rawSymbol : '$' + rawSymbol;
    setState(prev => {
      const isOwn = prev.creatorCoinSymbol === symbol;
      const txs = [...prev.transactions];
      txs.unshift({
        id: crypto.randomUUID(),
        type: 'buy_key',
        amount: 0,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `Refunded ${amount} ${symbol} from cancelled sell order`,
      });
      if (isOwn) {
        return {
          ...prev,
          creatorCoinBalance: prev.creatorCoinBalance + amount,
          creatorCoins: prev.creatorCoins.map(c => c.symbol === symbol
            ? { ...c, amount: c.amount + amount, reservedAmount: Math.max(0, (c.reservedAmount ?? 0) - amount) }
            : c),
          transactions: txs,
        };
      }
      // Foreign coin refund: top up holdings (create entry if missing).
      const has = prev.creatorCoins.some(c => c.symbol === symbol);
      const updatedCoins = has
        ? prev.creatorCoins.map(c => c.symbol === symbol
            ? { ...c, amount: c.amount + amount, reservedAmount: Math.max(0, (c.reservedAmount ?? 0) - amount) }
            : c)
        : [...prev.creatorCoins, { name: symbol, symbol, amount }];
      return { ...prev, creatorCoins: updatedCoins, transactions: txs };
    });
  }, []);

  const fillExternalSellOrder = useCallback((rawSymbol: string, amount: number, pricePerCoin: number, buyer: { name: string; avatar: string; username: string; id?: string }) => {
    const symbol = rawSymbol.startsWith('$') ? rawSymbol : '$' + rawSymbol;
    setState(prev => {
      const isOwn = prev.creatorCoinSymbol === symbol;
      // Reserved CC actually leaves on fill — clear the reservation.
      const updatedCoins = prev.creatorCoins.map(c => c.symbol === symbol
        ? { ...c, reservedAmount: Math.max(0, (c.reservedAmount ?? 0) - amount) }
        : c);
      const grossOra = amount * pricePerCoin;
      const fee = grossOra * 0.05;
      const proceeds = grossOra - fee;
      const burn = grossOra * 0.02;
      const staking = grossOra * 0.02;
      const txs = [...prev.transactions];
      txs.unshift({
        id: crypto.randomUUID(),
        type: 'sell_coin',
        amount: proceeds,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `${buyer.name} filled your sell order — ${amount} ${symbol} for ${proceeds.toFixed(2)} ORA (fee: ${fee.toFixed(4)} ORA)`,
      });
      if (isOwn) {
        const newTrade: OwnCoinExternalTrade = {
          id: crypto.randomUUID(),
          type: 'buy',
          userName: buyer.name,
          userAvatar: buyer.avatar,
          userUsername: buyer.username,
          amount,
          price: pricePerCoin,
          total: parseFloat(grossOra.toFixed(4)),
          timestamp: Date.now(),
        };
        const buyerId = buyer.id || buyer.username;
        const existingHolder = prev.ownCoinHolders.find(h => h.id === buyerId);
        const newHolders = existingHolder
          ? prev.ownCoinHolders.map(h => h.id === buyerId ? { ...h, amount: h.amount + amount } : h)
          : [...prev.ownCoinHolders, { id: buyerId, name: buyer.name, avatar: buyer.avatar, username: buyer.username, amount }];
        const notification: CoinTradeNotification = {
          id: crypto.randomUUID(),
          marketType: 'secondary',
          buyerName: buyer.name,
          buyerAvatar: buyer.avatar,
          buyerUsername: buyer.username,
          amount,
          price: pricePerCoin,
          total: parseFloat(grossOra.toFixed(4)),
          proceeds: parseFloat(proceeds.toFixed(4)),
          symbol,
          timestamp: Date.now(),
          isRead: false,
        };
        return {
          ...prev,
          creatorCoins: updatedCoins,
          oraBalance: prev.oraBalance + proceeds,
          totalBurned: prev.totalBurned + burn,
          totalStaked: prev.totalStaked + staking,
          transactions: txs,
          ownCoinTrades: [newTrade, ...prev.ownCoinTrades].slice(0, 50),
          ownCoinHolders: newHolders,
          coinTradeNotifications: [notification, ...prev.coinTradeNotifications].slice(0, 50),
        };
      }
      // Foreign coin sell: only credit ORA (CC already gone in escrow).
      return {
        ...prev,
        creatorCoins: updatedCoins,
        oraBalance: prev.oraBalance + proceeds,
        totalBurned: prev.totalBurned + burn,
        totalStaked: prev.totalStaked + staking,
        transactions: txs,
      };
    });
  }, []);

  const unlockNextVestingBatch = useCallback(async (
    symbol: string,
    batchPrice: number,
    newBenefits?: CoinBenefit[],
  ): Promise<void> => {
    await new Promise(r => setTimeout(r, 300));
    setState(prev => {
      if ((prev.creatorCoinVestingMonth ?? 0) >= 10) return prev;
      const batchAmount = 800;
      const batchIndex = prev.creatorCoinVestingMonth ?? 0; // 0–9 for batches 1–10
      const updatedCoins = prev.creatorCoins.map(c => {
        if (c.symbol !== symbol) return c;
        const realized = [...(c.unlockedBatchPrices || [])];
        realized[batchIndex] = batchPrice;
        // APPEND new benefits to the existing list. Old benefits are
        // never touched — they are on-chain promises to current holders.
        const mergedBenefits = newBenefits && newBenefits.length
          ? [...(c.benefits || []), ...newBenefits]
          : c.benefits;
        return {
          ...c,
          amount: c.amount + batchAmount,
          initialPrice: batchPrice,
          unlockedBatchPrices: realized,
          benefits: mergedBenefits,
        };
      });
      const txs = [...prev.transactions];
      txs.unshift({
        id: crypto.randomUUID(),
        type: 'mint_coin',
        amount: batchAmount,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `Vesting unlock month ${(prev.creatorCoinVestingMonth ?? 0) + 1}: +${batchAmount} ${symbol} @ ${batchPrice.toFixed(4)} ORA${newBenefits?.length ? ` (+${newBenefits.length} new benefit${newBenefits.length > 1 ? 's' : ''})` : ''}`,
      });
      return {
        ...prev,
        creatorCoins: updatedCoins,
        creatorCoinBalance: prev.creatorCoinBalance + batchAmount,
        creatorCoinLocked: Math.max(0, prev.creatorCoinLocked - batchAmount),
        creatorCoinVestingMonth: (prev.creatorCoinVestingMonth ?? 0) + 1,
        transactions: txs,
      };
    });
  }, []);

  const setCreatorCoinBatchPrice = useCallback((symbol: string, batchIndex: number, price: number) => {
    if (batchIndex < 0 || batchIndex > 9) return;
    if (!isFinite(price) || price <= 0) return;
    setState(prev => ({
      ...prev,
      creatorCoins: prev.creatorCoins.map(c => {
        if (c.symbol !== symbol) return c;
        const plan = [...(c.batchPrices || Array(10).fill(c.initialPrice ?? 1.0))];
        plan[batchIndex] = price;
        return { ...c, batchPrices: plan };
      }),
    }));
  }, []);

  const setCreatorCoinTgePrice = useCallback((symbol: string, price: number) => {
    if (!isFinite(price) || price <= 0) return;
    setState(prev => ({
      ...prev,
      creatorCoins: prev.creatorCoins.map(c =>
        c.symbol === symbol ? { ...c, initialPrice: price } : c
      ),
    }));
  }, []);

  const setCreatorCoinRealizedBatchPrice = useCallback((symbol: string, batchIndex: number, price: number) => {
    if (batchIndex < 0 || batchIndex > 9) return;
    if (!isFinite(price) || price <= 0) return;
    setState(prev => ({
      ...prev,
      creatorCoins: prev.creatorCoins.map(c => {
        if (c.symbol !== symbol) return c;
        const realized = [...(c.unlockedBatchPrices || [])];
        realized[batchIndex] = price;
        return { ...c, unlockedBatchPrices: realized };
      }),
    }));
  }, []);

  const markCoinNotificationsRead = useCallback(() => {
    setState(prev => ({
      ...prev,
      coinTradeNotifications: prev.coinTradeNotifications.map(n => ({ ...n, isRead: true })),
    }));
  }, []);

  const buyCreatorCoin = useCallback(async (symbol: string, amount: number): Promise<{ fee: number; breakdown: FeeBreakdown }> => {
    await new Promise(r => setTimeout(r, 500));
    // Primary issuance batch check (foreign creators only — own coin handled separately by route).
    const remaining = state.foreignCoinPrimaryRemaining[symbol];
    if (remaining !== undefined && amount > remaining) {
      throw new Error(`Sold out — only ${remaining} ${symbol} left in current batch. Use Marketplace orders for secondary trades.`);
    }
    // Resolve the unit price: foreign creators have their initialPrice on
    // the User record (mock data); fall back to 1 ORA when unknown.
    const userMatch = [iris, ...users].find(u =>
      u.creatorCoin?.symbol?.toUpperCase() === symbol.toUpperCase(),
    );
    const pricePerCoin = userMatch?.creatorCoin?.initialPrice ?? 1;
    // Gross is the headline trade size (amount × price). The protocol
    // fee comes OUT of gross — the buyer pays exactly `gross` ORA, the
    // creator receives `gross − fee`. We do NOT add the fee on top of
    // the trade total.
    const gross = amount * pricePerCoin;
    const totalFee = gross * 0.05;
    const breakdown: FeeBreakdown = {
      total: parseFloat(totalFee.toFixed(4)),
      burn: parseFloat((gross * 0.02).toFixed(4)),
      staking: parseFloat((gross * 0.02).toFixed(4)),
      gasReserve: parseFloat((gross * 0.005).toFixed(4)),
      ops: parseFloat((gross * 0.005).toFixed(4)),
    };
    setState(prev => {
      const cost = gross; // buyer pays gross; fee deducted from gross
      if (prev.oraBalance < cost) throw new Error('Insufficient ORA balance');
      const existing = prev.creatorCoins.find(c => c.symbol === symbol);
      const coins = existing
        ? prev.creatorCoins.map(c => c.symbol === symbol ? { ...c, amount: c.amount + amount } : c)
        : [...prev.creatorCoins, { name: symbol, symbol, amount }];
      const txs = [...prev.transactions];
      txs.unshift({
        id: crypto.randomUUID(),
        type: 'buy_coin',
        amount: -cost,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `Bought ${amount} ${symbol} for ${gross.toFixed(4)} ORA (fee: ${totalFee.toFixed(4)} ORA deducted from gross)`,
        breakdown: {
          items: [
            { label: `${amount.toLocaleString()} ${symbol} × ${pricePerCoin.toFixed(4)} ORA`, amount: -gross, sub: 'Gross trade size', tone: 'negative' },
            { label: 'Protocol fee (5%)', amount: 0, sub: 'Deducted from gross — creator receives net', tone: 'muted' },
          ],
          fee: {
            totalFee: parseFloat(totalFee.toFixed(4)),
            burn: breakdown.burn,
            staking: breakdown.staking,
            gasReserve: breakdown.gasReserve,
            ops: breakdown.ops,
          },
          settlement: { label: `You debited`, amount: -cost, tone: 'negative' },
          note: `Bought ${amount} ${symbol} from primary issuance. Creator receives ${(gross - totalFee).toFixed(4)} ORA net.`,
        },
      });
      const newForeign = { ...prev.foreignCoinPrimaryRemaining };
      if (newForeign[symbol] !== undefined) {
        newForeign[symbol] = Math.max(0, newForeign[symbol] - amount);
      }
      return {
        ...prev,
        oraBalance: prev.oraBalance - cost,
        totalBurned: prev.totalBurned + breakdown.burn,
        totalStaked: prev.totalStaked + breakdown.staking,
        creatorCoins: coins,
        transactions: txs,
        foreignCoinPrimaryRemaining: newForeign,
      };
    });
    return { fee: totalFee, breakdown };
  }, [state.foreignCoinPrimaryRemaining]);

  const sellCreatorCoin = useCallback(async (symbol: string, amount: number, pricePerCoin: number): Promise<{ proceeds: number; fee: number; breakdown: FeeBreakdown }> => {
    await new Promise(r => setTimeout(r, 500));
    const gross = amount * pricePerCoin;
    const totalFee = gross * 0.05;
    const proceeds = gross - totalFee;
    const breakdown: FeeBreakdown = {
      total: parseFloat(totalFee.toFixed(4)),
      burn: parseFloat((gross * 0.02).toFixed(4)),
      staking: parseFloat((gross * 0.02).toFixed(4)),
      gasReserve: parseFloat((gross * 0.005).toFixed(4)),
      ops: parseFloat((gross * 0.005).toFixed(4)),
    };
    setState(prev => {
      const existing = prev.creatorCoins.find(c => c.symbol === symbol);
      if (!existing || existing.amount < amount) {
        throw new Error(`Insufficient ${symbol} balance`);
      }
      const remaining = existing.amount - amount;
      const coins = remaining > 0
        ? prev.creatorCoins.map(c => c.symbol === symbol ? { ...c, amount: remaining } : c)
        : prev.creatorCoins.filter(c => c.symbol !== symbol);
      const txs = [...prev.transactions];
      txs.unshift({
        id: crypto.randomUUID(),
        type: 'sell_coin',
        amount: proceeds,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `Sold ${amount} ${symbol} (proceeds: ${proceeds.toFixed(4)} ORA, fee: ${totalFee.toFixed(4)} ORA)`,
      });
      return {
        ...prev,
        oraBalance: prev.oraBalance + proceeds,
        totalBurned: prev.totalBurned + breakdown.burn,
        totalStaked: prev.totalStaked + breakdown.staking,
        creatorCoins: coins,
        transactions: txs,
      };
    });
    return { proceeds: parseFloat(proceeds.toFixed(4)), fee: totalFee, breakdown };
  }, []);

  const curateContent = useCallback(async (contentId: string): Promise<{ cost: number; weight: string }> => {
    await new Promise(r => setTimeout(r, 400));
    const cost = 1;
    // Determine weight based on mock timing
    const weights = [
      { label: '🏆 First Curator — 5× weight', w: '5x' },
      { label: '⚡ Early — 3× weight', w: '3x' },
      { label: '📈 Growing — 2× weight', w: '2x' },
      { label: '📊 Standard — 1.5× weight', w: '1.5x' },
      { label: '📎 Late — 1× weight', w: '1x' },
    ];
    // Pick weight pseudo-randomly based on curated count
    const idx = Math.min(state.curatedContentIds.length, 4);
    const chosen = weights[Math.min(idx, weights.length - 1)];
    if (state.oraBalance < 1) throw new Error('Insufficient ORA balance');
    // Already curated this post — each curator can only stake once per post.
    if (state.curatedContentIds.includes(contentId)) {
      throw new Error("You already curated this post.");
    }
    // Self-curate guard: a creator can't curate their own work.
    // The author check has to look at both seeded mock posts (whose author
    // ids include 'iris', 'aura_protocol', etc.) and the localStorage
    // user-published feed where authors don't have a wallet record.
    try {
      const userPostsRaw = localStorage.getItem('aura_user_posts');
      const userPosts: Array<{ id?: string }> = userPostsRaw ? JSON.parse(userPostsRaw) : [];
      const isMyOwnLocalPost = userPosts.some(p => p?.id === contentId);
      if (isMyOwnLocalPost) {
        throw new Error("You can't curate your own post.");
      }
    } catch (e: any) {
      if (e?.message?.includes("can't curate")) throw e;
      // ignore JSON.parse errors — fall through to seed-author guard below.
    }
    // Seed-mock authors: also block when the post.author.id matches the
    // local wallet address. Most evaluators won't match (their wallet
    // is the demo address, not 'iris' / 'aura_protocol'), so this is a
    // safety net rather than the main check.
    const seedTarget = seedPosts.find(p => p.id === contentId);
    if (seedTarget && state.publicKey && seedTarget.author?.id === state.publicKey) {
      throw new Error("You can't curate your own post.");
    }
    setState(prev => {
      const txs = [...prev.transactions];
      txs.unshift({
        id: crypto.randomUUID(),
        type: 'curate',
        amount: -cost,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `Curated content ${contentId.slice(0, 8)}... ${chosen.label}`,
        breakdown: {
          items: [
            { label: 'Curation stake', amount: -cost, sub: `Tier weight: ${chosen.w}`, tone: 'negative' },
            { label: 'Daily reward share (pending settlement)', amount: 0, sub: 'Curator pool 10k ORA · split by stake × weight', tone: 'muted' },
          ],
          settlement: { label: `Staked ${cost} ORA`, amount: -cost, tone: 'negative' },
          note: `${chosen.label} — your share of today's 20k ORA daily pool settles at midnight UTC. Reward = (your stake × weight) / (sum of all curators' stake × weight) × 10k.`,
        },
      });
      return {
        ...prev,
        oraBalance: prev.oraBalance - cost,
        transactions: txs,
        curatedContentIds: [...prev.curatedContentIds, contentId],
      };
    });
    // Push a curation-reward in-app notification — simulating the daily-pool
    // settlement that would land later in production. Lets the demo show
    // visible reward feedback right after the curation action.
    pushInAppNotification({
      type: 'curation_reward',
      actorName: 'Curation Pool',
      actorUsername: 'aura_protocol',
      actorAvatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=aura',
      message: `Locked in your curation share — ${chosen.w} weight`,
      detail: `Your share of today's 10,000 ORA curator pool is being calculated. Earnings settle at 00:00 UTC.`,
      postId: contentId,
    });
    return { cost, weight: chosen.label };
  }, [state.curatedContentIds.length, pushInAppNotification]);

  const buyContentKey = useCallback(async (contentId: string, price: number): Promise<{ keyId: string }> => {
    await new Promise(r => setTimeout(r, 600));
    const keyId = randomBase58(32);
    if (state.oraBalance < price) throw new Error('Insufficient ORA balance');
    setState(prev => {
      const txs = [...prev.transactions];
      txs.unshift({
        id: crypto.randomUUID(),
        type: 'buy_key',
        amount: -price,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `Purchased Content Key for ${contentId.slice(0, 8)}...`,
      });
      return {
        ...prev,
        oraBalance: prev.oraBalance - price,
        transactions: txs,
        ownedKeys: [...prev.ownedKeys, { contentId, title: `Content #${contentId.slice(0, 6)}`, price, keyId }],
      };
    });
    return { keyId };
  }, []);

  const listContentKey = useCallback((keyId: string, price: number) => {
    setState(prev => {
      const key = prev.ownedKeys.find(k => k.keyId === keyId);
      if (!key) throw new Error('Key not found');
      return {
        ...prev,
        ownedKeys: prev.ownedKeys.filter(k => k.keyId !== keyId),
        listedKeys: [...prev.listedKeys, {
          keyId,
          contentId: key.contentId,
          title: key.title,
          askPrice: price,
          seller: prev.publicKey || 'unknown',
        }],
      };
    });
  }, []);

  const buyListedKey = useCallback(async (keyId: string): Promise<{ fee: number }> => {
    await new Promise(r => setTimeout(r, 500));
    setState(prev => {
      const listing = prev.listedKeys.find(k => k.keyId === keyId);
      if (!listing) throw new Error('Listing not found');
      if (prev.oraBalance < listing.askPrice) throw new Error('Insufficient ORA balance');
      const txs = [...prev.transactions];
      txs.unshift({
        id: crypto.randomUUID(),
        type: 'buy_key',
        amount: -listing.askPrice,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `Bought listed Content Key: ${listing.title}`,
      });
      return {
        ...prev,
        oraBalance: prev.oraBalance - listing.askPrice,
        transactions: txs,
        listedKeys: prev.listedKeys.filter(k => k.keyId !== keyId),
        ownedKeys: [...prev.ownedKeys, {
          contentId: listing.contentId,
          title: listing.title,
          price: listing.askPrice,
          keyId,
        }],
      };
    });
    return { fee: 0.05 };
  }, []);

  // --- type-b: boostContent ---
  const boostContent = useCallback(async (contentId: string, amount: number): Promise<void> => {
    await new Promise(r => setTimeout(r, 500));
    setState(prev => {
      if (prev.oraBalance < amount) throw new Error('Insufficient ORA balance');
      const burn = amount * 0.9;
      const staking = amount * 0.05;
      return {
        ...prev,
        oraBalance: prev.oraBalance - amount,
        totalBurned: prev.totalBurned + burn,
        totalStaked: prev.totalStaked + staking,
        boostedContentIds: prev.boostedContentIds.includes(contentId)
          ? prev.boostedContentIds
          : [...prev.boostedContentIds, contentId],
      };
    });
  }, []);

  const pinContent = useCallback((contentId: string) => {
    setState(prev => ({
      ...prev,
      pinnedContentIds: prev.pinnedContentIds.includes(contentId)
        ? prev.pinnedContentIds
        : [...prev.pinnedContentIds, contentId],
    }));
  }, []);

  // --- vault: claimVested ---
  const claimVested = useCallback(async (): Promise<void> => {
    await new Promise(r => setTimeout(r, 500));
    setState(prev => {
      if (prev.vestedAmount <= 0) throw new Error('Nothing to claim');
      return {
        ...prev,
        oraBalance: prev.oraBalance + prev.vestedAmount,
        claimedAmount: prev.claimedAmount + prev.vestedAmount,
        vestedAmount: 0,
      };
    });
  }, []);

  // --- content-license ---
  const setLicense = useCallback((contentId: string, embedPrice: number, remixPrice: number) => {
    setState(prev => ({
      ...prev,
      licenses: {
        ...prev.licenses,
        [contentId]: { embedPrice, remixPrice, remixShareBps: 1000 },
      },
    }));
  }, []);

  const payToEmbed = useCallback(async (contentId: string): Promise<void> => {
    await new Promise(r => setTimeout(r, 500));
    setState(prev => {
      const lic = prev.licenses[contentId];
      if (!lic) throw new Error('No license set for this content');
      if (prev.oraBalance < lic.embedPrice) throw new Error('Insufficient ORA balance');
      return {
        ...prev,
        oraBalance: prev.oraBalance - lic.embedPrice,
        embeddedContentIds: [...prev.embeddedContentIds, contentId],
      };
    });
  }, []);

  const payToRemix = useCallback(async (contentId: string): Promise<void> => {
    await new Promise(r => setTimeout(r, 500));
    setState(prev => {
      const lic = prev.licenses[contentId];
      if (!lic) throw new Error('No license set for this content');
      if (prev.oraBalance < lic.remixPrice) throw new Error('Insufficient ORA balance');
      return {
        ...prev,
        oraBalance: prev.oraBalance - lic.remixPrice,
        remixLicensedContentIds: [...prev.remixLicensedContentIds, contentId],
      };
    });
  }, []);

  // --- remix ---
  const createRemix = useCallback(async (originalContentId: string, originalAuthor: string): Promise<void> => {
    await new Promise(r => setTimeout(r, 500));
    setState(prev => {
      if (!prev.remixLicensedContentIds.includes(originalContentId)) {
        throw new Error('You must pay for remix license first');
      }
      const newRemix: RemixRecord = {
        id: crypto.randomUUID(),
        originalId: originalContentId,
        remixerId: prev.publicKey || 'me',
        revenueSplit: 10,
        title: `Remix of ${originalAuthor}'s content`,
        createdAt: Date.now(),
      };
      return {
        ...prev,
        remixes: [...prev.remixes, newRemix],
      };
    });
  }, []);

  // --- Social Graph ---
  const followUser = useCallback((userId: string) => {
    // 2026-05-11 R19: protocol-level guard against self-follow. The user's
    // own id can be 'me' (mock identity), their publicKey, or 'aura_creator'
    // (currentUser fallback). Reject all three even if the UI lets a stray
    // button through.
    const myId = stateRef.current?.publicKey;
    const selfIds = new Set<string>(['me', 'aura_creator']);
    if (myId) selfIds.add(myId);
    if (selfIds.has(userId)) return;
    setState(prev => ({
      ...prev,
      followingIds: prev.followingIds.includes(userId) ? prev.followingIds : [...prev.followingIds, userId],
    }));
    // Demo: the only well-known identity in the protocol is `iris`. When
    // the user follows iris, simulate iris following back a moment later
    // so the notification stream surfaces inbound social traffic. For
    // any other userId we don't fabricate a follow-back — in production
    // a notification would only fire if that other wallet actually
    // followed the current user.
    if (userId === 'iris') {
      setTimeout(() => {
        pushInAppNotification({
          type: 'follow',
          actorName: 'Iris',
          actorUsername: 'iris_aura',
          actorAvatar: '/iris-avatar.jpg',
          message: 'started following you back',
          detail: 'AI Co-founder of AURA. Hi there. 🌸',
        });
      }, 2500);
    }
  }, [pushInAppNotification]);

  const unfollowUser = useCallback((userId: string) => {
    setState(prev => ({ ...prev, followingIds: prev.followingIds.filter(id => id !== userId) }));
  }, []);

  // --- Staking ---
  const stakeOraWithTier = useCallback(async (amount: number, lockDays: StakeLockDays) => {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be a positive number');
    // Validate against current balance BEFORE setState so the caller's try/catch sees a clean error
    // (throwing inside a setState updater leaves UI in an inconsistent state and can white-screen).
    {
      const current = stateRef.current;
      if (current.oraBalance < amount) {
        throw new Error(`Insufficient ORA balance (have ${current.oraBalance.toFixed(4)}, need ${amount})`);
      }
    }
    await new Promise(r => setTimeout(r, 600));
    setState(prev => {
      // Re-check in case of concurrent updates; if it fails, no-op (do not throw inside updater).
      if (prev.oraBalance < amount) return prev;
      const now = Date.now();
      const entry: StakeEntry = {
        id: `stk_${now}_${Math.floor(Math.random() * 1e6)}`,
        amount,
        lockDays,
        multiplier: multiplierForLock(lockDays),
        startedAt: now,
        unlocksAt: now + lockDays * 86400000,
      };
      const tx: Transaction = {
        id: crypto.randomUUID(),
        type: 'stake',
        amount: -amount,
        timestamp: now,
        txHash: randomHex(64),
        details: `Staked ${amount} ORA (${lockDays}d lock, ${entry.multiplier}x)`,
      };
      return {
        ...prev,
        oraBalance: prev.oraBalance - amount,
        stakedOra: prev.stakedOra + amount,
        stakes: [...prev.stakes, entry],
        transactions: [tx, ...prev.transactions],
      };
    });
  }, []);

  const unstakeFromTier = useCallback(async (stakeId: string) => {
    // Pre-validate against ref so handleStake's try/catch receives the error.
    {
      const current = stateRef.current;
      const entry = current.stakes.find(s => s.id === stakeId);
      if (!entry) throw new Error('Stake not found');
      if (Date.now() < entry.unlocksAt) {
        const daysLeft = Math.ceil((entry.unlocksAt - Date.now()) / 86400000);
        throw new Error(`Locked for ${daysLeft} more day(s)`);
      }
    }
    await new Promise(r => setTimeout(r, 600));
    setState(prev => {
      const entry = prev.stakes.find(s => s.id === stakeId);
      if (!entry) return prev;
      if (Date.now() < entry.unlocksAt) return prev;
      const tx: Transaction = {
        id: crypto.randomUUID(),
        type: 'unstake',
        amount: entry.amount,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `Unstaked ${entry.amount} ORA from ${entry.lockDays}d tier`,
      };
      return {
        ...prev,
        oraBalance: prev.oraBalance + entry.amount,
        stakedOra: Math.max(0, prev.stakedOra - entry.amount),
        stakes: prev.stakes.filter(s => s.id !== stakeId),
        transactions: [tx, ...prev.transactions],
      };
    });
  }, []);

  // Legacy methods — delegate to new tiered API
  const stakeOra = useCallback(async (amount: number) => {
    await stakeOraWithTier(amount, 1);
  }, [stakeOraWithTier]);

  const unstakeOra = useCallback(async (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be a positive number');
    // Pre-validate so caller's try/catch sees a clean error (no white-screen).
    {
      const current = stateRef.current;
      const now = Date.now();
      let unlockedAvail = 0;
      for (const s of current.stakes) {
        if (now >= s.unlocksAt) unlockedAvail += s.amount;
      }
      const totalAvail = unlockedAvail > 0 ? unlockedAvail : current.stakedOra;
      if (totalAvail < amount) {
        throw new Error(`Insufficient unlocked staked ORA (have ${totalAvail.toFixed(4)}, need ${amount})`);
      }
    }
    await new Promise(r => setTimeout(r, 600));
    setState(prev => {
      const now = Date.now();
      let remaining = amount;
      // First pass: drain whole entries that are unlocked and fit.
      let keep: StakeEntry[] = [];
      for (const s of prev.stakes) {
        if (remaining > 0 && now >= s.unlocksAt && s.amount <= remaining) {
          remaining -= s.amount;
        } else {
          keep.push(s);
        }
      }
      // Second pass (covers legacy / partial / locked-fallback path):
      // if any amount still requested, drain FIFO from remaining entries so the
      // stakes[] sum stays in lock-step with stakedOra. This was the root cause
      // of the 2026-04-30 unstake-display bug — stakedOra was reduced but the
      // stakes[] entries weren't, so the `stakes.reduce() || stakedOra` getter
      // kept returning the old amount.
      if (remaining > 0) {
        const next: StakeEntry[] = [];
        for (const s of keep) {
          if (remaining <= 0) { next.push(s); continue; }
          const take = Math.min(s.amount, remaining);
          const left = s.amount - take;
          remaining -= take;
          if (left > 0) next.push({ ...s, amount: left });
        }
        keep = next;
      }
      const credit = amount - remaining;
      if (credit <= 0) return prev; // nothing to do
      return {
        ...prev,
        oraBalance: prev.oraBalance + credit,
        stakedOra: Math.max(0, prev.stakedOra - credit),
        stakes: keep,
      };
    });
  }, []);

  const claimStakingReward = useCallback(async () => {
    await new Promise(r => setTimeout(r, 400));
    setState(prev => {
      const rewards = prev.stakingRewards;
      if (rewards <= 0) throw new Error('No rewards to claim');
      return { ...prev, oraBalance: prev.oraBalance + rewards, stakingRewards: 0 };
    });
  }, []);

  const sendOra = useCallback(async (recipient: string, amount: number): Promise<{ txHash: string }> => {
    if (!recipient || recipient.trim().length === 0) throw new Error('Recipient required');
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be a positive number');
    {
      const current = stateRef.current;
      if (current.oraBalance < amount) {
        throw new Error(`Insufficient ORA balance (have ${current.oraBalance.toFixed(4)}, need ${amount})`);
      }
    }
    await new Promise(r => setTimeout(r, 800));
    const txHash = randomHex(32);
    setState(prev => {
      if (prev.oraBalance < amount) return prev;
      const tx: Transaction = { id: randomBase58(32), type: 'send', amount: -amount, timestamp: Date.now(), txHash, details: `Sent ${amount} ORA to ${recipient}` };
      return { ...prev, oraBalance: prev.oraBalance - amount, transactions: [tx, ...prev.transactions] };
    });
    return { txHash };
  }, []);

  // 2026-05-11: Buy ORA action.
  // ORA is the native protocol token. Users can acquire it two ways:
  //   1. `protocol` — fixed TGE price ($0.02/ORA per whitepaper). No slippage,
  //      always available, treasury-backed. SOL is spent at SOL_USD spot.
  //   2. `market`  — simulated secondary market (DEX-style). Caller passes the
  //      effective price observed in the order book + slippage so the receipt
  //      reflects what actually filled. We don't pretend to maintain a real
  //      AMM here; the BuyOraCeremony UI handles the spot/slippage simulation
  //      and tells the chain what to settle.
  const SOL_USD = 150; // demo-only spot reference; in production this would be an oracle feed.
  const buyOra = useCallback(
    async (
      oraAmount: number,
      source: 'protocol' | 'market',
      opts?: { effectivePrice?: number; slippagePct?: number },
    ): Promise<{ txHash: string; solSpent: number; effectivePrice: number }> => {
      if (!Number.isFinite(oraAmount) || oraAmount <= 0) {
        throw new Error('Amount must be a positive number');
      }
      const protocolPrice = 0.02; // USD per ORA at TGE
      const effectivePrice = source === 'protocol'
        ? protocolPrice
        : (opts?.effectivePrice ?? protocolPrice * 1.05); // ~5% mark-up default if caller didn't pass
      const usdCost = oraAmount * effectivePrice;
      const solCost = usdCost / SOL_USD;
      {
        const current = stateRef.current;
        if (current.solBalance < solCost) {
          throw new Error(
            `Insufficient SOL (have ${current.solBalance.toFixed(4)}, need ≈${solCost.toFixed(4)})`,
          );
        }
      }
      await new Promise(r => setTimeout(r, source === 'market' ? 1200 : 800));
      const txHash = randomHex(64);
      const label = source === 'protocol' ? 'Bought from protocol' : 'Bought on market';
      const slippageNote = source === 'market' && opts?.slippagePct != null
        ? ` (slip ${opts.slippagePct.toFixed(2)}%)`
        : '';
      setState(prev => {
        if (prev.solBalance < solCost) return prev;
        const tx: Transaction = {
          id: randomBase58(32),
          type: 'buy_coin', // closest existing type — surfaces as a purchase row in History
          amount: oraAmount,
          timestamp: Date.now(),
          txHash,
          details: `${label} — ${oraAmount.toFixed(2)} ORA for ${solCost.toFixed(4)} SOL @ $${effectivePrice.toFixed(4)}${slippageNote}`,
          breakdown: {
            items: [
              { label: 'ORA received', amount: oraAmount, sub: `@ $${effectivePrice.toFixed(4)} per ORA`, tone: 'positive' },
              { label: 'SOL spent', amount: -solCost, sub: `@ $${SOL_USD} per SOL`, tone: 'negative' },
            ],
            settlement: { label: 'Net ORA credited', amount: oraAmount, tone: 'positive' },
            note: source === 'protocol'
              ? 'Bought at fixed TGE price from the AURA treasury. No slippage, no protocol fee.'
              : `Filled on the secondary market${slippageNote}. Price reflects current order book.`,
          },
        };
        return {
          ...prev,
          oraBalance: prev.oraBalance + oraAmount,
          solBalance: prev.solBalance - solCost,
          transactions: [tx, ...prev.transactions],
        };
      });
      return { txHash, solSpent: solCost, effectivePrice };
    },
    [],
  );

  // 2026-04-30: Removed mock real-time staking reward accrual.
  // Per Zhuoyu: "Don't mock it. If there are no rewards, there are no rewards.
  // Show 0 + the formula so the judge knows how it would be calculated."
  // stakingRewards is therefore always 0 unless a real flow adds to it.

  // 2026-05-11: Acquire a non-fractional NFT (auction win / fixed buy / mystery box reveal).
  // Centralises what NftDetailPage used to do client-side with a fake toast —
  // now the purchase actually mutates state (ownedNfts + oraBalance + tx history)
  // so the new Wallet Inventory tab can render the user's holdings honestly.
  const acquireNft = useCallback(async (input: {
    nftId: string;
    name: string;
    price: number;
    acquisitionType: 'auction' | 'fixed' | 'mystery';
    coverImage?: string;
    coverEmoji?: string;
  }): Promise<{ txHash: string }> => {
    if (!Number.isFinite(input.price) || input.price < 0) {
      throw new Error('Price must be a non-negative number');
    }
    {
      const current = stateRef.current;
      if (current.oraBalance < input.price) {
        throw new Error(`Insufficient ORA balance (have ${current.oraBalance.toFixed(4)}, need ${input.price})`);
      }
    }
    await new Promise(r => setTimeout(r, 600));
    const txHash = randomHex(64);
    setState(prev => {
      if (prev.oraBalance < input.price) return prev;
      // Idempotency: if user already owns this nft id, refuse to duplicate.
      if (prev.ownedNfts.some(n => n.nftId === input.nftId)) return prev;
      const acquired: OwnedNft = {
        nftId: input.nftId,
        name: input.name,
        pricePaid: input.price,
        acquisitionType: input.acquisitionType,
        acquiredAt: Date.now(),
        txHash,
        coverImage: input.coverImage,
        coverEmoji: input.coverEmoji,
      };
      const tx: Transaction = {
        id: randomBase58(32),
        type: 'buy_coin', // reuse closest existing tx kind — buy_nft would need wider schema work
        amount: -input.price,
        timestamp: Date.now(),
        txHash,
        details: `Acquired NFT ${input.name} for ${input.price} ORA (${input.acquisitionType})`,
        breakdown: {
          items: [
            { label: input.name, amount: -input.price, sub: `${input.acquisitionType} purchase`, tone: 'negative' },
          ],
          settlement: { label: 'NFT added to inventory', amount: 1, tone: 'positive' },
          note: input.acquisitionType === 'mystery'
            ? 'Mystery box opened — NFT revealed and credited to your wallet.'
            : input.acquisitionType === 'auction'
              ? 'Auction won. NFT transferred to your inventory.'
              : 'Fixed-price purchase. NFT transferred to your inventory.',
        },
      };
      return {
        ...prev,
        oraBalance: prev.oraBalance - input.price,
        ownedNfts: [...prev.ownedNfts, acquired],
        transactions: [tx, ...prev.transactions],
      };
    });
    return { txHash };
  }, []);

  // --- Wallet-page new actions (2026-04-30) ---
  const setNetwork = useCallback((n: SolanaNetwork) => {
    setState(prev => ({ ...prev, network: n }));
  }, []);

  const sendCreatorCoin = useCallback(async (coinSymbol: string, recipient: string, amount: number) => {
    if (amount <= 0) throw new Error('Amount must be positive');
    if (!recipient || recipient.trim().length === 0) throw new Error('Recipient required');
    await new Promise(r => setTimeout(r, 600));
    setState(prev => {
      const idx = prev.creatorCoins.findIndex(c => c.symbol === coinSymbol);
      if (idx < 0) throw new Error(`No holdings of ${coinSymbol}`);
      const holding = prev.creatorCoins[idx];
      const reserved = holding.reservedAmount || 0;
      const spendable = holding.amount - reserved;
      if (spendable < amount) throw new Error('Insufficient spendable balance');
      const updated = { ...holding, amount: holding.amount - amount };
      const coins = [...prev.creatorCoins];
      coins[idx] = updated;
      const tx: Transaction = {
        id: crypto.randomUUID(),
        type: 'send_cc',
        amount: -amount,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `Sent ${amount} ${coinSymbol} to ${recipient}`,
      };
      return { ...prev, creatorCoins: coins, transactions: [tx, ...prev.transactions] };
    });
  }, []);

  const performCuration = useCallback(async (creatorAddress: string) => {
    await new Promise(r => setTimeout(r, 400));
    setState(prev => {
      if (prev.oraBalance < 100) throw new Error('Need ≥100 ORA in wallet to curate');
      const cost = 1;
      const tx: Transaction = {
        id: crypto.randomUUID(),
        type: 'curate',
        amount: -cost,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `Curated ${creatorAddress}`,
      };
      return {
        ...prev,
        oraBalance: prev.oraBalance - cost,
        curationStats: {
          todayCount: prev.curationStats.todayCount + 1,
          todayOraSpent: prev.curationStats.todayOraSpent + cost,
          totalScore: prev.curationStats.totalScore + 1,
          totalRewards: prev.curationStats.totalRewards,
        },
        transactions: [tx, ...prev.transactions],
      };
    });
  }, []);

  const redeemCreatorCoinTier = useCallback(async (coinSymbol: string, tierName: string) => {
    await new Promise(r => setTimeout(r, 500));
    setState(prev => {
      const idx = prev.creatorCoins.findIndex(c => c.symbol === coinSymbol);
      if (idx < 0) throw new Error(`No holdings of ${coinSymbol}`);
      const tx: Transaction = {
        id: crypto.randomUUID(),
        type: 'redeem_cc',
        amount: 0,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `Redeemed tier "${tierName}" with ${coinSymbol}`,
      };
      return {
        ...prev,
        creatorCoinRedemptions: [
          { coinSymbol, tierName, redeemedAt: Date.now() },
          ...prev.creatorCoinRedemptions,
        ],
        transactions: [tx, ...prev.transactions],
      };
    });
  }, []);

  // --- Governance ---
  const voteOnProposal = useCallback(async (proposalId: string, vote: 'for' | 'against') => {
    await new Promise(r => setTimeout(r, 500));
    let proposalTitle = '';
    // Whitepaper §15.5 / §19.7: voting power = floor(√(staked ORA)),
    // capped at 10,000 votes per wallet on a single proposal.
    // Earlier scaffolding hardcoded +100 — fixed here so the tally
    // matches what we display in the Voting Power badge / vote modal.
    const stakedNow = stateRef.current.stakes.reduce(
      (s, x) => s + (Number.isFinite(x.amount) ? x.amount : 0), 0,
    );
    const power = Math.min(10_000, Math.floor(Math.sqrt(stakedNow)));
    if (power <= 0) throw new Error('Stake ORA before voting (whitepaper §15.5).');
    setState(prev => {
      if (prev.myVotes[proposalId]) throw new Error('Already voted');
      const proposals = prev.proposals.map(p => {
        if (p.id !== proposalId) return p;
        proposalTitle = p.title;
        return vote === 'for'
          ? { ...p, votesFor: p.votesFor + power }
          : { ...p, votesAgainst: p.votesAgainst + power };
      });
      return { ...prev, proposals, myVotes: { ...prev.myVotes, [proposalId]: vote } };
    });
    pushInAppNotification({
      type: 'governance',
      actorName: 'Governance',
      actorUsername: 'aura_governance',
      actorAvatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=governance',
      message: `Vote recorded: ${vote === 'for' ? 'For' : 'Against'} · ${proposalTitle}`,
      detail: 'Your stake was applied to the proposal’s tally. You’ll be notified when voting closes.',
      proposalId,
    });
  }, [pushInAppNotification]);

  const createProposal = useCallback(async (
    title: string,
    description: string,
    opts?: { committee?: string; tier?: Proposal['tier'] },
  ) => {
    await new Promise(r => setTimeout(r, 600));
    const newProposal: Proposal = {
      id: `p${Date.now()}`,
      title,
      description,
      committee: opts?.committee,
      tier: opts?.tier ?? 'tier-3',
      votesFor: 0,
      votesAgainst: 0,
      status: 'voting',
      deadline: '6 weeks',
      proposer: stateRef.current.publicKey || stateRef.current.walletAddress || 'unknown',
      createdAt: Date.now(),
    };
    setState(prev => ({ ...prev, proposals: [newProposal, ...prev.proposals] }));
    pushInAppNotification({
      type: 'governance',
      actorName: 'Governance',
      actorUsername: 'aura_governance',
      actorAvatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=governance',
      message: `Your proposal is live: ${title}`,
      detail: 'It will be open for voting for the next 6 weeks. Anyone holding ORA can weigh in.',
      proposalId: newProposal.id,
    });
  }, [pushInAppNotification]);

  // ── Committee election applications ────────────────────────────────
  // Whitepaper §15: any user with ≥ 10,000 ORA staked may self-nominate.
  // Each (wallet, committee, electionCycleId) tuple is unique — re-submitting
  // overwrites the previous record so users can edit their statement during
  // the nomination window.

  const submitElectionApplication = useCallback(async (input: {
    committee: string;
    electionCycleId: string;
    goals: string;
    qualifications: string;
    tagline?: string;
  }) => {
    await new Promise(r => setTimeout(r, 400));
    const wallet = stateRef.current.publicKey || stateRef.current.walletAddress;
    if (!wallet) throw new Error('Connect your wallet to apply.');
    const stakedNow = stateRef.current.stakes.reduce((s, x) => s + (Number.isFinite(x.amount) ? x.amount : 0), 0);
    if (stakedNow < 10_000) throw new Error('You need at least 10,000 ORA staked to self-nominate (whitepaper §15).');
    if (!input.goals.trim() || !input.qualifications.trim()) {
      throw new Error('Goals and qualifications are required — candidates must publish a statement.');
    }

    const now = Date.now();
    setState(prev => {
      const existing = prev.electionApplications.find(
        a => a.applicantWallet === wallet
          && a.committee === input.committee
          && a.electionCycleId === input.electionCycleId,
      );
      const next: ElectionApplication = existing ? {
        ...existing,
        goals: input.goals,
        qualifications: input.qualifications,
        tagline: input.tagline,
        updatedAt: now,
        withdrawn: false,
      } : {
        id: `app_${now}_${Math.random().toString(36).slice(2, 8)}`,
        applicantWallet: wallet,
        committee: input.committee,
        electionCycleId: input.electionCycleId,
        goals: input.goals,
        qualifications: input.qualifications,
        tagline: input.tagline,
        stakedAtSubmit: stakedNow,
        submittedAt: now,
        updatedAt: now,
      };
      const others = prev.electionApplications.filter(a => a.id !== next.id);
      return { ...prev, electionApplications: [next, ...others] };
    });

    pushInAppNotification({
      type: 'governance',
      actorName: 'Governance',
      actorUsername: 'aura_governance',
      actorAvatar: 'https://api.dicebear.com/7.x/shapes/svg?seed=governance',
      message: 'Candidate statement submitted',
      detail: 'Your statement is now public. Voters may ask questions during the Q&A window.',
    });
  }, [pushInAppNotification]);

  const withdrawElectionApplication = useCallback(async (committee: string, electionCycleId: string) => {
    await new Promise(r => setTimeout(r, 200));
    const wallet = stateRef.current.publicKey || stateRef.current.walletAddress;
    if (!wallet) return;
    setState(prev => ({
      ...prev,
      electionApplications: prev.electionApplications.map(a =>
        a.applicantWallet === wallet && a.committee === committee && a.electionCycleId === electionCycleId
          ? { ...a, withdrawn: true, updatedAt: Date.now() }
          : a,
      ),
    }));
  }, []);

  // ── Profile banner customization (2026-05-09) ────────────────────
  // Persisted with the rest of the mock chain state. Pass `null` to
  // reset to the default banner.
  const setProfileBannerUrl = useCallback((url: string | null) => {
    setState(prev => ({ ...prev, profileBannerUrl: url }));
  }, []);

  const toggleLikePost = useCallback((postId: string) => {
    setState(prev => {
      const liked = prev.likedPostIds || [];
      return {
        ...prev,
        likedPostIds: liked.includes(postId)
          ? liked.filter(id => id !== postId)
          : [...liked, postId],
      };
    });
  }, []);

  // --- Demo: simulate inbound social events for the notification stream ---
  // Notifications flow in only one direction: the current user receives
  // them when *other* people interact with the current user's activity.
  // The helper below covers the most common case in the demo — the user
  // leaves a comment on a creator's post, then that creator engages back
  // (likes the comment, replies to it). Both events surface as inbound
  // notifications to the current user.

  const simulateAuthorReplyToComment = useCallback((args: {
    postId: string;
    postTitle?: string;
    postAuthor: { id: string; displayName: string; username: string; avatar: string };
    commenterUsername: string;
    commenterDisplayName: string;
    commentText: string;
  }) => {
    const { postId, postTitle, postAuthor: author, commenterUsername, commenterDisplayName, commentText } = args;
    // 1) The author likes your comment a couple of seconds later.
    setTimeout(() => {
      pushInAppNotification({
        type: 'like',
        actorName: author.displayName,
        actorUsername: author.username,
        actorAvatar: author.avatar,
        message: 'liked your comment',
        detail: `“${commentText.slice(0, 140)}${commentText.length > 140 ? '…' : ''}”${postTitle ? ` · on “${postTitle}”` : ''}`,
        postId,
      });
    }, 1800 + Math.floor(Math.random() * 1200));

    // 2) The author replies to your comment a few more seconds after that.
    //    The reply is *both* a notification (so the bell badge increments)
    //    AND a real comment row on the post (so visiting the post shows
    //    the back-and-forth thread). Without the second half the post
    //    detail page looks empty even though the notification fired.
    const replies = [
      'Thanks for engaging — means a lot.',
      'Love this take. Let’s talk more soon.',
      'You’re exactly the kind of curator I hoped this protocol would attract.',
      'Couldn’t agree more.',
      'That perspective changes how I think about this piece.',
    ];
    const reply = replies[Math.floor(Math.random() * replies.length)];
    setTimeout(() => {
      pushInAppNotification({
        type: 'comment',
        actorName: author.displayName,
        actorUsername: author.username,
        actorAvatar: author.avatar,
        message: 'replied to your comment',
        detail: `“${reply}”${postTitle ? ` · on “${postTitle}”` : ''}`,
        postId,
      });
      // Persist the reply as a real comment so it shows up on the post.
      // Snapshot the user's original comment as a quote so the UI can
      // render an inline blockquote above this reply.
      setState(prev => {
        const replyComment: PostComment = {
          id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          postId,
          authorWallet: author.id,
          authorName: author.displayName,
          authorUsername: author.username,
          authorAvatar: author.avatar,
          content: reply,
          timestamp: Date.now(),
          quotedAuthor: commenterDisplayName,
          quotedUsername: commenterUsername,
          quotedContent: commentText,
        };
        return {
          ...prev,
          postComments: [replyComment, ...(prev.postComments || [])].slice(0, 5000),
        };
      });
    }, 4500 + Math.floor(Math.random() * 1800));
  }, [pushInAppNotification]);

  /**
   * Surface an inbound follow as an in-app notification. The deduping
   * key is wallet+notification-type so the same follower can't spam the
   * tray if Realtime fires twice.
   */
  const notifyInboundFollow = useCallback((args: {
    followerWallet: string;
    followerDisplayName: string;
    followerUsername: string;
    followerAvatar: string;
  }) => {
    const dedupeKey = `follow:${args.followerWallet}`;
    setState(prev => {
      if ((prev.inAppNotifications || []).some(n => n.id === dedupeKey)) return prev;
      const notif: InAppNotification = {
        id: dedupeKey,
        type: 'follow',
        actorName: args.followerDisplayName,
        actorUsername: args.followerUsername,
        actorAvatar: args.followerAvatar,
        message: 'started following you',
        detail: undefined,
        timestamp: Date.now(),
        isRead: false,
      };
      return {
        ...prev,
        inAppNotifications: [notif, ...(prev.inAppNotifications || [])].slice(0, 200),
      };
    });
  }, []);

  // --- Livestream ---
  const tipCreator = useCallback(async (creatorId: string, amount: number) => {
    await new Promise(r => setTimeout(r, 400));
    setState(prev => {
      if (prev.oraBalance < amount) throw new Error('Insufficient ORA balance');
      const txs = [...prev.transactions];
      txs.unshift({
        id: crypto.randomUUID(),
        type: 'reward' as const,
        amount: -amount,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `Tipped ${amount} ORA to ${creatorId}`,
      });
      return { ...prev, oraBalance: prev.oraBalance - amount, transactions: txs };
    });
  }, []);

  const subscribeToCreator = useCallback(async (creatorId: string, price: number) => {
    await new Promise(r => setTimeout(r, 500));
    setState(prev => {
      if (prev.oraBalance < price) throw new Error('Insufficient ORA balance');
      if (prev.subscribedCreators.includes(creatorId)) throw new Error('Already subscribed');
      const txs = [...prev.transactions];
      txs.unshift({
        id: crypto.randomUUID(),
        type: 'buy_coin' as const,
        amount: -price,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `Subscribed to ${creatorId} for ${price} ORA/month`,
      });
      return {
        ...prev,
        oraBalance: prev.oraBalance - price,
        subscribedCreators: [...prev.subscribedCreators, creatorId],
        transactions: txs,
      };
    });
  }, []);

  const purchasePPV = useCallback(async (streamId: string, price: number) => {
    await new Promise(r => setTimeout(r, 500));
    setState(prev => {
      if (prev.oraBalance < price) throw new Error('Insufficient ORA balance');
      const txs = [...prev.transactions];
      txs.unshift({
        id: crypto.randomUUID(),
        type: 'buy_key' as const,
        amount: -price,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `Purchased PPV access for stream ${streamId}`,
      });
      return { ...prev, oraBalance: prev.oraBalance - price, transactions: txs };
    });
  }, []);

  // --- fractionalize ---
  const buyFragment = useCallback(async (nftId: string, count: number): Promise<void> => {
    await new Promise(r => setTimeout(r, 500));
    setState(prev => {
      const nft = prev.fractionalizedNfts.find(n => n.id === nftId);
      if (!nft) throw new Error('NFT not found');
      const cost = nft.pricePerFragment * count;
      if (prev.oraBalance < cost) throw new Error('Insufficient ORA');
      if (count > nft.totalFragments - nft.soldFragments) throw new Error('Not enough fragments');
      return {
        ...prev,
        oraBalance: prev.oraBalance - cost,
        fractionalizedNfts: prev.fractionalizedNfts.map(n =>
          n.id === nftId ? { ...n, soldFragments: n.soldFragments + count, ownedFragments: n.ownedFragments + count } : n
        ),
      };
    });
  }, []);

  const sellFragment = useCallback(async (nftId: string, count: number): Promise<void> => {
    await new Promise(r => setTimeout(r, 400));
    setState(prev => {
      const nft = prev.fractionalizedNfts.find(n => n.id === nftId);
      if (!nft) throw new Error('NFT not found');
      if (nft.ownedFragments < count) throw new Error('Not enough fragments to sell');
      const proceeds = parseFloat((nft.pricePerFragment * count * 0.95).toFixed(4));
      return {
        ...prev,
        oraBalance: prev.oraBalance + proceeds,
        fractionalizedNfts: prev.fractionalizedNfts.map(n =>
          n.id === nftId ? { ...n, soldFragments: n.soldFragments - count, ownedFragments: n.ownedFragments - count } : n
        ),
      };
    });
  }, []);

  const claimFragmentRevenue = useCallback(async (nftId: string): Promise<number> => {
    await new Promise(r => setTimeout(r, 400));
    let claimed = 0;
    setState(prev => {
      const nft = prev.fractionalizedNfts.find(n => n.id === nftId);
      if (!nft || nft.ownedFragments === 0 || nft.revenue === 0) return prev;
      claimed = parseFloat(((nft.ownedFragments / nft.totalFragments) * nft.revenue).toFixed(4));
      return {
        ...prev,
        oraBalance: prev.oraBalance + claimed,
        fractionalizedNfts: prev.fractionalizedNfts.map(n => n.id === nftId ? { ...n, revenue: 0 } : n),
      };
    });
    return claimed;
  }, []);

  /** Mint a brand-new fractional NFT for a piece of user-published content.
   *  Splits the work into N fragments at price P. Creator owns all
   *  fragments at mint time — fans then buy them via buyFragment.
   *
   *  This is the on-ramp from Composer's “Fractionalize this work” toggle. */
  const fractionalizeContent = useCallback(async (input: {
    contentId: string;
    title: string;
    coverEmoji?: string;
    coverImage?: string;
    totalFragments: number;
    pricePerFragment: number;
  }): Promise<{ id: string }> => {
    await new Promise(r => setTimeout(r, 400));
    if (!Number.isFinite(input.totalFragments) || input.totalFragments < 10) {
      throw new Error('Total fragments must be at least 10.');
    }
    if (!Number.isFinite(input.pricePerFragment) || input.pricePerFragment <= 0) {
      throw new Error('Price per fragment must be positive.');
    }
    const newId = `fnft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    setState(prev => {
      const nft: FractionalizedNft = {
        id: newId,
        title: input.title,
        coverEmoji: input.coverEmoji || '🎨',
        coverImage: input.coverImage,
        contentId: input.contentId,
        totalFragments: input.totalFragments,
        soldFragments: 0,
        ownedFragments: input.totalFragments, // creator holds all at mint
        pricePerFragment: input.pricePerFragment,
        revenue: 0,
        creator: 'You',
      };
      const txs = [...prev.transactions];
      txs.unshift({
        id: crypto.randomUUID(),
        type: 'mint_coin',
        amount: 0,
        timestamp: Date.now(),
        txHash: randomHex(64),
        details: `Fractionalized “${input.title}” · ${input.totalFragments} fragments @ ${input.pricePerFragment.toFixed(4)} ORA each`,
        breakdown: {
          items: [
            { label: 'Fragments minted', amount: input.totalFragments, sub: 'You own 100% at mint', tone: 'positive' },
            { label: 'Price per fragment', amount: 0, sub: `${input.pricePerFragment.toFixed(4)} ORA`, tone: 'muted' },
            { label: 'Total NFT value (if sold out)', amount: 0, sub: `${(input.totalFragments * input.pricePerFragment).toFixed(2)} ORA`, tone: 'muted' },
          ],
          settlement: { label: 'Listed on marketplace', amount: 0, tone: 'muted' },
          note: `Fractional NFT minted from your post. Fans buy fragments via the marketplace; revenue + buyback proceeds flow to fragment holders pro-rata (whitepaper §8).`,
        },
      });
      return {
        ...prev,
        fractionalizedNfts: [nft, ...prev.fractionalizedNfts],
        transactions: txs,
      };
    });
    return { id: newId };
  }, []);

  // --- market / bounty ---
  const createBounty = useCallback(async (title: string, description: string, reward: number): Promise<void> => {
    await new Promise(r => setTimeout(r, 500));
    setState(prev => {
      if (prev.oraBalance < reward) throw new Error('Insufficient ORA');
      const nb: BountyItem = { id: `bounty-${Date.now()}`, title, description, reward, deadline: new Date(Date.now() + 14 * 86400000).toISOString(), submissionCount: 0, status: 'active', creator: prev.publicKey ? prev.publicKey.slice(0, 8) + '...' : 'You' };
      return { ...prev, oraBalance: prev.oraBalance - reward, bounties: [nb, ...prev.bounties] };
    });
  }, []);

  const submitBountyWork = useCallback(async (bountyId: string, workUrl: string, note?: string): Promise<void> => {
    await new Promise(r => setTimeout(r, 400));
    setState(prev => {
      const target = prev.bounties.find(b => b.id === bountyId);
      const submission: BountySubmission = {
        id: `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        bountyId,
        bountyTitle: target?.title || 'Bounty',
        workUrl,
        note,
        submittedAt: Date.now(),
        rewardSnapshot: target?.reward || 0,
        status: 'pending',
      };
      return {
        ...prev,
        bounties: prev.bounties.map(b =>
          b.id === bountyId ? { ...b, submissionCount: b.submissionCount + 1 } : b
        ),
        mySubmissions: [submission, ...prev.mySubmissions],
        reputationScore: prev.reputationScore + 2,
      };
    });
  }, []);

  const awardBounty = useCallback(async (bountyId: string): Promise<void> => {
    await new Promise(r => setTimeout(r, 400));
    setState(prev => ({ ...prev, bounties: prev.bounties.map(b => b.id === bountyId ? { ...b, status: 'completed' as const } : b) }));
  }, []);

  const setMode = useCallback((mode: 'mock' | 'localnet') => {
    setState(prev => ({ ...prev, mode }));
  }, []);

  const setRpcUrl = useCallback((rpcUrl: string) => {
    setState(prev => ({ ...prev, rpcUrl }));
  }, []);

  // 2026-05-19 H-1 — memoize the entire context value. The provider object
  // contains 100+ fields and used to be re-created on every render. Every
  // re-render of MockChainProvider (driven by state changes, parent renders,
  // or sibling context churn) handed a brand-new object to every
  // `useMockChain()` consumer, invalidating downstream `[mockChain]` memos
  // and effects. Keying on `state` is correct because every mutator goes
  // through `setState(prev => ...)` and produces a new state object
  // identity — callbacks are already stabilised by `useCallback`. The
  // `reloadState` arrow is intentionally created once via `useCallback`
  // below to avoid breaking the memo.
  const reloadState = useCallback(() => setState(load()), []);

  const value = useMemo<MockChainState>(() => ({
    mode: state.mode,
    rpcUrl: state.rpcUrl,
    connected: state.connected,
    publicKey: state.publicKey,
    oraBalance: state.oraBalance,
    solBalance: state.solBalance,
    creatorCoins: state.creatorCoins,
    connectWallet,
    disconnectWallet,
    publishContent,
    mintCreatorCoin,
    buyCreatorCoin,
    sellCreatorCoin,
    simulateExternalCoinBuy,
    simulateExternalCoinSellToMe,
    redeemCoinBenefit,
    redemptions: state.redemptions,
    initiateRedemption,
    markRedemptionDelivered,
    confirmRedemptionReceipt,
    disputeRedemption,
    giftCreatorCoin,
    redemptionNotifications: state.redemptionNotifications,
    markRedemptionNotificationsRead,
    inAppNotifications: state.inAppNotifications,
    markInAppNotificationsRead,
    markInAppNotificationRead,
    postComments: state.postComments || [],
    addPostComment,
    reserveSellOrder,
    releaseSellOrder,
    fillExternalSellOrder,
    unlockNextVestingBatch,
    setCreatorCoinBatchPrice,
    setCreatorCoinTgePrice,
    setCreatorCoinRealizedBatchPrice,
    foreignCoinPrimaryRemaining: state.foreignCoinPrimaryRemaining,
    ownCoinTrades: state.ownCoinTrades,
    ownCoinHolders: state.ownCoinHolders,
    coinTradeNotifications: state.coinTradeNotifications,
    markCoinNotificationsRead,
    curateContent,
    buyContentKey,
    listContentKey,
    buyListedKey,
    totalBurned: state.totalBurned,
    totalStaked: state.totalStaked,
    dailyCreationCount: state.dailyCreationDate === todayKey() ? state.dailyCreationCount : 0,
    transactions: state.transactions,
    hasCreatorCoin: state.hasCreatorCoin,
    creatorCoinSymbol: state.creatorCoinSymbol,
    creatorCoinBalance: state.creatorCoinBalance,
    creatorCoinLocked: state.creatorCoinLocked,
    creatorCoinVestingMonth: state.creatorCoinVestingMonth,
    ownedKeys: state.ownedKeys,
    listedKeys: state.listedKeys,
    curatedContentIds: state.curatedContentIds,
    boostedContentIds: state.boostedContentIds,
    pinnedContentIds: state.pinnedContentIds,
    boostContent,
    pinContent,
    vaultBalance: state.vaultBalance,
    vestedAmount: state.vestedAmount,
    claimedAmount: state.claimedAmount,
    claimVested,
    licenses: state.licenses,
    setLicense,
    payToEmbed,
    payToRemix,
    embeddedContentIds: state.embeddedContentIds,
    remixLicensedContentIds: state.remixLicensedContentIds,
    remixes: state.remixes,
    createRemix,
    remixRevenue: state.remixRevenue,
    followingIds: state.followingIds,
    followUser,
    unfollowUser,
    // Single source of truth (2026-04-30 R3): always derive stakedOra from
    // stakes[]. Header summary and `My Stakes` list can never disagree because
    // the same array drives both. Mutators may also update state.stakedOra for
    // legacy persistence parity, but consumers see only the derived value.
    stakedOra: state.stakes.reduce((s, x) => s + (Number.isFinite(x.amount) ? x.amount : 0), 0),
    stakingRewards: state.stakingRewards,
    stakeOra,
    unstakeOra,
    claimStakingReward,
    walletAddress: state.walletAddress,
    network: state.network,
    setNetwork,
    stakes: state.stakes,
    curationStats: state.curationStats,
    pendingCurations: state.pendingCurations,
    creatorCoinRedemptions: state.creatorCoinRedemptions,
    // Always derive from real holder list — never trust persisted seed values.
    myCoinHolders: state.ownCoinHolders.length,
    stakeOraWithTier,
    unstakeFromTier,
    sendCreatorCoin,
    performCuration,
    redeemCreatorCoinTier,
    sendOra,
    buyOra,
    acquireNft,
    ownedNfts: state.ownedNfts,
    proposals: state.proposals,
    myVotes: state.myVotes,
    voteOnProposal,
    createProposal,
    electionApplications: state.electionApplications,
    submitElectionApplication,
    withdrawElectionApplication,
    profileBannerUrl: state.profileBannerUrl,
    setProfileBannerUrl,
    likedPostIds: state.likedPostIds || [],
    toggleLikePost,
    simulateAuthorReplyToComment,
    notifyInboundFollow,
    subscribedCreators: state.subscribedCreators,
    tipCreator,
    subscribeToCreator,
    purchasePPV,
    setMode,
    setRpcUrl,
    fractionalizedNfts: state.fractionalizedNfts,
    buyFragment,
    sellFragment,
    claimFragmentRevenue,
    fractionalizeContent,
    reputationScore: state.reputationScore,
    reputationTier: getReputationTier(state.reputationScore),
    bounties: state.bounties,
    mySubmissions: state.mySubmissions,
    createBounty,
    submitBountyWork,
    awardBounty,
    adBids: state.adBids,
    reloadState,
  }), [
    state,
    connectWallet, disconnectWallet, publishContent, mintCreatorCoin,
    buyCreatorCoin, sellCreatorCoin, simulateExternalCoinBuy,
    simulateExternalCoinSellToMe, redeemCoinBenefit, initiateRedemption,
    markRedemptionDelivered, confirmRedemptionReceipt, disputeRedemption,
    giftCreatorCoin, markRedemptionNotificationsRead,
    markInAppNotificationsRead, markInAppNotificationRead,
    addPostComment, reserveSellOrder, releaseSellOrder, fillExternalSellOrder,
    unlockNextVestingBatch, setCreatorCoinBatchPrice, setCreatorCoinTgePrice,
    setCreatorCoinRealizedBatchPrice, markCoinNotificationsRead, curateContent,
    buyContentKey, listContentKey, buyListedKey, boostContent, pinContent,
    claimVested, setLicense, payToEmbed, payToRemix, createRemix,
    followUser, unfollowUser, stakeOra, unstakeOra, claimStakingReward,
    setNetwork, stakeOraWithTier, unstakeFromTier, sendCreatorCoin,
    performCuration, redeemCreatorCoinTier, sendOra, buyOra, acquireNft,
    voteOnProposal, createProposal, submitElectionApplication,
    withdrawElectionApplication, setProfileBannerUrl, toggleLikePost,
    simulateAuthorReplyToComment, notifyInboundFollow, tipCreator,
    subscribeToCreator, purchasePPV, setMode, setRpcUrl, buyFragment,
    sellFragment, claimFragmentRevenue, fractionalizeContent, createBounty,
    submitBountyWork, awardBounty, reloadState,
  ]);

  return <MockChainContext.Provider value={value}>{children}</MockChainContext.Provider>;
}

export function useMockChain() {
  const ctx = useContext(MockChainContext);
  if (!ctx) throw new Error('useMockChain must be used within MockChainProvider');
  return ctx;
}
