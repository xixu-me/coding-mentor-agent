import { describe, expect, it } from "vitest";
import { createSession, postMessage } from "../src/server/services.js";
import { executeToolThroughGate } from "../src/server/tool-gate.js";
import { okEnvelope } from "../src/tools/envelope.js";
import { recordLearningEvent } from "../src/tools/progress-tools.js";
import { createTestRuntime } from "./utils/runtime.js";

describe("tool call gate", () => {
  it("blocks tools outside the current intent route group and records evidence", async () => {
    const runtime = await createTestRuntime();
    const session = createSession(runtime, { resume: false });
    const turn = await postMessage(runtime, session.session_id, { message: "解释 for 循环", attachments: [] });

    const result = await executeToolThroughGate(runtime, {
      sessionId: session.session_id,
      turnId: turn.turn_id,
      toolName: "run_python",
      params: { code: "print('blocked')" },
      invoke: async () => {
        throw new Error("blocked tool must not execute");
      },
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("TOOL_NOT_ALLOWED");
    const evidence = runtime.db.query<{ tool_name: string; result_code: string; redacted: number }>(
      "SELECT tool_name, result_code, redacted FROM tool_evidence WHERE turn_id = ? ORDER BY created_at DESC LIMIT 1",
    ).get([turn.turn_id]);
    expect(evidence).toMatchObject({ tool_name: "run_python", result_code: "blocked_capability", redacted: 1 });
    const event = runtime.db.query<{ event_type: string; severity: string }>(
      "SELECT event_type, severity FROM security_events WHERE session_id = ? ORDER BY created_at DESC LIMIT 1",
    ).get([session.session_id]);
    expect(event).toMatchObject({ event_type: "tool_call_blocked", severity: "medium" });
  });

  it("records compact redacted evidence for allowed tools", async () => {
    const runtime = await createTestRuntime();
    const result = await executeToolThroughGate(runtime, {
      sessionId: null,
      turnId: null,
      allowedToolGroup: "debugging_tools",
      toolName: "run_python",
      params: { code: "print('ok')" },
      invoke: async () => okEnvelope("run_python", Date.now(), {
        status: "passed",
        exit_code: 0,
        stdout: "ok\n",
        stderr: "",
        duration_ms: 1,
        truncated: false,
      }, "passed"),
    });

    expect(result.ok).toBe(true);
    const evidence = runtime.db.query<{ tool_name: string; result_code: string; summary_json: string; redacted: number; schema_version: string }>(
      "SELECT tool_name, result_code, summary_json, redacted, schema_version FROM tool_evidence ORDER BY created_at DESC LIMIT 1",
    ).get();
    expect(evidence).toMatchObject({ tool_name: "run_python", result_code: "allowed_success", redacted: 1 });
    expect(evidence?.schema_version).toBe("tool_evidence.v2");
    expect(JSON.parse(evidence?.summary_json ?? "{}").policy).toMatchObject({
      policy_group: "debugging_tools",
      caller: "model",
      result_code: "allowed_success",
    });
    expect(evidence?.summary_json).toContain("ok");
    expect(evidence?.summary_json).not.toContain("progress.db");
  });

  it("blocks direct model pytest while allowing workflow-owned pytest with server test metadata", async () => {
    const runtime = await createTestRuntime();
    const modelResult = await executeToolThroughGate(runtime, {
      sessionId: null,
      turnId: null,
      allowedToolGroup: "exercise_submission_tools",
      toolName: "run_pytest",
      params: { code: "print('x')", public_tests: "def test_x(): pass" },
      invoke: async () => {
        throw new Error("model pytest must not execute");
      },
    });
    expect(modelResult.ok).toBe(false);

    const workflowResult = await executeToolThroughGate(runtime, {
      sessionId: null,
      turnId: null,
      allowedToolGroup: "exercise_submission_tools",
      caller: "workflow",
      toolName: "run_pytest",
      params: {
        code: "print('x')",
        public_tests: "def test_x(): pass",
        policy: { test_source: "exercise_evaluator", evaluator_visibility: "private" },
      },
      invoke: async () => okEnvelope("run_pytest", Date.now(), {
        status: "passed",
        exit_code: 0,
        stdout: "",
        stderr: "",
        duration_ms: 1,
        truncated: false,
        test_results: [],
      }, "passed"),
    });

    expect(workflowResult.ok).toBe(true);
    const evidence = runtime.db.query<{ summary_json: string }>(
      "SELECT summary_json FROM tool_evidence WHERE tool_name = ?",
    ).all(["run_pytest"]);
    const workflowPolicy = evidence
      .map((row) => JSON.parse(row.summary_json).policy)
      .find((policy) => policy.caller === "workflow");
    expect(workflowPolicy).toMatchObject({
      policy_group: "exercise_submission_tools",
      caller: "workflow",
      result_code: "allowed_success",
    });
  });

  it("records stable evidence codes for blocked caller, blocked params, allowed failure, and runtime timeout", async () => {
    const runtime = await createTestRuntime();

    await executeToolThroughGate(runtime, {
      allowedToolGroup: "exercise_submission_tools",
      toolName: "run_pytest",
      params: { code: "print('x')", public_tests: "def test_x(): pass" },
      invoke: async () => {
        throw new Error("model pytest must not execute");
      },
    });
    await executeToolThroughGate(runtime, {
      allowedToolGroup: "debugging_tools",
      toolName: "run_python",
      params: { code: "print('x')", files: [{ path: "../escape.py", content: "" }] },
      invoke: async () => {
        throw new Error("bad params must not execute");
      },
    });
    await executeToolThroughGate(runtime, {
      allowedToolGroup: "debugging_tools",
      toolName: "run_python",
      params: { code: "print('x')" },
      invoke: async () => okEnvelope("run_python", Date.now(), {
        status: "failed",
        exit_code: 1,
        stdout: "",
        stderr: "failed",
        duration_ms: 1,
        truncated: false,
      }, "failed"),
    });
    await executeToolThroughGate(runtime, {
      allowedToolGroup: "debugging_tools",
      toolName: "run_python",
      params: { code: "while True: pass" },
      invoke: async () => okEnvelope("run_python", Date.now(), {
        status: "timeout",
        exit_code: 124,
        stdout: "",
        stderr: "",
        duration_ms: 3000,
        truncated: false,
      }, "timeout"),
    });

    const codes = runtime.db.query<{ tool_name: string; result_code: string; summary_json: string }>(
      "SELECT tool_name, result_code, summary_json FROM tool_evidence ORDER BY created_at ASC",
    ).all();
    expect(codes.map((item) => item.result_code)).toEqual([
      "blocked_caller",
      "blocked_params",
      "allowed_failure",
      "runtime_timeout",
    ]);
    expect(codes.at(-1)?.summary_json).toContain('"code":"OK"');
    expect(codes.at(-1)?.summary_json).toContain('"message":"timeout"');
  });

  it("allows only current-turn concept explanation learning events through kb read tools", async () => {
    const runtime = await createTestRuntime();
    const session = createSession(runtime, { resume: false });
    const firstTurn = await postMessage(runtime, session.session_id, { message: "解释 for 循环", attachments: [] });
    const secondTurn = await postMessage(runtime, session.session_id, { message: "继续解释 for 循环", attachments: [] });

    const wrongTurn = await executeToolThroughGate(runtime, {
      sessionId: session.session_id,
      turnId: secondTurn.turn_id,
      allowedToolGroup: "kb_read_tools",
      toolName: "record_learning_event",
      params: {
        event_type: "concept_explained",
        concept_ids: ["loop"],
        evidence: { session_turn_id: firstTurn.turn_id, summary: "解释 for 循环" },
      },
      invoke: () => recordLearningEvent(runtime, {
        event_type: "concept_explained",
        concept_ids: ["loop"],
        evidence: { session_turn_id: firstTurn.turn_id, summary: "解释 for 循环" },
      }),
    });
    expect(wrongTurn.ok).toBe(false);
    expect(wrongTurn.code).toBe("TOOL_NOT_ALLOWED");

    const correctTurn = await executeToolThroughGate(runtime, {
      sessionId: session.session_id,
      turnId: secondTurn.turn_id,
      allowedToolGroup: "kb_read_tools",
      toolName: "record_learning_event",
      params: {
        event_type: "concept_explained",
        concept_ids: ["loop"],
        evidence: { session_turn_id: secondTurn.turn_id, summary: "解释 for 循环" },
      },
      invoke: () => recordLearningEvent(runtime, {
        event_type: "concept_explained",
        concept_ids: ["loop"],
        evidence: { session_turn_id: secondTurn.turn_id, summary: "解释 for 循环" },
      }),
    });
    expect(correctTurn.ok).toBe(true);

    const event = runtime.db.query<{ turn_id: string; event_type: string }>(
      "SELECT turn_id, event_type FROM learning_events WHERE id = ?",
    ).get([correctTurn.data.event_id]);
    expect(event).toMatchObject({ turn_id: secondTurn.turn_id, event_type: "concept_explained" });
  });
});
