from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
MATRIX_POLICY_PATH = SCRIPT_DIR / "student_loop_matrix_policy.json"
DEFAULT_POLICY_PATH = SCRIPT_DIR / "student_loop_policy.json"
RUNS_ROOT = REPO_ROOT / ".app" / "student-loop" / "runs"
MATRIX_RUNS_ROOT = REPO_ROOT / ".app" / "student-loop" / "matrix-runs"
STUDENT_LOOP_COMMAND = SCRIPT_DIR / "run_student_loop.py"
COVERAGE_UNIVERSE_VERSION = "student-loop-strict.v2"


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise AssertionError(f"{path.name} must contain a JSON object")
    return value


def validate_matrix_policy(policy: dict[str, Any]) -> None:
    required_keys = {
        "schemaVersion",
        "coverageUniverseVersion",
        "requiredCleanCycles",
        "maxMatrixCycles",
        "maxRepairIterations",
        "maxRuntimeMinutes",
        "stopOnHighRisk",
        "allowedArtifactRoots",
        "coverageAdequacy",
        "scenarios",
    }
    missing = sorted(required_keys - set(policy))
    if missing:
        raise AssertionError(f"strict matrix policy missing keys: {missing}")
    if policy["schemaVersion"] != 1:
        raise AssertionError("strict matrix policy schemaVersion must be 1")
    if policy["coverageUniverseVersion"] != COVERAGE_UNIVERSE_VERSION:
        raise AssertionError("strict matrix coverageUniverseVersion is not recognized")
    for integer_key in ("requiredCleanCycles", "maxMatrixCycles", "maxRepairIterations", "maxRuntimeMinutes"):
        if not isinstance(policy.get(integer_key), int) or int(policy[integer_key]) < 1:
            raise AssertionError(f"strict matrix policy {integer_key} must be a positive integer")
    if int(policy["maxMatrixCycles"]) < int(policy["requiredCleanCycles"]):
        raise AssertionError("maxMatrixCycles must be greater than or equal to requiredCleanCycles")
    if int(policy["requiredCleanCycles"]) < 2:
        raise AssertionError("requiredCleanCycles must be at least 2 for best-boundary closure")
    if not isinstance(policy["scenarios"], list) or not policy["scenarios"]:
        raise AssertionError("strict matrix policy must define at least one scenario")
    allowed_artifact_roots = policy.get("allowedArtifactRoots")
    if allowed_artifact_roots != [".app/student-loop/runs", ".app/student-loop/matrix-runs"]:
        raise AssertionError("strict matrix policy allowedArtifactRoots must be limited to student-loop artifact roots")

    seen: set[str] = set()
    required_scenario_fields = {
        "id",
        "required",
        "status",
        "learnerState",
        "viewport",
        "networkCondition",
        "dataCondition",
        "faultMode",
        "expectedOutcome",
        "requiredEvidence",
        "adequacyAxisCoverage",
        "env",
    }
    for index, scenario in enumerate(policy["scenarios"]):
        if not isinstance(scenario, dict):
            raise AssertionError(f"strict matrix scenario {index} must be an object")
        missing_fields = sorted(required_scenario_fields - set(scenario))
        if missing_fields:
            raise AssertionError(f"strict matrix scenario {index} missing fields: {missing_fields}")
        scenario_id = str(scenario["id"]).strip()
        if not scenario_id:
            raise AssertionError(f"strict matrix scenario {index} has an empty id")
        if scenario_id in seen:
            raise AssertionError(f"strict matrix policy has duplicate scenario id: {scenario_id}")
        seen.add(scenario_id)
        if scenario.get("required") is not True:
            raise AssertionError(f"strict matrix scenario {scenario_id} must be required")
        if scenario.get("status") != "required":
            raise AssertionError(f"strict matrix scenario {scenario_id} must use status=required, not {scenario.get('status')}")
        if str(scenario.get("status")) == "planned":
            raise AssertionError(f"strict matrix scenario {scenario_id} cannot be planned")
        for text_field in ("learnerState", "viewport", "networkCondition", "dataCondition", "faultMode", "expectedOutcome"):
            if not str(scenario.get(text_field, "")).strip():
                raise AssertionError(f"strict matrix scenario {scenario_id} must define {text_field}")
        required_evidence = scenario["requiredEvidence"]
        if not isinstance(required_evidence, list) or not required_evidence or any(not str(item).strip() for item in required_evidence):
            raise AssertionError(f"strict matrix scenario {scenario_id} must include nonempty requiredEvidence")
        axis_coverage = scenario["adequacyAxisCoverage"]
        if not isinstance(axis_coverage, dict) or not axis_coverage:
            raise AssertionError(f"strict matrix scenario {scenario_id} must include adequacyAxisCoverage")
        for axis_id, values in axis_coverage.items():
            if not isinstance(axis_id, str) or not axis_id.strip():
                raise AssertionError(f"strict matrix scenario {scenario_id} has an invalid adequacy axis id")
            if not isinstance(values, list) or not values or any(not isinstance(value, str) or not value.strip() for value in values):
                raise AssertionError(f"strict matrix scenario {scenario_id} adequacy axis {axis_id} must list nonempty string values")
        env = scenario["env"]
        if not isinstance(env, dict):
            raise AssertionError(f"strict matrix scenario {scenario_id} env must be an object")
        for key, value in env.items():
            if not isinstance(key, str) or not isinstance(value, str):
                raise AssertionError(f"strict matrix scenario {scenario_id} env must map strings to strings")
        scenario_mode = env.get("STUDENT_LOOP_SCENARIO_MODE", "full")
        if scenario_mode not in {"full", "probe_only"}:
            raise AssertionError(f"strict matrix scenario {scenario_id} has invalid STUDENT_LOOP_SCENARIO_MODE: {scenario_mode}")
        if scenario_id == "default_full_journey" and scenario_mode != "full":
            raise AssertionError("default_full_journey must use full scenario mode")
        if scenario_id != "default_full_journey" and scenario_mode != "probe_only":
            raise AssertionError(f"strict matrix synthetic scenario {scenario_id} must use probe_only mode")
    validate_coverage_adequacy(policy)


