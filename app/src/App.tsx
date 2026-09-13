import { lazy, Suspense, useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { receiver } from './data/handoff.ts';
import type { EventIndex } from './data/types.ts';
import { PlaybackEngine, speedRate } from './playback/engine.ts';
import { Brand } from './components/Brand.tsx';
import { SiteNavigation } from './components/SiteNavigation.tsx';
import { initializeTelegram } from './platform/telegram.ts';
const GlobeScene = lazy(() => import('./globe/GlobeScene.tsx').then(module => ({ default: module.GlobeScene })));
import { DayLedger } from './components/DayLedger.tsx';
import { Timeline } from './components/Timeline.tsx';
import { ShotPanel } from './director/ShotPanel.tsx';
import { SceneLabels } from './director/SceneLabels.tsx';
import { ShotOverlays } from './director/ShotOverlays.tsx';
import { OnchainPanel } from './components/OnchainPanel.tsx';
import { FilmEffects } from './director/FilmEffects.tsx';
import { SHOTS, playShot, loadNarrationDurations, ledgerSidebar } from './director/shots.ts';
import './stage.css';
import './film.css';
import { recordingElementVisible, recordingVisibility, setRecordingMode, shotOverlayVisible } from './director/recording.ts';


function LoadedApp({ index, onReady, onError }: { index: EventIndex; onReady: () => void; onError: (message: string) => void }) {
  const [engine] = useState(() => { const value = new PlaybackEngine(index); value.prepareScene(); return value; });
  const state = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  useEffect(() => {
    let cancelled = false;
    // The complete HUD is mounted while the opaque loading cover is still present.
    // Scene readiness includes the first projected labels and completed GPU frame.
    void Promise.all([engine.ready(), document.fonts.ready]).then(() => {
      if (!cancelled) onReady();
    }).catch(reason => { if (!cancelled) onError(reason instanceof Error ? reason.message : 'The scene could not be prepared.'); });
    return () => { cancelled = true; };
  }, [engine, onReady, onError]);
  const [director, setDirector] = useState(false), [ledgerOpen, setLedgerOpen] = useState(false);
  const [onchain, setOnchain] = useState(false);
  const openOnchain = () => { engine.update({ playing: false, shotRunning: false }); setOnchain(true); };
  const openDirector = () => { engine.update({ recording: false }); setLedgerOpen(false); setDirector(v => !v); };
  useEffect(() => {
    const frameDriven = window.__cascade?.frameDriven === true;
    let last = frameDriven ? 0 : performance.now(), raf = 0;
    const tick = (now: number) => {
      // Clamp the per-tick delta: a main-thread stall (GC pause, a heavy
      // overlay mount — reproduced at the shot 19→12 "Beneath it"→"Close"
      // cut, which mounts the close-card's five nav links for the first
      // time) otherwise hands engine.tick() a multi-hundred-ms jump in one
      // step. shotElapsed then leaps straight past FilmEffects' ending-line
      // fade-in window, and because the screen recorder just repeats the
      // last painted frame through the stall, that jumped, already-visible
      // "global supply chains. settled." card gets baked into the END of
      // the PRECEDING shot's captured clip (scene-16.mp4, world-os cascade
      // round-3 note: text bled from scene 17 into scene 16). Capping the
      // step at 100ms (~3x the normal ~32ms cadence) makes the sim fall
      // behind during a stall instead of jumping — smooth for any real
      // viewer, and it removes the artifact from screen captures too.
      if (now - last >= 32) { const elapsed = Math.min(now - last, 100); last = now; if (!document.hidden) engine.tick(elapsed / 1000); }
      raf = requestAnimationFrame(tick);
    };
    if (!frameDriven) raf = requestAnimationFrame(tick);
    const visibility = () => { last = performance.now(); };
    if (!frameDriven) document.addEventListener('visibilitychange', visibility);
    const keyboard = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement;
      if (element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || event.repeat) return;
      if (event.shiftKey && event.code === 'KeyD') { event.preventDefault(); setDirector(v => !v); }
      if (event.code === 'Space') { event.preventDefault(); engine.toggle(); }
      if (event.code === 'Escape') { engine.stopShot(); setDirector(false); engine.update({ recording: false }); }
      if (event.code === 'KeyR') { void engine.ready().then(()=>{setRecordingMode(engine, !engine.state.recording); setDirector(false);}); }
    };
    if (!frameDriven) window.addEventListener('keydown', keyboard);
    const shot = Number(new URLSearchParams(location.search).get('shot'));
    if (SHOTS.some(s=>s.id===shot)) playShot(engine, shot);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', keyboard); document.removeEventListener('visibilitychange', visibility); };
  }, [engine]);
  useEffect(()=>{
    const keyboard=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement;
      if(!director||event.repeat||event.code!=='KeyB'||target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target.tagName))return;
      event.preventDefault();
      if(event.shiftKey)void window.__cascade?.exportBookmarks().catch(error=>console.error("Clipboard unavailable; bookmark JSON is logged above.",error));else window.__cascade?.addBookmark();
    };
    window.addEventListener('keydown',keyboard);return()=>window.removeEventListener('keydown',keyboard);
  },[director]);
  const visibility=recordingVisibility(state.recording);
  const scene=SHOTS.find(s=>s.id===state.shot),overlayActive=scene&&!['none','title'].includes(scene.overlay)&&shotOverlayVisible(state,scene,scene.overlay);
  const tesla = [...index.firms.values()].some(f => f.id.toLowerCase().includes('tesla'));
  return <main className={`app ${state.shot===2?'california-hook':''} ${state.camera.site?'site-focused':''} ${state.recording ? visibility.hud?'recording recording-hud':'recording clean-frame' : ''} ${ledgerSidebar(state.recording,state.shot) ? 'ledger-sidebar' : ''} ${ledgerOpen ? 'ledger-open' : ''} ${state.shot ? 'director-active' : ''} ${overlayActive?'overlay-active':''} ${[1,2,13,10,19,12].includes(state.shot??0)?'scene-clean':''} ${state.shot===12?'ending-wordmark':''}`}>
    <div className={state.timelapse&&state.timelapse.elapsed<state.timelapse.duration?'time-lapse-blur':''}><Suspense fallback={<div className="globe-placeholder" aria-label="Loading globe" />}><GlobeScene engine={engine} /></Suspense></div>
    <header className="topbar"><Brand onDirector={openDirector} />
      <span className="brand-subtitle">DATED DOLLARS</span><nav className="story-selector" aria-label="Featured supply chain">{['all', 'apple', 'tesla'].map(story => <button key={story} disabled={story === 'tesla' && !tesla} aria-pressed={state.story === story} onClick={() => { engine.update({ story }); if (story !== 'all') playShot(engine, 3); else { engine.stopShot(); engine.fly(36, -145, 2.15); } }}>{story === 'all' ? 'Global network' : story[0].toUpperCase() + story.slice(1)}</button>)}</nav>
      <SiteNavigation engine={engine}/>
      <button className="onchain-trigger" onClick={openOnchain}>On-chain</button>
      <div className="network-status"><span className="status-dot" />PAYMENTS IN MOTION</div>
    </header>
    {recordingElementVisible(state.recording,'scene-heading')&&<section className="scene-heading" aria-label="Cascade introduction"><span className="eyebrow">MONEY THAT MOVES THROUGH TIME</span><h1>One dollar.<br />Many payments.</h1><p>Money with a date.</p></section>}
    <div className="globe-coordinate" aria-hidden="true"><span>CASCADE</span><span>GLOBAL PAYMENT NETWORK</span></div>
    <button className="ledger-toggle" aria-expanded={ledgerOpen} aria-controls="daily-ledger" onClick={() => setLedgerOpen(v => !v)}>{ledgerOpen ? 'Close transactions' : 'Transactions'}<span aria-hidden="true">{ledgerOpen ? '−' : '+'}</span></button>
    <DayLedger rewindPosition={state.timelapse?.direction===-1&&state.timelapse.elapsed<2000?state.position:undefined} index={index} day={state.day} cursor={state.cursor} running={state.playing || state.shotRunning} rate={speedRate(state.speed)} waiting={state.paymentPresentation==='waiting'} presentation={engine.storyEvents!==null?{events:engine.storyEvents,amount:state.paymentAmount??undefined,date:state.paymentMaturity}:undefined} />
    <Timeline engine={engine} state={state} />

    {state.showDebt && recordingElementVisible(state.recording,'debt-card') && <div className="debt-card"><span>UNPAID SUPPLIER INVOICES</span><strong>$56 billion</strong></div>}
    {state.caption && recordingElementVisible(state.recording,'year-caption') && <p className="year-caption">Global supply chain</p>}
    <ShotOverlays engine={engine} state={state} onVerify={openOnchain} />
    <SceneLabels recording={state.recording} payments={state.shot===4?engine.storyEvents??[]:[]} orders={state.shot===3?engine.storyEvents??[]:[]} shot={state.shot} elapsed={state.shotElapsed} cues={state.cues} /><FilmEffects state={state} />
    {(onchain || (state.onchainGlimpse&&recordingElementVisible(state.recording,'onchain-glimpse'))) && <OnchainPanel tMs={state.tMs} onClose={() => {setOnchain(false);engine.update({onchainGlimpse:false});}} />}
    {director && visibility.director && <ShotPanel engine={engine} state={state} onClose={() => setDirector(false)} />}
  </main>;
}
export default function App() {
  useEffect(() => initializeTelegram(window.Telegram?.WebApp, document.documentElement), []);
  const [index, setIndex] = useState<EventIndex>(), [error, setError] = useState('');
  const [revealing, setRevealing] = useState(false), [revealed, setRevealed] = useState(false);
  const beginReveal = useCallback(() => setRevealing(true), []);
  const finishReveal = useCallback(() => {
    document.documentElement.dataset.cascadeRevealed = 'true';
    document.dispatchEvent(new Event('cascade:revealed'));
    setRevealed(true);
  }, []);
  useEffect(() => {
    delete document.documentElement.dataset.cascadeRevealed;
    return () => { delete document.documentElement.dataset.cascadeRevealed; };
  }, []);
  useEffect(() => {
    if (!revealing) return;
    // Fallback for environments that suppress transitionend (e.g. background tabs).
    const timer = setTimeout(finishReveal, 650);
    return () => clearTimeout(timer);
  }, [revealing, finishReveal]);
  useEffect(() => {
    const narrationReady=loadNarrationDurations(new URL(`${import.meta.env.BASE_URL}narration/narration.json`,location.href).href);
    let cancelled=false;
    const worker = new Worker(new URL('./data/loader.worker.ts', import.meta.url), { type: 'module' });
    let loading: ReturnType<typeof receiver>;
    worker.onmessage = ({ data }) => {
      if (data.type === 'header') loading = receiver(data.header);
      if (data.type === 'day') { loading.day(data.n, data.bucket); worker.postMessage({ type: 'ack' }); }
      if (data.type === 'ready') { const result=loading.finish();void narrationReady.then(()=>{if(!cancelled)setIndex(result);}); worker.terminate(); }
      if (data.type === 'error') { setError(data.error); worker.terminate(); }
    };
    worker.onerror = () => setError('The payment stream could not be opened.');
    worker.postMessage({ url: new URL(`${import.meta.env.BASE_URL}events.ndjson`, location.href).href });
    return () => {cancelled=true;worker.terminate();};
  }, []);
  if (error) return <main className="loading"><span className="eyebrow">CASCADE</span><h1>Unable to open payments</h1><p role="alert">{error}</p><button onClick={() => location.reload()}>Try again</button></main>;
  return <>
    {index && <LoadedApp index={index} onReady={beginReveal} onError={setError} />}
    {!revealed && <div className={`loading opening-cover${revealing ? ' opening-reveal' : ''}`} role="status" aria-label="Opening the network" onTransitionEnd={event => {
      if (event.target === event.currentTarget && event.propertyName === 'opacity') finishReveal();
    }}><span className="eyebrow">CASCADE</span><h1>Opening the network<span className="loading-dot">.</span></h1></div>}
  </>;
}
