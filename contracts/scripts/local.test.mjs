import test from 'node:test';
import assert from 'node:assert/strict';
import { balanceSheetJSON, rational } from './balance-sheet.mjs';
import { assertLocal, assertFork, localDeployer, signingWallet } from './local.mjs';

test('balance sheet preserves fractional cents and Python rational format', () => {
  const sheet = balanceSheetJSON({ backing: 10500000n, principal: 10000000n, spot: 3000000n,
    accruedScaled: 300001n * 10n**18n, claimableScaled: 200000n * 10n**18n,
    reserve: 199999n, deficit: 0n, shares: 10000000n });
  assert.deepEqual(sheet, { backing_asset_units: '10/1', backing_value_cents: 1050,
    principal_cents: 1000, dated_cents: 700, spot_cents: 300,
    unclaimed_accrued_cents: '300001/10000', claimable_cents: '20/1',
    reserve_cents: '199999/10000', deficit_cents: '0/1' });
  assert.equal(rational(0n, 1000n), '0/1');
  assert.equal(rational(-2n, 4n), '-1/2');
});
test('local and fork preflights reject the wrong chain and non-loopback endpoints', async () => {
  const provider = (chain, fork) => ({ send: async method => method === 'eth_chainId' ? chain : { forkConfig: fork ? { forkUrl: 'https://rpc.testnet.arc.io' } : {} } });
  await assertLocal(provider('0x7a69', false), 'http://127.0.0.1:8545');
  await assertFork(provider('0x4cef52', true), 'http://127.0.0.1:8545');
  await assert.rejects(assertLocal(provider('0x4cef52', true), 'http://127.0.0.1:8545'), /plain Anvil/);
  await assert.rejects(assertFork(provider('0x7a69', false), 'http://127.0.0.1:8545'), /requires an Arc fork/);
  await assert.rejects(assertLocal(provider('0x7a69', false), 'https://rpc.testnet.arc.io'), /loopback/);
  await assert.rejects(assertLocal(provider('0x1', false), 'http://localhost:8545'), /31337/);
});
test('local signer always uses the public deterministic local identity', () => {
  assert.equal(signingWallet(null, false).address, localDeployer(null).address);
});
