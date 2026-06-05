import { describe, expect, it } from "vitest";
import { answerDiagnosticQuestion, getNextDiagnosticQuestion } from "../src/server/diagnostics.js";
import { designDiagnosticQuestion } from "../src/server/diagnostic-designer.js";
import { createSession, getProgressSummary, postMessage } from "../src/server/services.js";
import { diagnosticHardCap } from "../src/server/diagnostic-strategy.js";
import { getCatalogDiagnosticsConcepts, getCatalogProgressPolicyInputMap } from "../src/server/course-catalog.js";
import { createId, nowIso } from "../src/security/ids.js";
import { createTestRuntime } from "./utils/runtime.js";
import { diagnosticTutor } from "./utils/content-fixtures.js";

describe("adaptive initial diagnostic", () => {
  it("reports dynamic placement progress fields and starts with a placement anchor", async () => {
    const runtime = await createTestRuntime({ tutor: diagnosticTutor() });
    const session = createSession(runtime, { resume: false });

    const next = await getNextDiagnosticQuestion(runtime, session.session_id);
    const summary = getProgressSummary(runtime);
    const hardCap = diagnosticHardCap(getCatalogDiagnosticsConcepts(runtime).length);

    expect(next.completed).toBe(false);
    expect(next.question?.concept_ids).toEqual([placementAnchorDiagnosticConcept(runtime)]);
    expect(next.progress).toMatchObject({
      answered: 0,
      total: hardCap,
      effective_answered: 0,
      min_questions: 3,
      min_effective_answers: 3,
      soft_cap: 16,
      hard_cap: hardCap,
      estimated_remaining_min: expect.any(Number),
      estimated_remaining_max: expect.any(Number),
      current_focus_concept_ids: [placementAnchorDiagnosticConcept(runtime)],
      completion_confidence: expect.any(Number),
      placement_confidence: expect.any(Number),
      leading_start_concept_id: expect.any(String),
    });
    expect(next.progress.estimated_remaining_min).toBeGreaterThan(0);
    expect(next.progress.estimated_remaining_max).toBeGreaterThanOrEqual(next.progress.estimated_remaining_min);
    expect(summary.diagnostic).toMatchObject({
      answered: 0,
      effective_answered: 0,
      min_questions: 3,
      min_effective_answers: 3,
      soft_cap: 16,
      hard_cap: hardCap,
      current_focus_concept_ids: [placementAnchorDiagnosticConcept(runtime)],
      completed: false,
    });
  });

  it("initializes diagnostic state only from manifest diagnostic scope", async () => {
    const runtime = await createTestRuntime({ tutor: diagnosticTutor() });
    const session = createSession(runtime, { resume: false });
    const diagnosticIds = getCatalogDiagnosticsConcepts(runtime).map((concept) => concept.id);

    expect(diagnosticIds).toContain("variable");
    expect(diagnosticIds).toContain("pytest");
    expect(diagnosticIds).not.toContain("generator");

    await getNextDiagnosticQuestion(runtime, session.session_id);
    const diagnosticSession = runtime.db.query<{ target_concepts_json: string; catalog_version: string }>(
      "SELECT target_concepts_json, catalog_version FROM diagnostic_sessions WHERE session_id = ?",
    ).get([session.session_id]);
    const targetIds = JSON.parse(diagnosticSession?.target_concepts_json ?? "[]") as string[];
    const states = runtime.db.query<{ concept_id: string }>(
      "SELECT concept_id FROM diagnostic_concept_state ORDER BY concept_id ASC",
    ).all().map((row) => row.concept_id);

    expect(diagnosticSession?.catalog_version).toBe("practical-python-2026-05");
    expect(targetIds.sort()).toEqual([...diagnosticIds].sort());
    expect(states).not.toContain("generator");
  });

  it("fails closed when the diagnostic designer has no valid catalog target", async () => {
    const emptyRuntime = await createTestRuntime({ skipCatalogSync: true });
    await expect(designDiagnosticQuestion(emptyRuntime)).rejects.toMatchObject({
      code: "CATALOG_UNAVAILABLE",
    });

    const runtime = await createTestRuntime({ tutor: diagnosticTutor() });
    await expect(designDiagnosticQuestion(runtime, "not-in-current-catalog")).rejects.toMatchObject({
      code: "CATALOG_UNAVAILABLE",
    });
  });

  it("persists bounded selection rationale without private answer material", async () => {
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
          difficulty: 5,
        }),
      },
    });
    const session = createSession(runtime, { resume: false });

    const next = await getNextDiagnosticQuestion(runtime, session.session_id);

    const generated = runtime.db.query<{ concept_ids_json: string; difficulty: number }>(
      "SELECT concept_ids_json, difficulty FROM generated_items WHERE id = ?",
    ).get([next.question!.id]);
    expect(JSON.parse(generated?.concept_ids_json ?? "[]")).toEqual([placementAnchorDiagnosticConcept(runtime)]);
    expect(generated?.difficulty).toBeLessThanOrEqual(2);

    const rationale = runtime.db.query<{ rationale_type: string; target_concept_id: string; difficulty_direction: string; rationale_json: string }>(
      "SELECT rationale_type, target_concept_id, difficulty_direction, rationale_json FROM diagnostic_rationales WHERE generated_item_id = ?",
    ).get([next.question!.id]);
    expect(rationale).toMatchObject({
      rationale_type: "selection",
      target_concept_id: placementAnchorDiagnosticConcept(runtime),
      difficulty_direction: "same",
    });
    expect(rationale?.rationale_json.length).toBeLessThanOrEqual(2000);
    expect(rationale?.rationale_json).not.toMatch(/answer_key|rubric|choice:a/i);
    expect(rationale?.rationale_json).toContain("placement");
  });

  it("uses repetition penalty, conflict handling, and difficulty direction for follow-up targets", async () => {
    const runtime = await createTestRuntime({ tutor: diagnosticTutor() });
    const session = createSession(runtime, { resume: false });

    const first = await getNextDiagnosticQuestion(runtime, session.session_id);
    await answerDiagnosticQuestion(runtime, session.session_id, first.diagnostic_id, {
      question_id: first.question!.id,
      answer: { choice_id: "a" },
    });

    const diagnosticSession = runtime.db.query<{ id: string }>(
      "SELECT id FROM diagnostic_sessions WHERE session_id = ?",
    ).get([session.session_id]);
    runtime.db.query(
      "UPDATE diagnostic_concept_state SET mastery = 45, confidence = 0.45, evidence_count = 2, uncertainty = 0.82, band = 'learning', conflicting_evidence_count = 2 WHERE diagnostic_session_id = ? AND concept_id = 'loop'",
    ).run([diagnosticSession!.id]);

    const next = await getNextDiagnosticQuestion(runtime, session.session_id);

    expect(next.completed).toBe(false);
    expect(next.question?.concept_ids).toEqual(["loop"]);
    expect(next.question?.concept_ids).not.toEqual(first.question?.concept_ids);
    const rationale = runtime.db.query<{ difficulty_direction: string; rationale_json: string }>(
      "SELECT difficulty_direction, rationale_json FROM diagnostic_rationales WHERE generated_item_id = ?",
    ).get([next.question!.id]);
    expect(rationale?.difficulty_direction).toBe("same");
    expect(rationale?.rationale_json).toContain("conflicting_evidence_count");
  });

  it("does not update concept mastery until the adaptive diagnostic completes", async () => {
    const runtime = await createTestRuntime({ tutor: diagnosticTutor() });
    const session = createSession(runtime, { resume: false });
    const first = await getNextDiagnosticQuestion(runtime, session.session_id);

    await answerDiagnosticQuestion(runtime, session.session_id, first.diagnostic_id, {
      question_id: first.question!.id,
      answer: { choice_id: "a" },
    });

    const mastery = runtime.db.query<{ mastery_level: number; confidence: number; evidence_count: number }>(
      "SELECT mastery_level, confidence, evidence_count FROM concept_mastery WHERE concept_id = ?",
    ).get([first.question!.concept_ids[0]]);
    expect(mastery).toBeUndefined();
  });

  it("stops after minimal effective evidence when sequential placement is reliable", async () => {
    const runtime = await createTestRuntime({ tutor: diagnosticTutor() });
    const session = createSession(runtime, { resume: false });
    const diagnosticSessionId = createActiveDiagnosticSession(runtime, session.session_id);
    setDiagnosticState(runtime, diagnosticSessionId, "intro-python", { mastery: 88, confidence: 0.92, evidenceCount: 1, uncertainty: 0.06, band: "proficient" });
    setDiagnosticState(runtime, diagnosticSessionId, "condition", { mastery: 84, confidence: 0.9, evidenceCount: 1, uncertainty: 0.08, band: "proficient" });
    setDiagnosticState(runtime, diagnosticSessionId, "loop", { mastery: 32, confidence: 0.91, evidenceCount: 1, uncertainty: 0.1, band: "weak" });
    insertAttempt(runtime, session.session_id, diagnosticSessionId, "intro-python", 0);
    insertAttempt(runtime, session.session_id, diagnosticSessionId, "condition", 1);
    insertAttempt(runtime, session.session_id, diagnosticSessionId, "loop", 2);

    const next = await getNextDiagnosticQuestion(runtime, session.session_id);

    expect(next.completed).toBe(true);
    expect(next.progress).toMatchObject({
      effective_answered: 3,
      placement_confidence: expect.any(Number),
      leading_start_concept_id: "loop",
    });
    expect(next.progress.placement_confidence).toBeGreaterThanOrEqual(0.85);
    const diagnostic = runtime.db.query<{ status: string; stop_reason: string | null }>(
      "SELECT status, stop_reason FROM diagnostic_sessions WHERE id = ?",
    ).get([diagnosticSessionId]);
    expect(diagnostic).toMatchObject({ status: "completed", stop_reason: "sequential_placement_ready" });
    const profile = JSON.parse(runtime.db.query<{ profile_json: string }>("SELECT profile_json FROM local_profile WHERE id = 'local'").get()?.profile_json ?? "{}") as { current_level?: string };
    expect(profile.current_level).not.toBe("未诊断");
  });

  it("does not return another question after verified placement confidence reaches 99 percent", async () => {
    const runtime = await createTestRuntime({ tutor: diagnosticTutor() });
    const session = createSession(runtime, { resume: false });
    const diagnosticSessionId = createActiveDiagnosticSession(runtime, session.session_id);
    setDiagnosticState(runtime, diagnosticSessionId, "intro-python", { mastery: 90, confidence: 0.99, evidenceCount: 1, uncertainty: 0.01, band: "proficient" });
    setDiagnosticState(runtime, diagnosticSessionId, "variable", { mastery: 72, confidence: 0.99, evidenceCount: 1, uncertainty: 0.01, band: "proficient" });
    setDiagnosticState(runtime, diagnosticSessionId, "expression", { mastery: 68, confidence: 0.99, evidenceCount: 1, uncertainty: 0.01, band: "learning" });
    insertAttempt(runtime, session.session_id, diagnosticSessionId, "intro-python", 0);
    insertAttempt(runtime, session.session_id, diagnosticSessionId, "variable", 1);
    insertAttempt(runtime, session.session_id, diagnosticSessionId, "expression", 2);

    const next = await getNextDiagnosticQuestion(runtime, session.session_id);

    expect(next.completed).toBe(true);
    expect(next.question).toBeUndefined();
    expect(next.progress.placement_confidence).toBe(0.99);
    expect(next.progress.confidence_margin).toBeLessThan(0.2);
    const diagnostic = runtime.db.query<{ status: string; stop_reason: string | null }>(
      "SELECT status, stop_reason FROM diagnostic_sessions WHERE id = ?",
    ).get([diagnosticSessionId]);
    expect(diagnostic).toMatchObject({ status: "completed", stop_reason: "sequential_placement_ready" });
  });

  it("continues questioning when placement confidence is still low after the minimum", async () => {
    const runtime = await createTestRuntime({ tutor: diagnosticTutor() });
    const session = createSession(runtime, { resume: false });
    const diagnosticSessionId = createActiveDiagnosticSession(runtime, session.session_id);
    for (let index = 0; index < 6; index++) {
      insertAttempt(runtime, session.session_id, diagnosticSessionId, "dict", index);
    }
    for (const concept of getCatalogDiagnosticsConcepts(runtime)) {
      setDiagnosticState(runtime, diagnosticSessionId, concept.id, { mastery: 45, confidence: 0.48, evidenceCount: 1, uncertainty: 0.58, band: "learning" });
    }

    const next = await getNextDiagnosticQuestion(runtime, session.session_id);

    expect(next.completed).toBe(false);
    expect(next.question?.concept_ids.length).toBeGreaterThan(0);
    expect(next.progress.estimated_remaining_min).toBeGreaterThan(0);
    const diagnostic = runtime.db.query<{ status: string; stop_reason: string | null }>(
      "SELECT status, stop_reason FROM diagnostic_sessions WHERE id = ?",
    ).get([diagnosticSessionId]);
    expect(diagnostic).toMatchObject({ status: "active", stop_reason: null });
  });

  it("closes at the diagnostic hard cap before attempting another generated question", async () => {
    let generationCalls = 0;
    const runtime = await createTestRuntime({
      tutor: {
        generate: async () => {
          generationCalls += 1;
          return JSON.stringify({
            prompt_md: "不应该生成的新题。",
            choices: [{ id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }],
            answer_choice_id: "a",
            difficulty: 1,
          });
        },
      },
    });
    const session = createSession(runtime, { resume: false });
    const diagnosticSessionId = createActiveDiagnosticSession(runtime, session.session_id);
    const concepts = getCatalogDiagnosticsConcepts(runtime);
    const hardCap = diagnosticHardCap(concepts.length);
    for (let index = 0; index < hardCap; index++) {
      insertAttempt(runtime, session.session_id, diagnosticSessionId, concepts[index % concepts.length]!.id, index);
    }

    const next = await getNextDiagnosticQuestion(runtime, session.session_id);

    expect(generationCalls).toBe(0);
    expect(next.completed).toBe(true);
    expect(next.question).toBeUndefined();
    expect(next.progress.answered).toBe(hardCap);
    expect(next.progress.estimated_remaining_min).toBe(0);
    expect(next.progress.estimated_remaining_max).toBe(0);
    const diagnostic = runtime.db.query<{ status: string; stop_reason: string | null }>(
      "SELECT status, stop_reason FROM diagnostic_sessions WHERE id = ?",
    ).get([diagnosticSessionId]);
    expect(diagnostic).toMatchObject({ status: "completed", stop_reason: "hard_cap_reached_low_confidence" });
    const rationale = runtime.db.query<{ rationale_json: string }>(
      "SELECT rationale_json FROM diagnostic_rationales WHERE diagnostic_session_id = ? ORDER BY created_at DESC LIMIT 1",
    ).get([diagnosticSessionId]);
    expect(rationale?.rationale_json).toContain("hard_cap_reached_low_confidence");
    expect(rationale?.rationale_json).not.toMatch(/answer_key|rubric|choice:a/i);
  });

  it("retries diagnostic generation after a transient generation failure", async () => {
    let generationCalls = 0;
    const runtime = await createTestRuntime({
      tutor: {
        generate: async () => {
          generationCalls += 1;
          if (generationCalls === 1) {
            return "not valid diagnostic json";
          }
          return JSON.stringify({
            prompt_md: "恢复后的测评题会输出什么？",
            choices: [{ id: "a", text: "正确选项" }, { id: "b", text: "干扰项一" }, { id: "c", text: "干扰项二" }],
            answer_choice_id: "a",
            difficulty: 1,
          });
        },
      },
    });
    const session = createSession(runtime, { resume: false });

    const interrupted = await getNextDiagnosticQuestion(runtime, session.session_id);

    expect(interrupted.completed).toBe(false);
    expect(interrupted.question).toBeUndefined();
    expect(interrupted.progress.diagnostic_status).toBe("technical_unavailable");
    const afterFailure = runtime.db.query<{ status: string; stop_reason: string | null }>(
      "SELECT status, stop_reason FROM diagnostic_sessions WHERE session_id = ?",
    ).get([session.session_id]);
    expect(afterFailure).toMatchObject({ status: "active", stop_reason: "diagnostic_generation_unavailable" });

    const recovered = await getNextDiagnosticQuestion(runtime, session.session_id);

    expect(recovered.completed).toBe(false);
    expect(recovered.question?.prompt_md).toContain("恢复后的测评题");
    expect(recovered.progress.diagnostic_status).toBe("active");
    expect(generationCalls).toBe(2);
    const afterRecovery = runtime.db.query<{ status: string; stop_reason: string | null }>(
      "SELECT status, stop_reason FROM diagnostic_sessions WHERE session_id = ?",
    ).get([session.session_id]);
    expect(afterRecovery).toMatchObject({ status: "active", stop_reason: null });
    const rationales = runtime.db.query<{ rationale_json: string }>(
      "SELECT rationale_json FROM diagnostic_rationales WHERE diagnostic_session_id = ? ORDER BY created_at ASC",
    ).all([afterFailure!.status ? runtime.db.query<{ id: string }>("SELECT id FROM diagnostic_sessions WHERE session_id = ?").get([session.session_id])!.id : ""]);
    expect(JSON.stringify(rationales)).toContain("diagnostic_generation_unavailable");
    expect(JSON.stringify(rationales)).toContain("generation_recovered");
    expect(JSON.stringify(rationales)).not.toMatch(/answer_key|rubric|choice:a/i);
  });

  it("keeps diagnostics technically unavailable after repeated generation unavailability without local fallback questions", async () => {
    let generationCalls = 0;
    const runtime = await createTestRuntime({
      tutor: {
        generate: async () => {
          generationCalls += 1;
          return "not valid diagnostic json";
        },
      },
    });
    const session = createSession(runtime, { resume: false });

    const interrupted = await getNextDiagnosticQuestion(runtime, session.session_id);
    const repeated = await getNextDiagnosticQuestion(runtime, session.session_id);

    expect(interrupted.question).toBeUndefined();
    expect(interrupted.progress.diagnostic_status).toBe("technical_unavailable");
    expect(repeated.completed).toBe(false);
    expect(repeated.question).toBeUndefined();
    expect(repeated.progress.diagnostic_status).toBe("technical_unavailable");
    expect(runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM generated_items WHERE generator_model_version = 'deterministic-catalog-fallback'").get()?.count).toBe(0);
    expect(generationCalls).toBe(2);
  });

  it("migrates existing paused generation-unavailable sessions to retry or hard-cap closure", async () => {
    let generationCalls = 0;
    const runtime = await createTestRuntime({
      tutor: {
        generate: async () => {
          generationCalls += 1;
          return JSON.stringify({
            prompt_md: "暂停后恢复生成的题目？",
            choices: [{ id: "a", text: "正确选项" }, { id: "b", text: "干扰项一" }, { id: "c", text: "干扰项二" }],
            answer_choice_id: "a",
            difficulty: 1,
          });
        },
      },
    });
    const session = createSession(runtime, { resume: false });
    const diagnosticSessionId = createActiveDiagnosticSession(runtime, session.session_id);
    runtime.db.query("UPDATE diagnostic_sessions SET status = 'paused', stop_reason = 'diagnostic_generation_unavailable', ended_at = ? WHERE id = ?").run([nowIso(), diagnosticSessionId]);

    const recovered = await getNextDiagnosticQuestion(runtime, session.session_id);

    expect(recovered.question?.prompt_md).toContain("暂停后恢复生成");
    expect(recovered.progress.diagnostic_status).toBe("active");
    expect(generationCalls).toBe(1);
    const migrated = runtime.db.query<{ status: string; stop_reason: string | null }>(
      "SELECT status, stop_reason FROM diagnostic_sessions WHERE id = ?",
    ).get([diagnosticSessionId]);
    expect(migrated).toMatchObject({ status: "active", stop_reason: null });

    const overCapSessionId = createActiveDiagnosticSession(runtime, session.session_id);
    const concepts = getCatalogDiagnosticsConcepts(runtime);
    const hardCap = diagnosticHardCap(concepts.length);
    for (let index = 0; index < hardCap; index++) {
      insertAttempt(runtime, session.session_id, overCapSessionId, concepts[index % concepts.length]!.id, index + 1000);
    }
    runtime.db.query("UPDATE diagnostic_sessions SET status = 'paused', stop_reason = 'diagnostic_generation_unavailable', ended_at = ? WHERE id = ?").run([nowIso(), overCapSessionId]);

    const closed = await getNextDiagnosticQuestion(runtime, session.session_id);

    expect(closed.completed).toBe(true);
    expect(closed.question).toBeUndefined();
    expect(generationCalls).toBe(1);
    const overCap = runtime.db.query<{ status: string; stop_reason: string | null }>(
      "SELECT status, stop_reason FROM diagnostic_sessions WHERE id = ?",
    ).get([overCapSessionId]);
    expect(overCap).toMatchObject({ status: "completed", stop_reason: "hard_cap_reached_low_confidence" });
  });

  it("completes after the bounded adaptive evidence cap when placement remains inconclusive", async () => {
    const runtime = await createTestRuntime({ tutor: diagnosticTutor() });
    const session = createSession(runtime, { resume: false });
    const diagnosticSessionId = createActiveDiagnosticSession(runtime, session.session_id);
    const concepts = getCatalogDiagnosticsConcepts(runtime);
    for (const concept of concepts) {
      setDiagnosticState(runtime, diagnosticSessionId, concept.id, { mastery: 45, confidence: 0.44, evidenceCount: 2, uncertainty: 0.31, band: "weak" });
    }
    const boundedCap = diagnosticHardCap(concepts.length) + 14;
    for (let index = 0; index < boundedCap; index++) {
      insertAttempt(runtime, session.session_id, diagnosticSessionId, concepts[index % concepts.length]!.id, index);
    }

    const next = await getNextDiagnosticQuestion(runtime, session.session_id);

    expect(next.completed).toBe(true);
    expect(next.question).toBeUndefined();
    const diagnostic = runtime.db.query<{ status: string; stop_reason: string | null }>(
      "SELECT status, stop_reason FROM diagnostic_sessions WHERE id = ?",
    ).get([diagnosticSessionId]);
    expect(diagnostic).toMatchObject({ status: "completed", stop_reason: "max_adaptive_evidence_reached" });
  });

  it("summarizes active diagnostic context without fixed total semantics or private answer material", async () => {
    const captured: unknown[] = [];
    const runtime = await createTestRuntime({
      tutor: {
        generate: async (request) => {
          captured.push(request);
          return "继续。";
        },
      },
    });
    const session = createSession(runtime, { resume: false });
    await getNextDiagnosticQuestion(runtime, session.session_id);

    captured.length = 0;
    await postMessage(runtime, session.session_id, { message: "解释 Python 字典", attachments: [] });

    const requestJson = JSON.stringify(captured.at(-1));
    expect(requestJson).toContain("current_focus_concept_ids");
    expect(requestJson).toContain("completion_confidence");
    expect(requestJson).not.toContain("\"total\"");
    expect(requestJson).not.toMatch(/answer_key_private|rubric_private|choice:a/i);
  });
});

