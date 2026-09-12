"""Executable reporting scenarios and reproducible random operation stress."""
from dataclasses import dataclass
from fractions import Fraction
import random
from collections import Counter

from .core import Vault, VaultPolicy, PaymentLeg, ProtocolError
from .events import EventStream
from .invariants import InvariantViolation


@dataclass
class ScenarioResult:
    name: str
    passed: bool
    vault: Vault
    detail: str

    @property
    def events(self):
        return self.vault.events.events


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def reject(code, call):
    try:
        call()
    except ProtocolError as error:
        check(error.code == code, f"expected {code}, received {error.code}")
    else:
        raise AssertionError(f"expected rejection {code}")


def issue(v, identifier, amount=10000, maturity=3, creditor="B", debtor="A"):
    v.register_invoice(request_id=f"register:{identifier}",actor=creditor,invoice_id=identifier,debtor=debtor,amount_cents=amount,due_day=maturity)
    v.issue(request_id=f"issue:{identifier}",actor=debtor,invoice_id=identifier,amount_cents=amount)


def finish(name, v, body):
    try:
        body(v)
        v.audit()
        passed, detail = True, "all expected state transitions and invariant checks passed"
    except Exception as error:
        passed, detail = False, f"{type(error).__name__}: {error}"
    v.emit_run_event("scenario_result",{"name":name,"passed":passed,"detail":detail})
    return ScenarioResult(name,passed,v,detail)


def loss_then_recovery():
    v=Vault(["A","B"],opening_reserve_cents=100,policy=VaultPolicy(reserve_floor_cents=100))
    def body(v):
        issue(v,"initial",maturity=1)
        v.checkpoint(); v.begin_day(1)
        v.checkpoint(backing_value_cents=10200)
        check(v.state.accrued_cents==100,"first inclusive income missing")
        v.begin_day(2); v.claim(request_id="claimed",actor="A",entitlement_id="entitlement:issue:initial")
        v.checkpoint(backing_value_cents=9900)
        check(v.deficit_mode and v.state.deficit_cents==200,"reserve was not exhausted before deficit")
        check(v.state.accounts["A"].spot_cents==100,"claimed yield clawed back")
        v.begin_day(3)
        reject("suspended",lambda:v.withdraw(request_id="blocked",actor="B",amount_cents=1))
        issue(v,"during-deficit",amount=100,maturity=10)
        v.checkpoint(backing_value_cents=int(v.state.backing_value_cents)+250)
        check(not v.deficit_mode and v.state.reserve_cents==50,"repair ordering wrong")
        check(v.state.indices[3]==v.state.indices[2],"index rose before reserve floor restored")
        v.begin_day(4); v.checkpoint(backing_value_cents=int(v.state.backing_value_cents)+100)
        check(v.state.indices[4]>v.state.indices[3] and v.state.reserve_cents>=100,"remaining income did not resume index")
    return finish("loss_then_recovery",v,body)


def coordinated_withdrawal_and_extension():
    v=Vault(["A","B","C"])
    def body(v):
        issue(v,"initial",maturity=2)
        v.transfer(request_id="share",actor="B",recipient="C",amount_cents=5000,date=2)
        v.checkpoint();v.begin_day(1);v.checkpoint();v.begin_day(2)
        v.extend(request_id="before-cutoff",actor="B",amount_cents=5000,from_date=2,to_date=5)
        reject("insufficient_balance",lambda:v.withdraw(request_id="too-early",actor="C",amount_cents=5000))
        v.checkpoint();v.begin_day(3)
        check(v.state.accounts["C"].units[2]==5000,"maturity rewrote stored units")
        v.withdraw(request_id="after-cutoff",actor="C",amount_cents=2500)
        v.extend(request_id="recommit",actor="C",amount_cents=2500,to_date=6)
        check(v.state.principal_cents==7500 and v.state.balance_sheet()["spot_cents"]==0,"atomic maturity failed")
    return finish("coordinated_withdrawal_and_extension",v,body)


def yield_collapse():
    v=Vault(["A","B"])
    def body(v):
        issue(v,"initial",maturity=10)
        v.checkpoint();v.begin_day(1);v.checkpoint(backing_value_cents=10100)
        index=v.state.indices[1]
        for day in range(2,7):
            v.begin_day(day);v.checkpoint()
            check(v.state.indices[day]==index,"zero yield changed index")
        check(v.state.principal_cents==10000 and v.state.accrued_cents==100,"collapse changed existing liabilities")
    return finish("yield_collapse",v,body)


def partial_extension_ten_times():
    v=Vault(["A","B"])
    def body(v):
        issue(v,"initial",maturity=1)
        for number in range(10):
            v.extend(request_id=f"extend:{number}",actor="B",amount_cents=1000,from_date=1,to_date=number+2)
        check(len(v.state.entitlements)==11 and v.state.principal_cents==10000,"partial extension notional wrong")
        v.checkpoint()
        for day in range(1,12):
            v.begin_day(day);v.checkpoint(backing_value_cents=int(v.state.backing_value_cents)+100)
        check(v.state.accounts["B"].effective_spot(v.state.cutoff)==10000,"partial extensions failed to mature")
    return finish("partial_extension_ten_times",v,body)


