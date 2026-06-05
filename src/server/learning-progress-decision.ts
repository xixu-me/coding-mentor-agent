import type {
  AppRuntime,
  DiagnosticFeedback,
  LearningProgressChapter,
  LearningProgressDecision,
  LearningProgressDiagnosticState,
  LearningProgressHandoffState,
  LearningProgressPracticeState,
  LearningProgressStart,
  LearningProgressUnit,
  ProgressProvenance,
  RecommendationFocusSummary,
} from "../types.js";
import {
  assertCatalogAvailable,
  getActiveCatalogConcepts,
  getCatalogConceptById,
  getCatalogProgressPolicyInputMap,
  getCatalogUnits,
  getLatestCatalogRun,
} from "./course-catalog.js";
import { getDiagnosticProgressSummary } from "./diagnostics.js";
import { conceptProgressFromProjection, PROGRESS_POLICY } from "./progress-policy.js";
import { rankProgressRecommendations } from "./recommendations.js";
import { loadLatestProgressEvidenceSummary } from "./progress-evidence.js";

type DiagnosticSessionRow = {
  id: string;
  session_id: string;
  status: "active" | "completed" | "paused" | "failed";
  stop_reason: string | null;
  catalog_version: string | null;
  catalog_run_id: string | null;
};

type MasteryRow = {
  concept_id: string;
  name: string;
  mastery_level: number;
  confidence: number;
  readiness: number;
  evidence_count: number;
  review_priority: number;
};

type UnitSelection = {
  unit: LearningProgressUnit;
  provenance: ProgressProvenance;
};

