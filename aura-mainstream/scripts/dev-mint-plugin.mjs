/**
 * vite-plugin-aura-dev-mint
 *
 * Localnet-only middleware that exposes:
 *
 *   GET /__dev/mint-ora?addr=<base58>&amount=<int, default 1000>
 *
 * Behavior:
 *   - Refuses to run unless VITE_SOLANA_CLUSTER=localnet (or RPC has 127.0.0.1).
 *   - Refuses to run if VITE_DEV_MINT_ENABLED === 'false'.
 *   - Uses the `spl-token` CLI with the admin keypair stored at
 *     ~/.config/solana/id.json (the local mint authority for ORA).
 *   - Calls `spl-token mint <MINT> <amount> <recipient>` which auto-creates
 *     the recipient's ATA if missing.
 *   - Returns { ok: true, signature?, stdout, stderr } or { ok: false, error }.
 *
 * SECURITY: this plugin is ONLY active in `vite serve` (dev mode). It is
 * never bundled into the production build, so the admin keypair never
 * leaves the developer's machine.
 */

import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const SOLANA_BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function safeJson(body) {
  try {
    return JSON.stringify(body);
  } catch {
    return JSON.stringify({ ok: false, error: 'failed to serialize response' });
  }
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(safeJson(body));
}

function runCmd(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => {
      resolve({ ok: false, error: `spawn failed: ${err.message}`, stdout, stderr });
    });
    child.on('close', (code) => {
      resolve({ ok: code === 0, code, stdout, stderr });
    });
  });
}

function extractSignature(stdout) {
  try {
    const parsed = JSON.parse(stdout);
    return parsed.signature ?? parsed.txid;
  } catch {
    const m = stdout.match(/Signature:\s*([A-Za-z0-9]+)/);
    return m ? m[1] : undefined;
  }
}

async function runSplTokenMint({ mint, amount, recipient, keypair, rpcUrl }) {
  // Mint to the owner's ATA (auto-resolves via --recipient-owner).
  // If the ATA doesn't exist yet, spl-token CLI creates it as part of the mint.
  const args = [
    'mint',
    mint,
    String(amount),
    '--recipient-owner', recipient,
    '--mint-authority', keypair,
    '--fee-payer', keypair,
    '--url', rpcUrl,
    '--output', 'json',
  ];
  const r = await runCmd('spl-token', args);
  if (r.ok) {
    return { ok: true, signature: extractSignature(r.stdout), stdout: r.stdout, stderr: r.stderr };
  }
  // Common cause: recipient ATA doesn't exist and this version of spl-token
  // CLI doesn't auto-create on mint. Try the explicit two-step path.
  if (/not exist|does not exist|InvalidAccountData|not found|0x1[0-9a-f]/i.test(r.stderr)) {
    const createArgs = [
      'create-account',
      mint,
      '--owner', recipient,
      '--fee-payer', keypair,
      '--url', rpcUrl,
    ];
    const c = await runCmd('spl-token', createArgs);
    if (!c.ok && !/already in use|already exists/i.test(c.stderr)) {
      return { ok: false, error: `create-account failed: ${c.stderr || c.stdout}`, stdout: c.stdout, stderr: c.stderr };
    }
    const r2 = await runCmd('spl-token', args);
    if (r2.ok) {
      return { ok: true, signature: extractSignature(r2.stdout), stdout: r2.stdout, stderr: r2.stderr };
    }
    return { ok: false, error: `mint failed after ATA create: ${r2.stderr || r2.stdout}`, stdout: r2.stdout, stderr: r2.stderr };
  }
  return { ok: false, error: `spl-token exited ${r.code}: ${r.stderr || r.stdout}`, stdout: r.stdout, stderr: r.stderr };
}

