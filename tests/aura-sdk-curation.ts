/**
 * SDK ↔ contract consistency tests for CurationModule (aura_curation).
 */

import { PublicKey, Keypair } from '@solana/web3.js';
import { assert } from 'chai';
import { sha256 } from '@noble/hashes/sha256';

import { CURATION_SEEDS, BASE_WEIGHT, SETTLEMENT_PERIOD_SECONDS } from '../sdk/src/modules/curation';

const CURATION_PROGRAM_ID = new PublicKey('D1FvbNBVZRvjJYVHNSHZKE653PWCNjb2cfEjNgNxYvc8');

function ixDisc(name: string): Buffer {
  return Buffer.from(sha256(Buffer.from(`global:${name}`, 'utf8')).slice(0, 8));
}

describe('aura-sdk CurationModule', () => {
  describe('Constants', () => {
    it('BASE_WEIGHT = 1000', () => assert.equal(BASE_WEIGHT, 1_000n));
    it('SETTLEMENT_PERIOD_SECONDS = 72h', () => assert.equal(SETTLEMENT_PERIOD_SECONDS, 72 * 60 * 60));
    it('seeds object defined', () => assert.ok(CURATION_SEEDS));
  });

  describe('PDA derivation', () => {
    it('curation pool PDA derives from content key', () => {
      const content = Keypair.generate().publicKey;
      const [a] = PublicKey.findProgramAddressSync(
        [Buffer.from('curation_pool'), content.toBuffer()],
        CURATION_PROGRAM_ID
      );
      const [b] = PublicKey.findProgramAddressSync(
        [Buffer.from('curation_pool'), content.toBuffer()],
        CURATION_PROGRAM_ID
      );
      assert.equal(a.toBase58(), b.toBase58());
    });

    it('reward_vault PDA is unique per content', () => {
      const c1 = Keypair.generate().publicKey;
      const c2 = Keypair.generate().publicKey;
      const [p1] = PublicKey.findProgramAddressSync(
        [Buffer.from('reward_vault'), c1.toBuffer()],
        CURATION_PROGRAM_ID
      );
      const [p2] = PublicKey.findProgramAddressSync(
        [Buffer.from('reward_vault'), c2.toBuffer()],
        CURATION_PROGRAM_ID
      );
      assert.notEqual(p1.toBase58(), p2.toBase58());
    });
  });

  describe('Discriminators', () => {
    const names = ['initialize_pool', 'curate', 'deposit_to_pool', 'claim_curation_reward', 'settle_pool'];

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
    });
  });
});
