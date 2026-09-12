from dataclasses import replace
from fractions import Fraction
import json
from pathlib import Path

import pytest

from sim import Vault, VaultPolicy, ProtocolError, InvariantViolation
from sim.events import iso_date, validate_event
from sim.scenarios import issue, run_scenarios, stress
from sim.world import generate_world, run_world, paired_runs


def test_worked_deposit_loss_recovery_example():
    v=Vault(['A','B'],opening_spot={'B':40000},opening_reserve_cents=1000,policy=VaultPolicy(reserve_floor_cents=1000))
    issue(v,'initial',amount=60000,maturity=30)
    v.checkpoint()
    expected=[(102000,600,1400,0,Fraction(101,100)),(203000,1200,1800,0,Fraction(51,50)),(200000,1200,0,1200,Fraction(51,50)),(201500,1200,300,0,Fraction(51,50)),(203000,1840,1160,0,Fraction(128,125))]
    for day,(result,expected_values) in enumerate(zip((1000,1000,-3000,1500,1500),expected),1):
        v.begin_day(day)
        if day==2:
            issue(v,'deposit',amount=100000,maturity=90)
        v.checkpoint(backing_value_cents=int(v.state.backing_value_cents)+result)
        assert (v.state.backing_value_cents,v.state.accrued_cents,v.state.reserve_cents,v.state.deficit_cents,v.state.indices[day])==expected_values


def test_fees_are_debited_once_as_asset_units():
    v=Vault(['A','B'])
    issue(v,'initial',amount=10000)
    v.checkpoint();v.begin_day(1)
    event=v.checkpoint(backing_value_cents=10100,fee_cents=20)
    assert event['data']['investment_result_cents']==80
    assert v.state.backing_value_cents==10080
    assert v.state.backing_asset_units==Fraction(10080,101)
    assert v.state.accrued_cents==80


def test_fractional_claim_rounds_once_and_residual_goes_to_reserve():
    v=Vault(['A','B'],opening_spot={'B':2})
    issue(v,'one-cent',amount=1,maturity=1)
    v.checkpoint();v.begin_day(1);v.checkpoint(backing_value_cents=4)
    assert v.state.accrued_cents==Fraction(1,3)
    v.begin_day(2)
    event=v.claim(request_id='claim',actor='A',entitlement_id='entitlement:issue:one-cent')
    assert event['amount_cents']==0 and event['data']['residual_cents']=='1/3'
    assert v.state.reserve_cents==1 and v.state.accrued_cents==0
    with pytest.raises(ProtocolError,match='already claimed'):
        v.claim(request_id='again',actor='A',entitlement_id='entitlement:issue:one-cent')


def test_extend_transfer_does_not_move_entitlement_and_intervals_do_not_overlap():
    v=Vault(['A','B','C'])
    issue(v,'first',maturity=3)
    v.extend(request_id='extension',actor='B',amount_cents=4000,from_date=3,to_date=6)
    v.transfer(request_id='transfer',actor='B',recipient='C',amount_cents=4000,date=6)
    e=v.state.entitlements['entitlement:extension']
    assert (e.start_day,e.end_day,e.account_id)==(4,6,'B')
    v.checkpoint()
    for day in range(1,7):
        v.begin_day(day);v.checkpoint(backing_value_cents=int(v.state.backing_value_cents)+100)
    assert e.accrued(v.state.indices,6)==120
    assert v.state.accounts['C'].units[6]==4000
    assert v.state.accounts['C'].effective_spot(6)==4000


def test_withdraw_matured_units_removes_matching_assets_only():
    v=Vault(['A','B'])
    issue(v,'first',maturity=1)
    v.checkpoint();v.begin_day(1)
    with pytest.raises(ProtocolError):
        v.withdraw(request_id='early',actor='B',amount_cents=1)
    v.checkpoint();v.begin_day(2)
    v.withdraw(request_id='withdraw',actor='B',amount_cents=4000)
    assert v.state.principal_cents==6000 and v.state.backing_value_cents==6000
    event=v.checkpoint()
    assert event['data']['investment_result_cents']==0
    assert event['data']['locked_principal_cent_days']==0


