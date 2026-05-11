// Shot 2 — Logo reveal
// 6 seconds. Picks up from Shot 1's fade-to-black.
//
// Sequence:
//   0.0–0.6s  black, AURA logo (🌸 flower) fades + scales in from 70% to 100%
//   0.6–1.2s  logo settles, soft purple/aura glow pulses behind it
//   1.2–2.0s  tagline line 1 slides up: "AURA"
//   2.0–3.0s  tagline line 2 fades in:   "Built on Solana. Co-founded by an AI."
//   3.0–5.5s  hold both, gentle glow continues
//   5.5–6.0s  fade to black for shot 3 hand-off
//
// Visual style: Iris-like floral feel without being cute. Dark background, single
// accent color (AURA brand cyan/teal #14C8A8 + soft purple #7C3AED).

import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const AURA_GREEN = '#14C8A8';
const AURA_PURPLE = '#7C3AED';

export const Shot2LogoReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // ── Logo entrance (frames 0..18, ~0.6s)
  const logoSpring = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    config: { damping: 14, stiffness: 90, mass: 0.6 },
  });
  const logoScale = 0.7 + 0.3 * logoSpring;
  const logoOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // ── Glow pulse breathing (loops every 3s)
  const glowPulse =
    0.5 + 0.25 * Math.sin((frame / fps) * Math.PI * 2 / 3);

  // ── Tagline line 1 "AURA" (frames 36..60, slide up)
  const t1Frame = frame - 36;
  const t1Opacity = interpolate(t1Frame, [0, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const t1TranslateY = interpolate(t1Frame, [0, 24], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Tagline line 2 (frames 60..90, fade in)
  const t2Frame = frame - 60;
  const t2Opacity = interpolate(t2Frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Final fade out (last 0.5s = 15 frames)
  const fadeOutOpacity = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000000',
        opacity: fadeOutOpacity,
      }}
    >
      {/* Glow halo behind logo */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 600,
            height: 600,
            borderRadius: '50%',
            background: `radial-gradient(circle at center, ${AURA_GREEN}44 0%, ${AURA_PURPLE}22 30%, transparent 70%)`,
            filter: 'blur(60px)',
            opacity: glowPulse * logoOpacity,
            transform: `translateY(-80px) scale(${0.9 + 0.1 * glowPulse})`,
          }}
        />
      </AbsoluteFill>

      {/* Logo + tagline stack */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          gap: 48,
        }}
      >
        {/* AURA brand logo — official PNG mark from aura-website-v2 */}
        <div
          style={{
            opacity: logoOpacity,
            transform: `scale(${logoScale})`,
            marginTop: -60,
            // Soft glow halo around the mark
            filter: `drop-shadow(0 0 24px ${AURA_GREEN}88) drop-shadow(0 0 60px ${AURA_GREEN}33)`,
          }}
        >
          <Img
            src={staticFile('aura-logo-transparent.png')}
            style={{ width: 280, height: 280, objectFit: 'contain' }}
          />
        </div>

        {/* Tagline block — sits absolute below logo so spacing is consistent */}
        <div
          style={{
            position: 'absolute',
            bottom: 220,
            left: 0,
            right: 0,
            textAlign: 'center',
            color: '#ffffff',
            fontFamily:
              "'Iowan Old Style', 'Georgia', 'Times New Roman', serif",
          }}
        >
          {/* Line 1: AURA, big serif */}
          <div
            style={{
              fontSize: 96,
              fontWeight: 600,
              letterSpacing: '0.18em',
              opacity: t1Opacity,
              transform: `translateY(${t1TranslateY}px)`,
              marginBottom: 16,
              // Soft gradient text fill (white -> aura green tint)
              background: `linear-gradient(180deg, #ffffff 0%, ${AURA_GREEN} 200%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            AURA
          </div>

          {/* Line 2: tagline, mono */}
          <div
            style={{
              fontFamily: "'SF Mono', 'JetBrains Mono', 'Menlo', monospace",
              fontSize: 22,
              letterSpacing: '0.36em',
              textTransform: 'uppercase',
              opacity: t2Opacity * 0.7,
              color: '#cdd6f4',
            }}
          >
            Built on Solana · Co-founded by an AI
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
