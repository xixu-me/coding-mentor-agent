from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from run_student_loop import find_free_port, npm_executable, stop_process, wait_for_http_ready


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
DISCOVERY_POLICY_PATH = SCRIPT_DIR / "student_loop_discovery_policy.json"
ACTOR_POLICY_PATH = SCRIPT_DIR / "student_loop_actor_policy.json"
ORACLE_LAYER_POLICY_PATH = SCRIPT_DIR / "student_loop_oracle_layers.json"
DISCOVERY_RUNS_ROOT = REPO_ROOT / ".app" / "student-loop" / "discovery-runs"
RUNS_ROOT = REPO_ROOT / ".app" / "student-loop" / "runs"
DISCOVERY_COMMAND = SCRIPT_DIR / "student_loop_discovery.py"
AI_ENV_KEYS = (
    "AI_PROVIDER",
    "AI_MODEL",
    "AI_API_KEY",
    "AI_BASE_URL",
    "AI_TIMEOUT_MS",
    "AI_MAX_OUTPUT_TOKENS",
    "AI_REASONING",
    "LLM_PROVIDER",
    "LLM_MODEL",
    "LLM_API_KEY",
    "LLM_RESPONSES_ENDPOINT",
    "LLM_TIMEOUT_MS",
    "LLM_MAX_OUTPUT_TOKENS",
    "ENABLE_PI_AGENT",
)


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise AssertionError(f"{path.name} must contain a JSON object")
    return value


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    if args.self_test_policy:
        return subprocess.call([sys.executable, str(DISCOVERY_COMMAND), "--self-test-policy"], cwd=REPO_ROOT)
    if args.live_provider:
        args.profile = "live_provider"
    if args.until_clean:
        return run_until_clean(args)
    return run_single_discovery(args)


def run_single_discovery(args: argparse.Namespace) -> int:
    policy = load_json(DISCOVERY_POLICY_PATH)
    profile = resolve_profile(policy, args.profile)
    discovery_run_id = allocate_timestamp_id(DISCOVERY_RUNS_ROOT)
    app_run_id = allocate_timestamp_id(RUNS_ROOT)
    seed = args.seed or default_seed(policy, profile, args.profile, discovery_run_id)
    port = int(os.environ.get("PORT") or find_free_port())
    base_url = f"http://127.0.0.1:{port}"
    discovery_run_root = DISCOVERY_RUNS_ROOT / discovery_run_id
    app_run_root = RUNS_ROOT / app_run_id
    artifact_dir = discovery_run_root / "artifacts"
    args.latest_summary_path = artifact_dir / "summary.json"
    app_artifact_dir = app_run_root / "artifacts"
    artifact_dir.mkdir(parents=True, exist_ok=True)
    app_artifact_dir.mkdir(parents=True, exist_ok=True)
    startup_log_path = artifact_dir / "server-startup.log"
    env = build_env(
        args=args,
        policy=policy,
        profile=profile,
        discovery_run_id=discovery_run_id,
        app_run_id=app_run_id,
        discovery_artifact_dir=artifact_dir,
        app_run_root=app_run_root,
        app_artifact_dir=app_artifact_dir,
        base_url=base_url,
        port=port,
        seed=seed,
    )
    command = [
        sys.executable,
        str(DISCOVERY_COMMAND),
        "--base-url",
        base_url,
        "--profile",
        str(args.profile),
        "--seed",
        seed,
    ]
    if args.persona:
        command.extend(["--persona", args.persona])
    if args.cluster_fingerprint:
        command.extend(["--cluster-fingerprint", args.cluster_fingerprint])
    if profile.get("liveProvider") or args.live_provider:
        command.append("--live-provider")

    with startup_log_path.open("wb") as startup_log:
        server = subprocess.Popen(
            [npm_executable(), "start"],
            cwd=REPO_ROOT,
            env=env,
            stdout=startup_log,
            stderr=subprocess.STDOUT,
        )
        try:
            wait_for_http_ready(
                base_url,
                server,
                timeout_seconds=server_startup_timeout_seconds(profile),
                startup_log_path=startup_log_path,
            )
            completed = subprocess.run(
                command,
                cwd=REPO_ROOT,
                env=env,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                check=False,
            )
            (artifact_dir / "discovery-command.log").write_text(completed.stdout[-20000:], encoding="utf-8")
            print(completed.stdout, end="")
            return completed.returncode
        finally:
            stop_process(server)


