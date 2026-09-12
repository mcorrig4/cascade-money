# Cascade NDJSON events — schema version 2

Version 2 preserves every version-1 envelope field and operation field. The
product-owner performance revision uses compact operation snapshots. It adds `iso_date`, invoice line items, geographical nodes and
Phase B operations/aggregates. All monetary spendable amounts are integer cents.
Exact rational values use reduced `numerator/denominator` strings. Asset units
are not cents. Latitude/longitude are approximate geographic floats, never money.

One UTF-8 JSON object per LF-terminated line; keys are sorted, output is compact,
and sequence numbers start at 1. Same seed and configuration produce identical
NDJSON bytes. Measured wall times are diagnostic output only, never event fields.

## Common envelope (every event)

| Field | Meaning |
|---|---|
| `schema_version` | Integer 2 |
| `seq` | Consecutive positive event sequence number |
| `type` | One of the 17 types documented below |
| `day` | Nonnegative integer execution day |
| `iso_date` | `2025-09-09 + day` in ISO format; day 364 is 2026-09-08 |
| `request_id` | Mutation request ID, attempted ID on rejection, null for metadata |
| `actor` | Simulation account actor; null for clock/checkpoint or metadata |
| `accounts` | Ordered unique affected account IDs, sender/debtor before recipient/creditor |
| `amount_cents` | Nominal invoice registration amount, successful operation amount, or zero for metadata/rejection/checkpoint |
| `dates` | Sorted unique relevant integer days; spot-only operations use an empty array |
| `index` | `{day,value}`: completed cutoff and exact published index |
| `balance_sheet` | Post-transition aggregate snapshot; unchanged on rejection |
| `checks` | Every hard check and both breach indicators, described below |
| `data` | Type-specific fields |

Checkpoint and day-summary balance sheets retain `backing_asset_units` (exact
rational quantity), `backing_value_cents`, `principal_cents`, `dated_cents`,
`spot_cents` (integer cents), and `unclaimed_accrued_cents`, `claimable_cents`,
`reserve_cents`, `deficit_cents` (exact rational cents). Other event types omit
asset quantity and provide the eight totals as integer cents, truncating only
these display values. Do not reconstruct exact accrual or solvency from truncated
snapshots: use the exact checkpoint/day-summary snapshot and breach flags.
Internal accounting and all reported financial metrics retain exact precision.
`index.value` remains exact on every event. Claimable is included in unclaimed
accrual and must not be added twice. Dated excludes balances at/before the cutoff.

`checks.hard` always contains `state_integrity`, `principal_identity`,
`encumbrance`, `date_rule`, `cursor_monotonicity`, `yield_conservation`,
`index_monotonicity`, `invoice_conservation`, `maturity_is_atomic`,
`issue_is_unconditional`. True means passed. `checks.breaches` always contains
`solvency` and `liquidity_standard`: true means an active breach. Either breach
suspends Claim/Withdraw. A liquidity-only breach does not invent dollar deficit.
`sim run` defaults to per-checkpoint verification; `sim stress` and scenarios
run all hard functions after every operation.
`--check-every N` optionally checks each Nth successful operation; intervening
`checks.hard` values are null, never a fabricated pass. Breaches are always
checked. Every checkpoint and final audit fully reconciles the ledger.
`stress --exhaustive --check-every 1` additionally fully reconciles every attempt. Unchanged frozen
records retain their checked proof; a checkpoint additionally reconciles complete
ledgers and exact entitlement interval totals. Metadata reuses the unchanged
state's check results. Rejected-candidate hard failures appear in `error_code`;
the rejection snapshot/checks describe the valid rolled-back state.

## Nested objects

**Invoice:** `invoice_id`, `creditor`, `debtor`, `amount_cents`, `due_day` (D),
`maturity_bound` (M), `signed_day`, `outstanding_cents`, `issued_cents`,
`paid_cents`, plus `item`, positive integer `quantity`, `unit`, `deliver_to`.
The latter is a site ID and can identify a third-party assembly destination,
as in the Samsung Display-to-Foxconn example. All approved fields are immutable.

**Entitlement:** `entitlement_id`, `account_id`, `amount_cents`, `start_day`,
`end_day`, `claimed`. Empty intervals are zero; nonempty ones use the inclusive
index formula. Transfers, Pay and Sell never change entitlement ownership.

**Payment leg:** `{amount_cents,date}`; null date is effective spot, otherwise
an unchanged future maturity. Legs sum to the operation's amount. Same-date
balances split/merge implicitly; no separate Split/Merge transaction is emitted.

