import { cueMs, revealStyle } from './cues.ts';
import evidence from '../data/onchain.json' with {type:'json'};
import { DatedDollar } from '../components/DatedDollar.ts';
import { datedUnit, extensionAt, sameDateSwapAt } from './dated-dollar.ts';
import { shotOverlayVisible } from './recording.ts';
import type { PlaybackEngine, PlaybackState } from '../playback/engine.ts';
import { activeChecks, latestEvent, rationalDollars } from '../data/overlay-selectors.ts';
import { COIN_BEATS, COMPOSABLE_BEATS, SHOTS, DEFAULT_CASCADE, VERIFIED_YEAR_INVOICES, STRESS_FIGURES } from './shots.ts';
import { displayDate } from '../data/types.ts';
import { dollars } from '../data/format.ts';

export function ShotOverlays({ engine, state, onVerify }: { engine: PlaybackEngine; state: PlaybackState; onVerify?: () => void }) {
 const scene=SHOTS.find(s=>s.id===state.shot);if(!scene||!shotOverlayVisible(state,scene)||['none','title'].includes(scene.overlay))return null;
 const kind=scene.overlay,tMs=state.shotElapsed*1000;
 const at=(name:string,seconds:number)=>cueMs(state,name,seconds,scene.baseSeconds);
 const shown=(name:string,seconds:number)=>tMs>=at(name,seconds);
 const motion=(name:string,seconds:number)=>revealStyle(tMs,at(name,seconds));
 const event=latestEvent(engine.index,state.day,state.cursor),sheet=event?.balanceSheet??{},checks=activeChecks(event);
 const coinNames=['coin','coin-date','same-date','coin-claim','coin-extend','coin-yield','coin-return'];
 const coinIndex=Math.max(0,COIN_BEATS.findLastIndex((b,i)=>shown(coinNames[i],b.at)));
 const coinBeat=COIN_BEATS[coinIndex];
 const extension=extensionAt(tMs,at('coin-extend',15.2),at('coin-yield',21.2));
 // The primitive holds its simulation day at zero while the maturity is extended.
 const unit=datedUnit(extension.maturityDay,state.day);
 const swapping=coinBeat.key==='fungibility';
 const swap=sameDateSwapAt(tMs,at('same-date',6.4),at('coin-claim',8.8));
 const appUrl=import.meta.env.VITE_PUBLIC_APP_URL||new URL(import.meta.env.BASE_URL,location.href).href;
 const showWordmark=kind==='wordmark'&&shown('wordmark',2.5);
 return <div className={`shot-overlay scene-overlay-${kind}`} data-testid={`overlay-${state.shot}`}>
  <div className="globe-dimmer"/>
  {kind==='contradiction'&&<section className="overlay-card contradiction-card" aria-label="Payment dates do not line up" style={motion('rows-in',0)}><span className="eyebrow">EVERYBODY HAS VALUE COMING. EVERYBODY HAS BILLS TO PAY.</span><h2 style={motion('dates-line',0)}>The dates don’t line up.</h2>
   <div className="payment-timeline"><strong>Apple → Samsung</strong><span>$100M receivable</span><div className="promise-track"><i style={{left:'83%'}}/><b style={{left:'83%'}}>PAID LATER</b></div></div>
   <div className="payment-timeline"><strong>Samsung → Corning</strong><span>Glass bill due first</span><div className="promise-track"><i style={{left:'28%'}}/><b style={{left:'28%'}}>DUE EARLIER</b></div></div>
  </section>}
  {kind==='question'&&<section className="overlay-card question-card" aria-label="A future payment moves today" style={motion('question-card',0)}><h2>What if that future payment<br/>could move today?</h2><div className="dated-coin"><span>CASCADE</span><strong>$1</strong>{shown('coin-date',5.2)&&<div className="coin-date date-stamp">{displayDate(115)}</div>}</div></section>}
  {kind==='totals'&&<section className="overlay-card cascade-totals" aria-label="The branched cascade"><div className="cascade-stat" style={motion('committed-counter',0)}><strong>{dollars(DEFAULT_CASCADE.committed,true)}</strong><span>deposited</span></div><div className="cascade-stat" style={motion('settled-counter',2)}><strong>{dollars(DEFAULT_CASCADE.settled,true)}</strong><span>transacted</span></div><div className="cascade-stat" style={motion('companies-counter',4.8)}><strong>{DEFAULT_CASCADE.invoices}</strong><span>invoices settled</span></div><h2 style={motion('tagline',10)}>The payments add up. The backing does not multiply.</h2></section>}
  {kind==='coin'&&<section className={`overlay-card coin-layout coin-${coinBeat.key}`} aria-label="Dated coin" data-beat={coinBeat.key}>
   {swapping?<div className="same-date-stage" data-testid="same-date-swap">{swap.map((pose,i)=><div key={i} className="swap-coin" style={{transform:`translate(calc(-50% + ${pose.x*24}vw), calc(-50% + ${pose.y*18}vh))`}}><DatedDollar {...unit} size={180}/></div>)}</div>:<>
   <div className="coin-copy" style={motion(coinNames[coinIndex],coinBeat.at)}><span className="eyebrow">A DOLLAR WITH A DATE</span><h2>{coinBeat.title}</h2><p>{coinBeat.text}</p>
    {shown('coin-extend',15.2)&&!shown('coin-return',25.2)&&<div className="coin-extension">
     <div className="date-interval"><span>DAY 0</span><span>DAY 30</span><span>DAY 90</span></div>
     <div className="extension-ticks" aria-label={`${extension.addedDays} added days of yield`}>{extension.ticks.map(tick=><i key={tick.day} data-day={tick.day} data-filled={tick.filled} style={{background:tick.filled?'#e8b768':'#233c39'}}/>)}</div>
     <div className="meter-label"><span>{extension.addedDays} added days</span><span>Yield only for the new interval</span></div>
    </div>}
   </div><div className="coin-stage" style={motion('coin',0)}><DatedDollar days={shown('coin-date',4.8)?unit.days:null} isoDate={unit.isoDate} size={180}/>
    {coinBeat.key==='claim'&&<div className="ghost-bill"><span>SUPPLIER BILL</span><strong>$1</strong><span>DAY 90 · PAID AT FACE</span></div>}
   </div></>}
  </section>}
  {kind==='backing'&&<section className="overlay-card backing-card" aria-label="Vault backing" style={motion('backing-card',0)}><span className="eyebrow">UNDERNEATH IT</span><h2>A vault on Arc.</h2><p className="contract-line" style={motion('contract',7)}>The vault is an ERC-1155 contract, with a token id for each UTC maturity day.</p><div className="asset-composition"><b>USDC <small>backing</small></b><span>→</span><b>Arc vault</b><span>←</span><b>USYC <small>designed yield reserve</small></b></div><p>One shared account of who owns what.<br/>And when it becomes cash.</p><button className="onchain-trigger" onClick={onVerify}>Verify on Arc</button></section>}
  {kind==='vault'&&<section className="overlay-card vault-card" aria-label="Vault balance sheet" style={motion('kicker',0)}><span className="eyebrow">MATURITY DAY / {displayDate(state.day).toUpperCase()}</span><h2>{['Extensions','Transfers','Redemptions','Sales'].map((word,i)=><span key={word} style={motion('op-'+word.toLowerCase(),i*1.2)}>{word}. </span>)}</h2><div className="vault-columns"><dl>{[['Backing','backing_value_cents'],['Dated units','dated_cents'],['Spot','spot_cents'],['Accrued yield','unclaimed_accrued_cents'],['Reserve','reserve_cents'],['Deficit','deficit_cents']].map(([label,field])=><div key={field}><dt>{label}</dt><dd>{rationalDollars(sheet[field])}</dd></div>)}</dl><div className="invariant-list"><span className="eyebrow">INVARIANTS</span>{checks.hard.map(c=><div key={c.name} className={c.pass?'check-pass':'check-fail'}><span className="check-light"/>{c.name.replaceAll('_',' ')}</div>)}{!checks.hard.length&&<p>Awaiting a vault checkpoint</p>}</div></div></section>}
  {kind==='laws'&&<section className="overlay-card laws-card" aria-label="Conservation laws"><span className="eyebrow">THE RULES SURVIVE</span><h2>Nothing counted twice.</h2><div className="law" style={motion('law-ownership',0)}><span>01 / INCOME</span><strong>Every dollar of income has exactly one owner.</strong></div><div className="law" style={motion('law-yield',0)}><span>02 / TIME</span><strong>No overlapping yield claims.</strong><p>On the same principal.</p></div><div className="law"><span>03 / OPERATIONS</span><strong>{STRESS_FIGURES.operations.toLocaleString('en-US')} operations. {STRESS_FIGURES.violations} violations.</strong><p>{VERIFIED_YEAR_INVOICES.toLocaleString('en-US')} invoices in the year.</p></div></section>}
  {kind==='composable'&&!shown('money-plus-time',12.2)&&<section className="overlay-card architecture-card" aria-label="Composable finance"><span className="eyebrow">MONEY WITH A DATE</span><h2>Composable.</h2><ol className="composable-items">{COMPOSABLE_BEATS.map((beat,i)=><li key={beat.title} className={shown('word-'+beat.title.toLowerCase(),beat.at)?'beat-visible':'beat-pending'} aria-hidden={!shown('word-'+beat.title.toLowerCase(),beat.at)} style={motion('word-'+beat.title.toLowerCase(),beat.at)} data-reveal-at={beat.at}><span>{String(i+1).padStart(2,'0')}</span><div><strong>{beat.title}</strong></div></li>)}</ol></section>}
  {showWordmark&&<section className="overlay-card close-card" aria-label="Cascade close card"><h2 className="close-wordmark beat-visible" style={motion('wordmark',2.5)}><svg className="wordmark-icon" viewBox="0 0 36 36" aria-hidden="true"><path d="M5 8h26M5 18h19M5 28h12" stroke="currentColor" strokeWidth="4"/></svg>Cascade Money</h2><p>money with a date.</p><nav aria-label="Cascade links"><button className="onchain-trigger" onClick={onVerify}>Verify on Arc</button><a href="/architecture">Architecture</a><a href={appUrl}>Open the app</a><a href="https://github.com/mcorrig4/cascade-money" target="_blank" rel="noreferrer">Repository</a><a href={evidence.sourceUrl} target="_blank" rel="noreferrer">Arc contract</a></nav><div className="close-footer"><span>{import.meta.env.VITE_TEAM||'Cascade team'}</span><span>Earth imagery: NASA</span></div></section>}
 </div>;
}
