/**
 * BountyDetailPage — real bounty detail view.
 *
 * 2026-05-11 R14 — completely rewritten. The previous version had a wall
 * of hard-coded mock data: a fake "AURA Platform UI/UX Design Concept"
 * bounty with a 5000 ORA reward, three fake submissions ("Alex Design",
 * "Luna Creative", "Design Studio X"), invented requirements lists and
 * skill chips. None of that came from the chain.
 *
 * Now: we read the bounty exclusively from `mockChain.bounties` (the same
 * source the Studio Bounties tab and Marketplace use). If the id doesn't
 * resolve we show a friendly 404. Submissions come from
 * `mockChain.mySubmissions` — the local user's own submissions to this
 * bounty (the protocol doesn't surface other users' work-in-flight, just
 * the winning submission once decided).
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Users, Upload, Coins, Clock,
  Briefcase, AlertCircle, Send, FileText, CheckCircle2, XCircle,
  Award, Ban, RefreshCw, Link as LinkIcon,
} from 'lucide-react';
import { PublicKey } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useMockChain } from '@/context/MockChainContext';
import { useGoBack } from '@/hooks/useGoBack';
import UserAvatar from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/context/ToastContext';
import { useBountyContract, MARKET_PROGRAM_ID, BountyStatus, BOUNTY_V2_LIMITS, type BountyOnChain, type SubmissionOnChain, SubmissionStatus } from '@/hooks/useBountyContract';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';

function formatDeadline(deadline?: string): { text: string; expired: boolean; soon: boolean } {
  if (!deadline) return { text: 'No deadline set', expired: false, soon: false };
  const now = Date.now();
  const target = new Date(deadline).getTime();
  if (!Number.isFinite(target)) return { text: deadline, expired: false, soon: false };
  const diff = target - now;
  if (diff <= 0) return { text: 'Closed', expired: true, soon: false };
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const soon = diff < 86_400_000 * 2;
  if (days > 0) return { text: `${days}d ${hours}h left`, expired: false, soon };
  return { text: `${hours}h left`, expired: false, soon };
}

function formatDate(d: string | number | undefined): string {
  if (d === undefined || d === null) return '—';
  const t = typeof d === 'number' ? d : Date.parse(d);
  if (!Number.isFinite(t)) return String(d);
  return new Date(t).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ───────────────────────────────────────────────────────────────────────
// Bounty identity strategy (2026-05-19):
//   • URL path `/marketplace/bounty/:id` — `id` is the *mock* bounty id
//     (e.g. "bounty-1"). This is the default and unchanged.
//   • URL query `?pda=<base58>` — when present AND VITE_BOUNTY_REAL_CHAIN
//     is enabled, we treat the page as a *real on-chain* bounty and fetch
//     account state via MarketModule.fetchBounty.
//   • Both can technically coexist (`/marketplace/bounty/x?pda=…`); when
//     pda is set + on-chain mode is on, the pda branch wins.
// ───────────────────────────────────────────────────────────────────────

/**
 * H-3 — Decode a `data:text/plain;base64,...` metadata URI back into the
 * plain text the creator originally typed. Falls back to the URI verbatim
 * for anything else (future IPFS / HTTPS / etc.) so we never blow up.
 */
function decodeMetadataUri(uri: string): string {
  if (!uri) return '';
  if (uri.startsWith('data:text/plain;base64,')) {
    try {
      // eslint-disable-next-line deprecation/deprecation
      return decodeURIComponent(escape(atob(uri.slice('data:text/plain;base64,'.length))));
    } catch {
      return uri;
    }
  }
  return uri;
}

/** Normalizes a chain bounty into the same shape used by the mock UI so
 *  the existing render code keeps working. */
