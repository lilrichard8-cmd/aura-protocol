// Shot 3 — Problem (Web2 platform risk)
// 11 seconds. Black bg with three stylized "platform" cards lined up,
// representing YouTube / TikTok / X. Each card is then slashed with a red
// diagonal line one at a time, cementing the "platforms can erase you" idea.
//
// We do NOT use real platform logos (license risk). Instead each card has:
//   - a generic colored play / sound / chat glyph
//   - the platform's shorthand letter (Y / T / X)
//   - a fake follower count "12.4M followers" that gets crossed out
//
// Sequence:
//   0.0–0.5s  fade up from black; 3 platform cards crossfade in
//   0.5–2.0s  cards lift and settle, soft float
//   2.0–6.0s  red slashes hit one card every 1.3s (T-2.0, T-3.3, T-4.6, T-5.9)
//             each slash adds a "DEPLATFORMED" stamp + counter strikethrough
//   6.0–9.5s  caption fades in and holds
//   9.5–11.0s fade out for Shot 4 hand-off

import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

interface PlatformCard {
  letter: string;
  name: string;
  followers: string;
  accent: string;
}

const PLATFORMS: PlatformCard[] = [
  { letter: 'Y', name: 'Video Platform A', followers: '12.4M followers', accent: '#FF0000' },
  { letter: 'T', name: 'Short Video Platform B', followers: '8.9M followers', accent: '#FE2C55' },
  { letter: 'X', name: 'Microblog Platform C', followers: '4.2M followers', accent: '#1DA1F2' },
];

const SLASH_HIT_FRAMES = [60, 99, 138]; // T=2.0s, 3.3s, 4.6s

export const Shot3Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Top fade-in (cards appear)
  const topFade = interpolate(frame, [0, 18], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Caption fade-in (frames 180..216, ~6.0–7.2s)
  const captionFrame = frame - 180;
  const captionOpacity = interpolate(captionFrame, [0, 36], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Final fade-out (last 0.5s)
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
      {/* Cards row */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 80,
          opacity: topFade,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 56,
          }}
        >
          {PLATFORMS.map((p, i) => (
            <PlatformPanel
              key={p.letter}
              card={p}
              index={i}
              slashHitFrame={SLASH_HIT_FRAMES[i]}
              currentFrame={frame}
              fps={fps}
            />
          ))}
        </div>
      </AbsoluteFill>

      {/* Caption */}
      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingBottom: 140,
        }}
      >
        <div
          style={{
            color: '#ffffff',
            fontFamily:
              "'Iowan Old Style', 'Georgia', 'Times New Roman', serif",
            fontSize: 56,
            fontWeight: 500,
            lineHeight: 1.3,
            textAlign: 'center',
            opacity: captionOpacity,
            maxWidth: 1500,
          }}
        >
          An algorithm change can erase years of work.
          <div
            style={{
              fontSize: 28,
              fontFamily: "'SF Mono', 'JetBrains Mono', 'Menlo', monospace",
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: '#888',
              marginTop: 24,
              opacity: 0.8,
            }}
          >
            You don&apos;t own your audience. You rent attention.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const PlatformPanel: React.FC<{
  card: PlatformCard;
  index: number;
  slashHitFrame: number;
  currentFrame: number;
  fps: number;
}> = ({ card, index, slashHitFrame, currentFrame, fps }) => {
  // Stagger entry by 6 frames per card
  const entryFrame = currentFrame - index * 6;
  const entrySpring = spring({
    frame: entryFrame,
    fps,
    from: 0,
    to: 1,
    config: { damping: 20, stiffness: 80 },
  });

  // Slash animation — line appears at slashHitFrame + 0..6 frames
  const slashProgress = interpolate(
    currentFrame,
    [slashHitFrame, slashHitFrame + 8],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  // Card "shake" right when slash hits
  const shakeFrame = currentFrame - slashHitFrame;
  const shake =
    shakeFrame >= 0 && shakeFrame < 12
      ? Math.sin(shakeFrame * 1.5) * (1 - shakeFrame / 12) * 8
      : 0;
  // Desaturate after slash
  const desaturate = slashProgress;

  // Soft float
  const floatY = Math.sin((currentFrame / fps) * Math.PI + index) * 4;

  return (
    <div
      style={{
        width: 340,
        height: 480,
        background: '#0f0f12',
        border: `2px solid ${card.accent}33`,
        borderRadius: 20,
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        opacity: entrySpring,
        transform: `translateY(${floatY + (1 - entrySpring) * 30 + shake}px)`,
        filter: `grayscale(${desaturate * 0.7}) brightness(${1 - desaturate * 0.4})`,
        boxShadow: `0 0 60px ${card.accent}22, 0 8px 24px rgba(0,0,0,0.5)`,
      }}
    >
      {/* Top: big accent letter circle */}
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: 24,
          background: card.accent,
          color: '#ffffff',
          fontSize: 56,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Helvetica Neue', sans-serif",
        }}
      >
        {card.letter}
      </div>

      <div
        style={{
          marginTop: 24,
          color: '#ffffff',
          fontFamily: "'Helvetica Neue', sans-serif",
          fontSize: 22,
          fontWeight: 600,
        }}
      >
        Your Channel
      </div>
      <div
        style={{
          color: '#888',
          fontSize: 14,
          marginTop: 4,
          fontFamily: "'SF Mono', 'JetBrains Mono', monospace",
          textDecoration: slashProgress > 0.5 ? 'line-through' : 'none',
        }}
      >
        {card.followers}
      </div>

      <div
        style={{
          marginTop: 'auto',
          color: '#666',
          fontSize: 12,
          fontFamily: "'SF Mono', monospace",
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          opacity: 0.6,
        }}
      >
        Algorithm controls reach
      </div>

      {/* Diagonal red slash */}
      {slashProgress > 0 && (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 340 480"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
          }}
        >
          <line
            x1={20}
            y1={20}
            x2={20 + 300 * slashProgress}
            y2={20 + 440 * slashProgress}
            stroke="#ff2d2d"
            strokeWidth={8}
            strokeLinecap="round"
            opacity={0.9}
          />
        </svg>
      )}

      {/* DEPLATFORMED stamp after slash completes */}
      {slashProgress > 0.6 && (
        <div
          style={{
            position: 'absolute',
            top: 200,
            left: '50%',
            transform: `translateX(-50%) rotate(-12deg)`,
            background: 'rgba(255,45,45,0.92)',
            color: '#fff',
            padding: '8px 20px',
            border: '3px solid #ff2d2d',
            borderRadius: 6,
            fontFamily: "'Helvetica Neue', sans-serif",
            fontWeight: 900,
            fontSize: 26,
            letterSpacing: '0.18em',
            opacity: interpolate(
              slashProgress,
              [0.6, 1],
              [0, 1],
            ),
            boxShadow: '0 4px 12px rgba(255,45,45,0.4)',
          }}
        >
          DEPLATFORMED
        </div>
      )}
    </div>
  );
};