export function deriveLearningProgressDecision(
  runtime: AppRuntime,
  options: { sessionId?: string | null } = {},
): LearningProgressDecision {
  assertCatalogAvailable(runtime);
  const sessionId = options.sessionId ?? null;
  const latestCatalog = getLatestCatalogRun(runtime);
  const diagnosticSession = loadLatestDiagnosticSession(runtime, sessionId);
  const rawDiagnosticStatus = diagnosticSession?.status;
  const rawDiagnosticStopReason = diagnosticSession?.stop_reason ?? null;
  const diagnosticProgress = getDiagnosticProgressSummary(runtime, { sessionId });
  const diagnosticFresh = isDiagnosticFresh(diagnosticSession, latestCatalog);
  const diagnosticState = deriveDiagnosticState(diagnosticSession, diagnosticFresh);
  const tutorAgentCatalogState = deriveTutorAgentCatalogState(runtime, sessionId, latestCatalog);
  const handoffState = deriveHandoffState(runtime, sessionId, diagnosticState, tutorAgentCatalogState);
  const practiceState = derivePracticeState(diagnosticState, handoffState, tutorAgentCatalogState === "stale");
  const profile = readLocalProfile(runtime);
  const concepts = getActiveCatalogConcepts(runtime);
  const units = getCatalogUnits(runtime);
  const masteryRows = loadMasteryRows(runtime);
  const masteryByConcept = new Map(masteryRows.map((row) => [row.concept_id, row]));
  const conceptById = new Map(concepts.map((concept) => [concept.id, concept]));
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const policyByConcept = getCatalogProgressPolicyInputMap(runtime);
  const diagnosticProvenance = diagnosticSession && sessionId
    ? {
      source: "active_diagnostic" as const,
      session_id: sessionId,
      diagnostic_session_id: diagnosticSession.id,
      catalog_run_id: diagnosticSession.catalog_run_id ?? undefined,
    }
    : null;
  const completedFresh = diagnosticState === "completed" && diagnosticProvenance !== null;
  const recommendationFocus = completedFresh
    ? rankProgressRecommendations(runtime, { sessionId, limit: 5 })
      .filter((item) => isActionableRecommendation(item.target_id, masteryByConcept))
      .map((item) => ({
      concept_id: item.concept_id,
      target_id: item.target_id,
      type: item.type,
      reason: item.reason,
    }))
    : [];
  const diagnosticFocus = completedFresh
    ? []
    : (diagnosticProgress.current_focus_concept_ids ?? []).map((conceptId) => ({
      concept_id: conceptId,
      target_id: conceptId,
      type: "diagnostic",
      reason: "diagnostic_focus",
    }));
  const learningStart = completedFresh
    ? deriveLearningStart(runtime, profile, diagnosticProgress)
    : null;
  const currentLevel = learningStart ? `从${learningStart.label}起步` : null;
  const currentGoal = completedFresh
    ? deriveCurrentGoal(runtime, learningStart, recommendationFocus)
    : null;
  const rawCurriculum = buildCurriculumProgress(runtime, masteryRows);
  const currentUnitSelection = selectCurrentUnit({
    diagnosticState,
    concepts,
    unitById,
    policyByConcept,
    masteryByConcept,
    learningStart,
    recommendationFocus,
    rawCurriculum,
    diagnosticProvenance,
    latestCatalogId: latestCatalog?.id,
  });
  const curriculum = applyCurrentUnitStatus(rawCurriculum, currentUnitSelection.unit, completedFresh);
  const visibleMastery = visibleMasteryRows(masteryRows);
  const recentProgressEvidence = sessionId ? loadLatestProgressEvidenceSummary(runtime, sessionId) : null;
  const recommendationProvenance = recommendationFocus.length
    ? {
      source: "recommendation_ranker" as const,
      concept_ids: recommendationFocus.map((item) => item.target_id),
      reason: "graph_ranked_focus",
    }
    : null;
  return {
    schema_version: "learning_progress_decision.v1",
    diagnostic_state: diagnosticState,
    handoff_state: handoffState,
    practice_state: practiceState,
    reasons: decisionReasons({
      diagnosticState,
      rawDiagnosticStatus,
      rawDiagnosticStopReason,
      diagnosticSession,
      latestCatalogId: latestCatalog?.id,
      tutorAgentCatalogState,
    }),
    current_level: currentLevel,
    current_goal: currentGoal,
    learning_start: learningStart,
    current_unit: currentUnitSelection.unit,
    course_progress_percent: computeCourseProgressPercent(curriculum, completedFresh),
    recent_progress_evidence: recentProgressEvidence,
    diagnostic: {
      diagnostic_id: "diag_first_use",
      ...diagnosticProgress,
      completed: diagnosticProgress.completed,
    },
    diagnostic_focus: diagnosticFocus,
    recommendation_focus: recommendationFocus,
    diagnostic_feedback: completedFresh ? buildDiagnosticFeedback(runtime, { sessionId, diagnostic: diagnosticProgress, learningStart }) : null,
    curriculum,
    mastery: visibleMastery,
    weak_concepts: visibleMastery.slice(0, 3).map((item) => ({ concept_id: item.concept_id, name: item.name, reason: `掌握度 ${item.mastery_level}，建议复习。` })),
    provenance: {
      current_level: learningStart && diagnosticProvenance ? { ...diagnosticProvenance, concept_id: learningStart.concept_id ?? undefined } : null,
      current_goal: currentGoal && recommendationProvenance ? recommendationProvenance : currentGoal && diagnosticProvenance ? diagnosticProvenance : null,
      learning_start: learningStart && diagnosticProvenance ? { ...diagnosticProvenance, concept_id: learningStart.concept_id ?? undefined } : null,
      current_unit: currentUnitSelection.provenance,
      recommendation_focus: recommendationProvenance,
    },
  };
}

function loadLatestDiagnosticSession(runtime: AppRuntime, sessionId?: string | null): DiagnosticSessionRow | undefined {
  return sessionId
    ? runtime.db.query<DiagnosticSessionRow>(
      "SELECT id, session_id, status, stop_reason, catalog_version, catalog_run_id FROM diagnostic_sessions WHERE session_id = ? ORDER BY started_at DESC LIMIT 1",
    ).get([sessionId])
    : runtime.db.query<DiagnosticSessionRow>(
      "SELECT id, session_id, status, stop_reason, catalog_version, catalog_run_id FROM diagnostic_sessions ORDER BY started_at DESC LIMIT 1",
    ).get();
}

