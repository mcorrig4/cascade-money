import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveRoute } from '../src/architecture/routing.ts';
import { deployment, flows, intervals, principalStates, receipts, sections, sequence, storage, traces, waterfall } from '../src/architecture/data.ts';

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
test('history architecture route, trailing slash, hash fallback and unknown paths', () => {
  for (const path of ['/architecture', '/architecture/']) assert.equal(resolveRoute(path), 'architecture');
  assert.equal(resolveRoute('/', '#/architecture'), 'architecture');
  assert.equal(resolveRoute('/', '#/architecture/loss-and-recovery'), 'architecture');
  assert.equal(resolveRoute('/architecture', '#loss-and-recovery'), 'architecture');
  assert.equal(resolveRoute('/'), 'globe');
  for (const path of ['/unknown', '/architecture-other', '/architecture/nested']) assert.equal(resolveRoute(path), 'not-found');
});
test('six judge questions appear in their required order with source links', () => {
  assert.deepEqual(sections.map(s => s.slug), ['one-deposit', 'principal-and-yield', 'one-ledger', 'earnings-and-control', 'loss-and-recovery', 'stream-and-evidence']);
  for (const section of sections) { assert.ok(section.boundary); assert.match(section.source, /^https:\/\/github.com\/mcorrig4\/cascade-money\/blob\/main\//); }
});
test('sequence settles three invoices on one deposit and burns matching principal at withdrawal', () => {
  assert.deepEqual(sequence.map(s => s.id), ['register', 'approve', 'deposit', 'mint', 'pay-1', 'pay-2', 'maturity', 'withdraw', 'burn']);
  assert.deepEqual(sequence.map(s => s.settled), [0, 0, 0, 100, 200, 300, 300, 300, 300]);
  assert.ok(sequence.slice(2, 8).every(s => s.backing === 100));
  assert.equal(sequence.at(-1)?.backing, 0);
  assert.match(sequence[4].detail, /date ≤ new M ≤ new D/);
  assert.match(sequence[8].detail, /atomic/);
});
test('inclusive entitlement intervals cover each committed day exactly once', () => {
  const coverage = Array.from({ length: 91 }, () => 0);
  for (const interval of intervals) {
    assert.equal(interval.amount, 100);
    for (let day = interval.start; day <= interval.end; day++) coverage[day]++;
  }
  assert.equal(coverage[0], 0);
  assert.ok(coverage.slice(1).every(count => count === 1));
  assert.equal(intervals[0].account, 'Apple · original beneficiary');
  assert.equal(intervals[1].start, intervals[0].end + 1);
  assert.deepEqual(principalStates.map(s => s.date), [30, 30, 90, 90, 90, 90, 90]);
  assert.equal(principalStates[3].holder, 'Buyer');
  assert.equal(principalStates[4].holder, 'Buyer');
  assert.equal(principalStates[5].holder, 'Buyer');
  assert.ok(principalStates[5].day < principalStates[6].day);
});
test('storage names match Solidity, including inherited balances and account heap', async () => {
  const vault = await read('contracts/src/CascadeVault.sol');
  const erc1155 = await read('contracts/lib/openzeppelin-contracts/contracts/token/ERC1155/ERC1155.sol');
  const heap = await read('contracts/src/libraries/AccountDates.sol');
  for (const name of ['supplyByDate','totalSupply','invoices','invoiceNonces','entitlements','account','amount','start','end','claimed','dueDate','acceptedMaturity','dailyIndex','starts','stops','activeNotional','accruedScaled','accountDates']) {
    assert.match(vault, new RegExp(`\\b${name}\\b`));
    assert.ok(JSON.stringify(storage).includes(name) || ['starts','stops'].includes(name), name);
  }
  assert.match(erc1155, /_balances/); assert.match(heap, /uint256\[\] dates/); assert.match(heap, /position/);
  const view = await read('contracts/src/DatedDollarERC20.sol');
  assert.match(view, /return vault.balanceOf\(account, date\)/);
  assert.match(view, /return vault.supplyByDate\(date\)/);
});
test('deployment and receipt references match the recorded Arc deployment', async () => {
  const evidence = await read('contracts/deployments/testnet-demo-run.md');
  assert.ok(evidence.includes(deployment.address)); assert.ok(evidence.includes(deployment.owner));
  for (const receipt of receipts) assert.ok(evidence.includes(receipt.hash));
  assert.equal(deployment.status, 'Planned · Arc mainnet');
  assert.match(deployment.allowlist, /ticket filed/);
});
test('waterfall reconciles at every step and repairs deficit and floor before index resumes', () => {
  for (const step of waterfall) {
    assert.equal(step.backing + step.deficit, step.principal + step.accrued + step.reserve, step.label);
    assert.ok(Object.values(step).filter(v => typeof v === 'number').every(v => v >= 0));
  }
  assert.deepEqual(waterfall.map(s => s.principal), Array(7).fill(100));
  assert.deepEqual(waterfall.map(s => s.deficit), [0,0,2,0,0,0,0]);
  assert.deepEqual(waterfall.map(s => s.reserve), [2,1,0,0,1,2,2]);
  assert.deepEqual(waterfall.map(s => s.index), [1.04,1.04,1.04,1.04,1.04,1.04,1.06]);
});
function fraction(value: string): [bigint, bigint] { const [n, d = '1'] = value.split('/'); return [BigInt(n), BigInt(d)]; }
function add(a: [bigint, bigint], b: [bigint, bigint]): [bigint,bigint] { return [a[0]*b[1]+b[0]*a[1], a[1]*b[1]]; }
test('captured implementation traces reconcile exactly with rational arithmetic', () => {
  for (const row of [...traces.reference, ...traces.local]) {
    const left = add(fraction(row.backing), fraction(row.deficit));
    const right = add(add(fraction(row.principal), fraction(row.accrued)), fraction(row.reserve));
    assert.equal(left[0]*right[1], right[0]*left[1], row.label);
  }
  assert.equal(traces.reference[2].deficit, '2');
  assert.equal(traces.reference[3].reserve, '1/2');
  assert.equal(traces.reference[2].index, traces.reference[3].index);
  assert.ok(traces.local.every(s => s.deficit === '0'));
});
test('playback and contract evidence have separate paths with concrete sources', () => {
  assert.deepEqual(flows.map(f => f.id), ['python','ndjson','worker','playback','transactions','receipts']);
  assert.ok(flows.slice(0,4).every(f => !f.source.includes('arcscan')));
  assert.match(flows[5].source, /arcscan/);
});
test('SVG exports are self-contained, source-linked and fully revealed', async () => {
  for (const [i, section] of sections.entries()) {
    const svg = await read(`docs/architecture/${i + 1}-${section.slug}.svg`);
    assert.ok(svg.includes('<svg')); assert.ok(svg.includes('<title')); assert.ok(svg.includes('<desc'));
    assert.ok(svg.includes(section.source)); assert.ok(svg.includes('data-visible="true"'));
    assert.ok(!/<g[^>]*data-visible="false"/.test(svg));
    assert.ok(!/<(?:script|image)\b/.test(svg));
  }
  assert.equal(await read('docs/architecture/7-component-inventory.svg'), await read('docs/architecture.svg'));
});
