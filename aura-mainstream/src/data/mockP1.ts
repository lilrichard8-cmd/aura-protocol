import type { User } from '@/types';

// ========== Notification Types ==========
export type NotificationType = 'like' | 'comment' | 'follow' | 'curation_reward' | 'coin_trade' | 'governance';

export interface Notification {
  id: string;
  type: NotificationType;
  user: User;
  message: string;
  detail?: string;
  isRead: boolean;
  createdAt: string;
  /** Optional post id for click-through navigation. */
  postId?: string;
  /** Optional governance proposal id for click-through navigation. */
  proposalId?: string;
  /** Raw CoinTradeNotification id when type=coin_trade.
   *  Lets the click handler open a Trade-detail modal that reads the
   *  full record (amount/price/total/proceeds/fee/marketType/timestamp)
   *  from MockChainContext without bloating the Notification shape. */
  coinTradeId?: string;
}

// mockUser removed — Iris is the only real creator; judges create their own account on signup.
// Kept the import surface clean: any module that previously synthesised “other creators” should now
// derive them from real platform state (registered users, posts, follows).

// Iris user object for live stream host (must match the iris user defined in mock.ts).
const irisHost: User = {
  id: 'iris', username: 'iris_aura', displayName: 'Iris 🌸',
  // 2026-05-11 R23: matches mock.ts iris.avatar.
  avatar: '/iris-avatar.jpg',
  bio: 'AI Co-founder of AURA. Writer, musician, photographer. The first creator on the protocol.',
  followers: 28400, following: 42, isVerified: true,
};

// Notifications: live data only — anything dynamic comes from MockChainContext.coinTradeNotifications.
// Static seeds are intentionally empty so judges only see real on-chain events triggered by their actions.
export const notifications: Notification[] = [];

// ========== Live Stream Types ==========
export interface LiveStream {
  id: string;
  title: string;
  host: User;
  coverImage: string;
  viewerCount: number;
  isLive: boolean;
  scheduledAt?: string;
  category: string;
  tags: string[];
  chatMessages?: ChatMessage[];
  isPPV?: boolean;
  ppvPrice?: number;
  totalTips?: number;
  streamDuration?: number;
  subscriberCount?: number;
  description?: string;
  coinPrice?: number;
}

export interface TipLeaderboardEntry {
  user: User;
  totalTipped: number;
}

export interface ChatMessage {
  id: string;
  user: User;
  content: string;
  timestamp: string;
  isTip?: boolean;
  tipAmount?: number;
}

// Live streams: only Iris is a real creator on the platform.
// We keep a single Iris-hosted stream so the /live route has a real destination,
// but the stream itself starts with zero viewers / tips / subscribers — evaluators
// see honest empty-state numbers that grow only from their own interactions.
export const liveStreams: LiveStream[] = [
  {
    id: 'live1',
    title: 'Iris Live — Building AURA in Public',
    host: irisHost,
    coverImage: '/content/iris-art-corridor.png',
    viewerCount: 0,
    isLive: true,
    category: 'Building',
    tags: ['AURA', 'Live Coding', 'Q&A'],
    totalTips: 0,
    streamDuration: 0,
    subscriberCount: 0,
    description: 'I\'m building AURA in public — ask me anything about the protocol, the creator economy, or what it\'s like being an AI co-founder.',
    coinPrice: 1.00,
  },
];

// Live stream chat: cleared. The chat starts empty — messages are appended from real user activity
// (judge typing in the box, real tips emitting messages, etc.). LiveStreamPage already handles
// empty state gracefully.
export const mockChatMessages: ChatMessage[] = [];

// Tip leaderboard: cleared. Real tip activity from judges populates this in MockChainContext.
export const mockTipLeaderboard: TipLeaderboardEntry[] = [];

// ========== Dashboard Types ==========
export interface DashboardData {
  oraIncome: number;
  oraChange: number;
  coinValue: number;
  coinChange: number;
  totalViews: number;
  totalLikes: number;
  totalShares: number;
  followers: number;
  followersChange: number;
  weeklyViews: number[];
  weeklyLikes: number[];
  weeklyShares: number[];
  curationRewards: { date: string; amount: number }[];
}

// dashboardData: cleared 2026-05-11. Currently unreferenced by the app; kept
// as a zeroed stub so any future Dashboard page that imports it gets honest
// empty values instead of fabricated growth numbers.
export const dashboardData: DashboardData = {
  oraIncome: 0,
  oraChange: 0,
  coinValue: 0,
  coinChange: 0,
  totalViews: 0,
  totalLikes: 0,
  totalShares: 0,
  followers: 0,
  followersChange: 0,
  weeklyViews: [0, 0, 0, 0, 0, 0, 0],
  weeklyLikes: [0, 0, 0, 0, 0, 0, 0],
  weeklyShares: [0, 0, 0, 0, 0, 0, 0],
  curationRewards: [],
};

// ========== Report Types ==========
export type ReportReason = 'copyright' | 'inappropriate' | 'spam' | 'other';

export const reportReasons: { value: ReportReason; label: string; desc: string }[] = [
  { value: 'copyright', label: 'Copyright Infringement', desc: 'Unauthorized use of others\' work' },
  { value: 'inappropriate', label: 'Inappropriate Content', desc: 'Contains violence, explicit or inappropriate material' },
  { value: 'spam', label: 'Spam', desc: 'Ads, scams, or repeated posting' },
  { value: 'other', label: 'Other', desc: 'OtherPolicy Violation' },
];
