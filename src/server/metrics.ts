import type { AppRuntime } from "../types.js";

type HistogramSnapshot = {
  count: number;
  avg: number;
  max: number;
};

export type LocalMetrics = {
  agent_turn_latency_ms: HistogramSnapshot;
  tool_call_latency_ms: HistogramSnapshot;
  sandbox_timeout_total: number;
  sandbox_resource_limit_total: number;
  model_error_total: number;
  llm_token_total: number;
  llm_cost_estimate: number;
  rate_limit_rejected_total: number;
  kb_lookup_miss_total: number;
  exercise_pass_rate: number;
  hint_count_avg: number;
  security_event_total: number;
};

export function getLocalMetrics(runtime: AppRuntime): LocalMetrics {
  const turnLatencies = runtime.db.query<{ started_at: string; ended_at: string | null }>(
    "SELECT started_at, ended_at FROM session_turns WHERE ended_at IS NOT NULL",
  ).all().map((row) => Math.max(0, new Date(row.ended_at ?? row.started_at).getTime() - new Date(row.started_at).getTime()));
  const toolLatencies = runtime.db.query<{ duration_ms: number }>("SELECT duration_ms FROM tool_audit_logs").all().map((row) => row.duration_ms);
  const attempts = runtime.db.query<{ status: string; hint_count: number }>("SELECT status, hint_count FROM exercise_attempts").all();
  const passedExercises = attempts.filter((attempt) => attempt.status === "passed").length;

  return {
    agent_turn_latency_ms: histogram(turnLatencies),
    tool_call_latency_ms: histogram(toolLatencies),
    sandbox_timeout_total: countWhere(runtime, "tool_audit_logs", "result_code IN ('timeout', 'TIMEOUT')") + countWhere(runtime, "exercise_attempts", "status = 'timeout'"),
    sandbox_resource_limit_total: countWhere(runtime, "tool_audit_logs", "result_code IN ('resource_limit', 'RESOURCE_LIMIT')"),
    model_error_total: countWhere(runtime, "session_turns", "status = 'error'"),
    llm_token_total: 0,
    llm_cost_estimate: 0,
    rate_limit_rejected_total: countWhere(runtime, "security_events", "event_type = 'rate_limit_exceeded'"),
    kb_lookup_miss_total: countWhere(runtime, "tool_audit_logs", "result_code = 'KB_NOT_FOUND'"),
    exercise_pass_rate: attempts.length === 0 ? 0 : passedExercises / attempts.length,
    hint_count_avg: average(attempts.map((attempt) => attempt.hint_count)),
    security_event_total: countWhere(runtime, "security_events", "1 = 1"),
  };
}

function histogram(values: number[]): HistogramSnapshot {
  return {
    count: values.length,
    avg: average(values),
    max: values.length ? Math.max(...values) : 0,
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function countWhere(runtime: AppRuntime, table: string, where: string): number {
  return runtime.db.query<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`).get()?.count ?? 0;
}
