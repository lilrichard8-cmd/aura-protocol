/**
 * useUnifiedWallet — single source of truth for "who is the user, what wallet
 * are they signing with" across both authentication paths:
 *
 *   1. Privy embedded wallet (default for normal/email users) ← preferred
 *   2. Solana wallet-adapter (Phantom / Solflare for power users)
 *
 * The returned shape is intentionally structurally compatible with the SDK's
 * `WalletAdapter` interface — it exposes `publicKey`, `connected`, and a
 * `sendTransaction(tx, connection, options?)` method. That means the existing
 * contract hooks (`new MarketModule(connection, wallet as any, …)`) keep
 * working without any further changes.
 *
 * Priority order: **Privy > wallet-adapter**.
 *   If a user is authenticated with Privy AND has Phantom connected, we use
 *   their Privy wallet (it's the one we provisioned, controlled by their
 *   email login — predictable for the "small user" UX). Phantom path is only
 *   the fall-through when Privy is not authenticated.
 *
 * NOTE on transaction signing for Privy:
 *   Privy v3 exposes `useSignAndSendTransaction()` from
 *   `@privy-io/react-auth/solana`. We adapt that hook into the
 *   wallet-adapter–style `sendTransaction(tx, connection)` API by:
 *     - serializing the partially-signed Transaction (Privy expects bytes)
 *     - calling Privy's signAndSend (Privy submits via its own RPC)
 *     - returning the resulting signature as base58
 *
 *   We pin the Privy `chain` to `solana:localnet` for now (matches
 *   VITE_RPC_URL=http://127.0.0.1:8899). On devnet/mainnet we'd switch to
 *   `solana:devnet` / `solana:mainnet`. The mapping is derived from
 *   VITE_SOLANA_CLUSTER.
 */

