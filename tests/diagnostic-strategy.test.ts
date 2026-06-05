import { describe, expect, it } from "vitest";
import {
  computeSequentialPlacementReadiness,
  selectSequentialPlacementTarget,
  scoreDiagnosticConceptPriority,
  selectDifficultyDirection,
  type DiagnosticConceptSnapshot,
  type DiagnosticAttemptSnapshot,
} from "../src/server/diagnostic-strategy.js";

describe("diagnostic strategy helpers", () => {
  it("prioritizes unknown prerequisites over similar non-prerequisites", () => {
    const variable = conceptState({ concept_id: "variable", band: "unknown", uncertainty: 0.72, evidence_count: 0, catalog_priority_weight: 3.2, prerequisite_blocker: true });
    const dict = conceptState({ concept_id: "dict", band: "unknown", uncertainty: 0.72, evidence_count: 0, review_priority: 5 });

    expect(scoreDiagnosticConceptPriority(variable).score).toBeGreaterThan(scoreDiagnosticConceptPriority(dict).score);
  });

  it("uses catalog-derived prerequisite weight before historical hardcoded IDs", () => {
    const catalogRoot = conceptState({
      concept_id: "intro-python",
      band: "unknown",
      uncertainty: 0.72,
      evidence_count: 0,
      catalog_priority_weight: 5,
      prerequisite_blocker: true,
    });
    const historicalVariable = conceptState({
      concept_id: "variable",
      band: "unknown",
      uncertainty: 0.72,
      evidence_count: 0,
    });

    expect(scoreDiagnosticConceptPriority(catalogRoot).score).toBeGreaterThan(scoreDiagnosticConceptPriority(historicalVariable).score);
    expect(scoreDiagnosticConceptPriority(catalogRoot).priority_inputs.prerequisite_weight).toBe(5);
  });

  it("penalizes recent repetition unless the concept is an unresolved prerequisite blocker", () => {
    const list = conceptState({ concept_id: "dict", band: "learning", uncertainty: 0.6, evidence_count: 1 });
    const withoutRecent = scoreDiagnosticConceptPriority(list, []);
    const withRecent = scoreDiagnosticConceptPriority(list, ["dict", "dict"]);

    expect(withRecent.score).toBeLessThan(withoutRecent.score);
  });

  it("raises conflict-heavy concepts for clarification", () => {
    const conflictedLoop = conceptState({ concept_id: "loop", band: "learning", uncertainty: 0.82, evidence_count: 2, conflicting_evidence_count: 2 });
    const unknownExpression = conceptState({ concept_id: "expression", band: "unknown", uncertainty: 0.72, evidence_count: 0 });

    const conflicted = scoreDiagnosticConceptPriority(conflictedLoop);
    expect(conflicted.score).toBeGreaterThan(scoreDiagnosticConceptPriority(unknownExpression).score);
    expect(conflicted.priority_inputs.conflicting_evidence_count).toBe(2);
  });

  it("selects lower or higher follow-up difficulty from recent answer outcome and confidence", () => {
    const incorrect: DiagnosticAttemptSnapshot = {
      item_id: "q1",
      concept_ids: ["variable"],
      outcome: "incorrect",
      difficulty: 2,
      created_at: "2026-05-15T00:00:00.000Z",
    };
    const correct: DiagnosticAttemptSnapshot = {
      item_id: "q2",
      concept_ids: ["variable"],
      outcome: "correct",
      difficulty: 1,
      created_at: "2026-05-15T00:00:01.000Z",
    };

    expect(selectDifficultyDirection(conceptState({ concept_id: "variable", confidence: 0.38 }), [incorrect])).toBe("lower");
    expect(selectDifficultyDirection(conceptState({ concept_id: "variable", confidence: 0.55 }), [correct])).toBe("higher");
    expect(selectDifficultyDirection(conceptState({ concept_id: "variable", confidence: 0.9 }), [correct])).toBe("same");
  });

  it("completes as soon as a high-confidence learning start is identified with minimal evidence", () => {
    const states = [
      conceptState({ concept_id: "intro-python", mastery: 88, confidence: 0.92, evidence_count: 1, uncertainty: 0.06, band: "proficient", catalog_order: 1 }),
      conceptState({ concept_id: "condition", mastery: 84, confidence: 0.9, evidence_count: 1, uncertainty: 0.08, band: "proficient", catalog_order: 2 }),
      conceptState({ concept_id: "loop", mastery: 32, confidence: 0.91, evidence_count: 1, uncertainty: 0.1, band: "weak", catalog_order: 3 }),
      conceptState({ concept_id: "function", mastery: 0, confidence: 0, evidence_count: 0, uncertainty: 1, band: "unknown", catalog_order: 4 }),
    ];

    const readiness = computeSequentialPlacementReadiness(states, 3);

    expect(readiness.stop).toBe(true);
    expect(readiness.reason).toBe("sequential_placement_ready");
    expect(readiness.placement.top_start_id).toBe("loop");
    expect(readiness.placement.top_confidence).toBeGreaterThanOrEqual(0.85);
    expect(readiness.placement.confidence_margin).toBeGreaterThanOrEqual(0.2);
    expect(readiness.placement.verified_boundary_ids).toContain("condition->loop");
    expect(readiness.estimated_remaining_max).toBe(0);
  });

  it("does not keep probing a verified boundary after placement confidence reaches the display cap", () => {
    const states = [
      conceptState({ concept_id: "intro-python", mastery: 90, confidence: 0.99, evidence_count: 1, uncertainty: 0.01, band: "proficient", catalog_order: 1 }),
      conceptState({ concept_id: "condition", mastery: 72, confidence: 0.99, evidence_count: 1, uncertainty: 0.01, band: "proficient", catalog_order: 2 }),
      conceptState({ concept_id: "loop", mastery: 68, confidence: 0.99, evidence_count: 1, uncertainty: 0.01, band: "learning", catalog_order: 3 }),
      conceptState({ concept_id: "function", mastery: 0, confidence: 0, evidence_count: 0, uncertainty: 1, band: "unknown", catalog_order: 4 }),
    ];

    const readiness = computeSequentialPlacementReadiness(states, 3);

    expect(readiness.placement.top_start_id).toBe("loop");
    expect(readiness.placement.top_confidence).toBe(0.99);
    expect(readiness.placement.verified_boundary_ids).toContain("condition->loop");
    expect(readiness.stop).toBe(true);
    expect(readiness.reason).toBe("sequential_placement_ready");
    expect(readiness.estimated_remaining_max).toBe(0);
  });

  it("does not let resolved high-confidence historical conflicts block placement completion", () => {
    const states = [
      conceptState({ concept_id: "intro-python", mastery: 88, confidence: 0.92, evidence_count: 2, uncertainty: 0.06, band: "proficient", catalog_order: 1 }),
      conceptState({ concept_id: "project_practice", mastery: 90, confidence: 1, evidence_count: 16, uncertainty: 0.3, band: "proficient", conflicting_evidence_count: 2, catalog_order: 2 }),
    ];

    const readiness = computeSequentialPlacementReadiness(states, 56);

    expect(readiness.stop).toBe(true);
    expect(readiness.reason).toBe("sequential_placement_ready");
    expect(readiness.placement.conflict_count).toBe(0);
  });

  it("keeps low-confidence placement active after the old hard-cap count and returns a focus target", () => {
    const states = [
      conceptState({ concept_id: "intro-python", mastery: 45, confidence: 0.48, evidence_count: 3, uncertainty: 0.58, band: "learning", catalog_order: 1 }),
      conceptState({ concept_id: "condition", mastery: 42, confidence: 0.44, evidence_count: 3, uncertainty: 0.61, band: "learning", catalog_order: 2 }),
      conceptState({ concept_id: "loop", mastery: 40, confidence: 0.41, evidence_count: 3, uncertainty: 0.66, band: "learning", catalog_order: 3 }),
      conceptState({ concept_id: "pytest", mastery: 0, confidence: 0, evidence_count: 0, uncertainty: 1, band: "unknown", catalog_order: 4 }),
    ];

    const readiness = computeSequentialPlacementReadiness(states, 42);
    const target = selectSequentialPlacementTarget(states, [], readiness.placement);

    expect(readiness.stop).toBe(false);
    expect(readiness.reason).not.toBe("needs_more_evidence");
    expect(readiness.reason).not.toContain("hard_cap");
    expect(readiness.estimated_remaining_min).toBeGreaterThan(0);
    expect(readiness.estimated_remaining_max).toBeGreaterThan(0);
    expect(target?.concept_id).toBeTruthy();
  });

  it("selects placement anchors, adjacent boundary probes, conflict clarification, and avoids repetition", () => {
    const states = [
      conceptState({ concept_id: "intro-python", catalog_order: 1, prerequisite_blocker: true, catalog_priority_weight: 4 }),
      conceptState({ concept_id: "condition", catalog_order: 2 }),
      conceptState({ concept_id: "loop", catalog_order: 3 }),
      conceptState({ concept_id: "function", catalog_order: 4 }),
      conceptState({ concept_id: "pytest", catalog_order: 5 }),
    ];

    expect(selectSequentialPlacementTarget(states)?.concept_id).toBe("loop");

    const boundaryReadiness = computeSequentialPlacementReadiness([
      conceptState({ concept_id: "intro-python", mastery: 86, confidence: 0.9, evidence_count: 1, uncertainty: 0.08, band: "proficient", catalog_order: 1 }),
      conceptState({ concept_id: "condition", mastery: 62, confidence: 0.62, evidence_count: 1, uncertainty: 0.38, band: "learning", catalog_order: 2 }),
      conceptState({ concept_id: "loop", mastery: 0, confidence: 0, evidence_count: 0, uncertainty: 1, band: "unknown", catalog_order: 3 }),
    ], 2);
    expect(selectSequentialPlacementTarget([
      conceptState({ concept_id: "intro-python", mastery: 86, confidence: 0.9, evidence_count: 1, uncertainty: 0.08, band: "proficient", catalog_order: 1 }),
      conceptState({ concept_id: "condition", mastery: 62, confidence: 0.62, evidence_count: 1, uncertainty: 0.38, band: "learning", catalog_order: 2 }),
      conceptState({ concept_id: "loop", mastery: 0, confidence: 0, evidence_count: 0, uncertainty: 1, band: "unknown", catalog_order: 3 }),
    ], [], boundaryReadiness.placement)?.concept_id).toBe("condition");

    const conflicted = [
      conceptState({ concept_id: "intro-python", catalog_order: 1 }),
      conceptState({ concept_id: "loop", mastery: 45, confidence: 0.65, evidence_count: 2, uncertainty: 0.72, band: "learning", conflicting_evidence_count: 2, catalog_order: 2 }),
      conceptState({ concept_id: "function", catalog_order: 3 }),
    ];
    expect(selectSequentialPlacementTarget(conflicted)?.concept_id).toBe("loop");

    const repeated = selectSequentialPlacementTarget(states, [
      { item_id: "q1", concept_ids: ["loop"], outcome: "incorrect", difficulty: 2, created_at: "2026-05-15T00:00:00.000Z" },
      { item_id: "q2", concept_ids: ["loop"], outcome: "incorrect", difficulty: 2, created_at: "2026-05-15T00:00:01.000Z" },
    ]);
    expect(repeated?.concept_id).not.toBe("loop");
  });
});

function conceptState(overrides: Partial<DiagnosticConceptSnapshot>): DiagnosticConceptSnapshot {
  return {
    concept_id: "variable",
    mastery: 20,
    confidence: 0.3,
    evidence_count: 0,
    uncertainty: 0.72,
    band: "unknown",
    conflicting_evidence_count: 0,
    review_priority: 3,
    last_item_id: null,
    ...overrides,
  };
}
