import json
import os
from pathlib import Path
import subprocess
import sys

import pytest

from sim.events import DATA_FIELDS, validate_event
from sim.world import APPLE_AMOUNT_CENTS, apple_fixture


ROOT = Path(__file__).resolve().parents[1]


def test_apple_fixture_is_ten_branched_settlements():
    vault=apple_fixture()
    events=vault.events.events
    settlements=[e for e in events if e['type'] in ('issue','pay')]
    assert len(settlements)==10 and len(events)==32
    assert sum(e['amount_cents'] for e in settlements)==45_000_000_000
    assert all(e['balance_sheet']['dated_cents']==APPLE_AMOUNT_CENTS for e in settlements)
    assert all(i.outstanding_cents==0 for i in vault.state.invoices.values())
    assert len(vault.state.entitlements)==1
    assert events[-1]['data']['metrics']['reuse_multiple']=='9/2'
    assert sum(a.units.get(90,0) for a in vault.state.accounts.values())==APPLE_AMOUNT_CENTS
    for event in events:validate_event(event)


def test_fixture_is_byte_identical_for_same_configuration():
    assert apple_fixture(seed=1, days=5).events.lines == apple_fixture(seed=1, days=5).events.lines


def test_cli_writes_real_deterministic_ndjson_across_hash_seeds(tmp_path):
    outputs = []
    for hash_seed in ("1", "999"):
        target = tmp_path / f"events-{hash_seed}.ndjson"
        result = subprocess.run([sys.executable, "-m", "sim", "run", "--world", "apple-fixture", "--days", "5", "--seed", "1", "--out", str(target)], cwd=ROOT, env={**os.environ, "PYTHONHASHSEED": hash_seed}, capture_output=True, text=True, check=True)
        assert "$450,000,000" in result.stdout
        outputs.append(target.read_bytes())
    assert outputs[0] == outputs[1]
    assert len(outputs[0].splitlines()) == 32
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
