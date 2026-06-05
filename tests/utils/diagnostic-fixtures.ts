import type { AppRuntime, LearningProgressDiagnosticState } from "../../src/types.js";
import { getActiveCatalogConcepts, getLatestCatalogRun } from "../../src/server/course-catalog.js";
import { deriveLearningProgressDecision } from "../../src/server/learning-progress-decision.js";
import { createId, nowIso } from "../../src/security/ids.js";

export type CompletedDiagnosticFixture = {
  diagnostic_session_id: string;
  session_id: string;
  concept_id: string;
  concept_name: string;
  catalog_run_id: string;
  catalog_version: string;
  freshness: "fresh";
};

export type DiagnosticFixtureClassification = {
  session_id: string;
  diagnostic_session_id: string | null;
  freshness: "fresh" | "stale" | "missing";
  diagnostic_state: LearningProgressDiagnosticState;
  issue_class?: "stale_completed_diagnostic_fixture" | "missing_completed_diagnostic_fixture";
  catalog_run_id?: string | null;
  catalog_version?: string | null;
  expected_catalog_run_id?: string | null;
  expected_catalog_version?: string | null;
};

function completeInitialDiagnosticFixtureImpl(
  runtime: AppRuntime,
  sessionId: string,
  options: { conceptId?: string; mastery?: number; confidence?: number } = {},
): CompletedDiagnosticFixture {
  const catalogRun = getLatestCatalogRun(runtime);
  if (!catalogRun) {
    throw new Error("completed diagnostic fixture requires a successful course catalog run");
  }
  const concept = selectFixtureConcept(runtime, options.conceptId);
  const now = nowIso();
  const diagnosticSessionId = createId("diag");
  const mastery = Math.max(0, Math.min(100, Math.round(options.mastery ?? 35)));
  const confidence = Math.max(0, Math.min(1, options.confidence ?? 0.85));

  runtime.db.transaction(() => {
    runtime.db.query(
      "INSERT INTO diagnostic_sessions(id, session_id, status, target_concepts_json, stop_reason, catalog_version, catalog_run_id, started_at, ended_at) VALUES (?, ?, 'completed', ?, 'test_complete', ?, ?, ?, ?)",
    ).run([
      diagnosticSessionId,
      sessionId,
      JSON.stringify([concept.id]),
      catalogRun.kb_version,
      catalogRun.id,
      now,
      now,
    ]);
    runtime.db.query(
      "INSERT INTO diagnostic_concept_state(diagnostic_session_id, concept_id, mastery, confidence, evidence_count, uncertainty, band, last_item_id, conflicting_evidence_count, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 0, ?)",
    ).run([
      diagnosticSessionId,
      concept.id,
      mastery,
      confidence,
      2,
      0.25,
      mastery >= 70 ? "proficient" : mastery < 40 ? "weak" : "learning",
      now,
    ]);
    runtime.db.query("UPDATE local_profile SET profile_json = ?, updated_at = ? WHERE id = 'local'").run([
      JSON.stringify({
        profile_summary: "Python course learner with a completed catalog-fresh diagnostic fixture.",
        current_level: `Start from ${concept.name}`,
        current_goal: `Practice ${concept.name}`,
        diagnostic_completion_confidence: confidence,
        diagnostic_placement_concept_id: concept.id,
        diagnostic_placement_label: concept.name,
        weak_concept_ids: [concept.id],
        unresolved_concept_ids: [],
      }),
      now,
    ]);
  });

  return {
    diagnostic_session_id: diagnosticSessionId,
    session_id: sessionId,
    concept_id: concept.id,
    concept_name: concept.name,
    catalog_run_id: catalogRun.id,
    catalog_version: catalogRun.kb_version,
    freshness: "fresh",
  };
}

function classifyCompletedDiagnosticFixture(runtime: AppRuntime, sessionId: string): DiagnosticFixtureClassification {
  const catalogRun = getLatestCatalogRun(runtime);
  const row = runtime.db.query<{
    id: string;
    status: string;
    catalog_run_id: string | null;
    catalog_version: string | null;
  }>(
    "SELECT id, status, catalog_run_id, catalog_version FROM diagnostic_sessions WHERE session_id = ? ORDER BY started_at DESC LIMIT 1",
  ).get([sessionId]);
  const decision = deriveLearningProgressDecision(runtime, { sessionId });
  if (!row || row.status !== "completed") {
    return {
      session_id: sessionId,
      diagnostic_session_id: row?.id ?? null,
      freshness: "missing",
      diagnostic_state: decision.diagnostic_state,
      issue_class: "missing_completed_diagnostic_fixture",
      expected_catalog_run_id: catalogRun?.id ?? null,
      expected_catalog_version: catalogRun?.kb_version ?? null,
    };
  }
  const fresh = Boolean(catalogRun && row.catalog_run_id === catalogRun.id && row.catalog_version === catalogRun.kb_version);
  return {
    session_id: sessionId,
    diagnostic_session_id: row.id,
    freshness: fresh ? "fresh" : "stale",
    diagnostic_state: decision.diagnostic_state,
    issue_class: fresh ? undefined : "stale_completed_diagnostic_fixture",
    catalog_run_id: row.catalog_run_id,
    catalog_version: row.catalog_version,
    expected_catalog_run_id: catalogRun?.id ?? null,
    expected_catalog_version: catalogRun?.kb_version ?? null,
  };
}

function selectFixtureConcept(runtime: AppRuntime, conceptId: string | undefined): { id: string; name: string } {
  const concepts = getActiveCatalogConcepts(runtime);
  const selected = concepts.find((concept) => concept.id === conceptId)
    ?? concepts.find((concept) => concept.id === "loop")
    ?? concepts.find((concept) => /loop|循环/i.test(`${concept.id} ${concept.name}`))
    ?? concepts[0];
  if (!selected) {
    throw new Error("completed diagnostic fixture requires at least one active catalog concept");
  }
  return { id: selected.id, name: selected.name };
}

export const completeInitialDiagnosticFixture = Object.assign(completeInitialDiagnosticFixtureImpl, {
  classify: classifyCompletedDiagnosticFixture,
});