function normalizeChainBounty(b: BountyOnChain): {
  id: string;
  title: string;
  description: string;
  reward: number;
  deadline: string;
  submissionCount: number;
  status: 'active' | 'completed' | 'expired';
  creator: string;
} {
  const reward = Number(b.totalReward) / 1_000_000_000; // assume 9 decimals
  let status: 'active' | 'completed' | 'expired';
  switch (b.status) {
    case BountyStatus.Open:
      status = 'active'; break;
    case BountyStatus.FullyAwarded:
    case BountyStatus.Closed:
      status = 'completed'; break;
    case BountyStatus.Expired:
    case BountyStatus.Cancelled:
      status = 'expired'; break;
    default:
      status = 'active';
  }
  return {
    id: b.address.toBase58(),
    title: b.title,
    // H-3 — decode the base64 data URI so the brief is readable instead of
    // a wall of base64 chars. Long URIs (IPFS / HTTPS) pass through.
    description: decodeMetadataUri(b.metadataUri || ''),
    reward,
    deadline: new Date(b.deadline * 1000).toISOString(),
    submissionCount: b.submissionCount,
    status,
    creator: b.sponsor.toBase58(),
  };
}

// H-4 — Local index of submissions the current browser session has seen.
// Two sources feed this index:
//   1. Just-submitted PDAs written by the submitter on success (so the
//      creator-side flow can pick them up after a refresh in the same
//      browser).
//   2. The cross-browser path: `getProgramAccounts` with a memcmp filter
//      on the BountySubmission discriminator + bounty PublicKey. This is
//      O(n) over all BountySubmission accounts but on localnet that's fine.
const SUBMISSIONS_STORAGE_PREFIX = 'aura_my_submissions:';

type StoredSubmission = {
  pda: string;
  submitterPubkey: string;
  submittedAt: number; // unix seconds
  workUrl?: string;
};

function loadStoredSubmissions(bountyPda: string): StoredSubmission[] {
  try {
    const raw = window.localStorage.getItem(SUBMISSIONS_STORAGE_PREFIX + bountyPda);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s: unknown): s is StoredSubmission => {
      return !!s && typeof s === 'object'
        && typeof (s as StoredSubmission).pda === 'string'
        && typeof (s as StoredSubmission).submitterPubkey === 'string';
    });
  } catch {
    return [];
  }
}

function saveStoredSubmissions(bountyPda: string, list: StoredSubmission[]): void {
  try {
    window.localStorage.setItem(
      SUBMISSIONS_STORAGE_PREFIX + bountyPda,
      JSON.stringify(list),
    );
  } catch {
    // QuotaExceeded etc. — silently drop; the on-chain fallback still works.
  }
}

function recordOwnSubmission(
  bountyPda: string,
  entry: StoredSubmission,
): void {
  const existing = loadStoredSubmissions(bountyPda);
  if (existing.some(e => e.pda === entry.pda)) return;
  saveStoredSubmissions(bountyPda, [...existing, entry]);
}