**Node:** preserves `id`, `name`, `role`, and adds `lat`, `lon`, `city`, `country`,
`region`, `sites`, `tier`, `category`, `policy`, `cash_need_bps`. A site contains
`site_id`, `lat`, `lon`, `city`, `country`, `region`. Primary coordinates duplicate
the first site. Roles are anchor, supplier or institution. There are 2,000
suppliers, two anchors and two separately identified window actors by default.
The network and purchases are illustrative, not asserted commercial contracts.

**Policy:** retains `liquidity_days`, `immediately_realizable_fraction`,
`reserve_floor_cents`, `reserve_share`, `daily_fee_cents`. Full runs additionally
record `date_policy`, `check_every`, `cash_need_bps`, `illustrative`, `opening_spot_cents`,
`opening_reserve_cents`. Opening window spot/reserve is explicitly backed.

## Event types

Each following example is an actual emitted record, independently illustrative;
the examples are not a single concatenated run. All listed `data` fields are
required. Unknown future types must not be mistaken for successful payments.

### `run_started`

`world`, `seed`, `requested_days`, `nodes`, `policy`, `phase`. The full apple/tesla world contains both anchors and runs the calendar; apple-fixture preserves the ten-event bootstrap demonstration.

```json
{"accounts":[],"actor":null,"amount_cents":0,"balance_sheet":{"backing_value_cents":0,"claimable_cents":0,"dated_cents":0,"deficit_cents":0,"principal_cents":0,"reserve_cents":0,"spot_cents":0,"unclaimed_accrued_cents":0},"checks":{"breaches":{"liquidity_standard":false,"solvency":false},"hard":{"cursor_monotonicity":true,"date_rule":true,"encumbrance":true,"index_monotonicity":true,"invoice_conservation":true,"issue_is_unconditional":true,"maturity_is_atomic":true,"principal_identity":true,"state_integrity":true,"yield_conservation":true}},"data":{"nodes":[{"cash_need_bps":1000,"category":"components","city":"Cupertino","country":"United States","id":"Apple","lat":37.3349,"lon":-122.009,"name":"Apple","policy":"naive","region":"North America","role":"anchor","sites":[{"city":"Cupertino","country":"United States","lat":37.3349,"lon":-122.009,"region":"North America","site_id":"apple-park"}],"tier":1},{"cash_need_bps":1000,"category":"components","city":"Asan","country":"South Korea","id":"Samsung Display","lat":36.797,"lon":127.059,"name":"Samsung Display","policy":"naive","region":"East Asia","role":"supplier","sites":[{"city":"Asan","country":"South Korea","lat":36.797,"lon":127.059,"region":"East Asia","site_id":"samsung-display-asan"}],"tier":1},{"cash_need_bps":1000,"category":"components","city":"Harrodsburg, Kentucky","country":"United States","id":"Corning","lat":37.772,"lon":-84.837,"name":"Corning","policy":"naive","region":"North America","role":"supplier","sites":[{"city":"Harrodsburg, Kentucky","country":"United States","lat":37.772,"lon":-84.837,"region":"North America","site_id":"corning-harrodsburg"}],"tier":1},{"cash_need_bps":1000,"category":"components","city":"Ottawa, Illinois","country":"United States","id":"Great Lakes Silica","lat":41.35,"lon":-88.84,"name":"Great Lakes Silica","policy":"naive","region":"North America","role":"supplier","sites":[{"city":"Ottawa, Illinois","country":"United States","lat":41.35,"lon":-88.84,"region":"North America","site_id":"great-lakes-illinois"}],"tier":1},{"cash_need_bps":1000,"category":"components","city":"Marietta, Ohio","country":"United States","id":"Ohio Valley Chemicals","lat":39.42,"lon":-81.45,"name":"Ohio Valley Chemicals","policy":"naive","region":"North America","role":"supplier","sites":[{"city":"Marietta, Ohio","country":"United States","lat":39.42,"lon":-81.45,"region":"North America","site_id":"ohio-valley-chemicals"}],"tier":1},{"cash_need_bps":1000,"category":"components","city":"Superior, Wisconsin","country":"United States","id":"Superior Sands Refining","lat":46.72,"lon":-92.1,"name":"Superior Sands Refining","policy":"naive","region":"North America","role":"supplier","sites":[{"city":"Superior, Wisconsin","country":"United States","lat":46.72,"lon":-92.1,"region":"North America","site_id":"superior-sands-refining"}],"tier":1},{"cash_need_bps":1000,"category":"components","city":"Long Beach","country":"United States","id":"Pacific Freight","lat":33.77,"lon":-118.19,"name":"Pacific Freight","policy":"naive","region":"North America","role":"supplier","sites":[{"city":"Long Beach","country":"United States","lat":33.77,"lon":-118.19,"region":"North America","site_id":"pacific-freight-long-beach"}],"tier":1},{"cash_need_bps":1000,"category":"components","city":"Freeport, Texas","country":"United States","id":"Dow","lat":28.956,"lon":-95.354,"name":"Dow","policy":"naive","region":"North America","role":"supplier","sites":[{"city":"Freeport, Texas","country":"United States","lat":28.956,"lon":-95.354,"region":"North America","site_id":"dow-freeport"}],"tier":1},{"cash_need_bps":1000,"category":"components","city":"Kansas City, Missouri","country":"United States","id":"Great Plains Rail","lat":39.1,"lon":-94.58,"name":"Great Plains Rail","policy":"naive","region":"North America","role":"supplier","sites":[{"city":"Kansas City, Missouri","country":"United States","lat":39.1,"lon":-94.58,"region":"North America","site_id":"great-plains-rail"}],"tier":1}],"phase":"A","policy":{"daily_fee_cents":0,"immediately_realizable_fraction":"1/1","liquidity_days":7,"reserve_floor_cents":0,"reserve_share":"0/1"},"requested_days":5,"seed":1,"world":"apple-fixture"},"dates":[],"day":0,"index":{"day":0,"value":"1/1"},"iso_date":"2025-09-09","request_id":null,"schema_version":2,"seq":1,"type":"run_started"}
```

