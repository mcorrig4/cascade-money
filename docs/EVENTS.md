# Cascade NDJSON events — schema version 1, Phase A

Each UTF-8 line is one complete JSON object, terminated by LF. Event order is
authoritative: `seq` starts at 1 and increases by one within a stream. Keys are
sorted and JSON is compact. No wall-clock time, output path, UUID or process hash
is serialized. Same configuration produces identical bytes.

This document covers **every currently emitted event type**. Phase B operation
types are not implemented or represented by placeholder events. Consumers should
dispatch on `type` and reject unsupported schema versions.

## Common envelope (present on every line)

| Field | Type / meaning |
|---|---|
| `schema_version` | Integer, currently 1 |
| `seq` | Positive integer sequence number |
| `type` | One of the seven event types below |
| `day` | Nonnegative integer execution day; all Phase A events use bootstrap day 0 |
| `request_id` | Successful or attempted mutation ID; null for run metadata |
| `actor` | Authenticated simulation actor, attempted actor on rejection, or null for metadata |
| `accounts` | Ordered unique account IDs involved; debtor/sender precedes creditor/recipient; empty for run metadata |
| `amount_cents` | Integer nominal amount on registration, minted/moved/settled amount on success, zero for metadata/rejection |
| `dates` | Sorted unique relevant integer dates: M/D on registration, M on Issue, selected dated buckets on Transfer/Pay; empty for spot-only movement or metadata/rejection |
| `index` | `{day, value}`: latest completed cutoff and exact index as a reduced rational string |
| `balance_sheet` | Aggregate post-operation state, or unchanged state for rejection; fields below |
| `checks` | `{hard: {name: boolean}, breaches: {name: boolean}}`; true means passing for hard checks, but active breach for indicators |
| `data` | Type-specific object; fields below |

Account IDs are strings. All spendable money is **integer cents**, not dollars.
Exact rational strings have form `numerator/denominator` with a positive
denominator. Their unit follows the field name; `100000000/1` asset units are
not `100000000` cents. Clients must preserve integer precision when handling
amounts beyond their language's safe numeric range.

`balance_sheet` fields:

| Field | Type / unit |
|---|---|
| `backing_asset_units` | Exact rational asset quantity |
| `backing_value_cents` | Integer marked backing value |
| `principal_cents` | Integer dated plus effective-spot liability |
| `dated_cents` | Integer units with date greater than completed cutoff |
| `spot_cents` | Integer explicit spot plus matured buckets |
| `unclaimed_accrued_cents` | Exact rational accrued liability, including claimable yield |
| `claimable_cents` | Exact rational claimable subset of unclaimed accrual |
| `reserve_cents` | Exact rational reserve accounting balance |
| `deficit_cents` | Exact rational backing shortfall |

All ten hard-check keys are always present: `state_integrity`,
`principal_identity`, `encumbrance`, `date_rule`, `cursor_monotonicity`,
`yield_conservation`, `index_monotonicity`, `invoice_conservation`,
`maturity_is_atomic`, `issue_is_unconditional`. The two breach keys are
`solvency` and `liquidity_standard`. Either breach suspends Claim/Withdraw when
those operations exist. A liquidity-only breach does not imply a dollar deficit.

Phase A checks prohibit index/allocation changes in its supported operations.
The stream does not imply that Phase B checkpoint and interval-extension checks
already exist. A rejected invariant-violating candidate is rolled back: the
rejection's hard checks describe the unchanged valid state, while its error code
identifies the failed candidate.

## Type-specific fields and example lines

Examples are actual emitted records. Each is independently illustrative; they
are not intended to form a concatenated run. Every field in the shown `data`
objects is required for that type.

### `run_started`

`world`: fixture name; `seed`: nonnegative integer; `requested_days`: positive
integer viewing horizon; `phase`: `"A"`; `nodes`: ordered `{id,name,role}` records
(`role` is `anchor` or `supplier`); `policy`: `liquidity_days`,
`immediately_realizable_fraction`, `reserve_floor_cents`, `reserve_share`,
`daily_fee_cents`. Fractions are exact strings. Accounts begin with zero balances.

