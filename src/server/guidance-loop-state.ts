import type { AppRuntime, GuidanceLoopState, PracticeMode, PracticeOutcome } from "../types.js";
import { deriveLearningFrontier } from "./learning-frontier.js";
import { deriveLearningProgressDecision } from "./learning-progress-decision.js";
import { loadLatestPracticeOutcome } from "./practice-workflow.js";

type ActionCountRow = {
  action_kind: string;
  count: number;
};

type JudgementRow = {
  payload_json: string;
};

type AttemptRow = {
  status: string;
  score: number | null;
};

type AgentPracticeReviewRow = {
  review_status: string;
};

export function deriveGuidanceLoopState(runtime: AppRuntime, input: { sessionId: string }): GuidanceLoopState {
  const decision = deriveLearningProgressDecision(runtime, { sessionId: input.sessionId });
  const frontier = deriveLearningFrontier(runtime, { sessionId: input.sessionId, decision });
  const currentConceptId = frontier.current_concept_id;
  const counts = loadAcceptedActionCounts(runtime, input.sessionId, currentConceptId);
  const latestPractice = loadLatestPracticeOutcome(runtime, input.sessionId);
  const activeExerciseId = activeExerciseIdFromOutcome(latestPractice);
  const practiceContractId = activeExerciseId ?? latestPracticeContractIdForConcept(runtime, input.sessionId, currentConceptId);
  const latestAttempt = activeExerciseId ? latestExerciseAttempt(runtime, input.sessionId, activeExerciseId) : null;
  const latestAgentReview = practiceContractId ? latestAgentPracticeReview(runtime, input.sessionId, practiceContractId) : null;
  const latestPracticeResult = latestAttempt?.status ?? latestAgentReview?.review_status ?? null;
  const activePractice = Boolean(activeExerciseId && !latestAttempt && !latestAgentReview);
  const latestJudgement = loadLatestGuidedAnswerJudgement(runtime, input.sessionId, currentConceptId);
  const blockedReasons: string[] = [];

  if (decision.diagnostic_state !== "completed") blockedReasons.push("diagnostic_not_completed");
  if (decision.handoff_state !== "guidance_started") blockedReasons.push("guidance_not_started");
  if (frontier.status !== "active") blockedReasons.push("frontier_paused");
  if (decision.practice_state === "locked_by_stale_catalog") blockedReasons.push("stale_catalog");
  if (frontier.allowed_practice_concept_ids.length === 0) blockedReasons.push("practice_frontier_empty");
  if (activePractice) blockedReasons.push("active_practice");

  let phase: GuidanceLoopState["phase"] = "need_explanation";
  let autoPracticeMode: PracticeMode | null = null;
  let autoPracticeAllowed = false;

  if (activePractice) {
    phase = "active_practice";
  } else if (latestPracticeResult) {
    phase = "review_practice_result";
  } else if (counts.explain_concept === 0 && counts.remediate_concept === 0) {
    phase = "need_explanation";
    blockedReasons.push("concept_guidance_missing");
  } else if (counts.ask_guided_question === 0) {
    phase = "need_guided_question";
    blockedReasons.push("guided_question_missing");
  } else if (!latestJudgement) {
    phase = "awaiting_guided_answer";
    blockedReasons.push("guided_answer_missing");
  } else if (latestJudgement.judgement === "blocked") {
    phase = "need_remediation";
    blockedReasons.push("guided_answer_blocked");
  } else if (latestJudgement.judgement === "partial") {
    phase = "practice_ready";
    autoPracticeMode = "scaffolded";
  } else if (latestJudgement.confidence >= 0.8) {
    phase = "practice_ready";
    autoPracticeMode = "standard";
  } else {
    phase = "need_guided_question";
    blockedReasons.push("guided_answer_low_confidence");
  }

  if (phase === "practice_ready" && autoPracticeMode && blockedReasons.length === 0) {
    autoPracticeAllowed = true;
  }

  return {
    schema_version: "guidance_loop_state.v1",
    current_concept_id: currentConceptId,
    phase,
    latest_guided_answer_judgement: latestJudgement?.judgement ?? null,
    judgement_confidence: latestJudgement?.confidence ?? null,
    explanation_count: counts.explain_concept + counts.remediate_concept,
    guided_question_count: counts.ask_guided_question,
    active_practice: activePractice,
    active_exercise_id: practiceContractId,
    latest_practice_result: latestPracticeResult,
    auto_practice_allowed: autoPracticeAllowed,
    auto_practice_mode: autoPracticeMode,
    blocked_reasons: [...new Set(blockedReasons)],
  };
}

