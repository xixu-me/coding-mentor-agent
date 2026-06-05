import type { AppRuntime, LearningFrontier, LearningProgressDecision } from "../types.js";
import {
  getActiveCatalogConcepts,
  getCatalogProgressPolicyInputMap,
  getLatestCatalogRun,
} from "./course-catalog.js";
import { deriveLearningProgressDecision } from "./learning-progress-decision.js";
import { conceptProgressFromProjection, PROGRESS_POLICY } from "./progress-policy.js";

type MasteryRow = {
  concept_id: string;
  mastery_level: number;
  confidence: number;
  readiness: number;
  evidence_count: number;
  review_priority: number;
};

export function deriveLearningFrontier(
  runtime: AppRuntime,
  input: { sessionId: string; decision?: LearningProgressDecision },
): LearningFrontier {
  const decision = input.decision ?? deriveLearningProgressDecision(runtime, { sessionId: input.sessionId });
  const catalog = getLatestCatalogRun(runtime);
  const diagnosticSessionId = latestDiagnosticSessionId(runtime, input.sessionId);
  if (decision.diagnostic_state !== "completed") {
    return pausedFrontier(decision, catalog, diagnosticSessionId, decision.diagnostic_state);
  }

  const concepts = getActiveCatalogConcepts(runtime);
  const conceptIds = new Set(concepts.map((concept) => concept.id));
  const policyByConcept = getCatalogProgressPolicyInputMap(runtime);
  const masteryByConcept = loadMasteryRows(runtime);
  const blocker = selectPrerequisiteBlocker(concepts, policyByConcept, masteryByConcept);
  const currentConceptId = blocker
    ?? knownConcept(decision.learning_start?.concept_id, conceptIds)
    ?? firstKnown(decision.recommendation_focus.flatMap((focus) => [focus.target_id, focus.concept_id]), conceptIds)
    ?? firstKnown(decision.current_unit.concept_ids, conceptIds)
    ?? concepts[0]?.id
    ?? null;
  if (!currentConceptId) {
    return pausedFrontier(decision, catalog, diagnosticSessionId, "catalog_empty");
  }

  const currentPolicy = policyByConcept.get(currentConceptId);
  const remediation = uniqueKnown([
    currentConceptId,
    ...(currentPolicy?.remediation_concept_ids ?? []),
  ], conceptIds);
  const rawBlocked = uniqueKnown([
    ...(currentPolicy?.downstream_concept_ids ?? []),
    ...concepts
      .filter((concept) => (policyByConcept.get(concept.id)?.prerequisite_ids ?? []).includes(currentConceptId))
      .map((concept) => concept.id),
  ].filter((conceptId) => conceptId !== currentConceptId), conceptIds);
  const currentProgress = conceptProgressFromProjection(masteryByConcept.get(currentConceptId));
  const currentProgressionReady = currentProgress >= PROGRESS_POLICY.readinessThreshold
    || hasRecordedPassedPracticeReview(runtime, input.sessionId, currentConceptId);
  const blocked = currentProgressionReady ? [] : rawBlocked;
  const nextConcept = currentProgressionReady
    ? nextCatalogConcept(concepts, currentConceptId, blocked)
    : null;
  const selectionReason = blocker && !currentProgressionReady
    ? "prerequisite_blocker"
    : decision.provenance.learning_start?.source === "active_diagnostic"
      ? "diagnostic_learning_start"
      : decision.current_unit.reason || "catalog_order";

  return {
    schema_version: "learning_frontier.v1",
    status: "active",
    current_concept_id: currentConceptId,
    allowed_action_kinds: [
      "explain_concept",
      "ask_guided_question",
      "evaluate_guided_answer",
      "remediate_concept",
      "request_structured_practice",
      "review_practice_result",
      "propose_next_concept",
    ],
    allowed_remediation_concept_ids: remediation,
    allowed_practice_concept_ids: remediation,
    allowed_next_concept_ids: nextConcept ? [nextConcept] : [],
    blocked_concept_ids: blocked,
    selection_reason: selectionReason,
    catalog_identity: {
      run_id: catalog?.id ?? null,
      version: catalog?.kb_version ?? null,
    },
    diagnostic_session_id: diagnosticSessionId,
    reasons: decision.reasons,
  };
}