### `invoice_registered`

`invoice` (the complete object above). Actor is the approving creditor. Registration increases the daily new-invoice counter, not gross settlement.

```json
{"accounts":["Apple","Samsung Display"],"actor":"Samsung Display","amount_cents":10000000000,"balance_sheet":{"backing_value_cents":0,"claimable_cents":0,"dated_cents":0,"deficit_cents":0,"principal_cents":0,"reserve_cents":0,"spot_cents":0,"unclaimed_accrued_cents":0},"checks":{"breaches":{"liquidity_standard":false,"solvency":false},"hard":{"cursor_monotonicity":true,"date_rule":true,"encumbrance":true,"index_monotonicity":true,"invoice_conservation":true,"issue_is_unconditional":true,"maturity_is_atomic":true,"principal_identity":true,"state_integrity":true,"yield_conservation":true}},"data":{"invoice":{"amount_cents":10000000000,"creditor":"Samsung Display","debtor":"Apple","deliver_to":"foxconn-zhengzhou","due_day":90,"invoice_id":"apple:1","issued_cents":0,"item":"foldable OLED panels","maturity_bound":90,"outstanding_cents":10000000000,"paid_cents":0,"quantity":2000000,"signed_day":0,"unit":"panels"}},"dates":[90],"day":0,"index":{"day":0,"value":"1/1"},"iso_date":"2025-09-09","request_id":"register:1","schema_version":2,"seq":2,"type":"invoice_registered"}
```

### `issue`

`invoice_id`, `debtor`, `creditor`, `outstanding_cents` after Issue, `asset_units` deposited, `mint_date` (always M), `entitlement`. The envelope amount is both capital deposited and invoice value settled.

```json
{"accounts":["Apple","Samsung Display"],"actor":"Apple","amount_cents":10000000000,"balance_sheet":{"backing_value_cents":10000000000,"claimable_cents":0,"dated_cents":10000000000,"deficit_cents":0,"principal_cents":10000000000,"reserve_cents":0,"spot_cents":0,"unclaimed_accrued_cents":0},"checks":{"breaches":{"liquidity_standard":false,"solvency":false},"hard":{"cursor_monotonicity":true,"date_rule":true,"encumbrance":true,"index_monotonicity":true,"invoice_conservation":true,"issue_is_unconditional":true,"maturity_is_atomic":true,"principal_identity":true,"state_integrity":true,"yield_conservation":true}},"data":{"asset_units":"100000000/1","creditor":"Samsung Display","debtor":"Apple","entitlement":{"account_id":"Apple","amount_cents":10000000000,"claimed":false,"end_day":90,"entitlement_id":"entitlement:settle:1","start_day":1},"invoice_id":"apple:1","mint_date":90,"outstanding_cents":0},"dates":[90],"day":0,"index":{"day":0,"value":"1/1"},"iso_date":"2025-09-09","request_id":"settle:1","schema_version":2,"seq":3,"type":"issue"}
```

### `transfer`

`sender`, `recipient`, `legs`. Dates and entitlement owners remain unchanged. This does not settle an invoice.

