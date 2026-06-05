import { createCipheriv, pbkdf2Sync, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AppRuntime } from "../types.js";
import { AppError } from "../types.js";
import { createId, nowIso } from "../security/ids.js";
import { redactText } from "../security/redaction.js";
import { deriveGuidanceLoopState } from "./guidance-loop-state.js";
import { loadProgressEvidenceSummaries } from "./progress-evidence.js";

export type LocalDataExport = {
  exported_at: string;
  profile: Record<string, unknown>;
  mastery: Array<Record<string, unknown>>;
  learning_events: Array<Record<string, unknown>>;
  sessions: Array<Record<string, unknown>>;
  messages: Array<Record<string, unknown>>;
  exercise_attempts: Array<Record<string, unknown>>;
  project_submissions: Array<Record<string, unknown>>;
  tutor_agent_states: Array<Record<string, unknown>>;
  tutor_agent_actions: Array<Record<string, unknown>>;
  guidance_loop_states: Array<Record<string, unknown>>;
  tutor_agent_frontiers: Array<Record<string, unknown>>;
  practice_outcomes: Array<Record<string, unknown>>;
  practice_contracts: Array<Record<string, unknown>>;
  agent_practice_reviews: Array<Record<string, unknown>>;
  recent_progress_evidence: Array<Record<string, unknown>>;
  audit_summaries: Array<Record<string, unknown>>;
  security_events: Array<Record<string, unknown>>;
};

export function exportLocalData(runtime: AppRuntime): LocalDataExport {
  const profileRow = runtime.db.query<{ display_name: string | null; profile_json: string; created_at: string; updated_at: string }>(
    "SELECT display_name, profile_json, created_at, updated_at FROM local_profile WHERE id = 'local'",
  ).get();
  const profile = profileRow ? JSON.parse(profileRow.profile_json) as Record<string, unknown> : {};
  const sessions = runtime.db.query<Record<string, unknown>>(
    "SELECT s.id, s.status, s.summary, s.started_at, s.ended_at, COUNT(t.id) AS turn_count FROM agent_sessions s LEFT JOIN session_turns t ON t.session_id = s.id GROUP BY s.id ORDER BY s.started_at ASC",
  ).all();
  return sanitizeExport({
    exported_at: nowIso(),
    profile: {
      display_name: profileRow?.display_name ?? undefined,
      ...profile,
      created_at: profileRow?.created_at,
      updated_at: profileRow?.updated_at,
    },
    mastery: runtime.db.query<Record<string, unknown>>("SELECT concept_id, mastery_level, confidence, evidence_count, review_priority, last_practiced_at, updated_at FROM concept_mastery ORDER BY concept_id").all(),
    learning_events: runtime.db.query<Record<string, unknown>>("SELECT event_type, concept_ids_json, payload_json, evidence_json, created_at FROM learning_events ORDER BY created_at").all(),
    sessions,
    messages: runtime.db.query<Record<string, unknown>>("SELECT session_id, turn_id, role, content_redacted_text, code_ref, tool_name, created_at FROM session_messages ORDER BY created_at").all(),
    exercise_attempts: runtime.db.query<Record<string, unknown>>("SELECT exercise_id, status, score, hint_count, result_summary_json, mistake_tag_ids_json, created_at FROM exercise_attempts ORDER BY created_at").all(),
    project_submissions: runtime.db.query<Record<string, unknown>>("SELECT project_plan_id, project_step_id, status, review_summary_json, created_at FROM project_step_submissions ORDER BY created_at").all(),
    tutor_agent_states: runtime.db.query<Record<string, unknown>>("SELECT session_id, status, current_concept_id, catalog_version, created_at, updated_at FROM tutor_agent_states ORDER BY updated_at").all(),
    tutor_agent_actions: runtime.db.query<Record<string, unknown>>("SELECT session_id, turn_id, action_kind, concept_id, validation_status, validation_code, learner_facing_response, created_at FROM tutor_agent_actions ORDER BY created_at").all(),
    guidance_loop_states: exportGuidanceLoopStates(runtime),
    tutor_agent_frontiers: exportTutorAgentFrontiers(runtime),
    practice_outcomes: exportPracticeOutcomes(runtime),
    practice_contracts: exportPracticeContracts(runtime),
    agent_practice_reviews: exportAgentPracticeReviews(runtime),
    recent_progress_evidence: loadProgressEvidenceSummaries(runtime, { limit: 50 }) as unknown as Array<Record<string, unknown>>,
    audit_summaries: runtime.db.query<Record<string, unknown>>("SELECT tool_name, result_code, result_summary, duration_ms, model_provider, model_name, created_at FROM tool_audit_logs ORDER BY created_at").all(),
    security_events: runtime.db.query<Record<string, unknown>>("SELECT event_type, severity, source, description, payload_redacted_json, created_at FROM security_events ORDER BY created_at").all(),
  });
}

