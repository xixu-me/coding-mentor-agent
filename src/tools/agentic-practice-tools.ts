import type {
  AgentPracticeProgressUpdateOutcome,
  AgentPracticeReviewConfidence,
  AgentPracticeReviewEvidenceSummary,
  AgentPracticeReviewStatus,
  AgentPracticeReviewSummary,
  AgentPracticeProgressEffect,
  AppRuntime,
  PracticeContractSummary,
  SandboxResult,
  ToolEnvelope,
} from "../types.js";
import { AppError } from "../types.js";
import { createId, nowIso, stableHash } from "../security/ids.js";
import { summarizeText } from "../security/redaction.js";
import { getCatalogConceptById, getCatalogProgressPolicyInputMap, getLatestCatalogRun } from "../server/course-catalog.js";
import { deriveLearningFrontier } from "../server/learning-frontier.js";
import { evidenceWeightForOutcome, recordEvidenceAndProject } from "../server/progress-policy.js";
import { errorEnvelope, okEnvelope } from "./envelope.js";

type ToolRunContext = {
  sessionId?: string | null;
  turnId?: string | null;
};

type PracticeContractRow = {
  id: string;
  session_id: string;
  turn_id: string | null;
  tutor_agent_action_id: string | null;
  concept_ids_json: string;
  title: string;
  prompt_md: string;
  starter_code: string | null;
  expected_behavior: string;
  visible_examples_json: string;
  acceptance_checklist_json: string;
  allowed_solution_shape: string | null;
  review_rubric: string;
  difficulty: number;
  progress_eligible: number;
  status: "active" | "submitted" | "completed" | "abandoned";
  created_at: string;
  updated_at: string;
};

type AgentPracticeReviewRow = {
  id: string;
  practice_contract_id: string;
  session_id: string;
  turn_id: string | null;
  submitted_code_hash: string;
  review_status: AgentPracticeReviewStatus;
  confidence: AgentPracticeReviewConfidence;
  evidence_refs_json: string;
  learner_facing_summary: string;
  progress_effect: AgentPracticeProgressEffect;
  progress_reason: string | null;
  created_at: string;
};

export async function createPracticeContract(runtime: AppRuntime, params: unknown, context: ToolRunContext = {}): Promise<ToolEnvelope<{
  contract: PracticeContractSummary;
}>> {
  const started = Date.now();
  try {
    const sessionId = requireContext(context).sessionId;
    const turnId = requireContext(context).turnId;
    const input = parseContractParams(params);
    const contract = persistPracticeContract(runtime, {
      ...input,
      session_id: sessionId,
      turn_id: turnId,
      tutor_agent_action_id: null,
    });
    return okEnvelope("create_practice_contract", started, { contract });
  } catch (error) {
    return errorEnvelope("create_practice_contract", started, error, { contract: emptyContract() });
  }
}

