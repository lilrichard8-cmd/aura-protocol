import { Composition } from 'remotion';
import { PitchVideo } from './pitch/PitchVideo';
import { TOTAL_FRAMES, FPS, W, H } from './pitch/shared';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* AURA Pitch Video v2 — 6-act, 2:00, founder narrative. */}
      <Composition
        id="PitchVideo"
        component={PitchVideo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={W}
        height={H}
      />
    </>
  );
};
