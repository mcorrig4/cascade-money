import { dateForDay } from './types.ts';
import type { Event, Firm, Invoice, JsonRecord, DaySummary } from './types.ts';

export function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}
export function money(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  throw new Error(`Expected integer cents, received ${String(value)}`);
}
export function parseLine(line: string): JsonRecord {
  // Modern Chromium and Node preserve the original token in reviver context.
  // Never accept an already-rounded monetary integer on an older engine.
  return JSON.parse(line, ((_key: string, value: unknown, context?: { source: string }) => {
    if (typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value)) {
      if (!context?.source || !/^-?\d+$/.test(context.source)) throw new Error('Browser cannot preserve integer precision');
      return BigInt(context.source);
    }
    return value;
  }) as Parameters<typeof JSON.parse>[1]);
}
const text = (value: unknown) => value == null ? undefined : String(value);
const locations: Record<string, [number, number, string, string]> = {
  Apple: [37.3349, -122.009, 'Cupertino', 'United States'],
  Foxconn: [25.078, 121.459, 'New Taipei', 'Taiwan'],
  TSMC: [24.781, 121.006, 'Hsinchu', 'Taiwan'],
  Corning: [42.1429, -77.0547, 'Corning', 'United States'],
  'Clearview Glass': [41.4993, -81.6944, 'Cleveland', 'United States'],
};
const named = new Set(['Apple', 'Tesla', 'Foxconn', 'TSMC', 'Samsung', 'Samsung Display', 'Corning', 'Sony', 'LG', 'Pegatron', 'Luxshare', 'Murata', 'Qualcomm', 'Broadcom', 'SK Hynix', 'Panasonic', 'CATL', 'LG Energy', 'LG Energy Solution', 'Glencore', 'Exxon', 'Shell', 'Dow', 'BASF', 'Sumco', 'SUMCO', 'Wacker', 'WACKER', 'Clearview Glass']);
export function adaptFirm(raw: unknown, schema: 1 | 2): Firm {
  const v = record(raw), id = String(v.id), name = text(v.name) ?? id;
  const fallback = schema === 1 ? locations[id] : undefined;
  const lat = typeof v.lat === 'number' ? v.lat : fallback?.[0];
  const lng = typeof v.lon === 'number' ? v.lon : fallback?.[1];
  const located = lat !== undefined && lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  return { id, name, role: String(v.role ?? 'supplier'), named: v.named === true || named.has(name) || v.role === 'anchor',
    lat: located ? lat : undefined, lng: located ? lng : undefined,
    city: text(v.city) ?? fallback?.[2], country: text(v.country) ?? fallback?.[3], region: text(v.region),
    sites: (Array.isArray(v.sites) ? v.sites : []).map(rawSite => {
      const site = record(rawSite);
      return { id: String(site.site_id), lat: Number(site.lat), lng: Number(site.lon), city: text(site.city), country: text(site.country) };
    }).filter(site => Number.isFinite(site.lat) && Math.abs(site.lat) <= 90 && Number.isFinite(site.lng) && Math.abs(site.lng) <= 180) };
}
export function adaptInvoice(raw: unknown): Invoice {
  const v = record(raw);
  return { id: String(v.invoice_id), debtor: String(v.debtor), creditor: String(v.creditor), amount: money(v.amount_cents),
    item: text(v.item), quantity: text(v.quantity), unit: text(v.unit), deliverTo: text(v.deliver_to), annotation: text(v.annotation) };
}
export function adaptEvent(v: JsonRecord): Event {
  if (v.schema_version !== 1 && v.schema_version !== 2) throw new Error(`Unsupported schema version ${v.schema_version}`);
  if (!Number.isSafeInteger(v.seq) || !Number.isSafeInteger(v.day) || Number(v.day) < 0) throw new Error('Invalid sequence or day');
  const data = record(v.data), checks = record(v.checks), type = String(v.type);
  const date = text(v.iso_date ?? v.date) ?? dateForDay(Number(v.day));
  if (date !== dateForDay(Number(v.day))) throw new Error(`Date/day mismatch at sequence ${v.seq}`);
  return { schema: v.schema_version, seq: Number(v.seq), type, day: Number(v.day), date, amount: money(v.amount_cents ?? 0),
    accounts: Array.isArray(v.accounts) ? v.accounts.map(String) : [], data, balanceSheet: record(v.balance_sheet),
    checks: { hard: record(checks.hard) as Record<string, boolean>, breaches: record(checks.breaches) as Record<string, boolean> },
    invoiceId: text(data.invoice_id), from: text(data.debtor ?? data.sender ?? data.seller), to: text(data.creditor ?? data.recipient ?? data.buyer),
    cutoff: { day: Number(record(v.index).day ?? 0), value: String(record(v.index).value ?? '1/1') } };
}
export function adaptSummary(e: Event): DaySummary | undefined {
  // Published v2 distinguishes daily Issue deposits from committed-to-date.
  // Keep the earlier explicit-cents aliases readable, but never treat a count as cents.
  const d = e.data;
  const purchases = record(d.new_invoices).cents ?? d.new_invoice_cents ?? d.new_invoices_cents ?? d.new_purchases_cents;
  const settled = record(d.invoices_settled).cents ?? d.settled_invoice_cents ?? d.settled_invoices_cents ?? d.invoice_settled_cents;
  if (purchases == null || settled == null) return undefined;
  return { day: e.day, purchases: money(purchases), settled: money(settled),
    committed: d.principal_committed_to_date_cents != null ? money(d.principal_committed_to_date_cents) : d.new_invoices == null && d.principal_committed_cents != null ? money(d.principal_committed_cents) : undefined,
    dailyCommitted: d.new_invoices != null && d.principal_committed_cents != null ? money(d.principal_committed_cents) : undefined,
    grossSettled: d.gross_settled_to_date_cents != null ? money(d.gross_settled_to_date_cents) : d.gross_invoice_settled_cents != null || d.gross_settled_cents != null ? money(d.gross_invoice_settled_cents ?? d.gross_settled_cents) : undefined,
    ratio: text(d.settled_to_committed ?? d.settled_to_committed_ratio ?? d.reuse_multiple), extensions: d.extensions, sells: d.sells, withdrawals: d.withdrawals,
    balanceSheet: Object.keys(record(d.balance_sheet)).length ? record(d.balance_sheet) : e.balanceSheet };
}
