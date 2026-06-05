import type { AppRuntime, DiagnosticSessionSummary } from "../types.js";
import { AppError } from "../types.js";
import { requireLocalSession, requirePublishedDiagnostic } from "../db/validators.js";
import { createId, nowIso } from "../security/ids.js";
import { redactText, summarizeText } from "../security/redaction.js";
import { assertCatalogAvailable, getCatalogConceptById, getCatalogDiagnosticsConcepts, getCatalogProgressPolicyInputMap, getLatestCatalogRun } from "./course-catalog.js";
import { designDiagnosticQuestion } from "./diagnostic-designer.js";
import {
  diagnosticProjectionForState,
  recordEvidenceAndProject,
  type ProjectionOutcome,
} from "./progress-policy.js";
import {
  buildAdaptiveDiagnosticProgress,
  computeConceptUncertainty,
  computeDiagnosticReadiness,
  diagnosticHardCap,
  type AdaptiveDiagnosticProgress,
  type DiagnosticAttemptSnapshot,
  type DiagnosticBand,
  type DiagnosticConceptSnapshot,
  type DiagnosticOutcome,
  type DiagnosticPriorityResult,
  selectAdaptiveDiagnosticTarget,
} from "./diagnostic-strategy.js";

type DiagnosticRow = {
  id: string;
  concept_ids_json: string;
  question_type: "multiple_choice" | "code_prediction" | "short_answer";
  prompt_md: string;
  choices_json: string;
  answer_key_ref: string | null;
  difficulty: number;
};

type DiagnosticSessionRow = {
  id: string;
  status: "active" | "completed" | "paused" | "failed";
  stop_reason: string | null;
};

type DiagnosticResponse = {
  diagnostic_id: string;
  completed: boolean;
  question: undefined | {
    id: string;
    concept_ids: string[];
    type: string;
    prompt_md: string;
    choices: Array<{ id: string; text: string }>;
    estimated_seconds: number;
  };
  progress: AdaptiveDiagnosticProgress;
};

const DIAGNOSTIC_GENERATION_UNAVAILABLE_REASON = "diagnostic_generation_unavailable";
const HARD_CAP_LOW_CONFIDENCE_REASON = "hard_cap_reached_low_confidence";

export function isInitialDiagnosticComplete(runtime: AppRuntime, sessionId: string): boolean {
  requireLocalSession(runtime, sessionId);
  const currentSession = runtime.db.query<DiagnosticSessionRow>(
    "SELECT id, status, stop_reason FROM diagnostic_sessions WHERE session_id = ? ORDER BY started_at DESC LIMIT 1",
  ).get([sessionId]);
  return normalizeDiagnosticSession(runtime, currentSession)?.status === "completed";
}

export function assertInitialDiagnosticComplete(runtime: AppRuntime, sessionId: string): void {
  if (isInitialDiagnosticComplete(runtime, sessionId)) return;
  throw new AppError("DIAGNOSTIC_REQUIRED", "完成初始测评后才能生成练习。", 409);
}

export function getDiagnosticProgressSummary(runtime: AppRuntime, options: { sessionId?: string | null } = {}): AdaptiveDiagnosticProgress & { completed: boolean } {
  assertCatalogAvailable(runtime);
  const diagnosticSession = options.sessionId
    ? runtime.db.query<DiagnosticSessionRow>(
      "SELECT id, status, stop_reason FROM diagnostic_sessions WHERE session_id = ? ORDER BY started_at DESC LIMIT 1",
    ).get([options.sessionId])
    : runtime.db.query<DiagnosticSessionRow>(
      "SELECT id, status, stop_reason FROM diagnostic_sessions ORDER BY started_at DESC LIMIT 1",
    ).get();
  const normalizedSession = normalizeDiagnosticSession(runtime, diagnosticSession);
  if (!normalizedSession) {
    const defaultStates = loadDefaultDiagnosticStates(runtime);
    const progress = buildAdaptiveDiagnosticProgress(defaultStates, 0, defaultStates[0] ? [defaultStates[0].concept_id] : []);
    return { ...progress, completed: false };
  }
  return {
    ...getDiagnosticProgress(runtime, normalizedSession.id, undefined, normalizedSession),
    completed: normalizedSession.status === "completed",
  };
}

