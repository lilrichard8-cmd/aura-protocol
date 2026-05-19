/**
 * LoginButton — Privy email/social login entry point.
 *
 * Sits at the top of any page that needs auth. When the user is not logged in,
 * shows a single "Sign In" CTA that opens the Privy modal. When they're logged
 * in, shows a small chip with their email prefix + a logout button.
 *
 * This is intentionally tiny — full account management lives on the wallet
 * page / profile page. The point of this component is just "give me a frictionless
 * email login at the top of every page".
 */

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { LogIn, LogOut, ChevronDown, Loader2 } from 'lucide-react';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';

function truncateAddress(addr: string, head = 4, tail = 4): string {
  if (!addr || addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export default function LoginButton() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const uw = useUnifiedWallet();
  const [open, setOpen] = useState(false);

  // Don't render until Privy finishes initial bootstrap; otherwise the button
  // flashes "Sign In" → "Logged in" on every reload.
  if (!ready) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-xs">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>Loading</span>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <button
        onClick={() => login()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-aura text-white text-xs font-semibold transition-all duration-300 hover:scale-105 active:scale-95 hover:bg-aura-dark shadow-sm hover:shadow-md"
      >
        <LogIn className="w-3.5 h-3.5" />
        <span>Sign In</span>
      </button>
    );
  }

  // Pick a label: email prefix > truncated wallet > 'User'
  const emailAddr = user?.email?.address;
  const label = emailAddr
    ? emailAddr.split('@')[0]
    : uw.publicKey
      ? truncateAddress(uw.publicKey.toBase58())
      : 'User';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-aura/10 hover:bg-aura/20 text-aura text-xs font-semibold transition-all duration-300 border border-aura/30 hover:border-aura/50 shadow-sm"
      >
        <span className="max-w-[8rem] truncate">{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl bg-background border border-border shadow-xl shadow-black/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-border/50">
              <div className="text-xs text-muted-foreground">Signed in as</div>
              <div className="text-sm font-semibold truncate">{emailAddr || label}</div>
              {uw.publicKey && (
                <div className="mt-1 text-[10px] font-mono text-muted-foreground truncate" title={uw.publicKey.toBase58()}>
                  {truncateAddress(uw.publicKey.toBase58(), 6, 6)}
                </div>
              )}
              <div className="mt-1 text-[10px] text-muted-foreground">
                {uw.source === 'privy' ? 'Email wallet' : uw.source === 'adapter' ? 'External wallet' : 'Not connected'}
                {uw.isLocalnet ? ' · Localnet' : ''}
              </div>
            </div>
            <button
              onClick={() => { setOpen(false); void logout(); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
