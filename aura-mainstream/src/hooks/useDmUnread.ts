/**
 * Hook: live unread DM count for a wallet.
 *
 * Refreshes the count when:
 *   • the component mounts
 *   • a new DM addressed to me arrives (Realtime INSERT)
 *   • any of my DMs flips read_at (Realtime UPDATE — fires after markRead)
 *   • the route changes (covers "user opened /messages and read everything")
 *   • a fallback poll every 60s
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { unreadCount, subscribeMessages } from '@/lib/dm';
import { supabase, SUPABASE_CONFIGURED } from '@/lib/supabase';

let readChannelNonce = 0;

export function useDmUnread(myWallet: string | null | undefined): number {
  const [count, setCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    if (!SUPABASE_CONFIGURED || !myWallet || !supabase) {
      setCount(0);
      return;
    }
    let cancelled = false;
    let pollHandle: ReturnType<typeof setInterval> | null = null;

    const refresh = async () => {
      try {
        const n = await unreadCount(myWallet);
        if (!cancelled) setCount(n);
      } catch {
        // Network errors shouldn't crash the sidebar.
      }
    };
    refresh();
    // Lightweight 30s fallback poll — instant updates come from the
    // markRead event (below) and Realtime INSERT/UPDATE.
    pollHandle = setInterval(refresh, 30_000);

    // Same-tab event: MessagesPage dispatches `aura:dm:read` immediately
    // after a successful markRead RPC. We trust it and zero the count
    // optimistically; a refresh() right after corrects any drift.
    const onRead = (e: Event) => {
      const detail = (e as CustomEvent).detail as { wallet?: string } | undefined;
      if (detail?.wallet === myWallet) {
        if (!cancelled) setCount(0);
        refresh();
      }
    };
    window.addEventListener('aura:dm:read', onRead);

    // Realtime: new inbound message
    const unsubInsert = subscribeMessages(myWallet, (msg) => {
      if (msg.to_wallet === myWallet) refresh();
    });

    // Realtime: read_at flipped (markRead) — needs UPDATE subscription.
    const id = ++readChannelNonce;
    const sb = supabase;
    const readChannel = sb.channel(`dm-read-${myWallet}-${id}`);
    readChannel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'dm_messages',
        filter: `to_wallet=eq.${myWallet}`,
      },
      () => refresh(),
    );
    readChannel.subscribe();

    return () => {
      cancelled = true;
      if (pollHandle) clearInterval(pollHandle);
      unsubInsert();
      window.removeEventListener('aura:dm:read', onRead);
      try { sb.removeChannel(readChannel); } catch { /* noop */ }
    };
  }, [myWallet]);

  // Re-fetch on route change — covers the "opened /messages and read all"
  // transition even if Realtime UPDATE is delayed.
  useEffect(() => {
    if (!SUPABASE_CONFIGURED || !myWallet) return;
    let cancelled = false;
    (async () => {
      try {
        const n = await unreadCount(myWallet);
        if (!cancelled) setCount(n);
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, [location.pathname, myWallet]);

  return count;
}
