"""Executable checks for Phase A. No assert statements or skipped checks.

Phase A has no checkpoint entry point: index and reserve changes are forbidden
in every supported transition. The daily allocation branch belongs to Phase B.
"""

from fractions import Fraction


class InvariantViolation(RuntimeError):
    code = "invariant_violation"

    def __init__(self, failures: dict[str, str]):
        self.failures = failures
        super().__init__("; ".join(f"{name}: {reason}" for name, reason in failures.items()))


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def state_integrity(before, after, tx):
    require(after.day == after.cutoff == 0, "Phase A supports only the bootstrap day/cutoff")
    require(after.backing_asset_units >= 0 and after.asset_price_cents > 0, "invalid backing quantity or price")
    require(after.backing_value_cents.denominator == 1, "backing value must be whole cents")
    require(after.reserve_cents >= 0 and after.deficit_cents >= 0, "negative reserve or deficit")
    for name in ("principal_cents", "deposits_today_cents", "withdrawals_today_cents", "previous_checkpoint_principal_cents"):
        require(type(getattr(after, name)) is int and getattr(after, name) >= 0, f"invalid {name}")
    for key, account in after.accounts.items():
        require(key == account.account_id, "account key mismatch")
    for key, invoice in after.invoices.items():
        require(key == invoice.invoice_id, "invoice key mismatch")
        require(invoice.debtor in after.accounts and invoice.creditor in after.accounts, "unknown invoice account")
    if tx is not None:
        require(tx.kind in {"invoice_registered", "issue", "transfer", "pay"}, "unsupported transition")
        require(tx.actor in before.accounts and set(after.accounts) == set(before.accounts), "account set changed")
        require(tx.request_id not in before.applied_requests, "replayed transition")
        require(after.applied_requests == before.applied_requests | {tx.request_id}, "incorrect replay ledger")
        require(after.day == before.day and after.cutoff == before.cutoff, "operation moved the clock")
        require(after.reserve_cents == before.reserve_cents and after.deficit_cents == before.deficit_cents, "operation altered reserve or deficit")
        require(after.previous_checkpoint_principal_cents == before.previous_checkpoint_principal_cents, "operation altered checkpoint denominator")


def principal_identity(before, after, tx):
    principal = sum(a.spot_cents + sum(a.units.values()) for a in after.accounts.values())
    require(after.principal_cents == principal, "principal aggregate disagrees with ledger")
    liabilities = principal + after.accrued_cents
    require(after.backing_value_cents + after.deficit_cents >= liabilities, "backing plus deficit below liabilities")
    require(after.deficit_cents == max(Fraction(0), liabilities - after.backing_value_cents), "deficit is not the actual shortfall")
    require(after.backing_value_cents + after.deficit_cents == liabilities + after.reserve_cents, "reserve balance sheet does not reconcile")


def encumbrance(before, after, tx):
    if tx is None:
        require(after.backing_asset_units == before.backing_asset_units, "unexplained backing movement")
        return
    deposit = tx.amount_cents if tx.kind == "issue" else 0
    require(after.asset_price_cents == before.asset_price_cents, "operation changed checkpoint asset price")
    require(after.backing_value_cents - before.backing_value_cents == deposit, "unauthorized backing movement")
    require(after.principal_cents - before.principal_cents == deposit, "deposit lacks matching principal")
    require(after.deposits_today_cents - before.deposits_today_cents == deposit, "deposit flow not recorded exactly once")
    require(after.withdrawals_today_cents == before.withdrawals_today_cents, "unsupported withdrawal")


def date_rule(before, after, tx):
    for invoice in after.invoices.values():
        require(type(invoice.due_day) is int and type(invoice.maturity_bound) is int, "noninteger invoice date")
        require(0 <= invoice.maturity_bound <= invoice.due_day, "M exceeds D or is negative")
    if tx is not None and tx.kind in {"issue", "pay"}:
        invoice = before.invoices[tx.data["invoice_id"]]
        require(tx.actor == invoice.debtor, "settler is not the debtor")
        if tx.kind == "issue":
            require(tx.data["mint_date"] == invoice.maturity_bound, "Issue did not mint at M")
        else:
            for leg in tx.data["legs"]:
                if leg["date"] is not None:
                    require(after.cutoff < leg["date"] <= invoice.maturity_bound <= invoice.due_day, "payment date is not eligible")


