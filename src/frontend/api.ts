import type { AgentSseEvent } from "./state.js";

export async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(body.message ?? response.statusText);
  }
  return response.json() as Promise<T>;
}

export function connectEvents(sessionId: string, onEvent: (event: AgentSseEvent) => void, onError: () => void): EventSource {
  const source = new EventSource(`/api/sessions/${encodeURIComponent(sessionId)}/events`);
  for (const eventName of ["message_delta", "tool_start", "tool_end", "learning_event_recorded", "error", "done"]) {
    source.addEventListener(eventName, (event) => {
      onEvent(JSON.parse((event as MessageEvent).data) as AgentSseEvent);
    });
  }
  source.onerror = () => onError();
  return source;
}

export type SessionResponse = { session_id: string; stream_url: string };
export type RunCodeResponse = {
  ok: boolean;
  code: string;
  message: string;
  result: { status: string; stdout: string; stderr: string; traceback: string; duration_ms: number; truncated: boolean };
};

export type ExerciseResponse = {
  exercise: {
    id: string;
    practice_contract_id?: string;
    title: string;
    difficulty: number;
    concept_ids: string[];
    prompt_md: string;
    starter_code?: string | null;
    expected_behavior?: string;
    acceptance_checklist?: string[];
    samples: Array<{ stdin: string; stdout: string }>;
    hint_level: number;
  };
  recommendation_id: string;
};

export type PracticeOutcome =
  | {
      schema_version: "practice_outcome.v1";
      kind: "exercise_ready";
      message: string;
      next_step: string;
      target: { concept_ids: string[]; difficulty: number; provenance: string[] };
      evidence: { result_code: string; tool_name?: string };
      exercise: ExerciseResponse["exercise"];
      recommendation_id: string;
      agent_action_id?: string;
    }
  | {
      schema_version: "practice_outcome.v1";
      kind: "practice_locked" | "practice_unavailable";
      message: string;
      next_step: string;
      target: { concept_ids: string[]; difficulty: number; provenance: string[] };
      evidence: { result_code: string; tool_name?: string };
      reason?: string;
      agent_action_id?: string;
    };

export type TutorAgentState = {
  state_id: string;
  status: "active" | "paused";
  current_concept_id: string | null;
  catalog_version: string | null;
};

export type TutorAgentActionSummary = {
  action_id: string;
  turn_id?: string | null;
  action_kind: string;
  concept_id: string | null;
  validation_status: "accepted" | "rejected";
  validation_code: string;
};

export type GuidanceLoopState = {
  schema_version: "guidance_loop_state.v1";
  current_concept_id: string | null;
  phase:
    | "need_explanation"
    | "need_guided_question"
    | "awaiting_guided_answer"
    | "practice_ready"
    | "active_practice"
    | "review_practice_result"
    | "need_remediation";
  latest_guided_answer_judgement: "understood" | "partial" | "blocked" | null;
  judgement_confidence: number | null;
  explanation_count: number;
  guided_question_count: number;
  active_practice: boolean;
  active_exercise_id: string | null;
  latest_practice_result: string | null;
  auto_practice_allowed: boolean;
  auto_practice_mode: "standard" | "scaffolded" | "micro" | null;
  blocked_reasons: string[];
};

export type LearningFrontier = {
  schema_version: "learning_frontier.v1";
  status: "active" | "paused";
  current_concept_id: string | null;
  allowed_action_kinds: string[];
  allowed_remediation_concept_ids: string[];
  allowed_practice_concept_ids: string[];
  allowed_next_concept_ids: string[];
  blocked_concept_ids: string[];
  selection_reason: string;
  catalog_identity: { run_id: string | null; version: string | null };
  reasons: string[];
};

export type PracticeContractSummary = {
  id: string;
  title: string;
  difficulty: number;
  concept_ids: string[];
  prompt_md: string;
  starter_code?: string | null;
  expected_behavior: string;
  acceptance_checklist: string[];
  status: "active" | "submitted" | "completed" | "abandoned";
};

export type AgentPracticeReviewSummary = {
  id: string;
  practice_contract_id: string;
  review_status: "passed" | "partial" | "needs_revision" | "blocked_by_error";
  confidence: "high" | "medium" | "low";
  evidence_refs: Array<{ tool_name: string; result_code: string; summary: string }>;
  learner_facing_summary: string;
  progress_effect: "recorded" | "not_recorded" | "pending";
  progress_reason?: string | null;
  recent_progress_evidence_id?: string | null;
  recorded_concept_ids?: string[];
};

export type RecentProgressEvidenceSummary = {
  source_type: "diagnostic" | "exercise" | "project" | "tutor_review" | "mistake";
  source_id: string;
  evidence_ids: string[];
  review_id?: string | null;
  practice_contract_id?: string | null;
  concept_ids: string[];
  concepts: Array<{ concept_id: string; label: string }>;
  outcome: string;
  progress_effect: "recorded" | "not_recorded" | "pending";
  review_status?: "passed" | "partial" | "needs_revision" | "blocked_by_error" | null;
  confidence?: "high" | "medium" | "low" | null;
  score?: number | null;
  evaluator_confidence?: number | null;
  reason?: string | null;
  evidence_refs: Array<{ tool_name: string; result_code: string; summary: string }>;
  created_at: string;
};

