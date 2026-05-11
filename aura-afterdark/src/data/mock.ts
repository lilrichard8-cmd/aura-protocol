// ─── Types ────────────────────────────────────────────────────────
export interface Creator {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  cover: string;
  bio: string;
  isVerified: boolean;
  isLive: boolean;
  subscriberCount: number;
  postCount: number;
  tiers: SubscriptionTier[];
  coinSymbol: string;
  coinPrice: number;
}

export interface SubscriptionTier {
  id: string;
  name: string;
  icon: string;
  price: number; // 0 = free
  perks: string[];
  contentCount: number;
}

export type PostType = 'image' | 'video' | 'gallery';

export interface Post {
  id: string;
  creatorId: string;
  creator: Pick<Creator, 'username' | 'displayName' | 'avatar' | 'isVerified'>;
  type: PostType;
  thumbnail: string;
  images?: string[];
  caption: string;
  isLocked: boolean;
  requiredTier: string | null; // null = free
  ppvPrice: number | null; // null = not PPV
  likeCount: number;
  commentCount: number;
  tipCount: number;
  createdAt: string;
  isLive?: boolean;
  viewerCount?: number;
  isCurated?: boolean; // ✅ Curated flag
  isBoosted?: boolean; // 🔥 Boosted flag  
  isPremium?: boolean; // 🔒 Premium flag
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  timestamp: string;
  isOwn: boolean;
  isPaid: boolean;
  paidAmount?: number;
  isPPV: boolean;
  ppvPrice?: number;
  ppvUnlocked?: boolean;
  ppvThumbnail?: string;
  isVoice?: boolean;
  voiceDuration?: number;
}

export interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantAvatar: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isOnline: boolean;
}

export interface WalletData {
  oraBalance: number;
  usdcBalance: number;
  totalEarnings: number;
  monthlyEarnings: number;
  weeklyEarnings: number;
  subscriberCount: number;
  earningsHistory: { date: string; amount: number }[];
  recentTransactions: Transaction[];
}

export interface Transaction {
  id: string;
  type: 'subscription' | 'tip' | 'ppv' | 'withdrawal' | 'deposit';
  amount: number;
  currency: string;
  from: string;
  to: string;
  timestamp: string;
  description: string;
}

export interface LiveStream {
  id: string;
  creatorId: string;
  creator: Pick<Creator, 'username' | 'displayName' | 'avatar' | 'isVerified'>;
  title: string;
  thumbnail: string;
  viewerCount: number;
  tipGoal: number;
  tipCurrent: number;
  isTicketed: boolean;
  ticketPrice?: number;
  requiredTier?: string;
  danmaku: DanmakuMessage[];
}

export interface DanmakuMessage {
  id: string;
  username: string;
  content: string;
  isTip: boolean;
  tipAmount?: number;
  timestamp: number;
}

// ─── Real Unsplash Images ────────────────────────────────────────
const images = {
  avatars: [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&auto=format", // Luna - 美女
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&auto=format", // Nyx - 美女2
    "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&auto=format", // Ember - 美女3  
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&auto=format", // Velvet - 美女4
    "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=400&fit=crop&auto=format", // Crimson - 美女5
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&auto=format", // 帅哥1
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&auto=format", // 帅哥2
  ],
  covers: [
    "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1200&h=400&fit=crop&auto=format", // 霓虹灯氛围
    "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=1200&h=400&fit=crop&auto=format", // 暗色调
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&h=400&fit=crop&auto=format", // 健身房
    "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200&h=400&fit=crop&auto=format", // 音乐/麦克风
    "https://images.unsplash.com/photo-1538439023242-90b38c56ab3b?w=1200&h=400&fit=crop&auto=format", // 时尚摄影
  ],
  posts: [
    // 时尚艺术类图片（更适合成人平台）
    "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&h=800&fit=crop&auto=format", // 时尚女模特
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=800&fit=crop&auto=format", // 时尚摄影
    "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&h=800&fit=crop&auto=format", // 艺术肖像
    "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=600&h=800&fit=crop&auto=format", // 健身女性
    "https://images.unsplash.com/photo-1605296867304-46d5465a13f1?w=600&h=800&fit=crop&auto=format", // 健身房
    "https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=600&h=800&fit=crop&auto=format", // 时尚肖像
    "https://images.unsplash.com/photo-1534030347209-7116b4139852?w=600&h=800&fit=crop&auto=format", // 抽象艺术
    "https://images.unsplash.com/photo-1496440737103-cd596325d314?w=600&h=800&fit=crop&auto=format", // 时尚女性
    "https://images.unsplash.com/photo-1519681393784-d8e5b5a4570e?w=600&h=800&fit=crop&auto=format", // 夜空/星空
    "https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=600&h=800&fit=crop&auto=format", // 肖像摄影
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&h=800&fit=crop&auto=format", // 时尚艺术
    "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=600&h=800&fit=crop&auto=format", // 艺术女性
    "https://images.unsplash.com/photo-1543965170-4c01a586684e?w=600&h=800&fit=crop&auto=format", // 时尚写真
    "https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=600&h=800&fit=crop&auto=format", // 艺术摄影
    "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=600&h=800&fit=crop&auto=format", // 时尚肖像2
  ]
};

