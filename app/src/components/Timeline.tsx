import { useMemo } from 'react';
import type { EventIndex } from '../data/types.ts';
import { displayDate } from '../data/types.ts';
import { dollars, ratio } from '../data/format.ts';
import type { PlaybackEngine, PlaybackState, Speed } from '../playback/engine.ts';
import { Icon } from './Icon.tsx';
function VolumeChart({ index, position }: { index: EventIndex; position: number }) {
  const { maximum, purchases, settled } = useMemo(() => {
    const maximum = index.days.reduce((m, day) => day.purchases > m ? day.purchases : day.settled > m ? day.settled : m, 1n);
    const height = (value: bigint) => Number(value * 64_000n / maximum) / 1000;
    return { maximum, purchases: index.days.map((d, i) => `${i ? 'L' : 'M'}${i * 3 + 1.5},${70 - height(d.purchases)}`).join(' '),
      settled: index.days.map((d, i) => `${i ? 'L' : 'M'}${i * 3 + 1.5},${70 - height(d.settled)}`).join(' ') };
  }, [index]);
  return <div className="volume-chart"><span className="chart-ceiling">{dollars(maximum, true)}</span>
    <svg viewBox="0 0 1095 76" preserveAspectRatio="none" role="img" aria-label="Daily dollar volume of new purchases and settled invoices">
      <path d="M0 70H1095M0 38H1095M0 6H1095" stroke="#aec5ca" strokeOpacity=".08" strokeWidth="1" />
      <path d={purchases} fill="none" stroke="#7e97a5" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <path d={settled} fill="none" stroke="#69e6c0" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <path d={`M${Math.min(1093, position * 3 + 1)} 0V76`} stroke="#f1f4e7" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </svg></div>;
}
export function Timeline({ engine, state }: { engine: PlaybackEngine; state: PlaybackState }) {
  const totals = engine.totals();
  return <footer className="bottom-panel">
    <div className="timeline-region">
      <div className="timeline-top"><div className="date-block"><span className="eyebrow">DAY {String(state.day + 1).padStart(3, '0')} / 365</span><strong>{displayDate(state.day)}</strong></div>
        <div className="series-key"><span><i className="key-purchases" />New purchases</span><span><i className="key-settled" />Invoices settled</span></div>
      </div>
      <div className="chart-track"><VolumeChart index={engine.index} position={state.position} /><input className="scrubber" type="range" min="0" max="364" step="1" value={state.day} onChange={e => engine.seek(Number(e.target.value))} aria-label="Timeline day" aria-valuetext={displayDate(state.day)} /></div>
      <div className="timeline-months"><span>SEP 9, 2025</span><span>NOV</span><span>JAN 2026</span><span>MAR</span><span>MAY</span><span>JUL</span><span>SEP 8, 2026</span></div>
      <div className="transport"><button className="play-button" onClick={() => engine.toggle()} aria-label={state.playing || state.shotRunning ? 'Pause' : 'Play'}><Icon name={state.playing || state.shotRunning ? 'pause' : 'play'} /></button>
        <button className="icon-button" onClick={() => engine.replayDay()} aria-label="Replay current day"><Icon name="replay" /></button>
        <div className="speed-options" aria-label="Playback speed">{([1, 10, 50, 'year'] as Speed[]).map(speed => <button key={speed} aria-pressed={state.speed === speed} onClick={() => engine.setSpeed(speed)}>{speed === 'year' ? '1 YEAR / 15 SEC' : `${speed}×`}</button>)}</div>
        <span className="playback-state">{state.playing || state.shotRunning ? 'PLAYING' : 'PAUSED'}</span>
      </div>
    </div>
    <div className="headline-counters" aria-label="Cumulative payment counters">
      <div className="headline"><span>INVOICES SETTLED</span><strong data-testid="settled">{dollars(totals.settled, true)}</strong></div>
      <div className="headline"><span>PRINCIPAL COMMITTED</span><strong data-testid="committed">{dollars(totals.committed, true)}</strong></div>
      <div className="ratio"><strong data-testid="ratio">{ratio(totals.settled, totals.committed)}</strong><span>SETTLED / COMMITTED</span></div>
    </div>
  </footer>;
}
