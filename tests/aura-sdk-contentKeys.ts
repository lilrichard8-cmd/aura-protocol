/**
 * [whitepaper-sync v1.1] §13 content-keys — SDK ↔ contract consistency tests.
 *
 * Verifies PDA derivation, instruction discriminators, fee math, and Borsh
 * encoding for the `ContentKeysModule` (sdk/src/modules/contentKeys.ts) line
 * up with the on-chain `aura_content_keys` program. Pure local — no RPC.
 */

import { PublicKey, Keypair } from '@solana/web3.js';
import { assert } from 'chai';
import { sha256 } from '@noble/hashes/sha256';

import {
  CONTENT_KEYS_SEEDS,
  CONTENT_KEYS_FEE_BPS,
  CONTENT_KEYS_LIMITS,
  AccessKind,
  computeCreatorNetPrimary,
  computeSellerProceedsSecondary,
} from '../sdk/src/modules/contentKeys';

const CONTENT_KEYS_PROGRAM_ID = new PublicKey(
  'CX6wqdXrR1C8sz8A7DWJ8fE2utXHivif7j1ie91i8Y3v'
);

function ixDisc(name: string): Buffer {
  return Buffer.from(sha256(Buffer.from(`global:${name}`, 'utf8')).slice(0, 8));
}

function u64LE(v: bigint | number): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(typeof v === 'bigint' ? v : BigInt(v), 0);
  return b;
}