def two_accounts_recommitting():
    v=Vault(["A","B"],opening_spot={"A":10000})
    def body(v):
        v.extend(request_id="first",actor="A",amount_cents=10000,to_date=1)
        v.transfer(request_id="to-b",actor="A",recipient="B",amount_cents=10000,date=1)
        v.checkpoint();v.begin_day(1);v.checkpoint(backing_value_cents=10100);v.begin_day(2)
        v.extend(request_id="second",actor="B",amount_cents=10000,to_date=3)
        v.transfer(request_id="to-a",actor="B",recipient="A",amount_cents=10000,date=3)
        v.checkpoint(backing_value_cents=10200);v.begin_day(3);v.checkpoint(backing_value_cents=10300)
        first,second=v.state.entitlements["entitlement:first"],v.state.entitlements["entitlement:second"]
        check((first.start_day,first.end_day,second.start_day,second.end_day)==(1,1,3,3),"recommit overlap or same-day earnings")
        check(first.account_id=="A" and second.account_id=="B" and v.state.reserve_cents==100,"idle day or ownership incorrect")
    return finish("two_accounts_recommitting",v,body)


def early_bound_pay_fails():
    v=Vault(["A","B","C","D"])
    def body(v):
        issue(v,"initial",maturity=30)
        v.extend(request_id="extend",actor="B",amount_cents=10000,from_date=30,to_date=90)
        v.transfer(request_id="transfer",actor="B",recipient="C",amount_cents=10000,date=90)
        v.register_invoice(request_id="early",actor="D",invoice_id="early",debtor="C",amount_cents=10000,due_day=90,maturity_bound=30)
        state=v.state
        reject("maturity_bound",lambda:v.pay(request_id="fail",actor="C",invoice_id="early",amount_cents=10000,legs=[PaymentLeg(10000,90)]))
        check(v.state is state,"Pay rejection mutated state")
    return finish("early_bound_pay_fails",v,body)


SCENARIOS=(loss_then_recovery,coordinated_withdrawal_and_extension,yield_collapse,partial_extension_ten_times,two_accounts_recommitting,early_bound_pay_fails)


def run_scenarios():
    return [scenario() for scenario in SCENARIOS]


def stress(*, ops=10000, seed=1, destination=None, retain=False):
    if type(ops) is not int or ops < 1:
        raise ValueError("ops must be positive")
    rng=random.Random(seed)
    names=[f"firm-{i}" for i in range(12)]
    v=Vault(names+["window"],opening_spot={**{a:100000 for a in names},"window":10000000},opening_reserve_cents=100000,event_stream=EventStream(destination=destination,retain=retain),window_participants=("window",))
    counts=Counter()
    for number in range(ops):
        if number and number%40==0:
            result=0 if v.state.day==0 else rng.randint(-10000,15000)
            if number%1000==0:
                result=-min(int(v.state.backing_value_cents)-1,200000)
            v.checkpoint(backing_value_cents=int(v.state.backing_value_cents)+result)
            v.begin_day(v.state.day+1)
        actor=rng.choice(names)
        other=rng.choice([a for a in names if a!=actor])
        request=f"random:{number}"
        kind=rng.choice(("register","issue","transfer","pay","extend","claim","withdraw","sell"))
        account=v.state.accounts[actor]
        dated=[(d,a) for d,a in account.units.items() if d>v.state.cutoff]
        try:
            if kind=="register" or kind in {"issue","pay"} and not v.state.invoices:
                kind="register"
                bound=v.state.day+rng.choice((0,1,7,30,60,90))
                v.register_invoice(request_id=request,actor=other,invoice_id=request,debtor=actor,amount_cents=rng.randint(1,20000),due_day=bound,maturity_bound=bound)
            elif kind in {"issue","pay"}:
                i=rng.choice(list(v.state.invoices.values()))
                amount=rng.randint(1,max(1,i.outstanding_cents))
                getattr(v,kind)(request_id=request,actor=i.debtor,invoice_id=i.invoice_id,amount_cents=amount)
            elif kind in {"transfer","extend","sell"}:
                date,available=rng.choice(dated) if dated and rng.randrange(4)!=0 else (None,account.effective_spot(v.state.cutoff))
                amount=rng.randint(1,max(1,available))
                if kind=="transfer":
                    v.transfer(request_id=request,actor=actor,recipient=other,amount_cents=amount,date=date)
                elif kind=="extend":
                    target=max(v.state.day,date or v.state.day)+rng.randint(1,90)
                    v.extend(request_id=request,actor=actor,amount_cents=amount,from_date=date,to_date=target)
                else:
                    v.sell(request_id=request,actor=actor,buyer="window",amount_cents=amount,date=date if date is not None else v.state.day,discount_bps=rng.randint(1,1000))
            elif kind=="claim":
                identifiers=account.entitlement_ids
                v.claim(request_id=request,actor=actor,entitlement_id=rng.choice(identifiers) if identifiers else "missing")
            else:
                v.withdraw(request_id=request,actor=actor,amount_cents=rng.randint(1,max(1,account.effective_spot(v.state.cutoff))))
            counts["accepted"]+=1
            counts[kind]+=1
        except ProtocolError:
            counts["rejected"]+=1
        # InvariantViolation deliberately propagates: never count it as an expected rejection.
    if not v.state.closed:
        v.checkpoint()
    v.audit()
    result={"ops":ops,"seed":seed,"accepted":counts["accepted"],"expected_rejections":counts["rejected"],"hard_invariant_violations":0,"passed":True,"accepted_by_operation":{k:counts[k] for k in ("register","issue","transfer","pay","extend","claim","withdraw","sell")},"checkpoints":v.state.cutoff+1}
    v.emit_run_event("scenario_result",{"name":"stress","passed":True,"detail":result})
    return result,v
