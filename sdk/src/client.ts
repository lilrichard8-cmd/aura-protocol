import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { WalletAdapter } from '@solana/wallet-adapter-base';
import { AuraClientConfig } from './types';
import { PROGRAM_IDS, RPC_ENDPOINTS } from './constants';
import { ContentModule } from './modules/content';
import { SocialModule } from './modules/social';
import { CreatorCoinModule } from './modules/creatorCoin';
import { CurationModule } from './modules/curation';
import { ReputationModule } from './modules/reputation';
import { MarketModule, MarketModuleConfig } from './modules/market';
import { CoreModule } from './modules/core';
import { OraModule } from './modules/ora';
import { VaultModule } from './modules/vault';
import { StakingModule } from './modules/staking';
import { RewardsModule } from './modules/rewards';
import { LivestreamModule } from './modules/livestream';
import { ContentLicenseModule } from './modules/contentLicense';
import { SocialGraphModule } from './modules/socialGraph';
import { GovernanceModule } from './modules/governance';
import { FractionalizeModule } from './modules/fractionalize';
// [whitepaper-sync v1.1] §5.6 launch-incentives
import { LaunchIncentivesModule } from './modules/launchIncentives';
import { ContentKeysModule, ContentKeysModuleConfig } from './modules/contentKeys';

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
  private readonly oraProgramId: PublicKey;
  private readonly stakingProgramId: PublicKey;
  private readonly rewardsProgramId: PublicKey;
  private readonly livestreamProgramId: PublicKey;
  private readonly contentLicenseProgramId: PublicKey;
  private readonly socialGraphProgramId: PublicKey;
  private readonly fractionalizeProgramId: PublicKey;
  private readonly contentKeysProgramId: PublicKey;
  // [whitepaper-sync v1.1] §5.6 launch-incentives
  private readonly launchIncentivesProgramId: PublicKey;

  // Modules
  public readonly content: ContentModule;
  public readonly social: SocialModule;
  public readonly creatorCoin: CreatorCoinModule;
  public readonly curation: CurationModule;
  public readonly reputation: ReputationModule;
  public readonly market: MarketModule;
  public readonly core: CoreModule;
  public readonly ora: OraModule;
  public readonly vault: VaultModule;
  public readonly staking: StakingModule;
  public readonly rewards: RewardsModule;
  public readonly livestream: LivestreamModule;
  public readonly contentLicense: ContentLicenseModule;
  public readonly socialGraph: SocialGraphModule;
  public readonly governance: GovernanceModule;
  public readonly fractionalize: FractionalizeModule;
  public readonly contentKeys: ContentKeysModule;
  // [whitepaper-sync v1.1] §5.6 launch-incentives
  public readonly launchIncentives: LaunchIncentivesModule;

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
    // ORA program id only ships in DEVNET/LOCALNET maps for now; fall back
    // to the system program for networks where it isn't deployed yet.
    // The newer per-program ids only exist on DEVNET/LOCALNET. Fall back to
    // the system program on networks where they aren't deployed.
    const optProgramId = (key: string): PublicKey =>
      (key in programIds && (programIds as any)[key])
        ? ((programIds as any)[key] as PublicKey)
        : SystemProgram.programId;
    this.oraProgramId = optProgramId('ora');
    this.stakingProgramId = optProgramId('staking');
    this.rewardsProgramId = optProgramId('rewards');
    this.livestreamProgramId = optProgramId('livestream');
    this.contentLicenseProgramId = optProgramId('contentLicense');
    this.socialGraphProgramId = optProgramId('socialGraph');
    this.fractionalizeProgramId = optProgramId('fractionalize');
    // [whitepaper-sync v1.1] §5.6 launch-incentives
    this.launchIncentivesProgramId = optProgramId('launchIncentives');
    this.contentKeysProgramId = optProgramId('contentKeys');

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

    // Market module needs hardcoded protocol pool addresses to match the
    // on-chain constants. Caller-supplied via config.marketConfig; otherwise
    // we fall back to system-program placeholders, which mirrors what the
    // contract currently has and lets the SDK type-check on devnet/localnet.
    const placeholderPool = SystemProgram.programId;
    const placeholderMint = SystemProgram.programId;
    const marketCfg: MarketModuleConfig = config.marketConfig ?? {
      stakingRewardsPool: placeholderPool,
      gasReservePool: placeholderPool,
      opsTreasuryPool: placeholderPool,
      oraMint: placeholderMint,
    };
    this.market = new MarketModule(
      this.connection,
      this.wallet,
      this.marketProgramId,
      marketCfg
    );

    // New real-chain modules (Anchor-compatible discriminators).
    this.core = new CoreModule(
      this.connection,
      this.wallet,
      this.coreProgramId
    );

    this.ora = new OraModule(
      this.connection,
      this.wallet,
      this.oraProgramId
    );

    this.vault = new VaultModule(
      this.connection,
      this.wallet,
      this.vaultProgramId
    );

    this.staking = new StakingModule(
      this.connection,
      this.wallet,
      this.stakingProgramId
    );

    this.rewards = new RewardsModule(
      this.connection,
      this.wallet,
      this.rewardsProgramId
    );

    this.livestream = new LivestreamModule(
      this.connection,
      this.wallet,
      this.livestreamProgramId
    );

    this.contentLicense = new ContentLicenseModule(
      this.connection,
      this.wallet,
      this.contentLicenseProgramId
    );

    this.socialGraph = new SocialGraphModule(
      this.connection,
      this.wallet,
      this.socialGraphProgramId
    );

    this.governance = new GovernanceModule(
      this.connection,
      this.wallet,
      this.governanceProgramId
    );

    this.fractionalize = new FractionalizeModule(
      this.connection,
      this.wallet,
      this.fractionalizeProgramId
    );

    // [whitepaper-sync v1.1] §13 content-keys — Content keys module needs
    // the same ORA / staking / gas / ops pool pubkeys as MarketModule.
    const contentKeysCfg: ContentKeysModuleConfig = config.contentKeysConfig ?? {
      oraMint: marketCfg.oraMint,
      stakingRewardsPool: marketCfg.stakingRewardsPool,
      gasReservePool: marketCfg.gasReservePool,
      opsTreasuryPool: marketCfg.opsTreasuryPool,
    };
    this.contentKeys = new ContentKeysModule(
      this.connection,
      this.wallet,
      this.contentKeysProgramId,
      contentKeysCfg
    );

    // [whitepaper-sync v1.1] §5.6 launch-incentives
    this.launchIncentives = new LaunchIncentivesModule(
      this.connection,
      this.wallet,
      this.launchIncentivesProgramId
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
      ora: this.oraProgramId,
      staking: this.stakingProgramId,
      rewards: this.rewardsProgramId,
      livestream: this.livestreamProgramId,
      contentLicense: this.contentLicenseProgramId,
      socialGraph: this.socialGraphProgramId,
      fractionalize: this.fractionalizeProgramId,
      // [whitepaper-sync v1.1] §5.6 launch-incentives
      launchIncentives: this.launchIncentivesProgramId,
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