export function getDiagnosticContextSummary(runtime: AppRuntime, options: { sessionId?: string | null } = {}): DiagnosticSessionSummary | undefined {
  const diagnosticSession = options.sessionId
    ? runtime.db.query<DiagnosticSessionRow>(
      "SELECT id, status, stop_reason FROM diagnostic_sessions WHERE session_id = ? ORDER BY started_at DESC LIMIT 1",
    ).get([options.sessionId])
    : runtime.db.query<DiagnosticSessionRow>(
      "SELECT id, status, stop_reason FROM diagnostic_sessions ORDER BY started_at DESC LIMIT 1",
    ).get();
  const normalizedSession = normalizeDiagnosticSession(runtime, diagnosticSession);
  if (!normalizedSession && options.sessionId) {
    const progress = getDiagnosticProgressSummary(runtime, { sessionId: options.sessionId });
    return {
      diagnostic_id: "diag_first_use",
      answered: progress.answered,
      completed: false,
      min_questions: progress.min_questions,
      soft_cap: progress.soft_cap,
      hard_cap: progress.hard_cap,
      estimated_remaining_min: progress.estimated_remaining_min,
      estimated_remaining_max: progress.estimated_remaining_max,
      current_focus_concept_ids: progress.current_focus_concept_ids,
      completion_confidence: progress.completion_confidence,
      effective_answered: progress.effective_answered,
      min_effective_answers: progress.min_effective_answers,
      placement_confidence: progress.placement_confidence,
      leading_start_concept_id: progress.leading_start_concept_id,
      leading_start_label: progress.leading_start_label,
      runner_up_start_concept_id: progress.runner_up_start_concept_id,
      confidence_margin: progress.confidence_margin,
      current_focus_boundary_ids: progress.current_focus_boundary_ids,
      diagnostic_status: progress.diagnostic_status,
    };
  }
  if (!normalizedSession) return undefined;
  const progress = getDiagnosticProgress(runtime, normalizedSession.id, undefined, normalizedSession);
  const states = loadDiagnosticStates(runtime, normalizedSession.id);
  const readiness = computeDiagnosticReadiness(states, progress.answered);
  const profileRow = runtime.db.query<{ profile_json: string }>("SELECT profile_json FROM local_profile WHERE id = 'local'").get();
  const profile = profileRow ? JSON.parse(profileRow.profile_json) as { current_level?: string } : {};
  if (normalizedSession.status === "completed") {
    return {
      diagnostic_id: "diag_first_use",
      answered: progress.answered,
      completed: true,
      current_focus_concept_ids: progress.current_focus_concept_ids,
      completion_confidence: progress.completion_confidence,
      effective_answered: progress.effective_answered,
      min_effective_answers: progress.min_effective_answers,
      placement_confidence: progress.placement_confidence,
      leading_start_concept_id: progress.leading_start_concept_id,
      leading_start_label: progress.leading_start_label,
      runner_up_start_concept_id: progress.runner_up_start_concept_id,
      confidence_margin: progress.confidence_margin,
      current_focus_boundary_ids: progress.current_focus_boundary_ids,
      diagnostic_status: progress.diagnostic_status,
      starting_level: profile.current_level ?? inferLevelFromDiagnostic(runtime, normalizedSession.id),
      weak_concept_ids: readiness.weak_concept_ranking,
      unresolved_concept_ids: readiness.unresolved_concept_ids,
    };
  }
  return {
    diagnostic_id: "diag_first_use",
    answered: progress.answered,
    completed: false,
    min_questions: progress.min_questions,
    soft_cap: progress.soft_cap,
    hard_cap: progress.hard_cap,
    estimated_remaining_min: progress.estimated_remaining_min,
    estimated_remaining_max: progress.estimated_remaining_max,
    current_focus_concept_ids: progress.current_focus_concept_ids,
    completion_confidence: progress.completion_confidence,
    effective_answered: progress.effective_answered,
    min_effective_answers: progress.min_effective_answers,
    placement_confidence: progress.placement_confidence,
    leading_start_concept_id: progress.leading_start_concept_id,
    leading_start_label: progress.leading_start_label,
    runner_up_start_concept_id: progress.runner_up_start_concept_id,
    confidence_margin: progress.confidence_margin,
    current_focus_boundary_ids: progress.current_focus_boundary_ids,
    diagnostic_status: progress.diagnostic_status,
  };
}

export async function getNextDiagnosticQuestion(runtime: AppRuntime, sessionId: string): Promise<DiagnosticResponse> {
  requireLocalSession(runtime, sessionId);
  assertCatalogAvailable(runtime);
  const diagnosticSession = ensureDiagnosticSession(runtime, sessionId);
  if (diagnosticSession.status === "completed") {
    return toDiagnosticResponse(undefined, getDiagnosticProgress(runtime, diagnosticSession.id, undefined, diagnosticSession), true);
  }
  if (diagnosticSession.status === "paused") {
    return toDiagnosticResponse(undefined, getDiagnosticProgress(runtime, diagnosticSession.id, undefined, diagnosticSession), false);
  }

  const initialStop = shouldStopDiagnostic(runtime, diagnosticSession.id);
  if (initialStop.stop) {
    const completed = completeDiagnosticSession(runtime, sessionId, diagnosticSession.id, initialStop.reason);
    return toDiagnosticResponse(undefined, getDiagnosticProgress(runtime, diagnosticSession.id), completed);
  }

  let selectedTarget = selectNextDiagnosticTarget(runtime, diagnosticSession.id);
  let row = findNextQuestion(runtime, diagnosticSession.id, selectedTarget?.concept_id);
  const recoveringFromGenerationFailure = diagnosticSession.stop_reason === DIAGNOSTIC_GENERATION_UNAVAILABLE_REASON;

  if (!row) {
    try {
      const designed = await designDiagnosticQuestion(runtime, selectedTarget?.concept_id, {
        difficultyDirection: selectedTarget?.difficulty_direction ?? "same",
      });
      insertGeneratedDiagnosticItem(runtime, diagnosticSession.id, designed, selectedTarget);
      if (recoveringFromGenerationFailure) {
        clearDiagnosticGenerationUnavailable(runtime, diagnosticSession.id, designed.id);
      }
      row = findNextQuestion(runtime, diagnosticSession.id, selectedTarget?.concept_id);
    } catch (error) {
      if (isDiagnosticGenerationUnavailable(error)) {
        recordDiagnosticGenerationUnavailable(runtime, diagnosticSession.id);
        const focusConceptIds = selectedTarget ? [selectedTarget.concept_id] : [];
        return toDiagnosticResponse(undefined, getDiagnosticProgress(runtime, diagnosticSession.id, focusConceptIds), false);
      }
      throw error;
    }
  } else if (selectedTarget && !parseStringArray(row.concept_ids_json).includes(selectedTarget.concept_id) && selectedTarget.priority_inputs.conflict_bonus > 0) {
    const existingRow = row;
    try {
      const designed = await designDiagnosticQuestion(runtime, selectedTarget.concept_id, {
        difficultyDirection: selectedTarget.difficulty_direction,
      });
      insertGeneratedDiagnosticItem(runtime, diagnosticSession.id, designed, selectedTarget);
      if (recoveringFromGenerationFailure) {
        clearDiagnosticGenerationUnavailable(runtime, diagnosticSession.id, designed.id);
      }
      row = findNextQuestion(runtime, diagnosticSession.id, selectedTarget.concept_id);
    } catch (error) {
      if (isDiagnosticGenerationUnavailable(error)) {
        persistGenerationInterruptionRationale(runtime, diagnosticSession.id);
        return toDiagnosticResponse(existingRow, getDiagnosticProgress(runtime, diagnosticSession.id, parseStringArray(existingRow.concept_ids_json)), false);
      }
      throw error;
    }
  }

  const focusConceptIds = row ? parseStringArray(row.concept_ids_json) : selectedTarget ? [selectedTarget.concept_id] : [];
  return toDiagnosticResponse(row, getDiagnosticProgress(runtime, diagnosticSession.id, focusConceptIds));
}