```json
{"accounts":["B","C"],"actor":"B","amount_cents":5000,"balance_sheet":{"backing_value_cents":10000,"claimable_cents":0,"dated_cents":10000,"deficit_cents":0,"principal_cents":10000,"reserve_cents":0,"spot_cents":0,"unclaimed_accrued_cents":0},"checks":{"breaches":{"liquidity_standard":false,"solvency":false},"hard":{"cursor_monotonicity":true,"date_rule":true,"encumbrance":true,"index_monotonicity":true,"invoice_conservation":true,"issue_is_unconditional":true,"maturity_is_atomic":true,"principal_identity":true,"state_integrity":true,"yield_conservation":true}},"data":{"legs":[{"amount_cents":5000,"date":2}],"recipient":"C","sender":"B"},"dates":[2],"day":0,"index":{"day":0,"value":"1/1"},"iso_date":"2025-09-09","request_id":"share","schema_version":2,"seq":3,"type":"transfer"}
```

### `pay`

`invoice_id`, `debtor`, `creditor`, `outstanding_cents` after Pay, `legs`, plus `extension_request_ids`. Links must refer to unused extensions by this actor whose amounts are delivered at their ending dates. Empty links mean no attributed preceding extension. Default selection is earliest eligible dates, then spot; explicit valid order is allowed.

```json
{"accounts":["Samsung Display","Corning"],"actor":"Samsung Display","amount_cents":10000000000,"balance_sheet":{"backing_value_cents":10000000000,"claimable_cents":0,"dated_cents":10000000000,"deficit_cents":0,"principal_cents":10000000000,"reserve_cents":0,"spot_cents":0,"unclaimed_accrued_cents":0},"checks":{"breaches":{"liquidity_standard":false,"solvency":false},"hard":{"cursor_monotonicity":true,"date_rule":true,"encumbrance":true,"index_monotonicity":true,"invoice_conservation":true,"issue_is_unconditional":true,"maturity_is_atomic":true,"principal_identity":true,"state_integrity":true,"yield_conservation":true}},"data":{"creditor":"Corning","debtor":"Samsung Display","extension_request_ids":[],"invoice_id":"apple:2","legs":[{"amount_cents":10000000000,"date":90}],"outstanding_cents":0},"dates":[90],"day":0,"index":{"day":0,"value":"1/1"},"iso_date":"2025-09-09","request_id":"settle:2","schema_version":2,"seq":6,"type":"pay"}
```

### `operation_rejected`

`operation`, `error_code`, `message`. State and successful request IDs are unchanged; amount is zero. Codes include invalid_argument, unknown_account, unknown_invoice, duplicate_invoice, invalid_bound, unauthorized, invoice_balance, replay, maturity_bound, payment_total, matured_is_spot, insufficient_balance, invariant_violation, invalid_extension, invalid_extension_link, unknown_entitlement, already_claimed, not_claimable, suspended, window_gate, invalid_discount, invalid_day, day_closed, invalid_mark, bootstrap_income, zero_asset_price. Serialization failures may prevent a rejection event, but cannot commit ledger state.

```json
{"accounts":["B"],"actor":"B","amount_cents":0,"balance_sheet":{"backing_value_cents":9900,"claimable_cents":0,"dated_cents":0,"deficit_cents":200,"principal_cents":10100,"reserve_cents":0,"spot_cents":10100,"unclaimed_accrued_cents":0},"checks":{"breaches":{"liquidity_standard":true,"solvency":true},"hard":{"cursor_monotonicity":true,"date_rule":true,"encumbrance":true,"index_monotonicity":true,"invoice_conservation":true,"issue_is_unconditional":true,"maturity_is_atomic":true,"principal_identity":true,"state_integrity":true,"yield_conservation":true}},"data":{"error_code":"suspended","message":"Withdraw suspended by deficit or liquidity breach","operation":"withdraw"},"dates":[],"day":3,"index":{"day":2,"value":"101/100"},"iso_date":"2025-09-12","request_id":"blocked","schema_version":2,"seq":10,"type":"operation_rejected"}
```

### `extend`

`from_date` (null for effective spot), `effective_from_date` (execution day for spot), `to_date`, `entitlement`. Burns/debits and mints the envelope amount atomically. Interval begins at max(tomorrow, old cursor+1). No principal enters or leaves.

```json
{"accounts":["B"],"actor":"B","amount_cents":5000,"balance_sheet":{"backing_value_cents":10000,"claimable_cents":0,"dated_cents":10000,"deficit_cents":0,"principal_cents":10000,"reserve_cents":0,"spot_cents":0,"unclaimed_accrued_cents":0},"checks":{"breaches":{"liquidity_standard":false,"solvency":false},"hard":{"cursor_monotonicity":true,"date_rule":true,"encumbrance":true,"index_monotonicity":true,"invoice_conservation":true,"issue_is_unconditional":true,"maturity_is_atomic":true,"principal_identity":true,"state_integrity":true,"yield_conservation":true}},"data":{"effective_from_date":2,"entitlement":{"account_id":"B","amount_cents":5000,"claimed":false,"end_day":5,"entitlement_id":"entitlement:before-cutoff","start_day":3},"from_date":2,"to_date":5},"dates":[2,5],"day":2,"index":{"day":1,"value":"1/1"},"iso_date":"2025-09-11","request_id":"before-cutoff","schema_version":2,"seq":8,"type":"extend"}
```

