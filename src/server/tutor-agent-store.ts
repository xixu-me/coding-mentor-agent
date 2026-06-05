import type {
  AppRuntime,
  LearningFrontier,
  TutorAgentAction,
  TutorAgentActionKind,
  TutorAgentActionSummary,
  TutorAgentStateSummary,
  TutorAgentValidationResult,
} from "../types.js";
import { AppError } from "../types.js";
import { createId, nowIso } from "../security/ids.js";
import { redactText, safeJson, summarizeText } from "../security/redaction.js";
import { getLatestCatalogRun } from "./course-catalog.js";
import { recordEvidenceAndProject } from "./progress-policy.js";

type StateRow = {
  id: string;
  session_id: string;
  diagnostic_session_id: string | null;
  catalog_run_id: string | null;
  catalog_version: string | null;
  status: "active" | "paused";
  current_concept_id: string | null;
  created_at: string;
  updated_at: string;
};

type ActionRow = {
  id: string;
  turn_id: string | null;
  action_kind: TutorAgentActionKind;
  concept_id: string | null;
  validation_status: "accepted" | "rejected";
  validation_code: string;
  learner_facing_response: string;
  created_at: string;
};

export function createOrResumeTutorAgentState(
  runtime: AppRuntime,
  input: {
    sessionId: string;
    diagnosticSessionId?: string | null;
    currentConceptId?: string | null;
    status?: "active" | "paused";
  },
): TutorAgentStateSummary {
  const now = nowIso();
  const catalog = getLatestCatalogRun(runtime);
  const existing = loadTutorAgentState(runtime, input.sessionId);
  if (existing) {
    runtime.db.query(
      `UPDATE tutor_agent_states
       SET diagnostic_session_id = COALESCE(?, diagnostic_session_id),
           catalog_run_id = ?,
           catalog_version = ?,
           status = ?,
           current_concept_id = COALESCE(?, current_concept_id),
           updated_at = ?
       WHERE id = ?`,
    ).run([
      input.diagnosticSessionId ?? null,
      catalog?.id ?? null,
      catalog?.kb_version ?? null,
      input.status ?? "active",
      input.currentConceptId ?? null,
      now,
      existing.state_id,
    ]);
    return loadTutorAgentState(runtime, input.sessionId)!;
  }

  const stateId = createId("ta_state");
  runtime.db.query(
    `INSERT INTO tutor_agent_states(
      id, session_id, diagnostic_session_id, catalog_run_id, catalog_version,
      status, current_concept_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run([
    stateId,
    input.sessionId,
    input.diagnosticSessionId ?? null,
    catalog?.id ?? null,
    catalog?.kb_version ?? null,
    input.status ?? "active",
    input.currentConceptId ?? null,
    now,
    now,
  ]);
  return loadTutorAgentState(runtime, input.sessionId)!;
}

export function loadTutorAgentState(runtime: AppRuntime, sessionId: string): TutorAgentStateSummary | null {
  const row = runtime.db.query<StateRow>(
    `SELECT id, session_id, diagnostic_session_id, catalog_run_id, catalog_version, status, current_concept_id, created_at, updated_at
     FROM tutor_agent_states
     WHERE session_id = ?
     ORDER BY updated_at DESC
     LIMIT 1`,
  ).get([sessionId]);
  return row ? toStateSummary(row) : null;
}

export function hasFreshTutorAgentState(runtime: AppRuntime, sessionId: string): boolean {
  const state = loadTutorAgentState(runtime, sessionId);
  if (!state) return false;
  const catalog = getLatestCatalogRun(runtime);
  return state.status === "active"
    && state.catalog_run_id === (catalog?.id ?? null)
    && state.catalog_version === (catalog?.kb_version ?? null);
}

export function recordTutorAgentAction(
  runtime: AppRuntime,
  input: {
    stateId?: string | null;
    sessionId: string;
    turnId?: string | null;
    action: TutorAgentAction | null;
    validation: TutorAgentValidationResult;
    fallbackResponse?: string;
  },
): TutorAgentActionSummary {
  const actionId = createId("ta_action");
  const now = nowIso();
  const action = input.action;
  const actionKind = action?.action_kind ?? "explain_status";
  const learnerResponse = redactText(input.fallbackResponse ?? action?.learner_facing_response ?? "", 1200);
  runtime.db.query(
    `INSERT INTO tutor_agent_actions(
      id, state_id, session_id, turn_id, action_kind, concept_id, action_json,
      validation_status, validation_code, validation_reason, learner_facing_response, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run([
    actionId,
    input.stateId ?? null,
    input.sessionId,
    input.turnId ?? null,
    actionKind,
    action?.concept_id ?? null,
    safeJson(sanitizeActionForStorage(action)),
    input.validation.accepted ? "accepted" : "rejected",
    input.validation.code,
    summarizeText(input.validation.reason, 300),
    learnerResponse,
    now,
  ]);
  return {
    action_id: actionId,
    turn_id: input.turnId ?? null,
    action_kind: actionKind,
    concept_id: action?.concept_id ?? null,
    validation_status: input.validation.accepted ? "accepted" : "rejected",
    validation_code: input.validation.code,
    learner_facing_response: learnerResponse,
    created_at: now,
  };
}

export function loadTutorAgentAction(runtime: AppRuntime, actionId: string): TutorAgentActionSummary | null {
  const row = runtime.db.query<ActionRow>(
    `SELECT id, turn_id, action_kind, concept_id, validation_status, validation_code, learner_facing_response, created_at
     FROM tutor_agent_actions
     WHERE id = ?`,
  ).get([actionId]);
  return row ? toActionSummary(row) : null;
}

export function loadRecentTutorAgentActions(runtime: AppRuntime, sessionId: string, limit = 5): TutorAgentActionSummary[] {
  return runtime.db.query<ActionRow>(
    `SELECT id, turn_id, action_kind, concept_id, validation_status, validation_code, learner_facing_response, created_at
     FROM tutor_agent_actions
     WHERE session_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
  ).all([sessionId, Math.max(1, Math.min(10, limit))]).map(toActionSummary);
}

export function loadTutorAgentActionsForTurns(runtime: AppRuntime, sessionId: string, turnIds: string[]): Map<string, TutorAgentActionSummary[]> {
  const uniqueTurnIds = [...new Set(turnIds)].filter(Boolean).slice(0, 100);
  const byTurn = new Map<string, TutorAgentActionSummary[]>();
  if (uniqueTurnIds.length === 0) return byTurn;
  const placeholders = uniqueTurnIds.map(() => "?").join(", ");
  const rows = runtime.db.query<ActionRow>(
    `SELECT id, turn_id, action_kind, concept_id, validation_status, validation_code, learner_facing_response, created_at
     FROM tutor_agent_actions
     WHERE session_id = ? AND turn_id IN (${placeholders})
     ORDER BY created_at ASC, id ASC`,
  ).all([sessionId, ...uniqueTurnIds]);
  for (const action of rows.map(toActionSummary)) {
    if (!action.turn_id) continue;
    byTurn.set(action.turn_id, [...(byTurn.get(action.turn_id) ?? []), action]);
  }
  return byTurn;
}

export function saveTutorAgentFrontierSnapshot(
  runtime: AppRuntime,
  input: { stateId?: string | null; sessionId: string; turnId?: string | null; frontier: LearningFrontier },
): void {
  runtime.db.query(
    "INSERT INTO tutor_agent_frontier_snapshots(id, state_id, session_id, turn_id, frontier_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run([
    createId("ta_frontier"),
    input.stateId ?? null,
    input.sessionId,
    input.turnId ?? null,
    safeJson(input.frontier),
    nowIso(),
  ]);
}

export function loadLatestTutorAgentFrontier(runtime: AppRuntime, sessionId: string): LearningFrontier | null {
  const row = runtime.db.query<{ frontier_json: string }>(
    "SELECT frontier_json FROM tutor_agent_frontier_snapshots WHERE session_id = ? ORDER BY created_at DESC LIMIT 1",
  ).get([sessionId]);
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.frontier_json) as LearningFrontier;
    return parsed?.schema_version === "learning_frontier.v1" ? parsed : null;
  } catch {
    return null;
  }
}

export function assertAcceptedTutorAgentAction(
  runtime: AppRuntime,
  input: { sessionId: string; actionId: string; conceptIds: string[]; expectedKind?: TutorAgentActionKind },
): TutorAgentActionSummary {
  const action = loadTutorAgentAction(runtime, input.actionId);
  if (!action || action.validation_status !== "accepted") {
    throw new AppError("VALIDATION_ERROR", "Agent-owned practice requires an accepted tutor action.");
  }
  if (action.concept_id && !input.conceptIds.includes(action.concept_id)) {
    throw new AppError("VALIDATION_ERROR", "Agent action concept does not match the requested practice target.");
  }
  if (input.expectedKind && action.action_kind !== input.expectedKind) {
    throw new AppError("VALIDATION_ERROR", "Agent action kind does not match the workflow.");
  }
  const state = runtime.db.query<{ session_id: string }>(
    "SELECT session_id FROM tutor_agent_actions WHERE id = ?",
  ).get([input.actionId]);
  if (state?.session_id !== input.sessionId) {
    throw new AppError("VALIDATION_ERROR", "Agent action does not belong to the active session.");
  }
  return action;
}

export function recordGuidedAnswerJudgement(
  runtime: AppRuntime,
  input: {
    sessionId: string;
    turnId?: string | null;
    agentActionId: string;
    conceptId: string;
    judgement: "understood" | "partial" | "blocked";
    confidence: number;
    misconceptionSummary?: string;
  },
): { event_id: string; evidence_id?: string } {
  const action = assertAcceptedTutorAgentAction(runtime, {
    sessionId: input.sessionId,
    actionId: input.agentActionId,
    conceptIds: [input.conceptId],
  });
  const confidence = Math.max(0, Math.min(1, input.confidence));
  const now = nowIso();
  const eventId = createId("evt");
  const turnId = existingTurnId(runtime, input.sessionId, input.turnId ?? null);
  const payload = {
    schema_version: "guided_answer_judgement.v1",
    agent_action_id: input.agentActionId,
    concept_id: input.conceptId,
    judgement: input.judgement,
    confidence,
    misconception_summary: summarizeText(input.misconceptionSummary ?? "", 240),
    validation_result: action.validation_status,
  };
  runtime.db.query(
    "INSERT INTO learning_events(id, session_id, turn_id, tool_call_id, event_type, concept_ids_json, payload_json, evidence_json, idempotency_key, created_at) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)",
  ).run([
    eventId,
    input.sessionId,
    turnId,
    "guided_answer_judged",
    JSON.stringify([input.conceptId]),
    safeJson(payload),
    safeJson({ agent_action_id: input.agentActionId, validation_result: action.validation_status }),
    `guided_answer:${input.agentActionId}:${input.conceptId}:${input.judgement}`,
    now,
  ]);

  if (input.judgement !== "understood" || confidence < 0.8) {
    return { event_id: eventId };
  }
  const evidence = recordEvidenceAndProject(runtime, {
    sourceType: "tutor_review",
    sourceId: input.agentActionId,
    sessionId: input.sessionId,
    turnId,
    conceptId: input.conceptId,
    outcome: "explained_mistake",
    evaluatorConfidence: confidence,
    evidenceWeight: 0.25,
    summary: payload,
    audit: false,
  });
  return { event_id: eventId, evidence_id: evidence.evidenceId };
}

function existingTurnId(runtime: AppRuntime, sessionId: string, turnId: string | null): string | null {
  if (!turnId) return null;
  return runtime.db.query<{ id: string }>("SELECT id FROM session_turns WHERE session_id = ? AND id = ?").get([sessionId, turnId])?.id ?? null;
}

function toStateSummary(row: StateRow): TutorAgentStateSummary {
  return {
    state_id: row.id,
    session_id: row.session_id,
    diagnostic_session_id: row.diagnostic_session_id,
    catalog_run_id: row.catalog_run_id,
    catalog_version: row.catalog_version,
    status: row.status,
    current_concept_id: row.current_concept_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toActionSummary(row: ActionRow): TutorAgentActionSummary {
  return {
    action_id: row.id,
    turn_id: row.turn_id,
    action_kind: row.action_kind,
    concept_id: row.concept_id,
    validation_status: row.validation_status,
    validation_code: row.validation_code,
    learner_facing_response: redactText(row.learner_facing_response, 800),
    created_at: row.created_at,
  };
}

function sanitizeActionForStorage(action: TutorAgentAction | null): unknown {
  if (!action) return {};
  return {
    action_kind: action.action_kind,
    concept_id: action.concept_id,
    rationale: summarizeText(action.rationale, 300),
    learner_facing_response: redactText(action.learner_facing_response, 1200),
    expected_learning_signal: summarizeText(action.expected_learning_signal, 200),
    requested_backend_action: action.requested_backend_action
      ? {
        type: action.requested_backend_action.type,
        concept_ids: action.requested_backend_action.concept_ids?.slice(0, 5),
      }
      : undefined,
  };
}
