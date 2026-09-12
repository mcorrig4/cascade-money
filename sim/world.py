"""The deterministic Phase A Apple fixture, not the Phase B world generator."""

from fractions import Fraction

from .core import Vault, _integer
from .events import rational

APPLE_CHAIN = ("Apple", "Foxconn", "TSMC", "Corning", "Clearview Glass")
APPLE_AMOUNT_CENTS = 100_000_000 * 100


def apple_fixture(*, days: int = 5, seed: int = 1) -> Vault:
    _integer(days, "days", 1)
    _integer(seed, "seed")
    vault = Vault(APPLE_CHAIN)
    vault.emit_run_event("run_started", {
        "world": "apple-fixture", "seed": seed, "requested_days": days,
        "nodes": [{"id": name, "name": name, "role": "anchor" if index == 0 else "supplier"} for index, name in enumerate(APPLE_CHAIN)],
        "policy": vault.policy.as_dict(), "phase": "A",
    })
    for hop, (debtor, creditor) in enumerate(zip(APPLE_CHAIN, APPLE_CHAIN[1:]), 1):
        vault.register_invoice(request_id=f"register:{hop}", actor=creditor, invoice_id=f"apple:{hop}", debtor=debtor, amount_cents=APPLE_AMOUNT_CENTS, due_day=90, maturity_bound=90)
    vault.issue(request_id="settle:1", actor="Apple", invoice_id="apple:1", amount_cents=APPLE_AMOUNT_CENTS)
    for hop, debtor in enumerate(APPLE_CHAIN[1:-1], 2):
        vault.pay(request_id=f"settle:{hop}", actor=debtor, invoice_id=f"apple:{hop}", amount_cents=APPLE_AMOUNT_CENTS)
    # Derive counters from actual settlement events; never from the story target.
    settled = sum(event["amount_cents"] for event in vault.events.events if event["type"] in ("issue", "pay"))
    deposited = sum(event["amount_cents"] for event in vault.events.events if event["type"] == "issue")
    vault.emit_run_event("run_completed", {
        "world": "apple-fixture", "requested_days": days, "daily_checkpoints_executed": 0,
        "metrics": {
            "gross_invoice_settled_cents": settled,
            "principal_deposited_cents": deposited,
            "principal_locked_cents": vault.state.balance_sheet()["dated_cents"],
            "reuse_multiple": rational(Fraction(settled, deposited)),
            "observed_principal_cent_days": 0,
            "circulation_efficiency_per_day": None,
            "circulation_efficiency_status": "unavailable_until_daily_checkpoints",
        },
    })
    return vault
