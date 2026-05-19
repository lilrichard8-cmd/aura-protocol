/**
 * useOraContract — bridges WalletPage to the real on-chain ORA SPL token.
 *
 * Feature-flagged: only activates when `VITE_ORA_REAL_CHAIN === 'true'`.
 * Otherwise returns `{ enabled: false }` and the page falls back to
 * MockChainContext for balance + transfers.
 *
 * Why a flag (mirrors useBountyContract):
 *  - The ORA mint PDA exists only after the `aura_ora` program has been
 *    deployed AND `initialize_ora` has been called. Until then there is
 *    no real mint to query.
 *  - The mint address itself is configured via `VITE_ORA_MINT`. If unset,
 *    the hook stays disabled so we never accidentally hit a placeholder.
 *  - One env var toggles real vs. mock: `VITE_ORA_REAL_CHAIN=true npm run dev`.
 *
 * Capabilities exposed:
 *   - getBalance(owner)   – reads the SPL token balance from the owner's ATA.
 *                           Returns 0n if the ATA does not yet exist.
 *   - transfer({to, amount}) – builds a single-instruction SPL transfer tx.
 *                           Auto-creates the recipient ATA if missing.
 *
 * NOTE on burns / fee splits: ORA's "5% protocol fee" semantics live in the
 * `aura_ora` program (process_fee / triple_burn). A peer-to-peer `Send` in
 * WalletPage is intentionally fee-free (per Zhuoyu, 2026-04-30) — so we use
 * a plain `createTransferInstruction` here. Fee-bearing flows (tips,
 * marketplace, etc.) should call OraModule.processFee instead.
 */

import { useMemo } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useUnifiedWalletAsAdapter, type UnifiedWalletAdapter } from './useUnifiedWallet';
import {
  PublicKey,
  Transaction,
  SystemProgram,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
} from '@solana/spl-token';
import { OraModule, ORA_DECIMALS } from '@aura-protocol/sdk';

/**
 * Deployed ORA program id (programs/ora/src/lib.rs: `declare_id!(...)`).
 * Kept as the build-time default; can be overridden via VITE_ORA_PROGRAM_ID
 * once the program is redeployed.
 */
const DEFAULT_ORA_PROGRAM_ID = new PublicKey(
  'BU6sgGN6a8pbzjQasfghumnqG5UEaUSsJ3mWc1gQU2tb'
);

function readPubkey(name: string, fallback: PublicKey): PublicKey {
  const raw = (import.meta as any).env?.[name] as string | undefined;
  if (!raw) return fallback;
  try {
    return new PublicKey(raw);
  } catch {
    console.warn(`[useOraContract] invalid pubkey for ${name}, falling back`);
    return fallback;
  }
}

export interface TxResult {
  signature: string;
  success: boolean;
  error?: string;
}

export interface OraContract {
  /** True only when VITE_ORA_REAL_CHAIN=true AND VITE_ORA_MINT is a valid pubkey. */
  enabled: boolean;
  /** Optional OraModule for higher-level on-chain operations (burns, fees, mints). */
  module: OraModule | null;
  /** The configured ORA mint (or system program id placeholder when disabled). */
  oraMint: PublicKey;
  /** Token decimals (ORA = 9). Provided so callers can format without reaching for SDK constants. */
  decimals: number;
  /**
   * Read balance from `owner`'s associated token account. Returns 0n when the
   * ATA does not yet exist (i.e. the user has never received ORA on-chain).
   */
  getBalance: (owner: PublicKey) => Promise<bigint>;
  /**
   * Transfer raw ORA token units (NOT UI units) from the connected wallet to
   * `to`. Auto-creates the recipient ATA if it doesn't exist. The sender's
   * ATA must already exist (it does iff the sender has any ORA balance).
   */
  transfer: (params: { to: PublicKey; amount: bigint }) => Promise<TxResult>;
}

