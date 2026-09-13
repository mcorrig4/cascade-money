import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {DatedDollar} from '@cascade-app/components/DatedDollar.ts';
import {AppSurface, PresentationPane} from '../AppSurface';
import {presentationRect, type WindowGeometry} from '../windowGeometry';
import {filmUnitFor} from '../appSurfaceGeometry';
import {cueFrame, type SceneCues} from '../../cues';
import {extensionState, illustrativeDate, swapPositions, STRESS_OPERATIONS, STRESS_ACCEPTED, STRESS_REJECTED} from './presentationMath';
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
  {cue: 'hook-open', sourceCue: 'stat-cost', figure: '$200B', label: 'of product costs', source: 'Apple 10-K FY2025', fact: 'product cost of sales $194.1B'},
  {cue: 'stat-suppliers', sourceCue: 'stat-suppliers', figure: '200', label: 'suppliers', source: 'Apple Supplier List 2025', fact: 'about 200 direct suppliers, 98% of spend'},
  {cue: 'stat-factories', sourceCue: 'stat-factories', figure: 'thousands', label: 'of factories', source: 'Apple Supply Chain 2025 Progress Report', fact: 'thousands of facilities'},
  {cue: 'stat-countries', sourceCue: 'stat-countries', figure: '50', label: 'countries', source: 'Apple Supply Chain 2025 Progress Report', fact: '50+ countries'},
];

const HookPresentation: React.FC<{at: (name: string) => number; geometry: WindowGeometry}> = ({at, geometry}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const unit = geometry.width / 1920;
  const terms = at('payment-terms'), promises = at('promises-word');
  const close = at('wordmark'), arc = at('hook-arc');
  const progress = (start: number, duration: number) => interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const on = (start: number) => progress(start - 1, 1) === 1;
  const reveal = (start: number): React.CSSProperties => ({
    ...visibility(on(start)), opacity: progress(start, .2 * fps),
  });
  return <div className="film-hook-band" style={{
    left: 32 * unit, right: 32 * unit, top: geometry.rect.bottom + 8 * unit, bottom: 8 * unit,
    '--film-unit': `${unit}px`,
  } as React.CSSProperties}>
    <section className="film-hook-facts" style={{opacity: 1 - .75 * progress(terms, .4 * fps)}}>
      {citations.map(c => <div className="film-hook-column" key={c.cue} style={reveal(at(c.cue))}>
        <strong className="film-hook-figure">{c.figure}</strong>
        <span className="film-hook-label">{c.label}</span>
        <div className="film-hook-source" style={reveal(at(c.sourceCue))}>
          <strong>{c.source}</strong><span>{c.fact}</span>
        </div>
      </div>)}
    </section>
    {/* Both clauses occupy their final width even before the second is spoken. */}
    <h2 className="film-hook-phrase" style={{
      ...visibility(on(terms) && !on(close)), opacity: progress(terms, .2 * fps) * (1 - progress(close - 1, 1)),
    }}>
      <span style={reveal(terms)}>payment terms</span><span style={reveal(promises)}> and promises</span>
    </h2>
    <section className="overlay-card film-hook-close" style={reveal(close)}>
      <Wordmark/><p style={reveal(arc)}>on Arc</p>
    </section>
  </div>;
};

