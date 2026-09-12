from dataclasses import FrozenInstanceError, replace
from fractions import Fraction

import pytest

from sim import InvariantViolation, PaymentLeg, ProtocolError, Vault, VaultPolicy
from sim import invariants
from sim.core import Entitlement, Transition


@pytest.fixture
def vault():
    return Vault(["A", "B", "C", "D"])


def invoice(vault, name="invoice", *, debtor="A", creditor="B", amount=100, date=90, bound=None):
    vault.register_invoice(request_id=f"register:{name}", actor=creditor, invoice_id=name, debtor=debtor, amount_cents=amount, due_day=date, maturity_bound=bound)


def fund(vault, name="fund", *, recipient="B", amount=100, date=90):
    invoice(vault, name, creditor=recipient, amount=amount, date=date)
    return vault.issue(request_id=f"issue:{name}", actor="A", invoice_id=name, amount_cents=amount)


def assert_rejected(vault, code, operation):
    before = vault.state
    count = len(vault.events.lines)
    with pytest.raises(ProtocolError) as error:
        operation()
    assert error.value.code == code
    assert vault.state is before
    assert len(vault.events.lines) == count + 1
    event = vault.events.events[-1]
    assert event["type"] == "operation_rejected"
    assert event["data"]["error_code"] == code
    assert all(event["checks"]["hard"].values())
    assert event["balance_sheet"] == before.balance_sheet()


def test_issue_mints_at_m_and_separates_asset_quantity_from_value():
    vault = Vault(["A", "B"], asset_price_cents=125)
    invoice(vault, amount=10_001, date=90, bound=30)
    event = vault.issue(request_id="issue", actor="A", invoice_id="invoice", amount_cents=10_001)
    assert dict(vault.state.accounts["B"].units) == {30: 10_001}
    assert vault.state.backing_asset_units == Fraction(10_001, 125)
    assert vault.state.backing_value_cents == 10_001
    assert vault.state.deposits_today_cents == 10_001
    assert vault.state.previous_checkpoint_principal_cents == 0
    assert vault.state.indices == {0: Fraction(1)}
    entitlement = vault.state.entitlements["entitlement:issue"]
    assert (entitlement.account_id, entitlement.start_day, entitlement.end_day) == ("A", 1, 30)
    assert event["data"]["outstanding_cents"] == 0


def test_partial_issues_merge_principal_but_keep_entitlements(vault):
    invoice(vault)
    for request, amount in (("one", 40), ("two", 60)):
        vault.issue(request_id=request, actor="A", invoice_id="invoice", amount_cents=amount)
    assert dict(vault.state.accounts["B"].units) == {90: 100}
    assert len(vault.state.accounts["A"].entitlement_ids) == 2
    assert vault.state.invoices["invoice"].issued_cents == 100
    assert_rejected(vault, "invoice_balance", lambda: vault.issue(request_id="three", actor="A", invoice_id="invoice", amount_cents=1))


@pytest.mark.parametrize("amount", [0, -1, True, 1.5, "100"])
def test_issue_rejects_nonpositive_or_noninteger_money(vault, amount):
    invoice(vault)
    assert_rejected(vault, "invalid_argument", lambda: vault.issue(request_id="bad", actor="A", invoice_id="invoice", amount_cents=amount))


def test_issue_rejects_unauthorized_and_overpayment(vault):
    invoice(vault)
    assert_rejected(vault, "unauthorized", lambda: vault.issue(request_id="bad", actor="C", invoice_id="invoice", amount_cents=1))
    assert_rejected(vault, "invoice_balance", lambda: vault.issue(request_id="bad", actor="A", invoice_id="invoice", amount_cents=101))


def test_replay_cannot_settle_twice_even_with_changed_payload(vault):
    invoice(vault)
    vault.issue(request_id="once", actor="A", invoice_id="invoice", amount_cents=40)
    assert_rejected(vault, "replay", lambda: vault.issue(request_id="once", actor="A", invoice_id="invoice", amount_cents=60))
    assert vault.state.invoices["invoice"].outstanding_cents == 60