def run_until_clean(args: argparse.Namespace) -> int:
    policy = load_json(DISCOVERY_POLICY_PATH)
    profile = resolve_profile(policy, args.profile)
    required_clean_sweeps = int(profile.get("requiredCleanSweeps") or policy["requiredCleanSweeps"])
    max_discovery_sweeps = int(policy["maxDiscoverySweeps"])
    started = time.time()
    max_runtime_seconds = int(policy["maxRuntimeMinutes"]) * 60
    clean_sweeps = 0
    sweep_summaries: list[dict[str, Any]] = []

    for sweep_index in range(1, max_discovery_sweeps + 1):
        if time.time() - started > max_runtime_seconds:
            return write_until_clean_summary(policy, args.profile, sweep_summaries, clean_sweeps, "runtime_budget_exceeded")
        persona_results = []
        for persona_id in profile["requiredPersonas"]:
            run_args = clone_args(args)
            run_args.until_clean = False
            run_args.persona = str(persona_id)
            run_args.seed = f"{args.seed or policy['seedDefaults']['defaultSeed']}:sweep-{sweep_index}:persona-{persona_id}"
            return_code = run_single_discovery(run_args)
            summary = latest_summary(getattr(run_args, "latest_summary_path", None))
            persona_results.append({
                "persona_id": persona_id,
                "return_code": return_code,
                "summary_path": summary.get("summary_path"),
                "closure_eligible": summary.get("closure_eligible"),
                "issue_clean": summary.get("issue_clean", False),
                "blocking_clusters": summary.get("blocking_clusters", []),
                "high_risk_findings_count": summary.get("high_risk_findings_count", 0),
                "covered_journey_states": summary.get("covered_journey_states", []),
                "covered_actor_actions": summary.get("covered_actor_actions", []),
                "covered_prompt_ids": summary.get("covered_prompt_ids", []),
                "covered_prompt_tags": summary.get("covered_prompt_tags", []),
                "covered_mutation_ids": summary.get("covered_mutation_ids", []),
                "covered_oracle_layers": summary.get("covered_oracle_layers", []),
                "tutor_agent_axis_coverage": summary.get("tutor_agent_axis_coverage", {}),
                "missing_tutor_agent_axis_values": summary.get("missing_tutor_agent_axis_values", {}),
                "unclassified_failure_count": summary.get("unclassified_failure_count", 0),
                "live_non_fallback_response_proved": summary.get("live_non_fallback_response_proved", False),
            })
            has_repair_issue = summary_has_repair_issue(summary) or int(summary.get("unclassified_failure_count", 0)) > 0
            if has_repair_issue or (policy.get("stopOnHighRisk") and int(summary.get("high_risk_findings_count", 0)) > 0):
                stop_condition = profile_stop_condition(profile, "repair_required" if summary_has_repair_issue(summary) else "not_closable")
                sweep_summaries.append({
                    "sweep_index": sweep_index,
                    "status": "failed",
                    "persona_results": persona_results,
                    "stop_reason": stop_condition,
                })
                return write_until_clean_summary(policy, args.profile, sweep_summaries, clean_sweeps, stop_condition)
        coverage = summarize_sweep_coverage(profile, persona_results)
        sweep_clean = (
            not coverage["missing_personas"]
            and not coverage["missing_journey_states"]
            and not coverage["missing_actor_actions"]
            and not coverage["missing_prompt_ids"]
            and not coverage["missing_prompt_tags"]
            and not coverage["missing_mutation_ids"]
            and not coverage["missing_oracle_layers"]
            and not coverage["missing_tutor_agent_axis_values"]
            and sum(int(result.get("unclassified_failure_count", 0)) for result in persona_results) == 0
            and (
                not profile.get("requireNonFallbackTutorEvidence")
                or any(result.get("live_non_fallback_response_proved") for result in persona_results)
            )
            and all(result["issue_clean"] for result in persona_results)
        )
        sweep_summaries.append({
            "sweep_index": sweep_index,
            "status": "clean" if sweep_clean else "failed",
            "persona_results": persona_results,
            "coverage": coverage,
            "stop_reason": "clean_sweep" if sweep_clean else "coverage_gap",
        })
        if sweep_clean:
            clean_sweeps += 1
            if clean_sweeps >= required_clean_sweeps:
                return write_until_clean_summary(policy, args.profile, sweep_summaries, clean_sweeps, profile_stop_condition(profile, "clean"))
        else:
            clean_sweeps = 0
            return write_until_clean_summary(policy, args.profile, sweep_summaries, clean_sweeps, profile_stop_condition(profile, "not_closable"))
    return write_until_clean_summary(policy, args.profile, sweep_summaries, clean_sweeps, "max_discovery_sweeps_reached")


