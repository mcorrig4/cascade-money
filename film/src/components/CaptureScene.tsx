/**
 * CaptureScene — plays a real dev-mac capture (public/captures/*.mp4) inside
 * a BrowserFrame. If the scene needs more time than the capture has, the
 * last real frame holds (Freeze) rather than looping or going black — these
 * are camera-engine captures with baked timing; the film company cannot
 * re-time them here, only trim.
 */
import React from 'react';
import {AbsoluteFill, Freeze, OffthreadVideo, staticFile, useCurrentFrame} from 'remotion';
import {BrowserFrame, FrameMode} from './BrowserFrame';

export const CaptureScene: React.FC<{
  src: string;
  captureDurationInFrames: number;
  startFrom?: number;
  /**
   * Source-time scale (boundary-bleed fix, 2026-09-13). The capture harness
   * cuts each scene at the app's own authored shot length; the film sizes the
   * scene from the real narration clip. When the narration is LONGER, a rate
   * below 1 stretches the capture's own footage across the whole scene
   * instead of letting the video run past its last authored frame into the
   * next shot's opening (which the recorder's cut carries a couple of tenths
   * of). Defaults to 1 — identity, no behavior change.
   */
  playbackRate?: number;
  mode: FrameMode;
  /** 0-1, precomputed by the caller (see CascadeFilm.tsx framing ramps). */
  progress?: number;
  /** Settle scale for 'framed' mode. Undefined keeps BrowserFrame's default. */
  targetScale?: number;
  vignette?: boolean;
  /**
   * Optional per-frame CSS transform applied ONLY to the video itself — not
   * the browser chrome, not the vignette, not `children` overlays. Used for
   * a rostrum-camera pan/zoom on the capture layer (see motion/rostrumCamera.ts,
   * Scene 9). Undefined for every other caller — identity, no behavior change.
   */
  videoStyle?: React.CSSProperties;
  children?: React.ReactNode; // overlay content composited above the video
}> = ({
  src,
  captureDurationInFrames,
  startFrom = 0,
  playbackRate = 1,
  mode,
  progress = 0,
  targetScale,
  vignette = false,
  videoStyle,
  children,
}) => {
  const frame = useCurrentFrame();
  const capFrame = Math.min(frame, captureDurationInFrames - 1);
  // The SOURCE frame the held image must show: playbackRate scales
  // composition frames onto source frames, so the freeze has to scale too or
  // it would hold a frame the moving video never reached.
  const freezeFrame = startFrom + Math.round(capFrame * playbackRate);

  const video = (
    // overflow:hidden clips a zoomed (videoStyle-scaled) capture to the
    // frame bounds — a no-op when videoStyle is undefined (unscaled content
    // never extends past its own AbsoluteFill anyway).
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <AbsoluteFill style={videoStyle}>
        {frame < captureDurationInFrames ? (
          <OffthreadVideo
            src={staticFile(`captures/${src}`)}
            startFrom={startFrom}
            playbackRate={playbackRate}
          />
        ) : (
          <Freeze frame={freezeFrame}>
            <OffthreadVideo src={staticFile(`captures/${src}`)} />
          </Freeze>
        )}
      </AbsoluteFill>
      {vignette && (
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)',
          }}
        />
      )}
    </AbsoluteFill>
  );

  return (
    <BrowserFrame mode={mode} progress={progress} targetScale={targetScale}>
      {video}
      {children}
    </BrowserFrame>
  );
};
