export type ContentType = 'photo' | 'video' | 'text' | 'live' | 'audio';

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  followers: number;
  following: number;
  isVerified: boolean;
  creatorCoin?: CreatorCoin;
  /** True for wallets that haven't completed onboarding yet (no profile, no posts, no followers). */
  isNewWallet?: boolean;
  /** Truthy when this user account was created by connecting a real Phantom/Solflare wallet. */
  walletAddress?: string;
}

export interface CreatorCoin {
  symbol: string;
  /** Optional initial mint price; runtime stats (holders/circulating/volume/change) are derived from on-chain state. */
  initialPrice?: number;
  /**
   * Standalone coin logo URL. Independent from the creator's profile avatar so
   * creators can design and upload their own coin artwork. Falls back to a
   * generated gradient "ticker letter" badge when not set.
   */
  logoUrl?: string;
  /** Optional one-line tagline shown on the coin's marketplace card. */
  tagline?: string;
  benefits?: Array<{
    id: string;
    type: 'hold' | 'consume';
    threshold: number;
    title: string;
    description: string;
  }>;
}

export interface Post {
  id: string;
  type: ContentType;
  author: User;
  title?: string;
  content?: string;
  images?: string[];
  coverImage?: string;
  aspectRatio?: number;
  videoDuration?: string;
  videoUrl?: string;
  audioUrl?: string;
  audioDuration?: string;
  audioWaveform?: number[];
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  isCurated: boolean;
  isBoosted?: boolean;
  isPremium?: boolean;
  premiumPrice?: number;
  isAd?: boolean;
  adLabel?: string;
  adUrl?: string;
  tags: string[];
  createdAt: string;
  viewerCount?: number;
  /** Optional on-chain Solana post PDA (base58). Set when the post was
   *  published via the Core program (aura_core publishContent). Pages
   *  that need live like/comment counts read this and call
   *  `coreOnChain.fetchPost(postPda)` to refresh from the chain. */
  onChainPostPda?: string;
}

export interface Comment {
  id: string;
  author: User;
  content: string;
  likes: number;
  isLiked: boolean;
  createdAt: string;
  replies?: Comment[];
  /** Optional inline quote block (e.g. when the post author replies to
   * a fan's comment, the fan's text is snapshotted here so the UI can
   * render a Bilibili-style quoted reply). */
  quotedAuthor?: string;
  quotedUsername?: string;
  quotedContent?: string;
}

export interface Conversation {
  id: string;
  user: User;
  lastMessage: string;
  timestamp: string;
  unread: number;
}

export interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: string;
  type: 'text' | 'tip';
  tipAmount?: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}
