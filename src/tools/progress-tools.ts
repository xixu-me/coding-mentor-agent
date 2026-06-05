import type { AppRuntime, LearningProgressDecision, ToolEnvelope } from "../types.js";
import { AppError } from "../types.js";
import { assertConceptIdsKnown, assertMistakeTagIdsKnown } from "../db/validators.js";
import { createId, nowIso, stableHash } from "../security/ids.js";
import { errorEnvelope, okEnvelope } from "./envelope.js";
import { assertValid, GetConceptMasteryParams, GetRecentLearningContextParams, RecordLearningEventParams, TagMistakeParams, UpdateMasteryParams } from "./schemas.js";
import { getActiveCatalogConcepts, getCatalogProgressPolicyInputMap } from "../server/course-catalog.js";
import { recordEvidenceAndProject, type ProjectionOutcome } from "../server/progress-policy.js";
import { deriveLearningProgressDecision } from "../server/learning-progress-decision.js";

type ToolRunContext = {
  sessionId?: string | null;
  turnId?: string | null;
};

export async function getStudentProfile(runtime: AppRuntime, options: { sessionId?: string | null } = {}): Promise<ToolEnvelope<{
  display_name?: string;
  profile_summary: string;
  current_level?: string;
  current_goal?: string | null;
  diagnostic_completed: boolean;
  created_at: string;
  updated_at: string;
  progress_decision: LearningProgressDecision;
}>> {
  const started = Date.now();
  try {
    const decision = deriveLearningProgressDecision(runtime, { sessionId: options.sessionId });
    const row = runtime.db.query<{ display_name: string | null; profile_json: string; created_at: string; updated_at: string }>(
      "SELECT display_name, profile_json, created_at, updated_at FROM local_profile WHERE id = 'local'",
    ).get();
    const profile = row ? JSON.parse(row.profile_json) as { profile_summary?: string; current_level?: string; current_goal?: string | null } : {};
    return okEnvelope("get_student_profile", started, {
      display_name: row?.display_name ?? undefined,
      profile_summary: profile.profile_summary ?? "Python 课程学习者，尚未完成首次诊断。",
      current_level: decision.current_level ?? undefined,
      current_goal: decision.current_goal,
      diagnostic_completed: decision.diagnostic_state === "completed",
      created_at: row?.created_at ?? nowIso(),
      updated_at: row?.updated_at ?? nowIso(),
      progress_decision: decision,
    });
  } catch (error) {
    return errorEnvelope("get_student_profile", started, error);
  }
}

export async function getConceptMastery(runtime: AppRuntime, params: unknown): Promise<ToolEnvelope<{
  concepts: Array<{
    concept_id: string;
    name: string;
    mastery_level: number | null;
    confidence: number | null;
    review_priority: number | null;
    last_practiced_at?: string;
    evidence_count: number;
  }>;
}>> {
  const started = Date.now();
  try {
    const input = assertValid<{ concept_ids: string[] }>(GetConceptMasteryParams, params);
    const conceptIds = input.concept_ids;
    assertConceptIdsKnown(runtime, conceptIds);
    const concepts = conceptIds.map((id) => {
      const row = runtime.db.query<{
        id: string;
        name: string;
        mastery_level: number | null;
        confidence: number | null;
        evidence_count: number | null;
        review_priority: number | null;
        last_practiced_at: string | null;
      }>(
        "SELECT c.id, c.name, m.mastery_level, m.confidence, m.evidence_count, m.review_priority, m.last_practiced_at FROM concepts c LEFT JOIN concept_mastery m ON m.concept_id = c.id WHERE c.id = ?",
      ).get([id]);
      return {
        concept_id: id,
        name: row?.name ?? id,
        mastery_level: row?.evidence_count && row.evidence_count > 0 ? row.mastery_level : null,
        confidence: row?.evidence_count && row.evidence_count > 0 ? row.confidence : null,
        review_priority: row?.evidence_count && row.evidence_count > 0 ? row.review_priority : null,
        last_practiced_at: row?.last_practiced_at ?? undefined,
        evidence_count: row?.evidence_count ?? 0,
      };
    });
    return okEnvelope("get_concept_mastery", started, { concepts });
  } catch (error) {
    return errorEnvelope("get_concept_mastery", started, error, { concepts: [] });
  }
}

