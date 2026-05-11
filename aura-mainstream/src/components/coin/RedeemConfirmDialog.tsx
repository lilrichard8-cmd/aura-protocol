import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Lock, Truck, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

interface Benefit {
  id: string;
  title: string;
  description: string;
  threshold: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  benefit: Benefit | null;
  symbol: string;        // e.g. "$IRIS"
  creatorName: string;
  onConfirm: () => Promise<void>;
}

export default function RedeemConfirmDialog({ open, onOpenChange, benefit, symbol, creatorName, onConfirm }: Props) {
  const [loading, setLoading] = useState(false);

  if (!benefit) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Redemption</DialogTitle>
          <DialogDescription>
            Review the perk and the escrow flow before locking your coins.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Benefit summary */}
          <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h4 className="font-semibold text-sm leading-tight">{benefit.title}</h4>
              <span className="shrink-0 text-xs font-mono px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400">
                {benefit.threshold} {symbol}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{benefit.description}</p>
          </div>

          {/* Escrow flow explainer */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">How redemption works</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5 w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">1. Coins lock into protocol escrow</p>
                  <p className="text-xs text-muted-foreground">{benefit.threshold} {symbol} will be held by the protocol — neither you nor {creatorName} can move them.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5 w-7 h-7 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Truck className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">2. {creatorName} delivers the perk</p>
                  <p className="text-xs text-muted-foreground">You'll be notified when delivery is marked complete with a note from the creator.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5 w-7 h-7 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">3. You confirm receipt</p>
                  <p className="text-xs text-muted-foreground">Coins release to {creatorName}. If the perk isn't delivered as promised, you can dispute instead.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Trust note */}
          <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Escrow is enforced on-chain. Your coins are safe until you confirm — or you can dispute the redemption.</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? 'Locking…' : `Lock ${benefit.threshold} ${symbol}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
