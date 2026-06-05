import { describe, expect, it } from "vitest";
import { createSandboxService } from "../src/sandbox/service.js";
import { SandboxHttpClient } from "../src/sandbox/http-client.js";
import type { SandboxClient, SandboxRunRequest } from "../src/types.js";

describe("sandbox-service internal HTTP boundary", () => {
  it("runs Python through the internal sandbox HTTP API with network disabled", async () => {
    const seen: Array<SandboxRunRequest & { network?: boolean; created_at?: string }> = [];
    const sandbox: SandboxClient = {
      runPython: async (request) => {
        seen.push(request);
        return { request_id: request.request_id, status: "passed", exit_code: 0, stdout: "ok\n", stderr: "", traceback: "", duration_ms: 1, truncated: false };
      },
      runPytest: async (request) => ({ request_id: request.request_id, status: "passed", exit_code: 0, stdout: "", stderr: "", traceback: "", duration_ms: 1, truncated: false, test_results: [] }),
      lint: async (request) => ({ request_id: request.request_id, status: "passed", exit_code: 0, stdout: "", stderr: "", traceback: "", duration_ms: 1, truncated: false }),
    };
    const server = createSandboxService(sandbox);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing sandbox service port");
    try {
      const client = new SandboxHttpClient(`http://127.0.0.1:${address.port}`);
      const result = await client.runPython({ request_id: "run_http", code: "print('ok')" });
      expect(result.status).toBe("passed");
      expect(seen[0]?.request_id).toBe("run_http");
      expect(seen[0]?.network).toBe(false);
      expect(seen[0]?.created_at).toMatch(/T/);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("rejects internal sandbox requests that try to enable network", async () => {
    const sandbox: SandboxClient = {
      runPython: async () => { throw new Error("network-enabled request must not execute"); },
      runPytest: async () => { throw new Error("network-enabled request must not execute"); },
      lint: async () => { throw new Error("network-enabled request must not execute"); },
    };
    const server = createSandboxService(sandbox);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing sandbox service port");
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/internal/sandbox/run-python`, {
        method: "POST",
        body: JSON.stringify({ request_id: "run_bad", code: "print(1)", files: [], limits: {}, network: true, created_at: new Date().toISOString() }),
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
