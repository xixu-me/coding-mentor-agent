import { describe, expect, it } from "vitest";
import { createPiCourseSession } from "../src/agent/pi-session.js";
import { createSession, postMessage } from "../src/server/services.js";
import { createTestRuntime } from "./utils/runtime.js";

describe("Pi SDK session adapter", () => {
  it("creates a course session with extensions disabled and only course tools active", async () => {
    const runtime = await createTestRuntime();
    const created = await createPiCourseSession(runtime) as any;
    try {
      expect(created.extensionsResult.extensions).toEqual([]);
      expect(created.extensionsResult.errors).toEqual([]);
      const customToolNames = created.session._customTools.map((tool: { name: string }) => tool.name).sort();
      expect(customToolNames).toEqual([
        "get_concept_mastery",
        "get_recent_learning_context",
        "get_student_profile",
        "kb_get_page_content",
        "kb_lint_status",
        "kb_overview",
        "kb_read_concept",
        "kb_read_file",
        "kb_read_image",
        "kb_read_summary",
        "kb_search",
      ].sort());
      type ToolSchema = { type?: string; properties?: Record<string, unknown> };
      const schemasByName = new Map<string, ToolSchema>(created.session._customTools.map((tool: { name: string; parameters: ToolSchema }) => [tool.name, tool.parameters]));
      for (const toolName of customToolNames) {
        expect(schemasByName.get(toolName)?.type).toBe("object");
      }
      expect(schemasByName.get("kb_read_file")?.properties).toHaveProperty("path");
      const activeToolNames = [...created.session._allowedToolNames].sort();
      expect(activeToolNames).toEqual(customToolNames);
      expect(activeToolNames).not.toContain("run_python");
      expect(activeToolNames).not.toContain("grade_submission");
      expect(activeToolNames).not.toContain("read");
      expect(activeToolNames).not.toContain("bash");
      expect(activeToolNames).not.toContain("edit");
      expect(activeToolNames).not.toContain("write");
    } finally {
      created.session?.dispose?.();
    }
  });

  it("scopes Pi tools to the routed debugging intent", async () => {
    const runtime = await createTestRuntime();
    const created = await createPiCourseSession(runtime, "debugging_tools") as any;
    try {
      const activeToolNames = [...created.session._allowedToolNames].sort();
      expect(activeToolNames).toContain("run_python");
      expect(activeToolNames).toContain("tag_mistake");
      expect(activeToolNames).not.toContain("update_mastery");
      expect(activeToolNames).not.toContain("run_pytest");
      expect(activeToolNames).not.toContain("grade_submission");
      expect(activeToolNames).not.toContain("create_project_plan");
    } finally {
      created.session?.dispose?.();
    }
  });

  it("attributes Pi custom tool execution to the server-owned session and turn", async () => {
    const runtime = await createTestRuntime({
      sandbox: {
        runPython: async (request) => ({
          request_id: request.request_id,
          status: "passed",
          exit_code: 0,
          stdout: "ok\n",
          stderr: "",
          traceback: "",
          duration_ms: 1,
          truncated: false,
        }),
        runPytest: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", traceback: "", duration_ms: 1, truncated: false, test_results: [] }),
        lint: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", traceback: "", duration_ms: 1, truncated: false }),
      },
    });
    const session = createSession(runtime, { resume: false });
    const turn = await postMessage(runtime, session.session_id, {
      message: "这段代码为什么报错？",
      code: "print('ok')",
      attachments: [],
    });
    const created = await createPiCourseSession(runtime, "debugging_tools", {
      sessionId: session.session_id,
      turnId: turn.turn_id,
    }) as any;
    try {
      const tool = created.session._customTools.find((item: { name: string }) => item.name === "run_python");
      expect(tool).toBeTruthy();
      await tool.execute("tool_fake", {
        session_id: "sess_attacker",
        turn_id: "turn_attacker",
        code: "print('ok')",
      });

      const evidence = runtime.db.query<{ session_id: string; turn_id: string; result_code: string; summary_json: string }>(
        "SELECT session_id, turn_id, result_code, summary_json FROM tool_evidence WHERE tool_name = 'run_python' ORDER BY created_at DESC LIMIT 1",
      ).get();
      expect(evidence).toMatchObject({
        session_id: session.session_id,
        turn_id: turn.turn_id,
        result_code: "allowed_success",
      });
      expect(JSON.parse(evidence?.summary_json ?? "{}").policy).toMatchObject({
        session_id: session.session_id,
        route_id: turn.turn_id,
      });

      const audit = runtime.db.query<{ session_id: string; turn_id: string; tool_name: string }>(
        "SELECT session_id, turn_id, tool_name FROM tool_audit_logs WHERE tool_name = 'run_python' ORDER BY created_at DESC LIMIT 1",
      ).get();
      expect(audit).toMatchObject({
        session_id: session.session_id,
        turn_id: turn.turn_id,
        tool_name: "run_python",
      });
    } finally {
      created.session?.dispose?.();
    }
  });
});
