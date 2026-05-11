// Shot 16 — Closing
// 6 seconds. Three lines fade in 1.5s apart on a dark background, summarizing
// the team and inviting the judge to participate.
//
// Lines:
//   1. "Søren built the company."
//   2. "Iris built the protocol."
//   3. "Come build creator ownership with us."
//
// The third line is slightly larger and aura-tinted, framing the call to
// action. Final 0.5s holds, then fades to black for Shot 17 (outro).

import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const AURA_GREEN = '#14C8A8';

const LINES = [
  { text: 'Søren built the company.', startFrame: 12, isCta: false },
  { text: 'Iris built the protocol.', startFrame: 57, isCta: false },
  {
    text: 'Come build creator ownership with us.',
    startFrame: 102,
    isCta: true,
  },
];

export const Shot16Closing: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Final fade-out (last 0.5s = 15 frames)
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000000',
        opacity: fadeOut,
      }}
    >
      {/* Subtle radial vignette to give black depth */}
      <AbsoluteFill
        style={{
          backgroundImage:
            `radial-gradient(ellipse at center, rgba(20,200,168,0.04) 0%, rgba(0,0,0,1) 60%)`,
        }}
      />

      {/* Three-line stack */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          padding: 80,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 40,
            alignItems: 'center',
          }}
        >
          {LINES.map((line, i) => {
            const f = frame - line.startFrame;
            const opacity = interpolate(f, [0, 24], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const translateY = interpolate(f, [0, 24], [16, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            return (
              <div
                key={i}
                style={{
                  fontFamily:
                    "'Iowan Old Style', 'Georgia', 'Times New Roman', serif",
                  fontWeight: line.isCta ? 600 : 500,
                  fontSize: line.isCta ? 56 : 44,
                  color: line.isCta ? AURA_GREEN : '#ffffff',
                  textAlign: 'center',
                  lineHeight: 1.3,
                  opacity,
                  transform: `translateY(${translateY}px)`,
                  letterSpacing: '0.005em',
                  textShadow: line.isCta
                    ? `0 0 30px ${AURA_GREEN}66`
                    : 'none',
                  // Add a soft top divider above the CTA to separate it
                  marginTop: line.isCta ? 24 : 0,
                  paddingTop: line.isCta ? 24 : 0,
                  borderTop: line.isCta
                    ? `1px solid rgba(255,255,255,0.08)`
                    : 'none',
                  width: line.isCta ? 800 : 'auto',
                }}
              >
                {line.text}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
