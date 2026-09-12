"""Phase A: immutable ledger records and atomic Issue, Transfer and Pay.

Day zero is the bootstrap boundary with I(0)=1. Daily advancement, investment
checkpoints and all Phase B operations are intentionally absent.
"""

from dataclasses import dataclass, field, replace
from fractions import Fraction
from types import MappingProxyType
from typing import Callable, Mapping

from .events import EventStream, rational
from . import invariants


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
    entitlement_ids: tuple[str, ...] = ()

    def __post_init__(self):
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
        return self.amount_cents * (indices[min(cutoff, self.end_day)] - indices[self.start_day - 1])

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
    reserve_cents: Fraction = Fraction(0)
    deficit_cents: Fraction = Fraction(0)
    deposits_today_cents: int = 0
    withdrawals_today_cents: int = 0
    previous_checkpoint_principal_cents: int = 0
    applied_requests: frozenset[str] = frozenset()

    def __post_init__(self):
        for name in ("accounts", "invoices", "entitlements", "indices"):
            object.__setattr__(self, name, MappingProxyType(dict(getattr(self, name))))

    @property
    def backing_value_cents(self) -> Fraction:
        return self.backing_asset_units * self.asset_price_cents

    @property
    def accrued_cents(self) -> Fraction:
        return sum((e.accrued(self.indices, self.cutoff) for e in self.entitlements.values() if not e.claimed), Fraction(0))

    @property
    def claimable_cents(self) -> Fraction:
        return sum((e.accrued(self.indices, self.cutoff) for e in self.entitlements.values() if not e.claimed and e.end_day <= self.cutoff), Fraction(0))

    def balance_sheet(self) -> dict:
        spot = sum(a.effective_spot(self.cutoff) for a in self.accounts.values())
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


@dataclass(frozen=True)
class Transition:
    kind: str
    request_id: str
    actor: str
    accounts: tuple[str, ...]
    amount_cents: int
    dates: tuple[int, ...]
    data: dict


