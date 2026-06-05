import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const packagePath = join(repoRoot, "package.json");
const policyPath = join(repoRoot, "tests", "e2e", "student_loop_policy.json");
const matrixPolicyPath = join(repoRoot, "tests", "e2e", "student_loop_matrix_policy.json");
const discoveryPolicyPath = join(repoRoot, "tests", "e2e", "student_loop_discovery_policy.json");
const actorPolicyPath = join(repoRoot, "tests", "e2e", "student_loop_actor_policy.json");
const oracleLayerPolicyPath = join(repoRoot, "tests", "e2e", "student_loop_oracle_layers.json");
const discoveryPersonasPath = join(repoRoot, "tests", "e2e", "student_loop_personas.json");
const discoveryPromptCorpusPath = join(repoRoot, "tests", "e2e", "student_loop_prompt_corpus.json");
const runnerPath = join(repoRoot, "tests", "e2e", "student_loop.py");
const runnerCommandPath = join(repoRoot, "tests", "e2e", "run_student_loop.py");
const matrixRunnerPath = join(repoRoot, "tests", "e2e", "run_student_loop_matrix.py");
const discoveryRunnerPath = join(repoRoot, "tests", "e2e", "student_loop_discovery.py");
const discoveryCommandPath = join(repoRoot, "tests", "e2e", "run_student_loop_discovery.py");
const agenticPracticeRunnerPath = join(repoRoot, "tests", "e2e", "agentic_practice_verification.py");
const protocolPath = join(repoRoot, "docs", "student-loop-protocol.md");
const repairChecklistPath = join(repoRoot, "docs", "student-loop-repair-checklist.md");
const specPath = join(repoRoot, "openspec", "specs", "student-loop-protocol", "spec.md");
const tutorAgentSpecPath = join(repoRoot, "openspec", "specs", "kb-grounded-autonomous-tutor-agent", "spec.md");

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

