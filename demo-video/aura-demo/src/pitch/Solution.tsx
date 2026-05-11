/**
 * Act 4 · Solution (0:54 – 1:34, 40s)
 *
 * Five pillars × 8s each. Wording sourced verbatim from Litepaper §"Five pillars".
 * Visual: left = pillar number + name + claim, right = abstract motion.
 */
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { COLORS, FONT, bgGradient, sec } from './shared';

const pillars = [
  {
    n: '01',
    name: 'Creator Coin',
    claim: 'Every creator is a micro-economy.',
    description: 'Cross 100 followers, mint a 10,000-supply coin. Holders unlock perks — some you keep, some you burn to redeem.',
    accent: COLORS.pillarCoin,
    glyph: '◉',
  },
  {
    n: '02',
    name: 'Curation Mining',
    claim: 'Discovery is labor.',
    description: 'Spend 1 ORA on what you believe in. Early curators of unknown talent earn up to 25× base reward.',
    accent: COLORS.pillarMining,
    glyph: '⛏',
  },
  {
    n: '03',
    name: 'Portable Graph',
    claim: 'If we vanish tomorrow, your audience walks away with you.',
    description: 'Followers, reputation, Creator Coins, Arweave content — all on-chain. Switch frontends; nothing is rebuilt.',
    accent: COLORS.pillarGraph,
    glyph: '🌐',
  },
  {
    n: '04',
    name: 'ORA Token',
    claim: 'Deflationary by design.',
    description: '5% protocol fee on every transfer · 2% burn / 2% staking / 0.5% gas / 0.5% ops. Plus a 5% scarcity burn on every reward.',
    accent: COLORS.pillarToken,
    glyph: '🔥',
  },
  {
    n: '05',
    name: 'Permanent Storage',
    claim: 'Your work, on Arweave forever.',
    description: 'Frontends can disappear. Platforms can fail. The work cannot. Pinned with 200-year mathematical guarantees.',
    accent: COLORS.pillarStorage,
    glyph: '∞',
  },
];

const PILLAR_DURATION = 8; // seconds each

export const Solution: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const activePillarIdx = Math.min(
    pillars.length - 1,
    Math.floor(frame / sec(PILLAR_DURATION))
  );
  const localFrame = frame - activePillarIdx * sec(PILLAR_DURATION);

  const enterIn = interpolate(localFrame, [0, sec(0.6)], [0, 1], { extrapolateRight: 'clamp' });
  const exitOut = interpolate(localFrame, [sec(PILLAR_DURATION - 0.6), sec(PILLAR_DURATION)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fade = Math.min(enterIn, exitOut);

  const pillar = pillars[activePillarIdx];

  const morph = spring({ frame: localFrame, fps, config: { damping: 20, stiffness: 60 } });
  const float = Math.sin(localFrame * 0.04) * 12;

  return (
    <AbsoluteFill style={{ background: bgGradient(), fontFamily: FONT.family, color: COLORS.fg, padding: '80px 100px' }}>
      {/* Top progress bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 60 }}>
        {pillars.map((_, i) => {
          const isActive = i === activePillarIdx;
          const isPast = i < activePillarIdx;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: isPast || isActive ? pillars[i].accent : COLORS.panelBorder,
                opacity: isActive ? 1 : isPast ? 0.45 : 1,
                boxShadow: isActive ? `0 0 12px ${pillars[i].accent}` : 'none',
              }}
            />
          );
        })}
      </div>

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1.15fr 1fr',
          gap: 80,
          alignItems: 'center',
          opacity: fade,
          transform: `translateX(${(1 - enterIn) * 80}px)`,
        }}
      >
        {/* Left — words */}
        <div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: pillar.accent,
              letterSpacing: 8,
              marginBottom: 14,
              fontFamily: FONT.mono,
            }}
          >
            PILLAR {pillar.n}
          </div>
          <div
            style={{
              fontSize: 124,
              fontWeight: 900,
              letterSpacing: -3,
              lineHeight: 0.95,
              marginBottom: 18,
              // Use the pillar accent as a solid fill rather than a gradient
              // to white — in light theme, the white stop made the text
              // disappear into the background (showed up as a colour-block
              // smear instead of legible type). Solid colour reads cleanly
              // on any background and keeps each pillar visually distinct.
              color: pillar.accent,
              filter: `drop-shadow(0 1px 0 ${COLORS.bg === '#fafaf7' ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.4)'})`,
            }}
          >
            {pillar.name}
          </div>
          <div
            style={{
              fontSize: 52,
              fontWeight: 800,
              letterSpacing: -1,
              marginBottom: 28,
              color: COLORS.fg,
              lineHeight: 1.1,
            }}
          >
            {pillar.claim}
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 500,
              color: COLORS.muted,
              maxWidth: 700,
              lineHeight: 1.45,
            }}
          >
            {pillar.description}
          </div>
        </div>

        {/* Right — abstract motion */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1 / 1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `translateY(${float}px)`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: `2px dashed ${pillar.accent}55`,
              transform: `rotate(${frame * 0.4}deg)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 60,
              borderRadius: '50%',
              border: `1px solid ${pillar.accent}88`,
              transform: `rotate(${-frame * 0.3}deg)`,
            }}
          />
          <div
            style={{
              width: 320 * morph,
              height: 320 * morph,
              borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, ${pillar.accent}, ${pillar.accent}33 70%, transparent 100%)`,
              filter: `drop-shadow(0 0 80px ${pillar.accent}88)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 200,
              position: 'relative',
            }}
          >
            {activePillarIdx === 0 ? (
              // Custom coin glyph for Creator Coin — concentric rings + 'A'
              <svg width={220} height={220} viewBox="0 0 200 200" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))' }}>
                <defs>
                  <linearGradient id="coinFace" x1="30%" y1="20%" x2="70%" y2="90%">
                    <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
                    <stop offset="100%" stopColor={pillar.accent} stopOpacity="0.9" />
                  </linearGradient>
                </defs>
                <circle cx="100" cy="100" r="94" fill="none" stroke={pillar.accent} strokeWidth="2.5" strokeDasharray="4 4" opacity="0.85" />
                <circle cx="100" cy="100" r="78" fill="url(#coinFace)" stroke={pillar.accent} strokeWidth="4" />
                <circle cx="100" cy="100" r="66" fill="none" stroke={pillar.accent} strokeWidth="1.5" opacity="0.45" />
                <text
                  x="100"
                  y="128"
                  textAnchor="middle"
                  fontFamily="Inter, sans-serif"
                  fontWeight="900"
                  fontSize="96"
                  letterSpacing="-4"
                  fill={pillar.accent}
                >
                  A
                </text>
              </svg>
            ) : (
              <span style={{ filter: 'drop-shadow(0 0 8px rgba(0,0,0,0.4))' }}>{pillar.glyph}</span>
            )}
          </div>
          {[0, 1, 2, 3, 4, 5].map(i => {
            const angle = ((frame + i * 60) * 0.02) + (i * (Math.PI * 2 / 6));
            const radius = 280;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: pillar.accent,
                  boxShadow: `0 0 20px ${pillar.accent}`,
                  left: '50%',
                  top: '50%',
                  transform: `translate(${x - 6}px, ${y - 6}px)`,
                }}
              />
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
