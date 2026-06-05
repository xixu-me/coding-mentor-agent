from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
import sqlite3
import subprocess
import sys
import threading
import time
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from playwright.sync_api import expect, sync_playwright
from run_student_loop import find_free_port, npm_executable, stop_process, wait_for_http_ready


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
RUNS_ROOT = REPO_ROOT / ".app" / "student-loop" / "agentic-practice-runs"
SENSITIVE_TERMS = ["hidden_tests", "evaluator_private", "private_solution", "submitted_code_snapshot"]
WRONG_CODE = "for i in range(1, 6)\n    if i % 2 == 0:\n        print(i)\n"
RIGHT_CODE = "for i in range(1, 6):\n    if i % 2 == 0:\n        print(i)\n"


class MockSandboxHandler(BaseHTTPRequestHandler):
    def send_json(self, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:  # noqa: N802 - http.server hook
        raw = self.rfile.read(int(self.headers.get("content-length", "0") or 0)).decode("utf-8") or "{}"
        try:
            code = str(json.loads(raw).get("code", ""))
        except Exception:
            code = ""
        if self.path == "/internal/sandbox/run-python":
            try:
                ast.parse(code)
            except SyntaxError as error:
                self.send_json({
                    "status": "syntax_error",
                    "stdout": "",
                    "stderr": f"SyntaxError: {error.msg}",
                    "exit_code": 1,
                    "duration_ms": 18,
                    "metadata": {"mock": True, "newline_count": code.count("\n")},
                })
                return
            if "range(1, 6):" in code and "i % 2 == 0" in code and "print(i)" in code and code.count("\n") >= 2:
                self.send_json({
                    "status": "passed",
                    "stdout": "2\n4\n",
                    "stderr": "",
                    "exit_code": 0,
                    "duration_ms": 22,
                    "metadata": {"mock": True, "newline_count": code.count("\n")},
                })
                return
            self.send_json({
                "status": "failed",
                "stdout": "",
                "stderr": "Output did not match expected behavior.",
                "exit_code": 1,
                "duration_ms": 20,
                "metadata": {"mock": True, "newline_count": code.count("\n")},
            })
            return
        self.send_json({"status": "passed", "stdout": "", "stderr": "", "exit_code": 0, "duration_ms": 10, "metadata": {"mock": True}})

    def log_message(self, *_args: Any) -> None:
        return


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    run_id = args.run_id or datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    run_root = RUNS_ROOT / run_id
    data_dir = run_root / "data"
    artifact_dir = run_root / "artifacts"
    db_path = data_dir / "mentor.db"
    artifact_dir.mkdir(parents=True, exist_ok=True)
    data_dir.mkdir(parents=True, exist_ok=True)
    gate_identity = build_gate_identity(args)

    if args.gate == "release":
        release_preflight = release_gate_preflight(os.environ)
        if release_preflight["status"] != "configured":
            write_report(artifact_dir, {
                "schema_version": "agentic_practice_verification.v1",
                "gate_identity": gate_identity,
                "release_gate": release_preflight,
                "closure_claim": "release closure not claimed",
                "checks": {"release_gate_configuration": False},
            })
            print(f"agentic practice verification report: {artifact_dir / 'verification-report.json'}")
            return 2

    sandbox_server: ThreadingHTTPServer | None = None
    sandbox_thread: threading.Thread | None = None
    env = os.environ.copy()
    port = int(env.get("PORT") or find_free_port())
    base_url = f"http://127.0.0.1:{port}"
    env.update({
        "PORT": str(port),
        "APP_DATA_DIR": str(data_dir),
        "PROGRESS_DB_PATH": str(db_path),
        "STUDENT_LOOP_ARTIFACT_DIR": str(artifact_dir),
        "STUDENT_LOOP_EVIDENCE_MODE": gate_identity["evidence_mode"],
        "STUDENT_LOOP_RUN_ID": run_id,
        "STUDENT_LOOP_MODEL_RATE_LIMIT_MAX": env.get("STUDENT_LOOP_MODEL_RATE_LIMIT_MAX", "50"),
    })
    if args.gate == "deterministic":
        sandbox_port = find_free_port()
        sandbox_server = ThreadingHTTPServer(("127.0.0.1", sandbox_port), MockSandboxHandler)
        sandbox_thread = threading.Thread(target=sandbox_server.serve_forever, daemon=True)
        sandbox_thread.start()
        env.update({
            "SANDBOX_SERVICE_URL": f"http://127.0.0.1:{sandbox_port}",
            "AI_PROVIDER": "",
            "AI_MODEL": "",
            "AI_API_KEY": "",
            "AI_BASE_URL": "",
            "LLM_API_KEY": "",
            "ENABLE_PI_AGENT": "false",
        })

    startup_log_path = artifact_dir / "server-startup.log"
    server = None
    run_state: dict[str, Any] = {
        "network_paths": [],
        "message_posts": [],
        "screenshots": [],
        "console_logs": [],
        "session_id": None,
    }
    try:
        with startup_log_path.open("wb") as startup_log:
            server = subprocess.Popen(
                [npm_executable(), "start"],
                cwd=REPO_ROOT,
                env=env,
                stdout=startup_log,
                stderr=subprocess.STDOUT,
            )
            wait_for_http_ready(base_url, server, timeout_seconds=90, startup_log_path=startup_log_path)
            report = run_browser_flow(base_url, db_path, artifact_dir, gate_identity, run_state)
            write_report(artifact_dir, report)
            print(f"agentic practice verification report: {artifact_dir / 'verification-report.json'}")
            return 0
    except Exception as error:
        write_report(artifact_dir, build_failure_report(
            gate_identity=gate_identity,
            startup_log_path=startup_log_path,
            db_path=db_path,
            run_state=run_state,
            error=error,
        ))
        print(f"agentic practice verification report: {artifact_dir / 'verification-report.json'}")
        raise
    finally:
        if server is not None:
            stop_process(server)
        if sandbox_server is not None:
            sandbox_server.shutdown()
        if sandbox_thread is not None:
            sandbox_thread.join(timeout=2)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run targeted browser verification for the agentic practice review flow.")
    parser.add_argument("--gate", choices=["deterministic", "release"], default="deterministic")
    parser.add_argument("--run-id")
    return parser.parse_args(argv)


def build_gate_identity(args: argparse.Namespace) -> dict[str, Any]:
    if args.gate == "release":
        return {
            "gate": "agentic_practice_release_gate",
            "gate_kind": "release_gate",
            "evidence_mode": "real_sandbox_live_provider",
            "deterministic_mock_sandbox": False,
            "release_gate": True,
            "closure_scope": "release integrations when configured",
            "must_not_claim_strict_or_realistic_closure": True,
        }
    return {
        "gate": "agentic_practice_targeted",
        "gate_kind": "targeted_local_browser",
        "evidence_mode": "deterministic_mock_sandbox",
        "deterministic_mock_sandbox": True,
        "release_gate": False,
        "closure_scope": "targeted deterministic local evidence only",
        "must_not_claim_release_or_live_closure": True,
    }


def release_gate_preflight(env: dict[str, str]) -> dict[str, Any]:
    missing = []
    if not env.get("SANDBOX_SERVICE_URL"):
        missing.append("SANDBOX_SERVICE_URL")
    if not (env.get("AI_PROVIDER") or env.get("LLM_PROVIDER")):
        missing.append("AI_PROVIDER")
    if not (env.get("AI_API_KEY") or env.get("LLM_API_KEY")):
        missing.append("AI_API_KEY")
    return {
        "status": "configured" if not missing else "configuration_failure",
        "missing": missing,
        "failure_class": None if not missing else "release_integration_configuration",
    }


def run_browser_flow(base_url: str, db_path: Path, artifact_dir: Path, gate_identity: dict[str, Any], run_state: dict[str, Any] | None = None) -> dict[str, Any]:
    session = http_json(base_url, "POST", "/api/sessions", {"resume": False})
    session_id = str(session["session_id"])
    if run_state is not None:
        run_state["session_id"] = session_id
    fixture = seed_completed_diagnostic_fixture(db_path, session_id)
    stale_probe = classify_completed_diagnostic_fixture(db_path, session_id)
    network_paths: list[str] = run_state.setdefault("network_paths", []) if run_state is not None else []
    message_posts: list[dict[str, Any]] = run_state.setdefault("message_posts", []) if run_state is not None else []
    screenshots: list[str] = run_state.setdefault("screenshots", []) if run_state is not None else []
    console_logs: list[dict[str, Any]] = run_state.setdefault("console_logs", []) if run_state is not None else []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1200, "height": 920})

        def on_request(request: Any) -> None:
            path = request.url.replace(base_url, "") if request.url.startswith(base_url) else request.url
            network_paths.append(path)
            if request.method == "POST" and path.endswith("/messages"):
                try:
                    message_posts.append(json.loads(request.post_data or "{}"))
                except Exception:
                    message_posts.append({"unparsed": request.post_data})

        page.on("request", on_request)
        page.on("console", lambda message: console_logs.append({
            "type": message.type,
            "text": message.text[:1000],
            "location": message.location,
        }))
        page.goto(base_url, wait_until="domcontentloaded")
        expect(page.get_by_role("button", name="开始导师指导")).to_be_visible(timeout=20_000)
        screenshot(page, artifact_dir, screenshots, "01-initial-completed-diagnostic.png")
        page.get_by_role("button", name="开始导师指导").click()
        page.wait_for_function(
            "() => document.querySelectorAll('.message.user').length >= 1 || document.body.innerText.includes('[初始测评反馈]')",
            timeout=20_000,
        )
        screenshot(page, artifact_dir, screenshots, "02-after-start-guidance.png")

        prompt = page.get_by_label("向导师提问或说明你的思路")
        prompt.fill("继续")
        page.get_by_role("button", name="发送").click()
        expect(page.get_by_text("一句话", exact=False)).to_be_visible(timeout=20_000)
        prompt.fill("我的理解是循环会重复执行一段代码，比如 for 可以依次处理一组数字。")
        page.get_by_role("button", name="发送").click()
        expect(page.locator(".exercise-card")).to_be_visible(timeout=20_000)
        screenshot(page, artifact_dir, screenshots, "03-practice-contract-card.png")

        snapshot_practice = http_json(base_url, "GET", f"/api/sessions/{session_id}/snapshot")
        active_contract = require_dict(snapshot_practice.get("active_practice_contract"), "active_practice_contract")
        active_exercise = require_dict(snapshot_practice.get("active_exercise"), "active_exercise")
        assert_surface(active_exercise.get("id") == active_contract.get("id"), "active exercise is not backed by persisted practice_contract")

        progress_before_wrong = http_json(base_url, "GET", "/api/progress/me")
        set_editor(page, WRONG_CODE)
        page.get_by_role("button", name="提交练习").click()
        expect(page.locator("text=run_student_code").first).to_be_visible(timeout=25_000)
        expect(page.locator("text=SyntaxError").first).to_be_visible(timeout=25_000)
        screenshot(page, artifact_dir, screenshots, "04-wrong-submission-review.png")
        progress_after_wrong = http_json(base_url, "GET", "/api/progress/me")
        assert_surface(
            progress_after_wrong.get("course_progress_percent") == progress_before_wrong.get("course_progress_percent"),
            "wrong submission advanced course_progress_percent",
        )
        fenced_code_visible_after_wrong = page.locator(".message.user pre code").count() >= 1
        assert_surface(fenced_code_visible_after_wrong, "learner fenced code block is missing")

        set_editor(page, RIGHT_CODE)
        page.get_by_role("button", name="提交练习").click()
        expect(page.locator("text=status=passed").first).to_be_visible(timeout=25_000)
        expect(page.locator("text=概念证据：已记录").first).to_be_visible(timeout=25_000)
        expect(page.locator("text=课程总进度").first).to_be_visible(timeout=25_000)
        screenshot(page, artifact_dir, screenshots, "05-passed-submission-review.png")
        passed_page_text = page.locator("body").inner_text(timeout=5_000)
        snapshot_passed = http_json(base_url, "GET", f"/api/sessions/{session_id}/snapshot")
        exported = http_json(base_url, "GET", "/api/data/export")
        progress_after_passed = http_json(base_url, "GET", "/api/progress/me")
        browser.close()

    db = collect_db_evidence(db_path)
    checks = build_checks(
        session_id=session_id,
        network_paths=network_paths,
        message_posts=message_posts,
        db=db,
        snapshot=snapshot_passed,
        exported=exported,
        progress_before_passed=progress_after_wrong,
        progress_after_passed=progress_after_passed,
        active_contract=active_contract,
        fenced_code_visible_after_wrong=fenced_code_visible_after_wrong,
        passed_page_text=passed_page_text,
    )
    return {
        "schema_version": "agentic_practice_verification.v1",
        "session_id": session_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "gate_identity": gate_identity,
        "diagnostic_fixture": fixture,
        "diagnostic_fixture_freshness": stale_probe,
        "screenshots": screenshots,
        "console_logs": console_logs,
        "network_paths": network_paths,
        "message_posts": summarize_message_posts(message_posts),
        "code_integrity": summarize_code_integrity(message_posts),
        "db": db,
        "initial_practice_contract": active_contract,
        "initial_active_exercise": active_exercise,
        "snapshot_summary": {
            "active_practice_contract": snapshot_passed.get("active_practice_contract"),
            "latest_agent_practice_review": snapshot_passed.get("latest_agent_practice_review"),
            "recent_progress_evidence": snapshot_passed.get("recent_progress_evidence"),
        },
        "export_counts": {key: len(value) for key, value in exported.items() if isinstance(value, list)},
        "progress_after_passed": progress_after_passed,
        "passed_ui_summary": summarize_text(passed_page_text, 1200),
        "surface_aware_leak_checks": checks["surface_aware_leak_checks"],
        "checks": checks,
        "closure_claim": closure_claim_for_gate(gate_identity),
    }


