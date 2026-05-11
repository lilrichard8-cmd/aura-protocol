export interface DashboardStats {
  totalEarnings: number;
  monthlyEarnings: number;
  weeklyChange: number;
  subscriberCount: number;
  subscriberChange: number;
}

export interface CreatorCoinStats {
  symbol: string;
  price: number;
  priceChange: number;
  holders: number;
  volume24h: number;
  marketCap: number;
}

export interface ContentPerformance {
  id: string;
  title: string;
  thumbnail: string;
  views: number;
  earnings: number;
  curationSignals: number;
}

export interface TopPatron {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  totalSpent: number;
  rank: number;
}