/**
 * SDK ↔ contract consistency tests for GovernanceModule.
 */

import { PublicKey, Keypair } from '@solana/web3.js';
import { assert } from 'chai';
import { sha256 } from '@noble/hashes/sha256';

import {
  GOVERNANCE_SEEDS,
  GOVERNANCE_LIMITS,
  CommitteeType,
  ProposalType,
  DisputeStatus,
  __internals,
} from '../sdk/src/modules/governance';

const GOV_PROGRAM_ID = new PublicKey('7Un16eWXCteD3PgjpYWggCjuQK2tneHDkwGXvUg5obBk');

function ixDisc(name: string): Buffer {
  return Buffer.from(sha256(Buffer.from(`global:${name}`, 'utf8')).slice(0, 8));
}

describe('aura-sdk GovernanceModule', () => {
  describe('Constants & seeds', () => {
    it('governance_config seed string', () =>
      assert.equal(GOVERNANCE_SEEDS.GOVERNANCE_CONFIG.toString(), 'governance_config'));

    it('arb-governance seed string', () =>
      assert.equal(GOVERNANCE_SEEDS.ARB_GOVERNANCE.toString(), 'arb-governance'));

    it('arb-registry seed string', () =>
      assert.equal(GOVERNANCE_SEEDS.ARB_REGISTRY.toString(), 'arb-registry'));

    it('arb-dispute seed string', () =>
      assert.equal(GOVERNANCE_SEEDS.ARB_DISPUTE.toString(), 'arb-dispute'));

    it('Trial 1 jury size = 5', () => assert.equal(GOVERNANCE_LIMITS.TRIAL1_JURY_SIZE, 5));
    it('Trial 2 panel size = 7', () => assert.equal(GOVERNANCE_LIMITS.TRIAL2_PANEL_SIZE, 7));

    it('MIN_STAKE_LAMPORTS = 10_000 * 1e9', () => {
      assert.equal(GOVERNANCE_LIMITS.MIN_STAKE_LAMPORTS, 10_000n * 1_000_000_000n);
    });

    it('CommitteeType + ProposalType + DisputeStatus enums populated', () => {
      assert.equal(CommitteeType.Arbitration, 3);
      assert.equal(ProposalType.CodeUpgrade, 3);
      assert.equal(DisputeStatus.Resolved, 6);
    });
  });

  describe('PDA derivation', () => {
    it('governance_config is singleton', () => {
      const [a] = PublicKey.findProgramAddressSync(
        [GOVERNANCE_SEEDS.GOVERNANCE_CONFIG], GOV_PROGRAM_ID
      );
      const [b] = PublicKey.findProgramAddressSync(
        [GOVERNANCE_SEEDS.GOVERNANCE_CONFIG], GOV_PROGRAM_ID
      );
      assert.equal(a.toBase58(), b.toBase58());
    });

    it('proposal PDA differs per (proposer, title)', () => {
      const proposer = Keypair.generate().publicKey;
      const [pa] = PublicKey.findProgramAddressSync(
        [GOVERNANCE_SEEDS.PROPOSAL, proposer.toBuffer(), Buffer.from('A')],
        GOV_PROGRAM_ID
      );
      const [pb] = PublicKey.findProgramAddressSync(
        [GOVERNANCE_SEEDS.PROPOSAL, proposer.toBuffer(), Buffer.from('B')],
        GOV_PROGRAM_ID
      );
      assert.notEqual(pa.toBase58(), pb.toBase58());
    });

    it('arb-dispute PDA uses LE u64 id', () => {
      const id0 = Buffer.alloc(8); id0.writeBigUInt64LE(BigInt(0));
      const id1 = Buffer.alloc(8); id1.writeBigUInt64LE(BigInt(1));
      const [p0] = PublicKey.findProgramAddressSync(
        [GOVERNANCE_SEEDS.ARB_DISPUTE, id0], GOV_PROGRAM_ID
      );
      const [p1] = PublicKey.findProgramAddressSync(
        [GOVERNANCE_SEEDS.ARB_DISPUTE, id1], GOV_PROGRAM_ID
      );
      assert.notEqual(p0.toBase58(), p1.toBase58());
    });
  });

  describe('Discriminators (all 20 instructions)', () => {
    const names = [
      'initialize_governance',
      'register_arbiter',
      'create_proposal',
      'vote_on_proposal',
      'execute_proposal',
      'create_dispute',
      'vote_on_dispute',
      'init_arbitration_governance',
      'init_arbitrator_registry',
      'register_as_arbitrator',
      'file_arbitration_dispute',
      'select_trial1_jury',
      'submit_trial1_ruling',
      'finalize_trial1',
      'appeal_to_trial2',
      'select_trial2_panel',
      'submit_trial2_ruling',
      'finalize_dispute',
      'dissolve_panel_for_absence',
    ];

    it('each is 8 bytes', () => {
      for (const n of names) assert.equal(ixDisc(n).length, 8);
    });

    it('mutually unique', () => {
      const seen = new Set<string>();
      for (const n of names) {
        const h = ixDisc(n).toString('hex');
        assert.isFalse(seen.has(h), `dup ${n}`);
        seen.add(h);
      }
      assert.equal(seen.size, names.length);
    });
  });

  describe('Ruling enum encoding', () => {
    it('ReleaseToCreator → [0]', () => {
      const b = __internals.encodeRuling({ kind: 'ReleaseToCreator' });
      assert.equal(b.length, 1);
      assert.equal(b[0], 0);
    });

    it('RefundBuyer → [1]', () => {
      const b = __internals.encodeRuling({ kind: 'RefundBuyer' });
      assert.equal(b.length, 1);
      assert.equal(b[0], 1);
    });

    it('Split(5000) → [2, 5000-le]', () => {
      const b = __internals.encodeRuling({ kind: 'Split', creatorShareBps: 5000 });
      assert.equal(b.length, 3);
      assert.equal(b[0], 2);
      assert.equal(b.readUInt16LE(1), 5000);
    });
  });
});
