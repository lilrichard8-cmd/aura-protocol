/**
 * Act 5 · Doorway (1:34 – 1:52, 18s)
 *
 * The infrastructure thesis made concrete: AURA is the only Web3 social
 * where Web2 users never see a wallet, gas fee, or seed phrase.
 *
 * Key Litepaper line:
 *   "If the user has to learn Web3, we failed."
 *
 * Beat:
 *   0–4s   "Web3 should serve users — not the other way around."
 *   4–14s  Two-doorway visual: Web2 (email/phone, MPC wallet behind the scenes)
 *          vs Web3 (Connect wallet) — both arrive at the same protocol.
 *  14–18s  "Same protocol. Same features. Two doorways."
 */
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONT, bgGradient, sec, auraGradient } from './shared';

export const Doorway: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1 — thesis
  const thesisIn = interpolate(frame, [0, sec(0.6)], [0, 1], { extrapolateRight: 'clamp' });
  const thesisOut = interpolate(frame, [sec(3.2), sec(4)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const thesis = Math.min(thesisIn, thesisOut);

  // Phase 2 — doorways visual
  const doorStart = sec(4);
  const door = spring({ frame: frame - doorStart, fps, config: { damping: 16, stiffness: 90 } });
  const doorOut = interpolate(frame, [sec(13.6), sec(14.5)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const doorOpacity = Math.min(door, doorOut);

  // Phase 3 — closing
  const closeIn = interpolate(frame, [sec(14), sec(14.8)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: bgGradient(), fontFamily: FONT.family, color: COLORS.fg, alignItems: 'center', justifyContent: 'center' }}>
      {/* Phase 1: thesis */}
      {thesis > 0 && (
        <div
          style={{
            position: 'absolute',
            opacity: thesis,
            textAlign: 'center',
            transform: `scale(${0.94 + thesis * 0.06})`,
            padding: '0 80px',
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 8,
              color: COLORS.tealLight,
              textTransform: 'uppercase',
              marginBottom: 24,
              fontFamily: FONT.mono,
            }}
          >
            Infrastructure, not a barrier
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              letterSpacing: -2,
              lineHeight: 1.05,
              maxWidth: 1500,
            }}
          >
            Web3 should serve users —
            <br />
            <span
              style={{
                background: auraGradient(135),
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: `drop-shadow(0 0 40px ${COLORS.tealMid}55)`,
              }}
            >
              not the other way around.
            </span>
          </div>
        </div>
      )}

      {/* Phase 2: two doorways */}
      {frame >= doorStart && frame < sec(14.5) && (
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            gap: 60,
            opacity: doorOpacity,
            transform: `translateY(${(1 - door) * 30}px)`,
          }}
        >
          <Doorway2
            badge="Web2"
            badgeColor={COLORS.tealLight}
            steps={[
              { label: 'Email or phone', sub: 'one tap' },
              { label: 'MPC wallet', sub: 'created behind the scenes' },
              { label: 'No seed phrase', sub: 'no gas fees, ever' },
            ]}
          />
          {/* Center — the protocol arrives at */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
            }}
          >
            <ArrowRight />
            <div
              style={{
                padding: '32px 56px',
                borderRadius: 24,
                background: `linear-gradient(135deg, ${COLORS.tealMid}33, ${COLORS.amberMid}22)`,
                border: `2px solid ${COLORS.tealMid}88`,
                fontSize: 36,
                fontWeight: 900,
                letterSpacing: 4,
                color: COLORS.fg,
                textAlign: 'center',
                fontFamily: FONT.mono,
                filter: `drop-shadow(0 0 40px ${COLORS.tealMid}55)`,
              }}
            >
              AURA<br />Protocol
            </div>
            <ArrowRight rotateDeg={180} />
          </div>
          <Doorway2
            badge="Web3"
            badgeColor={COLORS.amberMid}
            steps={[
              { label: 'Connect wallet', sub: 'Phantom · Backpack' },
              { label: 'Sign welcome message', sub: 'one signature' },
              { label: 'Same identity', sub: 'across every frontend' },
            ]}
          />
        </div>
      )}

      {/* Phase 3: closing */}
      {closeIn > 0 && (
        <div
          style={{
            position: 'absolute',
            opacity: closeIn,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: -1,
              marginBottom: 20,
            }}
          >
            Same protocol.{' '}
            <span style={{ color: COLORS.tealLight }}>Same features.</span>{' '}
            <span style={{ color: COLORS.amberMid }}>Two doorways.</span>
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 600,
              color: COLORS.muted,
              fontStyle: 'italic',
            }}
          >
            "If the user has to learn Web3, we failed."
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ── helpers ─────────────────────────────────────────

const Doorway2: React.FC<{ badge: string; badgeColor: string; steps: { label: string; sub: string }[] }> = ({ badge, badgeColor, steps }) => (
  <div
    style={{
      width: 420,
      padding: 32,
      borderRadius: 24,
      background: COLORS.panelBg,
      border: `1.5px solid ${badgeColor}55`,
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: -80,
        right: -80,
        width: 240,
        height: 240,
        borderRadius: '50%',
        background: `radial-gradient(${badgeColor}33, transparent 70%)`,
      }}
    />
    <div
      style={{
        alignSelf: 'flex-start',
        padding: '6px 16px',
        borderRadius: 999,
        background: badgeColor + '22',
        color: badgeColor,
        fontSize: 18,
        fontWeight: 800,
        letterSpacing: 4,
        fontFamily: 'JetBrains Mono, monospace',
      }}
    >
      {badge.toUpperCase()}
    </div>
    {steps.map((s, i) => (
      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: COLORS.fg, letterSpacing: -0.3 }}>{s.label}</div>
        <div style={{ fontSize: 16, color: COLORS.muted }}>{s.sub}</div>
      </div>
    ))}
  </div>
);

const ArrowRight: React.FC<{ rotateDeg?: number }> = ({ rotateDeg = 0 }) => (
  <div
    style={{
      width: 0,
      height: 0,
      borderLeft: `20px solid ${COLORS.tealLight}`,
      borderTop: '12px solid transparent',
      borderBottom: '12px solid transparent',
      transform: `rotate(${rotateDeg}deg)`,
      filter: `drop-shadow(0 0 8px ${COLORS.tealLight}88)`,
    }}
  />
);
