import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { nowIso } from "../security/ids.js";
import { MIGRATION_001, MIGRATION_002_CATALOG, MIGRATION_003_TUTOR_AGENT } from "./schema.js";

type Params = unknown[] | Record<string, unknown>;

function applyParams<T>(fn: (...args: any[]) => T, params?: Params): T {
  if (params === undefined) {
    return fn();
  }
  return Array.isArray(params) ? fn(...params) : fn(params);
}

export type AppStatement<T> = {
  all(params?: Params): T[];
  get(params?: Params): T | undefined;
  run(params?: Params): { changes: number | bigint; lastInsertRowid: number | bigint };
};

export class AppDatabase {
  readonly raw: DatabaseSync;
  private transactionDepth = 0;

  constructor(raw: DatabaseSync) {
    this.raw = raw;
    this.raw.exec("PRAGMA foreign_keys = ON;");
  }

  query<T = Record<string, unknown>>(sql: string): AppStatement<T> {
    const stmt = this.raw.prepare(sql);
    return {
      all: (params?: Params) => applyParams((...args) => stmt.all(...args) as T[], params),
      get: (params?: Params) => applyParams((...args) => stmt.get(...args) as T | undefined, params),
      run: (params?: Params) => applyParams((...args) => stmt.run(...args), params),
    };
  }

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  transaction<T>(fn: () => T): T {
    if (this.transactionDepth > 0) {
      return fn();
    }
    this.raw.exec("BEGIN IMMEDIATE;");
    this.transactionDepth++;
    try {
      const result = fn();
      this.raw.exec("COMMIT;");
      return result;
    } catch (error) {
      this.raw.exec("ROLLBACK;");
      throw error;
    } finally {
      this.transactionDepth--;
    }
  }

  close(): void {
    this.raw.close();
  }
}