function pausedFrontier(
  decision: LearningProgressDecision,
  catalog: { id: string; kb_version: string } | undefined,
  diagnosticSessionId: string | null,
  reason: string,
): LearningFrontier {
  return {
    schema_version: "learning_frontier.v1",
    status: "paused",
    current_concept_id: decision.learning_start?.concept_id ?? null,
    allowed_action_kinds: ["explain_status"],
    allowed_remediation_concept_ids: [],
    allowed_practice_concept_ids: [],
    allowed_next_concept_ids: [],
    blocked_concept_ids: decision.current_unit.concept_ids,
    selection_reason: reason,
    catalog_identity: {
      run_id: catalog?.id ?? null,
      version: catalog?.kb_version ?? null,
    },
    diagnostic_session_id: diagnosticSessionId,
    reasons: decision.reasons,
  };
}

function loadMasteryRows(runtime: AppRuntime): Map<string, MasteryRow> {
  return new Map(runtime.db.query<MasteryRow>(
    "SELECT concept_id, mastery_level, confidence, readiness, evidence_count, review_priority FROM concept_mastery",
  ).all().map((row) => [row.concept_id, row]));
}

function selectPrerequisiteBlocker(
  concepts: ReturnType<typeof getActiveCatalogConcepts>,
  policyByConcept: ReturnType<typeof getCatalogProgressPolicyInputMap>,
  masteryByConcept: Map<string, MasteryRow>,
): string | null {
  const candidates = concepts
    .map((concept) => {
      const policy = policyByConcept.get(concept.id);
      const mastery = masteryByConcept.get(concept.id);
      if (!policy?.prerequisite_blocker || !mastery || mastery.evidence_count <= 0) return null;
      const progress = conceptProgressFromProjection(mastery);
      if (progress >= PROGRESS_POLICY.readinessThreshold) return null;
      return {
        concept_id: concept.id,
        progress,
        review_priority: mastery.review_priority,
        prerequisite_weight: policy.prerequisite_weight,
        order_index: concept.order_index,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => right.prerequisite_weight - left.prerequisite_weight || left.progress - right.progress || right.review_priority - left.review_priority || left.order_index - right.order_index);
  return candidates[0]?.concept_id ?? null;
}

function nextCatalogConcept(
  concepts: ReturnType<typeof getActiveCatalogConcepts>,
  currentConceptId: string,
  blocked: string[],
): string | null {
  const current = concepts.find((concept) => concept.id === currentConceptId);
  if (!current) return null;
  const blockedSet = new Set(blocked);
  return concepts.find((concept) => concept.order_index > current.order_index && !blockedSet.has(concept.id))?.id ?? null;
}

function hasRecordedPassedPracticeReview(runtime: AppRuntime, sessionId: string, conceptId: string): boolean {
  const rows = runtime.db.query<{ concept_ids_json: string }>(
    `SELECT r.id
       , c.concept_ids_json
     FROM agent_practice_reviews r
     JOIN practice_contracts c ON c.id = r.practice_contract_id
     WHERE r.session_id = ?
       AND r.review_status = 'passed'
       AND r.confidence = 'high'
       AND r.progress_effect = 'recorded'
       AND c.status = 'completed'
     ORDER BY r.created_at DESC
     LIMIT 20`,
  ).all([sessionId]);
  return rows.some((row) => parseConceptIds(row.concept_ids_json).includes(conceptId));
}

function parseConceptIds(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function latestDiagnosticSessionId(runtime: AppRuntime, sessionId: string): string | null {
  return runtime.db.query<{ id: string }>(
    "SELECT id FROM diagnostic_sessions WHERE session_id = ? ORDER BY started_at DESC LIMIT 1",
  ).get([sessionId])?.id ?? null;
}

function firstKnown(values: Array<string | null | undefined>, known: Set<string>): string | null {
  for (const value of values) {
    const conceptId = knownConcept(value, known);
    if (conceptId) return conceptId;
  }
  return null;
}

function knownConcept(value: string | null | undefined, known: Set<string>): string | null {
  return value && known.has(value) ? value : null;
}

function uniqueKnown(values: string[], known: Set<string>): string[] {
  return [...new Set(values.filter((value) => known.has(value)))].slice(0, 5);
}
