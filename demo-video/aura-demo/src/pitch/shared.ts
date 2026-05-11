// Shared timing + style constants for the AURA pitch video.
//
// Theme switching: PITCH_THEME env var picks between palettes.
//   - 'dark'  (default): teal × amber on deep teal/black (Protocol page vibe)
//   - 'light' : white background, teal/amber accents (paper/poster look)
//   - 'green' : deep teal/emerald background, white text (KEEN/Apple Vision style)
//
// Pick at render time:
//   PITCH_THEME=light  npx remotion render PitchVideo out/pitch-light.mp4
//   PITCH_THEME=green  npx remotion render PitchVideo out/pitch-green.mp4

export const FPS = 30;
export const W = 1920;
export const H = 1080;

type ThemeName = 'dark' | 'light' | 'green';

// Read theme from env at module load time. Remotion forwards env vars
// to the rendering Chromium via Webpack's DefinePlugin.
const themeFromEnv = (typeof process !== 'undefined' && process.env?.PITCH_THEME) as ThemeName | undefined;
export const THEME: ThemeName = themeFromEnv && ['dark', 'light', 'green'].includes(themeFromEnv)
  ? themeFromEnv
  : 'dark';

const palettes: Record<ThemeName, {
  bg: string; bgMid: string; bgFar: string;
  fg: string; muted: string; mutedSoft: string;
  panelBg: string; panelBorder: string;
  glow: string;
}> = {
  dark: {
    bg: '#06201F',      bgMid: '#0a1418',          bgFar: '#000000',
    fg: '#ffffff',      muted: 'rgba(255,255,255,0.6)', mutedSoft: 'rgba(255,255,255,0.4)',
    panelBg: 'rgba(255,255,255,0.025)',
    panelBorder: 'rgba(255,255,255,0.12)',
    glow: 'rgba(13, 148, 136, 0.3)',
  },
  light: {
    // Off-white paper, soft warm tint — feels editorial, not clinical.
    bg: '#fafaf7',      bgMid: '#f4f4ee',          bgFar: '#ffffff',
    fg: '#0d2826',      // deep teal-ink for body text on white
    muted: 'rgba(15, 60, 56, 0.6)',
    mutedSoft: 'rgba(15, 60, 56, 0.35)',
    panelBg: 'rgba(13, 148, 136, 0.04)',
    panelBorder: 'rgba(13, 148, 136, 0.18)',
    glow: 'rgba(13, 148, 136, 0.18)',
  },
  green: {
    // Deep emerald-teal foreground, white text. Serious infra vibe.
    bg: '#0c3b35',      bgMid: '#0a2f2a',          bgFar: '#06201F',
    fg: '#ffffff',
    muted: 'rgba(255,255,255,0.7)',
    mutedSoft: 'rgba(255,255,255,0.45)',
    panelBg: 'rgba(255,255,255,0.05)',
    panelBorder: 'rgba(255,255,255,0.18)',
    glow: 'rgba(255, 255, 255, 0.15)',
  },
};

const p = palettes[THEME];

export const COLORS = {
  bg: p.bg, bgMid: p.bgMid, bgFar: p.bgFar,
  fg: p.fg, muted: p.muted, mutedSoft: p.mutedSoft,
  panelBg: p.panelBg, panelBorder: p.panelBorder,
  glow: p.glow,
  // Brand accents — these stay constant across themes so the visual
  // language reads as one family.
  tealMid: '#0d9488',     // teal-600
  tealDark: '#0f766e',    // teal-700
  tealLight: THEME === 'light' ? '#0d9488' : '#14b8a6',  // tighter on light
  tealGlow:  THEME === 'light' ? '#0f766e' : '#2dd4bf',
  amberMid:  THEME === 'light' ? '#b45309' : '#d97706',  // amber-700 on light for AAA contrast
  amberLight: THEME === 'light' ? '#d97706' : '#f59e0b',
  amberGlow:  THEME === 'light' ? '#f59e0b' : '#fbbf24',
  // Pillar accents
  pillarCoin:    '#0d9488',
  pillarMining:  THEME === 'light' ? '#b45309' : '#d97706',
  pillarGraph:   THEME === 'light' ? '#0d9488' : '#2dd4bf',
  pillarToken:   THEME === 'light' ? '#d97706' : '#f59e0b',
  pillarStorage: THEME === 'light' ? '#0891b2' : '#67e8f9',
};

export const FONT = {
  family: 'Inter, "SF Pro Display", system-ui, -apple-system, sans-serif',
  mono: '"JetBrains Mono", "SF Mono", Menlo, monospace',
};

/** Brand gradient — teal → amber. */
export const auraGradient = (deg = 90) =>
  `linear-gradient(${deg}deg, ${COLORS.tealMid} 0%, ${COLORS.amberMid} 100%)`;

/** Cooler gradient (more teal). */
export const coolGradient = (deg = 90) =>
  `linear-gradient(${deg}deg, ${COLORS.tealLight} 0%, ${COLORS.tealMid} 50%, ${COLORS.amberMid} 100%)`;

/** Page background — varies per theme but always 3-stop gradient. */
export const bgGradient = () =>
  `linear-gradient(135deg, ${COLORS.bg} 0%, ${COLORS.bgMid} 50%, ${COLORS.bgFar} 100%)`;

export const sec = (s: number) => Math.round(s * FPS);

export const ACT_SECONDS = {
  tiktok:    14,  // TikTok storm — the algorithm can erase a million careers overnight
  question:  18,  // My question — why not rebuild the substrate with Web3 logic?
  born:      14,  // AURA is born — logo reveal + thesis
  solution:  40,  // Five pillars (5 × 8s)
  frontends: 14,  // Open frontend ecosystem
  invitation: 20, // Invitation — 30 minutes, feel it
};

export const TOTAL_SECONDS = Object.values(ACT_SECONDS).reduce((a, b) => a + b, 0);
export const TOTAL_FRAMES = sec(TOTAL_SECONDS);
