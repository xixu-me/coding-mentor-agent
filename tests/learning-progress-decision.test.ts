import { describe, expect, it } from "vitest";
import { prepareTurnModelContext } from "../src/server/context-management.js";
import { getLatestCatalogRun } from "../src/server/course-catalog.js";
import { getNextDiagnosticQuestion } from "../src/server/diagnostics.js";
import { deriveLearningProgressDecision } from "../src/server/learning-progress-decision.js";
import { createSession, getProgressSummary } from "../src/server/services.js";
import { createId, nowIso } from "../src/security/ids.js";
import { getRecentLearningContext, getStudentProfile } from "../src/tools/progress-tools.js";
import { createTestRuntime } from "./utils/runtime.js";
import { diagnosticTutor, upsertMasteryFixture } from "./utils/content-fixtures.js";

describe("learning progress decision", () => {
  it("splits diagnostic, handoff, and practice state while failing closed before a fresh completion", async () => {
    const runtime = await createTestRuntime({ tutor: diagnosticTutor() });
    const session = createSession(runtime, { resume: false });

    const notStarted = deriveLearningProgressDecision(runtime, { sessionId: session.session_id });
    expect(notStarted).toMatchObject({
      diagnostic_state: "not_started",
      handoff_state: "not_ready",
      practice_state: "locked_by_diagnostic",
      current_goal: null,
      current_unit: { id: "diagnostic" },
      recommendation_focus: [],
    });

    await getNextDiagnosticQuestion(runtime, session.session_id);
    const active = deriveLearningProgressDecision(runtime, { sessionId: session.session_id });
    expect(active.diagnostic_state).toBe("active");
    expect(active.practice_state).toBe("locked_by_diagnostic");
    expect(active.diagnostic_focus.length).toBeGreaterThan(0);
    expect(active.recommendation_focus).toEqual([]);

    runtime.db.query("UPDATE diagnostic_sessions SET status = 'paused', stop_reason = 'needs_more_evidence' WHERE session_id = ?").run([session.session_id]);
    const inconclusive = deriveLearningProgressDecision(runtime, { sessionId: session.session_id });
    expect(inconclusive.diagnostic_state).toBe("inconclusive");
    expect(inconclusive.practice_state).toBe("locked_by_diagnostic");
    expect(inconclusive.recommendation_focus).toEqual([]);
  });

  it("distinguishes technical unavailable and catalog-stale diagnostics from fresh completion", async () => {
    const unavailableRuntime = await createTestRuntime();
    const unavailableSession = createSession(unavailableRuntime, { resume: false });
    await getNextDiagnosticQuestion(unavailableRuntime, unavailableSession.session_id);

    const unavailable = deriveLearningProgressDecision(unavailableRuntime, { sessionId: unavailableSession.session_id });
    expect(unavailable).toMatchObject({
      diagnostic_state: "technical_unavailable",
      practice_state: "locked_by_diagnostic",
      recommendation_focus: [],
    });

    const staleRuntime = await createTestRuntime({ tutor: diagnosticTutor() });
    const staleSession = createSession(staleRuntime, { resume: false });
    completeDiagnostic(staleRuntime, staleSession.session_id, { catalogFresh: false });

    const stale = deriveLearningProgressDecision(staleRuntime, { sessionId: staleSession.session_id });
    expect(stale).toMatchObject({
      diagnostic_state: "catalog_stale",
      practice_state: "locked_by_stale_catalog",
      diagnostic_feedback: null,
      recommendation_focus: [],
    });

    const freshRuntime = await createTestRuntime({ tutor: diagnosticTutor() });
    const freshSession = createSession(freshRuntime, { resume: false });
    completeDiagnostic(freshRuntime, freshSession.session_id, { catalogFresh: true, placementConceptId: "string" });

    const fresh = deriveLearningProgressDecision(freshRuntime, { sessionId: freshSession.session_id });
    expect(fresh).toMatchObject({
      diagnostic_state: "completed",
      handoff_state: "feedback_ready",
      practice_state: "guidance_first",
    });
    expect(fresh.learning_start?.concept_id).toBe("string");
    expect(fresh.diagnostic_feedback?.learning_start).toBeTruthy();
  });

  it("keeps generation interruptions locked until retry recovers to active diagnostic state", async () => {
    let generationCalls = 0;
    const runtime = await createTestRuntime({
      tutor: {
        generate: async () => {
          generationCalls += 1;
          if (generationCalls === 1) return "invalid diagnostic json";
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

    await getNextDiagnosticQuestion(runtime, session.session_id);
    const interrupted = deriveLearningProgressDecision(runtime, { sessionId: session.session_id });
    expect(interrupted).toMatchObject({
      diagnostic_state: "technical_unavailable",
      practice_state: "locked_by_diagnostic",
      recommendation_focus: [],
    });
    expect(interrupted.reasons).toContain("diagnostic_status:active");
    expect(interrupted.reasons).toContain("diagnostic_stop:diagnostic_generation_unavailable");

    await getNextDiagnosticQuestion(runtime, session.session_id);
    const recovered = deriveLearningProgressDecision(runtime, { sessionId: session.session_id });
    expect(recovered).toMatchObject({
      diagnostic_state: "active",
      practice_state: "locked_by_diagnostic",
      recommendation_focus: [],
    });
    expect(recovered.reasons).not.toContain("technical_unavailable");
    expect(recovered.reasons).not.toContain("diagnostic_stop:diagnostic_generation_unavailable");
  });

  it("exposes hard-cap low-confidence closure as completed guidance-first progress", async () => {
    const runtime = await createTestRuntime({ tutor: diagnosticTutor() });
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, {
      catalogFresh: true,
      placementConceptId: "string",
      stopReason: "hard_cap_reached_low_confidence",
    });

    const decision = deriveLearningProgressDecision(runtime, { sessionId: session.session_id });

    expect(decision).toMatchObject({
      diagnostic_state: "completed",
      handoff_state: "feedback_ready",
      practice_state: "guidance_first",
    });
    expect(decision.learning_start?.concept_id).toBe("string");
    expect(decision.reasons).toContain("diagnostic_stop:hard_cap_reached_low_confidence");
  });

  it("does not let display-only profile fields become authoritative progress", async () => {
    const runtime = await createTestRuntime({ tutor: diagnosticTutor() });
    const session = createSession(runtime, { resume: false });
    runtime.db.query("UPDATE local_profile SET profile_json = ?, updated_at = ? WHERE id = 'local'").run([
      JSON.stringify({
        profile_summary: "Legacy display profile",
        current_level: "高级",
        current_goal: "Display-only goal",
        diagnostic_placement_label: "Display-only placement",
      }),
      nowIso(),
    ]);

    const decision = deriveLearningProgressDecision(runtime, { sessionId: session.session_id });

    expect(decision.current_level).toBeNull();
    expect(decision.current_goal).toBeNull();
    expect(decision.learning_start).toBeNull();
    expect(decision.provenance.current_level).toBeNull();
    expect(decision.provenance.current_goal).toBeNull();
    expect(decision.provenance.learning_start).toBeNull();
  });

  it("selects current unit by diagnostic gate, blocker, learning start, recommendation focus, and catalog fallback", async () => {
    const diagnosticRuntime = await createTestRuntime({ tutor: diagnosticTutor() });
    const diagnosticSession = createSession(diagnosticRuntime, { resume: false });
    expect(deriveLearningProgressDecision(diagnosticRuntime, { sessionId: diagnosticSession.session_id }).current_unit.id).toBe("diagnostic");

    const blockerRuntime = await createTestRuntime({ tutor: diagnosticTutor() });
    const blockerSession = createSession(blockerRuntime, { resume: false });
    completeDiagnostic(blockerRuntime, blockerSession.session_id, { catalogFresh: true, placementConceptId: "string" });
    upsertMasteryFixture(blockerRuntime, "intro-python", { mastery: 5, readiness: 0, confidence: 0.9, evidenceCount: 4, reviewPriority: 10 });
    const blocker = deriveLearningProgressDecision(blockerRuntime, { sessionId: blockerSession.session_id });
    expect(blocker.current_unit.concept_ids).toContain("intro-python");
    expect(blocker.provenance.current_unit?.source).toBe("mastery_projection");

    const startRuntime = await createTestRuntime({ tutor: diagnosticTutor() });
    const startSession = createSession(startRuntime, { resume: false });
    completeDiagnostic(startRuntime, startSession.session_id, { catalogFresh: true, placementConceptId: "string" });
    upsertMasteryFixture(startRuntime, "intro-python", { mastery: 95, readiness: 95, confidence: 0.9, evidenceCount: 4, reviewPriority: 0 });
    const start = deriveLearningProgressDecision(startRuntime, { sessionId: startSession.session_id });
    expect(start.current_unit.concept_ids).toContain("string");
    expect(start.provenance.current_unit?.source).toBe("active_diagnostic");

    const recommendationRuntime = await createTestRuntime({ tutor: diagnosticTutor() });
    const recommendationSession = createSession(recommendationRuntime, { resume: false });
    completeDiagnostic(recommendationRuntime, recommendationSession.session_id, { catalogFresh: true });
    upsertMasteryFixture(recommendationRuntime, "set", { mastery: 20, readiness: 15, confidence: 0.9, evidenceCount: 3, reviewPriority: 10 });
    const recommendation = deriveLearningProgressDecision(recommendationRuntime, { sessionId: recommendationSession.session_id });
    expect(recommendation.current_unit.concept_ids).toContain(recommendation.recommendation_focus[0]!.target_id);
    expect(recommendation.provenance.current_unit?.source).toBe("recommendation_ranker");

    const fallbackRuntime = await createTestRuntime({ tutor: diagnosticTutor() });
    const fallbackSession = createSession(fallbackRuntime, { resume: false });
    completeDiagnostic(fallbackRuntime, fallbackSession.session_id, { catalogFresh: true });
    for (const conceptId of activeConceptIds(fallbackRuntime)) {
      upsertMasteryFixture(fallbackRuntime, conceptId, { mastery: 95, readiness: 95, confidence: 0.9, evidenceCount: 3, reviewPriority: 0 });
    }
    const fallback = deriveLearningProgressDecision(fallbackRuntime, { sessionId: fallbackSession.session_id });
    expect(fallback.current_unit.id).toBe(activeUnitIds(fallbackRuntime).at(-1));
    expect(fallback.provenance.current_unit?.source).toBe("active_catalog");
  });

  it("uses the same decision for progress API, tools, and model context", async () => {
    const runtime = await createTestRuntime({ tutor: diagnosticTutor() });
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, { catalogFresh: true, placementConceptId: "string" });
    upsertMasteryFixture(runtime, "function", { mastery: 25, readiness: 20, confidence: 0.8, evidenceCount: 2, reviewPriority: 8 });

    const decision = deriveLearningProgressDecision(runtime, { sessionId: session.session_id });
    const progress = getProgressSummary(runtime, { sessionId: session.session_id });
    const profile = await getStudentProfile(runtime, { sessionId: session.session_id });
    const recent = await getRecentLearningContext(runtime, { event_limit: 3 }, { sessionId: session.session_id });
    const context = prepareTurnModelContext(runtime, session.session_id, createId("turn"), { message: "我的学习进度怎么样？", code: "" });

    expect(progress.progress_decision).toMatchObject({
      diagnostic_state: decision.diagnostic_state,
      handoff_state: decision.handoff_state,
      practice_state: decision.practice_state,
      current_unit: decision.current_unit,
    });
    expect(profile.data.progress_decision).toMatchObject(progress.progress_decision);
    expect(recent.data.progress_decision).toMatchObject(progress.progress_decision);
    expect(context.context.bundle?.server_attested_state.learning_progress_decision).toMatchObject({
      diagnostic_state: progress.progress_decision.diagnostic_state,
      handoff_state: progress.progress_decision.handoff_state,
      practice_state: progress.progress_decision.practice_state,
      current_unit: progress.progress_decision.current_unit,
    });
    expect(context.context.bundle?.server_attested_state.recommendation_focus).toEqual(decision.recommendation_focus);
  });
});

function completeDiagnostic(
  runtime: Awaited<ReturnType<typeof createTestRuntime>>,
  sessionId: string,
  options: { catalogFresh: boolean; placementConceptId?: string; stopReason?: string } = { catalogFresh: true },
): string {
  const now = nowIso();
  const id = createId("diag");
  const catalogRun = options.catalogFresh ? getLatestCatalogRun(runtime) : undefined;
  runtime.db.query(
    "INSERT INTO diagnostic_sessions(id, session_id, status, target_concepts_json, stop_reason, catalog_version, catalog_run_id, started_at, ended_at) VALUES (?, ?, 'completed', ?, ?, ?, ?, ?, ?)",
  ).run([
    id,
    sessionId,
    JSON.stringify(["intro-python", "loop", "string", "function"]),
    options.stopReason ?? "test_complete",
    catalogRun?.kb_version ?? null,
    catalogRun?.id ?? null,
    now,
    now,
  ]);
  runtime.db.query("UPDATE local_profile SET profile_json = ?, updated_at = ? WHERE id = 'local'").run([
    JSON.stringify({
      profile_summary: "Python learner with completed diagnostic.",
      current_level: "Display-only level",
      current_goal: "Display-only goal",
      diagnostic_placement_concept_id: options.placementConceptId,
      diagnostic_placement_label: options.placementConceptId ? conceptName(runtime, options.placementConceptId) : undefined,
    }),
    now,
  ]);
  return id;
}

function conceptName(runtime: Awaited<ReturnType<typeof createTestRuntime>>, conceptId: string): string {
  return runtime.db.query<{ name: string }>("SELECT name FROM concepts WHERE id = ?").get([conceptId])?.name ?? conceptId;
}

function activeConceptIds(runtime: Awaited<ReturnType<typeof createTestRuntime>>): string[] {
  return runtime.db.query<{ id: string }>("SELECT id FROM concepts WHERE catalog_status = 'active' ORDER BY order_index ASC").all().map((row) => row.id);
}

function activeUnitIds(runtime: Awaited<ReturnType<typeof createTestRuntime>>): string[] {
  return runtime.db.query<{ id: string }>("SELECT id FROM course_units WHERE catalog_status = 'active' ORDER BY order_index ASC").all().map((row) => row.id);
}