def write_until_clean_summary(
    policy: dict[str, Any],
    profile_id: str,
    sweep_summaries: list[dict[str, Any]],
    clean_sweeps: int,
    stop_condition: str,
) -> int:
    run_id = allocate_timestamp_id(DISCOVERY_RUNS_ROOT)
    root = DISCOVERY_RUNS_ROOT / run_id
    root.mkdir(parents=True, exist_ok=True)
    profile = resolve_profile(policy, profile_id)
    closure_eligible = stop_condition in {"required_clean_sweeps_reached", profile_stop_condition(profile, "clean")}
    latest_coverage = {}
    if sweep_summaries:
        latest_coverage = sweep_summaries[-1].get("coverage", {}) if isinstance(sweep_summaries[-1], dict) else {}
    if not latest_coverage:
        latest_coverage = coverage_from_persona_results(profile, sweep_summaries)
    summary = {
        "schema_version": "student_loop_discovery_until_clean.v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "profile": profile_id,
        "gate_kind": gate_kind_for_profile(profile_id, profile),
        "live_mode": "live_realistic" if resolve_profile(policy, profile_id).get("liveProvider") else "local_only",
        "discovery_universe_version": policy["discoveryUniverseVersion"],
        "realistic_universe_version": policy["discoveryUniverseVersion"],
        "stop_condition": stop_condition,
        "required_clean_sweeps": profile_for_clean_sweeps(policy, profile_id),
        "max_discovery_sweeps": policy["maxDiscoverySweeps"],
        "clean_sweeps": clean_sweeps,
        "closure_eligible": closure_eligible,
        "closure_claim": closure_claim_for_profile(policy, profile_id) if closure_eligible else "Discovery closure was not claimed.",
        "coverage": latest_coverage,
        "sweep_summaries": sweep_summaries,
        "issue_clusters": [
            cluster
            for sweep in sweep_summaries
            for result in sweep.get("persona_results", [])
            for cluster in result.get("blocking_clusters", [])
        ],
        "exclusions": [],
        "oracle_layer_summary": latest_coverage.get("covered_oracle_layers", []),
        "full_realistic_closure": {
            "enabled": profile_id == "full_realistic_closure",
            "universe_version": policy["discoveryUniverseVersion"],
            "final_closure_command": profile.get("finalClosureCommand"),
            "clean_sweeps": clean_sweeps,
            "coverage_gap": {
                "missing_required_personas": latest_coverage.get("missing_personas", []),
                "missing_required_journey_states": latest_coverage.get("missing_journey_states", []),
                "missing_required_actor_actions": latest_coverage.get("missing_actor_actions", []),
                "missing_required_prompt_ids": latest_coverage.get("missing_prompt_ids", []),
                "missing_required_prompt_tags": latest_coverage.get("missing_prompt_tags", []),
                "missing_required_mutation_ids": latest_coverage.get("missing_mutation_ids", []),
                "missing_required_oracle_layers": latest_coverage.get("missing_oracle_layers", []),
                "missing_required_tutor_agent_axis_values": latest_coverage.get("missing_tutor_agent_axis_values", {}),
                "live_non_fallback_response_missing": latest_coverage.get("live_non_fallback_response_missing", False),
                "failed_persona_coverage_gap": latest_coverage.get("failed_persona_coverage_gap", {}),
            },
            "tutor_agent_coverage": latest_coverage.get("tutor_agent_axis_coverage", {}),
            "targeted_reruns_substitute_for_final_closure": False,
            "must_not_claim_absolute_absence": True,
        },
        "residual_risk_statement": policy["closure"]["residualRiskStatement"],
        "bounded_wording": bounded_wording_for_profile(profile_id) if closure_eligible else "Discovery run stopped before closure.",
    }
    path = root / "until-clean-summary.json"
    path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"discovery until-clean summary: {path}")
    return 0 if closure_eligible else 1


