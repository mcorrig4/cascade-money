# Cascade

Dated dollars: money that pays bills before it becomes cash.

A dated dollar is one dollar of principal, redeemable on a calendar date, fully
backed by value held in a vault on Arc. Every dated dollar sharing a date is
interchangeable with every other, and a dollar dated earlier than a bill settles
that bill at face value — no pricing, no negotiation, no credit check. Four
operations carry the whole system: issue a dated dollar against an invoice, pay
a bill with dated dollars, extend a dollar's date to earn the vault's yield for
the days you commit it, and withdraw once it matures.

The vault is a Solidity contract on Arc, backed by USDC, deployed and verified
on Arc testnet at `0x57838A35f05a43aD519204D7A6Ce63F52d7C1987`, with an Apple
supply-chain payment chain already executed and linked on chain. A Python
reference simulator implements the same protocol, asserting every invariant
after every operation, and generates the illustrative global supply-chain year
that the public app plays on a live 3D globe at
[cascade.vellum.network](https://cascade.vellum.network).

**Built during ETHOnline 2026.** The Tier One protocol specification, the
Solidity vault and its Arc testnet deployment, the Python reference simulator
and its invariant test suite, and the globe app were all built for this event:

- [`docs/`](docs/) — the Tier One protocol specification and architecture docs
- [`sim/`](sim/) — the Python reference implementation of the protocol
- [`contracts/`](contracts/) — the Solidity vault on Arc, built and tested with Foundry
- [`app/`](app/) — the globe app, live at [cascade.vellum.network](https://cascade.vellum.network)

## Verify it

- **Vault contract (verified on Arc testnet):** `0x57838A35f05a43aD519204D7A6Ce63F52d7C1987`
  — [view on Arcscan](https://testnet.arcscan.app/address/0x57838a35f05a43ad519204d7a6ce63f52d7c1987#code)
- **On-chain run report:** [`contracts/deployments/testnet-demo-run.md`](contracts/deployments/testnet-demo-run.md)

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
