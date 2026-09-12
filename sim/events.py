"""Deterministic, JSON-only event records and NDJSON output."""

import json
from fractions import Fraction
from typing import Iterable, TextIO

SCHEMA_VERSION = 1
DATA_FIELDS = {
    "run_started": {"world", "seed", "requested_days", "nodes", "policy", "phase"},
    "invoice_registered": {"invoice"},
    "issue": {"invoice_id", "debtor", "creditor", "outstanding_cents", "asset_units", "mint_date", "entitlement"},
    "transfer": {"sender", "recipient", "legs"},
    "pay": {"invoice_id", "debtor", "creditor", "outstanding_cents", "legs"},
    "operation_rejected": {"operation", "error_code", "message"},
    "run_completed": {"world", "requested_days", "daily_checkpoints_executed", "metrics"},
}
COMMON_FIELDS = {
    "schema_version", "seq", "type", "day", "request_id", "actor", "accounts",
    "amount_cents", "dates", "index", "balance_sheet", "checks", "data",
}


def rational(value: Fraction | int) -> str:
    value = Fraction(value)
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
    json.dumps(event, allow_nan=False)


class EventStream:
    """Keep canonical lines, so callers cannot mutate previously emitted events."""

    def __init__(self) -> None:
        self._lines: list[str] = []

    def append(self, event: dict) -> dict:
        record = {**event, "schema_version": SCHEMA_VERSION, "seq": len(self._lines) + 1}
        validate_event(record)
        line = json.dumps(record, separators=(",", ":"), sort_keys=True, allow_nan=False)
        self._lines.append(line)
        return json.loads(line)

    @property
    def events(self) -> tuple[dict, ...]:
        return tuple(json.loads(line) for line in self._lines)

    @property
    def lines(self) -> tuple[str, ...]:
        return tuple(self._lines)


def write_ndjson(lines: Iterable[str], destination: TextIO) -> None:
    for line in lines:
        destination.write(line + "\n")
