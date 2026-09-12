import { useMemo } from 'react';
import type { PlaybackEngine, PlaybackState } from '../playback/engine.ts';
import { activeChecks, latestEvent, rationalDollars } from '../data/overlay-selectors.ts';
import { COIN_BEATS, COMPOSABLE_BEATS, SHOTS, beatIndex, narrationTime, DEFAULT_CASCADE, VERIFIED_YEAR_INVOICES, STRESS_FIGURES } from './shots.ts';
import { displayDate } from '../data/types.ts';
import { dollars } from '../data/format.ts';

function PromiseGraph({engine}:{engine:PlaybackEngine}) {
 const graph=useMemo(()=>{
  const firms=[...engine.index.firms.values()], ids=new Map(firms.map((f,i)=>[f.id,i]));
  const point=(id:string)=>{const i=ids.get(id)??0,firm=firms[i];return {
   x:firm?.lng==null?50+(i*97)%900:50+(firm.lng+180)/360*900,
   y:firm?.lat==null?30+(i*47)%340:30+(90-firm.lat)/180*340};};
  const links=new Map<string,{from:string;to:string;count:number}>();
  for(const e of engine.index.payments)if(e.from&&e.to){
   const key=e.from+'→'+e.to,link=links.get(key);
   if(link)link.count++;else links.set(key,{from:e.from,to:e.to,count:1});
  }
  return {point,links:[...links.values()].sort((a,b)=>b.count-a.count).slice(0,1200)};
 },[engine.index]);
 return <svg className="promise-graph" viewBox="0 0 1000 400" role="img" aria-label="The year's payment connections">
  {graph.links.map(link=>{const a=graph.point(link.from),b=graph.point(link.to);return <g key={link.from+'→'+link.to}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y}/><circle cx={b.x} cy={b.y} r="2"/></g>;})}
 </svg>;
}
export function ShotOverlays({ engine, state, onVerify }: { engine: PlaybackEngine; state: PlaybackState; onVerify?: () => void }) {
 const scene=SHOTS.find(s=>s.id===state.shot);if(!scene||['none','title'].includes(scene.overlay))return null;
 const t=narrationTime(state),kind=scene.overlay;
 const event=latestEvent(engine.index,state.day,state.cursor),sheet=event?.balanceSheet??{},checks=activeChecks(event);
 const coinBeat=COIN_BEATS[beatIndex(COIN_BEATS,t)],progress=Math.min(1,Math.max(0,(t-15.2)/8.8)),date=Math.round(30+60*progress);
 const appUrl=import.meta.env.VITE_PUBLIC_APP_URL||new URL(import.meta.env.BASE_URL,location.href).href;
 const showWordmark=kind==='wordmark'&&t>=2.5;
 return <div className={`shot-overlay scene-overlay-${kind}`} data-testid={`overlay-${state.shot}`}>
  <div className="globe-dimmer"/>
  {kind==='contradiction'&&<section className="overlay-card contradiction-card" aria-label="Payment dates do not line up"><span className="eyebrow">EVERYBODY HAS VALUE COMING. EVERYBODY HAS BILLS TO PAY.</span><h2>The dates don’t line up.</h2>
   <div className="payment-timeline"><strong>Apple → Samsung</strong><span>$100M receivable</span><div className="promise-track"><i style={{left:'83%'}}/><b style={{left:'83%'}}>PAID LATER</b></div></div>
   <div className="payment-timeline"><strong>Samsung → Corning</strong><span>Glass bill due first</span><div className="promise-track"><i style={{left:'28%'}}/><b style={{left:'28%'}}>DUE EARLIER</b></div></div>
  </section>}
  {kind==='question'&&<section className="overlay-card question-card" aria-label="A future payment moves today"><h2>What if that future payment<br/>could move today?</h2><div className="dated-coin"><span>CASCADE</span><strong>$1</strong>{t>=5.2&&<div className="coin-date date-stamp">{displayDate(115)}</div>}</div></section>}
  {kind==='totals'&&<section className="overlay-card cascade-totals" aria-label="The straight-line cascade"><div className="cascade-stat"><strong>{dollars(DEFAULT_CASCADE.committed,true)}</strong><span>committed</span></div><div className="cascade-stat" style={{opacity:t>=2?1:0}}><strong>{dollars(DEFAULT_CASCADE.settled,true)}</strong><span>obligations settled</span></div><div className="cascade-stat" style={{opacity:t>=4.8?1:0}}><strong>{DEFAULT_CASCADE.companies}</strong><span>companies paid</span></div><h2 style={{opacity:t>=10?1:0}}>That’s the cascade.</h2></section>}
  {kind==='coin'&&<section className={`overlay-card coin-layout coin-${coinBeat.key}`} aria-label="Dated coin" data-beat={coinBeat.key}>
   <div className="coin-copy" key={coinBeat.key}><span className="eyebrow">A DOLLAR WITH A DATE</span><h2>{coinBeat.title}</h2><p>{coinBeat.text}</p>
    {t>=15.2&&t<25.2&&<div className="coin-extension"><div className="date-interval"><span>DAY 30</span><span className="interval-line"/><span>DAY 90</span></div><div className="yield-track"><div style={{width:`${progress*100}%`}}/></div><div className="meter-label"><span>{Math.round(60*progress)} added days</span><span>Yield for this interval</span></div></div>}
   </div><div className="coin-stage"><div className="dated-coin"><span>CASCADE</span><strong>$1</strong>{t>=4.8&&<><div className="coin-date">{displayDate(date)}</div><small>DAY {date}</small></>}</div>
    {coinBeat.key==='fungibility'&&<div className="dated-coin twin-coin"><strong>$1</strong><div className="coin-date">{displayDate(date)}</div><span>Same date</span></div>}
    {coinBeat.key==='claim'&&<div className="ghost-bill"><span>SUPPLIER BILL</span><strong>$1</strong><span>DAY 90 · PAID AT FACE</span></div>}
   </div>
  </section>}
  {kind==='backing'&&<section className="overlay-card backing-card" aria-label="Vault backing"><span className="eyebrow">UNDERNEATH IT</span><h2>A vault on Arc.</h2><div className="asset-composition"><b>USDC <small>backing</small></b><span>→</span><b>Arc vault</b><span>←</span><b>USYC <small>designed yield reserve</small></b></div><p>One shared account of who owns what.<br/>And when it becomes cash.</p><button className="onchain-trigger" onClick={onVerify}>Verify on Arc</button></section>}
  {kind==='vault'&&<section className="overlay-card vault-card" aria-label="Vault balance sheet"><span className="eyebrow">MATURITY DAY / {displayDate(state.day).toUpperCase()}</span><h2>Extensions. Transfers. Redemptions. Sales.</h2><div className="vault-columns"><dl>{[['Backing','backing_value_cents'],['Dated units','dated_cents'],['Spot','spot_cents'],['Accrued yield','unclaimed_accrued_cents'],['Reserve','reserve_cents'],['Deficit','deficit_cents']].map(([label,field])=><div key={field}><dt>{label}</dt><dd>{rationalDollars(sheet[field])}</dd></div>)}</dl><div className="invariant-list"><span className="eyebrow">INVARIANTS</span>{checks.hard.map(c=><div key={c.name} className={c.pass?'check-pass':'check-fail'}><span className="check-light"/>{c.name.replaceAll('_',' ')}</div>)}{!checks.hard.length&&<p>Awaiting a vault checkpoint</p>}</div></div></section>}
  {kind==='laws'&&<section className="overlay-card laws-card" aria-label="Conservation laws"><span className="eyebrow">THE RULES SURVIVE</span><h2>Nothing counted twice.</h2><div className="law"><span>01 / INCOME</span><strong>Every dollar of income has exactly one owner.</strong></div><div className="law"><span>02 / TIME</span><strong>No overlapping yield claims.</strong><p>On the same principal.</p></div><div className="law"><span>03 / OPERATIONS</span><strong>{STRESS_FIGURES.operations.toLocaleString('en-US')} operations. {STRESS_FIGURES.violations} violations.</strong><p>{VERIFIED_YEAR_INVOICES.toLocaleString('en-US')} invoices in the year.</p></div></section>}
  {kind==='composable'&&t<12.2&&<section className="overlay-card architecture-card" aria-label="Composable finance"><span className="eyebrow">MONEY WITH A DATE</span><h2>Composable.</h2><ol className="composable-items">{COMPOSABLE_BEATS.map((beat,i)=><li key={beat.title} className={t>=beat.at?'beat-visible':'beat-pending'} aria-hidden={t<beat.at} data-reveal-at={beat.at}><span>{String(i+1).padStart(2,'0')}</span><div><strong>{beat.title}</strong></div></li>)}</ol></section>}
  {kind==='promises'&&<section className="overlay-card promises-card" aria-label="Chain of promises" style={{opacity:Math.min(1,t/1.5)}}><PromiseGraph engine={engine}/><h2>{t>=7.2?'Before the cash does.':'An invisible chain of promises.'}</h2></section>}
  {showWordmark&&<section className="overlay-card close-card" aria-label="Cascade close card"><h2 className="close-wordmark beat-visible"><svg className="wordmark-icon" viewBox="0 0 36 36" aria-hidden="true"><path d="M5 8h26M5 18h19M5 28h12" stroke="currentColor" strokeWidth="4"/></svg>Cascade Money</h2><p>money with a date.</p><nav aria-label="Cascade links"><button className="onchain-trigger" onClick={onVerify}>Verify on Arc</button><a href="/architecture">Architecture</a><a href={appUrl}>Open the app</a><a href="https://github.com/mcorrig4/cascade-money" target="_blank" rel="noreferrer">Repository</a><a href="https://testnet.arcscan.app/address/0x57838a35f05a43ad519204d7a6ce63f52d7c1987#code" target="_blank" rel="noreferrer">Arc contract</a></nav><div className="close-footer"><span>{import.meta.env.VITE_TEAM||'Cascade team'}</span><span>Earth imagery: NASA</span></div></section>}
 </div>;
}
