/**
 * Curation Score helpers — single source of truth for the UI math
 * derived from whitepaper §8.4 (Curator Rank Weight × Discovery Weight).
 * Pages should import from here rather than redefining their own
 * thresholds, so a future tweak only touches this file.
 */

/** EXP cost / numeric weight for a curator's rank on a piece of content. */
export function rankWeightValue(rank: number): number {
  if (rank <= 1)   return 5;
  if (rank <= 10)  return 3;
  if (rank <= 50)  return 2;
  if (rank <= 200) return 1.5;
  if (rank <= 500) return 1.2;
  return 1;
}

/** Discovery Weight per whitepaper §8.4.2, by creator follower count. */
export function discoveryWeightValue(followers: number): number {
  if (followers < 100)      return 5;
  if (followers < 1_000)    return 3;
  if (followers < 10_000)   return 1.5;
  if (followers < 100_000)  return 1;
  return 0.5;
}

/** Compact multiplier label: "5x", "1.2x", "7.5x". */
export function formatMultiplier(n: number): string {
  const s = Number.isInteger(n) ? n.toFixed(0) : n.toFixed(2).replace(/\.?0+$/, '');
  return `${s}x`;
}

/**
 * Counts curate-tx hits against a given post. In the mock layer there is
 * only one user, so this is effectively the user's own count for the
 * post — enough to demonstrate rank progression on repeat curations.
 * Real builds replace this with the on-chain curator-count read from the
 * curation contract for that post.
 */
export function curatorCountFromChain(
  postId: string,
  transactions: Array<{ type: string; details?: string }>,
): number {
  const prefix = postId.slice(0, 8);
  let count = 0;
  for (const tx of transactions) {
    if (tx.type !== 'curate') continue;
    if (tx.details?.includes(prefix)) count += 1;
  }
  return count;
}

/** Prospective rank if you curate right now = existing curators + 1. */
export function prospectiveRankForPost(
  postId: string,
  transactions: Array<{ type: string; details?: string }>,
): number {
  return curatorCountFromChain(postId, transactions) + 1;
}

/**
 * Live follower count for a creator at this moment, derived from the
 * mock chain rather than the static seed in `mock.ts`. The static
 * `User.followers` is a demo placeholder; the protocol-level Curation
 * Score needs the real social graph. In the absence of a multi-user
 * backend the only signal we have is whether the connected wallet is
 * following the creator (0 or 1) — exactly the truth for a fresh
 * AURA deployment at hackathon time.
 */
export function liveFollowersFor(
  authorId: string,
  followingIds: string[],
): number {
  return followingIds.includes(authorId) ? 1 : 0;
}

/**
 * Combined Curation Score tier shown on Curate buttons / chips. Picks a
 * gradient based on the *combined* multiplier so the colour reflects
 * the actual share weight a curator would lock in, not just the rank
 * piece.
 */
export function combinedScoreTier(rank: number, followers: number): {
  combined: number;
  rankMult: number;
  discoveryMult: number;
  label: string;
  gradient: string;
} {
  const rankMult = rankWeightValue(rank);
  const discoveryMult = discoveryWeightValue(followers);
  const combined = rankMult * discoveryMult;
  let gradient: string;
  if (combined < 1)        gradient = 'from-slate-500 to-zinc-600 hover:from-slate-600 hover:to-zinc-700';
  else if (combined < 2)   gradient = 'from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600';
  else if (combined < 4)   gradient = 'from-lime-500 to-emerald-500 hover:from-lime-600 hover:to-emerald-600';
  else if (combined < 8)   gradient = 'from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600';
  else if (combined < 15)  gradient = 'from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700';
  else                     gradient = 'from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700';
  return {
    combined,
    rankMult,
    discoveryMult,
    label: formatMultiplier(combined),
    gradient,
  };
}
