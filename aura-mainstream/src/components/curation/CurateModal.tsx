/**
 * CurateModal — shared curation flow used by both the Curation page (latest
 * feed) and the post detail page. Single source of truth for layout, copy,
 * and the success animation, so the two entry points feel identical.
 *
 * Behaviour:
 *   • Renders the post preview, Curation Score chip (rank × discovery),
 *     fixed 1 ORA cost, current balance, Cancel / Curate buttons.
 *   • On confirm: calls mockChain.curateContent — a 1 ORA debit, and
 *     also pushes the curation-reward in-app notification (handled inside
 *     the mockChain action, so callers don't need to do anything extra).
 *   • Switches to a green "Curated!" success view for ~2.5s before
 *     closing automatically (or the caller can close immediately).
 */
import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FeeBreakdown from '@/components/common/FeeBreakdown';
import { useMockChain } from '@/context/MockChainContext';
import { useToast } from '@/context/ToastContext';
import { useCurationContract, tryParseContentId } from '@/hooks/useCurationContract';
import {
  prospectiveRankForPost, liveFollowersFor, combinedScoreTier,
  formatMultiplier,
} from '@/lib/curation-score';
import type { Post } from '@/types';

function fallbackEmoji(post: Post): string {
  return post.type === 'audio' ? '🎵'
    : post.type === 'video' ? '🎬'
    : post.type === 'photo' ? '📷'
    : post.type === 'live' ? '🔴'
    : '✍️';
}

interface CurateModalProps {
  open: boolean;
  post: Post | null;
  onClose: () => void;
  /** Optional callback fired when the curation transaction succeeds. */
  onCurated?: (result: { weight: string }) => void;
}

export default function CurateModal({ open, post, onClose, onCurated }: CurateModalProps) {
  const mockChain = useMockChain();
  const curation = useCurationContract();
  const { showToast } = useToast();
  const [curating, setCurating] = useState(false);
  const [result, setResult] = useState<{ weight: string } | null>(null);

  if (!open || !post) return null;

  const balance = mockChain.oraBalance;
  const insufficient = balance < 100;
  const rank = prospectiveRankForPost(post.id, mockChain.transactions);
  const followers = liveFollowersFor(post.author.id, mockChain.followingIds);
  const tier = combinedScoreTier(rank, followers);

  const handleConfirm = async () => {
    setCurating(true);
    try {
      // 2026-05-19 Tier 1.5: try real chain if enabled AND the post id is a
      // base58 Pubkey (i.e. an on-chain PostV2 PDA). Posts that exist only in
      // mock chain (string ids) fall through to the mock path.
      const onChainId = curation.enabled ? tryParseContentId(post.id) : null;
      if (curation.enabled && onChainId) {
        const tx = await curation.curate({ contentId: onChainId });
        if (!tx.success) {
          // Surface a creator-friendly message for the un-initialized pool case.
          const err = tx.error || 'on-chain curate failed';
          if (err.startsWith('pool-not-initialized')) {
            throw new Error(
              "Curation pool not set up for this content yet. The creator's pool needs to be initialized by an admin.",
            );
          }
          throw new Error(err);
        }
        // Mirror the success into mock chain so history / curated set updates
        // visually until we wire a real-chain feed.
        try {
          await mockChain.curateContent(post.id);
        } catch {
          /* mock-side bookkeeping is non-fatal */
        }
        const r = { weight: `Curated on-chain (record ${tx.record?.toBase58().slice(0, 4)}…)` };
        setResult(r);
        onCurated?.(r);
      } else {
        const r = await mockChain.curateContent(post.id);
        setResult(r);
        onCurated?.(r);
      }
      // Auto-close after the success animation has had time to read.
      setTimeout(() => {
        setResult(null);
        setCurating(false);
        onClose();
      }, 2500);
    } catch (e: any) {
      showToast('error', e?.message || 'Curation failed');
      setCurating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={() => !curating && onClose()}
    >
      <div
        className="bg-background rounded-2xl p-6 max-w-md w-full border shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {result ? (
          <div>
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">✨</div>
              <h3 className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                Curated! −1 ORA → Curation Pool
              </h3>
              <div className="bg-amber-500/10 rounded-xl p-3 text-sm font-medium text-amber-600 dark:text-amber-400">
                {result.weight}
              </div>
            </div>
            <div className="bg-secondary rounded-xl p-4 mt-3">
              <p className="text-xs text-muted-foreground mb-2 font-medium">
                Protocol Fee Structure (5%)
              </p>
              <FeeBreakdown totalAmount={1} feeAmount={0.05} compact />
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-bold mb-4">Curate Content</h3>

            <div className="mb-4 p-3 bg-secondary rounded-lg flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                {post.coverImage || post.images?.[0] ? (
                  <img
                    src={post.coverImage || post.images?.[0]}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl">
                    {fallbackEmoji(post)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-medium line-clamp-1">
                  {post.title || post.content?.slice(0, 60) || 'Untitled'}
                </p>
                <p className="text-xs text-muted-foreground">by @{post.author.username}</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Curation Score chip */}
              <div className="bg-amber-500/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    Your Curation Score
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r ${tier.gradient} text-white text-[10px] font-bold`}>
                    #{rank} · {tier.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Combined = <strong className="text-foreground">{formatMultiplier(tier.rankMult)}</strong> rank × <strong className="text-foreground">{formatMultiplier(tier.discoveryMult)}</strong> discovery. Rank tiers: 5× 1st · 3× 2–10 · 2× 11–50 · 1.5× 51–200 · 1.2× 201–500 · 1× 500+.
                </p>
              </div>

              <div className="bg-amber-500/10 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">1 ORA</p>
                <p className="text-xs text-muted-foreground">
                  Fixed curation cost — the 1 ORA flows into the daily 20,000 ORA reward pool. Your share is set by Curation Score (rank × discovery weight).
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Wallet className="w-3.5 h-3.5" />
                Balance: {balance.toFixed(2)} ORA
                {insufficient && (
                  <span className="text-red-500 font-medium ml-2">
                    ⚠ Need ≥100 ORA to curate
                  </span>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                  disabled={curating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={curating || insufficient}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600"
                >
                  {curating
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Curating…</>
                    : 'Curate — 1 ORA'}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