def seed_completed_diagnostic_fixture(db_path: Path, session_id: str) -> dict[str, Any]:
    with sqlite3.connect(db_path) as db:
        db.row_factory = sqlite3.Row
        catalog = db.execute(
            "SELECT id, kb_version FROM course_catalog_runs WHERE status = 'success' ORDER BY created_at DESC LIMIT 1",
        ).fetchone()
        if catalog is None:
            raise AssertionError("stale_completed_diagnostic_fixture: latest successful catalog run is missing")
        concept = db.execute(
            "SELECT id, name FROM concepts WHERE id = 'loop' UNION SELECT id, name FROM concepts WHERE name LIKE '%循环%' LIMIT 1",
        ).fetchone() or db.execute("SELECT id, name FROM concepts ORDER BY order_index ASC LIMIT 1").fetchone()
        if concept is None:
            raise AssertionError("stale_completed_diagnostic_fixture: active concept catalog is missing")
        now = datetime.now(timezone.utc).isoformat()
        diagnostic_id = "diag_agentic_practice_fixture"
        db.execute(
            "INSERT OR REPLACE INTO diagnostic_sessions(id, session_id, status, target_concepts_json, stop_reason, started_at, ended_at, catalog_version, catalog_run_id) VALUES (?, ?, 'completed', ?, 'agentic_practice_fixture', ?, ?, ?, ?)",
            (diagnostic_id, session_id, json.dumps([concept["id"]]), now, now, catalog["kb_version"], catalog["id"]),
        )
        db.execute(
            "INSERT OR REPLACE INTO diagnostic_concept_state(diagnostic_session_id, concept_id, mastery, confidence, evidence_count, uncertainty, band, last_item_id, conflicting_evidence_count, updated_at) VALUES (?, ?, 35, 0.85, 2, 0.25, 'learning', NULL, 0, ?)",
            (diagnostic_id, concept["id"], now),
        )
        db.execute(
            "UPDATE local_profile SET profile_json = ?, updated_at = ? WHERE id = 'local'",
            (json.dumps({
                "profile_summary": "Python learner with catalog-fresh completed diagnostic fixture.",
                "current_level": f"Start from {concept['name']}",
                "current_goal": f"Practice {concept['name']}",
                "diagnostic_completion_confidence": 0.85,
                "diagnostic_placement_concept_id": concept["id"],
                "diagnostic_placement_label": concept["name"],
                "weak_concept_ids": [concept["id"]],
                "unresolved_concept_ids": [],
            }, ensure_ascii=False), now),
        )
        db.commit()
        return {
            "diagnostic_session_id": diagnostic_id,
            "session_id": session_id,
            "concept_id": concept["id"],
            "concept_name": concept["name"],
            "catalog_run_id": catalog["id"],
            "catalog_version": catalog["kb_version"],
            "freshness": "fresh",
        }


