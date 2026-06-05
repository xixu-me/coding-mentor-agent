import type { AppRuntime, RateLimitAction, RateLimitDecision, RateLimitPolicy, RateLimiter } from "../types.js";
import { AppError } from "../types.js";
import { createId, nowIso } from "./ids.js";
import { safeJson } from "./redaction.js";

const DEFAULT_POLICIES: Record<RateLimitAction, RateLimitPolicy> = {
  model: { maxRequests: 12, windowMs: 60_000 },
  sandbox: { maxRequests: 20, windowMs: 60_000 },
};

export class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, number[]>();
  private readonly policies: Record<RateLimitAction, RateLimitPolicy>;
  private readonly clock: () => number;

  constructor(policies: Partial<Record<RateLimitAction, RateLimitPolicy>> = {}, clock: () => number = () => Date.now()) {
    this.policies = {
      model: policies.model ?? DEFAULT_POLICIES.model,
      sandbox: policies.sandbox ?? DEFAULT_POLICIES.sandbox,
    };
    this.clock = clock;
  }

  check(input: { sessionId: string; action: RateLimitAction; nowMs?: number }): RateLimitDecision {
    const nowMs = input.nowMs ?? this.clock();
    const policy = this.policies[input.action];
    const key = `${input.sessionId}:${input.action}`;
    const cutoff = nowMs - policy.windowMs;
    const retained = (this.buckets.get(key) ?? []).filter((timestamp) => timestamp > cutoff);

    if (retained.length >= policy.maxRequests) {
      const resetAt = retained[0]! + policy.windowMs;
      this.buckets.set(key, retained);
      return {
        allowed: false,
        retryAfterMs: Math.max(1, resetAt - nowMs),
        remaining: 0,
        resetAt,
      };
    }

    retained.push(nowMs);
    this.buckets.set(key, retained);
    return {
      allowed: true,
      retryAfterMs: 0,
      remaining: Math.max(0, policy.maxRequests - retained.length),
      resetAt: retained[0]! + policy.windowMs,
    };
  }
}

export function assertWithinRateLimit(runtime: AppRuntime, sessionId: string, action: RateLimitAction): void {
  const decision = runtime.rateLimiter.check({ sessionId, action });
  if (decision.allowed) return;

  recordSecurityEvent(runtime, {
    sessionId,
    source: action,
    eventType: "rate_limit_exceeded",
    severity: "medium",
    description: `${action} requests exceeded the local session rate limit`,
    payload: {
      retry_after_ms: decision.retryAfterMs,
      reset_at_ms: decision.resetAt,
    },
  });

  const waitSeconds = Math.max(1, Math.ceil(decision.retryAfterMs / 1000));
  throw new AppError("RATE_LIMITED", `请求过于频繁，请等待 ${waitSeconds} 秒后重试。`, 429, true);
}

export function recordSecurityEvent(runtime: AppRuntime, args: {
  sessionId?: string;
  eventType: string;
  severity: "low" | "medium" | "high" | "critical";
  source: string;
  description: string;
  payload?: unknown;
}): void {
  runtime.db.query(
    "INSERT INTO security_events(id, session_id, event_type, severity, source, description, payload_redacted_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run([
    createId("ev"),
    args.sessionId ?? null,
    args.eventType,
    args.severity,
    args.source,
    args.description,
    safeJson(args.payload ?? {}),
    nowIso(),
  ]);
}
