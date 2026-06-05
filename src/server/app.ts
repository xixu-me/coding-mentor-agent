import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import type { AppRuntime } from "../types.js";
import { AppError } from "../types.js";
import { createSession, getProgressSummary, getSessionSnapshot, postMessage, startDiagnosticGuidance } from "./services.js";
import { answerDiagnosticQuestion, assertInitialDiagnosticComplete, getNextDiagnosticQuestion } from "./diagnostics.js";
import { runPython } from "../tools/code-tools.js";
import { auditTool } from "../tools/envelope.js";
import { executeToolThroughGate } from "./tool-gate.js";
import { gradeSubmission } from "../tools/exercise-tools.js";
import { createProjectPlan, getProjectState, submitProjectStep } from "../tools/project-tools.js";
import { requireLocalSession } from "../db/validators.js";
import { assertWithinRateLimit } from "../security/rate-limit.js";
import { createEncryptedDatabaseBackup, deleteLocalLearningData, exportLocalData } from "./data-management.js";
import { getLocalMetrics } from "./metrics.js";
import { requestExplicitPractice } from "./practice-workflow.js";

type Subscriber = { sessionId: string; res: ServerResponse; lastSeq: number };

export function createApp(runtime: AppRuntime) {
  const subscribers = new Set<Subscriber>();
  return createServer(async (req, res) => {
    applySecurityHeaders(res);
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname.startsWith("/api/")) {
        await routeApi(runtime, subscribers, req, res, url);
        return;
      }
      serveStatic(req, res, url.pathname);
    } catch (error) {
      sendError(res, error);
    }
  });
}

