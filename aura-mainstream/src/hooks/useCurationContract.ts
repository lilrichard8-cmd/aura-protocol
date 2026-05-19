/**
 * useCurationContract — bridges Curation page + CurateModal to the on-chain
 * `aura_curation` program via the AURA SDK CurationModule.
 *
 * Feature-flagged: only activates when `VITE_CURATION_REAL_CHAIN === 'true'`.
 * Otherwise returns `{ enabled: false }` and the page should fall back to
 * MockChainContext (mockChain.curateContent / curationStats / reputationScore).
 *
 * Tier 1.5 wire-up (2026-05-19). Mirrors useBountyContract / useStakingContract
 * patterns.
 *
 * --- Important notes (read before turning the flag on for production) ---
 *
 * 1. `content_id` semantics: the on-chain curation program treats each content
 *    item as a Solana account (PublicKey). The frontend stores posts by string
 *    id (mock chain). For real-chain curation we need a stable Pubkey per post.
 *    Convention used here (and validated by callers):
 *      • Posts published via CoreModule have an on-chain PostV2 PDA — that PDA
 *        IS the content id (`new PublicKey(post.onChainId)`).
 *      • Posts that only exist in the mock chain CANNOT be curated on-chain;
 *        the caller should detect a non-base58 id and fall back to mock.
 *
 * 2. Pool initialization is restricted: `initializePool` MUST be called once
 *    by the protocol admin per post (with `creatorFollowerCount`). The
 *    frontend will NOT call this automatically — if the pool doesn't exist
 *    when the user tries to curate, `curate()` returns
 *    `error: 'pool-not-initialized'` and the UI shows a "creator hasn't
 *    enabled curation yet" message. Admins can initialize manually with
 *    `scripts/init-curation-pool.mjs <content_id> <follower_count>`.
 *
 * 3. `CURATION_FEE_SINK` is hardcoded in the on-chain program. The SDK
 *    requires the caller to pass the same address; we surface it via the
 *    `VITE_CURATION_FEE_SINK` env var (falls back to the protocol's
 *    deployed sink). The 1 ORA per curation flows into this sink.
 *
 * 4. As of 2026-05-19, `aura_curation` is NOT actually deployed to the
 *    running test validator (.so exists in target/deploy/ but `solana
 *    program show` returns AccountNotFound). With this hook enabled,
 *    every curation call will fail at submit time until Iris main
 *    re-deploys the program.
 */