def latest_summary(summary_path: Path | None = None) -> dict[str, Any]:
    if summary_path is not None:
        candidates = [summary_path]
    else:
        candidates = sorted(DISCOVERY_RUNS_ROOT.glob("*/artifacts/summary.json"), key=lambda item: item.stat().st_mtime, reverse=True)
    if not candidates:
        return {"summary_path": None, "closure_eligible": False, "blocking_clusters": ["summary_missing"]}
    path = candidates[0]
    if not path.exists() or path.stat().st_size == 0:
        return {"summary_path": repo_relative(path), "closure_eligible": False, "blocking_clusters": ["summary_missing_or_empty"]}
    try:
        summary = json.loads(path.read_text(encoding="utf-8"))
    except Exception as error:
        return {"summary_path": str(path), "closure_eligible": False, "blocking_clusters": [f"summary_read_failed:{type(error).__name__}"]}
    return {
        "summary_path": repo_relative(path),
        "closure_eligible": bool(summary.get("closure", {}).get("closure_eligible")),
        "blocking_clusters": [cluster.get("fingerprint") for cluster in summary.get("blocking_issue_clusters", [])],
        "high_risk_findings_count": int(summary.get("high_risk_findings_count", 0)),
        "issue_clean": not summary.get("blocking_issue_clusters", []) and int(summary.get("high_risk_findings_count", 0)) == 0,
        "covered_journey_states": summary.get("coverage", {}).get("covered_journey_states", []),
        "covered_actor_actions": summary.get("actor_action_coverage", {}).get("covered", []),
        "covered_prompt_ids": summary.get("prompt_id_coverage", {}).get("selected_prompt_ids", summary.get("prompt_coverage", {}).get("selected_prompt_ids", [])),
        "covered_prompt_tags": summary.get("prompt_coverage", {}).get("covered_prompt_tags", []),
        "covered_mutation_ids": summary.get("mutation_coverage", {}).get("selected_mutation_ids", []),
        "covered_oracle_layers": summary.get("oracle_layer_coverage", {}).get("covered", []),
        "tutor_agent_axis_coverage": summary.get("tutor_agent_axis_coverage", {}),
        "missing_tutor_agent_axis_values": summary.get("tutor_agent_axis_coverage", {}).get("missing", {}),
        "unclassified_failure_count": int(summary.get("full_realistic_closure", {}).get("unclassified_failure_count", 0)),
        "live_non_fallback_response_proved": bool(summary.get("coverage", {}).get("live_non_fallback_response_proved")),
    }