```json
{"accounts":[],"actor":null,"amount_cents":0,"balance_sheet":{"backing_asset_units":"0/1","backing_value_cents":0,"claimable_cents":"0/1","dated_cents":0,"deficit_cents":"0/1","principal_cents":0,"reserve_cents":"0/1","spot_cents":0,"unclaimed_accrued_cents":"0/1"},"checks":{"breaches":{"liquidity_standard":false,"solvency":false},"hard":{"cursor_monotonicity":true,"date_rule":true,"encumbrance":true,"index_monotonicity":true,"invoice_conservation":true,"issue_is_unconditional":true,"maturity_is_atomic":true,"principal_identity":true,"state_integrity":true,"yield_conservation":true}},"data":{"nodes":[{"id":"Apple","name":"Apple","role":"anchor"},{"id":"Foxconn","name":"Foxconn","role":"supplier"},{"id":"TSMC","name":"TSMC","role":"supplier"},{"id":"Corning","name":"Corning","role":"supplier"},{"id":"Clearview Glass","name":"Clearview Glass","role":"supplier"}],"phase":"A","policy":{"daily_fee_cents":0,"immediately_realizable_fraction":"1/1","liquidity_days":7,"reserve_floor_cents":0,"reserve_share":"0/1"},"requested_days":5,"seed":1,"world":"apple-fixture"},"dates":[],"day":0,"index":{"day":0,"value":"1/1"},"request_id":null,"schema_version":1,"seq":1,"type":"run_started"}
```

### `invoice_registered`

`invoice` contains `invoice_id`, `creditor`, `debtor`, `amount_cents`, `due_day`
(D), `maturity_bound` (M), `signed_day`, `outstanding_cents`, `issued_cents`,
`paid_cents`. New invoices have full outstanding balance and zero settlements.
The actor is the approving creditor. Registration is not a settlement.

```json
{"accounts":["Corning","Clearview Glass"],"actor":"Clearview Glass","amount_cents":10000000000,"balance_sheet":{"backing_asset_units":"0/1","backing_value_cents":0,"claimable_cents":"0/1","dated_cents":0,"deficit_cents":"0/1","principal_cents":0,"reserve_cents":"0/1","spot_cents":0,"unclaimed_accrued_cents":"0/1"},"checks":{"breaches":{"liquidity_standard":false,"solvency":false},"hard":{"cursor_monotonicity":true,"date_rule":true,"encumbrance":true,"index_monotonicity":true,"invoice_conservation":true,"issue_is_unconditional":true,"maturity_is_atomic":true,"principal_identity":true,"state_integrity":true,"yield_conservation":true}},"data":{"invoice":{"amount_cents":10000000000,"creditor":"Clearview Glass","debtor":"Corning","due_day":90,"invoice_id":"apple:4","issued_cents":0,"maturity_bound":90,"outstanding_cents":10000000000,"paid_cents":0,"signed_day":0}},"dates":[90],"day":0,"index":{"day":0,"value":"1/1"},"request_id":"register:4","schema_version":1,"seq":5,"type":"invoice_registered"}
```

### `issue`

`invoice_id`, `debtor`, `creditor`, `outstanding_cents` (after Issue),
`asset_units` (exact deposited quantity), `mint_date` (signed M), and
`entitlement`: `{entitlement_id,account_id,amount_cents,start_day,end_day,claimed}`.
The entitlement belongs to the debtor. The envelope amount is both the deposit
value and the invoice settlement value. Minting at/before cutoff is immediately
interpreted as spot, even though its stored mint identifier remains M.