import { useMemo, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { useUnifiedWalletAsAdapter, type UnifiedWalletAdapter } from './useUnifiedWallet';
import {
  CurationModule,
  PROGRAM_IDS,
} from '@aura-protocol/sdk';
import type {
  CurationPoolOnChain,
  CurationRecordOnChain,
} from '@aura-protocol/sdk/dist/modules/curation';

// Real on-chain program id (matches SDK PROGRAM_IDS.LOCALNET.curation).
const DEFAULT_CURATION_PROGRAM_ID = PROGRAM_IDS.LOCALNET.curation;

// Default curation fee sink address — taken from the on-chain
// programs/curation/src/lib.rs CURATION_FEE_SINK constant (currently the
// placeholder DppCZV1QDh6D4hoUJvpQCjiZ5KCjV4YTokUGsu7m4bxP).
const DEFAULT_CURATION_FEE_SINK = new PublicKey(
  'DppCZV1QDh6D4hoUJvpQCjiZ5KCjV4YTokUGsu7m4bxP',
);

function readPubkey(name: string, fallback: PublicKey): PublicKey {
  const raw = (import.meta as any).env?.[name] as string | undefined;
  if (!raw) return fallback;
  try {
    return new PublicKey(raw);
  } catch {
    console.warn(`[useCurationContract] invalid pubkey for ${name}, falling back`);
    return fallback;
  }
}

/** Parse a string post id into a PublicKey if it's a valid base58 32-byte address. */
export function tryParseContentId(id: string): PublicKey | null {
  if (!id) return null;
  if (id.length < 32 || id.length > 44) return null;
  try {
    return new PublicKey(id);
  } catch {
    return null;
  }
}

export interface TxResult {
  signature: string;
  success: boolean;
  error?: string;
}

export interface CurateArgs {
  contentId: PublicKey;
}

export interface ClaimCurationArgs {
  contentId: PublicKey;
}

export interface CurationContract {
  /** True only when VITE_CURATION_REAL_CHAIN=true AND env config resolves. */
  enabled: boolean;
  module: CurationModule | null;
  oraMint: PublicKey;
  curationFeeSink: PublicKey;
  decimals: number;
  /** Read the curation pool for a given content id. Returns null if not initialized. */
  fetchPool: (contentId: PublicKey) => Promise<CurationPoolOnChain | null>;
  /** Read a single curator's record for a given content id. */
  fetchRecord: (
    contentId: PublicKey,
    curator: PublicKey,
  ) => Promise<CurationRecordOnChain | null>;
  /** Curate a content item (debits 1 ORA, requires >= 100 ORA held). */
  curate: (args: CurateArgs) => Promise<TxResult & { record?: PublicKey }>;
  /** Claim the curator's slice of the content's reward pool. */
  claimReward: (args: ClaimCurationArgs) => Promise<TxResult>;
}

export function useCurationContract(): CurationContract {
  const { connection } = useConnection();
  const wallet = useUnifiedWalletAsAdapter();

  const flag = (import.meta as any).env?.VITE_CURATION_REAL_CHAIN === 'true';
  const oraMint = useMemo(
    () =>
      readPubkey('VITE_ORA_MINT', new PublicKey('11111111111111111111111111111111')),
    [],
  );
  const curationFeeSink = useMemo(
    () => readPubkey('VITE_CURATION_FEE_SINK', DEFAULT_CURATION_FEE_SINK),
    [],
  );
  const mintIsPlaceholder = oraMint.equals(
    new PublicKey('11111111111111111111111111111111'),
  );
  const enabled = flag && !mintIsPlaceholder;

  const programId = useMemo(
    () => readPubkey('VITE_CURATION_PROGRAM_ID', DEFAULT_CURATION_PROGRAM_ID),
    [],
  );

  const module = useMemo(() => {
    if (!enabled) return null;
    return new CurationModule(connection, wallet as UnifiedWalletAdapter, programId);
  }, [connection, wallet, programId, enabled]);

  const fetchPool: CurationContract['fetchPool'] = useCallback(async (contentId) => {
    if (!module) return null;
    try {
      return await module.fetchPool(contentId);
    } catch (e) {
      console.warn('[useCurationContract] fetchPool failed:', e);
      return null;
    }
  }, [module]);

  const fetchRecord: CurationContract['fetchRecord'] = useCallback(async (contentId, curator) => {
    if (!module) return null;
    try {
      return await module.fetchRecord(contentId, curator);
    } catch (e) {
      console.warn('[useCurationContract] fetchRecord failed:', e);
      return null;
    }
  }, [module]);

  const curate: CurationContract['curate'] = useCallback(async ({ contentId }) => {
    if (!module) return { signature: '', success: false, error: 'Curation module not enabled' };
    if (!wallet.publicKey) return { signature: '', success: false, error: 'Wallet not connected' };
    try {
      // Guard: pool must exist. Admins must initialize once via the dev script
      // (see scripts/init-curation-pool.mjs) — frontend never auto-inits to
      // avoid creator-follower-count races.
      const pool = await module.fetchPool(contentId);
      if (!pool) {
        return {
          signature: '',
          success: false,
          error:
            'pool-not-initialized: this content has no curation pool yet. Ask the creator/admin to initialize it.',
        };
      }

      const curatorAta = await getAssociatedTokenAddress(oraMint, wallet.publicKey);
      const res = await module.curate({
        contentId,
        curatorOraAccount: curatorAta,
        curationFeeSink,
      });
      return {
        signature: res.signature,
        success: res.success,
        error: res.error,
        record: res.record,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { signature: '', success: false, error: msg };
    }
  }, [module, wallet.publicKey, oraMint, curationFeeSink]);

  const claimReward: CurationContract['claimReward'] = useCallback(async ({ contentId }) => {
    if (!module) return { signature: '', success: false, error: 'Curation module not enabled' };
    if (!wallet.publicKey) return { signature: '', success: false, error: 'Wallet not connected' };
    try {
      const curatorAta = await getAssociatedTokenAddress(oraMint, wallet.publicKey);
      const res = await module.claimCurationReward({
        contentId,
        curatorOraAccount: curatorAta,
        oraMint,
      });
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { signature: '', success: false, error: msg };
    }
  }, [module, wallet.publicKey, oraMint]);

  // 2026-05-20 — stabilise returned object so consumers using it as a
  // useEffect dependency don't re-fire every render.
  return useMemo(
    () => ({
      enabled,
      module,
      oraMint,
      curationFeeSink,
      decimals: 9,
      fetchPool,
      fetchRecord,
      curate,
      claimReward,
    }),
    [enabled, module, oraMint, curationFeeSink, fetchPool, fetchRecord, curate, claimReward],
  );
}

export { TOKEN_PROGRAM_ID };
export type { CurationPoolOnChain, CurationRecordOnChain };
