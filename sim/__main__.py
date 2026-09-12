"""Run the reference world, paired date policies, scenarios or stress stream."""
import argparse
import json
from pathlib import Path
from time import perf_counter
from fractions import Fraction
from .events import write_ndjson
from .world import apple_fixture, run_world, paired_runs
from .scenarios import run_scenarios, stress


def positive_int(value):
    number=int(value)
    if number<1:
        raise argparse.ArgumentTypeError("must be positive")
    return number


def nonnegative_int(value):
    number=int(value)
    if number<0:
        raise argparse.ArgumentTypeError("must be nonnegative")
    return number


def cash_fraction(value):
    try:
        fraction=Fraction(value)
    except (ValueError,ZeroDivisionError):
        raise argparse.ArgumentTypeError("must be a fraction between zero and one")
    if not 0<=fraction<=1 or (fraction*10000).denominator != 1:
        raise argparse.ArgumentTypeError("must be between zero and one in whole basis points")
    return int(fraction*10000)


def write_json(path,data):
    path.write_text(json.dumps(data,sort_keys=True,indent=2)+"\n",encoding="utf-8")


def world_args(parser):
    parser.add_argument("--days",type=positive_int,default=365)
    parser.add_argument("--seed",type=nonnegative_int,default=1)
    parser.add_argument("--suppliers",type=positive_int,default=2000)
    parser.add_argument("--invoices",type=positive_int,default=12000)
    parser.add_argument("--cash-need-fraction",type=cash_fraction,default=1000)


def headline(metrics):
    fields=("invoice_count","settled_invoice_count","gross_invoice_settled_cents","principal_committed_cents","reuse_multiple","funding_deficit_cents","future_funding_deficit_cents","cash_need_shortfall_cents","extension_share","circulation_efficiency_per_day","yield_cost_per_settled_dollar")
    return {key:metrics[key] for key in fields}


def main(argv=None):
    parser=argparse.ArgumentParser(description="Cascade dated-dollar reference simulator")
    commands=parser.add_subparsers(dest="command",required=True)
    run=commands.add_parser("run")
    world_args(run)
    run.add_argument("--world",choices=("apple","tesla","apple-fixture"),default="apple")
    run.add_argument("--date-policy",choices=("exact","bucketed"),default="exact")
    run.add_argument("--out",type=Path,required=True)
    scenarios=commands.add_parser("scenarios")
    scenarios.add_argument("--out-dir",type=Path)
    random_run=commands.add_parser("stress")
    random_run.add_argument("--ops",type=positive_int,default=10000)
    random_run.add_argument("--seed",type=nonnegative_int,default=1)
    random_run.add_argument("--out",type=Path)
    compare=commands.add_parser("compare")
    world_args(compare)
    compare.add_argument("--out-dir",type=Path,required=True)
    args=parser.parse_args(argv)
    start=perf_counter()
    if args.command=="scenarios":
        results=run_scenarios()
        report={r.name:{"passed":r.passed,"detail":r.detail} for r in results}
        if args.out_dir:
            args.out_dir.mkdir(parents=True,exist_ok=True)
            for result in results:
                with (args.out_dir/f"{result.name}.ndjson").open("w",encoding="utf-8") as output:
                    write_ndjson(result.vault.events.lines,output)
            write_json(args.out_dir/"results.json",report)
        print(json.dumps(report,sort_keys=True))
        return 0 if all(r.passed for r in results) else 1
    if args.command=="stress":
        if args.out:
            with args.out.open("w",encoding="utf-8") as output:
                report,_=stress(ops=args.ops,seed=args.seed,destination=output)
            write_json(args.out.with_suffix(".metrics.json"),report)
        else:
            report,_=stress(ops=args.ops,seed=args.seed)
        print(json.dumps({**report,"wall_seconds":round(perf_counter()-start,6)},sort_keys=True))
        return 0
    kwargs=dict(days=args.days,seed=args.seed,suppliers=args.suppliers,invoices=args.invoices,cash_need_bps=args.cash_need_fraction)
    if args.command=="compare":
        args.out_dir.mkdir(parents=True,exist_ok=True)
        reports=paired_runs(output_dir=args.out_dir,**kwargs)
        write_json(args.out_dir/"comparison.json",reports)
        print(json.dumps({"exact":headline(reports["exact"]),"bucketed":headline(reports["bucketed"]),"delta":reports["delta_bucketed_minus_exact"],"wall_seconds":round(perf_counter()-start,6)},sort_keys=True))
        return 0
    if args.world=="apple-fixture":
        vault=apple_fixture(days=args.days,seed=args.seed)
        with args.out.open("w",encoding="utf-8") as output:
            write_ndjson(vault.events.lines,output)
        print(f"Wrote {len(vault.events.lines)} events; settled $400,000,000; locked $100,000,000; bootstrap fixture.")
        return 0
    with args.out.open("w",encoding="utf-8") as output:
        result=run_world(destination=output,date_policy=args.date_policy,**kwargs)
    write_json(args.out.with_suffix(".metrics.json"),result.metrics)
    print(json.dumps({**headline(result.metrics),"events":result.vault.events.count,"wall_seconds":round(perf_counter()-start,6)},sort_keys=True))
    return 0


if __name__=="__main__":
    raise SystemExit(main())