async function routeApi(runtime: AppRuntime, subscribers: Set<Subscriber>, req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const method = req.method ?? "GET";
  if (method === "POST" && url.pathname === "/api/sessions") {
    sendJson(res, createSession(runtime, await readJson(req)));
    return;
  }
  const sessionEvents = url.pathname.match(/^\/api\/sessions\/([^/]+)\/events$/);
  if (method === "GET" && sessionEvents) {
    const sessionId = decodeURIComponent(sessionEvents[1]!);
    const afterSeq = resolveSseAfterSeq(runtime, sessionId, req, url);
    openSse(runtime, subscribers, res, sessionId, afterSeq);
    return;
  }
  const sessionSnapshot = url.pathname.match(/^\/api\/sessions\/([^/]+)\/snapshot$/);
  if (method === "GET" && sessionSnapshot) {
    sendJson(res, getSessionSnapshot(runtime, decodeURIComponent(sessionSnapshot[1]!)));
    return;
  }
  const sessionMessages = url.pathname.match(/^\/api\/sessions\/([^/]+)\/messages$/);
  if (method === "POST" && sessionMessages) {
    const sessionId = decodeURIComponent(sessionMessages[1]!);
    const beforeSeq = latestSeq(runtime, sessionId);
    try {
      const result = await postMessage(runtime, sessionId, await readJson(req));
      pushNewEvents(runtime, subscribers, sessionId, beforeSeq);
      sendJson(res, result);
    } catch (error) {
      pushNewEvents(runtime, subscribers, sessionId, beforeSeq);
      throw error;
    }
    return;
  }
  const guidanceStart = url.pathname.match(/^\/api\/sessions\/([^/]+)\/guidance\/start$/);
  if (method === "POST" && guidanceStart) {
    const sessionId = decodeURIComponent(guidanceStart[1]!);
    const beforeSeq = latestSeq(runtime, sessionId);
    try {
      const result = await startDiagnosticGuidance(runtime, sessionId);
      pushNewEvents(runtime, subscribers, sessionId, beforeSeq);
      sendJson(res, result);
    } catch (error) {
      pushNewEvents(runtime, subscribers, sessionId, beforeSeq);
      throw error;
    }
    return;
  }
  const practiceStart = url.pathname.match(/^\/api\/sessions\/([^/]+)\/practice$/);
  if (method === "POST" && practiceStart) {
    const sessionId = decodeURIComponent(practiceStart[1]!);
    requireLocalSession(runtime, sessionId);
    assertWithinRateLimit(runtime, sessionId, "sandbox");
    const body = await readJson(req);
    const outcome = await requestExplicitPractice(runtime, {
      sessionId,
      turnId: null,
      conceptIds: Array.isArray(body.concept_ids) ? body.concept_ids.filter((item: unknown): item is string => typeof item === "string") : undefined,
      source: "ui",
    });
    sendJson(res, outcome);
    return;
  }
  if (method === "POST" && url.pathname === "/api/code/run") {
    const body = await readJson(req);
    const sessionId = String(body.session_id ?? "");
    requireLocalSession(runtime, sessionId);
    assertWithinRateLimit(runtime, sessionId, "sandbox");
    const result = await executeToolThroughGate(runtime, {
      sessionId,
      turnId: null,
      allowedToolGroup: "debugging_tools",
      caller: "api",
      toolName: "run_python",
      params: body,
      invoke: () => runPython(runtime, body),
    });
    auditTool(runtime, { sessionId, toolName: "run_python", params: body, result });
    sendJson(res, { request_id: result.data.request_id ?? "", result: result.data, ok: result.ok, code: result.code, message: result.message });
    return;
  }
  if (method === "GET" && url.pathname === "/api/diagnostics/next") {
    sendJson(res, await getNextDiagnosticQuestion(runtime, getOrCreateLocalSession(runtime)));
    return;
  }
  const diagnosticAnswer = url.pathname.match(/^\/api\/diagnostics\/([^/]+)\/answers$/);
  if (method === "POST" && diagnosticAnswer) {
    sendJson(res, await answerDiagnosticQuestion(runtime, getOrCreateLocalSession(runtime), decodeURIComponent(diagnosticAnswer[1]!), await readJson(req)));
    return;
  }
  if (method === "GET" && url.pathname === "/api/progress/me") {
    const sessionId = getOrCreateLocalSession(runtime);
    sendJson(res, getProgressSummary(runtime, { sessionId }));
    return;
  }
  if (method === "GET" && url.pathname === "/api/metrics") {
    sendJson(res, getLocalMetrics(runtime));
    return;
  }
  if (method === "GET" && url.pathname === "/api/data/export") {
    sendJson(res, exportLocalData(runtime));
    return;
  }
  if (method === "POST" && url.pathname === "/api/data/delete") {
    sendJson(res, deleteLocalLearningData(runtime, await readJson(req)));
    return;
  }
  if (method === "POST" && url.pathname === "/api/data/backups") {
    const backup = createEncryptedDatabaseBackup(runtime, await readJson(req));
    const { file_path: _filePath, ...safeBackup } = backup;
    sendJson(res, safeBackup);
    return;
  }
  if (method === "GET" && url.pathname === "/api/exercises/next") {
    const sessionId = resolveRequestSession(runtime, url.searchParams.get("session_id"));
    assertWithinRateLimit(runtime, sessionId, "sandbox");
    const params = omitSessionId(Object.fromEntries(url.searchParams.entries()));
    const outcome = await requestExplicitPractice(runtime, {
      sessionId,
      turnId: null,
      conceptIds: Array.isArray(params.concept_ids) ? params.concept_ids.filter((item: unknown): item is string => typeof item === "string") : stringParamList(params.concept_ids),
      source: "api",
    });
    sendJson(res, outcome);
    return;
  }
  const exerciseSubmit = url.pathname.match(/^\/api\/exercises\/([^/]+)\/submissions$/);
  if (method === "POST" && exerciseSubmit) {
    const body = await readJson(req);
    const sessionId = resolveRequestSession(runtime, body.session_id);
    assertWithinRateLimit(runtime, sessionId, "sandbox");
    const params = { ...omitSessionId(body), exercise_id: decodeURIComponent(exerciseSubmit[1]!) };
    const graded = await executeToolThroughGate(runtime, {
      sessionId,
      turnId: null,
      allowedToolGroup: "exercise_submission_tools",
      caller: "api",
      toolName: "grade_submission",
      params,
      invoke: () => gradeSubmission(runtime, params, { sessionId, turnId: null }),
    });
    if (!graded.ok) {
      throw new AppError(graded.code, graded.message, 400);
    }
    sendJson(res, graded.data);
    return;
  }
  if (method === "GET" && url.pathname === "/api/projects/current") {
    const state = await getProjectState(runtime, {});
    sendJson(res, state.ok ? state.data : { project_plan: null, steps: [], active_step_id: null });
    return;
  }
  if (method === "POST" && url.pathname === "/api/projects") {
    const body = await readJson(req);
    const sessionId = resolveRequestSession(runtime, body.session_id);
    assertWithinRateLimit(runtime, sessionId, "model");
    const params = omitSessionId(body);
    const created = await executeToolThroughGate(runtime, {
      sessionId,
      turnId: null,
      allowedToolGroup: "project_tools",
      caller: "api",
      toolName: "create_project_plan",
      params,
      invoke: () => createProjectPlan(runtime, params),
    });
    if (!created.ok) {
      throw new AppError(created.code, created.message, 400);
    }
    sendJson(res, created.data);
    return;
  }
  const projectSubmit = url.pathname.match(/^\/api\/projects\/([^/]+)\/steps\/([^/]+)\/submissions$/);
  if (method === "POST" && projectSubmit) {
    const body = await readJson(req);
    const sessionId = resolveRequestSession(runtime, body.session_id);
    assertWithinRateLimit(runtime, sessionId, "sandbox");
    const params = {
      ...omitSessionId(body),
      project_plan_id: decodeURIComponent(projectSubmit[1]!),
      project_step_id: decodeURIComponent(projectSubmit[2]!),
    };
    const submitted = await executeToolThroughGate(runtime, {
      sessionId,
      turnId: null,
      allowedToolGroup: "project_tools",
      caller: "api",
      toolName: "submit_project_step",
      params,
      invoke: () => submitProjectStep(runtime, params, { sessionId, turnId: null }),
    });
    if (!submitted.ok) {
      throw new AppError(submitted.code, submitted.message, 400);
    }
    sendJson(res, submitted.data);
    return;
  }
  throw new AppError("NOT_FOUND", "API route not found", 404);
}

