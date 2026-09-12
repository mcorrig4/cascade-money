import json
import os
from pathlib import Path
import subprocess
import sys

import pytest

from sim.events import DATA_FIELDS, validate_event
from sim.world import APPLE_AMOUNT_CENTS, APPLE_CHAIN, apple_fixture


ROOT = Path(__file__).resolve().parents[1]


def test_apple_fixture_is_four_real_settlements():
    vault = apple_fixture()
    events = vault.events.events
    assert len(events) == 10
    settlements = [event for event in events if event["type"] in ("issue", "pay")]
    assert [event["accounts"] for event in settlements] == [list(pair) for pair in zip(APPLE_CHAIN, APPLE_CHAIN[1:])]
    assert [sum(e["amount_cents"] for e in settlements[:index]) for index in range(1, 5)] == [APPLE_AMOUNT_CENTS * index for index in range(1, 5)]
    assert all(event["balance_sheet"]["dated_cents"] == APPLE_AMOUNT_CENTS for event in settlements)
    assert all(invoice.outstanding_cents == 0 for invoice in vault.state.invoices.values())
    assert dict(vault.state.accounts["Clearview Glass"].units) == {90: APPLE_AMOUNT_CENTS}
    assert all(not vault.state.accounts[name].units for name in APPLE_CHAIN[:-1])
    assert len(vault.state.entitlements) == 1
    assert next(iter(vault.state.entitlements.values())).account_id == "Apple"
    metrics = events[-1]["data"]["metrics"]
    assert metrics["reuse_multiple"] == "4/1"
    assert metrics["circulation_efficiency_per_day"] is None
    assert metrics["observed_principal_cent_days"] == 0
    assert vault.state.cutoff == 0
    for sequence, event in enumerate(events, 1):
        validate_event(event)
        assert event["seq"] == sequence
        assert all(event["checks"]["hard"].values())
        assert not any(event["checks"]["breaches"].values())


def test_fixture_is_byte_identical_for_same_configuration():
    assert apple_fixture(seed=1, days=5).events.lines == apple_fixture(seed=1, days=5).events.lines


def test_cli_writes_real_deterministic_ndjson_across_hash_seeds(tmp_path):
    outputs = []
    for hash_seed in ("1", "999"):
        target = tmp_path / f"events-{hash_seed}.ndjson"
        result = subprocess.run([sys.executable, "-m", "sim", "run", "--world", "apple-fixture", "--days", "5", "--seed", "1", "--out", str(target)], cwd=ROOT, env={**os.environ, "PYTHONHASHSEED": hash_seed}, capture_output=True, text=True, check=True)
        assert "$400,000,000" in result.stdout
        outputs.append(target.read_bytes())
    assert outputs[0] == outputs[1]
    assert len(outputs[0].splitlines()) == 10
    assert outputs[0].endswith(b"\n")


@pytest.mark.parametrize("args", [["--days", "0"], ["--days", "-1"], ["--seed", "-1"]])
def test_cli_rejects_invalid_configuration_without_output(tmp_path, args):
    target = tmp_path / "events.ndjson"
    result = subprocess.run([sys.executable, "-m", "sim", "run", "--world", "apple-fixture", "--out", str(target), *args], cwd=ROOT, capture_output=True, text=True)
    assert result.returncode == 2
    assert not target.exists()


def test_schema_rejects_missing_required_type_field():
    event = apple_fixture().events.events[0]
    del event["data"]["seed"]
    with pytest.raises(ValueError):
        validate_event(event)


def test_documented_example_lines_cover_every_emitted_event_type():
    document = (ROOT / "docs" / "EVENTS.md").read_text()
    examples = [json.loads(line) for line in document.splitlines() if line.startswith('{"accounts":')]
    assert {event["type"] for event in examples} == set(DATA_FIELDS)
    for event in examples:
        validate_event(event)
