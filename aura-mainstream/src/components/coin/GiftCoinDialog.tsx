import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Gift, Search } from 'lucide-react';
import { users, iris } from '@/data/mock';
import { useMockChain } from '@/context/MockChainContext';
import { useToast } from '@/context/ToastContext';
import { useCreatorCoinContract } from '@/hooks/useCreatorCoinContract';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

/**
 * Detect a plausible base58 Solana pubkey (43–44 chars, no 0/O/I/l). Used so
 * users can paste a wallet address for an on-chain gift; usernames and any
 * other string fall through to the mock SPL transfer.
 */
function tryParsePubkey(s: string): PublicKey | null {
  const t = s.trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(t)) return null;
  try { return new PublicKey(t); } catch { return null; }
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string;        // "$IRIS" / "$JUDGE" — full ticker
  available: number;     // sender's current balance (spendable)
}

interface Recipient {
  id?: string;
  username: string;
  name: string;
  avatar: string;
}

const FALLBACK_AVATAR = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80';

export default function GiftCoinDialog({ open, onOpenChange, symbol, available }: Props) {
  const mockChain = useMockChain();
  const { showToast } = useToast();
  // Real-chain bridge — VITE_CREATOR_COIN_REAL_CHAIN=true. Mock users have no
  // wallet addresses, so on-chain gifts only fire when the recipient field
  // contains a base58 pubkey. Username/mock recipients keep their existing
  // off-chain semantics so the demo flow never breaks.
  const onChain = useCreatorCoinContract();
  const uw = useUnifiedWallet();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Recipient | null>(null);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Suggested recipients = Iris + sample users + already-known holders.
  const suggestions: Recipient[] = useMemo(() => {
    const known: Recipient[] = [
      { id: iris.id, username: iris.username, name: iris.displayName, avatar: iris.avatar },
      ...users.map(u => ({ id: u.id, username: u.username, name: u.displayName, avatar: u.avatar })),
    ];
    // Dedup by username
    const seen = new Set<string>();
    return known.filter(r => {
      if (seen.has(r.username)) return false;
      seen.add(r.username);
      return true;
    });
  }, []);

  const filtered = query.trim()
    ? suggestions.filter(r =>
        r.username.toLowerCase().includes(query.toLowerCase()) ||
        r.name.toLowerCase().includes(query.toLowerCase())
      )
    : suggestions.slice(0, 6);

  const reset = () => { setQuery(''); setPicked(null); setAmount(''); setMessage(''); };

  const handleClose = () => {
    if (loading) return;
    reset();
    onOpenChange(false);
  };

  const handleGift = async () => {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast('error', 'Enter a positive amount.');
      return;
    }
    if (amt > available) {
      showToast('error', `You only have ${available} ${symbol}.`);
      return;
    }
    let recipient = picked;
    // Allow free-form username if user typed something but didn't click a suggestion.
    if (!recipient && query.trim()) {
      const u = query.trim().replace(/^@/, '');
      recipient = { username: u, name: u, avatar: FALLBACK_AVATAR };
    }
    if (!recipient) {
      showToast('error', 'Pick a recipient first.');
      return;
    }
    setLoading(true);
    try {
      // Real-chain path: only fires when (a) flag is on, (b) we have our
      // wallet, (c) recipient field is a real pubkey (paste mode), (d) the
      // sender's creator coin exists on-chain. Otherwise we fall through to
      // mockChain so usernames / demo recipients keep working.
      const recipientPk = tryParsePubkey(query) ?? null;
      let onChainSig: string | null = null;
      if (onChain.enabled && onChain.module && uw.publicKey && recipientPk) {
        try {
          const sender = uw.publicKey;
          // Resolve the creator coin from the connected wallet. Today we only
          // gift our own coin; if symbol-routing for foreign coins is needed,
          // the parent passes `creatorPubkey` and we resolve mint from there.
          const mintPda = onChain.coinMint(sender);
          if (mintPda) {
            const senderAta = getAssociatedTokenAddressSync(mintPda, sender, true);
            const recipientAta = getAssociatedTokenAddressSync(mintPda, recipientPk, true);
            const res = await onChain.module.giftCreatorCoin({
              coinMint: mintPda,
              senderTokenAccount: senderAta,
              recipient: recipientPk,
              recipientTokenAccount: recipientAta,
              amount: BigInt(Math.round(amt * 1e9)),
              memoUri: (message.trim() || '').slice(0, 256),
            });
            if (res.success) {
              onChainSig = res.signature;
            } else {
              showToast('error', res.error || 'On-chain gift failed (mock gift preserved)');
            }
          }
        } catch (err: any) {
          showToast('error', err?.message || 'On-chain gift threw');
        }
      }
      mockChain.giftCreatorCoin(symbol, amt, recipient, message.trim() || undefined);
      if (onChainSig) {
        showToast('success', `🎁 Sent ${amt} ${symbol} on-chain`, `tx: ${onChainSig.slice(0, 8)}…`);
      } else {
        showToast('success', `🎁 Sent ${amt} ${symbol} to @${recipient.username}!`);
      }
      reset();
      onOpenChange(false);
    } catch (err: any) {
      showToast('error', err.message || 'Gift failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(true); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-pink-500" />
            Gift {symbol}
          </DialogTitle>
          <DialogDescription>
            Send your {symbol} directly to another user. No fees, no escrow — instant transfer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipient picker */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recipient</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={e => { setQuery(e.target.value); setPicked(null); }}
                placeholder="Search username or name…"
                className="pl-9"
              />
            </div>
            {picked ? (
              <div className="flex items-center gap-3 p-2 rounded-lg bg-aura/10 border border-aura/30">
                <img src={picked.avatar} alt={picked.name} className="w-8 h-8 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{picked.name}</div>
                  <div className="text-xs text-muted-foreground truncate">@{picked.username}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => { setPicked(null); setQuery(''); }}>
                  Change
                </Button>
              </div>
            ) : (
              <div className="max-h-44 overflow-y-auto rounded-lg border bg-background/40">
                {filtered.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground text-center">
                    No matches. Press Send to gift to <span className="font-mono">@{query.replace(/^@/, '')}</span>.
                  </div>
                ) : (
                  filtered.map(r => (
                    <button
                      key={r.username}
                      onClick={() => { setPicked(r); setQuery(''); }}
                      className="w-full flex items-center gap-3 p-2 hover:bg-secondary/40 transition-colors text-left"
                    >
                      <img src={r.avatar} alt={r.name} className="w-7 h-7 rounded-full object-cover" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{r.name}</div>
                        <div className="text-xs text-muted-foreground truncate">@{r.username}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount</label>
              <span className="text-xs text-muted-foreground">
                Available: <span className="font-mono font-medium text-foreground">{available} {symbol}</span>
              </span>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="font-mono"
              />
              <Button variant="outline" size="sm" onClick={() => setAmount(String(available))} disabled={available <= 0}>
                Max
              </Button>
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Message (optional)</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="e.g. Thanks for the help!"
              className="w-full text-sm rounded-lg border bg-background px-3 py-2 resize-none"
              rows={2}
              maxLength={140}
            />
            <p className="text-[10px] text-muted-foreground text-right">{message.length}/140</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleGift} disabled={loading || !amount}>
            {loading ? 'Sending…' : <><Gift className="w-4 h-4 mr-1" /> Send Gift</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