// ─── Mock Creators ───────────────────────────────────────────────
export const creators: Creator[] = [
  {
    id: 'c1',
    username: 'luna_velvet',
    displayName: 'Luna Velvet',
    avatar: images.avatars[0],
    cover: images.covers[0],
    bio: 'Digital artist & creative muse. Exclusive art, behind-the-scenes, and more. Join my world.',
    isVerified: true,
    isLive: true,
    subscriberCount: 12400,
    postCount: 342,
    tiers: [
      { id: 't-free', name: 'Free Follow', icon: '🆓', price: 0, perks: ['Basic content', 'Public posts'], contentCount: 45 },
      { id: 't-bronze', name: 'Bronze', icon: '🥉', price: 5, perks: ['Exclusive photos', 'Behind the scenes'], contentCount: 120 },
      { id: 't-silver', name: 'Silver', icon: '🥈', price: 15, perks: ['Full content library', 'DM access', 'Monthly Q&A'], contentCount: 230 },
      { id: 't-gold', name: 'Gold', icon: '🥇', price: 30, perks: ['Everything', 'Custom content', 'Priority DMs', 'Video calls'], contentCount: 342 },
    ],
    coinSymbol: 'LUNA',
    coinPrice: 0.42,
  },
  {
    id: 'c2',
    username: 'nyx_shadow',
    displayName: 'Nyx Shadow',
    avatar: images.avatars[1],
    cover: images.covers[1],
    bio: 'Photographer exploring the edges of light & dark. Uncensored creative expression.',
    isVerified: true,
    isLive: false,
    subscriberCount: 8700,
    postCount: 198,
    tiers: [
      { id: 't-free', name: 'Free Follow', icon: '🆓', price: 0, perks: ['Preview content'], contentCount: 30 },
      { id: 't-bronze', name: 'Bronze', icon: '🥉', price: 5, perks: ['Weekly photosets'], contentCount: 80 },
      { id: 't-silver', name: 'Silver', icon: '🥈', price: 15, perks: ['Full gallery', 'DM access'], contentCount: 150 },
      { id: 't-gold', name: 'Gold', icon: '🥇', price: 30, perks: ['Everything + 1-on-1 shoots'], contentCount: 198 },
    ],
    coinSymbol: 'NYX',
    coinPrice: 0.28,
  },
  {
    id: 'c3',
    username: 'ember_rose',
    displayName: 'Ember Rose',
    avatar: images.avatars[2],
    cover: images.covers[2],
    bio: 'Fitness model & lifestyle creator. Workouts, tips, and exclusive content.',
    isVerified: true,
    isLive: false,
    subscriberCount: 21000,
    postCount: 567,
    tiers: [
      { id: 't-free', name: 'Free Follow', icon: '🆓', price: 0, perks: ['Workout tips'], contentCount: 60 },
      { id: 't-bronze', name: 'Bronze', icon: '🥉', price: 5, perks: ['Workout plans', 'Progress pics'], contentCount: 200 },
      { id: 't-silver', name: 'Silver', icon: '🥈', price: 15, perks: ['Full video library', 'Meal plans'], contentCount: 400 },
      { id: 't-gold', name: 'Gold', icon: '🥇', price: 30, perks: ['Custom plans', 'Video calls', 'Everything'], contentCount: 567 },
    ],
    coinSymbol: 'EMBR',
    coinPrice: 0.65,
  },
  {
    id: 'c4',
    username: 'velvet_dusk',
    displayName: 'Velvet Dusk',
    avatar: images.avatars[3],
    cover: images.covers[3],
    bio: 'ASMR & voice content creator. Let me whisper you to sleep.',
    isVerified: false,
    isLive: false,
    subscriberCount: 5300,
    postCount: 145,
    tiers: [
      { id: 't-free', name: 'Free Follow', icon: '🆓', price: 0, perks: ['Public ASMR'], contentCount: 20 },
      { id: 't-bronze', name: 'Bronze', icon: '🥉', price: 5, perks: ['Weekly ASMR'], contentCount: 60 },
      { id: 't-silver', name: 'Silver', icon: '🥈', price: 15, perks: ['Custom triggers', 'DM access'], contentCount: 100 },
      { id: 't-gold', name: 'Gold', icon: '🥇', price: 30, perks: ['Personal recordings', 'Everything'], contentCount: 145 },
    ],
    coinSymbol: 'VLVT',
    coinPrice: 0.15,
  },
  {
    id: 'c5',
    username: 'crimson_knight',
    displayName: 'Crimson Knight',
    avatar: images.avatars[4],
    cover: images.covers[4],
    bio: 'Cosplay & fantasy content. Bringing your favorite characters to life.',
    isVerified: true,
    isLive: false,
    subscriberCount: 15800,
    postCount: 289,
    tiers: [
      { id: 't-free', name: 'Free Follow', icon: '🆓', price: 0, perks: ['Public cosplays'], contentCount: 40 },
      { id: 't-bronze', name: 'Bronze', icon: '🥉', price: 5, perks: ['HD photosets', 'WIP shots'], contentCount: 100 },
      { id: 't-silver', name: 'Silver', icon: '🥈', price: 15, perks: ['Video content', 'Making-of'], contentCount: 200 },
      { id: 't-gold', name: 'Gold', icon: '🥇', price: 30, perks: ['Custom cosplay requests', 'Everything'], contentCount: 289 },
    ],
    coinSymbol: 'CRSN',
    coinPrice: 0.51,
  },
];