def gate_kind_for_profile(profile_id: str, profile: dict[str, Any]) -> str:
    if str(profile.get("gateKind", "")).strip():
        return str(profile["gateKind"])
    return "realistic_student_loop" if profile_id in {"realistic", "release", "security"} else profile_id


def closure_claim_for_profile(policy: dict[str, Any], profile_id: str) -> str:
    profile = resolve_profile(policy, profile_id)
    if profile_id == "full_realistic_closure":
        return (
            "Full-realistic student loop closure found no new blocking or high-risk in-scope issues inside the configured "
            "full-realistic student-operation universe, live model profile, actor policy, personas, prompt corpus, journey states, "
            "mutation policy, oracle layers, and seed budget."
        )
    return policy["closure"]["claimTemplate"]


def bounded_wording_for_profile(profile_id: str) -> str:
    if profile_id == "full_realistic_closure":
        return (
            "No new blocking or high-risk in-scope issues were found only inside the configured full-realistic student-operation "
            "boundary. This does not prove behavior outside that boundary."
        )
    return (
        "No new blocking in-scope realistic issue clusters were found only inside the configured realistic universe, live model "
        "profile, actor policy, personas, prompt corpus, journey states, mutation policy, and seed budget."
    )


def profile_stop_condition(profile: dict[str, Any], kind: str) -> str:
    if kind == "clean":
        return str(profile.get("stopConditionClean") or "required_clean_sweeps_reached")
    if kind == "repair_required":
        return str(profile.get("stopConditionRepairRequired") or "discovery_failed")
    if kind == "not_closable":
        return str(profile.get("stopConditionNotClosable") or "coverage_gap")
    return kind


def summary_has_repair_issue(summary: dict[str, Any]) -> bool:
    return bool(summary.get("blocking_clusters")) or int(summary.get("high_risk_findings_count", 0)) > 0


def summarize_sweep_coverage(profile: dict[str, Any], persona_results: list[dict[str, Any]]) -> dict[str, Any]:
    covered_personas = {
        str(result["persona_id"])
        for result in persona_results
        if result.get("issue_clean")
    }
    covered_states = {
        str(state)
        for result in persona_results
        for state in result.get("covered_journey_states", [])
    }
    covered_actor_actions = {
        str(action)
        for result in persona_results
        for action in result.get("covered_actor_actions", [])
    }
    covered_prompt_tags = {
        str(tag)
        for result in persona_results
        for tag in result.get("covered_prompt_tags", [])
    }
    covered_prompt_ids = {
        str(prompt_id)
        for result in persona_results
        for prompt_id in result.get("covered_prompt_ids", [])
    }
    covered_mutation_ids = {
        str(mutation_id)
        for result in persona_results
        for mutation_id in result.get("covered_mutation_ids", [])
    }
    covered_oracle_layers = {
        str(layer_id)
        for result in persona_results
        for layer_id in result.get("covered_oracle_layers", [])
    }
    tutor_agent_axis_coverage = merge_tutor_agent_axis_coverage([result.get("tutor_agent_axis_coverage", {}) for result in persona_results])
    required_personas = {str(item) for item in profile["requiredPersonas"]}
    required_states = {str(item) for item in profile["requiredJourneyStates"]}
    required_actor_actions = {str(item) for item in profile.get("requiredActorActions", [])}
    required_prompt_tags = {str(item) for item in profile.get("requiredPromptTags", [])}
    required_prompt_ids = {str(item) for item in profile.get("requiredPromptIds", [])}
    required_mutation_ids = {str(item) for item in profile.get("requiredMutationIds", [])}
    required_oracle_layers = {str(item) for item in profile.get("requiredOracleLayers", [])}
    missing_tutor_agent_axis_values = missing_tutor_agent_axis_values_for_profile(profile, tutor_agent_axis_coverage)
    return {
        "covered_personas": sorted(covered_personas),
        "missing_personas": sorted(required_personas - covered_personas),
        "covered_journey_states": sorted(covered_states),
        "missing_journey_states": sorted(required_states - covered_states),
        "covered_actor_actions": sorted(covered_actor_actions),
        "missing_actor_actions": sorted(required_actor_actions - covered_actor_actions),
        "covered_prompt_tags": sorted(covered_prompt_tags),
        "missing_prompt_tags": sorted(required_prompt_tags - covered_prompt_tags),
        "covered_prompt_ids": sorted(covered_prompt_ids),
        "missing_prompt_ids": sorted(required_prompt_ids - covered_prompt_ids),
        "covered_mutation_ids": sorted(covered_mutation_ids),
        "missing_mutation_ids": sorted(required_mutation_ids - covered_mutation_ids),
        "covered_oracle_layers": sorted(covered_oracle_layers),
        "missing_oracle_layers": sorted(required_oracle_layers - covered_oracle_layers),
        "tutor_agent_axis_coverage": tutor_agent_axis_coverage,
        "missing_tutor_agent_axis_values": missing_tutor_agent_axis_values,
        "live_non_fallback_response_missing": bool(profile.get("requireNonFallbackTutorEvidence")) and not any(result.get("live_non_fallback_response_proved") for result in persona_results),
        "failed_persona_coverage_gap": failed_persona_coverage_gap(profile, persona_results),
    }


