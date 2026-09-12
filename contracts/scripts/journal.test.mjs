import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Wallet, keccak256, Transaction } from 'ethers';
import { openRun, journaledSend } from './journal.mjs';
import { checkCheckpoint } from './demo.mjs';

function harness(t) {
  const directory = mkdtempSync(join(tmpdir(), 'cascade-resume-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const wallet = Wallet.createRandom();
  const state = { signed: 0, sent: [], receipts: new Map(), pending: new Set(), timeout: false, status: 1, lostAck: false };
  const provider = {
    send: async () => '0x' + state.receipts.size.toString(16),
    getTransactionReceipt: async hash => state.receipts.get(hash),
    getTransaction: async hash => state.pending.has(hash) ? { hash } : null,
    broadcastTransaction: async raw => {
      const hash = keccak256(raw);
      // The complete signed transaction must be on disk before any submission.
      assert.ok(readdirSync(directory).some(file => file.endsWith('.json') && readFileSync(join(directory, file), 'utf8').includes(raw)));
      state.sent.push(raw); state.pending.add(hash);
      if (!state.timeout) state.receipts.set(hash, { hash, status: state.status, logs: [] });
      if (state.lostAck) throw Error('RPC acknowledgement lost');
      return { hash };
    },
    waitForTransaction: async hash => state.receipts.get(hash) ?? null,
  };
  const signer = {
    getAddress: () => wallet.getAddress(),
    populateTransaction: async tx => ({ ...tx, chainId: 5042002, gasLimit: 21000n, gasPrice: 1n, type: 0 }),
    signTransaction: async tx => { state.signed++; return wallet.signTransaction(tx); },
  };
  const send = label => journaledSend({ directory, label, signer, provider, explorer: 'https://example.invalid',
    request: async () => ({ to: wallet.address, value: 1n }) });
  return { directory, state, send };
}

test('completed funding and issuance are never signed or broadcast twice across resumed steps', async t => {
  const { directory, state, send } = harness(t);
  openRun(directory, { vault: 'test', seedHash: 'public-hash' }, 20000n);
  const labels = ['fund Apple', 'fund Foxconn', 'principal', 'approve', 'register', 'issue', 'pay', 'extend'];
  for (let stop = 1; stop <= labels.length; stop++) {
    for (const label of labels.slice(0, stop)) await send(label);
  }
  assert.equal(state.signed, labels.length);
  assert.equal(state.sent.length, labels.length);
  assert.equal(new Set(state.sent.map(raw => Transaction.from(raw).nonce)).size, labels.length);
});

test('timeout resumption rebroadcasts identical signed bytes', async t => {
  const { state, send } = harness(t);
  state.timeout = true;
  await assert.rejects(send('issue'), /pending/);
  state.timeout = false;
  await send('issue');
  assert.equal(state.signed, 1);
  assert.equal(state.sent.length, 2);
  assert.equal(state.sent[0], state.sent[1]);
});

test('lost broadcast acknowledgement recovers mined receipt', async t => {
  const { state, send } = harness(t);
  state.lostAck = true;
  await send('principal');
  await send('principal');
  assert.equal(state.signed, 1);
  assert.equal(state.sent.length, 1);
});

test('reverted recorded transaction refuses replacement on every retry', async t => {
  const { state, send } = harness(t);
  state.status = 0;
  await assert.rejects(send('issue'), /reverted/);
  await assert.rejects(send('issue'), /reverted/);
  assert.equal(state.signed, 1);
  assert.equal(state.sent.length, 1);
});

test('run identity and original maturity anchor are immutable', t => {
  const { directory } = harness(t);
  assert.equal(openRun(directory, { amount: '10', vault: 'a' }, 100n).day, '100');
  assert.equal(openRun(directory, { amount: '10', vault: 'a' }, 102n).day, '100');
  assert.throws(() => openRun(directory, { amount: '100', vault: 'a' }, 102n), /identity/);
});

test('stale vault requires explicit zero-income consent and bounded backlog', () => {
  assert.throws(() => checkCheckpoint(100n, 99n, false), /Stale/);
  assert.doesNotThrow(() => checkCheckpoint(100n, 99n, true));
  assert.doesNotThrow(() => checkCheckpoint(100n, 100n, false));
  assert.throws(() => checkCheckpoint(100n, 67n, true), /backlog/);
  assert.throws(() => checkCheckpoint(100n, 101n, true), /Invalid/);
});

test('failure before RPC accepts a signed transaction resumes from its saved bytes', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'cascade-before-broadcast-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const wallet = Wallet.createRandom();
  let signed = 0; let failed = true; let receipt;
  const sent = [];
  const provider = {
    send: async () => '0x0',
    getTransactionReceipt: async () => receipt,
    getTransaction: async () => null,
    broadcastTransaction: async raw => {
      sent.push(raw);
      if (failed) throw Error('offline');
      receipt = { status: 1, hash: keccak256(raw) };
    },
    waitForTransaction: async () => receipt,
  };
  const signer = {
    getAddress: () => wallet.getAddress(),
    populateTransaction: async tx => ({ ...tx, chainId: 5042002, gasLimit: 21000n, gasPrice: 1n, type: 0 }),
    signTransaction: async tx => { signed++; return wallet.signTransaction(tx); },
  };
  const send = () => journaledSend({ directory, label: 'funding', signer, provider, explorer: 'https://example.invalid',
    request: async () => ({ to: wallet.address, value: 1n }) });
  await assert.rejects(send(), /offline/);
  failed = false;
  await send();
  assert.equal(signed, 1);
  assert.equal(sent[0], sent[1]);
});
