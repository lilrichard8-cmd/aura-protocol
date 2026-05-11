/**
 * PitchVideo v1 — full 8-act pitch composition for Colosseum 2026.
 *
 * Total length: 165 seconds (2:45) at 30fps = 4950 frames.
 * Acts (Litepaper-aligned):
 *   1. Hook        (12s) — borrowed-economy opener
 *   2. Problem     (24s) — four pathologies of the borrowed economy
 *   3. Insight     (18s) — "AURA is infrastructure, not a platform"
 *   4. Solution    (40s) — five pillars (verbatim from Litepaper)
 *   5. Doorway     (18s) — Web3 should serve users, not the other way around
 *   6. Frontends   (18s) — open frontend ecosystem (the real moat)
 *   7. Why Now     (18s) — Solana × regulation × AI co-founder
 *   8. Vision      (17s) — "We're asking for thirty minutes — to feel it."
 */
import { AbsoluteFill, Sequence } from 'remotion';
import { ACT_SECONDS, sec, COLORS } from './shared';
import { Hook } from './Hook';
import { Problem } from './Problem';
import { Insight } from './Insight';
import { Solution } from './Solution';
import { Doorway } from './Doorway';
import { OpenFrontends } from './OpenFrontends';
import { WhyNow } from './WhyNow';
import { Vision } from './Vision';

export const PitchVideo: React.FC = () => {
  let cursor = 0;
  const seq = (durationSec: number) => {
    const start = cursor;
    cursor += durationSec;
    return { from: sec(start), durationInFrames: sec(durationSec) };
  };

  const hookSeq      = seq(ACT_SECONDS.hook);
  const problemSeq   = seq(ACT_SECONDS.problem);
  const insightSeq   = seq(ACT_SECONDS.insight);
  const solutionSeq  = seq(ACT_SECONDS.solution);
  const doorwaySeq   = seq(ACT_SECONDS.doorway);
  const frontendsSeq = seq(ACT_SECONDS.frontends);
  const whyNowSeq    = seq(ACT_SECONDS.whyNow);
  const visionSeq    = seq(ACT_SECONDS.vision);

  return (
    <AbsoluteFill style={{ background: COLORS.bgFar }}>
      <Sequence from={hookSeq.from}      durationInFrames={hookSeq.durationInFrames}>      <Hook /></Sequence>
      <Sequence from={problemSeq.from}   durationInFrames={problemSeq.durationInFrames}>   <Problem /></Sequence>
      <Sequence from={insightSeq.from}   durationInFrames={insightSeq.durationInFrames}>   <Insight /></Sequence>
      <Sequence from={solutionSeq.from}  durationInFrames={solutionSeq.durationInFrames}>  <Solution /></Sequence>
      <Sequence from={doorwaySeq.from}   durationInFrames={doorwaySeq.durationInFrames}>   <Doorway /></Sequence>
      <Sequence from={frontendsSeq.from} durationInFrames={frontendsSeq.durationInFrames}> <OpenFrontends /></Sequence>
      <Sequence from={whyNowSeq.from}    durationInFrames={whyNowSeq.durationInFrames}>    <WhyNow /></Sequence>
      <Sequence from={visionSeq.from}    durationInFrames={visionSeq.durationInFrames}>    <Vision /></Sequence>
    </AbsoluteFill>
  );
};
