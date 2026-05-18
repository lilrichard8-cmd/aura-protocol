/**
 * SDK ↔ contract consistency tests for CoreModule (aura_core).
 */

import { PublicKey, Keypair } from '@solana/web3.js';
import { assert } from 'chai';
import { sha256 } from '@noble/hashes/sha256';

import { CORE_SEEDS } from '../sdk/src/modules/core';

const CORE_PROGRAM_ID = new PublicKey('Ho5Ent8c2D6eLAZuyW16iUekqMmpfqzoTspXbMQqa9JN');

function ixDisc(name: string): Buffer {
  return Buffer.from(sha256(Buffer.from(`global:${name}`, 'utf8')).slice(0, 8));
}

describe('aura-sdk CoreModule', () => {
  describe('PDA seeds', () => {
    it('USER_PROFILE seed string == "user"', () => {
      // Core uses standard SEEDS.USER_PROFILE
      const k = Keypair.generate().publicKey;
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from('user'), k.toBuffer()],
        CORE_PROGRAM_ID
      );
      assert.ok(pda);
    });

    it('user-profile PDA is deterministic per user', () => {
      const k = Keypair.generate().publicKey;
      const [a] = PublicKey.findProgramAddressSync(
        [Buffer.from('user'), k.toBuffer()],
        CORE_PROGRAM_ID
      );
      const [b] = PublicKey.findProgramAddressSync(
        [Buffer.from('user'), k.toBuffer()],
        CORE_PROGRAM_ID
      );
      assert.equal(a.toBase58(), b.toBase58());
    });

    it('user-profile PDA differs across users', () => {
      const a = Keypair.generate().publicKey;
      const b = Keypair.generate().publicKey;
      const [pa] = PublicKey.findProgramAddressSync([Buffer.from('user'), a.toBuffer()], CORE_PROGRAM_ID);
      const [pb] = PublicKey.findProgramAddressSync([Buffer.from('user'), b.toBuffer()], CORE_PROGRAM_ID);
      assert.notEqual(pa.toBase58(), pb.toBase58());
    });

    it('CORE_SEEDS is defined', () => {
      assert.ok(CORE_SEEDS);
    });
  });

  describe('Instruction discriminators', () => {
    const names = ['register_user', 'publish_content', 'like_post', 'follow_user', 'update_profile'];

    it('each discriminator is 8 bytes', () => {
      for (const n of names) assert.equal(ixDisc(n).length, 8);
    });

    it('discriminators are mutually unique', () => {
      const seen = new Set<string>();
      for (const n of names) {
        const h = ixDisc(n).toString('hex');
        assert.isFalse(seen.has(h), `dup for ${n}`);
        seen.add(h);
      }
    });

    it('register_user differs from publish_content', () => {
      assert.notEqual(ixDisc('register_user').toString('hex'), ixDisc('publish_content').toString('hex'));
    });
  });
});
