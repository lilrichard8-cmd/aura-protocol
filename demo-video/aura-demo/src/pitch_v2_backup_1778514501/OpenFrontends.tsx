/**
 * Act 6 · Open Frontends (1:52 – 2:10, 18s)
 *
 * The differentiator nobody else has — the protocol is shared substrate,
 * frontends compete on top of it. Same identity, different doorways,
 * no central permission. Resolves the compliance dilemma that breaks
 * every Web3 social attempt.
 *
 * Beat:
 *   0–4s    "Anyone can build a frontend."
 *   4–13s   Three frontend examples (Mainstream / AfterDark / Anyone)
 *           connect to a single AURA Protocol core
 *  13–18s   Closing: "The protocol stays open. The frontends stay accountable."
 */
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, FONT, bgGradient, sec, auraGradient } from './shared';

const frontends = [
  {
    name: 'Mainstream',
    sub: 'Reference implementation',
    desc: 'Free. Open-source. Built by the core team.',
    color: COLORS.tealLight,
    glyph: '🌸',
  },
  {
    name: 'AfterDark',
    sub: 'Adult-content frontend',
    desc: 'Separate compliance scope. Same protocol.',
    color: COLORS.amberMid,
    glyph: '🌙',
  },
  {
    name: 'Anyone else',
    sub: 'Permissionless registration',
    desc: 'Run any policy — KYC, regional, content rules. No fork required.',
    color: '#A855F7',
    glyph: '✦',
  },
];

export const OpenFrontends: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headlineIn = interpolate(frame, [0, sec(0.6)], [0, 1], { extrapolateRight: 'clamp' });
  const headlineOut = interpolate(frame, [sec(13), sec(13.8)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const headline = Math.min(headlineIn, headlineOut);

  const closingIn = interpolate(frame, [sec(13.8), sec(14.6)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: bgGradient(), fontFamily: FONT.family, color: COLORS.fg, padding: '60px 100px' }}>
      {/* Headline */}
      {headline > 0 && (
        <>
          <div style={{ opacity: headline, marginBottom: 60 }}>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: 8,
                color: COLORS.tealLight,
                textTransform: 'uppercase',
                marginBottom: 14,
                fontFamily: FONT.mono,
              }}
            >
              Open frontend ecosystem
            </div>
            <div style={{ fontSize: 84, fontWeight: 900, letterSpacing: -2, lineHeight: 1.05, maxWidth: 1500 }}>
              Anyone can{' '}
              <span
                style={{
                  background: auraGradient(135),
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                build a frontend.
              </span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 600, color: COLORS.muted, marginTop: 16 }}>
              The protocol is shared substrate. Frontends compete on top of it.
            </div>
          </div>

          <div
            style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gridTemplateRows: '1fr auto',
              columnGap: 28,
              opacity: headline,
              alignItems: 'stretch',
            }}
          >
            {frontends.map((f, i) => {
              const start = sec(1.5 + i * 0.5);
              const enter = spring({ frame: frame - start, fps, config: { damping: 16, stiffness: 95 } });
              return (
                <div
                  key={f.name}
                  style={{
                    background: COLORS.panelBg,
                    border: `1.5px solid ${f.color}66`,
                    borderRadius: 24,
                    padding: 40,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 18,
                    opacity: enter,
                    transform: `translateY(${(1 - enter) * 30}px)`,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: -80,
                      right: -80,
                      width: 280,
                      height: 280,
                      borderRadius: '50%',
                      background: `radial-gradient(${f.color}33, transparent 70%)`,
                    }}
                  />
                  <div style={{ fontSize: 64 }}>{f.glyph}</div>
                  <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: -1, color: f.color }}>
                    {f.name}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.fg, textTransform: 'uppercase', letterSpacing: 2, fontFamily: FONT.mono }}>
                    {f.sub}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 500, color: COLORS.muted, lineHeight: 1.4 }}>
                    {f.desc}
                  </div>
                </div>
              );
            })}

            {/* Single shared protocol bar at the bottom, spanning all three columns */}
            <div
              style={{
                gridColumn: '1 / -1',
                marginTop: 32,
                padding: 28,
                borderRadius: 20,
                background: `linear-gradient(135deg, ${COLORS.tealMid}33, ${COLORS.amberMid}22)`,
                border: `1.5px solid ${COLORS.tealMid}88`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 24,
              }}
            >
              <Img src={staticFile('aura-logo-transparent.png')} style={{ width: 64, height: 64, objectFit: 'contain' }} />
              <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 4, fontFamily: FONT.mono, color: COLORS.fg }}>
                AURA Protocol
              </div>
              <div style={{ fontSize: 22, color: COLORS.muted, fontStyle: 'italic' }}>
                · One identity. One graph. 95% of revenue to frontends.
              </div>
            </div>
          </div>
        </>
      )}

      {/* Closing line */}
      {closingIn > 0 && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: closingIn }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              letterSpacing: -2,
              textAlign: 'center',
              maxWidth: 1600,
              lineHeight: 1.08,
              padding: '0 80px',
            }}
          >
            <span style={{ color: COLORS.tealLight }}>The protocol stays open.</span>
            <br />
            <span style={{ color: COLORS.amberMid }}>The frontends stay accountable.</span>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