def validate_coverage_adequacy(policy: dict[str, Any]) -> None:
    adequacy = policy.get("coverageAdequacy")
    if not isinstance(adequacy, dict):
        raise AssertionError("strict matrix policy coverageAdequacy must be an object")
    required_keys = {
        "schemaVersion",
        "minimumCleanCycles",
        "closureClaimTemplate",
        "residualRiskStatement",
        "scenarioAxes",
        "highRiskPairings",
        "exclusions",
    }
    missing = sorted(required_keys - set(adequacy))
    if missing:
        raise AssertionError(f"coverage adequacy missing keys: {missing}")
    if adequacy["schemaVersion"] != 1:
        raise AssertionError("coverage adequacy schemaVersion must be 1")
    minimum_clean_cycles = adequacy["minimumCleanCycles"]
    if not isinstance(minimum_clean_cycles, int) or minimum_clean_cycles < 2:
        raise AssertionError("coverage adequacy minimumCleanCycles must be at least 2")
    if int(policy["requiredCleanCycles"]) < minimum_clean_cycles:
        raise AssertionError("requiredCleanCycles must satisfy coverage adequacy minimumCleanCycles")
    claim_template = str(adequacy.get("closureClaimTemplate", ""))
    if "inside the declared coverage universe" not in claim_template:
        raise AssertionError("coverage adequacy closureClaimTemplate must use bounded coverage-universe wording")
    if any(term in claim_template.lower() for term in ("no bugs exist", "absolute absence", "outside that universe is clean")):
        raise AssertionError("coverage adequacy closureClaimTemplate must not claim absolute bug absence")
    if not str(adequacy.get("residualRiskStatement", "")).strip():
        raise AssertionError("coverage adequacy residualRiskStatement must be nonempty")

    axes = adequacy["scenarioAxes"]
    if not isinstance(axes, list) or not axes:
        raise AssertionError("coverage adequacy scenarioAxes must be a nonempty list")
    axis_values: dict[str, set[str]] = {}
    for axis in axes:
        if not isinstance(axis, dict):
            raise AssertionError("coverage adequacy scenarioAxes entries must be objects")
        axis_id = str(axis.get("id", "")).strip()
        values = axis.get("requiredValues")
        if not axis_id:
            raise AssertionError("coverage adequacy axis id must be nonempty")
        if axis_id in axis_values:
            raise AssertionError(f"coverage adequacy has duplicate axis id: {axis_id}")
        if not isinstance(values, list) or not values:
            raise AssertionError(f"coverage adequacy axis {axis_id} must list requiredValues")
        normalized_values: set[str] = set()
        for value in values:
            value_id = str(value).strip()
            if not value_id:
                raise AssertionError(f"coverage adequacy axis {axis_id} has an empty value")
            if value_id in normalized_values:
                raise AssertionError(f"coverage adequacy axis {axis_id} has duplicate value: {value_id}")
            normalized_values.add(value_id)
        axis_values[axis_id] = normalized_values

    scenarios = policy["scenarios"]
    scenario_ids = {str(scenario["id"]) for scenario in scenarios}
    covered: dict[str, set[str]] = {axis: set() for axis in axis_values}
    for scenario in scenarios:
        scenario_id = str(scenario["id"])
        for axis_id, values in scenario["adequacyAxisCoverage"].items():
            if axis_id not in axis_values:
                raise AssertionError(f"strict matrix scenario {scenario_id} references unknown adequacy axis: {axis_id}")
            for value in values:
                value_id = str(value)
                if value_id not in axis_values[axis_id]:
                    raise AssertionError(f"strict matrix scenario {scenario_id} references unknown adequacy value: {axis_id}={value_id}")
                covered[axis_id].add(value_id)

    exclusions = adequacy["exclusions"]
    if not isinstance(exclusions, list):
        raise AssertionError("coverage adequacy exclusions must be a list")
    excluded: dict[str, set[str]] = {axis: set() for axis in axis_values}
    exclusion_ids: set[str] = set()
    for exclusion in exclusions:
        if not isinstance(exclusion, dict):
            raise AssertionError("coverage adequacy exclusions must contain objects")
        required = {"id", "axis", "value", "rationale", "proof", "owner", "residualRisk"}
        missing_exclusion = sorted(required - set(exclusion))
        if missing_exclusion:
            raise AssertionError(f"coverage adequacy exclusion missing keys: {missing_exclusion}")
        exclusion_id = str(exclusion["id"]).strip()
        axis_id = str(exclusion["axis"]).strip()
        value_id = str(exclusion["value"]).strip()
        if not exclusion_id or exclusion_id in exclusion_ids:
            raise AssertionError(f"coverage adequacy exclusion has invalid or duplicate id: {exclusion_id}")
        exclusion_ids.add(exclusion_id)
        if axis_id not in axis_values or value_id not in axis_values[axis_id]:
            raise AssertionError(f"coverage adequacy exclusion references unknown axis value: {axis_id}={value_id}")
        for text_key in ("rationale", "proof", "owner", "residualRisk"):
            if not str(exclusion.get(text_key, "")).strip():
                raise AssertionError(f"coverage adequacy exclusion {exclusion_id} must include {text_key}")
        excluded[axis_id].add(value_id)

    missing_axis_values = {
        axis_id: sorted(values - covered[axis_id] - excluded[axis_id])
        for axis_id, values in axis_values.items()
        if values - covered[axis_id] - excluded[axis_id]
    }
    if missing_axis_values:
        raise AssertionError(f"coverage adequacy missing axis coverage: {missing_axis_values}")

    pairings = adequacy["highRiskPairings"]
    if not isinstance(pairings, list) or not pairings:
        raise AssertionError("coverage adequacy highRiskPairings must be a nonempty list")
    pairing_ids: set[str] = set()
    for pairing in pairings:
        if not isinstance(pairing, dict):
            raise AssertionError("coverage adequacy highRiskPairings must contain objects")
        required = {"id", "required", "axisValues", "scenarioIds"}
        missing_pairing = sorted(required - set(pairing))
        if missing_pairing:
            raise AssertionError(f"coverage adequacy high-risk pairing missing keys: {missing_pairing}")
        pairing_id = str(pairing["id"]).strip()
        if not pairing_id or pairing_id in pairing_ids:
            raise AssertionError(f"coverage adequacy high-risk pairing has invalid or duplicate id: {pairing_id}")
        pairing_ids.add(pairing_id)
        if pairing.get("required") is not True:
            raise AssertionError(f"coverage adequacy high-risk pairing {pairing_id} must be required")
        axis_value_map = pairing["axisValues"]
        if not isinstance(axis_value_map, dict) or not axis_value_map:
            raise AssertionError(f"coverage adequacy high-risk pairing {pairing_id} must define axisValues")
        for axis_id, value in axis_value_map.items():
            value_id = str(value)
            if axis_id not in axis_values or value_id not in axis_values[axis_id]:
                raise AssertionError(f"coverage adequacy high-risk pairing {pairing_id} references unknown axis value: {axis_id}={value_id}")
        pairing_scenarios = pairing["scenarioIds"]
        if not isinstance(pairing_scenarios, list) or not pairing_scenarios:
            raise AssertionError(f"coverage adequacy high-risk pairing {pairing_id} must list scenarioIds")
        for scenario_id in pairing_scenarios:
            if str(scenario_id) not in scenario_ids:
                raise AssertionError(f"coverage adequacy high-risk pairing {pairing_id} references unknown scenario: {scenario_id}")


