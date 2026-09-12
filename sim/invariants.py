"""All hard checks run on every transition; checkpoints also reconcile full ledgers.

Changed-record scopes are computed by identity-diffing immutable maps in the
transaction engine, so unchanged records retain their previously checked proof.
"""
from fractions import Fraction


class InvariantViolation(RuntimeError):
    code = "invariant_violation"
    def __init__(self, failures):
        self.failures = failures
        super().__init__("; ".join(f"{k}: {v}" for k, v in failures.items()))


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def full(tx):
    return tx is None or tx.kind == "checkpoint"


def keys(state, tx, field):
    return getattr(state, field) if full(tx) else getattr(tx, "changed_" + field)


def state_integrity(before, after, tx):
    require(type(after.day) is int and 0 <= after.cutoff <= after.day <= after.cutoff + 1, "invalid day/cutoff")
    require(after.backing_asset_units >= 0 and after.asset_price_cents >= 0, "invalid backing quantity or price")
    require(after.backing_value_cents.denominator == 1, "backing value must be whole cents")
    require(after.reserve_cents >= 0 and after.deficit_cents >= 0, "negative reserve or deficit")
    for name in ("principal_cents", "deposits_today_cents", "withdrawals_today_cents", "previous_checkpoint_principal_cents"):
        require(type(getattr(after, name)) is int and getattr(after, name) >= 0, f"invalid {name}")
    for key in keys(after, tx, "accounts"):
        require(key == after.accounts[key].account_id, "account key mismatch")
    for key in keys(after, tx, "invoices"):
        i = after.invoices[key]
        require(key == i.invoice_id and i.debtor in after.accounts and i.creditor in after.accounts, "invalid invoice identity")
    if tx is not None:
        system = tx.kind in {"checkpoint", "day_opened"}
        require(system or tx.actor in before.accounts, "unknown actor")
        require(len(after.accounts) == len(before.accounts), "account set changed")
        require(tx.request_id not in before.applied_requests, "replayed transition")
        require(after.applied_requests == before.applied_requests | {tx.request_id}, "incorrect replay ledger")
        if tx.kind not in {"checkpoint", "day_opened"}:
            require(after.day == before.day and after.cutoff == before.cutoff, "operation moved clock")
            require(not before.closed, "operation after cutoff")
        require(after.opening_principal_cents == before.opening_principal_cents, "opening capital changed")
        require(after.extension_requests == (before.extension_requests | {tx.request_id} if tx.kind == "extend" else before.extension_requests), "extension registry changed unexpectedly")
        require(after.linked_extensions == (before.linked_extensions | set(tx.data["extension_request_ids"]) if tx.kind == "pay" else before.linked_extensions), "extension linkage registry changed unexpectedly")
        if tx.kind != "checkpoint":
            require(after.previous_checkpoint_principal_cents == before.previous_checkpoint_principal_cents, "operation changed frozen denominator")
            require(after.deficit_cents == before.deficit_cents, "operation manufactured deficit")
        if tx.kind not in {"checkpoint", "claim"}:
            require(after.reserve_cents == before.reserve_cents, "unexpected reserve movement")
        if tx.kind == "day_opened":
            require(before.closed and after.day == before.day + 1 and not after.closed and after.cutoff == before.cutoff, "invalid day advancement")
            require(after.deposits_today_cents == after.withdrawals_today_cents == 0, "daily flows not reset")


def principal_identity(before, after, tx):
    principal = after.explicit_spot_cents + sum(after.date_totals.values())
    require(after.principal_cents == principal, "principal aggregate disagrees with balances")
    liabilities = principal + after.accrued_cents
    require(after.backing_value_cents + after.deficit_cents >= liabilities, "backing plus deficit below liabilities")
    require(after.deficit_cents == max(Fraction(0), liabilities - after.backing_value_cents), "deficit is not actual shortfall")
    require(after.backing_value_cents + after.deficit_cents == principal + (after.accrued_cents + after.reserve_cents), "reserve balance sheet does not reconcile")
    if full(tx):
        require(principal == sum(a.spot_cents + sum(a.units.values()) for a in after.accounts.values()), "ledger principal differs from aggregates")
        require(principal == after.opening_principal_cents + sum(i.issued_cents for i in after.invoices.values()) + after.claimed_paid_cents - after.withdrawn_cents, "principal sources do not reconcile")


