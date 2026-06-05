import { createHash, randomUUID } from "node:crypto";

const PREFIXES = new Set(["sess", "turn", "msg", "tool", "evt", "run", "diag", "att", "rec", "proj", "step", "psub", "ev", "cmp", "route", "ctx", "gitem", "gex", "evid", "prac", "apr", "ta_state", "ta_action", "ta_frontier"]);

export function createId(prefix: string): string {
  if (!PREFIXES.has(prefix)) {
    throw new Error(`Unknown id prefix: ${prefix}`);
  }
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

export function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function nowIso(): string {
  return new Date().toISOString();
}