### `claim`

`entitlement_id`, `value_cents` (exact), `residual_cents` (exact fractional-cent amount routed to reserve). Envelope amount is the whole-cent payout, which can be zero. The claimed flag is set once.

```json
{"accounts":["A"],"actor":"A","amount_cents":100,"balance_sheet":{"backing_value_cents":10200,"claimable_cents":0,"dated_cents":0,"deficit_cents":0,"principal_cents":10100,"reserve_cents":100,"spot_cents":10100,"unclaimed_accrued_cents":0},"checks":{"breaches":{"liquidity_standard":false,"solvency":false},"hard":{"cursor_monotonicity":true,"date_rule":true,"encumbrance":true,"index_monotonicity":true,"invoice_conservation":true,"issue_is_unconditional":true,"maturity_is_atomic":true,"principal_identity":true,"state_integrity":true,"yield_conservation":true}},"data":{"entitlement_id":"entitlement:issue:initial","residual_cents":"0/1","value_cents":"100/1"},"dates":[1],"day":2,"index":{"day":1,"value":"101/100"},"iso_date":"2025-09-11","request_id":"claimed","schema_version":2,"seq":7,"type":"claim"}
```

### `withdraw`

`asset_units` (exact quantity leaving backing). Envelope amount is the equal spot liability debit at the current checkpoint price.

```json
{"accounts":["C"],"actor":"C","amount_cents":2500,"balance_sheet":{"backing_value_cents":7500,"claimable_cents":0,"dated_cents":5000,"deficit_cents":0,"principal_cents":7500,"reserve_cents":0,"spot_cents":2500,"unclaimed_accrued_cents":0},"checks":{"breaches":{"liquidity_standard":false,"solvency":false},"hard":{"cursor_monotonicity":true,"date_rule":true,"encumbrance":true,"index_monotonicity":true,"invoice_conservation":true,"issue_is_unconditional":true,"maturity_is_atomic":true,"principal_identity":true,"state_integrity":true,"yield_conservation":true}},"data":{"asset_units":"25/1"},"dates":[],"day":3,"index":{"day":2,"value":"1/1"},"iso_date":"2025-09-12","request_id":"after-cutoff","schema_version":2,"seq":12,"type":"withdraw"}
```

### `sell`

`seller`, `buyer`, `date`, `spot_cents`, `discount_bps` (posted quote), `clearing_discount` (actual exact fractional discount after cent rounding). Envelope amount is face principal, not spot consideration. Only a distinct gated buyer with its own spot can fund it. Reserve and existing entitlements do not move.

```json
{"accounts":["Curve Seller","Window Fund"],"actor":"Curve Seller","amount_cents":1000000,"balance_sheet":{"backing_value_cents":22608430950,"claimable_cents":0,"dated_cents":12501000000,"deficit_cents":0,"principal_cents":22501000000,"reserve_cents":103302644,"spot_cents":10000000000,"unclaimed_accrued_cents":4128305},"checks":{"breaches":{"liquidity_standard":false,"solvency":false},"hard":{"cursor_monotonicity":true,"date_rule":true,"encumbrance":true,"index_monotonicity":true,"invoice_conservation":true,"issue_is_unconditional":true,"maturity_is_atomic":true,"principal_identity":true,"state_integrity":true,"yield_conservation":true}},"data":{"buyer":"Window Fund","clearing_discount":"3/2500","date":11,"discount_bps":12,"seller":"Curve Seller","spot_cents":998800},"dates":[11],"day":4,"index":{"day":3,"value":"450148619/450000000"},"iso_date":"2025-09-13","request_id":"curve-sell:19","schema_version":2,"seq":39,"type":"sell"}
```

### `day_opened`

`previous_cutoff`. Moves to the next consecutive execution day and resets daily capital-flow counters. Only allowed after the previous closing checkpoint.

```json
{"accounts":[],"actor":null,"amount_cents":0,"balance_sheet":{"backing_value_cents":10100,"claimable_cents":0,"dated_cents":10000,"deficit_cents":0,"principal_cents":10000,"reserve_cents":100,"spot_cents":0,"unclaimed_accrued_cents":0},"checks":{"breaches":{"liquidity_standard":false,"solvency":false},"hard":{"cursor_monotonicity":true,"date_rule":true,"encumbrance":true,"index_monotonicity":true,"invoice_conservation":true,"issue_is_unconditional":true,"maturity_is_atomic":true,"principal_identity":true,"state_integrity":true,"yield_conservation":true}},"data":{"previous_cutoff":0},"dates":[],"day":1,"index":{"day":0,"value":"1/1"},"iso_date":"2025-09-10","request_id":"day:1","schema_version":2,"seq":4,"type":"day_opened"}
```