def encumbrance(before, after, tx):
    if tx is None:
        require(after.backing_asset_units == before.backing_asset_units, "unexplained backing movement")
        return
    if tx.kind == "checkpoint":
        fee = tx.data["fees_cents"]
        require(after.backing_value_cents == tx.data["gross_backing_value_cents"] - fee, "fee not charged once")
        require(after.backing_asset_units <= before.backing_asset_units, "checkpoint minted assets")
        require((before.backing_asset_units - after.backing_asset_units) * after.asset_price_cents == fee, "fee asset debit does not reconcile")
        return
    require(after.asset_price_cents == before.asset_price_cents, "operation changed checkpoint price")
    flow = tx.amount_cents if tx.kind == "issue" else -tx.amount_cents if tx.kind == "withdraw" else 0
    require(after.backing_value_cents - before.backing_value_cents == flow, "unauthorized backing movement")
    if tx.kind == "day_opened":
        return
    require(after.deposits_today_cents - before.deposits_today_cents == (tx.amount_cents if tx.kind == "issue" else 0), "deposit flow incorrect")
    require(after.withdrawals_today_cents - before.withdrawals_today_cents == (tx.amount_cents if tx.kind == "withdraw" else 0), "withdrawal flow incorrect")
    expected = flow + (tx.amount_cents if tx.kind == "claim" else 0)
    require(after.principal_cents - before.principal_cents == expected, "capital flow lacks matching liability movement")


def date_rule(before, after, tx):
    for key in keys(after, tx, "invoices"):
        i = after.invoices[key]
        require(type(i.due_day) is int and type(i.maturity_bound) is int and 0 <= i.maturity_bound <= i.due_day, "invalid M or D")
    if tx is not None and tx.kind in {"issue", "pay"}:
        i = before.invoices[tx.data["invoice_id"]]
        require(tx.actor == i.debtor, "settler is not debtor")
        if tx.kind == "issue":
            require(tx.data["mint_date"] == i.maturity_bound, "Issue did not mint at M")
        else:
            for leg in tx.data["legs"]:
                require(leg["date"] is None or before.cutoff < leg["date"] <= i.maturity_bound <= i.due_day, "payment date ineligible")


def _view(account, cutoff):
    view = {d: a for d, a in account.units.items() if d > cutoff}
    spot = account.effective_spot(cutoff)
    if spot:
        view[None] = spot
    return view


def cursor_monotonicity(before, after, tx):
    ids = before.accounts if tx is None else set(tx.changed_accounts) | set(tx.accounts)
    # At cutoff, interpret both sides using the NEW boundary; no units mutate.
    cutoff = after.cutoff
    expected = {key: _view(before.accounts[key], cutoff) for key in ids}
    def delta(account, date, amount):
        target = expected[account]
        target[date] = target.get(date, 0) + amount
        require(target[date] >= 0, "source lacks sufficient balance")
    if tx is not None:
        if tx.kind == "issue":
            i = before.invoices[tx.data["invoice_id"]]
            delta(i.creditor, i.maturity_bound if i.maturity_bound > cutoff else None, tx.amount_cents)
        elif tx.kind in {"transfer", "pay"}:
            recipient = tx.data["recipient"] if tx.kind == "transfer" else before.invoices[tx.data["invoice_id"]].creditor
            require(sum(l["amount_cents"] for l in tx.data["legs"]) == tx.amount_cents, "incorrect leg total")
            for leg in tx.data["legs"]:
                require(type(leg["amount_cents"]) is int and leg["amount_cents"] > 0, "invalid debit")
                delta(tx.actor, leg["date"], -leg["amount_cents"])
            for leg in tx.data["legs"]:
                delta(recipient, leg["date"], leg["amount_cents"])
        elif tx.kind == "extend":
            d = tx.data
            require(d["to_date"] > d["effective_from_date"] and d["to_date"] >= after.day + 1, "invalid extension cursor")
            require(d["effective_from_date"] == (after.day if d["from_date"] is None else d["from_date"]), "incorrect source cursor")
            delta(tx.actor, d["from_date"], -tx.amount_cents)
            delta(tx.actor, d["to_date"], tx.amount_cents)
        elif tx.kind == "claim":
            delta(tx.actor, None, tx.amount_cents)
        elif tx.kind == "withdraw":
            delta(tx.actor, None, -tx.amount_cents)
        elif tx.kind == "sell":
            d = tx.data
            delta(tx.actor, d["date"], -tx.amount_cents)
            delta(d["buyer"], d["date"], tx.amount_cents)
            delta(d["buyer"], None, -d["spot_cents"])
            delta(tx.actor, None, d["spot_cents"])
    require({k: {d:a for d,a in v.items() if a} for k,v in expected.items()} == {k: _view(after.accounts[k], cutoff) for k in ids}, "unexplained account/date movement")