```json
{"accounts":["Apple","Foxconn"],"actor":"Apple","amount_cents":10000000000,"balance_sheet":{"backing_asset_units":"100000000/1","backing_value_cents":10000000000,"claimable_cents":"0/1","dated_cents":10000000000,"deficit_cents":"0/1","principal_cents":10000000000,"reserve_cents":"0/1","spot_cents":0,"unclaimed_accrued_cents":"0/1"},"checks":{"breaches":{"liquidity_standard":false,"solvency":false},"hard":{"cursor_monotonicity":true,"date_rule":true,"encumbrance":true,"index_monotonicity":true,"invoice_conservation":true,"issue_is_unconditional":true,"maturity_is_atomic":true,"principal_identity":true,"state_integrity":true,"yield_conservation":true}},"data":{"asset_units":"100000000/1","creditor":"Foxconn","debtor":"Apple","entitlement":{"account_id":"Apple","amount_cents":10000000000,"claimed":false,"end_day":90,"entitlement_id":"entitlement:settle:1","start_day":1},"invoice_id":"apple:1","mint_date":90,"outstanding_cents":0},"dates":[90],"day":0,"index":{"day":0,"value":"1/1"},"request_id":"settle:1","schema_version":1,"seq":6,"type":"issue"}
```

### `transfer`

`sender`, `recipient`, `legs`: list of `{amount_cents,date}`. `date: null` means
effective spot; otherwise the integer date is preserved. The Phase A Transfer
API accepts one leg; its list representation matches Pay. Entitlements do not
move, and Transfer contributes zero to invoice settlement counters.

```json
{"accounts":["Clearview Glass","Corning"],"actor":"Clearview Glass","amount_cents":100,"balance_sheet":{"backing_asset_units":"100000000/1","backing_value_cents":10000000000,"claimable_cents":"0/1","dated_cents":10000000000,"deficit_cents":"0/1","principal_cents":10000000000,"reserve_cents":"0/1","spot_cents":0,"unclaimed_accrued_cents":"0/1"},"checks":{"breaches":{"liquidity_standard":false,"solvency":false},"hard":{"cursor_monotonicity":true,"date_rule":true,"encumbrance":true,"index_monotonicity":true,"invoice_conservation":true,"issue_is_unconditional":true,"maturity_is_atomic":true,"principal_identity":true,"state_integrity":true,"yield_conservation":true}},"data":{"legs":[{"amount_cents":100,"date":90}],"recipient":"Corning","sender":"Clearview Glass"},"dates":[90],"day":0,"index":{"day":0,"value":"1/1"},"request_id":"example:transfer","schema_version":1,"seq":11,"type":"transfer"}
```

### `pay`

`invoice_id`, `debtor`, `creditor`, `outstanding_cents` (after Pay), `legs`:
ordered list of `{amount_cents,date}`. Legs sum to the envelope amount. All
non-null dates must be after cutoff and no later than both D and M. Explicit
valid order is allowed; automatic selection is earliest eligible date first,
then spot. Dates and existing entitlement owners remain unchanged.

```json
{"accounts":["Corning","Clearview Glass"],"actor":"Corning","amount_cents":10000000000,"balance_sheet":{"backing_asset_units":"100000000/1","backing_value_cents":10000000000,"claimable_cents":"0/1","dated_cents":10000000000,"deficit_cents":"0/1","principal_cents":10000000000,"reserve_cents":"0/1","spot_cents":0,"unclaimed_accrued_cents":"0/1"},"checks":{"breaches":{"liquidity_standard":false,"solvency":false},"hard":{"cursor_monotonicity":true,"date_rule":true,"encumbrance":true,"index_monotonicity":true,"invoice_conservation":true,"issue_is_unconditional":true,"maturity_is_atomic":true,"principal_identity":true,"state_integrity":true,"yield_conservation":true}},"data":{"creditor":"Clearview Glass","debtor":"Corning","invoice_id":"apple:4","legs":[{"amount_cents":10000000000,"date":90}],"outstanding_cents":0},"dates":[90],"day":0,"index":{"day":0,"value":"1/1"},"request_id":"settle:4","schema_version":1,"seq":9,"type":"pay"}
```

### `operation_rejected`

`operation`: attempted type; `error_code`: stable machine-readable reason;
`message`: human-readable detail. Neither protocol state nor the successful
request-ID set changes. The envelope amount is zero so a failed attempt cannot
look like settlement. The request ID may repeat a previous successful request.
Relevant codes: `invalid_argument`, `unknown_account`, `unknown_invoice`,
`duplicate_invoice`, `invalid_bound`, `unauthorized`, `invoice_balance`, `replay`,
`maturity_bound`, `payment_total`, `matured_is_spot`, `insufficient_balance`,
`invariant_violation`. Constructor errors precede the event stream. Unexpected
programming/serialization failures raise and may prevent a rejection record.

