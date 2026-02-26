# @aura-protocol/sdk

TypeScript SDK for interacting with AURA Protocol on Solana.

## Installation

```bash
npm install @aura-protocol/sdk
# or
yarn add @aura-protocol/sdk
```

## Quick Start

```typescript
import { AuraClient, ContentType, LicenseType } from '@aura-protocol/sdk';
import { useWallet } from '@solana/wallet-adapter-react';

// Initialize the client
const aura = new AuraClient({
  network: 'mainnet',
  wallet: phantomWallet,
});

// Publish content
const result = await aura.content.publish({
  arweaveTxId: 'xxx...',
  contentType: ContentType.Image,
  license: LicenseType.CCBY,
  price: 0,
});

// Follow a creator
await aura.social.follow(creatorAddress);

// Buy creator coins
await aura.creatorCoin.buy({
  creatorAddress: creatorAddress,
  amount: 100,
});

// Curate content (like + record discovery time)
await aura.curation.curate({ contentId: contentAddress });

// Get reputation
const reputation = await aura.reputation.get(userAddress);
```

## Features

### Content Module

- `publish()` - Publish content to AURA Protocol
- `getLicense()` - Get content license information
- `getPost()` - Get post details

### Social Module

- `follow()` - Follow a creator
- `unfollow()` - Unfollow a creator
- `getUserProfile()` - Get user profile
- `like()` - Like a post

### Creator Coin Module

- `buy()` - Buy creator coins
- `sell()` - Sell creator coins
- `getCreatorCoin()` - Get creator coin information
- `calculateBuyPrice()` - Calculate buy price
- `calculateSellPrice()` - Calculate sell price

### Curation Module

- `curate()` - Curate content (like + record discovery time)
- `claimReward()` - Claim curation rewards
- `getCurationRecord()` - Get curation record
- `getCurationPool()` - Get curation pool
- `calculatePotentialReward()` - Calculate potential reward

### Reputation Module

- `get()` - Get reputation SBT
- `getStats()` - Get reputation stats summary
- `hasReputation()` - Check if user has reputation SBT

## Network Configuration

The SDK supports multiple networks:

- `mainnet` - Solana Mainnet
- `devnet` - Solana Devnet
- `testnet` - Solana Testnet
- `localnet` - Local Solana cluster

You can also provide a custom RPC URL:

```typescript
const aura = new AuraClient({
  network: 'mainnet',
  wallet: phantomWallet,
  rpcUrl: 'https://your-custom-rpc.com',
});
```

## React Integration

```typescript
import { useWallet } from '@solana/wallet-adapter-react';
import { AuraClient } from '@aura-protocol/sdk';

function MyComponent() {
  const wallet = useWallet();
  
  const aura = new AuraClient({
    network: 'mainnet',
    wallet: wallet,
  });
  
  const handlePublish = async () => {
    await aura.content.publish({
      arweaveTxId: 'xxx...',
      contentType: ContentType.Image,
    });
  };
  
  return <button onClick={handlePublish}>Publish</button>;
}
```

## License

MIT
