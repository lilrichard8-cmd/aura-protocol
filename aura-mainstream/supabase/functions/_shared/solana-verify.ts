// Solana wallet signature verification (Ed25519) for Edge Functions.
//
// We deliberately implement base58 decoding + Ed25519 verify with
// audited libraries from JSR (no opaque npm shims). The wallet address
// IS the public key (32 bytes after base58 decode).

import nacl from 'npm:tweetnacl@1.0.3';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const B58_INDEX: Record<string, number> = {};
for (let i = 0; i < B58.length; i++) B58_INDEX[B58[i]] = i;

export function b58decode(s: string): Uint8Array {
  if (!s) return new Uint8Array(0);
  let zeros = 0;
  while (zeros < s.length && s[zeros] === '1') zeros++;
  const bytes: number[] = [];
  for (let i = zeros; i < s.length; i++) {
    const v = B58_INDEX[s[i]];
    if (v === undefined) throw new Error(`Invalid base58 char: ${s[i]}`);
    let carry = v;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  const result = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) result[zeros + bytes.length - 1 - i] = bytes[i];
  return result;
}

/** Verify an Ed25519 signature where wallet is the base58 pubkey, sig is base58 64-byte sig. */
export function verifyWalletSignature(opts: {
  wallet: string;
  message: string;
  signature: string;
}): boolean {
  try {
    const pubkey = b58decode(opts.wallet);
    if (pubkey.length !== 32) return false;
    const sig = b58decode(opts.signature);
    if (sig.length !== 64) return false;
    const msg = new TextEncoder().encode(opts.message);
    return nacl.sign.detached.verify(msg, sig, pubkey);
  } catch {
    return false;
  }
}