export async function getRecentLearningContext(runtime: AppRuntime, params: unknown = {}, context: ToolRunContext = {}): Promise<ToolEnvelope<{
  profile_summary: string;
  current_level?: string;
  current_goal?: string | null;
  concept_mastery: Array<{ concept_id: string; name: string; mastery_level: number | null; confidence: number | null; review_priority: number | null }>;
  recent_events: Array<{ event_type: string; summary: string; created_at: string }>;
  weak_concepts: Array<{ concept_id: string; name: string; reason: string }>;
  active_exercise?: { id: string; title: string; status: string };
  active_project_step?: { id: string; title: string; status: string };
  progress_decision: LearningProgressDecision;
}>> {
  const started = Date.now();
  try {
    const input = assertValid<{ concept_ids?: string[]; include_active_exercise?: boolean; include_active_project?: boolean; event_limit?: number }>(GetRecentLearningContextParams, params);
    const profile = await getStudentProfile(runtime, { sessionId: context.sessionId });
    const decision = profile.data.progress_decision;
    const decisionConceptIds = [
      ...decision.recommendation_focus.map((item) => item.target_id),
      ...decision.diagnostic_focus.map((item) => item.target_id),
      ...decision.current_unit.concept_ids,
    ];
    const defaultConceptIds = runtime.db.query<{ concept_id: string }>(
      `SELECT c.id AS concept_id
       FROM concepts c
       LEFT JOIN concept_mastery m ON m.concept_id = c.id
       WHERE c.catalog_status = 'active'
       ORDER BY COALESCE(m.review_priority, 0) DESC, COALESCE(m.readiness, 0) ASC, c.order_index ASC, c.id ASC
       LIMIT 5`,
    ).all().map((row) => row.concept_id);
    const masteryIds = input.concept_ids?.length
      ? input.concept_ids
      : decisionConceptIds.length
        ? [...new Set(decisionConceptIds)].slice(0, 5)
        : defaultConceptIds.length ? defaultConceptIds : getActiveCatalogConcepts(runtime).slice(0, 5).map((concept) => concept.id);
    const mastery = await getConceptMastery(runtime, { concept_ids: masteryIds.slice(0, 5) });
    const events = context.sessionId
      ? runtime.db.query<{ event_type: string; evidence_json: string; created_at: string }>(
        "SELECT event_type, evidence_json, created_at FROM learning_events WHERE session_id = ? ORDER BY created_at DESC LIMIT ?",
      ).all([context.sessionId, input.event_limit ?? 5])
      : runtime.db.query<{ event_type: string; evidence_json: string; created_at: string }>(
        "SELECT event_type, evidence_json, created_at FROM learning_events ORDER BY created_at DESC LIMIT ?",
      ).all([input.event_limit ?? 5]);
    const weak = runtime.db.query<{ concept_id: string; name: string; mastery_level: number }>(
      "SELECT c.id AS concept_id, c.name, m.mastery_level FROM concept_mastery m JOIN concepts c ON c.id = m.concept_id WHERE c.catalog_status = 'active' AND m.evidence_count > 0 ORDER BY m.review_priority DESC, m.readiness ASC, m.mastery_level ASC LIMIT 5",
    ).all();
    const activeExercise = input.include_active_exercise === false ? undefined : runtime.db.query<{ id: string; title: string; status: string }>(
      "SELECT id, title, status FROM exercises WHERE status = 'published' ORDER BY difficulty ASC, id ASC LIMIT 1",
    ).get();
    const activeProjectStep = input.include_active_project === false ? undefined : runtime.db.query<{ id: string; title: string; status: string }>(
      "SELECT id, title, status FROM project_steps WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1",
    ).get();
    return okEnvelope("get_recent_learning_context", started, {
      profile_summary: profile.data.profile_summary,
      current_level: profile.data.current_level,
      current_goal: decision.current_goal,
      concept_mastery: mastery.data.concepts.map((item) => ({
        concept_id: item.concept_id,
        name: item.name,
        mastery_level: item.mastery_level,
        confidence: item.confidence,
        review_priority: item.review_priority,
      })),
      recent_events: events.map((event) => ({
        event_type: event.event_type,
        summary: (JSON.parse(event.evidence_json) as { summary?: string }).summary ?? "",
        created_at: event.created_at,
      })),
      weak_concepts: decision.weak_concepts.length
        ? decision.weak_concepts
        : weak.map((item) => ({ concept_id: item.concept_id, name: item.name, reason: `掌握度 ${item.mastery_level}，建议复习。` })),
      ...(activeExercise ? { active_exercise: activeExercise } : {}),
      ...(activeProjectStep ? { active_project_step: activeProjectStep } : {}),
      progress_decision: decision,
    });
  } catch (error) {
    return errorEnvelope("get_recent_learning_context", started, error);
  }
}

