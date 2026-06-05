export const DIAGNOSTIC_MIN_EVIDENCE_PER_CONCEPT = 2;
export const DIAGNOSTIC_MIN_QUESTIONS = 3;
export const DIAGNOSTIC_SOFT_CAP = 16;
export const PLACEMENT_MIN_EFFECTIVE_ANSWERS = 3;
export const PLACEMENT_CONFIDENCE_THRESHOLD = 0.85;
export const PLACEMENT_MARGIN_THRESHOLD = 0.2;
export const GLOBAL_CONFIDENCE_THRESHOLD = PLACEMENT_CONFIDENCE_THRESHOLD;
export const UNCERTAINTY_BLOCKER_THRESHOLD = 0.45;
const PLACEMENT_CONFIDENCE_DISPLAY_CAP = 0.99;

export type DiagnosticBand = "unknown" | "weak" | "learning" | "proficient" | "unknown_needs_more_evidence";
export type DiagnosticOutcome = "correct" | "partial" | "incorrect" | "ambiguous";
export type DifficultyDirection = "lower" | "same" | "higher";

export type DiagnosticConceptSnapshot = {
  concept_id: string;
  mastery: number;
  confidence: number;
  evidence_count: number;
  uncertainty: number;
  band: DiagnosticBand;
  conflicting_evidence_count: number;
  review_priority: number;
  last_item_id?: string | null;
  catalog_order?: number | null;
  catalog_priority_weight?: number | null;
  prerequisite_blocker?: boolean | null;
};

export type DiagnosticAttemptSnapshot = {
  item_id: string;
  concept_ids: string[];
  outcome: DiagnosticOutcome;
  difficulty: number;
  created_at: string;
};

export type DiagnosticPriorityResult = {
  concept_id: string;
  score: number;
  difficulty_direction: DifficultyDirection;
  priority_inputs: {
    band: DiagnosticBand;
    unknown_bonus: number;
    uncertainty: number;
    evidence_count: number;
    evidence_gap_bonus: number;
    prerequisite_weight: number;
    review_priority: number;
    conflicting_evidence_count: number;
    conflict_bonus: number;
    recent_repetition_count: number;
    repetition_penalty: number;
  };
  rationale: string[];
};

