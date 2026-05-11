/**
 * Act 3 · AURA is born (0:32 – 0:46, 14s)
 *
 * The reveal beat. After the founder's question, the brand emerges as
 * the answer. Built on Solana, treated as infrastructure not a platform.
 *
 * Beat:
 *   0–3s    Soft fade-in of the AURA mark, glow ramps up
 *   3–9s    Wordmark + thesis: "AURA is not a platform. AURA is infrastructure."
 *   9–14s   Tagline + chain badge: "The creator economy substrate. Built on Solana."
 */
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONT, auraGradient, bgGradient, sec } from './shared';

export const AuraBorn: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({ frame, fps, config: { damping: 14, stiffness: 70 } });
  const logoOpacity = interpolate(frame, [0, sec(1.2)], [0, 1], { extrapolateRight: 'clamp' });

  const wordmarkIn = interpolate(frame, [sec(2.4), sec(3.2)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const thesisIn = interpolate(frame, [sec(3.5), sec(4.3)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const thesisOut = interpolate(frame, [sec(8.5), sec(9.3)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const thesis = Math.min(thesisIn, thesisOut);

  const taglineIn = interpolate(frame, [sec(9.3), sec(10)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Slow glow halo behind the logo
  const halo = 0.6 + Math.sin(frame * 0.04) * 0.15;

  return (
    <AbsoluteFill
      style={{
        background: bgGradient(),
        fontFamily: FONT.family,
        color: COLORS.fg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Halo */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 45%, ${COLORS.tealMid}55 0%, transparent 45%)`,
          opacity: halo * logoOpacity,
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        {/* Logo */}
        <Img
          src={staticFile('aura-logo-transparent.png')}
          style={{
            width: 240,
            height: 240,
            objectFit: 'contain',
            opacity: logoOpacity,
            transform: `scale(${0.85 + logoSpring * 0.15})`,
            filter: `drop-shadow(0 0 50px ${COLORS.tealMid}77)`,
          }}
        />

        {/* Wordmark */}
        <div
          style={{
            opacity: wordmarkIn,
            transform: `translateY(${(1 - wordmarkIn) * 12}px)`,
            fontSize: 156,
            fontWeight: 900,
            letterSpacing: 12,
            lineHeight: 1,
            background: auraGradient(90),
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          AURA
        </div>

        {/* Thesis */}
        {thesis > 0 && (
          <div
            style={{
              opacity: thesis,
              transform: `translateY(${(1 - thesisIn) * 12}px)`,
              textAlign: 'center',
              marginTop: 24,
              maxWidth: 1500,
            }}
          >
            <div
              style={{
                fontSize: 48,
                fontWeight: 600,
                color: COLORS.muted,
                letterSpacing: -0.5,
                marginBottom: 14,
              }}
            >
              not a platform.
            </div>
            <div
              style={{
                fontSize: 88,
                fontWeight: 900,
                letterSpacing: -2,
                background: auraGradient(135),
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: `drop-shadow(0 0 30px ${COLORS.tealMid}55)`,
                lineHeight: 1.05,
              }}
            >
              an infrastructure.
            </div>
          </div>
        )}

        {/* Tagline + chain */}
        {taglineIn > 0 && (
          <div
            style={{
              opacity: taglineIn,
              transform: `translateY(${(1 - taglineIn) * 10}px)`,
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              marginTop: 32,
              padding: '14px 28px',
              borderRadius: 999,
              background: COLORS.panelBg,
              border: `1.5px solid ${COLORS.tealMid}55`,
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.fg, letterSpacing: 0.5 }}>
              The creator-economy substrate
            </div>
            <div style={{ width: 1, height: 24, background: COLORS.panelBorder }} />
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: '#14F195',
                fontFamily: FONT.mono,
                letterSpacing: 2,
              }}
            >
              Built on Solana
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