export async function recordLearningEvent(runtime: AppRuntime, params: unknown): Promise<ToolEnvelope<{
  event_id: string;
  event_type: string;
  concept_ids: string[];
}>> {
  const started = Date.now();
  try {
    const input = assertValid<{ event_type: string; concept_ids: string[]; payload?: Record<string, unknown>; evidence: { session_turn_id: string; tool_call_id?: string; summary: string } }>(RecordLearningEventParams, params);
    assertConceptIdsKnown(runtime, input.concept_ids);
    const turn = runtime.db.query<{ id: string; session_id: string }>("SELECT id, session_id FROM session_turns WHERE id = ?").get([input.evidence.session_turn_id]);
    if (!turn) {
      throw new AppError("SESSION_NOT_FOUND", "Learning event turn does not belong to a local session", 404);
    }
    const idempotencyKey = stableHash({
      session_turn_id: input.evidence.session_turn_id,
      event_type: input.event_type,
      concept_ids: input.concept_ids,
      tool_call_id: input.evidence.tool_call_id,
      payload: input.payload,
      summary: input.evidence.summary,
    });
    const existing = runtime.db.query<{ id: string }>("SELECT id FROM learning_events WHERE idempotency_key = ?").get([idempotencyKey]);
    const eventId = existing?.id ?? createId("ev");
    if (!existing) {
      runtime.db.query(
        "INSERT INTO learning_events(id, session_id, turn_id, tool_call_id, event_type, concept_ids_json, payload_json, evidence_json, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run([
        eventId,
        turn.session_id,
        turn.id,
        input.evidence.tool_call_id ?? null,
        input.event_type,
        JSON.stringify(input.concept_ids),
        JSON.stringify(input.payload ?? {}),
        JSON.stringify(input.evidence),
        idempotencyKey,
        nowIso(),
      ]);
    }
    return okEnvelope("record_learning_event", started, { event_id: eventId, event_type: input.event_type, concept_ids: input.concept_ids });
  } catch (error) {
    return errorEnvelope("record_learning_event", started, error, { event_id: "", event_type: "", concept_ids: [] });
  }
}

export async function tagMistake(runtime: AppRuntime, params: unknown): Promise<ToolEnvelope<{ event_id: string }>> {
  const started = Date.now();
  try {
    const input = assertValid<{ turn_id: string; concept_ids: string[]; mistake_tag_ids: string[]; evidence: { summary: string; tool_call_id?: string } }>(TagMistakeParams, params);
    assertConceptIdsKnown(runtime, input.concept_ids);
    assertMistakeTagIdsKnown(runtime, input.mistake_tag_ids);
    const event = await recordLearningEvent(runtime, {
      event_type: "mistake_tagged",
      concept_ids: input.concept_ids,
      payload: { outcome: input.mistake_tag_ids.join(",") },
      evidence: { session_turn_id: input.turn_id, tool_call_id: input.evidence.tool_call_id, summary: input.evidence.summary },
    });
    return okEnvelope("tag_mistake", started, { event_id: event.data.event_id });
  } catch (error) {
    return errorEnvelope("tag_mistake", started, error, { event_id: "" });
  }
}

export async function updateMastery(runtime: AppRuntime, params: unknown): Promise<ToolEnvelope<{
  concepts: Array<{ concept_id: string; mastery_level: number; confidence: number; review_priority: number }>;
}>> {
  const started = Date.now();
  try {
    const input = assertValid<{ turn_id: string; concept_ids: string[]; outcome: ProjectionOutcome; difficulty?: number; hint_count?: number; evidence: { summary: string } }>(UpdateMasteryParams, params);
    assertConceptIdsKnown(runtime, input.concept_ids);
    const turn = runtime.db.query<{ id: string; session_id: string }>("SELECT id, session_id FROM session_turns WHERE id = ?").get([input.turn_id]);
    if (!turn) {
      throw new AppError("SESSION_NOT_FOUND", "Mastery update turn does not belong to a local session", 404);
    }
    const now = nowIso();
    const policyInputs = getCatalogProgressPolicyInputMap(runtime);
    const updated = runtime.db.transaction(() => input.concept_ids.map((conceptId: string) => {
      const result = recordEvidenceAndProject(runtime, {
        sourceType: "tutor_review",
        sourceId: input.turn_id,
        sessionId: turn.session_id,
        turnId: input.turn_id,
        conceptId,
        outcome: input.outcome,
        difficulty: input.difficulty ?? null,
        summary: input.evidence,
        hintCount: input.hint_count ?? 0,
        prerequisiteCentrality: policyInputs.get(conceptId)?.prerequisite_weight ?? 0,
        audit: {
          toolCallId: `projection:${input.turn_id}:${conceptId}`,
          status: "tutor_review",
          score: input.outcome === "completed_independently" ? 100 : input.outcome === "completed_with_hint" ? 80 : 50,
          conceptIds: [conceptId],
        },
        createdAt: now,
      });
      return { concept_id: conceptId, ...result.projection };
    }));
    return okEnvelope("update_mastery", started, { concepts: updated });
  } catch (error) {
    return errorEnvelope("update_mastery", started, error, { concepts: [] });
  }
}
