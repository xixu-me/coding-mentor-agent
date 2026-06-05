import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { SandboxClient, SandboxResult, SandboxRunRequest } from "../types.js";
import { AppError } from "../types.js";

type InternalSandboxRequest = SandboxRunRequest & {
  public_tests?: string;
  network?: boolean;
  created_at?: string;
};

export function createSandboxService(sandbox: SandboxClient) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if ((req.method ?? "GET") !== "POST") {
        throw new AppError("NOT_FOUND", "Sandbox route not found", 404);
      }
      const body = validateInternalRequest(await readJson(req));
      if (url.pathname === "/internal/sandbox/run-python") {
        sendJson(res, withResourceUsage(await sandbox.runPython(body)));
        return;
      }
      if (url.pathname === "/internal/sandbox/run-pytest") {
        if (!body.public_tests) throw new AppError("VALIDATION_ERROR", "public_tests is required");
        sendJson(res, withResourceUsage(await sandbox.runPytest({ ...body, public_tests: body.public_tests })));
        return;
      }
      if (url.pathname === "/internal/sandbox/lint") {
        sendJson(res, withResourceUsage(await sandbox.lint(body)));
        return;
      }
      throw new AppError("NOT_FOUND", "Sandbox route not found", 404);
    } catch (error) {
      sendError(res, error);
    }
  });
}

function validateInternalRequest(value: unknown): InternalSandboxRequest {
  if (!value || typeof value !== "object") {
    throw new AppError("VALIDATION_ERROR", "Sandbox request body is required");
  }
  const body = value as Record<string, unknown>;
  if (typeof body.request_id !== "string" || typeof body.code !== "string" || typeof body.created_at !== "string") {
    throw new AppError("VALIDATION_ERROR", "request_id, code, and created_at are required");
  }
  if (body.network !== false) {
    throw new AppError("VALIDATION_ERROR", "Sandbox network must be false");
  }
  return {
    request_id: body.request_id,
    code: body.code,
    stdin: typeof body.stdin === "string" ? body.stdin : undefined,
    files: Array.isArray(body.files) ? body.files as Array<{ path: string; content: string }> : [],
    public_tests: typeof body.public_tests === "string" ? body.public_tests : undefined,
    limits: body.limits && typeof body.limits === "object" ? body.limits as SandboxRunRequest["limits"] : {},
    network: false,
    created_at: body.created_at,
  };
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  if (text.length > 100_000) throw new AppError("VALIDATION_ERROR", "Sandbox request body too large");
  return text ? JSON.parse(text) : {};
}

function withResourceUsage(result: SandboxResult): SandboxResult & { resource_usage: Record<string, never> } {
  return { ...result, resource_usage: {} };
}

function sendJson(res: ServerResponse, body: unknown, statusCode = 200): void {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function sendError(res: ServerResponse, error: unknown): void {
  const appError = error instanceof AppError ? error : new AppError("SANDBOX_INTERNAL_ERROR", "Sandbox service error", 500, true);
  sendJson(res, { code: appError.code, message: appError.message, retryable: appError.retryable }, appError.statusCode);
}