function isDiagnosticFresh(diagnosticSession: DiagnosticSessionRow | undefined, latestCatalog: { id: string; kb_version: string } | undefined): boolean {
  if (!diagnosticSession || diagnosticSession.status !== "completed" || !latestCatalog) return false;
  return diagnosticSession.catalog_run_id === latestCatalog.id && diagnosticSession.catalog_version === latestCatalog.kb_version;
}

function deriveDiagnosticState(diagnosticSession: DiagnosticSessionRow | undefined, diagnosticFresh: boolean): LearningProgressDiagnosticState {
  if (!diagnosticSession) return "not_started";
  if (diagnosticSession.stop_reason === "diagnostic_generation_unavailable" && diagnosticSession.status !== "completed") return "technical_unavailable";
  if (diagnosticSession.status === "paused") return "inconclusive";
  if (diagnosticSession.status === "completed") return diagnosticFresh ? "completed" : "catalog_stale";
  if (diagnosticSession.status === "failed") return "technical_unavailable";
  return "active";
}

function deriveHandoffState(
  runtime: AppRuntime,
  sessionId: string | null,
  diagnosticState: LearningProgressDiagnosticState,
  tutorAgentCatalogState: "fresh" | "stale" | "missing",
): LearningProgressHandoffState {
  if (diagnosticState !== "completed") return "not_ready";
  if (tutorAgentCatalogState === "fresh") return "guidance_started";
  if (tutorAgentCatalogState === "stale") return "feedback_ready";
  if (sessionId && hasStartedGuidance(runtime, sessionId)) return "guidance_started";
  return "feedback_ready";
}

function derivePracticeState(
  diagnosticState: LearningProgressDiagnosticState,
  handoffState: LearningProgressHandoffState,
  staleTutorAgent: boolean,
): LearningProgressPracticeState {
  if (diagnosticState === "catalog_stale") return "locked_by_stale_catalog";
  if (staleTutorAgent) return "locked_by_stale_catalog";
  if (diagnosticState !== "completed") return "locked_by_diagnostic";
  return handoffState === "guidance_started" ? "available_after_explicit_request" : "guidance_first";
}

function deriveTutorAgentCatalogState(
  runtime: AppRuntime,
  sessionId: string | null,
  latestCatalog: { id: string; kb_version: string } | undefined,
): "fresh" | "stale" | "missing" {
  if (!sessionId) return "missing";
  const row = runtime.db.query<{ catalog_run_id: string | null; catalog_version: string | null; status: string }>(
    "SELECT catalog_run_id, catalog_version, status FROM tutor_agent_states WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1",
  ).get([sessionId]);
  if (!row || (row.status !== "active" && row.status !== "paused")) return "missing";
  return row.catalog_run_id === (latestCatalog?.id ?? null) && row.catalog_version === (latestCatalog?.kb_version ?? null)
    ? "fresh"
    : "stale";
}

function hasStartedGuidance(runtime: AppRuntime, sessionId: string): boolean {
  const row = runtime.db.query<{ id: string }>(
    "SELECT id FROM session_messages WHERE session_id = ? AND role = 'user' AND content_redacted_text LIKE '开始导师指导。%' ORDER BY created_at DESC LIMIT 1",
  ).get([sessionId]);
  return Boolean(row);
}

