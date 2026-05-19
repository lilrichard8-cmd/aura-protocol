import { useState, useEffect } from 'react';
import { useMockChain, type RedemptionRequest } from '@/context/MockChainContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/button';
import { Lock, Truck, CheckCircle2, Inbox, ShoppingBag, Clock, AlertTriangle, Info, Link2 } from 'lucide-react';
import { useCreatorCoinContract } from '@/hooks/useCreatorCoinContract';
import {
  useCreatorCoinRedemption,
  RedemptionStatus as ChainRedemptionStatus,
  type RedemptionOnChain,
} from '@/hooks/useCreatorCoinRedemption';

/*
 * 2026-05-19 — Tier-2 creator-loop note.
 * The Creator-Coin redemption flow has a full on-chain implementation
 * (CreatorCoinModule.initiateRedemption / markDelivered / confirmReceipt /
 * disputeRedemption). Wiring this UI requires that each RedemptionRequest
 * carry an on-chain redemption_id + coin mint reference so we can derive
 * the redemption PDA. The current mock chain doesn't track these.
 *
 * To finish the on-chain wire-up:
 *   1. Extend `RedemptionRequest` with `coinMintBase58` and `redemptionId`
 *      (bigint counter from on-chain redemption_counter PDA).
 *   2. In `initiateRedemption` (MockChainContext) call
 *      creatorCoinOnChain.module.initiateRedemption and write the
 *      resulting id + counter back into the local RedemptionRequest.
 *   3. In handleDeliver / handleConfirm / dispute below, dispatch the
 *      matching SDK call after the mock-chain bookkeeping succeeds.
 *
 * This subagent (Tier-2 / creator-loop) sets the banner so the demo is
 * honest about the gap; the actual SDK dispatch will land in a follow-up
 * pass once MockChainContext exposes the redemption id.
 */

type ViewMode = 'buyer' | 'creator';