import { useMemo, useRef, useCallback } from 'react';
import { PublicKey, Transaction, type Connection, type SendOptions, type VersionedTransaction } from '@solana/web3.js';
import { usePrivy } from '@privy-io/react-auth';
import {
  useSignAndSendTransaction,
  useWallets as usePrivySolanaWallets,
} from '@privy-io/react-auth/solana';
import { useWallet as useAdapterWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';

export type WalletSource = 'privy' | 'adapter' | null;

export interface UnifiedWallet {
  /** Active wallet's public key (or null when not connected). */
  publicKey: PublicKey | null;
  /** True iff a wallet is currently usable for signing. */
  connected: boolean;
  /** Which underlying provider is active. Useful for UI ("Logged in with email" vs "Phantom connected"). */
  source: WalletSource;
  /**
   * Wallet-adapter-shaped `sendTransaction`. Works for SDK calls of the form:
   *   await module.contract.method(...).rpc()
   *   await wallet.sendTransaction(tx, connection)
   */
  sendTransaction: (
    tx: Transaction | VersionedTransaction,
    connection: Connection,
    options?: SendOptions
  ) => Promise<string>;
  /**
   * Sign an arbitrary message (used by SIWS-style wallet-auth flow).
   * Returns the raw signature bytes.
   */
  signMessage: ((message: Uint8Array) => Promise<Uint8Array>) | null;
  /** True when running against a local Solana validator (VITE_SOLANA_CLUSTER === 'localnet'). */
  isLocalnet: boolean;
}

/** Resolve the SolanaChain string Privy expects from our env config. */
function resolvePrivyChain():
  | 'solana:localnet'
  | 'solana:devnet'
  | 'solana:testnet'
  | 'solana:mainnet' {
  const cluster = (import.meta as any).env?.VITE_SOLANA_CLUSTER as string | undefined;
  const rpc = (import.meta as any).env?.VITE_RPC_URL as string | undefined;
  if (cluster === 'localnet' || rpc?.includes('127.0.0.1') || rpc?.includes('localhost')) {
    return 'solana:localnet';
  }
  if (cluster === 'devnet') return 'solana:devnet';
  if (cluster === 'testnet') return 'solana:testnet';
  return 'solana:mainnet';
}

export function useUnifiedWallet(): UnifiedWallet {
  // Privy state
  const { authenticated, ready: privyReady, user: privyUser } = usePrivy();
  const { wallets: privyWallets, ready: walletsReady } = usePrivySolanaWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();

  // Wallet-adapter state
  const adapter = useAdapterWallet();

  // Privy wallet detection: prefer the *embedded* wallet for the unified
  // "small user" flow. If the user has only linked an external wallet via
  // Privy, we still use it — but the most common case is embedded.
  const privyWallet = useMemo(() => {
    if (!privyReady || !walletsReady || !authenticated) return null;
    if (!privyWallets || privyWallets.length === 0) return null;
    // Pick the first connected wallet. Privy returns them in priority order.
    return privyWallets[0] ?? null;
  }, [privyReady, walletsReady, authenticated, privyWallets]);

  // Fallback address derivation: if `useSolanaWallets()` hasn't synced yet
  // but Privy.user.linkedAccounts already lists a Solana wallet (backend
  // created it during signup), we still want to know the address — at
  // least for display purposes (Header pill, WalletPage account card,
  // balance polling). Signing still requires `privyWallet` to be live.
  const fallbackAddress = useMemo<string | null>(() => {
    if (!privyReady || !authenticated || !privyUser) return null;
    if (privyWallets && privyWallets.length > 0) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accounts = (privyUser as any).linkedAccounts as unknown[] | undefined;
    if (!Array.isArray(accounts)) return null;
    for (const acc of accounts) {
      if (!acc || typeof acc !== 'object') continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = acc as any;
      if (a.type !== 'wallet') continue;
      const isSolana = a.chainType === 'solana' ||
        (typeof a.address === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a.address));
      if (isSolana && typeof a.address === 'string') return a.address as string;
    }
    return null;
  }, [privyReady, authenticated, privyUser, privyWallets]);

  const privyPublicKey = useMemo<PublicKey | null>(() => {
    if (privyWallet) {
      try {
        return new PublicKey(privyWallet.address);
      } catch {
        return null;
      }
    }
    if (fallbackAddress) {
      try {
        return new PublicKey(fallbackAddress);
      } catch {
        return null;
      }
    }
    return null;
  }, [privyWallet, fallbackAddress]);

  const privyChain = useMemo(() => resolvePrivyChain(), []);
  const isLocalnet = privyChain === 'solana:localnet';

  // Priority: Privy > adapter.
  //  - usePrivyPath: we have a *signable* Privy wallet (full live object).
  //  - usePrivyReadOnly: we know the address from linkedAccounts but the
  //    wallets hook hasn't synced yet — show balance, but can't sign.
  const usePrivyPath = privyWallet !== null && privyPublicKey !== null;
  const usePrivyReadOnly = !usePrivyPath && privyPublicKey !== null && fallbackAddress !== null;
  const useAdapterPath = !usePrivyPath && !usePrivyReadOnly && adapter.connected && adapter.publicKey != null;

  const publicKey: PublicKey | null = usePrivyPath || usePrivyReadOnly
    ? privyPublicKey
    : useAdapterPath
      ? adapter.publicKey
      : null;

  // `connected` means "can sign". Read-only mode is NOT connected for the
  // purposes of the SDK adapter; it's only used for display.
  const connected = usePrivyPath || useAdapterPath;

  const source: WalletSource = usePrivyPath || usePrivyReadOnly
    ? 'privy'
    : useAdapterPath
      ? 'adapter'
      : null;

  // ── sendTransaction ──────────────────────────────────────────────────
  const sendTransaction = useMemo(() => {
    return async (
      tx: Transaction | VersionedTransaction,
      connection: Connection,
      options?: SendOptions
    ): Promise<string> => {
      // Privy path
      if (usePrivyPath && privyWallet) {
        // For legacy Transaction we need recentBlockhash+feePayer set so the
        // serialization succeeds even though Privy will fill some of these.
        let serialized: Uint8Array;
        if ('version' in tx) {
          // VersionedTransaction
          serialized = tx.serialize();
        } else {
          const legacy = tx as Transaction;
          if (!legacy.recentBlockhash) {
            const { blockhash } = await connection.getLatestBlockhash();
            legacy.recentBlockhash = blockhash;
          }
          if (!legacy.feePayer && privyPublicKey) {
            legacy.feePayer = privyPublicKey;
          }
          serialized = legacy.serialize({ requireAllSignatures: false, verifySignatures: false });
        }
        const result = await signAndSendTransaction({
          transaction: serialized,
          wallet: privyWallet,
          chain: privyChain,
          ...(options ? { options: { sendOptions: options } as any } : {}),
        });
        // result.signature is Uint8Array — encode as base58
        return bs58.encode(result.signature);
      }

      // Adapter path
      if (useAdapterPath && adapter.sendTransaction) {
        return adapter.sendTransaction(tx, connection, options);
      }

      throw new Error('No wallet connected — cannot sign transaction');
    };
  }, [usePrivyPath, useAdapterPath, privyWallet, privyChain, privyPublicKey, signAndSendTransaction, adapter]);

  // ── signMessage (best-effort) ────────────────────────────────────────
  const signMessage = useMemo<UnifiedWallet['signMessage']>(() => {
    if (usePrivyPath && privyWallet) {
      return async (message: Uint8Array): Promise<Uint8Array> => {
        const sw: any = (privyWallet as any).standardWallet;
        const feat = sw?.features?.['solana:signMessage'];
        if (!feat?.signMessage) {
          throw new Error('Privy wallet does not support solana:signMessage');
        }
        // The standard wallet returns { signedMessage, signature } or similar.
        const res = await feat.signMessage({ message, account: sw.accounts?.[0] });
        const out = Array.isArray(res) ? res[0] : res;
        return out?.signature ?? out?.signedMessage ?? new Uint8Array();
      };
    }
    if (useAdapterPath && adapter.signMessage) {
      return adapter.signMessage.bind(adapter);
    }
    return null;
  }, [usePrivyPath, useAdapterPath, privyWallet, adapter]);

  // H-1 — memoize the returned object so that downstream `useMemo` /
  // `useEffect` hooks keyed on the wallet don't churn on every render.
  // The PublicKey instance is normalised through its base58 string so
  // identical addresses across renders produce a stable dep key.
  const publicKeyBase58 = publicKey?.toBase58() ?? null;
  return useMemo<UnifiedWallet>(() => ({
    publicKey,
    connected,
    source,
    sendTransaction,
    signMessage,
    isLocalnet,
  }), [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    publicKeyBase58,
    connected,
    source,
    sendTransaction,
    signMessage,
    isLocalnet,
  ]);
}

