import { Icon } from '../components/Icon.tsx';
import { SHOTS, playShot, shotAvailable } from './shots.ts';
import type { PlaybackEngine, PlaybackState } from '../playback/engine.ts';
export function ShotPanel({ engine, state, onClose }: { engine: PlaybackEngine; state: PlaybackState; onClose: () => void }) {
  return <section className="director" aria-label="Shot director">
    <div className="director-head"><div><span className="eyebrow">CASCADE / DIRECTOR</span><h2>Shot control</h2></div><button className="icon-button" onClick={onClose} aria-label="Close director"><Icon name="close" /></button></div>
    <div className="shot-list">{SHOTS.map(shot => <button key={shot.id} onClick={() => playShot(engine, shot.id)} disabled={!shotAvailable(engine, shot.id)} aria-pressed={state.shot === shot.id} title={!shotAvailable(engine, shot.id) ? 'This story has no matching events yet' : undefined}>
      <span className="shot-number">{String(shot.id).padStart(2, '0')}</span><span className="shot-description"><strong>{shot.title}</strong><small>{shot.detail}</small></span><span className="shot-duration">{shot.duration}</span>
    </button>)}</div>
    <div className="director-controls"><button onClick={() => playShot(engine, Math.max(1, (state.shot ?? 2) - 1))}><Icon name="left" />Previous</button><button onClick={() => playShot(engine, state.shot ?? 1)}><Icon name="replay" />Restart</button><button onClick={() => playShot(engine, Math.min(12, (state.shot ?? 0) + 1))}>Next<Icon name="right" /></button></div>
    <button className="record-button" onClick={() => { engine.update({ recording: true }); onClose(); }}><Icon name="expand" />Recording mode</button>
    <p className="director-help">Shift+D director · Space pause · Esc exit shot · R recording</p>
    {engine.index.warnings.length > 0 && <p className="director-warning">{engine.index.warnings.join('; ')}</p>}
  </section>;
}
