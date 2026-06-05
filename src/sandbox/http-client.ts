import type { SandboxClient, SandboxResult, SandboxRunRequest } from "../types.js";
import { AppError } from "../types.js";
import { nowIso } from "../security/ids.js";

export class SandboxHttpClient implements SandboxClient {
  constructor(private readonly baseUrl: string) {}

  async runPython(request: SandboxRunRequest): Promise<SandboxResult> {
    return this.post("/internal/sandbox/run-python", request);
  }

  async runPytest(request: SandboxRunRequest & { public_tests: string }): Promise<SandboxResult> {
    return this.post("/internal/sandbox/run-pytest", request);
  }

  async lint(request: SandboxRunRequest): Promise<SandboxResult> {
    return this.post("/internal/sandbox/lint", request);
  }

  private async post(path: string, request: SandboxRunRequest & { public_tests?: string }): Promise<SandboxResult> {
    const response = await fetch(new URL(path, this.baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: request.request_id,
        code: request.code,
        stdin: request.stdin,
        files: request.files ?? [],
        public_tests: request.public_tests,
        limits: request.limits ?? {},
        network: false,
        created_at: nowIso(),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AppError(String(body.code ?? "SANDBOX_HTTP_ERROR"), String(body.message ?? "Sandbox service error"), response.status, true);
    }
    return body as SandboxResult;
  }
}
