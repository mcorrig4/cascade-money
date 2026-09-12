"""Separate metrics reduced from successful events; no netting of costs/benefits."""
from collections import Counter
from fractions import Fraction
from .events import rational


def ratio(n, d):
    return rational(Fraction(n,d)) if d else None


class Metrics:
    def __init__(self):
        self.gross = self.committed = self.locked_settlement = self.cent_days = 0
        self.yield_paid = self.payments = self.extending_payments = 0
        self.invoice_count = self.settled_count = 0
        self.bounds = Counter()
        self.window = {}
        self.funding = {}
        self.checkpoints = []
        self.days = {}
        self.extension_ids = set()

    def _day(self, day):
        return self.days.setdefault(day, {"new_invoices":{"count":0,"cents":0},"invoices_settled":{"count":0,"cents":0},"principal_committed_cents":0,"extensions":{"count":0,"cents":0},"sells":{"count":0,"cents":0,"spot_cents":0},"withdrawals":{"count":0,"cents":0}})

    def observe(self, event):
        kind, data = event["type"], event["data"]
        day, amount = self._day(event["day"]), event["amount_cents"]
        if kind == "invoice_registered":
            self.invoice_count += 1
            day["new_invoices"]["count"] += 1
            day["new_invoices"]["cents"] += amount
            i = data["invoice"]
            self.bounds[i["maturity_bound"]-i["signed_day"]] += 1
        if kind in {"issue","pay"}:
            self.gross += amount
            day["invoices_settled"]["cents"] += amount
            if data["outstanding_cents"] == 0:
                day["invoices_settled"]["count"] += 1
                self.settled_count += 1
            if kind == "issue":
                self.committed += amount
                day["principal_committed_cents"] += amount
                if data["mint_date"] > event["index"]["day"]:
                    self.locked_settlement += amount
            else:
                self.payments += 1
                self.extending_payments += bool(data["extension_request_ids"])
                self.locked_settlement += sum(l["amount_cents"] for l in data["legs"] if l["date"] is not None)
        if kind == "extend":
            self.extension_ids.add(event["request_id"])
        if kind in {"extend","sell","withdraw"}:
            field = {"extend":"extensions","sell":"sells","withdraw":"withdrawals"}[kind]
            day[field]["count"] += 1
            day[field]["cents"] += amount
        if kind == "claim":
            self.yield_paid += amount
        if kind == "sell":
            day["sells"]["spot_cents"] += data["spot_cents"]
            entry = self.window.setdefault(data["date"], {"face_cents":0,"spot_cents":0,"trades":0})
            entry["face_cents"] += amount
            entry["spot_cents"] += data["spot_cents"]
            entry["trades"] += 1
        if kind == "funding_shortfall":
            self.funding[data["invoice_id"]] = dict(data)
        if kind == "checkpoint":
            self.cent_days += data["locked_principal_cent_days"]
            self.checkpoints.append({"day":event["day"],"iso_date":event["iso_date"],**event["balance_sheet"],"checks":event["checks"]})

    def day_summary(self, day, balance_sheet):
        return {**self._day(day),"gross_settled_to_date_cents":self.gross,"principal_committed_to_date_cents":self.committed,"settled_to_committed":ratio(self.gross,self.committed),"balance_sheet":balance_sheet}

    def report(self):
        funding = sorted(self.funding.values(), key=lambda v:(v["deadline"],v["invoice_id"]))
        return {"principal_deposited_cents":self.committed,"principal_locked_cents":self.checkpoints[-1]["dated_cents"] if self.checkpoints else 0,"observed_principal_cent_days":self.cent_days,"circulation_efficiency_status":"available" if self.cent_days else "unavailable_until_daily_checkpoints","invoice_count":self.invoice_count,"settled_invoice_count":self.settled_count,"gross_invoice_settled_cents":self.gross,"principal_committed_cents":self.committed,"reuse_multiple":ratio(self.gross,self.committed),"circulation_efficiency_per_day":ratio(self.locked_settlement,self.cent_days),"locked_settlement_cents":self.locked_settlement,"principal_cent_days":self.cent_days,"yield_paid_cents":self.yield_paid,"yield_cost_per_settled_dollar":ratio(self.yield_paid,self.gross),"funding_deficit_cents":sum(v["shortfall_cents"] for v in funding if v["kind"] == "invoice"),"future_funding_deficit_cents":sum(v["shortfall_cents"] for v in funding if v["kind"] == "projected"),"cash_need_shortfall_cents":sum(v["shortfall_cents"] for v in funding if v["kind"] == "cash"),"funding_deficits":funding,"payments":self.payments,"payments_with_extension":self.extending_payments,"extension_share":ratio(self.extending_payments,self.payments),"accepted_bound_days":dict(sorted(self.bounds.items())),"discount_window":{str(d):{**v,"clearing_discount":ratio(v["face_cents"]-v["spot_cents"],v["face_cents"])} for d,v in sorted(self.window.items())},"balance_sheets":self.checkpoints}
