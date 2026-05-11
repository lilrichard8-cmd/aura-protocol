/**
 * PitchVideo v2 — 6-act, founder-narrative cut for Colosseum 2026.
 *
 * Total length: 120 seconds (2:00) at 30fps = 3600 frames.
 *
 * Acts:
 *   1. TikTok Storm  (14s) — Jan 2025: 170M users, one signature away from gone
 *   2. My Question   (18s) — "Why can't we rebuild creator infra with Web3 logic?"
 *   3. AURA is born  (14s) — logo reveal + "not a platform, an infrastructure"
 *   4. Five Pillars  (40s) — Coin · Mining · Graph · Token · Storage (8s each)
 *   5. Open Frontends(14s) — protocol is shared substrate; anyone can plug in
 *   6. Invitation    (20s) — "30 minutes — to feel it." + CTA
 */
import { AbsoluteFill, Sequence } from 'remotion';
import { ACT_SECONDS, sec, COLORS } from './shared';
import { TikTokStorm } from './TikTokStorm';
import { MyQuestion } from './MyQuestion';
import { AuraBorn } from './AuraBorn';
import { Solution } from './Solution';
import { OpenFrontends } from './OpenFrontends';
import { Invitation } from './Invitation';

export const PitchVideo: React.FC = () => {
  let cursor = 0;
  const seq = (durationSec: number) => {
    const start = cursor;
    cursor += durationSec;
    return { from: sec(start), durationInFrames: sec(durationSec) };
  };

  const tiktokSeq     = seq(ACT_SECONDS.tiktok);
  const questionSeq   = seq(ACT_SECONDS.question);
  const bornSeq       = seq(ACT_SECONDS.born);
  const solutionSeq   = seq(ACT_SECONDS.solution);
  const frontendsSeq  = seq(ACT_SECONDS.frontends);
  const invitationSeq = seq(ACT_SECONDS.invitation);

  return (
    <AbsoluteFill style={{ background: COLORS.bgFar }}>
      <Sequence from={tiktokSeq.from}     durationInFrames={tiktokSeq.durationInFrames}>     <TikTokStorm /></Sequence>
      <Sequence from={questionSeq.from}   durationInFrames={questionSeq.durationInFrames}>   <MyQuestion /></Sequence>
      <Sequence from={bornSeq.from}       durationInFrames={bornSeq.durationInFrames}>       <AuraBorn /></Sequence>
      <Sequence from={solutionSeq.from}   durationInFrames={solutionSeq.durationInFrames}>   <Solution /></Sequence>
      <Sequence from={frontendsSeq.from}  durationInFrames={frontendsSeq.durationInFrames}>  <OpenFrontends /></Sequence>
      <Sequence from={invitationSeq.from} durationInFrames={invitationSeq.durationInFrames}> <Invitation /></Sequence>
    </AbsoluteFill>
  );
};