def coverage_from_persona_results(profile: dict[str, Any], sweep_summaries: list[dict[str, Any]]) -> dict[str, Any]:
    persona_results = [
        result
        for sweep in sweep_summaries
        if isinstance(sweep, dict)
        for result in sweep.get("persona_results", [])
        if isinstance(result, dict)
    ]
    if not persona_results:
        return {}
    coverage = summarize_sweep_coverage(profile, persona_results)
    coverage["source"] = "coverage_from_persona_results"
    return coverage


def failed_persona_coverage_gap(profile: dict[str, Any], persona_results: list[dict[str, Any]]) -> dict[str, Any]:
    failed = [
        result for result in persona_results
        if not result.get("issue_clean") or int(result.get("unclassified_failure_count", 0)) > 0
    ]
    if not failed:
        return {}
    covered_states = {str(state) for result in failed for state in result.get("covered_journey_states", [])}
    covered_actor_actions = {str(action) for result in failed for action in result.get("covered_actor_actions", [])}
    covered_prompt_ids = {str(prompt_id) for result in failed for prompt_id in result.get("covered_prompt_ids", [])}
    covered_prompt_tags = {str(tag) for result in failed for tag in result.get("covered_prompt_tags", [])}
    covered_mutation_ids = {str(mutation_id) for result in failed for mutation_id in result.get("covered_mutation_ids", [])}
    covered_oracle_layers = {str(layer) for result in failed for layer in result.get("covered_oracle_layers", [])}
    required_tutor_axes = missing_tutor_agent_axis_values_for_profile(
        profile,
        merge_tutor_agent_axis_coverage([result.get("tutor_agent_axis_coverage", {}) for result in failed]),
    )
    return {
        "failed_personas": [str(result.get("persona_id")) for result in failed],
        "missing_required_journey_states": sorted({str(item) for item in profile.get("requiredJourneyStates", [])} - covered_states),
        "missing_required_actor_actions": sorted({str(item) for item in profile.get("requiredActorActions", [])} - covered_actor_actions),
        "missing_required_prompt_ids": sorted({str(item) for item in profile.get("requiredPromptIds", [])} - covered_prompt_ids),
        "missing_required_prompt_tags": sorted({str(item) for item in profile.get("requiredPromptTags", [])} - covered_prompt_tags),
        "missing_required_mutation_ids": sorted({str(item) for item in profile.get("requiredMutationIds", [])} - covered_mutation_ids),
        "missing_required_oracle_layers": sorted({str(item) for item in profile.get("requiredOracleLayers", [])} - covered_oracle_layers),
        "missing_required_tutor_agent_axis_values": required_tutor_axes,
        "blocking_clusters": [cluster for result in failed for cluster in result.get("blocking_clusters", [])],
        "live_non_fallback_response_missing": bool(profile.get("requireNonFallbackTutorEvidence")) and not any(result.get("live_non_fallback_response_proved") for result in failed),
    }


