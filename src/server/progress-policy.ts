import type { AppRuntime } from "../types.js";
import { createId, nowIso } from "../security/ids.js";
import { sanitizeToolOutput } from "../tools/tool-policy.js";
import type { DiagnosticBand, DiagnosticConceptSnapshot } from "./diagnostic-strategy.js";

export const PROGRESS_POLICY = {
  readinessThreshold: 70,
  unitCompletionThreshold: 70,
  confidenceThreshold: 0.75,
  evidenceWeights: {
    completed_independently: 1,
    completed_with_hint: 0.65,
    explained_mistake: 0.45,
    failed_after_hints: 0.7,
    repeated_mistake: 0.9,
  },
  reviewPriority: {
    prerequisiteCentralityScale: 0.7,
    recencyPenaltyDays: 7,
  },
} as const;

export type ProjectionOutcome =
  | "completed_independently"
  | "completed_with_hint"
  | "explained_mistake"
  | "failed_after_hints"
  | "repeated_mistake";

export type LearningEvidenceInput = {
  sourceType: "diagnostic" | "exercise" | "project" | "tutor_review" | "mistake";
  sourceId: string;
  sessionId?: string | null;
  turnId?: string | null;
  conceptId: string;
  outcome: ProjectionOutcome;
  difficulty?: number | null;
  score?: number | null;
  evaluatorConfidence?: number | null;
  evidenceWeight?: number;
  catalogVersion?: string | null;
  summary?: Record<string, unknown>;
  validityState?: "valid" | "invalid" | "corrected";
  createdAt?: string;
};

export type MasteryProjectionRow = {
  mastery_level: number;
  confidence: number;
  readiness: number;
  evidence_count: number;
};

export type EvidenceInsertStatus = "inserted" | "duplicate" | "corrected";

export type LearningEvidenceRecordResult = {
  status: EvidenceInsertStatus;
  evidenceId: string;
  createdAt: string;
};

export type EvidenceProjectionResult = LearningEvidenceRecordResult & {
  projection: {
    mastery_level: number;
    confidence: number;
    readiness: number;
    review_priority: number;
  };
};

type StoredMasteryProjectionRow = MasteryProjectionRow & {
  review_priority: number;
  last_evidence_at: string | null;
};

export function evidenceWeightForOutcome(outcome: ProjectionOutcome): number {
  return PROGRESS_POLICY.evidenceWeights[outcome];
}

export function computeMasteryProjectionUpdate(input: {
  currentLevel: number;
  currentConfidence: number;
  currentReadiness: number;
  evidenceCount: number;
  outcome: ProjectionOutcome;
  difficulty?: number | null;
  hintCount?: number | null;
  evidenceWeight?: number;
  prerequisiteCentrality?: number;
}): { mastery_level: number; confidence: number; readiness: number; review_priority: number } {
  const difficulty = Math.max(1, Math.min(5, Math.round(input.difficulty ?? 2)));
  const hintPenalty = Math.min(input.hintCount ?? 0, 5);
  const evidenceWeight = Math.max(0, input.evidenceWeight ?? evidenceWeightForOutcome(input.outcome));
  const masteryDeltaByOutcome: Record<ProjectionOutcome, number> = {
    completed_independently: 8 + difficulty * 2,
    completed_with_hint: Math.max(1, 5 + difficulty - hintPenalty),
    explained_mistake: 3,
    failed_after_hints: -8,
    repeated_mistake: -10,
  };
  const readinessDeltaByOutcome: Record<ProjectionOutcome, number> = {
    completed_independently: 12 + difficulty * 2,
    completed_with_hint: Math.max(1, 6 + difficulty - hintPenalty * 2),
    explained_mistake: 2,
    failed_after_hints: -12,
    repeated_mistake: -16,
  };
  const positive = input.outcome === "completed_independently" || input.outcome === "completed_with_hint" || input.outcome === "explained_mistake";
  const confidenceDelta = positive
    ? 0.08 * evidenceWeight + Math.min(input.evidenceCount, 8) * 0.005
    : 0.06 * evidenceWeight + Math.min(input.evidenceCount, 8) * 0.004;
  const mastery = clamp(input.currentLevel + masteryDeltaByOutcome[input.outcome] * evidenceWeight, 0, 100);
  const readiness = positive
    ? clamp(input.currentReadiness + readinessDeltaByOutcome[input.outcome] * evidenceWeight, 0, 100)
    : clamp(Math.min(input.currentReadiness, input.currentLevel) + readinessDeltaByOutcome[input.outcome] * evidenceWeight, 0, 100);
  const confidence = clamp(input.currentConfidence + confidenceDelta, 0.1, 1);
  const prerequisiteCentrality = Math.max(0, input.prerequisiteCentrality ?? 0);
  const failureBonus = positive ? 0 : 1.4;
  const reviewPriority = clampInteger(
    Math.round(((100 - readiness) / 18) + (1 - confidence) + failureBonus + prerequisiteCentrality * PROGRESS_POLICY.reviewPriority.prerequisiteCentralityScale),
    0,
    10,
  );
  return {
    mastery_level: Math.round(mastery),
    confidence: round2(confidence),
    readiness: Math.round(readiness),
    review_priority: reviewPriority,
  };
}

