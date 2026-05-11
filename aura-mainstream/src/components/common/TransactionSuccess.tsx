import { useEffect } from 'react';
import FeeBreakdown from './FeeBreakdown';

interface TransactionSuccessProps {
  amount: number;
  label?: string;
  feeAmount?: number;
  /** Auto-dismiss duration in ms (0 = manual close only) */
  autoDismissMs?: number;
  onClose?: () => void;
}

export default function TransactionSuccess({
  amount,
  label = 'Transaction Successful',
  feeAmount,
  autoDismissMs = 3000,
  onClose,
}: TransactionSuccessProps) {
  useEffect(() => {
    if (autoDismissMs > 0 && onClose) {
      const t = setTimeout(onClose, autoDismissMs);
      return () => clearTimeout(t);
    }
  }, [autoDismissMs, onClose]);

  const fee = feeAmount ?? amount * 0.05;
  const creatorAmount = amount - fee;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-background rounded-2xl p-6 max-w-sm w-full mx-4 border shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Success icon */}
        <div className="text-center mb-4">
          <div className="text-5xl mb-2">✅</div>
          <h3 className="text-xl font-bold text-[#10B981]">{label}</h3>
          <p className="text-3xl font-bold mt-2">{amount.toFixed(4)} <span className="text-base text-muted-foreground">ORA</span></p>
        </div>

        {/* Fee breakdown */}
        <div className="bg-secondary rounded-xl p-4 mb-4">
          <div className="flex justify-between text-sm mb-3">
            <span className="text-muted-foreground">Protocol fee (5%)</span>
            <span className="font-mono font-medium">{fee.toFixed(4)} ORA</span>
          </div>
          <FeeBreakdown totalAmount={amount} feeAmount={fee} />
        </div>

        {/* Summary */}
        <div className="text-center text-xs text-muted-foreground space-y-0.5">
          <p className="font-medium">95% to creator · 5% to protocol</p>
          <p>Creator receives <span className="text-[#10B981] font-mono">{creatorAmount.toFixed(4)} ORA</span></p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="mt-4 w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Tap to close
          </button>
        )}
      </div>
    </div>
  );
}
