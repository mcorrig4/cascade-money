# Cascade implementation decisions

Authority: [Tier One v3.1](spec-tier1-v3.1.md). These interpretations were approved
after the Stage 1 plan. Quotes below reproduce the rule being resolved. Phase B implements the remaining operations, checkpoints, scenarios, metrics
and the illustrative geographic world. The legacy Phase A fixture is preserved.

## 1. Loss detection and capital flows

> At a checkpoint where the backing's dollar value fell over the day:

> Deposits and withdrawals are capital flows and never count as income.

Use the capital-flow-adjusted, fee-net investment result to detect losses:
`G_d = gross_marked_backing - previous_backing - deposits + withdrawals - fees`.
Closing backing is gross marked backing minus that same fee. If closing backing
already includes fees, use `G_d = closing_backing - previous_backing - deposits + withdrawals`
without subtracting fees again. Apply loss rules exactly when `G_d < 0`.
Withdrawals alone must not look like losses; deposits must not conceal losses.
Claim is an internal liability conversion, not an external capital flow.

## 2. Cents, exact accrual and Claim rounding

> Its value is amount times (I(E) minus I(S minus 1)), which counts every day from S through E inclusive, computable once I(E) is published.

Spendable balances, invoice amounts and payments are integer cents. Index values
and entitlement accrual use exact rational arithmetic, not floats. Claim rounds
down once to whole cents; the exact fractional-cent residual goes to reserve.
Accrual is not rounded daily. Accounting reserve/deficit values and calculation
residuals can therefore be rational cents even though spendable balances cannot.
JSON represents an exact rational as the reduced string `numerator/denominator`.
Asset quantities are exact rational asset units, distinct from cents; an Issue
of X cents deposits `X / checkpoint_asset_price_cents` asset units.

## 3. Previous-checkpoint denominator

> Principal notional is the sum of all outstanding units and spot at the previous checkpoint.

Use that frozen principal, never current principal, backing value or active
entitlement notional. Issue records its capital inflow separately and does not
rewrite the frozen denominator. I(0)=1 is the bootstrap index. In Phase A, only
the day-zero bootstrap batch exists; the initial previous-checkpoint principal
remains zero. The day-zero checkpoint seals the bootstrap batch's backing and principal as
the opening baseline before processing day 1. There is no division or income
checkpoint in Phase A.

## 4. Cutoff versus execution day

> An operation on day d participates in income from day d plus one onward. A unit dated D matures at the cutoff on day D.

> At the checkpoint on day D, every unit dated D becomes spot. This is a rule of interpretation, not a transaction: a unit whose date has passed is spot for every purpose without any maintenance operation.

Keep execution day `d` distinct from completed cutoff day `c`. Effective spot is
explicit spot plus stored buckets with `date <= c`; dated balances contain only
`date > c`. The brief's `date <= today` means the completed cutoff boundary for
maturity interpretation. Normal day-d operations precede its closing checkpoint;
the day-zero bootstrap is anchored by I(0)=1. Entitlement Claim requires its end
index to have been published. No maturity pass rewrites individual balances.
When spending effective spot, consume explicit spot first, then matured buckets
in ascending date order; recipients receive explicit spot. An API selection of
a matured bucket as still-dated units is rejected; select effective spot instead.

## 5. Empty or expired Issue earning intervals

> A creditor that wants payment as early as possible sets M equal to the day of signing.

> The debtor receives an entitlement with S equal to tomorrow and E equal to M, on X.

Issue still mints at signed M when M is today or already past. Record the
entitlement, but define `E < S` as an empty, zero-value interval. Do not evaluate
an index subtraction that would produce negative yield for an expired interval.
Before S, accrued value is zero; after E, a nonempty interval freezes at I(E).

## 6. Reserve routing, repair and zero principal

> minus any amount routed to the reserve or the deficit under the loss rules.

> Each day's distributable income is allocated exactly once, across entitlements active that day in proportion to amount, with the unallocated remainder to the reserve.

> It receives income on dollar-days with no entitlement, all income during deficit repair, and any share of income set by policy.

