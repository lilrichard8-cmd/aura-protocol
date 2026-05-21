/**
 * /api/faucet — ORA test-token faucet for AURA devnet.
 *
 * Lets a creator who just signed up grab 1000 ORA so they can immediately try
 * curation, tipping, key-buys, etc. without standing in front of a paywall on
 * day one. **Strictly devnet-only.** Mainnet should return 410 and the front
 * end should hide the button (VITE_FAUCET_ENABLED=false).
 *
 * Contract:
 *   POST /api/faucet
 *   body: { "walletAddress": "<base58 Solana pubkey>" }
 *   ok    → 200 { ok: true, signature, amount }
 *   limit → 429 { ok: false, error: "rate_limited", retryAfterSec, lastClaimAt }
 *   bad   → 400 { ok: false, error: "..." }
 *   down  → 500 { ok: false, error: "..." }
 *
 * Rate limit: **per-wallet 1 claim / 24h** (Upstash Redis SET NX EX 86400).
 *             **per-IP 10 claims / hour** (defense against drain bots).
 *             If Upstash isn't configured we **fail closed** (503) — the
 *             whole point of the faucet is to be cheap-but-bounded, and an
 *             unbounded faucet on shared infra is how reserves vanish.
 *
 * TODO (post-MVP): wire hCaptcha or Cloudflare Turnstile to neuter bots.
 *
 * Runtime: Vercel Edge. Cold start ~50ms. No Node-only deps allowed here —
 * we lean on @solana/web3.js + @solana/spl-token which both ship Edge-safe
 * builds, and @upstash/redis which is HTTP-based (no TCP socket).
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  getAccount,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import bs58 from 'bs58';
// Upstash Redis is HTTP-based, so it works in Edge runtime. If you'd rather
// host on Node runtime, swap to `ioredis` and drop `runtime: 'edge'` below.
import { Redis } from '@upstash/redis';

export const config = {
  // Vercel Edge gives us global routing + ~50ms cold starts. The Solana
  // libs we use here are all isomorphic, so this is safe.
  runtime: 'edge',
};

// ─── Config ──────────────────────────────────────────────────────────────

/** Default amount minted per claim (1000 ORA, 9 decimals). */
const CLAIM_AMOUNT_ORA = 1000;
const ORA_DECIMALS = 9;
const CLAIM_LAMPORTS = BigInt(CLAIM_AMOUNT_ORA) * BigInt(10 ** ORA_DECIMALS);

/** Per-wallet cooldown. */
const WALLET_COOLDOWN_SEC = 24 * 60 * 60; // 24h
/** Per-IP rate limit window + max claims. */
const IP_WINDOW_SEC = 60 * 60;            // 1h
const IP_MAX_CLAIMS = 10;

const SOLANA_BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// ─── Helpers ─────────────────────────────────────────────────────────────

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

/** Load the faucet keypair from FAUCET_KEYPAIR_SECRET. Accepts:
 *   - base58 64-byte secret (what `solana-keygen` outputs in --outfile JSON
 *     when concatenated, OR what `bs58.encode(kp.secretKey)` yields)
 *   - JSON array `[1,2,3,...]` (the format of `~/.config/solana/id.json`)
 *   - base64 64 bytes (less common — accepted as a last resort)
 */
function loadFaucetKeypair(secret: string): Keypair {
  const trimmed = secret.trim();
  // JSON array form (Solana CLI keypair file)
  if (trimmed.startsWith('[')) {
    const arr = JSON.parse(trimmed) as number[];
    if (!Array.isArray(arr) || arr.length !== 64) {
      throw new Error('FAUCET_KEYPAIR_SECRET JSON array must be 64 bytes');
    }
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  }
  // base58 (most compact)
  try {
    const bytes = bs58.decode(trimmed);
    if (bytes.length === 64) return Keypair.fromSecretKey(bytes);
  } catch {
    // fallthrough — try base64
  }
  // base64 fallback
  try {
    const bytes = Uint8Array.from(atob(trimmed), c => c.charCodeAt(0));
    if (bytes.length === 64) return Keypair.fromSecretKey(bytes);
  } catch {
    // ignore
  }
  throw new Error('FAUCET_KEYPAIR_SECRET must be base58 (64 bytes), JSON array, or base64 (64 bytes)');
}

/** Lazy-init Redis. We do this per request to avoid binding to a single
 *  Edge isolate's module-level cache (Edge isolates are warm-pooled but
 *  not necessarily isolated per project — be defensive). */
