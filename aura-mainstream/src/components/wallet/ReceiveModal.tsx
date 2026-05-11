import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/context/I18nContext';

interface Props {
  address: string;
  open: boolean;
  onClose: () => void;
}

const shorten = (a: string) => (a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);

export default function ReceiveModal({ address, open, onClose }: Props) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  if (!open) return null;

  const wallet = t.wallet as Record<string, unknown>;
  const receive = (wallet.receive as Record<string, string> | undefined) ?? {};
  const title = receive.title ?? 'Receive ORA';
  const subtitle = receive.subtitle ?? 'Share this address to receive tokens';
  const fullLabel = receive.fullAddress ?? 'Full address';
  const copyLabel = receive.copy ?? 'Copy';
  const copiedLabel = receive.copied ?? 'Copied';
  const closeLabel = receive.close ?? 'Close';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error('clipboard failed', e);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl border relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-secondary transition-colors"
          aria-label={closeLabel}
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="text-lg font-bold mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground mb-5">{subtitle}</p>

        <div className="flex justify-center mb-5">
          <div className="bg-white p-3 rounded-xl">
            <QRCodeSVG value={address} size={180} level="M" includeMargin={false} />
          </div>
        </div>

        <div className="bg-secondary/50 rounded-lg p-3 mb-4">
          <p className="text-xs text-muted-foreground mb-1">{fullLabel}</p>
          <p className="text-sm font-mono break-all">{address}</p>
          <p className="text-xs text-muted-foreground mt-1">{shorten(address)}</p>
        </div>

        <Button onClick={handleCopy} className="w-full" variant={copied ? 'default' : 'outline'}>
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              {copiedLabel}
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              {copyLabel}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