Positive investment result first repairs deficit, restores the reserve policy
floor, and applies any discretionary reserve share. Divide the remaining H by
previous principal P. Active entitlement notional A receives `A * H/P`; the
remaining `H - A * H/P` goes to reserve. That unentitled remainder is not also
subtracted before calculating the index. Income that repairs deficit cannot
simultaneously increase reserve. With P=0, the index stays flat and remaining
income goes to reserve.

> all subsequent income is routed to the deficit until it is zero, then to the reserve until the reserve regains its policy floor, and only then does I resume rising.

Apply the waterfall within one checkpoint: any remainder after completing repair
may increase the index that same day. Restore the configured floor whenever
reserve is below it, including after a loss that did not create deficit. Claim
and Withdraw can resume once deficit is zero and liquidity passes; they do not
wait for reserve to regain its floor. Already claimed yield is never clawed back.

## 7. Liquidity suspension is distinct from dollar deficit

> a breach does not fail an operation, it switches the vault into deficit mode.

> A shortfall suspends Withdraw and Claim until it clears.

The specific liquidity rule governs liquidity-only breaches. Maintain independent
solvency and liquidity indicators. Either suspends Claim and Withdraw. A solvent
liquidity breach neither creates a dollar deficit nor redirects income into
deficit repair. Report breaches separately from hard-invariant results.

## 8. Fixed policy defaults and backing model

> with N and the eligible asset set fixed by vault policy.

> any share of income set by policy.

> until the reserve regains its policy floor

Default N=7 days, fees=0, reserve floor=0 cents, discretionary reserve share=0.
The baseline's sole treasury backing asset is fully immediately realizable.
The policy can specify a fixed exact realizable fraction for liquidity fixtures;
it is not a dynamic liquidity provider or a market. Policy is fixed for a run
and serialized in run metadata. No reserve or window capital is silently created.

## 9. Exact-date and bucketed reporting

> Two runs, exact-date and bucketed, with the delta.

Use seven-day buckets, anchored at day zero, rounding accepted bounds down before
creditor approval and invoice creation. Do not round a delivered date beyond an
existing signed M. Issue always mints at the resulting M, even when it gives an
empty earning interval. Paired runs share exogenous inputs; report that their
creditor-approved bound policies differ. The `compare` command runs both policies against identical generated inputs.

## 10. Story counters and circulation efficiency

> Circulation efficiency: gross invoice value settled before maturity, per dollar-day of principal locked. Reported on its own.

Count Issue and Pay settlement amounts funded by still-locked units in the
circulation numerator; exclude the spot portion. The denominator is actual
principal dollar-days, including the final earning/maturity day. The separate
reuse counter is gross settled invoice value divided by deposited principal.
The Apple fixture's actual Issue and Pay events produce $400m / $100m = 4x.
Do not label this ratio circulation efficiency. A full 90-day $100m lock would
give $400m / ($100m * 90) = 0.04444... per day, but Phase A has no elapsed
checkpoints: observed principal-cent-days is zero and efficiency is explicitly
null/unavailable, rather than fabricated from the requested horizon.

## 11. Story conservation card and asset mismatch

The Stage 1 story draft said (historical wording; the story lane may revise it):

> Principal: backing is never less than units plus spot plus unclaimed yield.

The authoritative spec says:

> Backing dollar value plus deficit equals or exceeds units plus spot plus the accrued value of all unclaimed entitlements, at every checkpoint.

The front end must include deficit in that hard inequality and separately show
a solvency breach. That draft also said:

> Loss: reserve first, then the day's income, never principal.

The spec says:

> If the loss exceeds the reserve, the remainder is recorded as the deficit and the vault enters deficit mode

Expose reserve exhaustion, deficit and suspension; green hard checks do not mean
solvent. These notes do not edit the other lane's story script.

The same Stage 1 draft described:

> backed one to one by USDC in a vault on Arc

The spec defines backing as:

> A tokenized treasury-bill dollar held by the vault.

Model the spec's asset quantity, dollar valuation and investment result. Do not
assume USDC itself earns the simulated yield. There is no chain integration here.

