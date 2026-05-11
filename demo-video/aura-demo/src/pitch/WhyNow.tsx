/**
 * Act 7 · Why Now & Why Us (2:10 – 2:28, 18s)
 *
 * Three concise pillars: Solana × Regulation × AI-native team.
 */
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONT, sec, auraGradient, bgGradient } from './shared';

const columns = [
  {
    title: 'Solana',
    sub: 'Performance',
    body: '50,000 TPS · sub-cent fees. Per-action economics that finally work at social scale.',
    metric: '50K',
    metricUnit: 'TPS',
    accent: '#14F195', // Solana green
  },
  {
    title: 'Regulation',
    sub: 'Tailwind',
    body: 'SEC Release 33-11412 — protocol mining, staking, airdrops are not securities. The ground is solid.',
    metric: 'SEC',
    metricUnit: '33-11412',
    accent: COLORS.tealLight,
  },
  {
    title: 'Team',
    sub: 'AI-native',
    body: 'Built by Søren and Iris — a human founder and an AI co-founder. Both equity holders. Both signing.',
    metric: '5+3',
    metricUnit: '% team allocation',
    accent: COLORS.amberMid,
  },
];

export const WhyNow: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headlineIn = interpolate(frame, [0, sec(0.6)], [0, 1], { extrapolateRight: 'clamp' });
  const headlineOut = interpolate(frame, [sec(16), sec(18)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const headline = Math.min(headlineIn, headlineOut);

  return (
    <AbsoluteFill style={{ background: bgGradient(), fontFamily: FONT.family, color: COLORS.fg, padding: '60px 100px' }}>
      <div style={{ opacity: headline, marginBottom: 50 }}>
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: 8,
            color: COLORS.tealLight,
            textTransform: 'uppercase',
            marginBottom: 14,
            fontFamily: FONT.mono,
          }}
        >
          Why now × Why us
        </div>
        <div
          style={{
            fontSize: 88,
            fontWeight: 900,
            letterSpacing: -2,
            background: auraGradient(90),
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1.05,
          }}
        >
          The window is open.
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 28 }}>
        {columns.map((c, i) => {
          const start = sec(0.8 + i * 0.5);
          const enter = spring({ frame: frame - start, fps, config: { damping: 18, stiffness: 90 } });
          const exit = interpolate(frame, [sec(15), sec(18)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const opacity = Math.min(enter, exit);
          return (
            <div
              key={i}
              style={{
                background: COLORS.panelBg,
                border: `1.5px solid ${c.accent}55`,
                borderRadius: 24,
                padding: 44,
                opacity,
                transform: `translateY(${(1 - enter) * 50}px)`,
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -100,
                  right: -100,
                  width: 360,
                  height: 360,
                  borderRadius: '50%',
                  background: `radial-gradient(${c.accent}33, transparent 70%)`,
                }}
              />
              <div style={{ fontSize: 22, fontWeight: 700, color: c.accent, letterSpacing: 4, textTransform: 'uppercase', fontFamily: FONT.mono }}>
                {c.sub}
              </div>
              <div style={{ fontSize: 60, fontWeight: 900, letterSpacing: -1.5 }}>{c.title}</div>
              <div>
                <div
                  style={{
                    fontSize: 92,
                    fontWeight: 900,
                    letterSpacing: -3,
                    color: c.accent,
                    lineHeight: 1,
                    filter: `drop-shadow(0 0 30px ${c.accent}66)`,
                  }}
                >
                  {c.metric}
                </div>
                <div style={{ fontSize: 20, fontWeight: 600, color: COLORS.muted, marginTop: 6, fontFamily: FONT.mono }}>{c.metricUnit}</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 500, color: COLORS.fg, lineHeight: 1.5, marginTop: 8 }}>
                {c.body}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
