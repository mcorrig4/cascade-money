# Cascade

Dated dollars: money that pays bills before it becomes cash.

A Cascade dollar is one dollar, redeemable on a calendar date, backed one to one by USDC in a vault on Arc. Dollars with the same date are identical. An earlier dollar pays any bill due later, at face value. The date only moves forward.

- `docs/spec-tier1-v3.1.md` — the protocol specification.
- `sim/` — the reference implementation and simulation core.

Phase A implements atomic Issue, Transfer and Pay, creditor-approved invoice
bounds, replay protection, applicable invariant checks and a deterministic Apple
fixture. Run with Python 3.11+:

```sh
python3 -m pytest -q
python3 -m sim run --world apple-fixture --days 5 --seed 1 --out events.ndjson
```

The fixture emits ten real events: $100 million dated day 90 settles four
$100 million invoices. All actions execute on bootstrap day zero. `--days` records
the requested viewing horizon; daily checkpoints, yield allocation, the remaining
operations, full world, scenarios and stress runner are deferred to Phase B.
Reuse is reported as 4x; circulation efficiency remains unavailable until daily
checkpoints measure elapsed principal dollar-days.

- [Event schema and example lines](docs/EVENTS.md)
- [Approved implementation decisions and scope](docs/DECISIONS.md)