export function openDatabase({ dbPath }: { dbPath: string }): AppDatabase {
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const db = new AppDatabase(new DatabaseSync(dbPath));
  db.exec(MIGRATION_001);
  db.exec(MIGRATION_002_CATALOG);
  db.exec(MIGRATION_003_TUTOR_AGENT);
  ensureCatalogColumns(db);
  db.query("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(["001_initial", nowIso()]);
  db.query("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(["002_kb_catalog", nowIso()]);
  db.query("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(["003_tutor_agent", nowIso()]);
  return db;
}

function ensureCatalogColumns(db: AppDatabase): void {
  const columns: Array<{ table: string; name: string; definition: string }> = [
    { table: "concepts", name: "unit_id", definition: "TEXT" },
    { table: "concepts", name: "catalog_status", definition: "TEXT NOT NULL DEFAULT 'active' CHECK (catalog_status IN ('active', 'inactive'))" },
    { table: "concepts", name: "source_type", definition: "TEXT NOT NULL DEFAULT 'kb_concept'" },
    { table: "concepts", name: "source_path", definition: "TEXT" },
    { table: "concepts", name: "source_hash", definition: "TEXT" },
    { table: "concepts", name: "catalog_version", definition: "TEXT" },
    { table: "concepts", name: "order_index", definition: "INTEGER NOT NULL DEFAULT 0" },
    { table: "concepts", name: "previous_ids_json", definition: "TEXT NOT NULL DEFAULT '[]'" },
    { table: "concepts", name: "metadata_json", definition: "TEXT NOT NULL DEFAULT '{}'" },
    { table: "concepts", name: "diagnostic_eligible", definition: "INTEGER NOT NULL DEFAULT 1 CHECK (diagnostic_eligible IN (0, 1))" },
    { table: "concept_mastery", name: "readiness", definition: "REAL NOT NULL DEFAULT 0 CHECK (readiness BETWEEN 0 AND 100)" },
    { table: "concept_mastery", name: "last_evidence_at", definition: "TEXT" },
    { table: "mistake_tags", name: "catalog_status", definition: "TEXT NOT NULL DEFAULT 'active' CHECK (catalog_status IN ('active', 'inactive'))" },
    { table: "mistake_tags", name: "source_path", definition: "TEXT" },
    { table: "mistake_tags", name: "source_hash", definition: "TEXT" },
    { table: "mistake_tags", name: "catalog_version", definition: "TEXT" },
    { table: "mistake_tags", name: "concept_ids_json", definition: "TEXT NOT NULL DEFAULT '[]'" },
    { table: "mistake_tags", name: "metadata_json", definition: "TEXT NOT NULL DEFAULT '{}'" },
    { table: "mistake_tags", name: "order_index", definition: "INTEGER NOT NULL DEFAULT 0" },
    { table: "exercises", name: "catalog_status", definition: "TEXT NOT NULL DEFAULT 'active' CHECK (catalog_status IN ('active', 'inactive'))" },
    { table: "exercises", name: "source_path", definition: "TEXT" },
    { table: "exercises", name: "source_hash", definition: "TEXT" },
    { table: "exercises", name: "catalog_version", definition: "TEXT" },
    { table: "exercises", name: "order_index", definition: "INTEGER NOT NULL DEFAULT 0" },
    { table: "exercises", name: "private_solution", definition: "INTEGER NOT NULL DEFAULT 0 CHECK (private_solution IN (0, 1))" },
    { table: "exercises", name: "skip", definition: "INTEGER NOT NULL DEFAULT 0 CHECK (skip IN (0, 1))" },
    { table: "exercises", name: "metadata_json", definition: "TEXT NOT NULL DEFAULT '{}'" },
    { table: "diagnostic_sessions", name: "catalog_version", definition: "TEXT" },
    { table: "diagnostic_sessions", name: "catalog_run_id", definition: "TEXT" },
  ];
  for (const column of columns) {
    if (!hasColumn(db, column.table, column.name)) {
      db.exec(`ALTER TABLE ${column.table} ADD COLUMN ${column.name} ${column.definition};`);
    }
  }
  ensureLearningEvidenceSchema(db);
  backfillMasteryProjectionColumns(db);
  removePresetMasteryProjectionRows(db);
  ensureConceptRelationsSchema(db);
  ensureAgenticReviewPracticeSchema(db);
  db.exec(`
CREATE INDEX IF NOT EXISTS idx_concepts_catalog_status_order ON concepts(catalog_status, order_index);
CREATE INDEX IF NOT EXISTS idx_concepts_source_path ON concepts(source_path);
CREATE INDEX IF NOT EXISTS idx_exercises_catalog_status_order ON exercises(catalog_status, order_index);
CREATE INDEX IF NOT EXISTS idx_mistake_tags_catalog_status_order ON mistake_tags(catalog_status, order_index);
CREATE INDEX IF NOT EXISTS idx_learning_evidence_concept_created ON learning_evidence(concept_id, created_at);
CREATE INDEX IF NOT EXISTS idx_learning_evidence_source ON learning_evidence(source_type, source_id);
`);
  ensurePracticeOutcomeSchema(db);
}

function ensureAgenticReviewPracticeSchema(db: AppDatabase): void {
  db.exec(`
CREATE TABLE IF NOT EXISTS practice_contracts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  turn_id TEXT,
  tutor_agent_action_id TEXT,
  concept_ids_json TEXT NOT NULL DEFAULT '[]',
  title TEXT NOT NULL,
  prompt_md TEXT NOT NULL,
  starter_code TEXT,
  expected_behavior TEXT NOT NULL,
  visible_examples_json TEXT NOT NULL DEFAULT '[]',
  acceptance_checklist_json TEXT NOT NULL DEFAULT '[]',
  allowed_solution_shape TEXT,
  review_rubric TEXT NOT NULL,
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  progress_eligible INTEGER NOT NULL DEFAULT 0 CHECK (progress_eligible IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'submitted', 'completed', 'abandoned')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id),
  FOREIGN KEY (turn_id) REFERENCES session_turns(id),
  FOREIGN KEY (tutor_agent_action_id) REFERENCES tutor_agent_actions(id)
);

CREATE TABLE IF NOT EXISTS agent_practice_reviews (
  id TEXT PRIMARY KEY,
  practice_contract_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  turn_id TEXT,
  submitted_code_hash TEXT NOT NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('passed', 'partial', 'needs_revision', 'blocked_by_error')),
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  learner_facing_summary TEXT NOT NULL,
  progress_effect TEXT NOT NULL DEFAULT 'not_recorded' CHECK (progress_effect IN ('recorded', 'not_recorded', 'pending')),
  progress_reason TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (practice_contract_id) REFERENCES practice_contracts(id),
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id),
  FOREIGN KEY (turn_id) REFERENCES session_turns(id)
);

CREATE INDEX IF NOT EXISTS idx_practice_contracts_session_status ON practice_contracts(session_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_practice_contracts_turn ON practice_contracts(turn_id);
CREATE INDEX IF NOT EXISTS idx_agent_practice_reviews_contract_created ON agent_practice_reviews(practice_contract_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_practice_reviews_session_turn ON agent_practice_reviews(session_id, turn_id);
`);
}

function ensurePracticeOutcomeSchema(db: AppDatabase): void {
  db.exec(`
CREATE TABLE IF NOT EXISTS session_practice_outcomes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  turn_id TEXT,
  agent_action_id TEXT,
  outcome_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id),
  FOREIGN KEY (turn_id) REFERENCES session_turns(id),
  FOREIGN KEY (agent_action_id) REFERENCES tutor_agent_actions(id)
);
CREATE INDEX IF NOT EXISTS idx_session_practice_outcomes_session_created ON session_practice_outcomes(session_id, created_at);
`);
  if (!hasColumn(db, "session_practice_outcomes", "agent_action_id")) {
    db.exec("ALTER TABLE session_practice_outcomes ADD COLUMN agent_action_id TEXT;");
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_session_practice_outcomes_action ON session_practice_outcomes(agent_action_id);");
}

function ensureLearningEvidenceSchema(db: AppDatabase): void {
  db.exec(`
CREATE TABLE IF NOT EXISTS learning_evidence (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('diagnostic', 'exercise', 'project', 'tutor_review', 'mistake')),
  source_id TEXT NOT NULL,
  session_id TEXT,
  turn_id TEXT,
  concept_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  difficulty INTEGER CHECK (difficulty IS NULL OR difficulty BETWEEN 1 AND 5),
  score INTEGER CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  evaluator_confidence REAL CHECK (evaluator_confidence IS NULL OR evaluator_confidence BETWEEN 0 AND 1),
  evidence_weight REAL NOT NULL DEFAULT 1 CHECK (evidence_weight >= 0),
  validity_state TEXT NOT NULL DEFAULT 'valid' CHECK (validity_state IN ('valid', 'invalid', 'corrected')),
  catalog_version TEXT,
  summary_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  UNIQUE(source_type, source_id, concept_id),
  FOREIGN KEY (session_id) REFERENCES agent_sessions(id),
  FOREIGN KEY (turn_id) REFERENCES session_turns(id),
  FOREIGN KEY (concept_id) REFERENCES concepts(id)
);
`);
}

function backfillMasteryProjectionColumns(db: AppDatabase): void {
  db.query(
    "UPDATE concept_mastery SET readiness = CASE WHEN evidence_count > 0 THEN ROUND(mastery_level * confidence) ELSE 0 END WHERE readiness = 0 AND evidence_count > 0",
  ).run();
  db.query("UPDATE concept_mastery SET last_evidence_at = last_practiced_at WHERE last_evidence_at IS NULL AND last_practiced_at IS NOT NULL").run();
}

function removePresetMasteryProjectionRows(db: AppDatabase): void {
  db.query(
    `DELETE FROM concept_mastery
     WHERE evidence_count = 0
       AND last_evidence_at IS NULL
       AND last_practiced_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM learning_evidence
         WHERE learning_evidence.concept_id = concept_mastery.concept_id
       )`,
  ).run();
}

function ensureConceptRelationsSchema(db: AppDatabase): void {
  const table = db.query<{ sql: string }>("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'concept_relations'").get();
  if (!table?.sql || table.sql.includes("'progression'")) return;
  db.exec(`
PRAGMA foreign_keys = OFF;
ALTER TABLE concept_relations RENAME TO concept_relations_old;
CREATE TABLE concept_relations (
  source_concept_id TEXT NOT NULL,
  target_concept_id TEXT NOT NULL,
  relation_type TEXT NOT NULL CHECK (relation_type IN ('prerequisite', 'related', 'reinforces', 'follows', 'progression', 'remediation')),
  weight REAL NOT NULL DEFAULT 1 CHECK (weight >= 0),
  source_type TEXT NOT NULL DEFAULT 'kb_catalog',
  source_path TEXT,
  source_hash TEXT,
  catalog_version TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (source_concept_id, target_concept_id, relation_type),
  FOREIGN KEY (source_concept_id) REFERENCES concepts(id),
  FOREIGN KEY (target_concept_id) REFERENCES concepts(id)
);
INSERT OR IGNORE INTO concept_relations(
  source_concept_id, target_concept_id, relation_type, weight, source_type,
  source_path, source_hash, catalog_version, metadata_json, created_at, updated_at
)
SELECT
  source_concept_id, target_concept_id, relation_type, weight, source_type,
  source_path, source_hash, catalog_version, metadata_json, created_at, updated_at
FROM concept_relations_old
WHERE relation_type IN ('prerequisite', 'related', 'reinforces', 'follows', 'progression', 'remediation');
DROP TABLE concept_relations_old;
PRAGMA foreign_keys = ON;
`);
}

function hasColumn(db: AppDatabase, table: string, columnName: string): boolean {
  return db.query<{ name: string }>(`PRAGMA table_info(${table})`).all().some((column) => column.name === columnName);
}