function toDiagnosticResponse(row: DiagnosticRow | undefined, progress: AdaptiveDiagnosticProgress, completedOverride?: boolean): DiagnosticResponse {
  return {
    diagnostic_id: "diag_first_use",
    completed: completedOverride ?? !row,
    question: row ? {
      id: row.id,
      concept_ids: parseStringArray(row.concept_ids_json),
      type: row.question_type,
      prompt_md: row.prompt_md,
      choices: parseChoices(row.choices_json),
      estimated_seconds: 60,
    } : undefined,
    progress,
  };
}

function isDiagnosticGenerationUnavailable(error: unknown): boolean {
  return error instanceof AppError && error.code === "DIAGNOSTIC_GENERATION_UNAVAILABLE";
}

function recordDiagnosticGenerationUnavailable(runtime: AppRuntime, diagnosticSessionId: string): void {
  const now = nowIso();
  runtime.db.transaction(() => {
    runtime.db.query("UPDATE diagnostic_sessions SET status = 'active', stop_reason = ?, ended_at = NULL WHERE id = ? AND status IN ('active', 'paused')").run([
      DIAGNOSTIC_GENERATION_UNAVAILABLE_REASON,
      diagnosticSessionId,
    ]);
    persistGenerationInterruptionRationale(runtime, diagnosticSessionId, now);
  });
}

function clearDiagnosticGenerationUnavailable(runtime: AppRuntime, diagnosticSessionId: string, generatedItemId: string): void {
  const now = nowIso();
  runtime.db.transaction(() => {
    runtime.db.query("UPDATE diagnostic_sessions SET stop_reason = NULL, ended_at = NULL WHERE id = ? AND status = 'active' AND stop_reason = ?").run([
      diagnosticSessionId,
      DIAGNOSTIC_GENERATION_UNAVAILABLE_REASON,
    ]);
    persistRecoveryRationale(runtime, diagnosticSessionId, generatedItemId, now);
  });
}

export async function answerDiagnosticQuestion(runtime: AppRuntime, sessionId: string, diagnosticId: string, body: { question_id: string; answer: unknown }): Promise<{
  accepted: true;
  completed: boolean;
  next_question_url: string;
}> {
  requireLocalSession(runtime, sessionId);
  if (diagnosticId !== "diag_first_use") {
    throw new Error("Unknown diagnostic id");
  }
  requirePublishedDiagnostic(runtime, body.question_id);
  const diagnosticSession = ensureDiagnosticSession(runtime, sessionId);
  const question = runtime.db.query<DiagnosticRow>(
    "SELECT id, concept_ids_json, question_type, prompt_md, choices_json, answer_key_ref, difficulty FROM diagnostic_questions WHERE id = ?",
  ).get([body.question_id]);
  if (!question) {
    throw new Error("Unknown diagnostic question");
  }
  const evidence = scoreDiagnosticAnswer(question, body.answer);
  const now = nowIso();
  runtime.db.query(
    "INSERT OR IGNORE INTO diagnostic_attempts(id, question_id, session_id, answer_json, result_summary_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run([
    createId("diag"),
    body.question_id,
    sessionId,
    JSON.stringify(body.answer),
    JSON.stringify(evidence),
    now,
  ]);
  updateDiagnosticConceptState(runtime, diagnosticSession.id, evidence, now);
  const stop = shouldStopDiagnostic(runtime, diagnosticSession.id);
  if (stop.stop) {
    completeDiagnosticSession(runtime, sessionId, diagnosticSession.id, stop.reason);
  }
  const next = await getNextDiagnosticQuestion(runtime, sessionId);
  return { accepted: true, completed: next.completed, next_question_url: "/api/diagnostics/next" };
}

