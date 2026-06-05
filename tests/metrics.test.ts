import { describe, expect, it } from "vitest";
import { getLocalMetrics } from "../src/server/metrics.js";
import { createSession, postMessage } from "../src/server/services.js";
import { auditTool } from "../src/tools/envelope.js";
import { recordSecurityEvent } from "../src/security/rate-limit.js";
import { createId, nowIso } from "../src/security/ids.js";
import { createTestRuntime } from "./utils/runtime.js";

describe("local observability metrics", () => {
  it("collects the required MVP counters and gauges from local state", async () => {
    const runtime = await createTestRuntime({
      sandbox: {
        runPython: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", traceback: "", duration_ms: 1, truncated: false }),
        runPytest: async (request) => {
          if (request.code.includes("BROKEN_GENERATED_SOLUTION")) {
            return { status: "failed", exit_code: 1, stdout: "", stderr: "wrong output", traceback: "", duration_ms: 10, truncated: false, test_results: [] };
          }
          if (request.code.includes("range(1, n + 1)") || request.code.includes("n + 1")) {
            return { status: "passed", exit_code: 0, stdout: "", stderr: "", traceback: "", duration_ms: 10, truncated: false, test_results: [] };
          }
          return { status: "timeout", exit_code: 124, stdout: "", stderr: "timeout", traceback: "", duration_ms: 3000, truncated: false, test_results: [] };
        },
        lint: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", traceback: "", duration_ms: 1, truncated: false }),
      },
    });
    const session = createSession(runtime, { resume: false });
    await postMessage(runtime, session.session_id, { message: "先建立一次 turn", attachments: [] });
    auditTool(runtime, {
      sessionId: session.session_id,
      toolName: "run_python",
      params: { code: "while True: pass" },
      result: { ok: true, code: "timeout", message: "timeout", data: {}, metadata: { tool: "run_python", duration_ms: 3000 } },
    });
    recordSecurityEvent(runtime, {
      sessionId: session.session_id,
      eventType: "rate_limit_exceeded",
      severity: "medium",
      source: "model",
      description: "rate limited",
    });
    const exerciseId = createId("gex");
    const attemptId = createId("att");
    const now = nowIso();
    runtime.db.query("INSERT INTO exercises(id, title, difficulty, concept_ids_json, prompt_md, public_tests, hidden_tests_ref, status, version, created_at, updated_at) VALUES (?, '测试指标练习', 1, '[]', '测试指标提示', NULL, NULL, 'published', 'test', ?, ?)").run([
      exerciseId,
      now,
      now,
    ]);
    runtime.db.query("INSERT INTO exercise_attempts(id, exercise_id, code_hash, code_snapshot, status, score, hint_count, result_summary_json, mistake_tag_ids_json, created_at) VALUES (?, ?, 'fixture', 'print(1)', 'timeout', 0, 1, '{}', '[]', ?)").run([
      attemptId,
      exerciseId,
      now,
    ]);

    const metrics = getLocalMetrics(runtime);

    expect(metrics.agent_turn_latency_ms.count).toBeGreaterThan(0);
    expect(metrics.tool_call_latency_ms.count).toBeGreaterThan(0);
    expect(metrics.sandbox_timeout_total).toBeGreaterThan(0);
    expect(metrics.rate_limit_rejected_total).toBe(1);
    expect(metrics.security_event_total).toBe(1);
    expect(metrics.exercise_pass_rate).toBeGreaterThanOrEqual(0);
    expect(metrics.hint_count_avg).toBeGreaterThanOrEqual(0);
    expect(metrics.llm_token_total).toBe(0);
    expect(metrics.llm_cost_estimate).toBe(0);
  });
});