def merge_tutor_agent_axis_coverage(items: list[Any]) -> dict[str, Any]:
    covered: dict[str, set[str]] = {}
    universe_version = "tutor-agent-full-realistic.v1"
    for item in items:
        if not isinstance(item, dict):
            continue
        universe_version = str(item.get("universe_version") or universe_version)
        source = item.get("covered", {})
        if not isinstance(source, dict):
            continue
        for axis_id, values in source.items():
            covered.setdefault(str(axis_id), set())
            if isinstance(values, list):
                covered[str(axis_id)].update(str(value) for value in values)
    return {
        "universe_version": universe_version,
        "covered": {axis_id: sorted(values) for axis_id, values in covered.items()},
    }


def missing_tutor_agent_axis_values_for_profile(profile: dict[str, Any], coverage: dict[str, Any]) -> dict[str, list[str]]:
    covered = coverage.get("covered", {}) if isinstance(coverage, dict) else {}
    missing: dict[str, list[str]] = {}
    for axis in profile.get("tutorAgentCoverage", {}).get("axes", []):
        if not isinstance(axis, dict):
            continue
        axis_id = str(axis.get("id"))
        required_values = {str(value) for value in axis.get("requiredValues", [])}
        covered_values = {str(value) for value in covered.get(axis_id, [])} if isinstance(covered, dict) else set()
        axis_missing = sorted(required_values - covered_values)
        if axis_missing:
            missing[axis_id] = axis_missing
    return missing


def build_env(
    *,
    args: argparse.Namespace,
    policy: dict[str, Any],
    profile: dict[str, Any],
    discovery_run_id: str,
    app_run_id: str,
    discovery_artifact_dir: Path,
    app_run_root: Path,
    app_artifact_dir: Path,
    base_url: str,
    port: int,
    seed: str,
) -> dict[str, str]:
    env = {key: str(value) for key, value in os.environ.items()}
    if profile.get("liveProvider") or args.live_provider:
        env = load_env_files(env)
        if args.live_provider or profile.get("optInEnv"):
            env["STUDENT_LOOP_LIVE_PROVIDER"] = "1"
        budget = profile.get("budget", {})
        env.setdefault("AI_TIMEOUT_MS", str(budget.get("timeoutMs", 30000)))
        env.setdefault("AI_MAX_OUTPUT_TOKENS", str(budget.get("maxOutputTokens", 1200)))
    else:
        for key in AI_ENV_KEYS:
            env[key] = ""
        env.pop("STUDENT_LOOP_LIVE_PROVIDER", None)
    env.update({
        "PORT": str(port),
        "BASE_URL": base_url,
        "STUDENT_LOOP_DISCOVERY_RUN_ID": discovery_run_id,
        "STUDENT_LOOP_REALISTIC_RUN_ID": discovery_run_id,
        "STUDENT_LOOP_DISCOVERY_PROFILE": str(args.profile),
        "STUDENT_LOOP_DISCOVERY_SEED": seed,
        "STUDENT_LOOP_DISCOVERY_ARTIFACT_DIR": str(discovery_artifact_dir),
        "STUDENT_LOOP_RUN_ID": app_run_id,
        "APP_DATA_DIR": str(app_run_root / "data"),
        "PROGRESS_DB_PATH": str(app_run_root / "data" / "progress.db"),
        "STUDENT_LOOP_ARTIFACT_DIR": str(app_artifact_dir),
        "STUDENT_LOOP_DISCOVERY_UNIVERSE_VERSION": str(policy["discoveryUniverseVersion"]),
        "STUDENT_LOOP_ACTOR_POLICY_PATH": str(ACTOR_POLICY_PATH),
        "STUDENT_LOOP_ORACLE_LAYER_POLICY_PATH": str(ORACLE_LAYER_POLICY_PATH),
        "STUDENT_LOOP_MODEL_RATE_LIMIT_MAX": "100" if str(args.profile) == "full_realistic_closure" else env.get("STUDENT_LOOP_MODEL_RATE_LIMIT_MAX", ""),
        "STUDENT_LOOP_MODEL_RATE_LIMIT_WINDOW_MS": "1000" if str(args.profile) == "full_realistic_closure" else env.get("STUDENT_LOOP_MODEL_RATE_LIMIT_WINDOW_MS", ""),
    })
    return env


