# Cascade

Dated dollars: money that pays bills before it becomes cash.

The Python 3.11+ reference simulator implements the dated-dollar protocol in
[the Tier One specification](docs/spec-tier1-v3.1.md): atomic settlement,
exact yield accrual, reserve and deficit accounting, and funded discount-window
trades. It models treasury backing; it does not integrate a chain.

```sh
python3 -m sim run --world apple --days 365 --seed 1 --out events.ndjson
python3 -m sim scenarios --out-dir artifacts/scenarios
python3 -m sim stress --ops 10000 --out artifacts/stress.ndjson
python3 -m sim compare --days 365 --seed 1 --out-dir artifacts/paired
```

Create output directories before `run` or `stress` when needed. The full world
contains 2,000 suppliers, 12,000 generated invoices and additional scripted
purchases. Both Apple and Tesla stories play in parallel. `--world tesla` is an
alias for this shared world. Day zero is 2025-09-09. All purchases are illustrative.
Use `--cash-need-fraction 0.2`, `--suppliers`, `--invoices`, `--days` and `--seed`
to vary the run. `--date-policy bucketed` uses seven-day accepted-bound buckets;
`compare` produces both streams, independent metrics and their differences.

NDJSON schema v2 includes geographic nodes, line items, calendar dates, camera
story markers and daily summaries. A full run writes a `.metrics.json` sidecar.
Timing measurements appear only on stdout, preserving deterministic artifacts.
Exact fractions and comprehensive invariant checks make long runs and output
large; the 60-second performance target is not yet met.

For development, install `requirements-dev.txt` in an isolated environment and
run `python3 -m pytest -q`. Runtime uses only the standard library. Tests require
pytest and Hypothesis; the property tests are mandatory, never silently skipped.

The retained Phase A fixture is available with:

```sh
python3 -m sim run --world apple-fixture --days 5 --seed 1 --out events.ndjson
```

It emits ten events and settles $400M with $100M dated day 90, all on bootstrap
day zero. Its `--days` records a viewing horizon, not elapsed checkpoints.

- [Event schema and example lines](docs/EVENTS.md)
- [Implementation decisions](docs/DECISIONS.md)
- [Geographic provenance](docs/GEOGRAPHY.md)
