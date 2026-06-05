import { describe, expect, it } from "vitest";
import { startDiagnosticGuidance } from "../src/server/services.js";
import { getLatestCatalogRun } from "../src/server/course-catalog.js";
import { createId, nowIso } from "../src/security/ids.js";
import { completeInitialDiagnosticFixture } from "./utils/diagnostic-fixtures.js";
import { createTestRuntime } from "./utils/runtime.js";

describe("completed diagnostic fixture", () => {
  it("binds completed diagnostic state to the latest successful catalog run", async () => {
    const runtime = await createTestRuntime();
    const sessionId = createSessionRow(runtime);
    const catalogRun = getLatestCatalogRun(runtime);

    const fixture = completeInitialDiagnosticFixture(runtime, sessionId, { conceptId: "loop" });

    expect(fixture).toMatchObject({
      session_id: sessionId,
      concept_id: "loop",
      catalog_run_id: catalogRun?.id,
      catalog_version: catalogRun?.kb_version,
      freshness: "fresh",
    });
    expect(runtime.db.query<{ catalog_run_id: string | null; catalog_version: string | null }>(
      "SELECT catalog_run_id, catalog_version FROM diagnostic_sessions WHERE id = ?",
    ).get([fixture.diagnostic_session_id])).toMatchObject({
      catalog_run_id: catalogRun?.id,
      catalog_version: catalogRun?.kb_version,
    });
    expect(runtime.db.query<{ count: number }>(
      "SELECT COUNT(*) AS count FROM diagnostic_concept_state WHERE diagnostic_session_id = ? AND concept_id = 'loop'",
    ).get([fixture.diagnostic_session_id])?.count).toBe(1);

    await expect(startDiagnosticGuidance(runtime, sessionId)).resolves.toMatchObject({ accepted: true });
  });

  it("classifies stale completed diagnostics as fixture setup failures", async () => {
    const runtime = await createTestRuntime();
    const sessionId = createSessionRow(runtime);
    const now = nowIso();
    runtime.db.query(
      "INSERT INTO diagnostic_sessions(id, session_id, status, target_concepts_json, stop_reason, catalog_version, catalog_run_id, started_at, ended_at) VALUES (?, ?, 'completed', ?, 'stale_fixture', ?, ?, ?, ?)",
    ).run([createId("diag"), sessionId, JSON.stringify(["loop"]), "old-version", "old-run", now, now]);

    const fixture = completeInitialDiagnosticFixture.classify(runtime, sessionId);

    expect(fixture).toMatchObject({
      freshness: "stale",
      issue_class: "stale_completed_diagnostic_fixture",
      diagnostic_state: "catalog_stale",
    });
  });
});

function createSessionRow(runtime: Awaited<ReturnType<typeof createTestRuntime>>): string {
  const id = createId("sess");
  runtime.db.query("INSERT INTO agent_sessions(id, pi_session_id, status, started_at) VALUES (?, ?, 'active', ?)").run([
    id,
    `pi_${id}`,
    nowIso(),
  ]);
  return id;
}