const QuestionPresentation: React.FC<{at: (name: string) => number; geometry: WindowGeometry}> = ({at, geometry}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const unit = geometry.width / 1920;
  const question = at('question-card'), dollar = at('dated-dollar');
  const cash = at('not-as-cash'), definition = at('as-dollar-with-date');
  const progress = (start: number, duration: number) => interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const on = (start: number) => progress(start - 1, 1) === 1;
  const rise = progress(question, 6 * fps / 30);
  const dissolve = progress(dollar, .35 * fps);
  const slide = progress(dollar, .5 * fps);
  // The settled ledger row reads for .45 s before converging; the coin then holds
  // from dollar + 1.40 s until the measured 'not-as-cash' cue at 5.224 s.
  const convergeAt = dollar + .95 * fps;
  const converge = progress(convergeAt, .45 * fps);
  const size = 170 * unit, lockupWidth = size * 462 / 170;
  const discX = lockupWidth * .1775, discY = size * 82 / 170;
  return <>
    <div className="film-question-scrim" aria-hidden="true" style={{opacity: rise}}/>
    <section className="film-question" aria-label="A future payment moves today">
      <h2 className="film-question-heading" style={{
        ...visibility(on(question) && dissolve < 1), opacity: rise * (1 - dissolve),
        transform: `translateY(${12 * unit * (1 - rise)}px)`,
      }}>What if that future payment<br/>could move today?</h2>
      <div className="film-question-object">
        {/* A zero-width grid anchors the gap on the disc, independent of text widths.
            Each term's own half-width closes into that same anchor. */}
        <div className="film-question-ledger" style={{
          left: discX, top: discY, opacity: slide * (1 - converge),
          transform: `translate(${120 * unit * (1 - slide)}px, -50%)`,
          ...visibility(on(dollar) && converge < 1),
        }}>
          <strong className="film-question-amount" style={{
            transform: `translateX(calc(${50 * converge}% - ${14 * unit * (1 - converge)}px))`,
          }}>$100M</strong>
          <span className="film-question-date" style={{
            transform: `translateX(calc(${-50 * converge}% + ${14 * unit * (1 - converge)}px))`,
          }}>DEC 8</span>
        </div>
        {/* The lockup's own left edge sits on the gutter; the disc is its anchor point. */}
        <div className="film-question-token" style={{
          left: 0, width: lockupWidth, height: size, opacity: converge,
          transformOrigin: `${discX}px ${discY}px`, transform: `scale(${.85 + .15 * converge})`,
          ...visibility(on(convergeAt)),
        }}>
          <DatedDollar days={30} isoDate={illustrativeDate(30)} size={size}/>
        </div>
      </div>
      <p className="film-question-definition">
        <span style={visibility(on(cash))}>Not as cash.</span>{' '}
        <span style={visibility(on(definition))}>As a dollar with a date.</span>
      </p>
    </section>
  </>;
};

const ExamplePresentation: React.FC<{at: (name: string) => number; geometry: WindowGeometry}> = ({at, geometry}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const unit = geometry.width / 1920;
  const tracks = [
    {cue: 'parts-move', label: 'Parts delivered', duration: .4, className: 'film-example-parts'},
    {cue: 'money-waits', label: 'Payment due', duration: .9, className: 'film-example-money'},
  ].map(track => ({...track, start: at(track.cue)}));
  const closing = at('example-labels');
  const progress = (start: number, duration: number) => interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const on = (start: number) => progress(start - 1, 1) === 1;
  return <>
    <div className="film-question-scrim film-example-scrim" aria-hidden="true" style={visibility(on(tracks[0].start))}/>
    <section className="film-example" aria-label="The supply chain's timing gap" style={{left: 48 * unit, width: 620 * unit}}>
      <div className="film-example-eyebrow" style={visibility(on(tracks[0].start))}>PARTS AND PAYMENT</div>
      {tracks.map(track => <div className="film-example-track" key={track.cue} style={visibility(on(track.start))}>
        <div className="film-example-label">{track.label}</div>
        <div className="film-example-bar">
          <div className={`film-example-fill ${track.className}`} style={{transform: `scaleX(${progress(track.start, track.duration * fps)})`}}/>
        </div>
      </div>)}
      <div className="film-example-dates" style={visibility(on(tracks[1].start))}>
        <span>DAY 0</span><span>DAY 90</span>
        <i className="film-example-stop" aria-hidden="true"/>
      </div>
      <p className="film-example-closing" style={visibility(on(closing))}>
        Incoming value is useful only if it<br/>can meet the next obligation.
      </p>
    </section>
  </>;
};