function exportGuidanceLoopStates(runtime: AppRuntime): Array<Record<string, unknown>> {
  const sessions = runtime.db.query<{ session_id: string }>(
    "SELECT DISTINCT session_id FROM tutor_agent_states ORDER BY session_id",
  ).all();
  return sessions.map((row) => ({
    session_id: row.session_id,
    ...deriveGuidanceLoopState(runtime, { sessionId: row.session_id }),
  }));
}

function exportTutorAgentFrontiers(runtime: AppRuntime): Array<Record<string, unknown>> {
  return runtime.db.query<{ session_id: string; turn_id: string | null; frontier_json: string; created_at: string }>(
    "SELECT session_id, turn_id, frontier_json, created_at FROM tutor_agent_frontier_snapshots ORDER BY created_at",
  ).all().map((row) => {
    const frontier = parseJsonRecord(row.frontier_json);
    return {
      session_id: row.session_id,
      turn_id: row.turn_id,
      schema_version: frontier.schema_version,
      status: frontier.status,
      current_concept_id: frontier.current_concept_id,
      allowed_action_kinds: boundedStringArray(frontier.allowed_action_kinds),
      allowed_practice_concept_ids: boundedStringArray(frontier.allowed_practice_concept_ids),
      allowed_next_concept_ids: boundedStringArray(frontier.allowed_next_concept_ids),
      blocked_concept_ids: boundedStringArray(frontier.blocked_concept_ids),
      selection_reason: frontier.selection_reason,
      catalog_identity: frontier.catalog_identity,
      created_at: row.created_at,
    };
  });
}

function exportPracticeOutcomes(runtime: AppRuntime): Array<Record<string, unknown>> {
  return runtime.db.query<{ session_id: string; turn_id: string | null; agent_action_id: string | null; outcome_json: string; created_at: string }>(
    "SELECT session_id, turn_id, agent_action_id, outcome_json, created_at FROM session_practice_outcomes ORDER BY created_at",
  ).all().map((row) => {
    const outcome = parseJsonRecord(row.outcome_json);
    return {
      session_id: row.session_id,
      turn_id: row.turn_id,
      agent_action_id: row.agent_action_id ?? outcome.agent_action_id ?? null,
      kind: outcome.kind,
      reason: outcome.reason,
      target: outcome.target,
      evidence: outcome.evidence,
      created_at: row.created_at,
    };
  });
}

function exportPracticeContracts(runtime: AppRuntime): Array<Record<string, unknown>> {
  return runtime.db.query<Record<string, unknown>>(
    `SELECT id, session_id, turn_id, tutor_agent_action_id, concept_ids_json, title, prompt_md,
            expected_behavior, visible_examples_json, acceptance_checklist_json, allowed_solution_shape,
            review_rubric, difficulty, progress_eligible, status, created_at, updated_at
     FROM practice_contracts
     ORDER BY created_at`,
  ).all();
}

function exportAgentPracticeReviews(runtime: AppRuntime): Array<Record<string, unknown>> {
  return runtime.db.query<Record<string, unknown>>(
    `SELECT id, practice_contract_id, session_id, turn_id, submitted_code_hash, review_status,
            confidence, evidence_refs_json, learner_facing_summary, progress_effect,
            progress_reason, created_at
     FROM agent_practice_reviews
     ORDER BY created_at`,
  ).all();
}

function parseJsonRecord(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function boundedStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).slice(0, 20) : [];
}

