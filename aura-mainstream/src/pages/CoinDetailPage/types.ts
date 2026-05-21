// CoinDetailPage local types — extracted 2026-05-20 P-1 split.
export interface PricePoint {
  time: string;
  price: number;
  volume: number;
}

export interface Holder {
  id: string;
  name: string;
  avatar: string;
  username: string;
  amount: number;
  percentage: number;
}

export interface Transaction {
  id: string;
  type: 'buy' | 'sell';
  user: {
    name: string;
    avatar: string;
    username: string;
  };
  amount: number;
  price: number;
  total: number;
  time: string;
}

export interface CreatorContent {
  id: string;
  title: string;
  thumbnail: string;
  type: 'photo' | 'video';
  likes: number;
  createdAt: string;
}

export interface CoinData {
  id: string;
  name: string;
  symbol: string;
  creator: {
    name: string;
    avatar: string;
    username: string;
    followers: number;
    bio: string;
  };
  currentPrice: number;
  change24h: number;
  circulating: number;
  totalSupply: number;
  volume24h: number;
  holders: Holder[];
  transactions: Transaction[];
  recentContent: CreatorContent[];
  priceHistory: PricePoint[];
}