### `checkpoint`

`gross_backing_value_cents`, `previous_backing_value_cents`, `deposits_cents`, `withdrawals_cents`, `fees_cents`, `investment_result_cents`, `previous_principal_cents`, `active_entitlement_cents`, `distributable_cents`, `entitlement_accrual_cents`, `unallocated_to_reserve_cents`, `deficit_repair_cents`, `reserve_floor_topup_cents`, `policy_reserve_cents`, `index_increment`, `matured_cents`, `locked_principal_cent_days`, `bootstrap`. Allocation/repair fields and increment are rational strings; other amounts/counts are integers. Gross mark is before fees; fees leave as asset units once. Bootstrap day 0 seals I(0)=1 without income. Every later day publishes one index, completes its maturity interpretation, and reports prior-cutoff locked exposure. Mature is represented here, not by a token rewrite event.

```json
{"accounts":[],"actor":null,"amount_cents":0,"balance_sheet":{"backing_asset_units":"101/1","backing_value_cents":10100,"claimable_cents":"0/1","dated_cents":10000,"deficit_cents":"0/1","principal_cents":10000,"reserve_cents":"100/1","spot_cents":0,"unclaimed_accrued_cents":"0/1"},"checks":{"breaches":{"liquidity_standard":false,"solvency":false},"hard":{"cursor_monotonicity":true,"date_rule":true,"encumbrance":true,"index_monotonicity":true,"invoice_conservation":true,"issue_is_unconditional":true,"maturity_is_atomic":true,"principal_identity":true,"state_integrity":true,"yield_conservation":true}},"data":{"active_entitlement_cents":0,"bootstrap":true,"deficit_repair_cents":"0/1","deposits_cents":10000,"distributable_cents":"0/1","entitlement_accrual_cents":"0/1","fees_cents":0,"gross_backing_value_cents":10100,"index_increment":"0/1","investment_result_cents":0,"locked_principal_cent_days":0,"matured_cents":0,"policy_reserve_cents":"0/1","previous_backing_value_cents":100,"previous_principal_cents":0,"reserve_floor_topup_cents":"0/1","unallocated_to_reserve_cents":"0/1","withdrawals_cents":0},"dates":[0],"day":0,"index":{"day":0,"value":"1/1"},"iso_date":"2025-09-09","request_id":"checkpoint:0","schema_version":2,"seq":3,"type":"checkpoint"}
```

### `story`

`story_id`, `beat`, `caption`, `camera_accounts`, `settled_cents`, `committed_cents`. Camera accounts identify geographical nodes; site destinations are available from the associated invoice. Totals are specific to this story, so the early Apple 4x shot is distinct from simultaneous Tesla/world activity. Captions are editable in sim/story_annotations.json.

```json
{"accounts":[],"actor":null,"amount_cents":0,"balance_sheet":{"backing_value_cents":10000000000,"claimable_cents":0,"dated_cents":10000000000,"deficit_cents":0,"principal_cents":10000000000,"reserve_cents":0,"spot_cents":0,"unclaimed_accrued_cents":0},"checks":{"breaches":{"liquidity_standard":false,"solvency":false},"hard":{"cursor_monotonicity":true,"date_rule":true,"encumbrance":true,"index_monotonicity":true,"invoice_conservation":true,"issue_is_unconditional":true,"maturity_is_atomic":true,"principal_identity":true,"state_integrity":true,"yield_conservation":true}},"data":{"beat":"silica","branch":"silica","camera_accounts":["Corning","Great Lakes Silica"],"caption":"Corning bought silica and soda ash from Great Lakes Silica in Illinois, paid with sixty million of Apple\u2019s original dated dollars.","committed_cents":10000000000,"settled_cents":26000000000,"story_id":"apple-fixture"},"dates":[],"day":0,"index":{"day":0,"value":"1/1"},"iso_date":"2025-09-09","request_id":null,"schema_version":2,"seq":10,"type":"story"}
```

### `day_summary`

`new_invoices` {count,cents} means invoices registered that day; `invoices_settled` {count,cents} counts fully closed invoices and all settlement value including partial payments; `principal_committed_cents` is newly deposited Issue capital that day; `gross_settled_to_date_cents`, `principal_committed_to_date_cents`, `settled_to_committed` (exact ratio or null); `extensions` {count,cents}; `sells` {count,cents,spot_cents}, with cents meaning face value; `withdrawals` {count,cents}; `balance_sheet` duplicates the common final daily snapshot. Exactly one follows each daily checkpoint, including day 0.

