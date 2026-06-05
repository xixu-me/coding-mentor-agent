import type {
  AgentPracticeProgressEffect,
  AgentPracticeReviewConfidence,
  AgentPracticeReviewEvidenceSummary,
  AgentPracticeReviewStatus,
  AppRuntime,
  RecentProgressEvidenceSummary,
} from "../types.js";
import { summarizeText } from "../security/redaction.js";

type LearningEvidenceRow = {
  id: string;
  source_type: RecentProgressEvidenceSummary["source_type"];
  source_id: string;
  session_id: string | null;
  turn_id: string | null;
  concept_id: string;
  outcome: string;
  score: number | null;
  evaluator_confidence: number | null;
  summary_json: string;
  created_at: string;
};

type ReviewRow = {
  id: string;
  practice_contract_id: string;
  review_status: AgentPracticeReviewStatus;
  confidence: AgentPracticeReviewConfidence;
  evidence_refs_json: string;
  progress_effect: AgentPracticeProgressEffect;
  progress_reason: string | null;
};

type ConceptRow = {
  id: string;
  name: string;
};

export function loadLatestProgressEvidenceSummary(runtime: AppRuntime, sessionId: string): RecentProgressEvidenceSummary | null {
  const latest = runtime.db.query<LearningEvidenceRow>(
    `SELECT id, source_type, source_id, session_id, turn_id, concept_id, outcome, score,
            evaluator_confidence, summary_json, created_at
     FROM learning_evidence
     WHERE session_id = ? AND validity_state = 'valid'
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
  ).get([sessionId]);
  if (!latest) return null;
  return progressEvidenceFromSource(runtime, latest.source_type, latest.source_id, sessionId);
}

export function loadProgressEvidenceSummaries(runtime: AppRuntime, options: { sessionId?: string | null; limit?: number } = {}): RecentProgressEvidenceSummary[] {
  const limit = Math.max(1, Math.min(50, Math.round(options.limit ?? 20)));
  const rows = options.sessionId
    ? runtime.db.query<LearningEvidenceRow>(
      `SELECT id, source_type, source_id, session_id, turn_id, concept_id, outcome, score,
              evaluator_confidence, summary_json, created_at
       FROM learning_evidence
       WHERE session_id = ? AND validity_state = 'valid'
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    ).all([options.sessionId, limit])
    : runtime.db.query<LearningEvidenceRow>(
      `SELECT id, source_type, source_id, session_id, turn_id, concept_id, outcome, score,
              evaluator_confidence, summary_json, created_at
       FROM learning_evidence
       WHERE validity_state = 'valid'
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    ).all([limit]);
  const seen = new Set<string>();
  const summaries: RecentProgressEvidenceSummary[] = [];
  for (const row of rows) {
    const key = `${row.source_type}:${row.source_id}:${row.session_id ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const summary = progressEvidenceFromSource(runtime, row.source_type, row.source_id, row.session_id);
    if (summary) summaries.push(summary);
  }
  return summaries.slice(0, limit);
}

export function loadProgressEvidenceSummariesForTurns(runtime: AppRuntime, sessionId: string, turnIds: string[]): Map<string, RecentProgressEvidenceSummary> {
  const uniqueTurnIds = [...new Set(turnIds)].filter(Boolean).slice(0, 100);
  const byTurn = new Map<string, RecentProgressEvidenceSummary>();
  if (uniqueTurnIds.length === 0) return byTurn;
  const placeholders = uniqueTurnIds.map(() => "?").join(", ");
  const rows = runtime.db.query<LearningEvidenceRow>(
    `SELECT id, source_type, source_id, session_id, turn_id, concept_id, outcome, score,
            evaluator_confidence, summary_json, created_at
     FROM learning_evidence
     WHERE session_id = ? AND turn_id IN (${placeholders}) AND validity_state = 'valid'
     ORDER BY created_at DESC, id DESC`,
  ).all([sessionId, ...uniqueTurnIds]);
  const seenSource = new Set<string>();
  for (const row of rows) {
    if (!row.turn_id || byTurn.has(row.turn_id)) continue;
    const sourceKey = `${row.source_type}:${row.source_id}:${row.session_id ?? ""}`;
    if (seenSource.has(sourceKey)) continue;
    seenSource.add(sourceKey);
    const summary = progressEvidenceFromSource(runtime, row.source_type, row.source_id, row.session_id);
    if (summary) byTurn.set(row.turn_id, summary);
  }
  return byTurn;
}

export function attachProgressEvidenceToReview<T extends {
  id: string;
  progress_effect: AgentPracticeProgressEffect;
  recent_progress_evidence_id?: string | null;
  recorded_concept_ids?: string[];
}>(review: T | null, evidence: RecentProgressEvidenceSummary | null): T | null {
  if (!review) return null;
  if (!evidence || evidence.review_id !== review.id) return review;
  return {
    ...review,
    recent_progress_evidence_id: evidence.source_id,
    recorded_concept_ids: evidence.concept_ids,
  };
}

function progressEvidenceFromSource(
  runtime: AppRuntime,
  sourceType: RecentProgressEvidenceSummary["source_type"],
  sourceId: string,
  sessionId: string | null,
): RecentProgressEvidenceSummary | null {
  const rows = sessionId
    ? runtime.db.query<LearningEvidenceRow>(
      `SELECT id, source_type, source_id, session_id, turn_id, concept_id, outcome, score,
              evaluator_confidence, summary_json, created_at
       FROM learning_evidence
       WHERE source_type = ? AND source_id = ? AND session_id = ? AND validity_state = 'valid'
       ORDER BY created_at ASC, id ASC`,
    ).all([sourceType, sourceId, sessionId])
    : runtime.db.query<LearningEvidenceRow>(
      `SELECT id, source_type, source_id, session_id, turn_id, concept_id, outcome, score,
              evaluator_confidence, summary_json, created_at
       FROM learning_evidence
       WHERE source_type = ? AND source_id = ? AND validity_state = 'valid'
       ORDER BY created_at ASC, id ASC`,
    ).all([sourceType, sourceId]);
  if (rows.length === 0) return null;
  const first = rows[0]!;
  const review = sourceType === "tutor_review" ? loadReview(runtime, sourceId, first.session_id) : null;
  const conceptIds = [...new Set(rows.map((row) => summarizeText(row.concept_id, 80)).filter(Boolean))];
  return {
    source_type: sourceType,
    source_id: sourceId,
    evidence_ids: rows.map((row) => row.id).slice(0, 20),
    review_id: review?.id ?? (sourceType === "tutor_review" ? sourceId : null),
    practice_contract_id: review?.practice_contract_id ?? practiceContractIdFromSummary(first.summary_json),
    concept_ids: conceptIds,
    concepts: conceptIds.map((conceptId) => ({ concept_id: conceptId, label: conceptLabel(runtime, conceptId) })),
    outcome: summarizeText(first.outcome, 80),
    progress_effect: review?.progress_effect ?? "recorded",
    review_status: review?.review_status ?? null,
    confidence: review?.confidence ?? null,
    score: first.score,
    evaluator_confidence: first.evaluator_confidence,
    reason: review?.progress_reason ? summarizeText(review.progress_reason, 300) : null,
    evidence_refs: parseEvidenceRefs(review?.evidence_refs_json),
    created_at: rows.at(-1)?.created_at ?? first.created_at,
  };
}

function loadReview(runtime: AppRuntime, reviewId: string, sessionId: string | null): ReviewRow | null {
  const row = sessionId
    ? runtime.db.query<ReviewRow>(
      "SELECT id, practice_contract_id, review_status, confidence, evidence_refs_json, progress_effect, progress_reason FROM agent_practice_reviews WHERE id = ? AND session_id = ?",
    ).get([reviewId, sessionId])
    : runtime.db.query<ReviewRow>(
      "SELECT id, practice_contract_id, review_status, confidence, evidence_refs_json, progress_effect, progress_reason FROM agent_practice_reviews WHERE id = ?",
    ).get([reviewId]);
  return row ?? null;
}

function conceptLabel(runtime: AppRuntime, conceptId: string): string {
  const row = runtime.db.query<ConceptRow>("SELECT id, name FROM concepts WHERE id = ?").get([conceptId]);
  return summarizeText(row?.name ?? conceptId, 120);
}

function practiceContractIdFromSummary(summaryJson: string): string | null {
  const summary = parseRecord(summaryJson);
  return typeof summary.practice_contract_id === "string" ? summarizeText(summary.practice_contract_id, 120) : null;
}

function parseEvidenceRefs(value: string | undefined): AgentPracticeReviewEvidenceSummary[] {
  const parsed = parseArray(value);
  return parsed
    .filter(isRecord)
    .map((item) => ({
      tool_name: summarizeText(String(item.tool_name ?? ""), 80),
      result_code: summarizeText(String(item.result_code ?? ""), 80),
      summary: summarizeText(String(item.summary ?? ""), 500),
    }))
    .filter((item) => item.tool_name.length > 0)
    .slice(0, 10);
}

function parseArray(value: string | undefined): unknown[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseRecord(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