def test_invoice_is_immutable_unique_and_creditor_approved(vault):
    invoice(vault, date=90, bound=30)
    with pytest.raises(FrozenInstanceError):
        vault.state.invoices["invoice"].maturity_bound = 90
    with pytest.raises(TypeError):
        vault.state.invoices["invoice"] = None
    assert vault.state.invoices["invoice"].creditor == "B"
    assert_rejected(vault, "duplicate_invoice", lambda: vault.register_invoice(request_id="new-request", actor="C", invoice_id="invoice", debtor="A", amount_cents=100, due_day=90))
    assert_rejected(vault, "invalid_bound", lambda: invoice(vault, "bad", date=30, bound=90))


def test_transfer_splits_merges_and_leaves_entitlements(vault):
    fund(vault)
    entitlements = dict(vault.state.entitlements)
    for request, amount in (("one", 30), ("two", 20)):
        vault.transfer(request_id=request, actor="B", recipient="C", amount_cents=amount, date=90)
    assert dict(vault.state.accounts["B"].units) == {90: 50}
    assert dict(vault.state.accounts["C"].units) == {90: 50}
    assert vault.state.entitlements == entitlements
    assert vault.state.accounts["C"].entitlement_ids == ()
    assert_rejected(vault, "insufficient_balance", lambda: vault.transfer(request_id="bad", actor="B", recipient="C", amount_cents=51, date=90))


def test_issue_at_cutoff_is_spot_without_rewriting_the_bucket(vault):
    event = fund(vault, date=0)
    assert dict(vault.state.accounts["B"].units) == {0: 100}
    assert event["balance_sheet"]["spot_cents"] == 100
    assert event["balance_sheet"]["dated_cents"] == 0
    assert vault.state.entitlements["entitlement:issue:fund"].accrued(vault.state.indices, 0) == 0
    vault.transfer(request_id="spot", actor="B", recipient="C", amount_cents=60)
    assert vault.state.accounts["B"].effective_spot(0) == 40
    assert vault.state.accounts["C"].spot_cents == 60
    assert vault.state.principal_cents == 100
    assert_rejected(vault, "matured_is_spot", lambda: vault.transfer(request_id="dated-zero", actor="B", recipient="C", amount_cents=1, date=0))


def test_self_transfer_and_self_issue_do_not_lose_balances(vault):
    invoice(vault, creditor="A")
    vault.issue(request_id="issue", actor="A", invoice_id="invoice", amount_cents=100)
    before = vault.state.accounts["A"]
    vault.transfer(request_id="self", actor="A", recipient="A", amount_cents=100, date=90)
    assert vault.state.accounts["A"] == before
    assert_rejected(vault, "insufficient_balance", lambda: vault.transfer(request_id="over", actor="A", recipient="A", amount_cents=101, date=90))


def test_pay_earliest_eligible_dates_then_spot(vault):
    for date, amount in ((5, 30), (10, 40), (40, 100), (0, 50)):
        fund(vault, str(date), date=date, amount=amount)
    invoice(vault, "payable", debtor="B", creditor="C", amount=100, date=90, bound=10)
    event = vault.pay(request_id="pay", actor="B", invoice_id="payable", amount_cents=100)
    assert event["data"]["legs"] == [{"amount_cents": 30, "date": 5}, {"amount_cents": 40, "date": 10}, {"amount_cents": 30, "date": None}]
    assert vault.state.invoices["payable"].outstanding_cents == 0
    assert vault.state.accounts["B"].units[40] == 100
    assert vault.state.accounts["B"].effective_spot(0) == 20


