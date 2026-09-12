"""Phase A command-line entry point."""

import argparse
from pathlib import Path

from .events import write_ndjson
from .world import apple_fixture


def positive_int(value: str) -> int:
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError("must be positive")
    return number


def nonnegative_int(value: str) -> int:
    number = int(value)
    if number < 0:
        raise argparse.ArgumentTypeError("must be nonnegative")
    return number


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Cascade Phase A simulation")
    commands = parser.add_subparsers(dest="command", required=True)
    run = commands.add_parser("run", help="emit the deterministic bootstrap fixture")
    run.add_argument("--world", choices=("apple-fixture",), required=True)
    run.add_argument("--days", type=positive_int, default=5, help="requested viewing horizon; Phase A executes day-zero settlements only")
    run.add_argument("--seed", type=nonnegative_int, default=1)
    run.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    vault = apple_fixture(days=args.days, seed=args.seed)
    with args.out.open("w", encoding="utf-8", newline="\n") as destination:
        write_ndjson(vault.events.lines, destination)
    metrics = vault.events.events[-1]["data"]["metrics"]
    print(f"Wrote {len(vault.events.lines)} events to {args.out}; settled ${metrics['gross_invoice_settled_cents'] // 100:,}; locked ${metrics['principal_locked_cents'] // 100:,}; reuse {metrics['reuse_multiple']}. Phase A: no daily checkpoints.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
