import { AbsoluteFill, useCurrentFrame, useVideoConfig, Sequence, spring, interpolate } from 'remotion';

// Brand palette (matches lesson-01 production plan)
const COLORS = {
  text: '#FFFFFF',
  textShadow: 'rgba(0, 0, 0, 0.85)',
  emphasis: '#E8B96B',       // warm gold
  highlight: '#7A9B7E',      // sage green
  accent: '#F5F1E8',         // cream
};

// Word component: kinetic pop-in, holds, pop-out
const Word = ({ word, emphasis, startFrame, endFrame }) => {
  const frame = useCurrentFrame();

  if (frame < startFrame || frame > endFrame) return null;

  // Pop-in: scale 0.7 -> 1.0 over first 4 frames
  const popIn = spring({
    frame: frame - startFrame,
    fps: 30,
    config: { damping: 12, stiffness: 200, mass: 0.5 },
  });
  const scale = interpolate(popIn, [0, 1], [0.7, 1.0]);

  // Pop-out: scale 1.0 -> 0.9 over last 3 frames
  const outDuration = 3;
  const outProgress = Math.max(0, frame - (endFrame - outDuration)) / outDuration;
  const outScale = interpolate(outProgress, [0, 1], [1.0, 0.9]);
  const finalScale = frame > endFrame - outDuration ? outScale : scale;

  // Opacity
  const opacity = frame < endFrame - outDuration ? 1 : 1 - outProgress;

  return (
    <span
      style={{
        display: 'inline-block',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        fontSize: 72,
        fontWeight: emphasis ? 800 : 600,
        color: emphasis ? COLORS.emphasis : COLORS.text,
        textShadow: `0 4px 24px ${COLORS.textShadow}, 0 2px 8px ${COLORS.textShadow}`,
        transform: `scale(${finalScale})`,
        opacity,
        letterSpacing: '-0.02em',
        padding: '0 8px',
        margin: '0 2px',
      }}
    >
      {word}
    </span>
  );
};

const CaptionVideo = ({ timings, totalDurationInFrames }) => {
  const { fps } = useVideoConfig();

  if (!timings || !timings.timings || timings.timings.length === 0) {
    return <AbsoluteFill style={{ backgroundColor: 'transparent' }} />;
  }

  // Group every 2 words
  const wordsPerGroup = 2;
  const groups = [];
  for (let i = 0; i < timings.timings.length; i += wordsPerGroup) {
    const groupWords = timings.timings.slice(i, i + wordsPerGroup);
    const startFrame = Math.floor(groupWords[0].start * fps);
    const lastEnd = groupWords[groupWords.length - 1].end;
    const endFrame = Math.floor(lastEnd * fps);
    groups.push({ words: groupWords, startFrame, endFrame });
  }

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      {/* Caption area: lower-middle, away from the 3D objects */}
      <div
        style={{
          position: 'absolute',
          bottom: 100,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexWrap: 'wrap',
          maxWidth: '90%',
          margin: '0 auto',
          padding: '0 40px',
          textAlign: 'center',
        }}
      >
        {groups.map((group, gi) => {
          const duration = group.endFrame - group.startFrame;
          if (duration <= 0) return null;
          return (
            <Sequence key={gi} from={group.startFrame} durationInFrames={duration}>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                {group.words.map((w, wi) => {
                  const wordStart = Math.floor(w.start * fps) - group.startFrame;
                  const wordEnd = Math.floor(w.end * fps) - group.startFrame;
                  return (
                    <Word
                      key={wi}
                      word={w.word}
                      emphasis={w.emphasis}
                      startFrame={Math.max(0, wordStart)}
                      endFrame={wordEnd + 1}
                    />
                  );
                })}
              </div>
            </Sequence>
          );
        })}
      </div>

      {/* Brand watermark in corner */}
      <div
        style={{
          position: 'absolute',
          top: 36,
          left: 36,
          fontFamily: 'Inter, sans-serif',
          fontSize: 18,
          fontWeight: 500,
          color: COLORS.accent,
          opacity: 0.5,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
        }}
      >
        AI Skills Studio
      </div>
    </AbsoluteFill>
  );
};

export default CaptionVideo;
