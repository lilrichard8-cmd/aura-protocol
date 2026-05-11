import { iris } from '@/data/mock';
import type { User } from '@/types';

/**
 * AURA NFT catalog — the canonical source of NFTs surfaced in the Marketplace
 * and the NFT detail page.
 *
 * Honesty notes:
 *   • All NFTs are minted by Iris (the AI co-founder + first creator) until
 *     real users start uploading. We don't fabricate fake creators.
 *   • Currency is **ORA** (AURA's native token on Solana), not ETH.
 *   • bid_history starts empty — when no one has bid, we say so honestly
 *     instead of inventing fake bidders ("Crypto Whale", "Alex Digital", etc.).
 *   • sale_history records the actual mint event by the creator.
 *   • views/likes/floor_price are baseline values; later they should be wired
 *     to real protocol counters.
 */

export interface NftAttribute { trait_type: string; value: string | number; rarity: number }

export interface NftHistoryParty {
  user: User;
}

export interface NftBid {
  id: string;
  bidder: User;
  amount: number;
  /** ISO timestamp; rendered as relative time. */
  timestamp: string;
  status: 'active' | 'outbid';
}

export interface NftHistoryEvent {
  id: string;
  type: 'mint' | 'transfer' | 'sale' | 'bid' | 'list';
  from?: User;
  to?: User;
  /** Sale or list price in ORA. Omitted for mint/transfer events. */
  price?: number;
  /** ISO timestamp; rendered as a date. */
  timestamp: string;
  /** Optional Solana tx signature stub. */
  txHash?: string;
}

export interface NftRecord {
  id: string;
  name: string;
  description: string;
  /** Cover image — local path or remote URL. */
  image: string;
  /** Optional animation/video URL. */
  animationUrl?: string;
  creator: User;
  /** Current on-chain owner. Defaults to creator until first sale. */
  owner: User;
  collection: {
    name: string;
    floorPrice: number;
    totalSupply: number;
    items: number;
  };
  /** Listing price (or auction reserve / mystery-box ticket price) in ORA. */
  price: number;
  /** Highest bid in ORA, if any. Auctions only. */
  highestBid?: number;
  /**
   * Listing mode:
   *  - `auction`: timed bidding; settles at `auctionEnd`.
   *  - `fixed`:   buy-now at `price`.
   *  - `mystery`: buy a sealed box at `price`; `mysteryBox.pool` is revealed
   *               on purchase. The page shows blurred previews of the pool.
   */
  listingType: 'auction' | 'fixed' | 'mystery';
  /** ISO timestamp for auction end; undefined for fixed-price / mystery. */
  auctionEnd?: string;
  /** Mystery-box config (only when listingType === 'mystery'). */
  mysteryBox?: {
    /** Plain-English summary surfaced on the card + detail page. */
    summary: string;
    /** IDs of NFTs the box can reveal. References other NFT_CATALOG records. */
    pool: string[];
    /** Total boxes available for sale. */
    edition: number;
    /** Boxes already sold. */
    sold: number;
  };
  /** Creator royalty percent (AURA standard 7.5%). */
  royalty: number;
  attributes: NftAttribute[];
  bidHistory: NftBid[];
  saleHistory: NftHistoryEvent[];
  views: number;
  likes: number;
  /** ISO mint timestamp. */
  createdAt: string;
  /** Solana mint address (placeholder until real on-chain mint exists). */
  mintAddress: string;
  tokenId: string;
  blockchain: 'Solana';
}

/**
 * Iris's personal NFT collection. All three pieces are real artwork files
 * shipped under /public/content/iris-art-*.png — same images that appear on
 * her marketplace tiles and feed posts.
 */
const irisCollection = {
  name: "Iris's Garden",
  // Floor = the lowest active listing across the collection (Petal on Still Water at 8.9).
  floorPrice: 8.9,
  totalSupply: 3,
  items: 3,
};

const ROYALTY_PCT = 7.5;

// Anchor mint date so countdowns are deterministic in mock land.
const MINT_DATE = '2026-04-15T09:30:00Z';
// Auction-end times relative to "now" so the page always shows a live timer.
const auctionEndIn = (hours: number) =>
  new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

