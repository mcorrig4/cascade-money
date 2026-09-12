# Phase B implementation and verification

Phase B is implemented. The performance target is **not met**: the exact-date
365-day run took **1141.512 seconds**, including NDJSON and metrics
output. The bucketed run took **1024.322 seconds**. Both run with
all hard checks and both breach indicators enabled.

## Validation

- Python 3.13.5 from PATH; runtime uses the standard library.
- **66 pytest tests passed**, including the Hypothesis state machine and exact
  capital-flow property. Command: `PYTHONPATH=/tmp/cascade-testdeps python3 -m pytest -q`.
  Test-only Hypothesis and sortedcontainers were copied from an existing local
  environment to `/tmp/cascade-testdeps`; no system packages were installed.
  Fresh environments can use `requirements-dev.txt` in their own virtual environment.
- Stress: **10,000 random attempts**, **6,980 accepted**,
  **3,020 expected rejections**, **zero hard-invariant
  violations**, 250 checkpoints; 132.815 seconds.
- The retained Phase A fixture still emits ten events and settles $400M using
  $100M dated day 90. The full-world processor-first Apple story independently
  reaches the same 4x shape on day 3.
- Each full world contains 2,000 suppliers plus two anchors and two window actors,
  12,018 invoices, 365 checkpoints and 365 daily summaries.
- Independent streaming reconciliation verified sequence numbers, ISO dates,
  geographic delivery-site references, every daily counter and closing total,
  early Apple story totals, and absence of hard-invariant failures in both streams.
- Exact and bucketed CLI paths and the paired CLI were exercised. The full
  comparison is derived from the completed year runs with identical seed and
  exogenous generation settings.

## Year results (seed 1, cash need 10%)

| Metric | Exact date | Seven-day buckets |
|---|---:|---:|
| Gross invoices settled | $945,975,310.16 | $946,310,080.64 |
| Fresh principal committed | $505,303,300.00 | $505,303,300.00 |
| Settled / committed | 1.872094 | 1.872757 |
| Historical invoice funding deficit | $178,251,681.44 | $178,544,495.28 |
| Projected future invoice shortfall | $31,579,178.89 | $31,845,722.31 |
| Off-network cash shortfall | $24,802,816.93 | $24,804,277.93 |
| Pay operations linked to Extend | 22.905028% | 21.028037% |
| Circulation efficiency per day | 0.012988 | 0.012903 |
| Entitlement payout per dollar settled | 0.008095 | 0.007979 |

Historical funding deficit is measured once at each invoice deadline and is not
an ending vault solvency deficit. Future deadlines and off-network cash needs
are reported separately. Settled/committed is the reuse ratio, not circulation
efficiency. Full precision and the separate window curve, accepted bounds and
365 balance sheets are retained in the metrics JSON.

## Named scenarios

| Scenario | Result |
|---|---|
| coordinated withdrawal and extension | PASS |
| early bound pay fails | PASS |
| loss then recovery | PASS |
| partial extension ten times | PASS |
| two accounts recommitting | PASS |
| yield collapse | PASS |

## Performance and limitations

The largest measured exact-run transition category was **invariants**,
**451.351 seconds**. Full transition timings:

| Category | Seconds |
|---|---:|
| event_encoding | 155.097 |
| invariants | 451.351 |
| prepare | 174.215 |
| scope_diff | 153.423 |

These categories exclude world-policy iteration and other runner work. Each run
uses one Python thread; the host was shared with other verification work, so
these are observed wall times, not isolated CPU benchmarks. Exact fraction
arithmetic, complete checkpoint reconciliation and repeated snapshots are
material costs. The exact stream is 3500.6 MB and has
255,541 events; the bucketed stream is 3319.3 MB
and has 255,595 events. No checks were thinned to meet the target.

Immutable sharded ledger maps and replay sets share unchanged storage. Every
transition check runs; exact identity diffs establish which immutable records
changed, and every checkpoint fully reconciles the ledgers. Equivalent
entitlement intervals are grouped algebraically during reconciliation. Exact
rational accrual and Claim rounding are unchanged.

## Changes and implementation choices

- The requested geographic year world uses a processor-first Apple route;
  the original Foxconn-first fixture remains available separately.
- Day zero is a bootstrap cutoff. Days 0–364 cover 2025-09-09 through 2026-09-08,
  yielding 365 daily records and 364 elapsed earning intervals.
- Approximate geographic pins and fictional purchase relationships are explicit.
  Delivery can target a third-party assembler, following the product examples.
- The baseline uses explicit opening window capital, a fixed illustrative 4%
  investment input and funded 6.5% annualized simple-discount quotes. These are
  simulation assumptions, not a promised return or market-discovery feature.
- A zero asset valuation suspends pricing fresh Issue deposits until recovery.
- The 60-second target remains a reported limitation. All protocol interpretations
  and defaults are recorded in [DECISIONS.md](DECISIONS.md).

## Files and artifacts

Implementation: `sim/core.py`, `sim/invariants.py`, `sim/storage.py`,
`sim/events.py`, `sim/geography.py`, `sim/story_annotations.json`, `sim/world.py`,
`sim/scenarios.py`, `sim/metrics.py`, `sim/__main__.py`, `sim/__init__.py`.
Tests: existing Phase A tests plus `tests/test_phase_b.py`,
`tests/test_properties.py`, `tests/test_storage.py`; dependencies in
`requirements-dev.txt`. Documentation: [EVENTS.md](EVENTS.md),
[DECISIONS.md](DECISIONS.md), [GEOGRAPHY.md](GEOGRAPHY.md) and the root README.

Generated artifacts are local and gitignored:

- `artifacts/apple-365.ndjson` and `artifacts/apple-365.metrics.json`
- `artifacts/bucketed-365.ndjson` and `artifacts/bucketed-365.metrics.json`
- `artifacts/comparison.json`
- `artifacts/stress.ndjson`, `artifacts/stress-result.json`
- `artifacts/scenarios/` with six streams and `results.json`
- `artifacts/stream-audit.json`
- `events.ndjson` retains the small ten-event Phase A fixture.
