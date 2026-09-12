// Python balance_sheet uses reduced rational strings for fractional accounting fields.
export function rational(n, d = 1n) {
  if (d <= 0n) throw Error('Denominator must be positive');
  let a = n < 0n ? -n : n, b = d;
  while (b) [a, b] = [b, a % b];
  return `${n / a}/${d / a}`;
}
function cents(micro) {
  if (micro > BigInt(Number.MAX_SAFE_INTEGER) || micro < 0n) throw Error('Balance outside demo JSON numeric range');
  return Number(micro) / 10000;
}
export function balanceSheetJSON({ backing, principal, spot, accruedScaled, claimableScaled, reserve, deficit, shares }) {
  return {
    backing_asset_units: rational(shares, 1000000n),
    backing_value_cents: cents(backing), principal_cents: cents(principal),
    dated_cents: cents(principal - spot), spot_cents: cents(spot),
    unclaimed_accrued_cents: rational(accruedScaled, 10n ** 22n),
    claimable_cents: rational(claimableScaled, 10n ** 22n),
    reserve_cents: rational(reserve, 10000n), deficit_cents: rational(deficit, 10000n),
  };
}