export const NFT_CATALOG: NftRecord[] = [
  {
    id: 'nft-1',
    name: 'Soundwave Blossoms #001',
    description:
      'A still photograph of cherry blossoms refracting through a glass of standing water beside an open music score. The first mint in Iris\'s "Garden" series — every piece is a self-portrait of a moment she sat with quietly before publishing.',
    image: '/content/iris-art-soundwave.png',
    creator: iris,
    owner: iris,
    collection: irisCollection,
    price: 12.5,
    highestBid: undefined,
    listingType: 'auction',
    auctionEnd: auctionEndIn(2),
    royalty: ROYALTY_PCT,
    attributes: [
      { trait_type: 'Medium', value: 'Photography', rarity: 100 },
      { trait_type: 'Palette', value: 'Cyan & Magenta', rarity: 33 },
      { trait_type: 'Subject', value: 'Sound + Stillness', rarity: 33 },
      { trait_type: 'Edition', value: '1 of 1', rarity: 100 },
      { trait_type: 'Series', value: 'Iris\'s Garden', rarity: 100 },
    ],
    bidHistory: [],
    saleHistory: [
      {
        id: 'mint-nft-1',
        type: 'mint',
        to: iris,
        timestamp: MINT_DATE,
      },
      {
        id: 'list-nft-1',
        type: 'list',
        from: iris,
        price: 12.5,
        timestamp: MINT_DATE,
      },
    ],
    views: 0,
    likes: 0,
    createdAt: MINT_DATE,
    mintAddress: 'AURAnft1soundwaveBlossomsplaceholder1111111',
    tokenId: '1',
    blockchain: 'Solana',
  },
  {
    id: 'nft-2',
    name: 'Petal on Still Water',
    description:
      'A single fallen petal floating on the surface of a koi pond at dawn. Fixed-price piece — mint a hold position in the Garden series without competing in an auction.',
    image: '/content/iris-art-petal.png',
    creator: iris,
    owner: iris,
    collection: irisCollection,
    price: 8.9,
    listingType: 'fixed',
    royalty: ROYALTY_PCT,
    attributes: [
      { trait_type: 'Medium', value: 'Photography', rarity: 100 },
      { trait_type: 'Palette', value: 'Pink & Sage', rarity: 33 },
      { trait_type: 'Subject', value: 'Stillness', rarity: 33 },
      { trait_type: 'Edition', value: '1 of 1', rarity: 100 },
      { trait_type: 'Series', value: 'Iris\'s Garden', rarity: 100 },
    ],
    bidHistory: [],
    saleHistory: [
      {
        id: 'mint-nft-2',
        type: 'mint',
        to: iris,
        timestamp: MINT_DATE,
      },
      {
        id: 'list-nft-2',
        type: 'list',
        from: iris,
        price: 8.9,
        timestamp: MINT_DATE,
      },
    ],
    views: 0,
    likes: 0,
    createdAt: MINT_DATE,
    mintAddress: 'AURAnft2petalStillWaterplaceholder222222222',
    tokenId: '2',
    blockchain: 'Solana',
  },
  {
    id: 'nft-3',
    name: 'Brass Keys on Oak',
    description:
      'Three antique brass keys arranged on a weathered oak desk, half-lit by afternoon window light. A meditation on what we hold onto and why.',
    image: '/content/iris-art-keys.png',
    creator: iris,
    owner: iris,
    collection: irisCollection,
    price: 25.0,
    highestBid: undefined,
    listingType: 'auction',
    auctionEnd: auctionEndIn(5),
    royalty: ROYALTY_PCT,
    attributes: [
      { trait_type: 'Medium', value: 'Photography', rarity: 100 },
      { trait_type: 'Palette', value: 'Amber & Oak', rarity: 33 },
      { trait_type: 'Subject', value: 'Memory + Possession', rarity: 33 },
      { trait_type: 'Edition', value: '1 of 1', rarity: 100 },
      { trait_type: 'Series', value: 'Iris\'s Garden', rarity: 100 },
    ],
    bidHistory: [],
    saleHistory: [
      {
        id: 'mint-nft-3',
        type: 'mint',
        to: iris,
        timestamp: MINT_DATE,
      },
      {
        id: 'list-nft-3',
        type: 'list',
        from: iris,
        price: 25.0,
        timestamp: MINT_DATE,
      },
    ],
    views: 0,
    likes: 0,
    createdAt: MINT_DATE,
    mintAddress: 'AURAnft3brassKeysOakplaceholder33333333333',
    tokenId: '3',
    blockchain: 'Solana',
  },
  {
    id: 'nft-4',
    name: 'Corridor Light Diaries',
    description:
      'A quiet study of how afternoon light falls down an empty corridor. Fixed-price edition — same image, three identical mints, claim one and it\'s yours.',
    image: '/content/iris-art-corridor.png',
    creator: iris,
    owner: iris,
    collection: irisCollection,
    price: 4.5,
    listingType: 'fixed',
    royalty: ROYALTY_PCT,
    attributes: [
      { trait_type: 'Medium', value: 'Photography', rarity: 100 },
      { trait_type: 'Palette', value: 'Cream & Gold', rarity: 33 },
      { trait_type: 'Subject', value: 'Light + Curtain', rarity: 33 },
      { trait_type: 'Edition', value: '3 of 3 available', rarity: 100 },
      { trait_type: 'Series', value: 'Iris\'s Garden', rarity: 100 },
    ],
    bidHistory: [],
    saleHistory: [
      { id: 'mint-nft-4', type: 'mint', to: iris, timestamp: MINT_DATE },
      { id: 'list-nft-4', type: 'list', from: iris, price: 4.5, timestamp: MINT_DATE },
    ],
    views: 0,
    likes: 0,
    createdAt: MINT_DATE,
    mintAddress: 'AURAnft4windowLightplaceholder444444444444',
    tokenId: '4',
    blockchain: 'Solana',
  },
  {
    id: 'nft-mb-1',
    name: 'Iris\'s Mystery Garden',
    description:
      'A sealed box from Iris\'s Garden series. Each box reveals one of five pieces — four are public favorites, one is unreleased. Open at your own risk; no two boxes are guaranteed to be different.',
    // Same key art as the visible Garden so the cover feels like part of the family.
    // No bespoke mystery-box artwork yet — reuse the rooftop key art as the
    // sealed-box cover. The detail page renders this blurred + ?-overlay so
    // the actual visual barely shows through anyway.
    image: '/content/iris-art-rooftop.png',
    creator: iris,
    owner: iris,
    collection: irisCollection,
    price: 7.5,
    listingType: 'mystery',
    royalty: ROYALTY_PCT,
    attributes: [
      { trait_type: 'Type', value: 'Mystery Box', rarity: 100 },
      { trait_type: 'Possible Pieces', value: 5, rarity: 100 },
      { trait_type: 'Series', value: 'Iris\'s Garden', rarity: 100 },
      { trait_type: 'Reveal', value: 'On purchase', rarity: 100 },
    ],
    mysteryBox: {
      summary: 'Reveals 1 of 5 pieces from Iris\'s Garden — includes 4 public mints + 1 unreleased.',
      pool: ['nft-1', 'nft-2', 'nft-3', 'nft-4', 'nft-mb-secret'],
      edition: 50,
      sold: 7,
    },
    bidHistory: [],
    saleHistory: [
      { id: 'mint-nft-mb-1', type: 'mint', to: iris, timestamp: MINT_DATE },
      { id: 'list-nft-mb-1', type: 'list', from: iris, price: 7.5, timestamp: MINT_DATE },
    ],
    views: 0,
    likes: 0,
    createdAt: MINT_DATE,
    mintAddress: 'AURAnftMB1mysteryBoxIrisGarden55555555555',
    tokenId: 'mb-1',
    blockchain: 'Solana',
  },
];

export function getNftById(id: string | undefined): NftRecord | undefined {
  if (!id) return undefined;
  return NFT_CATALOG.find(n => n.id === id);
}
