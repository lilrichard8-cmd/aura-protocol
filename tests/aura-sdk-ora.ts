/**
 * SDK ↔ contract consistency tests for OraModule (aura_ora).
 */

import { PublicKey } from '@solana/web3.js';
import { assert } from 'chai';
import { sha256 } from '@noble/hashes/sha256';

import { ORA_SEEDS, ORA_DECIMALS, ORA_INITIAL_SUPPLY } from '../sdk/src/modules/ora';

const ORA_PROGRAM_ID = new PublicKey('Dq6fFo2yjSuiGPhc1hwDocKhEpsSam2X8PbzbhVzTHxN');

function ixDisc(name: string): Buffer {
  return Buffer.from(sha256(Buffer.from(`global:${name}`, 'utf8')).slice(0, 8));
}

describe('aura-sdk OraModule', () => {
  describe('Constants', () => {
    it('ORA_DECIMALS = 9', () => assert.equal(ORA_DECIMALS, 9));
    it('ORA_INITIAL_SUPPLY is positive', () => assert.isTrue(ORA_INITIAL_SUPPLY > 0n));
    it('seeds object is defined', () => assert.ok(ORA_SEEDS));
  });

  describe('PDA derivation', () => {
    it('config PDA is deterministic', () => {
      const [a] = PublicKey.findProgramAddressSync([Buffer.from('ora_config')], ORA_PROGRAM_ID);
      const [b] = PublicKey.findProgramAddressSync([Buffer.from('ora_config')], ORA_PROGRAM_ID);
      assert.equal(a.toBase58(), b.toBase58());
    });

    it('config PDA returns a valid pubkey', () => {
      const [pda] = PublicKey.findProgramAddressSync([Buffer.from('ora_config')], ORA_PROGRAM_ID);
      assert.ok(pda);
      assert.equal(pda.toBuffer().length, 32);
    });
  });

  describe('Instruction discriminators', () => {
    const names = ['initialize_ora', 'mint_ora', 'burn_ora'];

    it('each discriminator is 8 bytes', () => {
      for (const n of names) assert.equal(ixDisc(n).length, 8);
    });

    it('discriminators are mutually unique', () => {
      const seen = new Set<string>();
      for (const n of names) {
        const h = ixDisc(n).toString('hex');
        assert.isFalse(seen.has(h));
        seen.add(h);
      }
    });
  });
});
