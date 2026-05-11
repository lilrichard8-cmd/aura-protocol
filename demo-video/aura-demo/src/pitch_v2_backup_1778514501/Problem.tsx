/**
 * Act 2 · Problem (0:12 – 0:36, 24s)
 *
 * The "borrowed economy" framing from the Litepaper — surface
 * structural pathologies, but with new framing: "borrow" is the
 * unifying verb. Final beat collapses into a single point that
 * transitions to the Insight act.
 *
 * Beat:
 *   0–3s   Headline: "Today, creators borrow everything."
 *   3–18s  Four "borrow" cards stagger in (3.5s spacing)
 *   18–22s Subhead: "Web3 was supposed to fix this. Instead, P2E ponzis and rug-pulls."
 *   22–24s Collapse to dot
 */
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { COLORS, FONT, bgGradient, sec } from './shared';

const cards = [
  {
    verb: 'Audiences',
    sub: 'rented from platforms',
    tone: COLORS.tealLight,
    icon: '👥',
  },
  {
    verb: 'Reach',
    sub: 'gated by an algorithm black box',
    tone: COLORS.amberMid,
    icon: '📊',
  },
  {
    verb: 'Identity',
    sub: 'one ban erases a decade',
    tone: '#EF4444',
    icon: '🔒',
  },
  {
    verb: 'Upside',
    sub: 'flows to the platform, not the maker',
    tone: '#A855F7',
    icon: '💸',
  },
];

export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headlineIn = interpolate(frame, [0, sec(0.6)], [0, 1], { extrapolateRight: 'clamp' });
  const headlineOut = interpolate(frame, [sec(20), sec(22)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const headline = Math.min(headlineIn, headlineOut);

  const subheadIn = interpolate(frame, [sec(18), sec(19)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const subheadOut = interpolate(frame, [sec(22), sec(23.5)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const subhead = Math.min(subheadIn, subheadOut);

  const collapseStart = sec(22);
  const collapse = interpolate(frame, [collapseStart, sec(24)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: bgGradient(), fontFamily: FONT.family, color: COLORS.fg, padding: 80 }}>
      <div style={{ opacity: headline, marginBottom: 40 }}>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 6, color: COLORS.tealLight, textTransform: 'uppercase', marginBottom: 12 }}>
          The state of play
        </div>
        <div style={{ fontSize: 96, fontWeight: 900, letterSpacing: -2, lineHeight: 1.05 }}>
          Today, creators <span style={{ color: COLORS.amberMid }}>borrow</span> everything.
        </div>
      </div>

      {/* Four cards */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: 20,
          opacity: collapse,
          transform: `scale(${interpolate(collapse, [0, 1], [0.6, 1])})`,
        }}
      >
        {cards.map((c, i) => {
          const start = sec(2 + i * 0.7);
          const enter = spring({
            frame: frame - start,
            fps,
            config: { damping: 16, stiffness: 100 },
          });
          const float = Math.sin((frame - start) * 0.04 + i) * 5;
          return (
            <div
              key={i}
              style={{
                background: COLORS.panelBg,
                border: `1px solid ${c.tone}66`,
                borderRadius: 20,
                padding: 32,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                opacity: enter,
                transform: `translateY(${(1 - enter) * 30 + float}px)`,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -60,
                  right: -60,
                  width: 220,
                  height: 220,
                  borderRadius: '50%',
                  background: `radial-gradient(${c.tone}33, transparent 70%)`,
                }}
              />
              <div style={{ fontSize: 64 }}>{c.icon}</div>
              <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -0.5 }}>{c.verb}</div>
              <div style={{ fontSize: 19, fontWeight: 500, color: COLORS.muted, lineHeight: 1.45 }}>{c.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Subheadline appearing under the cards */}
      {subhead > 0 && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 100, pointerEvents: 'none' }}>
          <div
            style={{
              opacity: subhead,
              fontSize: 38,
              fontWeight: 700,
              color: COLORS.muted,
              textAlign: 'center',
              letterSpacing: -0.5,
              maxWidth: 1300,
              lineHeight: 1.4,
            }}
          >
            Web3 was supposed to fix this. Instead, it gave us{' '}
            <span style={{ color: COLORS.amberMid, fontWeight: 800 }}>P2E ponzis and rug-pulls.</span>
          </div>
        </AbsoluteFill>
      )}

      {/* Collapsing dot */}
      {frame >= collapseStart && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              width: interpolate(frame, [collapseStart, sec(24)], [0, 80], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
              height: interpolate(frame, [collapseStart, sec(24)], [0, 80], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
              borderRadius: '50%',
              background: COLORS.tealLight,
              boxShadow: `0 0 80px ${COLORS.tealLight}`,
            }}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
