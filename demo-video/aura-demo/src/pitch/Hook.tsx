/**
 * Act 1 · Hook (0:00 – 0:12)
 *
 * Three escalating statements with the third one being the dagger.
 * Wording sourced from the Litepaper opening — "an act of borrowing".
 *
 * Beat:
 *   0–4s   "The creator economy has been an act of borrowing."
 *   4–8s   "$130B of value · <5% to creators."
 *   8–12s  "One algorithm change resets a million careers."
 */
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { COLORS, FONT, auraGradient, bgGradient, sec } from './shared';

const lines: { primary: string; accent?: string; from: number; to: number; layout: 'phrase' | 'metrics' | 'phrase' }[] = [
  { primary: 'The creator economy has been', accent: 'an act of borrowing.', from: 0, to: 4, layout: 'phrase' },
  { primary: '', from: 4, to: 8, layout: 'metrics' },
  { primary: 'One algorithm change resets', accent: 'a million careers.', from: 8, to: 12, layout: 'phrase' },
];

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: bgGradient(), fontFamily: FONT.family, color: COLORS.fg }}>
      {/* Subtle moving texture so the dark background is never flat */}
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${30 + Math.sin(frame * 0.02) * 10}% ${50 + Math.cos(frame * 0.025) * 10}%, ${COLORS.tealMid}1f 0%, transparent 60%)` }} />

      {lines.map((line, i) => {
        const startFrame = sec(line.from);
        const endFrame = sec(line.to);
        const localFrame = frame - startFrame;
        if (frame < startFrame || frame >= endFrame) return null;
        const fadeIn = interpolate(localFrame, [0, sec(0.4)], [0, 1], { extrapolateRight: 'clamp' });
        const fadeOut = interpolate(localFrame, [sec(line.to - line.from - 0.4), sec(line.to - line.from)], [1, 0], { extrapolateLeft: 'clamp' });
        const opacity = Math.min(fadeIn, fadeOut);

        return (
          <AbsoluteFill key={i} style={{ opacity, alignItems: 'center', justifyContent: 'center' }}>
            {line.layout === 'phrase' ? (
              <div style={{ textAlign: 'center', padding: '0 80px' }}>
                <div style={{ fontSize: 80, fontWeight: 600, color: COLORS.muted, letterSpacing: -1.5, marginBottom: 24, lineHeight: 1.1 }}>
                  {line.primary}
                </div>
                {line.accent && (
                  <div
                    style={{
                      fontSize: 152,
                      fontWeight: 900,
                      letterSpacing: -3,
                      lineHeight: 1.05,
                      background: auraGradient(135),
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      filter: `drop-shadow(0 0 40px ${COLORS.tealMid}55)`,
                    }}
                  >
                    {line.accent}
                  </div>
                )}
              </div>
            ) : (
              // Metrics layout: two giant numbers separated by a vertical pipe.
              <div style={{ display: 'flex', alignItems: 'center', gap: 80, padding: '0 80px' }}>
                <Metric primary="$130B" sub="created" tone={COLORS.tealLight} />
                <div style={{ width: 2, height: 240, background: COLORS.panelBorder }} />
                <Metric primary="<5%" sub="to creators" tone={COLORS.amberMid} />
              </div>
            )}
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

const Metric: React.FC<{ primary: string; sub: string; tone: string }> = ({ primary, sub, tone }) => (
  <div style={{ textAlign: 'center' }}>
    <div
      style={{
        fontSize: 280,
        fontWeight: 900,
        letterSpacing: -8,
        lineHeight: 0.92,
        color: tone,
        filter: `drop-shadow(0 0 60px ${tone}55)`,
      }}
    >
      {primary}
    </div>
    <div style={{ fontSize: 40, fontWeight: 600, color: COLORS.muted, marginTop: 8, letterSpacing: 0.5 }}>
      {sub}
    </div>
  </div>
);