function findNextQuestion(runtime: AppRuntime, diagnosticSessionId: string, preferredConceptId?: string): DiagnosticRow | undefined {
  return runtime.db.query<DiagnosticRow>(
    `SELECT q.id, q.concept_ids_json, q.question_type, q.prompt_md, q.choices_json, q.answer_key_ref, q.difficulty
     FROM diagnostic_questions q
     JOIN generated_items gi ON gi.id = q.id
     WHERE q.status = 'published'
       AND gi.diagnostic_session_id = ?
       AND q.id NOT IN (SELECT question_id FROM diagnostic_attempts)
     ORDER BY
       CASE WHEN ? IS NOT NULL AND q.concept_ids_json LIKE ? THEN 0 ELSE 1 END,
       gi.created_at ASC,
       q.id ASC
     LIMIT 1`,
  ).get([diagnosticSessionId, preferredConceptId ?? null, preferredConceptId ? `%"${preferredConceptId}"%` : ""]);
}

function getDiagnosticProgress(runtime: AppRuntime, diagnosticSessionId: string, focusConceptIds?: string[], session?: DiagnosticSessionRow): AdaptiveDiagnosticProgress {
  const sessionState = session ?? runtime.db.query<DiagnosticSessionRow>(
    "SELECT id, status, stop_reason FROM diagnostic_sessions WHERE id = ?",
  ).get([diagnosticSessionId]);
  const answered = countDiagnosticAnswers(runtime, diagnosticSessionId);
  const states = loadDiagnosticStates(runtime, diagnosticSessionId);
  const selectedTarget = focusConceptIds?.length ? undefined : selectNextDiagnosticTarget(runtime, diagnosticSessionId);
  const target = focusConceptIds?.length ? focusConceptIds : selectedTarget ? [selectedTarget.concept_id] : [];
  const progress = buildAdaptiveDiagnosticProgress(states.length > 0 ? states : loadDefaultDiagnosticStates(runtime), answered, target);
  return {
    ...progress,
    leading_start_label: placementLabel(runtime, progress.leading_start_concept_id) ?? progress.leading_start_label,
    estimated_remaining_min: sessionState?.status === "completed" ? 0 : progress.estimated_remaining_min,
    estimated_remaining_max: sessionState?.status === "completed" ? 0 : progress.estimated_remaining_max,
    diagnostic_status: sessionState?.stop_reason === DIAGNOSTIC_GENERATION_UNAVAILABLE_REASON ? "technical_unavailable" : "active",
  };
}

function countDiagnosticAnswers(runtime: AppRuntime, diagnosticSessionId: string): number {
  return runtime.db.query<{ count: number }>(
    `SELECT COUNT(DISTINCT a.question_id) AS count
     FROM diagnostic_attempts a
     JOIN generated_items gi ON gi.id = a.question_id
     WHERE gi.diagnostic_session_id = ?`,
  ).get([diagnosticSessionId])?.count ?? 0;
}

function ensureDiagnosticSession(runtime: AppRuntime, sessionId: string): DiagnosticSessionRow {
  assertCatalogAvailable(runtime);
  const existing = runtime.db.query<DiagnosticSessionRow>(
    "SELECT id, status, stop_reason FROM diagnostic_sessions WHERE session_id = ? ORDER BY started_at DESC LIMIT 1",
  ).get([sessionId]);
  const normalizedExisting = normalizeDiagnosticSession(runtime, existing);
  if (normalizedExisting) return normalizedExisting;

  const id = createId("diag");
  const now = nowIso();
  const conceptIds = getCatalogDiagnosticsConcepts(runtime).map((concept) => concept.id);
  if (conceptIds.length === 0) {
    throw new AppError("CATALOG_UNAVAILABLE", "课程目录没有可用于初始测评的有效概念。", 503, true);
  }
  const catalogRun = getLatestCatalogRun(runtime);
  runtime.db.transaction(() => {
    runtime.db.query(
      "INSERT INTO diagnostic_sessions(id, session_id, status, target_concepts_json, catalog_version, catalog_run_id, started_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run([id, sessionId, "active", JSON.stringify(conceptIds), catalogRun?.kb_version ?? runtime.config.kbVersion, catalogRun?.id ?? null, now]);
    const masteryRows = runtime.db.query<{ concept_id: string; mastery_level: number; confidence: number; evidence_count: number }>(
      "SELECT concept_id, mastery_level, confidence, evidence_count FROM concept_mastery WHERE evidence_count > 0",
    ).all();
    const masteryByConcept = new Map(masteryRows.map((row) => [row.concept_id, row]));
    for (const conceptId of conceptIds) {
      const mastery = masteryByConcept.get(conceptId);
      const evidenceCount = mastery?.evidence_count ?? 0;
      const confidence = mastery?.confidence ?? 0;
      const masteryLevel = mastery?.mastery_level ?? 0;
      runtime.db.query(
        "INSERT INTO diagnostic_concept_state(diagnostic_session_id, concept_id, mastery, confidence, evidence_count, uncertainty, band, conflicting_evidence_count, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run([
        id,
        conceptId,
        masteryLevel,
        confidence,
        evidenceCount,
        computeConceptUncertainty(confidence, evidenceCount, 0),
        evidenceCount === 0 ? "unknown" : bandForMastery(masteryLevel, evidenceCount),
        0,
        now,
      ]);
    }
  });
  return { id, status: "active", stop_reason: null };
}

function selectNextDiagnosticTarget(runtime: AppRuntime, diagnosticSessionId: string): DiagnosticPriorityResult | undefined {
  return selectAdaptiveDiagnosticTarget(
    loadDiagnosticStates(runtime, diagnosticSessionId),
    loadRecentDiagnosticAttempts(runtime, diagnosticSessionId),
  );
}

