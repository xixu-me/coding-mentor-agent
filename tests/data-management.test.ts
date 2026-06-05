import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.js";
import { createEncryptedDatabaseBackup, deleteLocalLearningData, exportLocalData } from "../src/server/data-management.js";
import { createSession, postMessage } from "../src/server/services.js";
import { createId, nowIso } from "../src/security/ids.js";
import { createTempDir } from "./utils/fs.js";
import { createTestRuntime } from "./utils/runtime.js";

describe("local data export, deletion, and backup", () => {
  it("exports local learning data without internal paths or hidden material", async () => {
    const runtime = await createTestRuntime();
    const session = createSession(runtime, { resume: false });
    await postMessage(runtime, session.session_id, { message: "解释 for 循环", attachments: [] });

    const exported = exportLocalData(runtime);

    expect(exported.profile.profile_summary).toContain("Python");
    expect(exported.sessions.length).toBe(1);
    expect(exported.sessions[0]?.turn_count).toBe(1);
    expect(JSON.stringify(exported)).not.toMatch(/progress\.db|hidden_tests|E:\\|\.app/);
  });

  it("exports tutor messages with colon-newline text without corrupting JSON", async () => {
    const runtime = await createTestRuntime({
      tutor: {
        generate: async () => "```python\n:\n> Python 里，for / if / while / def 后面通常要加冒号。",
      },
    });
    const session = createSession(runtime, { resume: false });

    await postMessage(runtime, session.session_id, { message: "帮我看一个 SyntaxError", attachments: [] });

    const exported = exportLocalData(runtime);
    expect(exported.messages.some((message) => String(message.content_redacted_text).includes("Python 里"))).toBe(true);
  });

  it("deletes learning data while retaining anonymized audit and security summaries", async () => {
    const runtime = await createTestRuntime();
    const session = createSession(runtime, { resume: false });
    await postMessage(runtime, session.session_id, { message: "我要重置学习记录", attachments: [] });
    runtime.db.query(
      "INSERT INTO tool_audit_logs(id, session_id, tool_name, params_hash, params_redacted_json, result_code, result_summary, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run([createId("tool"), session.session_id, "run_python", "hash", "{}", "OK", "passed", 1, nowIso()]);
    runtime.db.query(
      "INSERT INTO security_events(id, session_id, event_type, severity, source, description, payload_redacted_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run([createId("ev"), session.session_id, "input_rejected", "low", "model", "oversized", "{}", nowIso()]);

    const result = deleteLocalLearningData(runtime, { confirm: "DELETE_LOCAL_LEARNING_DATA" });

    expect(result.deleted.sessions).toBe(1);
    expect(runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM session_turns").get()?.count).toBe(0);
    expect(runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM learning_events").get()?.count).toBe(0);
    expect(runtime.db.query<{ session_id: string | null }>("SELECT session_id FROM tool_audit_logs LIMIT 1").get()?.session_id).toBeNull();
    expect(runtime.db.query<{ session_id: string | null }>("SELECT session_id FROM security_events LIMIT 1").get()?.session_id).toBeNull();
    expect(exportLocalData(runtime).profile.profile_summary).toContain("尚未完成首次诊断");
  });

  it("creates an encrypted database backup in the controlled app data directory", async () => {
    const dir = createTempDir();
    const runtime = await createTestRuntime({ appDataDir: dir, dbPath: join(dir, "progress.db") });
    const session = createSession(runtime, { resume: false });
    await postMessage(runtime, session.session_id, { message: "备份前的问题", attachments: [] });

    const backup = createEncryptedDatabaseBackup(runtime, { passphrase: "local test passphrase" });

    expect(backup.encrypted).toBe(true);
    expect(backup.backup_id).toMatch(/^backup_/);
    expect(backup.file_path.startsWith(join(dir, "backups"))).toBe(true);
    expect(existsSync(backup.file_path)).toBe(true);
    const bytes = readFileSync(backup.file_path);
    expect(bytes.length).toBeGreaterThan(64);
    expect(bytes.toString("utf8")).not.toContain("SQLite format");
    expect(bytes.toString("utf8")).not.toContain("备份前的问题");
  });

  it("exposes data management through controlled local API routes", async () => {
    const dir = createTempDir();
    const runtime = await createTestRuntime({ appDataDir: dir, dbPath: join(dir, "progress.db") });
    const session = createSession(runtime, { resume: false });
    await postMessage(runtime, session.session_id, { message: "准备导出", attachments: [] });
    const server = createApp(runtime);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test server port");
    try {
      const base = `http://127.0.0.1:${address.port}`;
      const exported = await fetch(`${base}/api/data/export`);
      expect(exported.status).toBe(200);
      await expect(exported.json()).resolves.toMatchObject({ sessions: [{ turn_count: 1 }] });

      const backup = await fetch(`${base}/api/data/backups`, {
        method: "POST",
        body: JSON.stringify({ passphrase: "local test passphrase" }),
      });
      expect(backup.status).toBe(200);
      const backupJson = await backup.json() as Record<string, unknown>;
      expect(backupJson.encrypted).toBe(true);
      expect(backupJson.file_path).toBeUndefined();

      const deleted = await fetch(`${base}/api/data/delete`, {
        method: "POST",
        body: JSON.stringify({ confirm: "DELETE_LOCAL_LEARNING_DATA" }),
      });
      expect(deleted.status).toBe(200);
      await expect(deleted.json()).resolves.toMatchObject({ deleted: { sessions: 1 } });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
