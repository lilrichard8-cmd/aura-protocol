/**
 * Act 2 · My Question (0:14 – 0:32, 18s)
 *
 * The founder's personal beat. The TikTok storm was the trigger, but
 * the real question came later: why are we still building creator
 * economies on borrowed substrate when Web3 finally has the primitives
 * to fix it?
 *
 * Beat:
 *   0–5s    "I watched it happen — and one question wouldn't leave me alone."
 *   5–13s   The question, big and centered, two halves:
 *           "Why can't we rebuild creator infrastructure
 *            with the logic of Web3?"
 *   13–18s  The four primitives that snap into view, answering "we can":
 *           Identity · Ownership · Portability · Settlement
 */
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONT, auraGradient, bgGradient, sec } from './shared';

const primitives = [
  { label: 'Identity',     icon: '🆔', sub: 'owned by the user' },
  { label: 'Ownership',    icon: '🔑', sub: 'tokens, not metrics' },
  { label: 'Portability',  icon: '🌐', sub: 'audience walks with you' },
  { label: 'Settlement',   icon: '⚖️', sub: 'paid by the protocol' },
];

export const MyQuestion: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1: setup
  const setupIn = interpolate(frame, [0, sec(0.6)], [0, 1], { extrapolateRight: 'clamp' });
  const setupOut = interpolate(frame, [sec(4.2), sec(5)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const setup = Math.min(setupIn, setupOut);

  // Phase 2: the question
  const qIn = interpolate(frame, [sec(5), sec(6)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const qOut = interpolate(frame, [sec(12.5), sec(13.2)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const q = Math.min(qIn, qOut);

  // Phase 3: the four primitives answer
  const ansStart = sec(13.2);

  return (
    <AbsoluteFill style={{ background: bgGradient(), fontFamily: FONT.family, color: COLORS.fg, alignItems: 'center', justifyContent: 'center' }}>
      {/* Phase 1: setup */}
      {setup > 0 && (
        <div style={{ position: 'absolute', opacity: setup, textAlign: 'center', padding: '0 80px', maxWidth: 1600 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 8,
              color: COLORS.amberMid,
              textTransform: 'uppercase',
              fontFamily: FONT.mono,
              marginBottom: 28,
            }}
          >
            A founder's note
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              letterSpacing: -1,
              lineHeight: 1.25,
              color: COLORS.fg,
              maxWidth: 1500,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            I watched it happen — and one question
            <br />
            <span style={{ color: COLORS.muted, fontWeight: 600 }}>wouldn't leave me alone.</span>
          </div>
        </div>
      )}

      {/* Phase 2: the question */}
      {q > 0 && (
        <div
          style={{
            position: 'absolute',
            opacity: q,
            textAlign: 'center',
            padding: '0 80px',
            maxWidth: 1700,
            transform: `scale(${0.94 + q * 0.06})`,
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: COLORS.tealLight,
              letterSpacing: 6,
              fontFamily: FONT.mono,
              marginBottom: 32,
            }}
          >
            ?
          </div>
          <div
            style={{
              fontSize: 56,
              fontWeight: 600,
              color: COLORS.muted,
              letterSpacing: -0.5,
              marginBottom: 28,
              lineHeight: 1.2,
            }}
          >
            Why can't we rebuild
          </div>
          <div
            style={{
              fontSize: 128,
              fontWeight: 900,
              letterSpacing: -3,
              lineHeight: 1.05,
              background: auraGradient(135),
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: `drop-shadow(0 0 50px ${COLORS.tealMid}55)`,
            }}
          >
            creator infrastructure
          </div>
          <div
            style={{
              fontSize: 56,
              fontWeight: 600,
              color: COLORS.muted,
              letterSpacing: -0.5,
              marginTop: 28,
              lineHeight: 1.2,
            }}
          >
            with the logic of <span style={{ color: COLORS.amberLight, fontWeight: 800 }}>Web3</span>?
          </div>
        </div>
      )}

      {/* Phase 3: the four primitives answer */}
      {frame >= ansStart && (
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 32,
            padding: '0 80px',
          }}
        >
          <div
            style={{
              fontSize: 48,
              fontWeight: 800,
              letterSpacing: -1,
              color: COLORS.fg,
              opacity: interpolate(frame, [ansStart, ansStart + sec(0.6)], [0, 1], { extrapolateRight: 'clamp' }),
            }}
          >
            We finally <span style={{ color: COLORS.tealLight }}>can.</span>
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1600 }}>
            {primitives.map((p, i) => {
              const start = ansStart + sec(0.5 + i * 0.25);
              const enter = spring({ frame: frame - start, fps, config: { damping: 16, stiffness: 110 } });
              return (
                <div
                  key={p.label}
                  style={{
                    opacity: enter,
                    transform: `translateY(${(1 - enter) * 20}px)`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    padding: '24px 32px',
                    borderRadius: 16,
                    background: COLORS.panelBg,
                    border: `1.5px solid ${COLORS.tealMid}55`,
                    minWidth: 220,
                  }}
                >
                  <div style={{ fontSize: 44 }}>{p.icon}</div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                      color: COLORS.tealGlow,
                      letterSpacing: -0.5,
                      fontFamily: FONT.mono,
                    }}
                  >
                    {p.label}
                  </div>
                  <div style={{ fontSize: 15, color: COLORS.muted, fontWeight: 500, textAlign: 'center' }}>
                    {p.sub}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