/**
 * Minimal structural type used by SDK module constructors. Every contract
 * hook (`useBountyContract`, `useOraContract`, …) imports this and uses it
 * in place of the previous `wallet as any` cast.
 *
 * SDK modules consume this shape via `@solana/wallet-adapter-base`'s
 * `WalletAdapter` interface, which is a strict superset of what we expose
 * here. The fields included below are the *only* ones the SDK actually
 * touches (publicKey + sendTransaction + connected, with signMessage as
 * an optional escape hatch for SIWS-style flows).
 */
export interface UnifiedWalletAdapter {
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  disconnecting: boolean;
  wallet: null;
  wallets: never[];
  autoConnect: boolean;
  sendTransaction: UnifiedWallet['sendTransaction'];
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
  select: () => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: undefined;
  signAllTransactions: undefined;
  source: WalletSource;
  isLocalnet: boolean;
}

/**
 * Adapter that returns a stable, WalletContextState-compatible object suitable
 * for handing directly to SDK module constructors (`new MarketModule(conn,
 * wallet as UnifiedWalletAdapter, …)`). The contract hooks consume this shape.
 *
 * 2026-05-19 audit H-1 / M-1 / M-3:
 *   - Memoised by base58 string (not PublicKey reference) so identical
 *     addresses across renders don't break downstream `useMemo` cache.
 *   - In `usePrivyReadOnly` mode (`publicKey != null` but `connected = false`),
 *     `connected` stays false so SDK calls bail out cleanly; pages should
 *     gate Submit buttons on `wallet.source !== null`.
 *   - Returns the explicit `UnifiedWalletAdapter` interface so hooks can
 *     drop `as any` casts.
 */
export function useUnifiedWalletAsAdapter(): UnifiedWalletAdapter {
  const uw = useUnifiedWallet();
  const publicKeyBase58 = uw.publicKey?.toBase58() ?? null;

  // 2026-05-20 — stabilise sendTransaction / signMessage identities. The
  // upstream `uw.sendTransaction` ref changes on every render (Privy's
  // `signAndSendTransaction` is itself non-stable, and the wallet-adapter
  // path's `adapter` object reference also churns). When the adapter
  // object identity changed every render it propagated into every contract
  // hook (useOraContract.module, .transfer, etc.) and ultimately blew up
  // WalletPage's balance-poll useEffect into a setState death loop.
  //
  // Fix: park the latest sendTransaction/signMessage in refs and expose
  // stable useCallback wrappers that read through the refs at call time.
  // The SDK only invokes these inside async tx flows, so reading the
  // freshest function ref through .current is correct — we just don't
  // want the *identity* to churn between renders.
  const sendTxRef = useRef(uw.sendTransaction);
  sendTxRef.current = uw.sendTransaction;
  const stableSendTransaction = useCallback(
    (
      tx: Transaction | VersionedTransaction,
      conn: Connection,
      options?: SendOptions,
    ): Promise<string> => sendTxRef.current(tx, conn, options),
    [],
  );

  const signMsgRef = useRef(uw.signMessage);
  signMsgRef.current = uw.signMessage;
  // Only expose a stable signMessage when there's a real one underneath —
  // SDK callers do `if (wallet.signMessage)` so we mustn't always return
  // a wrapper. Use a memo keyed on whether signMessage is present.
  const hasSignMessage = uw.signMessage != null;
  const stableSignMessage = useCallback(
    async (message: Uint8Array): Promise<Uint8Array> => {
      const fn = signMsgRef.current;
      if (!fn) throw new Error('Wallet does not support signMessage');
      return fn(message);
    },
    [],
  );

  return useMemo<UnifiedWalletAdapter>(() => ({
    publicKey: uw.publicKey,
    connected: uw.connected,
    connecting: false,
    disconnecting: false,
    wallet: null,
    wallets: [],
    autoConnect: false,
    // Methods the SDK calls — stable identity, internals re-resolved via
    // refs at call time so the freshest Privy/adapter signer is used.
    sendTransaction: stableSendTransaction,
    signMessage: hasSignMessage ? stableSignMessage : undefined,
    // Stubs for fields wallet-adapter normally has
    select: () => {},
    connect: async () => {},
    disconnect: async () => {},
    signTransaction: undefined,
    signAllTransactions: undefined,
    source: uw.source,
    isLocalnet: uw.isLocalnet,
  }), [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    publicKeyBase58,
    uw.connected,
    uw.source,
    uw.isLocalnet,
    hasSignMessage,
    stableSendTransaction,
    stableSignMessage,
  ]);
}