const CascadePresentation: React.FC<{at: (name: string) => number; geometry: WindowGeometry}> = ({at, geometry}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const unit = geometry.width / 1920;
  const start = at('same-dollars'), settled = at('nine-invoices');
  const tickFrames = 1.1 * fps / 9;
  const progress = (onset: number, duration: number) => interpolate(frame, [onset, onset + duration], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const on = (onset: number) => progress(onset - 1, 1) === 1;
  const count = progress(settled, .2 * fps);
  return <section className="film-cascade-spine" aria-label="The same dollars: nine invoices settled" style={visibility(on(start))}>
    <div className="film-totals-eyebrow">THE SAME DOLLARS</div>
    <div className="film-cascade-spine-row">
      <svg className="film-cascade-spine-drawing" width={56 * unit} height={502 * unit}>
        <rect className="film-cascade-source" width={56 * unit} height={34 * unit}/>
        {Array.from({length: 9}, (_, i) => <g key={i}>
          <rect className="film-cascade-hop" x={0} y={(40 + i * 52) * unit} width={56 * unit} height={46 * unit}/>
          <rect className="film-cascade-hop-fill" x={0} y={(40 + i * 52) * unit} width={56 * unit}
            height={46 * unit * progress(start + i * tickFrames, tickFrames)}/>
        </g>)}
      </svg>
      {/* The SVG's bottom edge supplies the last segment's baseline for the HTML heading. */}
      <div className="film-totals-heading" style={{...visibility(on(settled)), opacity: count, transform: `translateY(${12 * unit * (1 - count)}px)`}}>
        <strong className="film-totals-figure">9</strong>
        <span className="film-totals-label">invoices settled</span>
      </div>
    </div>
  </section>;
};

const TotalsPresentation: React.FC<{at: (name: string) => number; geometry: WindowGeometry}> = ({at, geometry}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const unit = geometry.width / 1920;
  const reserveValue = at('deposited-value'), reserveDraw = at('committed-counter');
  const settlementValue = at('transacted-value'), settlementDraw = at('settled-counter');
  const segmentStart = at('invoices-settled');
  // These spoken words no longer reveal separate counters, but remain required cues.
  at('invoice-value'); at('companies-counter');
  const riseFrames = 6 * fps / 30, drawFrames = .45 * fps, tickFrames = .7 * fps / 9;
  const progress = (start: number, duration: number) => interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const rise = (start: number): React.CSSProperties => {
    const p = progress(start, riseFrames);
    return {opacity: p, transform: `translateY(${12 * unit * (1 - p)}px)`};
  };
  const reveal = (start: number): React.CSSProperties => ({
    clipPath: `inset(0 ${(1 - progress(start, riseFrames)) * 100}% 0 0)`,
  });
  const multiplier = progress(segmentStart, riseFrames);
  return <section className="film-totals" aria-label="Backing and flow: $450 million settled against $100 million in reserve"
    style={{marginBottom: geometry.height * (252 / 1080)}}>
    <div className="film-totals-eyebrow" style={reveal(reserveValue)}>BACKING AND FLOW</div>
    <div className="film-totals-row">
      <div className="film-totals-heading">
        <strong className="film-totals-figure" style={rise(reserveValue)}>$100M</strong>
        <span className="film-totals-label" style={reveal(reserveDraw + drawFrames)}>deposited · the reserve</span>
      </div>
      <div className="film-totals-bar film-totals-reserve" style={{transform: `scaleX(${progress(reserveDraw, drawFrames)})`}}/>
    </div>
    <div className="film-totals-row">
      <div className="film-totals-heading">
        <strong className="film-totals-figure" style={rise(settlementValue)}>$450M</strong>
        <span className="film-totals-label" style={reveal(settlementDraw + drawFrames)}>transacted</span>
      </div>
      <div className="film-totals-bar film-totals-settlement" style={{transform: `scaleX(${progress(settlementDraw, drawFrames)})`}}
        role="img" aria-label="Nine settlements total 4.5 times the reserve">
        {Array.from({length: 9}, (_, i) => <div className="film-totals-segment" key={i}>
          {/* Retract each mint bridge to expose the ground-colour divider beneath it. */}
          {i > 0 && <i className="film-totals-divider" style={{transform: `scaleY(${1 - progress(segmentStart + i * tickFrames, tickFrames)})`}}/>}
        </div>)}
      </div>
    </div>
    <span className="film-totals-multiplier" style={{
      visibility: frame < segmentStart ? 'hidden' : 'visible',
      transform: `translateY(${12 * unit * (1 - multiplier)}px)`,
    }}>4.5x the reserve</span>
  </section>;
};

const CoinPresentation: React.FC<{at: (name: string) => number; geometry: WindowGeometry}> = ({at, geometry}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const unit = geometry.width / 1920;
  const pane = presentationRect(geometry, 'left', 32 * filmUnitFor(geometry.width, geometry.height));
  const axisLeft = 0, axisRight = pane.width;
  const axisY = pane.height * .76;
  const tokenY = pane.height * .40;
  const soloSize = 165 * unit, pairSize = 100 * unit;
  const soloWidth = soloSize * 462 / 170, pairWidth = pairSize * 462 / 170;
  const soloLeft = (pane.width - soloWidth) / 2;
  const pairRadius = (pairWidth + 24 * unit) / 2;
  const dayX = (day: number) => axisLeft + (axisRight - axisLeft) * day / 90;
  const beat = {
    coin: at('coin'), pair: at('coin-pair'), swap: at('swap'), principal: at('coin-principal'),
    date: at('coin-date'), earlier: at('earlier-pays-later'), face: at('face-value'),
    extend: at('extend'), yield: at('coin-yield'), final: at('final-card'), finalDate: at('final-date'),
  };
  const progress = (start: number, seconds: number) => interpolate(frame, [start, start + seconds * fps], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  // A one-frame step stamps copy on its cue, without a cross-fade or anticipation.
  const on = (start: number) => interpolate(frame, [start - 1, start], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  }) === 1;
  const enter = progress(beat.pair, .6);
  const principal = progress(beat.principal, .5);
  const accepted = progress(beat.earlier, .5);
  const billDays = [15, 45, 62, 84];
  const billsStart = beat.earlier + .5 * fps;
  const judgementSeconds = .9 / billDays.length;
  const verdictOpacity = 1 - .55 * progress(billsStart + .9 * fps, .25);
  const finalProgress = progress(beat.final, .5);
  const dim = 1 - finalProgress;
  const extension = extensionState(frame, at('extend'), at('coin-yield'));
  const originalDay = extension.maturityDay - extension.addedDays;
  // Use the outbound half of the existing swap arc, then hold the exchanged positions.
  const arc = swapPositions(.75 * progress(beat.swap, .75), 0, 0, pairRadius);
  const pairPoses = arc.map(pose => ({
    left: (pane.width - pairWidth) / 2 + pose.x * enter,
    y: tokenY + pose.y / pairRadius * 60 * unit * enter,
  }));
  const extending = on(beat.extend);
  const maturityDay = extending ? extension.maturityDay : 30;
  const markerX = dayX(maturityDay);
  const caption = on(beat.yield) ? 'Yield for the added interval only'
    : on(beat.face) ? 'At face value'
    : on(beat.earlier) ? 'Earlier pays later'
    : on(beat.date) ? 'Redeemable on its calendar date'
    : on(beat.principal) ? '1 USDC of principal'
    : on(beat.pair) ? 'Same date' : '';
  const token = (left: number, y: number, size: number, days: number, isoDate?: string, opacity = 1) =>
    <div className="film-coin-token" style={{left, top: y - size * 82 / 170, opacity}}>
      <DatedDollar days={days} isoDate={isoDate} size={size}/>
    </div>;
  const activeSize = pairSize + (soloSize - pairSize) * principal;
  const tokenLeft = pairPoses[0].left * (1 - principal) + soloLeft * principal;
  const activeY = pairPoses[0].y * (1 - principal) + tokenY * principal;
  // DatedDollar's disc centre is (82, 82) in its cropped viewBox; its outer radius is 81.5.
  const dropX = tokenLeft + activeSize * 82 / 170;
  const dropY = activeY + activeSize * 81.5 / 170;
  const ghostSize = 70 * unit;
  return <section className="film-coin" aria-label="Dated dollar">
    <div className="film-coin-kicker" style={{opacity: progress(beat.coin, .3) * dim}}>THE PRIMITIVE</div>
    <div className="film-coin-axis" style={{left: axisLeft, width: axisRight - axisLeft, top: axisY, opacity: dim}}>
      {on(beat.earlier) && <div className="film-coin-accepted" style={{
        left: dayX(originalDay), width: axisRight - dayX(originalDay),
        top: -40 * unit, height: 40 * unit, opacity: verdictOpacity,
        clipPath: `inset(0 ${(1 - accepted) * 100}% 0 0)`,
      }}/>}
      <div className="film-coin-hairline" style={{transform: `scaleX(${progress(beat.coin, .6)})`}}/>
      <div className="film-coin-elapsed" style={{width: `${100 / 3}%`, transform: `scaleX(${Math.min(1, 3 * progress(beat.coin, .6))})`}}/>
      {extending && <div className="film-coin-extension" style={{left: `${100 / 3}%`, width: `${extension.addedDays / 90 * 100}%`}}/>}
    </div>
    {on(beat.pair) && <svg className="film-coin-drop" width="100%" height="100%" style={{opacity: dim}}>
      <path d={`M ${dropX} ${dropY} V ${axisY} H ${markerX}`}/>
    </svg>}
    {on(beat.coin) && <div className="film-coin-marker" style={{left: markerX, top: axisY, opacity: dim}}/>}
    <div className="film-coin-annotations" style={{opacity: dim}}>
      {[0, 30, 90].map(day => <div key={day} className="film-coin-tick" style={{
        left: dayX(day), top: axisY,
        visibility: on(beat.coin) && progress(beat.coin, .6) >= day / 90 ? 'visible' : 'hidden',
      }}>
        <i/>
        <span className="film-coin-day" style={{transform: `translateX(${day === 0 ? 0 : day === 90 ? -100 : -50}%)`}}>DAY {day}</span>
        {day === 30 && on(beat.date) && <span className="film-coin-redeemable">REDEEMABLE</span>}
        {day !== 0 && on(beat.face) && <span className="film-coin-face" style={{transform: `translateX(${day === 90 ? -100 : -50}%)`}}>1.00</span>}
      </div>)}
      <div className="film-coin-bills" style={{opacity: verdictOpacity}}>
        {on(billsStart) && <span className="film-coin-bills-label" style={{left: dayX((15 + 84) / 2), top: axisY - 74 * unit}}>BILLS DUE</span>}
        {billDays.map((day, index) => {
          const start = billsStart + index * judgementSeconds * fps;
          const judgement = progress(start, judgementSeconds);
          const payable = day >= originalDay;
          return on(start) && <svg key={day} className={`film-coin-bill${payable ? '' : ' film-coin-bill-rejected'}`}
            width={18 * unit} height={26 * unit} role="img" aria-label={`Bill due day ${day}: ${payable ? 'payable' : 'not payable'}`}
            style={{left: dayX(day) - 9 * unit, top: axisY - 26 * unit, opacity: payable ? .9 : .5}}>
            <rect x={1} y={1} width={18 * unit - 2} height={26 * unit - 2} fillOpacity={payable ? judgement : 0}/>
            {!payable && <line x1={0} y1={26 * unit} x2={18 * unit} y2={0} opacity={judgement}/>}
          </svg>;
        })}
      </div>
      {extending && <div className="film-coin-yield" style={{left: (dayX(originalDay) + dayX(maturityDay)) / 2, top: axisY - 30 * unit}}>
        <span>+{extension.addedDays} DAYS</span>
        {on(beat.yield) && <span>YIELD</span>}
      </div>}
    </div>
    {on(beat.pair) && <>
      {/* The pair resolves into one token on 'one USDC'; two tokens after that would contradict the line. */}
      {principal < 1 && token(pairPoses[1].left, pairPoses[1].y, pairSize, 30, undefined, 1 - principal)}
      {token(
        tokenLeft, activeY,
        activeSize, maturityDay, on(beat.date) ? illustrativeDate(maturityDay) : undefined,
      )}
    </>}
    {extending && <div className="film-coin-ghost" style={{
      left: dayX(originalDay) - ghostSize * 82 / 170, top: axisY - 96 * unit - ghostSize, opacity: .6 * dim,
    }}>
      <DatedDollar days={originalDay} isoDate={illustrativeDate(originalDay)} size={ghostSize}/>
    </div>}
    {/* SVG text supplies an exact baseline and keeps every caption to one line. */}
    <svg className="film-coin-caption" width="100%" height="100%">
      <text x={0} y={axisY + 110 * unit} opacity={dim}>{caption}</text>
      {on(beat.final) && finalProgress === 1 && <text className="film-coin-final" x={0} y={axisY + 110 * unit}>
        {on(beat.finalDate) ? 'One dollar. One date.' : 'One dollar.'}
      </text>}
    </svg>
  </section>;
};

const BackingPresentation: React.FC<{at: (name: string) => number; geometry: WindowGeometry}> = ({at, geometry}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const unit = geometry.width / 1920;
  const pane = presentationRect(geometry, 'left', 32 * filmUnitFor(geometry.width, geometry.height));
  const footerTop = geometry.height - geometry.height * (252 / 1080);
  const heading = at('backing-card'), contract = at('contract'), maturity = at('maturity-day');
  const reserve = at('reserve'), role = at('reserve-role');
  const riseFrames = 6 * fps / 30;
  const stampDelay = 3 * fps / 30;
  const rowFrames = (1.4 * fps - stampDelay) / 4;
  const progress = (start: number, duration: number) => interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const rise = (start: number): React.CSSProperties => ({
    opacity: progress(start, riseFrames),
    transform: `translateY(${12 * unit * (1 - progress(start, riseFrames))}px)`,
  });
  const draw = (start: number): React.CSSProperties => ({
    clipPath: `inset(0 ${(1 - progress(start, .4 * fps)) * 100}% 0 0)`,
  });
  // Both columns come from the same UTC date, including across month boundaries.
  const rows = [...[30, 31, 32, 33].map(day => {
    const date = illustrativeDate(day);
    const [year, month, maturityDay] = date.split('-').map(Number);
    return {id: String(Math.floor(Date.UTC(year, month - 1, maturityDay) / 86400000)), date};
  }), {id: '…', date: '…'}];
  return <section className="film-backing" aria-label="Vault token IDs by UTC maturity day"
    style={{top: pane.height * .40, bottom: pane.bottom - footerTop}}>
    <div style={rise(heading)}>
      <div className="film-backing-eyebrow">THE VAULT</div>
      <h2 className="film-backing-heading">ERC-1155</h2>
    </div>
    <div className="film-backing-register" role="table" aria-label="Token ID to maturity date mapping">
      <div className="film-backing-columns" role="row" style={draw(contract)}>
        <span role="columnheader">TOKEN ID</span><span role="columnheader">MATURITY · UTC</span>
      </div>
      {rows.map((row, index) => {
        const start = maturity + index * rowFrames;
        return <div className="film-backing-row" role="row" key={row.id} style={{
          // Finish the downward wipe before stamping the complete date.
          clipPath: `inset(0 0 ${(1 - progress(start, stampDelay)) * 100}% 0)`,
        }}>
          <span className="film-backing-id" role="cell">{row.id}</span>
          <span className="film-backing-date" role="cell" style={{
            // A one-frame stamp, gated at the full three-frame delay.
            visibility: progress(start + stampDelay - 1, 1) === 1 ? 'visible' : 'hidden',
          }}>{row.date}</span>
        </div>;
      })}
    </div>
    <div className="film-backing-rule" style={draw(reserve)}/>
    <div className="film-backing-reserve" style={rise(reserve)}>
      <span className="film-backing-asset">USYC<i className="film-backing-underline" style={draw(role)}/></span>
      <span className="film-backing-role" style={{opacity: progress(role, riseFrames)}}>yield-bearing reserve</span>
    </div>
  </section>;
};

const StressPresentation: React.FC<{at: (name: string) => number; geometry: WindowGeometry}> = ({at, geometry}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const unit = geometry.width / 1920;
  const flash = at('stress-flash'), operations = at('stress-operations');
  const violations = at('zero-violations'), end = at('stress-end');
  const split = operations + .3 * fps;
  const progress = (start: number, duration: number) => interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const on = (start: number) => progress(start - 1, 1) === 1;
  const reveal = (start: number): React.CSSProperties => ({
    ...visibility(on(start)), opacity: progress(start, .2 * fps),
  });
  const hold = 1 - progress(end, .4 * fps);
  return <>
    <div className="film-question-scrim film-example-scrim" aria-hidden="true"
      style={{opacity: progress(flash, .2 * fps) * hold}}/>
    <section className="film-stress" aria-label="Separate adversarial test"
      style={{left: 48 * unit, width: 620 * unit, opacity: hold}}>
      <div className="film-stress-eyebrow" style={reveal(flash)}>SEPARATE ADVERSARIAL TEST</div>
      <div className="film-stress-heading" style={reveal(operations)}>
        <strong className="film-stress-figure">{STRESS_OPERATIONS.toLocaleString('en-US')}</strong>
        <span className="film-stress-label">operations</span>
      </div>
      <div className="film-stress-split" style={visibility(on(split))}>
        <div className="film-stress-bar" role="img" aria-label="7,002 accepted; 2,998 expected rejections" style={{
          clipPath: `inset(0 ${(1 - progress(split, .7 * fps)) * 100}% 0 0)`,
        }}>
          <div className="film-stress-accepted" style={{width: `${STRESS_ACCEPTED / STRESS_OPERATIONS * 100}%`}}/>
          <div className="film-stress-rejected" style={{width: `${STRESS_REJECTED / STRESS_OPERATIONS * 100}%`}}/>
          <i className="film-stress-divider" style={{left: `${STRESS_ACCEPTED / STRESS_OPERATIONS * 100}%`}}/>
        </div>
        <div className="film-stress-split-labels" style={reveal(split)}>
          <span>{STRESS_ACCEPTED.toLocaleString('en-US')} accepted</span>
          <span>{STRESS_REJECTED.toLocaleString('en-US')} expected rejections</span>
        </div>
      </div>
      <p className="film-stress-violations" style={reveal(violations)}><strong>0</strong> invariant violations</p>
    </section>
  </>;
};

const ComposablePresentation: React.FC<{at: (name: string) => number; geometry: WindowGeometry}> = ({at, geometry}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const unit = geometry.width / 1920;
  const pane = presentationRect(geometry, 'left', 32 * filmUnitFor(geometry.width, geometry.height));
  const wordmark = at('wordmark'), closing = at('money-plus-time');
  const plus = at('money-plus'), time = at('money-time');
  const progress = (start: number, duration: number) => interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const on = (start: number) => progress(start - 1, 1) === 1;
  const reveal = (start: number): React.CSSProperties => ({
    ...visibility(on(start)), opacity: progress(start, .2 * fps),
  });
  // Centre the evidence itself; the closing slot never moves or replaces its rows.
  return <section className="film-composable" aria-label="Composable finance" style={{
    left: 16 * unit, width: Math.max(0, pane.width - 16 * unit), top: (pane.height - 344 * unit) / 2,
    '--film-unit': `${unit}px`,
  } as React.CSSProperties}>
    <div className="film-composable-close">
      <section className="overlay-card film-hook-close" style={{
        ...visibility(on(wordmark) && !on(closing)),
        opacity: progress(wordmark, .2 * fps) * (1 - progress(closing - 1, 1)),
      }}><Wordmark/></section>
      <h2 className="film-composable-statement" style={reveal(closing)}>
        <span>Money<span style={reveal(plus)}> plus</span></span>
        <span style={reveal(time)}>time</span>
      </h2>
    </div>
    <ul className="film-composable-register" style={{opacity: 1 - .65 * progress(wordmark, .4 * fps)}}>
      {['Loans', 'Forwards', 'Bonds', 'Derivatives'].map(title => {
        const start = at(`word-${title.toLowerCase()}`);
        return <li className="film-composable-row" key={title} style={visibility(on(start))}>
          <span style={{opacity: progress(start, .2 * fps)}}>{title}</span>
          <i className="film-composable-rule" aria-hidden="true" style={{transform: `scaleX(${progress(start, .35 * fps)})`}}/>
        </li>;
      })}
    </ul>
  </section>;
};

export const ScenePresentation: React.FC<{scene: number; geometry: WindowGeometry; cues: SceneCues}> = ({scene, geometry, cues}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const at = (name: string) => requiredFrame(cues, name, fps);
  const shown: Beat = name => frame >= at(name);
  const unit = geometry.width / 1920;
  if (![2, 3, 4, 5, 6, 7, 8, 9, 10].includes(scene)) return null;
  const inset = scene === 3 || scene === 4 || scene === 9;
  const content = scene === 3 ? <ExamplePresentation at={at} geometry={geometry}/> : scene === 4 ? <QuestionPresentation at={at} geometry={geometry}/> : scene === 5 ? <CascadePresentation at={at} geometry={geometry}/> : scene === 6 ? <TotalsPresentation at={at} geometry={geometry}/>
    : scene === 7 ? <CoinPresentation at={at} geometry={geometry}/>
    : scene === 8 ? <BackingPresentation at={at} geometry={geometry}/> : scene === 9 ? <StressPresentation at={at} geometry={geometry}/> : <ComposablePresentation at={at} geometry={geometry}/>;
  return <AppSurface className={`film-presentation film-presentation-${scene}`}>
    {scene === 2 ? <HookPresentation at={at} geometry={geometry}/>
      : inset ? scene === 3 ? <div className="film-presentation-inset" style={{
        // Reserve the footer and keep both the scrim and copy below the order cards.
        position: 'absolute', left: 0, width: geometry.width, height: 255 * unit,
        bottom: geometry.height * (252 / 1080), overflow: 'hidden',
        '--film-unit': `${unit}px`,
      } as React.CSSProperties}>{content}</div> : scene === 4 ? <div className="film-presentation-inset" style={{
        // MiddleFilm fits the 1080-high source below 65px of browser chrome.
        // Clip the full-height scrim to the globe between the app's 90px topbar
        // and 250px footer, leaving two film units clear of their border pixels.
        position: 'absolute', left: 0, width: geometry.width,
        top: geometry.rect.top + geometry.scale * (65 + 90 * (1080 - 65) / 1080) * unit + 2 * unit,
        bottom: geometry.height - (geometry.rect.top + geometry.scale * (65 + 830 * (1080 - 65) / 1080) * unit) + 2 * unit,
      }}>{content}</div> : <div className="film-presentation-inset" style={{
        // Match scene 3's seat; clip the scrim and copy above the app footer.
        position: 'absolute', left: 0, width: geometry.width, height: 255 * unit,
        bottom: geometry.height * (252 / 1080), overflow: 'hidden',
        '--film-unit': `${unit}px`,
      } as React.CSSProperties}>{content}</div>
      : <PresentationPane side="left" geometry={geometry} verticalAlign={scene === 6 ? 'end' : 'center'}>{content}</PresentationPane>}
  </AppSurface>;
};
