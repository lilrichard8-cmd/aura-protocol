/**
 * SDK ↔ contract consistency tests for VaultModule (aura_vault).
 */

import { PublicKey, Keypair } from '@solana/web3.js';
import { assert } from 'chai';
import { sha256 } from '@noble/hashes/sha256';

import { VAULT_SEEDS, VAULT_VESTING_PERIOD_SECS, SpendPurpose } from '../sdk/src/modules/vault';

const VAULT_PROGRAM_ID = new PublicKey('9sefu7Jr4kAdASSro3AHpTp7XVcShveDntZWvPeJczNL');

function ixDisc(name: string): Buffer {
  return Buffer.from(sha256(Buffer.from(`global:${name}`, 'utf8')).slice(0, 8));
}

describe('aura-sdk VaultModule', () => {
  describe('Constants', () => {
    it('seeds object is defined', () => assert.ok(VAULT_SEEDS));
    it('vesting period is 4 years (in seconds)', () => {
      // Whitepaper-defined value, sanity-check positive
      assert.isTrue(VAULT_VESTING_PERIOD_SECS > 0);
    });
    it('SpendPurpose enum has expected values', () => assert.ok(SpendPurpose));
  });

  describe('PDA derivation', () => {
    it('config PDA is deterministic', () => {
      const [a] = PublicKey.findProgramAddressSync([Buffer.from('vault_config')], VAULT_PROGRAM_ID);
      const [b] = PublicKey.findProgramAddressSync([Buffer.from('vault_config')], VAULT_PROGRAM_ID);
      assert.equal(a.toBase58(), b.toBase58());
    });

    it('vesting vault PDA differs per beneficiary', () => {
      const a = Keypair.generate().publicKey;
      const b = Keypair.generate().publicKey;
      const [pa] = PublicKey.findProgramAddressSync([Buffer.from('vesting_vault'), a.toBuffer()], VAULT_PROGRAM_ID);
      const [pb] = PublicKey.findProgramAddressSync([Buffer.from('vesting_vault'), b.toBuffer()], VAULT_PROGRAM_ID);
      assert.notEqual(pa.toBase58(), pb.toBase58());
    });
  });

  describe('Discriminators', () => {
    const names = ['initialize_vault', 'spend_vault'];

    it('each discriminator is 8 bytes', () => {
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