def classify_completed_diagnostic_fixture(db_path: Path, session_id: str) -> dict[str, Any]:
    with sqlite3.connect(db_path) as db:
        db.row_factory = sqlite3.Row
        catalog = db.execute("SELECT id, kb_version FROM course_catalog_runs WHERE status = 'success' ORDER BY created_at DESC LIMIT 1").fetchone()
        diagnostic = db.execute("SELECT id, catalog_run_id, catalog_version FROM diagnostic_sessions WHERE session_id = ? ORDER BY started_at DESC LIMIT 1", (session_id,)).fetchone()
    fresh = bool(catalog and diagnostic and diagnostic["catalog_run_id"] == catalog["id"] and diagnostic["catalog_version"] == catalog["kb_version"])
    return {
        "freshness": "fresh" if fresh else "stale",
        "issue_class": None if fresh else "stale_completed_diagnostic_fixture",
        "diagnostic_session_id": diagnostic["id"] if diagnostic else None,
        "catalog_run_id": diagnostic["catalog_run_id"] if diagnostic else None,
        "catalog_version": diagnostic["catalog_version"] if diagnostic else None,
        "expected_catalog_run_id": catalog["id"] if catalog else None,
        "expected_catalog_version": catalog["kb_version"] if catalog else None,
    }


def collect_db_evidence(db_path: Path) -> dict[str, Any]:
    queries = {
        "practice_contracts": "SELECT id, session_id, title, status, progress_eligible, concept_ids_json FROM practice_contracts ORDER BY created_at",
        "agent_practice_reviews": "SELECT id, practice_contract_id, review_status, confidence, progress_effect, submitted_code_hash, evidence_refs_json FROM agent_practice_reviews ORDER BY created_at",
        "tool_evidence": "SELECT tool_name, result_code, summary_json FROM tool_evidence ORDER BY created_at",
        "learning_evidence": "SELECT id, source_type, source_id, concept_id, outcome, evaluator_confidence, score, summary_json FROM learning_evidence ORDER BY created_at",
        "intent_routes": "SELECT intent, allowed_tool_group, evidence_signals_json FROM intent_routes ORDER BY created_at",
    }
    with sqlite3.connect(db_path) as db:
        db.row_factory = sqlite3.Row
        return {name: [dict(row) for row in db.execute(query).fetchall()] for name, query in queries.items()}