def test_explicit_pay_order_is_a_preference_not_a_rule(vault):
    fund(vault, "dated", amount=50, date=10)
    fund(vault, "spot", amount=50, date=0)
    invoice(vault, "payable", debtor="B", creditor="C", amount=60, date=90, bound=10)
    event = vault.pay(request_id="pay", actor="B", invoice_id="payable", amount_cents=60, legs=[PaymentLeg(50), PaymentLeg(10, 10)])
    assert event["data"]["legs"][0]["date"] is None
    assert vault.state.accounts["B"].units[10] == 40


def test_transfer_does_not_bypass_pay_m_bound(vault):
    fund(vault, date=90)
    vault.transfer(request_id="transfer", actor="B", recipient="C", amount_cents=100, date=90)
    invoice(vault, "early", debtor="C", creditor="D", amount=100, date=90, bound=30)
    assert_rejected(vault, "maturity_bound", lambda: vault.pay(request_id="bad", actor="C", invoice_id="early", amount_cents=100, legs=[PaymentLeg(100, 90)]))
    assert_rejected(vault, "insufficient_balance", lambda: vault.pay(request_id="auto", actor="C", invoice_id="early", amount_cents=100))


def test_late_invalid_leg_rolls_back_all_earlier_debits(vault):
    fund(vault, date=10, amount=50)
    invoice(vault, "payable", debtor="B", creditor="C", date=30)
    assert_rejected(vault, "insufficient_balance", lambda: vault.pay(request_id="bad", actor="B", invoice_id="payable", amount_cents=100, legs=[PaymentLeg(50, 10), PaymentLeg(50)]))
    assert_rejected(vault, "insufficient_balance", lambda: vault.pay(request_id="duplicates", actor="B", invoice_id="payable", amount_cents=100, legs=[PaymentLeg(50, 10), PaymentLeg(50, 10)]))
    assert_rejected(vault, "payment_total", lambda: vault.pay(request_id="sum", actor="B", invoice_id="payable", amount_cents=100, legs=[PaymentLeg(49, 10)]))


def test_combined_issue_pay_invoice_balance_and_replay(vault):
    fund(vault)
    invoice(vault, "payable", debtor="B", creditor="C")
    vault.issue(request_id="partial-issue", actor="B", invoice_id="payable", amount_cents=40)
    vault.pay(request_id="pay", actor="B", invoice_id="payable", amount_cents=60)
    payable = vault.state.invoices["payable"]
    assert (payable.issued_cents, payable.paid_cents, payable.outstanding_cents) == (40, 60, 0)
    assert_rejected(vault, "replay", lambda: vault.pay(request_id="pay", actor="B", invoice_id="payable", amount_cents=60))
    assert_rejected(vault, "invoice_balance", lambda: vault.pay(request_id="more", actor="B", invoice_id="payable", amount_cents=1))


def test_reverse_invoice_never_claws_back_original_issue(vault):
    fund(vault)
    original = vault.state.invoices["fund"]
    holder = vault.state.accounts["B"]
    invoice(vault, "reversal", debtor="B", creditor="A")
    assert vault.state.invoices["fund"] == original
    assert vault.state.accounts["B"] == holder
    vault.pay(request_id="reverse-payment", actor="B", invoice_id="reversal", amount_cents=100)
    assert vault.state.invoices["fund"] == original
    assert vault.state.principal_cents == 100


def test_hard_invariant_failure_rolls_back_candidate(vault):
    fund(vault)
    before = vault.state
    def corrupt(state):
        accounts = dict(state.accounts)
        accounts["B"] = replace(accounts["B"], units={80: 100})
        return replace(state, accounts=accounts), Transition("transfer", "corrupt", "B", ("B", "C"), 1, (90,), {"sender": "B", "recipient": "C", "legs": [{"amount_cents": 1, "date": 90}]})
    with pytest.raises(InvariantViolation) as error:
        vault._execute("transfer", "corrupt", "B", corrupt)
    assert "cursor_monotonicity" in error.value.failures
    assert vault.state is before
    assert "corrupt" not in vault.state.applied_requests
    assert vault.events.events[-1]["data"]["error_code"] == "invariant_violation"


