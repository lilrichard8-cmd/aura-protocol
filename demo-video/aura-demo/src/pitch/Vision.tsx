/**
 * Act 8 · Vision + CTA (2:28 – 2:45, 17s)
 *
 * Litepaper-grounded close: "Not money. Not funding. A chance for the
 * jury to feel it." The ask is a felt experience, not a deck.
 *
 * Beat:
 *   0–6s    "We're not asking for funding. We're asking you to feel it."
 *   6–11s   AURA logo + tagline center
 *  11–17s   CTA card with URL + "Connect a wallet. Mint a coin. In thirty minutes you'll know."
 */
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONT, auraGradient, bgGradient, sec } from './shared';

export const Vision: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1 — ask
  const askIn = interpolate(frame, [0, sec(0.8)], [0, 1], { extrapolateRight: 'clamp' });
  const askOut = interpolate(frame, [sec(5), sec(6)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ask = Math.min(askIn, askOut);

  // Phase 2 — logo
  const logoFrame = frame - sec(6);
  const logoSpring = spring({ frame: logoFrame, fps, config: { damping: 14, stiffness: 80 } });
  const logoOpacity = interpolate(logoFrame, [0, sec(0.7)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const logoExit = interpolate(frame, [sec(10), sec(11)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Phase 3 — CTA
  const ctaIn = interpolate(frame, [sec(11), sec(11.8)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ctaSpring = spring({ frame: frame - sec(11), fps, config: { damping: 14, stiffness: 100 } });

  return (
    <AbsoluteFill style={{ background: bgGradient(), fontFamily: FONT.family, color: COLORS.fg, alignItems: 'center', justifyContent: 'center' }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at center, ${COLORS.tealMid}1f 0%, transparent 60%)` }} />

      {/* Phase 1: ask */}
      {ask > 0 && (
        <div
          style={{
            position: 'absolute',
            opacity: ask,
            textAlign: 'center',
            transform: `scale(${0.94 + ask * 0.06})`,
            padding: '0 80px',
            maxWidth: 1700,
          }}
        >
          <div
            style={{
              fontSize: 52,
              fontWeight: 600,
              color: COLORS.muted,
              marginBottom: 32,
              letterSpacing: -0.5,
            }}
          >
            We're not asking for funding,
          </div>
          <div
            style={{
              fontSize: 124,
              fontWeight: 900,
              letterSpacing: -3,
              lineHeight: 1.05,
              background: auraGradient(135),
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: `drop-shadow(0 0 50px ${COLORS.tealMid}55)`,
            }}
          >
            a token allocation,
            <br />or a presale.
          </div>
          <div
            style={{
              fontSize: 40,
              fontWeight: 700,
              color: COLORS.fg,
              marginTop: 32,
              letterSpacing: -0.5,
            }}
          >
            We're asking for thirty minutes — to <span style={{ color: COLORS.amberLight, fontWeight: 900 }}>feel it.</span>
          </div>
        </div>
      )}

      {/* Phase 2: logo */}
      {frame >= sec(6) && frame < sec(11) && (
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transform: `scale(${logoSpring})`,
            opacity: Math.min(logoOpacity, logoExit),
          }}
        >
          <Img src={staticFile('aura-logo-transparent.png')} style={{ width: 280, height: 280, objectFit: 'contain' }} />
          <div
            style={{
              fontSize: 156,
              fontWeight: 900,
              letterSpacing: 12,
              marginTop: 20,
              background: auraGradient(90),
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            AURA
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 600,
              color: COLORS.muted,
              marginTop: 14,
              letterSpacing: 0.5,
            }}
          >
            Creator economy infrastructure. Built on Solana.
          </div>
        </div>
      )}

      {/* Phase 3: CTA */}
      {frame >= sec(11) && (
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 24,
            opacity: ctaIn,
            transform: `translateY(${(1 - ctaSpring) * 40}px)`,
            maxWidth: 1400,
            padding: '0 80px',
          }}
        >
          <Img src={staticFile('aura-logo-transparent.png')} style={{ width: 140, height: 140, objectFit: 'contain' }} />
          <div
            style={{
              fontSize: 88,
              fontWeight: 900,
              letterSpacing: 8,
              background: auraGradient(90),
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            AURA
          </div>
          <div
            style={{
              padding: '32px 64px',
              borderRadius: 24,
              background: COLORS.panelBg,
              border: `1.5px solid ${COLORS.tealMid}66`,
              minWidth: 900,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: COLORS.tealLight,
                letterSpacing: 6,
                textTransform: 'uppercase',
                marginBottom: 16,
                fontFamily: FONT.mono,
              }}
            >
              Connect · Mint · Curate
            </div>
            <div style={{ fontSize: 60, fontWeight: 900, letterSpacing: -1, color: COLORS.fg, fontFamily: FONT.mono }}>
              aura.builders
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, color: COLORS.muted, marginTop: 16 }}>
              Built for Colosseum 2026 · by Søren &amp; Iris
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
