import { describe, expect, it } from "vitest";
import { answerDiagnosticQuestion, getNextDiagnosticQuestion } from "../src/server/diagnostics.js";
import { createSession, getProgressSummary, postMessage } from "../src/server/services.js";
import { diagnosticHardCap } from "../src/server/diagnostic-strategy.js";
import { getCatalogDiagnosticsConcepts } from "../src/server/course-catalog.js";
import { selectExercise } from "../src/tools/exercise-tools.js";
import { getConceptMastery, getRecentLearningContext, getStudentProfile, recordLearningEvent, tagMistake, updateMastery } from "../src/tools/progress-tools.js";
import { createId, nowIso } from "../src/security/ids.js";
import { createTestRuntime } from "./utils/runtime.js";
import { diagnosticTutor, upsertMasteryFixture } from "./utils/content-fixtures.js";

describe("diagnostics and progress", () => {
  it("initializes a local profile through the first-use diagnostic flow", async () => {
    const runtime = await createTestRuntime({ tutor: diagnosticTutor() });
    const session = createSession(runtime, { resume: false });
    const next = await getNextDiagnosticQuestion(runtime, session.session_id);
    expect(next.completed).toBe(false);
    expect(next.question?.id).toBeTruthy();

    const answer = await answerDiagnosticQuestion(runtime, session.session_id, next.diagnostic_id, {
      question_id: next.question!.id,
      answer: { choice_id: "a" },
    });
    expect(answer.accepted).toBe(true);

    const progress = getProgressSummary(runtime);
    expect(progress.profile_summary).toContain("Python");
    expect(progress.mastery).toEqual([]);
  });

  it("starts without seeded diagnostic questions and asks the tutor to design one on demand", async () => {
    const runtime = await createTestRuntime({
      tutor: {
        generate: async () => JSON.stringify({
          prompt_md: "下面代码执行后会输出什么？\n```python\nx = 2\nprint(x + 3)\n```",
          choices: [
            { id: "a", text: "5" },
            { id: "b", text: "23" },
            { id: "c", text: "x + 3" },
          ],
          answer_choice_id: "a",
          difficulty: 1,
        }),
      },
    });
    const session = createSession(runtime, { resume: false });
    expect(runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM diagnostic_questions WHERE status = 'published'").get()?.count).toBe(0);

    const next = await getNextDiagnosticQuestion(runtime, session.session_id);

    expect(next.completed).toBe(false);
    expect(next.question?.prompt_md).toContain("x = 2");
    const generated = runtime.db.query<{ version: string; prompt_md: string }>("SELECT version, prompt_md FROM diagnostic_questions WHERE status = 'published' LIMIT 1").get();
    expect(generated).toMatchObject({ version: "agent-designed" });
    expect(generated?.prompt_md).not.toContain("下面哪段代码会输出 0 到 4");
  });

  it("keeps course progress at the diagnostic gate before a starting level is known", async () => {
    const runtime = await createTestRuntime({ tutor: diagnosticTutor() });
    const session = createSession(runtime, { resume: false });

    const initial = getProgressSummary(runtime);
    expect(initial.current_level).toBe("未诊断");
    expect(initial.course_progress_percent).toBe(0);
    expect(initial.current_chapter_title).toBe("初始测评");
    expect(initial.diagnostic).toMatchObject({ answered: 0, total: diagnosticHardCap(getCatalogDiagnosticsConcepts(runtime).length), completed: false });
    expect(initial.curriculum.map((chapter) => chapter.title)).toEqual([
      "入门与基础",
      "数据处理",
      "程序组织",
      "类与对象",
      "对象模型",
      "生成器",
      "进阶主题",
      "测试与调试",
      "包与工程化",
    ]);
    expect(initial.curriculum.map((chapter) => chapter.id)).toEqual([
      "introduction",
      "working-with-data",
      "program-organization",
      "classes-and-objects",
      "object-model",
      "generators",
      "advanced-topics",
      "testing-debugging",
      "packages",
    ]);
    expect(initial.curriculum.map((chapter) => chapter.id)).not.toContain("chapter_1");
    expect(initial.curriculum.map((chapter) => chapter.title)).not.toContain("KB 概念");
    expect(initial.curriculum.length).toBeGreaterThan(2);

    const next = await getNextDiagnosticQuestion(runtime, session.session_id);
    await answerDiagnosticQuestion(runtime, session.session_id, next.diagnostic_id, {
      question_id: next.question!.id,
      answer: { choice_id: "a" },
    });

    const afterOneAnswer = getProgressSummary(runtime);
    expect(afterOneAnswer.current_level).toBe("未诊断");
    expect(afterOneAnswer.course_progress_percent).toBe(0);
    expect(afterOneAnswer.current_chapter_title).toBe("初始测评");
    expect(afterOneAnswer.diagnostic).toMatchObject({ answered: 1, total: diagnosticHardCap(getCatalogDiagnosticsConcepts(runtime).length), completed: false });
  });

  it("does not let profile current level unlock diagnostic completion or exercises", async () => {
    const runtime = await createTestRuntime({ tutor: diagnosticTutor() });
    const session = createSession(runtime, { resume: false });
    runtime.db.query("UPDATE local_profile SET profile_json = ?, updated_at = ? WHERE id = 'local'").run([
      JSON.stringify({
        profile_summary: "Legacy profile says the learner has a level.",
        current_level: "初级",
        current_goal: "This must remain display-only.",
      }),
      nowIso(),
    ]);

    const profile = await getStudentProfile(runtime);
    const progress = getProgressSummary(runtime);
    const selected = await selectExercise(runtime, { concept_ids: ["loop"], difficulty: 2, mode: "practice" }, { sessionId: session.session_id });

    expect(profile.data.diagnostic_completed).toBe(false);
    expect(progress.current_level).toBe("未诊断");
    expect(progress.course_progress_percent).toBe(0);
    expect(progress.current_chapter_id).toBe("diagnostic");
    expect(selected).toMatchObject({ ok: false, code: "DIAGNOSTIC_REQUIRED" });
  });

  it("does not award course progress merely for completed placement", async () => {
    const runtime = await createTestRuntime({ tutor: diagnosticTutor() });
    const session = createSession(runtime, { resume: false });
    runtime.db.query(
      "INSERT INTO diagnostic_sessions(id, session_id, status, target_concepts_json, stop_reason, started_at, ended_at) VALUES (?, ?, 'completed', ?, 'test_complete', ?, ?)",
    ).run([createId("diag"), session.session_id, JSON.stringify(["loop"]), nowIso(), nowIso()]);

    const progress = getProgressSummary(runtime);

    expect(progress.diagnostic.completed).toBe(true);
    expect(progress.course_progress_percent).toBe(0);
  });

  it("closes diagnostics conservatively at the hard cap and keeps ordinary practice guidance-first", async () => {
    const runtime = await createTestRuntime({ tutor: diagnosticTutor() });
    const session = createSession(runtime, { resume: false });
    const first = await getNextDiagnosticQuestion(runtime, session.session_id);
    const diagnosticSession = runtime.db.query<{ id: string }>(
      "SELECT id FROM diagnostic_sessions WHERE session_id = ?",
    ).get([session.session_id]);
    expect(diagnosticSession?.id).toBeTruthy();
    const hardCap = diagnosticHardCap(getCatalogDiagnosticsConcepts(runtime).length);
    seedDiagnosticAttemptsAtCap(runtime, diagnosticSession!.id, session.session_id, hardCap);

    const next = await getNextDiagnosticQuestion(runtime, session.session_id);
    const row = runtime.db.query<{ status: string; stop_reason: string | null }>(
      "SELECT status, stop_reason FROM diagnostic_sessions WHERE id = ?",
    ).get([diagnosticSession!.id]);
    const selected = await selectExercise(runtime, { concept_ids: [first.question!.concept_ids[0]], difficulty: 1, mode: "practice" }, { sessionId: session.session_id });
    const progress = getProgressSummary(runtime, { sessionId: session.session_id });

    expect(next.completed).toBe(true);
    expect(next.question).toBeUndefined();
    expect(next.progress.estimated_remaining_min).toBe(0);
    expect(row).toMatchObject({ status: "completed", stop_reason: "hard_cap_reached_low_confidence" });
    expect(progress.progress_decision).toMatchObject({
      diagnostic_state: "completed",
      practice_state: "guidance_first",
    });
    expect(selected).toMatchObject({ ok: false, code: "DIAGNOSTIC_REQUIRED" });
  });

  it("maintains adaptive diagnostic concept state and continues after the first answer", async () => {
    const runtime = await createTestRuntime({ tutor: diagnosticTutor() });
    const session = createSession(runtime, { resume: false });

    const first = await getNextDiagnosticQuestion(runtime, session.session_id);
    expect(first.completed).toBe(false);
    expect(first.progress.total).toBe(diagnosticHardCap(getCatalogDiagnosticsConcepts(runtime).length));

    const diagnosticSession = runtime.db.query<{ id: string; status: string; target_concepts_json: string }>(
      "SELECT id, status, target_concepts_json FROM diagnostic_sessions WHERE session_id = ?",
    ).get([session.session_id]);
    expect(diagnosticSession).toMatchObject({ status: "active" });
    expect(JSON.parse(diagnosticSession?.target_concepts_json ?? "[]")).toHaveLength(getCatalogDiagnosticsConcepts(runtime).length);

    const states = runtime.db.query<{ concept_id: string; evidence_count: number; band: string }>(
      "SELECT concept_id, evidence_count, band FROM diagnostic_concept_state WHERE diagnostic_session_id = ?",
    ).all([diagnosticSession!.id]);
    expect(states).toHaveLength(getCatalogDiagnosticsConcepts(runtime).length);
    expect(states.every((state) => state.evidence_count === 0 && state.band === "unknown")).toBe(true);

    const generatedItem = runtime.db.query<{ concept_ids_json: string; prompt_md: string; answer_key_private_json: string; validation_status: string; schema_version: string }>(
      "SELECT concept_ids_json, prompt_md, answer_key_private_json, validation_status, schema_version FROM generated_items WHERE id = ?",
    ).get([first.question!.id]);
    expect(generatedItem).toMatchObject({ validation_status: "validated", schema_version: "generated_diagnostic_item.v1" });
    expect(generatedItem?.answer_key_private_json).toContain("choice");
    expect(generatedItem?.prompt_md).not.toContain(generatedItem?.answer_key_private_json ?? "answer");

    const answered = await answerDiagnosticQuestion(runtime, session.session_id, first.diagnostic_id, {
      question_id: first.question!.id,
      answer: { choice_id: "a" },
    });
    expect(answered.completed).toBe(false);

    const next = await getNextDiagnosticQuestion(runtime, session.session_id);
    expect(next.completed).toBe(false);
    expect(next.question?.id).not.toBe(first.question?.id);
    expect(next.question?.concept_ids[0]).not.toBe(first.question?.concept_ids[0]);

    const updatedState = runtime.db.query<{ evidence_count: number; confidence: number; band: string }>(
      "SELECT evidence_count, confidence, band FROM diagnostic_concept_state WHERE diagnostic_session_id = ? AND concept_id = ?",
    ).get([diagnosticSession!.id, first.question!.concept_ids[0]]);
    expect(updatedState?.evidence_count).toBe(1);
    expect(updatedState?.confidence).toBeGreaterThan(0);
    expect(updatedState?.band).not.toBe("unknown");
  });

  it("validates concept ids and computes mastery server-side", async () => {
    const runtime = await createTestRuntime();
    const session = createSession(runtime, { resume: false });
    const turn = await postMessage(runtime, session.session_id, { message: "帮我看循环", attachments: [] });
    const before = await getConceptMastery(runtime, { concept_ids: ["loop"] });
    expect(before.ok).toBe(true);
    expect(before.data.concepts[0]?.confidence).toBeNull();

    const event = await recordLearningEvent(runtime, {
      event_type: "debug_hint_given",
      concept_ids: ["loop"],
      evidence: { session_turn_id: turn.turn_id, summary: "定位 for 语句缺少冒号" },
    });
    expect(event.ok).toBe(true);

    const updated = await updateMastery(runtime, {
      turn_id: turn.turn_id,
      concept_ids: ["loop"],
      outcome: "completed_with_hint",
      difficulty: 2,
      hint_count: 1,
      evidence: { summary: "学生修复循环语法" },
    });
    expect(updated.ok).toBe(true);

    const after = await getConceptMastery(runtime, { concept_ids: ["loop"] });
    expect(after.data.concepts[0]?.mastery_level ?? 0).toBeGreaterThan(before.data.concepts[0]!.mastery_level ?? 0);
  });

  it("does not show inactive catalog concepts in weak learning context", async () => {
    const runtime = await createTestRuntime();
    upsertMasteryFixture(runtime, "loop", { mastery: 5, confidence: 0.9, readiness: 0, evidenceCount: 5, reviewPriority: 10 });
    runtime.db.query("UPDATE concepts SET catalog_status = 'inactive' WHERE id = 'loop'").run();

    const context = await getRecentLearningContext(runtime, { event_limit: 3 });

    expect(context.ok).toBe(true);
    expect(context.data.weak_concepts.map((concept) => concept.concept_id)).not.toContain("loop");
    expect(context.data.concept_mastery.map((concept) => concept.concept_id)).not.toContain("loop");
  });

  it("deduplicates learning events per turn without merging identical events from different turns", async () => {
    const runtime = await createTestRuntime();
    const session = createSession(runtime, { resume: false });
    const firstTurn = await postMessage(runtime, session.session_id, { message: "第一次调试循环", attachments: [] });
    const secondTurn = await postMessage(runtime, session.session_id, { message: "第二次调试循环", attachments: [] });

    const first = await recordLearningEvent(runtime, {
      event_type: "debug_hint_given",
      concept_ids: ["loop"],
      evidence: { session_turn_id: firstTurn.turn_id, summary: "定位 for 语句缺少冒号" },
    });
    const duplicateFirst = await recordLearningEvent(runtime, {
      event_type: "debug_hint_given",
      concept_ids: ["loop"],
      evidence: { session_turn_id: firstTurn.turn_id, summary: "定位 for 语句缺少冒号" },
    });
    const second = await recordLearningEvent(runtime, {
      event_type: "debug_hint_given",
      concept_ids: ["loop"],
      evidence: { session_turn_id: secondTurn.turn_id, summary: "定位 for 语句缺少冒号" },
    });

    expect(first.ok).toBe(true);
    expect(duplicateFirst.data.event_id).toBe(first.data.event_id);
    expect(second.ok).toBe(true);
    expect(second.data.event_id).not.toBe(first.data.event_id);
  });

  it("rejects unknown concept ids before reading mastery", async () => {
    const runtime = await createTestRuntime();
    await expect(getConceptMastery(runtime, { concept_ids: ["../../secrets"] })).resolves.toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
    });
    await expect(getConceptMastery(runtime, { concept_ids: [] })).resolves.toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
    });
    await expect(getRecentLearningContext(runtime, { event_limit: 99 })).resolves.toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects learning writes for turns that do not belong to a local session", async () => {
    const runtime = await createTestRuntime();
    await expect(recordLearningEvent(runtime, {
      event_type: "debug_hint_given",
      concept_ids: ["loop"],
      evidence: { session_turn_id: "turn_missing", summary: "不能写入不存在的 turn" },
    })).resolves.toMatchObject({
      ok: false,
      code: "SESSION_NOT_FOUND",
    });
    await expect(updateMastery(runtime, {
      turn_id: "turn_missing",
      concept_ids: ["loop"],
      outcome: "completed_with_hint",
      evidence: { summary: "不能用不存在的 turn 更新掌握度" },
    })).resolves.toMatchObject({
      ok: false,
      code: "SESSION_NOT_FOUND",
    });
  });

  it("validates mistake tag writes with schema and local allowlists", async () => {
    const runtime = await createTestRuntime();
    const session = createSession(runtime, { resume: false });
    const turn = await postMessage(runtime, session.session_id, { message: "我总是漏冒号", attachments: [] });
    const tag = runtime.db.query<{ id: string; metadata_json: string }>(
      "SELECT id, metadata_json FROM mistake_tags WHERE catalog_status = 'active' ORDER BY id ASC LIMIT 1",
    ).get();
    expect(tag?.id).toMatch(/^kb-/);
    expect(JSON.parse(tag?.metadata_json ?? "{}")).toMatchObject({ source_type: "mistake_tag" });

    await expect(tagMistake(runtime, {
      turn_id: turn.turn_id,
      concept_ids: ["loop"],
      mistake_tag_ids: [tag!.id],
      evidence: { summary: "for 语句末尾缺少冒号" },
      mastery_level: 100,
    })).resolves.toMatchObject({
      ok: true,
    });

    await expect(tagMistake(runtime, {
      turn_id: turn.turn_id,
      concept_ids: ["loop"],
      mistake_tag_ids: [],
      evidence: { summary: "空错因列表不能写入" },
    })).resolves.toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
    });
  });
});

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
  const existingQuestions = runtime.db.query<{ id: string; concept_ids_json: string }>(
    "SELECT id, concept_ids_json FROM generated_items WHERE diagnostic_session_id = ?",
  ).all([diagnosticSessionId]);
  for (const question of existingQuestions) {
    runtime.db.query(
      "INSERT OR IGNORE INTO diagnostic_attempts(id, question_id, session_id, answer_json, result_summary_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run([
      createId("diag"),
      question.id,
      sessionId,
      JSON.stringify({ choice_id: "b" }),
      JSON.stringify({ outcome: "incorrect", concept_ids: JSON.parse(question.concept_ids_json) }),
      now,
    ]);
  }
  for (let index = existingQuestions.length; index < count; index++) {
    const questionId = createId("diag");
    const conceptId = index === 0 ? "loop" : "variable";
    runtime.db.query(
      "INSERT INTO diagnostic_questions(id, concept_ids_json, question_type, prompt_md, choices_json, answer_key_ref, difficulty, status, version, created_at, updated_at) VALUES (?, ?, 'multiple_choice', ?, ?, 'answer:choice:a', 1, 'published', 'test', ?, ?)",
    ).run([
      questionId,
      JSON.stringify([conceptId]),
      `Question ${index}`,
      JSON.stringify([{ id: "a", text: "A" }]),
      now,
      now,
    ]);
    runtime.db.query(
      "INSERT INTO generated_items(id, diagnostic_session_id, concept_ids_json, item_type, prompt_md, choices_json, answer_key_private_json, rubric_private, difficulty, expected_evidence, validation_status, generator_model_version, generator_prompt_version, schema_version, created_at) VALUES (?, ?, ?, 'multiple_choice', ?, ?, ?, '', 1, 'recognition', 'validated', 'test', 'test', 'generated_diagnostic_item.v1', ?)",
    ).run([
      questionId,
      diagnosticSessionId,
      JSON.stringify([conceptId]),
      `Question ${index}`,
      JSON.stringify([{ id: "a", text: "A" }]),
      JSON.stringify({ choice: "a" }),
      now,
    ]);
    runtime.db.query(
      "INSERT INTO diagnostic_attempts(id, question_id, session_id, answer_json, result_summary_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run([
      createId("diag"),
      questionId,
      sessionId,
      JSON.stringify({ choice_id: "b" }),
      JSON.stringify({ outcome: "incorrect" }),
      now,
    ]);
  }
}
