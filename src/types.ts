import type { AppDatabase } from "./db/database.js";

export type EnabledBatch = "batch-a" | "batch-b" | "batch-c" | "full";

export type SandboxStatus =
  | "passed"
  | "failed"
  | "timeout"
  | "runtime_error"
  | "syntax_error"
  | "sandbox_error"
  | "resource_limit";

export type SandboxResult = {
  request_id?: string;
  status: SandboxStatus;
  exit_code: number;
  stdout: string;
  stderr: string;
  traceback?: string;
  duration_ms: number;
  truncated: boolean;
  test_results?: Array<{
    name: string;
    passed: boolean;
    message: string;
  }>;
  diagnostics?: Array<{
    tool: string;
    code: string;
    line?: number;
    message: string;
  }>;
};

export type SandboxRunRequest = {
  request_id: string;
  code: string;
  stdin?: string;
  files?: Array<{ path: string; content: string }>;
  limits?: {
    timeout_ms?: number;
    memory_mb?: number;
    output_bytes?: number;
  };
};

export type SandboxClient = {
  runPython(request: SandboxRunRequest): Promise<SandboxResult>;
  runPytest(request: SandboxRunRequest & { public_tests: string }): Promise<SandboxResult>;
  lint(request: SandboxRunRequest): Promise<SandboxResult>;
};

export type RateLimitAction = "model" | "sandbox";

export type RateLimitPolicy = {
  maxRequests: number;
  windowMs: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  retryAfterMs: number;
  remaining: number;
  resetAt: number;
};

export type RateLimiter = {
  check(input: { sessionId: string; action: RateLimitAction; nowMs?: number }): RateLimitDecision;
};

export type ModelContextMessage = {
  role: "user" | "assistant" | "tool";
  text: string;
  turn_id: string;
  message_id: string;
};

export type ModelRequestContext = {
  strategy: "full_recent" | "context_compaction";
  compacted: boolean;
  summary: string | null;
  recent_messages: ModelContextMessage[];
  current_input: {
    message: string;
    code?: string;
  };
  omitted_turn_count: number;
  route?: IntentRoute;
  bundle?: ModelContextBundle;
};

export type StudentIntent =
  | "concept_explanation"
  | "code_understanding"
  | "debugging"
  | "exercise_request"
  | "exercise_submission"
  | "diagnostic_answer"
  | "progress_query"
  | "resource_recommendation"
  | "project_request"
  | "clarification"
  | "safety_refusal";

export type ToolGroupId =
  | "kb_read_tools"
  | "code_understanding_tools"
  | "debugging_tools"
  | "exercise_generation_tools"
  | "exercise_submission_tools"
  | "agent_practice_authoring_tools"
  | "agent_practice_review_tools"
  | "diagnostic_tools"
  | "progress_read_tools"
  | "resource_recommendation_tools"
  | "project_tools"
  | "read_only_tools"
  | "no_tools";

export type ContextBuilderId =
  | "concept_explanation"
  | "code_understanding"
  | "debugging"
  | "exercise_request"
  | "exercise_submission"
  | "diagnostic_answer"
  | "progress_query"
  | "resource_recommendation"
  | "project_request"
  | "clarification"
  | "safety_refusal";

export type IntentRoute = {
  intent: StudentIntent;
  confidence: number;
  target_concept_ids: string[];
  evidence_signals: string[];
  has_code: boolean;
  requires_tool: boolean;
  allowed_tool_group: ToolGroupId;
  context_builder: ContextBuilderId;
  risk_flags: Array<
    | "prompt_injection_attempt"
    | "asks_for_hidden_answer"
    | "oversized_code"
    | "ambiguous_submission"
    | "unknown_concept"
  >;
  clarification_question?: string;
  schema_version: "intent_route.v1";
};

export type ConceptMasterySnapshot = {
  concept_id: string;
  name: string;
  mastery_level: number;
  confidence: number;
  readiness?: number;
  evidence_count: number;
  review_priority: number;
};

export type LearningEventSummary = {
  event_type: string;
  concept_ids: string[];
  summary: string;
  created_at: string;
};

export type EvidenceSummary = {
  evidence_id: string;
  tool_name: string;
  result_code: string;
  summary: string;
  redacted: boolean;
};

export type PracticeContractSummary = {
  id: string;
  session_id: string;
  turn_id: string | null;
  tutor_agent_action_id?: string | null;
  concept_ids: string[];
  title: string;
  prompt_md: string;
  starter_code?: string | null;
  expected_behavior: string;
  visible_examples: Array<Record<string, unknown>>;
  acceptance_checklist: string[];
  allowed_solution_shape?: string | null;
  review_rubric: string;
  difficulty: number;
  progress_eligible: boolean;
  status: "active" | "submitted" | "completed" | "abandoned";
  created_at: string;
  updated_at: string;
};

