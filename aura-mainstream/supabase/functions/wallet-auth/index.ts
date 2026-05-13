// Edge Function: wallet-auth
//
// Verifies a Solana wallet signature over a SIWS-style login message
// and returns a 1-hour session token the frontend uses for subsequent
// write actions.
//
// Request:
//   POST {
//     wallet:    base58 Solana pubkey
//     signature: base58 ed25519 signature
//     nonce:     uuid (must be unused)
//     issuedAt:  ISO timestamp (must be within ±5 min)
//     domain:    origin host (must match Origin header)
//   }
//
// Response:
//   { token, wallet, expiresAt }
//
// Hardening:
//   • Origin header must match `domain` and be in the CORS allowlist.
//   • issuedAt skew ±5 min hard limit.
//   • Nonce is one-shot (wallet_auth_nonces unique constraint).
//   • Signature verified against the canonical message (server-rebuilt,
//     never trusts a client-provided message string).

import { jsonResponse, preflight } from '../_shared/cors.ts';
import { verifyWalletSignature } from '../_shared/solana-verify.ts';
import { consumeNonce, createSession } from '../_shared/session.ts';

const SESSION_TTL_MS = 60 * 60 * 1000; // 1h
const SKEW_MS = 5 * 60 * 1000; // ±5 min

function buildLoginMessage(opts: {
  domain: string;
  wallet: string;
  nonce: string;
  issuedAt: string;
}): string {
  return [
    `${opts.domain} wants you to sign in with your Solana account:`,
    opts.wallet,
    '',
    'Welcome to AURA. This signature proves you control this wallet.',
    'No on-chain transaction, no gas. Token expires in 1 hour.',
    '',
    `URI: https://${opts.domain}`,
    'Version: 1',
    'Chain ID: solana:mainnet',
    `Nonce: ${opts.nonce}`,
    `Issued At: ${opts.issuedAt}`,
  ].join('\n');
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const origin = req.headers.get('origin');
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, origin);

  let body: { wallet?: string; signature?: string; nonce?: string; issuedAt?: string; domain?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400, origin);
  }
  const { wallet, signature, nonce, issuedAt, domain } = body;
  if (!wallet || !signature || !nonce || !issuedAt || !domain) {
    return jsonResponse({ error: 'missing_fields' }, 400, origin);
  }

  // 1. Origin / domain binding
  if (!origin) return jsonResponse({ error: 'origin_required' }, 400, origin);
  try {
    const originHost = new URL(origin).host;
    if (originHost !== domain) {
      return jsonResponse({ error: 'origin_domain_mismatch' }, 400, origin);
    }
  } catch {
    return jsonResponse({ error: 'invalid_origin' }, 400, origin);
  }

  // 2. Timestamp skew
  const ts = Date.parse(issuedAt);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > SKEW_MS) {
    return jsonResponse({ error: 'timestamp_skew' }, 400, origin);
  }

  // 3. Nonce single-use
  const fresh = await consumeNonce(nonce).catch(() => null);
  if (fresh === false) return jsonResponse({ error: 'nonce_reused' }, 400, origin);
  if (fresh === null) return jsonResponse({ error: 'nonce_store_error' }, 500, origin);

  // 4. Signature verification against server-rebuilt message
  const message = buildLoginMessage({ domain, wallet, nonce, issuedAt });
  if (!verifyWalletSignature({ wallet, message, signature })) {
    return jsonResponse({ error: 'invalid_signature' }, 401, origin);
  }

  // 5. Issue session
  let session;
  try {
    session = await createSession(wallet, SESSION_TTL_MS);
  } catch (e) {
    return jsonResponse({ error: 'session_create_failed', detail: String(e) }, 500, origin);
  }

  return jsonResponse({
    token: session.token,
    wallet: session.wallet,
    expiresAt: new Date(session.expires_at).getTime(),
  }, 200, origin);
});