## 12. Authentication, replay and rejected operations

> A record signed by the creditor

> Every operation is atomic.

> Issues and payments against an invoice never exceed its amount in total.

The in-process simulation's trusted caller supplies the actor account. Invoice
registration makes that actor the creditor and freezes the approved fields; no
cryptographic signatures or key management are added. Request IDs are unique
across all successful mutations, including registration. A duplicate successful
request rejects even if its payload changes. Failed IDs are not consumed and
may be retried. Invoice IDs remain unique independently of request IDs.

Candidate ledger records are immutable. Validate the full transition and encode
its event before publishing state. A protocol rejection or invariant failure
leaves ledger, replay set and settlement counters unchanged and emits a rejection
event against the unchanged snapshot. Programming/serialization exceptions also
leave state unchanged but may prevent emitting a rejection event. The full world writes each encoded event before publishing its candidate state.
An output error aborts the run; a partially written file must be discarded. The
small legacy fixture retains events and writes them after construction.

## 13. Other agreed simulation defaults (Phase B)

> The wallet default is a preference, not a protocol rule.

Allow explicit valid payment selections. The default uses eligible dates in
ascending order, then effective spot. Treasury idle-spot sweeps extend to the
next relevant payable's bound, or tomorrow if none exists. Mixed firms use a
recorded seeded mixture of naive and treasury choices.

> funded by the window's own participants, never by the reserve.

Window participants receive explicitly backed opening spot in the full-world
fixture. Use a simple recorded quote schedule; only funded executions contribute
curve points. No auction, solver, credit or inferred market pricing is added.
Executed discount-volume reporting stays separate from payment metrics.

> Funding deficit: for each payable, the eligible shortfall by amount and deadline, and its sum over the run.

Do not repeatedly add daily observations of the same payable shortfall to its
run total. Extension share counts successful Pay operations with an explicitly
linked preceding extension. Metrics are implemented independently in `sim/metrics.py`.

## 14. Phase A fixture horizon and event coverage

The approved Phase A contains no daily checkpoint engine. `--days 5` records the
requested viewing horizon; all four scripted settlements execute on bootstrap
day zero. It does not claim five elapsed days, publish synthetic flat indices,
or run operations from Phase B. `run_completed.daily_checkpoints_executed` is 0.
The legacy fixture has five accounts and four invoices; the full world is a
separate runner. The seed is recorded, but this scripted fixture has no random choices.
All implemented schema-v2 event types are documented in [EVENTS.md](EVENTS.md).


## 15. Calendar, locations and illustrative purchases

The product direction sets day zero to 2025-09-09. A 365-day run covers day 0
through day 364 (2026-09-08), with a summary and checkpoint on every day. The
bootstrap checkpoint seals I(0)=1 without earnings; there are 364 elapsed earning
intervals. Longer runs use the same epoch and consecutive integer days.

Coordinates are approximate city/site pins, not surveyed plant entrances.
Generated locations use a small embedded cluster table with seeded jitter.
All purchases and commercial links are illustrative, not claims about actual
contracts or the iPhone's bill of materials. `story_annotations.json` is the
single editable source for named scripted invoices. Delivery sites can belong
to a third-party assembler: the explicit product examples resolve the phrase
"payee-side site" in favor of the physical destination, not creditor ownership.
The corrected display proof starts Apple → Samsung Display and reaches
400M/100M on day 3. The quick fixture uses this same corrected chain. Processor,
battery and assembly payments fan out directly from Apple, then flow into each
supplier’s own inputs. Scripted TSMC → Corning payments have been removed.

## 16. World funding, schedules and wallet policies

> The wallet default is a preference, not a protocol rule.

The default world has 2,000 suppliers plus Apple and Tesla, and 12,000 generated
invoices plus scripted invoices. Both anchor CLI names run this shared world.
Generated invoices have bounded Pareto sizes, 30/60/90-day terms and seeded
policy choices. Naive firms pay the earliest eligible date, idle spot and
withdraw on cash need. Treasury firms additionally extend to the signed bound,
claim matured entitlements, sweep idle spot and sell dated holdings on shortfall.
Mixed firms choose a seeded policy each day. Cash needs default to 10% of Issue
and Pay inflows and are configurable in whole basis points.

