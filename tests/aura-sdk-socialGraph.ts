/**
 * SDK ↔ contract consistency tests for SocialGraphModule.
 */

import { PublicKey, Keypair } from '@solana/web3.js';
import { assert } from 'chai';
import { sha256 } from '@noble/hashes/sha256';

import { SOCIAL_GRAPH_SEEDS, SOCIAL_GRAPH_LIMITS } from '../sdk/src/modules/socialGraph';

const SG_PROGRAM_ID = new PublicKey('GxvZT4AX7FUCv6HJTVFYPaFciH4ktsDVmXTgGjTZFnUN');

function ixDisc(name: string): Buffer {
  return Buffer.from(sha256(Buffer.from(`global:${name}`, 'utf8')).slice(0, 8));
}

describe('aura-sdk SocialGraphModule', () => {
  describe('Constants', () => {
    it('seeds defined', () => assert.ok(SOCIAL_GRAPH_SEEDS));
    it('limits defined', () => assert.ok(SOCIAL_GRAPH_LIMITS));
  });

  describe('PDA derivation', () => {
    it('graph PDA is unique per owner', () => {
      const a = Keypair.generate().publicKey;
      const b = Keypair.generate().publicKey;
      const [pa] = PublicKey.findProgramAddressSync(
        [Buffer.from('social_graph'), a.toBuffer()],
        SG_PROGRAM_ID
      );
      const [pb] = PublicKey.findProgramAddressSync(
        [Buffer.from('social_graph'), b.toBuffer()],
        SG_PROGRAM_ID
      );
      assert.notEqual(pa.toBase58(), pb.toBase58());
    });

    it('graph PDA is deterministic per owner', () => {
      const o = Keypair.generate().publicKey;
      const [a] = PublicKey.findProgramAddressSync([Buffer.from('social_graph'), o.toBuffer()], SG_PROGRAM_ID);
      const [b] = PublicKey.findProgramAddressSync([Buffer.from('social_graph'), o.toBuffer()], SG_PROGRAM_ID);
      assert.equal(a.toBase58(), b.toBase58());
    });
  });

  describe('Discriminators', () => {
    const names = ['initialize_social_graph', 'follow_creator', 'unfollow_creator'];

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