export type AgentPracticeReviewStatus = "passed" | "partial" | "needs_revision" | "blocked_by_error";
export type AgentPracticeReviewConfidence = "high" | "medium" | "low";
export type AgentPracticeProgressEffect = "recorded" | "not_recorded" | "pending";

export type AgentPracticeReviewEvidenceSummary = {
  tool_name: string;
  result_code: string;
  summary: string;
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
  progress_effect: AgentPracticeProgressEffect;
  review_status?: AgentPracticeReviewStatus | null;
  confidence?: AgentPracticeReviewConfidence | null;
  score?: number | null;
  evaluator_confidence?: number | null;
  reason?: string | null;
  evidence_refs: AgentPracticeReviewEvidenceSummary[];
  created_at: string;
};

export type AgentPracticeReviewSummary = {
  id: string;
  practice_contract_id: string;
  session_id: string;
  turn_id: string | null;
  submitted_code_hash: string;
  review_status: AgentPracticeReviewStatus;
  confidence: AgentPracticeReviewConfidence;
  evidence_refs: AgentPracticeReviewEvidenceSummary[];
  learner_facing_summary: string;
  progress_effect: AgentPracticeProgressEffect;
  progress_reason?: string | null;
  recent_progress_evidence_id?: string | null;
  recorded_concept_ids?: string[];
  created_at: string;
};

export type PracticeSubmissionMetadata = {
  kind: "practice_submission";
  practice_contract_id: string;
  code: string;
};

export type AgentPracticeProgressUpdateOutcome = {
  review_id: string;
  progress_effect: AgentPracticeProgressEffect;
  recorded_concept_ids: string[];
  reason: string;
};

export type KbExcerpt = {
  source_id: string;
  title: string;
  text: string;
};

export type DiagnosticSessionSummary = {
  diagnostic_id: string;
  answered: number;
  completed: boolean;
  effective_answered?: number;
  min_questions?: number;
  min_effective_answers?: number;
  soft_cap?: number;
  hard_cap?: number;
  estimated_remaining_min?: number;
  estimated_remaining_max?: number;
  current_focus_concept_ids?: string[];
  completion_confidence?: number;
  placement_confidence?: number;
  leading_start_concept_id?: string | null;
  leading_start_label?: string | null;
  runner_up_start_concept_id?: string | null;
  confidence_margin?: number;
  current_focus_boundary_ids?: string[];
  diagnostic_status?: "active" | "technical_unavailable";
  starting_level?: string;
  weak_concept_ids?: string[];
  unresolved_concept_ids?: string[];
};

export type DiagnosticFeedback = {
  performance_summary: string;
  mastery_summary: string;
  learning_start: string;
};

export type GeneratedExerciseSummary = {
  exercise_id: string;
  concept_ids: string[];
  difficulty: number;
  prompt_md: string;
};

export type PracticeExerciseArtifact = {
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
  submission?: {
    endpoint: string;
    enabled: boolean;
  };
};

export type PracticeTarget = {
  concept_ids: string[];
  difficulty: number;
  provenance: string[];
};

export type PracticeMode = "standard" | "scaffolded" | "micro";

export type TutorAgentActionKind =
  | "explain_concept"
  | "ask_guided_question"
  | "evaluate_guided_answer"
  | "remediate_concept"
  | "request_structured_practice"
  | "review_practice_result"
  | "propose_next_concept"
  | "explain_status";

export type TutorAgentStatus = "active" | "paused";

export type TutorAgentAction = {
  action_kind: TutorAgentActionKind;
  concept_id: string | null;
  rationale: string;
  learner_facing_response: string;
  expected_learning_signal: string;
  requested_backend_action?: {
    type: "structured_practice" | "guided_answer_judgement" | "none";
    concept_ids?: string[];
  };
};

export type TutorAgentTurnPlan = {
  actions: TutorAgentAction[];
  learner_facing_response?: string;
};

export type GuidanceLoopPhase =
  | "need_explanation"
  | "need_guided_question"
  | "awaiting_guided_answer"
  | "practice_ready"
  | "active_practice"
  | "review_practice_result"
  | "need_remediation";

export type GuidanceLoopState = {
  schema_version: "guidance_loop_state.v1";
  current_concept_id: string | null;
  phase: GuidanceLoopPhase;
  latest_guided_answer_judgement: "understood" | "partial" | "blocked" | null;
  judgement_confidence: number | null;
  explanation_count: number;
  guided_question_count: number;
  active_practice: boolean;
  active_exercise_id: string | null;
  latest_practice_result: string | null;
  auto_practice_allowed: boolean;
  auto_practice_mode: PracticeMode | null;
  blocked_reasons: string[];
};