function createActiveDiagnosticSession(runtime: Awaited<ReturnType<typeof createTestRuntime>>, sessionId: string): string {
  const now = nowIso();
  const diagnosticSessionId = createId("diag");
  const concepts = getCatalogDiagnosticsConcepts(runtime);
  runtime.db.query(
    "INSERT INTO diagnostic_sessions(id, session_id, status, target_concepts_json, started_at) VALUES (?, ?, 'active', ?, ?)",
  ).run([diagnosticSessionId, sessionId, JSON.stringify(concepts.map((concept) => concept.id)), now]);
  for (const concept of concepts) {
    runtime.db.query(
      "INSERT INTO diagnostic_concept_state(diagnostic_session_id, concept_id, mastery, confidence, evidence_count, uncertainty, band, conflicting_evidence_count, updated_at) VALUES (?, ?, 0, 0, 0, 1, 'unknown', 0, ?)",
    ).run([diagnosticSessionId, concept.id, now]);
  }
  return diagnosticSessionId;
}

function placementAnchorDiagnosticConcept(runtime: Awaited<ReturnType<typeof createTestRuntime>>): string {
  const concepts = getCatalogDiagnosticsConcepts(runtime);
  return concepts[Math.floor((concepts.length - 1) / 2)]!.id;
}

function criticalDiagnosticConcepts(runtime: Awaited<ReturnType<typeof createTestRuntime>>): string[] {
  const policy = getCatalogProgressPolicyInputMap(runtime);
  return getCatalogDiagnosticsConcepts(runtime)
    .filter((concept) => {
      const input = policy.get(concept.id);
      return input?.prerequisite_blocker === true || (input?.prerequisite_weight ?? 0) >= 2;
    })
    .map((concept) => concept.id);
}