export function deleteLocalLearningData(runtime: AppRuntime, input: { confirm?: string }): { deleted: { sessions: number; learning_events: number; exercise_attempts: number; project_submissions: number } } {
  if (input.confirm !== "DELETE_LOCAL_LEARNING_DATA") {
    throw new AppError("VALIDATION_ERROR", "Deletion requires explicit confirmation");
  }
  const counts = {
    sessions: count(runtime, "agent_sessions"),
    learning_events: count(runtime, "learning_events"),
    exercise_attempts: count(runtime, "exercise_attempts"),
    project_submissions: count(runtime, "project_step_submissions"),
  };
  const now = nowIso();
  runtime.db.transaction(() => {
    runtime.db.query("UPDATE tool_audit_logs SET session_id = NULL, turn_id = NULL").run();
    runtime.db.query("UPDATE security_events SET session_id = NULL").run();
    runtime.db.query("DELETE FROM tool_evidence").run();
    runtime.db.query("DELETE FROM agent_practice_reviews").run();
    runtime.db.query("DELETE FROM practice_contracts").run();
    runtime.db.query("DELETE FROM session_practice_outcomes").run();
    runtime.db.query("DELETE FROM tutor_agent_frontier_snapshots").run();
    runtime.db.query("DELETE FROM tutor_agent_actions").run();
    runtime.db.query("DELETE FROM tutor_agent_states").run();
    runtime.db.query("DELETE FROM model_context_compactions").run();
    runtime.db.query("DELETE FROM project_step_submissions").run();
    runtime.db.query("DELETE FROM project_steps").run();
    runtime.db.query("DELETE FROM project_plans").run();
    runtime.db.query("DELETE FROM exercise_attempts").run();
    runtime.db.query("DELETE FROM generated_exercise_evaluators").run();
    runtime.db.query("DELETE FROM generated_exercises").run();
    runtime.db.query("DELETE FROM exercises WHERE status = 'generated_private'").run();
    runtime.db.query("DELETE FROM diagnostic_attempts").run();
    runtime.db.query("DELETE FROM generated_items").run();
    runtime.db.query("DELETE FROM diagnostic_concept_state").run();
    runtime.db.query("DELETE FROM diagnostic_sessions").run();
    runtime.db.query("DELETE FROM diagnostic_questions WHERE version = 'agent-designed'").run();
    runtime.db.query("DELETE FROM recommendations").run();
    runtime.db.query("DELETE FROM learning_events").run();
    runtime.db.query("DELETE FROM session_sse_events").run();
    runtime.db.query("DELETE FROM session_messages").run();
    runtime.db.query("DELETE FROM context_traces").run();
    runtime.db.query("DELETE FROM intent_routes").run();
    runtime.db.query("DELETE FROM session_turns").run();
    runtime.db.query("DELETE FROM agent_sessions").run();
    runtime.db.query("DELETE FROM concept_mastery").run();
    runtime.db.query(
      "INSERT INTO local_profile(id, display_name, profile_json, created_at, updated_at) VALUES ('local', NULL, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET display_name = NULL, profile_json = excluded.profile_json, updated_at = excluded.updated_at",
    ).run([JSON.stringify({
      profile_summary: "Python 课程学习者，尚未完成首次诊断。",
      current_level: "未诊断",
      current_goal: null,
    }), now, now]);
    runtime.db.query(
      "INSERT INTO security_events(id, session_id, event_type, severity, source, description, payload_redacted_json, created_at) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)",
    ).run([createId("ev"), "local_data_deleted", "medium", "privacy", "Local learning data was deleted; anonymized audit summaries retained", "{}", now]);
  });
  rmSync(join(runtime.config.appDataDir, "pi-sessions"), { recursive: true, force: true });
  return { deleted: counts };
}

export function createEncryptedDatabaseBackup(runtime: AppRuntime, input: { passphrase?: string }): {
  backup_id: string;
  encrypted: true;
  bytes: number;
  created_at: string;
  file_path: string;
} {
  if (!input.passphrase || input.passphrase.length < 8) {
    throw new AppError("VALIDATION_ERROR", "Backup passphrase must be at least 8 characters");
  }
  if (runtime.config.dbPath === ":memory:") {
    throw new AppError("VALIDATION_ERROR", "File-backed database is required for encrypted backups");
  }
  const integrity = runtime.db.query<{ integrity_check: string }>("PRAGMA integrity_check").get();
  if (integrity?.integrity_check !== "ok") {
    throw new AppError("DATABASE_INTEGRITY_ERROR", "SQLite integrity check failed", 500);
  }

  const backupId = `backup_${createId("ev").slice(3)}`;
  const createdAt = nowIso();
  const backupDir = join(runtime.config.appDataDir, "backups");
  mkdirSync(backupDir, { recursive: true });
  const plainPath = join(backupDir, `${backupId}.sqlite`);
  const encryptedPath = join(backupDir, `${backupId}.sqlite.enc`);
  runtime.db.exec(`VACUUM INTO '${plainPath.replaceAll("'", "''")}'`);
  try {
    const plain = readFileSync(plainPath);
    const encrypted = encryptBackup(plain, input.passphrase);
    writeFileSync(encryptedPath, encrypted);
    return {
      backup_id: backupId,
      encrypted: true,
      bytes: encrypted.length,
      created_at: createdAt,
      file_path: encryptedPath,
    };
  } finally {
    rmSync(plainPath, { force: true });
  }
}

function count(runtime: AppRuntime, table: string): number {
  return runtime.db.query<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count ?? 0;
}

function encryptBackup(plain: Buffer, passphrase: string): Buffer {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = pbkdf2Sync(passphrase, salt, 120_000, 32, "sha256");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from("CMABK1\n", "utf8"), salt, iv, tag, ciphertext]);
}

function sanitizeExport<T extends LocalDataExport>(value: T): T {
  return sanitizeExportValue(value) as T;
}

function sanitizeExportValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactText(value, 2_000_000);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeExportValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeExportValue(item)]),
    );
  }
  return value;
}