export default function auraDevMintPlugin(opts = {}) {
  const {
    oraMint = process.env.VITE_ORA_MINT,
    rpcUrl = process.env.VITE_RPC_URL || 'http://127.0.0.1:8899',
    keypair = path.join(os.homedir(), '.config/solana/id.json'),
    defaultAmount = 1000,
    enabled: enabledOpt,
  } = opts;

  const isLocalnet = (
    process.env.VITE_SOLANA_CLUSTER === 'localnet'
    || /127\.0\.0\.1|localhost/.test(rpcUrl)
  );
  // Allow explicit kill-switch via env, but default to localnet detection.
  const enabled = enabledOpt ?? (
    isLocalnet && process.env.VITE_DEV_MINT_ENABLED !== 'false'
  );

  return {
    name: 'aura-dev-mint',
    apply: 'serve',
    configureServer(server) {
      if (!enabled) {
        // eslint-disable-next-line no-console
        console.warn('[aura-dev-mint] disabled (not localnet or VITE_DEV_MINT_ENABLED=false)');
        return;
      }

      // C-3 — In-flight dedupe map: prevents StrictMode double-mount, HMR
      // reloads, and rapid-fire requests from triggering multiple parallel
      // spl-token CLI invocations for the same (addr, amount). Entries are
      // evicted 5 s after the underlying promise resolves.
      //
      // Key: `${addr}:${amount}`. Two different amounts to the same addr
      // are intentionally allowed to coexist (legitimate top-up scenario).
      /** @type {Map<string, Promise<{ok:boolean,signature?:string,error?:string,stdout?:string,stderr?:string}>>} */
      const inFlight = new Map();
      if (!oraMint) {
        // eslint-disable-next-line no-console
        console.warn('[aura-dev-mint] VITE_ORA_MINT not set — endpoint will refuse requests');
      }
      if (!fs.existsSync(keypair)) {
        // eslint-disable-next-line no-console
        console.warn(`[aura-dev-mint] admin keypair missing at ${keypair} — endpoint will refuse requests`);
      } else {
        // eslint-disable-next-line no-console
        console.info(`[aura-dev-mint] ready — POST /__dev/mint-ora (mint=${oraMint?.slice(0, 6)}…, rpc=${rpcUrl})`);
      }

      server.middlewares.use(async (req, res, next) => {
        if (!req.url) { next(); return; }
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname !== '/__dev/mint-ora') { next(); return; }
        if (req.method !== 'GET' && req.method !== 'POST') {
          send(res, 405, { ok: false, error: 'method not allowed' });
          return;
        }
        // C-2 — enforce loopback origin regardless of vite host binding.
        // The admin keypair is the ORA mint authority; allowing LAN access
        // (vite --host) would let any peer mint unlimited ORA. We always
        // require the connecting socket to be loopback.
        const remote = req.socket?.remoteAddress;
        if (
          remote !== '127.0.0.1'
          && remote !== '::1'
          && remote !== '::ffff:127.0.0.1'
        ) {
          send(res, 403, { ok: false, error: 'localhost only' });
          return;
        }
        if (!enabled) {
          send(res, 403, { ok: false, error: 'dev mint disabled' });
          return;
        }
        if (!oraMint) {
          send(res, 500, { ok: false, error: 'VITE_ORA_MINT not configured' });
          return;
        }
        if (!fs.existsSync(keypair)) {
          send(res, 500, { ok: false, error: `keypair missing: ${keypair}` });
          return;
        }
        const addr = url.searchParams.get('addr');
        const amountRaw = url.searchParams.get('amount');
        if (!addr || !SOLANA_BASE58.test(addr)) {
          send(res, 400, { ok: false, error: 'invalid addr param' });
          return;
        }
        let amount = defaultAmount;
        if (amountRaw) {
          const n = Number(amountRaw);
          if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) {
            send(res, 400, { ok: false, error: 'invalid amount (must be 1..1000000)' });
            return;
          }
          amount = n;
        }
        // C-3 — coalesce concurrent identical requests onto a single
        // spl-token CLI invocation. Anything that arrives while a mint is
        // in flight awaits the same promise and gets the same response.
        const dedupeKey = `${addr}:${amount}`;
        let pending = inFlight.get(dedupeKey);
        const isPiggyback = !!pending;
        if (!pending) {
          pending = runSplTokenMint({
            mint: oraMint,
            amount,
            recipient: addr,
            keypair,
            rpcUrl,
          }).catch((err) => ({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          }));
          inFlight.set(dedupeKey, pending);
          // Evict 5 s after settle — enough for any straggler StrictMode
          // double-mount to land on the cached promise.
          pending.finally(() => {
            setTimeout(() => inFlight.delete(dedupeKey), 5000);
          });
        }
        try {
          const result = await pending;
          if (!result.ok) {
            send(res, 500, result);
            return;
          }
          send(res, 200, {
            ok: true,
            signature: result.signature,
            amount,
            mint: oraMint,
            recipient: addr,
            ...(isPiggyback ? { dedupedTo: dedupeKey } : {}),
          });
        } catch (err) {
          send(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
        }
      });
    },
  };
}
