// Inventory tab — full NFT / Content Key / Fractional NFT listings.
// Extracted from WalletPage.tsx 2026-05-20 P-1 split (moved from StudioHubPage).
import { useNavigate } from 'react-router-dom';
import { Sparkles, Key, Layers } from 'lucide-react';
import type { OwnedKey, OwnedNft, FractionalizedNft } from '@/context/MockChainContext';

export function InventoryTab(props: {
  ownedKeys: OwnedKey[];
  ownedNfts: OwnedNft[];
  fractionalizedNfts: FractionalizedNft[];
  onMintFnft: () => void;
}) {
  const navigate = useNavigate();
  const ownedFnfts = props.fractionalizedNfts.filter(f => f.ownedFragments > 0);
  // Friendly label per acquisition type for the NFT cards.
  const ACQ_LABEL: Record<OwnedNft['acquisitionType'], string> = {
    auction: 'Auction win',
    fixed: 'Direct buy',
    mystery: 'Mystery box',
  };
  const ACQ_COLOR: Record<OwnedNft['acquisitionType'], string> = {
    auction: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    fixed: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    mystery: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="space-y-6">
      {/* Section 0: Full NFTs (auction wins / fixed buys / mystery reveals).
         These are the non-fractional NFTs minted on-chain to the user. */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-pink-500" />
            NFTs
            <span className="text-xs text-muted-foreground font-normal">({props.ownedNfts.length})</span>
          </h2>
        </div>
        {props.ownedNfts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/40 bg-secondary/20 p-6 text-center">
            <Sparkles className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No NFTs owned yet.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Win at auction, buy on fixed price, or open a mystery box on the marketplace.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {props.ownedNfts.map(n => (
              <button
                key={n.nftId}
                onClick={() => navigate(`/marketplace/nft/${n.nftId}`)}
                className="text-left rounded-xl border bg-card hover:border-pink-500/40 hover:shadow-sm transition-all overflow-hidden"
              >
                <div className="aspect-square bg-gradient-to-br from-pink-500/15 to-purple-500/15 flex items-center justify-center text-5xl relative overflow-hidden">
                  {n.coverImage ? (
                    <img src={n.coverImage} alt={n.name} className="w-full h-full object-cover" />
                  ) : (
                    <span>{n.coverEmoji ?? '🎨'}</span>
                  )}
                  <span className={`absolute top-2 left-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${ACQ_COLOR[n.acquisitionType]}`}>
                    {ACQ_LABEL[n.acquisitionType]}
                  </span>
                </div>
                <div className="p-3 space-y-1">
                  <p className="text-sm font-semibold truncate">{n.name}</p>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="font-mono font-bold">{n.pricePaid.toFixed(2)} ORA</span>
                  </div>
                  <p className="text-[9px] text-muted-foreground">
                    {new Date(n.acquiredAt).toLocaleDateString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Section 1: Content Keys */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold inline-flex items-center gap-2">
            <Key className="w-4 h-4 text-indigo-500" />
            Content Keys
            <span className="text-xs text-muted-foreground font-normal">({props.ownedKeys.length})</span>
          </h2>
        </div>
        {props.ownedKeys.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/40 bg-secondary/20 p-6 text-center">
            <Key className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No content keys purchased yet.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Buy keys to unlock premium content from creators.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {props.ownedKeys.map(k => (
              <button
                key={k.keyId}
                onClick={() => navigate(`/post/${k.contentId}`)}
                className="text-left rounded-xl border bg-card hover:border-indigo-500/40 hover:shadow-sm transition-all p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Key className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-mono text-muted-foreground truncate">{k.keyId.slice(0, 8)}…</span>
                </div>
                <p className="font-semibold text-sm truncate mb-2">{k.title}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-mono font-bold">{k.price.toFixed(2)} ORA</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Fractional NFTs */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold inline-flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-500" />
            Fractional NFTs
            <span className="text-xs text-muted-foreground font-normal">({ownedFnfts.length} owned / {props.fractionalizedNfts.length} total on platform)</span>
          </h2>
          <button onClick={props.onMintFnft} className="text-xs text-aura font-semibold hover:underline">
            Mint new →
          </button>
        </div>
        {ownedFnfts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/40 bg-secondary/20 p-6 text-center">
            <Layers className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">You don't own any NFT fragments yet.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Buy fragments on the marketplace or mint your own NFT.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {ownedFnfts.map(f => {
              const ownPct = f.totalFragments > 0 ? (f.ownedFragments / f.totalFragments) * 100 : 0;
              return (
                <button
                  key={f.id}
                  onClick={() => navigate(`/marketplace/fraction/${f.id}`)}
                  className="text-left rounded-xl border bg-card hover:border-violet-500/40 hover:shadow-sm transition-all overflow-hidden"
                >
                  <div className="aspect-square bg-gradient-to-br from-violet-500/15 to-indigo-500/15 flex items-center justify-center text-5xl">
                    {f.coverImage ? <img src={f.coverImage} alt={f.title} className="w-full h-full object-cover" /> : <span>{f.coverEmoji}</span>}
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-sm font-semibold truncate">{f.title}</p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{f.ownedFragments} of {f.totalFragments}</span>
                      <span className="text-violet-500 font-bold">{ownPct.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1 rounded-full bg-secondary/60 overflow-hidden">
                      <div className="h-full bg-violet-500" style={{ width: `${ownPct}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Value ≈ <span className="font-mono">{(f.ownedFragments * f.pricePerFragment).toFixed(2)} ORA</span>
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-[11px] text-muted-foreground italic px-1">
        More inventory types — sponsored ad slots, remix licenses, subscription NFTs — land in v0.9.
      </p>
    </div>
  );
}

export default InventoryTab;