// ─── Mock Posts ───────────────────────────────────────────────────
export const posts: Post[] = [
  // Free posts
  {
    id: 'p1', creatorId: 'c1', creator: { username: 'luna_velvet', displayName: 'Luna Velvet', avatar: images.avatars[0], isVerified: true },
    type: 'image', thumbnail: images.posts[0], caption: 'New artwork just dropped! What do you think of this color palette? 🎨✨', isLocked: false, requiredTier: null, ppvPrice: null,
    likeCount: 1247, commentCount: 82, tipCount: 43, createdAt: '2h ago', isCurated: true,
  },
  {
    id: 'p2', creatorId: 'c3', creator: { username: 'ember_rose', displayName: 'Ember Rose', avatar: images.avatars[2], isVerified: true },
    type: 'image', thumbnail: images.posts[3], caption: 'Morning workout complete! 💪 Full routine in the Bronze tier.', isLocked: false, requiredTier: null, ppvPrice: null,
    likeCount: 1800, commentCount: 129, tipCount: 65, createdAt: '3h ago', isBoosted: true,
  },
  // Locked / paid posts
  {
    id: 'p3', creatorId: 'c1', creator: { username: 'luna_velvet', displayName: 'Luna Velvet', avatar: images.avatars[0], isVerified: true },
    type: 'gallery', thumbnail: images.posts[2], images: [images.posts[2], images.posts[11], images.posts[12]],
    caption: 'Exclusive behind-the-scenes gallery from my latest photoshoot ✨🔥', isLocked: true, requiredTier: 't-bronze', ppvPrice: null,
    likeCount: 532, commentCount: 48, tipCount: 87, createdAt: '4h ago', isPremium: true,
  },
  {
    id: 'p4', creatorId: 'c2', creator: { username: 'nyx_shadow', displayName: 'Nyx Shadow', avatar: images.avatars[1], isVerified: true },
    type: 'image', thumbnail: images.posts[5], caption: 'The shadow series continues... exploring light and dark 🖤', isLocked: true, requiredTier: 't-silver', ppvPrice: null,
    likeCount: 854, commentCount: 61, tipCount: 129, createdAt: '6h ago', isCurated: true, isBoosted: true,
  },
  // PPV posts
  {
    id: 'p5', creatorId: 'c5', creator: { username: 'crimson_knight', displayName: 'Crimson Knight', avatar: images.avatars[4], isVerified: true },
    type: 'video', thumbnail: images.posts[7], caption: 'Full transformation video - 15 minutes of pure artistry ⚔️✨', isLocked: true, requiredTier: null, ppvPrice: 12,
    likeCount: 1187, commentCount: 186, tipCount: 294, createdAt: '8h ago', isPremium: true,
  },
  {
    id: 'p6', creatorId: 'c3', creator: { username: 'ember_rose', displayName: 'Ember Rose', avatar: images.avatars[2], isVerified: true },
    type: 'video', thumbnail: images.posts[4], caption: 'Full uncut workout video + nutrition breakdown 🔥💪', isLocked: true, requiredTier: null, ppvPrice: 8,
    likeCount: 2043, commentCount: 263, tipCount: 412, createdAt: '10h ago',
  },
  // Live post
  {
    id: 'p7', creatorId: 'c1', creator: { username: 'luna_velvet', displayName: 'Luna Velvet', avatar: images.avatars[0], isVerified: true },
    type: 'image', thumbnail: images.posts[13], caption: 'LIVE NOW: Art stream - painting your requests! 🎨🔴', isLocked: false, requiredTier: null, ppvPrice: null,
    likeCount: 434, commentCount: 169, tipCount: 256, createdAt: 'LIVE', isLive: true, viewerCount: 1247,
  },
  // More diverse content
  {
    id: 'p8', creatorId: 'c4', creator: { username: 'velvet_dusk', displayName: 'Velvet Dusk', avatar: images.avatars[3], isVerified: false },
    type: 'image', thumbnail: images.posts[9], caption: 'New ASMR setup reveal! The mic quality is incredible 🎙️✨', isLocked: false, requiredTier: null, ppvPrice: null,
    likeCount: 421, commentCount: 65, tipCount: 32, createdAt: '12h ago',
  },
  {
    id: 'p9', creatorId: 'c2', creator: { username: 'nyx_shadow', displayName: 'Nyx Shadow', avatar: images.avatars[1], isVerified: true },
    type: 'gallery', thumbnail: images.posts[8], images: [images.posts[8], images.posts[10], images.posts[14]],
    caption: 'Midnight photography collection — Gold tier exclusive 🌙🖤', isLocked: true, requiredTier: 't-gold', ppvPrice: null,
    likeCount: 976, commentCount: 87, tipCount: 298, createdAt: '1d ago',
  },
  {
    id: 'p10', creatorId: 'c5', creator: { username: 'crimson_knight', displayName: 'Crimson Knight', avatar: images.avatars[4], isVerified: true },
    type: 'image', thumbnail: images.posts[6], caption: 'Sneak peek of the next creation! Can you guess the inspiration? 🤔✨', isLocked: false, requiredTier: null, ppvPrice: null,
    likeCount: 2300, commentCount: 445, tipCount: 118, createdAt: '1d ago',
  },
  {
    id: 'p11', creatorId: 'c4', creator: { username: 'velvet_dusk', displayName: 'Velvet Dusk', avatar: images.avatars[3], isVerified: false },
    type: 'video', thumbnail: images.posts[12], caption: 'Personal ASMR session — exclusive content 🔒🎧', isLocked: true, requiredTier: null, ppvPrice: 15,
    likeCount: 643, commentCount: 98, tipCount: 176, createdAt: '1d ago',
  },
  {
    id: 'p12', creatorId: 'c3', creator: { username: 'ember_rose', displayName: 'Ember Rose', avatar: images.avatars[2], isVerified: true },
    type: 'gallery', thumbnail: images.posts[1], images: [images.posts[1], images.posts[3], images.posts[14]],
    caption: 'Training diary & progress shots — Silver+ subscribers 💎💪', isLocked: true, requiredTier: 't-silver', ppvPrice: null,
    likeCount: 2176, commentCount: 334, tipCount: 556, createdAt: '2d ago',
  },
];

