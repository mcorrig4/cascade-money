# Phase B story and performance revision

The corrected display chain reaches **$400 million settled on $100 million locked until maturity day 90, by simulated day 3**. All five requested story routes replace the previous scripts, including the ten-event quick fixture. There is no scripted TSMC-to-Corning payment.

The performance target remains **unmet**. The final exact-date 365-day run took **392.866 seconds**, including NDJSON and metrics output, against the 90-second target. The bucketed run took **379.940 seconds**. Each uses one Python thread on a shared host; the runs overlapped, so these are observed wall times rather than isolated CPU benchmarks. All default operation checks, full daily reconciliation and final reconciliation were enabled.

## Validation

- **82 tests passed**, including the Hypothesis state machine, capital-flow property, exact arithmetic properties and deliberately corrupted aggregate/schedule tests. See `artifacts/corrected/tests.txt`.
- Latest incremental stress: **10,000 attempts**, **7,002 accepted**, **2,998 expected rejections**, **zero hard-invariant violations**, **250 checkpoints**, **17.528 seconds**. An exhaustive 10,000-attempt run also passed and returned identical operation results; it took 369.966 seconds.
- All six scenarios pass. The corrected quick fixture emits ten events.
- Both year runs contain **2,000 suppliers**, two anchors and two window participants, **12,022 invoices**, 365 checkpoints and 365 daily summaries. The exact stream contains **252,289 events**, the bucketed stream **252,566**.
- The final exact metrics dictionary is **identical** to a frozen corrected-story reference captured before performance changes, including every checkpoint balance sheet, window metric and funding record. No financial metric changed during optimization. See `financial-equivalence.json`.
- An independent stream audit verifies sequence numbers, calendar dates, delivery sites, every daily counter, closing totals and the early display proof. See `stream-audit.json`.

## Year results

Seed 1, 10% off-network cash need, days 0–364 (2025-09-09 through 2026-09-08).

| Metric | Exact date | Seven-day buckets |
|---|---:|---:|
| Gross invoices settled | $1,351,442,053.41 | $1,352,019,858.28 |
| Fresh principal committed | $460,696,600.00 | $460,696,600.00 |
| Settled / committed | 2.933475 | 2.934729 |
| Historical invoice funding deficit | $175,186,811.19 | $175,577,390.91 |
| Future invoice funding shortfall | $38,695,655.51 | $38,860,218.49 |
| Off-network cash shortfall | $81,912,025.30 | $81,986,079.05 |
| Pay operations linked to Extend | 23.9304% | 21.6312% |
| Circulation efficiency per day | 0.027374 | 0.027800 |
| Entitlement payout per dollar settled | 0.003865 | 0.003751 |

Historical invoice funding deficit records shortfall at invoice deadlines; it is not a vault solvency deficit. Future invoice and off-network cash shortfalls are separate. The ending exact vault deficit is **$0.00**. The reuse ratio and circulation efficiency remain separate. Metrics JSON retains exact fractions, all funding deadlines, window volumes and clearing discounts by date, and all 365 balance sheets.

## Scenarios

| Scenario | Result |
|---|---|
| coordinated withdrawal and extension | PASS |
| early bound pay fails | PASS |
| loss then recovery | PASS |
| partial extension ten times | PASS |
| two accounts recommitting | PASS |
| yield collapse | PASS |

## Performance

The same corrected financial reference took **1089.351 seconds** before optimization (with no NDJSON destination). The final run includes NDJSON output and is 2.77 times faster. The user's prior 921-second run used the old story configuration, so it is not an identical-workload comparison.

The largest measured transition category is **invariants**, at **181.456 seconds**.

| Category | Seconds |
|---|---:|
| event_encoding | 42.360 |
| invariants | 181.456 |
| prepare | 68.193 |
| scope_diff | 46.783 |

These categories exclude world-policy iteration, runner metadata and other work. The exact stream is 1310.3 MB; the bucketed stream is 1318.6 MB. No check thinning was used. Further performance work is required to reach 90 seconds.

## Implementation changes

- Editable scripts now follow the display, processor, battery and assembly chains from Apple, plus the parallel Tesla battery chain. Apple consigns components to Foxconn. Sumco/Wacker and five fictional firms have the requested geographic pins and count within the supplier total.
- Script actors with an outgoing payment tomorrow hold their story funds for that hop. Display markers retain `story_id=apple-duo` for the camera consumer; the other Apple routes have distinct IDs.
- Immutable radix maps journal actual changed records. Incremental checks reconcile per-date supply, effective spot, near-term liquidity, invoices, accrued value and claimable value. Full ledger reconciliation runs at every checkpoint and at run end. End audits also reconstruct future entitlement schedules.
- Scheduled entitlement activity and queued claims replace repeated history scans. Exact common-denominator arithmetic avoids repeated fraction normalization; spendable cents and Claim's single downward rounding are unchanged.
- Ordinary event snapshots contain compact integer display totals. Checkpoint and day-summary snapshots retain exact asset quantity and rational totals. Exact index values and Claim payloads remain in the stream. Schema version remains 2.
- `--check-every 1` is the default. Explicit larger values defer intermediate hard checks and expose null check results; breaches, checkpoint checks and final checks remain enabled. `stress --exhaustive` adds full ledger reconciliation at each selected attempt.

New supporting modules are `sim/index.py` and `sim/money.py`; the added regression and property coverage is in `tests/test_incremental.py`. The core, invariant checker, immutable storage, world scripts, geography, event schema and CLI were updated.

Protocol interpretations remain in [DECISIONS.md](DECISIONS.md); the complete schema and examples are in [EVENTS.md](EVENTS.md). The historical Phase B report is superseded by this report.

## Reproduction and artifacts

```sh
PYTHONPATH=/tmp/cascade-testdeps python3 -m pytest -q
python3 -m sim run --world apple-fixture --days 5 --seed 1 --out events.ndjson
python3 -m sim run --world apple --days 365 --seed 1 --check-every 1 --out artifacts/corrected/apple-365.ndjson
python3 -m sim run --world apple --days 365 --seed 1 --date-policy bucketed --check-every 1 --out artifacts/corrected/bucketed-365.ndjson
python3 -m sim scenarios --out-dir artifacts/corrected/scenarios
python3 -m sim stress --ops 10000 --check-every 1 --out artifacts/corrected/stress-incremental.ndjson
python3 -m sim stress --ops 10000 --check-every 1 --exhaustive --out artifacts/corrected/stress.ndjson
```

Runtime dependencies are standard-library only. Test dependencies came from an existing local environment; no system packages were installed. Fresh environments can use `requirements-dev.txt` in a virtual environment.

Generated year streams, exact metrics, comparison, timing reports, scenario streams, stress streams, financial equivalence and stream audit results are in `artifacts/corrected/` (gitignored). `events.ndjson` remains the small corrected fixture. Older files directly under `artifacts/` are historical and should not drive the corrected stories.
