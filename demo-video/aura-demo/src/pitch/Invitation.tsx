/**
 * Act 6 · Invitation (1:40 – 2:00, 20s)
 *
 * The close. Not a pitch for funding — an invitation to feel the
 * product.
 *
 * Beat:
 *   0–4s    "We're not asking for funding."
 *   4–10s   "We're asking for 10 minutes — to feel it."
 *  10–14s   The three actions: Connect · Mint · Curate
 *  14–20s   Final CTA card — logo, URL, byline
 */
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONT, auraGradient, bgGradient, sec } from './shared';

const actions = [
  { verb: 'Connect',  sub: 'wallet · or just email',         glyph: '🔗' },
  { verb: 'Mint',     sub: 'your Creator Coin',               glyph: '🪙' },
  { verb: 'Curate',   sub: 'stake on someone you believe in', glyph: '✦' },
];

export const Invitation: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1: the "not asking"
  const negIn = interpolate(frame, [0, sec(0.8)], [0, 1], { extrapolateRight: 'clamp' });
  const negOut = interpolate(frame, [sec(3.2), sec(4)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const neg = Math.min(negIn, negOut);

  // Phase 2: the ask
  const askIn = interpolate(frame, [sec(4), sec(4.8)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const askOut = interpolate(frame, [sec(9.2), sec(10)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ask = Math.min(askIn, askOut);

  // Phase 3: the three actions
  const stepsStart = sec(10);
  const stepsOut = interpolate(frame, [sec(13.4), sec(14)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Phase 4: final CTA
  const ctaStart = sec(14);
  const ctaIn = interpolate(frame, [ctaStart, ctaStart + sec(0.7)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ctaSpring = spring({ frame: frame - ctaStart, fps, config: { damping: 14, stiffness: 95 } });

  return (
    <AbsoluteFill style={{ background: bgGradient(), fontFamily: FONT.family, color: COLORS.fg, alignItems: 'center', justifyContent: 'center' }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at center, ${COLORS.tealMid}1f 0%, transparent 60%)` }} />

      {/* Phase 1: not asking */}
      {neg > 0 && (
        <div style={{ position: 'absolute', opacity: neg, textAlign: 'center', padding: '0 80px', maxWidth: 1700 }}>
          <div
            style={{
              fontSize: 80,
              fontWeight: 700,
              color: COLORS.muted,
              letterSpacing: -1,
              lineHeight: 1.15,
            }}
          >
            We're <span style={{ textDecoration: 'line-through', textDecorationColor: '#EF4444', textDecorationThickness: 6 }}>not asking for funding.</span>
          </div>
          <div
            style={{
              fontSize: 40,
              fontWeight: 600,
              color: COLORS.mutedSoft,
              marginTop: 24,
              letterSpacing: -0.5,
            }}
          >
            Not a token allocation. Not a presale.
          </div>
        </div>
      )}

      {/* Phase 2: the ask */}
      {ask > 0 && (
        <div
          style={{
            position: 'absolute',
            opacity: ask,
            textAlign: 'center',
            padding: '0 80px',
            maxWidth: 1700,
            transform: `scale(${0.95 + ask * 0.05})`,
          }}
        >
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: COLORS.fg,
              marginBottom: 28,
              letterSpacing: -0.5,
            }}
          >
            We're asking for
          </div>
          <div
            style={{
              fontSize: 220,
              fontWeight: 900,
              letterSpacing: -6,
              lineHeight: 0.95,
              background: auraGradient(135),
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: `drop-shadow(0 0 60px ${COLORS.tealMid}55)`,
            }}
          >
            10 minutes
          </div>
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: COLORS.fg,
              marginTop: 32,
              letterSpacing: -0.5,
            }}
          >
            — to <span style={{ color: COLORS.amberLight, fontWeight: 900 }}>feel it.</span>
          </div>
        </div>
      )}

      {/* Phase 3: three actions */}
      {frame >= stepsStart && frame < ctaStart && (
        <div
          style={{
            position: 'absolute',
            opacity: stepsOut,
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            padding: '0 80px',
          }}
        >
          {actions.map((a, i) => {
            const start = stepsStart + sec(0.15 + i * 0.25);
            const enter = spring({ frame: frame - start, fps, config: { damping: 16, stiffness: 110 } });
            return (
              <div
                key={a.verb}
                style={{
                  opacity: enter,
                  transform: `translateY(${(1 - enter) * 20}px)`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                  padding: '36px 48px',
                  borderRadius: 24,
                  background: COLORS.panelBg,
                  border: `1.5px solid ${COLORS.tealMid}66`,
                  minWidth: 280,
                }}
              >
                <div style={{ fontSize: 64 }}>{a.glyph}</div>
                <div
                  style={{
                    fontSize: 44,
                    fontWeight: 900,
                    letterSpacing: -1,
                    color: COLORS.tealLight,
                    fontFamily: FONT.mono,
                  }}
                >
                  {a.verb}
                </div>
                <div style={{ fontSize: 18, color: COLORS.muted, fontWeight: 600, textAlign: 'center' }}>
                  {a.sub}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Phase 4: final CTA */}
      {frame >= ctaStart && (
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 22,
            opacity: ctaIn,
            transform: `translateY(${(1 - ctaSpring) * 30}px)`,
            maxWidth: 1400,
            padding: '0 80px',
          }}
        >
          <Img src={staticFile('aura-logo-transparent.png')} style={{ width: 140, height: 140, objectFit: 'contain' }} />
          <div
            style={{
              fontSize: 80,
              fontWeight: 900,
              letterSpacing: 8,
              background: auraGradient(90),
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1,
            }}
          >
            AURA
          </div>
          <div
            style={{
              padding: '28px 56px',
              borderRadius: 24,
              background: COLORS.panelBg,
              border: `1.5px solid ${COLORS.tealMid}66`,
              minWidth: 800,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: COLORS.tealLight,
                letterSpacing: 6,
                textTransform: 'uppercase',
                marginBottom: 12,
                fontFamily: FONT.mono,
              }}
            >
              Try it now
            </div>
            <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: -1, color: COLORS.fg, fontFamily: FONT.mono }}>
              aura.builders
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: COLORS.muted, marginTop: 14 }}>
              Colosseum 2026 · by Søren &amp; Iris
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
