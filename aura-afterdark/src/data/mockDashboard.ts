import { DashboardStats, CreatorCoinStats, ContentPerformance, TopPatron } from '@/types/dashboard';

export const mockDashboardStats: DashboardStats = {
  totalEarnings: 34560.00,
  monthlyEarnings: 4230.50,
  weeklyChange: 12.5,
  subscriberCount: 1247,
  subscriberChange: 8.2,
};

export const mockCreatorCoinStats: CreatorCoinStats = {
  symbol: 'LUNA',
  price: 0.42,
  priceChange: 5.8,
  holders: 1547,
  volume24h: 12450.75,
  marketCap: 650000,
};

export const mockContentPerformance: ContentPerformance[] = [
  {
    id: 'p1',
    title: 'New artwork just dropped!',
    thumbnail: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&h=800&fit=crop',
    views: 12400,
    earnings: 543.20,
    curationSignals: 89,
  },
  {
    id: 'p3',
    title: 'Behind-the-scenes gallery',
    thumbnail: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&h=800&fit=crop',
    views: 8900,
    earnings: 432.15,
    curationSignals: 67,
  },
  {
    id: 'p7',
    title: 'Art stream painting requests',
    thumbnail: 'https://images.unsplash.com/photo-1496440737103-cd596325d314?w=600&h=800&fit=crop',
    views: 15600,
    earnings: 712.30,
    curationSignals: 124,
  },
  {
    id: 'p2',
    title: 'Color palette exploration',
    thumbnail: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=800&fit=crop',
    views: 6700,
    earnings: 298.45,
    curationSignals: 45,
  },
  {
    id: 'p5',
    title: 'Creative process video',
    thumbnail: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=600&h=800&fit=crop',
    views: 9200,
    earnings: 389.60,
    curationSignals: 73,
  },
];

export const mockTopPatrons: TopPatron[] = [
  {
    id: 'p1',
    username: 'crypto_whale',
    displayName: 'Crypto Whale',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    totalSpent: 2450.75,
    rank: 1,
  },
  {
    id: 'p2',
    username: 'patron_vip',
    displayName: 'VIP Patron',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop',
    totalSpent: 1890.50,
    rank: 2,
  },
  {
    id: 'p3',
    username: 'art_collector',
    displayName: 'Art Collector',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop',
    totalSpent: 1456.25,
    rank: 3,
  },
  {
    id: 'p4',
    username: 'nightowl_fan',
    displayName: 'Night Owl',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop',
    totalSpent: 1123.80,
    rank: 4,
  },
  {
    id: 'p5',
    username: 'mystery_supporter',
    displayName: 'Mystery Supporter',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop',
    totalSpent: 987.40,
    rank: 5,
  },
];