def server_startup_timeout_seconds(profile: dict[str, Any]) -> int:
    budget = profile.get("budget", {}) if isinstance(profile.get("budget"), dict) else {}
    budget_timeout_ms = int(budget.get("timeoutMs", 45_000) or 45_000)
    return max(90, min(240, int(budget_timeout_ms / 1000) + 75))


def load_env_files(env: dict[str, str]) -> dict[str, str]:
    loaded = dict(env)
    for path in (REPO_ROOT / ".env", REPO_ROOT / ".env.local"):
        if not path.exists():
            continue
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            if not re.fullmatch(r"[A-Z_][A-Z0-9_]*", key):
                continue
            if key in loaded and loaded[key] != "":
                continue
            loaded[key] = unquote_env_value(value.strip())
    return loaded


def unquote_env_value(value: str) -> str:
    if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
        return value[1:-1]
    return value


def resolve_profile(policy: dict[str, Any], profile_id: str) -> dict[str, Any]:
    profiles = policy.get("gateProfiles", {})
    if profile_id not in profiles:
        raise AssertionError(f"unknown discovery profile: {profile_id}")
    return profiles[profile_id]


def profile_for_clean_sweeps(policy: dict[str, Any], profile_id: str) -> int:
    profile = resolve_profile(policy, profile_id)
    return int(profile.get("requiredCleanSweeps") or policy["requiredCleanSweeps"])


def default_seed(policy: dict[str, Any], profile: dict[str, Any], profile_id: str, discovery_run_id: str) -> str:
    base = str(policy["seedDefaults"]["defaultSeed"])
    mode = "live" if profile.get("liveProvider") else "local"
    return f"{base}:{profile_id}:{mode}:{discovery_run_id}"


def allocate_timestamp_id(root: Path) -> str:
    root.mkdir(parents=True, exist_ok=True)
    while True:
        candidate = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        if not (root / candidate).exists():
            return candidate
        time.sleep(1.05)


def repo_relative(path: Path) -> str:
    try:
        return path.resolve().relative_to(REPO_ROOT.resolve()).as_posix()
    except ValueError:
        return path.name


def clone_args(args: argparse.Namespace) -> argparse.Namespace:
    return argparse.Namespace(**vars(args))


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Start the app and run persona-driven student loop discovery.")
    parser.add_argument("--self-test-policy", action="store_true", help="Validate discovery contracts without launching a browser or app server.")
    parser.add_argument("--profile", default="realistic", choices=["local", "discovery", "realistic", "full_realistic_closure", "live_provider", "release", "security"], help="Discovery gate profile.")
    parser.add_argument("--until-clean", action="store_true", help="Run discovery sweeps until the configured clean sweep count is reached.")
    parser.add_argument("--live-provider", action="store_true", help="Run the opt-in live-provider gate.")
    parser.add_argument("--seed", help="Deterministic discovery seed.")
    parser.add_argument("--persona", help="Run one persona id. Intended for targeted discovery reruns.")
    parser.add_argument("--cluster-fingerprint", help="Issue cluster fingerprint for targeted rerun bookkeeping.")
    return parser.parse_args(argv)


if __name__ == "__main__":
    raise SystemExit(main())