function readLocalProfile(runtime: AppRuntime): Record<string, unknown> {
  const row = runtime.db.query<{ profile_json: string }>("SELECT profile_json FROM local_profile WHERE id = 'local'").get();
  if (!row) return {};
  try {
    const parsed = JSON.parse(row.profile_json);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function loadMasteryRows(runtime: AppRuntime): MasteryRow[] {
  return runtime.db.query<MasteryRow>(
    `SELECT c.id AS concept_id, c.name, m.mastery_level, m.confidence, m.readiness, m.evidence_count, m.review_priority
     FROM concepts c
     JOIN concept_mastery m ON m.concept_id = c.id
     WHERE c.catalog_status = 'active' AND m.evidence_count > 0`,
  ).all();
}

function visibleMasteryRows(masteryRows: MasteryRow[]): LearningProgressDecision["mastery"] {
  return [...masteryRows]
    .sort((left, right) => right.review_priority - left.review_priority || left.readiness - right.readiness || left.mastery_level - right.mastery_level)
    .slice(0, 8)
    .map(({ concept_id, name, mastery_level, confidence, review_priority }) => ({
      concept_id,
      name,
      mastery_level,
      confidence,
      review_priority,
    }));
}

function deriveLearningStart(
  runtime: AppRuntime,
  profile: Record<string, unknown>,
  diagnostic: { effective_answered?: number; leading_start_concept_id?: string | null; leading_start_label?: string | null },
): LearningProgressStart | null {
  const leadingId = stringValue(diagnostic.leading_start_concept_id);
  const profilePlacementId = stringValue(profile.diagnostic_placement_concept_id);
  const conceptId = (profilePlacementId && getCatalogConceptById(runtime, profilePlacementId) ? profilePlacementId : undefined)
    ?? ((diagnostic.effective_answered ?? 0) > 0 && leadingId && getCatalogConceptById(runtime, leadingId) ? leadingId : undefined)
    ?? null;
  const label = conceptId
    ? getCatalogConceptById(runtime, conceptId)?.name ?? conceptId
    : stringValue(profile.diagnostic_placement_label) ?? ((diagnostic.effective_answered ?? 0) > 0 ? stringValue(diagnostic.leading_start_label) : undefined);
  return label ? { concept_id: conceptId, label } : null;
}

function deriveCurrentGoal(runtime: AppRuntime, learningStart: LearningProgressStart | null, recommendationFocus: RecommendationFocusSummary[]): string | null {
  const firstFocus = recommendationFocus[0];
  if (firstFocus) {
    const concept = getCatalogConceptById(runtime, firstFocus.target_id) ?? getCatalogConceptById(runtime, firstFocus.concept_id);
    return concept ? `巩固：${concept.name}` : `巩固：${firstFocus.target_id}`;
  }
  return learningStart ? `从${learningStart.label}继续学习` : null;
}

function isActionableRecommendation(targetId: string, masteryByConcept: Map<string, MasteryRow>): boolean {
  const mastery = masteryByConcept.get(targetId);
  if (!mastery || mastery.evidence_count <= 0) return true;
  return conceptProgressFromProjection(mastery) < PROGRESS_POLICY.unitCompletionThreshold || mastery.review_priority > 0;
}

function selectCurrentUnit(input: {
  diagnosticState: LearningProgressDiagnosticState;
  concepts: ReturnType<typeof getActiveCatalogConcepts>;
  unitById: Map<string, { id: string; title: string }>;
  policyByConcept: ReturnType<typeof getCatalogProgressPolicyInputMap>;
  masteryByConcept: Map<string, MasteryRow>;
  learningStart: LearningProgressStart | null;
  recommendationFocus: RecommendationFocusSummary[];
  rawCurriculum: LearningProgressChapter[];
  diagnosticProvenance: Extract<ProgressProvenance, { source: "active_diagnostic" }> | null;
  latestCatalogId?: string;
}): UnitSelection {
  if (input.diagnosticState !== "completed") {
    const stale = input.diagnosticState === "catalog_stale";
    return {
      unit: {
        id: "diagnostic",
        title: stale ? "初始测评需要更新" : "初始测评",
        kind: stale ? "status" : "diagnostic",
        concept_ids: [],
        reason: input.diagnosticState,
      },
      provenance: { source: "diagnostic_gate", reason: input.diagnosticState },
    };
  }

  const blocker = selectPrerequisiteBlocker(input.concepts, input.policyByConcept, input.masteryByConcept);
  if (blocker) {
    return unitForConcept(input, blocker.concept_id, {
      source: "mastery_projection",
      concept_ids: [blocker.concept_id],
      reason: "prerequisite_blocker",
    }) ?? catalogFallback(input);
  }

  if (input.learningStart?.concept_id && input.diagnosticProvenance) {
    const selected = unitForConcept(input, input.learningStart.concept_id, {
      ...input.diagnosticProvenance,
      concept_id: input.learningStart.concept_id,
    });
    if (selected) return selected;
  }

  for (const focus of input.recommendationFocus) {
    const selected = unitForConcept(input, focus.target_id, {
      source: "recommendation_ranker",
      concept_ids: [focus.target_id],
      reason: "recommendation_focus",
    }) ?? unitForConcept(input, focus.concept_id, {
      source: "recommendation_ranker",
      concept_ids: [focus.concept_id],
      reason: "recommendation_focus",
    });
    if (selected) return selected;
  }

  return catalogFallback(input);
}

function selectPrerequisiteBlocker(
  concepts: ReturnType<typeof getActiveCatalogConcepts>,
  policyByConcept: ReturnType<typeof getCatalogProgressPolicyInputMap>,
  masteryByConcept: Map<string, MasteryRow>,
): { concept_id: string } | null {
  const candidates = concepts
    .map((concept) => {
      const policy = policyByConcept.get(concept.id);
      const mastery = masteryByConcept.get(concept.id);
      if (!policy?.prerequisite_blocker || !mastery || mastery.evidence_count <= 0) return undefined;
      const progress = conceptProgressFromProjection(mastery);
      if (progress >= PROGRESS_POLICY.readinessThreshold) return undefined;
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
  return candidates[0] ? { concept_id: candidates[0].concept_id } : null;
}

function unitForConcept(
  input: {
    concepts: ReturnType<typeof getActiveCatalogConcepts>;
    unitById: Map<string, { id: string; title: string }>;
    rawCurriculum: LearningProgressChapter[];
  },
  conceptId: string,
  provenance: ProgressProvenance,
): UnitSelection | null {
  const concept = input.concepts.find((item) => item.id === conceptId);
  if (!concept?.unit_id) return null;
  const unit = input.unitById.get(concept.unit_id);
  if (!unit) return null;
  const chapter = input.rawCurriculum.find((item) => item.id === unit.id);
  return {
    unit: {
      id: unit.id,
      title: unit.title,
      kind: "catalog",
      concept_ids: chapter?.concept_ids ?? [conceptId],
      mastery_percent: chapter?.mastery_percent,
      reason: provenance.source,
    },
    provenance: provenance.source === "active_diagnostic" ? { ...provenance, unit_id: unit.id } : provenance,
  };
}

function catalogFallback(input: {
  rawCurriculum: LearningProgressChapter[];
  latestCatalogId?: string;
}): UnitSelection {
  const incomplete = input.rawCurriculum.find((chapter) => chapter.mastery_percent < PROGRESS_POLICY.unitCompletionThreshold);
  const chapter = incomplete ?? input.rawCurriculum[input.rawCurriculum.length - 1] ?? {
    id: "catalog",
    title: "课程目录",
    concept_ids: [],
    mastery_percent: 0,
    status: "upcoming" as const,
  };
  return {
    unit: {
      id: chapter.id,
      title: chapter.title,
      kind: "catalog",
      concept_ids: chapter.concept_ids,
      mastery_percent: chapter.mastery_percent,
      reason: incomplete ? "catalog_path_incomplete" : "catalog_path_complete",
    },
    provenance: {
      source: "active_catalog",
      catalog_run_id: input.latestCatalogId,
      unit_id: chapter.id,
      reason: incomplete ? "first_incomplete_unit" : "final_completed_unit",
    },
  };
}

function buildCurriculumProgress(runtime: AppRuntime, mastery: MasteryRow[]): LearningProgressChapter[] {
  const masteryByConcept = new Map(mastery.map((item) => [item.concept_id, item]));
  const policyByConcept = getCatalogProgressPolicyInputMap(runtime);
  const concepts = getActiveCatalogConcepts(runtime);
  const conceptsByUnit = new Map<string, string[]>();
  for (const concept of concepts) {
    const unitId = concept.unit_id ?? "unassigned";
    const list = conceptsByUnit.get(unitId) ?? [];
    list.push(concept.id);
    conceptsByUnit.set(unitId, list);
  }
  return getCatalogUnits(runtime).map((unit) => {
    const conceptIds = conceptsByUnit.get(unit.id) ?? [];
    const weightedProgress = conceptIds.map((conceptId) => {
      const policy = policyByConcept.get(conceptId);
      return {
        progress: conceptProgressFromProjection(masteryByConcept.get(conceptId)),
        weight: policy?.progress_weight ?? 1,
      };
    });
    const rawMasteryPercent = weightedProgress.length === 0 ? 0 : Math.round(weightedAverage(weightedProgress));
    const prerequisiteCap = prerequisiteReadinessCap(policyByConcept, masteryByConcept, conceptIds);
    return {
      id: unit.id,
      title: unit.title,
      concept_ids: conceptIds,
      mastery_percent: Math.min(rawMasteryPercent, prerequisiteCap),
      status: "upcoming" as const,
    };
  });
}

function applyCurrentUnitStatus(
  curriculum: LearningProgressChapter[],
  currentUnit: LearningProgressUnit,
  completedFresh: boolean,
): LearningProgressChapter[] {
  if (!completedFresh || currentUnit.kind !== "catalog") return curriculum;
  const currentIndex = curriculum.findIndex((chapter) => chapter.id === currentUnit.id);
  if (currentIndex === -1) return curriculum;
  const allComplete = curriculum.every((chapter) => chapter.mastery_percent >= PROGRESS_POLICY.unitCompletionThreshold);
  if (allComplete) return curriculum.map((chapter) => ({ ...chapter, status: "completed" }));
  return curriculum.map((chapter, index) => ({
    ...chapter,
    status: index < currentIndex ? "completed" : index === currentIndex ? "current" : "upcoming",
  }));
}

function computeCourseProgressPercent(curriculum: LearningProgressChapter[], completedFresh: boolean): number {
  if (!completedFresh) return 0;
  const chapterProgress = curriculum.length === 0 ? 0 : average(curriculum.map((chapter) => chapter.mastery_percent));
  return Math.max(0, Math.min(100, Math.round(chapterProgress)));
}

function prerequisiteReadinessCap(
  policyByConcept: ReturnType<typeof getCatalogProgressPolicyInputMap>,
  masteryByConcept: Map<string, MasteryRow>,
  conceptIds: string[],
): number {
  let cap = 100;
  for (const conceptId of conceptIds) {
    const policy = policyByConcept.get(conceptId);
    for (const prerequisiteId of policy?.prerequisite_ids ?? []) {
      const prerequisite = masteryByConcept.get(prerequisiteId);
      const progress = conceptProgressFromProjection(prerequisite);
      if (progress < PROGRESS_POLICY.readinessThreshold) {
        cap = Math.min(cap, progress);
      }
    }
  }
  return cap;
}

function buildDiagnosticFeedback(
  runtime: AppRuntime,
  options: {
    sessionId?: string | null;
    diagnostic: { completed: boolean; leading_start_label?: string | null };
    learningStart: LearningProgressStart | null;
  },
): DiagnosticFeedback | null {
  if (!options.diagnostic.completed) return null;
  const session = loadLatestDiagnosticSession(runtime, options.sessionId);
  if (!session || session.status !== "completed") return null;
  const states = loadDiagnosticFeedbackStates(runtime, session.id);
  const learningStart = options.learningStart?.label ?? options.diagnostic.leading_start_label ?? "当前学习起点";
  return {
    performance_summary: summarizeDiagnosticPerformance(states),
    mastery_summary: summarizeDiagnosticMastery(states, learningStart),
    learning_start: learningStart,
  };
}

type DiagnosticFeedbackState = {
  concept_id: string;
  name: string | null;
  mastery: number;
  confidence: number;
  evidence_count: number;
  band: string;
  conflicting_evidence_count: number;
  catalog_order: number | null;
};

function loadDiagnosticFeedbackStates(runtime: AppRuntime, diagnosticSessionId: string): DiagnosticFeedbackState[] {
  return runtime.db.query<DiagnosticFeedbackState>(
    `SELECT
       s.concept_id,
       c.name,
       s.mastery,
       s.confidence,
       s.evidence_count,
       s.band,
       s.conflicting_evidence_count,
       c.order_index AS catalog_order
     FROM diagnostic_concept_state s
     LEFT JOIN concepts c ON c.id = s.concept_id
     WHERE s.diagnostic_session_id = ?
     ORDER BY COALESCE(c.order_index, 9999) ASC, s.concept_id ASC`,
  ).all([diagnosticSessionId]);
}

function summarizeDiagnosticPerformance(states: DiagnosticFeedbackState[]): string {
  const assessed = states.filter((state) => state.evidence_count > 0);
  if (assessed.length === 0) return "已完成初始测评，系统已记录你的答题表现。";
  const stable = assessed.filter((state) => state.mastery >= 70 && state.confidence >= 0.7 && state.conflicting_evidence_count === 0);
  const unstable = assessed.filter((state) => state.mastery < 70 || state.band === "weak" || state.band === "learning" || state.conflicting_evidence_count > 0);
  const stableText = labelList(stable);
  const unstableText = labelList(unstable);
  if (stableText && unstableText) return `${stableText}表现较稳定，${unstableText}仍需巩固。`;
  if (stableText) return `${stableText}表现较稳定。`;
  if (unstableText) return `${unstableText}相关题目仍有波动。`;
  return "已完成初始测评，系统已记录你的答题表现。";
}

function summarizeDiagnosticMastery(states: DiagnosticFeedbackState[], learningStart: string): string {
  const assessed = states.filter((state) => state.evidence_count > 0);
  if (assessed.length === 0) return `建议从${learningStart}开始，边学边确认掌握情况。`;
  const ready = assessed.filter((state) => state.mastery >= 70 && state.confidence >= 0.7);
  const needs = assessed.filter((state) => state.mastery < 70 || state.band === "weak" || state.band === "learning");
  const readyText = labelList(ready);
  const needsText = labelList(needs);
  if (readyText && needsText) return `已具备${readyText}基础，建议补齐${needsText}。`;
  if (needsText) return `建议先巩固${needsText}，再继续推进后续内容。`;
  if (readyText) return `已具备${readyText}基础，建议从${learningStart}继续推进。`;
  return `建议从${learningStart}开始，边学边确认掌握情况。`;
}

function labelList(states: DiagnosticFeedbackState[], limit = 3): string {
  return [...new Map(states.map((state) => [state.concept_id, state.name ?? state.concept_id])).values()]
    .slice(0, limit)
    .join("、");
}

function decisionReasons(input: {
  diagnosticState: LearningProgressDiagnosticState;
  rawDiagnosticStatus?: string;
  rawDiagnosticStopReason: string | null;
  diagnosticSession?: DiagnosticSessionRow;
  latestCatalogId?: string;
  tutorAgentCatalogState?: "fresh" | "stale" | "missing";
}): string[] {
  const reasons: string[] = [input.diagnosticState];
  if (input.rawDiagnosticStatus) reasons.push(`diagnostic_status:${input.rawDiagnosticStatus}`);
  if (input.rawDiagnosticStopReason) reasons.push(`diagnostic_stop:${input.rawDiagnosticStopReason}`);
  if (input.diagnosticState === "catalog_stale") {
    reasons.push(`diagnostic_catalog:${input.diagnosticSession?.catalog_run_id ?? "missing"}`);
    reasons.push(`active_catalog:${input.latestCatalogId ?? "missing"}`);
  }
  if (input.tutorAgentCatalogState === "stale") reasons.push("tutor_agent_catalog_stale");
  return reasons;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weightedAverage(values: Array<{ progress: number; weight: number }>): number {
  const totalWeight = values.reduce((sum, value) => sum + value.weight, 0);
  if (totalWeight <= 0) return 0;
  return values.reduce((sum, value) => sum + value.progress * value.weight, 0) / totalWeight;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