def yield_conservation(before, after, tx):
    changed = keys(after, tx, "entitlements")
    added = []
    for key in changed:
        e = after.entitlements[key]
        require(key == e.entitlement_id and e.account_id in after.accounts, "invalid entitlement identity")
        require(type(e.amount_cents) is int and e.amount_cents > 0 and type(e.start_day) is int and e.start_day >= 1 and type(e.end_day) is int and e.end_day >= 0, "invalid entitlement")
        old = before.entitlements.get(key)
        if old is None:
            added.append(e)
        elif old != e:
            require(tx is not None and tx.kind == "claim" and tx.data["entitlement_id"] == key and not old.claimed and e.claimed, "existing entitlement moved or rewritten")
            require((old.account_id, old.amount_cents, old.start_day, old.end_day) == (e.account_id, e.amount_cents, e.start_day, e.end_day), "claim changed entitlement terms")
    if tx is not None and tx.kind in {"issue", "extend"}:
        require(len(added) == 1, "commitment must create one entitlement")
        e = added[0]
        start = after.day + 1 if tx.kind == "issue" else max(after.day + 1, tx.data["effective_from_date"] + 1)
        end = tx.data["mint_date"] if tx.kind == "issue" else tx.data["to_date"]
        require((e.account_id, e.amount_cents, e.start_day, e.end_day, e.claimed) == (tx.actor, tx.amount_cents, start, end, False), "incorrect commitment interval")
        require(e.as_dict() == tx.data["entitlement"], "event entitlement differs")
    else:
        require(not added, "unexpected new entitlement")
    if full(tx):
        owned = {k: set() for k in after.accounts}
        accrued = claimable = Fraction(0)
        intervals = {}
        matured_intervals = {}
        for key, e in after.entitlements.items():
            owned[e.account_id].add(key)
            if not e.claimed and e.start_day <= min(e.end_day, after.cutoff):
                interval = (e.start_day, min(e.end_day, after.cutoff))
                intervals[interval] = intervals.get(interval, 0) + e.amount_cents
                if e.end_day <= after.cutoff:
                    matured_intervals[interval] = matured_intervals.get(interval, 0) + e.amount_cents
        for (start,end), amount in intervals.items():
            delta = after.indices[end] - after.indices[start-1]
            accrued += amount * delta
            claimable += matured_intervals.get((start,end),0) * delta
        for key, a in after.accounts.items():
            require(len(a.entitlement_ids) == len(set(a.entitlement_ids)) and set(a.entitlement_ids) == owned[key], "entitlement owner index differs")
        require(accrued == after.accrued_total and claimable == after.claimable_total, "accrual aggregate differs from interval formula")
    else:
        for key in tx.changed_accounts:
            previous = before.accounts[key].entitlement_ids
            expected = previous + tuple(e.entitlement_id for e in added if e.account_id == key)
            require(after.accounts[key].entitlement_ids == expected, "entitlement ownership index changed")
    if tx is None:
        require(after.indices == before.indices, "unexplained index movement")
    elif tx.kind == "checkpoint":
        d = tx.data
        increment = Fraction(d["index_increment"])
        active = sum(e.amount_cents for e in before.entitlements.values() if not e.claimed and e.start_day <= after.day <= e.end_day)
        require(active == d["active_entitlement_cents"] and active <= d["previous_principal_cents"], "active intervals exceed previous principal")
        allocated = active * increment
        income = Fraction(d["distributable_cents"])
        require(income == allocated + Fraction(d["unallocated_to_reserve_cents"]), "income not allocated exactly once")
        require(after.accrued_total - before.accrued_total == allocated == Fraction(d["entitlement_accrual_cents"]), "wrong entitlement accrual")
        result = d["investment_result_cents"]
        require(result == (0 if d["bootstrap"] else d["gross_backing_value_cents"] - d["previous_backing_value_cents"] - d["deposits_cents"] + d["withdrawals_cents"] - d["fees_cents"]), "capital flows counted as income")
        require(d["previous_principal_cents"] == before.previous_checkpoint_principal_cents, "wrong denominator")
        require(increment == (income / d["previous_principal_cents"] if d["previous_principal_cents"] else 0), "incorrect index increment")
        if result < 0:
            require(income == increment == 0 and after.reserve_cents == max(0, before.reserve_cents + result) and after.deficit_cents == before.deficit_cents + max(0, -result - before.reserve_cents), "loss waterfall failed")
        else:
            repair = Fraction(d["deficit_repair_cents"])
            topup, share = Fraction(d["reserve_floor_topup_cents"]), Fraction(d["policy_reserve_cents"])
            require(repair == min(before.deficit_cents, result) and after.deficit_cents == before.deficit_cents - repair, "deficit repair incorrect")
            require(result == repair + topup + share + income, "positive waterfall does not conserve income")
            require(after.reserve_cents == before.reserve_cents + topup + share + income - allocated, "reserve allocation incorrect")
    elif tx.kind == "claim":
        old = before.entitlements[tx.data["entitlement_id"]]
        value = old.accrued(before.indices, before.cutoff)
        require(old.account_id == tx.actor and old.end_day <= before.cutoff and not old.claimed, "invalid Claim")
        paid = value.numerator // value.denominator
        require(tx.amount_cents == paid and Fraction(tx.data["value_cents"]) == value and Fraction(tx.data["residual_cents"]) == value - paid, "claim rounding incorrect")
        require(after.accrued_total == before.accrued_total - value and after.claimable_total == before.claimable_total - value and after.reserve_cents == before.reserve_cents + value - paid, "claim liability conversion incorrect")
    else:
        require(after.accrued_total == before.accrued_total and after.claimable_total == before.claimable_total, "operation manufactured accrual")
        require(after.indices is before.indices, "operation changed index")