/** Truncates a base58 pubkey for inline display. */
function shortPk(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function BountyDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const goBack = useGoBack('/studio?tab=bounties');
  const mockChain = useMockChain();
  const { showToast } = useToast();
  const onChain = useBountyContract();
  const wallet = useWallet();
  const unified = useUnifiedWallet();
  const { connection } = useConnection();

  // Parse and validate the optional ?pda= param. If on-chain mode is off
  // we still pretend the param doesn't exist (mock fallback) to avoid
  // confusing users when the feature flag is disabled.
  const pdaParam = searchParams.get('pda');
  const bountyPda = useMemo<PublicKey | null>(() => {
    if (!pdaParam) return null;
    try {
      return new PublicKey(pdaParam);
    } catch {
      return null;
    }
  }, [pdaParam]);
  const useRealChain = !!(onChain.enabled && onChain.module && bountyPda);

  // Chain-bounty state (only used in on-chain mode).
  const [chainBounty, setChainBounty] = useState<BountyOnChain | null>(null);
  const [chainBountyLoading, setChainBountyLoading] = useState<boolean>(useRealChain);
  const [chainBountyError, setChainBountyError] = useState<string | null>(null);
  // Bump this to force a re-fetch after a successful action.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!useRealChain || !onChain.module || !bountyPda) {
      setChainBounty(null);
      setChainBountyLoading(false);
      setChainBountyError(null);
      return;
    }
    setChainBountyLoading(true);
    setChainBountyError(null);
    onChain.module.fetchBounty(bountyPda)
      .then(b => {
        if (cancelled) return;
        if (!b) {
          setChainBountyError('Bounty account not found on-chain.');
          setChainBounty(null);
        } else {
          setChainBounty(b);
        }
      })
      .catch(e => {
        if (cancelled) return;
        setChainBountyError(e?.message || 'Failed to load bounty from chain.');
      })
      .finally(() => {
        if (!cancelled) setChainBountyLoading(false);
      });
    return () => { cancelled = true; };
  }, [useRealChain, onChain.module, bountyPda, refreshKey]);

  const mockBounty = useMemo(
    () => useRealChain ? undefined : mockChain.bounties.find(b => b.id === id),
    [useRealChain, mockChain.bounties, id],
  );

  // The unified bounty object the UI renders against — either the normalized
  // chain bounty or the mock one.
  const bounty = useMemo(
    () => useRealChain
      ? (chainBounty ? normalizeChainBounty(chainBounty) : undefined)
      : mockBounty,
    [useRealChain, chainBounty, mockBounty],
  );

  // The current user's submissions to this bounty (if any).
  //  • Mock mode: read from mockChain.mySubmissions.
  //  • Real chain: the program doesn't surface submissions without an
  //    indexer, so the list stays empty here. Submitters get tx-level
  //    feedback via toast instead. Future: read program accounts.
  const mySubmissions = useMemo(
    () => (!useRealChain && bounty)
      ? mockChain.mySubmissions
          .filter(s => s.bountyId === bounty.id)
          .sort((a, b) => b.submittedAt - a.submittedAt)
      : [],
    [useRealChain, mockChain.mySubmissions, bounty],
  );

  const [workUrl, setWorkUrl] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // On-chain creator action state (award / cancel / refund / reject).
  const [awardSubPda, setAwardSubPda] = useState('');
  const [awardAmount, setAwardAmount] = useState('');
  const [actionBusy, setActionBusy] = useState<null | 'award' | 'reject' | 'cancel' | 'refund'>(null);

  // H-4 — On-chain submission discovery.
  //
  // The contract doesn't expose a `listSubmissions(bounty)` RPC, so we
  // discover submissions two ways:
  //   (a) Cross-browser: `connection.getProgramAccounts` with a memcmp
  //       on the BountySubmission discriminator + the bounty PublicKey.
  //       (Discriminator lives at offset 0; bounty pubkey at offset 8.)
  //   (b) Same-browser fallback: localStorage cache populated by the
  //       submitter at submit-time.
  // Both sources merge into a single deduplicated list keyed by PDA.
  const [chainSubmissions, setChainSubmissions] = useState<SubmissionOnChain[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  const [storedSubmissionRefs, setStoredSubmissionRefs] = useState<StoredSubmission[]>([]);

  // Refresh the localStorage view whenever the bounty key changes or we bump
  // refreshKey. localStorage is synchronous so this is cheap.
  useEffect(() => {
    if (!useRealChain || !bountyPda) {
      setStoredSubmissionRefs([]);
      return;
    }
    setStoredSubmissionRefs(loadStoredSubmissions(bountyPda.toBase58()));
  }, [useRealChain, bountyPda, refreshKey]);

  // Pull live on-chain submissions via getProgramAccounts.
  useEffect(() => {
    let cancelled = false;
    if (!useRealChain || !onChain.module || !bountyPda) {
      setChainSubmissions([]);
      setSubmissionsLoading(false);
      setSubmissionsError(null);
      return () => { cancelled = true; };
    }
    setSubmissionsLoading(true);
    setSubmissionsError(null);
    (async () => {
      try {
        // Layout: discriminator(8) + bounty(32) + submitter(32) + …
        // We filter on the bounty pubkey at offset 8.
        const accounts = await connection.getProgramAccounts(
          MARKET_PROGRAM_ID,
          {
            filters: [
              { memcmp: { offset: 8, bytes: bountyPda.toBase58() } },
            ],
          },
        );
        const parsed: SubmissionOnChain[] = [];
        for (const { pubkey, account } of accounts) {
          try {
            const sub = await onChain.module!.fetchSubmission(pubkey);
            if (sub && sub.bounty.equals(bountyPda)) {
              parsed.push(sub);
            }
          } catch {
            // Account matched memcmp but failed to parse (likely not a
            // BountySubmission — different discriminator). Skip.
            void account;
          }
        }
        // Newest first.
        parsed.sort((a, b) => b.submittedAt - a.submittedAt);
        if (!cancelled) setChainSubmissions(parsed);
      } catch (e) {
        if (!cancelled) {
          setSubmissionsError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setSubmissionsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [useRealChain, onChain.module, bountyPda, connection, refreshKey]);

  // Merge on-chain submissions + localStorage refs (the on-chain ones win
  // because they have the full SubmissionOnChain data, including status
  // and awarded amount).
  const mergedChainSubmissions = useMemo(() => {
    const byPda = new Map<string, SubmissionOnChain>();
    for (const s of chainSubmissions) {
      byPda.set(s.address.toBase58(), s);
    }
    // For local-only refs not yet visible on-chain (RPC lag), surface them
    // as a stub so the creator at least sees "pending" rows.
    const stubs: { pda: string; submitter: string; submittedAt: number; status: 'unknown' }[] = [];
    for (const ref of storedSubmissionRefs) {
      if (!byPda.has(ref.pda)) {
        stubs.push({
          pda: ref.pda,
          submitter: ref.submitterPubkey,
          submittedAt: ref.submittedAt,
          status: 'unknown',
        });
      }
    }
    return {
      onChain: Array.from(byPda.values()),
      stubs,
    };
  }, [chainSubmissions, storedSubmissionRefs]);

  // On-chain loading state.
  if (useRealChain && chainBountyLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-3">
        <RefreshCw className="w-6 h-6 mx-auto text-muted-foreground animate-spin" />
        <p className="text-sm text-muted-foreground">Loading bounty from chain…</p>
        <p className="text-[11px] text-muted-foreground/70 font-mono break-all">
          {bountyPda?.toBase58()}
        </p>
      </div>
    );
  }

  // 404 — bounty doesn't exist (probably stale link or already deleted).
  if (!bounty) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-bold">Bounty not found</h1>
        <p className="text-sm text-muted-foreground">
          {chainBountyError
            ? chainBountyError
            : "This bounty doesn't exist (or was removed). It may have been deleted by its creator or you may be following a stale link."}
        </p>
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" onClick={goBack}>Back</Button>
          <Button onClick={() => navigate('/studio?tab=bounties')} className="bg-green-500 hover:bg-green-600 text-white">
            <Briefcase className="w-4 h-4 mr-1.5" /> Browse bounties
          </Button>
        </div>
      </div>
    );
  }

  const deadlineInfo = formatDeadline(bounty.deadline);
  // Creator check: in on-chain mode compare to unified wallet pubkey
  // (covers Privy embedded + Phantom); otherwise to mockChain.publicKey.
  const walletPk58 = unified.publicKey?.toBase58() ?? wallet.publicKey?.toBase58();
  const isCreator = useRealChain
    ? !!(walletPk58 && walletPk58 === bounty.creator)
    : bounty.creator === mockChain.publicKey;
  const canSubmit =
    !isCreator
    && bounty.status === 'active'
    && !deadlineInfo.expired
    // In on-chain mode, the wallet must be connected.
    && (!useRealChain || (onChain.module && (unified.connected || wallet.connected)));

  const handleSubmission = async () => {
    if (!workUrl.trim()) {
      showToast('error', 'Add a link to your work', 'Paste a Figma / GitHub / portfolio URL.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (useRealChain && onChain.module && bountyPda) {
        const uri = workUrl.trim().slice(0, BOUNTY_V2_LIMITS.SUBMISSION_URI_MAX);
        if (uri.length === 0) throw new Error('Empty work URL.');
        const res = await onChain.module.submitWork({ bounty: bountyPda, contentUri: uri });
        if (!res.success) throw new Error(res.error || 'on-chain submit failed');
        // H-4 — Persist the submission PDA + submitter so this browser can
        // surface it without depending on getProgramAccounts (which may lag
        // on slow RPC). The creator-side flow in another browser uses
        // getProgramAccounts instead.
        if (res.submission && (unified.publicKey || wallet.publicKey)) {
          recordOwnSubmission(bountyPda.toBase58(), {
            pda: res.submission.toBase58(),
            submitterPubkey: (unified.publicKey ?? wallet.publicKey!).toBase58(),
            submittedAt: Math.floor(Date.now() / 1000),
            workUrl: uri,
          });
        }
        showToast(
          'success',
          'Submission sent on-chain',
          `tx: ${res.signature.slice(0, 8)}…${res.submission ? ` · submission ${res.submission.toBase58().slice(0, 8)}…` : ''}`,
        );
        // Note field is ignored on-chain (program only stores contentUri).
        if (note.trim()) {
          showToast('info', 'Note skipped', 'The on-chain contract only stores the work URL. Add context inside the link instead.');
        }
      } else {
        await mockChain.submitBountyWork(bounty.id, workUrl.trim(), note.trim() || undefined);
        showToast('success', 'Submission sent', 'The bounty creator can now review it.');
      }
      setWorkUrl('');
      setNote('');
      setRefreshKey(k => k + 1);
    } catch (e: any) {
      showToast('error', 'Submission failed', e?.message || 'Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Creator-only on-chain actions ─────────────────────────────────────
  const parseSubmissionPda = (s: string): PublicKey | null => {
    try { return new PublicKey(s.trim()); } catch { return null; }
  };

  const handleAward = async () => {
    if (!useRealChain || !onChain.module || !bountyPda) return;
    const sub = parseSubmissionPda(awardSubPda);
    if (!sub) {
      showToast('error', 'Invalid submission PDA', 'Paste the base58 pubkey of the submission account.');
      return;
    }
    const amt = Number(awardAmount);
    if (!Number.isFinite(amt) || amt < BOUNTY_V2_LIMITS.MIN_AWARD_AMOUNT) {
      showToast('error', 'Invalid amount', `Award must be at least ${BOUNTY_V2_LIMITS.MIN_AWARD_AMOUNT} ORA.`);
      return;
    }
    setActionBusy('award');
    try {
      const gross = BigInt(Math.floor(amt)) * 1_000_000_000n; // 9 decimals
      const res = await onChain.module.awardSubmission({
        bounty: bountyPda,
        submission: sub,
        grossAmount: gross,
      });
      if (!res.success) throw new Error(res.error || 'award failed');
      showToast('success', 'Submission awarded', `tx: ${res.signature.slice(0, 8)}… · winner net = gross × 0.95`);
      setAwardSubPda(''); setAwardAmount('');
      setRefreshKey(k => k + 1);
    } catch (e: any) {
      showToast('error', 'Award failed', e?.message || 'Try again.');
    } finally {
      setActionBusy(null);
    }
  };

  const handleReject = async () => {
    if (!useRealChain || !onChain.module || !bountyPda) return;
    const sub = parseSubmissionPda(awardSubPda);
    if (!sub) {
      showToast('error', 'Invalid submission PDA', 'Paste the base58 pubkey of the submission account.');
      return;
    }
    setActionBusy('reject');
    try {
      const res = await onChain.module.rejectSubmission(bountyPda, sub);
      if (!res.success) throw new Error(res.error || 'reject failed');
      showToast('success', 'Submission rejected', `tx: ${res.signature.slice(0, 8)}…`);
      setAwardSubPda(''); setAwardAmount('');
      setRefreshKey(k => k + 1);
    } catch (e: any) {
      showToast('error', 'Reject failed', e?.message || 'Try again.');
    } finally {
      setActionBusy(null);
    }
  };

  const handleCancel = async () => {
    if (!useRealChain || !onChain.module || !bountyPda) return;
    setActionBusy('cancel');
    try {
      const res = await onChain.module.cancelBounty(bountyPda);
      if (!res.success) throw new Error(res.error || 'cancel failed');
      showToast('success', 'Bounty cancelled', `Escrow refunded to sponsor. tx: ${res.signature.slice(0, 8)}…`);
      setRefreshKey(k => k + 1);
    } catch (e: any) {
      showToast('error', 'Cancel failed', e?.message || 'Try again.');
    } finally {
      setActionBusy(null);
    }
  };

  const handleRefund = async () => {
    if (!useRealChain || !onChain.module || !bountyPda) return;
    setActionBusy('refund');
    try {
      const res = await onChain.module.refundExpired(bountyPda);
      if (!res.success) throw new Error(res.error || 'refund failed');
      showToast('success', 'Refund triggered', `Escrow returned to sponsor. tx: ${res.signature.slice(0, 8)}…`);
      setRefreshKey(k => k + 1);
    } catch (e: any) {
      showToast('error', 'Refund failed', e?.message || 'Try again.');
    } finally {
      setActionBusy(null);
    }
  };

  const statusChip = (() => {
    switch (bounty.status) {
      case 'active':
        return <Badge className="bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30">Active</Badge>;
      case 'completed':
        return <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30">Completed</Badge>;
      case 'expired':
        return <Badge variant="outline" className="text-muted-foreground">Expired</Badge>;
      default:
        return <Badge variant="outline">{bounty.status}</Badge>;
    }
  })();

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={goBack}
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      {/* Title card */}
      <div className="bg-card rounded-2xl border shadow-sm p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/15 text-green-600 dark:text-green-400 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold leading-tight">{bounty.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                {statusChip}
                <span className="text-[11px] text-muted-foreground">
                  ID {bounty.id.slice(0, 10)}…
                </span>
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Reward</p>
            <p className="text-2xl font-bold text-amber-500 inline-flex items-center gap-1">
              <Coins className="w-4 h-4" />
              {bounty.reward.toLocaleString()} <span className="text-base font-medium">ORA</span>
            </p>
          </div>
        </div>

        {/* Meta row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Meta icon={<Clock className="w-3.5 h-3.5" />} label="Deadline">
            <span className={deadlineInfo.expired ? 'text-muted-foreground' : deadlineInfo.soon ? 'text-amber-500' : ''}>
              {deadlineInfo.text}
            </span>
          </Meta>
          <Meta icon={<Calendar className="w-3.5 h-3.5" />} label="Closes">
            {bounty.deadline ? formatDate(bounty.deadline) : '—'}
          </Meta>
          <Meta icon={<Users className="w-3.5 h-3.5" />} label="Submissions">
            {bounty.submissionCount}
          </Meta>
          <Meta icon={<Briefcase className="w-3.5 h-3.5" />} label="Creator">
            <span className="inline-flex items-center gap-1.5">
              <UserAvatar src={undefined} displayName={bounty.creator} username={bounty.creator} className="w-4 h-4 rounded-full" />
              <span className="truncate">{bounty.creator || 'Unknown'}</span>
            </span>
          </Meta>
        </div>
      </div>

      {/* Brief */}
      <div className="bg-card rounded-2xl border shadow-sm p-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Brief
        </h2>
        {bounty.description ? (
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap leading-relaxed text-sm">
            {bounty.description}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            The creator didn't add a description.
          </p>
        )}
      </div>

      {/* My submissions to this bounty */}
      {mySubmissions.length > 0 && (
        <div className="bg-card rounded-2xl border shadow-sm p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your submissions ({mySubmissions.length})
          </h2>
          <ul className="space-y-2">
            {mySubmissions.map(s => (
              <li
                key={s.id}
                className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <a
                      href={s.workUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-aura hover:underline truncate"
                    >
                      {s.workUrl}
                    </a>
                  </div>
                  {s.note && (
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      {s.note}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    Submitted {formatDate(s.submittedAt)} · Reward snapshot {s.rewardSnapshot} ORA
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {s.status === 'pending' && (
                    <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/40">
                      <Clock className="w-3 h-3 mr-1" /> Pending
                    </Badge>
                  )}
                  {s.status === 'won' && (
                    <Badge className="bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Won
                    </Badge>
                  )}
                  {s.status === 'lost' && (
                    <Badge variant="outline" className="text-muted-foreground">
                      <XCircle className="w-3 h-3 mr-1" /> Lost
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Submit work form (other users only, while active) */}
      {canSubmit && (
        <div className="bg-card rounded-2xl border shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-aura/15 text-aura flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold">Submit your work</h2>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-1 block">
              Work link
            </label>
            <Input
              placeholder="https://figma.com/file/... or https://github.com/..."
              value={workUrl}
              onChange={e => setWorkUrl(e.target.value)}
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Public link to your deliverable. Figma, GitHub, Notion, IPFS, anywhere accessible.
            </p>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-1 block">
              Note (optional)
            </label>
            <Textarea
              placeholder="One paragraph: what you delivered, how it meets the brief, anything the creator should know."
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              className="text-sm resize-y"
            />
          </div>
          <Button
            onClick={handleSubmission}
            disabled={isSubmitting || !workUrl.trim()}
            className="w-full bg-aura hover:bg-aura-dark text-white disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting…' : (
              <>
                <Send className="w-4 h-4 mr-1.5" />
                Send submission
              </>
            )}
          </Button>
        </div>
      )}

      {/* States the user can't submit: not creator + not active */}
      {!canSubmit && !isCreator && (
        <div className="bg-muted/40 rounded-2xl border border-border/60 p-6 text-center">
          <AlertCircle className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">
            {deadlineInfo.expired
              ? 'This bounty has closed.'
              : bounty.status === 'completed'
                ? 'A winner has already been selected.'
                : 'Submissions are not open for this bounty.'}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            You can still browse the brief above.
          </p>
        </div>
      )}

      {/* H-4 — Submissions list (creator view, on-chain mode). Surfaces all
          submission PDAs against this bounty so the creator can click to
          select instead of hand-copying from a toast. */}
      {isCreator && useRealChain && bountyPda && (
        <div className="bg-card rounded-2xl border shadow-sm p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-aura" />
            <h2 className="text-sm font-semibold">Submissions to review</h2>
            <Badge variant="outline" className="text-[10px] ml-auto">
              {submissionsLoading
                ? 'loading…'
                : `${mergedChainSubmissions.onChain.length + mergedChainSubmissions.stubs.length} found`}
            </Badge>
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Refresh submissions"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${submissionsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {submissionsError && (
            <p className="text-[11px] text-amber-500">
              Submission discovery failed: {submissionsError}. Falling back to local cache.
            </p>
          )}
          {!submissionsLoading
            && mergedChainSubmissions.onChain.length === 0
            && mergedChainSubmissions.stubs.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              No submissions yet. Share the bounty URL with potential submitters.
            </p>
          )}
          <ul className="space-y-2">
            {mergedChainSubmissions.onChain.map(s => {
              const pda58 = s.address.toBase58();
              const selected = awardSubPda.trim() === pda58;
              const statusBadge = (() => {
                switch (s.status) {
                  case SubmissionStatus.Awarded:
                    return <Badge className="bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30"><Award className="w-3 h-3 mr-1" /> Awarded</Badge>;
                  case SubmissionStatus.Rejected:
                    return <Badge variant="outline" className="text-muted-foreground"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
                  default:
                    return <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/40"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
                }
              })();
              return (
                <li
                  key={pda58}
                  className={
                    'rounded-xl border px-4 py-3 cursor-pointer transition-colors ' +
                    (selected
                      ? 'border-aura bg-aura/10'
                      : 'border-border/60 bg-muted/30 hover:bg-muted/50')
                  }
                  onClick={() => setAwardSubPda(pda58)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        {s.contentUri ? (
                          <a
                            href={s.contentUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="hover:text-aura hover:underline truncate"
                          >
                            {s.contentUri}
                          </a>
                        ) : (
                          <span className="italic text-muted-foreground">no link provided</span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-muted-foreground/80 truncate">
                        {shortPk(pda58)} · by {shortPk(s.submitter.toBase58())}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70">
                        Submitted {formatDate(s.submittedAt * 1000)}
                        {s.status === SubmissionStatus.Awarded && s.awardedAmount > 0n && (
                          <> · Awarded {(Number(s.awardedAmount) / 1_000_000_000).toLocaleString()} ORA</>
                        )}
                      </p>
                    </div>
                    <div className="flex-shrink-0">{statusBadge}</div>
                  </div>
                </li>
              );
            })}
            {mergedChainSubmissions.stubs.map(s => (
              <li
                key={s.pda}
                className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/40"
                onClick={() => setAwardSubPda(s.pda)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold inline-flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                      Local reference
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground/80">
                      {shortPk(s.pda)} · by {shortPk(s.submitter)}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70">
                      Cached locally · {formatDate(s.submittedAt * 1000)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">cached</Badge>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-muted-foreground/70 leading-tight">
            Click a row to select it for award/reject below.
          </p>
        </div>
      )}

      {/* Creator-only on-chain actions — only renders when useRealChain. */}
      {isCreator && useRealChain && bountyPda && (
        <div className="bg-aura/5 border border-aura/30 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-aura" />
            <h2 className="text-sm font-semibold">Manage this bounty (on-chain)</h2>
            <Badge variant="outline" className="text-[10px] ml-auto">
              <LinkIcon className="w-2.5 h-2.5 mr-1" /> real chain
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Pick a submission from the list above (or paste a PDA manually) to award
            (release escrow) or reject. Cancel or refund returns escrow to you.
          </p>

          {/* Award / Reject row */}
          {bounty.status === 'active' && (
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground block">
                Submission PDA <span className="font-normal normal-case opacity-70">(auto-filled when you click a row above)</span>
              </label>
              <Input
                placeholder="base58 pubkey of submission account"
                value={awardSubPda}
                onChange={e => setAwardSubPda(e.target.value)}
                className="text-xs font-mono"
              />
              <label className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground block mt-2">
                Award amount (ORA, gross)
              </label>
              <Input
                type="number"
                placeholder={`min ${BOUNTY_V2_LIMITS.MIN_AWARD_AMOUNT}`}
                value={awardAmount}
                onChange={e => setAwardAmount(e.target.value)}
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Winner receives 95% net; 5% goes to the protocol fee split.
              </p>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleAward}
                  disabled={actionBusy !== null}
                  className="bg-aura hover:bg-aura-dark text-white flex-1"
                >
                  <Award className="w-3.5 h-3.5 mr-1.5" />
                  {actionBusy === 'award' ? 'Awarding…' : 'Award winner'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReject}
                  disabled={actionBusy !== null}
                  className="flex-1"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1.5" />
                  {actionBusy === 'reject' ? 'Rejecting…' : 'Reject'}
                </Button>
              </div>
            </div>
          )}

          {/* Cancel / Refund row */}
          <div className="flex gap-2 pt-2 border-t border-aura/20">
            {bounty.status === 'active' && !deadlineInfo.expired && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                disabled={actionBusy !== null}
                className="flex-1 text-red-600 border-red-500/40 hover:bg-red-500/10"
              >
                <Ban className="w-3.5 h-3.5 mr-1.5" />
                {actionBusy === 'cancel' ? 'Cancelling…' : 'Cancel bounty'}
              </Button>
            )}
            {deadlineInfo.expired && bounty.status !== 'completed' && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefund}
                disabled={actionBusy !== null}
                className="flex-1"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                {actionBusy === 'refund' ? 'Refunding…' : 'Refund expired'}
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/70 font-mono break-all pt-1">
            bounty: {bountyPda.toBase58()}
          </p>
        </div>
      )}

      {/* Creator-only note (mock mode) */}
      {isCreator && !useRealChain && (
        <div className="bg-aura/5 border border-aura/30 rounded-2xl p-6 space-y-2">
          <h2 className="text-sm font-semibold inline-flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-aura" />
            You posted this bounty
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Submissions arrive sealed — only you (the creator) can see them once decided.
            Manage incoming work and pick a winner from <span className="font-semibold">Studio → Bounties</span>.
          </p>
          <Button
            size="sm"
            onClick={() => navigate('/studio?tab=bounties')}
            className="bg-aura hover:bg-aura-dark text-white mt-2"
          >
            Manage in Studio
          </Button>
        </div>
      )}
    </div>
  );
}

function Meta({
  icon, label, children,
}: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground inline-flex items-center gap-1">
        {icon} {label}
      </p>
      <p className="text-sm font-semibold">{children}</p>
    </div>
  );
}
