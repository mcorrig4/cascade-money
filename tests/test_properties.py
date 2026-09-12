"""Hypothesis must be installed: these tests never silently skip."""
from fractions import Fraction
from hypothesis import given, settings, strategies as st
from hypothesis.stateful import RuleBasedStateMachine, rule, invariant
from sim import Vault, ProtocolError
from sim.scenarios import issue


@given(deposit=st.integers(1,10000),withdrawal=st.integers(0,1000),income=st.integers(0,100),fee=st.integers(0,10))
@settings(max_examples=50,deadline=None,derandomize=True)
def test_capital_flows_are_never_income(deposit,withdrawal,income,fee):
    v=Vault(['A','B','C'],opening_spot={'B':1000})
    issue(v,'first',amount=1000,maturity=10)
    v.checkpoint();v.begin_day(1)
    issue(v,'deposit',amount=deposit,maturity=10,creditor='C')
    if withdrawal:
        v.withdraw(request_id='withdraw',actor='B',amount_cents=withdrawal)
    event=v.checkpoint(backing_value_cents=int(v.state.backing_value_cents)+income+fee,fee_cents=fee)
    assert event['data']['investment_result_cents']==income
    assert v.state.indices[1]-1==Fraction(income,2000)


class VaultMachine(RuleBasedStateMachine):
    def __init__(self):
        super().__init__()
        self.v=Vault(['A','B','C','window'],opening_spot={'A':10000,'B':10000,'C':10000,'window':100000},opening_reserve_cents=1000,window_participants=('window',))
        self.serial=0
    def identifier(self):
        self.serial+=1
        return f'property:{self.serial}'
    def attempt(self,call):
        state=self.v.state
        try: call()
        except ProtocolError: assert self.v.state is state
    @rule(actor=st.sampled_from(['A','B','C']),amount=st.integers(1,1000),term=st.integers(0,10))
    def issue(self,actor,amount,term):
        identifier=self.identifier()
        issue(self.v,identifier,amount=amount,maturity=self.v.state.day+term,creditor=actor,debtor='A')
    @rule(actor=st.sampled_from(['A','B','C']),recipient=st.sampled_from(['A','B','C']),amount=st.integers(1,1000),offset=st.integers(0,10),spot=st.booleans())
    def transfer(self,actor,recipient,amount,offset,spot):
        self.attempt(lambda:self.v.transfer(request_id=self.identifier(),actor=actor,recipient=recipient,amount_cents=amount,date=None if spot else self.v.state.day+offset))
    @rule(actor=st.sampled_from(['A','B','C']),amount=st.integers(1,1000),term=st.integers(1,10),spot=st.booleans())
    def extend(self,actor,amount,term,spot):
        dates=[d for d in self.v.state.accounts[actor].units if d>self.v.state.cutoff]
        source=None if spot or not dates else min(dates)
        target=max(self.v.state.day,source or 0)+term
        self.attempt(lambda:self.v.extend(request_id=self.identifier(),actor=actor,amount_cents=amount,from_date=source,to_date=target))
    @rule(actor=st.sampled_from(['A','B','C']),amount=st.integers(1,1000),action=st.sampled_from(['claim','withdraw','sell']))
    def cash(self,actor,amount,action):
        if action=='claim':
            ids=self.v.state.accounts[actor].entitlement_ids
            self.attempt(lambda:self.v.claim(request_id=self.identifier(),actor=actor,entitlement_id=ids[0] if ids else 'missing'))
        elif action=='withdraw':
            self.attempt(lambda:self.v.withdraw(request_id=self.identifier(),actor=actor,amount_cents=amount))
        else:
            dates=list(self.v.state.accounts[actor].units)
            self.attempt(lambda:self.v.sell(request_id=self.identifier(),actor=actor,buyer='window',amount_cents=amount,date=dates[0] if dates else self.v.state.day+1,discount_bps=100))
    @rule(actor=st.sampled_from(['A','B','C']),amount=st.integers(1,1000),term=st.integers(0,10))
    def pay(self,actor,amount,term):
        identifier=self.identifier()
        self.v.register_invoice(request_id='register:'+identifier,actor='C',invoice_id=identifier,debtor=actor,amount_cents=amount,due_day=self.v.state.day+term)
        self.attempt(lambda:self.v.pay(request_id=identifier,actor=actor,invoice_id=identifier,amount_cents=amount))
    @rule(result=st.integers(-500,1000))
    def checkpoint(self,result):
        if self.v.state.day==0: result=0
        self.v.checkpoint(backing_value_cents=int(self.v.state.backing_value_cents)+result)
        self.v.begin_day(self.v.state.day+1)
    @invariant()
    def all_invariants(self):
        assert all(self.v.audit()['hard'].values())
        indices=list(self.v.state.indices.values())
        assert indices==sorted(indices)


TestVaultMachine=VaultMachine.TestCase
TestVaultMachine.settings=settings(max_examples=30,stateful_step_count=40,deadline=None,derandomize=True)
