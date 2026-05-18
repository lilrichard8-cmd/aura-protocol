/**
 * SDK ↔ contract consistency tests for LaunchIncentivesModule
 * (aura_launch_incentives).
 *
 * Anchors against Whitepaper §5.6 + Numbers Handbook §4 numbers and the
 * on-chain seeds defined in programs/launch-incentives/src/lib.rs.
 *
 * [whitepaper-sync v1.1] §5.6 launch-incentives
 */

import { PublicKey, Keypair } from '@solana/web3.js';
import { assert } from 'chai';
import { sha256 } from '@noble/hashes/sha256';

import {
  LAUNCH_INCENTIVES_SEEDS,
  MILLION_PLAN_POOL,
  ONBOARDING_POOL,
  RISING_STAR_POOL,
  LAUNCH_INCENTIVE_TOTAL,
  MILESTONE_COUNT,
  MILESTONE_DAU_THRESHOLDS,
  MILESTONE_RELEASES,
  MILESTONE_PER_USER_CAP,
  ONBOARDING_MIN_EXTERNAL_FOLLOWERS,
  ONBOARDING_RATE_PER_FOLLOWER,
  ONBOARDING_PER_CREATOR_CAP,
  ONBOARDING_UNLOCK_MONTHS,
  ONBOARDING_MAX_CONSECUTIVE_MISSES,
  RISING_STAR_RATE_PER_FOLLOWER,
  RISING_STAR_MONTHLY_CAP,
  RISING_STAR_DURATION_MONTHS,
  OnboardingStatus,
  RisingStarStatus,
  deriveMilestonePda,
  deriveMillionClaimPda,
  deriveOnboardingGrantPda,
  deriveRisingStarGrantPda,
  deriveRisingStarMonthPda,
} from '../sdk/src/modules/launchIncentives';

const LAUNCH_INCENTIVES_PROGRAM_ID = new PublicKey(
  'GiqNJ5BbaebqvDPGep4QeK6JLNagk5zzW68pykb9eQEf'
);

function ixDisc(name: string): Buffer {
  return Buffer.from(sha256(Buffer.from(`global:${name}`, 'utf8')).slice(0, 8));
}

