import { displayDate, type Event } from '../data/types.ts';
import { dollars } from '../data/format.ts';
import { SCENE_LOCATIONS, sceneTextAt, proofMaturity } from './shots.ts';
import { cueMs, entrance } from './cues.ts';

export function SceneLabels({ shot, elapsed, cues={}, orders=[], payments=[] }: { payments?:Event[]; orders?:Event[]; shot: number | null; elapsed: number; cues?:Record<string,number> }) {
  if(elapsed<0)return null;
  const location = SCENE_LOCATIONS.find(location => location.shot === shot);
  const cue = sceneTextAt(shot, elapsed,cues);
  // Scene 3 hands the lower third to the obligation card: the order list clears
  // out of its way on the same spoken word the card arrives on ("The PARTS
  // move, the money waits" — see ObligationCard and cues.ts scene 3).
  const ordersAlpha = shot===3
    ? 1 - entrance(elapsed*1000, cueMs({shotElapsed:elapsed,shotDuration:0,cues}, 'parts-move', 18.63, 20.2), 420)
    : 1;
  return <>
    {location && <section className="scene-location" aria-label="Scene location"><strong>{location.name}</strong><span>{location.place}</span></section>}
    {shot===3&&orders.length>0&&ordersAlpha>0&&<section className="scene-orders" aria-label="Apple orders" style={{opacity:ordersAlpha}}>
      {orders.map(order=><div key={order.seq} data-invoice={order.invoiceId}><strong>{order.from} → {order.to}</strong><span>{dollars(order.amount,true)} · Due {proofMaturity(order)===null?'—':displayDate(proofMaturity(order)!)} (day {proofMaturity(order)})</span></div>)}
    </section>}
    {shot===4&&payments.length>0&&<section className="scene-cascade" aria-label="Revealed cascade payments">
      {payments.map(event=><div key={event.seq} data-invoice={event.invoiceId}><span>{event.from} → {event.to}</span><strong>{dollars(event.amount,true)}</strong></div>)}
    </section>}
    {cue && <div className="scene-narration" aria-label="Scene narration" data-cue={cue.id} style={{ opacity: cue.opacity, transform: `translateY(${cue.offset/10}vh)` }}><div>{cue.id==='derivatives'&&<span className="scene-cue-context">THE DERIVATIVES MARKET</span>}<p>{cue.text}</p></div></div>}
  </>;
}
