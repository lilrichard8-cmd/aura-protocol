/**
 * SDK ↔ contract consistency tests for ContentLicenseModule.
 */

import { PublicKey, Keypair } from '@solana/web3.js';
import { assert } from 'chai';
import { sha256 } from '@noble/hashes/sha256';

import { CONTENT_LICENSE_SEEDS, CONTENT_LICENSE_LIMITS } from '../sdk/src/modules/contentLicense';

const CL_PROGRAM_ID = new PublicKey('9PK5h7iiAM87nSxRC8R9u8K8gJAEANiNNKD7AuhbWuwE');

function ixDisc(name: string): Buffer {
  return Buffer.from(sha256(Buffer.from(`global:${name}`, 'utf8')).slice(0, 8));
}

describe('aura-sdk ContentLicenseModule', () => {
  describe('Constants', () => {
    it('seeds defined', () => {
      assert.ok(CONTENT_LICENSE_SEEDS.LICENSE);
      assert.ok(CONTENT_LICENSE_SEEDS.EMBED);
      assert.ok(CONTENT_LICENSE_SEEDS.REMIX);
    });

    it('LICENSE seed string is "license"', () =>
      assert.equal(CONTENT_LICENSE_SEEDS.LICENSE.toString(), 'license'));

    it('limits object defined', () => assert.ok(CONTENT_LICENSE_LIMITS));
  });

  describe('PDA derivation', () => {
    it('license PDA differs per content', () => {
      const c1 = Keypair.generate().publicKey;
      const c2 = Keypair.generate().publicKey;
      const [p1] = PublicKey.findProgramAddressSync(
        [CONTENT_LICENSE_SEEDS.LICENSE, c1.toBuffer()],
        CL_PROGRAM_ID
      );
      const [p2] = PublicKey.findProgramAddressSync(
        [CONTENT_LICENSE_SEEDS.LICENSE, c2.toBuffer()],
        CL_PROGRAM_ID
      );
      assert.notEqual(p1.toBase58(), p2.toBase58());
    });

    it('embed PDA is unique per (content, payer)', () => {
      const content = Keypair.generate().publicKey;
      const payerA = Keypair.generate().publicKey;
      const payerB = Keypair.generate().publicKey;
      const [a] = PublicKey.findProgramAddressSync(
        [CONTENT_LICENSE_SEEDS.EMBED, content.toBuffer(), payerA.toBuffer()],
        CL_PROGRAM_ID
      );
      const [b] = PublicKey.findProgramAddressSync(
        [CONTENT_LICENSE_SEEDS.EMBED, content.toBuffer(), payerB.toBuffer()],
        CL_PROGRAM_ID
      );
      assert.notEqual(a.toBase58(), b.toBase58());
    });
  });

  describe('Discriminators', () => {
    const names = ['set_license', 'update_license', 'pay_to_embed', 'pay_to_remix'];

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