function latestAgentPracticeReview(runtime: AppRuntime, sessionId: string, practiceContractId: string): AgentPracticeReviewRow | null {
  return runtime.db.query<AgentPracticeReviewRow>(
    `SELECT review_status
     FROM agent_practice_reviews
     WHERE session_id = ? AND practice_contract_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
  ).get([sessionId, practiceContractId]) ?? null;
}

function latestPracticeContractIdForConcept(runtime: AppRuntime, sessionId: string, conceptId: string | null): string | null {
  const rows = runtime.db.query<{ id: string; concept_ids_json: string }>(
    `SELECT id, concept_ids_json
     FROM practice_contracts
     WHERE session_id = ?
     ORDER BY updated_at DESC
     LIMIT 20`,
  ).all([sessionId]);
  if (!conceptId) return rows[0]?.id ?? null;
  return rows.find((row) => parseConceptIds(row.concept_ids_json).includes(conceptId))?.id ?? null;
}

function loadAcceptedActionCounts(
  runtime: AppRuntime,
  sessionId: string,
  currentConceptId: string | null,
): Record<"explain_concept" | "ask_guided_question" | "remediate_concept", number> {
  const rows = runtime.db.query<ActionCountRow>(
    `SELECT action_kind, COUNT(*) AS count
     FROM tutor_agent_actions
     WHERE session_id = ?
       AND validation_status = 'accepted'
       AND (? IS NULL OR concept_id = ?)
       AND action_kind IN ('explain_concept', 'ask_guided_question', 'remediate_concept')
     GROUP BY action_kind`,
  ).all([sessionId, currentConceptId, currentConceptId]);
  return {
    explain_concept: Number(rows.find((row) => row.action_kind === "explain_concept")?.count ?? 0),
    ask_guided_question: Number(rows.find((row) => row.action_kind === "ask_guided_question")?.count ?? 0),
    remediate_concept: Number(rows.find((row) => row.action_kind === "remediate_concept")?.count ?? 0),
  };
}

function loadLatestGuidedAnswerJudgement(
  runtime: AppRuntime,
  sessionId: string,
  currentConceptId: string | null,
): { judgement: "understood" | "partial" | "blocked"; confidence: number } | null {
  const row = runtime.db.query<JudgementRow>(
    `SELECT payload_json
     FROM learning_events
     WHERE session_id = ?
       AND event_type = 'guided_answer_judged'
       AND (? IS NULL OR concept_ids_json LIKE ?)
     ORDER BY created_at DESC
     LIMIT 1`,
  ).get([sessionId, currentConceptId, currentConceptId ? `%${currentConceptId}%` : null]);
  if (!row) return null;
  const payload = parseJsonRecord(row.payload_json);
  const judgement = payload.judgement;
  if (judgement !== "understood" && judgement !== "partial" && judgement !== "blocked") return null;
  const confidence = typeof payload.confidence === "number" ? Math.max(0, Math.min(1, payload.confidence)) : 0;
  return { judgement, confidence };
}

function activeExerciseIdFromOutcome(outcome: PracticeOutcome | null): string | null {
  return outcome?.kind === "exercise_ready" ? outcome.exercise.id : null;
}

function latestExerciseAttempt(runtime: AppRuntime, sessionId: string, exerciseId: string): AttemptRow | null {
  return runtime.db.query<AttemptRow>(
    `SELECT status, score
     FROM exercise_attempts
     WHERE session_id = ? AND exercise_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
  ).get([sessionId, exerciseId]) ?? null;
}

function parseJsonRecord(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function parseConceptIds(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
