from dataclasses import FrozenInstanceError, replace
from fractions import Fraction
import json
from pathlib import Path
import pytest
from hypothesis import given, strategies as st
from sim import Vault, InvariantViolation
from sim.index import IndexSeries
from sim.world import run_world
from sim.scenarios import stress


def test_corrected_story_routes_and_annotations():
    beats=json.loads(Path('sim/story_annotations.json').read_text())
    routes={
        'apple-duo':['Apple','Samsung Display','Corning','Great Lakes Silica','Pacific Freight'],
        'apple-processor':['Apple','TSMC','Sumco','Wacker','Bécancour Silicon'],
        'apple-battery':['Apple','Panasonic','Pohang Cathode','Glencore'],
        'apple-assembly':['Apple','Foxconn','Luxshare','Shenzhen PCB'],
        'tesla':['Tesla','Panasonic','Pohang Cathode','Glencore'],
    }
    for identifier, route in routes.items():
        chain=[b for b in beats if b['story_id']==identifier]
        assert [(b['debtor'],b['creditor']) for b in chain] == list(zip(route,route[1:]))
    assert not any(b['debtor']=='TSMC' and b['creditor']=='Corning' for b in beats)
    assert all(b['operation']=='extend_pay' for b in beats if b['story_id']=='tesla' and b['debtor']!='Tesla')
    proof=[b for b in beats if b['story_id']=='apple-duo']
    assert sum(b['amount_cents'] for b in proof)==40_000_000_000
    assert sum(b['amount_cents'] for b in proof if b['operation']=='issue')==10_000_000_000
    assert max(b['day'] for b in proof)<30


@given(st.lists(st.fractions(min_value=0,max_value=100,max_denominator=100000),min_size=1,max_size=15))
def test_short_interval_cache_equals_inclusive_index_formula(increments):
    series=IndexSeries()
    for d,increment in enumerate(increments,1):
        series=series.publish(d,series[d-1]+increment,increment)
    assert all(Fraction(n,series.scale)==series[d] for d,n in series.prefixes.items())
    for start in range(1,len(increments)+1):
        for end in range(start,len(increments)+1):
            assert series.interval(start,end)==series[end]-series[start-1]
    with pytest.raises(FrozenInstanceError):series._last=999


@pytest.mark.parametrize('field',['spot_total_cents','near_liquid_cents','supply_cents','invoice_face_cents','invoice_issued_cents','invoice_paid_cents','invoice_outstanding_cents'])
def test_full_reconciliation_detects_aggregate_drift(field):
    v=Vault(['A','B'],opening_spot={'A':100})
    v._state=replace(v.state,**{field:getattr(v.state,field)+1})
    with pytest.raises(InvariantViolation):v.audit()


def test_compact_snapshots_and_check_frequency_do_not_change_metrics():
    a=run_world(days=15,suppliers=40,invoices=60,retain=True)
    b=run_world(days=15,suppliers=40,invoices=60,retain=True,check_every=7)
    assert a.metrics==b.metrics
    for e in a.vault.events.events:
        assert ('backing_asset_units' in e['balance_sheet']) == (e['type'] in {'checkpoint','day_summary'})
        if e['type'] not in {'checkpoint','day_summary'}:
            assert all(type(value) is int for value in e['balance_sheet'].values())
    assert any(None in e['checks']['hard'].values() for e in b.vault.events.events)
    assert all(all(e['checks']['hard'].values()) for e in b.vault.events.events if e['type']=='checkpoint')


def test_exhaustive_and_incremental_stress_agree():
    a,_=stress(ops=300,seed=3)
    b,_=stress(ops=300,seed=3,exhaustive=True)
    assert a==b


def test_fast_state_copy_preserves_snapshots_and_invalidates_backing_cache():
    from sim.core import replace as evolve
    v=Vault(['A'],opening_spot={'A':100})
    before=v.state
    assert before.backing_value_cents==100
    updated=evolve(before,backing_asset_units=Fraction(2))
    expected=replace(before,backing_asset_units=Fraction(2))
    assert updated==expected and updated.backing_value_cents==200
    assert before.backing_value_cents==100
    with pytest.raises(TypeError):evolve(before,typo=1)


@given(st.fractions(max_denominator=10**12), st.fractions(max_denominator=10**12))
def test_exact_cent_accumulators_match_fraction(a,b):
    from sim.money import ExactCents
    from sim.events import rational
    x,y=ExactCents.of(a),ExactCents.of(b)
    assert (x+y).as_fraction()==a+b
    assert (x-y).as_fraction()==a-b
    assert (x*y).as_fraction()==a*b
    assert (x<b)==(a<b) and (x==y)==(a==b)
    assert (a+y).as_fraction()==a+b and (a-y).as_fraction()==a-b
    assert int(x)==int(a)
    assert rational(x)==rational(a)
    assert hash(x)==hash(a)


def test_exact_cent_accumulators_reject_invalid_denominators():
    from sim.money import ExactCents
    for denominator in (0,-1,0.5):
        with pytest.raises(ValueError):ExactCents(1,denominator)


@pytest.mark.parametrize('field', ['activity_delta','entitlement_endings'])
def test_final_audit_reconciles_future_schedules(field):
    v=Vault(['A','B'])
    v.register_invoice(request_id='invoice',actor='B',invoice_id='i',debtor='A',amount_cents=100,due_day=90)
    v.issue(request_id='issue',actor='A',invoice_id='i',amount_cents=100)
    v._state=replace(v.state,**{field:{}})
    with pytest.raises(InvariantViolation):v.audit()
