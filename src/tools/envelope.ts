import type { ToolEnvelope } from "../types.js";
import { AppError } from "../types.js";
import { nowIso, stableHash, createId } from "../security/ids.js";
import { redactText, safeJson, summarizeText } from "../security/redaction.js";
import type { AppRuntime } from "../types.js";

export function toEnvelope<TData>(input: ToolEnvelope<TData>): ToolEnvelope<TData> {
  return input;
}

export function okEnvelope<TData>(tool: string, startedAt: number, data: TData, message = "OK", metadata: Record<string, unknown> = {}): ToolEnvelope<TData> {
  return {
    ok: true,
    code: "OK",
    message,
    data,
    metadata: {
      tool,
      duration_ms: Date.now() - startedAt,
      ...metadata,
    },
  };
}

export function errorEnvelope<TData = Record<string, never>>(tool: string, startedAt: number, error: unknown, data = {} as TData): ToolEnvelope<TData> {
  if (error instanceof AppError) {
    return {
      ok: false,
      code: error.code,
      message: error.message,
      data,
      metadata: { tool, duration_ms: Date.now() - startedAt },
    };
  }
  return {
    ok: false,
    code: "SANDBOX_INTERNAL_ERROR",
    message: "沙箱或本地服务暂时不可用，请稍后重试。",
    data,
    metadata: { tool, duration_ms: Date.now() - startedAt },
  };
}

export function auditTool(runtime: AppRuntime, args: {
  sessionId?: string;
  turnId?: string;
  toolName: string;
  params: unknown;
  result: ToolEnvelope;
}): void {
  runtime.db.query(
    "INSERT INTO tool_audit_logs(id, session_id, turn_id, tool_name, params_hash, params_redacted_json, result_code, result_summary, duration_ms, model_provider, model_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run([
    createId("tool"),
    args.sessionId ?? null,
    args.turnId ?? null,
    args.toolName,
    stableHash(args.params),
    safeJson(args.params),
    args.result.code,
    summarizeText(args.result.message || JSON.stringify(args.result.data), 500),
    args.result.metadata.duration_ms,
    "local",
    "rule-tutor",
    nowIso(),
  ]);
}

export function summarizeEnvelopeForStudent(envelope: ToolEnvelope): string {
  if (!envelope.ok) {
    return redactText(envelope.message, 500);
  }
  const dataText = typeof envelope.data === "string" ? envelope.data : JSON.stringify(envelope.data);
  return redactText(dataText, 700);
}