function insertGeneratedDiagnosticItem(
  runtime: AppRuntime,
  diagnosticSessionId: string,
  designed: Awaited<ReturnType<typeof designDiagnosticQuestion>>,
  selection?: DiagnosticPriorityResult,
  generatorModelVersion = "model-generated",
): void {
  const now = nowIso();
  const answerKey = parseAnswerKey(designed.answer_key_ref);
  const conceptIds = selection ? [selection.concept_id] : sanitizeConceptIds(runtime, designed.concept_ids);
  const difficulty = Math.max(1, Math.min(5, Math.round(designed.difficulty)));
  runtime.db.transaction(() => {
    runtime.db.query(
      "INSERT INTO diagnostic_questions(id, concept_ids_json, question_type, prompt_md, choices_json, answer_key_ref, difficulty, status, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run([
      designed.id,
      JSON.stringify(conceptIds),
      designed.question_type,
      designed.prompt_md,
      JSON.stringify(designed.choices),
      designed.answer_key_ref,
      difficulty,
      "published",
      "agent-designed",
      now,
      now,
    ]);
    runtime.db.query(
      "INSERT INTO generated_items(id, diagnostic_session_id, concept_ids_json, item_type, prompt_md, choices_json, answer_key_private_json, rubric_private, difficulty, expected_evidence, validation_status, generator_model_version, generator_prompt_version, schema_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run([
      designed.id,
      diagnosticSessionId,
      JSON.stringify(conceptIds),
      designed.question_type,
      designed.prompt_md,
      JSON.stringify(designed.choices),
      JSON.stringify(answerKey),
      "选择题按 private answer key 确定正确选项；短答题需要私有评分规则。",
      difficulty,
      designed.question_type === "code_prediction" ? "prediction" : "recognition",
      "validated",
      generatorModelVersion,
      "diagnostic-generator.v2",
      "generated_diagnostic_item.v1",
      now,
    ]);
    if (selection) {
      persistSelectionRationale(runtime, diagnosticSessionId, designed.id, selection, now);
    }
  });
}

function scoreDiagnosticAnswer(question: DiagnosticRow, answer: unknown): {
  item_id: string;
  concept_ids: string[];
  outcome: DiagnosticOutcome;
  difficulty: number;
  evidence_quality: "high" | "medium" | "low";
  explanation_quality?: "strong" | "adequate" | "weak";
} {
  const answerChoice = answer && typeof answer === "object" ? (answer as { choice_id?: unknown }).choice_id : undefined;
  const correctChoice = parseAnswerKey(question.answer_key_ref ?? "").choice;
  const outcome = typeof answerChoice === "string" && answerChoice.toLowerCase() === correctChoice ? "correct" : "incorrect";
  return {
    item_id: question.id,
    concept_ids: parseStringArray(question.concept_ids_json),
    outcome,
    difficulty: question.difficulty,
    evidence_quality: question.question_type === "short_answer" ? "medium" : "high",
  };
}

function updateDiagnosticConceptState(
  runtime: AppRuntime,
  diagnosticSessionId: string,
  evidence: ReturnType<typeof scoreDiagnosticAnswer>,
  now: string,
): void {
  for (const conceptId of evidence.concept_ids) {
    const current = runtime.db.query<{ mastery: number; confidence: number; evidence_count: number; band: DiagnosticBand; conflicting_evidence_count: number }>(
      "SELECT mastery, confidence, evidence_count, band, conflicting_evidence_count FROM diagnostic_concept_state WHERE diagnostic_session_id = ? AND concept_id = ?",
    ).get([diagnosticSessionId, conceptId]);
    if (!current) continue;
    const previousBand = current.band;
    const masteryDelta = evidence.outcome === "correct" ? 12 : evidence.outcome === "partial" ? 3 : -10;
    const confidenceDelta = evidence.outcome === "ambiguous" ? 0.05 : 0.22;
    const mastery = Math.max(0, Math.min(100, current.mastery + masteryDelta));
    const confidence = Math.max(0, Math.min(1, current.confidence + confidenceDelta));
    const evidenceCount = current.evidence_count + 1;
    const nextBand = bandForMastery(mastery, evidenceCount);
    const conflictingEvidenceCount = current.conflicting_evidence_count + (previousBand !== "unknown" && previousBand !== nextBand ? 1 : 0);
    runtime.db.query(
      "UPDATE diagnostic_concept_state SET mastery = ?, confidence = ?, evidence_count = ?, uncertainty = ?, band = ?, last_item_id = ?, conflicting_evidence_count = ?, updated_at = ? WHERE diagnostic_session_id = ? AND concept_id = ?",
    ).run([
      mastery,
      confidence,
      evidenceCount,
      computeConceptUncertainty(confidence, evidenceCount, conflictingEvidenceCount),
      nextBand,
      evidence.item_id,
      conflictingEvidenceCount,
      now,
      diagnosticSessionId,
      conceptId,
    ]);
  }
}

function shouldStopDiagnostic(runtime: AppRuntime, diagnosticSessionId: string): { stop: boolean; reason: string } {
  const states = loadDiagnosticStates(runtime, diagnosticSessionId);
  if (states.length === 0) return { stop: false, reason: "" };
  const answered = countDiagnosticAnswers(runtime, diagnosticSessionId);
  const readiness = computeDiagnosticReadiness(states, answered);
  if (readiness.stop) return { stop: true, reason: readiness.reason };
  if (answered >= boundedAdaptiveEvidenceCap(states.length)) {
    return { stop: true, reason: "max_adaptive_evidence_reached" };
  }
  if (answered >= diagnosticHardCap(states.length)) {
    return { stop: true, reason: HARD_CAP_LOW_CONFIDENCE_REASON };
  }
  return { stop: readiness.stop, reason: readiness.reason };
}