// ─── Mock Conversations ──────────────────────────────────────────
export const conversations: Conversation[] = [
  { id: 'conv1', participantId: 'c1', participantName: 'Luna Velvet', participantAvatar: images.avatars[0], lastMessage: 'Thanks for the tip! 💕', lastMessageTime: '2m ago', unreadCount: 2, isOnline: true },
  { id: 'conv2', participantId: 'c3', participantName: 'Ember Rose', participantAvatar: images.avatars[2], lastMessage: 'Your custom plan is ready!', lastMessageTime: '1h ago', unreadCount: 0, isOnline: true },
  { id: 'conv3', participantId: 'c2', participantName: 'Nyx Shadow', participantAvatar: images.avatars[1], lastMessage: 'New PPV content just for you 📸', lastMessageTime: '3h ago', unreadCount: 1, isOnline: false },
  { id: 'conv4', participantId: 'c5', participantName: 'Crimson Knight', participantAvatar: images.avatars[4], lastMessage: 'The costume is almost done!', lastMessageTime: '1d ago', unreadCount: 0, isOnline: false },
  { id: 'conv5', participantId: 'c4', participantName: 'Velvet Dusk', participantAvatar: images.avatars[3], lastMessage: 'Here\'s your personalized audio 🎧', lastMessageTime: '2d ago', unreadCount: 0, isOnline: false },
];