def index_monotonicity(before, after, tx):
    require(after.indices[0] == 1, "I(0) must equal one")
    if full(tx):
        require(set(after.indices) == set(range(after.cutoff + 1)), "index series not contiguous")
        previous = Fraction(1)
        for day in range(after.cutoff + 1):
            value = after.indices[day]
            require(isinstance(value, Fraction) and value >= previous, "index decreased or is inexact")
            previous = value
    if tx is not None and tx.kind == "checkpoint":
        require(after.cutoff == after.day and after.closed, "checkpoint did not close day")
        require(all(after.indices[d] == value for d,value in before.indices.items()), "published index rewritten")
        require(after.indices[after.cutoff] == before.indices[before.cutoff] + Fraction(tx.data["index_increment"]), "index increment mismatch")
    else:
        require(after.indices == before.indices, "published index rewritten")


def invoice_conservation(before, after, tx):
    for key in keys(after, tx, "invoices"):
        i = after.invoices[key]
        require(type(i.amount_cents) is int and i.amount_cents > 0 and all(type(v) is int and v >= 0 for v in (i.issued_cents,i.paid_cents,i.outstanding_cents)), "invalid invoice balances")
        require(i.issued_cents + i.paid_cents + i.outstanding_cents == i.amount_cents, "invoice conservation failed")
        old = before.invoices.get(key)
        expected = old.as_dict() if old else None
        if tx is not None and tx.kind == "invoice_registered" and key == tx.data["invoice"]["invoice_id"]:
            require(old is None and i.creditor == tx.actor and i.signed_day == after.day and i.issued_cents == i.paid_cents == 0, "invalid registration")
            expected = tx.data["invoice"]
        elif tx is not None and tx.kind in {"issue","pay"} and key == tx.data["invoice_id"]:
            expected["outstanding_cents"] -= tx.amount_cents
            expected["issued_cents" if tx.kind == "issue" else "paid_cents"] += tx.amount_cents
            require(tx.data["outstanding_cents"] == expected["outstanding_cents"], "event invoice balance differs")
        require(i.as_dict() == expected, "unexplained invoice mutation")


