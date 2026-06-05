import { describe, expect, it } from "vitest";
import { gradeSubmission, selectExercise } from "../src/tools/exercise-tools.js";
import { createProjectPlan, recordProjectProgress, reviewProjectCode, submitProjectStep } from "../src/tools/project-tools.js";
import { createSession } from "../src/server/services.js";
import { getLatestCatalogRun } from "../src/server/course-catalog.js";
import { createId, nowIso } from "../src/security/ids.js";
import { createTestRuntime } from "./utils/runtime.js";
import { insertGeneratedExerciseFixture, insertProjectPlanFixture, upsertMasteryFixture } from "./utils/content-fixtures.js";

describe("exercise and project flows", () => {
  it("rejects session-scoped exercise generation before the initial diagnostic is complete", async () => {
    let sandboxRuns = 0;
    const runtime = await createTestRuntime({
      sandbox: {
        runPython: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", traceback: "", duration_ms: 1, truncated: false }),
        runPytest: async () => {
          sandboxRuns++;
          return { status: "passed", exit_code: 0, stdout: "", stderr: "", traceback: "", duration_ms: 1, truncated: false, test_results: [] };
        },
        lint: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", traceback: "", duration_ms: 1, truncated: false }),
      },
    });
    const session = createSession(runtime, { resume: false });

    const selected = await selectExercise(runtime, { concept_ids: ["loop"], difficulty: 2, mode: "practice" }, { sessionId: session.session_id });

    expect(selected).toMatchObject({
      ok: false,
      code: "DIAGNOSTIC_REQUIRED",
    });
    expect(sandboxRuns).toBe(0);
    expect(runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM generated_exercises").get()?.count).toBe(0);
  });

  it("rejects session-scoped exercise generation during guidance-first handoff", async () => {
    const runtime = await createTestRuntime({
      sandbox: {
        runPython: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", traceback: "", duration_ms: 1, truncated: false }),
        runPytest: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", traceback: "", duration_ms: 1, truncated: false, test_results: [] }),
        lint: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", traceback: "", duration_ms: 1, truncated: false }),
      },
    });
    const session = createSession(runtime, { resume: false });
    completeDiagnosticWithWeakConcept(runtime, session.session_id, "loop");
    insertGeneratedExerciseFixture(runtime, { conceptIds: ["loop"], difficulty: 2 });

    const selected = await selectExercise(runtime, { concept_ids: ["loop"], difficulty: 2, mode: "practice" }, { sessionId: session.session_id });

    expect(selected).toMatchObject({
      ok: false,
      code: "DIAGNOSTIC_REQUIRED",
    });
  });

  it("grades an existing generated exercise fixture with the private evaluator", async () => {
    let evaluatorSeenBySandbox = "";
    const runtime = await createTestRuntime({
      sandbox: {
        runPython: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", traceback: "", duration_ms: 1, truncated: false }),
        runPytest: async (request) => {
          evaluatorSeenBySandbox = request.public_tests;
          return {
            status: request.public_tests.includes("test_fixture_even_numbers") ? "passed" : "failed",
            exit_code: 0,
            stdout: "",
            stderr: "",
            traceback: "",
            duration_ms: 10,
            truncated: false,
            test_results: [{ name: "test_fixture_even_numbers", passed: true, message: "" }],
          };
        },
        lint: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", traceback: "", duration_ms: 1, truncated: false }),
      },
    });
    const fixture = insertGeneratedExerciseFixture(runtime, { conceptIds: ["loop"], difficulty: 2 });

    const selected = await selectExercise(runtime, { concept_ids: ["loop"], difficulty: 2, mode: "practice" });
    expect(selected).toMatchObject({
      ok: true,
      data: {
        exercise: {
          id: fixture.id,
          concept_ids: ["loop"],
          difficulty: 2,
        },
      },
    });
    expect(JSON.stringify(selected.data)).not.toContain("test_fixture_even_numbers");
    expect(JSON.stringify(selected.data)).not.toContain("evaluator_private");

    const generated = runtime.db.query<{
      id: string;
      evaluator_private_ref: string;
      evaluator_hash: string;
      validation_status: string;
      schema_version: string;
      sandbox_image_version: string;
      validation_report_json: string;
    }>("SELECT id, evaluator_private_ref, evaluator_hash, validation_status, schema_version, sandbox_image_version, validation_report_json FROM generated_exercises WHERE id = ?").get([fixture.id]);
    expect(generated).toMatchObject({
      id: fixture.id,
      validation_status: "validated",
      schema_version: "generated_exercise.v1",
      sandbox_image_version: "python:3.13-slim-bookworm",
    });
    expect(generated?.evaluator_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(generated?.validation_report_json ?? "{}")).toMatchObject({
      validation_status: "validated",
    });

    const privateEvaluator = runtime.db.query<{ evaluator_private: string }>(
      "SELECT evaluator_private FROM generated_exercise_evaluators WHERE generated_exercise_id = ?",
    ).get([fixture.id]);
    expect(privateEvaluator?.evaluator_private).toContain("test_fixture_even_numbers");

    const graded = await gradeSubmission(runtime, {
      exercise_id: fixture.id,
      code: "n=int(input())\nfor i in range(1,n+1):\n    if i%2==0: print(i)",
      hint_count: 0,
    });
    expect(graded.ok).toBe(true);
    expect(graded.data.status).toBe("passed");
    expect(graded.data.hidden_tests?.summary).toBe("");
    expect(evaluatorSeenBySandbox).toContain("test_fixture_even_numbers");
    expect(JSON.stringify(graded.data)).not.toContain("test_fixture_even_numbers");
    const evaluatorEvidence = runtime.db.query<{ summary_json: string }>(
      "SELECT summary_json FROM tool_evidence WHERE tool_name = ? ORDER BY created_at DESC LIMIT 1",
    ).get(["read_private_evaluator"]);
    const evaluatorPolicy = JSON.parse(evaluatorEvidence?.summary_json ?? "{}").policy;
    expect(evaluatorPolicy).toMatchObject({
      policy_group: "exercise_submission_tools",
      caller: "workflow",
      result_code: "allowed_success",
    });
    expect(evaluatorEvidence?.summary_json).not.toContain("test_fixture_even_numbers");
    const learningEvidence = runtime.db.query<{ source_type: string; concept_id: string; outcome: string; source_id: string; validity_state: string }>(
      "SELECT source_type, concept_id, outcome, source_id, validity_state FROM learning_evidence WHERE source_id = ?",
    ).all([graded.data.attempt_id]);
    expect(learningEvidence).toEqual([
      expect.objectContaining({
        source_type: "exercise",
        concept_id: "loop",
        outcome: "completed_independently",
        source_id: graded.data.attempt_id,
        validity_state: "valid",
      }),
    ]);
    const projected = runtime.db.query<{ mastery_level: number; readiness: number; evidence_count: number; last_evidence_at: string | null }>(
      "SELECT mastery_level, readiness, evidence_count, last_evidence_at FROM concept_mastery WHERE concept_id = 'loop'",
    ).get();
    expect(projected?.mastery_level).toBeGreaterThan(0);
    expect(projected?.readiness).toBeGreaterThan(0);
    expect(projected?.evidence_count).toBeGreaterThan(0);
    expect(projected?.last_evidence_at).toBeTruthy();
  });

  it("records failed exercise evidence without increasing readiness", async () => {
    const runtime = await createTestRuntime({
      sandbox: {
        runPython: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", traceback: "", duration_ms: 1, truncated: false }),
        runPytest: async (request) => {
          const isValidation = request.code.includes("range(1, n + 1)") || request.code.includes("BROKEN_GENERATED_SOLUTION");
          return {
            status: isValidation && !request.code.includes("BROKEN_GENERATED_SOLUTION") ? "passed" : "failed",
            exit_code: isValidation ? 0 : 1,
            stdout: "",
            stderr: "",
            traceback: "",
            duration_ms: 10,
            truncated: false,
            test_results: [{ name: "test_fixture_even_numbers", passed: isValidation, message: isValidation ? "" : "wrong output" }],
          };
        },
        lint: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", traceback: "", duration_ms: 1, truncated: false }),
      },
    });
    const fixture = insertGeneratedExerciseFixture(runtime, { conceptIds: ["loop"], difficulty: 2 });
    const before = runtime.db.query<{ readiness: number; mastery_level: number }>(
      "SELECT readiness, mastery_level FROM concept_mastery WHERE concept_id = 'loop'",
    ).get();

    const graded = await gradeSubmission(runtime, {
      exercise_id: fixture.id,
      code: "print('wrong')",
      hint_count: 1,
    });
    const after = runtime.db.query<{ readiness: number; mastery_level: number; review_priority: number }>(
      "SELECT readiness, mastery_level, review_priority FROM concept_mastery WHERE concept_id = 'loop'",
    ).get();

    expect(graded.data.status).toBe("failed");
    expect(after?.readiness).toBeLessThanOrEqual(before?.readiness ?? 0);
    expect(after?.mastery_level).toBeLessThanOrEqual(before?.mastery_level ?? 0);
    expect(after?.review_priority).toBeGreaterThanOrEqual(1);
  });

  it("rejects exercise concept ids outside the active catalog", async () => {
    const runtime = await createTestRuntime();

    const selected = await selectExercise(runtime, { concept_ids: ["not-in-current-catalog"], difficulty: 2, mode: "practice" });

    expect(selected).toMatchObject({
      ok: false,
      code: "CATALOG_CONCEPT_NOT_FOUND",
    });
    expect(runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM generated_exercises").get()?.count).toBe(0);
  });

  it("unlocks the first exercise from completed diagnostic weak concepts and starting difficulty", async () => {
    const runtime = await createTestRuntime({
      sandbox: {
        runPython: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", traceback: "", duration_ms: 1, truncated: false }),
        runPytest: async () => ({ status: "sandbox_error", exit_code: 1, stdout: "", stderr: "Docker daemon unavailable in test runtime", traceback: "", duration_ms: 1, truncated: false, test_results: [] }),
        lint: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", traceback: "", duration_ms: 1, truncated: false }),
      },
    });
    const session = createSession(runtime, { resume: false });
    completeDiagnosticWithWeakConcept(runtime, session.session_id, "variable");
    markGuidanceStarted(runtime, session.session_id);

    const selected = await selectExercise(runtime, {}, { sessionId: session.session_id });

    expect(selected).toMatchObject({ ok: false, code: "EXERCISE_CONTENT_UNAVAILABLE" });
  });

  it("returns unavailable instead of creating project plans from templates", async () => {
    const runtime = await createTestRuntime();
    const created = await createProjectPlan(runtime, { project_goal: "做一个猜数字游戏", preferred_difficulty: 2 });
    expect(created).toMatchObject({ ok: false, code: "PROJECT_CONTENT_UNAVAILABLE" });
    expect(runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM project_plans").get()?.count).toBe(0);
  });

  it("rejects project submissions when KB public tests are unavailable", async () => {
    let publicTests = "";
    const runtime = await createTestRuntime({
      sandbox: {
        runPython: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", traceback: "", duration_ms: 1, truncated: false }),
        runPytest: async (request) => {
          publicTests = request.public_tests;
          return {
            status: request.public_tests.includes("subprocess.run") && request.public_tests.includes("/work/main.py") ? "passed" : "failed",
            exit_code: request.public_tests.includes("subprocess.run") ? 0 : 1,
            stdout: "",
            stderr: "",
            traceback: "",
            duration_ms: 10,
            truncated: false,
            test_results: [],
          };
        },
        lint: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", traceback: "", duration_ms: 1, truncated: false }),
      },
    });
    const fixture = insertProjectPlanFixture(runtime);

    const submitted = await submitProjectStep(runtime, {
      project_plan_id: fixture.planId,
      project_step_id: fixture.activeStepId,
      code: "guess = int(input())\nprint('猜对了' if guess == 5 else '大了')",
      files: [],
    });

    expect(submitted).toMatchObject({ ok: false, code: "PROJECT_CONTENT_UNAVAILABLE" });
    expect(publicTests).toBe("");
  });

  it("rejects project steps that do not belong to the submitted plan", async () => {
    const runtime = await createTestRuntime();
    const first = insertProjectPlanFixture(runtime);
    const second = insertProjectPlanFixture(runtime);

    const rejected = await submitProjectStep(runtime, {
      project_plan_id: second.planId,
      project_step_id: first.activeStepId,
      code: "print('wrong plan')",
      files: [],
    });

    expect(rejected.ok).toBe(false);
    expect(rejected.code).toBe("FORBIDDEN");
  });

  it("reviews project submissions and records project progress through constrained tools", async () => {
    const runtime = await createTestRuntime({
      sandbox: {
        runPython: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", traceback: "", duration_ms: 1, truncated: false }),
        runPytest: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", traceback: "", duration_ms: 10, truncated: false, test_results: [] }),
        lint: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", traceback: "", duration_ms: 1, truncated: false }),
      },
    });
    const fixture = insertProjectPlanFixture(runtime);
    const submissionId = createId("psub");
    runtime.db.query(
      "INSERT INTO project_step_submissions(id, project_plan_id, project_step_id, code_hash, code_snapshot, status, review_summary_json, created_at) VALUES (?, ?, ?, 'fixture', ?, 'passed', ?, ?)",
    ).run([
      submissionId,
      fixture.planId,
      fixture.activeStepId,
      "guess = int(input())\nprint('猜对了')",
      JSON.stringify({ passed: true, message: "测试夹具提交通过。", concept_ids: ["loop"] }),
      nowIso(),
    ]);

    const reviewed = await reviewProjectCode(runtime, {
      project_plan_id: fixture.planId,
      project_step_id: fixture.activeStepId,
      submission_id: submissionId,
    });
    expect(reviewed.ok).toBe(true);
    expect(reviewed.data.message).toContain("测试夹具提交通过");
    expect(JSON.stringify(reviewed.data)).not.toContain("progress.db");

    const recorded = await recordProjectProgress(runtime, {
      project_plan_id: fixture.planId,
      project_step_id: fixture.activeStepId,
      submission_id: submissionId,
      status: "passed",
      summary: "完成第一步。",
      mastery_level: 100,
    });
    expect(recorded.ok).toBe(true);
    const event = runtime.db.query<{ event_type: string; payload_json: string }>(
      "SELECT event_type, payload_json FROM learning_events WHERE id = ?",
    ).get([recorded.data.event_id]);
    expect(event?.event_type).toBe("project_step_completed");
    expect(event?.payload_json).not.toContain("mastery_level");
  });
});

function completeDiagnosticWithWeakConcept(runtime: Awaited<ReturnType<typeof createTestRuntime>>, sessionId: string, conceptId: string): void {
  const now = nowIso();
  const catalogRun = getLatestCatalogRun(runtime);
  runtime.db.query(
    "INSERT INTO diagnostic_sessions(id, session_id, status, target_concepts_json, stop_reason, catalog_version, catalog_run_id, started_at, ended_at) VALUES (?, ?, 'completed', ?, 'test_complete', ?, ?, ?, ?)",
  ).run([createId("diag"), sessionId, JSON.stringify([conceptId]), catalogRun?.kb_version ?? runtime.config.kbVersion, catalogRun?.id ?? null, now, now]);
  runtime.db.query("UPDATE local_profile SET profile_json = ?, updated_at = ? WHERE id = 'local'").run([
    JSON.stringify({
      profile_summary: "Python 课程学习者，已完成初始测评。",
      current_level: "初学者",
      current_goal: "先巩固变量和表达式",
    }),
    now,
  ]);
  upsertMasteryFixture(runtime, conceptId, { mastery: 15, confidence: 0.82, readiness: 10, evidenceCount: 2, reviewPriority: 9 });
}

function markGuidanceStarted(runtime: Awaited<ReturnType<typeof createTestRuntime>>, sessionId: string): void {
  const now = nowIso();
  const turnId = createId("turn");
  runtime.db.transaction(() => {
    runtime.db.query("INSERT INTO session_turns(id, session_id, status, user_message_summary, code_ref, assistant_message_summary, started_at, ended_at) VALUES (?, ?, 'done', ?, NULL, NULL, ?, ?)").run([
      turnId,
      sessionId,
      "开始导师指导。",
      now,
      now,
    ]);
    runtime.db.query("INSERT INTO session_messages(id, session_id, turn_id, message_id, role, content_redacted_text, created_at) VALUES (?, ?, ?, ?, 'user', ?, ?)").run([
      createId("msg"),
      sessionId,
      turnId,
      createId("msg"),
      "开始导师指导。",
      now,
    ]);
  });
}
