/**
 * onChainPostStore — per-user post PDA registry kept in localStorage.
 *
 * The Core program (aura_core) stores posts on-chain as PDAs seeded by
 * [author, post_count], but there is no on-chain index of "all posts ever
 * published" we can scan client-side without a real RPC indexer. Until we
 * deploy a Helius/Hyperloop pipeline we keep a per-user list of post PDAs
 * in localStorage so the creator-loop subagent can:
 *
 *   1. After publishContent → write the new PDA to `aura_user_posts:<owner>`
 *   2. HomePage / ExplorePage feed aggregator → scan every
 *      `aura_user_posts:*` key in localStorage and merge → cross-user feed
 *      (per-device only — this is documented and TODO'd for the indexer).
 *   3. ProfilePage → list current user's posts by reading the per-user key.
 *
 * Schema (per key):
 *   key   = `aura_user_posts:<author_base58>`
 *   value = JSON [{ postPda, author, postId, createdAt, title?, mode? }]
 *
 * `postId` is the local UUID we generate in CreatePage so we can join
 * with the legacy `aura_user_posts` blob (mock content payload).
 *
 * 2026-05-19 — first cut for Tier-2 creator-loop real-chain.
 */

const PER_USER_KEY = (owner: string) => `aura_user_posts:${owner}`;

export interface OnChainPostRef {
  /** Base58 of the Solana PDA returned by Core publishContent. */
  postPda: string;
  /** Base58 of the author/wallet that published it. */
  author: string;
  /** Local UUID used in the legacy `aura_user_posts` blob. */
  postId: string;
  /** ms timestamp. */
  createdAt: number;
  /** Short title used for tooltips / placeholder cards. */
  title?: string;
  /** photo / text / video / audio / live. */
  mode?: string;
  /** Optional tx signature for explorer linking. */
  signature?: string;
}

function readPerUser(owner: string): OnChainPostRef[] {
  try {
    const raw = localStorage.getItem(PER_USER_KEY(owner));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as OnChainPostRef[]) : [];
  } catch {
    return [];
  }
}

export function getOwnPosts(owner: string): OnChainPostRef[] {
  if (!owner) return [];
  return readPerUser(owner);
}

export function recordOwnPost(owner: string, ref: OnChainPostRef): void {
  if (!owner || !ref?.postPda) return;
  try {
    const list = readPerUser(owner);
    // Dedup by PDA — re-publish flows shouldn't double-insert.
    if (list.some(r => r.postPda === ref.postPda)) return;
    list.unshift(ref); // newest-first
    localStorage.setItem(PER_USER_KEY(owner), JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('aura_user_posts_changed'));
  } catch {
    /* quota / disabled — silently drop. */
  }
}

/**
 * Scan every `aura_user_posts:*` localStorage key and return a flat list
 * of every post we have a PDA for. Per-device only — this is a placeholder
 * for the future indexer. Sorted newest-first.
 */
export function listAllKnownPosts(): OnChainPostRef[] {
  const out: OnChainPostRef[] = [];
  if (typeof localStorage === 'undefined') return out;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('aura_user_posts:')) continue;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          for (const ref of arr) {
            if (ref?.postPda && ref?.author) out.push(ref as OnChainPostRef);
          }
        }
      } catch { /* skip corrupt */ }
    }
  } catch { /* skip */ }
  return out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
