/**
 * AURA Protocol SDK Usage Examples
 */

import { AuraClient, ContentType, LicenseType, PublicKey } from '../src';

/**
 * Example 1: Initialize the SDK
 */
async function initializeClient(wallet: any) {
  const aura = new AuraClient({
    network: 'devnet',
    wallet: wallet,
  });

  console.log('SDK initialized');
  console.log('Connected:', aura.isConnected);
  console.log('Public Key:', aura.publicKey?.toBase58());
  
  return aura;
}

/**
 * Example 2: Publish Content
 */
async function publishContent(aura: AuraClient) {
  const result = await aura.content.publish({
    arweaveTxId: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    contentType: ContentType.Image,
    license: LicenseType.CCBY,
    price: 0,
    embedPrice: 1000000, // 0.001 SOL in lamports
    remixRoyaltyBps: 3000, // 30%
    commercialAllowed: true,
    derivativesAllowed: true,
    attributionRequired: true,
  });

  if (result.success) {
    console.log('Content published!');
    console.log('Transaction:', result.signature);
  } else {
    console.error('Failed:', result.error);
  }
}

/**
 * Example 3: Social Interactions
 */
async function socialInteractions(aura: AuraClient) {
  const creatorAddress = new PublicKey('...creator-address...');

  // Follow a creator
  const followResult = await aura.social.follow(creatorAddress);
  console.log('Follow result:', followResult.success);

  // Get user profile
  const profile = await aura.social.getUserProfile(creatorAddress);
  if (profile) {
    console.log('Creator:', profile.username);
    console.log('Followers:', profile.followerCount);
    console.log('Posts:', profile.postCount);
  }

  // Like a post
  const postPda = new PublicKey('...post-pda...');
  const likeResult = await aura.social.like(postPda);
  console.log('Like result:', likeResult.success);
}

/**
 * Example 4: Creator Coins
 */
async function creatorCoinOperations(aura: AuraClient) {
  const creatorAddress = new PublicKey('...creator-address...');

  // Get creator coin info
  const coinInfo = await aura.creatorCoin.getCreatorCoin(creatorAddress);
  if (coinInfo) {
    console.log('Symbol:', coinInfo.symbol);
    console.log('Total Supply:', coinInfo.totalSupply);
    console.log('Reserve Balance:', coinInfo.reserveBalance);
  }

  // Calculate buy price
  const buyPrice = await aura.creatorCoin.calculateBuyPrice(creatorAddress, 100);
  console.log('Price for 100 tokens:', buyPrice, 'lamports');

  // Buy creator coins
  const buyResult = await aura.creatorCoin.buy({
    creatorAddress,
    amount: 100,
  });
  console.log('Buy result:', buyResult.success);

  // Sell creator coins
  const sellResult = await aura.creatorCoin.sell({
    creatorAddress,
    amount: 50,
  });
  console.log('Sell result:', sellResult.success);
}

/**
 * Example 5: Curation
 */
async function curationOperations(aura: AuraClient) {
  const contentId = new PublicKey('...content-pda...');

  // Curate content
  const curateResult = await aura.curation.curate({ contentId });
  console.log('Curate result:', curateResult.success);

  // Get curation pool
  const pool = await aura.curation.getCurationPool(contentId);
  if (pool) {
    console.log('Total Pool:', pool.totalPool);
    console.log('Total Weight:', pool.totalWeight);
    console.log('Curators Count:', pool.curatorsCount);
  }

  // Calculate potential reward
  const reward = await aura.curation.calculatePotentialReward(
    contentId,
    aura.publicKey!
  );
  console.log('Potential Reward:', reward, 'lamports');

  // Claim reward
  const claimResult = await aura.curation.claimReward({ contentId });
  console.log('Claim result:', claimResult.success);
}

/**
 * Example 6: Reputation
 */
async function reputationOperations(aura: AuraClient) {
  const userAddress = new PublicKey('...user-address...');

  // Get reputation
  const reputation = await aura.reputation.get(userAddress);
  if (reputation) {
    console.log('Reputation Tier:', reputation.reputationTier);
    console.log('Total Posts:', reputation.totalPosts);
    console.log('Total Earnings:', reputation.totalEarnings);
    console.log('Followers:', reputation.followers);
    console.log('Curation Score:', reputation.curationScore);
    console.log('Verified Skills:', reputation.verifiedSkills);
  }

  // Get stats summary
  const stats = await aura.reputation.getStats(userAddress);
  if (stats) {
    console.log('Stats:', stats);
  }
}

/**
 * Example 7: Complete Workflow
 */
async function completeWorkflow(wallet: any) {
  // 1. Initialize
  const aura = await initializeClient(wallet);

  // 2. Check balance
  const balance = await aura.getBalance();
  console.log('Balance:', balance, 'SOL');

  // 3. Request airdrop if on devnet
  if (aura.network === 'devnet' && balance < 1) {
    await aura.requestAirdrop(2);
    console.log('Airdrop requested');
  }

  // 4. Publish content
  await publishContent(aura);

  // 5. Social interactions
  await socialInteractions(aura);

  // 6. Creator coin operations
  await creatorCoinOperations(aura);

  // 7. Curation
  await curationOperations(aura);

  // 8. Check reputation
  await reputationOperations(aura);

  console.log('Complete workflow finished!');
}

// Export examples
export {
  initializeClient,
  publishContent,
  socialInteractions,
  creatorCoinOperations,
  curationOperations,
  reputationOperations,
  completeWorkflow,
};
