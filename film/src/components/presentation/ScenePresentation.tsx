import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {DatedDollar} from '@cascade-app/components/DatedDollar.ts';
import {AppSurface, PresentationPane} from '../AppSurface';
import {type WindowGeometry} from '../windowGeometry';
import {cueFrame, type SceneCues} from '../../cues';
import {extensionState, illustrativeDate, swapPositions, YEAR_INVOICES, STRESS_OPERATIONS} from './presentationMath';
import './presentation.css';

type Beat = (name: string) => boolean;

/** Stage 2 requires new film cards to fail visibly in development if a spoken cue is missing. */
const requiredFrame = (cues: SceneCues, name: string, fps: number) => {
  if (cues?.[name] === undefined) throw new Error(`Missing presentation cue: ${name}`);
  return cueFrame(cues, name, fps, Number.NaN);
};

const Wordmark = () => <h2 className="close-wordmark"><svg className="wordmark-icon" viewBox="0 0 36 36" aria-hidden="true"><path d="M5 8h26M5 18h19M5 28h12" stroke="currentColor" strokeWidth="4"/></svg>Cascade Money</h2>;
const visibility = (shown: boolean): React.CSSProperties => ({visibility: shown ? 'visible' : 'hidden'});
const citations = [
  {cue: 'stat-cost', source: 'Apple 10-K FY2025', fact: 'product cost of sales $194.1B'},
  {cue: 'stat-suppliers', source: 'Apple Supplier List 2025', fact: '~200 direct suppliers, 98% of spend'},
  {cue: 'stat-factories', source: 'Apple Supply Chain 2025 Progress Report', fact: 'thousands of facilities, 50+ countries'},
];

const HookPresentation: React.FC<{shown: Beat; geometry: WindowGeometry}> = ({shown, geometry}) => {
  const unit = geometry.width / 1920;
  return <>
    <div className="film-hook-sources" style={{left: 32 * unit, right: 32 * unit, top: 40 * unit}}>
      {citations.map(c => <div key={c.cue} style={visibility(shown(c.cue))}><strong>{c.source}</strong><span>{c.fact}</span></div>)}
    </div>
    <div className="film-hook-band" style={{left: 32 * unit, right: 32 * unit, top: geometry.rect.bottom + 8 * unit, bottom: 8 * unit}}>
      {shown('wordmark') ? <section className="overlay-card film-hook-close"><Wordmark/>{shown('hook-arc') && <p>on Arc</p>}</section>
        : shown('promises') ? <section className="overlay-card"><h2>payment terms and promises</h2></section>
        : shown('stat-suppliers') ? <section className="overlay-card cascade-totals film-hook-facts">
          <div className="cascade-stat"><strong>200</strong><span>suppliers</span></div>
          <div className="cascade-stat" style={visibility(shown('stat-factories'))}><strong>thousands</strong><span>of factories</span></div>
          <div className="cascade-stat" style={visibility(shown('stat-countries'))}><strong>50</strong><span>countries</span></div>
        </section>
        : shown('hook-open') ? <section className="overlay-card film-hook-cost"><div className="cascade-stat"><strong>$200B</strong><span>of product costs</span></div></section> : null}
    </div>
  </>;
};

const QuestionPresentation: React.FC<{shown: Beat}> = ({shown}) => !shown('question-card') ? null :
  <section className="overlay-card question-card film-inset-card" aria-label="A future payment moves today">
    <h2>{shown('dated-dollar') ? 'A dated dollar.' : <>What if that future payment<br/>could move today?</>}</h2>
    {shown('dated-dollar') && <DatedDollar days={30} isoDate={illustrativeDate(30)} size={100}/>}
    {shown('not-cash') && <p>Not as cash. As a dollar with a date.</p>}
  </section>;

const ExamplePresentation: React.FC<{shown: Beat}> = ({shown}) => !shown('example-labels') ? null :
  <section className="overlay-card film-inset-card" aria-label="The supply chain's timing gap"><p>FROM APPLE · LATER</p><p>PAYMENT NEEDED · TODAY</p></section>;

const TotalsPresentation: React.FC<{shown: Beat}> = ({shown}) =>
  <section className="overlay-card cascade-totals film-totals" aria-label="The branched cascade">
    <div className="cascade-stat"><strong style={visibility(shown('deposited-value'))}>$100M</strong><span style={visibility(shown('committed-counter'))}>deposited</span></div>
    <div className="cascade-stat"><strong style={visibility(shown('transacted-value'))}>$450M</strong><span style={visibility(shown('settled-counter'))}>transacted</span></div>
    <div className="cascade-stat"><strong style={visibility(shown('invoice-value'))}>9</strong><span><span style={visibility(shown('companies-counter'))}>invoices</span>{' '}<span style={visibility(shown('invoices-settled'))}>settled</span></span></div>
  </section>;

