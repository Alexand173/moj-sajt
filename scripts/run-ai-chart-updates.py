"""Run the OpenAI Vision chart scraper sequentially for GitHub Actions.

This command is intended for an unlocked Windows self-hosted runner with a
logged-in Soundcharts Chrome profile. It keeps GUI scraping sequential, writes
isolated logs/artifacts per preset, and fails before accepting partial charts.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SUPPORTED_PRESETS = (
    "germany-rock",
    "germany-pop",
    "germany-hip-hop",
    "germany-rb-soul",
    "germany-metal",
    "germany-dance-electronic",
    "france-rock",
    "france-pop",
    "france-hip-hop",
    "france-rb-soul",
    "france-metal",
    "france-dance-electronic",
    "italy-rock",
    "italy-pop",
    "italy-hip-hop",
    "italy-rb-soul",
    "italy-metal",
    "italy-dance-electronic",
    "poland-rock",
    "poland-pop",
    "poland-hip-hop",
    "poland-rb-soul",
    "poland-metal",
    "poland-dance-electronic",
)


def parse_presets(value: str | None) -> list[str]:
    requested = [item.strip().lower() for item in (value or "").split(",") if item.strip()]
    if not requested:
        return list(SUPPORTED_PRESETS)

    unsupported = sorted(set(requested) - set(SUPPORTED_PRESETS))
    if unsupported:
        raise ValueError(
            "Unsupported preset(s): "
            + ", ".join(unsupported)
            + ". Supported presets: "
            + ", ".join(SUPPORTED_PRESETS)
        )
    return requested


def output_root() -> Path:
    configured = os.getenv("AI_SCRAPER_OUTPUT_ROOT", "").strip()
    if configured:
        return Path(configured).expanduser().resolve()

    runner_temp = os.getenv("RUNNER_TEMP", "").strip()
    base = Path(runner_temp) if runner_temp else Path(".tmp")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return (base / "musictop-ai-scraper" / timestamp).resolve()


def validate_artifact(path: Path, *, preset: str, target_rows: int) -> dict[str, Any]:
    if not path.exists():
        raise RuntimeError(f"{preset}: scraper did not create {path}.")

    try:
        artifact = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise RuntimeError(f"{preset}: invalid JSON artifact: {error}") from error

    rows = artifact.get("rows") if isinstance(artifact, dict) else None
    if not isinstance(rows, list):
        raise RuntimeError(f"{preset}: artifact does not contain a rows array.")

    ranks: list[int] = []
    invalid_rank_rows = 0
    for row in rows:
        if not isinstance(row, dict) or row.get("rank") is None:
            invalid_rank_rows += 1
            continue
        try:
            ranks.append(int(row["rank"]))
        except (TypeError, ValueError):
            invalid_rank_rows += 1

    expected_ranks = list(range(1, target_rows + 1))
    duplicate_ranks = sorted({rank for rank in ranks if ranks.count(rank) > 1})
    missing_ranks = sorted(set(expected_ranks) - set(ranks))
    rows_without_youtube = sum(
        1
        for row in rows
        if not isinstance(row, dict) or not str(row.get("youtube_id") or "").strip()
    )

    if (
        len(rows) != target_rows
        or sorted(ranks) != expected_ranks
        or invalid_rank_rows
        or duplicate_ranks
        or missing_ranks
        or rows_without_youtube
        or artifact.get("uploaded_to_supabase") != target_rows
    ):
        raise RuntimeError(
            f"{preset}: artifact validation failed: rows={len(rows)}, "
            f"invalid rank rows={invalid_rank_rows}, missing ranks={missing_ranks}, "
            f"duplicate ranks={duplicate_ranks}, rows without YouTube ID={rows_without_youtube}, "
            f"uploaded={artifact.get('uploaded_to_supabase')}."
        )

    return {
        "preset": preset,
        "artifact": str(path),
        "rows": len(rows),
        "ranks": f"1-{target_rows}",
        "rowsWithoutYoutubeId": rows_without_youtube,
        "uploadedToSupabase": artifact.get("uploaded_to_supabase"),
        "capturedAt": artifact.get("captured_at"),
    }


def write_summary(path: Path, summary: dict[str, Any]) -> None:
    path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")


def tail_lines(path: Path, count: int = 12) -> list[str]:
    if not path.exists():
        return []
    return path.read_text(encoding="utf-8", errors="replace").splitlines()[-count:]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--presets",
        default=os.getenv("AI_SCRAPER_PRESETS", ""),
        help="Comma-separated preset list; defaults to all supported country charts.",
    )
    parser.add_argument(
        "--output-root",
        default=os.getenv("AI_SCRAPER_OUTPUT_ROOT", ""),
        help="Root directory for logs and chart artifacts.",
    )
    parser.add_argument(
        "--wait-seconds",
        type=float,
        default=float(os.getenv("AI_SCRAPER_WAIT_SECONDS", "15")),
        help="Seconds to wait for Soundcharts after opening each preset.",
    )
    parser.add_argument(
        "--max-rows",
        type=int,
        default=int(os.getenv("AI_SCRAPER_MAX_ROWS", "50")),
        help="Required rows per chart; uploads fail when the chart is incomplete.",
    )
    parser.add_argument(
        "--attempts",
        type=int,
        default=int(os.getenv("AI_SCRAPER_ATTEMPTS", "2")),
        help="Fresh attempts per preset when a GUI capture or validation fails.",
    )
    parser.add_argument("--list-presets", action="store_true", help="Print supported presets and exit.")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.list_presets:
        print("\n".join(SUPPORTED_PRESETS))
        return 0
    if args.max_rows < 1:
        raise ValueError("--max-rows must be greater than zero.")
    if args.attempts < 1:
        raise ValueError("--attempts must be greater than zero.")
    if args.wait_seconds < 0:
        raise ValueError("--wait-seconds cannot be negative.")

    presets = parse_presets(args.presets)
    root = Path(args.output_root).expanduser().resolve() if args.output_root else output_root()
    root.mkdir(parents=True, exist_ok=True)
    scraper_path = Path(__file__).with_name("ai_scraper.py").resolve()
    repository_root = scraper_path.parents[1]
    summary_path = root / "run-summary.json"
    summary: dict[str, Any] = {
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "targetRows": args.max_rows,
        "presets": presets,
        "results": [],
        "success": False,
    }

    try:
        for index, preset in enumerate(presets, start=1):
            preset_root = root / preset
            preset_root.mkdir(parents=True, exist_ok=True)
            log_path = preset_root / "run.log"
            artifact_path = preset_root / "chart-data.json"
            command = [
                sys.executable,
                str(scraper_path),
                "--preset",
                preset,
                "--upload",
                "--replace-chart",
                "--output-dir",
                str(preset_root),
                "--wait-seconds",
                str(args.wait_seconds),
                "--max-rows",
                str(args.max_rows),
            ]
            result: dict[str, Any] | None = None
            for attempt in range(1, args.attempts + 1):
                artifact_path.unlink(missing_ok=True)
                print(f"[{index}/{len(presets)}] START {preset} (attempt {attempt}/{args.attempts})", flush=True)
                with log_path.open("w", encoding="utf-8") as log:
                    completed = subprocess.run(
                        command,
                        cwd=repository_root,
                        env=os.environ.copy(),
                        stdout=log,
                        stderr=subprocess.STDOUT,
                        check=False,
                    )

                if completed.returncode == 0:
                    try:
                        artifact_result = validate_artifact(
                            artifact_path,
                            preset=preset,
                            target_rows=args.max_rows,
                        )
                        artifact_result["status"] = "passed"
                        artifact_result["attempt"] = attempt
                        artifact_result["log"] = str(log_path)
                        result = artifact_result
                        break
                    except RuntimeError as error:
                        failure_message = str(error)
                else:
                    failure_message = f"scraper exited with code {completed.returncode}"

                print(
                    f"[{index}/{len(presets)}] RETRY {preset}: {failure_message}",
                    flush=True,
                )

            if result is None:
                result = {
                    "preset": preset,
                    "status": "failed",
                    "attempts": args.attempts,
                    "log": str(log_path),
                    "tail": tail_lines(log_path),
                }
                summary["results"].append(result)
                write_summary(summary_path, summary)
                print(f"[{index}/{len(presets)}] FAILED {preset}; see {log_path}", flush=True)
                return 1

            summary["results"].append(result)
            write_summary(summary_path, summary)
            print(f"[{index}/{len(presets)}] PASS {preset}: {args.max_rows} rows", flush=True)

        summary["success"] = True
        summary["finishedAt"] = datetime.now(timezone.utc).isoformat()
        write_summary(summary_path, summary)
        print(f"All {len(presets)} chart presets passed: {summary_path}", flush=True)
        return 0
    except Exception as error:
        summary["error"] = str(error)
        summary["finishedAt"] = datetime.now(timezone.utc).isoformat()
        write_summary(summary_path, summary)
        print(f"Chart update failed: {error}", file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
