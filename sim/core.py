"""Exact dated-dollar ledger, atomic operations and daily investment checkpoints."""

from dataclasses import dataclass, field, replace as dataclass_replace
from fractions import Fraction
from functools import cached_property
from time import perf_counter
from types import MappingProxyType
from typing import Callable, Mapping

from .events import EventStream, rational, iso_date
from . import invariants
from .storage import FrozenMap, FrozenSet, AppendLog
from .index import IndexSeries
from .money import ExactCents


class ProtocolError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def _integer(value: int, name: str, minimum: int = 0) -> None:
    if type(value) is not int or value < minimum:
        raise ProtocolError("invalid_argument", f"{name} must be an integer >= {minimum}")


def _identifier(value: str, name: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise ProtocolError("invalid_argument", f"{name} must be a nonempty string")


@dataclass(frozen=True)
class Account:
    account_id: str
    spot_cents: int = 0
    units: Mapping[int, int] = field(default_factory=dict)
    entitlement_ids: AppendLog = field(default_factory=AppendLog)

    def __post_init__(self):
        object.__setattr__(self, "entitlement_ids", AppendLog.of(self.entitlement_ids))
        if not isinstance(self.units, MappingProxyType):
            object.__setattr__(self, "units", MappingProxyType(dict(self.units)))

    def effective_spot(self, cutoff: int) -> int:
        return self.spot_cents + sum(amount for date, amount in self.units.items() if date <= cutoff)


@dataclass(frozen=True)
class Invoice:
    invoice_id: str
    creditor: str
    debtor: str
    amount_cents: int
    due_day: int
    maturity_bound: int
    signed_day: int
    outstanding_cents: int
    issued_cents: int = 0
    paid_cents: int = 0
    item: str = "goods"
    quantity: int = 1
    unit: str = "lot"
    deliver_to: str = "creditor site"

    def as_dict(self) -> dict:
        return dict(vars(self))


@dataclass(frozen=True)
class Entitlement:
    entitlement_id: str
    account_id: str
    amount_cents: int
    start_day: int
    end_day: int
    claimed: bool = False

    def accrued(self, indices: Mapping[int, Fraction], cutoff: int) -> Fraction:
        if self.end_day < self.start_day or cutoff < self.start_day:
            return Fraction(0)
        return self.amount_cents * (indices.interval(self.start_day, min(cutoff, self.end_day)) if isinstance(indices, IndexSeries) else indices[min(cutoff, self.end_day)] - indices[self.start_day - 1])

    def as_dict(self) -> dict:
        return dict(vars(self))


@dataclass(frozen=True)
class PaymentLeg:
    amount_cents: int
    date: int | None = None  # None means effective spot, including matured buckets.

    def as_dict(self) -> dict:
        return {"amount_cents": self.amount_cents, "date": self.date}


@dataclass(frozen=True)
class VaultPolicy:
    liquidity_days: int = 7
    immediately_realizable_fraction: Fraction = Fraction(1)
    reserve_floor_cents: int = 0
    reserve_share: Fraction = Fraction(0)
    daily_fee_cents: int = 0

    def __post_init__(self):
        for name in ("liquidity_days", "reserve_floor_cents", "daily_fee_cents"):
            _integer(getattr(self, name), name)
        for name in ("immediately_realizable_fraction", "reserve_share"):
            value = getattr(self, name)
            if type(value) not in (int, Fraction) or not 0 <= value <= 1:
                raise ProtocolError("invalid_argument", f"{name} must be an exact fraction between zero and one")
            object.__setattr__(self, name, Fraction(value))

    def as_dict(self) -> dict:
        return {key: rational(value) if isinstance(value, Fraction) else value for key, value in vars(self).items()}


@dataclass(frozen=True)
class State:
    accounts: Mapping[str, Account]
    invoices: Mapping[str, Invoice] = field(default_factory=dict)
    entitlements: Mapping[str, Entitlement] = field(default_factory=dict)
    indices: Mapping[int, Fraction] = field(default_factory=lambda: {0: Fraction(1)})
    day: int = 0
    cutoff: int = 0
    backing_asset_units: Fraction = Fraction(0)
    asset_price_cents: Fraction = Fraction(100)
    principal_cents: int = 0
    reserve_cents: ExactCents = ExactCents()
    deficit_cents: ExactCents = ExactCents()
    deposits_today_cents: int = 0
    withdrawals_today_cents: int = 0
    previous_checkpoint_principal_cents: int = 0
    applied_requests: FrozenSet = field(default_factory=FrozenSet)
    closed: bool = False
    previous_backing_value_cents: int = 0
    accrued_total: ExactCents = ExactCents()
    claimable_total: ExactCents = ExactCents()
    date_totals: Mapping[int, int] = field(default_factory=dict)
    explicit_spot_cents: int = 0
    spot_total_cents: int = 0
    near_liquid_cents: int = 0
    supply_cents: int = 0
    activity_delta: Mapping[int, int] = field(default_factory=dict)
    entitlement_endings: Mapping[int, tuple[str, ...]] = field(default_factory=dict)
    active_notional_cents: int = 0
    invoice_face_cents: int = 0
    invoice_issued_cents: int = 0
    invoice_paid_cents: int = 0
    invoice_outstanding_cents: int = 0
    opening_principal_cents: int = 0
    claimed_paid_cents: int = 0
    withdrawn_cents: int = 0
    previous_locked_cents: int = 0
    linked_extensions: FrozenSet = field(default_factory=FrozenSet)
    extension_requests: FrozenSet = field(default_factory=FrozenSet)

    def __post_init__(self):
        for name in ("accounts", "invoices", "entitlements", "date_totals", "activity_delta", "entitlement_endings"):
            if not isinstance(getattr(self, name), FrozenMap):
                object.__setattr__(self, name, FrozenMap(getattr(self, name)))
        for name in ("accrued_total", "claimable_total", "reserve_cents", "deficit_cents"):
            object.__setattr__(self, name, ExactCents.of(getattr(self, name)))
        if not isinstance(self.indices, IndexSeries):
            object.__setattr__(self, "indices", IndexSeries(self.indices))

    @cached_property
    def backing_value_cents(self) -> Fraction:
        return self.backing_asset_units * self.asset_price_cents

    @property
    def accrued_cents(self) -> ExactCents:
        return self.accrued_total

    @property
    def claimable_cents(self) -> ExactCents:
        return self.claimable_total

    def balance_sheet(self, *, compact=False) -> dict:
        spot = self.spot_total_cents
        if compact:
            return {"backing_value_cents": int(self.backing_value_cents),
                    "principal_cents": self.principal_cents, "dated_cents": self.principal_cents-spot,
                    "spot_cents": spot, "unclaimed_accrued_cents": int(self.accrued_cents),
                    "claimable_cents": int(self.claimable_cents), "reserve_cents": int(self.reserve_cents),
                    "deficit_cents": int(self.deficit_cents)}
        return {
            "backing_asset_units": rational(self.backing_asset_units),
            "backing_value_cents": int(self.backing_value_cents),
            "principal_cents": self.principal_cents,
            "dated_cents": self.principal_cents - spot,
            "spot_cents": spot,
            "unclaimed_accrued_cents": rational(self.accrued_cents),
            "claimable_cents": rational(self.claimable_cents),
            "reserve_cents": rational(self.reserve_cents),
            "deficit_cents": rational(self.deficit_cents),
        }


def replace(record, **changes):
    """Copy immutable State storage in C rather than reinitializing every field.

    Ordinary dataclass construction/replacement remains available to tests and
    callers; only the internal transition builder takes this equivalent path.
    """
    if not isinstance(record, State):
        return dataclass_replace(record, **changes)
    unknown = changes.keys() - State.__dataclass_fields__.keys()
    if unknown:
        raise TypeError(f"unknown State fields: {sorted(unknown)}")
    data = record.__dict__.copy()
    data.update(changes)
    for name in ("accounts", "invoices", "entitlements", "date_totals", "activity_delta", "entitlement_endings"):
        if name in changes and not isinstance(data[name], FrozenMap):
            data[name] = FrozenMap(data[name])
    for name in ("accrued_total", "claimable_total", "reserve_cents", "deficit_cents"):
        if name in changes:
            data[name] = ExactCents.of(data[name])
    if "indices" in changes and not isinstance(data["indices"], IndexSeries):
        data["indices"] = IndexSeries(data["indices"])
    if data["backing_asset_units"] is not record.backing_asset_units or data["asset_price_cents"] is not record.asset_price_cents:
        data.pop("backing_value_cents", None)
    data.pop("_liquidity_result", None)
    result = object.__new__(State)
    object.__setattr__(result, "__dict__", data)
    return result


@dataclass(frozen=True)
class Transition:
    kind: str
    request_id: str
    actor: str
    accounts: tuple[str, ...]
    amount_cents: int
    dates: tuple[int, ...]
    data: dict
    changed_accounts: tuple[str, ...] = ()
    changed_invoices: tuple[str, ...] = ()
    changed_entitlements: tuple[str, ...] = ()


class Vault:
    def __init__(self, accounts: list[str] | tuple[str, ...], *, asset_price_cents: Fraction | int = 100, policy: VaultPolicy | None = None, opening_spot: Mapping[str, int] | None = None, opening_reserve_cents: int = 0, window_participants: tuple[str, ...] = (), event_stream: EventStream | None = None, check_every: int | str = 1):
        for account in accounts:
            _identifier(account, "account")
        if len(set(accounts)) != len(accounts):
            raise ProtocolError("duplicate_account", "account identifiers must be unique")
        if type(asset_price_cents) not in (int, Fraction) or asset_price_cents <= 0:
            raise ProtocolError("invalid_argument", "asset price must be an exact positive value")
        if check_every != "checkpoint":
            _integer(check_every, "check_every", 1)
        self.check_every = check_every
        self.operation_count = 0
        self._policy = policy or VaultPolicy()
        self._state = State(accounts={a: Account(a) for a in sorted(accounts)}, asset_price_cents=Fraction(asset_price_cents))
        opening_spot = dict(opening_spot or {})
        _integer(opening_reserve_cents, "opening_reserve_cents")
        for account, amount in opening_spot.items():
            if account not in self.state.accounts:
                raise ProtocolError("unknown_account", "unknown opening spot account")
            _integer(amount, "opening spot")
        if not set(window_participants) <= set(self.state.accounts):
            raise ProtocolError("unknown_account", "unknown window participant")
        self.window_participants = frozenset(window_participants)
        principal = sum(opening_spot.values())
        backing = principal + opening_reserve_cents
        self._state = replace(self.state, accounts={key: replace(a, spot_cents=opening_spot.get(key, 0)) for key, a in self.state.accounts.items()}, principal_cents=principal, explicit_spot_cents=principal, spot_total_cents=principal, near_liquid_cents=principal, supply_cents=principal, opening_principal_cents=principal, backing_asset_units=Fraction(backing)/self.state.asset_price_cents, reserve_cents=Fraction(opening_reserve_cents), previous_backing_value_cents=backing)
        self.events = event_stream or EventStream()
        self._last_checks = self.audit()
        self.timings = {name: 0.0 for name in ("prepare", "scope_diff", "invariants", "event_encoding")}

    @property
    def state(self) -> State:
        return self._state

    @property
    def policy(self) -> VaultPolicy:
        return self._policy

    @property
    def deficit_mode(self) -> bool:
        return invariants.solvency(self.state, self.policy)

    @property
    def claim_withdraw_suspended(self) -> bool:
        return self.deficit_mode or invariants.liquidity_standard(self.state, self.policy)

    def audit(self) -> dict:
        return invariants.check_all(self.state, self.state, None, self.policy)

    def _envelope(self, state: State, checks: dict, *, kind: str, request_id: str | None, actor: str | None, accounts: tuple[str, ...], amount_cents: int, dates: tuple[int, ...], data: dict) -> dict:
        return {
            "type": kind, "day": state.day, "iso_date": iso_date(state.day), "request_id": request_id, "actor": actor,
            "accounts": list(dict.fromkeys(accounts)), "amount_cents": amount_cents,
            "dates": list(sorted(set(dates))), "index": {"day": state.cutoff, "value": state.indices.serialized(state.cutoff)},
            "balance_sheet": state.balance_sheet(compact=kind not in {"checkpoint", "day_summary"}), "checks": checks, "data": data,
        }

    def emit_run_event(self, kind: str, data: dict) -> dict:
        if kind not in ("run_started", "run_completed", "story", "day_summary", "funding_shortfall", "scenario_result"):
            raise ValueError("only run metadata can be emitted without a transition")
        return self.events.append(self._envelope(self.state, self._last_checks, kind=kind, request_id=None, actor=None, accounts=(), amount_cents=0, dates=(), data=data))

    def _execute(self, kind: str, request_id: str, actor: str, prepare: Callable[[State], tuple[State, Transition]]) -> dict:
        before = self.state
        started = perf_counter()
        try:
            _identifier(request_id, "request_id")
            system = kind in {"day_opened", "checkpoint"}
            if not system:
                _identifier(actor, "actor")
            if not system and actor not in before.accounts:
                raise ProtocolError("unknown_account", "actor is not a vault account")
            if request_id in before.applied_requests:
                raise ProtocolError("replay", "request_id has already been applied")
            if before.closed and kind not in {"day_opened"}:
                raise ProtocolError("day_closed", "open the next day before operating")
            candidate, transition = prepare(before)
            prepared = perf_counter()
            changes = {}
            for field_name in ("accounts", "invoices", "entitlements"):
                old, new = getattr(before, field_name), getattr(candidate, field_name)
                keys, removed = ((), ()) if old is new else new.difference(old)
                if removed:
                    raise invariants.InvariantViolation({"state_integrity": "ledger records removed"})
                changes["changed_" + field_name] = keys
            transition = replace(transition, **changes)
            updates = {}
            explicit, spot, near, supply = before.explicit_spot_cents, before.spot_total_cents, before.near_liquid_cents, before.supply_cents
            for key in transition.changed_accounts:
                old, new = before.accounts[key], candidate.accounts[key]
                delta = new.spot_cents - old.spot_cents
                explicit += delta; spot += delta; near += delta; supply += delta
                if old.units is new.units:
                    continue
                for date in set(old.units) | set(new.units):
                    delta = new.units.get(date, 0) - old.units.get(date, 0)
                    if not delta: continue
                    updates[date] = updates.get(date, before.date_totals.get(date, 0)) + delta
                    supply += delta
                    if date <= before.cutoff: spot += delta
                    if date <= before.cutoff + self.policy.liquidity_days: near += delta
            dates = before.date_totals.updated(updates) if updates else before.date_totals
            if candidate.cutoff != before.cutoff:
                spot = explicit + sum(v for d,v in dates.items() if d <= candidate.cutoff)
                near = explicit + sum(v for d,v in dates.items() if d <= candidate.cutoff + self.policy.liquidity_days)
            invoice_totals = {}
            if transition.changed_invoices:
                fields = (("invoice_face_cents","amount_cents"), ("invoice_issued_cents","issued_cents"), ("invoice_paid_cents","paid_cents"), ("invoice_outstanding_cents","outstanding_cents"))
                invoice_totals = {aggregate:getattr(before,aggregate) for aggregate,_ in fields}
                for key in transition.changed_invoices:
                    old, new = before.invoices.get(key), candidate.invoices[key]
                    for aggregate, field in fields:
                        invoice_totals[aggregate] += getattr(new,field) - (getattr(old,field) if old else 0)
            activity_updates, ending_updates = {}, {}
            for key in transition.changed_entitlements:
                if key in before.entitlements: continue
                right = candidate.entitlements[key]
                ending_updates[right.end_day] = ending_updates.get(right.end_day, before.entitlement_endings.get(right.end_day, AppendLog())) + (key,)
                if right.start_day <= right.end_day:
                    for date, amount in ((right.start_day, right.amount_cents), (right.end_day+1, -right.amount_cents)):
                        activity_updates[date] = activity_updates.get(date, before.activity_delta.get(date, 0)) + amount
            activity = before.activity_delta.updated(activity_updates) if activity_updates else before.activity_delta
            endings = before.entitlement_endings.updated(ending_updates) if ending_updates else before.entitlement_endings
            candidate = replace(candidate, activity_delta=activity, entitlement_endings=endings, date_totals=dates, explicit_spot_cents=explicit, spot_total_cents=spot,
                                near_liquid_cents=near, supply_cents=supply, **invoice_totals,
                                applied_requests=before.applied_requests | {request_id})
            if candidate.backing_asset_units is before.backing_asset_units and candidate.asset_price_cents is before.asset_price_cents:
                object.__setattr__(candidate, "backing_value_cents", before.backing_value_cents)
            scoped = perf_counter()
            if kind == "checkpoint" or (self.check_every != "checkpoint" and self.operation_count % self.check_every == 0):
                checks = invariants.check_all(before, candidate, transition, self.policy)
            else:
                checks = {"hard": {f.__name__: None for f in invariants.HARD_CHECKS},
                          "breaches": {f.__name__: f(candidate, self.policy) for f in invariants.BREACH_CHECKS}}

            checked = perf_counter()
            # All validation and JSON encoding happen before publishing the state.
            event = self.events.append(self._envelope(candidate, checks, kind=kind, request_id=request_id, actor=actor, accounts=transition.accounts, amount_cents=transition.amount_cents, dates=transition.dates, data=transition.data))
        except (ProtocolError, invariants.InvariantViolation) as error:
            rejected = Transition("rejected", "", actor, (), 0, (), {})
            checks = invariants.check_all(before, before, rejected, self.policy)
            self.events.append(self._envelope(before, checks, kind="operation_rejected", request_id=request_id if isinstance(request_id, str) else None, actor=actor if isinstance(actor, str) else None, accounts=(actor,) if isinstance(actor, str) else (), amount_cents=0, dates=(), data={"operation": kind, "error_code": error.code, "message": str(error)}))
            raise
        self.timings["prepare"] += prepared - started
        self.timings["scope_diff"] += scoped - prepared
        self.timings["invariants"] += checked - scoped
        self.timings["event_encoding"] += perf_counter() - checked
        self._state = candidate
        self.operation_count += 1
        self._last_checks = checks
        return event

    def register_invoice(self, *, request_id: str, actor: str, invoice_id: str, debtor: str, amount_cents: int, due_day: int, maturity_bound: int | None = None, item: str = "goods", quantity: int = 1, unit: str = "lot", deliver_to: str = "creditor site") -> dict:
        def prepare(state):
            _identifier(invoice_id, "invoice_id")
            _identifier(debtor, "debtor")
            _integer(amount_cents, "amount_cents", 1)
            _integer(due_day, "due_day")
            bound = due_day if maturity_bound is None else maturity_bound
            _integer(bound, "maturity_bound")
            if bound > due_day:
                raise ProtocolError("invalid_bound", "M must be no later than D")
            if debtor not in state.accounts:
                raise ProtocolError("unknown_account", "debtor is not a vault account")
            if invoice_id in state.invoices:
                raise ProtocolError("duplicate_invoice", "invoice identifier already exists")
            for name, value in (("item", item), ("unit", unit), ("deliver_to", deliver_to)):
                _identifier(value, name)
            _integer(quantity, "quantity", 1)
            invoice = Invoice(invoice_id, actor, debtor, amount_cents, due_day, bound, state.day, amount_cents, item=item, quantity=quantity, unit=unit, deliver_to=deliver_to)
            candidate = replace(state, invoices=state.invoices.updated({invoice_id: invoice}))
            return candidate, Transition("invoice_registered", request_id, actor, (debtor, actor), amount_cents, (bound, due_day), {"invoice": invoice.as_dict()})
        return self._execute("invoice_registered", request_id, actor, prepare)

    @staticmethod
    def _payable(state: State, invoice_id: str, actor: str, amount: int) -> Invoice:
        _identifier(invoice_id, "invoice_id")
        _integer(amount, "amount_cents", 1)
        if invoice_id not in state.invoices:
            raise ProtocolError("unknown_invoice", "invoice does not exist")
        invoice = state.invoices[invoice_id]
        if actor != invoice.debtor:
            raise ProtocolError("unauthorized", "only the invoice debtor can settle it")
        if amount > invoice.outstanding_cents:
            raise ProtocolError("invoice_balance", "amount exceeds invoice outstanding balance")
        return invoice

    def issue(self, *, request_id: str, actor: str, invoice_id: str, amount_cents: int) -> dict:
        def prepare(state):
            invoice = self._payable(state, invoice_id, actor, amount_cents)
            accounts = {}
            creditor = state.accounts[invoice.creditor]
            units = dict(creditor.units)
            units[invoice.maturity_bound] = units.get(invoice.maturity_bound, 0) + amount_cents
            accounts[invoice.creditor] = replace(creditor, units=units)
            entitlement = Entitlement(f"entitlement:{request_id}", actor, amount_cents, state.day + 1, invoice.maturity_bound)
            debtor = accounts.get(actor, state.accounts[actor])
            accounts[actor] = replace(debtor, entitlement_ids=debtor.entitlement_ids + (entitlement.entitlement_id,))
            invoice = replace(invoice, outstanding_cents=invoice.outstanding_cents - amount_cents, issued_cents=invoice.issued_cents + amount_cents)
            if not state.asset_price_cents:
                raise ProtocolError("zero_asset_price", "worthless backing cannot fund an Issue")
            asset_units = Fraction(amount_cents) / state.asset_price_cents
            candidate = replace(state, accounts=state.accounts.updated(accounts), invoices=state.invoices.updated({invoice_id: invoice}), entitlements=state.entitlements.updated({entitlement.entitlement_id: entitlement}), backing_asset_units=(state.backing_value_cents + amount_cents) / state.asset_price_cents, principal_cents=state.principal_cents + amount_cents, deposits_today_cents=state.deposits_today_cents + amount_cents)
            data = {"invoice_id": invoice_id, "debtor": actor, "creditor": invoice.creditor, "outstanding_cents": invoice.outstanding_cents, "asset_units": rational(asset_units), "mint_date": invoice.maturity_bound, "entitlement": entitlement.as_dict()}
            return candidate, Transition("issue", request_id, actor, (actor, invoice.creditor), amount_cents, (invoice.maturity_bound,), data)
        return self._execute("issue", request_id, actor, prepare)

    @staticmethod
    def _move(state: State, sender: str, recipient: str, legs: tuple[PaymentLeg, ...]) -> State:
        _identifier(recipient, "recipient")
        if recipient not in state.accounts:
            raise ProtocolError("unknown_account", "recipient is not a vault account")
        source = state.accounts[sender]
        units, spot = dict(source.units), source.spot_cents
        for leg in legs:
            if not isinstance(leg, PaymentLeg):
                raise ProtocolError("invalid_argument", "payment legs must be PaymentLeg records")
            _integer(leg.amount_cents, "leg amount", 1)
            if leg.date is not None:
                _integer(leg.date, "leg date")
                if leg.date <= state.cutoff:
                    raise ProtocolError("matured_is_spot", "matured units must be selected as effective spot")
                if units.get(leg.date, 0) < leg.amount_cents:
                    raise ProtocolError("insufficient_balance", "insufficient dated balance")
                units[leg.date] -= leg.amount_cents
                if units[leg.date] == 0:
                    del units[leg.date]
            else:
                remainder = leg.amount_cents
                debit = min(spot, remainder)
                spot -= debit
                remainder -= debit
                for date in sorted(d for d in units if d <= state.cutoff):
                    debit = min(units[date], remainder)
                    units[date] -= debit
                    remainder -= debit
                    if units[date] == 0:
                        del units[date]
                    if not remainder:
                        break
                if remainder:
                    raise ProtocolError("insufficient_balance", "insufficient effective spot")
        accounts = {}
        accounts[sender] = replace(source, units=units, spot_cents=spot)
        target = accounts.get(recipient, state.accounts[recipient])  # Correct even for self-transfers.
        units, spot = dict(target.units), target.spot_cents
        for leg in legs:
            if leg.date is None:
                spot += leg.amount_cents
            else:
                units[leg.date] = units.get(leg.date, 0) + leg.amount_cents
        accounts[recipient] = replace(target, units=units, spot_cents=spot)
        return replace(state, accounts=state.accounts.updated(accounts))

    def transfer(self, *, request_id: str, actor: str, recipient: str, amount_cents: int, date: int | None = None) -> dict:
        def prepare(state):
            leg = PaymentLeg(amount_cents, date)
            candidate = self._move(state, actor, recipient, (leg,))
            data = {"sender": actor, "recipient": recipient, "legs": [leg.as_dict()]}
            return candidate, Transition("transfer", request_id, actor, (actor, recipient), amount_cents, () if date is None else (date,), data)
        return self._execute("transfer", request_id, actor, prepare)

    def pay(self, *, request_id: str, actor: str, invoice_id: str, amount_cents: int, legs: tuple[PaymentLeg, ...] | list[PaymentLeg] | None = None, extension_request_ids: tuple[str, ...] = ()) -> dict:
        def prepare(state):
            invoice = self._payable(state, invoice_id, actor, amount_cents)
            selected = []
            if legs is None:
                remainder = amount_cents
                account = state.accounts[actor]
                for date, available in sorted(account.units.items()):
                    if state.cutoff < date <= invoice.maturity_bound and remainder:
                        take = min(available, remainder)
                        selected.append(PaymentLeg(take, date))
                        remainder -= take
                if remainder:
                    selected.append(PaymentLeg(remainder))
            else:
                if not isinstance(legs, (tuple, list)):
                    raise ProtocolError("invalid_argument", "legs must be a list or tuple")
                selected = list(legs)
            for leg in selected:
                if not isinstance(leg, PaymentLeg):
                    raise ProtocolError("invalid_argument", "invalid payment leg")
                _integer(leg.amount_cents, "leg amount", 1)
                if leg.date is not None:
                    _integer(leg.date, "leg date")
                    if leg.date > invoice.due_day or leg.date > invoice.maturity_bound:
                        raise ProtocolError("maturity_bound", "delivered date exceeds invoice D or M")
            if sum(leg.amount_cents for leg in selected) != amount_cents:
                raise ProtocolError("payment_total", "payment legs must sum to amount_cents")
            if not isinstance(extension_request_ids, tuple):
                raise ProtocolError("invalid_extension_link", "extension links must be a tuple of IDs")
            for identifier in extension_request_ids:
                _identifier(identifier, "extension request ID")
            if len(set(extension_request_ids)) != len(extension_request_ids):
                raise ProtocolError("invalid_extension_link", "extension links must be unique IDs")
            linked_amounts = {}
            for identifier in extension_request_ids:
                entitlement = state.entitlements.get(f"entitlement:{identifier}")
                if identifier not in state.extension_requests or identifier in state.linked_extensions or entitlement is None or entitlement.account_id != actor:
                    raise ProtocolError("invalid_extension_link", "extension link is unknown, used or belongs to another account")
                linked_amounts[entitlement.end_day] = linked_amounts.get(entitlement.end_day, 0) + entitlement.amount_cents
            for date, amount in linked_amounts.items():
                if amount > sum(l.amount_cents for l in selected if l.date == date):
                    raise ProtocolError("invalid_extension_link", "payment does not deliver the linked extended amount")
            candidate = self._move(state, actor, invoice.creditor, tuple(selected))
            candidate = replace(candidate, linked_extensions=state.linked_extensions | set(extension_request_ids))
            invoice = replace(invoice, outstanding_cents=invoice.outstanding_cents - amount_cents, paid_cents=invoice.paid_cents + amount_cents)
            candidate = replace(candidate, invoices=state.invoices.updated({invoice_id: invoice}))
            data = {"invoice_id": invoice_id, "debtor": actor, "creditor": invoice.creditor, "outstanding_cents": invoice.outstanding_cents, "legs": [leg.as_dict() for leg in selected], "extension_request_ids": list(extension_request_ids)}
            return candidate, Transition("pay", request_id, actor, (actor, invoice.creditor), amount_cents, tuple(leg.date for leg in selected if leg.date is not None), data)
        return self._execute("pay", request_id, actor, prepare)

    @staticmethod
    def _debit(account: Account, amount: int, date: int | None, cutoff: int) -> Account:
        _integer(amount, "amount_cents", 1)
        units, spot = dict(account.units), account.spot_cents
        if date is not None:
            _integer(date, "date")
            if date <= cutoff:
                raise ProtocolError("matured_is_spot", "select matured balances as spot")
            if units.get(date, 0) < amount:
                raise ProtocolError("insufficient_balance", "insufficient dated balance")
            units[date] -= amount
            if not units[date]:
                del units[date]
        else:
            remainder = amount - min(spot, amount)
            spot -= min(spot, amount)
            for maturity in sorted(d for d in units if d <= cutoff):
                take = min(remainder, units[maturity])
                remainder -= take
                units[maturity] -= take
                if not units[maturity]:
                    del units[maturity]
                if not remainder:
                    break
            if remainder:
                raise ProtocolError("insufficient_balance", "insufficient effective spot")
        return replace(account, units=units, spot_cents=spot)

    def extend(self, *, request_id: str, actor: str, amount_cents: int, to_date: int, from_date: int | None = None) -> dict:
        def prepare(state):
            _integer(to_date, "to_date")
            old_date = state.day if from_date is None else from_date
            _integer(old_date, "from_date")
            if to_date <= old_date or to_date < state.day + 1:
                raise ProtocolError("invalid_extension", "new date must be later and at least tomorrow")
            account = self._debit(state.accounts[actor], amount_cents, from_date, state.cutoff)
            units = dict(account.units)
            units[to_date] = units.get(to_date, 0) + amount_cents
            entitlement = Entitlement(f"entitlement:{request_id}", actor, amount_cents, max(state.day + 1, old_date + 1), to_date)
            account = replace(account, units=units, entitlement_ids=account.entitlement_ids + (entitlement.entitlement_id,))
            candidate = replace(state, accounts=state.accounts.updated({actor: account}), entitlements=state.entitlements.updated({entitlement.entitlement_id: entitlement}), extension_requests=state.extension_requests | {request_id})
            data = {"from_date": from_date, "effective_from_date": old_date, "to_date": to_date, "entitlement": entitlement.as_dict()}
            return candidate, Transition("extend", request_id, actor, (actor,), amount_cents, (old_date, to_date), data)
        return self._execute("extend", request_id, actor, prepare)

    def claim(self, *, request_id: str, actor: str, entitlement_id: str) -> dict:
        def prepare(state):
            _identifier(entitlement_id, "entitlement_id")
            if self.claim_withdraw_suspended:
                raise ProtocolError("suspended", "Claim suspended by deficit or liquidity breach")
            if entitlement_id not in state.entitlements:
                raise ProtocolError("unknown_entitlement", "entitlement does not exist")
            entitlement = state.entitlements[entitlement_id]
            if entitlement.account_id != actor:
                raise ProtocolError("unauthorized", "entitlement belongs to another account")
            if entitlement.claimed:
                raise ProtocolError("already_claimed", "entitlement already claimed")
            if entitlement.end_day > state.cutoff:
                raise ProtocolError("not_claimable", "end index is not published")
            value = entitlement.accrued(state.indices, state.cutoff)
            paid = value.numerator // value.denominator
            residual = value - paid
            account = replace(state.accounts[actor], spot_cents=state.accounts[actor].spot_cents + paid)
            candidate = replace(state, accounts=state.accounts.updated({actor: account}), entitlements=state.entitlements.updated({entitlement_id: replace(entitlement, claimed=True)}), principal_cents=state.principal_cents + paid, claimed_paid_cents=state.claimed_paid_cents + paid, accrued_total=state.accrued_total - value, claimable_total=state.claimable_total - value, reserve_cents=state.reserve_cents + residual)
            data = {"entitlement_id": entitlement_id, "value_cents": rational(value), "residual_cents": rational(residual)}
            return candidate, Transition("claim", request_id, actor, (actor,), paid, (entitlement.start_day, entitlement.end_day), data)
        return self._execute("claim", request_id, actor, prepare)

    def withdraw(self, *, request_id: str, actor: str, amount_cents: int) -> dict:
        def prepare(state):
            if self.claim_withdraw_suspended:
                raise ProtocolError("suspended", "Withdraw suspended by deficit or liquidity breach")
            account = self._debit(state.accounts[actor], amount_cents, None, state.cutoff)
            quantity = Fraction(amount_cents) / state.asset_price_cents
            candidate = replace(state, accounts=state.accounts.updated({actor: account}), backing_asset_units=(state.backing_value_cents - amount_cents) / state.asset_price_cents, principal_cents=state.principal_cents - amount_cents, withdrawals_today_cents=state.withdrawals_today_cents + amount_cents, withdrawn_cents=state.withdrawn_cents + amount_cents)
            return candidate, Transition("withdraw", request_id, actor, (actor,), amount_cents, (), {"asset_units": rational(quantity)})
        return self._execute("withdraw", request_id, actor, prepare)

    def sell(self, *, request_id: str, actor: str, buyer: str, amount_cents: int, date: int, discount_bps: int) -> dict:
        def prepare(state):
            _integer(date, "date")
            _integer(discount_bps, "discount_bps")
            if discount_bps >= 10000:
                raise ProtocolError("invalid_discount", "discount must be below 100 percent")
            if buyer not in self.window_participants or buyer == actor:
                raise ProtocolError("window_gate", "buyer must be a distinct funded window participant")
            _integer(amount_cents, "amount_cents", 1)
            consideration = amount_cents * (10000 - discount_bps) // 10000
            if not consideration:
                raise ProtocolError("invalid_discount", "consideration must be at least one cent")
            candidate = self._move(state, actor, buyer, (PaymentLeg(amount_cents, date),))
            candidate = self._move(candidate, buyer, actor, (PaymentLeg(consideration),))
            data = {"seller": actor, "buyer": buyer, "date": date, "spot_cents": consideration, "discount_bps": discount_bps, "clearing_discount": rational(Fraction(amount_cents - consideration, amount_cents))}
            return candidate, Transition("sell", request_id, actor, (actor, buyer), amount_cents, (date,), data)
        return self._execute("sell", request_id, actor, prepare)

    def begin_day(self, day: int) -> dict:
        def prepare(state):
            _integer(day, "day", 1)
            if not state.closed or day != state.day + 1:
                raise ProtocolError("invalid_day", "days must follow completed checkpoints consecutively")
            candidate = replace(state, day=day, closed=False, deposits_today_cents=0, withdrawals_today_cents=0)
            return candidate, Transition("day_opened", f"day:{day}", None, (), 0, (), {"previous_cutoff": state.cutoff})
        return self._execute("day_opened", f"day:{day}", None, prepare)

    def checkpoint(self, *, backing_value_cents: int | None = None, fee_cents: int | None = None) -> dict:
        """Publish a gross pre-fee mark. None means no investment result that day."""
        def prepare(state):
            gross = int(state.backing_value_cents) if backing_value_cents is None else backing_value_cents
            fee = self.policy.daily_fee_cents if fee_cents is None else fee_cents
            _integer(gross, "backing_value_cents")
            _integer(fee, "fee_cents")
            if fee > gross:
                raise ProtocolError("invalid_mark", "fees cannot exceed backing")
            bootstrap = state.day == 0
            if bootstrap and (gross != state.backing_value_cents or fee):
                raise ProtocolError("bootstrap_income", "bootstrap checkpoint publishes I(0)=1 without income")
            result = 0 if bootstrap else gross - state.previous_backing_value_cents - state.deposits_today_cents + state.withdrawals_today_cents - fee
            closing = gross - fee
            if not state.backing_asset_units and closing:
                raise ProtocolError("invalid_mark", "cannot mark nonexistent assets")
            reserve, deficit = state.reserve_cents.as_fraction(), state.deficit_cents.as_fraction()
            repair = floor_topup = policy_share = Fraction(0)
            income = Fraction(0)
            if result < 0:
                absorbed = min(reserve, -result)
                reserve -= absorbed
                deficit += -result - absorbed
            else:
                repair = min(deficit, result)
                deficit -= repair
                remainder = result - repair
                floor_topup = min(remainder, max(Fraction(0), self.policy.reserve_floor_cents - reserve))
                reserve += floor_topup
                remainder -= floor_topup
                policy_share = remainder * self.policy.reserve_share
                reserve += policy_share
                income = remainder - policy_share
            principal = state.previous_checkpoint_principal_cents
            active = state.active_notional_cents + state.activity_delta.get(state.day, 0)
            increment = income / principal if principal else Fraction(0)
            allocated = active * increment
            unallocated = income - allocated
            reserve += unallocated
            index = state.indices[state.cutoff] + increment
            indices = state.indices.publish(state.day, index, increment)
            ending_numerator = 0
            if state.day > state.cutoff:
                for key in state.entitlement_endings.get(state.day, ()):
                    right = state.entitlements[key]
                    if not right.claimed and right.start_day <= right.end_day:
                        ending_numerator += right.amount_cents * (indices.prefixes[right.end_day] - indices.prefixes[right.start_day-1])
            newly_claimable = Fraction(ending_numerator, indices.scale)
            candidate = replace(state, active_notional_cents=active, indices=indices, cutoff=state.day, closed=True, asset_price_cents=Fraction(gross)/state.backing_asset_units if state.backing_asset_units else state.asset_price_cents, backing_asset_units=state.backing_asset_units * Fraction(closing, gross) if gross else state.backing_asset_units, previous_locked_cents=sum(v for d,v in state.date_totals.items() if d > state.day), accrued_total=state.accrued_total + allocated, claimable_total=state.claimable_total + newly_claimable, reserve_cents=reserve, deficit_cents=deficit, previous_checkpoint_principal_cents=state.principal_cents, previous_backing_value_cents=closing)
            data = {"gross_backing_value_cents": gross, "previous_backing_value_cents": state.previous_backing_value_cents, "deposits_cents": state.deposits_today_cents, "withdrawals_cents": state.withdrawals_today_cents, "fees_cents": fee, "investment_result_cents": result, "previous_principal_cents": principal, "active_entitlement_cents": active, "distributable_cents": rational(income), "entitlement_accrual_cents": rational(allocated), "unallocated_to_reserve_cents": rational(unallocated), "deficit_repair_cents": rational(repair), "reserve_floor_topup_cents": rational(floor_topup), "policy_reserve_cents": rational(policy_share), "index_increment": rational(increment), "matured_cents": sum(v for d,v in state.date_totals.items() if state.cutoff < d <= state.day), "locked_principal_cent_days": state.previous_locked_cents if not bootstrap else 0, "bootstrap": bootstrap}
            return candidate, Transition("checkpoint", f"checkpoint:{state.day}", None, (), 0, (state.day,), data)
        return self._execute("checkpoint", f"checkpoint:{self.state.day}", None, prepare)