```json
{"accounts":[],"actor":null,"amount_cents":0,"balance_sheet":{"backing_asset_units":"226000000/1","backing_value_cents":22600000000,"claimable_cents":"0/1","dated_cents":12500000000,"deficit_cents":"0/1","principal_cents":22500000000,"reserve_cents":"100000000/1","spot_cents":10000000000,"unclaimed_accrued_cents":"0/1"},"checks":{"breaches":{"liquidity_standard":false,"solvency":false},"hard":{"cursor_monotonicity":true,"date_rule":true,"encumbrance":true,"index_monotonicity":true,"invoice_conservation":true,"issue_is_unconditional":true,"maturity_is_atomic":true,"principal_identity":true,"state_integrity":true,"yield_conservation":true}},"data":{"balance_sheet":{"backing_asset_units":"226000000/1","backing_value_cents":22600000000,"claimable_cents":"0/1","dated_cents":12500000000,"deficit_cents":"0/1","principal_cents":22500000000,"reserve_cents":"100000000/1","spot_cents":10000000000,"unclaimed_accrued_cents":"0/1"},"extensions":{"cents":0,"count":0},"gross_settled_to_date_cents":12500000000,"invoices_settled":{"cents":12500000000,"count":2},"new_invoices":{"cents":12500000000,"count":2},"principal_committed_cents":12500000000,"principal_committed_to_date_cents":12500000000,"sells":{"cents":0,"count":0,"spot_cents":0},"settled_to_committed":"1/1","withdrawals":{"cents":0,"count":0}},"dates":[],"day":0,"index":{"day":0,"value":"1/1"},"iso_date":"2025-09-09","request_id":null,"schema_version":2,"seq":9,"type":"day_summary"}
```

### `funding_shortfall`

`invoice_id`, `deadline`, `shortfall_cents`, `kind`. Kind invoice is the eligible shortfall recorded once at its due-day decision; projected is the end-run forecast for a later deadline; cash is an unmet off-network need (synthetic cash:account ID). These categories remain separate. Later payments do not erase a historical missed-deadline observation.

```json
{"accounts":[],"actor":null,"amount_cents":0,"balance_sheet":{"backing_value_cents":22405651086,"claimable_cents":0,"dated_cents":12538120000,"deficit_cents":0,"principal_cents":22283475162,"reserve_cents":109772500,"spot_cents":9745355162,"unclaimed_accrued_cents":12403423},"checks":{"breaches":{"liquidity_standard":false,"solvency":false},"hard":{"cursor_monotonicity":true,"date_rule":true,"encumbrance":true,"index_monotonicity":true,"invoice_conservation":true,"issue_is_unconditional":true,"maturity_is_atomic":true,"principal_identity":true,"state_integrity":true,"yield_conservation":true}},"data":{"deadline":94,"invoice_id":"world:00021","kind":"projected","shortfall_cents":3690000},"dates":[],"day":9,"index":{"day":9,"value":"6124115259749106848507180508715346579392802511034877/6118051375584978884523266810925472403617029375000000"},"iso_date":"2025-09-18","request_id":null,"schema_version":2,"seq":146,"type":"funding_shortfall"}
```

### `scenario_result`

`name`, `passed`, `detail` (text for named scenarios, structured counts for stress). Expected protocol rejections may be part of a passing scenario. A hard-invariant failure never counts as an expected rejection.

```json
{"accounts":[],"actor":null,"amount_cents":0,"balance_sheet":{"backing_value_cents":10350,"claimable_cents":0,"dated_cents":100,"deficit_cents":0,"principal_cents":10200,"reserve_cents":149,"spot_cents":10100,"unclaimed_accrued_cents":0},"checks":{"breaches":{"liquidity_standard":false,"solvency":false},"hard":{"cursor_monotonicity":true,"date_rule":true,"encumbrance":true,"index_monotonicity":true,"invoice_conservation":true,"issue_is_unconditional":true,"maturity_is_atomic":true,"principal_identity":true,"state_integrity":true,"yield_conservation":true}},"data":{"detail":"all expected state transitions and invariant checks passed","name":"loss_then_recovery","passed":true},"dates":[],"day":4,"index":{"day":4,"value":"1294/1275"},"iso_date":"2025-09-13","request_id":null,"schema_version":2,"seq":16,"type":"scenario_result"}
```

### `run_completed`