def _views(state):
    result = {}
    for key, account in state.accounts.items():
        view = {date: amount for date, amount in account.units.items() if date > state.cutoff}
        spot = account.effective_spot(state.cutoff)
        if spot:
            view[None] = spot
        result[key] = view
    return result


def cursor_monotonicity(before, after, tx):
    expected = _views(before)
    if tx is not None and tx.kind == "issue":
        invoice = before.invoices[tx.data["invoice_id"]]
        date = invoice.maturity_bound if invoice.maturity_bound > before.cutoff else None
        target = expected[invoice.creditor]
        target[date] = target.get(date, 0) + tx.amount_cents
    elif tx is not None and tx.kind in {"transfer", "pay"}:
        recipient = tx.data["recipient"] if tx.kind == "transfer" else before.invoices[tx.data["invoice_id"]].creditor
        require(sum(leg["amount_cents"] for leg in tx.data["legs"]) == tx.amount_cents, "leg total differs from operation amount")
        debits = {}
        for leg in tx.data["legs"]:
            date, amount = leg["date"], leg["amount_cents"]
            require(type(amount) is int and amount > 0, "invalid debit")
            debits[date] = debits.get(date, 0) + amount
        for date, amount in debits.items():
            require(expected[tx.actor].get(date, 0) >= amount, "source cannot fund all legs")
            expected[tx.actor][date] -= amount
        for date, amount in debits.items():
            expected[recipient][date] = expected[recipient].get(date, 0) + amount
    expected = {key: {date: amount for date, amount in view.items() if amount} for key, view in expected.items()}
    require(_views(after) == expected, "unexplained account/date movement")


def yield_conservation(before, after, tx):
    require(after.indices == before.indices, "Phase A operation allocated income or changed the index")
    for key, entitlement in before.entitlements.items():
        require(after.entitlements.get(key) == entitlement, "existing entitlement changed or moved")
    added = set(after.entitlements) - set(before.entitlements)
    if tx is not None and tx.kind == "issue":
        require(len(added) == 1, "Issue must create exactly one entitlement")
        entitlement = after.entitlements[next(iter(added))]
        invoice = before.invoices[tx.data["invoice_id"]]
        require((entitlement.account_id, entitlement.amount_cents, entitlement.start_day, entitlement.end_day, entitlement.claimed) == (tx.actor, tx.amount_cents, after.day + 1, invoice.maturity_bound, False), "incorrect Issue interval, amount or owner")
        require(entitlement.as_dict() == tx.data["entitlement"], "event entitlement differs from ledger")
    else:
        require(not added, "non-Issue operation created an entitlement")
    for key, entitlement in after.entitlements.items():
        require(key == entitlement.entitlement_id and entitlement.account_id in after.accounts, "invalid entitlement identity")
        require(type(entitlement.amount_cents) is int and entitlement.amount_cents > 0, "invalid entitlement amount")
        require(entitlement.start_day == 1 and type(entitlement.end_day) is int and entitlement.end_day >= 0 and not entitlement.claimed, "unsupported Phase A entitlement state")
    for account in after.accounts.values():
        owned = {key for key, entitlement in after.entitlements.items() if entitlement.account_id == account.account_id}
        require(len(account.entitlement_ids) == len(set(account.entitlement_ids)) and set(account.entitlement_ids) == owned, "account entitlement index disagrees with ledger")
    # Every supported earning interval originates in a distinct fresh deposit.
    require(sum(e.amount_cents for e in after.entitlements.values()) == sum(i.issued_cents for i in after.invoices.values()), "Issue notional and entitlement notional disagree")
    require(after.accrued_cents == 0, "unpublished Phase A income accrued")


def index_monotonicity(before, after, tx):
    require(set(after.indices) == set(range(after.cutoff + 1)), "index series is not contiguous through cutoff")
    require(after.indices[0] == 1, "I(0) must equal one")
    require(all(isinstance(value, Fraction) for value in after.indices.values()), "index must be exact")
    values = [after.indices[day] for day in sorted(after.indices)]
    require(all(a <= b for a, b in zip(values, values[1:])), "index decreased")
    require(all(after.indices.get(day) == value for day, value in before.indices.items()), "published index was rewritten")


