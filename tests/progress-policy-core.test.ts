import { describe, expect, it } from "vitest";
import { answerDiagnosticQuestion, getNextDiagnosticQuestion } from "../src/server/diagnostics.js";
import { diagnosticHardCap } from "../src/server/diagnostic-strategy.js";
import { getCatalogDiagnosticsConcepts, getCatalogProgressPolicyInputMap, getLatestCatalogRun } from "../src/server/course-catalog.js";
import { prepareTurnModelContext } from "../src/server/context-management.js";
import { createSession, getProgressSummary, postMessage } from "../src/server/services.js";
import { recordEvidenceAndProject } from "../src/server/progress-policy.js";
import { selectExercise } from "../src/tools/exercise-tools.js";
import { getStudentProfile, updateMastery } from "../src/tools/progress-tools.js";
import { createId, nowIso } from "../src/security/ids.js";
import { createTestRuntime } from "./utils/runtime.js";
import { diagnosticTutor, upsertMasteryFixture } from "./utils/content-fixtures.js";

describe("hardened progress policy core", () => {
  it("does not apply duplicate evidence projection or projection audit twice", async () => {
    const runtime = await createTestRuntime({ tutor: diagnosticTutor() });
    const session = createSession(runtime, { resume: false });
    const turn = await postMessage(runtime, session.session_id, { message: "我完成了循环练习", attachments: [] });
    const evidence = {
      sourceType: "tutor_review" as const,
      sourceId: turn.turn_id,
      sessionId: session.session_id,
      turnId: turn.turn_id,
      conceptId: "loop",
      outcome: "completed_independently" as const,
      difficulty: 2,
      score: 100,
      evaluatorConfidence: 0.9,
      evidenceWeight: 1,
      summary: { summary: "学生独立完成循环练习" },
      audit: { toolCallId: `projection:${turn.turn_id}` },
    };

    const first = recordEvidenceAndProject(runtime, evidence);
    const afterFirst = masteryRow(runtime, "loop");
    const second = recordEvidenceAndProject(runtime, evidence);
    const afterSecond = masteryRow(runtime, "loop");

    expect(first.status).toBe("inserted");
    expect(second.status).toBe("duplicate");
    expect(runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM learning_evidence WHERE source_type = 'tutor_review' AND source_id = ? AND concept_id = 'loop'").get([turn.turn_id])?.count).toBe(1);
    expect(runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM tool_evidence WHERE tool_name = 'update_mastery_projection' AND tool_call_id = ?").get([`projection:${turn.turn_id}`])?.count).toBe(1);
    expect(afterSecond).toEqual(afterFirst);
  });

  it("creates diagnostic evidence before completed diagnostic projection and profile updates", async () => {
    const runtime = await createTestRuntime({ tutor: diagnosticTutor() });
    const session = createSession(runtime, { resume: false });
    await createReadyDiagnostic(runtime, session.session_id);

    const next = await getNextDiagnosticQuestion(runtime, session.session_id);
    const diagnostic = runtime.db.query<{ id: string; status: string }>(
      "SELECT id, status FROM diagnostic_sessions WHERE session_id = ? ORDER BY started_at DESC LIMIT 1",
    ).get([session.session_id]);
    const evidenceRows = runtime.db.query<{ concept_id: string; source_id: string }>(
      "SELECT concept_id, source_id FROM learning_evidence WHERE source_type = 'diagnostic' AND source_id = ? ORDER BY concept_id ASC",
    ).all([diagnostic!.id]);
    const profile = await getStudentProfile(runtime, { sessionId: session.session_id });

    expect(next.completed).toBe(true);
    expect(diagnostic).toMatchObject({ status: "completed" });
    expect(evidenceRows.length).toBeGreaterThan(0);
    expect(evidenceRows.map((row) => row.concept_id)).toContain("intro-python");
    expect(masteryRow(runtime, "intro-python").last_evidence_at).toBeTruthy();
    expect(profile.data.diagnostic_completed).toBe(true);
    expect(profile.data.current_level).not.toBe("未诊断");
  });

  it("returns deterministic diagnostic feedback only after completed diagnostic", async () => {
    const runtime = await createTestRuntime({ tutor: diagnosticTutor() });
    const session = createSession(runtime, { resume: false });

    const before = getProgressSummary(runtime, { sessionId: session.session_id });
    expect(before.diagnostic.completed).toBe(false);
    expect(before.diagnostic_feedback).toBeNull();

    await createReadyDiagnostic(runtime, session.session_id);
    await getNextDiagnosticQuestion(runtime, session.session_id);
    const after = getProgressSummary(runtime, { sessionId: session.session_id });

    expect(after.diagnostic.completed).toBe(true);
    expect(after.diagnostic_feedback).toMatchObject({
      performance_summary: expect.any(String),
      mastery_summary: expect.any(String),
      learning_start: after.diagnostic.leading_start_label ?? after.current_level,
    });
    expect(after.diagnostic_feedback?.performance_summary).not.toMatch(/\d+%|->/);
    expect(after.diagnostic_feedback?.mastery_summary).not.toMatch(/\d+%|->/);
  });

  it("keeps low-confidence diagnostic cap closure free of readiness-producing diagnostic evidence", async () => {
    const runtime = await createTestRuntime({ tutor: diagnosticTutor() });
    const session = createSession(runtime, { resume: false });
    const first = await getNextDiagnosticQuestion(runtime, session.session_id);
    const diagnostic = runtime.db.query<{ id: string }>("SELECT id FROM diagnostic_sessions WHERE session_id = ?").get([session.session_id]);
    seedDiagnosticAttemptsAtCap(runtime, diagnostic!.id, session.session_id, diagnosticHardCap(getCatalogDiagnosticsConcepts(runtime).length));

    const next = await getNextDiagnosticQuestion(runtime, session.session_id);
    const selected = await selectExercise(runtime, { concept_ids: [first.question!.concept_ids[0]], difficulty: 1, mode: "practice" }, { sessionId: session.session_id });

    expect(next.completed).toBe(true);
    expect(next.question).toBeUndefined();
    expect(next.progress.estimated_remaining_min).toBe(0);
    expect(selected).toMatchObject({ ok: false, code: "DIAGNOSTIC_REQUIRED" });
    expect(runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM learning_evidence WHERE source_type = 'diagnostic' AND source_id = ?").get([diagnostic!.id])?.count).toBe(0);
  });

  it("uses the same projection policy for tutor review and equivalent exercise evidence", async () => {
    const runtime = await createTestRuntime();
    const reviewSession = createSession(runtime, { resume: false });
    const exerciseSession = createSession(runtime, { resume: false });
    completeInitialDiagnostic(runtime, reviewSession.session_id);
    completeInitialDiagnostic(runtime, exerciseSession.session_id);
    const reviewTurn = await postMessage(runtime, reviewSession.session_id, { message: "我自己完成了循环题", attachments: [] });

    const reviewed = await updateMastery(runtime, {
      turn_id: reviewTurn.turn_id,
      concept_ids: ["loop"],
      outcome: "completed_independently",
      difficulty: 2,
      hint_count: 0,
      evidence: { summary: "独立完成" },
    });
    const reviewedProjection = masteryRow(runtime, "loop");
    runtime.db.query("DELETE FROM concept_mastery WHERE concept_id = 'loop'").run();
    recordEvidenceAndProject(runtime, {
      sourceType: "exercise",
      sourceId: createId("att"),
      sessionId: exerciseSession.session_id,
      conceptId: "loop",
      outcome: "completed_independently",
      difficulty: 2,
      score: 100,
      evidenceWeight: 1,
      summary: { status: "passed" },
      hintCount: 0,
      audit: false,
    });
    const gradedProjection = masteryRow(runtime, "loop");

    expect(reviewed.ok).toBe(true);
    expect(gradedProjection.mastery_level).toBe(reviewedProjection.mastery_level);
    expect(gradedProjection.readiness).toBe(reviewedProjection.readiness);
    expect(gradedProjection.confidence).toBe(reviewedProjection.confidence);
  });

  it("scopes progress, profile, and model context to the active session", async () => {
    const runtime = await createTestRuntime();
    const completed = createSession(runtime, { resume: false });
    completeInitialDiagnostic(runtime, completed.session_id);
    const active = createSession(runtime, { resume: false });
    const turnId = createId("turn");

    const activeProgress = getProgressSummary(runtime, { sessionId: active.session_id });
    const completedProgress = getProgressSummary(runtime, { sessionId: completed.session_id });
    const activeProfile = await getStudentProfile(runtime, { sessionId: active.session_id });
    const prepared = prepareTurnModelContext(runtime, active.session_id, turnId, { message: "继续学习", code: "" });
    const selected = await selectExercise(runtime, { concept_ids: ["loop"], difficulty: 1, mode: "practice" }, { sessionId: active.session_id });

    expect(completedProgress.diagnostic.completed).toBe(true);
    expect(activeProgress.diagnostic.completed).toBe(false);
    expect(activeProgress.course_progress_percent).toBe(0);
    expect(activeProfile.data.diagnostic_completed).toBe(false);
    expect(prepared.context.bundle?.server_attested_state.active_diagnostic?.completed).toBe(false);
    expect(selected).toMatchObject({ ok: false, code: "DIAGNOSTIC_REQUIRED" });
  });

  it("keeps concept explanation context separate from structured exercise generation", async () => {
    const runtime = await createTestRuntime();
    const session = createSession(runtime, { resume: false });
    completeInitialDiagnostic(runtime, session.session_id);

    const prepared = prepareTurnModelContext(runtime, session.session_id, createId("turn"), { message: "for 循环是什么？", code: "" });
    const serializedBundle = JSON.stringify(prepared.context.bundle);

    expect(prepared.route.intent).toBe("concept_explanation");
    expect(prepared.context.bundle?.task_contract).toEqual({
      kind: "concept_explanation",
      required_output: "explanation_example_mistake_next_step",
    });
    expect(serializedBundle).not.toContain("practice_source");
    expect(serializedBundle).not.toContain("generated_exercise_artifact");
  });

  it("ranks recommendations from graph and evidence signals instead of recommendation recency", async () => {
    const runtime = await createTestRuntime();
    const session = createSession(runtime, { resume: false });
    completeInitialDiagnostic(runtime, session.session_id);
    const now = nowIso();
    upsertMasteryFixture(runtime, "intro-python", { mastery: 5, readiness: 0, confidence: 0.9, evidenceCount: 4, reviewPriority: 9 });
    upsertMasteryFixture(runtime, "string", { mastery: 60, readiness: 50, confidence: 0.5, evidenceCount: 1, reviewPriority: 2 });
    runtime.db.query("INSERT INTO recommendations(id, recommendation_type, target_id, reason, status, created_at) VALUES (?, 'exercise', 'string', 'recent row must not dominate', 'shown', ?)").run([createId("rec"), now]);

    const policy = getCatalogProgressPolicyInputMap(runtime).get("intro-python");
    const progress = getProgressSummary(runtime, { sessionId: session.session_id });

    expect(policy?.prerequisite_blocker).toBe(true);
    expect(progress.recommendations[0]?.target_id).toBe("intro-python");
    expect(progress.recommendations[0]?.reason).toContain("prerequisite");
  });
});

function masteryRow(runtime: Awaited<ReturnType<typeof createTestRuntime>>, conceptId: string): {
  mastery_level: number;
  confidence: number;
  readiness: number;
  evidence_count: number;
  review_priority: number;
  last_evidence_at: string | null;
} {
  const row = runtime.db.query<{
    mastery_level: number;
    confidence: number;
    readiness: number;
    evidence_count: number;
    review_priority: number;
    last_evidence_at: string | null;
  }>("SELECT mastery_level, confidence, readiness, evidence_count, review_priority, last_evidence_at FROM concept_mastery WHERE concept_id = ?").get([conceptId]);
  if (!row) throw new Error(`Missing mastery row for ${conceptId}`);
  return row;
}

async function createReadyDiagnostic(runtime: Awaited<ReturnType<typeof createTestRuntime>>, sessionId: string): Promise<string> {
  await getNextDiagnosticQuestion(runtime, sessionId);
  const diagnostic = runtime.db.query<{ id: string }>("SELECT id FROM diagnostic_sessions WHERE session_id = ? ORDER BY started_at DESC LIMIT 1").get([sessionId]);
  if (!diagnostic) throw new Error("Missing diagnostic session");
  const now = nowIso();
  runtime.db.query(
    "UPDATE diagnostic_concept_state SET mastery = 82, confidence = 0.92, evidence_count = 2, uncertainty = 0.1, band = 'proficient', conflicting_evidence_count = 0, updated_at = ? WHERE diagnostic_session_id = ?",
  ).run([now, diagnostic.id]);
  seedDiagnosticAttempts(runtime, diagnostic.id, sessionId, 6, "correct");
  return diagnostic.id;
}

function completeInitialDiagnostic(runtime: Awaited<ReturnType<typeof createTestRuntime>>, sessionId: string): string {
  const now = nowIso();
  const id = createId("diag");
  const catalogRun = getLatestCatalogRun(runtime);
  runtime.db.query(
    "INSERT INTO diagnostic_sessions(id, session_id, status, target_concepts_json, stop_reason, catalog_version, catalog_run_id, started_at, ended_at) VALUES (?, ?, 'completed', ?, 'test_complete', ?, ?, ?, ?)",
  ).run([id, sessionId, JSON.stringify(["intro-python", "loop"]), catalogRun?.kb_version ?? runtime.config.kbVersion, catalogRun?.id ?? null, now, now]);
  runtime.db.query("UPDATE local_profile SET profile_json = ?, updated_at = ? WHERE id = 'local'").run([
    JSON.stringify({
      profile_summary: "Python 课程学习者，已完成初始测评。",
      current_level: "初学者",
      current_goal: "继续练习",
    }),
    now,
  ]);
  return id;
}

function seedDiagnosticAttemptsAtCap(
  runtime: Awaited<ReturnType<typeof createTestRuntime>>,
  diagnosticSessionId: string,
  sessionId: string,
  count: number,
): void {
  const now = nowIso();
  runtime.db.query(
    "UPDATE diagnostic_concept_state SET mastery = 0, confidence = 0, evidence_count = 0, uncertainty = 0.9, band = 'unknown', conflicting_evidence_count = 0 WHERE diagnostic_session_id = ?",
  ).run([diagnosticSessionId]);
  seedDiagnosticAttempts(runtime, diagnosticSessionId, sessionId, count, "incorrect", now);
}

function seedDiagnosticAttempts(
  runtime: Awaited<ReturnType<typeof createTestRuntime>>,
  diagnosticSessionId: string,
  sessionId: string,
  count: number,
  outcome: "correct" | "incorrect",
  createdAt = nowIso(),
): void {
  const conceptIds = getCatalogDiagnosticsConcepts(runtime).map((concept) => concept.id);
  for (let index = 0; index < count; index++) {
    const questionId = createId("diag");
    const conceptId = conceptIds[index % conceptIds.length] ?? "intro-python";
    runtime.db.query(
      "INSERT INTO diagnostic_questions(id, concept_ids_json, question_type, prompt_md, choices_json, answer_key_ref, difficulty, status, version, created_at, updated_at) VALUES (?, ?, 'multiple_choice', ?, ?, 'answer:choice:a', 1, 'published', 'test', ?, ?)",
    ).run([
      questionId,
      JSON.stringify([conceptId]),
      `Question ${index}`,
      JSON.stringify([{ id: "a", text: "A" }, { id: "b", text: "B" }]),
      createdAt,
      createdAt,
    ]);
    runtime.db.query(
      "INSERT INTO generated_items(id, diagnostic_session_id, concept_ids_json, item_type, prompt_md, choices_json, answer_key_private_json, rubric_private, difficulty, expected_evidence, validation_status, generator_model_version, generator_prompt_version, schema_version, created_at) VALUES (?, ?, ?, 'multiple_choice', ?, ?, ?, '', 1, 'recognition', 'validated', 'test', 'test', 'generated_diagnostic_item.v1', ?)",
    ).run([
      questionId,
      diagnosticSessionId,
      JSON.stringify([conceptId]),
      `Question ${index}`,
      JSON.stringify([{ id: "a", text: "A" }, { id: "b", text: "B" }]),
      JSON.stringify({ choice: "a" }),
      createdAt,
    ]);
    runtime.db.query(
      "INSERT INTO diagnostic_attempts(id, question_id, session_id, answer_json, result_summary_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run([
      createId("diag"),
      questionId,
      sessionId,
      JSON.stringify({ choice_id: outcome === "correct" ? "a" : "b" }),
      JSON.stringify({ outcome, concept_ids: [conceptId] }),
      createdAt,
    ]);
  }
}