const CoinPresentation: React.FC<{shown: Beat; at: (name: string) => number; frame: number; fps: number; geometry: WindowGeometry}> = ({shown, at, frame, fps, geometry}) => {
  const unit = geometry.width / 1920;
  const extension = extensionState(frame, at('extend'), at('coin-yield'));
  const final = shown('final-card');
  const extending = shown('extend') && !final;
  const title = final ? 'One dollar.' : shown('coin-yield') ? 'Yield for exactly that time' : shown('extend') ? 'Extend farther' : shown('earlier-pays-later') ? 'Earlier pays later' : shown('coin-principal') ? 'One dollar' : shown('swap') ? 'Interchangeable' : 'Dollars';
  const center = (geometry.rect.left - 64 * unit) / 2;
  const poses = swapPositions((frame - at('swap')) / fps, center, 743 * unit, 151 * unit);
  const pair = shown('coin-pair') && !shown('earlier-pays-later');
  return <section className="overlay-card coin-layout film-coin" aria-label="Dated dollar">
    <div className="coin-copy" style={visibility(shown('coin'))}>
      <h2>{title}</h2>
      {final ? shown('final-date') && <p>One date.</p> : <>
        {!shown('earlier-pays-later') && <>{shown('coin-principal') && <p>One USDC{shown('coin-date') && <> on a calendar date.</>}</p>}</>}
        {shown('earlier-pays-later') && !extending && <p>A dollar due earlier pays a bill due later{shown('face-value') && <> at face value.</>}</p>}
        {extending && <div className="coin-extension"><div className="date-interval"><span>DAY 0</span><span>DAY 30</span><span>DAY 90</span></div>
          <div className="extension-ticks" aria-label={`${extension.addedDays} added days of yield`}>{extension.ticks.map(tick => <i key={tick.day} data-day={tick.day} data-filled={tick.filled} style={{background: tick.filled ? '#69e6c0' : '#233c39'}}/>)}</div>
          <div className="meter-label"><span>{extension.addedDays} added days</span></div>
        </div>}
      </>}
    </div>
    <div className={pair ? 'same-date-stage' : 'coin-stage'} style={visibility(shown('coin'))}>
      {(pair ? poses : [{x: center, y: 743 * unit}]).map((pose, i) => <div key={i} className="swap-coin" style={{left: pose.x, top: pose.y, transform: 'translate(-50%, -50%)'}}><DatedDollar days={pair || shown('coin-date') ? extension.maturityDay : null} isoDate={pair || shown('coin-date') ? illustrativeDate(extension.maturityDay) : undefined} size={100 * unit}/></div>)}
    </div>
  </section>;
};

const BackingPresentation: React.FC<{shown: Beat}> = ({shown}) => !shown('backing-card') ? null :
  <section className="overlay-card backing-card film-backing" aria-label="Vault backing">
    <h2>A vault on Arc.</h2>
    {shown('contract') && <p className="contract-line">ERC-1155{shown('maturity-day') && <> · a token id for each UTC maturity day.</>}</p>}
    {shown('reserve') && <div className="asset-composition"><b>USYC{shown('reserve-role') && <small>yield-bearing reserve</small>}</b></div>}
  </section>;

const StressPresentation: React.FC<{shown: Beat}> = ({shown}) => !shown('stress-flash') || shown('stress-end') ? null :
  <section className="overlay-card film-inset-card film-stress" aria-label="Year simulation and separate adversarial test">
    <p><strong>{YEAR_INVOICES.toLocaleString('en-US')} simulated invoices.</strong></p>
    <p>Every invariant held under adversarial conditions.</p>
    {shown('stress-operations') && <p className="fine-print">Separate adversarial test · {STRESS_OPERATIONS.toLocaleString('en-US')} operations</p>}
  </section>;

const ComposablePresentation: React.FC<{shown: Beat}> = ({shown}) => {
  if (shown('money-plus-time')) return <section className="overlay-card film-money-time"><h2>Money{shown('money-plus') && <> plus</>}{shown('money-time') && <> time</>}</h2></section>;
  if (shown('wordmark')) return <section className="overlay-card film-cascade"><Wordmark/></section>;
  return <section className="overlay-card architecture-card film-composable" aria-label="Composable finance"><ol className="composable-items">{['Loans', 'Forwards', 'Bonds', 'Derivatives'].map((title, i) => <li key={title} className="beat-visible" style={visibility(shown(`word-${title.toLowerCase()}`))}><span>{String(i + 1).padStart(2, '0')}</span><div><strong>{title}</strong></div></li>)}</ol></section>;
};

export const ScenePresentation: React.FC<{scene: number; geometry: WindowGeometry; cues: SceneCues}> = ({scene, geometry, cues}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const at = (name: string) => requiredFrame(cues, name, fps);
  const shown: Beat = name => frame >= at(name);
  const unit = geometry.width / 1920;
  if (![2, 3, 4, 6, 7, 8, 9, 10].includes(scene)) return null;
  const inset = scene === 3 || scene === 4 || scene === 9;
  const content = scene === 3 ? <ExamplePresentation shown={shown}/> : scene === 4 ? <QuestionPresentation shown={shown}/> : scene === 6 ? <TotalsPresentation shown={shown}/>
    : scene === 7 ? <CoinPresentation shown={shown} at={at} frame={frame} fps={fps} geometry={geometry}/>
    : scene === 8 ? <BackingPresentation shown={shown}/> : scene === 9 ? <StressPresentation shown={shown}/> : <ComposablePresentation shown={shown}/>;
  return <AppSurface className={`film-presentation film-presentation-${scene}`}>
    {scene === 2 ? <HookPresentation shown={shown} geometry={geometry}/>
      : inset ? <div className="film-presentation-inset" style={{position: 'absolute', left: geometry.rect.left + 84 * unit, top: geometry.rect.top + 403 * unit, width: 980 * unit, height: 380 * unit}}>{content}</div>
      : <PresentationPane side="left" geometry={geometry} verticalAlign={scene === 7 ? 'start' : 'center'}>{content}</PresentationPane>}
  </AppSurface>;
};
