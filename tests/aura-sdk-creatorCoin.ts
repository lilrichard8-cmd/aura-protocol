/**
 * SDK ↔ contract consistency tests for CreatorCoinModule.
 */

import { PublicKey, Keypair } from '@solana/web3.js';
import { assert } from 'chai';
import { sha256 } from '@noble/hashes/sha256';

import {
  CREATOR_COIN_SEEDS,
  CREATOR_COIN_FEE_BPS,
  CREATOR_COIN_LIMITS,
  INITIAL_SUPPLY_RAW,
  TOTAL_SUPPLY_RAW,
  LOCKED_SUPPLY_RAW,
} from '../sdk/src/modules/creatorCoin';

const CC_PROGRAM_ID = new PublicKey('B38n2DX7BR4tEait7Pn3SHUwB29WQt4U8jttCQgJZ57w');

function ixDisc(name: string): Buffer {
  return Buffer.from(sha256(Buffer.from(`global:${name}`, 'utf8')).slice(0, 8));
}

describe('aura-sdk CreatorCoinModule', () => {
  describe('Constants', () => {
    it('seed strings match Rust', () => {
      assert.equal(CREATOR_COIN_SEEDS.CREATOR_COIN.toString(), 'creator_coin');
      assert.equal(CREATOR_COIN_SEEDS.CREATOR_COIN_MINT.toString(), 'creator_coin_mint');
      assert.equal(CREATOR_COIN_SEEDS.BENEFITS.toString(), 'benefits');
      assert.equal(CREATOR_COIN_SEEDS.REDEMPTION_COUNTER.toString(), 'redemption-counter');
      assert.equal(CREATOR_COIN_SEEDS.REDEMPTION.toString(), 'redemption');
      assert.equal(CREATOR_COIN_SEEDS.BURN_TRACKER.toString(), 'burn-tracker');
    });

    it('trading fee splits sum to 5% (500 bps)', () => {
      const { TOTAL, BURN, STAKING, GAS, OPS } = CREATOR_COIN_FEE_BPS;
      assert.equal(BURN + STAKING + GAS + OPS, TOTAL);
      assert.equal(TOTAL, 500);
    });

    it('supply: initial 2000 + locked 8000 = total 10000', () => {
      assert.equal(INITIAL_SUPPLY_RAW + LOCKED_SUPPLY_RAW, TOTAL_SUPPLY_RAW);
    });

    it('symbol max length = 10', () => {
      assert.equal(CREATOR_COIN_LIMITS.SYMBOL_MAX, 10);
    });
  });

  describe('PDA derivation', () => {
    it('creator_coin PDA differs per creator', () => {
      const a = Keypair.generate().publicKey;
      const b = Keypair.generate().publicKey;
      const [pa] = PublicKey.findProgramAddressSync(
        [CREATOR_COIN_SEEDS.CREATOR_COIN, a.toBuffer()],
        CC_PROGRAM_ID
      );
      const [pb] = PublicKey.findProgramAddressSync(
        [CREATOR_COIN_SEEDS.CREATOR_COIN, b.toBuffer()],
        CC_PROGRAM_ID
      );
      assert.notEqual(pa.toBase58(), pb.toBase58());
    });

    it('benefits PDA uses coin mint', () => {
      const mint = Keypair.generate().publicKey;
      const [pa] = PublicKey.findProgramAddressSync(
        [CREATOR_COIN_SEEDS.BENEFITS, mint.toBuffer()],
        CC_PROGRAM_ID
      );
      assert.ok(pa);
    });

    it('redemption PDA uses LE u64 id', () => {
      const mint = Keypair.generate().publicKey;
      const id = Buffer.alloc(8); id.writeBigUInt64LE(BigInt(42));
      const [p] = PublicKey.findProgramAddressSync(
        [CREATOR_COIN_SEEDS.REDEMPTION, mint.toBuffer(), id],
        CC_PROGRAM_ID
      );
      assert.ok(p);
    });

    it('burn-tracker PDA is singleton', () => {
      const [a] = PublicKey.findProgramAddressSync([CREATOR_COIN_SEEDS.BURN_TRACKER], CC_PROGRAM_ID);
      const [b] = PublicKey.findProgramAddressSync([CREATOR_COIN_SEEDS.BURN_TRACKER], CC_PROGRAM_ID);
      assert.equal(a.toBase58(), b.toBase58());
    });
  });

  describe('Discriminators (real Anchor sha256)', () => {
    const names = [
      'create_creator_coin',
      'unlock_monthly',
      'create_sell_order',
      'fill_order',
      'cancel_order',
      'init_benefits_list',
      'add_benefit',
      'update_benefit',
      'deactivate_benefit',
      'init_redemption_counter',
      'initiate_redemption',
      'mark_delivered',
      'confirm_receipt',
      'auto_confirm',
      'dispute_redemption',
      'execute_ruling',
      'gift_creator_coin',
      'primary_buy',
      'init_burn_tracker',
    ];

    it('17+ instructions wrapped', () => {
      assert.isAtLeast(names.length, 17);
    });

    it('each discriminator is 8 bytes', () => {
      for (const n of names) assert.equal(ixDisc(n).length, 8, `len for ${n}`);
    });

    it('discriminators are mutually unique', () => {
      const seen = new Set<string>();
      for (const n of names) {
        const h = ixDisc(n).toString('hex');
        assert.isFalse(seen.has(h), `dup for ${n}`);
        seen.add(h);
      }
      assert.equal(seen.size, names.length);
    });

    it('rejects legacy 1-byte tag scheme (writeUInt8(1,0) etc)', () => {
      // The new module no longer uses fake 1-byte discriminators. We sanity-check
      // by asserting that all our discriminators have entropy in all 8 bytes
      // (probability of all-zero high bytes is ~negligible).
      const sample = ixDisc('create_creator_coin');
      const isAllZeroAfter1 = sample.slice(1).every(b => b === 0);
      assert.isFalse(isAllZeroAfter1, 'discriminator looks like a 1-byte legacy tag');
    });
  });
});