export type SessionSnapshotResponse = {
  session_id: string;
  last_event_id: string | null;
  turns: Array<{
    turn_id: string;
    status: string;
    user_message: { text: string; code_ref?: string };
    assistant_messages: Array<{ message_id: string; text: string }>;
    turn_error?: { code: string; message: string; retryable: boolean };
    tool_summaries: Array<{ tool_call_id: string; tool_name: string; ok: boolean; code: string; summary: string }>;
    annotations?: {
      tutor_actions: TutorAgentActionSummary[];
      guidance_loop_state?: GuidanceLoopState | null;
      practice_review?: AgentPracticeReviewSummary | null;
      progress_evidence?: RecentProgressEvidenceSummary | null;
    };
  }>;
  active_exercise: ExerciseResponse["exercise"] | null;
  active_practice_outcome?: PracticeOutcome | null;
  active_practice_contract?: PracticeContractSummary | null;
  latest_agent_practice_review?: AgentPracticeReviewSummary | null;
  recent_progress_evidence?: RecentProgressEvidenceSummary | null;
  tutor_agent_state?: TutorAgentState | null;
  guidance_loop_state?: GuidanceLoopState | null;
  recent_tutor_agent_actions?: TutorAgentActionSummary[];
  latest_tutor_agent_frontier?: LearningFrontier | null;
  current_concept_id?: string | null;
  active_project_step: null;
};

export type AdaptiveDiagnosticProgress = {
  answered: number;
  total: number;
  effective_answered: number;
  min_questions: number;
  min_effective_answers: number;
  soft_cap: number;
  hard_cap: number;
  estimated_remaining_min: number;
  estimated_remaining_max: number;
  current_focus_concept_ids: string[];
  completion_confidence: number;
  placement_confidence: number;
  leading_start_concept_id: string | null;
  leading_start_label: string | null;
  runner_up_start_concept_id: string | null;
  confidence_margin: number;
  current_focus_boundary_ids: string[];
  diagnostic_status: "active" | "technical_unavailable";
};

export type DiagnosticFeedback = {
  performance_summary: string;
  mastery_summary: string;
  learning_start: string;
};

export type LearningProgressDecision = {
  schema_version: "learning_progress_decision.v1";
  diagnostic_state: "not_started" | "active" | "inconclusive" | "technical_unavailable" | "completed" | "catalog_stale";
  handoff_state: "not_ready" | "feedback_ready" | "guidance_started";
  practice_state: "locked_by_diagnostic" | "locked_by_stale_catalog" | "guidance_first" | "available_after_explicit_request";
  reasons: string[];
  current_level: string | null;
  current_goal: string | null;
  learning_start: { concept_id: string | null; label: string } | null;
  current_unit: {
    id: string;
    title: string;
    kind: "diagnostic" | "catalog" | "status";
    concept_ids: string[];
    reason: string;
    mastery_percent?: number;
  };
  course_progress_percent: number;
  recent_progress_evidence?: RecentProgressEvidenceSummary | null;
  diagnostic_focus: Array<{ concept_id: string; target_id: string; type: string; reason: string }>;
  recommendation_focus: Array<{ concept_id: string; target_id: string; type: string; reason: string }>;
  diagnostic_feedback: DiagnosticFeedback | null;
  provenance: Record<string, unknown>;
};

export type ProgressResponse = {
  profile_summary: string;
  current_level: string;
  current_goal: string | null;
  course_progress_percent: number;
  recent_progress_evidence?: RecentProgressEvidenceSummary | null;
  current_chapter_id: string;
  current_chapter_title: string;
  diagnostic: AdaptiveDiagnosticProgress & { completed: boolean };
  diagnostic_feedback: DiagnosticFeedback | null;
  curriculum: Array<{
    id: string;
    title: string;
    concept_ids: string[];
    mastery_percent: number;
    status: "completed" | "current" | "upcoming";
  }>;
  mastery: Array<{ concept_id: string; name: string; mastery_level: number; confidence: number; review_priority: number }>;
  weak_concepts: Array<{ concept_id: string; name: string; reason: string }>;
  recommendations: Array<{ id: string; type: string; target_id: string; reason: string }>;
  progress_decision?: LearningProgressDecision;
};

export type DiagnosticResponse = {
  diagnostic_id: string;
  completed: boolean;
  question?: {
    id: string;
    concept_ids: string[];
    type: string;
    prompt_md: string;
    choices: Array<{ id: string; text: string }>;
    estimated_seconds: number;
  };
  progress: AdaptiveDiagnosticProgress;
};

export type DiagnosticAnswerResponse = {
  accepted: true;
  completed: boolean;
  next_question_url: string;
};

export type ProjectState = {
  project_plan: null | { id: string; title: string; status: string; summary: string };
  steps: Array<{ id: string; order: number; title: string; status: string; acceptance_criteria: string[] }>;
  active_step_id: string | null;
};
