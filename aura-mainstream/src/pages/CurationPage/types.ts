// Curation local types — extracted 2026-05-20 P-1 split.
import type { Sparkles } from 'lucide-react';
import type { Post } from '@/types';

export interface CurationRecord {
  id: string;
  contentId: string;
  contentTitle: string;
  contentCover?: string;
  stakeAmount: number;
  stakeTime: number;
  status: 'active' | 'claimed' | 'pending';
  rewards: number;
  timeWeight: number;
  performanceCoeff: number;
}

/**
 * EXP rules — some carry a formula (where the math actually matters), some
 * are plain descriptions (where the formula adds no clarity).
 */
export type ExpRule = {
  icon: typeof Sparkles;
  label: string;
  description: string;
  /** Optional formula — only when the math is the clearest way to communicate the rule. */
  formula?: string;
  /** Optional concrete example to anchor the description. */
  example?: string;
  /** Optional reward table for milestone-style rewards. */
  table?: Array<{ when: string; reward: string }>;
  signColor: string;
  iconColor: string;
};

export type LeaderboardEntry = {
  post: Post;
  tier: { multiplier: '5x' | '3x' | '2x' | '1x'; gradient: string };
  curatorCount: number;
  avgWeight: number;
  stakeScore: number;
  shareOfPool: number;
  curatorReward: number;
  creatorReward: number;
  totalStaked: number;
  mins: number;
};

export const RANK_STYLE: Record<number, { medal: string; ring: string; bgGlow: string }> = {
  1: { medal: '🥇', ring: 'ring-yellow-400/60',  bgGlow: 'from-yellow-400/20 to-amber-500/15' },
  2: { medal: '🥈', ring: 'ring-zinc-400/60',    bgGlow: 'from-zinc-300/20 to-zinc-400/15'    },
  3: { medal: '🥉', ring: 'ring-orange-400/60',  bgGlow: 'from-orange-400/20 to-amber-600/15' },
};