def maturity_is_atomic(before, after, tx):
    for key in keys(after, tx, "accounts"):
        account = after.accounts[key]
        require(type(account.spot_cents) is int and account.spot_cents >= 0, "invalid spot balance")
        for date, amount in account.units.items():
            require(type(date) is int and date >= 0 and type(amount) is int and amount > 0, "invalid dated bucket")
        require(account.effective_spot(after.cutoff) + sum(v for d,v in account.units.items() if d > after.cutoff) == account.spot_cents + sum(account.units.values()), "maturity partition failed")
    if full(tx):
        dates, spot = {}, 0
        for a in after.accounts.values():
            spot += a.spot_cents
            for d,v in a.units.items():
                dates[d] = dates.get(d,0) + v
        require(dates == after.date_totals and spot == after.explicit_spot_cents and spot + sum(dates.values()) == after.principal_cents, "spot/dated aggregates double-count or lose principal")


def issue_is_unconditional(before, after, tx):
    candidates = before.invoices if full(tx) else tx.changed_invoices
    for key in candidates:
        if key in before.invoices:
            require(key in after.invoices and after.invoices[key].issued_cents >= before.invoices[key].issued_cents and after.invoices[key].paid_cents >= before.invoices[key].paid_cents, "settlement clawed back")
    allowed = tx.amount_cents if tx is not None and tx.kind == "withdraw" else 0
    require(after.principal_cents >= before.principal_cents - allowed, "issued principal destroyed")


def solvency(state, policy):
    return state.deficit_cents > 0


def liquidity_standard(state, policy):
    required = state.explicit_spot_cents + state.claimable_cents + sum(v for d,v in state.date_totals.items() if d <= state.cutoff + policy.liquidity_days)
    return state.backing_value_cents * policy.immediately_realizable_fraction < required


HARD_CHECKS = (state_integrity, principal_identity, encumbrance, date_rule, cursor_monotonicity, yield_conservation, index_monotonicity, invoice_conservation, maturity_is_atomic, issue_is_unconditional)
BREACH_CHECKS = (solvency, liquidity_standard)


def check_all(before, after, tx, policy):
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
    if tx is not None and tx.kind in {"claim", "withdraw"}:
        if solvency(before, policy) or liquidity_standard(before, policy):
            failures["suspension"] = "Claim/Withdraw attempted during breach"
    if tx is not None and tx.kind == "checkpoint" and tx.data["investment_result_cents"] >= 0:
        d = tx.data
        remainder = d["investment_result_cents"] - Fraction(d["deficit_repair_cents"])
        topup = min(remainder, max(0, policy.reserve_floor_cents - before.reserve_cents))
        if Fraction(d["reserve_floor_topup_cents"]) != topup or Fraction(d["policy_reserve_cents"]) != (remainder - topup) * policy.reserve_share:
            failures["yield_conservation"] = "reserve policy waterfall mismatch"
    if failures:
        raise InvariantViolation(failures)
    return {"hard": hard, "breaches": breaches}
