/**
 * SDK ↔ contract consistency tests for ReputationModule.
 */

import { PublicKey, Keypair } from '@solana/web3.js';
import { assert } from 'chai';
import { sha256 } from '@noble/hashes/sha256';

import { REPUTATION_SEEDS, REPUTATION_TIER_ORDER } from '../sdk/src/modules/reputation';

const REP_PROGRAM_ID = new PublicKey('GoBjYZJngPdQe2wEgzu4bE74PPDFa8XGKqVadFuM8pEg');

function ixDisc(name: string): Buffer {
  return Buffer.from(sha256(Buffer.from(`global:${name}`, 'utf8')).slice(0, 8));
}

describe('aura-sdk ReputationModule', () => {
  describe('Constants', () => {
    it('SBT seed string is "reputation_sbt"', () =>
      assert.equal(REPUTATION_SEEDS.SBT.toString(), 'reputation_sbt'));

    it('REPUTATION_TIER_ORDER is a non-empty array', () => {
      assert.isAbove(REPUTATION_TIER_ORDER.length, 0);
    });
  });

  describe('PDA derivation', () => {
    it('SBT PDA is unique per creator', () => {
      const a = Keypair.generate().publicKey;
      const b = Keypair.generate().publicKey;
      const [pa] = PublicKey.findProgramAddressSync(
        [REPUTATION_SEEDS.SBT, a.toBuffer()],
        REP_PROGRAM_ID
      );
      const [pb] = PublicKey.findProgramAddressSync(
        [REPUTATION_SEEDS.SBT, b.toBuffer()],
        REP_PROGRAM_ID
      );
      assert.notEqual(pa.toBase58(), pb.toBase58());
    });

    it('SBT PDA is deterministic', () => {
      const k = Keypair.generate().publicKey;
      const [a] = PublicKey.findProgramAddressSync([REPUTATION_SEEDS.SBT, k.toBuffer()], REP_PROGRAM_ID);
      const [b] = PublicKey.findProgramAddressSync([REPUTATION_SEEDS.SBT, k.toBuffer()], REP_PROGRAM_ID);
      assert.equal(a.toBase58(), b.toBase58());
    });
  });

  describe('Discriminators', () => {
    const names = ['update_reputation', 'mint_sbt'];

    it('each is 8 bytes', () => {
      for (const n of names) assert.equal(ixDisc(n).length, 8);
    });

    it('mutually unique', () => {
      const seen = new Set<string>();
      for (const n of names) {
        const h = ixDisc(n).toString('hex');
        assert.isFalse(seen.has(h));
        seen.add(h);
      }
    });
  });
});
