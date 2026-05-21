// Wallet portfolio summary card.
// Extracted from WalletPage.tsx 2026-05-20 P-1 split.
import {
  Send,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PortfolioCard(props: {
  walletAddress: string;
  addrCopied: boolean;
  handleCopyAddress: () => void;
  showBalance: boolean;
  setShowBalance: (v: boolean) => void;
  oraBalance: number;
  solBalance: number;
  ccCount: number;
  txCount: number;
  onSend: () => void;
  onReceive: () => void;
  liveChain?: boolean;
  chainBalanceErr?: string | null;
}) {
  const shortenAddr = (addr: string) => addr ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : '—';
  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-xl p-6 border border-purple-200/50 dark:border-purple-800/50 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/40">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm">🌸</div>
        <span className="text-xs font-mono text-muted-foreground flex-1 truncate">{shortenAddr(props.walletAddress)}</span>
        <button onClick={props.handleCopyAddress} className="p-1 rounded hover:bg-secondary transition-colors" aria-label="Copy address">
          {props.addrCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold">Portfolio</h3>
          {props.liveChain && (
            <span
              title={
                props.chainBalanceErr
                  ? `Live chain (last error: ${props.chainBalanceErr})`
                  : 'Live balance — sourced from the ORA SPL token account on-chain'
              }
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                props.chainBalanceErr
                  ? 'bg-orange-500/10 text-orange-600 border-orange-500/30'
                  : 'bg-green-500/10 text-green-600 border-green-500/30'
              }`}
            >
              <Radio className="w-2.5 h-2.5" />
              {props.chainBalanceErr ? 'LIVE (err)' : 'LIVE'}
            </span>
          )}
        </div>
        <button onClick={() => props.setShowBalance(!props.showBalance)} className="p-1.5 hover:bg-white/10 rounded-full">
          {props.showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      </div>
      <div className="mb-2">
        <div className="text-4xl font-black tabular-nums leading-tight">
          {props.showBalance ? props.oraBalance.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '••••••'} <span className="text-base font-normal text-muted-foreground">ORA</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          ≈ ${props.showBalance ? (props.oraBalance * 0.02).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '••••'} USD
        </div>
      </div>
      <div className="text-xs text-muted-foreground mb-4">
        {props.showBalance ? `${props.solBalance.toFixed(4)} SOL` : '•••• SOL'}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg bg-background/50 px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground font-bold">CC</div>
          <div className="text-sm font-bold tabular-nums">{props.ccCount}</div>
        </div>
        <div className="rounded-lg bg-background/50 px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground font-bold">Txs</div>
          <div className="text-sm font-bold tabular-nums">{props.txCount}</div>
        </div>
      </div>
      <div className="flex gap-2 mt-auto">
        <Button onClick={props.onSend} className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 text-xs">
          <Send className="w-3.5 h-3.5 mr-1.5" /> Send
        </Button>
        <Button variant="outline" className="flex-1 text-xs" onClick={props.onReceive}>
          <Download className="w-3.5 h-3.5 mr-1.5" /> Receive
        </Button>
      </div>
      {props.liveChain && props.walletAddress && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(props.walletAddress) && (
        <a
          href={`https://explorer.solana.com/address/${props.walletAddress}?cluster=custom&customUrl=${encodeURIComponent('http://127.0.0.1:8899')}`}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 inline-flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          <ExternalLink className="w-3 h-3" /> View on Solana Explorer (localnet)
        </a>
      )}
    </div>
  );
}

export default PortfolioCard;
