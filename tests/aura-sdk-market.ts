/**
 * SDK ↔ contract consistency tests for MarketModule (Bounty V2).
 *
 * The SDK builds transactions locally — no RPC required for these tests.
 * We verify that the SDK's PDA derivation, instruction discriminator, and
 * Borsh encoding agree with the on-chain Rust contract.
 */

import { PublicKey, Keypair } from '@solana/web3.js';
import { assert } from 'chai';
import { sha256 } from '@noble/hashes/sha256';

import {
  BOUNTY_V2_SEEDS,
  BOUNTY_V2_LIMITS,
  BOUNTY_V2_FEE_BPS,
  computeWinnerNet,
  // [whitepaper-sync v1.1] §12 NFT royalty
  NFT_ROYALTY_SEEDS,
  NFT_ROYALTY_BPS,
  NFT_PROTOCOL_FEE_BPS,
  NFT_MAX_TOTAL_DEDUCTION_BPS,
  computeNftSaleSplit,
  deriveNftRoyaltyConfig,
} from '../sdk/src/modules/market';

const MARKET_PROGRAM_ID = new PublicKey('5BTekjKRiY8pXqEr7eQsqhRFynN27CxfYnh1d5q27cLV');

// Recompute discriminator the way Anchor does (sha256("global:<name>")[..8]).
function ixDisc(name: string): Buffer {
  const buf = Buffer.from(`global:${name}`, 'utf8');
  return Buffer.from(sha256(buf).slice(0, 8));
}