function openSse(runtime: AppRuntime, subscribers: Set<Subscriber>, res: ServerResponse, sessionId: string, afterSeq: number): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  const subscriber = { sessionId, res, lastSeq: afterSeq };
  subscribers.add(subscriber);
  pushNewEvents(runtime, subscribers, sessionId, afterSeq);
  const ping = setInterval(() => res.write(": ping\n\n"), 15000);
  res.on("close", () => {
    clearInterval(ping);
    subscribers.delete(subscriber);
  });
}

function resolveSseAfterSeq(runtime: AppRuntime, sessionId: string, req: IncomingMessage, url: URL): number {
  requireLocalSession(runtime, sessionId);
  const eventCursor = url.searchParams.get("after") ?? headerValue(req.headers["last-event-id"]);
  if (eventCursor) {
    const row = runtime.db.query<{ seq: number }>("SELECT seq FROM session_sse_events WHERE session_id = ? AND id = ?").get([sessionId, eventCursor]);
    return row?.seq ?? 0;
  }
  const legacySeq = Number(url.searchParams.get("after_seq") ?? 0);
  return Number.isFinite(legacySeq) && legacySeq > 0 ? Math.floor(legacySeq) : 0;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function pushNewEvents(runtime: AppRuntime, subscribers: Set<Subscriber>, sessionId: string, afterSeq: number): void {
  const events = runtime.db.query<{ id: string; seq: number; event_type: string; payload_redacted_json: string }>(
    "SELECT id, seq, event_type, payload_redacted_json FROM session_sse_events WHERE session_id = ? AND seq > ? ORDER BY seq ASC",
  ).all([sessionId, afterSeq]);
  for (const subscriber of subscribers) {
    if (subscriber.sessionId !== sessionId) continue;
    for (const event of events.filter((item) => item.seq > subscriber.lastSeq)) {
      subscriber.res.write(`id: ${event.id}\n`);
      subscriber.res.write(`event: ${event.event_type}\n`);
      subscriber.res.write(`data: ${event.payload_redacted_json}\n\n`);
      subscriber.lastSeq = event.seq;
    }
  }
}

function latestSeq(runtime: AppRuntime, sessionId: string): number {
  return runtime.db.query<{ seq: number }>("SELECT COALESCE(MAX(seq), 0) AS seq FROM session_sse_events WHERE session_id = ?").get([sessionId])?.seq ?? 0;
}

function getOrCreateLocalSession(runtime: AppRuntime): string {
  const existing = runtime.db.query<{ id: string }>("SELECT id FROM agent_sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1").get();
  return existing?.id ?? createSession(runtime, { resume: false }).session_id;
}

function resolveRequestSession(runtime: AppRuntime, value: unknown): string {
  const sessionId = typeof value === "string" && value.length > 0 ? value : getOrCreateLocalSession(runtime);
  requireLocalSession(runtime, sessionId);
  return sessionId;
}

function omitSessionId<T extends Record<string, unknown>>(body: T): Omit<T, "session_id"> {
  const { session_id: _sessionId, ...rest } = body;
  return rest;
}

function stringParamList(value: unknown): string[] | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (chunks.length === 0) return {};
  const text = Buffer.concat(chunks).toString("utf8");
  if (text.length > 100_000) throw new AppError("VALIDATION_ERROR", "Request body too large");
  return JSON.parse(text);
}

function sendJson(res: ServerResponse, body: unknown, statusCode = 200): void {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function sendError(res: ServerResponse, error: unknown): void {
  const appError = error instanceof AppError ? error : new AppError("INTERNAL_ERROR", "Local service error", 500);
  sendJson(res, { code: appError.code, message: appError.message, retryable: appError.retryable }, appError.statusCode);
}

function applySecurityHeaders(res: ServerResponse): void {
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-src 'none'; frame-ancestors 'none'; form-action 'self'");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
}

function serveStatic(_req: IncomingMessage, res: ServerResponse, pathname: string): void {
  const dist = join(process.cwd(), "dist", "client");
  const root = existsSync(dist) ? dist : process.cwd();
  const normalized = normalize(pathname === "/" ? "/index.html" : pathname).replace(/^(\.\.[/\\])+/, "");
  const file = join(root, normalized);
  const fallback = join(root, "index.html");
  const target = existsSync(file) && statSync(file).isFile() ? file : fallback;
  const type = contentType(extname(target));
  res.writeHead(200, { "Content-Type": type });
  createReadStream(target).pipe(res);
}

function contentType(ext: string): string {
  return ({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
  } as Record<string, string>)[ext] ?? "application/octet-stream";
}
