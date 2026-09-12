import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Hand-laid SVG counterpart of architecture.md; no browser, server, fonts or packages required.
const source = new URL('../../docs/architecture.md', import.meta.url);
const output = new URL('../../docs/architecture.svg', import.meta.url);
const mermaid = readFileSync(source, 'utf8').match(/```mermaid\s*\n([\s\S]*?)```/)?.[1];
if (!mermaid) throw Error('Missing Mermaid block');
const esc = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const nodes = [
  ['APPLE', 60, 55, 290, 65, ['Debtor / Apple'], 'external'],
  ['USDC', 60, 215, 290, 90, ['USDC', '6-decimal ERC-20 interface'], ''],
  ['OWNER', 410, 215, 340, 90, ['Checkpoint owner', 'Funds demo yield via allowance'], ''],
  ['VAULT', 410, 385, 340, 105, ['CascadeVault', 'USDC custody · invoices', 'Backing check: B ≥ P + ceil(Y)'], 'vault'],
  ['DATES', 830, 385, 340, 105, ['Date mints · ERC-1155', 'ID = UTC epoch day'], ''],
  ['PAYEE', 830, 215, 340, 90, ['Creditor / next supplier', 'Original date retained'], ''],
  ['EXTEND', 830, 565, 340, 85, ['Extend', 'Burn T1 · mint T2 > T1'], ''],
  ['LEDGER', 410, 725, 340, 90, ['Entitlement ledger', 'account · amount · S · E · claimed'], ''],
  ['HOLDER', 60, 565, 290, 85, ['Holder', 'Withdraw USDC'], ''],
  ['WINDOW', 830, 855, 340, 85, ['Separate discount window', 'Participant-funded · outside vault'], 'external'],
  ['FRONTEND', 1330, 455, 340, 110, ['Cascade front end', 'Events · balances · receipts', 'Reference scenarios / pricing'], 'external'],
  ['REF', 410, 1055, 560, 90, ['Independent Python reference implementation', 'Loss waterfall · stress scenarios · event stream'], 'external'],
  ['LOCAL', 1060, 1055, 420, 90, ['Foundry tests', 'UTC time warp · invariant sequences'], 'external'],
];
for (const [id] of nodes) if (!new RegExp('\\b' + id + '\\[').test(mermaid)) throw Error('Mermaid node missing: ' + id);
const edges = [
  ['M205 120 V215', 'issue: deposit USDC', 215, 177],
  ['M350 260 H375 V420 H410', '', 0, 0],
  ['M580 305 V385', 'checkpoint: publish I(d)', 590, 351],
  ['M750 420 H830', 'mint', 770, 409],
  ['M1000 385 V305', 'pay / transfer', 1010, 351],
  ['M950 490 V565', 'burn', 960, 534],
  ['M1170 607 H1210 V445 H1170', 'mint', 1175, 535],
  ['M500 490 V725', 'issue interval', 510, 690],
  ['M830 608 H690 V725', 'added interval', 705, 594],
  ['M750 770 H795 V460 H830', '', 0, 0],
  ['M830 475 H775 V525 H580 V490', '', 0, 0],
  ['M410 460 H380 V607 H350', '', 0, 0],
  ['M1100 490 V550 H1240 V900 H1170', 'principal only', 1110, 833, true],
  ['M620 490 V990 H1290 V490 H1330', 'events · balances · explorer receipts', 695, 980],
  ['M1170 900 H1310 V550 H1330', 'prices / yield curve · shot 7', 1330, 878, true],
  ['M690 1055 V1020 H1530 V565', '', 0, 0, true],
  ['M1270 1055 V1035 H1620 V565', '', 0, 0, true],
];
const svg = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="1730" height="1200" viewBox="0 0 1730 1200" role="img" aria-labelledby="title desc">',
  '<title id="title">Cascade: dated dollars on Arc</title>',
  '<desc id="desc">USDC funds CascadeVault and ERC-1155 date mints. Extension adds entitlement intervals. Claims mint spot and withdrawals return USDC. An independent reference implementation and participant-funded discount window feed the front end.</desc>',
  '<metadata>Mermaid SHA-256: ' + createHash('sha256').update(mermaid).digest('hex') + '</metadata>',
  '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="#52647a"/></marker></defs>',
  '<style>text{font-family:Arial,Helvetica,sans-serif;fill:#172b45} .label{font-size:16px;paint-order:stroke;stroke:#f8fafc;stroke-width:5px;stroke-linejoin:round} .node{fill:white;stroke:#9cb4cb;stroke-width:1.5} .vault{fill:#dff4f0;stroke:#158474;stroke-width:2} .external{fill:#eef2f8;stroke:#a9b6c8;stroke-width:1.5}</style>',
  '<rect width="1730" height="1200" fill="#f8fafc"/>',
  '<text x="410" y="90" font-size="34" font-weight="700">Cascade · dated dollars on Arc</text>',
  '<rect x="35" y="150" width="1230" height="865" rx="22" fill="#eff6fc" stroke="#a3c5e2" stroke-width="2"/>',
  '<text x="60" y="190" font-size="22" font-weight="700">Arc · EVM · USDC gas</text>',
];
for (const [d, label, x, y, dashed] of edges) {
  svg.push('<path d="' + d + '" fill="none" stroke="#52647a" stroke-width="2" stroke-linejoin="round" marker-end="url(#arrow)"' + (dashed ? ' stroke-dasharray="7 6"' : '') + '/>');
  if (label) svg.push('<text class="label" x="' + x + '" y="' + y + '">' + esc(label) + '</text>');
}
for (const [, x, y, w, h, lines, kind] of nodes) {
  svg.push('<rect class="node ' + kind + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="12"/>');
  lines.forEach((line, i) => svg.push('<text text-anchor="middle" x="' + (x + w / 2) + '" y="' + (y + h / 2 - (lines.length - 1) * 12 + i * 24 + 7) + '" font-size="' + (i ? 16 : 20) + '" font-weight="' + (i ? 400 : 700) + '">' + esc(line) + '</text>'));
}
svg.push('<text class="label" x="645" y="515">ID ≤ today: spot → withdraw burns liability</text>');
svg.push('<text class="label" x="805" y="710">claim → today-dated spot</text>');
svg.push('<text x="60" y="1175" font-size="16">Solid: vault path · Dashed: separate components · Entitlements stay with their owner when principal moves</text>');
svg.push('</svg>');
writeFileSync(output, svg.join('\n') + '\n');
console.log('Rendered ' + output.pathname);
