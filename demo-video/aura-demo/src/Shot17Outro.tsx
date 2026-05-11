// Shot 17 — Outro
// 6 seconds. Final beauty shot: AURA logo center, URL + handle below,
// tech stack pills at the bottom-right, gentle ambient glow.
//
// Sequence:
//   0.0–1.0s  fade in from black; logo scales in
//   1.0–2.5s  URL + handle fade in below logo
//   2.5–4.0s  tech stack pills slide up at bottom-right (Solana / Anchor /
//             Arweave / Lit Protocol)
//   4.0–5.5s  hold, gentle glow continues
//   5.5–6.0s  fade to black (end of film)

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

const STACK = ['Solana', 'Anchor', 'Arweave', 'Lit Protocol'];

export const Shot17Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Logo entrance (frames 0..24)
  const logoSpring = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    config: { damping: 14, stiffness: 80, mass: 0.6 },
  });
  const logoScale = 0.85 + 0.15 * logoSpring;

  // Glow pulse breathing
  const glowPulse = 0.5 + 0.25 * Math.sin((frame / fps) * Math.PI * 2 / 3);

  // URL block fade (frames 30..70)
  const urlFrame = frame - 30;
  const urlOpacity = interpolate(urlFrame, [0, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const urlTranslateY = interpolate(urlFrame, [0, 40], [12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Stack pills slide up (frames 75..120)
  const stackFrame = frame - 75;

  // Final fade out
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Top fade-in (entire scene from black)
  const topFade = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000000',
        opacity: fadeOut * topFade,
      }}
    >
      {/* Glow halo */}
      <AbsoluteFill
        style={{ justifyContent: 'center', alignItems: 'center' }}
      >
        <div
          style={{
            position: 'absolute',
            width: 700,
            height: 700,
            borderRadius: '50%',
            background: `radial-gradient(circle at center, ${AURA_GREEN}33 0%, ${AURA_PURPLE}1c 30%, transparent 70%)`,
            filter: 'blur(80px)',
            opacity: glowPulse,
            transform: `translateY(-40px) scale(${0.9 + 0.1 * glowPulse})`,
          }}
        />
      </AbsoluteFill>

      {/* Logo + URL stack */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          padding: 80,
          gap: 36,
        }}
      >
        <div
          style={{
            transform: `scale(${logoScale})`,
            filter: `drop-shadow(0 0 24px ${AURA_GREEN}88) drop-shadow(0 0 60px ${AURA_GREEN}33)`,
          }}
        >
          <Img
            src={staticFile('aura-logo-transparent.png')}
            style={{ width: 220, height: 220, objectFit: 'contain' }}
          />
        </div>

        {/* URL block */}
        <div
          style={{
            opacity: urlOpacity,
            transform: `translateY(${urlTranslateY}px)`,
            textAlign: 'center',
            color: '#ffffff',
            fontFamily:
              "'Iowan Old Style', 'Georgia', 'Times New Roman', serif",
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 600,
              letterSpacing: '0.06em',
              background: `linear-gradient(180deg, #ffffff 0%, ${AURA_GREEN} 200%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginBottom: 12,
            }}
          >
            aura.cool
          </div>
          <div
            style={{
              fontFamily: "'SF Mono', 'JetBrains Mono', 'Menlo', monospace",
              fontSize: 20,
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              color: '#cdd6f4',
              opacity: 0.65,
            }}
          >
            @AURAprotocol · github.com/aura-protocol
          </div>
        </div>
      </AbsoluteFill>

      {/* Tech stack pills, bottom strip */}
      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingBottom: 64,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 14,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {STACK.map((name, i) => {
            const pillFrame = stackFrame - i * 6;
            const opacity = interpolate(pillFrame, [0, 18], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const translateY = interpolate(pillFrame, [0, 18], [10, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            return (
              <div
                key={name}
                style={{
                  opacity,
                  transform: `translateY(${translateY}px)`,
                  border: `1px solid rgba(255,255,255,0.18)`,
                  borderRadius: 999,
                  padding: '8px 18px',
                  fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
                  fontSize: 14,
                  color: '#cdd6f4',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  background: 'rgba(255,255,255,0.04)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                {name}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