export function conceptProgressFromProjection(input: { mastery_level: number; confidence: number; readiness?: number | null; evidence_count: number } | undefined): number {
  if (!input) return 0;
  if (input.evidence_count <= 0) return 0;
  const readiness = input.readiness ?? Math.round(input.mastery_level * input.confidence);
  const ability = Math.min(input.mastery_level, readiness);
  const confidenceCap = Math.max(0.35, Math.min(1, input.confidence));
  return clampInteger(Math.round(ability * confidenceCap), 0, 100);
}

export function recordValidatedLearningEvidence(runtime: AppRuntime, evidence: LearningEvidenceInput): LearningEvidenceRecordResult {
  const createdAt = evidence.createdAt ?? nowIso();
  const existing = runtime.db.query<{ id: string; created_at: string; validity_state: string }>(
    "SELECT id, created_at, validity_state FROM learning_evidence WHERE source_type = ? AND source_id = ? AND concept_id = ?",
  ).get([evidence.sourceType, evidence.sourceId, evidence.conceptId]);
  if (existing) {
    return {
      status: existing.validity_state === "corrected" ? "corrected" : "duplicate",
      evidenceId: existing.id,
      createdAt: existing.created_at,
    };
  }
  const evidenceId = createId("evid");
  const validityState = evidence.validityState ?? "valid";
  runtime.db.query(
    `INSERT INTO learning_evidence(
      id, source_type, source_id, session_id, turn_id, concept_id, outcome, difficulty,
      score, evaluator_confidence, evidence_weight, validity_state, catalog_version, summary_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run([
    evidenceId,
    evidence.sourceType,
    evidence.sourceId,
    evidence.sessionId ?? null,
    evidence.turnId ?? null,
    evidence.conceptId,
    evidence.outcome,
    evidence.difficulty ?? null,
    evidence.score ?? null,
    evidence.evaluatorConfidence ?? null,
    evidence.evidenceWeight ?? evidenceWeightForOutcome(evidence.outcome),
    validityState,
    evidence.catalogVersion ?? null,
    JSON.stringify(evidence.summary ?? {}),
    createdAt,
  ]);
  return { status: validityState === "corrected" ? "corrected" : "inserted", evidenceId, createdAt };
}

export function applyEvidenceToMasteryProjection(
  runtime: AppRuntime,
  input: LearningEvidenceInput & { hintCount?: number | null; prerequisiteCentrality?: number },
): { mastery_level: number; confidence: number; readiness: number; review_priority: number } {
  const now = input.createdAt ?? nowIso();
  const current = runtime.db.query<MasteryProjectionRow>(
    "SELECT mastery_level, confidence, readiness, evidence_count FROM concept_mastery WHERE concept_id = ?",
  ).get([input.conceptId]) ?? unknownProjectionSeed();
  const next = computeMasteryProjectionUpdate({
    currentLevel: current.mastery_level,
    currentConfidence: current.confidence,
    currentReadiness: current.readiness,
    evidenceCount: current.evidence_count,
    outcome: input.outcome,
    difficulty: input.difficulty,
    hintCount: input.hintCount,
    evidenceWeight: input.evidenceWeight,
    prerequisiteCentrality: input.prerequisiteCentrality,
  });
  runtime.db.query(
    `INSERT INTO concept_mastery(
      concept_id, mastery_level, confidence, readiness, evidence_count, review_priority,
      version, last_practiced_at, last_evidence_at, updated_at
    ) VALUES (?, ?, ?, ?, 1, ?, 1, ?, ?, ?)
    ON CONFLICT(concept_id) DO UPDATE SET
      mastery_level = excluded.mastery_level,
      confidence = excluded.confidence,
      readiness = excluded.readiness,
      evidence_count = concept_mastery.evidence_count + 1,
      review_priority = excluded.review_priority,
      version = concept_mastery.version + 1,
      last_practiced_at = excluded.last_practiced_at,
      last_evidence_at = excluded.last_evidence_at,
      updated_at = excluded.updated_at`,
  ).run([
    input.conceptId,
    next.mastery_level,
    next.confidence,
    next.readiness,
    next.review_priority,
    now,
    now,
    now,
  ]);
  return next;
}

export function recordEvidenceAndProject(
  runtime: AppRuntime,
  input: LearningEvidenceInput & {
    hintCount?: number | null;
    prerequisiteCentrality?: number;
    audit?: false | {
      toolCallId?: string;
      toolName?: string;
      resultCode?: string;
      status?: string;
      score?: number;
      conceptIds?: string[];
    };
  },
): EvidenceProjectionResult {
  return runtime.db.transaction(() => {
    const evidenceResult = recordValidatedLearningEvidence(runtime, input);
    if (evidenceResult.status === "duplicate") {
      return {
        ...evidenceResult,
        projection: readExistingProjection(runtime, input.conceptId),
      };
    }
    const projection = applyEvidenceToMasteryProjection(runtime, {
      ...input,
      createdAt: evidenceResult.createdAt,
    });
    if (input.audit !== false) {
      recordProjectionAuditEvidence(runtime, {
        sessionId: input.sessionId,
        turnId: input.turnId,
        attemptId: input.sourceId,
        conceptIds: input.audit?.conceptIds ?? [input.conceptId],
        status: input.audit?.status ?? input.sourceType,
        score: input.audit?.score ?? input.score ?? 0,
        outcome: input.outcome,
        toolCallId: input.audit?.toolCallId,
        toolName: input.audit?.toolName,
        resultCode: input.audit?.resultCode,
        createdAt: evidenceResult.createdAt,
      });
    }
    return {
      ...evidenceResult,
      projection,
    };
  });
}

export function diagnosticProjectionForState(state: Pick<DiagnosticConceptSnapshot, "band" | "mastery" | "confidence" | "evidence_count" | "catalog_priority_weight" | "prerequisite_blocker">): {
  outcome: ProjectionOutcome;
  evidenceWeight: number;
  prerequisiteCentrality: number;
} | undefined {
  if (state.evidence_count <= 0 || state.band === "unknown" || state.band === "unknown_needs_more_evidence") {
    return undefined;
  }
  const outcome = diagnosticOutcomeForBand(state.band, state.mastery);
  const confidenceWeight = Math.max(0.35, Math.min(1, state.confidence));
  const evidenceCoverageWeight = Math.min(1, 0.5 + state.evidence_count * 0.2);
  const weaknessWeight = outcome === "failed_after_hints" || outcome === "repeated_mistake" ? 0.85 : 1;
  return {
    outcome,
    evidenceWeight: round2(confidenceWeight * evidenceCoverageWeight * weaknessWeight),
    prerequisiteCentrality: Math.max(0, state.catalog_priority_weight ?? 0) + (state.prerequisite_blocker ? 1 : 0),
  };
}

export function recordProjectionAuditEvidence(runtime: AppRuntime, input: {
  sessionId?: string | null;
  turnId?: string | null;
  attemptId: string;
  conceptIds: string[];
  status: string;
  score: number;
  outcome: ProjectionOutcome;
  toolCallId?: string;
  toolName?: string;
  resultCode?: string;
  createdAt?: string;
}): void {
  runtime.db.query(
    "INSERT INTO tool_evidence(id, session_id, turn_id, tool_name, tool_call_id, result_code, summary_json, redacted, schema_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run([
    createId("tool"),
    input.sessionId ?? null,
    input.turnId ?? null,
    input.toolName ?? "update_mastery_projection",
    input.toolCallId ?? `projection:${input.attemptId}`,
    input.resultCode ?? "allowed_success",
    JSON.stringify(sanitizeToolOutput({
      policy: {
        policy_group: "exercise_submission_tools",
        caller: "workflow",
        result_code: input.resultCode ?? "allowed_success",
      },
      attempt_id: input.attemptId,
      concept_ids: input.conceptIds,
      status: input.status,
      score: input.score,
      outcome: input.outcome,
    }, 500)),
    1,
    "tool_evidence.v1",
    input.createdAt ?? nowIso(),
  ]);
}

function readExistingProjection(runtime: AppRuntime, conceptId: string): StoredMasteryProjectionRow {
  return runtime.db.query<StoredMasteryProjectionRow>(
    "SELECT mastery_level, confidence, readiness, evidence_count, review_priority, last_evidence_at FROM concept_mastery WHERE concept_id = ?",
  ).get([conceptId]) ?? { ...unknownProjectionSeed(), review_priority: 0, last_evidence_at: null };
}

function unknownProjectionSeed(): MasteryProjectionRow {
  return {
    mastery_level: 0,
    confidence: 0,
    readiness: 0,
    evidence_count: 0,
  };
}

function diagnosticOutcomeForBand(band: DiagnosticBand, mastery: number): ProjectionOutcome {
  if (band === "proficient" || mastery >= 70) return "completed_independently";
  if (band === "learning" || mastery >= 40) return "completed_with_hint";
  return mastery <= 20 ? "repeated_mistake" : "failed_after_hints";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