class Vault:
    def __init__(self, accounts: list[str] | tuple[str, ...], *, asset_price_cents: Fraction | int = 100, policy: VaultPolicy | None = None):
        for account in accounts:
            _identifier(account, "account")
        if len(set(accounts)) != len(accounts):
            raise ProtocolError("duplicate_account", "account identifiers must be unique")
        if type(asset_price_cents) not in (int, Fraction) or asset_price_cents <= 0:
            raise ProtocolError("invalid_argument", "asset price must be an exact positive value")
        self._policy = policy or VaultPolicy()
        self._state = State(accounts={a: Account(a) for a in sorted(accounts)}, asset_price_cents=Fraction(asset_price_cents))
        self.events = EventStream()
        self.audit()

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
            "type": kind, "day": state.day, "request_id": request_id, "actor": actor,
            "accounts": list(dict.fromkeys(accounts)), "amount_cents": amount_cents,
            "dates": list(sorted(set(dates))), "index": {"day": state.cutoff, "value": rational(state.indices[state.cutoff])},
            "balance_sheet": state.balance_sheet(), "checks": checks, "data": data,
        }

    def emit_run_event(self, kind: str, data: dict) -> dict:
        if kind not in ("run_started", "run_completed"):
            raise ValueError("only run metadata can be emitted without a transition")
        return self.events.append(self._envelope(self.state, self.audit(), kind=kind, request_id=None, actor=None, accounts=(), amount_cents=0, dates=(), data=data))

    def _execute(self, kind: str, request_id: str, actor: str, prepare: Callable[[State], tuple[State, Transition]]) -> dict:
        before = self.state
        self.audit()
        try:
            _identifier(request_id, "request_id")
            _identifier(actor, "actor")
            if actor not in before.accounts:
                raise ProtocolError("unknown_account", "actor is not a vault account")
            if request_id in before.applied_requests:
                raise ProtocolError("replay", "request_id has already been applied")
            candidate, transition = prepare(before)
            candidate = replace(candidate, applied_requests=before.applied_requests | {request_id})
            checks = invariants.check_all(before, candidate, transition, self.policy)
            # All validation and JSON encoding happen before publishing the state.
            event = self.events.append(self._envelope(candidate, checks, kind=kind, request_id=request_id, actor=actor, accounts=transition.accounts, amount_cents=transition.amount_cents, dates=transition.dates, data=transition.data))
        except (ProtocolError, invariants.InvariantViolation) as error:
            self.events.append(self._envelope(before, self.audit(), kind="operation_rejected", request_id=request_id if isinstance(request_id, str) else None, actor=actor if isinstance(actor, str) else None, accounts=(actor,) if isinstance(actor, str) else (), amount_cents=0, dates=(), data={"operation": kind, "error_code": error.code, "message": str(error)}))
            raise
        self._state = candidate
        return event

    def register_invoice(self, *, request_id: str, actor: str, invoice_id: str, debtor: str, amount_cents: int, due_day: int, maturity_bound: int | None = None) -> dict:
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
            invoice = Invoice(invoice_id, actor, debtor, amount_cents, due_day, bound, state.day, amount_cents)
            candidate = replace(state, invoices={**state.invoices, invoice_id: invoice})
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
            accounts = dict(state.accounts)
            creditor = accounts[invoice.creditor]
            units = dict(creditor.units)
            units[invoice.maturity_bound] = units.get(invoice.maturity_bound, 0) + amount_cents
            accounts[invoice.creditor] = replace(creditor, units=units)
            entitlement = Entitlement(f"entitlement:{request_id}", actor, amount_cents, state.day + 1, invoice.maturity_bound)
            debtor = accounts[actor]
            accounts[actor] = replace(debtor, entitlement_ids=debtor.entitlement_ids + (entitlement.entitlement_id,))
            invoice = replace(invoice, outstanding_cents=invoice.outstanding_cents - amount_cents, issued_cents=invoice.issued_cents + amount_cents)
            asset_units = Fraction(amount_cents) / state.asset_price_cents
            candidate = replace(state, accounts=accounts, invoices={**state.invoices, invoice_id: invoice}, entitlements={**state.entitlements, entitlement.entitlement_id: entitlement}, backing_asset_units=state.backing_asset_units + asset_units, principal_cents=state.principal_cents + amount_cents, deposits_today_cents=state.deposits_today_cents + amount_cents)
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
        accounts = dict(state.accounts)
        accounts[sender] = replace(source, units=units, spot_cents=spot)
        target = accounts[recipient]  # Correct even for self-transfers.
        units, spot = dict(target.units), target.spot_cents
        for leg in legs:
            if leg.date is None:
                spot += leg.amount_cents
            else:
                units[leg.date] = units.get(leg.date, 0) + leg.amount_cents
        accounts[recipient] = replace(target, units=units, spot_cents=spot)
        return replace(state, accounts=accounts)

    def transfer(self, *, request_id: str, actor: str, recipient: str, amount_cents: int, date: int | None = None) -> dict:
        def prepare(state):
            leg = PaymentLeg(amount_cents, date)
            candidate = self._move(state, actor, recipient, (leg,))
            data = {"sender": actor, "recipient": recipient, "legs": [leg.as_dict()]}
            return candidate, Transition("transfer", request_id, actor, (actor, recipient), amount_cents, () if date is None else (date,), data)
        return self._execute("transfer", request_id, actor, prepare)

    def pay(self, *, request_id: str, actor: str, invoice_id: str, amount_cents: int, legs: tuple[PaymentLeg, ...] | list[PaymentLeg] | None = None) -> dict:
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
            candidate = self._move(state, actor, invoice.creditor, tuple(selected))
            invoice = replace(invoice, outstanding_cents=invoice.outstanding_cents - amount_cents, paid_cents=invoice.paid_cents + amount_cents)
            candidate = replace(candidate, invoices={**state.invoices, invoice_id: invoice})
            data = {"invoice_id": invoice_id, "debtor": actor, "creditor": invoice.creditor, "outstanding_cents": invoice.outstanding_cents, "legs": [leg.as_dict() for leg in selected]}
            return candidate, Transition("pay", request_id, actor, (actor, invoice.creditor), amount_cents, tuple(leg.date for leg in selected if leg.date is not None), data)
        return self._execute("pay", request_id, actor, prepare)
