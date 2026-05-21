// NFT + content key + fractional NFT holdings summary card.
// Extracted from WalletPage.tsx 2026-05-20 P-1 split.
import { Layers, Sparkles, Key, ArrowRight } from 'lucide-react';
import type { OwnedKey, OwnedNft, FractionalizedNft } from '@/context/MockChainContext';

export function NftKeyHoldingsCard(props: {
  ownedKeys: OwnedKey[];
  ownedNfts: OwnedNft[];
  fractionalizedNfts: FractionalizedNft[];
  onSeeAll: () => void;
}) {
  const ownedFnfts = props.fractionalizedNfts.filter(f => f.ownedFragments > 0);
  const totalFragments = ownedFnfts.reduce((s, f) => s + f.ownedFragments, 0);
  const totalKeysValue = props.ownedKeys.reduce((s, k) => s + k.price, 0);
  const totalNftSpend = props.ownedNfts.reduce((s, n) => s + n.pricePaid, 0);

  return (
    <div className="bg-gradient-to-br from-indigo-500/10 to-violet-500/10 rounded-xl p-6 border border-indigo-200/50 dark:border-indigo-800/50 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-500" />
          <h3 className="text-lg font-bold">Owned Assets</h3>
        </div>
        <button onClick={props.onSeeAll} className="text-[11px] text-indigo-500 hover:underline inline-flex items-center gap-0.5">
          See all <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg bg-background/50 p-3">
          <div className="flex items-center gap-1 mb-0.5">
            <Sparkles className="w-3 h-3 text-pink-500" />
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-bold">NFTs</p>
          </div>
          <div className="text-xl font-bold tabular-nums">{props.ownedNfts.length}</div>
          <div className="text-[10px] text-muted-foreground">{totalNftSpend.toFixed(0)} ORA</div>
        </div>
        <div className="rounded-lg bg-background/50 p-3">
          <div className="flex items-center gap-1 mb-0.5">
            <Key className="w-3 h-3 text-indigo-500" />
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-bold">Keys</p>
          </div>
          <div className="text-xl font-bold tabular-nums">{props.ownedKeys.length}</div>
          <div className="text-[10px] text-muted-foreground">{totalKeysValue.toFixed(0)} ORA</div>
        </div>
        <div className="rounded-lg bg-background/50 p-3">
          <div className="flex items-center gap-1 mb-0.5">
            <Layers className="w-3 h-3 text-violet-500" />
            <p className="text-[9px] uppercase tracking-wide text-muted-foreground font-bold">Fragments</p>
          </div>
          <div className="text-xl font-bold tabular-nums">{totalFragments}</div>
          <div className="text-[10px] text-muted-foreground">{ownedFnfts.length} NFT{ownedFnfts.length === 1 ? '' : 's'}</div>
        </div>
      </div>

      {/* Recent holdings preview — unified list across the 3 asset types */}
      <div className="flex-1 min-h-0">
        {props.ownedKeys.length === 0 && ownedFnfts.length === 0 && props.ownedNfts.length === 0 ? (
          <div className="rounded-lg bg-background/30 border border-dashed border-border/50 p-4 text-center">
            <Sparkles className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No NFTs, keys, or fragments yet.</p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">Buy on the marketplace to fill this up.</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {props.ownedNfts.slice(0, 4).map(n => (
              <div key={n.nftId} className="flex items-center gap-2 rounded-md bg-background/40 px-2.5 py-2">
                <Sparkles className="w-3 h-3 text-pink-500 shrink-0" />
                <span className="text-[11px] font-medium flex-1 truncate">{n.name}</span>
                <span className="text-[9px] uppercase text-muted-foreground/70 font-mono">{n.acquisitionType}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{n.pricePaid.toFixed(0)} ORA</span>
              </div>
            ))}
            {props.ownedKeys.slice(0, 3).map(k => (
              <div key={k.keyId} className="flex items-center gap-2 rounded-md bg-background/40 px-2.5 py-2">
                <Key className="w-3 h-3 text-indigo-500 shrink-0" />
                <span className="text-[11px] font-medium flex-1 truncate">{k.title}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{k.price.toFixed(2)}</span>
              </div>
            ))}
            {ownedFnfts.slice(0, 3).map(f => (
              <div key={f.id} className="flex items-center gap-2 rounded-md bg-background/40 px-2.5 py-2">
                <Layers className="w-3 h-3 text-violet-500 shrink-0" />
                <span className="text-[11px] font-medium flex-1 truncate">{f.title}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{f.ownedFragments}f</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default NftKeyHoldingsCard;
