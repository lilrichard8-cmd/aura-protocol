import { useState, useEffect } from 'react';
import { useMockChain, type RedemptionRequest } from '@/context/MockChainContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/button';
import { Lock, Truck, CheckCircle2, Inbox, ShoppingBag, Clock, AlertTriangle } from 'lucide-react';

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
