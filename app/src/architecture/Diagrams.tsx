import type { ReactNode } from 'react';
import { code, deployment, explorer, flows, intervals, principalStates, receipts, sections, sequence, storage, traces, usycSource, vaultSource, waterfall } from './data.ts';

const colors = { money: '#69e6c0', yield: '#e8b768', control: '#9cabbf', white: '#f1eee6', deficit: '#c298a5' };
type Tone = keyof typeof colors;
const svgStyle = `text{font-family:Inter,Arial,Helvetica,sans-serif;fill:#f1eee6;font-size:16px} .small{font-size:14px;fill:#a3b3bd}.label{font-size:13px;letter-spacing:1.2px;fill:#9cabbf}.heading{font-size:20px;font-weight:500}.money{fill:#69e6c0}.yield{fill:#e8b768}.control{fill:#9cabbf}.mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:15px}.box{fill:#0d1c27;stroke:#2a3e4c;stroke-width:1}.wire{fill:none;stroke:#566c7b;stroke-width:1.5}.guide{stroke:#273c4b;stroke-dasharray:4 7}.step{transition:opacity .5s ease,transform .5s ease}.step[data-visible="false"]{opacity:0;transform:translateY(6px)}a:hover text{text-decoration:underline}a:focus-visible{outline:2px solid #69e6c0}@media(prefers-reduced-motion:reduce){.step{transition:none!important;transform:none!important;opacity:1!important}}`;
function Frame({ id, height, children, description }: { id: number; height: number; children: ReactNode; description: string }) {
  const section = sections[id - 1];
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 1120 ${height}`} width="1120" height={height} role="img" aria-labelledby={`diagram-${id}-title diagram-${id}-desc`} className="architecture-svg">
    <title id={`diagram-${id}-title`}>{section.title}</title><desc id={`diagram-${id}-desc`}>{description}</desc>
    <style>{svgStyle}</style><defs>{Object.entries(colors).map(([name, color]) => <marker key={name} id={`arrow-${id}-${name}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill={color} /></marker>)}</defs>
    <rect width="1120" height={height} rx="12" fill="#09151f" />
    <text x="32" y="35" className="label">CASCADE / {String(id).padStart(2, '0')}</text>
    <a href={section.source} target="_blank" rel="noreferrer"><text x="32" y="65" className="control">{section.boundary}</text></a>
    {children}
  </svg>;
}
function Step({ n, progress, children }: { n: number; progress: number; children: ReactNode }) {
  return <g className="step" data-step={n} data-visible={progress >= n ? 'true' : 'false'}>{children}</g>;
}
function Arrow({ id, x1, y1, x2, y2 = y1, tone = 'money', dashed = false }: { id: number; x1: number; y1: number; x2: number; y2?: number; tone?: Tone; dashed?: boolean }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colors[tone]} strokeWidth="1.5" strokeDasharray={dashed ? '5 5' : undefined} markerEnd={`url(#arrow-${id}-${tone})`} />;
}
function Box({ x, y, width = 320, title, lines, tone = 'control', href }: { x: number; y: number; width?: number; title: string; lines: readonly string[]; tone?: Tone; href?: string }) {
  const content = <g><rect className="box" x={x} y={y} width={width} height={62 + lines.length * 25} rx="8" /><rect x={x} y={y + 16} width="3" height="22" fill={colors[tone]} /><text x={x + 18} y={y + 34} className="heading" style={{ fill: colors[tone] }}>{title}</text>{lines.map((line, i) => <text key={i} x={x + 18} y={y + 66 + i * 25}>{line}</text>)}</g>;
  return href ? <a href={href} target="_blank" rel="noreferrer">{content}</a> : content;
}
export function SequenceDiagram({ progress = 99 }: { progress?: number }) {
  const xs = [100, 275, 450, 625, 800];
  return <Frame id={1} height={1160} description="A $100 example: register and approve, issue dated units, settle two further invoices, mature, then atomically burn and withdraw. Backing is $100 throughout circulation while settlement reaches $300.">
    {['Creditor', 'Debtor (Apple)', 'CascadeVault', 'ERC-1155 ledger', 'Next Creditor'].map((label, i) => <g key={label}><text x={xs[i]} y="113" textAnchor="middle">{label}</text><line className="guide" x1={xs[i]} x2={xs[i]} y1="132" y2="1080" /></g>)}
    <text x="925" y="113" className="label">BACKING / SETTLED</text>
    {sequence.map((step, i) => <Step key={step.id} n={i + 1} progress={progress}><a href={vaultSource} target="_blank" rel="noreferrer">
      <rect x="38" y={151 + i * 102} width="840" height="56" rx="5" fill="#09151f" />
      <text x="48" y={174 + i * 102}>{String(i + 1).padStart(2, '0')} · {step.title}</text>
      <text x="48" y={198 + i * 102} className="small">{step.detail}</text>
      <Arrow id={1} x1={xs[step.from]} x2={xs[step.to]} y1={221 + i * 102} tone={i === 0 || i === 6 ? 'control' : 'money'} dashed={i === 6} />
      <text x="925" y={190 + i * 102} className="money">${step.backing} / ${step.settled}</text>
    </a></Step>)}
    <text x="38" y="1118" className="money">$100 backing during circulation → $300 of invoices settled → $100 principal redeemed.</text>
    <text x="38" y="1143" className="small">Onward arrows summarize pay() through the vault and ledger. Final holder occupies the next-creditor role.</text>
  </Frame>;
}
export function IntervalsDiagram({ progress = 99 }: { progress?: number }) {
  return <Frame id={2} height={1160} description="$100 starts at T30. Transfer changes principal holder only. Extension burns T30 and mints T90; Apple retains days 1–30 and the extender gets 31–90. A participant pays $97 for principal only. Backward extension fails. Claims mint yield as spot separately from principal redemption.">
    <text x="32" y="111" className="label">PRINCIPAL STATE MACHINE · $100 FACE VALUE · RELATIVE UTC DAYS</text>
    {principalStates.slice(0, 4).map((s, i) => <Step key={s.id} n={i + 1} progress={progress}><Box x={32 + i * 272} y={140} width={240} title={`Day ${s.day} · ${s.holder}`} lines={[s.label, s.detail]} tone={i === 2 ? 'yield' : 'money'} href={i === 3 ? code('sim/core.py') : vaultSource} />{i < 3 && <Arrow id={2} x1={272 + i * 272} x2={299 + i * 272} y1={192} />}</Step>)}
    <Step n={5} progress={progress}><Box x={760} y={294} width={328} title="Backward extension rejected" lines={['Day 26 · T90 → T30', 'InvalidDate · state unchanged']} tone="control" href={vaultSource} /><Arrow id={2} x1={944} y1={252} x2={944} y2={292} tone="control" dashed /></Step>
    <Step n={4} progress={progress}><a href={code('sim/core.py')} target="_blank" rel="noreferrer"><text x="32" y="328" className="control">PYTHON REFERENCE · PARTICIPANT-FUNDED SECONDARY PURCHASE</text><text x="32" y="358">Buyer → extender: $97 of buyer-owned spot</text><text x="32" y="385">Extender → buyer: $100 dated T90 · buyer earns the $3 discount</text><text x="32" y="412" className="yield">Both existing entitlements stay with their beneficiaries.</text></a></Step>
    <text x="32" y="470" className="label">YIELD ENTITLEMENTS · NON-OVERLAPPING INCLUSIVE INTERVALS</text>
    <line x1="340" x2="1060" y1="513" y2="513" className="wire" />
    {[1, 30, 31, 60, 90].map(day => <g key={day}><line x1={340 + (day - 1) * 8} x2={340 + (day - 1) * 8} y1="505" y2="650" className="guide" /><text x={340 + (day - 1) * 8} y={day === 31 ? 493 : 538} textAnchor="middle" className="small">{day}</text></g>)}
    {intervals.map((bar, i) => <Step key={bar.start} n={i ? 3 : 1} progress={progress}><a href={vaultSource} target="_blank" rel="noreferrer"><text x="32" y={584 + i * 58}>{bar.account}</text><rect x={340 + (bar.start - 1) * 8} y={559 + i * 58} width={(bar.end - bar.start + 1) * 8 - 2} height="37" rx="4" fill="#e8b768" fillOpacity={i ? '.26' : '.13'} stroke="#e8b768" /><text x={350 + (bar.start - 1) * 8} y={584 + i * 58} className="yield">Days {bar.start}–{bar.end} · $100</text></a></Step>)}
    <text x="32" y="696" className="mono">value = amount × [ I(end) − I(start − 1) ] / SCALE</text>
    <Step n={6} progress={progress}><Box x={32} y={735} width={504} title="Claim · beneficiary collects yield" lines={['Day 30: Apple claims after I(30) is published.', 'Day 90: extender claims after I(90) is published.', 'claim(id) → claimed = true → mint today-dated spot']} tone="yield" href={vaultSource} /></Step>
    <Step n={7} progress={progress}><Box x={568} y={735} width={520} title="Redemption · holder collects principal" lines={['Day 90: buyer holds $100 interpreted as spot.', 'withdraw($100) → burn matching mature units', 'Vault sends $100 backing to the buyer.']} tone="money" href={vaultSource} /></Step>
    <Step n={7} progress={progress}><Arrow id={2} x1={284} y1={872} x2={284} y2={925} tone="yield" /><Box x={32} y={928} width={504} title="Claimed spot can be withdrawn separately" lines={['Claim does not redeem the buyer’s $100.', 'Beneficiaries may keep or withdraw their spot.']} tone="yield" href={vaultSource} /></Step>
    <text x="568" y="972" className="control">Date labels are relative to issuance day 0.</text><text x="568" y="1000" className="control">Every operation on day d earns from d + 1.</text>
    <text x="32" y="1125" className="small">Solidity: transfer / extend / claim / withdraw. Python reference: atomic participant-funded Sell.</text>
  </Frame>;
}
export function StorageDiagram({ progress = 99 }: { progress?: number }) {
  return <Frame id={3} height={1000} description="CascadeVault storage uses inherited ERC-1155 balances, per-date supply, invoices and creditor nonces, independent entitlements, a daily index, start and stop schedules, accruedScaled liability and accountDates heaps. ERC-20 date views forward reads and transfers to this ledger; DateMetadata supplies presentation."><Step n={1} progress={progress}>
    <rect x="20" y="95" width="1080" height="581" rx="10" fill="none" stroke="#69e6c0" strokeOpacity=".35" />
    <text x="38" y="127" className="money">CascadeVault : ERC1155 · field names from Solidity</text>
    {storage.map((entity, i) => { const x = 38 + (i % 3) * 355, y = 153 + Math.floor(i / 3) * 253; return <a key={entity.title} href={entity.source} target="_blank" rel="noreferrer"><rect x={x} y={y} width="334" height="217" rx="7" className="box" /><text x={x + 16} y={y + 32}>{entity.title}</text><line x1={x + 16} x2={x + 318} y1={y + 49} y2={y + 49} className="wire" />{entity.fields.map((field, j) => <text key={field} x={x + 16} y={y + 78 + j * 28} className="mono">{field}</text>)}<text x={x + 16} y={y + 191} className="small">{entity.note}</text></a>; })}
    <Arrow id={3} x1={180} y1={730} x2={180} y2={677} /><text x="200" y="710" className="small">read / transferDate()</text>
    <Arrow id={3} x1={850} y1={677} x2={850} y2={730} tone="control" /><text x="875" y="710" className="small">uri(id)</text>
    <Box x={32} y={735} width={630} title="DatedDollarERC20 · viewFor[date]" lines={['balanceOf(account) → vault.balanceOf(account, date)', 'totalSupply() → vault.supplyByDate(date)', 'transfer / transferFrom → vault.transferDate', 'allowance[owner][spender] is local to each date view']} tone="money" href={code('contracts/src/DatedDollarERC20.sol')} />
    <Box x={690} y={735} width={398} title="DateMetadata · presentation" lines={['uri · isoDate · label · creationSymbol', 'JSON + SVG · USD+N / USD spot', 'metadata is immutable in the vault.']} href={code('contracts/src/DateMetadata.sol')} />
    <text x="32" y="973" className="money">One supply: ERC-20 views hold allowances and labels; principal lives in the ERC-1155 ledger.</text>
  </Step></Frame>;
}
export function TrustDiagram({ progress = 99 }: { progress?: number }) {
  return <Frame id={4} height={1190} description="Deployed CascadeVault custodies USDC; its immutable checkpoint owner funds the chosen index delta. The local CascadeVaultUSYC values MockUSYC shares using owner-set price; MockUSYC owner controls setPrice and mint. Buy is funded by USDC and sell requires available USDC. Real USYC integration awaits Circle allowlisting; Arc mainnet is planned after September 16."><Step n={1} progress={progress}>
    <text x="32" y="116" className="money">ARC TESTNET · VERIFIED USDC VAULT</text><text x="590" y="116" className="yield">LOCAL VARIANT · MOCK USYC ACCOUNTING</text>
    <Box x={32} y={140} width={498} title="Checkpoint owner · privileged" lines={['owner chooses indexDelta and calls checkpoint(delta).', 'Owner approves and supplies USDC for accrued yield.']} href={vaultSource} />
    <Box x={590} y={140} width={498} title="MockUSYC.owner · privileged" lines={['setPrice(value) controls valuation · scale 1e18.', 'mint(to, shares) is owner-only; buy() is USDC-funded.']} href={code('contracts/src/mocks/MockUSYC.sol')} />
    <Arrow id={4} x1={281} y1={252} x2={281} y2={320} tone="control" /><text x="298" y="291" className="small">Fund then publish daily index</text>
    <Arrow id={4} x1={839} y1={252} x2={839} y2={320} tone="control" /><text x="855" y="291" className="small">Price and share authority</text>
    <Box x={32} y={325} width={498} title="CascadeVault · USDC custody" lines={['Backing = usdc.balanceOf(vault)', 'Funded = ceil(activeNotional × delta / SCALE).', 'accruedScaled rises by activeNotional × delta.', 'Principal withdrawal returns USDC.']} tone="money" href={vaultSource} />
    <Box x={590} y={325} width={498} title="CascadeVaultUSYC · share custody" lines={['Backing = asset.balanceOf(vault) × price / SCALE', 'owner publishes consecutive daily checkpoint().', 'Income excludes deposits and withdrawals.', 'Principal withdrawal returns USYC shares.']} tone="yield" href={usycSource} />
    <Arrow id={4} x1={839} y1={487} x2={839} y2={542} tone="yield" /><text x="32" y="542" className="control">Immutable checkpoint owner on Arc testnet:</text><a href={`${explorer}/address/${deployment.owner}`} target="_blank" rel="noreferrer"><text x="32" y="570" className="mono">{deployment.owner}</text></a>
    <Box x={590} y={548} width={498} title="MockUSYC · USDC redemption liquidity" lines={['buy(): USDC in → shares minted at current price.', 'sell(): shares burned → USDC from asset custody.', 'Price changes do not add redemption cash.']} href={code('contracts/src/mocks/MockUSYC.sol')} />
    <Box x={32} y={641} width={498} title="Arc testnet · verified" lines={['Chain 5042002 · CascadeVault', '$10 principal settled $40 across four invoices.', 'Open verified source and transaction receipts →']} tone="money" href={deployment.verified} />
    <Box x={590} y={747} width={498} title="Real USYC · allowlist-gated integration" lines={[deployment.allowlist, 'Testnet asset: MockUSYC · local execution trace.', 'Real USYC follows Circle access and asset integration.']} tone="yield" href={code('docs/architecture/README.md')} />
    <Box x={32} y={848} width={498} title={deployment.status} lines={[deployment.launch, 'Deployment and real-asset integration follow launch.']} href={code('docs/architecture/README.md')} />
    <a href={deployment.verified} target="_blank" rel="noreferrer"><text x="32" y="1043" className="label">VERIFIED VAULT ADDRESS</text><text x="32" y="1074" className="mono">{deployment.address}</text></a>
    <a href={code('contracts/test/USYC.t.sol')} target="_blank" rel="noreferrer"><text x="32" y="1144" className="small">USYC guard: Claim and Withdraw require zero deficit and sufficient USDC redemption liquidity at the mock asset.</text></a>
  </Step></Frame>;
}
const rational = (value: string) => { const [n, d = '1'] = value.split('/'); return Number(n) / Number(d); };
const dollars = (value: string) => `$${rational(value).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`;
function TraceTable({ y, title, rows, href }: { y: number; title: string; rows: typeof traces.reference; href: string }) {
  return <a href={href} target="_blank" rel="noreferrer"><text x="32" y={y} className="heading">{title}</text>
    {['Checkpoint / operation', 'Backing', 'Principal', 'Accrued', 'Reserve', 'Deficit', 'I(d)'].map((name, i) => <text key={name} x={[32, 290, 420, 550, 680, 810, 940][i]} y={y + 37} className="small">{name}</text>)}
    {rows.map((row, i) => <g key={row.label}><line x1="32" x2="1088" y1={y + 48 + i * 32} y2={y + 48 + i * 32} className="wire" /><text x="32" y={y + 71 + i * 32}>{row.label}</text>{(['backing', 'principal', 'accrued', 'reserve', 'deficit'] as const).map((key, j) => <text key={key} x={290 + j * 130} y={y + 71 + i * 32} className={key === 'accrued' ? 'yield' : key === 'backing' ? 'money' : ''}><title>{`${row[key]} dollars`}</title>{dollars(row[key])}</text>)}<text x="940" y={y + 71 + i * 32} className="mono">{rational(row.index).toFixed(6)}</text></g>)}
  </a>;
}
export function WaterfallDiagram({ progress = 99 }: { progress?: number }) {
  const keys = ['backing', 'principal', 'accrued', 'reserve', 'deficit'] as const;
  const labels = ['Backing value', 'Principal · units + spot', 'Accrued yield', 'Reserve', 'Deficit'];
  const tones: Tone[] = ['money', 'white', 'yield', 'control', 'deficit'];
  return <Frame id={5} height={1920} description="Five quantities in stacked rows over seven policy steps: normal accrual, reserve loss, deficit, deficit repair, reserve rebuilding, floor restoration, renewed index growth. Each column reconciles backing plus deficit equals principal plus accrued plus reserve. Separate tables show recorded Python loss_then_recovery and local CascadeVaultUSYC yield-run checkpoints.">
    <text x="32" y="112" className="heading">Loss-rule walkthrough · dollars · reserve floor $2</text><text x="32" y="141" className="small">Python reference / USYC policy · each column is one complete accounting state.</text>
    <text x="32" y="173" className="small">Stacked totals: backing + deficit (left), principal + accrued + reserve (right). All bars share a dollar scale.</text>
    {waterfall.map((step, i) => <Step key={`stack-${i}`} n={i + 1} progress={progress}>
      <a href={usycSource} target="_blank" rel="noreferrer">
        {([[{ value: step.backing, tone: 'money' }, { value: step.deficit, tone: 'deficit' }], [{ value: step.principal, tone: 'white' }, { value: step.accrued, tone: 'yield' }, { value: step.reserve, tone: 'control' }]] as const).map((stack, side) => {
          let total = 0;
          return <g key={side}>{stack.map((part, j) => {
            total += part.value;
            return <rect key={j} x={282 + i * 120 + side * 46} y={405 - total * 1.7} width="28" height={part.value * 1.7} fill={colors[part.tone]} fillOpacity=".65" />;
          })}</g>;
        })}
        <text x={275 + i * 120} y="426" className="small">B+D</text><text x={321 + i * 120} y="426" className="small">P+Y+R</text>
      </a>
    </Step>)}
    <g transform="translate(0 240)">
    {keys.map((key, j) => <g key={key}><text x="32" y={250 + j * 73} style={{ fill: colors[tones[j]] }}>{labels[j]}</text><line x1="255" x2="1088" y1={269 + j * 73} y2={269 + j * 73} className="guide" /></g>)}
    {waterfall.map((step, i) => <Step key={step.label} n={i + 1} progress={progress}><a href={usycSource} target="_blank" rel="noreferrer"><text x={280 + i * 120} y="215" className="label">STEP {i + 1}</text>{keys.map((key, j) => <g key={key}><rect x={276 + i * 120} y={224 + j * 73} width="90" height="33" rx="3" fill={colors[tones[j]]} fillOpacity=".14" /><text x={283 + i * 120} y={247 + j * 73} style={{ fill: colors[tones[j]] }}>${step[key]}</text></g>)}</a></Step>)}
    <text x="32" y="627" className="mono">backing + deficit = principal + accrued + reserve</text>
    {waterfall.map((step, i) => <Step key={step.label} n={i + 1} progress={progress}><text x="32" y={679 + i * 32} className={step.deficit ? 'yield' : ''}>{i + 1}. {step.label}</text><text x="340" y={679 + i * 32} className="small">{step.note}</text><text x="947" y={679 + i * 32} className="mono">I = {step.index.toFixed(2)}</text></Step>)}
    <TraceTable y={944} title="Python reference · loss_then_recovery · recorded checkpoints" rows={traces.reference} href={code('sim/scenarios.py')} />
    <text x="32" y="1165" className="small">Day 2: $1 yield claimed as spot before loss. Day 3: $1 new Issue; repair restores $0.50 of the $1 floor.</text>
    <TraceTable y={1240} title="CascadeVaultUSYC · local yield run · MockUSYC prices" rows={traces.local} href={code('contracts/scripts/yield-demo.mjs')} />
    <a href={code('contracts/test/USYC.t.sol')} target="_blank" rel="noreferrer"><text x="32" y="1560" className="small">Local yield run: rising prices, separate claims and share withdrawal. Solidity loss / floor traces: USYC.t.sol →</text></a>
    <a href={code('app/src/architecture/traces.json')} target="_blank" rel="noreferrer"><text x="32" y="1593" className="small">Inspect exact trace values → · USYC accrued uses balanceSheet() rounded-up liability; table displays 4 decimals.</text></a>
    <text x="32" y="1641" className="yield">During deficit: Claim / Withdraw suspended. Principal and prior claims stay intact; payments can continue.</text>
    </g>
  </Frame>;
}
export function EvidenceDiagram({ progress = 99 }: { progress?: number }) {
  return <Frame id={6} height={890} description="Python scenarios and world generation emit recorded NDJSON. The worker parses and indexes it; playback drives the globe and counters. Independently, Arc testnet contract transactions produce explorer receipts and verified source. Testnet receipts show $10 principal settling $40 in invoices."><Step n={1} progress={progress}>
    <text x="32" y="118" className="label">PLAYBACK PATH · PYTHON REFERENCE · RECORDED EVENT STREAM</text>
    {flows.slice(0, 4).map((flow, i) => <g key={flow.id}><Box x={32 + i * 272} y={155} width={240} title={flow.label} lines={flow.detail.split(' + ')} tone={i === 3 ? 'money' : 'control'} href={flow.source} />{i < 3 && <Arrow id={6} x1={272 + i * 272} x2={299 + i * 272} y1={202} tone="control" />}</g>)}
    <a href={code('app/src/data/index.ts')} target="_blank" rel="noreferrer"><text x="32" y="340">Worker index: days, invoices, payments, extensions, trades and checkpoints.</text><text x="32" y="370" className="money">Counters: Issue + Pay increase settled value. Only Issue increases deposited capital.</text></a>
    <line x1="32" x2="1088" y1="418" y2="418" stroke="#52647a" strokeDasharray="5 8" />
    <text x="32" y="468" className="label">EVIDENCE PATH · CONTRACT TRANSACTIONS · ARC TESTNET</text>
    {flows.slice(4).map((flow, i) => <Box key={flow.id} x={32 + i * 560} y={501} width={496} title={flow.label} lines={[flow.detail]} href={flow.source} />)}
    <Arrow id={6} x1={528} x2={587} y1={548} tone="control" />
    <a href={deployment.verified} target="_blank" rel="noreferrer"><text x="32" y="655" className="heading">Verified on Arc testnet · $10 principal → $40 settled invoices</text></a>
    {receipts.slice(1).map((receipt, i) => <a key={receipt.hash} href={`${explorer}/tx/${receipt.hash}`} target="_blank" rel="noreferrer"><text x={32 + (i % 2) * 560} y={710 + Math.floor(i / 2) * 40} className={i === 3 ? 'yield' : 'money'}>{receipt.label} → receipt</text></a>)}
    <text x="32" y="852" className="control">The globe plays a recorded event stream. The contract is verified on Arc testnet.</text>
  </Step></Frame>;
}
export const diagrams = [SequenceDiagram, IntervalsDiagram, StorageDiagram, TrustDiagram, WaterfallDiagram, EvidenceDiagram];