def invoice_conservation(before, after, tx):
    for invoice in after.invoices.values():
        require(type(invoice.amount_cents) is int and invoice.amount_cents > 0, "invalid invoice amount")
        require(all(type(value) is int and value >= 0 for value in (invoice.issued_cents, invoice.paid_cents, invoice.outstanding_cents)), "negative or noninteger invoice balance")
        require(invoice.issued_cents + invoice.paid_cents + invoice.outstanding_cents == invoice.amount_cents, "invoice conservation failed")
    expected = {key: invoice.as_dict() for key, invoice in before.invoices.items()}
    if tx is not None and tx.kind == "invoice_registered":
        invoice = tx.data["invoice"]
        require(invoice["invoice_id"] not in expected, "duplicate invoice")
        require(invoice["creditor"] == tx.actor and invoice["signed_day"] == after.day, "invoice not approved by creditor")
        require(invoice["issued_cents"] == invoice["paid_cents"] == 0 and invoice["outstanding_cents"] == invoice["amount_cents"], "new invoice has settlements")
        expected[invoice["invoice_id"]] = invoice
    elif tx is not None and tx.kind in {"issue", "pay"}:
        invoice = expected[tx.data["invoice_id"]]
        invoice["outstanding_cents"] -= tx.amount_cents
        invoice["issued_cents" if tx.kind == "issue" else "paid_cents"] += tx.amount_cents
        require(tx.data["outstanding_cents"] == invoice["outstanding_cents"], "event invoice balance differs")
    require({key: invoice.as_dict() for key, invoice in after.invoices.items()} == expected, "unexplained invoice mutation")


def maturity_is_atomic(before, after, tx):
    classified = 0
    for account in after.accounts.values():
        require(type(account.spot_cents) is int and account.spot_cents >= 0, "invalid spot balance")
        for date, amount in account.units.items():
            require(type(date) is int and date >= 0 and type(amount) is int and amount > 0, "invalid dated bucket")
        dated = {date for date in account.units if date > after.cutoff}
        matured = {date for date in account.units if date <= after.cutoff}
        require(not dated & matured and dated | matured == set(account.units), "maturity partition failed")
        classified += account.effective_spot(after.cutoff) + sum(account.units[date] for date in dated)
    require(classified == after.principal_cents, "spot and dated classification double-counts or loses principal")


def issue_is_unconditional(before, after, tx):
    for key, invoice in before.invoices.items():
        require(key in after.invoices, "invoice history removed")
        require(after.invoices[key].issued_cents >= invoice.issued_cents and after.invoices[key].paid_cents >= invoice.paid_cents, "settlement was clawed back")
    require(after.principal_cents >= before.principal_cents, "Phase A operation destroyed issued principal")


def solvency(state, policy) -> bool:
    return state.deficit_cents > 0


def liquidity_standard(state, policy) -> bool:
    required = state.claimable_cents
    for account in state.accounts.values():
        required += account.effective_spot(state.cutoff)
        required += sum(amount for date, amount in account.units.items() if state.cutoff < date <= state.cutoff + policy.liquidity_days)
    return state.backing_value_cents * policy.immediately_realizable_fraction < required


HARD_CHECKS = (
    state_integrity, principal_identity, encumbrance, date_rule,
    cursor_monotonicity, yield_conservation, index_monotonicity,
    invoice_conservation, maturity_is_atomic, issue_is_unconditional,
)
BREACH_CHECKS = (solvency, liquidity_standard)


def check_all(before, after, tx, policy) -> dict:
    failures, hard, breaches = {}, {}, {}
    for check in HARD_CHECKS:
        try:
            check(before, after, tx)
            hard[check.__name__] = True
        except Exception as error:
            hard[check.__name__] = False
            failures[check.__name__] = str(error)
    for check in BREACH_CHECKS:
        try:
            breaches[check.__name__] = check(after, policy)
        except Exception as error:
            failures[check.__name__] = str(error)
    if failures:
        raise InvariantViolation(failures)
    return {"hard": hard, "breaches": breaches}
