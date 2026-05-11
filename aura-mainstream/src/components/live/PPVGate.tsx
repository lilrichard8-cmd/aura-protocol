import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PPVGateProps {
  price: number;
  hostName: string;
  onPay: () => void;
  paying: boolean;
}

export default function PPVGate({ price, hostName, onPay, paying }: PPVGateProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center backdrop-blur-xl bg-black/60">
      <div className="text-center p-8 max-w-sm">
        <div className="w-16 h-16 rounded-full bg-ora/20 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-ora" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Premium Stream</h3>
        <p className="text-white/70 mb-6">
          This is an exclusive stream by <span className="text-white font-semibold">{hostName}</span>.
          Pay to unlock the full experience.
        </p>
        <Button
          onClick={onPay}
          disabled={paying}
          className="bg-gradient-to-r from-amber-500 to-ora text-white font-bold px-8 py-3 rounded-xl text-lg hover:opacity-90 transition-opacity"
        >
          {paying ? 'Processing...' : `Pay ${price} ORA to Watch`}
        </Button>
        <p className="text-white/40 text-xs mt-3">5% platform fee · 95% goes to creator</p>
      </div>
    </div>
  );
}
