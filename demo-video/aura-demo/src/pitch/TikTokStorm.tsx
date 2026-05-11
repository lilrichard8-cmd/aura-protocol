/**
 * Act 1 · TikTok Storm (0:00 – 0:14, 14s)
 *
 * Cold open with the visceral fear that everyone in the industry felt:
 * a single political decision could erase 170M users + a million careers
 * overnight. That is the borrowed-economy nightmare made concrete.
 *
 * Beat:
 *   0–4s   "January 2025." + headline-style cards stacking (ban, lawsuit, divest)
 *   4–9s   "170M users. One signature away from gone."
 *   9–14s  "And it wasn't an isolated incident — it's the model."
 *          Three platform logos blink → all show 'at risk' badges
 */
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONT, auraGradient, bgGradient, sec } from './shared';

const headlines = [
  { source: 'Reuters · Jan 19 2025', text: 'TikTok goes dark for 170M Americans' },
  { source: 'WSJ · Apr 2024',         text: 'Biden signs divest-or-ban law' },
  { source: 'Bloomberg · 2025',       text: 'A million creators wake up with no audience' },
];

export const TikTokStorm: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1: stacking headlines (0–4s)
  const phase1Out = interpolate(frame, [sec(3.5), sec(4.2)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Phase 2: scale punchline (4–9s)
  const phase2In = interpolate(frame, [sec(4.2), sec(5)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const phase2Out = interpolate(frame, [sec(8.3), sec(9)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const phase2 = Math.min(phase2In, phase2Out);

  // Phase 3: pattern (9–14s)
  const phase3In = interpolate(frame, [sec(9), sec(9.8)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: bgGradient(), fontFamily: FONT.family, color: COLORS.fg }}>
      {/* Restless red radial pulse so it feels urgent, not academic */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${50 + Math.sin(frame * 0.05) * 8}% ${40 + Math.cos(frame * 0.04) * 10}%, rgba(239, 68, 68, 0.18) 0%, transparent 55%)`,
          opacity: 0.6,
        }}
      />

      {/* Phase 1: stacking headlines */}
      {frame < sec(4.2) && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: phase1Out }}>
          <div style={{ width: 1300, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: 8,
                color: '#EF4444',
                textTransform: 'uppercase',
                fontFamily: FONT.mono,
                marginBottom: 8,
              }}
            >
              January 2025
            </div>
            {headlines.map((h, i) => {
              const start = sec(0.4 + i * 0.7);
              const enter = spring({ frame: frame - start, fps, config: { damping: 18, stiffness: 110 } });
              return (
                <div
                  key={i}
                  style={{
                    opacity: enter,
                    transform: `translateX(${(1 - enter) * 40}px)`,
                    padding: '20px 28px',
                    borderLeft: `4px solid #EF4444`,
                    background: COLORS.panelBg,
                    borderRadius: 6,
                  }}
                >
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: COLORS.muted,
                      fontFamily: FONT.mono,
                      letterSpacing: 2,
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    {h.source}
                  </div>
                  <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: -0.5, color: COLORS.fg }}>
                    {h.text}
                  </div>
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      )}

      {/* Phase 2: 170M + One signature */}
      {phase2 > 0 && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: phase2 }}>
          <div style={{ textAlign: 'center', padding: '0 80px' }}>
            <div
              style={{
                fontSize: 280,
                fontWeight: 900,
                letterSpacing: -8,
                lineHeight: 0.92,
                color: '#EF4444',
                filter: `drop-shadow(0 0 80px rgba(239,68,68,0.55))`,
              }}
            >
              170M
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, color: COLORS.muted, marginTop: 4, letterSpacing: 2 }}>
              users
            </div>
            <div
              style={{
                fontSize: 64,
                fontWeight: 800,
                letterSpacing: -1,
                marginTop: 48,
                lineHeight: 1.15,
                maxWidth: 1400,
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              one signature away from <span style={{ color: '#EF4444', fontWeight: 900 }}>gone.</span>
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* Phase 3: the pattern */}
      {phase3In > 0 && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: phase3In, padding: '0 80px' }}>
          <div style={{ textAlign: 'center', maxWidth: 1600 }}>
            <div
              style={{
                fontSize: 40,
                fontWeight: 600,
                color: COLORS.muted,
                letterSpacing: -0.5,
                marginBottom: 32,
              }}
            >
              And TikTok was just one of them.
            </div>
            <div
              style={{
                fontSize: 104,
                fontWeight: 900,
                letterSpacing: -2,
                lineHeight: 1.05,
                background: auraGradient(135),
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: `drop-shadow(0 0 40px ${COLORS.tealMid}55)`,
              }}
            >
              Every creator economy
              <br />runs on borrowed land.
            </div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