function boundedAdaptiveEvidenceCap(conceptCount: number): number {
  return diagnosticHardCap(conceptCount) + 14;
}

function completeDiagnosticSession(runtime: AppRuntime, sessionId: string, diagnosticSessionId: string, stopReason: string): boolean {
  const now = nowIso();
  return runtime.db.transaction(() => {
    const finalStates = loadDiagnosticStates(runtime, diagnosticSessionId);
    const readiness = computeDiagnosticReadiness(finalStates, countDiagnosticAnswers(runtime, diagnosticSessionId));
    runtime.db.query("UPDATE diagnostic_sessions SET status = 'completed', stop_reason = ?, ended_at = ? WHERE id = ? AND status = 'active'").run([
      stopReason,
      now,
      diagnosticSessionId,
    ]);
    projectDiagnosticEvidence(runtime, {
      diagnosticSessionId,
      sessionId,
      states: finalStates,
      createdAt: now,
    });
    persistStopRationale(runtime, diagnosticSessionId, stopReason, readiness, now);
    runtime.db.query("UPDATE local_profile SET profile_json = ?, updated_at = ? WHERE id = 'local'").run([
      JSON.stringify({
        profile_summary: `Python 课程学习者，已完成自适应诊断（${stopReason}），建议从薄弱概念开始巩固。`,
        current_level: inferLevelFromDiagnostic(runtime, diagnosticSessionId),
        current_goal: goalFromDiagnosticResult(runtime, readiness),
        diagnostic_completion_confidence: readiness.completion_confidence,
        diagnostic_placement_concept_id: readiness.placement.top_start_id,
        diagnostic_placement_label: placementLabel(runtime, readiness.placement.top_start_id),
        diagnostic_confidence_margin: readiness.placement.confidence_margin,
        diagnostic_verified_boundary_ids: readiness.placement.verified_boundary_ids,
        weak_concept_ids: readiness.weak_concept_ranking,
        unresolved_concept_ids: readiness.unresolved_concept_ids,
      }),
      now,
    ]);
    return true;
  });
}

function inferLevelFromDiagnostic(runtime: AppRuntime, diagnosticSessionId: string): string {
  const states = loadDiagnosticStates(runtime, diagnosticSessionId);
  const readiness = computeDiagnosticReadiness(states, countDiagnosticAnswers(runtime, diagnosticSessionId));
  const placement = placementLabel(runtime, readiness.placement.top_start_id);
  if (placement) return `从${placement}起步`;
  const row = runtime.db.query<{ avg_mastery: number }>(
    "SELECT AVG(mastery) AS avg_mastery FROM diagnostic_concept_state WHERE diagnostic_session_id = ?",
  ).get([diagnosticSessionId]);
  const mastery = row?.avg_mastery ?? 0;
  if (mastery >= 70) return "进阶基础";
  if (mastery >= 40) return "初级";
  return "初学者";
}

function goalFromDiagnosticResult(runtime: AppRuntime, readiness: ReturnType<typeof computeDiagnosticReadiness>): string | null {
  const conceptId = readiness.weak_concept_ranking[0] ?? readiness.unresolved_concept_ids[0];
  if (!conceptId) return null;
  const concept = getCatalogConceptById(runtime, conceptId);
  return concept ? `巩固：${concept.name}` : null;
}

function loadDiagnosticStates(runtime: AppRuntime, diagnosticSessionId: string): DiagnosticConceptSnapshot[] {
  const policyInputs = getCatalogProgressPolicyInputMap(runtime);
  return runtime.db.query<DiagnosticConceptSnapshot>(
    `SELECT
       s.concept_id,
       s.mastery,
       s.confidence,
       s.evidence_count,
       s.uncertainty,
       s.band,
       s.conflicting_evidence_count,
       COALESCE(m.review_priority, 0) AS review_priority,
       s.last_item_id,
      c.order_index AS catalog_order
     FROM diagnostic_concept_state s
     LEFT JOIN concept_mastery m ON m.concept_id = s.concept_id
     LEFT JOIN concepts c ON c.id = s.concept_id
     WHERE s.diagnostic_session_id = ?`,
  ).all([diagnosticSessionId]).map((state) => {
    const policy = policyInputs.get(state.concept_id);
    return {
      ...state,
      catalog_priority_weight: policy?.prerequisite_weight ?? 1,
      prerequisite_blocker: policy?.prerequisite_blocker ?? false,
    };
  });
}

function loadDefaultDiagnosticStates(runtime: AppRuntime): DiagnosticConceptSnapshot[] {
  const policyInputs = getCatalogProgressPolicyInputMap(runtime);
  const masteryRows = runtime.db.query<{ concept_id: string; mastery_level: number; confidence: number; evidence_count: number; review_priority: number }>(
    "SELECT concept_id, mastery_level, confidence, evidence_count, review_priority FROM concept_mastery WHERE evidence_count > 0",
  ).all();
  const masteryByConcept = new Map(masteryRows.map((row) => [row.concept_id, row]));
  return getCatalogDiagnosticsConcepts(runtime).map((concept) => {
    const mastery = masteryByConcept.get(concept.id);
    const policy = policyInputs.get(concept.id);
    const evidenceCount = mastery?.evidence_count ?? 0;
    const confidence = mastery?.confidence ?? 0;
    const masteryLevel = mastery?.mastery_level ?? 0;
    return {
      concept_id: concept.id,
      mastery: masteryLevel,
      confidence,
      evidence_count: evidenceCount,
      uncertainty: computeConceptUncertainty(confidence, evidenceCount, 0),
      band: (evidenceCount === 0 ? "unknown" : bandForMastery(masteryLevel, evidenceCount)) as DiagnosticBand,
      conflicting_evidence_count: 0,
      review_priority: mastery?.review_priority ?? 0,
      last_item_id: null,
      catalog_order: concept.order_index,
      catalog_priority_weight: policy?.prerequisite_weight ?? 1,
      prerequisite_blocker: policy?.prerequisite_blocker ?? false,
    };
  });
}