def test_event_serialization_failure_does_not_commit(vault, monkeypatch):
    invoice(vault)
    before, lines = vault.state, vault.events.lines
    def fail(event):
        raise ValueError("serialization unavailable")
    monkeypatch.setattr(vault.events, "append", fail)
    with pytest.raises(ValueError, match="serialization unavailable"):
        vault.issue(request_id="issue", actor="A", invoice_id="invoice", amount_cents=100)
    assert vault.state is before
    assert vault.events.lines == lines


def test_event_and_account_views_cannot_mutate_protocol(vault):
    fund(vault)
    with pytest.raises(TypeError):
        vault.state.accounts["B"].units[90] = 0
    record = vault.events.events[-1]
    record["balance_sheet"]["principal_cents"] = 0
    assert vault.events.events[-1]["balance_sheet"]["principal_cents"] == 100


def test_inclusive_entitlement_arithmetic_and_empty_intervals():
    indices = {0: Fraction(1), 1: Fraction(101, 100), 2: Fraction(103, 100), 3: Fraction(106, 100), 4: Fraction(110, 100)}
    entitlement = Entitlement("e", "A", 100, 1, 3)
    assert entitlement.accrued(indices, 0) == 0
    assert entitlement.accrued(indices, 1) == 1
    assert entitlement.accrued(indices, 2) == 3
    assert entitlement.accrued(indices, 3) == entitlement.accrued(indices, 4) == 6
    assert Entitlement("e", "A", 100, 2, 3).accrued(indices, 3) == 5
    assert Entitlement("e", "A", 100, 4, 1).accrued(indices, 4) == 0
    assert Entitlement("e", "A", 1, 1, 1).accrued(indices, 1) == Fraction(1, 100)


def test_liquidity_breach_does_not_reject_issue_or_fabricate_deficit():
    vault = Vault(["A", "B"], policy=VaultPolicy(immediately_realizable_fraction=Fraction(1, 2)))
    event = fund(vault, date=0)
    assert all(event["checks"]["hard"].values())
    assert event["checks"]["breaches"] == {"solvency": False, "liquidity_standard": True}
    assert vault.claim_withdraw_suspended
    assert not vault.deficit_mode
    assert vault.state.deficit_cents == 0


@pytest.mark.parametrize("date,breach", [(0, True), (7, True), (8, False)])
def test_liquidity_uses_inclusive_n_day_horizon(date, breach):
    vault = Vault(["A", "B"], policy=VaultPolicy(immediately_realizable_fraction=Fraction(1, 2)))
    fund(vault, date=date)
    assert invariants.liquidity_standard(vault.state, vault.policy) is breach


def test_solvency_indicator_uses_actual_deficit(vault):
    fund(vault)
    short = replace(vault.state, backing_asset_units=Fraction(9, 10), deficit_cents=Fraction(10))
    result = invariants.check_all(short, short, None, vault.policy)
    assert all(result["hard"].values())
    assert result["breaches"]["solvency"] is True


def test_liquidity_includes_claimable_yield(vault):
    fund(vault)
    # Direct indicator fixture; no Phase B checkpoint operation is implemented.
    entitlement = Entitlement("e", "A", 100, 1, 1)
    state = replace(vault.state, day=1, cutoff=1, indices={0: Fraction(1), 1: Fraction(2)}, entitlements={"e": entitlement}, backing_asset_units=Fraction(3, 2), accrued_total=Fraction(100), claimable_total=Fraction(100))
    assert invariants.liquidity_standard(state, VaultPolicy(immediately_realizable_fraction=Fraction(1, 2)))


