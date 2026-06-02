import { registerRoot } from 'remotion';
import { useEffect, useState } from 'react';
import { Composition } from 'remotion';
import CaptionVideo from './CaptionVideo.jsx';
import timingsData from '../scripts/timings.json';

const RemotionRoot = () => {
  const [timings, setTimings] = useState(timingsData);
  const totalDurationInFrames = Math.floor(timings.totalDuration * 30);

  return (
    <>
      <Composition
        id="CaptionVideo"
        component={CaptionVideo}
        durationInFrames={totalDurationInFrames}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          timings,
          totalDurationInFrames,
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
