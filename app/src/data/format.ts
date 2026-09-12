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
