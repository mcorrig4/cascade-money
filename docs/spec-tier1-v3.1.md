# Cascade Tier One: Dated Dollars

Specification v3.1, 2026-09-12. Supersedes v2 and v3. Precise enough to implement. Changes from v2: the index is defined, loss handling is defined with a deficit regime, the liquidity standard includes claimable yield, recipient-approved maturity is enforced by a signed constraint rather than history, Pay carries invoice balances and replay protection, asset quantity is separated from dollar value, and the discount window's yield treatment is stated.

## The instrument

A dated dollar is one dollar of principal, redeemable on a calendar date, backed by value held in the Cascade vault. Its date is the earliest day the principal becomes liquid, and the day through which the vault's yield on that principal is already assigned. All dated dollars with the same date are interchangeable. A dated dollar with an earlier date settles any bill due on or after that date, at face value. The date only ever moves later.

## Time

The system clock is the UTC calendar day. Every operation is stamped with the day it executes. Income is checkpointed once per day at a fixed cutoff. An operation on day d participates in income from day d plus one onward. A unit dated D matures at the cutoff on day D.

## Objects

- Backing asset. A tokenized treasury-bill dollar held by the vault. The vault records its quantity in asset units and its dollar value at each checkpoint. Quantity and dollar value are separate fields.
- Spot. A dollar-denominated balance inside Cascade. Spot earns its holder nothing. Spot is transferable.
- Dated unit. A token whose identifier is a calendar day in UTC, with a dollar amount.
- Invoice. A record signed by the creditor: creditor, debtor, amount, due date D, an accepted-maturity bound M with M no later than D, an invoice identifier, and the outstanding balance. Default M equals D. A creditor that wants payment as early as possible sets M equal to the day of signing.
- Yield index. A number I(d) published at each daily checkpoint, with I(0) equal to one. I(d) equals I(d minus 1) plus the day's distributable income divided by the day's principal notional. Distributable income is the vault's investment result for the day: the backing's dollar value at the checkpoint, minus its value at the previous checkpoint, minus deposits received during the day, plus withdrawals paid during the day, minus fees charged once, minus any amount routed to the reserve or the deficit under the loss rules. Deposits and withdrawals are capital flows and never count as income. Principal notional is the sum of all outstanding units and spot at the previous checkpoint. I never decreases. On a loss day I(d) equals I(d minus 1).
- Yield entitlement. A record of account, amount, first earning day S, last earning day E, and a claimed flag. Its value is amount times (I(E) minus I(S minus 1)), which counts every day from S through E inclusive, computable once I(E) is published. Its accrued value on any day d before E is amount times (I(d) minus I(S minus 1)).
- Reserve. A vault sub-account in dollars. It receives income on dollar-days with no entitlement, all income during deficit repair, and any share of income set by policy. It is first-loss capital.
- Deficit. A dollar amount, normally zero, equal to the shortfall of backing dollar value below the sum of units, spot, and the accrued value of all unclaimed entitlements.
- Account. A spot balance, dated units grouped by date, and entitlements.

## Operations

Every operation is atomic. Every invariant is checked after every operation and after every checkpoint.

1. Issue. The debtor on an invoice deposits asset units whose dollar value X is no more than the invoice's outstanding balance. The creditor receives X units dated M, the invoice's accepted-maturity bound, which defaults to the due date D. The debtor receives an entitlement with S equal to tomorrow and E equal to M, on X. The invoice balance falls by X. Issue against an invoice with zero balance fails. Because the units are dated M, Issue can never deliver a maturity the creditor did not accept.
2. Transfer. Units or spot move between accounts. Dates do not change. No entitlement is created or moved.
3. Split and merge. Units of one date divide and combine freely.
4. Pay. The debtor on an invoice pays amount X against its outstanding balance using units dated on or before D and spot. Every unit delivered must be dated on or before M, the creditor's accepted-maturity bound. Pay fails if any delivered unit is dated after M, or if X exceeds the outstanding balance. The balance falls by X. Units keep their date when they move to the creditor. Wallet default order: earliest eligible date first, then later dates, then spot. The wallet default is a preference, not a protocol rule.
5. Extend. A holder burns X units dated T1, or debits X spot with T1 equal to today, and mints X units dated T2 later than T1 and no earlier than tomorrow. The holder receives an entitlement with S equal to the later of tomorrow and T1 plus one, and E equal to T2, on X. The burn, the mint and the entitlement are one atomic step.
6. Mature. At the checkpoint on day D, every unit dated D becomes spot. This is a rule of interpretation, not a transaction: a unit whose date has passed is spot for every purpose without any maintenance operation. Entitlements with end day D become claimable once I(D) is published.
7. Claim. An account collects a claimable, unclaimed entitlement as spot equal to its value, and the flag is set. During a deficit, Claim is suspended.
8. Withdraw. Spot leaves Cascade as backing asset units at the current checkpoint value, on demand, subject to the liquidity standard. During a deficit, Withdraw is suspended.
9. Sell. Optional. Units dated D are exchanged for spot today at a discount through one gated institutional window funded by the window's own participants, never by the reserve. The buyer receives principal only. Every existing entitlement stays with the account that committed the time. The buyer's return is the discount. Sell moves no date.

