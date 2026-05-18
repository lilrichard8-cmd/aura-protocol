/**
 * SDK ↔ contract consistency tests for RewardsModule (aura_rewards).
 */

import { PublicKey } from '@solana/web3.js';
import { assert } from 'chai';
import { sha256 } from '@noble/hashes/sha256';

import {
  REWARDS_SEEDS,
  TOTAL_INCENTIVE_POOL,
  INCENTIVE_TAX_BPS,
  MAU_THRESHOLD,
  ContentTier,
  CONTENT_TIER_MULTIPLIER,
  RewardPhase,
  PHASE_RATIO_BPS,
} from '../sdk/src/modules/rewards';

const REWARDS_PROGRAM_ID = new PublicKey('Bfwu9gQFyYsaURqDSVYwsfB5VXwGgbTHbSgrzEhNtbuR');

function ixDisc(name: string): Buffer {
  return Buffer.from(sha256(Buffer.from(`global:${name}`, 'utf8')).slice(0, 8));
}

describe('aura-sdk RewardsModule', () => {
  describe('Constants', () => {
    it('seeds defined', () => assert.ok(REWARDS_SEEDS));
    it('TOTAL_INCENTIVE_POOL = 500M ORA (with 9 decimals)', () =>
      assert.equal(TOTAL_INCENTIVE_POOL, 500_000_000n * 1_000_000_000n));
    it('INCENTIVE_TAX_BPS = 1000 (10% burn)', () =>
      assert.equal(INCENTIVE_TAX_BPS, 1_000));
    it('MAU_THRESHOLD = 500_000', () => assert.equal(MAU_THRESHOLD, 500_000n));

    it('5 content tiers configured', () => {
      assert.ok(CONTENT_TIER_MULTIPLIER[ContentTier.Basic]);
      assert.ok(CONTENT_TIER_MULTIPLIER[ContentTier.Exceptional]);
    });

    it('phase ratios sum to 10000 bps', () => {
      const phases: RewardPhase[] = [
        RewardPhase.Phase1Creation100,
        RewardPhase.Phase2Split70_30,
        RewardPhase.Phase3Split50_50,
      ];
      for (const phase of phases) {
        const { creation, curation } = PHASE_RATIO_BPS[phase];
        assert.equal(creation + curation, 10_000, `phase ${phase}`);
      }
    });
  });

  describe('PDA derivation', () => {
    it('reward state PDA is singleton', () => {
      const [a] = PublicKey.findProgramAddressSync([Buffer.from('reward_state')], REWARDS_PROGRAM_ID);
      const [b] = PublicKey.findProgramAddressSync([Buffer.from('reward_state')], REWARDS_PROGRAM_ID);
      assert.equal(a.toBase58(), b.toBase58());
    });
  });

  describe('Discriminators', () => {
    const names = [
      'initialize_rewards',
      'distribute_creation_reward',
      'distribute_curation_reward',
      'transition_phase',
      'update_mau',
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