describe("student loop protocol", () => {
  it("defines a strict machine-readable loop policy", () => {
    const policy = readJson(policyPath);

    expect(policy.allowedHosts).toEqual(["127.0.0.1"]);
    expect(policy.maxDiagnosticAnswers).toBe(56);
    expect(policy.maxRepairIterations).toBe(3);
    expect(policy.allowedDiagnosticStatuses).toEqual(
      expect.arrayContaining(["active", "technical_unavailable", "completed", "in_progress"]),
    );
    expect(policy.maxTechnicalUnavailableRetries).toBeGreaterThanOrEqual(1);
    expect(policy.allowedControlledApiErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "GET", path: "/api/exercises/next", statuses: [400, 409] }),
        expect.objectContaining({ method: "POST", path: "/api/projects", statuses: [400] }),
      ]),
    );
    expect(policy.allowedRequestFailures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "GET", path: "/api/sessions/{session_id}/events", failures: ["net::ERR_ABORTED"] }),
      ]),
    );
    expect(policy.forbiddenReportTerms).toEqual(
      expect.arrayContaining([
        ".env",
        "API key",
        "hidden tests",
        "private evaluators",
        "private solutions",
        "kb/private",
        ".git",
      ]),
    );
  });

  it("documents execution boundaries, canonical command, and repair gate", () => {
    const protocol = readFileSync(protocolPath, "utf8");

    expect(protocol).toContain("Student Loop Protocol");
    expect(protocol).toContain(".app/student-loop/runs/<run-id>/");
    expect(protocol).toContain("current run directory");
    expect(protocol).toContain("artifacts/");
    expect(protocol).toContain("data/");
    expect(protocol).toContain("STUDENT_LOOP_RUN_ID");
    expect(protocol).toContain("APP_DATA_DIR");
    expect(protocol).toContain("PROGRESS_DB_PATH");
    expect(protocol).toContain("STUDENT_LOOP_ARTIFACT_DIR");
    expect(protocol).toContain("127.0.0.1");
    expect(protocol).toContain("npm run test:student-loop");
    expect(protocol).toContain("runner must never edit source code");
    expect(protocol).toContain("one root cause per iteration");
    expect(protocol).toContain("finding");
    expect(protocol).toContain("minimal reproduction");
    expect(protocol).toContain("targeted verification");
    expect(protocol).toContain("repair ledger");
    expect(protocol).toContain("scenario_coverage");
    expect(protocol).toContain("executed");
    expect(protocol).toContain("planned");
    expect(protocol).toContain("not_applicable");
    expect(protocol).toContain("terminal-facing");
    expect(protocol).toContain("Strict Coverage Closure");
    expect(protocol).toContain("coverage universe");
    expect(protocol).toContain("npm run test:student-loop:strict");
    expect(protocol).toContain("npm run test:student-loop:until-clean");
    expect(protocol).toContain("closure applies only inside the declared coverage universe");
  });

  it("defines a concrete student-loop-protocol purpose and expanded repair checklist", () => {
    const spec = readFileSync(specPath, "utf8");
    const checklist = readFileSync(repairChecklistPath, "utf8");
    const purpose = spec.match(/## Purpose\s+([\s\S]*?)\n## Requirements/)?.[1] ?? "";

    expect(purpose).not.toContain("TBD");
    expect(purpose).toContain("browser-driven student journey loop");
    expect(checklist).toContain("Issue class");
    expect(checklist).toContain("Repair attempt count");
    expect(checklist).toContain("Repair ledger entry");
    expect(checklist).toContain("Student loop rerun report");
    expect(checklist).toContain("Strict scenario id");
    expect(checklist).toContain("Coverage universe version");
    expect(checklist).toContain("Failed matrix summary");
    expect(checklist).toContain("Full strict matrix rerun summary");
  });

  it("defines a concrete tutor-agent purpose and repair checklist fields for tutor-agent closure", () => {
    const spec = readFileSync(tutorAgentSpecPath, "utf8");
    const checklist = readFileSync(repairChecklistPath, "utf8");
    const purpose = spec.match(/## Purpose\s+([\s\S]*?)\n## Requirements/)?.[1] ?? "";

    expect(purpose).not.toContain("TBD");
    expect(purpose).toContain("KB-grounded autonomous post-diagnostic tutor agent");
    expect(purpose).toContain("persisted state");
    expect(purpose).toContain("bounded actions");
    expect(purpose).toContain("frontier validation");
    expect(purpose).toContain("guided-answer evidence");
    expect(purpose).toContain("recoverable learning progression");
    expect(checklist).toContain("Tutor-agent finding category");
    expect(checklist).toContain("Tutor-agent state id");
    expect(checklist).toContain("Tutor-agent action id");
    expect(checklist).toContain("Tutor-agent frontier snapshot id");
    expect(checklist).toContain("Current tutor-agent concept id");
    expect(checklist).toContain("Tutor-agent targeted rerun summaries");
  });

  it("exposes a portable local-only student loop command", () => {
    const pkg = readJson(packagePath);
    const scripts = pkg.scripts as Record<string, string>;
    const command = readFileSync(runnerCommandPath, "utf8");
    const protocol = readFileSync(protocolPath, "utf8");

    expect(scripts["test:student-loop:local"]).toBe("python tests/e2e/run_student_loop.py");
    expect(command).toContain("STUDENT_LOOP_RUN_ID");
    expect(command).toContain("APP_DATA_DIR");
    expect(command).toContain("PROGRESS_DB_PATH");
    expect(command).toContain("STUDENT_LOOP_ARTIFACT_DIR");
    expect(command).toContain("STUDENT_LOOP_EVIDENCE_MODE");
    expect(command).toContain("local_only");
    expect(command).toContain("npm");
    expect(command).toContain("start");
    expect(command).toContain("wait_for_http_ready");
    expect(command).toContain("urlopen");
    expect(command).toContain("server.poll");
    expect(command).toContain("server-startup.log");
    expect(command).toContain("tail_file_text");
    expect(protocol).toContain("npm run test:student-loop:local");
  });

  it("defines a strict coverage universe policy without planned required scenarios", () => {
    const matrixPolicy = readJson(matrixPolicyPath);
    const scenarios = matrixPolicy.scenarios as Array<Record<string, unknown>>;

    expect(matrixPolicy.coverageUniverseVersion).toBe("student-loop-strict.v2");
    expect(matrixPolicy.requiredCleanCycles).toBeGreaterThanOrEqual(2);
    expect(matrixPolicy.maxMatrixCycles).toBeGreaterThanOrEqual(matrixPolicy.requiredCleanCycles as number);
    expect(Array.isArray(scenarios)).toBe(true);
    expect(scenarios.length).toBeGreaterThanOrEqual(9);
    expect(new Set(scenarios.map((scenario) => scenario.id)).size).toBe(scenarios.length);
    expect(scenarios.map((scenario) => scenario.id)).toEqual(
      expect.arrayContaining([
        "default_full_journey",
        "completed_paths_fixture",
        "slow_network_behavior",
        "rate_limit_behavior",
        "partial_progress_states",
        "adversarial_input_profiles",
        "model_behavior_anomalies",
        "recovery_data_faults",
        "artifact_oracle_safety",
      ]),
    );
    for (const scenario of scenarios) {
      expect(scenario.required).toBe(true);
      expect(scenario.status).toBe("required");
      expect(scenario).toMatchObject({
        learnerState: expect.any(String),
        viewport: expect.any(String),
        networkCondition: expect.any(String),
        dataCondition: expect.any(String),
        faultMode: expect.any(String),
        expectedOutcome: expect.any(String),
      });
      expect(scenario).toHaveProperty("requiredEvidence");
      expect(scenario).toHaveProperty("adequacyAxisCoverage");
      expect(scenario.status).not.toBe("planned");
    }
  });

  it("defines a best-boundary coverage adequacy model and bounded closure wording", () => {
    const matrixPolicy = readJson(matrixPolicyPath);
    const adequacy = matrixPolicy.coverageAdequacy as Record<string, unknown>;
    const protocol = readFileSync(protocolPath, "utf8");
    const spec = readFileSync(specPath, "utf8");

    expect(adequacy).toMatchObject({
      schemaVersion: 1,
      minimumCleanCycles: expect.any(Number),
      closureClaimTemplate: expect.any(String),
      residualRiskStatement: expect.any(String),
    });
    expect(adequacy.minimumCleanCycles).toBeGreaterThanOrEqual(2);
    expect(adequacy.closureClaimTemplate).toContain("inside the declared coverage universe");
    expect(adequacy.closureClaimTemplate).not.toMatch(/no bugs exist|absolute absence/i);

    const axes = adequacy.scenarioAxes as Array<Record<string, unknown>>;
    expect(axes.map((axis) => axis.id)).toEqual(
      expect.arrayContaining([
        "learner_progress_state",
        "learner_input_profile",
        "model_behavior",
        "artifact_safety",
        "oracle_class",
      ]),
    );
    for (const axis of axes) {
      expect(axis).toMatchObject({ id: expect.any(String), requiredValues: expect.any(Array) });
      expect((axis.requiredValues as unknown[]).length).toBeGreaterThan(0);
    }

    expect(protocol).toContain("Best-Boundary Strict Coverage Closure");
    expect(protocol).toContain("coverage adequacy");
    expect(protocol).toContain("must not claim absolute absence of bugs");
    expect(spec).toContain("Best-boundary coverage adequacy");
    expect(spec).toContain("Expanded best-boundary strict scenarios");
  });

  it("exposes strict matrix and until-clean student loop commands as local-only repair gates", () => {
    const pkg = readJson(packagePath);
    const scripts = pkg.scripts as Record<string, string>;
    const matrixRunner = readFileSync(matrixRunnerPath, "utf8");

    expect(scripts["test:student-loop:strict"]).toBe("python tests/e2e/run_student_loop_matrix.py --strict");
    expect(scripts["test:student-loop:until-clean"]).toBe("python tests/e2e/run_student_loop_matrix.py --until-clean");
    expect(matrixRunner).toContain("student_loop_matrix_policy.json");
    expect(matrixRunner).toContain("matrix-runs");
    expect(matrixRunner).toContain("coverage_universe_version");
    expect(matrixRunner).toContain("closure_eligible");
    expect(matrixRunner).toContain("coverage_adequacy");
    expect(matrixRunner).toContain("missing_axis_values");
    expect(matrixRunner).toContain("high_risk_pairings");
    expect(matrixRunner).toContain("scenario_verification_eligible");
    expect(matrixRunner).not.toContain("run_student_loop_discovery");
    expect(matrixRunner).not.toContain("STUDENT_LOOP_LIVE_PROVIDER");
    expect(matrixRunner).not.toContain("STUDENT_LOOP_REALISTIC");
    expect(matrixRunner).not.toContain(".unlink(");
    expect(matrixRunner).not.toContain("shell=True");
  });

  it("exposes default live realistic, local-only, strict, release, and security command boundaries", () => {
    const pkg = readJson(packagePath);
    const scripts = pkg.scripts as Record<string, string>;
    const matrixRunner = readFileSync(matrixRunnerPath, "utf8");
    const discoveryCommand = readFileSync(discoveryCommandPath, "utf8");
    const discoveryRunner = readFileSync(discoveryRunnerPath, "utf8");
    const protocol = readFileSync(protocolPath, "utf8");

    expect(scripts["test:student-loop"]).toBe("python tests/e2e/run_student_loop_discovery.py --profile realistic");
    expect(scripts["test:student-loop:realistic"]).toBe("python tests/e2e/run_student_loop_discovery.py --profile realistic");
    expect(scripts["test:student-loop:realistic:until-clean"]).toBe("python tests/e2e/run_student_loop_discovery.py --profile realistic --until-clean");
    expect(scripts["test:student-loop:local"]).toBe("python tests/e2e/run_student_loop.py");
    expect(scripts["test:student-loop:strict"]).toBe("python tests/e2e/run_student_loop_matrix.py --strict");
    expect(scripts["test:student-loop:until-clean"]).toBe("python tests/e2e/run_student_loop_matrix.py --until-clean");
    expect(scripts["test:student-loop:discover"]).toBe("python tests/e2e/run_student_loop_discovery.py --profile realistic");
    expect(scripts["test:student-loop:discover:until-clean"]).toBe("python tests/e2e/run_student_loop_discovery.py --profile realistic --until-clean");
    expect(scripts["test:student-loop:live-provider"]).toBe("python tests/e2e/run_student_loop_discovery.py --live-provider");
    expect(scripts["test:student-loop:release"]).toBe("python tests/e2e/run_student_loop_discovery.py --profile release");
    expect(scripts["test:student-loop:security"]).toBe("python tests/e2e/run_student_loop_discovery.py --profile security");
    expect(scripts["test:student-loop:full-realistic"]).toBe(
      "python tests/e2e/run_student_loop_discovery.py --profile full_realistic_closure",
    );
    expect(scripts["test:student-loop:full-realistic:until-clean"]).toBe(
      "python tests/e2e/run_student_loop_discovery.py --profile full_realistic_closure --until-clean",
    );
    expect(scripts["test:student-loop:agentic-practice"]).toBe("python tests/e2e/agentic_practice_verification.py");
    expect(matrixRunner).not.toContain("run_student_loop_discovery");
    expect(matrixRunner).not.toContain("STUDENT_LOOP_LIVE_PROVIDER");
    expect(discoveryCommand).toContain("DISCOVERY_RUNS_ROOT");
    expect(discoveryCommand).toContain("STUDENT_LOOP_DISCOVERY_RUN_ID");
    expect(discoveryCommand).toContain("STUDENT_LOOP_REALISTIC_RUN_ID");
    expect(discoveryCommand).toContain("student_loop_actor_policy.json");
    expect(discoveryCommand).toContain("student_loop_oracle_layers.json");
    expect(discoveryCommand).toContain("server-startup.log");
    expect(discoveryRunner).toContain("student_loop_discovery_policy.json");
    expect(discoveryRunner).toContain("student_loop_personas.json");
    expect(discoveryRunner).toContain("student_loop_prompt_corpus.json");
    expect(discoveryRunner).toContain("build_tutor_agent_evidence");
    expect(discoveryRunner).toContain("compute_tutor_agent_axis_coverage");
    expect(discoveryRunner).toContain("missing_tutor_agent_state");
    expect(discoveryRunner).toContain("practice_without_validated_action");
    expect(discoveryRunner).toContain("ACTOR_POLICY_PATH");
    expect(discoveryRunner).toContain("ORACLE_LAYER_POLICY_PATH");
    expect(discoveryRunner).toContain("live_provider_configuration");
    expect(discoveryRunner).toContain("urlopen(request, timeout=profile_timeout_seconds(self.profile))");
    expect(discoveryRunner).toContain("is_allowed_request_failure");
    expect(protocol).toContain("npm run test:student-loop:discover");
    expect(protocol).toContain("npm run test:student-loop:live-provider");
    expect(protocol).toContain("Default Live Realistic Student Loop");
    expect(protocol).toContain("npm run test:student-loop:realistic");
    expect(protocol).toContain("npm run test:student-loop:realistic:until-clean");
    expect(protocol).toContain("npm run test:student-loop:full-realistic");
    expect(protocol).toContain("npm run test:student-loop:full-realistic:until-clean");
    expect(protocol).toContain("npm run test:student-loop:local");
  });

  it("exposes a targeted agentic practice verification gate with catalog-fresh fixtures and surface-aware evidence", () => {
    const runner = readFileSync(agenticPracticeRunnerPath, "utf8");

    expect(runner).toContain("def seed_completed_diagnostic_fixture");
    expect(runner).toContain("catalog_run_id");
    expect(runner).toContain("catalog_version");
    expect(runner).toContain("stale_completed_diagnostic_fixture");
    expect(runner).toContain(".locator(\"text=run_student_code\").first");
    expect(runner).toContain("practice_submission");
    expect(runner).toContain("intent_routes");
    expect(runner).toContain("/api/exercises/");
    expect(runner).toContain("/submissions");
    expect(runner).toContain("progress_effect");
    expect(runner).toContain("tutor_review");
    expect(runner).toContain("surface_aware_leak_checks");
    expect(runner).toContain("gate_identity");
    expect(runner).toContain("deterministic_mock_sandbox");
    expect(runner).toContain("release_gate");
  });

  it("defines a realistic live discovery policy, persona manifest, and prompt corpus", () => {
    const discoveryPolicy = readJson(discoveryPolicyPath);
    const personas = readJson(discoveryPersonasPath).personas as Array<Record<string, unknown>>;
    const corpus = readJson(discoveryPromptCorpusPath).prompts as Array<Record<string, unknown>>;

    expect(discoveryPolicy.discoveryUniverseVersion).toBe("student-loop-discovery.v1");
    expect(discoveryPolicy.defaultProfile).toBe("realistic");
    expect(discoveryPolicy.allowedArtifactRoots).toEqual(
      expect.arrayContaining([".app/student-loop/runs", ".app/student-loop/discovery-runs"]),
    );
    expect(discoveryPolicy.requiredCleanSweeps).toBeGreaterThanOrEqual(2);
    expect(discoveryPolicy.maxDiscoverySweeps).toBeGreaterThanOrEqual(discoveryPolicy.requiredCleanSweeps as number);
    expect(discoveryPolicy.stopOnHighRisk).toBe(true);
    expect(discoveryPolicy.gateProfiles).toMatchObject({
      discovery: expect.objectContaining({ liveProvider: false }),
      local: expect.objectContaining({ liveProvider: false }),
      realistic: expect.objectContaining({
        liveProvider: true,
        actorPolicy: "student_loop_actor_policy.json",
        oracleLayerPolicy: "student_loop_oracle_layers.json",
        requireNonFallbackTutorEvidence: true,
      }),
      full_realistic_closure: expect.objectContaining({
        liveProvider: true,
        evidenceMode: "live_full_realistic_closure",
        actorPolicy: "student_loop_actor_policy.json",
        oracleLayerPolicy: "student_loop_oracle_layers.json",
        requireNonFallbackTutorEvidence: true,
        requirePromptCorpusCoverage: true,
        requireOracleLayerCoverage: true,
        stopConditionClean: "full_realistic_clean_sweep",
        stopConditionRepairRequired: "repair_required",
        stopConditionNotClosable: "not_closable",
      }),
      live_provider: expect.objectContaining({ liveProvider: true, optInEnv: "STUDENT_LOOP_LIVE_PROVIDER" }),
      release: expect.objectContaining({ liveProvider: true }),
      security: expect.objectContaining({ liveProvider: true }),
    });
    expect(discoveryPolicy.issueClustering).toMatchObject({
      fingerprintFields: expect.arrayContaining(["finding_layer", "actor_action_id", "journey_action", "oracle_class", "persona_id"]),
    });

    expect(personas.length).toBeGreaterThanOrEqual(5);
    expect(new Set(personas.map((persona) => persona.id)).size).toBe(personas.length);
    for (const persona of personas) {
      expect(persona).toMatchObject({
        id: expect.any(String),
        required: true,
        learnerLevel: expect.any(String),
        goals: expect.any(Array),
        likelyMistakes: expect.any(Array),
        inputProfileTags: expect.any(Array),
        actionBudget: expect.any(Number),
        stopConditions: expect.any(Array),
      });
    }

    expect(corpus.length).toBeGreaterThanOrEqual(8);
    expect(new Set(corpus.map((prompt) => prompt.id)).size).toBe(corpus.length);
    for (const prompt of corpus) {
      expect(prompt).toMatchObject({
        id: expect.any(String),
        tags: expect.any(Array),
        language: expect.any(String),
        personaApplicability: expect.any(Array),
        riskLabels: expect.any(Array),
        expectedOracleProperties: expect.any(Array),
        maxChars: expect.any(Number),
        text: expect.any(String),
      });
      expect(JSON.stringify(prompt)).not.toMatch(/API key|hidden tests|private evaluators|private solutions|kb\/private|\.git/i);
    }

    const realisticProfile = (discoveryPolicy.gateProfiles as Record<string, Record<string, unknown>>).realistic;
    if (!realisticProfile) {
      throw new Error("realistic profile is missing");
    }
    const realisticPersonas = new Set(realisticProfile.requiredPersonas as string[]);
    const realisticPromptTags = new Set<string>();
    for (const prompt of corpus) {
      const appliesToRealistic = (prompt.personaApplicability as string[]).some((personaId) =>
        realisticPersonas.has(personaId),
      );
      if (appliesToRealistic) {
        for (const tag of prompt.tags as string[]) {
          realisticPromptTags.add(tag);
        }
      }
    }
    const missingRealisticPromptTags = (realisticProfile.requiredPromptTags as string[]).filter(
      (tag) => !realisticPromptTags.has(tag),
    );
    expect(missingRealisticPromptTags).toEqual([]);

    const fullProfile = (discoveryPolicy.gateProfiles as Record<string, Record<string, unknown>>).full_realistic_closure;
    if (!fullProfile) {
      throw new Error("full_realistic_closure profile is missing");
    }
    const personaIds = personas.map((persona) => persona.id);
    const promptIds = corpus.map((prompt) => prompt.id);
    const promptTags = [...new Set(corpus.flatMap((prompt) => prompt.tags as string[]))].sort();
    expect(fullProfile.requiredPersonas).toEqual(personaIds);
    expect(fullProfile.requiredPromptIds).toEqual(promptIds);
    expect([...(fullProfile.requiredPromptTags as string[])].sort()).toEqual(promptTags);
    expect(fullProfile.requiredMutationIds).toEqual(discoveryPolicy.mutationIds);
    expect(fullProfile.requiredJourneyStates).toEqual(
      expect.arrayContaining([
        "first_load",
        "diagnostic_probe",
        "guidance_start",
        "tutor_agent_concept_explanation",
        "guided_question",
        "guided_answer",
        "exercise_submission",
        "progress_query",
        "ask_concept",
        "ask_debugging",
        "practice_request",
        "project_request",
        "follow_up",
        "refresh_recovery",
        "back_navigation",
        "prompt_injection_probe",
        "hidden_answer_probe",
        "system_prompt_probe",
        "export_check",
      ]),
    );
  });

  it("requires full-realistic tutor-agent coverage axes and closure evidence", () => {
    const discoveryPolicy = readJson(discoveryPolicyPath);
    const fullProfile = (discoveryPolicy.gateProfiles as Record<string, Record<string, unknown>>).full_realistic_closure;
    if (!fullProfile) {
      throw new Error("full_realistic_closure profile is missing");
    }
    const tutorAgentCoverage = fullProfile.tutorAgentCoverage as Record<string, unknown>;
    const axes = tutorAgentCoverage.axes as Array<Record<string, unknown>>;
    const axisMap = new Map(axes.map((axis) => [axis.id, axis.requiredValues]));

    expect(tutorAgentCoverage).toMatchObject({
      universeVersion: "tutor-agent-full-realistic.v1",
      requireExecutedCoverage: true,
      blockPlannedCoverage: true,
      residualRiskStatement: expect.stringContaining("tutor-agent"),
    });
    expect(axisMap.get("tutor_agent_state")).toEqual(
      expect.arrayContaining([
        "not_started",
        "guidance_started",
        "accepted_action",
        "rejected_action",
        "agent_practice_ready",
        "guided_answer_judged",
        "refresh_recovered",
        "stale_paused",
      ]),
    );
    expect(axisMap.get("learning_strategy_order")).toEqual(
      expect.arrayContaining([
        "diagnostic_first",
        "guidance_before_practice",
        "concept_explain_before_practice",
        "guided_question_before_progression",
        "practice_updates_progress",
        "frontier_blocks_skip",
      ]),
    );
    expect(axisMap.get("ui_consistency_surface")).toEqual(
      expect.arrayContaining([
        "chat_messages",
        "diagnostic_card",
        "guidance_action",
        "current_concept_strip",
        "practice_card",
        "progress_header",
        "snapshot_restore",
      ]),
    );
    expect(fullProfile.requiredTutorAgentSummaryFields).toEqual(
      expect.arrayContaining([
        "universe_version",
        "state",
        "current_concept_id",
        "recent_actions",
        "frontier",
        "latest_practice_outcome",
        "axis_coverage",
        "strategy_order",
        "ui_surface_checks",
      ]),
    );
    expect(fullProfile.blockingOracleCategories).toEqual(
      expect.arrayContaining([
        "missing_tutor_agent_state",
        "missing_tutor_agent_action",
        "missing_tutor_agent_frontier",
        "frontier_order_violation",
        "practice_without_validated_action",
        "agent_practice_attribution_missing",
        "high_impact_tool_after_rejected_action",
        "guided_answer_direct_mastery_mutation",
        "agent_refresh_duplication",
        "snapshot_progress_export_contradiction",
        "stale_catalog_progression",
        "sensitive_agent_artifact_leakage",
      ]),
    );
  });

  it("defines student actor action grammar, oracle layers, and realistic closure schema", () => {
    const actorPolicy = readJson(actorPolicyPath);
    const oracleLayerPolicy = readJson(oracleLayerPolicyPath);
    const allowedActions = actorPolicy.allowedActions as Array<Record<string, unknown>>;
    const layers = oracleLayerPolicy.layers as Array<Record<string, unknown>>;

    expect(actorPolicy.schemaVersion).toBe(1);
    expect(actorPolicy.actorPolicyVersion).toBe("student-loop-actor.v1");
    expect(allowedActions.map((action) => action.id)).toEqual(
      expect.arrayContaining([
        "ask_tutor",
        "answer_diagnostic",
        "click_guidance",
        "ask_concept",
        "answer_guided_question",
        "submit_exercise",
        "ask_progress",
        "type",
        "click",
        "refresh",
        "back",
        "request_practice",
        "request_project",
        "export_check",
        "retry",
        "stop",
      ]),
    );
    for (const action of allowedActions) {
      expect(action).toMatchObject({
        id: expect.any(String),
        executor: "playwright",
        maxPerJourney: expect.any(Number),
      });
      expect(action).toHaveProperty("allowedTargets");
    }

    expect(actorPolicy.outputSchema).toMatchObject({
      requiredFields: expect.arrayContaining(["action_id", "rationale"]),
      maxRationaleChars: expect.any(Number),
      maxMessageChars: expect.any(Number),
    });
    expect(actorPolicy.modelBoundary).toMatchObject({
      defaultRole: "student_actor",
      mayDirectlyExecuteTools: false,
      mayAccessExternalNetwork: false,
      mayEditFiles: false,
      mayRunShell: false,
    });

    expect(oracleLayerPolicy.schemaVersion).toBe(1);
    expect(oracleLayerPolicy.oracleLayerPolicyVersion).toBe("student-loop-oracle-layers.v1");
    expect(layers.map((layer) => layer.id)).toEqual(
      expect.arrayContaining([
        "frontend_display",
        "learner_workflow",
        "business_logic",
        "model_response",
        "api_persistence",
        "security_safety",
        "performance_stability",
      ]),
    );
    for (const layer of layers) {
      expect(layer).toMatchObject({
        id: expect.any(String),
        blockingCategories: expect.any(Array),
        advisoryCategories: expect.any(Array),
      });
    }
    expect(oracleLayerPolicy.realisticSummaryRequiredFields).toEqual(
      expect.arrayContaining([
        "gate_kind",
        "live_mode",
        "provider_metadata",
        "actor_metadata",
        "oracle_layer_summary",
        "actor_action_coverage",
        "prompt_coverage",
        "mutation_coverage",
        "prompt_id_coverage",
        "oracle_layer_coverage",
        "full_realistic_closure",
        "tutor_agent_evidence",
        "tutor_agent_axis_coverage",
        "tutor_agent_issue_clusters",
        "issue_clusters",
        "exclusions",
        "residual_risk",
      ]),
    );
    expect(oracleLayerPolicy.categoryLayerOverrides).toMatchObject({
      missing_tutor_agent_state: "learner_workflow",
      missing_tutor_agent_frontier: "api_persistence",
      frontier_order_violation: "business_logic",
      practice_without_validated_action: "business_logic",
      high_impact_tool_after_rejected_action: "security_safety",
      tutor_agent_ui_overlap: "frontend_display",
    });
  });

  it("validates realistic discovery policy, live preflight, actor policy, and oracle layers without launching a browser", () => {
    const output = execFileSync("python", [discoveryCommandPath, "--self-test-policy"], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(output).toContain("discovery policy self-test passed");
    expect(output).toContain("persona manifest self-test passed");
    expect(output).toContain("prompt corpus self-test passed");
    expect(output).toContain("prompt mutation self-test passed");
    expect(output).toContain("live-provider preflight self-test passed");
    expect(output).toContain("realistic live preflight self-test passed");
    expect(output).toContain("full-realistic closure policy self-test passed");
    expect(output).toContain("student actor policy self-test passed");
    expect(output).toContain("actor action validation self-test passed");
    expect(output).toContain("oracle layer policy self-test passed");
    expect(output).toContain("issue clustering self-test passed");
    expect(output).toContain("tutor-agent full-realistic policy self-test passed");
  });

  it("requires full-realistic discovery to execute diagnostics before guidance and enforce ordered preconditions", () => {
    const discoveryRunner = readFileSync(discoveryRunnerPath, "utf8");

    expect(discoveryRunner).toContain("def complete_initial_diagnostic");
    expect(discoveryRunner).toContain("diagnostic_completion_evidence");
    expect(discoveryRunner).toContain("same_origin_diagnostic_fallback");
    expect(discoveryRunner).toContain("technical_unavailable_recovery");
    expect(discoveryRunner).toContain('status == "technical_unavailable" and not isinstance(question, dict)');
    expect(discoveryRunner).toContain("def require_journey_precondition");
    expect(discoveryRunner).toContain("diagnostic_completion_required_before_guidance");
    expect(discoveryRunner).toContain("first_missing_precondition");
    expect(discoveryRunner).toContain("DIAGNOSTIC_REQUIRED");
    expect(discoveryRunner).toContain("diagnostic_required_before_guidance");
  });

  it("requires full-realistic practice submission to use agent-created practice evidence", () => {
    const discoveryRunner = readFileSync(discoveryRunnerPath, "utf8");

    expect(discoveryRunner).toContain("def submit_agent_practice_exercise");
    expect(discoveryRunner).toContain("def retry_recovery");
    expect(discoveryRunner).toContain("def progress_query");
    expect(discoveryRunner).toContain("project_request_mode");
    expect(discoveryRunner).toContain("agent_created_practice_evidence");
    expect(discoveryRunner).toContain("grading_progress_consistency");
    expect(discoveryRunner).toContain("snapshot_export_progress_consistency");
    expect(discoveryRunner).not.toContain('return {"prompt": prompt_result, "exercise_api": summarize_payload(exercise)}');
  });

  it("requires tutor-agent coverage to be derived from bounded evidence, not event names alone", () => {
    const discoveryRunner = readFileSync(discoveryRunnerPath, "utf8");

    expect(discoveryRunner).toContain("ordered_journey_evidence");
    expect(discoveryRunner).toContain("progress_projection");
    expect(discoveryRunner).toContain("exported_actions");
    expect(discoveryRunner).toContain("guided_answer_judgement");
    expect(discoveryRunner).toContain("evidence_derived_tutor_agent_axis_coverage");
    expect(discoveryRunner).toContain("event_name_only_coverage_blocked");
    expect(discoveryRunner).toContain("coverage_probe_fallback_advisory");
    expect(discoveryRunner).toContain("post_core_fallback_advisory");
    expect(discoveryRunner).toContain("def is_post_core_fallback_advisory_action");
    expect(discoveryRunner).not.toContain('if "guided_answer" in event_names:\n            coverage["tutor_agent_state"].append("guided_answer_judged")');
    expect(discoveryRunner).not.toContain('coverage["learning_strategy_order"].extend(value for value, event in order_pairs.items() if event in event_names)');
  });

  it("requires state-dependent closure wording and early-stop coverage propagation", () => {
    const discoveryRunner = readFileSync(discoveryRunnerPath, "utf8");
    const discoveryCommand = readFileSync(discoveryCommandPath, "utf8");

    expect(discoveryRunner).toContain("closure_report_for_state");
    expect(discoveryRunner).toContain("closure_not_claimed");
    expect(discoveryRunner).toContain("bounded_claim");
    expect(discoveryCommand).toContain("coverage_from_persona_results");
    expect(discoveryCommand).toContain("failed_persona_coverage_gap");
    expect(discoveryCommand).toContain('summary = latest_summary(getattr(run_args, "latest_summary_path", None))');
    expect(discoveryCommand).toContain('if not result.get("issue_clean") or int(result.get("unclassified_failure_count", 0)) > 0');
    expect(discoveryCommand).toContain("server_startup_timeout_seconds");
    expect(discoveryCommand).toContain("STUDENT_LOOP_MODEL_RATE_LIMIT_MAX");
    expect(discoveryCommand).toContain("live_non_fallback_response_missing");
    expect(discoveryCommand).toContain("targeted_reruns_substitute_for_final_closure");
    expect(discoveryRunner).not.toContain('"claim": closure_claim_for_profile(self.policy, self.profile_id)');
    expect(discoveryRunner).not.toContain('"bounded_claim": bounded_claim_for_profile(self.profile_id)');
    expect(discoveryRunner).toContain("temporary_summary_path.replace(summary_path)");
  });

  it("requires full-realistic geometry oracle helpers and categories", () => {
    const discoveryRunner = readFileSync(discoveryRunnerPath, "utf8");
    const oracleLayerPolicy = readJson(oracleLayerPolicyPath);
    const frontendBlocking = ((oracleLayerPolicy.layers as Array<Record<string, unknown>>)
      .find((layer) => layer.id === "frontend_display")?.blockingCategories ?? []) as string[];

    expect(discoveryRunner).toContain("def collect_geometry_evidence");
    expect(discoveryRunner).toContain("def compute_geometry_findings");
    expect(discoveryRunner).toContain("layout_overflow");
    expect(discoveryRunner).toContain("text_overlap");
    expect(discoveryRunner).toContain("inaccessible_expected_control");
    expect(discoveryRunner).toContain("current_concept_display_missing");
    expect(discoveryRunner).toContain("stale_visual_state");
    expect(discoveryRunner).toContain("geometry oracle self-test passed");
    expect(frontendBlocking).toEqual(expect.arrayContaining(["layout_overflow", "text_overlap", "inaccessible_expected_control", "current_concept_display_missing"]));
  });

  it("separates repair iteration verification from final closure and accelerates synthetic scenarios", () => {
    const matrixPolicy = readJson(matrixPolicyPath);
    const scenarios = matrixPolicy.scenarios as Array<Record<string, unknown>>;
    const runner = readFileSync(runnerPath, "utf8");
    const protocol = readFileSync(protocolPath, "utf8");
    const checklist = readFileSync(repairChecklistPath, "utf8");
    const spec = readFileSync(specPath, "utf8");

    for (const scenario of scenarios) {
      const env = scenario.env as Record<string, string>;
      if (scenario.id === "default_full_journey") {
        expect(env.STUDENT_LOOP_SCENARIO_MODE ?? "full").toBe("full");
      } else {
        expect(env.STUDENT_LOOP_SCENARIO_MODE).toBe("probe_only");
      }
    }

    expect(runner).toContain("STUDENT_LOOP_SCENARIO_MODE");
    expect(runner).toContain("probe_only");
    expect(runner).toContain("scenario_mode");
    expect(protocol).toContain("Repair Iteration Gate");
    expect(protocol).toContain("Final Closure Gate");
    expect(protocol).toContain("probe-only");
    expect(protocol).toContain("Full strict matrix reruns are final closure evidence, not a required rerun after every repair iteration.");
    expect(checklist).toContain("Affected strict scenarios");
    expect(checklist).toContain("Final closure rerun status");
    expect(checklist).toContain("Discovery run id");
    expect(checklist).toContain("Issue cluster fingerprint");
    expect(checklist).toContain("Discovery seed");
    expect(checklist).toContain("Affected personas");
    expect(checklist).toContain("Final discovery closure status");
    expect(spec).toContain("affected strict scenarios");
    expect(spec).toContain("before claiming coverage closure");
    expect(spec).toContain("Persona-driven student journey discovery");
    expect(spec).toContain("Live-provider student loop gate");
  });

  it("keeps the existing smoke test independent from the student loop", () => {
    const smoke = readFileSync(join(repoRoot, "tests", "e2e", "smoke.py"), "utf8");

    expect(smoke).not.toContain("student_loop_policy");
    expect(smoke).not.toContain("StudentLoop");
    expect(smoke).not.toContain("STUDENT_LOOP_ARTIFACT_DIR");
  });

  it("validates runner policy parsing, local-only URLs, sanitization, and truncation", () => {
    const output = execFileSync("python", [runnerPath, "--self-test-policy"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        BASE_URL: "http://127.0.0.1:3100",
      },
    });

    expect(output).toContain("student loop policy self-test passed");
    expect(output).toContain("run identity self-test passed");
    expect(output).toContain("repair ledger self-test passed");
    expect(output).toContain("repair ledger path guard self-test passed");
    expect(output).toContain("controlled API payload code self-test passed");
  });

  it("validates strict matrix policy and summary contracts without launching a browser", () => {
    const output = execFileSync("python", [matrixRunnerPath, "--self-test-policy"], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(output).toContain("strict matrix policy self-test passed");
    expect(output).toContain("coverage adequacy self-test passed");
    expect(output).toContain("strict matrix summary self-test passed");
    expect(output).toContain("until-clean bounds self-test passed");
  });

  it("keeps the runner contract aligned with actionable failure evidence and artifact safety", () => {
    const runner = readFileSync(runnerPath, "utf8");
    const checklistMatch = runner.match(/"repair_checklist_fields": \[([\s\S]*?)\]/);
    const checklistFields = checklistMatch?.[1] ?? "";

    expect(runner).toContain("STUDENT_LOOP_RUN_ID");
    expect(runner).toContain("run_root");
    expect(runner).toContain("evidence_mode");
    expect(runner).toContain("diagnostic_attempts");
    expect(runner).toContain("selected_choice");
    expect(runner).toContain("submit_button");
    expect(runner).toContain("screenshot_notes");
    expect(runner).toContain("write_screenshot_note");
    expect(runner).toContain("sanitize_report_value");
    expect(runner).toContain("repair-ledger.jsonl");
    expect(runner).toContain("assert_snapshot_has_tutor_agent_state");
    expect(runner).toContain("assert_agent_practice_has_action_attribution");
    expect(runner).toContain("assert_progress_snapshot_export_consistency");
    expect(runner).toContain("issue_class");
    expect(runner).toContain("scenario_status");
    expect(runner).toContain("slow_network_behavior");
    expect(runner).toContain("rate_limit_behavior");
    expect(runner).toContain("partial_progress_states");
    expect(runner).toContain("adversarial_input_profiles");
    expect(runner).toContain("model_behavior_anomalies");
    expect(runner).toContain("recovery_data_faults");
    expect(runner).toContain("artifact_oracle_safety");
    expect(runner).toContain("STUDENT_LOOP_STRICT_SCENARIO_ID");
    expect(runner).toContain("STUDENT_LOOP_NETWORK_LATENCY_MS");
    expect(runner).toContain("STUDENT_LOOP_RATE_LIMIT_PROBE");
    expect(runner).toContain("STUDENT_LOOP_EXTRA_INPUT_PROBES");
    expect(runner).toContain("STUDENT_LOOP_MODEL_ANOMALY_PROBES");
    expect(checklistFields).toContain("issue_class");
    expect(checklistFields).toContain("repair_attempt_count");
    expect(checklistFields).toContain("repair_ledger_entry");
    expect(checklistFields).toContain("touched_files");
    expect(checklistFields).toContain("student_loop_report");
    expect(checklistFields).toContain("student_loop_rerun_report");
    expect(checklistFields).toContain("strict_scenario_id");
    expect(checklistFields).toContain("affected_strict_scenarios");
    expect(checklistFields).toContain("coverage_universe_version");
    expect(checklistFields).toContain("coverage_adequacy_summary");
    expect(checklistFields).toContain("axis_coverage_failure");
    expect(checklistFields).toContain("high_risk_pairing_status");
    expect(checklistFields).toContain("residual_risk_statement");
    expect(checklistFields).toContain("failed_matrix_summary");
    expect(checklistFields).toContain("affected_scenario_rerun_summaries");
    expect(checklistFields).toContain("final_closure_rerun_status");
    expect(checklistFields).toContain("full_strict_matrix_rerun_summary");
    expect(checklistFields).toContain("tutor_agent_finding_category");
    expect(checklistFields).toContain("tutor_agent_state_id");
    expect(checklistFields).toContain("tutor_agent_action_id");
    expect(checklistFields).toContain("tutor_agent_frontier_snapshot_id");
    expect(checklistFields).toContain("current_tutor_agent_concept_id");
    expect(checklistFields).toContain("tutor_agent_targeted_rerun_summaries");
    expect(runner).not.toContain(".unlink(");
  });

  it("does not target transient disabled diagnostic submit text", () => {
    const runner = readFileSync(runnerPath, "utf8");

    expect(runner).not.toContain("提交测评|提交中");
    expect(runner).toContain('get_by_role("button", name="提交测评")');
    expect(runner).toContain("choice did not become selected");
    expect(runner).toContain('get_attribute("aria-checked")');
    expect(runner).toContain("diagnostic UI did not become ready");
  });
});