def validate_default_policy_for_strict(default_policy: dict[str, Any], matrix_policy: dict[str, Any]) -> None:
    coverage = default_policy.get("scenarioCoverage")
    if not isinstance(coverage, dict):
        raise AssertionError("default student loop policy must define scenarioCoverage")
    required = {
        str(evidence)
        for scenario in matrix_policy["scenarios"]
        for evidence in scenario.get("requiredEvidence", [])
    }
    missing = sorted(required - set(coverage))
    if missing:
        raise AssertionError(f"default student loop policy coverage missing strict evidence keys: {missing}")


def utc_timestamp_id() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def allocate_timestamp_id(root: Path) -> str:
    while True:
        candidate = utc_timestamp_id()
        if not (root / candidate).exists():
            return candidate
        time.sleep(1.05)


def run_matrix(*, selected_scenario_id: str | None = None) -> dict[str, Any]:
    matrix_policy = load_json(MATRIX_POLICY_PATH)
    default_policy = load_json(DEFAULT_POLICY_PATH)
    validate_matrix_policy(matrix_policy)
    validate_default_policy_for_strict(default_policy, matrix_policy)

    matrix_run_id = allocate_timestamp_id(MATRIX_RUNS_ROOT)
    matrix_run_root = MATRIX_RUNS_ROOT / matrix_run_id
    matrix_run_root.mkdir(parents=True, exist_ok=True)

    scenarios = matrix_policy["scenarios"]
    if selected_scenario_id:
        scenarios = [scenario for scenario in scenarios if scenario["id"] == selected_scenario_id]
        if not scenarios:
            raise AssertionError(f"unknown strict matrix scenario: {selected_scenario_id}")

    scenario_results = []
    for scenario in scenarios:
        scenario_results.append(run_scenario(matrix_policy, matrix_run_root, scenario))

    summary = build_matrix_summary(matrix_policy, matrix_run_id, scenario_results, selected_scenario_id)
    summary_path = matrix_run_root / "summary.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"strict matrix summary: {summary_path}")
    return summary


