/**
 * SupabaseFollowSync — invisible component that bridges the Supabase
 * `wallet_follows` table to mockChain's in-app notifications.
 *
 * Mounts once at app root. While the user has a connected wallet:
 *   • Pulls the current list of inbound followers and pushes a
 *     notification for each one not already in the tray.
 *   • Subscribes to Realtime INSERTs so future follows surface live.
 *
 * The notification dedupe key is `follow:<followerWallet>` (set inside
 * mockChain.notifyInboundFollow) so we never double-count even if the
 * polling pass and the Realtime event both deliver the same row.
 */
import { useEffect } from 'react';
import { useMockChain } from '@/context/MockChainContext';
import { listFollowers, subscribeNewFollowers, type WalletFollow } from '@/lib/follows';
import { SUPABASE_CONFIGURED } from '@/lib/supabase';

function shorten(addr: string): string {
  if (!addr) return 'Unknown';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function applyFollow(row: WalletFollow, notify: ReturnType<typeof useMockChain>['notifyInboundFollow']) {
  notify({
    followerWallet: row.follower_wallet,
    followerDisplayName: row.follower_display_name || shorten(row.follower_wallet),
    followerUsername: row.follower_username || shorten(row.follower_wallet),
    followerAvatar: row.follower_avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${row.follower_wallet}`,
  });
}

export default function SupabaseFollowSync() {
  const mockChain = useMockChain();
  const myWallet = mockChain.connected
    ? (mockChain.publicKey || mockChain.walletAddress || '')
    : '';

  useEffect(() => {
    if (!SUPABASE_CONFIGURED || !myWallet) return;
    let cancelled = false;

    // Initial pull — covers offline-while-followed cases.
    listFollowers(myWallet)
      .then((rows) => {
        if (cancelled) return;
        for (const row of rows) applyFollow(row, mockChain.notifyInboundFollow);
      })
      .catch(() => { /* network errors fall through to Realtime */ });

    // Realtime: surface new follows as they happen.
    const unsubscribe = subscribeNewFollowers(myWallet, (row) => {
      if (cancelled) return;
      applyFollow(row, mockChain.notifyInboundFollow);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [myWallet, mockChain.notifyInboundFollow]);

  return null;
}
