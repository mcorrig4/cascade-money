import type { Invoice } from './types.ts';
export function dollars(cents: bigint, compact = false): string {
  const negative = cents < 0n, value = negative ? -cents : cents;
  if (compact) {
    for (const [scale, suffix] of [[100_000_000_000n, 'B'], [100_000_000n, 'M'], [100_000n, 'K']] as const) {
      if (value >= scale) {
        const tenths = value * 10n / scale;
        return `${negative ? '−' : ''}$${tenths / 10n}${tenths % 10n ? `.${tenths % 10n}` : ''}${suffix}`;
      }
    }
  }
  const whole = (value / 100n).toLocaleString('en-US');
  return `${negative ? '−' : ''}$${whole}${value % 100n ? `.${String(value % 100n).padStart(2, '0')}` : ''}`;
}
export const ratio = (settled: bigint, committed: bigint) => committed === 0n ? '—' : `${(Number(settled * 100n / committed) / 100).toFixed(2)}×`;

/** Human-readable line items; count nouns already present in the item are not repeated. */
export function invoiceDetail(invoice?: Invoice): string {
  if (!invoice) return '';
  if (invoice.annotation) return invoice.annotation;
  const {item = '', unit = '', quantity = '', deliverTo} = invoice;
  const count = /^\d+$/.test(quantity) ? BigInt(quantity).toLocaleString('en-US') : quantity;
  const duplicateUnit = item.toLowerCase().split(/\W+/).includes(unit.toLowerCase());
  const genericUnit = /^(units?|pieces?|items?)$/i.test(unit);
  const description = item && unit && !duplicateUnit && !genericUnit ? `${unit} of ${item}` : item || unit;
  const destination = deliverTo?.replace(/[-_]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  return [count, description, destination ? `→ ${destination}` : ''].filter(Boolean).join(' ');
}