> funded by the window's own participants, never by the reserve.

The window starts with explicitly backed $100M spot and the vault has $1M
explicitly backed opening reserve. This capital is reported in opening state;
it is not counted as newly committed Issue principal. The illustrative return
is 4% annualized using a 365-day divisor and whole-cent daily backing marks.
The window quotes 6.5% annualized simple discounts (whole basis points, at least
one), with actual funded trades at 7, 30, 60, 90 and 180 days on day 4. Quotes are
simulation inputs, not a market discovery mechanism or promised yield.

## 17. Daily and full-run metrics

> Funding deficit: for each payable, the eligible shortfall by amount and deadline, and its sum over the run.

Record each invoice's eligible shortfall once on its due day. The headline is
the sum of these historical deadline shortfalls, even if subsequently settled.
Unpaid invoices due beyond the run are reported separately as projected funding
shortfalls. Unmet off-network cash needs are also separate and never netted.
Daily issued/settled invoice counts count registrations and invoices reaching
full settlement; settled cents include partial settlements. Principal committed
means cumulative fresh Issue deposits, not the sum of repeated extensions.
Daily summaries include both flow counters and the closing balance sheet.

Extension share is the number of Pay operations linked to actual prior Extend
request IDs divided by all successful Pay operations. A link must belong to the
payer, match the amount/date delivered and never have been counted previously.
Multiple extension requests may support one Pay. Ratio settled-to-committed and
circulation efficiency remain separate; no denominator silently includes the
window's opening capital or repeated commitment of the same units.

## 18. Invariant execution and output cost

> Every operation is atomic.

> Every invariant is checked after every operation and after every checkpoint.

Every checker runs on each candidate transition. Immutable unchanged records
retain their established checks; changed records are found from actual ledger
identity differences, not from caller-declared affected accounts. Ledger maps and
replay sets use immutable CRC32-sharded storage: a transition copies touched
shards, while identity comparisons prove that all other shards are unchanged.
Iteration order is independent of Python hash randomization. Every daily
checkpoint and explicit audit fully reconciles ledger aggregates. Rejections
check the unchanged transition incrementally.
Full accrual reconciliation groups equal entitlement intervals before exact
arithmetic; it is algebraically identical to summing each entitlement. The default keeps every operation checked; only an explicit `--check-every N`
with N greater than one defers intermediate hard checks. Timings are diagnostic CLI output,
excluded from deterministic NDJSON. The stream can be written without retaining
all previous event lines in memory.

## 19. Total asset loss

> The loss is charged to the reserve.

A zero dollar backing mark retains the worthless asset quantity, exhausts reserve
and records deficit. An Issue cannot price a fresh deposit at zero, and rejects
until a positive valuation is restored. Recovery of that quantity follows the
same capital-flow-adjusted repair waterfall. No replacement asset or bailout is
created automatically.


## 20. Product-owner story and performance revision

The latest user instruction replaces both the full-world scripts and the quick
fixture with the supplied display/processor/battery/assembly relationships.
New fictional firms have fixed story pins in Illinois, Long Beach, Quebec,
Pohang and Shenzhen and count toward the 2,000 suppliers. Sumco and Wacker have
Tokyo and Burghausen pins. Third-party delivery to Foxconn is explicit. A supplier
with an outgoing scripted payment tomorrow holds its story funds for that hop;
this prevents its general wallet policy from consuming the scripted principal.
The four Apple chains use separate markers; the display proof retains
`story_id=apple-duo` for the existing camera consumer.

The user explicitly requests incremental post-operation checking, full daily
and end-of-run reconciliation, compact operation snapshots, and `--check-every`.
Default `--check-every 1` runs every hard checker using changed records and
maintained aggregates: supply by date, effective spot, near-term principal,
invoice totals, accrued/claimable yield, and scheduled entitlement activity.
Immutable radix maps journal actual updates; weak parent links avoid retaining
historical snapshots. Full checkpoint/end reconciliation is unconditional.
An optional N greater than one defers intermediate hard checks and marks them
null in the stream; it does not defer breach monitoring. The exhaustive stress
mode runs a full reconciliation at each selected attempt as well.

