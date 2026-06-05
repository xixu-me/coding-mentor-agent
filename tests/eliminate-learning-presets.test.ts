import { describe, expect, it } from "vitest";
import { generateTutorResponse } from "../src/agent/respond.js";
import { deleteLocalLearningData } from "../src/server/data-management.js";
import { designDiagnosticQuestion } from "../src/server/diagnostic-designer.js";
import { getLatestCatalogRun } from "../src/server/course-catalog.js";
import { getNextDiagnosticQuestion } from "../src/server/diagnostics.js";
import { rankProgressRecommendations } from "../src/server/recommendations.js";
import { createSession, getProgressSummary } from "../src/server/services.js";
import { prepareModelContext } from "../src/server/context.js";
import { selectExercise } from "../src/tools/exercise-tools.js";
import { createProjectPlan } from "../src/tools/project-tools.js";
import { createId, nowIso } from "../src/security/ids.js";
import { createTestRuntime } from "./utils/runtime.js";

describe("eliminating learning presets", () => {
  it("does not seed mastery priors or preset goals during bootstrap, catalog sync, or reset", async () => {
    const runtime = await createTestRuntime();

    expect(countMasteryRows(runtime)).toBe(0);
    expect(profile(runtime).current_goal ?? null).toBeNull();
    expect(getProgressSummary(runtime).current_goal).toBeNull();

    const deleted = deleteLocalLearningData(runtime, { confirm: "DELETE_LOCAL_LEARNING_DATA" });

    expect(deleted.deleted.sessions).toBe(0);
    expect(countMasteryRows(runtime)).toBe(0);
    expect(profile(runtime).current_goal ?? null).toBeNull();
    expect(getProgressSummary(runtime).current_goal).toBeNull();
  });

  it("keeps projectionless active concepts unknown instead of weak mastery defaults", async () => {
    const runtime = await createTestRuntime();

    const progress = getProgressSummary(runtime);
    const recommendations = rankProgressRecommendations(runtime, { limit: 3 });

    expect(progress.course_progress_percent).toBe(0);
    expect(progress.mastery).toEqual([]);
    expect(progress.weak_concepts).toEqual([]);
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0]?.reason).toContain("unknown");
    expect(JSON.stringify(recommendations)).not.toContain("0.3");
  });

  it("fails closed with a retryable diagnostic interruption when no authorized generated item exists", async () => {
    const runtime = await createTestRuntime();
    const session = createSession(runtime, { resume: false });

    await expect(designDiagnosticQuestion(runtime, "loop")).rejects.toMatchObject({
      code: "DIAGNOSTIC_GENERATION_UNAVAILABLE",
    });

    const next = await getNextDiagnosticQuestion(runtime, session.session_id);
    const diagnostic = runtime.db.query<{ status: string; stop_reason: string | null }>(
      "SELECT status, stop_reason FROM diagnostic_sessions WHERE session_id = ? ORDER BY started_at DESC LIMIT 1",
    ).get([session.session_id]);

    expect(next.completed).toBe(false);
    expect(next.question).toBeUndefined();
    expect(next.progress.diagnostic_status).toBe("technical_unavailable");
    expect(diagnostic).toMatchObject({
      status: "active",
      stop_reason: "diagnostic_generation_unavailable",
    });
  });

  it("does not create generated exercises from deterministic local templates", async () => {
    const runtime = await createTestRuntime();
    const session = createSession(runtime, { resume: false });
    completeInitialDiagnostic(runtime, session.session_id);
    markGuidanceStarted(runtime, session.session_id);

    const selected = await selectExercise(runtime, { concept_ids: ["loop"], difficulty: 2, mode: "practice" }, { sessionId: session.session_id });

    expect(selected).toMatchObject({
      ok: false,
      code: "EXERCISE_CONTENT_UNAVAILABLE",
    });
    expect(runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM generated_exercises").get()?.count).toBe(0);
    expect(runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM exercises WHERE status = 'generated_private'").get()?.count).toBe(0);
  });

  it("does not create project plans from a fixed local project template", async () => {
    const runtime = await createTestRuntime();

    const created = await createProjectPlan(runtime, { project_goal: "做一个猜数字游戏", preferred_difficulty: 2 });

    expect(created).toMatchObject({
      ok: false,
      code: "PROJECT_CONTENT_UNAVAILABLE",
    });
    expect(runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM project_plans").get()?.count).toBe(0);
  });

  it("does not inject generic context topics, mistake labels, goals, or canned tutor lessons", async () => {
    const runtime = await createTestRuntime();
    const session = createSession(runtime, { resume: false });
    seedBlankTurns(runtime, session.session_id, 5);

    const context = prepareModelContext(runtime, session.session_id, { message: "继续" });
    const summary = context.summary ?? "";

    expect(summary).toContain("context_compaction");
    expect(summary).not.toContain("Python 基础练习");
    expect(summary).not.toContain("继续观察常见错因");
    expect(summary).not.toContain("提高 Python 编程实践能力");
    await expect(generateTutorResponse(runtime, "解释 for 循环")).rejects.toMatchObject({
      code: "MODEL_UNAVAILABLE",
    });
  });
});

function countMasteryRows(runtime: Awaited<ReturnType<typeof createTestRuntime>>): number {
  return runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM concept_mastery").get()?.count ?? 0;
}

function profile(runtime: Awaited<ReturnType<typeof createTestRuntime>>): Record<string, unknown> {
  const row = runtime.db.query<{ profile_json: string }>("SELECT profile_json FROM local_profile WHERE id = 'local'").get();
  return JSON.parse(row?.profile_json ?? "{}") as Record<string, unknown>;
}

function completeInitialDiagnostic(runtime: Awaited<ReturnType<typeof createTestRuntime>>, sessionId: string): void {
  const now = nowIso();
  const catalogRun = getLatestCatalogRun(runtime);
  runtime.db.query(
    "INSERT INTO diagnostic_sessions(id, session_id, status, target_concepts_json, stop_reason, catalog_version, catalog_run_id, started_at, ended_at) VALUES (?, ?, 'completed', ?, 'test_complete', ?, ?, ?, ?)",
  ).run([createId("diag"), sessionId, JSON.stringify(["loop"]), catalogRun?.kb_version ?? runtime.config.kbVersion, catalogRun?.id ?? null, now, now]);
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

function seedBlankTurns(runtime: Awaited<ReturnType<typeof createTestRuntime>>, sessionId: string, count: number): void {
  const now = nowIso();
  for (let index = 0; index < count; index++) {
    runtime.db.query(
      "INSERT INTO session_turns(id, session_id, status, user_message_summary, assistant_message_summary, started_at, ended_at) VALUES (?, ?, 'done', '', '', ?, ?)",
    ).run([createId("turn"), sessionId, `${now}-${index}`, `${now}-${index}`]);
  }
}