function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.FAUCET_RATE_LIMIT_KV_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.FAUCET_RATE_LIMIT_KV_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// ─── Handler ─────────────────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  // CORS — same-origin only by default. Loosen here if the faucet needs to be
  // callable from a different domain (e.g. a docs site embedding).
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
        'access-control-max-age': '86400',
      },
    });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  // ── Env ───────────────────────────────────────────────────────────────
  const NETWORK = process.env.FAUCET_NETWORK ?? 'devnet';
  if (NETWORK === 'mainnet' || NETWORK === 'mainnet-beta') {
    // Hard guard — never accidentally drain mainnet through this endpoint.
    return json({ ok: false, error: 'faucet_disabled_on_mainnet' }, 410);
  }
  const RPC_URL = process.env.FAUCET_RPC_URL ?? 'https://api.devnet.solana.com';
  const ORA_MINT = process.env.FAUCET_ORA_MINT;
  const KEY_SECRET = process.env.FAUCET_KEYPAIR_SECRET;

  if (!ORA_MINT) return json({ ok: false, error: 'faucet_misconfigured_missing_mint' }, 500);
  if (!KEY_SECRET) return json({ ok: false, error: 'faucet_misconfigured_missing_key' }, 500);

  // ── Parse + validate ─────────────────────────────────────────────────
  let body: { walletAddress?: string };
  try {
    body = (await req.json()) as { walletAddress?: string };
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }
  const walletAddress = body.walletAddress?.trim();
  if (!walletAddress || !SOLANA_BASE58.test(walletAddress)) {
    return json({ ok: false, error: 'invalid_wallet_address' }, 400);
  }
  let recipientPk: PublicKey;
  try {
    recipientPk = new PublicKey(walletAddress);
  } catch {
    return json({ ok: false, error: 'invalid_wallet_address' }, 400);
  }

  // ── Rate limit (Upstash) ─────────────────────────────────────────────
  const redis = getRedis();
  if (!redis) {
    // Fail closed. An unbounded faucet is worse than no faucet — anyone
    // could drain the mint authority. If you really want to run without
    // a rate-limit backend (e.g. for local smoke testing), set
    // FAUCET_ALLOW_NO_RATE_LIMIT=true. **Do not set this in production.**
    if (process.env.FAUCET_ALLOW_NO_RATE_LIMIT !== 'true') {
      return json({ ok: false, error: 'faucet_misconfigured_missing_rate_limit_kv' }, 503);
    }
  }

  if (redis) {
    // Per-wallet cooldown — atomic SET NX EX. Returns "OK" on success,
    // null when the key already exists.
    const walletKey = `faucet:wallet:${walletAddress}`;
    const setRes = await redis.set(walletKey, Date.now(), { nx: true, ex: WALLET_COOLDOWN_SEC });
    if (setRes !== 'OK') {
      // Already claimed — surface a useful retry-after value.
      const lastClaimAtRaw = await redis.get<number>(walletKey);
      const lastClaimAt = typeof lastClaimAtRaw === 'number' ? lastClaimAtRaw : null;
      const ttl = await redis.ttl(walletKey); // seconds
      return json({
        ok: false,
        error: 'rate_limited_wallet',
        message: `This wallet already claimed in the last 24h.`,
        retryAfterSec: ttl > 0 ? ttl : WALLET_COOLDOWN_SEC,
        lastClaimAt,
      }, 429, {
        'retry-after': String(ttl > 0 ? ttl : WALLET_COOLDOWN_SEC),
      });
    }

    // Per-IP claims/hour — INCR + EXPIRE-if-new.
    const ip = getClientIp(req);
    const ipKey = `faucet:ip:${ip}`;
    const ipCount = await redis.incr(ipKey);
    if (ipCount === 1) {
      await redis.expire(ipKey, IP_WINDOW_SEC);
    }
    if (ipCount > IP_MAX_CLAIMS) {
      // Roll back the wallet key so the user can retry from a different
      // IP / after the IP cooldown (the wallet wasn't actually funded).
      await redis.del(walletKey);
      const ttl = await redis.ttl(ipKey);
      return json({
        ok: false,
        error: 'rate_limited_ip',
        message: `Too many claims from this IP. Try again in ~${Math.ceil(ttl / 60)} min.`,
        retryAfterSec: ttl > 0 ? ttl : IP_WINDOW_SEC,
      }, 429, {
        'retry-after': String(ttl > 0 ? ttl : IP_WINDOW_SEC),
      });
    }
  }

  // ── Mint ─────────────────────────────────────────────────────────────
  let signature: string;
  try {
    const faucetKp = loadFaucetKeypair(KEY_SECRET);
    const mintPk = new PublicKey(ORA_MINT);
    const conn = new Connection(RPC_URL, 'confirmed');

    const ata = await getAssociatedTokenAddress(mintPk, recipientPk, true);

    // Check if ATA exists; if not, prepend a create instruction.
    let ataExists = false;
    try {
      await getAccount(conn, ata);
      ataExists = true;
    } catch {
      ataExists = false;
    }

    const tx = new Transaction();
    if (!ataExists) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          faucetKp.publicKey, // payer
          ata,
          recipientPk,        // owner of the ATA
          mintPk,
          TOKEN_PROGRAM_ID,
        ),
      );
    }
    tx.add(
      createMintToInstruction(
        mintPk,
        ata,
        faucetKp.publicKey, // mint authority
        CLAIM_LAMPORTS,     // u64 — bigint OK
        [],
        TOKEN_PROGRAM_ID,
      ),
    );

    // sendAndConfirmTransaction internally fetches a blockhash + signs.
    signature = await sendAndConfirmTransaction(conn, tx, [faucetKp], {
      commitment: 'confirmed',
      skipPreflight: false,
    });
  } catch (err) {
    // Roll back the wallet cooldown so the user can retry. We don't roll
    // back the IP counter — repeated failures still smell like abuse.
    if (redis) {
      try {
        await redis.del(`faucet:wallet:${walletAddress}`);
      } catch {
        // ignore
      }
    }
    const msg = err instanceof Error ? err.message : String(err);
    return json({ ok: false, error: 'mint_failed', message: msg }, 500);
  }

  return json({
    ok: true,
    signature,
    amount: CLAIM_AMOUNT_ORA,
    mint: ORA_MINT,
    recipient: walletAddress,
    network: NETWORK,
  });
}
