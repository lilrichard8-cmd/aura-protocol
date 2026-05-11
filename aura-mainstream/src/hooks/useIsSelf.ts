// useIsSelf — returns true when the given user id refers to the current
// signed-in viewer. Use this to hide Follow buttons / inbox CTAs / etc.
// on the viewer's own profile, cards, and detail pages.
//
// 2026-05-11 R19. The check has to be defensive because the platform has
// three different "me" identifiers floating around:
//   • `me` — the seeded currentUser id in mock data
//   • `aura_creator` — the seeded currentUser.username also leaking as id
//   • `mockChain.publicKey` — the user's mock wallet pubkey
// Any one of these matching the input id means "this is me".

import { useAuth } from '@/context/AuthContext';
import { useMockChain } from '@/context/MockChainContext';

export function useIsSelf(userId: string | null | undefined): boolean {
  const { user: me } = useAuth();
  const mockChain = useMockChain();
  if (!userId) return false;
  if (me?.id && userId === me.id) return true;
  if (mockChain.publicKey && userId === mockChain.publicKey) return true;
  // Legacy fallbacks — seeded currentUser shipped with id='me' and
  // username='aura_creator'; some screens still hand the username as the
  // id slot. Treat both as self.
  if (userId === 'me' || userId === 'aura_creator') return true;
  return false;
}