const STATUS_META: Record<RedemptionRequest['status'], { label: string; tone: string; icon: typeof Lock }> = {
  pending_delivery: { label: 'Awaiting delivery', tone: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', icon: Lock },
  delivered: { label: 'Delivered — confirm receipt', tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', icon: Truck },
  confirmed: { label: 'Completed', tone: 'bg-green-500/10 text-green-600 dark:text-green-400', icon: CheckCircle2 },
  disputed: { label: 'Disputed — awaiting arbitration', tone: 'bg-red-500/10 text-red-600 dark:text-red-400', icon: AlertTriangle },
};

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Live countdown to auto-confirm. Production = 7 days; demo = 30s.
const AUTO_CONFIRM_MS = 30_000;
function AutoConfirmCountdown({ deliveredAt }: { deliveredAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const remaining = Math.max(0, deliveredAt + AUTO_CONFIRM_MS - now);
  const seconds = Math.ceil(remaining / 1000);
  if (remaining === 0) return <span className="text-xs text-muted-foreground">Auto-confirming…</span>;
  return (
    <span className="text-xs text-muted-foreground">
      ⏱ Auto-confirms in <span className="font-mono font-medium text-foreground/80">{seconds}s</span>
    </span>
  );
}

export default function RedemptionsContent() {
  const mockChain = useMockChain();
  const { showToast } = useToast();
  // Surface chain-awareness; full wire-up gated on RedemptionRequest
  // schema upgrade (see header comment).
  const creatorCoinOnChain = useCreatorCoinContract();
  // 2026-05-19 — dedicated redemption facade. Lists real on-chain
  // redemptions for the local wallet whenever the flag is enabled.
  const redemptionChain = useCreatorCoinRedemption();
  const [chainRedemptions, setChainRedemptions] = useState<RedemptionOnChain[]>([]);
  const [chainLoading, setChainLoading] = useState(false);

  // Refresh on mount + every 30s. Lists all redemptions where the local
  // wallet appears as either buyer or creator. Two RPC calls (one each).
  useEffect(() => {
    if (!redemptionChain.enabled || !redemptionChain.payer) return;
    let cancelled = false;
    const tick = async () => {
      setChainLoading(true);
      try {
        const me = redemptionChain.payer!;
        const [asBuyer, asCreator] = await Promise.all([
          redemptionChain.listRedemptions({ buyer: me }),
          redemptionChain.listRedemptions({ creator: me }),
        ]);
        // De-duplicate by address (a user could be both buyer + creator
        // for distinct redemptions; same redemption never appears in both).
        const seen = new Set<string>();
        const merged: RedemptionOnChain[] = [];
        for (const r of [...asBuyer, ...asCreator]) {
          const k = r.address.toBase58();
          if (!seen.has(k)) { seen.add(k); merged.push(r); }
        }
        if (!cancelled) setChainRedemptions(merged);
      } catch (e) {
        console.warn('[RedemptionsContent] chain refresh failed', e);
      } finally {
        if (!cancelled) setChainLoading(false);
      }
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [redemptionChain.enabled, redemptionChain.payer]);
  const [view, setView] = useState<ViewMode>('buyer');
  const [deliverNote, setDeliverNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [disputeFor, setDisputeFor] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');

  const all = mockChain.redemptions;
  // Buyer view: redemptions the local user initiated.
  const buyerList = all.filter(r => r.perspective === 'me_as_buyer');
  // Creator view (mock): in this demo, the local user can simulate fulfillment for any
  // outstanding redemption (since other "creators" like Iris are not real accounts).
  const creatorList = all.filter(r => r.status !== 'confirmed' && r.status !== 'disputed');

  const list = view === 'buyer' ? buyerList : creatorList;

  const handleConfirm = async (id: string) => {
    setBusy(id);
    try {
      await mockChain.confirmRedemptionReceipt(id);
      showToast('success', '✅ Receipt confirmed — coins released to creator.');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to confirm');
    } finally {
      setBusy(null);
    }
  };

  const handleDeliver = async (id: string) => {
    setBusy(id);
    try {
      const note = (deliverNote[id] || '').trim() || undefined;
      await mockChain.markRedemptionDelivered(id, note);
      showToast('success', '🚚 Marked as delivered — buyer can now confirm.');
      setDeliverNote(prev => ({ ...prev, [id]: '' }));
    } catch (err: any) {
      showToast('error', err.message || 'Failed to mark delivered');
    } finally {
      setBusy(null);
    }
  };

  return (
    // 2026-05-09: layout flattened (was max-w-3xl mx-auto px-4 py-6) so the
    // component can fill the parent section. The toggle now sits at the
    // top-left of whatever wraps us (e.g. the Creator Coin redemption card).
    <div className="space-y-5">
      {creatorCoinOnChain.enabled && (
        <div className="flex items-start gap-2 text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 rounded-lg px-3 py-2">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div className="flex-1">
            <span className="font-semibold">Hybrid mode.</span>{' '}
            Mock-chain actions update local state. The <span className="font-mono">On-Chain</span> section
            below lists redemptions persisted on the Solana validator via{' '}
            <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">initiate_redemption</code>.
            mark-delivered / confirm-receipt for those rows dispatch real transactions.
          </div>
        </div>
      )}

      {/* On-chain section — only when the redemption flag is on. Always
          rendered above the mock list so it's visible during demos. */}
      {redemptionChain.enabled && (
        <div className="rounded-xl border border-emerald-200/50 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/20 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold inline-flex items-center gap-2">
              <Link2 className="w-4 h-4 text-emerald-600" />
              On-chain redemptions
              {chainLoading && <span className="text-[10px] text-muted-foreground">refreshing…</span>}
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {chainRedemptions.length} record{chainRedemptions.length === 1 ? '' : 's'}
            </span>
          </div>
          {chainRedemptions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No on-chain redemptions yet. They appear here after you sign{' '}
              <code className="font-mono">initiate_redemption</code> from a Creator-Coin detail page.
            </p>
          ) : (
            <div className="space-y-2">
              {chainRedemptions.map(r => (
                <ChainRedemptionRow
                  key={r.address.toBase58()}
                  redemption={r}
                  isCreator={redemptionChain.payer?.equals(r.creator) ?? false}
                  isBuyer={redemptionChain.payer?.equals(r.buyer) ?? false}
                  onMarkDelivered={async (noteUri) => {
                    const res = await redemptionChain.markDelivered({
                      coinMint: r.coinMint,
                      redemptionId: r.id,
                      noteUri,
                    });
                    if (!res.success) {
                      showToast('error', res.error || 'markDelivered failed');
                    } else {
                      showToast('success', `🚚 on-chain markDelivered tx: ${res.signature.slice(0, 12)}…`);
                    }
                  }}
                  onConfirmReceipt={async () => {
                    const res = await redemptionChain.confirmReceipt({
                      coinMint: r.coinMint,
                      redemptionId: r.id,
                      creator: r.creator,
                    });
                    if (!res.success) {
                      showToast('error', res.error || 'confirmReceipt failed');
                    } else {
                      showToast('success', `✅ on-chain confirmReceipt tx: ${res.signature.slice(0, 12)}…`);
                    }
                  }}
                  onDispute={async (reasonUri) => {
                    const res = await redemptionChain.disputeRedemption({
                      coinMint: r.coinMint,
                      redemptionId: r.id,
                      reasonUri,
                    });
                    if (!res.success) {
                      showToast('error', res.error || 'dispute failed');
                    } else {
                      showToast('success', `⚠️ on-chain dispute tx: ${res.signature.slice(0, 12)}…`);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
      {/* View toggle — top-left of parent frame */}
      <div className="inline-flex rounded-lg border bg-secondary/40 p-1">
        <button
          onClick={() => setView('buyer')}
          className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
            view === 'buyer' ? 'bg-aura/10 text-aura' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          My Redemptions
          {buyerList.length > 0 && <span className="text-xs opacity-70">({buyerList.length})</span>}
        </button>
        <button
          onClick={() => setView('creator')}
          className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
            view === 'creator' ? 'bg-aura/10 text-aura' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Inbox className="w-4 h-4" />
          To Fulfill
          {creatorList.length > 0 && <span className="text-xs opacity-70">({creatorList.length})</span>}
        </button>
      </div>

      {view === 'creator' && (
        <div className="text-xs text-muted-foreground rounded-lg bg-muted/40 px-3 py-2 border">
          🛠 <span className="font-medium">Mock creator mode</span> — for demo purposes you can mark any open redemption
          as delivered (in production, only the actual coin issuer can do this).
        </div>
      )}

      {list.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          {view === 'buyer'
            ? "You haven't redeemed any creator perks yet."
            : 'No redemption requests waiting for fulfillment.'}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(req => {
            const meta = STATUS_META[req.status];
            const Icon = meta.icon;
            const isBusy = busy === req.id;
            return (
              <div key={req.id} className="bg-card rounded-xl border p-4 space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm truncate">{req.benefitTitle}</h4>
                      <span className="shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400">
                        {req.cost} {req.symbol}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{req.benefitDescription}</p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium ${meta.tone}`}>
                    <Icon className="w-3 h-3" />
                    {meta.label}
                  </span>
                </div>

                {/* Counterparty + timing */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(req.createdAt)}
                  </span>
                  <span>·</span>
                  <span>
                    {view === 'buyer' ? (
                      <>Creator: <span className="text-foreground font-medium">{req.creatorName}</span></>
                    ) : (
                      <>Buyer: <span className="text-foreground font-medium">{req.buyerName}</span></>
                    )}
                  </span>
                </div>

                {/* Delivery note (if delivered) */}
                {req.status !== 'pending_delivery' && req.deliveryNote && (
                  <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs border">
                    <div className="font-medium mb-1 text-foreground/80">Delivery note from {req.creatorName}:</div>
                    <p className="text-muted-foreground whitespace-pre-wrap">{req.deliveryNote}</p>
                  </div>
                )}

                {/* Actions */}
                {view === 'creator' && req.status === 'pending_delivery' && (
                  <div className="space-y-2">
                    <textarea
                      value={deliverNote[req.id] || ''}
                      onChange={e => setDeliverNote(prev => ({ ...prev, [req.id]: e.target.value }))}
                      placeholder="Optional: add a delivery note (link, code, message...)"
                      className="w-full text-xs rounded-lg border bg-background px-3 py-2 resize-none"
                      rows={2}
                    />
                    <Button size="sm" onClick={() => handleDeliver(req.id)} disabled={isBusy}>
                      {isBusy ? 'Marking…' : 'Mark as Delivered'}
                    </Button>
                  </div>
                )}

                {view === 'buyer' && req.status === 'delivered' && (
                  <div className="space-y-2">
                    {disputeFor === req.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={disputeReason}
                          onChange={e => setDisputeReason(e.target.value)}
                          placeholder='Why are you disputing? (e.g. "link broken", "never received", "not as described")'
                          className="w-full text-xs rounded-lg border bg-background px-3 py-2 resize-none"
                          rows={2}
                        />
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="destructive" onClick={async () => {
                            setBusy(req.id);
                            try {
                              await mockChain.disputeRedemption(req.id, disputeReason.trim() || undefined);
                              showToast('success', '⚠️ Dispute filed — coins held pending arbitration.');
                              setDisputeFor(null); setDisputeReason('');
                            } catch (err: any) {
                              showToast('error', err.message || 'Failed to dispute');
                            } finally { setBusy(null); }
                          }} disabled={isBusy}>
                            Submit Dispute
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setDisputeFor(null); setDisputeReason(''); }} disabled={isBusy}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 flex-wrap">
                        <Button size="sm" onClick={() => handleConfirm(req.id)} disabled={isBusy}>
                          {isBusy ? 'Confirming…' : 'Confirm Receipt'}
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => setDisputeFor(req.id)} disabled={isBusy}>
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Dispute
                        </Button>
                        <AutoConfirmCountdown deliveredAt={req.deliveredAt || Date.now()} />
                      </div>
                    )}
                  </div>
                )}

                {req.status === 'disputed' && (
                  <div className="rounded-lg bg-red-500/5 border border-red-500/20 px-3 py-2 text-xs space-y-1">
                    <div className="font-medium text-red-600 dark:text-red-400">Pending arbitration</div>
                    {req.disputeReason && (
                      <p className="text-muted-foreground">Reason: <span className="text-foreground/80">{req.disputeReason}</span></p>
                    )}
                    <p className="text-muted-foreground">Coins remain in escrow until resolved by community vote.</p>
                  </div>
                )}

                {req.status === 'confirmed' && (
                  <p className="text-xs text-muted-foreground">
                    Released {formatTime(req.confirmedAt || req.createdAt)} · {req.cost} {req.symbol} → {req.creatorName}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// ChainRedemptionRow — renders one on-chain Redemption account.
// 2026-05-19 — Tier-2 creator-loop wire-up. Kept inline in this file
// because it's only used here and references the same status/icon meta.
// ────────────────────────────────────────────────────────────────────────

interface ChainRowProps {
  redemption: RedemptionOnChain;
  isCreator: boolean;
  isBuyer: boolean;
  onMarkDelivered: (noteUri: string) => Promise<void>;
  onConfirmReceipt: () => Promise<void>;
  onDispute: (reasonUri: string) => Promise<void>;
}

function chainStatusMeta(s: ChainRedemptionStatus): { label: string; tone: string } {
  switch (s) {
    case ChainRedemptionStatus.PendingDelivery: return { label: 'Pending delivery', tone: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' };
    case ChainRedemptionStatus.Delivered:       return { label: 'Delivered',         tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' };
    case ChainRedemptionStatus.Confirmed:       return { label: 'Confirmed',         tone: 'bg-green-500/10 text-green-600 dark:text-green-400' };
    case ChainRedemptionStatus.Disputed:        return { label: 'Disputed',          tone: 'bg-red-500/10 text-red-600 dark:text-red-400' };
    default: return { label: 'Unknown', tone: 'bg-muted text-muted-foreground' };
  }
}

function ChainRedemptionRow({ redemption, isCreator, isBuyer, onMarkDelivered, onConfirmReceipt, onDispute }: ChainRowProps) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const meta = chainStatusMeta(redemption.status);

  // Format the cost from base units (9 decimals).
  const costHuman = Number(redemption.cost) / 1e9;

  return (
    <div className="bg-card rounded-lg border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">#{redemption.id.toString()}</span>
            <span className="text-xs font-semibold">{costHuman} CC</span>
            <span className="text-[10px] font-mono text-muted-foreground truncate" title={redemption.address.toBase58()}>
              {redemption.address.toBase58().slice(0, 6)}…{redemption.address.toBase58().slice(-4)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Benefit #{redemption.benefitId} · slot {redemption.createdAtSlot.toString()}
          </p>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${meta.tone}`}>
          {meta.label}
        </span>
      </div>

      {/* Delivery note */}
      {redemption.status !== ChainRedemptionStatus.PendingDelivery && redemption.deliveryNoteUri && (
        <div className="text-[11px] text-muted-foreground bg-muted/30 rounded px-2 py-1">
          <span className="font-medium text-foreground/80">Note:</span> {redemption.deliveryNoteUri}
        </div>
      )}

      {/* Dispute reason */}
      {redemption.status === ChainRedemptionStatus.Disputed && redemption.disputeReasonUri && (
        <div className="text-[11px] text-red-600 dark:text-red-400 bg-red-500/10 rounded px-2 py-1">
          Dispute: {redemption.disputeReasonUri}
        </div>
      )}

      {/* Creator actions */}
      {isCreator && redemption.status === ChainRedemptionStatus.PendingDelivery && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Delivery note / tracking…"
            className="flex-1 text-xs rounded border bg-background px-2 py-1"
            maxLength={200}
          />
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => { setBusy(true); try { await onMarkDelivered(note); } finally { setBusy(false); } }}
          >
            {busy ? '…' : 'Mark Delivered'}
          </Button>
        </div>
      )}

      {/* Buyer actions */}
      {isBuyer && redemption.status === ChainRedemptionStatus.Delivered && (
        showDispute ? (
          <div className="space-y-1.5">
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Dispute reason"
              rows={2}
              className="w-full text-xs rounded border bg-background px-2 py-1 resize-none"
              maxLength={200}
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try { await onDispute(disputeReason); setShowDispute(false); setDisputeReason(''); }
                  finally { setBusy(false); }
                }}
              >
                {busy ? '…' : 'Submit dispute'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowDispute(false)} disabled={busy}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={busy} onClick={async () => { setBusy(true); try { await onConfirmReceipt(); } finally { setBusy(false); } }}>
              {busy ? '…' : 'Confirm receipt'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowDispute(true)} disabled={busy}>Dispute</Button>
          </div>
        )
      )}
    </div>
  );
}
