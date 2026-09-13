# Branching proof and checkpoint verification

The display proof settles **$450,000,000 on one $100,000,000 Issue**, reaching **4.5× reuse on day 4**. Every payment carries the original day-90 units; the story creates no additional principal or entitlements after Issue.

The final fixed-core 365-day run took **317.216 seconds**, including NDJSON and metrics output. **The under-90-second target remains unmet.** The prior overlapping run took 376.096 seconds. The fixed-core repeat used CPU 7 with our other verification jobs stopped; the host itself is shared, so this is not an exclusive-machine benchmark.

## Branch allocation and necessary continuation

The specified split tree alone reaches exactly 4×: $100M to Samsung Display, $100M to Corning, $100M across Corning's split, and $100M across the next split. Splitting divides value; it does not multiply settlement value at that generation.

To satisfy the request to exceed four, the chosen default adds two input-transport invoices: Superior Sands Refining → Pacific Freight ($30M), and Dow → Great Plains Rail ($20M). This continuation was raised for clarification and then stated as the working assumption. It adds genuine payment hops without minting principal.

| Payer | Payee | Amount | Day | Branch |
|---|---|---:|---:|---|
| Apple | Samsung Display | $100M | 0 | root |
| Samsung Display | Corning | $100M | 1 | root |
| Corning | Great Lakes Silica | $60M | 2 | silica |
| Corning | Ohio Valley Chemicals | $40M | 2 | chemicals |
| Great Lakes Silica | Superior Sands Refining | $40M | 3 | silica/refining |
| Great Lakes Silica | Pacific Freight | $20M | 3 | silica/freight |
| Ohio Valley Chemicals | Dow | $25M | 3 | chemicals/feedstock |
| Ohio Valley Chemicals | Great Plains Rail | $15M | 3 | chemicals/rail |
| Superior Sands Refining | Pacific Freight | $30M | 4 | silica/refining/freight |
| Dow | Great Plains Rail | $20M | 4 | chemicals/feedstock/rail |

The final proof-only holdings are $50M at Pacific Freight, $35M at Great Plains Rail, $10M at Superior Sands Refining and $5M at Dow. The quick bootstrap fixture independently verifies this graph with 32 events and one entitlement. Editable captions and branch paths are in `sim/story_annotations.json`.

## Verification and profiling

- The 86-test suite passed, including the full-size 30-day comparison of checkpoint versus per-operation verification. **The entire metrics reports match**, including exact rational metrics, cent balances, funding records and daily balance sheets.
- Two additional regression tests passed, along with eight existing fixture/schema tests rerun: CLI default selection, and guards forbidding whole-ledger map iteration or structural scope scans during ordinary operations. **88 distinct tests passed in total.** See `tests.txt` and `additional-tests.txt`.
- Stress: 10,000 attempts, 7,002 accepted, 2,998 expected rejections, zero hard-invariant violations. All hard checks run after each operation by default; full ledger audits also run at checkpoints and completion. `--exhaustive` remains available.
- The complete fixed-core year metrics match the first year run exactly. See `repeat-equivalence.json`.
- The stream audit verifies the calendar, geographic delivery sites, daily totals, checkpoint checks, branch markers and proof counters. See `stream-audit.json`.

`sim run` and paired world runs now default to `--check-every checkpoint`. Operation preconditions and breach checks remain active, deferred hard checks are explicitly null, and full reconciliation runs at every checkpoint and at the end. `sim run --check-every 1` enables per-operation verification. Stress and scenarios keep per-operation verification as their default. The bootstrap fixture retains per-operation checks.

The 30-day cProfile captures are `before.pstats` and `after.pstats`. The latter identified immutable map updates (126,108 calls, 5.407 profiled seconds) and State copies (4.276 profiled seconds) as substantial preparation costs; changed-record difference work took 0.647 profiled seconds. These profiles have profiling overhead and different verification/story configurations, so their elapsed times are not isolated speed comparisons.

Preparation and scope fixes:

- Empty map/set updates reuse the original object.
- Composed weak ancestor journals retain exact changed-key scopes even when intermediate snapshots are collected, avoiding structural bucket scans during operations.
- Persistent ordered entitlement logs append by copying at most 64 IDs; account and maturity-ending histories no longer copy all preceding IDs on each append.
- Claims skip unchanged dated-balance maps during aggregate updates. Invoice aggregates process only changed invoices.
- Story-fund protection uses a precomputed daily actor set instead of scanning the script for every actor every day.

Full daily reconciliation remains mandatory. Final transition timings are:

| Category | Seconds |
|---|---:|
| event_encoding | 44.400 |
| invariants | 110.780 |
| prepare | 68.543 |
| scope_diff | 46.046 |

These timings exclude other runner/world work. The 90-second goal needs further work; no additional verification was silently disabled.

## Annual headline results

| Metric | Result |
|---|---:|
| Suppliers | 2,000 |
| Invoices | 12,029 |
| Events | 254,358 |
| Gross settled | $1,449,470,964.64 |
| Principal committed | $508,228,500.00 |
| Reuse ratio | 3.052100× |
| Historical invoice funding deficit | $175,157,610.39 |
| Pay operations linked to Extend | 23.7989% |

These annual figures include the other stories and generated economy. The proof-specific committed counter remains $100M. Funding deficits, cash-need shortfalls, circulation efficiency, yield cost and window metrics remain separate in the metrics JSON.

## Scenarios

| Scenario | Result |
|---|---|
| coordinated withdrawal and extension | PASS |
| early bound pay fails | PASS |
| loss then recovery | PASS |
| partial extension ten times | PASS |
| two accounts recommitting | PASS |
| yield collapse | PASS |

## Artifacts and commands

Current artifacts are under `artifacts/branching/`; older corrected-story outputs are historical.

```sh
python3 -m sim run --world apple --days 365 --seed 1 --out artifacts/branching/apple-final.ndjson
python3 -m sim run --world apple --days 30 --seed 1 --check-every 1 --out operation-checked.ndjson
python3 -m sim scenarios --out-dir artifacts/branching/scenarios
python3 -m sim stress --ops 10000 --out artifacts/branching/stress.ndjson
PYTHONPATH=/tmp/cascade-testdeps python3 -m pytest -q
```

The fixed-core run additionally used `os.sched_setaffinity`; its CPU selection is saved in `affinity.json`. The complete event schema and examples are in [EVENTS.md](EVENTS.md), and the policy/branch decisions are in [DECISIONS.md](DECISIONS.md#21-branching-proof-and-baked-stream-verification).
