import { Connection, PublicKey } from '@solana/web3.js';
import { WalletAdapter } from '@solana/wallet-adapter-base';
import { AuraClientConfig } from './types';
import { PROGRAM_IDS, RPC_ENDPOINTS } from './constants';
import { ContentModule } from './modules/content';
import { SocialModule } from './modules/social';
import { CreatorCoinModule } from './modules/creatorCoin';
import { CurationModule } from './modules/curation';
import { ReputationModule } from './modules/reputation';

/**
 * Main AURA Protocol SDK Client
 * 
 * @example
 * ```typescript
 * import { AuraClient } from '@aura-protocol/sdk';
 * 
 * const aura = new AuraClient({
 *   network: 'mainnet',
 *   wallet: phantomWallet,
 * });
 * 
 * // Publish content
 * await aura.content.publish({
 *   arweaveTxId: 'xxx...',
 *   contentType: ContentType.Image,
 *   license: LicenseType.CCBY,
 *   price: 0,
 * });
 * 
 * // Follow a creator
 * await aura.social.follow(creatorAddress);
 * 
 * // Buy creator coins
 * await aura.creatorCoin.buy({
 *   creatorAddress: creatorAddress,
 *   amount: 100,
 * });
 * 
 * // Curate content
 * await aura.curation.curate({ contentId: contentAddress });
 * ```
 */
export class AuraClient {
  public readonly connection: Connection;
  public readonly wallet: WalletAdapter;
  public readonly network: 'mainnet' | 'devnet' | 'testnet' | 'localnet';
  
  // Program IDs
  private readonly coreProgramId: PublicKey;
  private readonly creatorCoinProgramId: PublicKey;
  private readonly curationProgramId: PublicKey;
  private readonly governanceProgramId: PublicKey;
  private readonly marketProgramId: PublicKey;
  private readonly vaultProgramId: PublicKey;

  // Modules
  public readonly content: ContentModule;
  public readonly social: SocialModule;
  public readonly creatorCoin: CreatorCoinModule;
  public readonly curation: CurationModule;
  public readonly reputation: ReputationModule;

  /**
   * Create a new AURA Protocol SDK client
   */
  constructor(config: AuraClientConfig) {
    this.network = config.network;
    this.wallet = config.wallet;

    // Initialize connection
    const rpcUrl = config.rpcUrl || RPC_ENDPOINTS[config.network];
    this.connection = new Connection(rpcUrl, 'confirmed');

    // Set program IDs based on network
    const programIds = PROGRAM_IDS[config.network.toUpperCase() as keyof typeof PROGRAM_IDS];
    this.coreProgramId = programIds.core;
    this.creatorCoinProgramId = programIds.creatorCoin;
    this.curationProgramId = programIds.curation;
    this.governanceProgramId = programIds.governance;
    this.marketProgramId = programIds.market;
    this.vaultProgramId = programIds.vault;

    // Initialize modules
    this.content = new ContentModule(
      this.connection,
      this.wallet,
      this.coreProgramId
    );

    this.social = new SocialModule(
      this.connection,
      this.wallet,
      this.coreProgramId
    );

    this.creatorCoin = new CreatorCoinModule(
      this.connection,
      this.wallet,
      this.creatorCoinProgramId
    );

    this.curation = new CurationModule(
      this.connection,
      this.wallet,
      this.curationProgramId
    );

    this.reputation = new ReputationModule(
      this.connection,
      this.wallet,
      this.coreProgramId
    );
  }

  /**
   * Get the current wallet's public key
   */
  get publicKey(): PublicKey | null {
    return this.wallet.publicKey;
  }

  /**
   * Check if wallet is connected
   */
  get isConnected(): boolean {
    return this.wallet.connected && this.wallet.publicKey !== null;
  }

  /**
   * Get program IDs for the current network
   */
  getProgramIds() {
    return {
      core: this.coreProgramId,
      creatorCoin: this.creatorCoinProgramId,
      curation: this.curationProgramId,
      governance: this.governanceProgramId,
      market: this.marketProgramId,
      vault: this.vaultProgramId,
    };
  }

  /**
   * Get the RPC endpoint URL
   */
  getRpcUrl(): string {
    return this.connection.rpcEndpoint;
  }

  /**
   * Get SOL balance for a public key
   */
  async getBalance(publicKey?: PublicKey): Promise<number> {
    const address = publicKey || this.wallet.publicKey;
    if (!address) {
      throw new Error('No public key provided and wallet not connected');
    }
    const balance = await this.connection.getBalance(address);
    return balance / 1e9; // Convert lamports to SOL
  }

  /**
   * Request airdrop (devnet/testnet only)
   */
  async requestAirdrop(amount: number = 1): Promise<string> {
    if (this.network === 'mainnet') {
      throw new Error('Airdrop not available on mainnet');
    }

    if (!this.wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    const signature = await this.connection.requestAirdrop(
      this.wallet.publicKey,
      amount * 1e9
    );
    await this.connection.confirmTransaction(signature);
    return signature;
  }
}