def test_sell_is_funded_principal_only_and_preserves_reserve():
    v=Vault(['A','B','window','outsider'],opening_spot={'window':10000},window_participants=('window',),opening_reserve_cents=100)
    issue(v,'initial',maturity=90)
    rights=dict(v.state.entitlements)
    v.sell(request_id='sell',actor='B',buyer='window',amount_cents=10000,date=90,discount_bps=500)
    assert v.state.accounts['window'].units[90]==10000
    assert v.state.accounts['B'].spot_cents==9500
    assert v.state.reserve_cents==100 and v.state.entitlements==rights
    with pytest.raises(ProtocolError) as error:
        v.sell(request_id='ungated',actor='window',buyer='outsider',amount_cents=1,date=90,discount_bps=1)
    assert error.value.code=='window_gate'
    v.audit()


def test_sell_unfunded_rolls_back_the_principal_leg():
    v=Vault(['A','B','window'],window_participants=('window',))
    issue(v,'initial')
    before=v.state
    with pytest.raises(ProtocolError):
        v.sell(request_id='sell',actor='B',buyer='window',amount_cents=10000,date=3,discount_bps=100)
    assert v.state is before


def test_zero_principal_and_idle_spot_income_go_to_reserve():
    v=Vault(['A'],opening_reserve_cents=100)
    v.checkpoint();v.begin_day(1);v.checkpoint(backing_value_cents=110)
    assert v.state.indices[1]==1 and v.state.reserve_cents==110


def test_cutoff_replay_and_calendar_cannot_skip_days():
    v=Vault(['A'])
    with pytest.raises(ProtocolError): v.begin_day(1)
    v.checkpoint()
    with pytest.raises(ProtocolError): v.checkpoint()
    with pytest.raises(ProtocolError): v.begin_day(2)
    v.begin_day(1)
    assert v.state.day==1 and v.state.cutoff==0
    assert iso_date(0)=='2025-09-09' and iso_date(364)=='2026-09-08'


def test_checkpoint_loss_corruption_is_detected():
    v=Vault(['A','B'],opening_reserve_cents=100)
    issue(v,'initial');v.checkpoint();v.begin_day(1)
    v.checkpoint(backing_value_cents=9900)
    corrupted=replace(v.state,deficit_cents=Fraction(0))
    from sim.invariants import check_all
    with pytest.raises(InvariantViolation): check_all(corrupted,corrupted,None,v.policy)


def test_all_named_scenarios():
    results=run_scenarios()
    assert len(results)==6
    assert all(r.passed for r in results),[(r.name,r.detail) for r in results]
    for result in results:
        for event in result.events:
            validate_event(event)


def test_random_stress_exercises_operations():
    result,_=stress(ops=500,seed=4)
    assert result['passed'] and result['hard_invariant_violations']==0
    assert result['accepted']+result['expected_rejections']==500
    assert result['accepted_by_operation']['extend']>0 and result['accepted_by_operation']['sell']>0


def test_geography_and_invoice_generation_are_deterministic_and_complete():
    nodes,invoices=generate_world()
    assert len(nodes)==2002 and len(invoices)>=10000
    assert (nodes,invoices)==generate_world()
    assert {n['policy'] for n in nodes}=={'naive','treasury','mixed'}
    for n in nodes:
        assert -90<=n['lat']<=90 and -180<=n['lon']<=180
        assert n['city'] and n['country'] and n['region'] and n['sites']
    by_id={n['id']:n for n in nodes}
    assert {s['city'] for s in by_id['Foxconn']['sites']}=={'Zhengzhou','Chennai'}
    assert {s['city'] for s in by_id['Tesla']['sites']}=={'Fremont','Austin'}
    assert {s['city'] for s in by_id['Glencore']['sites']}=={'Baar','Kolwezi','Sudbury'}
    sites={s['site_id'] for n in nodes for s in n['sites']}
    for invoice in invoices:
        assert invoice['item'] and invoice['quantity']>0 and invoice['unit']
        assert invoice['deliver_to'] in sites
        assert invoice['due_day']-invoice['day'] in (30,60,90)