```json
{"accounts":["Clearview Glass"],"actor":"Clearview Glass","amount_cents":0,"balance_sheet":{"backing_asset_units":"100000000/1","backing_value_cents":10000000000,"claimable_cents":"0/1","dated_cents":10000000000,"deficit_cents":"0/1","principal_cents":10000000000,"reserve_cents":"0/1","spot_cents":0,"unclaimed_accrued_cents":"0/1"},"checks":{"breaches":{"liquidity_standard":false,"solvency":false},"hard":{"cursor_monotonicity":true,"date_rule":true,"encumbrance":true,"index_monotonicity":true,"invoice_conservation":true,"issue_is_unconditional":true,"maturity_is_atomic":true,"principal_identity":true,"state_integrity":true,"yield_conservation":true}},"data":{"error_code":"insufficient_balance","message":"insufficient dated balance","operation":"transfer"},"dates":[],"day":0,"index":{"day":0,"value":"1/1"},"request_id":"example:rejected","schema_version":1,"seq":12,"type":"operation_rejected"}
```

### `run_completed`

`world`, `requested_days`, `daily_checkpoints_executed` (0 in Phase A), and
`metrics`: `gross_invoice_settled_cents`, `principal_deposited_cents`,
`principal_locked_cents`, `reuse_multiple` (exact ratio),
`observed_principal_cent_days` (0), `circulation_efficiency_per_day` (null),
`circulation_efficiency_status` (`"unavailable_until_daily_checkpoints"`).

The Apple fixture's counters are calculated from successful Issue/Pay events,
not assigned from narrative targets. Reuse and circulation efficiency are
different fields; the latter requires elapsed checkpoints and remains unknown
in Phase A. `--days 5` never fabricates five days of income or lock exposure.

```json
{"accounts":[],"actor":null,"amount_cents":0,"balance_sheet":{"backing_asset_units":"100000000/1","backing_value_cents":10000000000,"claimable_cents":"0/1","dated_cents":10000000000,"deficit_cents":"0/1","principal_cents":10000000000,"reserve_cents":"0/1","spot_cents":0,"unclaimed_accrued_cents":"0/1"},"checks":{"breaches":{"liquidity_standard":false,"solvency":false},"hard":{"cursor_monotonicity":true,"date_rule":true,"encumbrance":true,"index_monotonicity":true,"invoice_conservation":true,"issue_is_unconditional":true,"maturity_is_atomic":true,"principal_identity":true,"state_integrity":true,"yield_conservation":true}},"data":{"daily_checkpoints_executed":0,"metrics":{"circulation_efficiency_per_day":null,"circulation_efficiency_status":"unavailable_until_daily_checkpoints","gross_invoice_settled_cents":40000000000,"observed_principal_cent_days":0,"principal_deposited_cents":10000000000,"principal_locked_cents":10000000000,"reuse_multiple":"4/1"},"requested_days":5,"world":"apple-fixture"},"dates":[],"day":0,"index":{"day":0,"value":"1/1"},"request_id":null,"schema_version":1,"seq":10,"type":"run_completed"}
```

## Front-end consumption

Create the five nodes from `run_started`, then edges from registered invoices.
On Issue/Pay, add `amount_cents` to the gross settled counter and animate the
debtor-to-creditor hop. Set the locked counter from `balance_sheet.dated_cents`.
Do not add registration, Transfer or rejected amounts to settlements. Display
the date stamp from `mint_date`/payment legs. Preserve the debtor's entitlement
owner independently of the coin's current holder.

The requested fixture emits exactly ten lines: start, four registrations, Issue,
three Pays, completion. It shows $100m, $200m, $300m, $400m settled while the
locked counter remains $100m. For sample generation:

```sh
python3 -m sim run --world apple-fixture --days 5 --seed 1 --out events.ndjson
```
