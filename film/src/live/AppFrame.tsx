import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig} from 'remotion';
import '@cascade-app/styles.css';
import App from '@cascade-app/App.tsx';
import {seekTo} from '@cascade-app/director/seek.ts';

type LiveCascade = {
  frameDriven?: boolean;
  ready?: Promise<void>;
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
  await browserWindow.__cascade.ready;
};

export type AppFrameProps = {scene?: number; timesMs?: number[]};

export const AppFrame: React.FC<AppFrameProps> = ({scene = 4, timesMs}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const [handle] = useState(() => delayRender('Loading Cascade globe, textures, models, and stream'));
  const [ready, setReady] = useState(false);
  const continued = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void waitForGlobe().then(() => {
      if (!cancelled) setReady(true);
    }).catch(error => cancelRender(error));
    return () => { cancelled = true; };
  }, []);

  useLayoutEffect(() => {
    if (!ready) return;
    const tMs = timesMs?.[frame] ?? frame / fps * 1000;
    seekTo(tMs, scene);
    const sample=browserWindow.__cascade?.renderFrame?.(tMs);
    if(timesMs)console.info(`[CascadeLive probe] frame ${frame}:`,JSON.stringify(sample));
    if (frame === 0) console.info('[CascadeLive] frame 0 models:', JSON.stringify(browserWindow.__cascade?.models?.()));
    if (!continued.current) {
      continued.current = true;
      continueRender(handle);
    }
  }, [fps, frame, handle, ready, scene, timesMs]);

  return <div className="cascade-live-frame" style={{position: 'absolute', inset: 0, width: 1920, height: 1080, overflow: 'hidden'}}>
    <style>{`.cascade-live-frame *, .cascade-live-frame *::before, .cascade-live-frame *::after {animation: none !important; transition: none !important;}`}</style>
    <App />
  </div>;
};