def safe_collect_db_evidence(db_path: Path) -> dict[str, Any]:
    if not db_path.exists():
        return {}
    try:
        return collect_db_evidence(db_path)
    except Exception as error:
        return {"collection_error": sanitize_error(error)}


def build_checks(
    *,
    session_id: str,
    network_paths: list[str],
    message_posts: list[dict[str, Any]],
    db: dict[str, Any],
    snapshot: dict[str, Any],
    exported: dict[str, Any],
    progress_before_passed: dict[str, Any],
    progress_after_passed: dict[str, Any],
    active_contract: dict[str, Any],
    fenced_code_visible_after_wrong: bool,
    passed_page_text: str,
) -> dict[str, Any]:
    tool_names = [row["tool_name"] for row in db["tool_evidence"]]
    old_submission_paths = [path for path in network_paths if "/api/exercises/" in path and "/submissions" in path]
    surface_aware_leak_checks = check_artifact_surfaces(snapshot=snapshot, exported=exported, db=db)
    active_contract_id = str(active_contract.get("id") or "")
    latest_review = snapshot.get("latest_agent_practice_review") if isinstance(snapshot.get("latest_agent_practice_review"), dict) else {}
    snapshot_progress_evidence = snapshot.get("recent_progress_evidence") if isinstance(snapshot.get("recent_progress_evidence"), dict) else {}
    progress_evidence = progress_after_passed.get("recent_progress_evidence") if isinstance(progress_after_passed.get("recent_progress_evidence"), dict) else {}
    export_progress_evidence = exported.get("recent_progress_evidence") if isinstance(exported.get("recent_progress_evidence"), list) else []
    passed_review_id = str(latest_review.get("id") or "")
    recorded_concept_ids = progress_evidence.get("concept_ids") if isinstance(progress_evidence.get("concept_ids"), list) else []
    aggregate_percent_unchanged_on_pass = progress_after_passed.get("course_progress_percent") == progress_before_passed.get("course_progress_percent")
    checks = {
        "practice_backed_by_persisted_contract": any(row.get("id") == active_contract_id for row in db["practice_contracts"]),
        "student_submission_rendered_as_fenced_code": fenced_code_visible_after_wrong,
        "practice_submission_payloads": [
            {
                "kind": post.get("practice_submission", {}).get("kind") if isinstance(post.get("practice_submission"), dict) else None,
                "practice_contract_id_present": bool((post.get("practice_submission") or {}).get("practice_contract_id")) if isinstance(post.get("practice_submission"), dict) else False,
                "submitted_code_present": bool((post.get("practice_submission") or {}).get("code")) if isinstance(post.get("practice_submission"), dict) else False,
                "code_integrity": code_integrity(post.get("practice_submission", {}).get("code")) if isinstance(post.get("practice_submission"), dict) else None,
            }
            for post in message_posts
            if isinstance(post.get("practice_submission"), dict)
        ],
        "practice_submission_turns_routed_to_agent_review_tools": [
            route for route in db["intent_routes"]
            if route.get("intent") == "exercise_submission" and route.get("allowed_tool_group") == "agent_practice_review_tools"
        ],
        "old_pregrading_endpoint_not_called": not old_submission_paths,
        "old_pregrading_paths": old_submission_paths,
        "wrong_review_has_tool_evidence_and_no_progress": any(
            row.get("review_status") == "needs_revision" and row.get("progress_effect") == "not_recorded"
            for row in db["agent_practice_reviews"]
        ),
        "passed_review_persisted_and_progress_recorded": any(
            row.get("review_status") == "passed" and row.get("confidence") == "high" and row.get("progress_effect") == "recorded"
            for row in db["agent_practice_reviews"]
        ),
        "required_tools_called": {name: tool_names.count(name) for name in ["run_student_code", "record_agent_review", "request_learning_progress_update"]},
        "has_tutor_review_learning_evidence": any(row.get("source_type") == "tutor_review" for row in db["learning_evidence"]),
        "course_progress_percent_after_passed": progress_after_passed.get("course_progress_percent"),
        "course_progress_percent_before_passed": progress_before_passed.get("course_progress_percent"),
        "aggregate_percent_unchanged_on_pass": aggregate_percent_unchanged_on_pass,
        "recent_progress_evidence_consistent": (
            bool(passed_review_id)
            and progress_evidence.get("source_type") == "tutor_review"
            and progress_evidence.get("source_id") == passed_review_id
            and progress_evidence.get("review_id") == passed_review_id
            and progress_evidence.get("progress_effect") == "recorded"
            and snapshot_progress_evidence.get("source_id") == passed_review_id
            and any(isinstance(item, dict) and item.get("source_id") == passed_review_id for item in export_progress_evidence)
            and any(row.get("source_type") == "tutor_review" and row.get("source_id") == passed_review_id for row in db["learning_evidence"])
            and len(recorded_concept_ids) > 0
        ),
        "recorded_concept_ids": recorded_concept_ids,
        "ui_distinguishes_concept_evidence_from_aggregate": (
            ("概念证据" in passed_page_text)
            and ("课程总进度" in passed_page_text)
            and ("学习进度：已记录" not in passed_page_text)
            and ("进度 已记录" not in passed_page_text)
        ),
        "surface_aware_leak_checks": surface_aware_leak_checks,
    }
    assert_surface(len(checks["practice_submission_payloads"]) >= 2, "practice_submission payload evidence is missing")
    assert_surface(all((item.get("code_integrity") or {}).get("newline_count", 0) >= 2 for item in checks["practice_submission_payloads"]), "practice_submission code integrity evidence is missing newlines")
    assert_surface(checks["practice_backed_by_persisted_contract"], "active exercise did not match a persisted practice_contract")
    assert_surface(checks["student_submission_rendered_as_fenced_code"], "student message did not render submitted code as fenced code")
    assert_surface(len(checks["practice_submission_turns_routed_to_agent_review_tools"]) >= 2, "intent_routes did not route submissions to agent_practice_review_tools")
    assert_surface(checks["old_pregrading_endpoint_not_called"], f"legacy pre-grading endpoint was called: {old_submission_paths}")
    assert_surface(checks["wrong_review_has_tool_evidence_and_no_progress"], "wrong submission review/progress evidence is missing")
    assert_surface(checks["passed_review_persisted_and_progress_recorded"], "passed review recorded progress evidence is missing")
    assert_surface(checks["has_tutor_review_learning_evidence"], "tutor_review learning evidence is missing")
    assert_surface(checks["recent_progress_evidence_consistent"], "recent progress evidence is not consistent across snapshot/progress/export/db")
    if aggregate_percent_unchanged_on_pass:
        assert_surface(checks["ui_distinguishes_concept_evidence_from_aggregate"], "UI did not distinguish concept evidence from aggregate course progress")
    blocking_leak_checks = {key: value for key, value in surface_aware_leak_checks.items() if key != "visible_conversation_contains_student_code"}
    assert_surface(all(blocking_leak_checks.values()), f"surface-aware leak checks failed: {surface_aware_leak_checks}")
    assert_surface(session_id.startswith("sess_"), "session id was not persisted")
    return checks