// ─── Mock Messages ───────────────────────────────────────────────
export const messagesByConversation: Record<string, Message[]> = {
  conv1: [
    { id: 'm1', senderId: 'c1', senderName: 'Luna Velvet', senderAvatar: images.avatars[0], content: 'Hey! Welcome to my DMs 💕', timestamp: '10:00 AM', isOwn: false, isPaid: false, isPPV: false },
    { id: 'm2', senderId: 'me', senderName: 'You', senderAvatar: '', content: 'Love your latest artwork!', timestamp: '10:02 AM', isOwn: true, isPaid: false, isPPV: false },
    { id: 'm3', senderId: 'c1', senderName: 'Luna Velvet', senderAvatar: images.avatars[0], content: 'Thank you so much! Want to see the process video?', timestamp: '10:05 AM', isOwn: false, isPaid: false, isPPV: false },
    { id: 'm4', senderId: 'c1', senderName: 'Luna Velvet', senderAvatar: images.avatars[0], content: '', timestamp: '10:06 AM', isOwn: false, isPaid: false, isPPV: true, ppvPrice: 5, ppvUnlocked: false, ppvThumbnail: images.posts[2] },
    { id: 'm5', senderId: 'me', senderName: 'You', senderAvatar: '', content: '', timestamp: '10:08 AM', isOwn: true, isPaid: true, paidAmount: 10, isPPV: false },
    { id: 'm6', senderId: 'c1', senderName: 'Luna Velvet', senderAvatar: images.avatars[0], content: 'Thanks for the tip! 💕', timestamp: '10:09 AM', isOwn: false, isPaid: false, isPPV: false },
    { id: 'm7', senderId: 'c1', senderName: 'Luna Velvet', senderAvatar: images.avatars[0], content: '', timestamp: '10:10 AM', isOwn: false, isPaid: false, isPPV: false, isVoice: true, voiceDuration: 15 },
  ],
  conv2: [
    { id: 'm10', senderId: 'c3', senderName: 'Ember Rose', senderAvatar: images.avatars[2], content: 'Hi! Your custom workout plan is ready. Check it out!', timestamp: '9:00 AM', isOwn: false, isPaid: false, isPPV: false },
    { id: 'm11', senderId: 'me', senderName: 'You', senderAvatar: '', content: 'Amazing, can\'t wait to start!', timestamp: '9:15 AM', isOwn: true, isPaid: false, isPPV: false },
    { id: 'm12', senderId: 'c3', senderName: 'Ember Rose', senderAvatar: images.avatars[2], content: 'Your custom plan is ready!', timestamp: '9:30 AM', isOwn: false, isPaid: false, isPPV: false },
  ],
  conv3: [
    { id: 'm20', senderId: 'c2', senderName: 'Nyx Shadow', senderAvatar: images.avatars[1], content: 'I have something special for you...', timestamp: 'Yesterday', isOwn: false, isPaid: false, isPPV: false },
    { id: 'm21', senderId: 'c2', senderName: 'Nyx Shadow', senderAvatar: images.avatars[1], content: '', timestamp: 'Yesterday', isOwn: false, isPaid: false, isPPV: true, ppvPrice: 15, ppvUnlocked: false, ppvThumbnail: images.posts[8] },
    { id: 'm22', senderId: 'c2', senderName: 'Nyx Shadow', senderAvatar: images.avatars[1], content: 'New PPV content just for you 📸', timestamp: '3h ago', isOwn: false, isPaid: false, isPPV: false },
  ],
};

