export const github = 'https://github.com/mcorrig4/cascade-money/blob/main/';
export const code = (path: string) => `${github}${path}`;
export const vaultSource = code('contracts/src/CascadeVault.sol');
export const usycSource = code('contracts/src/CascadeVaultUSYC.sol');
export const explorer = 'https://testnet.arcscan.app';
export const deployment = {
  address: '0x57838A35f05a43aD519204D7A6Ce63F52d7C1987',
  owner: '0x9C2069b5b510E548963E98474CA08F72E26Fe3f4',
  verified: `${explorer}/address/0x57838a35f05a43ad519204d7a6ce63f52d7c1987#code`,
  launch: 'After September 16, 2026 launch',
  status: 'Planned · Arc mainnet',
  allowlist: 'Real USYC after Circle allowlists the vault',
};
export const receipts = [
  { label: 'Deploy vault', hash: '0xeec1fa5a6c47902e2a10b953f809262f52b2759eb88642e14622a7d2204b275e' },
  { label: 'Issue · Apple → Foxconn', hash: '0x70fa7b0e7a2f77dd51c8e23f41919e4e909c5f54230b4b590db8bf2017f6ef2c' },
  { label: 'Pay · Foxconn → TSMC', hash: '0x7d95fb4b18b0b0ae616c665408cab1304606219b3e675abe71426123df3d1619' },
  { label: 'Pay · TSMC → Corning', hash: '0xb43e2d93ca18c142c1e252910c80f5eebbadd7d7598e282c078687461283542c' },
  { label: 'Extend · T90 → T120', hash: '0x76128b8bd8775bc693248770e7250b4bda0a66e50026a9bcffbfcf94e1ec8ff7' },
  { label: 'Pay · Corning → glass supplier', hash: '0xc7ab543c8b736e254b37516c74e566502721af1f68de6ca36b51028b84660b46' },
];
export const sequence = [
  { id: 'register', from: 0, to: 2, title: 'Register invoice · creditor authorizes D and M', detail: 'registerInvoice(Apple, $100, D, M) · M ≤ D', backing: 0, settled: 0 },
  { id: 'approve', from: 1, to: 2, title: 'Approve USDC · spender is CascadeVault', detail: 'USDC.approve(vault, $100) · approval is on the USDC token', backing: 0, settled: 0 },
  { id: 'deposit', from: 1, to: 2, title: 'Deposit $100 USDC against the invoice', detail: 'issue(invoiceId, $100) · pulls backing into custody', backing: 100, settled: 0 },
  { id: 'mint', from: 2, to: 3, title: 'Mint $100 dated M to the creditor', detail: 'Same issue transaction · Apple receives the original yield interval', backing: 100, settled: 100 },
  { id: 'pay-1', from: 0, to: 4, title: 'Creditor pays its supplier · same $100 units', detail: 'pay via vault / ledger · guard: date ≤ new M ≤ new D', backing: 100, settled: 200 },
  { id: 'pay-2', from: 4, to: 3, title: 'Next creditor pays a second onward invoice', detail: 'Ledger moves units to that supplier · same date guard', backing: 100, settled: 300 },
  { id: 'maturity', from: 2, to: 3, title: 'Maturity · existing units are interpreted as spot', detail: 'Solidity: id ≤ today() · UTC epoch day · no maintenance mint', backing: 100, settled: 300 },
  { id: 'withdraw', from: 4, to: 2, title: 'Final holder requests $100 withdrawal', detail: 'withdraw($100) · only mature balances can be consumed', backing: 100, settled: 300 },
  { id: 'burn', from: 2, to: 3, title: 'Burn matching principal; send $100 USDC', detail: 'One atomic withdrawal · principal and backing fall together', backing: 0, settled: 300 },
] as const;
export const intervals = [
  { account: 'Apple · original beneficiary', amount: 100, start: 1, end: 30 },
  { account: 'Extender · added interval', amount: 100, start: 31, end: 90 },
] as const;
export const principalStates = [
  { id: 'issue', day: 0, date: 30, holder: 'Creditor', label: 'Issue $100 · T30', detail: 'Apple owns days 1–30' },
  { id: 'transfer', day: 10, date: 30, holder: 'Extender', label: 'Transfer · T30', detail: 'Yield ownership unchanged' },
  { id: 'extend', day: 20, date: 90, holder: 'Extender', label: 'Burn T30 → mint T90', detail: 'Extender owns days 31–90' },
  { id: 'sell', day: 25, date: 90, holder: 'Buyer', label: 'Sell $100 for $97 spot', detail: 'Buyer funds the purchase' },
  { id: 'reject', day: 26, date: 90, holder: 'Buyer', label: 'T90 → T30 rejected', detail: 'InvalidDate · balances unchanged' },
  { id: 'claim', day: 30, date: 90, holder: 'Buyer', label: 'Apple claims yield', detail: 'I(30) published → mint spot' },
  { id: 'redeem', day: 90, date: 90, holder: 'Buyer', label: 'Buyer redeems principal', detail: 'Burn $100 spot → backing out' },
] as const;
export const storage = [
  { title: 'ERC-1155 · principal', fields: ['_balances[id][account] (inherited)', 'supplyByDate[id]', 'totalSupply'], note: 'Mature IDs are spot; counted once.', source: vaultSource },
  { title: 'invoices[bytes32] → Invoice', fields: ['creditor · debtor · amount', 'outstanding', 'dueDate (D) · acceptedMaturity (M)'], note: 'invoiceNonces[creditor] seeds each ID.', source: vaultSource },
  { title: 'entitlements[id] → Entitlement', fields: ['account · amount', 'start (S) · end (E) · claimed', 'entitlementCount'], note: 'Principal transfers leave these intact.', source: vaultSource },
  { title: 'Daily accrual', fields: ['dailyIndex[day] → I(d)', 'lastCheckpoint · activeNotional', 'accruedScaled'], note: 'Aggregate unclaimed liability, scaled.', source: vaultSource },
  { title: 'Interval scheduling', fields: ['starts[S] += amount', 'stops[E + 1] += amount', 'S…E are inclusive'], note: 'Update activeNotional at checkpoint.', source: vaultSource },
  { title: 'accountDates[account] → Heap', fields: ['dates[] · position[date]', 'datesOf(account, offset, limit)', 'earliestDate(account)'], note: 'Index of IDs with nonzero balances.', source: code('contracts/src/libraries/AccountDates.sol') },
] as const;
// A policy walkthrough in dollars: each state is an exact, reconciled balance sheet.
// Recorded implementation traces are kept separately below this walkthrough.
export const waterfall = [
  { label: 'Normal accrual', backing: 106, principal: 100, accrued: 4, reserve: 2, deficit: 0, index: 1.04, note: 'Income accrues · reserve floor $2' },
  { label: 'Reserve takes loss', backing: 105, principal: 100, accrued: 4, reserve: 1, deficit: 0, index: 1.04, note: '$1 loss → reserve $2 to $1' },
  { label: 'Loss exceeds reserve', backing: 102, principal: 100, accrued: 4, reserve: 0, deficit: 2, index: 1.04, note: '$3 loss → Claim / Withdraw suspended' },
  { label: 'Repair deficit', backing: 104, principal: 100, accrued: 4, reserve: 0, deficit: 0, index: 1.04, note: '$2 recovery → deficit zero' },
  { label: 'Rebuild reserve', backing: 105, principal: 100, accrued: 4, reserve: 1, deficit: 0, index: 1.04, note: '$1 recovery → index still flat' },
  { label: 'Reach reserve floor', backing: 106, principal: 100, accrued: 4, reserve: 2, deficit: 0, index: 1.04, note: '$1 recovery → floor restored' },
  { label: 'Index resumes', backing: 108, principal: 100, accrued: 6, reserve: 2, deficit: 0, index: 1.06, note: 'Next $2 income → yield accrues' },
] as const;
export const flows = [
  { id: 'python', label: 'Python reference', detail: 'Scenarios + world generator', source: code('sim/world.py') },
  { id: 'ndjson', label: 'Recorded NDJSON', detail: 'Events + daily balance sheets', source: code('sim/events.py') },
  { id: 'worker', label: 'Loader worker', detail: 'Parse → validate → index', source: code('app/src/data/loader.worker.ts') },
  { id: 'playback', label: 'Playback engine', detail: 'Cursor → globe + counters', source: code('app/src/playback/engine.ts') },
  { id: 'transactions', label: 'Contract transactions', detail: 'Arc testnet · separate evidence', source: code('contracts/deployments/testnet-demo-run.md') },
  { id: 'receipts', label: 'Explorer receipts', detail: 'Verified source + mined results', source: deployment.verified },
] as const;
export const sections = [
  { slug: 'one-deposit', title: 'One deposit pays several suppliers.', question: 'How does the same principal settle another invoice?', description: 'The invoice is settled when dated dollars arrive. The creditor can pass them onward, while the backing remains in the vault until redemption.', boundary: 'CascadeVault · Solidity payment path', source: vaultSource, sourceLabel: 'Issue, Pay and Withdraw', steps: sequence.length },
  { slug: 'principal-and-yield', title: 'Principal moves; yield ownership stays.', question: 'Who gets paid for waiting?', description: 'Each commitment owns a distinct interval. Moving a balance changes its holder; extending its date assigns only the additional days.', boundary: 'Solidity ledger · Python reference secondary market', source: vaultSource, sourceLabel: 'Extend and Claim', steps: 7 },
  { slug: 'one-ledger', title: 'One balance ledger, several interfaces.', question: 'What is actually stored?', description: 'A date is an ERC-1155 ID. Per-date ERC-20 contracts expose those same balances and supply, while metadata gives the date a readable name.', boundary: 'CascadeVault · Solidity storage and interfaces', source: vaultSource, sourceLabel: 'Storage and date views', steps: 1 },
  { slug: 'earnings-and-control', title: 'Where earnings come from, and who controls them.', question: 'What backs the instrument, and who is trusted?', description: 'The USDC and USYC variants share the dated-dollar ledger. Their sources of earnings, valuation controls and withdrawal assets differ.', boundary: 'Arc testnet · deployed USDC vault / local USYC variant', source: usycSource, sourceLabel: 'Backing and checkpoint hooks', steps: 1 },
  { slug: 'loss-and-recovery', title: 'What happens when backing falls?', question: 'Who absorbs a loss before yield can resume?', description: 'Reserve absorbs losses first. A remaining shortfall becomes deficit. Recovery repairs the deficit, restores the reserve floor, then resumes the index.', boundary: 'Python reference + CascadeVaultUSYC · local accounting', source: code('sim/invariants.py'), sourceLabel: 'Balance-sheet and loss invariants', steps: waterfall.length },
  { slug: 'stream-and-evidence', title: 'What you watched, and what you can verify.', question: 'How does the globe connect to the evidence?', description: 'The globe plays a recorded event stream. The contract is verified on Arc testnet. Follow the data path to reproduce the playback, and the evidence path to inspect transactions.', boundary: 'Recorded Python events / independent Arc testnet receipts', source: code('docs/EVENTS.md'), sourceLabel: 'Event schema and counter semantics', steps: 1 },
] as const;
export type ArchitectureSection = (typeof sections)[number];
export { default as traces } from './traces.json' with { type: 'json' };