def check_artifact_surfaces(*, snapshot: dict[str, Any], exported: dict[str, Any], db: dict[str, Any]) -> dict[str, bool]:
    snapshot_text = json.dumps(snapshot, ensure_ascii=False)
    export_db_tool_text = json.dumps({"export": exported, "db": db}, ensure_ascii=False)
    return {
        "snapshot_no_private_evaluator_markers": not any(term in snapshot_text for term in SENSITIVE_TERMS),
        "export_db_tool_no_private_evaluator_markers": not any(term in export_db_tool_text for term in SENSITIVE_TERMS),
        "export_db_tool_no_raw_wrong_code": WRONG_CODE.strip() not in export_db_tool_text,
        "export_db_tool_no_raw_right_code": RIGHT_CODE.strip() not in export_db_tool_text,
        "visible_conversation_contains_student_code": WRONG_CODE.strip() in snapshot_text or RIGHT_CODE.strip() in snapshot_text,
    }


def set_editor(page: Any, value: str) -> None:
    editor = page.locator(".cm-content").last
    expect(editor).to_be_visible(timeout=10_000)
    editor.click()
    page.keyboard.press("Control+A")
    page.keyboard.insert_text(value)


def screenshot(page: Any, artifact_dir: Path, screenshots: list[str], name: str) -> None:
    path = artifact_dir / name
    page.screenshot(path=str(path), full_page=True)
    screenshots.append(str(path))


