# AURA Protocol SDK Architecture

## Overview

The AURA Protocol SDK is a TypeScript library that provides a clean, type-safe interface for interacting with AURA Protocol smart contracts on Solana.

## Project Structure

```
sdk/
├── src/
│   ├── index.ts                 # Main entry point
│   ├── client.ts                # AuraClient main class
│   ├── types.ts                 # TypeScript type definitions
│   ├── constants.ts             # Program IDs, RPC endpoints, seeds
│   └── modules/
│       ├── content.ts           # Content publishing and licensing
│       ├── social.ts            # Social interactions (follow, like)
│       ├── creatorCoin.ts       # Creator coin trading
│       ├── curation.ts          # Curation and rewards
│       └── reputation.ts        # Reputation system
├── examples/
│   └── usage.ts                 # Usage examples
├── package.json
├── tsconfig.json
├── README.md
└── ARCHITECTURE.md
```

## Core Components

### 1. AuraClient

The main client class that initializes and manages all modules.

```typescript
const aura = new AuraClient({
  network: 'mainnet',
  wallet: phantomWallet,
});
```

**Features:**
- Network configuration (mainnet, devnet, testnet, localnet)
- Wallet adapter integration
- Connection management
- Module initialization

### 2. Content Module

Handles content publishing and licensing operations.

**Methods:**
- `publish()` - Publish content with Arweave TX ID
- `getLicense()` - Get content license information
- `getPost()` - Get post details

**Interaction with:**
- Core Program (`CoreProgram11111111111111111111111111111111`)
- User Profile PDA
- Post PDA

### 3. Social Module

Manages social interactions and user profiles.

**Methods:**
- `follow()` - Follow a creator
- `unfollow()` - Unfollow a creator
- `getUserProfile()` - Get user profile
- `like()` - Like a post

**PDAs Used:**
- User Profile: `["user", userPublicKey]`

### 4. Creator Coin Module

Handles creator coin creation, buying, and selling using bonding curves.

**Methods:**
- `buy()` - Buy creator coins
- `sell()` - Sell creator coins
- `getCreatorCoin()` - Get coin information
- `calculateBuyPrice()` - Calculate buy price
- `calculateSellPrice()` - Calculate sell price

**PDAs Used:**
- Creator Coin: `["creator_coin", creatorPublicKey]`
- Creator Coin Mint: `["creator_coin_mint", creatorPublicKey]`
- Reserve Vault: `["reserve_vault", creatorPublicKey]`

**Bonding Curve:**
Price = k * Supply^n

### 5. Curation Module

Implements curation mining with time-decay weighting.

**Methods:**
- `curate()` - Curate content (like + record discovery time)
- `claimReward()` - Claim curation rewards
- `getCurationRecord()` - Get user's curation record
- `getCurationPool()` - Get pool information
- `calculatePotentialReward()` - Calculate potential reward

**Time Decay Weights:**
- First hour: 10x
- 1-6 hours: 5x
- 6-24 hours: 2x
- 24-72 hours: 1x
- After 72 hours: 0.1x

**PDAs Used:**
- Curation Pool: `["curation_pool", contentId]`
- Curation Record: `["curation_record", contentId, curatorPublicKey]`

### 6. Reputation Module

Manages on-chain reputation SBTs (Soulbound Tokens).

**Methods:**
- `get()` - Get reputation SBT
- `getStats()` - Get reputation stats summary
- `hasReputation()` - Check if user has reputation
- `calculateTier()` - Calculate reputation tier
- `getTierName()` - Get tier name

**Reputation Tiers:**
- Bronze (0-99 score)
- Silver (100-999)
- Gold (1000-4999)
- Platinum (5000-9999)
- Diamond (10000+)

## Type System

### Key Types

```typescript
// Client configuration
interface AuraClientConfig {
  network: 'mainnet' | 'devnet' | 'testnet' | 'localnet';
  wallet: WalletAdapter;
  rpcUrl?: string;
}

// Content types
enum ContentType {
  Text, Image, Video, Audio, Mixed
}

enum LicenseType {
  CC0, CCBY, PayToEmbed, PayToRemix, Exclusive
}

// Creator coin types
enum CurveType {
  Linear, Quadratic, Cubic
}

// Transaction result
interface TransactionResult {
  signature: string;
  success: boolean;
  error?: string;
}
```

## PDA Derivation

All Program Derived Addresses (PDAs) follow consistent patterns:

```typescript
// User Profile
[Buffer.from("user"), userPublicKey.toBuffer()]

// Post
[Buffer.from("post"), authorPublicKey.toBuffer(), postCountBytes]

// Creator Coin
[Buffer.from("creator_coin"), creatorPublicKey.toBuffer()]

// Curation Record
[Buffer.from("curation_record"), contentId.toBuffer(), curatorPublicKey.toBuffer()]

// Reputation SBT
[Buffer.from("reputation_sbt"), userPublicKey.toBuffer()]
```

## Program IDs

The SDK interacts with multiple on-chain programs:

- **Core Program**: User profiles, posts, social graph
- **Creator Coin Program**: Creator coin creation and trading
- **Curation Program**: Curation records and reward pools
- **Governance Program**: DAO governance (future)
- **Market Program**: NFT marketplace (future)
- **Vault Program**: Payment escrow

## Error Handling

All transaction methods return a `TransactionResult`:

```typescript
const result = await aura.content.publish({...});
if (result.success) {
  console.log('Success:', result.signature);
} else {
  console.error('Error:', result.error);
}
```

## Network Support

| Network | RPC Endpoint | Usage |
|---------|--------------|-------|
| Mainnet | `https://api.mainnet-beta.solana.com` | Production |
| Devnet | `https://api.devnet.solana.com` | Development |
| Testnet | `https://api.testnet.solana.com` | Testing |
| Localnet | `http://localhost:8899` | Local development |

## Integration with Wallet Adapters

The SDK is designed to work with Solana Wallet Adapter:

```typescript
import { useWallet } from '@solana/wallet-adapter-react';

function App() {
  const wallet = useWallet();
  
  const aura = new AuraClient({
    network: 'mainnet',
    wallet: wallet,
  });
  
  // Use SDK methods...
}
```

## Building and Publishing

```bash
# Build
npm run build

# Generates:
# - dist/index.js (CommonJS)
# - dist/index.d.ts (TypeScript definitions)
# - dist/index.d.ts.map (Source maps)
```

## Future Enhancements

1. **GraphQL Integration**: Add GraphQL client for querying indexed data
2. **Event Subscriptions**: WebSocket support for real-time updates
3. **Batch Operations**: Support for batched transactions
4. **Account Caching**: Cache frequently accessed accounts
5. **Retry Logic**: Automatic retry for failed transactions
6. **Gas Optimization**: Transaction size optimization
7. **Mobile Support**: React Native compatibility

## References

- [Solana Web3.js Documentation](https://solana-labs.github.io/solana-web3.js/)
- [Anchor Framework](https://www.anchor-lang.com/)
- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter)
- [AURA Protocol Whitepaper](../docs/AURA_Web3升级方案_v1.md)
