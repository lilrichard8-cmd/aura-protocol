import { PublicKey } from '@solana/web3.js';

/**
 * AURA Protocol Program IDs
 */
export const PROGRAM_IDS = {
  MAINNET: {
    core: new PublicKey('CoreProgram11111111111111111111111111111111'),
    creatorCoin: new PublicKey('CreatorCoinProgram11111111111111111111111111'),
    curation: new PublicKey('CurationProgram111111111111111111111111111111'),
    governance: new PublicKey('GovernanceProgram1111111111111111111111111111'),
    market: new PublicKey('MarketProgram111111111111111111111111111111111'),
    vault: new PublicKey('VaultProgram1111111111111111111111111111111111'),
  },
  DEVNET: {
    // Real on-chain program ids from programs/*/src/lib.rs declare_id!().
    core: new PublicKey('Ho5Ent8c2D6eLAZuyW16iUekqMmpfqzoTspXbMQqa9JN'),
    creatorCoin: new PublicKey('B38n2DX7BR4tEait7Pn3SHUwB29WQt4U8jttCQgJZ57w'),
    curation: new PublicKey('D1FvbNBVZRvjJYVHNSHZKE653PWCNjb2cfEjNgNxYvc8'),
    governance: new PublicKey('7Un16eWXCteD3PgjpYWggCjuQK2tneHDkwGXvUg5obBk'),
    market: new PublicKey('5BTekjKRiY8pXqEr7eQsqhRFynN27CxfYnh1d5q27cLV'),
    vault: new PublicKey('9sefu7Jr4kAdASSro3AHpTp7XVcShveDntZWvPeJczNL'),
    ora: new PublicKey('Dq6fFo2yjSuiGPhc1hwDocKhEpsSam2X8PbzbhVzTHxN'),
    staking: new PublicKey('6h1sZi8cG3WNB2r9FqTkgoMLBBUPZWbyWPQ3mRsSPyAv'),
    rewards: new PublicKey('Bfwu9gQFyYsaURqDSVYwsfB5VXwGgbTHbSgrzEhNtbuR'),
    livestream: new PublicKey('Bhni5CRZwqPGS9PhvUQtnKFpDs1vjZ4ckYaFayfNQeqH'),
    fractionalize: new PublicKey('3AQUkL1ayeJPHS2kYRRpsrACmrXmhKDYjhLsvwGUaw1S'),
    contentLicense: new PublicKey('9PK5h7iiAM87nSxRC8R9u8K8gJAEANiNNKD7AuhbWuwE'),
    reputation: new PublicKey('GoBjYZJngPdQe2wEgzu4bE74PPDFa8XGKqVadFuM8pEg'),
    socialGraph: new PublicKey('GxvZT4AX7FUCv6HJTVFYPaFciH4ktsDVmXTgGjTZFnUN'),
    typeB: new PublicKey('2Y6gMW2CRePALFRfJ4RCBTtQmJb2YHt4B5b9cHgDt9Kw'),
  },
  TESTNET: {
    core: new PublicKey('CoreProgram11111111111111111111111111111111'),
    creatorCoin: new PublicKey('CreatorCoinProgram11111111111111111111111111'),
    curation: new PublicKey('CurationProgram111111111111111111111111111111'),
    governance: new PublicKey('GovernanceProgram1111111111111111111111111111'),
    market: new PublicKey('MarketProgram111111111111111111111111111111111'),
    vault: new PublicKey('VaultProgram1111111111111111111111111111111111'),
  },
  LOCALNET: {
    core: new PublicKey('Ho5Ent8c2D6eLAZuyW16iUekqMmpfqzoTspXbMQqa9JN'),
    creatorCoin: new PublicKey('B38n2DX7BR4tEait7Pn3SHUwB29WQt4U8jttCQgJZ57w'),
    curation: new PublicKey('D1FvbNBVZRvjJYVHNSHZKE653PWCNjb2cfEjNgNxYvc8'),
    governance: new PublicKey('7Un16eWXCteD3PgjpYWggCjuQK2tneHDkwGXvUg5obBk'),
    market: new PublicKey('5BTekjKRiY8pXqEr7eQsqhRFynN27CxfYnh1d5q27cLV'),
    vault: new PublicKey('9sefu7Jr4kAdASSro3AHpTp7XVcShveDntZWvPeJczNL'),
    ora: new PublicKey('Dq6fFo2yjSuiGPhc1hwDocKhEpsSam2X8PbzbhVzTHxN'),
    staking: new PublicKey('6h1sZi8cG3WNB2r9FqTkgoMLBBUPZWbyWPQ3mRsSPyAv'),
    rewards: new PublicKey('Bfwu9gQFyYsaURqDSVYwsfB5VXwGgbTHbSgrzEhNtbuR'),
    livestream: new PublicKey('Bhni5CRZwqPGS9PhvUQtnKFpDs1vjZ4ckYaFayfNQeqH'),
    fractionalize: new PublicKey('3AQUkL1ayeJPHS2kYRRpsrACmrXmhKDYjhLsvwGUaw1S'),
    contentLicense: new PublicKey('9PK5h7iiAM87nSxRC8R9u8K8gJAEANiNNKD7AuhbWuwE'),
    reputation: new PublicKey('GoBjYZJngPdQe2wEgzu4bE74PPDFa8XGKqVadFuM8pEg'),
    socialGraph: new PublicKey('GxvZT4AX7FUCv6HJTVFYPaFciH4ktsDVmXTgGjTZFnUN'),
    typeB: new PublicKey('2Y6gMW2CRePALFRfJ4RCBTtQmJb2YHt4B5b9cHgDt9Kw'),
  },
};

/**
 * RPC Endpoints
 */
export const RPC_ENDPOINTS = {
  mainnet: 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
  localnet: 'http://localhost:8899',
};

/**
 * PDA Seeds
 */
export const SEEDS = {
  USER_PROFILE: 'user',
  POST: 'post',
  CREATOR_COIN: 'creator_coin',
  CREATOR_COIN_MINT: 'creator_coin_mint',
  RESERVE_VAULT: 'reserve_vault',
  CURATION_POOL: 'curation_pool',
  CURATION_RECORD: 'curation_record',
  CONTENT_LICENSE: 'content_license',
  REPUTATION_SBT: 'reputation_sbt',
  SOCIAL_GRAPH_NFT: 'social_graph_nft',
};
