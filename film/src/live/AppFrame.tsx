import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig} from 'remotion';
import '@cascade-app/styles.css';
import App from '@cascade-app/App.tsx';
import {seekTo} from '@cascade-app/director/seek.ts';
import {SHOTS} from '@cascade-app/director/shots.ts';
import cueTimes from '../generated/cues.json';

type LiveCascade = {
  frameDriven?: boolean;
  engine?: {update: (state: {recording: boolean}) => void};
  ready?: () => Promise<void>;
  renderFrame?: (tMs: number) => unknown;
  models?: () => {id: string; pending: boolean; missing: boolean; loaded: boolean; fade: number}[];
};

const browserWindow = window as unknown as {__cascade?: LiveCascade};
browserWindow.__cascade = {...browserWindow.__cascade, frameDriven: true};

const waitForGlobe = async () => {
  const started = Date.now();
  while (!browserWindow.__cascade?.ready || !browserWindow.__cascade.renderFrame) {
    if (Date.now() - started > 10_000) throw new Error(`Timed out waiting for the Cascade globe API: ${document.body.innerText.slice(0, 500)}`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  await browserWindow.__cascade.ready();
};

export type AppFrameProps = {
  scene?: number;
  timesMs?: number[];
  /** A deterministic opening state. The app remains mounted underneath. */
  loadingFrames?: number;
  absoluteTimeline?: boolean;
};

export const AppFrame: React.FC<AppFrameProps> = ({scene = 4, timesMs, loadingFrames = 0, absoluteTimeline = false}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const [handle] = useState(() => delayRender('Loading Cascade globe, textures, models, and stream'));
  const [ready, setReady] = useState(false);
  const continued = useRef(false);
  // Hold the loading screen until BOTH the authored minimum (loadingFrames)
  // has elapsed AND the app has actually signaled ready — `ready` is an
  // async condition (globe/textures/models) that can outlast the authored
  // hold, and dropping the overlay at the authored cutoff regardless of
  // readiness left a gap where nothing has been drawn yet: a solid black
  // content pane for however many frames `ready` takes to catch up.
  const isLoadingFrame = frame < loadingFrames || !ready;

  useEffect(() => {
    let cancelled = false;
    void waitForGlobe().then(() => {
      if (!cancelled) setReady(true);
    }).catch(error => cancelRender(error));
    return () => { cancelled = true; };
  }, []);

  useLayoutEffect(() => {
    if (isLoadingFrame) {
      if (!continued.current) {
        continued.current = true;
        continueRender(handle);
      }
      return;
    }
    if (!ready) return;
    const localMs = timesMs?.[frame] ?? (frame - loadingFrames) / fps * 1000;
    const sceneStartMs = SHOTS.find((shot) => shot.scene === scene)?.startTime ?? 0;
    const tMs = localMs + (absoluteTimeline ? sceneStartMs * 1000 : 0);
    seekTo(tMs, scene, absoluteTimeline, Object.fromEntries(Object.entries((cueTimes as Record<string,Record<string,number>>)[String(scene)]??{}).map(([name,seconds])=>[name,seconds*1000])));
    // W2 Stage 2: seek resets recording; only the unlocked middle delegates cards to the film.
    if (scene >= 2 && scene <= 10) browserWindow.__cascade?.engine?.update({recording: true});
    // Rendering phases are authored scene-locally even though the public seek
    // coordinate is the absolute film timeline.
    const sample=browserWindow.__cascade?.renderFrame?.(localMs);
    if(timesMs)console.info(`[CascadeLive probe] frame ${frame}:`,JSON.stringify(sample));
    if (frame === 0) console.info('[CascadeLive] frame 0 models:', JSON.stringify(browserWindow.__cascade?.models?.()));
    if (!continued.current) {
      continued.current = true;
      continueRender(handle);
    }
  }, [absoluteTimeline, fps, frame, handle, isLoadingFrame, loadingFrames, ready, scene, timesMs]);

  return <div className="cascade-live-frame" style={{position: 'absolute', inset: 0, width: 1920, height: 1080, overflow: 'hidden'}}>
    <style>{`.cascade-live-frame *, .cascade-live-frame *::before, .cascade-live-frame *::after {animation: none !important; transition: none !important;}`}</style>
    <App />
    {isLoadingFrame ? (
      <div style={{position: 'absolute', inset: 0, zIndex: 100000, display: 'grid', placeItems: 'center', background: '#06111b', color: '#dceff2', fontFamily: "Inter, 'Helvetica Neue', Arial, sans-serif"}}>
        <div style={{display: 'grid', justifyItems: 'center', gap: 22}}>
          <div style={{fontSize: 42, fontWeight: 650, letterSpacing: -1}}>Cascade</div>
          <div style={{fontSize: 16, letterSpacing: 2.5, textTransform: 'uppercase', color: '#78aeb5'}}>Loading the network</div>
          <div style={{width: 280, height: 2, background: '#17333c', overflow: 'hidden'}}>
            <div style={{width: `${Math.max(4, ((frame + 1) / Math.max(1, loadingFrames)) * 100)}%`, height: '100%', background: '#69e6c0'}} />
          </div>
        </div>
      </div>
    ) : null}
  </div>;
};