export function useOraContract(): OraContract {
  const { connection } = useConnection();
  // 2026-05-19 — unified wallet (Privy embedded > Phantom)
  const wallet = useUnifiedWalletAsAdapter();

  // 1) The kill switch. If anything fails, treat as disabled so the page
  //    silently falls back to mock.
  const flagEnabled =
    (import.meta as any).env?.VITE_ORA_REAL_CHAIN === 'true';

  // 2) Resolve the ORA mint. We only enable when this is a valid, non-system
  //    public key — otherwise getBalance would query nonsense.
  const SYSTEM_PROGRAM = SystemProgram.programId;
  const oraMint = useMemo(
    () => readPubkey('VITE_ORA_MINT', SYSTEM_PROGRAM),
    [SYSTEM_PROGRAM]
  );
  const mintIsReal = !oraMint.equals(SYSTEM_PROGRAM);

  // 3) Resolve the ORA program id (optional — used for OraModule).
  const programId = useMemo(
    () => readPubkey('VITE_ORA_PROGRAM_ID', DEFAULT_ORA_PROGRAM_ID),
    []
  );

  const enabled = flagEnabled && mintIsReal;

  // 4) Construct the SDK OraModule when enabled. Mirrors useBountyContract:
  //    structurally compatible cast of WalletContextState → WalletAdapter.
  const module = useMemo(() => {
    if (!enabled) return null;
    return new OraModule(connection, wallet as UnifiedWalletAdapter, programId);
  }, [enabled, connection, wallet, programId]);

  const getBalance = useMemo(
    () =>
      async (owner: PublicKey): Promise<bigint> => {
        if (!enabled) return 0n;
        try {
          const ata = await getAssociatedTokenAddress(oraMint, owner);
          const acc = await getAccount(connection, ata);
          return acc.amount; // already raw token units (bigint)
        } catch (e) {
          // ATA doesn't exist or wrong owner → user has 0 ORA on-chain.
          if (
            e instanceof TokenAccountNotFoundError ||
            e instanceof TokenInvalidAccountOwnerError
          ) {
            return 0n;
          }
          // Surface unexpected RPC errors so caller can show toast.
          throw e;
        }
      },
    [enabled, connection, oraMint]
  );

  const transfer = useMemo(
    () =>
      async ({
        to,
        amount,
      }: {
        to: PublicKey;
        amount: bigint;
      }): Promise<TxResult> => {
        if (!enabled) {
          return { signature: '', success: false, error: 'on-chain mode disabled' };
        }
        if (!wallet.connected || !wallet.publicKey) {
          return { signature: '', success: false, error: 'Wallet not connected' };
        }
        if (amount <= 0n) {
          return { signature: '', success: false, error: 'amount must be > 0' };
        }
        try {
          const sender = wallet.publicKey;
          const senderAta = await getAssociatedTokenAddress(oraMint, sender);
          const recipientAta = await getAssociatedTokenAddress(oraMint, to);

          const tx = new Transaction();

          // Auto-create the recipient ATA if missing. Sender pays rent.
          const recipientInfo = await connection.getAccountInfo(recipientAta);
          if (!recipientInfo) {
            tx.add(
              createAssociatedTokenAccountInstruction(
                sender,
                recipientAta,
                to,
                oraMint,
                TOKEN_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID
              )
            );
          }

          tx.add(
            createTransferInstruction(
              senderAta,
              recipientAta,
              sender,
              amount,
              [],
              TOKEN_PROGRAM_ID
            )
          );

          const { blockhash } = await connection.getLatestBlockhash();
          tx.recentBlockhash = blockhash;
          tx.feePayer = sender;

          const signature = await wallet.sendTransaction(tx, connection);
          await connection.confirmTransaction(signature);
          return { signature, success: true };
        } catch (e) {
          return {
            signature: '',
            success: false,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      },
    [enabled, connection, wallet, oraMint]
  );

  // 2026-05-20 — stabilise the returned object so consumers using it as a
  // useEffect dependency don't re-fire every render (regression: WalletPage's
  // balance-poll effect was triggering ad infinitum, locking the SPA into a
  // setState death loop). `getBalance` and `transfer` are already useMemo'd,
  // and `oraMint` / `module` / `enabled` are stable, so an outer useMemo
  // with identity-comparable deps does the job.
  return useMemo(
    () => ({
      enabled,
      module,
      oraMint,
      decimals: ORA_DECIMALS,
      getBalance,
      transfer,
    }),
    [enabled, module, oraMint, getBalance, transfer],
  );
}