function insertAttempt(
  runtime: Awaited<ReturnType<typeof createTestRuntime>>,
  sessionId: string,
  diagnosticSessionId: string,
  conceptId: string,
  index: number,
): void {
  const now = nowIso();
  const questionId = `diag_test_${conceptId}_${index}`;
  runtime.db.query(
    "INSERT INTO diagnostic_questions(id, concept_ids_json, question_type, prompt_md, choices_json, answer_key_ref, difficulty, status, version, created_at, updated_at) VALUES (?, ?, 'multiple_choice', '测试题', ?, 'answer:choice:a', 1, 'published', 'test', ?, ?)",
  ).run([questionId, JSON.stringify([conceptId]), JSON.stringify([{ id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }]), now, now]);
  runtime.db.query(
    "INSERT INTO generated_items(id, diagnostic_session_id, concept_ids_json, item_type, prompt_md, choices_json, answer_key_private_json, rubric_private, difficulty, expected_evidence, validation_status, generator_model_version, generator_prompt_version, schema_version, created_at) VALUES (?, ?, ?, 'multiple_choice', '测试题', ?, ?, '', 1, 'recognition', 'validated', 'test', 'test', 'generated_diagnostic_item.v1', ?)",
  ).run([questionId, diagnosticSessionId, JSON.stringify([conceptId]), JSON.stringify([{ id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }]), JSON.stringify({ choice: "a" }), now]);
  runtime.db.query(
    "INSERT INTO diagnostic_attempts(id, question_id, session_id, answer_json, result_summary_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run([createId("diag"), questionId, sessionId, JSON.stringify({ choice_id: "a" }), JSON.stringify({ outcome: "correct" }), now]);
}

function setDiagnosticState(
  runtime: Awaited<ReturnType<typeof createTestRuntime>>,
  diagnosticSessionId: string,
  conceptId: string,
  input: { mastery: number; confidence: number; evidenceCount: number; uncertainty: number; band: string },
): void {
  runtime.db.query(
    "UPDATE diagnostic_concept_state SET mastery = ?, confidence = ?, evidence_count = ?, uncertainty = ?, band = ?, conflicting_evidence_count = 0 WHERE diagnostic_session_id = ? AND concept_id = ?",
  ).run([input.mastery, input.confidence, input.evidenceCount, input.uncertainty, input.band, diagnosticSessionId, conceptId]);
}
