"""Deterministic, JSON-only event records and NDJSON output."""

import json
from datetime import date, timedelta
from functools import lru_cache
import sys

sys.set_int_max_str_digits(0)
EPOCH = date(2025, 9, 9)


def iso_date(day: int) -> str:
    return (EPOCH + timedelta(days=day)).isoformat()

from fractions import Fraction
from typing import Iterable, TextIO

SCHEMA_VERSION = 2
DATA_FIELDS = {
    "run_started": {"world", "seed", "requested_days", "nodes", "policy", "phase"},
    "invoice_registered": {"invoice"},
    "issue": {"invoice_id", "debtor", "creditor", "outstanding_cents", "asset_units", "mint_date", "entitlement"},
    "transfer": {"sender", "recipient", "legs"},
    "pay": {"invoice_id", "debtor", "creditor", "outstanding_cents", "legs", "extension_request_ids"},
    "operation_rejected": {"operation", "error_code", "message"},
    "run_completed": {"world", "requested_days", "daily_checkpoints_executed", "metrics"},
}
DATA_FIELDS.update({
    "extend": {"from_date", "effective_from_date", "to_date", "entitlement"},
    "claim": {"entitlement_id", "value_cents", "residual_cents"},
    "withdraw": {"asset_units"},
    "sell": {"seller", "buyer", "date", "spot_cents", "discount_bps", "clearing_discount"},
    "day_opened": {"previous_cutoff"},
    "checkpoint": {"gross_backing_value_cents", "previous_backing_value_cents", "deposits_cents", "withdrawals_cents", "fees_cents", "investment_result_cents", "previous_principal_cents", "active_entitlement_cents", "distributable_cents", "entitlement_accrual_cents", "unallocated_to_reserve_cents", "deficit_repair_cents", "reserve_floor_topup_cents", "policy_reserve_cents", "index_increment", "matured_cents", "locked_principal_cent_days", "bootstrap"},
    "story": {"story_id", "beat", "caption", "camera_accounts", "settled_cents", "committed_cents"},
    "day_summary": {"new_invoices", "invoices_settled", "principal_committed_cents", "gross_settled_to_date_cents", "principal_committed_to_date_cents", "settled_to_committed", "extensions", "sells", "withdrawals", "balance_sheet"},
    "funding_shortfall": {"invoice_id", "deadline", "shortfall_cents", "kind"},
    "scenario_result": {"name", "passed", "detail"},
})
COMMON_FIELDS = {
    "schema_version", "seq", "type", "day", "iso_date", "request_id", "actor", "accounts",
    "amount_cents", "dates", "index", "balance_sheet", "checks", "data",
}


@lru_cache(maxsize=8192)
def rational(value: Fraction | int) -> str:
    value = value.as_fraction() if hasattr(value, "as_fraction") else Fraction(value)
    return f"{value.numerator}/{value.denominator}"


def validate_event(event: dict) -> None:
    """Validate the envelope and required type-specific fields before publishing."""
    if set(event) != COMMON_FIELDS or event["schema_version"] != SCHEMA_VERSION:
        raise ValueError("invalid event envelope")
    kind = event["type"]
    if kind not in DATA_FIELDS or set(event["data"]) != DATA_FIELDS[kind]:
        raise ValueError("invalid event type or data fields")
    for field in ("seq", "day", "amount_cents"):
        if type(event[field]) is not int or event[field] < (1 if field == "seq" else 0):
            raise ValueError(f"invalid {field}")
    if not isinstance(event["accounts"], list) or not all(isinstance(a, str) for a in event["accounts"]):
        raise ValueError("invalid accounts")
    if not all(type(d) is int and d >= 0 for d in event["dates"]):
        raise ValueError("invalid dates")
    if event["iso_date"] != iso_date(event["day"]):
        raise ValueError("incorrect ISO date")


class EventStream:
    """Keep canonical lines, so callers cannot mutate previously emitted events."""

    def __init__(self, *, destination=None, retain=True, observer=None) -> None:
        self._lines: list[str] = []
        self.destination, self.retain, self.observer = destination, retain, observer
        self.count = 0

    def append(self, event: dict) -> dict:
        record = {**event, "schema_version": SCHEMA_VERSION, "seq": self.count + 1}
        validate_event(record)
        line = json.dumps(record, separators=(",", ":"), sort_keys=True, allow_nan=False)
        if self.destination is not None:
            self.destination.write(line + "\n")
        if self.retain:
            self._lines.append(line)
        self.count += 1
        if self.observer is not None:
            self.observer(record)
        return record

    @property
    def events(self) -> tuple[dict, ...]:
        return tuple(json.loads(line) for line in self._lines)

    @property
    def lines(self) -> tuple[str, ...]:
        return tuple(self._lines)


def write_ndjson(lines: Iterable[str], destination: TextIO) -> None:
    for line in lines:
        destination.write(line + "\n")
