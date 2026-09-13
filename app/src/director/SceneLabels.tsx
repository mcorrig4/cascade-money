import { displayDate, type Event } from '../data/types.ts';
import { dollars } from '../data/format.ts';
import { SCENE_LOCATIONS, sceneTextAt, proofMaturity } from './shots.ts';

export function SceneLabels({ shot, elapsed, cues={}, orders=[], payments=[] }: { payments?:Event[]; orders?:Event[]; shot: number | null; elapsed: number; cues?:Record<string,number> }) {
  const location = SCENE_LOCATIONS.find(location => location.shot === shot);
  const cue = sceneTextAt(shot, elapsed,cues);
  return <>
    {location && <section className="scene-location" aria-label="Scene location"><strong>{location.name}</strong><span>{location.place}</span></section>}
    {shot===3&&orders.length>0&&<section className="scene-orders" aria-label="Apple orders">
      {orders.map(order=><div key={order.seq} data-invoice={order.invoiceId}><strong>Apple → {order.to}</strong><span>{dollars(order.amount,true)} · Due {proofMaturity(order)===null?'—':displayDate(proofMaturity(order)!)} (day {proofMaturity(order)})</span></div>)}
    </section>}
    {shot===4&&payments.length>0&&<section className="scene-cascade" aria-label="Revealed cascade payments">
      {payments.map(event=><div key={event.seq} data-invoice={event.invoiceId}><span>{event.from} → {event.to}</span><strong>{dollars(event.amount,true)}</strong></div>)}
    </section>}
    {cue && <div className="scene-narration" aria-label="Scene narration" data-cue={cue.id} style={{ opacity: cue.opacity, transform: `translateY(${cue.offset/10}vh)` }}><div>{cue.id==='derivatives'&&<span className="scene-cue-context">THE DERIVATIVES MARKET</span>}<p>{cue.text}</p></div></div>}
  </>;
}
