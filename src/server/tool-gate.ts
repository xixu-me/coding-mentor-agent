import type { AppRuntime, EnabledBatch, ToolEnvelope, ToolGroupId } from "../types.js";
import { AppError } from "../types.js";
import { createId, nowIso } from "../security/ids.js";
import { recordSecurityEvent } from "../security/rate-limit.js";
import { safeJson } from "../security/redaction.js";
import {
  normalizeToolGroup,
  sanitizePolicyReason,
  sanitizeToolEnvelopeForEvidence,
  type ToolCaller,
  type ToolEvidenceResultCode,
  type ToolPolicyDecision,
  validateToolCallPolicy,
} from "../tools/tool-policy.js";

type ToolGateInput<TData> = {
  sessionId?: string | null;
  turnId?: string | null;
  allowedToolGroup?: ToolGroupId;
  caller?: ToolCaller;
  enabledBatch?: EnabledBatch;
  agentActionId?: string | null;
  toolName: string;
  params: unknown;
  invoke: () => Promise<ToolEnvelope<TData>>;
};

export async function executeToolThroughGate<TData>(runtime: AppRuntime, input: ToolGateInput<TData>): Promise<ToolEnvelope<TData | Record<string, never>>> {
  const started = Date.now();
  const allowedGroup = input.allowedToolGroup ?? loadAllowedToolGroup(runtime, input.turnId);
  const caller = input.caller ?? "model";
  const decision = validateToolCallPolicy({
    group: allowedGroup,
    caller,
    enabledBatch: input.enabledBatch ?? runtime.config.enabledBatch,
    toolName: input.toolName,
    params: input.params,
    context: {
      sessionId: input.sessionId,
      turnId: input.turnId,
    },
  });
  if (!decision.allowed) {
    const blocked = blockedEnvelope(input.toolName, started, `Tool ${input.toolName} is not allowed for ${decision.policyGroup}: ${decision.reason ?? decision.resultCode}`);
    recordToolEvidence(runtime, input, blocked, decision);
    if (input.sessionId && decision.riskLevel !== "low") {
      recordSecurityEvent(runtime, {
        sessionId: input.sessionId,
        eventType: "tool_call_blocked",
        severity: "medium",
        source: "tool_gate",
        description: `Blocked ${input.toolName} for ${decision.policyGroup}`,
        payload: {
          tool_name: input.toolName,
          allowed_tool_group: decision.policyGroup,
          caller,
          result_code: decision.resultCode,
        },
      });
    }
    return blocked;
  }

  const result = await input.invoke();
  const resultCode = classifyAllowedResult(result);
  recordToolEvidence(runtime, input, result, {
    ...decision,
    resultCode,
  });
  return result;
}

function loadAllowedToolGroup(runtime: AppRuntime, turnId?: string | null): ToolGroupId {
  if (!turnId) return "no_tools";
  const row = runtime.db.query<{ allowed_tool_group: string }>(
    "SELECT allowed_tool_group FROM intent_routes WHERE turn_id = ?",
  ).get([turnId]);
  return normalizeToolGroup(row?.allowed_tool_group) as ToolGroupId;
}

function blockedEnvelope(toolName: string, started: number, message: string): ToolEnvelope<Record<string, never>> {
  const error = new AppError("TOOL_NOT_ALLOWED", "当前意图不允许调用这个工具。");
  return {
    ok: false,
    code: error.code,
    message,
    data: {},
    metadata: {
      tool: toolName,
      duration_ms: Date.now() - started,
    },
  };
}

function recordToolEvidence(runtime: AppRuntime, input: Omit<ToolGateInput<unknown>, "invoke">, result: ToolEnvelope, decision: ToolPolicyDecision): void {
  const summary = {
    ...sanitizeToolEnvelopeForEvidence(result) as Record<string, unknown>,
    policy: {
      policy_version: "tool_policy.v1",
      policy_group: decision.policyGroup,
      tool_name: input.toolName,
      capabilities: decision.capabilities,
      caller: decision.caller,
      result_code: decision.resultCode,
      blocked_reason: sanitizePolicyReason(decision.reason),
      route_id: input.turnId ?? null,
      session_id: input.sessionId ?? null,
      agent_action_id: input.agentActionId ?? null,
      risk_level: decision.riskLevel,
    },
  };
  runtime.db.query(
    "INSERT INTO tool_evidence(id, session_id, turn_id, tool_name, tool_call_id, result_code, summary_json, redacted, schema_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run([
    createId("evid"),
    input.sessionId ?? null,
    input.turnId ?? null,
    input.toolName,
    createId("tool"),
    decision.resultCode,
    safeJson(summary),
    1,
    "tool_evidence.v2",
    nowIso(),
  ]);
}

function classifyAllowedResult(result: ToolEnvelope): ToolEvidenceResultCode {
  const status = sandboxStatusFromResult(result);
  if (status === "timeout" || timeoutLike(result.code) || timeoutLike(result.message)) return "runtime_timeout";
  if (status === "sandbox_error") return "runtime_unavailable";
  if (status === "runtime_error" || result.code === "SANDBOX_INTERNAL_ERROR") return "runtime_error";
  if (!result.ok) return "allowed_failure";
  if (!status || status === "passed") return "allowed_success";
  return "allowed_failure";
}

function sandboxStatusFromResult(result: ToolEnvelope): string | undefined {
  const data = result.data;
  if (!data || typeof data !== "object") return undefined;
  const status = (data as { status?: unknown }).status;
  return typeof status === "string" ? status : undefined;
}

function timeoutLike(value: string | undefined): boolean {
  return typeof value === "string" && /timeout|timed out/i.test(value);
}
