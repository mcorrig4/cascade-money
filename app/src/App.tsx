import { useEffect, useState, useSyncExternalStore } from 'react';
import type { EventIndex } from './data/types.ts';
import { PlaybackEngine } from './playback/engine.ts';
import { GlobeScene } from './globe/GlobeScene.tsx';
import { DayLedger } from './components/DayLedger.tsx';
import { Timeline } from './components/Timeline.tsx';
import { ShotPanel } from './director/ShotPanel.tsx';
import { ShotOverlays } from './director/ShotOverlays.tsx';
import { playShot } from './director/shots.ts';

function LoadedApp({ index }: { index: EventIndex }) {
  const [engine] = useState(() => new PlaybackEngine(index));
  const state = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const [director, setDirector] = useState(false);
  useEffect(() => {
    let last = performance.now(), raf = 0;
    const tick = (now: number) => {
      if (now - last >= 32) { const elapsed = now - last; last = now; if (!document.hidden) engine.tick(elapsed / 1000); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const visibility = () => { last = performance.now(); };
    document.addEventListener('visibilitychange', visibility);
    const keyboard = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement;
      if (element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || event.repeat) return;
      if (event.shiftKey && event.code === 'KeyD') { event.preventDefault(); setDirector(v => !v); }
      if (event.code === 'Space') { event.preventDefault(); engine.toggle(); }
      if (event.code === 'Escape') { engine.stopShot(); setDirector(false); engine.update({ recording: false }); }
      if (event.code === 'KeyR') { engine.update({ recording: !engine.state.recording }); setDirector(false); }
    };
    window.addEventListener('keydown', keyboard);
    const shot = Number(new URLSearchParams(location.search).get('shot'));
    if (shot >= 1 && shot <= 12) playShot(engine, shot);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', keyboard); document.removeEventListener('visibilitychange', visibility); };
  }, [engine]);
  const tesla = [...index.firms.values()].some(f => f.id.toLowerCase().includes('tesla'));
  return <main className={`app ${state.recording ? 'recording' : ''} ${state.shot && state.shot >= 6 ? 'overlay-active' : ''}`}>
    <GlobeScene engine={engine} />
    <header className="topbar"><a className="brand" href="./" aria-label="Cascade home"><svg width="35" height="35" viewBox="0 0 36 36" aria-hidden="true"><path d="M5 8h26M5 18h19M5 28h12" stroke="currentColor" strokeWidth="4" /></svg><span>cascade<span className="brand-dot">.</span></span></a>
      <span className="brand-subtitle">DATED DOLLARS</span><nav className="story-selector" aria-label="Featured supply chain">{['all', 'apple', 'tesla'].map(story => <button key={story} disabled={story === 'tesla' && !tesla} aria-pressed={state.story === story} onClick={() => { engine.update({ story }); if (story !== 'all') playShot(engine, 3); else { engine.stopShot(); engine.fly(36, -145, 2.15); } }}>{story === 'all' ? 'Global network' : story[0].toUpperCase() + story.slice(1)}</button>)}</nav>
      <div className="network-status"><span className="status-dot" />PAYMENTS IN MOTION</div>
    </header>
    <section className="scene-heading" aria-label="Cascade introduction"><span className="eyebrow">MONEY THAT MOVES THROUGH TIME</span><h1>One dollar.<br />Many payments.</h1><p>Money that pays bills<br />before it becomes cash.</p></section>
    <div className="globe-coordinate" aria-hidden="true"><span>CASCADE</span><span>GLOBAL PAYMENT NETWORK</span></div>
    <DayLedger index={index} day={state.day} cursor={state.cursor} />
    <Timeline engine={engine} state={state} />
    {state.shot === 1 && <div className="location-card"><span className="eyebrow">CUPERTINO, CALIFORNIA</span><h2>Apple Park</h2><p>September 9, 2025</p></div>}
    {state.showDebt && <div className="debt-card"><span>UNPAID SUPPLIER INVOICES</span><strong>$56 billion</strong></div>}
    {state.caption && <p className="year-caption">illustrative global supply chain</p>}
    <ShotOverlays engine={engine} state={state} />
    {director && !state.recording && <ShotPanel engine={engine} state={state} onClose={() => setDirector(false)} />}
  </main>;
}
export default function App() {
  const [index, setIndex] = useState<EventIndex>(), [error, setError] = useState('');
  useEffect(() => {
    const worker = new Worker(new URL('./data/loader.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => { if (data.type === 'ready') setIndex(data.index); if (data.type === 'error') setError(data.error); };
    worker.onerror = () => setError('The payment stream could not be opened.');
    worker.postMessage({ url: new URL(`${import.meta.env.BASE_URL}events.ndjson`, location.href).href });
    return () => worker.terminate();
  }, []);
  if (error) return <main className="loading"><span className="eyebrow">CASCADE</span><h1>Unable to open payments</h1><p role="alert">{error}</p><button onClick={() => location.reload()}>Try again</button></main>;
  if (!index) return <main className="loading"><span className="eyebrow">CASCADE</span><h1>Opening the network<span className="loading-dot">.</span></h1></main>;
  return <LoadedApp index={index} />;
}