def test_globe_has_daily_summaries_early_apple_shape_and_five_trades():
    result=run_world(days=10,suppliers=30,invoices=30,retain=True)
    events=result.vault.events.events
    assert len([e for e in events if e['type']=='day_summary'])==10
    fourth=next(e for e in events if e['type']=='story' and e['data']['beat']=='four-times')
    assert fourth['day']<30 and fourth['data']['settled_cents']==40_000_000_000 and fourth['data']['committed_cents']==10_000_000_000
    curve=[e for e in events if e['type']=='sell' and e['data']['seller']=='Curve Seller']
    assert {e['data']['date']-e['day'] for e in curve}=={7,30,60,90,180}
    summaries=[e for e in events if e['type']=='day_summary']
    assert sum(e['data']['invoices_settled']['cents'] for e in summaries)==result.metrics['gross_invoice_settled_cents']
    assert sum(e['data']['principal_committed_cents'] for e in summaries)==result.metrics['principal_committed_cents']
    for event in events: validate_event(event)


def test_paired_runs_preserve_bounds_and_report_separate_delta():
    results=paired_runs(days=10,suppliers=30,invoices=30)
    assert results['exact']['invoice_count']==results['bucketed']['invoice_count']
    assert results['delta_bucketed_minus_exact']['gross_invoice_settled_cents']==results['bucketed']['gross_invoice_settled_cents']-results['exact']['gross_invoice_settled_cents']


def test_scripted_annotations_live_in_one_editable_file():
    story=json.loads((Path(__file__).parents[1]/'sim/story_annotations.json').read_text())
    assert any(b['creditor']=='Samsung Display' and b['quantity']==2000000 for b in story)
    assert any(b['creditor']=='Panasonic' and b['quantity']==12000000 for b in story)
    assert [b for b in story if b['story_id']=='apple-duo'][0]['creditor']=='TSMC'


def test_pay_extension_annotation_cannot_reuse_issue_or_old_link():
    from sim import PaymentLeg
    v=Vault(['A','B','C'])
    issue(v,'first',amount=100,maturity=2)
    v.register_invoice(request_id='bill',actor='C',invoice_id='bill',debtor='B',amount_cents=100,due_day=4)
    with pytest.raises(ProtocolError) as error:
        v.pay(request_id='fake-link',actor='B',invoice_id='bill',amount_cents=100,extension_request_ids=('issue:first',))
    assert error.value.code=='invalid_extension_link'
    v.extend(request_id='ext',actor='B',amount_cents=50,from_date=2,to_date=4)
    v.pay(request_id='pay',actor='B',invoice_id='bill',amount_cents=50,legs=[PaymentLeg(50,4)],extension_request_ids=('ext',))
    v.transfer(request_id='return',actor='C',recipient='B',amount_cents=50,date=4)
    with pytest.raises(ProtocolError) as error:
        v.pay(request_id='reuse-link',actor='B',invoice_id='bill',amount_cents=50,legs=[PaymentLeg(50,4)],extension_request_ids=('ext',))
    assert error.value.code=='invalid_extension_link'


def test_total_loss_does_not_delete_units_and_can_recover():
    v=Vault(['A','B'])
    issue(v,'first',amount=100,maturity=3)
    v.checkpoint();v.begin_day(1);v.checkpoint(backing_value_cents=0)
    assert v.state.backing_asset_units==1 and v.state.asset_price_cents==0
    assert v.state.deficit_cents==100 and v.state.principal_cents==100
    v.begin_day(2)
    v.register_invoice(request_id='new',actor='B',invoice_id='new',debtor='A',amount_cents=10,due_day=3)
    with pytest.raises(ProtocolError) as error:
        v.issue(request_id='worthless',actor='A',invoice_id='new',amount_cents=10)
    assert error.value.code=='zero_asset_price'
    v.checkpoint(backing_value_cents=120)
    assert v.state.deficit_cents==0 and v.state.accrued_cents==20


def test_sell_requires_a_dated_unit_not_spot():
    v = Vault(["seller", "window"], opening_spot={"seller": 100, "window": 100}, window_participants=("window",))
    before = v.state
    with pytest.raises(ProtocolError):
        v.sell(request_id="spot-sale", actor="seller", buyer="window", amount_cents=100, date=None, discount_bps=100)
    assert v.state is before
    assert v.events.events[-1]["type"] == "operation_rejected"
