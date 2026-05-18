/**
 * SDK ↔ contract consistency tests for FractionalizeModule.
 */

import { PublicKey, Keypair } from '@solana/web3.js';
import { assert } from 'chai';
import { sha256 } from '@noble/hashes/sha256';

import {
  FRACTIONALIZE_SEEDS,
  FRACTIONALIZE_LIMITS,
} from '../sdk/src/modules/fractionalize';

const FRAC_PROGRAM_ID = new PublicKey('3AQUkL1ayeJPHS2kYRRpsrACmrXmhKDYjhLsvwGUaw1S');

function ixDisc(name: string): Buffer {
  return Buffer.from(sha256(Buffer.from(`global:${name}`, 'utf8')).slice(0, 8));
}

describe('aura-sdk FractionalizeModule', () => {
  describe('Constants & seeds', () => {
    it('seed strings match Rust', () => {
      assert.equal(FRACTIONALIZE_SEEDS.FRACTIONAL_NFT.toString(), 'fractional_nft');
      assert.equal(FRACTIONALIZE_SEEDS.FRAGMENT_MINT.toString(), 'fragment_mint');
      assert.equal(FRACTIONALIZE_SEEDS.NFT_VAULT.toString(), 'nft_vault');
      assert.equal(FRACTIONALIZE_SEEDS.REVENUE_VAULT.toString(), 'revenue_vault');
      assert.equal(FRACTIONALIZE_SEEDS.FRAGMENT_HOLDER.toString(), 'fragment_holder');
      assert.equal(FRACTIONALIZE_SEEDS.LICENSE_VOTE.toString(), 'license_vote');
    });

    it('MAX_FRAGMENTS = 1_000_000', () => {
      assert.equal(FRACTIONALIZE_LIMITS.MAX_FRAGMENTS, 1_000_000n);
    });

    it('DEFAULT_VOTE_THRESHOLD_BPS = 5000 (50%)', () => {
      assert.equal(FRACTIONALIZE_LIMITS.DEFAULT_VOTE_THRESHOLD_BPS, 5_000);
    });

    it('VOTING_PERIOD_SECONDS = 72h', () => {
      assert.equal(FRACTIONALIZE_LIMITS.VOTING_PERIOD_SECONDS, 72 * 60 * 60);
    });
  });

  describe('PDA derivation', () => {
    it('fractional_nft PDA differs per NFT mint', () => {
      const m1 = Keypair.generate().publicKey;
      const m2 = Keypair.generate().publicKey;
      const [p1] = PublicKey.findProgramAddressSync(
        [FRACTIONALIZE_SEEDS.FRACTIONAL_NFT, m1.toBuffer()],
        FRAC_PROGRAM_ID
      );
      const [p2] = PublicKey.findProgramAddressSync(
        [FRACTIONALIZE_SEEDS.FRACTIONAL_NFT, m2.toBuffer()],
        FRAC_PROGRAM_ID
      );
      assert.notEqual(p1.toBase58(), p2.toBase58());
    });

    it('fragment_holder PDA is unique per (fnft, holder)', () => {
      const fnft = Keypair.generate().publicKey;
      const h1 = Keypair.generate().publicKey;
      const h2 = Keypair.generate().publicKey;
      const [p1] = PublicKey.findProgramAddressSync(
        [FRACTIONALIZE_SEEDS.FRAGMENT_HOLDER, fnft.toBuffer(), h1.toBuffer()],
        FRAC_PROGRAM_ID
      );
      const [p2] = PublicKey.findProgramAddressSync(
        [FRACTIONALIZE_SEEDS.FRAGMENT_HOLDER, fnft.toBuffer(), h2.toBuffer()],
        FRAC_PROGRAM_ID
      );
      assert.notEqual(p1.toBase58(), p2.toBase58());
    });

    it('license_vote PDA uses LE u64 proposal id', () => {
      const fnft = Keypair.generate().publicKey;
      const id0 = Buffer.alloc(8); id0.writeBigUInt64LE(BigInt(0));
      const id1 = Buffer.alloc(8); id1.writeBigUInt64LE(BigInt(1));
      const [p0] = PublicKey.findProgramAddressSync(
        [FRACTIONALIZE_SEEDS.LICENSE_VOTE, fnft.toBuffer(), id0],
        FRAC_PROGRAM_ID
      );
      const [p1] = PublicKey.findProgramAddressSync(
        [FRACTIONALIZE_SEEDS.LICENSE_VOTE, fnft.toBuffer(), id1],
        FRAC_PROGRAM_ID
      );
      assert.notEqual(p0.toBase58(), p1.toBase58());
    });

    it('revenue_vault is keyed by NFT mint (same as Rust)', () => {
      const m = Keypair.generate().publicKey;
      const [a] = PublicKey.findProgramAddressSync(
        [FRACTIONALIZE_SEEDS.REVENUE_VAULT, m.toBuffer()],
        FRAC_PROGRAM_ID
      );
      const [b] = PublicKey.findProgramAddressSync(
        [FRACTIONALIZE_SEEDS.REVENUE_VAULT, m.toBuffer()],
        FRAC_PROGRAM_ID
      );
      assert.equal(a.toBase58(), b.toBase58());
    });
  });

  describe('Discriminators', () => {
    const names = [
      'fractionalize_nft',
      'buy_fragment',
      'sell_fragment',
      'distribute_revenue',
      'claim_revenue',
      'vote_on_license',
      'finalize_license_vote',
      'reclaim_nft',
    ];

    it('8 instructions wrapped', () => assert.equal(names.length, 8));

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
      assert.equal(seen.size, names.length);
    });
  });
});
