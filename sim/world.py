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

# Full world: immutable generated inputs, then daily company policies.
import json
import random
from pathlib import Path
from dataclasses import dataclass
from .core import ProtocolError, PaymentLeg
from .events import EventStream
from .geography import NAMED_SITES, ITEMS, generated_site, node_record
from .metrics import Metrics


@dataclass
class WorldResult:
    vault: Vault
    metrics: dict
    nodes: list[dict]


def generate_world(*, seed=1, suppliers=2000, days=365, invoices=12000, cash_need_bps=1000):
    _integer(suppliers, "suppliers", len(NAMED_SITES)-2)
    _integer(days, "days", 5)
    _integer(invoices, "invoices", 1)
    _integer(cash_need_bps, "cash_need_bps")
    if cash_need_bps > 10000:
        raise ValueError("cash need fraction cannot exceed one")
    rng = random.Random(seed)
    nodes = []
    for name, sites in NAMED_SITES.items():
        category = "raw" if name == "Glencore" else "refining" if name in {"Dow","BASF","Shell","Exxon","Northstar Cell Materials"} else "assembly" if name in {"Foxconn","Pegatron","Luxshare"} else "packaging" if name == "Duo Packaging" else "retail" if name == "Duo Retail" else "components"
        tier = 0 if name in {"Apple","Tesla"} else 3 if category == "raw" else 2 if category == "refining" else 1
        nodes.append(node_record(name, sites, tier=tier, category=category, policy=rng.choice(("naive","treasury","mixed")), cash_need_bps=cash_need_bps))
    remaining = suppliers - (len(nodes)-2)
    for number in range(remaining):
        tier = (1,2,3)[number % 3]
        categories = {1:("components","assembly","packaging","logistics","retail"),2:("refining","components"),3:("raw",)}[tier]
        category = rng.choice(categories)
        nodes.append(node_record(f"Supplier {number+1:04d}", [generated_site(rng,number+1,category)], tier=tier, category=category, policy=rng.choice(("naive","treasury","mixed")), cash_need_bps=cash_need_bps))
    tiers = {tier:[n for n in nodes if n["tier"] == tier] for tier in range(4)}
    parent = {}
    for node in nodes[2:]:
        parent[node["id"]] = rng.choice(tiers[node["tier"]-1])["id"]
    by_id = {n["id"]:n for n in nodes}
    obligations = []
    supplier_nodes = nodes[2:]
    for number in range(invoices):
        creditor = supplier_nodes[number % len(supplier_nodes)]
        debtor = parent[creditor["id"]]
        day = rng.randrange(4,days)
        term = rng.choice((30,60,90))
        amount = max(10000, min(500_000_000, int(1_000_000 * rng.paretovariate(1.35)) // 10000 * 10000))
        item, unit = rng.choice(ITEMS[creditor["category"]])
        bound = day if rng.randrange(10) == 0 else day + term
        obligations.append({"day":day,"invoice_id":f"world:{number:05d}","debtor":debtor,"creditor":creditor["id"],"amount_cents":amount,"due_day":day+term,"maturity_bound":bound,"item":item,"quantity":max(1,amount//10000),"unit":unit,"deliver_to":by_id[debtor]["sites"][0]["site_id"]})
    return nodes, sorted(obligations,key=lambda i:(i["day"],i["invoice_id"]))


def eligible_legs(vault, actor, bound, amount):
    account = vault.state.accounts[actor]
    remaining, legs = amount, []
    for date,value in sorted(account.units.items()):
        if vault.state.cutoff < date <= bound and remaining:
            take = min(value,remaining)
            legs.append(PaymentLeg(take,date))
            remaining -= take
    take = min(remaining,account.effective_spot(vault.state.cutoff))
    if take:
        legs.append(PaymentLeg(take))
    return legs


def run_world(*, days=365, seed=1, suppliers=2000, invoices=12000, cash_need_bps=1000, date_policy="exact", destination=None, retain=False):
    if date_policy not in {"exact","bucketed"}:
        raise ValueError("unknown date policy")
    nodes, obligations = generate_world(seed=seed,suppliers=suppliers,days=days,invoices=invoices,cash_need_bps=cash_need_bps)
    node_by_id = {n["id"]:n for n in nodes}
    for name in ("Window Fund","Curve Seller"):
        node = node_record(name,NAMED_SITES["Apple"],tier=0,policy="naive",cash_need_bps=0)
        node["role"] = "institution"
        node["sites"] = [{**node["sites"][0],"site_id":name.lower().replace(" ","-")}]
        nodes.append(node)
    metrics = Metrics()
    needs = {n["id"]:0 for n in nodes}
    def observe(event):
        metrics.observe(event)
        if event["type"] in {"issue","pay"}:
            target = event["data"]["creditor"]
            if target in node_by_id:
                needs[target] += event["amount_cents"] * node_by_id[target]["cash_need_bps"] // 10000
    stream = EventStream(destination=destination,retain=retain,observer=observe)
    vault = Vault([n["id"] for n in nodes], opening_spot={"Window Fund":10_000_000_000}, opening_reserve_cents=100_000_000, window_participants=("Window Fund",), event_stream=stream)
    vault.emit_run_event("run_started",{"world":"apple","seed":seed,"requested_days":days,"nodes":nodes,"policy":{**vault.policy.as_dict(),"date_policy":date_policy,"cash_need_bps":cash_need_bps,"illustrative":True,"opening_spot_cents":10_000_000_000,"opening_reserve_cents":100_000_000},"phase":"B"})
    schedule = {}
    for obligation in obligations:
        schedule.setdefault(obligation["day"],[]).append(obligation)
    stories = json.loads(Path(__file__).with_name("story_annotations.json").read_text())
    story_totals = {}
    pending = {n["id"]:set() for n in nodes}
    due = {}
    rng = random.Random(seed ^ 0xCA5CADE)
    serial = 0
    def request(label):
        nonlocal serial
        serial += 1
        return f"{label}:{serial}"
    def bound(date):
        return date if date_policy == "exact" else date // 7 * 7
    def register(data):
        vault.register_invoice(request_id=request("register"),actor=data["creditor"],invoice_id=data["invoice_id"],debtor=data["debtor"],amount_cents=data["amount_cents"],due_day=data["due_day"],maturity_bound=bound(data["maturity_bound"]),item=data["item"],quantity=data["quantity"],unit=data["unit"],deliver_to=data["deliver_to"])
        pending[data["debtor"]].add(data["invoice_id"])
        due.setdefault(data["due_day"],[]).append(data["invoice_id"])
    def pay_invoice(identifier, treasury):
        invoice = vault.state.invoices[identifier]
        if not invoice.outstanding_cents:
            pending[invoice.debtor].discard(identifier)
            return
        if invoice.debtor in {"Apple","Tesla"}:
            vault.issue(request_id=request("issue"),actor=invoice.debtor,invoice_id=identifier,amount_cents=invoice.outstanding_cents)
            pending[invoice.debtor].discard(identifier)
            return
        legs = eligible_legs(vault,invoice.debtor,invoice.maturity_bound,invoice.outstanding_cents)
        amount = sum(l.amount_cents for l in legs)
        if not amount:
            return
        extension_ids, delivered = [], []
        for leg in legs:
            if treasury and invoice.maturity_bound >= vault.state.day + 1 and leg.date != invoice.maturity_bound:
                identifier_ext = request("extend-pay")
                vault.extend(request_id=identifier_ext,actor=invoice.debtor,amount_cents=leg.amount_cents,from_date=leg.date,to_date=invoice.maturity_bound)
                extension_ids.append(identifier_ext)
                delivered.append(PaymentLeg(leg.amount_cents,invoice.maturity_bound))
            else:
                delivered.append(leg)
        vault.pay(request_id=request("pay"),actor=invoice.debtor,invoice_id=identifier,amount_cents=amount,legs=delivered,extension_request_ids=tuple(extension_ids))
        if not vault.state.invoices[identifier].outstanding_cents:
            pending[invoice.debtor].discard(identifier)
    for day in range(days):
        if day:
            vault.begin_day(day)
        for index, beat in enumerate(stories):
            if beat["day"] != day:
                continue
            identifier = f"story:{index}"
            register({**beat,"invoice_id":identifier,"due_day":beat["maturity"],"maturity_bound":beat["maturity"]})
            extensions = []
            if beat["operation"] == "issue":
                vault.issue(request_id=request("story-issue"),actor=beat["debtor"],invoice_id=identifier,amount_cents=beat["amount_cents"])
            else:
                if beat["operation"] == "extend_pay":
                    ext_id = request("story-extend")
                    vault.extend(request_id=ext_id,actor=beat["debtor"],amount_cents=beat["amount_cents"],from_date=bound(beat["from_date"]),to_date=bound(beat["maturity"]))
                    extensions.append(ext_id)
                vault.pay(request_id=request("story-pay"),actor=beat["debtor"],invoice_id=identifier,amount_cents=beat["amount_cents"],extension_request_ids=tuple(extensions))
            pending[beat["debtor"]].discard(identifier)
            totals = story_totals.setdefault(beat["story_id"],[0,0])
            totals[0] += beat["amount_cents"]
            if beat["operation"] == "issue":
                totals[1] += beat["amount_cents"]
            vault.emit_run_event("story",{"story_id":beat["story_id"],"beat":beat["beat"],"caption":beat["caption"],"camera_accounts":[beat["debtor"],beat["creditor"]],"settled_cents":totals[0],"committed_cents":totals[1]})
        if day == 4:
            for term in (7,30,60,90,180):
                identifier = f"curve:{term}"
                register({"invoice_id":identifier,"debtor":"Apple","creditor":"Curve Seller","amount_cents":1_000_000,"due_day":day+term,"maturity_bound":day+term,"item":"illustrative funded window demonstration lot","quantity":1,"unit":"lot","deliver_to":"curve-seller"})
                vault.issue(request_id=request("curve-issue"),actor="Apple",invoice_id=identifier,amount_cents=1_000_000)
                pending["Apple"].discard(identifier)
                vault.sell(request_id=request("curve-sell"),actor="Curve Seller",buyer="Window Fund",amount_cents=1_000_000,date=bound(day+term),discount_bps=max(1,term*650//365))
        for obligation in schedule.get(day,()):
            register(obligation)
        # No competition with the protected early narrative before its fourth hop.
        if day >= 4:
            for node in nodes:
                actor = node["id"]
                if node["role"] == "institution":
                    continue
                treasury = node["policy"] == "treasury" or node["policy"] == "mixed" and rng.randrange(2) == 0
                for identifier in sorted(pending[actor],key=lambda key:(vault.state.invoices[key].due_day,key)):
                    pay_invoice(identifier,treasury)
                account = vault.state.accounts[actor]
                cash = min(needs[actor],account.effective_spot(vault.state.cutoff))
                if cash and not vault.claim_withdraw_suspended:
                    vault.withdraw(request_id=request("withdraw"),actor=actor,amount_cents=cash)
                    needs[actor] -= cash
                if treasury and needs[actor]:
                    for maturity, available in sorted(vault.state.accounts[actor].units.items()):
                        if maturity <= vault.state.cutoff:
                            continue
                        discount = min(5000,max(1,max(0,maturity-day)*650//365))
                        buyer_spot = vault.state.accounts["Window Fund"].effective_spot(vault.state.cutoff)
                        face = min(available,(needs[actor]*10000+9999-discount)//(10000-discount),buyer_spot*10000//(10000-discount))
                        if face > 0 and face*(10000-discount)//10000:
                            sold = vault.sell(request_id=request("sell"),actor=actor,buyer="Window Fund",amount_cents=face,date=maturity,discount_bps=discount)
                            cash = min(needs[actor],sold["data"]["spot_cents"])
                            if cash and not vault.claim_withdraw_suspended:
                                vault.withdraw(request_id=request("withdraw-sale"),actor=actor,amount_cents=cash)
                                needs[actor] -= cash
                        if not needs[actor]:
                            break
                # Claim at the first following execution day; end index is published.
                if not vault.claim_withdraw_suspended:
                    for identifier in vault.state.accounts[actor].entitlement_ids:
                        entitlement = vault.state.entitlements[identifier]
                        if not entitlement.claimed and entitlement.end_day <= vault.state.cutoff:
                            vault.claim(request_id=request("claim"),actor=actor,entitlement_id=identifier)
                spot = vault.state.accounts[actor].effective_spot(vault.state.cutoff)
                if treasury and spot:
                    future_bounds = [vault.state.invoices[key].maturity_bound for key in pending[actor] if vault.state.invoices[key].maturity_bound > day]
                    target = min(future_bounds) if future_bounds else day+1
                    vault.extend(request_id=request("sweep"),actor=actor,amount_cents=spot,to_date=target)
        for identifier in due.get(day,()):
            invoice = vault.state.invoices[identifier]
            short = invoice.outstanding_cents - sum(l.amount_cents for l in eligible_legs(vault,invoice.debtor,invoice.maturity_bound,invoice.outstanding_cents))
            if short:
                vault.emit_run_event("funding_shortfall",{"invoice_id":identifier,"deadline":invoice.due_day,"shortfall_cents":short,"kind":"invoice"})
        # Deterministic 4% annualized illustrative investment result; day 0 is bootstrap.
        income = vault.state.previous_backing_value_cents * 400 // 3_650_000 if day else 0
        vault.checkpoint(backing_value_cents=int(vault.state.backing_value_cents)+income)
        vault.emit_run_event("day_summary",metrics.day_summary(day,vault.state.balance_sheet()))
    for invoice in vault.state.invoices.values():
        if invoice.outstanding_cents and invoice.due_day >= days:
            short = invoice.outstanding_cents - sum(l.amount_cents for l in eligible_legs(vault,invoice.debtor,invoice.maturity_bound,invoice.outstanding_cents))
            if short:
                vault.emit_run_event("funding_shortfall",{"invoice_id":invoice.invoice_id,"deadline":invoice.due_day,"shortfall_cents":short,"kind":"projected"})
    for actor, amount in sorted(needs.items()):
        if amount:
            vault.emit_run_event("funding_shortfall",{"invoice_id":f"cash:{actor}","deadline":days-1,"shortfall_cents":amount,"kind":"cash"})
    report = metrics.report()
    report["story_totals"] = {key:{"settled_cents":v[0],"committed_cents":v[1]} for key,v in sorted(story_totals.items())}
    report["suppliers"] = suppliers
    report["days"] = days
    report["date_policy"] = date_policy
    vault.emit_run_event("run_completed",{"world":"apple","requested_days":days,"daily_checkpoints_executed":days,"metrics":report})
    return WorldResult(vault,report,nodes)


def paired_runs(*, output_dir=None, **kwargs):
    reports = {}
    for policy in ("exact","bucketed"):
        if output_dir is None:
            reports[policy] = run_world(date_policy=policy,**kwargs).metrics
        else:
            with (Path(output_dir)/f"{policy}.ndjson").open("w",encoding="utf-8") as stream:
                reports[policy] = run_world(date_policy=policy,destination=stream,**kwargs).metrics
    fields = ("gross_invoice_settled_cents","principal_committed_cents","funding_deficit_cents","yield_paid_cents","payments_with_extension","principal_cent_days")
    reports["delta_bucketed_minus_exact"] = {key:reports["bucketed"][key]-reports["exact"][key] for key in fields}
    return reports
