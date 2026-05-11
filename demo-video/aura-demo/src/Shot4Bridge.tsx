// Shot 4 — AURA Bridge
// 7 seconds. Picks up after Shot 3's "DEPLATFORMED" cards. Wipes the negative
// energy with a particle dissolve and reveals the AURA promise as a positive
// counter-statement.
//
// Sequence:
//   0.0–1.0s  black, white shimmer particles drift up screen (afterimage of slashes)
//   1.0–2.5s  large serif headline letter-fade in: "AURA is built on a different bet."
//   2.5–4.5s  pause + subtle particle continues
//   4.5–6.5s  second line slides up: "Own your audience. Own your economy."
//   6.5–7.0s  fade out for Shot 5 (Iris reveal) hand-off

import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const AURA_GREEN = '#14C8A8';

export const Shot4Bridge: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Headline 1 letter-by-letter fade-in (frames 30..75, 1.0–2.5s)
  const h1Text = 'AURA is built on a different bet.';
  const h1StartFrame = 30;
  const h1Frame = frame - h1StartFrame;
  const h1CharsVisible = Math.max(
    0,
    Math.min(h1Text.length, Math.floor(h1Frame / 1.4)),
  );
  const h1Visible = h1Text.slice(0, h1CharsVisible);
  const h1Opacity = interpolate(h1Frame, [-10, 0], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Headline 2 slide-up (frames 135..180, 4.5–6.0s)
  const h2StartFrame = 135;
  const h2Frame = frame - h2StartFrame;
  const h2Opacity = interpolate(h2Frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const h2TranslateY = interpolate(h2Frame, [0, 30], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Final fade-out (last 0.5s = 15 frames)
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Generate stable particle positions (deterministic by index)
  const particles = Array.from({ length: 60 }, (_, i) => {
    const seed = (i * 9301 + 49297) % 233280;
    return {
      x: (seed % 1920),
      y: ((seed * 7) % 1080),
      size: 2 + ((seed >> 4) % 5),
      speed: 0.3 + (((seed >> 8) % 100) / 100) * 1.2,
      offset: ((seed >> 11) % 360),
    };
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000000',
        opacity: fadeOut,
      }}
    >
      {/* Drifting particles — soft afterimage of slash dust */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        {particles.map((p, i) => {
          const lifeProgress = ((frame * p.speed + p.offset) % 240) / 240;
          // Particles drift up + fade out over their cycle
          const driftY = p.y - lifeProgress * 200;
          const opacity =
            interpolate(lifeProgress, [0, 0.1, 0.7, 1], [0, 0.4, 0.4, 0]) *
            interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: p.x,
                top: driftY,
                width: p.size,
                height: p.size,
                background: AURA_GREEN,
                borderRadius: '50%',
                opacity,
                filter: 'blur(0.5px)',
              }}
            />
          );
        })}
      </AbsoluteFill>

      {/* Headlines */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          padding: 80,
        }}
      >
        <div
          style={{
            color: '#ffffff',
            fontFamily:
              "'Iowan Old Style', 'Georgia', 'Times New Roman', serif",
            fontSize: 76,
            fontWeight: 500,
            lineHeight: 1.3,
            textAlign: 'center',
            opacity: h1Opacity,
            maxWidth: 1500,
            letterSpacing: '0.005em',
          }}
        >
          {h1Visible}
          {h1CharsVisible < h1Text.length && (
            <span
              style={{
                opacity: 0.5,
                marginLeft: 4,
                display: 'inline-block',
                width: 4,
                height: 60,
                background: AURA_GREEN,
                verticalAlign: 'middle',
                transform: 'translateY(-4px)',
              }}
            />
          )}
        </div>

        <div
          style={{
            marginTop: 64,
            color: AURA_GREEN,
            fontFamily:
              "'Iowan Old Style', 'Georgia', 'Times New Roman', serif",
            fontSize: 56,
            fontWeight: 600,
            lineHeight: 1.3,
            textAlign: 'center',
            opacity: h2Opacity,
            transform: `translateY(${h2TranslateY}px)`,
            letterSpacing: '0.01em',
            textShadow: `0 0 30px ${AURA_GREEN}55`,
          }}
        >
          Own your audience.
          <br />
          Own your economy.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
