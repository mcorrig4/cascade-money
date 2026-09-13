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
    assert sum(b['amount_cents'] for b in proof)==50_000_000_000
    assert sum(b['amount_cents'] for b in proof if b['operation']=='issue')==15_000_000_000
    sony=[b for b in proof if b['beat']=='camera-sensors']
    assert len(sony)==1
    assert (sony[0]['debtor'],sony[0]['creditor'],sony[0]['amount_cents'],sony[0]['maturity'],sony[0]['deliver_to'])==('Apple','Sony',5_000_000_000,90,'foxconn-zhengzhou')
    samsung_tree=[b for b in proof if b['beat']!='camera-sensors']
    assert len([b for b in samsung_tree if b['operation']=='pay'])==9
    assert sum(b['amount_cents'] for b in samsung_tree)==45_000_000_000
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
    a=run_world(days=15,suppliers=40,invoices=60,retain=True,check_every=1)
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


def test_checkpoint_and_operation_verification_match_full_30_day_world():
    a=run_world(days=30,seed=1,check_every="checkpoint")
    b=run_world(days=30,seed=1,check_every=1)
    assert a.metrics==b.metrics
    assert a.metrics['story_totals']['apple-duo']=={'settled_cents':50_000_000_000,'committed_cents':15_000_000_000}


def test_branching_proof_reuses_only_original_day_90_units():
    result=run_world(days=5,suppliers=40,invoices=20,retain=True)
    events=result.vault.events.events
    proof=[e for e in events if e['type']=='story' and e['data']['story_id']=='apple-duo']
    assert len(proof)==11
    assert {e['data']['branch'] for e in proof} >= {'root','silica','chemicals','silica/refining','silica/freight','chemicals/feedstock','chemicals/rail'}
    assert proof[-1]['data']['settled_cents']==50_000_000_000
    assert proof[0]['data']['committed_cents']==10_000_000_000
    assert all(e['data']['committed_cents']==15_000_000_000 for e in proof[1:])
    annotations=[b for b in json.loads(Path('sim/story_annotations.json').read_text()) if b['story_id']!='apple-fixture']
    samsung_pay_ids={f'story:{i}' for i,b in enumerate(annotations) if b['story_id']=='apple-duo' and b['operation']=='pay'}
    payments=[e for e in events if e['type']=='pay' and e['data']['invoice_id'] in samsung_pay_ids]
    sony_id=next(f'story:{i}' for i,b in enumerate(annotations) if b['story_id']=='apple-duo' and b['beat']=='camera-sensors')
    assert any(e['type']=='issue' and e['data']['invoice_id']==sony_id for e in events)
    assert not any(e['type']=='pay' and e['data']['invoice_id']==sony_id for e in events)
    assert len(payments)==9
    assert all(l['date']==90 for e in payments for l in e['data']['legs'])


def test_operations_do_not_iterate_whole_ledger_maps(monkeypatch):
    from sim.storage import FrozenMap
    current=[]
    execute=Vault._execute
    def tracked(self,kind,*args,**kwargs):
        current.append(kind)
        try:return execute(self,kind,*args,**kwargs)
        finally:current.pop()
    monkeypatch.setattr(Vault,'_execute',tracked)
    for name in ('__iter__','items','values'):
        original=getattr(FrozenMap,name)
        def checked(self,_original=original):
            assert not current or current[-1]=='checkpoint', 'whole ledger iteration during operation'
            return _original(self)
        monkeypatch.setattr(FrozenMap,name,checked)
    difference=FrozenMap.difference
    def journal_only(self,previous):
        if current and current[-1]!='checkpoint':
            assert self is previous or any(a() is previous for a,_ in self._journal), 'structural scope scan during operation'
        return difference(self,previous)
    monkeypatch.setattr(FrozenMap,'difference',journal_only)
    run_world(days=10,suppliers=40,invoices=60,check_every=1)


def test_run_cli_defaults_to_checkpoint_verification(tmp_path,capsys):
    from sim.__main__ import main
    output=tmp_path/'events.ndjson'
    assert main(['run','--days','5','--suppliers','40','--invoices','20','--out',str(output)])==0
    events=[json.loads(line) for line in output.read_text().splitlines()]
    assert events[0]['data']['policy']['check_every']=='checkpoint'
    assert all(all(v is None for v in e['checks']['hard'].values()) for e in events if e['type']=='pay')
    assert all(all(e['checks']['hard'].values()) for e in events if e['type']=='checkpoint')