def summarize_message_posts(posts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    summarized = []
    for post in posts:
        submission = post.get("practice_submission") if isinstance(post, dict) else None
        summarized.append({
            "message_length": len(str(post.get("message", ""))),
            "code_length": len(str(post.get("code", ""))),
            "practice_submission": {
                "kind": submission.get("kind") if isinstance(submission, dict) else None,
                "practice_contract_id": submission.get("practice_contract_id") if isinstance(submission, dict) else None,
                "code_length": len(str(submission.get("code", ""))) if isinstance(submission, dict) else 0,
                "code_integrity": code_integrity(submission.get("code")) if isinstance(submission, dict) else None,
            },
        })
    return summarized


def summarize_code_integrity(posts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = []
    for post in posts:
        submission = post.get("practice_submission") if isinstance(post, dict) else None
        if isinstance(submission, dict):
            result.append({
                "practice_contract_id": submission.get("practice_contract_id"),
                **code_integrity(submission.get("code")),
            })
    return result


def code_integrity(value: Any) -> dict[str, Any]:
    code = value if isinstance(value, str) else ""
    return {
        "code_length": len(code),
        "newline_count": code.count("\n"),
        "sha256": hashlib.sha256(code.encode("utf-8")).hexdigest() if code else None,
    }


def build_failure_report(
    *,
    gate_identity: dict[str, Any],
    startup_log_path: Path,
    db_path: Path,
    run_state: dict[str, Any],
    error: Exception,
) -> dict[str, Any]:
    screenshots = list(run_state.get("screenshots") or [])
    for path in startup_log_path.parent.glob("*.png"):
        resolved = str(path)
        if resolved not in screenshots:
            screenshots.append(resolved)
    message_posts = list(run_state.get("message_posts") or [])
    db = safe_collect_db_evidence(db_path)
    failure_class = classify_failure(gate_identity, db, error)
    return {
        "schema_version": "agentic_practice_verification.v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "session_id": run_state.get("session_id"),
        "gate_identity": gate_identity,
        "failure": {
            "failure_class": failure_class,
            "error_type": type(error).__name__,
            "message": sanitize_error(error),
        },
        "server_log_path": str(startup_log_path),
        "screenshots": screenshots,
        "console_logs": list(run_state.get("console_logs") or []),
        "network_paths": list(run_state.get("network_paths") or []),
        "message_posts": summarize_message_posts(message_posts),
        "code_integrity": summarize_code_integrity(message_posts),
        "db": db,
        "closure_claim": "closure not claimed; gate failed before successful verification report",
        "checks": {
            "verification_completed": False,
            "release_or_live_closure_claimed": False,
        },
}


def classify_failure(gate_identity: dict[str, Any], db: dict[str, Any], error: Exception) -> str:
    tool_evidence = db.get("tool_evidence") if isinstance(db, dict) else None
    if gate_identity.get("release_gate") and isinstance(tool_evidence, list):
        for row in tool_evidence:
            if not isinstance(row, dict):
                continue
            summary = str(row.get("summary_json") or "")
            if row.get("result_code") == "runtime_unavailable" or "sandbox_error" in summary or "SANDBOX_INTERNAL_ERROR" in summary:
                return "release_integration_failure"
    if isinstance(error, TimeoutError):
        return "timeout_failure"
    return "browser_assertion_failure"


def closure_claim_for_gate(gate_identity: dict[str, Any]) -> str:
    if gate_identity.get("release_gate"):
        return "agentic practice release gate evidence collected; strict-matrix, realistic-live, and full-realistic closure not claimed"
    return "targeted deterministic local evidence only; release/live/strict/realistic closure not claimed"


def sanitize_error(error: Exception) -> str:
    return str(error).replace(str(REPO_ROOT), "<repo>").replace(os.getcwd(), "<repo>")[:1200]


def summarize_text(value: str, limit: int) -> str:
    return " ".join(value.split())[:limit]


def http_json(base_url: str, method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(base_url + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def write_report(artifact_dir: Path, report: dict[str, Any]) -> None:
    (artifact_dir / "verification-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


def require_dict(value: Any, surface: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise AssertionError(f"missing or invalid surface: {surface}")
    return value


def assert_surface(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


if __name__ == "__main__":
    raise SystemExit(main())
