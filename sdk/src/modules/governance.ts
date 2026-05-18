/**
 * GovernanceModule — Governance & arbitration on-chain operations.
 *
 * Wraps `aura_governance` (programs/governance/src/lib.rs + arbitration.rs).
 * Real Anchor discriminators (sha256("global:<name>")[..8]).
 *
 * Two surfaces:
 *   - Classic governance: proposals + voting (initialize_governance,
 *     register_arbiter, create_proposal, vote_on_proposal,
 *     execute_proposal, create_dispute, vote_on_dispute)
 *   - Arbitration (§13.8 two-trial jury system):
 *     init_arbitration_governance, init_arbitrator_registry,
 *     register_as_arbitrator, file_arbitration_dispute,
 *     select_trial1_jury, submit_trial1_ruling, finalize_trial1,
 *     appeal_to_trial2, select_trial2_panel, submit_trial2_ruling,
 *     finalize_dispute, dissolve_panel_for_absence
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import { WalletAdapter } from '@solana/wallet-adapter-base';
import { sha256 } from '@noble/hashes/sha256';

import { TransactionResult } from '../types';

// ────────────────────────────────────────────────────────────────────────
// Constants — must match programs/governance/src/lib.rs + arbitration.rs
// ────────────────────────────────────────────────────────────────────────

export const GOVERNANCE_SEEDS = {
  GOVERNANCE_CONFIG: Buffer.from('governance_config'),
  ARBITER: Buffer.from('arbiter'),
  PROPOSAL: Buffer.from('proposal'),
  VOTE: Buffer.from('vote'),
  DISPUTE: Buffer.from('dispute'),
  DISPUTE_VOTE: Buffer.from('dispute_vote'),
  ARB_GOVERNANCE: Buffer.from('arb-governance'),
  ARB_REGISTRY: Buffer.from('arb-registry'),
  ARB_DISPUTE: Buffer.from('arb-dispute'),
} as const;

export const GOVERNANCE_LIMITS = {
  TITLE_MAX: 100,
  DESCRIPTION_MAX: 5000,
  EVIDENCE_URI_MAX: 200,
  REASONING_URI_MAX: 200,
  MAX_ARBITRATORS: 200,
  TRIAL1_JURY_SIZE: 5,
  TRIAL2_PANEL_SIZE: 7,
  MIN_STAKE_LAMPORTS: 10_000n * 1_000_000_000n,
  MIN_ARS_TRIAL2: 100n,
} as const;

export enum CommitteeType {
  Development = 0,
  Content = 1,
  Operations = 2,
  Arbitration = 3,
  Technical = 4,
}

export enum ProposalType {
  PolicyChange = 0,
  BudgetAllocation = 1,
  PartnershipApproval = 2,
  CodeUpgrade = 3,
  Other = 4,
}

export enum ProposalStatus {
  UnderReview = 0,
  Voting = 1,
  Passed = 2,
  Failed = 3,
  Executed = 4,
}

export enum DisputeType {
  Copyright = 0,
  Scam = 1,
  Harassment = 2,
  Other = 3,
}

export enum OldDisputeStatus {
  UnderReview = 0,
  Guilty = 1,
  Innocent = 2,
}

export enum DisputeStatus {
  Filed = 0,
  Trial1JurySelected = 1,
  Trial1Pending = 2,
  Trial1Concluded = 3,
  Trial2PanelSelected = 4,
  Trial2Pending = 5,
  Resolved = 6,
  Dissolved = 7,
  EarningsAutoReleased = 8,
}

export type Ruling =
  | { kind: 'ReleaseToCreator' }
  | { kind: 'RefundBuyer' }
  | { kind: 'Split'; creatorShareBps: number };

// ────────────────────────────────────────────────────────────────────────
// Anchor discriminator helpers
// ────────────────────────────────────────────────────────────────────────

function ixDiscriminator(name: string): Buffer {
  return Buffer.from(sha256(Buffer.from(`global:${name}`, 'utf8')).slice(0, 8));
}
function accountDiscriminator(name: string): Buffer {
  return Buffer.from(sha256(Buffer.from(`account:${name}`, 'utf8')).slice(0, 8));
}

export const GOVERNANCE_CONFIG_DISC = accountDiscriminator('GovernanceConfig');
export const PROPOSAL_DISC = accountDiscriminator('Proposal');
export const ARBITRATION_GOVERNANCE_DISC = accountDiscriminator('ArbitrationGovernance');
export const ARBITRATOR_REGISTRY_DISC = accountDiscriminator('ArbitratorRegistry');
export const ARBITRATION_DISPUTE_DISC = accountDiscriminator('ArbitrationDispute');

// ────────────────────────────────────────────────────────────────────────
// Borsh primitives
// ────────────────────────────────────────────────────────────────────────

function u8(v: number): Buffer { const b = Buffer.alloc(1); b.writeUInt8(v, 0); return b; }
function u16LE(v: number): Buffer { const b = Buffer.alloc(2); b.writeUInt16LE(v, 0); return b; }
function u32LE(v: number): Buffer { const b = Buffer.alloc(4); b.writeUInt32LE(v, 0); return b; }
function u64LE(v: bigint | number): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(typeof v === 'bigint' ? v : BigInt(v), 0);
  return b;
}
function bool(v: boolean): Buffer { return u8(v ? 1 : 0); }
function borshString(s: string): Buffer {
  const utf8 = Buffer.from(s, 'utf8');
  return Buffer.concat([u32LE(utf8.length), utf8]);
}
function encodeRuling(r: Ruling): Buffer {
  switch (r.kind) {
    case 'ReleaseToCreator': return u8(0);
    case 'RefundBuyer': return u8(1);
    case 'Split': return Buffer.concat([u8(2), u16LE(r.creatorShareBps)]);
  }
}

// ────────────────────────────────────────────────────────────────────────
// PDA helpers
// ────────────────────────────────────────────────────────────────────────

export interface GovernancePdas {
  governanceConfig(): PublicKey;
  arbiter(arbiter: PublicKey): PublicKey;
  proposal(proposer: PublicKey, title: string): PublicKey;
  vote(proposal: PublicKey, voter: PublicKey): PublicKey;
  dispute(plaintiff: PublicKey, targetUser: PublicKey): PublicKey;
  disputeVote(dispute: PublicKey, arbiter: PublicKey): PublicKey;
  arbGovernance(): PublicKey;
  arbRegistry(): PublicKey;
  arbDispute(disputeId: bigint | number): PublicKey;
}

function makePdas(programId: PublicKey): GovernancePdas {
  const findPda = (seeds: Buffer[]) =>
    PublicKey.findProgramAddressSync(seeds, programId)[0];
  return {
    governanceConfig() {
      return findPda([GOVERNANCE_SEEDS.GOVERNANCE_CONFIG]);
    },
    arbiter(a) {
      return findPda([GOVERNANCE_SEEDS.ARBITER, a.toBuffer()]);
    },
    proposal(proposer, title) {
      return findPda([
        GOVERNANCE_SEEDS.PROPOSAL,
        proposer.toBuffer(),
        Buffer.from(title, 'utf8'),
      ]);
    },
    vote(proposal, voter) {
      return findPda([
        GOVERNANCE_SEEDS.VOTE,
        proposal.toBuffer(),
        voter.toBuffer(),
      ]);
    },
    dispute(plaintiff, target) {
      return findPda([
        GOVERNANCE_SEEDS.DISPUTE,
        plaintiff.toBuffer(),
        target.toBuffer(),
      ]);
    },
    disputeVote(dispute, arbiter) {
      return findPda([
        GOVERNANCE_SEEDS.DISPUTE_VOTE,
        dispute.toBuffer(),
        arbiter.toBuffer(),
      ]);
    },
    arbGovernance() {
      return findPda([GOVERNANCE_SEEDS.ARB_GOVERNANCE]);
    },
    arbRegistry() {
      return findPda([GOVERNANCE_SEEDS.ARB_REGISTRY]);
    },
    arbDispute(id) {
      return findPda([GOVERNANCE_SEEDS.ARB_DISPUTE, u64LE(BigInt(id))]);
    },
  };
}

// ────────────────────────────────────────────────────────────────────────
// Public params
// ────────────────────────────────────────────────────────────────────────

export interface InitializeGovernanceParams {
  oraMint: PublicKey;
  quorum: bigint | number;
}

export interface RegisterArbiterParams {
  arbiter: PublicKey;
}

export interface CreateProposalParams {
  title: string;
  description: string;
  committeeType: CommitteeType;
  proposalType: ProposalType;
}

export interface VoteOnProposalParams {
  proposal: PublicKey;
  voteFor: boolean;
  voterOraAccount: PublicKey;
}

export interface ExecuteProposalParams {
  proposal: PublicKey;
}

export interface CreateDisputeParams {
  targetUser: PublicKey;
  evidenceUri: string;
  disputeType: DisputeType;
}

export interface VoteOnDisputeParams {
  dispute: PublicKey;
  voteGuilty: boolean;
}

export interface InitArbitrationGovernanceParams {
  coreTeamMultisig: PublicKey;
}

export interface RegisterAsArbitratorParams {
  userOraAccount: PublicKey;
}

export interface FileArbitrationDisputeParams {
  redemptionId: bigint | number;
  coinMint: PublicKey;
  defendant: PublicKey;
}

export interface DisputeIdParam {
  disputeId: bigint | number;
}

export interface SubmitRulingParams extends DisputeIdParam {
  vote: Ruling;
  reasoningUri: string;
}

// ────────────────────────────────────────────────────────────────────────
// On-chain shapes
// ────────────────────────────────────────────────────────────────────────

export interface GovernanceConfigOnChain {
  admin: PublicKey;
  proposalCount: bigint;
  oraMint: PublicKey;
  quorum: bigint;
  bump: number;
}

// ────────────────────────────────────────────────────────────────────────
// GovernanceModule
// ────────────────────────────────────────────────────────────────────────

export class GovernanceModule {
  public readonly pdas: GovernancePdas;

  constructor(
    private connection: Connection,
    private wallet: WalletAdapter,
    private programId: PublicKey
  ) {
    this.pdas = makePdas(programId);
  }

  // ── Read helpers ─────────────────────────────────────────────────────

  async fetchGovernanceConfig(): Promise<GovernanceConfigOnChain | null> {
    const acc = await this.connection.getAccountInfo(this.pdas.governanceConfig());
    if (!acc) return null;
    return parseGovernanceConfig(acc.data);
  }

  // ── Classic governance ───────────────────────────────────────────────

  async initializeGovernance(params: InitializeGovernanceParams): Promise<TransactionResult> {
    const admin = this.requireWallet();
    const cfg = this.pdas.governanceConfig();
    const data = Buffer.concat([
      ixDiscriminator('initialize_governance'),
      params.oraMint.toBuffer(),
      u64LE(BigInt(params.quorum)),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: cfg, isSigner: false, isWritable: true },
        { pubkey: admin, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async registerArbiter(params: RegisterArbiterParams): Promise<TransactionResult> {
    const admin = this.requireWallet();
    const cfg = this.pdas.governanceConfig();
    const record = this.pdas.arbiter(params.arbiter);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: cfg, isSigner: false, isWritable: false },
        { pubkey: record, isSigner: false, isWritable: true },
        { pubkey: params.arbiter, isSigner: false, isWritable: false },
        { pubkey: admin, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('register_arbiter'),
    });
    return this.sendTx([ix]);
  }

  async createProposal(params: CreateProposalParams): Promise<TransactionResult & { proposal?: PublicKey }> {
    const proposer = this.requireWallet();
    if (params.title.length > GOVERNANCE_LIMITS.TITLE_MAX)
      return errRes(`title exceeds ${GOVERNANCE_LIMITS.TITLE_MAX} chars`);
    if (params.description.length > GOVERNANCE_LIMITS.DESCRIPTION_MAX)
      return errRes(`description exceeds ${GOVERNANCE_LIMITS.DESCRIPTION_MAX} chars`);

    const cfg = this.pdas.governanceConfig();
    const proposalPda = this.pdas.proposal(proposer, params.title);
    const data = Buffer.concat([
      ixDiscriminator('create_proposal'),
      borshString(params.title),
      borshString(params.description),
      u8(params.committeeType),
      u8(params.proposalType),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: cfg, isSigner: false, isWritable: true },
        { pubkey: proposalPda, isSigner: false, isWritable: true },
        { pubkey: proposer, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    const res = await this.sendTx([ix]);
    return { ...res, proposal: proposalPda };
  }

  async voteOnProposal(params: VoteOnProposalParams): Promise<TransactionResult> {
    const voter = this.requireWallet();
    const cfg = this.pdas.governanceConfig();
    const voteRecord = this.pdas.vote(params.proposal, voter);
    const data = Buffer.concat([
      ixDiscriminator('vote_on_proposal'),
      bool(params.voteFor),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: cfg, isSigner: false, isWritable: false },
        { pubkey: params.proposal, isSigner: false, isWritable: true },
        { pubkey: voteRecord, isSigner: false, isWritable: true },
        { pubkey: params.voterOraAccount, isSigner: false, isWritable: false },
        { pubkey: voter, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async executeProposal(params: ExecuteProposalParams): Promise<TransactionResult> {
    const authority = this.requireWallet();
    const cfg = this.pdas.governanceConfig();
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: cfg, isSigner: false, isWritable: false },
        { pubkey: params.proposal, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false },
      ],
      data: ixDiscriminator('execute_proposal'),
    });
    return this.sendTx([ix]);
  }

  async createDispute(params: CreateDisputeParams): Promise<TransactionResult & { dispute?: PublicKey }> {
    const plaintiff = this.requireWallet();
    if (params.evidenceUri.length > GOVERNANCE_LIMITS.EVIDENCE_URI_MAX)
      return errRes(`evidenceUri exceeds ${GOVERNANCE_LIMITS.EVIDENCE_URI_MAX} chars`);
    const disputePda = this.pdas.dispute(plaintiff, params.targetUser);
    const data = Buffer.concat([
      ixDiscriminator('create_dispute'),
      borshString(params.evidenceUri),
      u8(params.disputeType),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: disputePda, isSigner: false, isWritable: true },
        { pubkey: plaintiff, isSigner: true, isWritable: true },
        { pubkey: params.targetUser, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    const res = await this.sendTx([ix]);
    return { ...res, dispute: disputePda };
  }

  async voteOnDispute(params: VoteOnDisputeParams): Promise<TransactionResult> {
    const arbiter = this.requireWallet();
    const record = this.pdas.arbiter(arbiter);
    const voteRecord = this.pdas.disputeVote(params.dispute, arbiter);
    const data = Buffer.concat([
      ixDiscriminator('vote_on_dispute'),
      bool(params.voteGuilty),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: params.dispute, isSigner: false, isWritable: true },
        { pubkey: record, isSigner: false, isWritable: false },
        { pubkey: voteRecord, isSigner: false, isWritable: true },
        { pubkey: arbiter, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  // ── Arbitration (§13.8 two-trial) ────────────────────────────────────

  async initArbitrationGovernance(params: InitArbitrationGovernanceParams): Promise<TransactionResult> {
    const admin = this.requireWallet();
    const arbGov = this.pdas.arbGovernance();
    const data = Buffer.concat([
      ixDiscriminator('init_arbitration_governance'),
      params.coreTeamMultisig.toBuffer(),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: arbGov, isSigner: false, isWritable: true },
        { pubkey: admin, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async initArbitratorRegistry(): Promise<TransactionResult> {
    const admin = this.requireWallet();
    const reg = this.pdas.arbRegistry();
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: reg, isSigner: false, isWritable: true },
        { pubkey: admin, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: ixDiscriminator('init_arbitrator_registry'),
    });
    return this.sendTx([ix]);
  }

  async registerAsArbitrator(params: RegisterAsArbitratorParams): Promise<TransactionResult> {
    const user = this.requireWallet();
    const reg = this.pdas.arbRegistry();
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: reg, isSigner: false, isWritable: true },
        { pubkey: params.userOraAccount, isSigner: false, isWritable: false },
        { pubkey: user, isSigner: true, isWritable: true },
      ],
      data: ixDiscriminator('register_as_arbitrator'),
    });
    return this.sendTx([ix]);
  }

  async fileArbitrationDispute(params: FileArbitrationDisputeParams): Promise<TransactionResult & { arbDispute?: PublicKey }> {
    const plaintiff = this.requireWallet();
    const arbGov = this.pdas.arbGovernance();

    // Need current dispute_count to derive the dispute PDA correctly.
    const gov = await this.connection.getAccountInfo(arbGov);
    if (!gov) return errRes('arbitration governance not initialized');
    // ArbitrationGovernance layout: disc(8) + phase(1) + multisig(32) + transition_at(8) + dispute_count(8) + bump(1)
    const id = gov.data.readBigUInt64LE(8 + 1 + 32 + 8);
    const arbDisputePda = this.pdas.arbDispute(id);

    const data = Buffer.concat([
      ixDiscriminator('file_arbitration_dispute'),
      u64LE(BigInt(params.redemptionId)),
      params.coinMint.toBuffer(),
      params.defendant.toBuffer(),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: arbGov, isSigner: false, isWritable: true },
        { pubkey: arbDisputePda, isSigner: false, isWritable: true },
        { pubkey: plaintiff, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    const res = await this.sendTx([ix]);
    return { ...res, arbDispute: arbDisputePda };
  }

  async selectTrial1Jury(params: DisputeIdParam): Promise<TransactionResult> {
    const caller = this.requireWallet();
    const arbDispute = this.pdas.arbDispute(params.disputeId);
    const reg = this.pdas.arbRegistry();
    const data = Buffer.concat([
      ixDiscriminator('select_trial1_jury'),
      u64LE(BigInt(params.disputeId)),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: arbDispute, isSigner: false, isWritable: true },
        { pubkey: reg, isSigner: false, isWritable: false },
        { pubkey: caller, isSigner: true, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async submitTrial1Ruling(params: SubmitRulingParams): Promise<TransactionResult> {
    return this.submitRulingImpl('submit_trial1_ruling', params);
  }

  async finalizeTrial1(params: DisputeIdParam): Promise<TransactionResult> {
    return this.callerOnly('finalize_trial1', params);
  }

  async appealToTrial2(params: DisputeIdParam): Promise<TransactionResult> {
    const appellant = this.requireWallet();
    const arbDispute = this.pdas.arbDispute(params.disputeId);
    const data = Buffer.concat([
      ixDiscriminator('appeal_to_trial2'),
      u64LE(BigInt(params.disputeId)),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: arbDispute, isSigner: false, isWritable: true },
        { pubkey: appellant, isSigner: true, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async selectTrial2Panel(params: DisputeIdParam): Promise<TransactionResult> {
    const caller = this.requireWallet();
    const arbDispute = this.pdas.arbDispute(params.disputeId);
    const reg = this.pdas.arbRegistry();
    const data = Buffer.concat([
      ixDiscriminator('select_trial2_panel'),
      u64LE(BigInt(params.disputeId)),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: arbDispute, isSigner: false, isWritable: true },
        { pubkey: reg, isSigner: false, isWritable: false },
        { pubkey: caller, isSigner: true, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  async submitTrial2Ruling(params: SubmitRulingParams): Promise<TransactionResult> {
    return this.submitRulingImpl('submit_trial2_ruling', params);
  }

  async finalizeDispute(params: DisputeIdParam): Promise<TransactionResult> {
    return this.callerOnly('finalize_dispute', params);
  }

  async dissolvePanelForAbsence(params: DisputeIdParam): Promise<TransactionResult> {
    const caller = this.requireWallet();
    const arbDispute = this.pdas.arbDispute(params.disputeId);
    const reg = this.pdas.arbRegistry();
    const data = Buffer.concat([
      ixDiscriminator('dissolve_panel_for_absence'),
      u64LE(BigInt(params.disputeId)),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: arbDispute, isSigner: false, isWritable: true },
        { pubkey: reg, isSigner: false, isWritable: true },
        { pubkey: caller, isSigner: true, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  // ── Internals ────────────────────────────────────────────────────────

  private async submitRulingImpl(name: 'submit_trial1_ruling' | 'submit_trial2_ruling', params: SubmitRulingParams): Promise<TransactionResult> {
    const juror = this.requireWallet();
    if (params.reasoningUri.length > GOVERNANCE_LIMITS.REASONING_URI_MAX)
      return errRes(`reasoningUri exceeds ${GOVERNANCE_LIMITS.REASONING_URI_MAX} chars`);
    const arbDispute = this.pdas.arbDispute(params.disputeId);
    const data = Buffer.concat([
      ixDiscriminator(name),
      u64LE(BigInt(params.disputeId)),
      encodeRuling(params.vote),
      borshString(params.reasoningUri),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: arbDispute, isSigner: false, isWritable: true },
        { pubkey: juror, isSigner: true, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  private async callerOnly(name: string, params: DisputeIdParam): Promise<TransactionResult> {
    const caller = this.requireWallet();
    const arbDispute = this.pdas.arbDispute(params.disputeId);
    const data = Buffer.concat([
      ixDiscriminator(name),
      u64LE(BigInt(params.disputeId)),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: arbDispute, isSigner: false, isWritable: true },
        { pubkey: caller, isSigner: true, isWritable: false },
      ],
      data,
    });
    return this.sendTx([ix]);
  }

  private requireWallet(): PublicKey {
    if (!this.wallet.publicKey) throw new Error('Wallet not connected');
    return this.wallet.publicKey;
  }

  private async sendTx(ixs: TransactionInstruction[]): Promise<TransactionResult> {
    try {
      const payer = this.requireWallet();
      const tx = new Transaction().add(...ixs);
      const { blockhash } = await this.connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = payer;
      const sig = await this.wallet.sendTransaction(tx, this.connection);
      await this.connection.confirmTransaction(sig);
      return { signature: sig, success: true };
    } catch (e) {
      return { signature: '', success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}

// ────────────────────────────────────────────────────────────────────────
// Parsers
// ────────────────────────────────────────────────────────────────────────

function parseGovernanceConfig(data: Buffer): GovernanceConfigOnChain {
  if (!data.slice(0, 8).equals(GOVERNANCE_CONFIG_DISC)) {
    throw new Error('Account is not a GovernanceConfig');
  }
  let o = 8;
  const admin = new PublicKey(data.slice(o, o + 32)); o += 32;
  const proposalCount = data.readBigUInt64LE(o); o += 8;
  const oraMint = new PublicKey(data.slice(o, o + 32)); o += 32;
  const quorum = data.readBigUInt64LE(o); o += 8;
  const bump = data.readUInt8(o);
  return { admin, proposalCount, oraMint, quorum, bump };
}

function errRes(msg: string): TransactionResult {
  return { signature: '', success: false, error: msg };
}

export const __internals = {
  ixDiscriminator,
  accountDiscriminator,
  u8, u16LE, u32LE, u64LE, bool, borshString, encodeRuling,
};