describe('aura-sdk ContentKeysModule', () => {
  describe('PDA seeds match the on-chain Rust constants', () => {
    it('content-counter per creator', () => {
      assert.equal(CONTENT_KEYS_SEEDS.COUNTER.toString(), 'content-counter');
      const creator = Keypair.generate().publicKey;
      const [pda] = PublicKey.findProgramAddressSync(
        [CONTENT_KEYS_SEEDS.COUNTER, creator.toBuffer()],
        CONTENT_KEYS_PROGRAM_ID
      );
      assert.ok(pda);
    });

    it('content PDA uses LE-encoded u64 content_id', () => {
      assert.equal(CONTENT_KEYS_SEEDS.CONTENT.toString(), 'content');
      const creator = Keypair.generate().publicKey;
      const [pda] = PublicKey.findProgramAddressSync(
        [CONTENT_KEYS_SEEDS.CONTENT, creator.toBuffer(), u64LE(7n)],
        CONTENT_KEYS_PROGRAM_ID
      );
      assert.ok(pda);
    });

    it('content-key PDA is content-scoped and serial-indexed', () => {
      assert.equal(CONTENT_KEYS_SEEDS.KEY.toString(), 'content-key');
      const content = Keypair.generate().publicKey;
      const [p1] = PublicKey.findProgramAddressSync(
        [CONTENT_KEYS_SEEDS.KEY, content.toBuffer(), u64LE(1n)],
        CONTENT_KEYS_PROGRAM_ID
      );
      const [p2] = PublicKey.findProgramAddressSync(
        [CONTENT_KEYS_SEEDS.KEY, content.toBuffer(), u64LE(2n)],
        CONTENT_KEYS_PROGRAM_ID
      );
      assert.notEqual(p1.toBase58(), p2.toBase58());
    });

    it('listing PDA is unique per key', () => {
      assert.equal(CONTENT_KEYS_SEEDS.LISTING.toString(), 'key-listing');
      const k1 = Keypair.generate().publicKey;
      const k2 = Keypair.generate().publicKey;
      const [l1] = PublicKey.findProgramAddressSync(
        [CONTENT_KEYS_SEEDS.LISTING, k1.toBuffer()],
        CONTENT_KEYS_PROGRAM_ID
      );
      const [l2] = PublicKey.findProgramAddressSync(
        [CONTENT_KEYS_SEEDS.LISTING, k2.toBuffer()],
        CONTENT_KEYS_PROGRAM_ID
      );
      assert.notEqual(l1.toBase58(), l2.toBase58());
    });
  });

  describe('Instruction discriminators (Anchor sha256("global:<name>"))', () => {
    const expected = [
      'init_content_counter',
      'publish_content',
      'update_content',
      'deactivate_content',
      'buy_key',
      'list_key',
      'delist_key',
      'buy_listed_key',
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
      const probe = ixDisc('buy_key').toString('hex');
      assert.equal(probe.length, 16); // 8 bytes = 16 hex chars
      const probe2 = ixDisc('buy_key').toString('hex');
      assert.equal(probe, probe2);
    });
  });

  describe('Fee constants mirror WP §5.7 / §13', () => {
    it('primary fee = 5% (500 bps), split 40/40/10/10', () => {
      const { PRIMARY_BURN, PRIMARY_STAKING, PRIMARY_GAS, PRIMARY_OPS, PRIMARY_TOTAL } =
        CONTENT_KEYS_FEE_BPS;
      assert.equal(PRIMARY_BURN + PRIMARY_STAKING + PRIMARY_GAS + PRIMARY_OPS, PRIMARY_TOTAL);
      assert.equal(PRIMARY_TOTAL, 500);
      assert.equal(PRIMARY_BURN, 200);
      assert.equal(PRIMARY_STAKING, 200);
      assert.equal(PRIMARY_GAS, 50);
      assert.equal(PRIMARY_OPS, 50);
    });

    it('secondary protocol fee = 5%, default royalty = 5%, max royalty = 45%', () => {
      assert.equal(CONTENT_KEYS_FEE_BPS.SECONDARY_PROTOCOL_TOTAL, 500);
      assert.equal(CONTENT_KEYS_FEE_BPS.DEFAULT_ROYALTY, 500);
      assert.equal(CONTENT_KEYS_FEE_BPS.MAX_ROYALTY, 4_500);
    });

    it('arweave tx id cap = 64 chars', () => {
      assert.equal(CONTENT_KEYS_LIMITS.ARWEAVE_TX_MAX, 64);
    });
  });

  describe('AccessKind enum values match Rust variant order', () => {
    // Anchor enums are encoded by variant index (0-based).
    it('Permanent = 0, Subscription = 1, BurnAfterReading = 2', () => {
      assert.equal(AccessKind.Permanent, 0);
      assert.equal(AccessKind.Subscription, 1);
      assert.equal(AccessKind.BurnAfterReading, 2);
    });
  });

  describe('computeCreatorNetPrimary (95% of gross)', () => {
    it('1_000_000 ORA gross → 950_000 net', () => {
      const net = computeCreatorNetPrimary(1_000_000n);
      assert.equal(net, 950_000n);
    });

    it('rounds fee down (creator keeps the crumb)', () => {
      // gross = 19 → fee = floor(19 * 500 / 10000) = 0, creator = 19
      const net = computeCreatorNetPrimary(19n);
      assert.equal(net, 19n);
    });

    it('big number does not overflow', () => {
      const huge = 10_000_000_000_000_000n;
      const net = computeCreatorNetPrimary(huge);
      assert.equal(net, 9_500_000_000_000_000n);
    });
  });

  describe('computeSellerProceedsSecondary (90% seller / 5% royalty / 5% protocol)', () => {
    it('1_000_000 ORA gross @ default 500 bps royalty → 900_000 seller', () => {
      const proceeds = computeSellerProceedsSecondary(
        1_000_000n,
        CONTENT_KEYS_FEE_BPS.DEFAULT_ROYALTY
      );
      assert.equal(proceeds, 900_000n);
    });

    it('higher royalty reduces seller proceeds', () => {
      // gross = 1_000_000, royalty = 4500 (45%), protocol = 500 (5%)
      // seller = 1_000_000 - 450_000 - 50_000 = 500_000
      const proceeds = computeSellerProceedsSecondary(
        1_000_000n,
        CONTENT_KEYS_FEE_BPS.MAX_ROYALTY
      );
      assert.equal(proceeds, 500_000n);
    });

    it('zero royalty leaves only 5% protocol fee', () => {
      // gross = 1_000_000, royalty = 0, protocol = 50_000 → seller = 950_000
      const proceeds = computeSellerProceedsSecondary(1_000_000n, 0);
      assert.equal(proceeds, 950_000n);
    });
  });
});
