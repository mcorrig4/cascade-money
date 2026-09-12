import type { PlaybackEngine, PlaybackState } from '../playback/engine.ts';
import { activeChecks, curveQuotes, extensionAccrual, latestEvent, rationalDollars } from '../data/overlay-selectors.ts';
import { dollars } from '../data/format.ts';
import { COIN_BEATS, COMPOSABLE_BEATS, beatIndex } from './shots.ts';
import { displayDate } from '../data/types.ts';


export function ShotOverlays({ engine, state, onVerify }: { engine: PlaybackEngine; state: PlaybackState; onVerify?: () => void }) {
  const shot = state.shot; if (!shot || shot < 6) return null;
  const event = latestEvent(engine.index, state.day, state.cursor), seq = event?.seq ?? 0;
  const extension = shot === 6 ? (engine.index.extensions.find(e => e.accounts.some(id => id.toLowerCase().includes('tesla'))) ?? engine.index.extensions[0]) : engine.index.extensions.findLast(e => e.seq <= seq);
  const coinBeat = COIN_BEATS[beatIndex(COIN_BEATS,state.shotElapsed)];
  const progress = Math.min(1, Math.max(0, (state.shotElapsed - 25) / 19));
  const from = Number(extension?.data.effective_from_date ?? extension?.data.from_date ?? 30);
  const to = Number(extension?.data.to_date ?? 90);
  const date = Math.round(from + (to - from) * progress);
  const accrued = extensionAccrual(engine.index, extension, seq);
  const quotes = curveQuotes(engine.index, seq), available = quotes.filter(q => q.price !== null);
  const minimum = Math.min(0.95, ...available.map(q => q.price!)), maximum = Math.max(1, ...available.map(q => q.price!));
  const x = (tenor: number) => 75 + tenor / 180 * 670;
  const y = (price: number) => 255 - (price - minimum) / Math.max(0.01, maximum - minimum) * 200;
  const checks = activeChecks(event), sheet = event?.balanceSheet ?? {};
  const cube = shot === 10 && state.stage === 'cube';
  const appUrl = import.meta.env.VITE_PUBLIC_APP_URL || new URL(import.meta.env.BASE_URL, location.href).href;
  return <div className={`shot-overlay ${cube ? 'cube-overlay' : ''}`} data-testid={`overlay-${shot}`}>
    <div className="globe-dimmer" />
    {shot === 6 && <section className={`overlay-card coin-layout coin-${coinBeat.key}`} aria-label="Dated coin" data-beat={coinBeat.key}>
      <div className="coin-copy" key={coinBeat.key}><span className="eyebrow">A DOLLAR WITH A DATE</span><h2>{coinBeat.title}</h2><p>{coinBeat.text}</p>
        {state.shotElapsed >= 25 && <div className="coin-extension"><div className="date-interval"><span>DAY {from}</span><span className="interval-line"/><span>DAY {to}</span></div><div className="yield-track"><div style={{width:`${progress*100}%`}}/></div><div className="meter-label"><span>{Math.round((to-from)*progress)} added days</span><span>Yield {accrued===null?'—':dollars(accrued)}</span></div></div>}
        {coinBeat.key==='claim' && <div className="claim-rule">Earlier date ≤ bill due date</div>}
      </div>
      <div className="dated-coin"><span>CASCADE</span><strong>$1</strong>{state.shotElapsed>=6&&<><div className="coin-date">{displayDate(date)}</div><small>DAY {date}</small></>}{coinBeat.key==='fungibility'&&<span className="fungible-equals">$1 = $1</span>}</div>
    </section>}
    {shot === 7 && <section className="overlay-card curve-card" aria-label="Yield curve"><span className="eyebrow">THE PRICE OF COMMERCIAL TIME</span><h2>A yield curve.<br />From a payment rail.</h2><div className="curve-label">DOLLARS PAID PER $1 FACE VALUE</div><svg viewBox="0 0 820 310" role="img" aria-label="Dated-dollar prices for 7, 30, 60, 90 and 180 days">
      {[0, 1, 2].map(i => { const price = minimum + (maximum - minimum) * i / 2; return <g key={i}><line x1="65" x2="770" y1={y(price)} y2={y(price)} className="curve-grid" /><text x="0" y={y(price) + 5}>{price.toFixed(3)}</text></g>; })}
      {quotes.map((q, i) => <g key={q.tenor}>{q.price !== null && <><circle cx={x(q.tenor)} cy={y(q.price)} r="5" /><text x={x(q.tenor)} y={y(q.price) - 16} textAnchor="middle">{q.price.toFixed(4)}</text>{i > 0 && quotes[i - 1].price !== null && <line className="curve-line" x1={x(quotes[i - 1].tenor)} y1={y(quotes[i - 1].price!)} x2={x(q.tenor)} y2={y(q.price)} />}</>}<text x={x(q.tenor)} y="298" textAnchor="middle">{q.tenor}d</text></g>)}
    </svg>{!available.length && <p className="curve-empty">Awaiting discount-window trades</p>}<p className="fine-print">Face-weighted executed prices · through {displayDate(state.day, true)}</p></section>}
    {shot === 8 && <section className="overlay-card laws-card" aria-label="Conservation laws"><span className="eyebrow">THREE CONSERVATION LAWS</span><h2>Nothing disappears.<br />Nothing is counted twice.</h2><div className="law"><span>01 / PRINCIPAL</span><strong>Backing ≥ dated units + spot + accrued yield</strong></div><div className="law"><span>02 / YIELD</span><strong>Every dollar of income has exactly one owner.</strong><p>Yield intervals on the same principal never overlap.</p></div><div className="law"><span>03 / LOSS</span><strong>Reserve first. Then the day’s income.</strong><p>Never principal.</p></div></section>}
    {shot === 9 && <section className="overlay-card vault-card" aria-label="Vault balance sheet"><span className="eyebrow">THE VAULT / {displayDate(state.day).toUpperCase()}</span><h2>Every dollar.<br />Accounted for.</h2><div className="vault-columns"><dl>{[['Backing', 'backing_value_cents'], ['Dated units', 'dated_cents'], ['Spot', 'spot_cents'], ['Accrued yield', 'unclaimed_accrued_cents'], ['Reserve', 'reserve_cents'], ['Deficit', 'deficit_cents']].map(([label, field]) => <div key={field}><dt>{label}</dt><dd>{rationalDollars(sheet[field])}</dd></div>)}</dl><div className="invariant-list"><span className="eyebrow">INVARIANTS</span>{checks.hard.map(c => <div key={c.name} className={c.pass ? 'check-pass' : 'check-fail'}><span className="check-light" />{c.name.replaceAll('_', ' ')}</div>)}{!checks.hard.length && <p>Awaiting a vault checkpoint</p>}{checks.breaches.filter(c => c.active).map(c => <div className="check-fail" key={c.name}><span className="check-light" />{c.name.replaceAll('_', ' ')}</div>)}</div></div><p className="fine-print">Claimable yield {rationalDollars(sheet.claimable_cents)} is included in accrued yield.</p></section>}
    {shot === 11 && <section className="overlay-card architecture-card" aria-label="Architecture"><span className="eyebrow">DATED DOLLARS ON ARC</span><h2>Composable.</h2><ol className="composable-items">{COMPOSABLE_BEATS.map((beat,i)=><li key={beat.title} className={state.shotElapsed>=beat.at?'beat-visible':'beat-pending'} aria-hidden={state.shotElapsed<beat.at} data-reveal-at={beat.at}><span>{String(i+1).padStart(2,'0')}</span><div><strong>{beat.title}</strong><p>{beat.detail}</p></div></li>)}</ol><a href={`${import.meta.env.BASE_URL}architecture.svg`} download>Download architecture diagram</a></section>}
    {shot === 12 && <section className="overlay-card close-card" aria-label="Cascade close card"><span className="eyebrow">DATED DOLLARS ON ARC</span><p className="close-phrase">global supply chains. settled.</p><h2 className={state.shotElapsed>=1?'close-wordmark beat-visible':'close-wordmark beat-pending'}>Cascade Money<span>.</span></h2><p>Money with a date.</p><nav aria-label="Cascade links"><button className="onchain-trigger" onClick={onVerify}>Verify on Arc</button><a href="/architecture">Architecture</a><a href={appUrl}>Open the app <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13 13 3M3 3h10v10" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg></a><a href="https://github.com/mcorrig4/cascade-money" target="_blank" rel="noreferrer">Repository <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13 13 3M3 3h10v10" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg></a><a href="https://testnet.arcscan.app/address/0x57838a35f05a43ad519204d7a6ce63f52d7c1987#code" target="_blank" rel="noreferrer">Arc contract <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13 13 3M3 3h10v10" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg></a></nav><div className="close-footer"><span>{import.meta.env.VITE_TEAM || 'Cascade team'}</span><span>Earth imagery: NASA</span></div></section>}
  </div>;
}
