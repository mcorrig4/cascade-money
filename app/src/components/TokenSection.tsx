import evidence from '../data/onchain.json' with { type: 'json' };
import { usdc } from '../data/arc-read.ts';
import type { ArcReading } from '../data/arc-read.ts';
import { midnightCountdown, snapshotUtcMs, tokenLabel, utcDate, UTC_DAY_MS } from '../data/date-token.ts';

export function TokenSection({ live, loading, tMs, referenceTMs }: { live?: ArcReading; loading: boolean; tMs: number; referenceTMs: number }) {
  const today = live?.today ?? evidence.recorded.day;
  const tickers = [0, 1, 30, 90];
  const supplies = live?.supplies ?? evidence.recorded.supplies;
  const maximum = supplies.reduce((max, s) => BigInt(s.amount) > max ? BigInt(s.amount) : max, 1n);
  const issue = evidence.transactions[11], pay = evidence.transactions[12], extend = evidence.transactions[14];
  const utcMs = live ? snapshotUtcMs(live.blockUtcMs, tMs, referenceTMs) : null;
  const command = live
    ? `cast call ${evidence.vault} \\\n  'uri(uint256)(string)' ${live.today} \\\n  --rpc-url ${evidence.rpcUrl}`
    : `cast call ${evidence.vault} \\\n  'uri(uint256)(string)' "$(cast call ${evidence.vault} 'today()(uint256)' --rpc-url ${evidence.rpcUrl})" \\\n  --rpc-url ${evidence.rpcUrl}`;
  return <section className="token-section" aria-labelledby="token-title">
    <h3 id="token-title">The token</h3>
    <p className="token-lead">One ERC-1155 contract. One token ID per calendar day.</p>
    <div data-testid="token-diagram" className="token-diagram">
      <svg viewBox="0 0 1500 330" role="img" aria-labelledby="token-diagram-title token-diagram-description">
        <title id="token-diagram-title">One vault holds all date IDs</title>
        <desc id="token-diagram-description">The CascadeVault ERC-1155 contract holds USDC backing for dated dollars. The three illustrated date IDs mature on the reference day, thirty days later, and ninety days later.</desc>
        <rect x="475" y="6" width="550" height="92" rx="16" className="token-vault-box"/>
        <text x="750" y="46" textAnchor="middle" className="token-svg-heading">ONE VAULT · ERC-1155</text>
        <text x="750" y="80" textAnchor="middle">USDC backing for every date ID</text>
        <path d="M750 98V124 M245 160V124H1255V160 M750 124V160" className="token-connector"/>
        {[0, 30, 90].map((offset, i) => <g key={offset} transform={`translate(${20 + i * 510} 160)`}>
          <rect width="460" height="157" rx="15" className="token-date-box"/>
          <text x="230" y="48" textAnchor="middle" className="token-svg-heading">{tokenLabel(offset, 0)}</text>
          <text x="230" y="94" textAnchor="middle">ID {today === null ? `today + ${offset}` : today + offset}</text>
          <text x="230" y="133" textAnchor="middle">{today === null ? `UTC day +${offset}` : utcDate(today + offset)}</text>
        </g>)}
      </svg>
      <p className="token-note">{live ? `IDs at Arc block ${BigInt(live.block)}` : `Recorded reference${today === null ? '' : ` · ${utcDate(today)} UTC`}`} · each ID is a zero-coupon dollar maturing that day.</p>
    </div>
    <p className="token-backing"><strong>The deployed vault holds USDC as backing.</strong> USYC is the planned yield reserve; a mock USYC variant backs the local yield demonstration until Circle allowlists the vault for the real asset.</p>
    <section data-testid="token-tickers" className="token-tickers" aria-label="Date-token tickers">
      <h4>{live ? 'Live names decoded from uri(id)' : loading ? 'Reading uri(id) from Arc…' : 'Recorded reference · live metadata unavailable'}</h4>
      <div className="token-ticker-grid">{tickers.map(offset => {
        const token = live?.tokens.find(token => token.id === live.today + offset);
        return <div className="token-ticker" key={offset}><strong>{token?.metadata.name ?? tokenLabel(offset, 0)}</strong><span>{today === null ? `today + ${offset}` : `ID ${today + offset}`}</span><span>{today === null ? 'UTC maturity' : `${utcDate(today + offset)} UTC`}</span></div>;
      })}</div>
      {!live && <p className="token-note">Labels follow the contract’s date arithmetic at the recorded reference day. Live uri() reads will replace them when Arc responds.</p>}
      <p className="token-rollover"><strong>{utcMs === null ? 'Next rollover · awaiting Arc UTC time' : `${midnightCountdown(utcMs)} until midnight UTC`}</strong><br/>The ticker rolls every midnight UTC by construction.</p>
      {live && <p className="token-note">Names read at block {BigInt(live.block).toString()} · {live.timestamp.replace('T', ' ').replace('.000Z', ' UTC')}</p>}
    </section>
    <section data-testid="token-ladder" className="maturity-ladder" aria-label="Maturity ladder">
      <h4>Maturity ladder · {live ? 'live supply' : 'recorded supply'}</h4>
      <p>Outstanding principal by date ID used in the 16-transaction run.</p>
      {supplies.map((s, i) => <div className="maturity-row" key={s.id ?? i}>
        <div><strong>{s.id === null ? `Run day +${evidence.recorded.supplies[i]?.offset}` : utcDate(s.id)}</strong><span>{s.id === null ? 'UTC maturity' : `ID ${s.id}`} · {usdc(s.amount)} USDC</span></div>
        <div className="maturity-track" role="img" aria-label={`${s.id === null ? 'Recorded maturity' : utcDate(s.id)}: ${usdc(s.amount)} USDC`}><span style={{ width: `${Number(BigInt(s.amount) * 10000n / maximum) / 100}%` }}/></div>
      </div>)}
      <p className="token-note">{live ? 'supplyByDate(id), read at the same block as the balances.' : 'Recorded final balance-sheet values; these are not a current RPC reading.'} This ladder covers the demonstrated IDs.</p>
    </section>
    <section data-testid="token-lifecycle" className="token-lifecycle" aria-label="Dated-dollar lifecycle">
      <h4>Issue → pay → extend → mature → redeem</h4>
      <ol>
        <li><strong>Issue</strong><p>Deposit USDC; mint dated principal to the invoice’s creditor.</p><a href={issue.url} target="_blank" rel="noreferrer">{issue.label} · transaction</a></li>
        <li><strong>Pay at face</strong><p>An earlier date pays a later bill when it meets the creditor’s accepted maturity.</p><a href={pay.url} target="_blank" rel="noreferrer">{pay.label} · transaction</a></li>
        <li><strong>Extend</strong><p>Move the date forward; own the vault yield for the added interval.</p><a href={extend.url} target="_blank" rel="noreferrer">{extend.label} · transaction</a></li>
        <li><strong>Mature</strong><p>When ID ≤ today’s UTC day number, that balance is spot. No maintenance mint is needed.</p><a href={`${evidence.contractSourceUrl}#L493`} target="_blank" rel="noreferrer">Mature-balance rule · contract source</a></li>
        <li><strong>Redeem</strong><p>withdraw burns mature principal and sends the holder the matching USDC.</p><a href={`${evidence.contractSourceUrl}#L327`} target="_blank" rel="noreferrer">withdraw · contract source</a></li>
      </ol>
    </section>
    <section data-testid="token-contract" className="token-contract" aria-label="Token contract details">
      <h4>Read the contract yourself</h4>
      <p><strong>Standard: ERC-1155</strong> · Arc testnet · chain {evidence.chainId}</p>
      <a href={evidence.sourceUrl} target="_blank" rel="noreferrer">Verified source on Arcscan</a>
      <code className="arc-address">{evidence.vault}</code>
      <p><strong>ID = floor(unixTimestampSeconds / 86400)</strong><br/>Equivalently, floor(tMs / {UTC_DAY_MS}). Maturity begins at ID × 86400 seconds since the Unix epoch, at midnight UTC.</p>
      <p><a href={`${evidence.contractSourceUrl}#L162`} target="_blank" rel="noreferrer">today() arithmetic</a> · <a href={`${evidence.metadataSourceUrl}#L27`} target="_blank" rel="noreferrer">Metadata label construction</a></p>
      <pre><code>{command}</code></pre>
      <p className="token-note">{live ? `Read uri(${live.today}), today's ID at the block above. ` : 'The inner read obtains today’s ID directly from the vault. '}Read-only; no wallet or signature required.</p>
    </section>
  </section>;
}
