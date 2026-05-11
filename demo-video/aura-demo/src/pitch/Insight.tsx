/**
 * Act 3 · Insight (0:36 – 0:54, 18s)
 *
 * The thesis. Litepaper-grounded — "AURA is infrastructure, not a platform."
 *
 * Beat:
 *   0–5s    "AURA is not a platform."  /  "AURA is infrastructure."
 *   5–11s   The on-chain primitives (5 tag chips light up sequentially)
 *   11–18s  Logo emerges, wordmark + tagline (substrate-not-app framing)
 */
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONT, auraGradient, bgGradient, sec } from './shared';

const primitives = [
  { label: 'Identity',   icon: '🆔' },
  { label: 'Tokens',     icon: '🪙' },
  { label: 'Storage',    icon: '📦' },
  { label: 'Settlement', icon: '⚖️' },
  { label: 'Reputation', icon: '⭐' },
];

export const Insight: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1 — thesis
  const thesisIn = interpolate(frame, [sec(0.3), sec(1)], [0, 1], { extrapolateRight: 'clamp' });
  const thesisOut = interpolate(frame, [sec(4), sec(5)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const thesis = Math.min(thesisIn, thesisOut);

  // Phase 2 — primitives
  const primitivesStart = sec(5);
  const primitivesIn = interpolate(frame, [primitivesStart, sec(6)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const primitivesOut = interpolate(frame, [sec(10), sec(11)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const primitivesOpacity = Math.min(primitivesIn, primitivesOut);

  // Phase 3 — logo reveal
  const logoFrame = frame - sec(11);
  const logoSpring = spring({ frame: logoFrame, fps, config: { damping: 14, stiffness: 80 } });
  const logoOpacity = interpolate(logoFrame, [0, sec(0.5)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const wordmarkOpacity = interpolate(logoFrame, [sec(1), sec(2)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const taglineOpacity = interpolate(logoFrame, [sec(2.4), sec(3.4)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: bgGradient(), fontFamily: FONT.family, color: COLORS.fg, alignItems: 'center', justifyContent: 'center' }}>
      {/* Soft radial glow during logo reveal */}
      {frame >= sec(11) && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at center, ${COLORS.tealMid}33 0%, transparent 50%)`,
            opacity: logoOpacity,
          }}
        />
      )}

      {/* Phase 1: thesis */}
      {thesis > 0 && (
        <div
          style={{
            position: 'absolute',
            opacity: thesis,
            textAlign: 'center',
            transform: `scale(${0.94 + thesis * 0.06})`,
          }}
        >
          <div
            style={{
              fontSize: 80,
              fontWeight: 600,
              color: COLORS.muted,
              letterSpacing: -1,
              marginBottom: 24,
            }}
          >
            AURA is not a platform.
          </div>
          <div
            style={{
              fontSize: 152,
              fontWeight: 900,
              letterSpacing: -3,
              lineHeight: 1,
              background: auraGradient(135),
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: `drop-shadow(0 0 60px ${COLORS.tealMid}55)`,
            }}
          >
            AURA is infrastructure.
          </div>
        </div>
      )}

      {/* Phase 2: the substrate */}
      {primitivesOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            opacity: primitivesOpacity,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 48,
          }}
        >
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: COLORS.fg,
              letterSpacing: -1,
              textAlign: 'center',
              maxWidth: 1400,
              lineHeight: 1.2,
            }}
          >
            We are building the <span style={{ color: COLORS.tealLight, fontWeight: 900 }}>substrate</span> for the creator economy.
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1500 }}>
            {primitives.map((p, i) => {
              const chipStart = sec(5.4 + i * 0.18);
              const chipIn = interpolate(frame, [chipStart, chipStart + sec(0.4)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
              return (
                <div
                  key={p.label}
                  style={{
                    opacity: chipIn,
                    transform: `scale(${0.85 + chipIn * 0.15})`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '20px 32px',
                    borderRadius: 999,
                    background: 'rgba(13, 148, 136, 0.1)',
                    border: `1.5px solid ${COLORS.tealMid}77`,
                    fontSize: 32,
                    fontWeight: 700,
                    color: COLORS.tealGlow,
                    letterSpacing: 0.5,
                    fontFamily: FONT.mono,
                  }}
                >
                  <span style={{ fontFamily: FONT.family }}>{p.icon}</span>
                  {p.label}
                </div>
              );
            })}
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: COLORS.muted,
              fontStyle: 'italic',
              marginTop: 12,
            }}
          >
            …on-chain primitives that any frontend can plug into.
          </div>
        </div>
      )}

      {/* Phase 3: logo */}
      {frame >= sec(11) && (
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transform: `scale(${logoSpring})`,
            opacity: logoOpacity,
          }}
        >
          <Img src={staticFile('aura-logo-transparent.png')} style={{ width: 240, height: 240, objectFit: 'contain' }} />
          <div
            style={{
              opacity: wordmarkOpacity,
              fontSize: 132,
              fontWeight: 900,
              letterSpacing: 8,
              marginTop: 16,
              background: auraGradient(90),
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            AURA
          </div>
          <div
            style={{
              opacity: taglineOpacity,
              fontSize: 32,
              fontWeight: 600,
              color: COLORS.muted,
              marginTop: 16,
              letterSpacing: 0.5,
              textAlign: 'center',
            }}
          >
            The creator economy infrastructure. Built on Solana.
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