def test_every_hard_invariant_detects_its_corruption(vault):
    fund(vault, date=10)
    before = vault.state
    account = before.accounts["B"]
    original_invoice = before.invoices["fund"]
    entitlement = before.entitlements["entitlement:issue:fund"]
    corruptions = {
        "state_integrity": replace(before, cutoff=1),
        "principal_identity": replace(before, principal_cents=101),
        "encumbrance": replace(before, backing_asset_units=Fraction(9, 10)),
        "date_rule": replace(before, invoices={"fund": replace(original_invoice, maturity_bound=11)}),
        "cursor_monotonicity": replace(before, accounts={**before.accounts, "B": replace(account, units={11: 100})}),
        "yield_conservation": replace(before, entitlements={entitlement.entitlement_id: replace(entitlement, account_id="C")}),
        "index_monotonicity": replace(before, indices={0: Fraction(0)}),
        "invoice_conservation": replace(before, invoices={"fund": replace(original_invoice, outstanding_cents=1)}),
        "maturity_is_atomic": replace(before, accounts={**before.accounts, "B": replace(account, spot_cents=100)}),
        "issue_is_unconditional": replace(before, invoices={"fund": replace(original_invoice, issued_cents=0, outstanding_cents=100)}),
    }
    assert set(corruptions) == {check.__name__ for check in invariants.HARD_CHECKS}
    for check in invariants.HARD_CHECKS:
        with pytest.raises(ValueError):
            check(before, corruptions[check.__name__], None)


def test_checker_runs_every_function_even_after_a_failure(vault, monkeypatch):
    called = []
    def fail(*args):
        called.append("fail")
        raise ValueError("deliberate")
    def following(*args):
        called.append("following")
    def breach(*args):
        called.append("breach")
        return False
    monkeypatch.setattr(invariants, "HARD_CHECKS", (fail, following))
    monkeypatch.setattr(invariants, "BREACH_CHECKS", (breach,))
    with pytest.raises(InvariantViolation):
        vault.audit()
    assert called == ["fail", "following", "breach"]


def test_every_check_runs_on_each_success_and_rejection(vault, monkeypatch):
    calls = []
    def wrap(check):
        def recording(*args):
            calls.append(check.__name__)
            return check(*args)
        recording.__name__ = check.__name__
        return recording
    expected = {check.__name__ for check in invariants.HARD_CHECKS + invariants.BREACH_CHECKS}
    monkeypatch.setattr(invariants, "HARD_CHECKS", tuple(wrap(check) for check in invariants.HARD_CHECKS))
    monkeypatch.setattr(invariants, "BREACH_CHECKS", tuple(wrap(check) for check in invariants.BREACH_CHECKS))
    operations = [
        lambda: invoice(vault),
        lambda: vault.issue(request_id="issue", actor="A", invoice_id="invoice", amount_cents=100),
        lambda: vault.transfer(request_id="transfer", actor="B", recipient="C", amount_cents=10, date=90),
        lambda: invoice(vault, "payable", debtor="B", creditor="D", amount=90),
        lambda: vault.pay(request_id="pay", actor="B", invoice_id="payable", amount_cents=90),
    ]
    for operation in operations:
        calls.clear()
        operation()
        assert set(calls) == expected
        assert all(calls.count(name) == 1 for name in expected)  # Every post-transition check; immutable pre-state was already checked.
    calls.clear()
    with pytest.raises(ProtocolError):
        vault.transfer(request_id="bad", actor="B", recipient="C", amount_cents=1, date=90)
    assert set(calls) == expected
    assert all(calls.count(name) == 1 for name in expected)


def test_policy_is_fixed_for_the_run(vault):
    with pytest.raises(AttributeError):
        vault.policy = VaultPolicy(liquidity_days=30)
    with pytest.raises(FrozenInstanceError):
        vault.policy.liquidity_days = 30


def test_index_checker_detects_a_decrease(vault):
    corrupted = replace(vault.state, cutoff=2, indices={0: Fraction(1), 1: Fraction(2), 2: Fraction(3, 2)})
    with pytest.raises(ValueError, match="index decreased"):
        invariants.index_monotonicity(vault.state, corrupted, None)
