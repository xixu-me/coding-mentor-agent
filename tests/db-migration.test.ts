import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db/database.js";
import { createTempDir } from "./utils/fs.js";

describe("SQLite migration", () => {
  it("creates the normative schema with foreign keys enabled", () => {
    const dir = createTempDir();
    const db = openDatabase({ dbPath: `${dir}/progress.db` });
    const fk = db.query<{ foreign_keys: number }>("PRAGMA foreign_keys").get();
    expect(fk?.foreign_keys).toBe(1);

    const tables = db.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name);
    expect(tables).toContain("local_profile");
    expect(tables).toContain("project_step_submissions");
    expect(tables).toContain("tool_audit_logs");
    expect(tables).toContain("intent_routes");
    expect(tables).toContain("context_traces");
    expect(tables).toContain("tool_evidence");
    expect(tables).toContain("diagnostic_sessions");
    expect(tables).toContain("diagnostic_concept_state");
    expect(tables).toContain("generated_items");
    expect(tables).toContain("generated_exercises");
    expect(tables).toContain("generated_exercise_evaluators");
    expect(tables).toContain("learning_evidence");
    expect(tables).toContain("practice_contracts");
    expect(tables).toContain("agent_practice_reviews");

    const projectSteps = db.query<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'project_steps'").get();
    expect(projectSteps?.sql).toContain("UNIQUE(id, project_plan_id)");

    const routes = db.query<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'intent_routes'").get();
    expect(routes?.sql).toContain("schema_version");
    expect(routes?.sql).toContain("allowed_tool_group");

    const traces = db.query<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'context_traces'").get();
    expect(traces?.sql).toContain("trace_contains_sensitive_data");

    const evaluatorStore = db.query<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'generated_exercise_evaluators'").get();
    expect(evaluatorStore?.sql).toContain("evaluator_private");

    const relations = db.query<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'concept_relations'").get();
    expect(relations?.sql).toContain("'progression'");
    expect(relations?.sql).toContain("'remediation'");

    const evidence = db.query<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'learning_evidence'").get();
    expect(evidence?.sql).toContain("source_type");
    expect(evidence?.sql).toContain("validity_state");

    const contracts = db.query<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'practice_contracts'").get();
    expect(contracts?.sql).toContain("expected_behavior");
    expect(contracts?.sql).toContain("acceptance_checklist_json");
    expect(contracts?.sql).toContain("progress_eligible");

    const reviews = db.query<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'agent_practice_reviews'").get();
    expect(reviews?.sql).toContain("submitted_code_hash");
    expect(reviews?.sql).toContain("evidence_refs_json");
    expect(reviews?.sql).not.toContain("submitted_code_snapshot");

    const masteryColumns = db.query<{ name: string }>("PRAGMA table_info(concept_mastery)").all().map((column) => column.name);
    expect(masteryColumns).toContain("readiness");
    expect(masteryColumns).toContain("last_evidence_at");

    const indexes = db.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'index'").all().map((row) => row.name);
    expect(indexes).toContain("idx_session_sse_events_session_seq");
    expect(indexes).toContain("idx_project_submissions_step_plan");
    expect(indexes).toContain("idx_intent_routes_session_turn");
    expect(indexes).toContain("idx_context_traces_session_turn");
    expect(indexes).toContain("idx_generated_exercise_evaluators_exercise");
    expect(indexes).toContain("idx_learning_evidence_concept_created");
    expect(indexes).toContain("idx_practice_contracts_session_status");
    expect(indexes).toContain("idx_agent_practice_reviews_contract_created");
    db.close();
  });
});
