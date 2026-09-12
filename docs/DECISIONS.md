# Cascade implementation decisions

Authority: [Tier One v3.1](spec-tier1-v3.1.md). These interpretations were approved
after the Stage 1 plan. Quotes below reproduce the rule being resolved. Phase A
implements accounts, invoices, Issue, Transfer and Pay only. Decisions concerning
daily income, Claim, Extend, Withdraw, Sell, the full world or comparative metrics
are recorded now, but their operations are deferred to Phase B.

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
remains zero. Phase B must seal the bootstrap batch's backing and principal as
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
creditor-approved bound policies differ. Implementation belongs to Phase B.

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
leave state unchanged but may prevent emitting a rejection event. No file I/O
occurs inside a protocol transaction; Phase A writes its canonical event lines
to NDJSON after constructing the small fixture.

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
linked preceding extension. Full metric implementations remain Phase B work.

## 14. Phase A fixture horizon and event coverage

The approved Phase A contains no daily checkpoint engine. `--days 5` records the
requested viewing horizon; all four scripted settlements execute on bootstrap
day zero. It does not claim five elapsed days, publish synthetic flat indices,
or run operations from Phase B. `run_completed.daily_checkpoints_executed` is 0.
The fixture has five accounts and four invoices; the 2,000-supplier network is
deferred. The seed is recorded, but this scripted fixture has no random choices.
The only event types currently implemented are documented in [EVENTS.md](EVENTS.md).
Extend, checkpoint, Claim, Withdraw and Sell events will be specified alongside
their implementations in Phase B, not emitted as placeholders now.