`world`, `requested_days`, `daily_checkpoints_executed`, `metrics`. Legacy fields principal_deposited_cents, principal_locked_cents, observed_principal_cent_days, reuse_multiple, gross_invoice_settled_cents, circulation_efficiency_per_day and circulation_efficiency_status are retained. Full runs add invoice_count, settled_invoice_count, principal_committed_cents, locked_settlement_cents, principal_cent_days, yield_paid_cents, yield_cost_per_settled_dollar, funding_deficit_cents, future_funding_deficit_cents, cash_need_shortfall_cents, funding_deficits (itemized by deadline), payments, payments_with_extension, extension_share, accepted_bound_days, discount_window, balance_sheets, story_totals, suppliers, days, date_policy. Ratios use exact strings or null when the denominator is zero. Discount-window entries aggregate face/spot/trades and value-weighted realized clearing discount by absolute maturity date. Balance sheets retain each checkpoint and its check results.

```json
{"accounts":[],"actor":null,"amount_cents":0,"balance_sheet":{"backing_value_cents":10000000000,"claimable_cents":0,"dated_cents":10000000000,"deficit_cents":0,"principal_cents":10000000000,"reserve_cents":0,"spot_cents":0,"unclaimed_accrued_cents":0},"checks":{"breaches":{"liquidity_standard":false,"solvency":false},"hard":{"cursor_monotonicity":true,"date_rule":true,"encumbrance":true,"index_monotonicity":true,"invoice_conservation":true,"issue_is_unconditional":true,"maturity_is_atomic":true,"principal_identity":true,"state_integrity":true,"yield_conservation":true}},"data":{"daily_checkpoints_executed":0,"metrics":{"circulation_efficiency_per_day":null,"circulation_efficiency_status":"unavailable_until_daily_checkpoints","gross_invoice_settled_cents":45000000000,"observed_principal_cent_days":0,"principal_deposited_cents":10000000000,"principal_locked_cents":10000000000,"reuse_multiple":"9/2"},"requested_days":5,"world":"apple-fixture"},"dates":[],"day":0,"index":{"day":0,"value":"1/1"},"iso_date":"2025-09-09","request_id":null,"schema_version":2,"seq":32,"type":"run_completed"}
```

## Globe playback and metric separation

Use nodes/sites for geography and registered invoices for annotated edges. On
Issue/Pay animate the debtor-to-creditor flow and increment gross settled by the
envelope amount. Do not add invoice registration, Transfer, Extend, Sell or
rejected attempts to that counter. Drive the camera from story markers and the
bottom chart from day_summary. Use dates/index cutoff to interpret liquidity.

Reuse is gross settlement divided by cumulative Issue deposits. Extending the
same principal does not inflate this committed-capital denominator. Circulation
efficiency is locked settlement value divided by actual principal dollar-days.
Yield cost, funding deficits, extension share and window discounts are independent
metrics. The full 365-day run publishes 365 summaries and 365 checkpoint records
(including bootstrap), with 364 elapsed inter-cutoff earning intervals.

```sh
python3 -m sim run --world apple --days 365 --seed 1 --out artifacts/apple-365.ndjson
python3 -m sim scenarios --out-dir artifacts/scenarios
python3 -m sim stress --ops 10000 --out artifacts/stress.ndjson
python3 -m sim compare --days 365 --out-dir artifacts/paired
```


## Corrected product stories

The display proof branches at Corning into silica and chemicals, then into
refining, freight, feedstock and rail. Additional input-transport payments reach
$450M settled on $100M committed on day 4. The quick
`apple-fixture` uses the same corrected chain at bootstrap. Processor payments
follow Apple → TSMC → Sumco → Wacker → Bécancour Silicon. Battery payments follow
Apple → Panasonic → Pohang Cathode → Glencore. Assembly follows Apple → Foxconn
→ Luxshare → Shenzhen PCB. Tesla uses Panasonic → Pohang Cathode → Glencore with
an extension before each downstream payment. The initial Issue commits the first
interval. All amounts and generated firms remain illustrative. `story_id` values
are `apple-duo`, `apple-processor`, `apple-battery`, `apple-assembly`, and `tesla`.

Story markers include `data.branch`: `root` before a split and slash-separated branch ancestry afterwards (for example `silica/refining`). Non-display stories use `root`.

`sim run` and paired world runs now default to `--check-every checkpoint`: full daily and final reconciliation, with deferred operation hard checks explicitly null. `sim stress` and scenarios retain every-operation verification. Breach monitoring and operation preconditions always run.

The branching display proof uses these `branch` paths: `root` (Apple → Samsung Display → Corning), `silica`, `chemicals`, `silica/refining`, `silica/freight`, `chemicals/feedstock`, `chemicals/rail`, `silica/refining/freight`, and `chemicals/feedstock/rail`. The final marker reports 45,000,000,000 settled cents and 10,000,000,000 committed cents. The two final transport hops make reuse 4.5×; splitting alone would remain 4×.

The bootstrap `apple-fixture` remains verified per operation and emits 32 records (ten invoice registrations, ten settlements, ten branch markers and two run markers). It has no daily checkpoints.
