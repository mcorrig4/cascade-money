import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { dollars } from '../data/format.ts';
import { displayDate } from '../data/types.ts';
import type { Event, EventIndex } from '../data/types.ts';
import { ledgerMode, logDuration, ledgerRowHeight, inspectionSnapshot } from './ledger-mode.ts';
const labels: Record<string, string> = {
  issue: 'Committed & settled', pay: 'Invoice settled', transfer: 'Transfer', invoice_registered: 'New purchase',
  extend: 'Maturity extended', sell: 'Sold for spot', withdraw: 'Withdrawal', claim: 'Yield claimed', operation_rejected: 'Not executed',
};
function LedgerRow({ event, index, compact, inspect }: { event: Event; index: EventIndex; compact:boolean; inspect:()=>void }) {
  const invoice = index.invoices.get(event.invoiceId ?? String((event.data.invoice as { invoice_id?: string } | undefined)?.invoice_id ?? ''));
  const from = event.from ?? invoice?.debtor ?? event.accounts[0], to = event.to ?? invoice?.creditor ?? event.accounts[1];
  const name = (id?: string) => index.firms.get(id ?? '')?.name ?? id ?? 'Vault';
  const detail = invoice?.annotation ?? [invoice?.quantity, invoice?.unit, invoice?.item, invoice?.deliverTo ? `→ ${invoice.deliverTo}` : undefined].filter(Boolean).join(' ');
  const maturity=event.data.to_date ?? event.data.mint_date ?? event.data.accepted_maturity ?? event.dates?.at(-1);
  const unit=typeof maturity==='number'?displayDate(maturity,true):'—';
  return <article tabIndex={0} onClick={inspect} onFocus={inspect} className={`ledger-row ${event.type}`} data-seq={event.seq}>
    {compact ? <div className="ledger-log-line"><time dateTime={event.date} title={`Event ${event.seq}`}>{event.date.slice(5)}</time><span className="log-parties" title={`${name(from)} → ${name(to)}`}>{name(from)} → {name(to)}</span><strong>{dollars(event.amount || invoice?.amount || 0n,true)}</strong><span className="log-unit">{unit}</span></div> : <><div className="ledger-row-top"><span className="operation-dot" /><span>{labels[event.type] ?? event.type.replaceAll('_', ' ')}</span><span className="sequence">{String(event.seq).padStart(3, '0')}</span></div>
    <div className="ledger-parties"><span title={name(from)}>{name(from)}</span><span className="arrow">→</span><span title={name(to)}>{name(to)}</span></div>
    <div className="ledger-bottom"><strong>{dollars(event.amount, true)}</strong><span>{invoice?.item && !detail ? invoice.item : event.type === 'issue' && typeof event.data.mint_date === 'number' ? `Dated ${displayDate(event.data.mint_date, true)}` : ''}</span></div>
    {detail && <p className="ledger-annotation" title={detail}>{detail}</p>}</> }
  </article>;
}
export function DayLedger({ index, day, cursor, running=false, rate=1 }: { index: EventIndex; day: number; cursor: number; running?:boolean; rate?:number }) {
  const [scroll, setScroll] = useState(0), host = useRef<HTMLDivElement>(null);
  const [inspection,setInspection]=useState<ReturnType<typeof inspectionSnapshot<Event>> | null>(null);
  const panel=useRef<HTMLElement>(null);
  const latched=useRef(false), pendingScroll=useRef<number | null>(null);
  const inspecting=inspection!==null;
  const mode=ledgerMode(running,inspecting), compact=mode==='compact';
  const liveEvents = index.days[day].events.slice(0, cursor).filter(e => !['run_started', 'run_completed', 'story', 'day_summary', 'checkpoint', 'day_opened', 'scenario_result'].includes(e.type)).reverse();
  const events=inspection?.events ?? liveEvents, displayedDay=inspection?.day ?? day;
  const inspect=(seq?:number)=>{
    if(latched.current || !events.length)return;
    latched.current=true;
    const snapshot=inspectionSnapshot(day,events,seq);
    pendingScroll.current=snapshot.selectedIndex*ledgerRowHeight('expanded');
    setInspection(snapshot);
  };
  const resume=()=>{latched.current=false;setInspection(null);pendingScroll.current=0;};
  useEffect(()=>{
    // Native capture observes the final pointer position even when React's
    // delegated row enter/leave sequence changes during the layout switch.
    const outside=(event:PointerEvent)=>{
      if(!latched.current || !['mouse','pen'].includes(event.pointerType))return;
      const bounds=panel.current?.getBoundingClientRect();
      if(bounds && (event.clientX<bounds.left || event.clientX>=bounds.right || event.clientY<bounds.top || event.clientY>=bounds.bottom))resume();
    };
    document.addEventListener('pointermove',outside,true);
    document.addEventListener('pointerout',outside,true);
    return ()=>{document.removeEventListener('pointermove',outside,true);document.removeEventListener('pointerout',outside,true);};
  },[]);
  const inspectPointer=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(event.type!=='pointerdown' && event.pointerType!=='mouse' && event.pointerType!=='pen')return;
    const bounds=event.currentTarget.getBoundingClientRect();
    if(event.clientX<bounds.left || event.clientX>=bounds.right || event.clientY<bounds.top || event.clientY>=bounds.bottom)return;
    const row=(event.target as Element).closest<HTMLElement>('[data-seq]');
    // The scroll host survives every row replacement. Entering its live area
    // latches immediately, including gaps left by an insertion animation.
    const offset=Math.max(0,Math.floor(((event.clientY-event.currentTarget.getBoundingClientRect().top)+event.currentTarget.scrollTop)/ledgerRowHeight(mode)));
    inspect(row?Number(row.dataset.seq):events[offset]?.seq);
  };
  useLayoutEffect(()=>{
    if(!host.current)return;
    if(pendingScroll.current!==null){host.current.scrollTop=pendingScroll.current;setScroll(host.current.scrollTop);pendingScroll.current=null;}
    else if(!inspection){host.current.scrollTop=0;setScroll(0);}
    if(inspection)host.current.firstElementChild?.getAnimations().forEach(a=>a.cancel());
  },[inspection,displayedDay]);
  useLayoutEffect(()=>{
    if(!compact||!host.current)return;
    host.current.scrollTop=0; setScroll(0);
    const rows=host.current.firstElementChild;
    if(rows) { rows.getAnimations().forEach(a=>a.cancel()); rows.animate([{transform:'translateY(-10px)'},{transform:'translateY(0)'}],{duration:logDuration(rate),easing:'ease-out'}); }
  },[day,cursor,compact,rate]);
  const rowHeight = ledgerRowHeight(mode), start = Math.max(0, Math.floor(scroll / rowHeight) - 2), visible = events.slice(start, start + (compact?28:12));
  return <aside ref={panel} id="daily-ledger" className={`ledger ledger-${mode} ${inspecting?'ledger-inspecting':''}`} data-mode={mode} onPointerLeave={e=>{if(e.pointerType==='mouse'||e.pointerType==='pen')resume();}} aria-label="Current day transaction ledger">
    <div className="ledger-heading"><div><span className="eyebrow">TRANSACTIONS</span><h2>{displayDate(displayedDay, true)}</h2></div><span className="count">{events.length.toLocaleString('en-US')}</span></div>
    <div className="ledger-columns"><span>{compact?'DAY · PAYMENT FLOW · USD · DATED UNIT':'PAYMENT FLOW'}</span>{inspecting&&<button onClick={resume}>Resume log</button>}</div>
    <div className="ledger-scroll" ref={host} onPointerEnter={inspectPointer} onPointerMoveCapture={inspectPointer} onPointerDownCapture={inspectPointer} onScroll={e => setScroll(e.currentTarget.scrollTop)}>
      {events.length ? <div style={{ height: events.length * rowHeight, position: 'relative' }}><div style={{ position: 'absolute', top: start * rowHeight, width: '100%' }}>{visible.map(e => <LedgerRow key={e.seq} event={e} index={index} compact={compact} inspect={()=>inspect(e.seq)} />)}</div></div> : <div className="ledger-empty"><span className="empty-line" />No transactions this day</div>}
    </div>
    <div className="ledger-foot"><span className="status-dot" />{inspecting?(running?'Inspecting · playback continues':'Inspecting · playback paused'):'Every payment, in sequence'}</div>
  </aside>;
}