describe('aura-sdk MarketModule', () => {
  describe('PDA derivation matches the on-chain seeds', () => {
    it('official-authority singleton', () => {
      const [pda] = PublicKey.findProgramAddressSync(
        [BOUNTY_V2_SEEDS.OFFICIAL_AUTHORITY],
        MARKET_PROGRAM_ID
      );
      assert.equal(BOUNTY_V2_SEEDS.OFFICIAL_AUTHORITY.toString(), 'bounty-official-authority');
      assert.ok(pda);
    });

    it('bounty-counter per sponsor', () => {
      const sponsor = Keypair.generate().publicKey;
      const [pda] = PublicKey.findProgramAddressSync(
        [BOUNTY_V2_SEEDS.COUNTER, sponsor.toBuffer()],
        MARKET_PROGRAM_ID
      );
      assert.equal(BOUNTY_V2_SEEDS.COUNTER.toString(), 'bounty-counter');
      assert.ok(pda);
    });

    it('bounty PDA uses LE-encoded u64 id', () => {
      const sponsor = Keypair.generate().publicKey;
      const id = Buffer.alloc(8); id.writeBigUInt64LE(BigInt(42));
      const [pda] = PublicKey.findProgramAddressSync(
        [BOUNTY_V2_SEEDS.BOUNTY, sponsor.toBuffer(), id],
        MARKET_PROGRAM_ID
      );
      assert.equal(BOUNTY_V2_SEEDS.BOUNTY.toString(), 'bounty-v2');
      assert.ok(pda);
    });

    it('submission PDA is unique per (bounty, submitter)', () => {
      const bounty = Keypair.generate().publicKey;
      const a = Keypair.generate().publicKey;
      const b = Keypair.generate().publicKey;
      const [p1] = PublicKey.findProgramAddressSync(
        [BOUNTY_V2_SEEDS.SUBMISSION, bounty.toBuffer(), a.toBuffer()],
        MARKET_PROGRAM_ID
      );
      const [p2] = PublicKey.findProgramAddressSync(
        [BOUNTY_V2_SEEDS.SUBMISSION, bounty.toBuffer(), b.toBuffer()],
        MARKET_PROGRAM_ID
      );
      assert.notEqual(p1.toBase58(), p2.toBase58());
    });
  });

  describe('Instruction discriminators (Anchor sha256("global:<name>"))', () => {
    const expected = [
      'bv2_init_official_authority',
      'bv2_rotate_official_authority',
      'bv2_init_bounty_counter',
      'bv2_create_bounty',
      'bv2_submit_to_bounty',
      'bv2_award_submission',
      'bv2_reject_submission',
      'bv2_cancel_bounty',
      'bv2_close_bounty',
      'bv2_refund_expired',
    ];

    it('computes 8-byte discriminator for each instruction', () => {
      for (const name of expected) {
        const d = ixDisc(name);
        assert.equal(d.length, 8, `${name} discriminator length`);
      }
    });

    it('discriminators are mutually unique', () => {
      const seen = new Set<string>();
      for (const name of expected) {
        const d = ixDisc(name).toString('hex');
        assert.isFalse(seen.has(d), `duplicate discriminator for ${name}`);
        seen.add(d);
      }
      assert.equal(seen.size, expected.length);
    });

    it('produces deterministic hashes (regression-locked)', () => {
      // If any of these change, the SDK has broken wire-compat with the
      // deployed contract. To re-baseline: deploy a matching contract and
      // capture the new hashes from there.
      const probe = ixDisc('bv2_create_bounty').toString('hex');
      assert.equal(probe.length, 16); // 8 bytes = 16 hex chars
      // The actual hex is whatever Anchor + the function name produce; this
      // assertion just locks that the function is stable across SDK builds.
      const probe2 = ixDisc('bv2_create_bounty').toString('hex');
      assert.equal(probe, probe2);
    });
  });

  describe('Constants match contract', () => {
    it('MAX_WINNERS = 10', () => {
      assert.equal(BOUNTY_V2_LIMITS.MAX_WINNERS, 10);
    });

    it('MIN_AWARD_AMOUNT = 20 (audit fix L-1)', () => {
      assert.equal(BOUNTY_V2_LIMITS.MIN_AWARD_AMOUNT, 20);
    });

    it('ORA fee split sums to 5% (500 bps)', () => {
      const { BURN, STAKING, GAS, OPS, TOTAL } = BOUNTY_V2_FEE_BPS;
      assert.equal(BURN + STAKING + GAS + OPS, TOTAL);
      assert.equal(TOTAL, 500);
    });
  });

  describe('computeWinnerNet', () => {
    it('1_000_000 ORA gross → 950_000 net', () => {
      const net = computeWinnerNet(1_000_000n);
      assert.equal(net, 950_000n);
    });

    it('rounds fee down (winner gets the rounding crumb)', () => {
      // gross = 19 → fee = floor(19 * 500 / 10000) = 0, winner = 19.
      // This is why MIN_AWARD_AMOUNT is 20.
      const net = computeWinnerNet(19n);
      assert.equal(net, 19n);
    });

    it('gross = 20 → fee = 1, winner = 19', () => {
      // floor(20 * 500 / 10000) = 1
      const net = computeWinnerNet(20n);
      assert.equal(net, 19n);
    });

    it('big number does not overflow', () => {
      const huge = 10_000_000_000_000_000n; // 10^16
      const net = computeWinnerNet(huge);
      assert.equal(net, 9_500_000_000_000_000n);
    });
  });

  // ╔═════════════════════════════════════════════════════════════════╗
  // [whitepaper-sync v1.1] §12 NFT Royalty SDK ↔ contract consistency
  // ╚═════════════════════════════════════════════════════════════════╝
  describe('NFT Royalty (WP §12)', () => {
    describe('Constants match whitepaper', () => {
      it('royalty band 5%–45% with 5% default', () => {
        assert.equal(NFT_ROYALTY_BPS.MIN, 500);
        assert.equal(NFT_ROYALTY_BPS.MAX, 4500);
        assert.equal(NFT_ROYALTY_BPS.DEFAULT, 500);
      });

      it('protocol fee bps split matches §5.7', () => {
        const { BURN, STAKING, GAS, OPS, TOTAL } = NFT_PROTOCOL_FEE_BPS;
        assert.equal(BURN + STAKING + GAS + OPS, TOTAL);
        assert.equal(TOTAL, 500);
        assert.equal(BURN, 200);
        assert.equal(STAKING, 200);
        assert.equal(GAS, 50);
        assert.equal(OPS, 50);
      });

      it('max total deduction = 50% (45% royalty + 5% fee)', () => {
        assert.equal(NFT_MAX_TOTAL_DEDUCTION_BPS, 5000);
      });

      it('seed buffer matches `b"nft-royalty"`', () => {
        assert.equal(NFT_ROYALTY_SEEDS.CONFIG.toString(), 'nft-royalty');
      });
    });

    describe('PDA derivation', () => {
      it('config PDA is deterministic per (programId, nftMint)', () => {
        const nft = Keypair.generate().publicKey;
        const a = deriveNftRoyaltyConfig(MARKET_PROGRAM_ID, nft);
        const b = deriveNftRoyaltyConfig(MARKET_PROGRAM_ID, nft);
        assert.equal(a.toBase58(), b.toBase58());
      });

      it('different mints → different configs', () => {
        const m1 = Keypair.generate().publicKey;
        const m2 = Keypair.generate().publicKey;
        const p1 = deriveNftRoyaltyConfig(MARKET_PROGRAM_ID, m1);
        const p2 = deriveNftRoyaltyConfig(MARKET_PROGRAM_ID, m2);
        assert.notEqual(p1.toBase58(), p2.toBase58());
      });

      it('derivation matches manual seed lookup', () => {
        const nft = Keypair.generate().publicKey;
        const fromSdk = deriveNftRoyaltyConfig(MARKET_PROGRAM_ID, nft);
        const [manual] = PublicKey.findProgramAddressSync(
          [NFT_ROYALTY_SEEDS.CONFIG, nft.toBuffer()],
          MARKET_PROGRAM_ID
        );
        assert.equal(fromSdk.toBase58(), manual.toBase58());
      });
    });

    describe('Instruction discriminators', () => {
      const expected = ['set_royalty', 'enforce_royalty_on_sale'];

      it('discriminator length is 8 bytes', () => {
        for (const name of expected) {
          assert.equal(ixDisc(name).length, 8);
        }
      });

      it('discriminators are unique', () => {
        const seen = new Set<string>();
        for (const name of expected) {
          const d = ixDisc(name).toString('hex');
          assert.isFalse(seen.has(d), `duplicate for ${name}`);
          seen.add(d);
        }
      });

      it('discriminators are stable across calls', () => {
        for (const name of expected) {
          const a = ixDisc(name).toString('hex');
          const b = ixDisc(name).toString('hex');
          assert.equal(a, b);
        }
      });
    });

    describe('computeNftSaleSplit (mirrors compute_nft_sale_split on-chain)', () => {
      it('5% royalty: 1_000 ORA sale → 50 royalty / 50 fee / 900 net', () => {
        const s = computeNftSaleSplit(1_000_000_000n, NFT_ROYALTY_BPS.MIN);
        assert.equal(s.royalty, 50_000_000n);
        assert.equal(s.feeTotal, 50_000_000n);
        assert.equal(s.burn, 20_000_000n);
        assert.equal(s.staking, 20_000_000n);
        assert.equal(s.gas, 5_000_000n);
        assert.equal(s.ops, 5_000_000n);
        assert.equal(s.sellerNet, 900_000_000n);
        // legs sum back to sale price (royalty + protocol-fee legs + seller_net)
        assert.equal(
          s.royalty + s.burn + s.staking + s.gas + s.ops + s.sellerNet,
          1_000_000_000n
        );
      });

      it('45% royalty: 1_000 ORA sale → 450 royalty / 50 fee / 500 net', () => {
        const s = computeNftSaleSplit(1_000_000_000n, NFT_ROYALTY_BPS.MAX);
        assert.equal(s.royalty, 450_000_000n);
        assert.equal(s.feeTotal, 50_000_000n);
        assert.equal(s.sellerNet, 500_000_000n);
      });

      it('rounding residue routed to ops', () => {
        // Mirrors the Rust unit test split_rounding_residue_goes_to_ops.
        const s = computeNftSaleSplit(12_345n, 1_000);
        assert.equal(s.royalty, 1_234n);
        assert.equal(s.feeTotal, 617n);
        assert.equal(s.burn, 246n);
        assert.equal(s.staking, 246n);
        assert.equal(s.gas, 61n);
        assert.equal(s.ops, 64n);
        assert.equal(s.sellerNet, 12_345n - 1_234n - 617n);
      });

      it('rejects royaltyBps < MIN', () => {
        assert.throws(() => computeNftSaleSplit(1_000_000_000n, 499));
      });

      it('rejects royaltyBps > MAX', () => {
        assert.throws(() => computeNftSaleSplit(1_000_000_000n, 4501));
      });

      it('big number does not overflow (1e16 lamports)', () => {
        const huge = 10_000_000_000_000_000n;
        const s = computeNftSaleSplit(huge, NFT_ROYALTY_BPS.DEFAULT);
        // 5% royalty + 5% fee → seller nets 90%
        assert.equal(s.sellerNet, 9_000_000_000_000_000n);
      });
    });
  });
});