export type LearningFrontier = {
  schema_version: "learning_frontier.v1";
  status: TutorAgentStatus;
  current_concept_id: string | null;
  allowed_action_kinds: TutorAgentActionKind[];
  allowed_remediation_concept_ids: string[];
  allowed_practice_concept_ids: string[];
  allowed_next_concept_ids: string[];
  blocked_concept_ids: string[];
  selection_reason: string;
  catalog_identity: {
    run_id: string | null;
    version: string | null;
  };
  diagnostic_session_id?: string | null;
  reasons: string[];
};

export type TutorAgentStateSummary = {
  state_id: string;
  session_id: string;
  diagnostic_session_id: string | null;
  catalog_run_id: string | null;
  catalog_version: string | null;
  status: TutorAgentStatus;
  current_concept_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TutorAgentActionSummary = {
  action_id: string;
  turn_id?: string | null;
  action_kind: TutorAgentActionKind;
  concept_id: string | null;
  validation_status: "accepted" | "rejected";
  validation_code: string;
  learner_facing_response: string;
  created_at: string;
};

export type TutorAgentValidationResult = {
  accepted: boolean;
  code: string;
  reason: string;
};

export type PracticeLockReason =
  | LearningProgressPracticeState
  | "frontier_blocked"
  | "agent_action_required";

export type PracticeOutcome =
  | {
      schema_version: "practice_outcome.v1";
      kind: "exercise_ready";
      message: string;
      next_step: string;
      target: PracticeTarget;
      evidence: { result_code: string; tool_name?: string };
      exercise: PracticeExerciseArtifact;
      recommendation_id: string;
      agent_action_id?: string;
    }
  | {
      schema_version: "practice_outcome.v1";
      kind: "practice_locked";
      message: string;
      next_step: string;
      target: PracticeTarget;
      evidence: { result_code: string; tool_name?: string };
      reason: PracticeLockReason;
      agent_action_id?: string;
    }
  | {
      schema_version: "practice_outcome.v1";
      kind: "practice_unavailable";
      message: string;
      next_step: string;
      target: PracticeTarget;
      evidence: { result_code: string; tool_name?: string };
      reason: string;
      agent_action_id?: string;
    };

export type RecommendationFocusSummary = {
  concept_id: string;
  target_id: string;
  type: string;
  reason: string;
};

export type LearningProgressDiagnosticState =
  | "not_started"
  | "active"
  | "inconclusive"
  | "technical_unavailable"
  | "completed"
  | "catalog_stale";

export type LearningProgressHandoffState = "not_ready" | "feedback_ready" | "guidance_started";

export type LearningProgressPracticeState =
  | "locked_by_diagnostic"
  | "locked_by_stale_catalog"
  | "guidance_first"
  | "available_after_explicit_request";

export type ProgressProvenance =
  | { source: "active_diagnostic"; session_id: string; diagnostic_session_id: string; catalog_run_id?: string; concept_id?: string; unit_id?: string }
  | { source: "explicit_user_goal"; session_id?: string; captured_at: string }
  | { source: "active_catalog"; catalog_run_id?: string; concept_id?: string; unit_id?: string; reason?: string }
  | { source: "mastery_projection"; concept_ids: string[]; reason?: string }
  | { source: "recommendation_ranker"; concept_ids: string[]; reason?: string }
  | { source: "diagnostic_gate"; reason: string };

export type LearningProgressUnit = {
  id: string;
  title: string;
  kind: "diagnostic" | "catalog" | "status";
  concept_ids: string[];
  reason: string;
  mastery_percent?: number;
};

export type LearningProgressStart = {
  concept_id: string | null;
  label: string;
};

export type LearningProgressChapter = {
  id: string;
  title: string;
  concept_ids: string[];
  mastery_percent: number;
  status: "completed" | "current" | "upcoming";
};

export type LearningProgressDecision = {
  schema_version: "learning_progress_decision.v1";
  diagnostic_state: LearningProgressDiagnosticState;
  handoff_state: LearningProgressHandoffState;
  practice_state: LearningProgressPracticeState;
  reasons: string[];
  current_level: string | null;
  current_goal: string | null;
  learning_start: LearningProgressStart | null;
  current_unit: LearningProgressUnit;
  course_progress_percent: number;
  recent_progress_evidence: RecentProgressEvidenceSummary | null;
  diagnostic: DiagnosticSessionSummary & { completed: boolean };
  diagnostic_focus: RecommendationFocusSummary[];
  recommendation_focus: RecommendationFocusSummary[];
  diagnostic_feedback: DiagnosticFeedback | null;
  curriculum: LearningProgressChapter[];
  mastery: Array<{ concept_id: string; name: string; mastery_level: number; confidence: number; review_priority: number }>;
  weak_concepts: Array<{ concept_id: string; name: string; reason: string }>;
  provenance: {
    current_level: ProgressProvenance | null;
    current_goal: ProgressProvenance | null;
    learning_start: ProgressProvenance | null;
    current_unit: ProgressProvenance | null;
    recommendation_focus: ProgressProvenance | null;
  };
};

export type LearningProgressDecisionContextSummary = Pick<LearningProgressDecision,
  | "schema_version"
  | "diagnostic_state"
  | "handoff_state"
  | "practice_state"
  | "reasons"
  | "current_level"
  | "current_goal"
  | "learning_start"
  | "current_unit"
  | "course_progress_percent"
  | "recent_progress_evidence"
  | "diagnostic_focus"
  | "recommendation_focus"
  | "provenance"
> & {
  diagnostic: DiagnosticSessionSummary & { completed: boolean };
};

export type TaskContract =
  | { kind: "concept_explanation"; required_output: "explanation_example_mistake_next_step" }
  | { kind: "debugging"; required_output: "debug_judgement"; max_hint_level: 5 }
  | { kind: "exercise_request"; required_output: "generated_exercise_artifact" }
  | { kind: "exercise_submission"; required_output: "submission_judgement" }
  | { kind: "diagnostic_answer"; required_output: "diagnostic_score_and_state_update" }
  | { kind: "progress_query"; required_output: "progress_summary" }
  | { kind: "resource_recommendation"; required_output: "resource_recommendations" }
  | { kind: "code_understanding"; required_output: "code_explanation" }
  | { kind: "project_request" | "clarification" | "safety_refusal"; required_output: string };

export type ModelContextBundle = {
  route: IntentRoute;
  system_contract: {
    course_name: string;
    response_language: "zh";
    teaching_policy: string;
    tool_policy: ToolGroupId;
  };
  server_attested_state: {
    profile_summary?: string;
    concept_mastery?: ConceptMasterySnapshot[];
    recent_learning_events?: LearningEventSummary[];
    active_diagnostic?: DiagnosticSessionSummary;
    learning_progress_decision?: LearningProgressDecisionContextSummary;
    tutor_agent_state?: TutorAgentStateSummary;
    learning_frontier?: LearningFrontier;
    guidance_loop_state?: GuidanceLoopState;
    recent_tutor_agent_actions?: TutorAgentActionSummary[];
    latest_practice_outcome?: PracticeOutcome;
    active_practice_contract?: PracticeContractSummary | null;
    latest_agent_practice_review?: AgentPracticeReviewSummary | null;
    recommendation_focus?: RecommendationFocusSummary[];
    active_exercise?: GeneratedExerciseSummary;
    session_summary?: string;
  };
  untrusted_inputs: {
    user_message: string;
    student_code?: string;
    kb_excerpts?: KbExcerpt[];
    tool_outputs?: EvidenceSummary[];
  };
  task_contract: TaskContract;
  context_budget: {
    max_chars: number;
    omitted_sections: string[];
    redaction_applied: boolean;
  };
  schema_version: "model_context_bundle.v1";
};

export type TutorRequest = {
  message: string;
  code?: string;
  context: ModelRequestContext;
};

export type TutorResponder = {
  generate(request: TutorRequest): Promise<string>;
};

export type AiReasoning = "minimal" | "low" | "medium" | "high" | "xhigh";
export type AiApi = "openai-responses";

export type AppConfig = {
  appDataDir: string;
  dbPath: string;
  kbRoot: string;
  kbVersion: string;
  enabledBatch: EnabledBatch;
  ai?: {
    provider: string;
    api?: AiApi;
    baseUrl?: string;
    model: string;
    apiKey: string;
    timeoutMs: number;
    maxOutputTokens: number;
    reasoning?: AiReasoning;
  };
  sandboxImage: string;
  sandboxServiceUrl?: string;
  sandboxHardLimits: {
    timeoutMs: number;
    pytestTimeoutMs: number;
    memoryMb: number;
    outputBytes: number;
  };
};

export type AppRuntime = {
  db: AppDatabase;
  config: AppConfig;
  sandbox: SandboxClient;
  rateLimiter: RateLimiter;
  tutor?: TutorResponder;
};

export type ToolEnvelope<TData = unknown> = {
  ok: boolean;
  code: string;
  message: string;
  data: TData;
  metadata: {
    tool: string;
    duration_ms: number;
    truncated?: boolean;
    source?: string;
    [key: string]: unknown;
  };
};

export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(code: string, message: string, statusCode = 400, retryable = false) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}
