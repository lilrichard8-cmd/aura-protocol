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
    core: new PublicKey('CoreProgram11111111111111111111111111111111'),
    creatorCoin: new PublicKey('CreatorCoinProgram11111111111111111111111111'),
    curation: new PublicKey('CurationProgram111111111111111111111111111111'),
    governance: new PublicKey('GovernanceProgram1111111111111111111111111111'),
    market: new PublicKey('MarketProgram111111111111111111111111111111111'),
    vault: new PublicKey('VaultProgram1111111111111111111111111111111111'),
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
    core: new PublicKey('CoreProgram11111111111111111111111111111111'),
    creatorCoin: new PublicKey('CreatorCoinProgram11111111111111111111111111'),
    curation: new PublicKey('CurationProgram111111111111111111111111111111'),
    governance: new PublicKey('GovernanceProgram1111111111111111111111111111'),
    market: new PublicKey('MarketProgram111111111111111111111111111111111'),
    vault: new PublicKey('VaultProgram1111111111111111111111111111111111'),
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