Short entitlement intervals sum the exact published daily index increments;
this telescopes to `I(E)-I(S-1)` without subtracting very large prefix fractions.
Wallets queue claimable rights in the original creation order, instead of scanning
previously claimed rights. Neither optimization changes earning intervals,
Claim rounding, payment selections, or any financial aggregate.

Only checkpoint and day-summary snapshots contain exact asset quantity and
rational liability/reserve totals. Other snapshots omit quantity and truncate
rational totals to display cents. The exact index and Claim payloads remain
available; these display values never feed back into the ledger or metrics.

Checkpoint reconciliation can put all published indices over their exact least
common denominator and sum integer entitlement numerators. The final totals are
compared by exact cross multiplication with the rational ledger. This is the
same inclusive interval formula, without per-record fraction normalization.

Internal reserve, deficit and accrued totals use unreduced exact integer ratios (`ExactCents`) to avoid normalizing the same large denominators after every operation. Checkpoint distribution and published index values remain canonical `Fraction` values. Claim still rounds down exactly once; exact output canonicalizes the ratio. Property tests compare accumulator arithmetic and serialization with `Fraction`. The final audit additionally reconstructs future entitlement activity and ending schedules; checkpoint checks independently reconcile current activity, accrued and claimable value.

Capital flows compute the new backing asset quantity as `(backing_value + flow) / current_price`, algebraically equal to adding or subtracting `flow / current_price` from the previous quantity. End-of-day claimable additions sum exact scaled interval numerators before a single canonical conversion. Both avoid repeated large-rational normalization; neither changes valuation or Claim rounding.


## 21. Branching proof and baked-stream verification

The product owner requests a branching display story and a reuse counter greater than four. Splitting conserves value: the specified tree alone settles exactly $400M on $100M (two $100M upstream payments, $100M across Corning's split, then $100M across the next splits). To exceed four, the default continuation adds transport invoices from Superior Sands Refining to Pacific Freight ($30M) and Dow to Great Plains Rail ($20M). These produce $450M settled, one $100M Issue, and 4.5× reuse by day 4. Every payment uses the original day-90 units. Corning splits $60M/$40M; silica splits $40M/$20M; chemicals splits $25M/$15M. No split creates principal. The editable script contains all allocations and captions. The bootstrap fixture follows the same branching graph.

Every story marker includes a `branch` string. `root` identifies the unsplit path; slash-separated descendants identify the branches (for example `silica/refining/freight`). Other stories retain `root`. Geographic pins for the three new fictional suppliers are Marietta, Ohio; Superior, Wisconsin; and Kansas City, Missouri.

The user explicitly requests: “make --check-every default to the daily checkpoint for sim run (full checks every operation stay the default for sim stress and sim scenarios).” The baked stream is therefore produced with `--check-every checkpoint`: operation preconditions and breach monitoring always run, deferred hard-check results are null, and full reconciliation runs at every daily checkpoint and at the end. `sim run --check-every 1` retains operation verification. `sim stress` and scenarios verify all hard checks after every operation by default; stress `--exhaustive` additionally reconciles the entire ledger after each selected attempt. Paired world runs use the same checkpoint default. A full-size 30-day regression asserts equality of the entire metrics report between checkpoint and per-operation verification, including exact fractions and every daily balance sheet.

Preparation and scope tracking avoid copying growing histories: immutable entitlement ID logs append at most 64 IDs per block, empty map/set updates preserve identity, and composed weak ancestor journals survive collected intermediate snapshots without scanning map buckets. Claim scope tracking skips unchanged dated-balance maps; invoice aggregate work runs only for changed invoices. Protected story actors are scheduled once rather than scanning the script per actor per day. These are storage/scheduling changes only, not financial-policy changes.

## 22. Merge verification, 2026-09-12

2026-09-12: commit 307f7c0 is the merge of devmac-integration (r3+r4) despite its message; verified and deployed at af299b1.