function loadRecentDiagnosticAttempts(runtime: AppRuntime, diagnosticSessionId: string): DiagnosticAttemptSnapshot[] {
  return runtime.db.query<{ question_id: string; concept_ids_json: string; result_summary_json: string; difficulty: number; created_at: string }>(
    `SELECT a.question_id, q.concept_ids_json, a.result_summary_json, q.difficulty, a.created_at
     FROM diagnostic_attempts a
     JOIN diagnostic_questions q ON q.id = a.question_id
     JOIN generated_items gi ON gi.id = a.question_id
     WHERE gi.diagnostic_session_id = ?
     ORDER BY a.created_at DESC
     LIMIT 4`,
  ).all([diagnosticSessionId]).map((row) => {
    const summary = parseObject(row.result_summary_json) as { outcome?: DiagnosticOutcome };
    return {
      item_id: row.question_id,
      concept_ids: parseStringArray(row.concept_ids_json),
      outcome: summary.outcome ?? "ambiguous",
      difficulty: row.difficulty,
      created_at: row.created_at,
    };
  });
}

function projectDiagnosticEvidence(runtime: AppRuntime, input: {
  diagnosticSessionId: string;
  sessionId: string;
  states: DiagnosticConceptSnapshot[];
  createdAt: string;
}): void {
  for (const state of input.states) {
    const projection = diagnosticProjectionForState(state);
    if (!projection) continue;
    recordEvidenceAndProject(runtime, {
      sourceType: "diagnostic",
      sourceId: input.diagnosticSessionId,
      sessionId: input.sessionId,
      turnId: null,
      conceptId: state.concept_id,
      outcome: projection.outcome,
      difficulty: diagnosticDifficultyForState(state),
      evaluatorConfidence: state.confidence,
      evidenceWeight: projection.evidenceWeight,
      summary: {
        schema_version: "diagnostic_learning_evidence.v1",
        band: state.band,
        mastery: Math.round(state.mastery),
        confidence: state.confidence,
        evidence_count: state.evidence_count,
        uncertainty: state.uncertainty,
      },
      hintCount: diagnosticHintCountForOutcome(projection.outcome),
      prerequisiteCentrality: projection.prerequisiteCentrality,
      audit: {
        toolCallId: `projection:${input.diagnosticSessionId}:${state.concept_id}`,
        toolName: "diagnostic_mastery_projection",
        status: "diagnostic_completed",
        score: Math.round(state.mastery),
        conceptIds: [state.concept_id],
      },
      createdAt: input.createdAt,
    });
  }
}

function persistSelectionRationale(
  runtime: AppRuntime,
  diagnosticSessionId: string,
  generatedItemId: string,
  selection: DiagnosticPriorityResult,
  now: string,
): void {
  runtime.db.query(
    "INSERT INTO diagnostic_rationales(id, diagnostic_session_id, generated_item_id, rationale_type, target_concept_id, difficulty_direction, rationale_json, created_at) VALUES (?, ?, ?, 'selection', ?, ?, ?, ?)",
  ).run([
    createId("diag"),
    diagnosticSessionId,
    generatedItemId,
    selection.concept_id,
    selection.difficulty_direction,
    boundedRationaleJson({
      schema_version: "diagnostic_selection_rationale.v1",
      target_concept_id: selection.concept_id,
      score: selection.score,
      difficulty_direction: selection.difficulty_direction,
      placement: {
        target_concept_id: selection.concept_id,
        rationale: selection.rationale.filter((item) => item.includes("placement")),
      },
      priority_inputs: selection.priority_inputs,
      rationale: selection.rationale,
    }),
    now,
  ]);
}

function persistStopRationale(
  runtime: AppRuntime,
  diagnosticSessionId: string,
  stopReason: string,
  readiness: ReturnType<typeof computeDiagnosticReadiness>,
  now: string,
): void {
  runtime.db.query(
    "INSERT INTO diagnostic_rationales(id, diagnostic_session_id, generated_item_id, rationale_type, target_concept_id, difficulty_direction, rationale_json, created_at) VALUES (?, ?, NULL, 'stop', NULL, NULL, ?, ?)",
  ).run([
    createId("diag"),
    diagnosticSessionId,
    boundedRationaleJson({
      schema_version: "diagnostic_stop_rationale.v1",
      stop_reason: stopReason,
      completion_confidence: readiness.completion_confidence,
      placement: {
        leading_start_id: readiness.placement.top_start_id,
        leading_start_label: placementLabel(runtime, readiness.placement.top_start_id) ?? readiness.placement.top_start_label,
        runner_up_start_id: readiness.placement.runner_up_start_id,
        confidence_margin: readiness.placement.confidence_margin,
        verified_boundary_ids: readiness.placement.verified_boundary_ids,
        unresolved_boundary_ids: readiness.placement.unresolved_boundary_ids,
      },
      weak_concept_ranking: readiness.weak_concept_ranking,
      unresolved_concept_ids: readiness.unresolved_concept_ids,
    }),
    now,
  ]);
}