## Recipient-approved maturity

The accepted-maturity bound M on the invoice is the enforcement mechanism. A payer who wants to extend before paying may do so only if the extended date is no later than M. Because M is signed by the creditor and checked by Pay against the delivered units, no transfer or wallet arrangement can deliver a later date than the creditor accepted.

## Loss rules

At a checkpoint where the backing's dollar value fell over the day:

1. The day's income is zero. I(d) equals I(d minus 1). No entitlement accrues for that day.
2. The loss is charged to the reserve.
3. If the loss exceeds the reserve, the remainder is recorded as the deficit and the vault enters deficit mode: Claim and Withdraw are suspended, Issue, Pay, Transfer, Extend and Sell continue, and all subsequent income is routed to the deficit until it is zero, then to the reserve until the reserve regains its policy floor, and only then does I resume rising.
4. Yield already claimed is never clawed back. Units and spot balances are never reduced.

## Invariants

Invariants come in two classes. Hard invariants are never violated by any operation; an operation that would violate one fails. Breach indicators are conditions the vault monitors at every checkpoint; a breach does not fail an operation, it switches the vault into deficit mode.

Hard invariants:

- Principal identity. Backing dollar value plus deficit equals or exceeds units plus spot plus the accrued value of all unclaimed entitlements, at every checkpoint.
- Encumbrance. Backing asset units equal in value to units plus spot cannot be withdrawn, except in the same atomic step that debits the matching spot liability.
- Date rule. A unit settles only invoices due on or after its date, and only when dated on or before the invoice's accepted-maturity bound.
- Cursor monotonicity. A unit's date only ever moves later, and only through Extend.
- Yield conservation. Each day's distributable income is allocated exactly once, across entitlements active that day in proportion to amount, with the unallocated remainder to the reserve. Entitlement intervals on any dollar of principal never overlap.
- Index monotonicity. I never decreases.
- Invoice conservation. Issues and payments against an invoice never exceed its amount in total.
- Maturity is atomic. A unit is never both dated and spot.
- Issue is unconditional. A cancelled or disputed invoice creates a new invoice in the other direction and never claws units back.

Breach indicators:

- Solvency. The deficit is zero. A non-zero deficit is deficit mode.
- Liquidity standard. Immediately realizable backing covers all spot balances, all units maturing within the next N days, and all claimable unclaimed entitlement value, with N and the eligible asset set fixed by vault policy. A shortfall suspends Withdraw and Claim until it clears.

## Why the yield goes to the party who moves the date

Whoever commits principal for an interval gives up the right to withdraw it during that interval, and the vault's income for that interval is the compensation. The original debtor commits the first interval. An extender commits the next one. Idle spot commits nothing, earns nothing, and its income funds the reserve that protects every holder.

## What is deliberately absent

No credit. No underwriting. No insurance. No price inside the payment path. No obligation graph and no solver. No transferable yield tokens. No privacy layer. No promised rate.

## Chain shape

One vault program: backing custody, the index, the entitlement ledger, the reserve, the deficit flag. One mint per calendar date. Entry points: issue, pay, extend, claim, withdraw, transfer. The discount window is a separate program.

## What the executable model reports

- Circulation efficiency: gross invoice value settled before maturity, per dollar-day of principal locked. Reported on its own.
- Yield cost: total entitlement value paid, per dollar of invoices settled. Reported on its own.
- Funding deficit: for each payable, the eligible shortfall by amount and deadline, and its sum over the run.
- Share of payments that extend before paying, and the distribution of accepted-maturity bounds creditors set.
- Discount-window volume and clearing discount per date.
- The vault balance sheet at every checkpoint: backing value, units, spot, claimable entitlements, reserve, deficit, invariant status.
- Named scenarios, each pass or fail: loss then recovery; coordinated withdrawal and extension around one date; yield collapse; one holder extending ten times in part; two accounts recommitting to each other; extend, transfer, then pay against an invoice with an early bound.
- Two runs, exact-date and bucketed, with the delta.
