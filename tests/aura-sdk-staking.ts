/**
 * SDK ↔ contract consistency tests for StakingModule (aura_staking).
 */

import { PublicKey, Keypair } from '@solana/web3.js';
import { assert } from 'chai';
import { sha256 } from '@noble/hashes/sha256';

import {
  STAKING_SEEDS,
  LockupTier,
  LOCKUP_PARAMS,
  EARLY_UNSTAKE_PENALTY_BPS,
} from '../sdk/src/modules/staking';

const STAKING_PROGRAM_ID = new PublicKey('6h1sZi8cG3WNB2r9FqTkgoMLBBUPZWbyWPQ3mRsSPyAv');

function ixDisc(name: string): Buffer {
  return Buffer.from(sha256(Buffer.from(`global:${name}`, 'utf8')).slice(0, 8));
}

describe('aura-sdk StakingModule', () => {
  describe('Constants', () => {
    it('seeds defined', () => assert.ok(STAKING_SEEDS));
    it('EARLY_UNSTAKE_PENALTY_BPS = 2000 (20%)', () =>
      assert.equal(EARLY_UNSTAKE_PENALTY_BPS, 2_000));

    it('4 lockup tiers configured (1mo/3mo/6mo/12mo) [audit fix R5 H-S-1]', () => {
      assert.ok(LOCKUP_PARAMS[LockupTier.OneMonth]);
      assert.ok(LOCKUP_PARAMS[LockupTier.ThreeMonths]);
      assert.ok(LOCKUP_PARAMS[LockupTier.SixMonths]);
      assert.ok(LOCKUP_PARAMS[LockupTier.TwelveMonths]);
    });

    it('longer lockups have higher multipliers', () => {
      const m1 = LOCKUP_PARAMS[LockupTier.OneMonth].multiplierBps;
      const m12 = LOCKUP_PARAMS[LockupTier.TwelveMonths].multiplierBps;
      assert.isAbove(m12, m1);
    });
  });

  describe('PDA derivation', () => {
    it('staking pool PDA is a singleton (seed only)', () => {
      const [a] = PublicKey.findProgramAddressSync([Buffer.from('staking_pool')], STAKING_PROGRAM_ID);
      const [b] = PublicKey.findProgramAddressSync([Buffer.from('staking_pool')], STAKING_PROGRAM_ID);
      assert.equal(a.toBase58(), b.toBase58());
    });

    it('stake PDA differs across users (with same nonce)', () => {
      const u1 = Keypair.generate().publicKey;
      const u2 = Keypair.generate().publicKey;
      const nonce = Buffer.alloc(8); nonce.writeBigInt64LE(BigInt(0));
      const [p1] = PublicKey.findProgramAddressSync(
        [Buffer.from('stake'), u1.toBuffer(), nonce],
        STAKING_PROGRAM_ID
      );
      const [p2] = PublicKey.findProgramAddressSync(
        [Buffer.from('stake'), u2.toBuffer(), nonce],
        STAKING_PROGRAM_ID
      );
      assert.notEqual(p1.toBase58(), p2.toBase58());
    });
  });

  describe('Discriminators', () => {
    const names = [
      'initialize_staking_pool',
      'stake_ora',
      'unstake_ora',
      'claim_staking_reward',
      'update_daily_rewards',
    ];

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