describe('aura-sdk LaunchIncentivesModule', () => {
  describe('Sub-pool budgets (Handbook §4)', () => {
    it('Million Plan = 50M ORA (9 decimals)', () =>
      assert.equal(MILLION_PLAN_POOL.toString(), (50_000_000n * 1_000_000_000n).toString()));

    it('Onboarding = 50M ORA', () =>
      assert.equal(ONBOARDING_POOL.toString(), (50_000_000n * 1_000_000_000n).toString()));

    it('Rising Star = 50M ORA', () =>
      assert.equal(RISING_STAR_POOL.toString(), (50_000_000n * 1_000_000_000n).toString()));

    it('sum of three sub-pools = 150M ORA', () => {
      const sum = MILLION_PLAN_POOL + ONBOARDING_POOL + RISING_STAR_POOL;
      assert.equal(sum.toString(), LAUNCH_INCENTIVE_TOTAL.toString());
      assert.equal(sum.toString(), (150_000_000n * 1_000_000_000n).toString());
    });
  });

  describe('Million Plan constants (Handbook §4.1)', () => {
    it('4 milestones', () => assert.equal(MILESTONE_COUNT, 4));

    it('DAU thresholds: 100K / 250K / 500K / 1M', () => {
      assert.deepEqual(
        MILESTONE_DAU_THRESHOLDS.map((x) => x.toString()),
        ['100000', '250000', '500000', '1000000']
      );
    });

    it('release sizes: 5M / 5M / 10M / 30M = 50M total', () => {
      assert.deepEqual(
        MILESTONE_RELEASES.map((x) => x.toString()),
        [
          (5_000_000n * 1_000_000_000n).toString(),
          (5_000_000n * 1_000_000_000n).toString(),
          (10_000_000n * 1_000_000_000n).toString(),
          (30_000_000n * 1_000_000_000n).toString(),
        ]
      );
      const sum =
        MILESTONE_RELEASES[0] +
        MILESTONE_RELEASES[1] +
        MILESTONE_RELEASES[2] +
        MILESTONE_RELEASES[3];
      assert.equal(sum.toString(), MILLION_PLAN_POOL.toString());
    });

    it('per-user per-milestone cap = 10,000 ORA', () =>
      assert.equal(
        MILESTONE_PER_USER_CAP.toString(),
        (10_000n * 1_000_000_000n).toString()
      ));
  });

  describe('Onboarding constants (Handbook §4.2)', () => {
    it('min external followers = 10,000', () =>
      assert.equal(ONBOARDING_MIN_EXTERNAL_FOLLOWERS.toString(), '10000'));

    it('rate = 1 ORA per follower (1 * 10^9 base units)', () =>
      assert.equal(ONBOARDING_RATE_PER_FOLLOWER.toString(), '1000000000'));

    it('per-creator cap = 1,000,000 ORA', () =>
      assert.equal(
        ONBOARDING_PER_CREATOR_CAP.toString(),
        (1_000_000n * 1_000_000_000n).toString()
      ));

    it('12-month unlock schedule', () => assert.equal(ONBOARDING_UNLOCK_MONTHS, 12));

    it('3 consecutive misses → forfeit', () =>
      assert.equal(ONBOARDING_MAX_CONSECUTIVE_MISSES, 3));
  });

  describe('Rising Star constants (Handbook §4.3)', () => {
    it('rate = 1 ORA per new AURA follower', () =>
      assert.equal(RISING_STAR_RATE_PER_FOLLOWER.toString(), '1000000000'));

    it('per-creator monthly cap = 5,000 ORA', () =>
      assert.equal(
        RISING_STAR_MONTHLY_CAP.toString(),
        (5_000n * 1_000_000_000n).toString()
      ));

    it('1-year duration', () => assert.equal(RISING_STAR_DURATION_MONTHS, 12));
  });

  describe('Status enums', () => {
    it('OnboardingStatus has 4 variants', () => {
      assert.equal(OnboardingStatus.Active, 0);
      assert.equal(OnboardingStatus.Paused, 1);
      assert.equal(OnboardingStatus.Forfeit, 2);
      assert.equal(OnboardingStatus.Completed, 3);
    });
    it('RisingStarStatus has 3 variants', () => {
      assert.equal(RisingStarStatus.Active, 0);
      assert.equal(RisingStarStatus.Completed, 1);
      assert.equal(RisingStarStatus.Suspended, 2);
    });
  });

  describe('Seeds', () => {
    it('all seeds are byte buffers', () => {
      for (const v of Object.values(LAUNCH_INCENTIVES_SEEDS)) {
        assert.ok(Buffer.isBuffer(v));
        assert.isAbove(v.length, 0);
      }
    });
  });

  describe('PDA derivation', () => {
    it('LaunchIncentives state PDA is a singleton', () => {
      const [a] = PublicKey.findProgramAddressSync(
        [LAUNCH_INCENTIVES_SEEDS.STATE],
        LAUNCH_INCENTIVES_PROGRAM_ID
      );
      const [b] = PublicKey.findProgramAddressSync(
        [LAUNCH_INCENTIVES_SEEDS.STATE],
        LAUNCH_INCENTIVES_PROGRAM_ID
      );
      assert.equal(a.toBase58(), b.toBase58());
    });

    it('Milestone PDAs differ across milestone ids', () => {
      const [a] = deriveMilestonePda(LAUNCH_INCENTIVES_PROGRAM_ID, 0);
      const [b] = deriveMilestonePda(LAUNCH_INCENTIVES_PROGRAM_ID, 1);
      const [c] = deriveMilestonePda(LAUNCH_INCENTIVES_PROGRAM_ID, 2);
      const [d] = deriveMilestonePda(LAUNCH_INCENTIVES_PROGRAM_ID, 3);
      const set = new Set([a, b, c, d].map((x) => x.toBase58()));
      assert.equal(set.size, 4);
    });

    it('MilestoneClaim PDAs differ across (user, milestone)', () => {
      const u = Keypair.generate().publicKey;
      const [m0] = deriveMillionClaimPda(LAUNCH_INCENTIVES_PROGRAM_ID, u, 0);
      const [m1] = deriveMillionClaimPda(LAUNCH_INCENTIVES_PROGRAM_ID, u, 1);
      assert.notEqual(m0.toBase58(), m1.toBase58());
    });

    it('OnboardingGrant PDAs differ across creators', () => {
      const c1 = Keypair.generate().publicKey;
      const c2 = Keypair.generate().publicKey;
      const [a] = deriveOnboardingGrantPda(LAUNCH_INCENTIVES_PROGRAM_ID, c1);
      const [b] = deriveOnboardingGrantPda(LAUNCH_INCENTIVES_PROGRAM_ID, c2);
      assert.notEqual(a.toBase58(), b.toBase58());
    });

    it('RisingStarGrant PDA is distinct from OnboardingGrant PDA for the same creator', () => {
      const c = Keypair.generate().publicKey;
      const [ob] = deriveOnboardingGrantPda(LAUNCH_INCENTIVES_PROGRAM_ID, c);
      const [rs] = deriveRisingStarGrantPda(LAUNCH_INCENTIVES_PROGRAM_ID, c);
      assert.notEqual(ob.toBase58(), rs.toBase58());
    });

    it('RisingStarMonth PDAs differ across month indices', () => {
      const c = Keypair.generate().publicKey;
      const [m0] = deriveRisingStarMonthPda(LAUNCH_INCENTIVES_PROGRAM_ID, c, 0);
      const [m11] = deriveRisingStarMonthPda(LAUNCH_INCENTIVES_PROGRAM_ID, c, 11);
      assert.notEqual(m0.toBase58(), m11.toBase58());
    });
  });

  describe('Discriminators', () => {
    const names = [
      'initialize_launch_incentives',
      'initialize_million_plan_state',
      'trigger_milestone',
      'claim_million_reward',
      'register_onboarding',
      'claim_monthly_unlock',
      'forfeit_pending_to_million_plan',
      'register_rising_star',
      'record_monthly_followers',
      'claim_rising_star_monthly',
    ];

    it('each is 8 bytes', () => {
      for (const n of names) assert.equal(ixDisc(n).length, 8);
    });

    it('mutually unique', () => {
      const seen = new Set<string>();
      for (const n of names) {
        const h = ixDisc(n).toString('hex');
        assert.isFalse(seen.has(h), `duplicate disc for ${n}`);
        seen.add(h);
      }
    });
  });
});
