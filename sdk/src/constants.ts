import { PublicKey } from '@solana/web3.js';

/**
 * AURA Protocol Program IDs
 */
export const PROGRAM_IDS = {
  MAINNET: {
    // [pre-mainnet] placeholders — these must be replaced with real ids before deploy.
    // We use the System Program id as a length-valid placeholder; it always parses.
    core: new PublicKey('11111111111111111111111111111111'),
    creatorCoin: new PublicKey('11111111111111111111111111111111'),
    curation: new PublicKey('11111111111111111111111111111111'),
    governance: new PublicKey('11111111111111111111111111111111'),
    market: new PublicKey('11111111111111111111111111111111'),
    vault: new PublicKey('11111111111111111111111111111111'),
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
    // [whitepaper-sync v1.1] §13 content-keys — placeholder program id; replace pre-mainnet.
    contentKeys: new PublicKey('CX6wqdXrR1C8sz8A7DWJ8fE2utXHivif7j1ie91i8Y3v'),
    // [whitepaper-sync v1.1] §5.6 launch-incentives — placeholder program id; replace pre-mainnet.
    launchIncentives: new PublicKey('GiqNJ5BbaebqvDPGep4QeK6JLNagk5zzW68pykb9eQEf'),
  },
  TESTNET: {
    // [pre-deploy] testnet placeholders — use System Program id (length-valid).
    core: new PublicKey('11111111111111111111111111111111'),
    creatorCoin: new PublicKey('11111111111111111111111111111111'),
    curation: new PublicKey('11111111111111111111111111111111'),
    governance: new PublicKey('11111111111111111111111111111111'),
    market: new PublicKey('11111111111111111111111111111111'),
    vault: new PublicKey('11111111111111111111111111111111'),
  },
  LOCALNET: {
    // [2026-05-19 redeploy] real on-chain program ids on the running test-validator.
    // After `anchor keys sync` + `anchor build --no-idl` + deploy-localnet.sh.
    core: new PublicKey('4VTNh4tcTuF5wDYhP8qbvf5hdUV4xUm7KJVJd9oSweEE'),
    creatorCoin: new PublicKey('DW4BZcwY5c3nQHMGKysmTdXKpFous778RKcbSvw2xNMZ'),
    curation: new PublicKey('DimxL8QLZ5xPrq4igyuZbU52cfL81eVzEoani45Z63h7'),
    governance: new PublicKey('E9RGmKxpRKZ8hX5GnrgBq1aTayY7JGH5kzwBoN5RZxyT'),
    market: new PublicKey('9YgDaCgqqHhztHEr8TDBmX3ffrdHw9nMXt2tZXjBA2sc'),
    vault: new PublicKey('7XdAeorsSoYDhHrJMQHuHKrPVerQvfz8zt18cEW4N3Rz'),
    ora: new PublicKey('BU6sgGN6a8pbzjQasfghumnqG5UEaUSsJ3mWc1gQU2tb'),
    staking: new PublicKey('BU5dKjtXCPqCffJe7GaPR8Eu1pVfgWFLAUFeHcT8ENZA'),
    rewards: new PublicKey('5Zit5jo7zH1ca2TxqJaDckYdsZqfaPAEFWgjS8bnw5AY'),
    livestream: new PublicKey('Bhni5CRZwqPGS9PhvUQtnKFpDs1vjZ4ckYaFayfNQeqH'),
    // [2026-05-19 stack-fix redeploy] fractionalize program redeployed with
    // new keypair (old keypair was lost when target/ was cleaned during the
    // FractionalizeNFT stack-overflow fix).
    fractionalize: new PublicKey('2QPBHcFbYc9UwoS5KBoGRcZ5Db4idyN1GxnbAuBLY38h'),
    contentLicense: new PublicKey('8AmchauzdkEt2ZafZbac9NT8BGwLaL2sVwwQxKbSgis'),
    reputation: new PublicKey('EoTfniRTgWhRD58bjUBSLk1rGR98tzfGZdVZuJXh8es8'),
    socialGraph: new PublicKey('M7AinRcTUSR9Y8paXwE281p24hkUhQSWv7sa9bw1oC4'),
    typeB: new PublicKey('2Y6gMW2CRePALFRfJ4RCBTtQmJb2YHt4B5b9cHgDt9Kw'),
    contentKeys: new PublicKey('HCZyqzGVjmUKfUfztmL4ceeZkw3Pm5spdsBjWQ4yaHqT'),
    launchIncentives: new PublicKey('4ujsepHLzxwbFfX8VbPtxGYxBMnb1WKnQybEgS9gWJHD'),
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
