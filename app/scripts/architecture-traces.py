"""Capture reference checkpoints and an existing local USYC run, without sending transactions."""
import json
import sys
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from sim.scenarios import loss_then_recovery

result = loss_then_recovery()
assert result.passed, result.detail

def snapshot(label, sheet, index, rounded=False):
    accrued = Fraction(sheet['unclaimed_accrued_cents'])
    if rounded:
        # balanceSheet() uses ceil(accruedScaled / SCALE), in micro-USDC.
        micro = accrued * 10000
        accrued = Fraction(-(-micro.numerator // micro.denominator), 10000)
    values = dict(backing=Fraction(sheet['backing_value_cents']), principal=Fraction(str(sheet['principal_cents'])),
                  accrued=accrued, reserve=Fraction(sheet['reserve_cents']), deficit=Fraction(sheet['deficit_cents']))
    assert values['backing'] + values['deficit'] == values['principal'] + values['accrued'] + values['reserve']
    return dict(label=label, index=index, **{key: str(value / 100) for key, value in values.items()})

reference = [snapshot(f"Day {e['day']}", e['balance_sheet'], e['index']['value'])
             for e in result.events if e['type'] == 'checkpoint']
source = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'contracts/.local/yield-demo.ndjson'
records = [json.loads(line) for line in source.read_text().splitlines() if line.strip()]
assert records and all(e.get('mode') == 'local' and not e.get('dry_run') for e in records)
selected = [e for e in records if e['label'].startswith('day+') or e['label'] in ('Apple claim', 'silica claim / freight principal is spot', 'freight withdrawal')]
local = [snapshot(e['label'].replace('day+', 'Day ').replace('silica claim / freight principal is spot', 'Silica claim'), e['balance_sheet'], e['index'], rounded=True) for e in selected]
output = ROOT / 'app/src/architecture/traces.json'
output.write_text(json.dumps(dict(reference=reference, local=local), indent=2) + '\n')
print(output.relative_to(ROOT))