export function persistPracticeContract(runtime: AppRuntime, input: {
  session_id: string;
  turn_id?: string | null;
  tutor_agent_action_id?: string | null;
  concept_ids: string[];
  title: string;
  prompt_md: string;
  starter_code?: string | null;
  expected_behavior: string;
  visible_examples?: Array<Record<string, unknown>>;
  acceptance_checklist: string[];
  allowed_solution_shape?: string | null;
  review_rubric: string;
  difficulty: number;
  progress_eligible: boolean;
}): PracticeContractSummary {
  const now = nowIso();
  const id = createId("prac");
  runtime.db.query(
    `INSERT INTO practice_contracts(
      id, session_id, turn_id, tutor_agent_action_id, concept_ids_json, title, prompt_md, starter_code,
      expected_behavior, visible_examples_json, acceptance_checklist_json, allowed_solution_shape,
      review_rubric, difficulty, progress_eligible, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
  ).run([
    id,
    input.session_id,
    input.turn_id ?? null,
    input.tutor_agent_action_id ?? null,
    JSON.stringify(input.concept_ids.slice(0, 5)),
    summarizeText(input.title, 120),
    summarizeText(input.prompt_md, 4000),
    input.starter_code ? summarizeText(input.starter_code, 4000) : null,
    summarizeText(input.expected_behavior, 1000),
    JSON.stringify((input.visible_examples ?? []).slice(0, 5)),
    JSON.stringify(input.acceptance_checklist.map((item) => summarizeText(item, 300)).slice(0, 8)),
    input.allowed_solution_shape ? summarizeText(input.allowed_solution_shape, 300) : null,
    summarizeText(input.review_rubric, 1000),
    Math.max(1, Math.min(5, Math.round(input.difficulty))),
    input.progress_eligible ? 1 : 0,
    now,
    now,
  ]);
  return rowToContract(loadContractById(runtime, id, input.session_id));
}

export function loadActivePracticeContractSummary(runtime: AppRuntime, sessionId: string): PracticeContractSummary | null {
  const row = runtime.db.query<PracticeContractRow>(
    "SELECT * FROM practice_contracts WHERE session_id = ? AND status IN ('active', 'submitted') ORDER BY created_at DESC LIMIT 1",
  ).get([sessionId]);
  return row ? rowToContract(row) : null;
}

export function loadLatestAgentPracticeReviewSummary(runtime: AppRuntime, sessionId: string, practiceContractId?: string | null): AgentPracticeReviewSummary | null {
  const row = practiceContractId
    ? runtime.db.query<AgentPracticeReviewRow>(
      "SELECT * FROM agent_practice_reviews WHERE session_id = ? AND practice_contract_id = ? ORDER BY created_at DESC LIMIT 1",
    ).get([sessionId, practiceContractId])
    : runtime.db.query<AgentPracticeReviewRow>(
      "SELECT * FROM agent_practice_reviews WHERE session_id = ? ORDER BY created_at DESC LIMIT 1",
    ).get([sessionId]);
  return row ? rowToReview(row) : null;
}

export function loadAgentPracticeReviewSummariesForTurns(runtime: AppRuntime, sessionId: string, turnIds: string[]): Map<string, AgentPracticeReviewSummary> {
  const uniqueTurnIds = [...new Set(turnIds)].filter(Boolean).slice(0, 100);
  const byTurn = new Map<string, AgentPracticeReviewSummary>();
  if (uniqueTurnIds.length === 0) return byTurn;
  const placeholders = uniqueTurnIds.map(() => "?").join(", ");
  const rows = runtime.db.query<AgentPracticeReviewRow>(
    `SELECT *
     FROM agent_practice_reviews
     WHERE session_id = ? AND turn_id IN (${placeholders})
     ORDER BY created_at DESC, id DESC`,
  ).all([sessionId, ...uniqueTurnIds]);
  for (const row of rows) {
    if (!row.turn_id || byTurn.has(row.turn_id)) continue;
    byTurn.set(row.turn_id, rowToReview(row));
  }
  return byTurn;
}

export async function getActivePracticeContract(runtime: AppRuntime, params: unknown = {}, context: ToolRunContext = {}): Promise<ToolEnvelope<{
  contract: PracticeContractSummary | null;
}>> {
  const started = Date.now();
  try {
    const sessionId = requireContext(context).sessionId;
    const contractId = params && typeof params === "object" ? (params as { practice_contract_id?: unknown }).practice_contract_id : undefined;
    const row = typeof contractId === "string"
      ? loadContractById(runtime, contractId, sessionId)
      : runtime.db.query<PracticeContractRow>(
        "SELECT * FROM practice_contracts WHERE session_id = ? AND status IN ('active', 'submitted') ORDER BY created_at DESC LIMIT 1",
      ).get([sessionId]);
    return okEnvelope("get_active_practice_contract", started, { contract: row ? rowToContract(row) : null });
  } catch (error) {
    return errorEnvelope("get_active_practice_contract", started, error, { contract: null });
  }
}

export async function checkPythonSyntax(runtime: AppRuntime, params: unknown, context: ToolRunContext = {}): Promise<ToolEnvelope<SandboxResult>> {
  const started = Date.now();
  try {
    requireContext(context);
    const input = parseSubmissionParams(params);
    ensureContract(runtime, input.practice_contract_id, context.sessionId);
    const result = await runtime.sandbox.lint({
      request_id: createId("run"),
      code: input.code,
      limits: boundedLimits(),
    });
    return okEnvelope("check_python_syntax", started, result, result.status);
  } catch (error) {
    return errorEnvelope("check_python_syntax", started, error, emptySandboxResult());
  }
}

export async function runStudentCode(runtime: AppRuntime, params: unknown, context: ToolRunContext = {}): Promise<ToolEnvelope<SandboxResult>> {
  const started = Date.now();
  try {
    requireContext(context);
    const input = parseSubmissionParams(params);
    ensureContract(runtime, input.practice_contract_id, context.sessionId);
    const result = await runtime.sandbox.runPython({
      request_id: createId("run"),
      code: input.code,
      stdin: input.stdin,
      limits: boundedLimits(),
    });
    return okEnvelope("run_student_code", started, result, result.status);
  } catch (error) {
    return errorEnvelope("run_student_code", started, error, emptySandboxResult());
  }
}

export async function runReviewProbe(runtime: AppRuntime, params: unknown, context: ToolRunContext = {}): Promise<ToolEnvelope<SandboxResult & { evidence_source: "agent_generated_probe" }>> {
  const started = Date.now();
  try {
    requireContext(context);
    const input = parseProbeParams(params);
    ensureContract(runtime, input.practice_contract_id, context.sessionId);
    const result = await runtime.sandbox.runPython({
      request_id: createId("run"),
      code: [
        "# Agent-generated review probe. This is review evidence, not a hidden evaluator.",
        input.code,
        "",
        input.probe_code,
      ].join("\n"),
      limits: { timeout_ms: 1500, memory_mb: 128, output_bytes: 4000 },
    });
    return okEnvelope("run_review_probe", started, { ...result, evidence_source: "agent_generated_probe" }, result.status);
  } catch (error) {
    return errorEnvelope("run_review_probe", started, error, { ...emptySandboxResult(), evidence_source: "agent_generated_probe" });
  }
}

export async function recordAgentReview(runtime: AppRuntime, params: unknown, context: ToolRunContext = {}): Promise<ToolEnvelope<{
  review: AgentPracticeReviewSummary;
}>> {
  const started = Date.now();
  try {
    const { sessionId, turnId } = requireContext(context);
    const input = parseReviewParams(params);
    const contract = ensureContract(runtime, input.practice_contract_id, sessionId);
    const id = createId("apr");
    const now = nowIso();
    runtime.db.transaction(() => {
      runtime.db.query(
        `INSERT INTO agent_practice_reviews(
          id, practice_contract_id, session_id, turn_id, submitted_code_hash, review_status,
          confidence, evidence_refs_json, learner_facing_summary, progress_effect, progress_reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?)`,
      ).run([
        id,
        contract.id,
        sessionId,
        turnId,
        stableHash(input.submitted_code),
        input.review_status,
        input.confidence,
        JSON.stringify(input.evidence_refs),
        summarizeText(input.learner_facing_summary, 1200),
        now,
      ]);
      runtime.db.query("UPDATE practice_contracts SET status = 'submitted', updated_at = ? WHERE id = ?").run([now, contract.id]);
    });
    return okEnvelope("record_agent_review", started, { review: rowToReview(loadReviewById(runtime, id, sessionId)) });
  } catch (error) {
    return errorEnvelope("record_agent_review", started, error, { review: emptyReview() });
  }
}

export async function requestLearningProgressUpdate(runtime: AppRuntime, params: unknown, context: ToolRunContext = {}): Promise<ToolEnvelope<AgentPracticeProgressUpdateOutcome>> {
  const started = Date.now();
  try {
    const { sessionId, turnId } = requireContext(context);
    const reviewId = parseReviewId(params);
    const review = loadReviewById(runtime, reviewId, sessionId);
    const contract = loadContractById(runtime, review.practice_contract_id, sessionId);
    const validation = validateProgressReady(runtime, sessionId, review, contract);
    if (validation) {
      if (validation !== "review progress was already recorded") {
        updateReviewProgress(runtime, review.id, "not_recorded", validation);
      }
      return okEnvelope("request_learning_progress_update", started, {
        review_id: review.id,
        progress_effect: "not_recorded",
        recorded_concept_ids: [],
        reason: validation,
      });
    }
    const conceptIds = parseStringArray(contract.concept_ids_json);
    const policyInputs = getCatalogProgressPolicyInputMap(runtime);
    const recorded: string[] = [];
    runtime.db.transaction(() => {
      for (const conceptId of conceptIds) {
        const concept = getCatalogConceptById(runtime, conceptId, { includeInactive: true });
        if (!concept) continue;
        const result = recordEvidenceAndProject(runtime, {
          sourceType: "tutor_review",
          sourceId: review.id,
          sessionId,
          turnId,
          conceptId,
          outcome: "completed_independently",
          difficulty: contract.difficulty,
          score: 100,
          evaluatorConfidence: 0.8,
          evidenceWeight: evidenceWeightForOutcome("completed_independently"),
          catalogVersion: concept.catalog_version ?? getLatestCatalogRun(runtime)?.kb_version ?? runtime.config.kbVersion,
          summary: {
            practice_contract_id: contract.id,
            review_status: review.review_status,
            confidence: review.confidence,
            evidence_refs: safeParseArray(review.evidence_refs_json).slice(0, 10),
          },
          prerequisiteCentrality: policyInputs.get(conceptId)?.prerequisite_weight ?? 0,
          audit: {
            toolCallId: `agentic-review:${review.id}:${conceptId}`,
            toolName: "request_learning_progress_update",
            resultCode: "allowed_success",
            status: review.review_status,
            score: 100,
            conceptIds: [conceptId],
          },
        });
        if (result.status === "inserted") recorded.push(conceptId);
      }
      updateReviewProgress(runtime, review.id, recorded.length > 0 ? "recorded" : "not_recorded", recorded.length > 0 ? "progress evidence recorded" : "no active catalog concepts were recorded");
      runtime.db.query("UPDATE practice_contracts SET status = ? WHERE id = ?").run([recorded.length > 0 ? "completed" : "submitted", contract.id]);
    });
    return okEnvelope("request_learning_progress_update", started, {
      review_id: review.id,
      progress_effect: recorded.length > 0 ? "recorded" : "not_recorded",
      recorded_concept_ids: recorded,
      reason: recorded.length > 0 ? "progress evidence recorded" : "no active catalog concepts were recorded",
    });
  } catch (error) {
    return errorEnvelope("request_learning_progress_update", started, error, {
      review_id: "",
      progress_effect: "not_recorded",
      recorded_concept_ids: [],
      reason: "progress update failed",
    });
  }
}

function requireContext(context: ToolRunContext): { sessionId: string; turnId: string } {
  if (!context.sessionId || !context.turnId) {
    throw new AppError("VALIDATION_ERROR", "Agentic practice tools require server-owned session and turn context", 400);
  }
  return { sessionId: context.sessionId, turnId: context.turnId };
}

function parseContractParams(params: unknown): {
  concept_ids: string[];
  title: string;
  prompt_md: string;
  starter_code?: string;
  expected_behavior: string;
  visible_examples?: Array<Record<string, unknown>>;
  acceptance_checklist: string[];
  allowed_solution_shape?: string;
  review_rubric: string;
  difficulty: number;
  progress_eligible: boolean;
} {
  if (!params || typeof params !== "object") throw new AppError("VALIDATION_ERROR", "Practice contract parameters are required", 400);
  const value = params as Record<string, unknown>;
  return {
    concept_ids: parseBoundedStringArray(value.concept_ids, 5),
    title: requireString(value.title, 120),
    prompt_md: requireString(value.prompt_md, 4000),
    starter_code: typeof value.starter_code === "string" ? summarizeText(value.starter_code, 4000) : undefined,
    expected_behavior: requireString(value.expected_behavior, 1000),
    visible_examples: Array.isArray(value.visible_examples) ? value.visible_examples.filter(isRecord).slice(0, 5) : [],
    acceptance_checklist: parseBoundedStringArray(value.acceptance_checklist, 8, 300),
    allowed_solution_shape: typeof value.allowed_solution_shape === "string" ? summarizeText(value.allowed_solution_shape, 300) : undefined,
    review_rubric: requireString(value.review_rubric, 1000),
    difficulty: Math.max(1, Math.min(5, Math.round(typeof value.difficulty === "number" ? value.difficulty : 2))),
    progress_eligible: value.progress_eligible === true,
  };
}

function parseSubmissionParams(params: unknown): { practice_contract_id: string; code: string; stdin?: string } {
  if (!params || typeof params !== "object") throw new AppError("VALIDATION_ERROR", "Submission parameters are required", 400);
  const value = params as Record<string, unknown>;
  return {
    practice_contract_id: requireString(value.practice_contract_id, 120),
    code: requireCodeString(value.code, 20_000),
    stdin: typeof value.stdin === "string" ? requireCodeString(value.stdin, 4000) : undefined,
  };
}

function parseProbeParams(params: unknown): { practice_contract_id: string; code: string; probe_code: string } {
  const input = parseSubmissionParams(params);
  const value = params as Record<string, unknown>;
  return { ...input, probe_code: requireCodeString(value.probe_code, 4000) };
}

function parseReviewParams(params: unknown): {
  practice_contract_id: string;
  submitted_code: string;
  review_status: AgentPracticeReviewStatus;
  confidence: AgentPracticeReviewConfidence;
  evidence_refs: AgentPracticeReviewEvidenceSummary[];
  learner_facing_summary: string;
} {
  if (!params || typeof params !== "object") throw new AppError("VALIDATION_ERROR", "Review parameters are required", 400);
  const value = params as Record<string, unknown>;
  const reviewStatus = String(value.review_status);
  const confidence = String(value.confidence);
  if (!["passed", "partial", "needs_revision", "blocked_by_error"].includes(reviewStatus)) throw new AppError("VALIDATION_ERROR", "Review status is not allowed", 400);
  if (!["high", "medium", "low"].includes(confidence)) throw new AppError("VALIDATION_ERROR", "Review confidence is not allowed", 400);
  return {
    practice_contract_id: requireString(value.practice_contract_id, 120),
    submitted_code: requireCodeString(value.submitted_code, 20_000),
    review_status: reviewStatus as AgentPracticeReviewStatus,
    confidence: confidence as AgentPracticeReviewConfidence,
    evidence_refs: parseEvidenceRefs(value.evidence_refs),
    learner_facing_summary: requireString(value.learner_facing_summary, 1200),
  };
}

function parseReviewId(params: unknown): string {
  if (!params || typeof params !== "object") throw new AppError("VALIDATION_ERROR", "Review id is required", 400);
  return requireString((params as Record<string, unknown>).review_id, 120);
}

function ensureContract(runtime: AppRuntime, contractId: string, sessionId?: string | null): PracticeContractRow {
  return loadContractById(runtime, contractId, sessionId ?? undefined);
}

function loadContractById(runtime: AppRuntime, contractId: string, sessionId?: string): PracticeContractRow {
  const row = runtime.db.query<PracticeContractRow>(
    "SELECT * FROM practice_contracts WHERE id = ? AND (? IS NULL OR session_id = ?)",
  ).get([contractId, sessionId ?? null, sessionId ?? null]);
  if (!row) throw new AppError("PRACTICE_CONTRACT_NOT_FOUND", "当前练习契约不存在或不属于此会话。", 404);
  return row;
}

function loadReviewById(runtime: AppRuntime, reviewId: string, sessionId: string): AgentPracticeReviewRow {
  const row = runtime.db.query<AgentPracticeReviewRow>(
    "SELECT * FROM agent_practice_reviews WHERE id = ? AND session_id = ?",
  ).get([reviewId, sessionId]);
  if (!row) throw new AppError("PRACTICE_REVIEW_NOT_FOUND", "练习评阅记录不存在或不属于此会话。", 404);
  return row;
}

function validateProgressReady(runtime: AppRuntime, sessionId: string, review: AgentPracticeReviewRow, contract: PracticeContractRow): string | undefined {
  if (!contract.progress_eligible) return "practice contract is not progress eligible";
  if (review.review_status !== "passed") return "review status is not passed";
  if (review.confidence !== "high") return "review confidence is not high";
  const evidenceRefs = safeParseArray(review.evidence_refs_json);
  const hasExecutionEvidence = evidenceRefs.some((item) =>
    isRecord(item)
    && (item.tool_name === "run_student_code" || item.tool_name === "check_python_syntax")
    && typeof item.result_code === "string"
    && item.result_code.includes("success")
  );
  if (!hasExecutionEvidence) return "review is missing successful execution or syntax evidence";
  if (review.progress_effect === "recorded") return "review progress was already recorded";
  const conceptIds = parseStringArray(contract.concept_ids_json);
  const frontier = deriveLearningFrontier(runtime, { sessionId });
  if (frontier.status !== "active") return "learning frontier is not active";
  const allowed = new Set([...frontier.allowed_practice_concept_ids, frontier.current_concept_id].filter((item): item is string => Boolean(item)));
  if (conceptIds.length === 0 || conceptIds.some((conceptId) => !allowed.has(conceptId))) {
    return "practice contract concepts are outside the current learning frontier";
  }
  return undefined;
}

function updateReviewProgress(runtime: AppRuntime, reviewId: string, effect: AgentPracticeProgressEffect, reason: string): void {
  runtime.db.query("UPDATE agent_practice_reviews SET progress_effect = ?, progress_reason = ? WHERE id = ?").run([effect, reason, reviewId]);
}

function rowToContract(row: PracticeContractRow): PracticeContractSummary {
  return {
    id: row.id,
    session_id: row.session_id,
    turn_id: row.turn_id,
    tutor_agent_action_id: row.tutor_agent_action_id,
    concept_ids: parseStringArray(row.concept_ids_json),
    title: row.title,
    prompt_md: row.prompt_md,
    starter_code: row.starter_code,
    expected_behavior: row.expected_behavior,
    visible_examples: safeParseArray(row.visible_examples_json).filter(isRecord),
    acceptance_checklist: parseStringArray(row.acceptance_checklist_json),
    allowed_solution_shape: row.allowed_solution_shape,
    review_rubric: row.review_rubric,
    difficulty: row.difficulty,
    progress_eligible: row.progress_eligible === 1,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToReview(row: AgentPracticeReviewRow): AgentPracticeReviewSummary {
  return {
    id: row.id,
    practice_contract_id: row.practice_contract_id,
    session_id: row.session_id,
    turn_id: row.turn_id,
    submitted_code_hash: row.submitted_code_hash,
    review_status: row.review_status,
    confidence: row.confidence,
    evidence_refs: parseEvidenceRefs(safeParseArray(row.evidence_refs_json)),
    learner_facing_summary: row.learner_facing_summary,
    progress_effect: row.progress_effect,
    progress_reason: row.progress_reason,
    created_at: row.created_at,
  };
}

function parseEvidenceRefs(value: unknown): AgentPracticeReviewEvidenceSummary[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => ({
      tool_name: summarizeText(String(item.tool_name ?? ""), 80),
      result_code: summarizeText(String(item.result_code ?? ""), 80),
      summary: summarizeText(String(item.summary ?? ""), 500),
    }))
    .filter((item) => item.tool_name.length > 0)
    .slice(0, 10);
}

function parseBoundedStringArray(value: unknown, maxItems: number, maxLength = 80): string[] {
  if (!Array.isArray(value)) throw new AppError("VALIDATION_ERROR", "Expected a bounded string array", 400);
  const result = value.map((item) => String(item)).filter(Boolean).map((item) => summarizeText(item, maxLength)).slice(0, maxItems);
  if (result.length === 0) throw new AppError("VALIDATION_ERROR", "Expected at least one string", 400);
  return result;
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function safeParseArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function requireString(value: unknown, maxLength: number): string {
  if (typeof value !== "string" || value.length === 0) throw new AppError("VALIDATION_ERROR", "Required string is missing", 400);
  return summarizeText(value, maxLength);
}

function requireCodeString(value: unknown, maxLength: number): string {
  if (typeof value !== "string" || value.length === 0 || value.trim().length === 0) {
    throw new AppError("VALIDATION_ERROR", "Required code string is missing", 400);
  }
  if (value.length > maxLength) {
    throw new AppError("VALIDATION_ERROR", "Code string is too long", 400);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedLimits(): { timeout_ms: number; memory_mb: number; output_bytes: number } {
  return { timeout_ms: 3000, memory_mb: 128, output_bytes: 8000 };
}

function emptySandboxResult(): SandboxResult {
  return { status: "sandbox_error", exit_code: 1, stdout: "", stderr: "", traceback: "", duration_ms: 0, truncated: false };
}

function emptyContract(): PracticeContractSummary {
  return {
    id: "",
    session_id: "",
    turn_id: null,
    concept_ids: [],
    title: "",
    prompt_md: "",
    expected_behavior: "",
    visible_examples: [],
    acceptance_checklist: [],
    review_rubric: "",
    difficulty: 1,
    progress_eligible: false,
    status: "abandoned",
    created_at: "",
    updated_at: "",
  };
}

function emptyReview(): AgentPracticeReviewSummary {
  return {
    id: "",
    practice_contract_id: "",
    session_id: "",
    turn_id: null,
    submitted_code_hash: "",
    review_status: "blocked_by_error",
    confidence: "low",
    evidence_refs: [],
    learner_facing_summary: "",
    progress_effect: "not_recorded",
    created_at: "",
  };
}
