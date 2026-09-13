# Cascade

Dated dollars: Money with a date.

[Architecture page](https://cascade.vellum.network/architecture) · [Submission SVGs and export instructions](docs/architecture/README.md)

A dated dollar is one dollar of principal, redeemable on a calendar date, fully
backed by value held in a vault on Arc. Every dated dollar sharing a date is
interchangeable with every other, and a dollar dated earlier than a bill settles
that bill at face value — no pricing, no negotiation, no credit check. Four
operations carry the whole system: issue a dated dollar against an invoice, pay
a bill with dated dollars, extend a dollar's date to earn the vault's yield for
the days you commit it, and withdraw once it matures.

The vault is a Solidity contract on Arc. It holds USDC and is built to hold
USYC, Circle's tokenized money market fund, as its yield source — a mock USYC
variant backs the local yield demonstration until Circle allowlists the vault
for the real asset. The vault is deployed and verified on Arc testnet at
`0x57838A35f05a43aD519204D7A6Ce63F52d7C1987`, where a four-invoice chain
(Apple to Foxconn to TSMC to Corning to a glass supplier, with a thirty-day
extension from day ninety to day one hundred twenty) has already been executed
and linked on chain, demonstrating the mechanism end to end across sixteen
transactions. The app's Verify on Arc panel reads that chain live from the
testnet — actors, transactions, and explorer links — rather than embedding a
static copy of it. A Python reference implementation runs the same protocol,
asserting every invariant after every operation, and generates a separate,
larger illustrative run — a full year of the display chain (Apple to Samsung
Display to Corning to a silica supplier to a freight carrier) — served to the
app as a 32 MB filtered event stream and played on a live 3D globe at
[cascade.vellum.network](https://cascade.vellum.network), with each company
rendered under its own logo, a ledger that stays compact during playback and
expands on pause, and scene labels naming each location. Two illustrative
runs, clearly named: the on-chain run proves the mechanism, the globe plays
the year.

Apple Park and the Fifth Avenue store appear on the globe as modeled 3D
landmarks at the shots that visit them. A separate, local-only photorealistic
tiles scene exists purely as a recording environment for the submission
film: it requires a local Google Maps Tiles API key, is gated behind the
`VITE_ENABLE_TILES` build flag, and is off — and absent from the built
bundle — in production. The film itself lives under [`film/`](film/): a
Remotion package that composites captured app footage inside an animated
browser-frame treatment alongside motion-graphic title and data scenes.

**Built during ETHOnline 2026.** The Tier One protocol specification, the
Solidity vault and its Arc testnet deployment, the Python reference simulator
and its invariant test suite, and the globe app were all built for this event:

- [`docs/`](docs/) — the Tier One protocol specification and architecture docs
- [`sim/`](sim/) — the Python reference implementation of the protocol
- [`contracts/`](contracts/) — the Solidity vault on Arc, built and tested with Foundry
- [`app/`](app/) — the globe app, live at [cascade.vellum.network](https://cascade.vellum.network)
- [`film/`](film/) — the Remotion film package used to produce the submission video

## Verify it

- **Vault contract (verified on Arc testnet):** `0x4E7D5b438d38b93b811F7f847613100023d7DafE`
  — [view on Arcscan](https://testnet.arcscan.app/address/0x4e7d5b438d38b93b811f7f847613100023d7dafe#code)
- **On-chain run report:** [`contracts/deployments/testnet-demo-run.md`](contracts/deployments/testnet-demo-run.md)
- **Verify on Arc panel:** open the app and use its Verify on Arc panel — it reads the
  four-invoice chain's actors, transactions, and explorer links live from Arc testnet,
  not from a bundled copy.

**Run the reference implementation:**

```sh
python -m sim scenarios
python -m sim run --world apple --days 365 --seed 1 --out events.ndjson
```

For the test suite, install `requirements-dev.txt` in a virtual environment and run `pytest`:

```sh
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
pytest -q
```

**Run the contracts tests:**

```sh
cd contracts && forge test
```

**Run the app:**

```sh
pnpm --dir app install && pnpm --dir app dev
```

The local-only photorealistic tiles scene needs a Google Maps Tiles API key in
`app/.env.local` and `VITE_ENABLE_TILES=1`; without them the build gate keeps
it out entirely, which is how the production build ships.

**Run the film (Remotion Studio):**

```sh
pnpm --dir film start
```
