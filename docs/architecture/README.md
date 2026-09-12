# Cascade architecture

Open the app at [/architecture](/architecture). The route uses browser history;
the static host must serve `index.html` for unknown document paths. `/#/architecture`
is also accepted. The globe is loaded only on the root route.

The submission has six questions, each rendered by the React SVG components in
[`app/src/architecture/Diagrams.tsx`](../../app/src/architecture/Diagrams.tsx).
Each diagram embeds its implementation boundary, source links, title, description,
colors and fonts. Exports show every step and need no JavaScript or external CSS.

| File | Question |
| --- | --- |
| [1-one-deposit.svg](1-one-deposit.svg) | One deposit pays several suppliers. |
| [2-principal-and-yield.svg](2-principal-and-yield.svg) | Principal moves; yield ownership stays. |
| [3-one-ledger.svg](3-one-ledger.svg) | One balance ledger, several interfaces. |
| [4-earnings-and-control.svg](4-earnings-and-control.svg) | Where earnings come from, and who controls them. |
| [5-loss-and-recovery.svg](5-loss-and-recovery.svg) | What happens when backing falls? |
| [6-stream-and-evidence.svg](6-stream-and-evidence.svg) | What you watched, and what you can verify. |
| [7-component-inventory.svg](7-component-inventory.svg) | Optional existing component inventory, copied unchanged. |

```sh
pnpm --dir app export:architecture
pnpm --dir app test
pnpm --dir app build
pnpm --dir app check:architecture
```

`check:architecture` opens the built app in local Chromium using intercepted HTTP
requests and an index.html history fallback; it binds no port. Set `CHROME_PATH`
if Chromium is not on PATH. It checks direct routes, fallback, mobile overflow,
scroll reveals, replay, reduced motion, source links and standalone exports.

The dollar waterfall is an exact policy walkthrough, followed by two captured
implementation traces in `app/src/architecture/traces.json`. To refresh them from
the Python scenario and an existing local USYC yield run:

```sh
python3 app/scripts/architecture-traces.py [path-to-local-USYC-NDJSON]
pnpm --dir app export:architecture
```

The extractor asserts each balance sheet reconciles and applies the Solidity
`balanceSheet()` ceiling to accrued liability. Table labels use relative UTC days.
The Python trace includes the claim before loss and the new Issue during deficit.
The local USYC yield trace covers rising prices, claims and share withdrawal;
`contracts/test/USYC.t.sol` contains the Solidity loss and reserve-floor cases.

Deployment plan recorded for this submission: the USDC vault is verified on Arc
testnet at `0x57838A35f05a43aD519204D7A6Ce63F52d7C1987`. Arc mainnet deployment is
planned after the September 16, 2026 launch. The vault's backing asset is USYC,
Circle's tokenized money market fund; the testnet build holds USDC (and a mock
USYC for the yield demonstration), and real USYC is used once Circle allowlists
the vault. `CascadeVaultUSYC` currently uses `MockUSYC`, with local execution
evidence; its price and mint authority is `MockUSYC.owner`. The testnet asset
boundary uses the same mock-asset design.
