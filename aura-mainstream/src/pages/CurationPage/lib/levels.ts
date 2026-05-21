// Curation EXP / level math.
// Extracted from CurationPage.tsx 2026-05-20 P-1 split.

export const LEVEL_UP_COSTS: number[] = [
  // Lv. 1→2…4→5  — Initiate, very gentle
  100, 200, 300, 400,
  // Lv. 5→6…9→10 — Apprentice
  600, 800, 1000, 1200, 1500,
  // Lv. 10→11…14→15 — Adept
  2000, 2500, 3000, 3500, 4000,
  // Lv. 15→16…19→20 — Expert
  5000, 6000, 7000, 8000, 10000,
  // Lv. 20→21…24→25 — Veteran (first coloured tier)
  13000, 16000, 20000, 25000, 30000,
  // Lv. 25→26…29→30 — Champion
  40000, 50000, 65000, 80000, 100000,
  // Lv. 30→31…34→35 — Master
  130000, 160000, 200000, 250000, 300000,
  // Lv. 35→36…39→40 — Grandmaster
  400000, 500000, 650000, 800000, 1000000,
  // Lv. 40→41…44→45 — Mythic
  1300000, 1600000, 2000000, 2500000, 3000000,
];
/** Growth factor for levels past the explicit table (Lv. 45+). */
export const LEVEL_UP_GROWTH = 1.3;

/** Round to a friendly number so beyond-table costs still look clean. */
export function roundNice(n: number): number {
  if (n <= 0) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(n)));
  const norm = n / mag;
  let nice: number;
  if (norm < 1.5) nice = 1;
  else if (norm < 2.25) nice = 2;
  else if (norm < 3.5) nice = 2.5;
  else if (norm < 7.5) nice = 5;
  else nice = 10;
  return Math.round(nice * mag);
}

/** EXP needed to step from level N to level N+1. */
export function costToAdvance(fromLevel: number): number {
  if (fromLevel < 1) return 0;
  const idx = fromLevel - 1; // costs[0] = cost from Lv.1→2
  if (idx < LEVEL_UP_COSTS.length) return LEVEL_UP_COSTS[idx];
  const lastIdx = LEVEL_UP_COSTS.length - 1;
  const overshoot = idx - lastIdx;
  const raw = LEVEL_UP_COSTS[lastIdx] * Math.pow(LEVEL_UP_GROWTH, overshoot);
  return roundNice(raw);
}

/** Cumulative EXP required to *reach* the given level. Lv. 1 = 0 EXP. */
export function expForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let i = 1; i < level; i++) total += costToAdvance(i);
  return total;
}

/** Resolve current level from an EXP total. Uncapped. */
export function levelForExp(exp: number): number {
  let lv = 1;
  while (expForLevel(lv + 1) <= exp) lv++;
  return lv;
}

/** Visual badge style for a level. 5-level color bands, intensity climbs. */
export function badgeStyleForLevel(level: number): {
  name: string;
  emoji: string;
  gradient: string;
  text: string;
  ring: string;
  glow?: string;
} {
  const band = Math.floor((Math.max(1, level) - 1) / 5);
  const styles = [
    /* 0 — Lv. 1–5   Initiate    */ { name: 'Initiate',     emoji: '○', gradient: 'from-slate-300/30 to-slate-400/30',                 text: 'text-slate-500 dark:text-slate-300',     ring: 'border-slate-300/60' },
    /* 1 — Lv. 6–10  Apprentice  */ { name: 'Apprentice',   emoji: '◆', gradient: 'from-amber-700/30 to-orange-700/30',               text: 'text-amber-700 dark:text-amber-400',     ring: 'border-amber-700/40' },
    /* 2 — Lv. 11–15 Adept       */ { name: 'Adept',        emoji: '✦', gradient: 'from-zinc-300/40 to-zinc-400/40',                  text: 'text-zinc-600 dark:text-zinc-200',       ring: 'border-zinc-400/50' },
    /* 3 — Lv. 16–20 Expert      */ { name: 'Expert',       emoji: '★', gradient: 'from-yellow-400/40 to-amber-500/40',               text: 'text-amber-600 dark:text-amber-400',     ring: 'border-amber-400/50' },
    /* 4 — Lv. 21–25 Veteran     */ { name: 'Veteran',      emoji: '🌿', gradient: 'from-emerald-400/40 to-teal-500/40',               text: 'text-emerald-600 dark:text-emerald-400', ring: 'border-emerald-400/50', glow: 'shadow-emerald-500/20' },
    /* 5 — Lv. 26–30 Champion    */ { name: 'Champion',     emoji: '💠', gradient: 'from-cyan-400/45 to-blue-500/45',                  text: 'text-cyan-600 dark:text-cyan-300',       ring: 'border-cyan-400/55', glow: 'shadow-cyan-500/25' },
    /* 6 — Lv. 31–35 Master      */ { name: 'Master',       emoji: '❇', gradient: 'from-violet-500/50 to-purple-600/50',              text: 'text-violet-600 dark:text-violet-300',   ring: 'border-violet-400/55', glow: 'shadow-violet-500/30' },
    /* 7 — Lv. 36–40 Grandmaster */ { name: 'Grandmaster',  emoji: '🔥', gradient: 'from-rose-500/50 to-pink-600/50',                  text: 'text-rose-600 dark:text-rose-300',       ring: 'border-rose-400/55', glow: 'shadow-rose-500/35' },
    /* 8 — Lv. 41–45 Mythic      */ { name: 'Mythic',       emoji: '🌈', gradient: 'from-pink-500/50 via-violet-500/50 to-cyan-500/50', text: 'text-fuchsia-600 dark:text-fuchsia-300', ring: 'border-fuchsia-400/55', glow: 'shadow-fuchsia-500/40' },
  ];
  if (band < styles.length) return styles[band];
  // Lv. 46+ Transcendent — holographic, all bands beyond use this
  return {
    name: 'Transcendent',
    emoji: '✨',
    gradient: 'from-amber-300/60 via-fuchsia-500/60 to-cyan-400/60',
    text: 'text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-fuchsia-500 to-cyan-400',
    ring: 'border-fuchsia-400/70',
    glow: 'shadow-fuchsia-500/50',
  };
}

/** One row per 5-level band in the ladder display. */
export const LEVEL_BANDS: Array<{ from: number; to: number }> = [
  { from: 1,  to: 5  },
  { from: 6,  to: 10 },
  { from: 11, to: 15 },
  { from: 16, to: 20 },
  { from: 21, to: 25 },
  { from: 26, to: 30 },
  { from: 31, to: 35 },
  { from: 36, to: 40 },
  { from: 41, to: 45 },
  { from: 46, to: 999 },
];
