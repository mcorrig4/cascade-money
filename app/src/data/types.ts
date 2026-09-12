export type Money = bigint;
export type JsonRecord = Record<string, unknown>;
export interface Site { id: string; lat: number; lng: number; city?: string; country?: string }
export interface Firm {
  id: string; name: string; role: string; named: boolean;
  lat?: number; lng?: number; city?: string; country?: string; region?: string;
  sites?: Site[];
}
export interface Invoice {
  id: string; debtor: string; creditor: string; amount: Money;
  item?: string; quantity?: string; unit?: string; deliverTo?: string; annotation?: string;
}
export interface Event {
  schema: 1 | 2; seq: number; type: string; day: number; date: string;
  amount: Money; accounts: string[]; data: JsonRecord;
  balanceSheet: JsonRecord; checks: { hard: Record<string, boolean>; breaches: Record<string, boolean> };
  invoiceId?: string; from?: string; to?: string;
  cutoff: { day: number; value: string };
}
export interface Totals { settled: Money; committed: Money }
export interface DaySummary {
  day: number; purchases: Money; settled: Money; committed?: Money; dailyCommitted?: Money; grossSettled?: Money;
  ratio?: string; extensions?: unknown; sells?: unknown; withdrawals?: unknown;
  balanceSheet: JsonRecord;
}
export interface DayBucket {
  events: Event[]; start: Totals; end: Totals; prefix: Totals[];
  purchases: Money; settled: Money; summary?: DaySummary; lastState?: Event;
}
export interface StoryMarker { storyId: string; beat: string; caption?: string; event: Event; cameraAccounts: string[]; payment?: Event }
export interface EventIndex {
  schema: 1 | 2; firms: Map<string, Firm>; invoices: Map<string, Invoice>;
  days: DayBucket[]; stories: StoryMarker[]; eventCount: number; warnings: string[];
  payments: Event[]; extensions: Event[]; trades: Event[]; checkpoints: Event[];
}
export const DAYS = 365;
export const START = Date.UTC(2025, 8, 9);
export const dateForDay = (day: number) => new Date(START + day * 86_400_000).toISOString().slice(0, 10);
export const displayDate = (day: number, short = false) => new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC', month: short ? 'short' : 'long', day: 'numeric', ...(short ? {} : { year: 'numeric' }),
}).format(new Date(START + day * 86_400_000));
export const isPayment = (e: Event) => ['issue', 'pay', 'transfer'].includes(e.type);
export const isSettlement = (e: Event) => ['issue', 'pay'].includes(e.type);
