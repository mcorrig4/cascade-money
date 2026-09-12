# Cascade vault decisions

Authority: `../docs/spec-tier1-v3.1.md`. These are the Stage-1 decisions approved by the user,
implemented for the USDC demo. The Python reference implementation is independent.

## Backing asset and funded demo index

Exact spec: “A tokenized treasury-bill dollar held by the vault. The vault records its quantity in asset units and its dollar value at each checkpoint. Quantity and dollar value are separate fields.”

Decision: hold only USDC through its six-decimal ERC-20 interface, valued at nominal par. The token
balance is asset quantity; the balance-sheet backing field is its equal nominal dollar value.
There is no T-bill strategy, NAV oracle, fee policy, or real investment return in this contract.
Native USDC and ERC-20 USDC on Arc are one asset. No native sweep or arbitrary external-call path exists.

Exact spec: “I(d) equals I(d minus 1) plus the day's distributable income divided by the day's principal notional.”

Exact spec: “Deposits and withdrawals are capital flows and never count as income.”

Decision: `checkpoint(indexDelta)` takes a demo index increment from the immutable owner. It pulls
`ceil(activeNotional * indexDelta / SCALE)` USDC from the owner using an ERC-20 allowance, in the
same atomic transaction. It does not derive investment income from deposits or the backing balance.
An unfunded checkpoint reverts without publishing an index. Zero increments need no allowance.
Direct USDC donations are reserve, not index income. The owner cannot withdraw reserve.

Exact spec: “Each day's distributable income is allocated exactly once, across entitlements active that day in proportion to amount, with the unallocated remainder to the reserve. Entitlement intervals on any dollar of principal never overlap.”

Decision: starts at S and stops at E+1 schedule active notional in O(1) work per checkpoint. The entire
scaled allocation belongs to entitlement holders. Rounded-up funding surplus and rounded-down claim
dust become reserve. The demo does not simulate income on idle spot or a treasury portfolio; that part
of yield/reserve policy belongs to the reference model. Existing entitlement intervals remain fixed
when units move, extend, or mature. Extension starts after the previous date or tomorrow, whichever is later.

## UTC clock and missing checkpoints

Exact spec: “The system clock is the UTC calendar day. Every operation is stamped with the day it executes. Income is checkpointed once per day at a fixed cutoff. An operation on day d participates in income from day d plus one onward. A unit dated D matures at the cutoff on day D.”

Decision: `today = block.timestamp / 86400`; logical cutoff is 00:00 UTC. The first transaction cannot
be guaranteed to land exactly at midnight. Each owner checkpoint publishes `lastCheckpoint + 1`,
provided it is no later than today. Catch-up uses one call per logical day, including explicit zero
increments. Multiple historical days may be published in one real day; a logical day is never duplicated.
No future index or accelerated clock is exposed. Deployment establishes the current-day baseline at one;
all earlier indices, including I(0), are one. Newly created intervals require `lastCheckpoint == today`.
Transfer, pay, withdrawal, and claims for already-published end days do not wait for new checkpoints.
ERC-1155 transfer events carry execution block timestamps; domain events also include the UTC day.

## Maturity and spot representation

Exact spec: “This is a rule of interpretation, not a transaction: a unit whose date has passed is spot for every purpose without any maintenance operation.”

Exact spec: “A unit is never both dated and spot.”

Decision: every existing token ID at or before today is spot, without burn/mint maintenance. ERC-1155
balances keep their original IDs; the supply total counts each balance exactly once. There is no second
spot ledger. Claims mint new units dated today, immediately interpreted as spot.

Exact spec: “Every unit delivered must be dated on or before M, the creditor's accepted-maturity bound.”

Decision resolving the overlap with “spot for every purpose”: the date bound applies to **unmatured**
units. Matured IDs are spot even when their original ID exceeds a historical invoice's M. Every future
ID must satisfy `id <= M <= D`. A future token extended beyond M still fails after any intermediate
transfer. Once genuinely matured, it may settle that invoice as spot. Pay never rewrites token dates.

## Empty issuance intervals and claims

Exact spec: “The debtor receives an entitlement with S equal to tomorrow and E equal to M, on X.”

Decision: issuance against `M <= today` is permitted. Its empty interval has zero value and is recorded
already closed (`claimed = true`), with no scheduled accrual. The creditor receives immediately liquid units.

Exact spec: “An account collects a claimable, unclaimed entitlement as spot equal to its value, and the flag is set.”

Exact spec: “Its value is amount times (I(E) minus I(S minus 1)), which counts every day from S through E inclusive, computable once I(E) is published.”

Decision: only the recorded account can claim; I(E) must exist. Compute the exact scaled value, remove it
from aggregate accrual, mark claimed, then mint the floor in six-decimal units under today's ID. Fractional
USDC dust becomes reserve. Zero-value claims still close the record. Claim never sends external USDC;
withdrawal is separate. There are no transferable entitlement tokens.

## Backing, reserve, deficit, and liquidity

Exact spec: “Backing dollar value plus deficit equals or exceeds units plus spot plus the accrued value of all unclaimed entitlements, at every checkpoint.”

Decision: enforce the stronger `B >= P + ceil(Y / SCALE)`, where P counts all ERC-1155 units once and
Y is the exact scaled accrued value of all unclaimed entitlements, including those not yet claimable.
Check it after every monetary operation and standard transfer, and before claim/withdraw. Reserve is the
nonnegative residual; a view reports an observed shortfall as deficit. ERC-1155 approval changes do not alter liabilities.

Exact spec: “Backing asset units equal in value to units plus spot cannot be withdrawn, except in the same atomic step that debits the matching spot liability.”

