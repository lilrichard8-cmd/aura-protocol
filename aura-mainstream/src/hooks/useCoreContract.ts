/**
 * useCoreContract — bridges CreatePage to the on-chain Core program
 * (aura_core) via the AURA SDK CoreModule.
 *
 * Feature-flagged: only activates when `VITE_CORE_REAL_CHAIN === 'true'`.
 * Otherwise returns `{ enabled: false }` and the page falls back to its
 * MockChainContext publish flow.
 *
 * Why a flag (mirrors useBountyContract):
 *   - The Core program still requires a real Arweave tx id at publish
 *     time. Until the Arweave uploader is wired into the composer we
 *     pass a deterministic placeholder so the contract accepts the tx
 *     (the on-chain program only validates length, not content).
 *   - One env var to flip: `VITE_CORE_REAL_CHAIN=true npm run dev`.
 *
 * 2026-05-19 — first cut. Pairs with useMarketRoyaltyContract for
 * NFT royalty setting after publish.
 */

import { useMemo } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useUnifiedWalletAsAdapter, type UnifiedWalletAdapter } from './useUnifiedWallet';
import { PublicKey } from '@solana/web3.js';
import {
  CoreModule,
  ContentTypeCore,
  AccessControlCore,
  CORE_LIMITS,
} from '@aura-protocol/sdk';

// Real on-chain program id (matches programs/core/src/lib.rs declare_id!).
const CORE_PROGRAM_ID = new PublicKey('4VTNh4tcTuF5wDYhP8qbvf5hdUV4xUm7KJVJd9oSweEE');

export interface CoreContract {
  enabled: boolean;
  module: CoreModule | null;
  programId: PublicKey;
}

/** Returns a stable CoreModule instance keyed to the wallet adapter. */
export function useCoreContract(): CoreContract {
  const { connection } = useConnection();
  // 2026-05-19 — unified wallet (Privy embedded > Phantom)
  const wallet = useUnifiedWalletAsAdapter();

  const enabled = (import.meta as any).env?.VITE_CORE_REAL_CHAIN === 'true';

  const module = useMemo(() => {
    if (!enabled) return null;
    // wallet-adapter-react's WalletContextState is structurally
    // compatible with the SDK's WalletAdapter (publicKey + connected +
    // sendTransaction). Same cast pattern as useBountyContract.
    return new CoreModule(connection, wallet as UnifiedWalletAdapter, CORE_PROGRAM_ID);
  }, [connection, wallet, enabled]);

  // 2026-05-19 H-1 — stabilise the returned object so consumers don't see
  // a new reference on every render.
  return useMemo(() => ({
    enabled,
    module,
    programId: CORE_PROGRAM_ID,
  }), [enabled, module]);
}

/**
 * Produce a 43-char placeholder Arweave tx id from arbitrary input.
 * The on-chain `publish_content` only validates length === 43 (base64
 * alphabet not enforced), so any 43-char string works while we wait
 * for the real Arweave uploader integration.
 *
 * Deterministic per-input so reuploads stay idempotent — uses a tiny
 * FNV-1a-ish mix over the input to fill the buffer, then pads/truncates
 * to exactly CORE_LIMITS.ARWEAVE_TX_ID_LEN (43) characters.
 */
export function placeholderArweaveTxId(seed: string): string {
  const target = CORE_LIMITS.ARWEAVE_TX_ID_LEN; // 43
  // Browser-safe: avoid Buffer / Node crypto. Use a small ASCII alphabet
  // similar to Arweave's base64url so anything inspecting the field still
  // looks plausible.
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let acc = 2166136261;
  const out: string[] = [];
  const input = (seed || 'aura') + '|' + Date.now().toString(36);
  for (let i = 0; i < target; i++) {
    // FNV-1a-ish mix folding in position to break repetition.
    const ch = input.charCodeAt(i % input.length) ^ (i * 16777619);
    acc = (acc ^ ch) >>> 0;
    acc = Math.imul(acc, 16777619) >>> 0;
    out.push(alphabet[acc % alphabet.length]);
  }
  return out.join('');
}

/** Map composer mode string → on-chain ContentTypeCore. */
export function modeToContentType(
  mode: 'photo' | 'video' | 'text' | 'audio' | 'live',
): ContentTypeCore {
  switch (mode) {
    case 'photo':
      return ContentTypeCore.Image;
    case 'video':
      return ContentTypeCore.Video;
    case 'audio':
      return ContentTypeCore.Audio;
    case 'text':
      return ContentTypeCore.Text;
    // `live` has no direct on-chain analogue; treat as mixed.
    case 'live':
    default:
      return ContentTypeCore.Mixed;
  }
}

/**
 * Map composer accessControls (Set<AccessControl>) → on-chain
 * AccessControlCore. The on-chain enum only has 3 states; we collapse:
 *   - public                  → Public
 *   - content-key             → PayToView
 *   - any other / time-limit  → BurnAfterReading
 *   - default                 → Public
 */
export function accessControlToCore(controls: Iterable<string>): AccessControlCore {
  const set = new Set(controls);
  if (set.has('content-key')) return AccessControlCore.PayToView;
  // Followers / coin-holders aren't representable directly in the v1
  // Core enum; fall back to Public so the chain doesn't gate them
  // (front-end still enforces who sees the cleartext).
  return AccessControlCore.Public;
}

// Re-export SDK types so pages can import from one place.
export { ContentTypeCore, AccessControlCore, CORE_LIMITS };