def run_scenario(matrix_policy: dict[str, Any], matrix_run_root: Path, scenario: dict[str, Any]) -> dict[str, Any]:
    scenario_id = str(scenario["id"])
    run_id = allocate_timestamp_id(RUNS_ROOT)
    run_root = RUNS_ROOT / run_id
    scenario_log = matrix_run_root / f"{scenario_id}.log"

    env = {
        **os.environ,
        **{str(key): str(value) for key, value in scenario.get("env", {}).items()},
        "STUDENT_LOOP_RUN_ID": run_id,
        "STUDENT_LOOP_STRICT_SCENARIO_ID": scenario_id,
        "STUDENT_LOOP_COVERAGE_UNIVERSE_VERSION": str(matrix_policy["coverageUniverseVersion"]),
    }
    completed = subprocess.run(
        [sys.executable, str(STUDENT_LOOP_COMMAND)],
        cwd=REPO_ROOT,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    scenario_log.write_text(completed.stdout[-20000:], encoding="utf-8")

    report_path = run_root / "artifacts" / "report.json"
    report = load_report_if_present(report_path)
    result = evaluate_scenario_report(
        scenario=scenario,
        run_id=run_id,
        run_root=run_root,
        report_path=report_path,
        report=report,
        return_code=completed.returncode,
    )
    result["log_path"] = repo_relative_identity(scenario_log)
    return result


def load_report_if_present(report_path: Path) -> dict[str, Any] | None:
    if not report_path.exists():
        return None
    value = json.loads(report_path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise AssertionError(f"student loop report must be an object: {report_path}")
    return value


def evaluate_scenario_report(
    *,
    scenario: dict[str, Any],
    run_id: str,
    run_root: Path,
    report_path: Path,
    report: dict[str, Any] | None,
    return_code: int,
) -> dict[str, Any]:
    report_path_valid = report_path.resolve() == (run_root / "artifacts" / "report.json").resolve()
    report_path_under_runs = is_subpath(report_path, RUNS_ROOT)
    run_id_matches = bool(report and report.get("run", {}).get("run_id") == run_id)
    required_evidence = {}
    missing_required_evidence = []
    failed_findings = []
    failed_steps = []
    forbidden_terms_found: list[str] = []

    if report:
        coverage = report.get("scenario_coverage", {})
        for evidence_id in scenario["requiredEvidence"]:
            evidence_status = coverage.get(evidence_id, {}).get("status") if isinstance(coverage, dict) else None
            required_evidence[evidence_id] = evidence_status
            if evidence_status != "executed":
                missing_required_evidence.append(evidence_id)
        failed_findings = [
            finding
            for finding in report.get("findings", [])
            if isinstance(finding, dict) and finding.get("result") == "fail"
        ]
        failed_steps = [
            step
            for step in report.get("steps", [])
            if isinstance(step, dict) and step.get("status") == "failed"
        ]
        report_text = json.dumps(report, ensure_ascii=False)
        for term in load_json(DEFAULT_POLICY_PATH).get("forbiddenReportTerms", []):
            if str(term).lower() in report_text.lower():
                forbidden_terms_found.append(str(term))
    else:
        missing_required_evidence = list(scenario["requiredEvidence"])

    failure_reasons = []
    if return_code != 0:
        failure_reasons.append(f"student loop exited {return_code}")
    if not report:
        failure_reasons.append("missing student loop report")
    if not report_path_valid or not report_path_under_runs:
        failure_reasons.append("invalid report path")
    if not run_id_matches:
        failure_reasons.append("report run id does not match scenario run directory")
    if missing_required_evidence:
        failure_reasons.append("missing required evidence")
    if failed_findings:
        failure_reasons.append("failing oracle findings")
    if failed_steps:
        failure_reasons.append("failed student loop steps")
    if forbidden_terms_found:
        failure_reasons.append("forbidden terms found")

    return {
        "id": scenario["id"],
        "status": "passed" if not failure_reasons else "failed",
        "return_code": return_code,
        "run_id": run_id,
        "report_path": repo_relative_identity(report_path),
        "report_path_valid": report_path_valid,
        "report_path_under_runs": report_path_under_runs,
        "run_id_matches": run_id_matches,
        "required_evidence": required_evidence,
        "adequacy_axis_coverage": scenario.get("adequacyAxisCoverage", {}),
        "missing_required_evidence": missing_required_evidence,
        "failed_findings_count": len(failed_findings),
        "failure_categories": sorted({str(finding.get("category")) for finding in failed_findings}),
        "failed_steps_count": len(failed_steps),
        "forbidden_terms_found": sorted(set(forbidden_terms_found)),
        "failure_reasons": failure_reasons,
    }


def build_coverage_adequacy_summary(
    matrix_policy: dict[str, Any],
    scenario_results: list[dict[str, Any]],
    *,
    selected_scenario_id: str | None = None,
) -> dict[str, Any]:
    adequacy = matrix_policy["coverageAdequacy"]
    axes = adequacy["scenarioAxes"]
    axis_required_values = {
        str(axis["id"]): {str(value) for value in axis["requiredValues"]}
        for axis in axes
    }
    passed_results = {
        str(result["id"]): result
        for result in scenario_results
        if result.get("status") == "passed"
    }
    policy_scenarios = {str(scenario["id"]): scenario for scenario in matrix_policy["scenarios"]}
    covered: dict[str, dict[str, list[str]]] = {
        axis_id: {value: [] for value in sorted(values)}
        for axis_id, values in axis_required_values.items()
    }

    for scenario_id in passed_results:
        scenario = policy_scenarios.get(scenario_id)
        if not scenario:
            continue
        for axis_id, values in scenario.get("adequacyAxisCoverage", {}).items():
            for value in values:
                if axis_id in covered and value in covered[axis_id]:
                    covered[axis_id][value].append(scenario_id)

    exclusions = adequacy.get("exclusions", [])
    excluded_values: dict[str, dict[str, list[dict[str, Any]]]] = {
        axis_id: {}
        for axis_id in axis_required_values
    }
    unproved_exclusions = []
    for exclusion in exclusions:
        axis_id = str(exclusion.get("axis", ""))
        value = str(exclusion.get("value", ""))
        proof = str(exclusion.get("proof", "")).strip()
        if axis_id in excluded_values:
            excluded_values[axis_id].setdefault(value, []).append(exclusion)
        if not proof:
            unproved_exclusions.append(exclusion.get("id"))

    missing_axis_values = {}
    if not selected_scenario_id:
        for axis_id, values in axis_required_values.items():
            missing_values = []
            for value in sorted(values):
                if covered[axis_id][value] or excluded_values.get(axis_id, {}).get(value):
                    continue
                missing_values.append(value)
            if missing_values:
                missing_axis_values[axis_id] = missing_values

    high_risk_pairings = []
    missing_high_risk_pairings = []
    for pairing in adequacy.get("highRiskPairings", []):
        scenario_ids = [str(item) for item in pairing.get("scenarioIds", [])]
        covered_by = [scenario_id for scenario_id in scenario_ids if scenario_id in passed_results]
        status = "covered" if covered_by else "missing"
        if selected_scenario_id and selected_scenario_id not in scenario_ids:
            status = "not_evaluated_for_selected_scenario"
        elif status == "missing":
            missing_high_risk_pairings.append(str(pairing.get("id")))
        high_risk_pairings.append({
            "id": pairing.get("id"),
            "status": status,
            "axis_values": pairing.get("axisValues", {}),
            "scenario_ids": scenario_ids,
            "covered_by": covered_by,
        })

    failures = []
    if missing_axis_values:
        failures.append("missing required adequacy axis values")
    if missing_high_risk_pairings:
        failures.append("missing required high-risk pairings")
    if unproved_exclusions:
        failures.append("unproved coverage exclusions")

    return {
        "schema_version": "student_loop_coverage_adequacy.v1",
        "coverage_universe_version": matrix_policy["coverageUniverseVersion"],
        "scope": "selected_scenario" if selected_scenario_id else "full_matrix",
        "covered_axis_values": covered,
        "missing_axis_values": missing_axis_values,
        "excluded_axis_values": excluded_values,
        "high_risk_pairings": high_risk_pairings,
        "missing_high_risk_pairings": missing_high_risk_pairings,
        "unproved_exclusions": unproved_exclusions,
        "closure_claim_template": adequacy["closureClaimTemplate"],
        "residual_risk_statement": adequacy["residualRiskStatement"],
        "failures": failures,
    }


def build_matrix_summary(
    matrix_policy: dict[str, Any],
    matrix_run_id: str,
    scenario_results: list[dict[str, Any]],
    selected_scenario_id: str | None = None,
) -> dict[str, Any]:
    required_ids = {str(scenario["id"]) for scenario in matrix_policy["scenarios"] if scenario.get("required") is True}
    executed_ids = {str(result["id"]) for result in scenario_results}
    missing_required_scenarios = [] if selected_scenario_id else sorted(required_ids - executed_ids)
    failed_results = [result for result in scenario_results if result["status"] != "passed"]
    planned_required_scenarios = [
        str(scenario["id"])
        for scenario in matrix_policy["scenarios"]
        if scenario.get("required") is True and scenario.get("status") == "planned"
    ]
    forbidden_terms = sorted({
        term
        for result in scenario_results
        for term in result.get("forbidden_terms_found", [])
    })
    failed_findings_count = sum(int(result.get("failed_findings_count", 0)) for result in scenario_results)
    failed_steps_count = sum(int(result.get("failed_steps_count", 0)) for result in scenario_results)
    coverage_adequacy = build_coverage_adequacy_summary(
        matrix_policy,
        scenario_results,
        selected_scenario_id=selected_scenario_id,
    )
    summary_failures = []
    if failed_results:
        summary_failures.append("one or more strict scenarios failed")
    if missing_required_scenarios:
        summary_failures.append("required strict scenarios were not executed")
    if planned_required_scenarios:
        summary_failures.append("required strict scenarios cannot be planned")
    if forbidden_terms:
        summary_failures.append("forbidden evidence terms were found")
    if coverage_adequacy["failures"]:
        summary_failures.append("coverage adequacy failures were found")

    scenario_verification_eligible = not summary_failures and failed_findings_count == 0 and failed_steps_count == 0
    closure_eligible = bool(scenario_verification_eligible and not selected_scenario_id)
    stop_condition = "coverage_closure_achieved" if closure_eligible else "matrix_failed"
    if selected_scenario_id and scenario_verification_eligible:
        stop_condition = "selected_scenario_verified"
    return {
        "schema_version": "student_loop_matrix_summary.v1",
        "matrix_run_id": matrix_run_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "coverage_universe_version": matrix_policy["coverageUniverseVersion"],
        "selected_scenario_id": selected_scenario_id,
        "scenario_count": len(scenario_results),
        "required_scenario_count": len(required_ids) if not selected_scenario_id else len(scenario_results),
        "scenario_results": scenario_results,
        "missing_required_scenarios": missing_required_scenarios,
        "planned_required_scenarios": planned_required_scenarios,
        "failed_findings_count": failed_findings_count,
        "failed_steps_count": failed_steps_count,
        "forbidden_terms_found": forbidden_terms,
        "coverage_adequacy": coverage_adequacy,
        "summary_failures": summary_failures,
        "scenario_verification_eligible": scenario_verification_eligible,
        "closure_eligible": closure_eligible,
        "stop_condition": stop_condition,
    }


def run_until_clean() -> dict[str, Any]:
    matrix_policy = load_json(MATRIX_POLICY_PATH)
    validate_matrix_policy(matrix_policy)
    required_clean_cycles = int(matrix_policy["requiredCleanCycles"])
    max_matrix_cycles = int(matrix_policy["maxMatrixCycles"])
    clean_cycles = 0
    cycle_summaries = []

    for cycle_index in range(1, max_matrix_cycles + 1):
        summary = run_matrix()
        cycle_summaries.append({
            "cycle_index": cycle_index,
            "matrix_run_id": summary["matrix_run_id"],
            "closure_eligible": summary["closure_eligible"],
            "stop_condition": summary["stop_condition"],
            "summary_failures": summary["summary_failures"],
            "coverage_adequacy": summary["coverage_adequacy"],
        })
        if summary["closure_eligible"]:
            clean_cycles += 1
            if clean_cycles >= required_clean_cycles:
                return {
                    "stop_condition": "required_clean_cycles_reached",
                    "required_clean_cycles": required_clean_cycles,
                    "max_matrix_cycles": max_matrix_cycles,
                    "max_repair_iterations": matrix_policy["maxRepairIterations"],
                    "stop_on_high_risk": matrix_policy["stopOnHighRisk"],
                    "clean_cycles": clean_cycles,
                    "latest_matrix_summary": summary["matrix_run_id"],
                    "coverage_adequacy": summary["coverage_adequacy"],
                    "failed_scenario_reports": [],
                    "repair_ledger_entries": ".app/student-loop/repair-ledger.jsonl",
                    "remaining_risk": summary["coverage_adequacy"]["residual_risk_statement"],
                    "cycle_summaries": cycle_summaries,
                }
        else:
            clean_cycles = 0
            return {
                "stop_condition": "matrix_failed",
                "required_clean_cycles": required_clean_cycles,
                "max_matrix_cycles": max_matrix_cycles,
                "max_repair_iterations": matrix_policy["maxRepairIterations"],
                "stop_on_high_risk": matrix_policy["stopOnHighRisk"],
                "clean_cycles": clean_cycles,
                "latest_matrix_summary": summary["matrix_run_id"],
                "coverage_adequacy": summary["coverage_adequacy"],
                "failed_scenario_reports": [
                    result["report_path"]
                    for result in summary["scenario_results"]
                    if result["status"] != "passed"
                ],
                "repair_ledger_entries": ".app/student-loop/repair-ledger.jsonl",
                "remaining_risk": summary["coverage_adequacy"]["residual_risk_statement"],
                "cycle_summaries": cycle_summaries,
            }

    return {
        "stop_condition": "max_matrix_cycles_reached",
        "required_clean_cycles": required_clean_cycles,
        "max_matrix_cycles": max_matrix_cycles,
        "max_repair_iterations": matrix_policy["maxRepairIterations"],
        "stop_on_high_risk": matrix_policy["stopOnHighRisk"],
        "clean_cycles": clean_cycles,
        "latest_matrix_summary": cycle_summaries[-1]["matrix_run_id"] if cycle_summaries else None,
        "coverage_adequacy": cycle_summaries[-1]["coverage_adequacy"] if cycle_summaries else None,
        "failed_scenario_reports": [],
        "repair_ledger_entries": ".app/student-loop/repair-ledger.jsonl",
        "remaining_risk": "required clean cycle count was not reached",
        "cycle_summaries": cycle_summaries,
    }


def write_until_clean_summary(summary: dict[str, Any]) -> Path:
    run_id = allocate_timestamp_id(MATRIX_RUNS_ROOT)
    run_root = MATRIX_RUNS_ROOT / run_id
    run_root.mkdir(parents=True, exist_ok=True)
    path = run_root / "until-clean-summary.json"
    path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def repo_relative_identity(path: Path) -> dict[str, Any]:
    resolved = path.resolve()
    try:
        repo_relative = resolved.relative_to(REPO_ROOT.resolve()).as_posix()
    except ValueError:
        repo_relative = None
    return {
        "name": resolved.name,
        "parent_name": resolved.parent.name,
        "repo_relative": repo_relative,
        "exists": resolved.exists(),
    }


def is_subpath(path: Path, base: Path) -> bool:
    try:
        path.resolve().relative_to(base.resolve())
        return True
    except ValueError:
        return False


def run_self_test() -> None:
    matrix_policy = load_json(MATRIX_POLICY_PATH)
    default_policy = load_json(DEFAULT_POLICY_PATH)
    validate_matrix_policy(matrix_policy)
    validate_default_policy_for_strict(default_policy, matrix_policy)

    duplicate_policy = json.loads(json.dumps(matrix_policy))
    duplicate_policy["scenarios"][1]["id"] = duplicate_policy["scenarios"][0]["id"]
    assert_policy_fails(duplicate_policy, "duplicate")

    planned_policy = json.loads(json.dumps(matrix_policy))
    planned_policy["scenarios"][0]["status"] = "planned"
    assert_policy_fails(planned_policy, "planned")

    missing_metadata_policy = json.loads(json.dumps(matrix_policy))
    del missing_metadata_policy["scenarios"][0]["learnerState"]
    assert_policy_fails(missing_metadata_policy, "missing")

    missing_adequacy_policy = json.loads(json.dumps(matrix_policy))
    del missing_adequacy_policy["coverageAdequacy"]
    assert_policy_fails(missing_adequacy_policy, "coverageAdequacy")

    duplicate_axis_policy = json.loads(json.dumps(matrix_policy))
    duplicate_axis_policy["coverageAdequacy"]["scenarioAxes"][1]["id"] = duplicate_axis_policy["coverageAdequacy"]["scenarioAxes"][0]["id"]
    assert_policy_fails(duplicate_axis_policy, "duplicate axis")

    missing_axis_policy = json.loads(json.dumps(matrix_policy))
    del missing_axis_policy["scenarios"][0]["adequacyAxisCoverage"]["learner_progress_state"]
    assert_policy_fails(missing_axis_policy, "missing axis coverage")

    missing_pairing_policy = json.loads(json.dumps(matrix_policy))
    missing_pairing_policy["coverageAdequacy"]["highRiskPairings"][0]["scenarioIds"] = ["missing_scenario"]
    assert_policy_fails(missing_pairing_policy, "unknown scenario")

    invalid_exclusion_policy = json.loads(json.dumps(matrix_policy))
    invalid_exclusion_policy["coverageAdequacy"]["exclusions"] = [{
        "id": "missing-proof",
        "axis": "learner_progress_state",
        "value": "fresh",
        "rationale": "self test",
        "owner": "self test",
        "residualRisk": "self test",
    }]
    assert_policy_fails(invalid_exclusion_policy, "exclusion missing")

    invalid_clean_policy = json.loads(json.dumps(matrix_policy))
    invalid_clean_policy["requiredCleanCycles"] = 1
    assert_policy_fails(invalid_clean_policy, "at least 2")

    invalid_mode_policy = json.loads(json.dumps(matrix_policy))
    invalid_mode_policy["scenarios"][1]["env"]["STUDENT_LOOP_SCENARIO_MODE"] = "full"
    assert_policy_fails(invalid_mode_policy, "probe_only mode")
    print("strict matrix policy self-test passed")
    print("coverage adequacy self-test passed")

    scenario = matrix_policy["scenarios"][0]
    fake_run_id = "20260516T120000Z"
    fake_report = {
        "run": {"run_id": fake_run_id},
        "scenario_coverage": {
            evidence: {"status": "executed", "reason": "self test"}
            for evidence in scenario["requiredEvidence"]
        },
        "findings": [],
        "steps": [{"name": "open_app", "status": "passed"}],
    }
    fake_result = evaluate_scenario_report(
        scenario=scenario,
        run_id=fake_run_id,
        run_root=RUNS_ROOT / fake_run_id,
        report_path=RUNS_ROOT / fake_run_id / "artifacts" / "report.json",
        report=fake_report,
        return_code=0,
    )
    if fake_result["status"] != "passed":
        raise AssertionError(f"strict matrix summary self-test expected passed scenario: {fake_result}")
    missing_evidence_report = json.loads(json.dumps(fake_report))
    missing_evidence_report["scenario_coverage"][scenario["requiredEvidence"][0]]["status"] = "planned"
    missing_result = evaluate_scenario_report(
        scenario=scenario,
        run_id=fake_run_id,
        run_root=RUNS_ROOT / fake_run_id,
        report_path=RUNS_ROOT / fake_run_id / "artifacts" / "report.json",
        report=missing_evidence_report,
        return_code=0,
    )
    if missing_result["status"] != "failed" or not missing_result["missing_required_evidence"]:
        raise AssertionError("strict matrix summary self-test did not fail unexecuted required evidence")
    summary = build_matrix_summary(matrix_policy, "20260516T120100Z", [
        {
            **fake_result,
            "id": scenario["id"],
        }
        for scenario in matrix_policy["scenarios"]
    ])
    if not summary["closure_eligible"]:
        raise AssertionError("strict matrix summary self-test expected closure eligible summary")
    selected_summary = build_matrix_summary(matrix_policy, "20260516T120200Z", [fake_result], selected_scenario_id=str(scenario["id"]))
    if not selected_summary["scenario_verification_eligible"] or selected_summary["closure_eligible"]:
        raise AssertionError("selected strict scenario self-test expected targeted verification without closure eligibility")
    if selected_summary["stop_condition"] != "selected_scenario_verified":
        raise AssertionError("selected strict scenario self-test expected selected_scenario_verified stop condition")
    print("strict matrix summary self-test passed")

    if int(matrix_policy["requiredCleanCycles"]) < 2 or int(matrix_policy["maxMatrixCycles"]) < int(matrix_policy["requiredCleanCycles"]):
        raise AssertionError("until-clean bounds are invalid")
    print("until-clean bounds self-test passed")


def assert_policy_fails(policy: dict[str, Any], expected_text: str) -> None:
    try:
        validate_matrix_policy(policy)
    except AssertionError as error:
        if expected_text.lower() not in str(error).lower():
            raise AssertionError(f"policy failed for the wrong reason: {error}") from error
        return
    raise AssertionError("invalid strict matrix policy unexpectedly passed")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the strict student loop coverage matrix.")
    parser.add_argument("--self-test-policy", action="store_true", help="Validate strict policy and summary contracts without launching a browser.")
    parser.add_argument("--strict", action="store_true", help="Run the full strict coverage matrix once.")
    parser.add_argument("--until-clean", action="store_true", help="Run strict matrix cycles until the configured clean cycle count is reached.")
    parser.add_argument("--scenario", help="Run one strict scenario by id. Intended for targeted repair verification.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    if args.self_test_policy:
        run_self_test()
        return 0
    if args.until_clean:
        summary = run_until_clean()
        path = write_until_clean_summary(summary)
        print(f"until-clean summary: {path}")
        return 0 if summary["stop_condition"] == "required_clean_cycles_reached" else 1
    if args.strict or args.scenario:
        summary = run_matrix(selected_scenario_id=args.scenario)
        return 0 if summary["scenario_verification_eligible"] else 1
    raise SystemExit("choose --strict, --until-clean, --scenario, or --self-test-policy")


if __name__ == "__main__":
    raise SystemExit(main())