Decision: withdraw burns exactly the matching matured balances before transferring USDC; a failure rolls
back both. No privileged principal or reserve withdrawal exists. All custody transfers use SafeERC20;
incoming transfers must increase backing by exactly the expected amount.

Exact spec: “If the loss exceeds the reserve, the remainder is recorded as the deficit and the vault enters deficit mode: Claim and Withdraw are suspended, Issue, Pay, Transfer, Extend and Sell continue, and all subsequent income is routed to the deficit until it is zero, then to the reserve until the reserve regains its policy floor, and only then does I resume rising.”

Decision: full deficit continuation and loss waterfall are outside the on-chain demo. A shortfall blocks
operations that fail the stronger backing check; it cannot coexist with unconditional continuation of
all those operations. Donations can repair a shortfall. There is no NAV/loss checkpoint, reserve policy
floor, or admin pause. USDC blocklisting or depegging is not represented as investment-loss accounting.
Already claimed yield is never clawed back; the owner cannot slash principal.

Exact spec: “Immediately realizable backing covers all spot balances, all units maturing within the next N days, and all claimable unclaimed entitlement value, with N and the eligible asset set fixed by vault policy.”

Decision: the sole eligible asset is USDC. The demo treats it as fully realizable at par. Requiring backing
for **all** principal and accrued yield dominates that subset for every N, so no maturity-horizon scan or
configurable N is needed. Actual transfer failures still revert atomically.

## Bounded buckets and account date heap

Exact spec: “Every operation is atomic.”

Exact spec: “Wallet default order: earliest eligible date first, then later dates, then spot. The wallet default is a preference, not a protocol rule.”

Decision: pay accepts at most 32 unique buckets, all validated before transfers. Canonical argument order is
ascending future dates, followed by ascending matured IDs. The caller chooses which buckets to supply,
so the wallet selection preference remains optional. Each chosen bucket contributes up to the remaining
payment; unused trailing IDs are still validated. Empty, duplicate, out-of-order, or oversized inputs revert.
Splitting one invoice across bounded partial payments is supported.

Exact spec: “Spot leaves Cascade as backing asset units at the current checkpoint value, on demand, subject to the liquidity standard.”

Decision: an indexed min-heap contains each account's distinct nonzero IDs. Transfers update it immediately;
maturity does not. `withdraw(amount)` consumes the smallest matured IDs, at most 32 per call. Requests
spanning more buckets revert atomically and can be split. Pagination exposes heap order, not sorted order.
There is no cap on the total number of dates an account can own. Standard ERC-1155 batch transfers retain
their standard interface and are bounded by transaction gas, not the payment-specific 32-bucket rule.

Exact spec: “A holder burns X units dated T1, or debits X spot with T1 equal to today, and mints X units dated T2 later than T1 and no earlier than tomorrow.”

Decision: `extend(amount, today, T2)` consumes interpreted spot through the same 32-bucket heap path.
Other source dates select that specific ID, including an older matured ID. In all cases T2 must be later
than both the source date and today. No cursor reset or earlier mint is allowed through extension.

## Invoice signatures, conservation, and retries

Exact spec: “A record signed by the creditor: creditor, debtor, amount, due date D, an accepted-maturity bound M with M no later than D, an invoice identifier, and the outstanding balance. Default M equals D.”

Decision: registration from the creditor address is the signature. Terms are immutable, only the debtor
can issue/pay, and an overload defaults M to D. IDs hash chain ID, vault address, creditor, and creditor
nonce. There is no EIP-712 relay or cancellation method.

Exact spec: “Issues and payments against an invoice never exceed its amount in total.”

Decision: both operations debit one outstanding balance before external callbacks. The three-argument pay
has transaction-nonce replay protection and conservation, but identical newly signed partial payments are
not distinguishable from intentional repeats. The four-argument overload adds `expectedOutstanding` for
optimistic concurrency; a successful first payment makes a stale retry revert. The demo uses this overload.

Exact spec: “A cancelled or disputed invoice creates a new invoice in the other direction and never claws units back.”

Decision: no clawback path exists; corrective invoices use ordinary registration in the reverse direction.

## Discount window and demo scope

Exact spec: “The discount window is a separate program.”

Decision: include the window in the architecture as a separate participant-funded component, not as
implemented vault code. It transfers principal only; existing entitlements stay with the committer.
Shot 7 prices and shot 9 loss stress require the independently developed reference/window work.
The contracts do not import or call `sim/`.

Exact spec: “The system clock is the UTC calendar day.”

Decision: the public day+90/day+120 story cannot mature during the hackathon. Foundry time-warp tests
demonstrate maturity/claim/withdraw; the front end must distinguish those from live testnet receipts.
The live script defaults to **10 USDC** (100 optional). A single deployer funds five deterministic testnet
actors with native USDC gas and funds Apple's ERC-20 principal. The seed and actor keys print only for
testnet runs; they are never written into repository artifacts. The deployer key is never printed.

## Tooling and dependency provenance

User refinement: use standard Foundry, Solidity 0.8.30, Prague, optimizer 200. No Arc Foundry download.
OpenZeppelin network installation failed on sandbox DNS; the cached **5.0.2** source closure is vendored
unmodified under `lib/openzeppelin-contracts` (16 Solidity files, including transitive imports).
`forge-std` **1.16.2** is copied from the host's existing proofline dependency. `DEPENDENCIES.sha256`
pins the committed source bytes. This replaces the initially proposed OpenZeppelin 5.4.0 download.
All RPC/token preflight checks run only when deployment or explicit live demo commands are executed.
