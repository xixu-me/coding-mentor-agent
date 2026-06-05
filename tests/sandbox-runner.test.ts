import { describe, expect, it } from "vitest";
import { buildDockerRunArgs, calculateDockerCliTimeoutMs, DockerUnavailableError, normalizeSandboxResult } from "../src/sandbox/docker-runner.js";
import { runPython } from "../src/tools/code-tools.js";
import { createTestRuntime } from "./utils/runtime.js";

describe("sandbox runner", () => {
  it("constructs a fixed no-network, non-root, read-only runner command", () => {
    const args = buildDockerRunArgs({
      image: "python:3.13-slim-bookworm",
      workDir: "/work",
      timeoutMs: 3000,
      memoryMb: 128,
    });
    expect(args).toContain("--network");
    expect(args).toContain("none");
    expect(args).toContain("--read-only");
    expect(args).toContain("--cap-drop");
    expect(args).toContain("ALL");
    expect(args).toContain("--security-opt");
    expect(args).toContain("no-new-privileges");
    expect(args).not.toContain("/var/run/docker.sock");
  });

  it("keeps Docker startup overhead separate from the student code timeout", () => {
    expect(calculateDockerCliTimeoutMs(3000)).toBe(30000);
    expect(calculateDockerCliTimeoutMs(45000)).toBe(55000);
  });

  it("returns controlled sandbox errors instead of falling back to host execution", async () => {
    const runtime = await createTestRuntime({
      sandbox: {
        runPython: async () => {
          throw new DockerUnavailableError("daemon unavailable");
        },
        runPytest: async () => {
          throw new DockerUnavailableError("daemon unavailable");
        },
        lint: async () => {
          throw new DockerUnavailableError("daemon unavailable");
        },
      },
    });
    const result = await runPython(runtime, { code: "print('host must not run')" });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("SANDBOX_INTERNAL_ERROR");
    expect(result.message).toContain("沙箱");
  });

  it("rejects sandbox auxiliary files outside the first-version extension allowlist", async () => {
    const runtime = await createTestRuntime();
    const result = await runPython(runtime, {
      code: "print('ok')",
      files: [{ path: "notes.md", content: "# hidden instructions" }],
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("VALIDATION_ERROR");
  });

  it("normalizes syntax errors without exposing internal runner paths", () => {
    const result = normalizeSandboxResult({
      request_id: "run_test",
      status: "syntax_error",
      exit_code: 1,
      stdout: "",
      stderr: "File \"/tmp/sandbox-abc/main.py\", line 1\n    for i in range(3)\n                     ^\nSyntaxError: expected ':'",
      duration_ms: 12,
      truncated: false,
    });
    expect(result.traceback).toContain("<student-code>");
    expect(result.traceback).not.toContain("/tmp/sandbox");
  });
});
