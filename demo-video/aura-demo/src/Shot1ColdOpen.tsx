// Shot 1 — Cold open
// 8 seconds, 1920x1080, 30fps, black background, white serif text.
// Typewriter character-by-character (2 frames per char), then hold + blinking
// cursor. Final 0.5s: subtle fade-out preparing transition to AURA logo (shot 2).
//
// Style references:
//   - Apple keynote intro (calm, restrained, lots of negative space)
//   - The "Every X is a sovereign Y" sentence pattern is the Iris VO line.
//
// All animation is driven by useCurrentFrame() — no CSS transitions.

import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const FULL_TEXT = 'Every creator is a sovereign micro-economy.';
const CHAR_FRAMES = 2;          // 2 frames per character at 30fps = 67ms/char
const CURSOR_BLINK_FRAMES = 18; // ~600ms blink cycle
const HOLD_AFTER_TYPE_FRAMES = 60; // hold typed text 2s before fade-out
const FADE_OUT_FRAMES = 30;     // last 1s fades to black for shot-2 hand-off

const Cursor: React.FC<{ frame: number; blinkFrames: number }> = ({
  frame,
  blinkFrames,
}) => {
  const opacity = interpolate(
    frame % blinkFrames,
    [0, blinkFrames / 2, blinkFrames],
    [1, 0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  return (
    <span
      style={{
        opacity,
        marginLeft: 4,
        // Fine vertical block "▌" feels more cinema than terminal "_".
        display: 'inline-block',
        width: 24,
        height: 64,
        background: '#ffffff',
        verticalAlign: 'middle',
        transform: 'translateY(-4px)',
      }}
    />
  );
};

export const Shot1ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // ── How many characters typed so far?
  const typedCharCount = Math.min(
    FULL_TEXT.length,
    Math.floor(frame / CHAR_FRAMES),
  );
  const typedText = FULL_TEXT.slice(0, typedCharCount);
  const finishedTyping = typedCharCount >= FULL_TEXT.length;

  // ── Calculate fade-out for the last second.
  const fadeOpacity = interpolate(
    frame,
    [durationInFrames - FADE_OUT_FRAMES, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // ── Subtle vignette pulse, breathing feel (1 cycle / 4s).
  const vignettePulse = Math.sin((frame / fps) * Math.PI * 0.5) * 0.04 + 0.96;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000000',
        opacity: fadeOpacity,
        // Subtle radial vignette to make black feel alive (not flat).
        backgroundImage: `radial-gradient(ellipse at center, rgba(255,255,255,${0.02 * vignettePulse}) 0%, rgba(0,0,0,1) 70%)`,
      }}
    >
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
            // Use a warm serif like Apple's keynote font (system serif is fine for v1).
            fontFamily:
              "'Iowan Old Style', 'Georgia', 'Times New Roman', serif",
            fontWeight: 500,
            fontSize: 72,
            letterSpacing: '0.01em',
            textAlign: 'center',
            lineHeight: 1.3,
            maxWidth: 1500,
            // Ever-so-slight shadow to make text feel embedded, not pasted.
            textShadow: '0 1px 2px rgba(255,255,255,0.05)',
          }}
        >
          {typedText}
          {!finishedTyping && (
            <Cursor frame={frame} blinkFrames={CURSOR_BLINK_FRAMES} />
          )}
          {/* Once finished, replace block cursor with thin underscore that
              also blinks but feels like a held thought. */}
          {finishedTyping && frame < durationInFrames - FADE_OUT_FRAMES && (
            <Cursor
              frame={frame - FULL_TEXT.length * CHAR_FRAMES}
              blinkFrames={CURSOR_BLINK_FRAMES}
            />
          )}
        </div>

        {/* Subtle attribution / mood line under the headline.
            Appears only after typing finishes. */}
        {finishedTyping && (
          <SubtleAttribution
            frame={frame - FULL_TEXT.length * CHAR_FRAMES - 12}
            holdFrames={HOLD_AFTER_TYPE_FRAMES}
          />
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const SubtleAttribution: React.FC<{ frame: number; holdFrames: number }> = ({
  frame,
}) => {
  // Fade in over 18 frames (~0.6s) starting at frame=0 of this sub-component.
  const opacity = interpolate(frame, [0, 18], [0, 0.55], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (opacity <= 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 96,
        left: 0,
        right: 0,
        textAlign: 'center',
        color: '#ffffff',
        opacity,
        fontFamily: "'SF Mono', 'JetBrains Mono', 'Menlo', monospace",
        fontSize: 18,
        letterSpacing: '0.4em',
        textTransform: 'uppercase',
      }}
    >
      AURA · A New Architecture for Creator Ownership
    </div>
  );
};