function persistGenerationInterruptionRationale(runtime: AppRuntime, diagnosticSessionId: string, now = nowIso()): void {
  const states = loadDiagnosticStates(runtime, diagnosticSessionId);
  const readiness = computeDiagnosticReadiness(states, countDiagnosticAnswers(runtime, diagnosticSessionId));
  persistStopRationale(runtime, diagnosticSessionId, DIAGNOSTIC_GENERATION_UNAVAILABLE_REASON, readiness, now);
}

function persistRecoveryRationale(runtime: AppRuntime, diagnosticSessionId: string, generatedItemId: string, now: string): void {
  const readiness = computeDiagnosticReadiness(loadDiagnosticStates(runtime, diagnosticSessionId), countDiagnosticAnswers(runtime, diagnosticSessionId));
  runtime.db.query(
    "INSERT INTO diagnostic_rationales(id, diagnostic_session_id, generated_item_id, rationale_type, target_concept_id, difficulty_direction, rationale_json, created_at) VALUES (?, ?, ?, 'selection', NULL, NULL, ?, ?)",
  ).run([
    createId("diag"),
    diagnosticSessionId,
    generatedItemId,
    boundedRationaleJson({
      schema_version: "diagnostic_generation_recovery.v1",
      recovery: "generation_recovered",
      previous_stop_reason: DIAGNOSTIC_GENERATION_UNAVAILABLE_REASON,
      answered: countDiagnosticAnswers(runtime, diagnosticSessionId),
      completion_confidence: readiness.completion_confidence,
      placement: {
        leading_start_id: readiness.placement.top_start_id,
        leading_start_label: placementLabel(runtime, readiness.placement.top_start_id) ?? readiness.placement.top_start_label,
        confidence_margin: readiness.placement.confidence_margin,
      },
    }),
    now,
  ]);
}

function boundedRationaleJson(value: unknown): string {
  const json = JSON.stringify(sanitizeRationale(value));
  if (json.length <= 2000) return json;
  return JSON.stringify({
    schema_version: "bounded_rationale_summary.v1",
    truncated: true,
    summary: summarizeText(json, 1800),
  });
}

function sanitizeRationale(value: unknown): unknown {
  if (typeof value === "string") return redactText(value, 180);
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 12).map(sanitizeRationale);
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (/answer|rubric|private/i.test(key)) continue;
    output[key] = sanitizeRationale(item);
  }
  return output;
}

function diagnosticDifficultyForState(state: DiagnosticConceptSnapshot): number {
  if (state.prerequisite_blocker) return 3;
  if ((state.catalog_priority_weight ?? 0) >= 3) return 3;
  return 2;
}

function diagnosticHintCountForOutcome(outcome: ProjectionOutcome): number {
  if (outcome === "completed_with_hint") return 1;
  if (outcome === "failed_after_hints") return 2;
  if (outcome === "repeated_mistake") return 3;
  return 0;
}

function normalizeDiagnosticSession(runtime: AppRuntime, session: DiagnosticSessionRow | undefined): DiagnosticSessionRow | undefined {
  if (!session) return undefined;
  if (session.status === "paused" && session.stop_reason === "needs_more_evidence") {
    runtime.db.query("UPDATE diagnostic_sessions SET status = 'active', stop_reason = NULL, ended_at = NULL WHERE id = ?").run([session.id]);
    return { ...session, status: "active", stop_reason: null };
  }
  if (session.status === "paused" && session.stop_reason === DIAGNOSTIC_GENERATION_UNAVAILABLE_REASON) {
    runtime.db.query("UPDATE diagnostic_sessions SET status = 'active', ended_at = NULL WHERE id = ?").run([session.id]);
    return { ...session, status: "active" };
  }
  return session;
}

function placementLabel(runtime: AppRuntime, conceptId: string | null): string | null {
  if (!conceptId) return null;
  return getCatalogConceptById(runtime, conceptId)?.name ?? conceptId;
}

function parseAnswerKey(answerKeyRef: string): { choice: string } {
  const match = answerKeyRef.match(/answer:choice:([a-d])/i);
  return { choice: match?.[1]?.toLowerCase() ?? "a" };
}

function bandForMastery(mastery: number, evidenceCount: number): DiagnosticBand {
  if (evidenceCount === 0) return "unknown";
  if (mastery < 40) return "weak";
  if (mastery < 70) return "learning";
  return "proficient";
}

function sanitizeConceptIds(runtime: AppRuntime, conceptIds: string[]): string[] {
  const sanitized = conceptIds.filter((conceptId) => getCatalogConceptById(runtime, conceptId));
  if (sanitized.length > 0) return [...new Set(sanitized)].slice(0, 3);
  const fallback = getCatalogDiagnosticsConcepts(runtime)[0]?.id;
  if (!fallback) {
    throw new AppError("CATALOG_UNAVAILABLE", "课程目录没有可用于生成测评题的有效概念。", 503, true);
  }
  return [fallback];
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseChoices(value: string): Array<{ id: string; text: string }> {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is { id: string; text: string } => item && typeof item.id === "string" && typeof item.text === "string")
      : [];
  } catch {
    return [];
  }
}

function parseObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}
