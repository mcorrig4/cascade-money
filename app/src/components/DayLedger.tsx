import { useRef, useState, useEffect } from 'react';
import { dollars } from '../data/format.ts';
import { displayDate } from '../data/types.ts';
import type { Event, EventIndex } from '../data/types.ts';
const labels: Record<string, string> = {
  issue: 'Committed & settled', pay: 'Invoice settled', transfer: 'Transfer', invoice_registered: 'New purchase',
  extend: 'Maturity extended', sell: 'Sold for spot', withdraw: 'Withdrawal', claim: 'Yield claimed', operation_rejected: 'Not executed',
};
function LedgerRow({ event, index }: { event: Event; index: EventIndex }) {
  const invoice = index.invoices.get(event.invoiceId ?? String((event.data.invoice as { invoice_id?: string } | undefined)?.invoice_id ?? ''));
  const from = event.from ?? invoice?.debtor ?? event.accounts[0], to = event.to ?? invoice?.creditor ?? event.accounts[1];
  const name = (id?: string) => index.firms.get(id ?? '')?.name ?? id ?? 'Vault';
  const detail = invoice?.annotation ?? [invoice?.quantity, invoice?.unit, invoice?.item, invoice?.deliverTo ? `→ ${invoice.deliverTo}` : undefined].filter(Boolean).join(' ');
  return <article className={`ledger-row ${event.type}`} data-seq={event.seq}>
    <div className="ledger-row-top"><span className="operation-dot" /><span>{labels[event.type] ?? event.type.replaceAll('_', ' ')}</span><span className="sequence">{String(event.seq).padStart(3, '0')}</span></div>
    <div className="ledger-parties"><span title={name(from)}>{name(from)}</span><span className="arrow">→</span><span title={name(to)}>{name(to)}</span></div>
    <div className="ledger-bottom"><strong>{dollars(event.amount, true)}</strong><span>{invoice?.item && !detail ? invoice.item : event.type === 'issue' && typeof event.data.mint_date === 'number' ? `Dated ${displayDate(event.data.mint_date, true)}` : ''}</span></div>
    {detail && <p className="ledger-annotation" title={detail}>{detail}</p>}
  </article>;
}
export function DayLedger({ index, day, cursor }: { index: EventIndex; day: number; cursor: number }) {
  const [scroll, setScroll] = useState(0), host = useRef<HTMLDivElement>(null);
  const events = index.days[day].events.slice(0, cursor).filter(e => !['run_started', 'run_completed', 'story', 'day_summary', 'checkpoint'].includes(e.type)).reverse();
  useEffect(() => { if (host.current) host.current.scrollTop = 0; setScroll(0); }, [day]);
  const rowHeight = 160, start = Math.max(0, Math.floor(scroll / rowHeight) - 2), visible = events.slice(start, start + 12);
  return <aside className="ledger" aria-label="Current day transaction ledger">
    <div className="ledger-heading"><div><span className="eyebrow">TRANSACTIONS</span><h2>{displayDate(day, true)}</h2></div><span className="count">{events.length.toLocaleString('en-US')}</span></div>
    <div className="ledger-columns"><span>PAYMENT FLOW</span><span>USD</span></div>
    <div className="ledger-scroll" ref={host} onScroll={e => setScroll(e.currentTarget.scrollTop)}>
      {events.length ? <div style={{ height: events.length * rowHeight, position: 'relative' }}><div style={{ position: 'absolute', top: start * rowHeight, width: '100%' }}>{visible.map(e => <LedgerRow key={e.seq} event={e} index={index} />)}</div></div> : <div className="ledger-empty"><span className="empty-line" />No transactions this day</div>}
    </div>
    <div className="ledger-foot"><span className="status-dot" />Every payment, in sequence</div>
  </aside>;
}
