import type { AppRuntime } from "../types.js";
import { conceptProgressFromProjection } from "./progress-policy.js";
import { getActiveCatalogConcepts, getCatalogProgressPolicyInputMap } from "./course-catalog.js";

export type RankedRecommendation = {
  id: string;
  type: "exercise" | "review";
  target_id: string;
  reason: string;
  score: number;
  concept_id: string;
};

type MasteryProjection = {
  concept_id: string;
  mastery_level: number;
  confidence: number;
  readiness: number;
  evidence_count: number;
  review_priority: number;
  last_evidence_at: string | null;
};

const SCORE = {
  weaknessScale: 0.42,
  readinessScale: 0.28,
  confidenceScale: 8,
  reviewPriorityScale: 3,
  prerequisiteBlocker: 24,
  downstreamScale: 4,
  prerequisiteWeightScale: 3,
  remediationRoute: 10,
  recentFailure: 12,
  recentSuccess: -4,
  repetitionPenalty: -7,
  severeBlockerFloor: 42,
} as const;

export function rankProgressRecommendations(runtime: AppRuntime, options: { sessionId?: string | null; limit?: number } = {}): RankedRecommendation[] {
  const limit = Math.max(1, Math.min(10, options.limit ?? 5));
  const concepts = getActiveCatalogConcepts(runtime);
  const policyByConcept = getCatalogProgressPolicyInputMap(runtime);
  const masteryByConcept = new Map(runtime.db.query<MasteryProjection>(
    "SELECT concept_id, mastery_level, confidence, readiness, evidence_count, review_priority, last_evidence_at FROM concept_mastery",
  ).all().map((row) => [row.concept_id, row]));
  const recentEvidence = loadRecentEvidenceByConcept(runtime, options.sessionId);
  const recentTargetCount = loadRecentTargetCount(runtime, options.sessionId);

  return concepts
    .map((concept) => {
      const projection = masteryByConcept.get(concept.id);
      const unknown = !projection || projection.evidence_count <= 0;
      const policy = policyByConcept.get(concept.id);
      const progress = conceptProgressFromProjection(projection);
      const weakness = 100 - progress;
      const readinessGap = 100 - (projection?.readiness ?? 0);
      const hasRemediation = (policy?.remediation_concept_ids.length ?? 0) > 0;
      const recent = recentEvidence.get(concept.id);
      const repeatedTargets = recentTargetCount.get(concept.id) ?? 0;
      const severeBlocker = Boolean(policy?.prerequisite_blocker) && (unknown || (projection?.readiness ?? 0) < 30);
      const score = round2(Math.max(
        severeBlocker ? SCORE.severeBlockerFloor : 0,
        weakness * SCORE.weaknessScale
          + readinessGap * SCORE.readinessScale
          + (1 - Math.max(0, projection?.confidence ?? 0)) * SCORE.confidenceScale
          + (projection?.review_priority ?? 0) * SCORE.reviewPriorityScale
          + (policy?.prerequisite_blocker ? SCORE.prerequisiteBlocker : 0)
          + (policy?.downstream_concept_ids.length ?? 0) * SCORE.downstreamScale
          + (policy?.prerequisite_weight ?? 0) * SCORE.prerequisiteWeightScale
          + (hasRemediation ? SCORE.remediationRoute : 0)
          + (isFailureOutcome(recent?.outcome) ? SCORE.recentFailure : 0)
          + (isSuccessOutcome(recent?.outcome) ? SCORE.recentSuccess : 0)
          + (severeBlocker ? 0 : repeatedTargets * SCORE.repetitionPenalty),
      ));
      const targetId = chooseRecommendationTarget(concept.id, policy?.remediation_concept_ids ?? [], recent?.outcome);
      return {
        id: `ranked:${targetId}`,
        type: "exercise" as const,
        target_id: targetId,
        concept_id: concept.id,
        score,
        reason: recommendationReason({ conceptId: concept.id, targetId, score, prerequisite: Boolean(policy?.prerequisite_blocker), remediation: targetId !== concept.id, repeatedTargets, unknown }),
      };
    })
    .sort((left, right) => right.score - left.score || left.target_id.localeCompare(right.target_id, "en"))
    .slice(0, limit);
}

function loadRecentEvidenceByConcept(runtime: AppRuntime, sessionId?: string | null): Map<string, { outcome: string; created_at: string }> {
  const rows = sessionId
    ? runtime.db.query<{ concept_id: string; outcome: string; created_at: string }>(
      "SELECT concept_id, outcome, created_at FROM learning_evidence WHERE session_id = ? AND validity_state = 'valid' ORDER BY created_at DESC LIMIT 50",
    ).all([sessionId])
    : runtime.db.query<{ concept_id: string; outcome: string; created_at: string }>(
      "SELECT concept_id, outcome, created_at FROM learning_evidence WHERE validity_state = 'valid' ORDER BY created_at DESC LIMIT 50",
    ).all();
  const result = new Map<string, { outcome: string; created_at: string }>();
  for (const row of rows) {
    if (!result.has(row.concept_id)) result.set(row.concept_id, row);
  }
  return result;
}

function loadRecentTargetCount(runtime: AppRuntime, sessionId?: string | null): Map<string, number> {
  const rows = sessionId
    ? runtime.db.query<{ concept_id: string }>(
      "SELECT concept_id FROM learning_evidence WHERE session_id = ? AND validity_state = 'valid' ORDER BY created_at DESC LIMIT 20",
    ).all([sessionId])
    : [];
  const result = new Map<string, number>();
  for (const row of rows) {
    result.set(row.concept_id, (result.get(row.concept_id) ?? 0) + 1);
  }
  return result;
}

function chooseRecommendationTarget(conceptId: string, remediationConceptIds: string[], recentOutcome?: string): string {
  if (remediationConceptIds.length > 0 && isFailureOutcome(recentOutcome)) {
    return remediationConceptIds[0]!;
  }
  return conceptId;
}

function recommendationReason(input: { conceptId: string; targetId: string; score: number; prerequisite: boolean; remediation: boolean; repeatedTargets: number; unknown: boolean }): string {
  const parts = ["KB graph-ranked"];
  if (input.unknown) parts.push("unknown evidence coverage");
  if (input.prerequisite) parts.push("prerequisite blocker");
  if (input.remediation) parts.push(`remediation route from ${input.conceptId}`);
  if (input.repeatedTargets > 0) parts.push("active-session repetition bounded");
  parts.push(`score ${input.score}`);
  return parts.join("; ");
}

function isFailureOutcome(outcome?: string): boolean {
  return outcome === "failed_after_hints" || outcome === "repeated_mistake";
}

function isSuccessOutcome(outcome?: string): boolean {
  return outcome === "completed_independently" || outcome === "completed_with_hint";
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
