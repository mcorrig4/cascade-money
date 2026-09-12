import test from 'node:test';
import assert from 'node:assert/strict';
import { demoAccounts, paymentDates } from './demo.mjs';
import { loadConfig } from './config.mjs';

test('seed reproduces five distinct actor addresses', () => {
  const a = demoAccounts('offline-unit-test'); const b = demoAccounts('offline-unit-test');
  assert.equal(new Set(a.map(x => x.wallet.address)).size, 5);
  assert.deepEqual(a.map(x => x.wallet.address), b.map(x => x.wallet.address));
  assert.notEqual(a[0].wallet.address, demoAccounts('different')[0].wallet.address);
});
test('wallet ordering puts future dates first and interpreted spot last', () => {
  assert.deepEqual(paymentDates([12n, 9n, 11n, 10n], 10n), [11n,12n,9n,10n]);
});
test('mainnet placeholder cannot deploy accidentally', () => {
  assert.throws(() => loadConfig(new URL('../chains/mainnet.example.json', import.meta.url)), /chainId/);
  assert.equal(loadConfig(new URL('../chains/testnet.json', import.meta.url)).chainId, 5042002);
});