export type DiagnosticReadiness = {
  stop: boolean;
  reason: string;
  completion_confidence: number;
  unresolved_concept_ids: string[];
  weak_concept_ranking: string[];
  estimated_remaining_min: number;
  estimated_remaining_max: number;
  placement: SequentialPlacementState;
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

export type DiagnosticPlacementCandidate = {
  start_id: string;
  label: string;
  concept_ids: string[];
  lower_boundary_concept_id: string | null;
  upper_boundary_concept_id: string | null;
  order: number;
};

export type SequentialPlacementState = {
  candidates: DiagnosticPlacementCandidate[];
  top_start_id: string | null;
  top_start_label: string | null;
  top_confidence: number;
  runner_up_start_id: string | null;
  confidence_margin: number;
  verified_boundary_ids: string[];
  unresolved_boundary_ids: string[];
  conflict_count: number;
  effective_answer_count: number;
  focus_concept_ids: string[];
  focus_boundary_ids: string[];
};

export function diagnosticHardCap(conceptCount = 0): number {
  return Math.max(24, Math.max(1, conceptCount) * DIAGNOSTIC_MIN_EVIDENCE_PER_CONCEPT);
}

export function scoreDiagnosticConceptPriority(
  state: DiagnosticConceptSnapshot,
  recentConceptIds: string[] = [],
  recentAttempts: DiagnosticAttemptSnapshot[] = [],
): DiagnosticPriorityResult {
  const isUnknown = state.band === "unknown" || state.evidence_count === 0;
  const isCritical = isCatalogCriticalPrerequisite(state);
  const recentRepetitionCount = recentConceptIds.filter((conceptId) => conceptId === state.concept_id).length;
  const unknownBonus = isUnknown ? 4.5 : 0;
  const evidenceGapBonus = Math.max(0, DIAGNOSTIC_MIN_EVIDENCE_PER_CONCEPT - state.evidence_count) * 1.1;
  const prerequisiteWeight = Math.max(1, state.catalog_priority_weight ?? 1);
  const activeConflict = hasActivePlacementConflict(state);
  const conflictBonus = activeConflict ? Math.min(12, state.conflicting_evidence_count * 4) : 0;
  const severePrerequisiteBlocker = isCritical && (isUnknown || state.uncertainty >= 0.75);
  const repetitionPenalty = severePrerequisiteBlocker
    ? Math.min(1.25, recentRepetitionCount * 0.5)
    : recentRepetitionCount * 2.5;
  const reviewBonus = Math.max(0, state.review_priority) * 0.4;
  const score = Math.max(0, round2(
    unknownBonus
    + (state.uncertainty * 3)
    + evidenceGapBonus
    + prerequisiteWeight
    + reviewBonus
    + conflictBonus
    - repetitionPenalty,
  ));
  const difficultyDirection = selectDifficultyDirection(state, recentAttempts);

  return {
    concept_id: state.concept_id,
    score,
    difficulty_direction: difficultyDirection,
    priority_inputs: {
      band: state.band,
      unknown_bonus: unknownBonus,
      uncertainty: round2(state.uncertainty),
      evidence_count: state.evidence_count,
      evidence_gap_bonus: round2(evidenceGapBonus),
      prerequisite_weight: prerequisiteWeight,
      review_priority: state.review_priority,
      conflicting_evidence_count: state.conflicting_evidence_count,
      conflict_bonus: conflictBonus,
      recent_repetition_count: recentRepetitionCount,
      repetition_penalty: repetitionPenalty,
    },
    rationale: [
      isUnknown ? "needs_initial_evidence" : "has_existing_evidence",
      isCritical ? "critical_prerequisite" : "noncritical_concept",
      activeConflict ? "clarify_conflicting_evidence" : "no_conflict_signal",
      recentRepetitionCount > 0 ? "recent_repetition_penalized" : "not_recently_repeated",
    ],
  };
}

export function selectAdaptiveDiagnosticTarget(
  states: DiagnosticConceptSnapshot[],
  recentAttempts: DiagnosticAttemptSnapshot[] = [],
): DiagnosticPriorityResult | undefined {
  return selectSequentialPlacementTarget(states, recentAttempts);
}

export function selectSequentialPlacementTarget(
  states: DiagnosticConceptSnapshot[],
  recentAttempts: DiagnosticAttemptSnapshot[] = [],
  placement: SequentialPlacementState = computeSequentialPlacementState(states, countEffectiveEvidence(states)),
): DiagnosticPriorityResult | undefined {
  const ordered = orderPlacementStates(states);
  if (ordered.length === 0) return undefined;
  const recentConceptIds = recentAttempts.flatMap((attempt) => attempt.concept_ids).slice(0, 6);
  const conflicted = ordered
    .filter((state) => hasActivePlacementConflict(state) && canAffectPlacement(state, placement))
    .map((state) => placementPriorityResult(state, recentConceptIds, recentAttempts, 100 + state.conflicting_evidence_count * 8, ["placement_conflict_clarification"]))
    .sort(comparePlacementPriority(ordered))[0];
  if (conflicted) return conflicted;

  if (countEffectiveEvidence(ordered) === 0) {
    return placementPriorityResult(selectInitialPlacementAnchor(ordered, recentConceptIds), recentConceptIds, recentAttempts, 90, ["placement_initial_anchor"]);
  }

  const focused = placement.focus_concept_ids
    .map((conceptId) => ordered.find((state) => state.concept_id === conceptId))
    .filter((state): state is DiagnosticConceptSnapshot => Boolean(state))
    .map((state) => placementPriorityResult(state, recentConceptIds, recentAttempts, 80 + state.uncertainty * 10, ["placement_boundary_probe"]))
    .sort(comparePlacementPriority(ordered))[0];
  if (focused) return focused;

  const unresolved = ordered
    .filter((state) => state.evidence_count === 0 || state.uncertainty >= UNCERTAINTY_BLOCKER_THRESHOLD)
    .map((state) => placementPriorityResult(state, recentConceptIds, recentAttempts, 60 + state.uncertainty * 10, ["placement_uncertainty_probe"]))
    .sort(comparePlacementPriority(ordered))[0];
  if (unresolved) return unresolved;

  return ordered
    .map((state) => scoreDiagnosticConceptPriority(state, recentConceptIds, recentAttempts))
    .sort(comparePlacementPriority(ordered))
    [0];
}

export function selectDifficultyDirection(
  state: DiagnosticConceptSnapshot,
  recentConceptIdsOrAttempts: string[] | DiagnosticAttemptSnapshot[] = [],
): DifficultyDirection {
  const attempts = Array.isArray(recentConceptIdsOrAttempts) && typeof recentConceptIdsOrAttempts[0] === "object"
    ? recentConceptIdsOrAttempts as DiagnosticAttemptSnapshot[]
    : [];
  const recentForConcept = attempts.find((attempt) => attempt.concept_ids.includes(state.concept_id));
  if (hasActivePlacementConflict(state)) return "same";
  if (!recentForConcept) return "same";
  if (recentForConcept.outcome === "incorrect") {
    return isCatalogCriticalPrerequisite(state) || state.confidence < 0.55 ? "lower" : "same";
  }
  if (recentForConcept.outcome === "correct" && state.confidence < GLOBAL_CONFIDENCE_THRESHOLD) {
    return "higher";
  }
  return "same";
}

export function computeDiagnosticReadiness(
  states: DiagnosticConceptSnapshot[],
  answered: number,
): DiagnosticReadiness {
  return computeSequentialPlacementReadiness(states, answered);
}

export function computeSequentialPlacementReadiness(
  states: DiagnosticConceptSnapshot[],
  answered: number,
): DiagnosticReadiness {
  const weakConceptRanking = rankWeakConcepts(states);
  const unresolved = states
    .filter((state) => state.evidence_count < DIAGNOSTIC_MIN_EVIDENCE_PER_CONCEPT || state.uncertainty >= 0.55 || state.band === "unknown")
    .map((state) => state.concept_id);
  const placement = computeSequentialPlacementState(states, answered);
  const hasVerifiedBoundary = placement.verified_boundary_ids.length > 0;
  const minimumSatisfied = placement.effective_answer_count >= PLACEMENT_MIN_EFFECTIVE_ANSWERS;
  const confidenceSatisfied = placement.top_confidence >= PLACEMENT_CONFIDENCE_THRESHOLD;
  const marginSatisfied = placement.confidence_margin >= PLACEMENT_MARGIN_THRESHOLD
    || placement.top_confidence >= PLACEMENT_CONFIDENCE_DISPLAY_CAP;
  const conflictFree = placement.conflict_count === 0;

  if (minimumSatisfied && confidenceSatisfied && marginSatisfied && hasVerifiedBoundary && conflictFree) {
    return buildReadiness(true, "sequential_placement_ready", placement.top_confidence, unresolved, weakConceptRanking, answered, 0, placement);
  }
  if (!minimumSatisfied) {
    return buildReadiness(false, "minimum_effective_answers_pending", placement.top_confidence, unresolved, weakConceptRanking, answered, PLACEMENT_MIN_EFFECTIVE_ANSWERS - placement.effective_answer_count, placement);
  }
  if (!conflictFree) {
    return buildReadiness(false, "placement_conflict_pending", placement.top_confidence, unresolved, weakConceptRanking, answered, 1, placement);
  }
  if (!hasVerifiedBoundary) {
    return buildReadiness(false, "placement_boundary_unverified", placement.top_confidence, unresolved, weakConceptRanking, answered, 1, placement);
  }
  if (!confidenceSatisfied) {
    return buildReadiness(false, "placement_confidence_pending", placement.top_confidence, unresolved, weakConceptRanking, answered, 1, placement);
  }
  return buildReadiness(false, "placement_margin_pending", placement.top_confidence, unresolved, weakConceptRanking, answered, 1, placement);
}

export function buildAdaptiveDiagnosticProgress(
  states: DiagnosticConceptSnapshot[],
  answered: number,
  focusConceptIds: string[] = [],
): AdaptiveDiagnosticProgress {
  const readiness = computeDiagnosticReadiness(states, answered);
  const selectedTarget = focusConceptIds.length > 0 ? undefined : selectAdaptiveDiagnosticTarget(states);
  const target = focusConceptIds.length > 0 ? focusConceptIds : selectedTarget ? [selectedTarget.concept_id] : [];
  return {
    answered,
    total: diagnosticHardCap(states.length),
    effective_answered: readiness.placement.effective_answer_count,
    min_questions: PLACEMENT_MIN_EFFECTIVE_ANSWERS,
    min_effective_answers: PLACEMENT_MIN_EFFECTIVE_ANSWERS,
    soft_cap: DIAGNOSTIC_SOFT_CAP,
    hard_cap: diagnosticHardCap(states.length),
    estimated_remaining_min: readiness.estimated_remaining_min,
    estimated_remaining_max: readiness.estimated_remaining_max,
    current_focus_concept_ids: target,
    completion_confidence: readiness.completion_confidence,
    placement_confidence: readiness.placement.top_confidence,
    leading_start_concept_id: readiness.placement.top_start_id,
    leading_start_label: readiness.placement.top_start_label,
    runner_up_start_concept_id: readiness.placement.runner_up_start_id,
    confidence_margin: readiness.placement.confidence_margin,
    current_focus_boundary_ids: readiness.placement.focus_boundary_ids,
    diagnostic_status: "active",
  };
}

export function computeConceptUncertainty(confidence: number, evidenceCount: number, conflicts: number): number {
  const evidenceGap = Math.max(0, DIAGNOSTIC_MIN_EVIDENCE_PER_CONCEPT - evidenceCount) / DIAGNOSTIC_MIN_EVIDENCE_PER_CONCEPT;
  const conflictPenalty = Math.min(0.35, conflicts * 0.15);
  return round2(Math.max(0, Math.min(1, (1 - confidence) * 0.55 + evidenceGap * 0.35 + conflictPenalty)));
}

export function isCriticalPrerequisite(conceptId: string): boolean {
  void conceptId;
  return false;
}

function buildReadiness(
  stop: boolean,
  reason: string,
  completionConfidence: number,
  unresolvedConceptIds: string[],
  weakConceptRanking: string[],
  answered: number,
  minAdditionalEvidence: number,
  placement: SequentialPlacementState,
): DiagnosticReadiness {
  const estimatedRemainingMin = stop ? 0 : Math.max(minAdditionalEvidence, PLACEMENT_MIN_EFFECTIVE_ANSWERS - placement.effective_answer_count, 1);
  const estimatedRemainingMax = stop ? 0 : Math.max(estimatedRemainingMin, Math.min(6, Math.max(estimatedRemainingMin + 1, DIAGNOSTIC_SOFT_CAP - answered)));
  return {
    stop,
    reason,
    completion_confidence: round2(completionConfidence),
    unresolved_concept_ids: [...new Set(unresolvedConceptIds)].slice(0, 8),
    weak_concept_ranking: weakConceptRanking,
    estimated_remaining_min: estimatedRemainingMin,
    estimated_remaining_max: estimatedRemainingMax,
    placement,
  };
}

function placementPriorityResult(
  state: DiagnosticConceptSnapshot,
  recentConceptIds: string[],
  recentAttempts: DiagnosticAttemptSnapshot[],
  placementScore: number,
  placementRationale: string[],
): DiagnosticPriorityResult {
  const base = scoreDiagnosticConceptPriority(state, recentConceptIds, recentAttempts);
  const recentRepetitionCount = recentConceptIds.filter((conceptId) => conceptId === state.concept_id).length;
  const repetitionPenalty = recentRepetitionCount * 8;
  return {
    ...base,
    score: round2(Math.max(0, placementScore + base.score * 0.05 - repetitionPenalty)),
    rationale: [...placementRationale, ...base.rationale],
  };
}

function comparePlacementPriority(states: DiagnosticConceptSnapshot[]): (left: DiagnosticPriorityResult, right: DiagnosticPriorityResult) => number {
  return (left, right) => {
    const leftOrder = states.find((state) => state.concept_id === left.concept_id)?.catalog_order ?? 9999;
    const rightOrder = states.find((state) => state.concept_id === right.concept_id)?.catalog_order ?? 9999;
    return right.score - left.score || leftOrder - rightOrder || left.concept_id.localeCompare(right.concept_id);
  };
}

function canAffectPlacement(state: DiagnosticConceptSnapshot, placement: SequentialPlacementState): boolean {
  if (placement.focus_concept_ids.includes(state.concept_id)) return true;
  if (placement.top_start_id === state.concept_id || placement.runner_up_start_id === state.concept_id) return true;
  return hasActivePlacementConflict(state);
}

function selectInitialPlacementAnchor(states: DiagnosticConceptSnapshot[], recentConceptIds: string[]): DiagnosticConceptSnapshot {
  const anchorIndex = Math.floor((states.length - 1) / 2);
  const candidates = [
    states[anchorIndex],
    states[anchorIndex + 1],
    states[anchorIndex - 1],
    ...states,
  ].filter((state): state is DiagnosticConceptSnapshot => Boolean(state));
  return candidates.find((state) => !recentConceptIds.includes(state.concept_id)) ?? states[anchorIndex] ?? states[0]!;
}

function countEffectiveEvidence(states: DiagnosticConceptSnapshot[]): number {
  return states.reduce((sum, state) => sum + Math.max(0, state.evidence_count), 0);
}

function orderPlacementStates(states: DiagnosticConceptSnapshot[]): DiagnosticConceptSnapshot[] {
  return [...states].sort((left, right) => {
    const leftOrder = left.catalog_order ?? 9999;
    const rightOrder = right.catalog_order ?? 9999;
    return leftOrder - rightOrder || left.concept_id.localeCompare(right.concept_id);
  });
}

function hasDirectPlacementEvidence(state: DiagnosticConceptSnapshot): boolean {
  return state.evidence_count > 0 && state.confidence >= 0.5 && state.band !== "unknown";
}

function isReadyBeforePlacement(state: DiagnosticConceptSnapshot): boolean {
  return state.evidence_count > 0 && state.mastery >= 70 && state.confidence >= 0.75 && !hasActivePlacementConflict(state);
}

function isPlacementBoundaryVerified(top: DiagnosticConceptSnapshot, lower: DiagnosticConceptSnapshot | undefined, allKnownReady: boolean): boolean {
  if (allKnownReady) return top.evidence_count > 0 && top.confidence >= 0.75 && !hasActivePlacementConflict(top);
  if (!hasDirectPlacementEvidence(top)) return false;
  if (!lower) return top.confidence >= 0.75 || top.mastery < 70;
  return isReadyBeforePlacement(lower);
}

function computePlacementConfidence(
  top: DiagnosticConceptSnapshot,
  lower: DiagnosticConceptSnapshot | undefined,
  answered: number,
  boundaryVerified: boolean,
  conflictCount: number,
): number {
  const evidenceFactor = Math.min(1, answered / PLACEMENT_MIN_EFFECTIVE_ANSWERS);
  const lowerConfidence = lower ? lower.confidence : top.confidence;
  const confidence = top.confidence * 0.55
    + lowerConfidence * 0.25
    + evidenceFactor * 0.2
    + Math.min(0.08, placementSeparation(top, lower) * 0.2)
    - Math.min(0.3, conflictCount * 0.08);
  return round2(Math.max(0, Math.min(boundaryVerified ? PLACEMENT_CONFIDENCE_DISPLAY_CAP : 0.78, confidence)));
}

function computePlacementMargin(
  top: DiagnosticConceptSnapshot,
  lower: DiagnosticConceptSnapshot | undefined,
  runnerUp: DiagnosticConceptSnapshot | undefined,
  boundaryVerified: boolean,
): number {
  if (!boundaryVerified) return round2(Math.min(0.18, placementSeparation(top, runnerUp)));
  return round2(Math.max(0, Math.min(0.99, placementSeparation(top, lower ?? runnerUp))));
}

function placementSeparation(left: DiagnosticConceptSnapshot, right: DiagnosticConceptSnapshot | undefined): number {
  const leftScore = placementReadinessScore(left);
  const rightScore = right ? placementReadinessScore(right) : left.mastery < 70 ? 100 : 45;
  return Math.abs(leftScore - rightScore) / 100;
}

function placementReadinessScore(state: DiagnosticConceptSnapshot): number {
  if (state.evidence_count === 0) return 0;
  return Math.max(0, Math.min(100, state.mastery * 0.65 + state.confidence * 35));
}

function selectPlacementFocusConcepts(
  top: DiagnosticConceptSnapshot,
  lower: DiagnosticConceptSnapshot | undefined,
  boundaryVerified: boolean,
): string[] {
  if (!boundaryVerified) {
    if (!hasDirectPlacementEvidence(top)) return [top.concept_id];
    if (lower && !isReadyBeforePlacement(lower)) return [lower.concept_id, top.concept_id];
  }
  return [top.concept_id];
}

export function computeSequentialPlacementState(
  states: DiagnosticConceptSnapshot[],
  answered: number,
): SequentialPlacementState {
  const ordered = orderPlacementStates(states);
  const candidates = ordered.map((state, index) => ({
    start_id: state.concept_id,
    label: state.concept_id,
    concept_ids: [state.concept_id],
    lower_boundary_concept_id: index > 0 ? ordered[index - 1]!.concept_id : null,
    upper_boundary_concept_id: index < ordered.length - 1 ? ordered[index + 1]!.concept_id : null,
    order: index,
  }));
  if (ordered.length === 0) {
    return {
      candidates,
      top_start_id: null,
      top_start_label: null,
      top_confidence: 0,
      runner_up_start_id: null,
      confidence_margin: 0,
      verified_boundary_ids: [],
      unresolved_boundary_ids: [],
      conflict_count: 0,
      effective_answer_count: answered,
      focus_concept_ids: [],
      focus_boundary_ids: [],
    };
  }

  const firstNotReady = ordered.find((state) => hasDirectPlacementEvidence(state) && !isReadyBeforePlacement(state));
  const firstUnknownAfterEvidence = ordered.find((state) => state.evidence_count === 0);
  const allKnownReady = firstNotReady === undefined && firstUnknownAfterEvidence === undefined;
  const top = firstNotReady ?? firstUnknownAfterEvidence ?? ordered[ordered.length - 1]!;
  const topIndex = ordered.findIndex((state) => state.concept_id === top.concept_id);
  const lower = topIndex > 0 ? ordered[topIndex - 1] : undefined;
  const runnerUp = lower ?? ordered[topIndex + 1];
  const conflictCount = ordered.reduce((sum, state) => sum + (hasActivePlacementConflict(state) ? state.conflicting_evidence_count : 0), 0);
  const boundaryVerified = isPlacementBoundaryVerified(top, lower, allKnownReady);
  const boundaryId = lower ? `${lower.concept_id}->${top.concept_id}` : `start->${top.concept_id}`;
  const topConfidence = computePlacementConfidence(top, lower, answered, boundaryVerified, conflictCount);
  const confidenceMargin = allKnownReady ? 0.99 : computePlacementMargin(top, lower, runnerUp, boundaryVerified);
  const unresolvedBoundaryIds = boundaryVerified ? [] : [boundaryId];
  const focusConceptIds = selectPlacementFocusConcepts(top, lower, boundaryVerified);
  return {
    candidates,
    top_start_id: top.concept_id,
    top_start_label: top.concept_id,
    top_confidence: topConfidence,
    runner_up_start_id: runnerUp?.concept_id ?? null,
    confidence_margin: confidenceMargin,
    verified_boundary_ids: boundaryVerified ? [boundaryId] : [],
    unresolved_boundary_ids: unresolvedBoundaryIds,
    conflict_count: conflictCount,
    effective_answer_count: answered,
    focus_concept_ids: focusConceptIds,
    focus_boundary_ids: [boundaryId],
  };
}

function computeCompletionConfidence(states: DiagnosticConceptSnapshot[]): number {
  if (states.length === 0) return 0;
  const criticalStates = states.filter(isCatalogCriticalPrerequisite);
  const placementStates = criticalStates.length > 0 ? criticalStates : states;
  const averageConfidence = average(placementStates.map((state) => state.confidence));
  const coveredRatio = placementStates.filter((state) => state.evidence_count > 0 && state.band !== "unknown").length / placementStates.length;
  const weakStates = states.filter((state) => state.band === "weak").slice(0, 3);
  const weakStability = weakStates.length === 0
    ? 1
    : weakStates.filter((state) => state.evidence_count >= DIAGNOSTIC_MIN_EVIDENCE_PER_CONCEPT || state.confidence >= 0.7).length / weakStates.length;
  const conflictPenalty = Math.min(0.25, states.reduce((sum, state) => sum + (hasActivePlacementConflict(state) ? state.conflicting_evidence_count : 0), 0) * 0.03);
  return Math.max(0, Math.min(1, (averageConfidence * 0.7) + (coveredRatio * 0.2) + (weakStability * 0.1) - conflictPenalty));
}

function rankWeakConcepts(states: DiagnosticConceptSnapshot[]): string[] {
  return [...states]
    .filter((state) => state.band === "weak" || state.band === "unknown_needs_more_evidence" || state.mastery < 45)
    .sort((left, right) => left.mastery - right.mastery || left.confidence - right.confidence || right.uncertainty - left.uncertainty)
    .map((state) => state.concept_id)
    .slice(0, 5);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function isCatalogCriticalPrerequisite(state: DiagnosticConceptSnapshot): boolean {
  return state.prerequisite_blocker === true || (state.catalog_priority_weight ?? 0) >= 2;
}

function hasActivePlacementConflict(state: DiagnosticConceptSnapshot): boolean {
  return state.conflicting_evidence_count > 0
    && state.uncertainty >= UNCERTAINTY_BLOCKER_THRESHOLD
    && state.confidence < GLOBAL_CONFIDENCE_THRESHOLD;
}