// ─── Mock Live Stream ────────────────────────────────────────────
export const liveStreams: LiveStream[] = [
  {
    id: 'ls1',
    creatorId: 'c1',
    creator: { username: 'luna_velvet', displayName: 'Luna Velvet', avatar: images.avatars[0], isVerified: true },
    title: 'Late Night Art Stream — Painting Your Requests! 🎨',
    thumbnail: images.posts[2],
    viewerCount: 847,
    tipGoal: 500,
    tipCurrent: 342,
    isTicketed: false,
    danmaku: [
      { id: 'd1', username: 'user123', content: 'Love this!', isTip: false, timestamp: Date.now() - 5000 },
      { id: 'd2', username: 'fan_42', content: '🔥🔥🔥', isTip: false, timestamp: Date.now() - 4000 },
      { id: 'd3', username: 'patron_vip', content: 'Amazing work!', isTip: true, tipAmount: 25, timestamp: Date.now() - 3000 },
      { id: 'd4', username: 'nightowl', content: 'Can you paint a dragon?', isTip: false, timestamp: Date.now() - 2000 },
      { id: 'd5', username: 'art_lover', content: 'Tipped!', isTip: true, tipAmount: 10, timestamp: Date.now() - 1000 },
      { id: 'd6', username: 'shadow_fan', content: 'The colors are incredible', isTip: false, timestamp: Date.now() - 500 },
      { id: 'd7', username: 'crypto_whale', content: '🐳', isTip: true, tipAmount: 100, timestamp: Date.now() - 200 },
      { id: 'd8', username: 'newbie22', content: 'First time here, this is awesome!', isTip: false, timestamp: Date.now() },
    ],
  },
];

// ─── Mock Wallet Data ────────────────────────────────────────────
export const walletData: WalletData = {
  oraBalance: 2450.75,
  usdcBalance: 1280.50,
  totalEarnings: 34560.00,
  monthlyEarnings: 4230.50,
  weeklyEarnings: 1120.25,
  subscriberCount: 847,
  earningsHistory: [
    { date: 'Mon', amount: 145 },
    { date: 'Tue', amount: 230 },
    { date: 'Wed', amount: 180 },
    { date: 'Thu', amount: 310 },
    { date: 'Fri', amount: 420 },
    { date: 'Sat', amount: 380 },
    { date: 'Sun', amount: 275 },
    { date: 'Mon', amount: 195 },
    { date: 'Tue', amount: 340 },
    { date: 'Wed', amount: 290 },
    { date: 'Thu', amount: 410 },
    { date: 'Fri', amount: 520 },
    { date: 'Sat', amount: 480 },
    { date: 'Sun', amount: 355 },
  ],
  recentTransactions: [
    { id: 'tx1', type: 'subscription', amount: 15, currency: 'ORA', from: 'user_abc', to: 'you', timestamp: '2h ago', description: 'Silver tier subscription' },
    { id: 'tx2', type: 'tip', amount: 25, currency: 'ORA', from: 'patron_vip', to: 'you', timestamp: '3h ago', description: 'Tip on live stream' },
    { id: 'tx3', type: 'ppv', amount: 10, currency: 'ORA', from: 'fan_42', to: 'you', timestamp: '5h ago', description: 'PPV content unlock' },
    { id: 'tx4', type: 'tip', amount: 100, currency: 'ORA', from: 'crypto_whale', to: 'you', timestamp: '6h ago', description: 'Super tip!' },
    { id: 'tx5', type: 'subscription', amount: 30, currency: 'ORA', from: 'user_xyz', to: 'you', timestamp: '8h ago', description: 'Gold tier subscription' },
    { id: 'tx6', type: 'withdrawal', amount: 500, currency: 'USDC', from: 'you', to: 'wallet_ext', timestamp: '1d ago', description: 'Withdrawal to external wallet' },
    { id: 'tx7', type: 'subscription', amount: 5, currency: 'ORA', from: 'user_new', to: 'you', timestamp: '1d ago', description: 'Bronze tier subscription' },
    { id: 'tx8', type: 'ppv', amount: 8, currency: 'ORA', from: 'fan_99', to: 'you', timestamp: '2d ago', description: 'PPV video unlock' },
  ],
};

// ─── User Profile ────────────────────────────────────────────────
export const currentUser = {
  id: 'me',
  username: 'aurora_dreamer',
  displayName: 'Aurora Dreamer',
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop",
  email: 'aurora@example.com',
  oraBalance: 2450.75,
  isCreator: true,
  subscribedTo: ['c1', 'c3'],
  kycVerified: true,
  joinedDate: 'Jan 2025',
};