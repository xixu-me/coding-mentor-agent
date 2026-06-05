import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AiApi, AiReasoning, AppConfig, EnabledBatch } from "./types.js";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig & { port: number; dbPath: string } {
  if (env === process.env) {
    loadEnvFile(env, resolve(process.cwd(), ".env"));
    loadEnvFile(env, resolve(process.cwd(), ".env.local"));
  }
  const appDataDir = resolve(env.APP_DATA_DIR ?? join(process.cwd(), ".app"));
  mkdirSync(appDataDir, { recursive: true });
  const enabledBatch = parseBatch(env.ENABLED_BATCH ?? "full");
  const ai = parseAiConfig(env);
  return {
    appDataDir,
    dbPath: resolve(env.PROGRESS_DB_PATH ?? join(appDataDir, "progress.db")),
    kbRoot: resolve(env.COURSE_KB_ROOT ?? join(process.cwd(), "kb", "python-course-kb-practical-python", "wiki")),
    kbVersion: env.COURSE_KB_VERSION ?? "kb-local",
    enabledBatch,
    ...(ai ? { ai } : {}),
    sandboxImage: env.SANDBOX_IMAGE ?? "coding-mentor-python-runner:0.1.0",
    sandboxServiceUrl: env.SANDBOX_SERVICE_URL,
    sandboxHardLimits: {
      timeoutMs: Number(env.SANDBOX_TIMEOUT_MS ?? 3000),
      pytestTimeoutMs: Number(env.SANDBOX_PYTEST_TIMEOUT_MS ?? 8000),
      memoryMb: Number(env.SANDBOX_MEMORY_MB ?? 128),
      outputBytes: Number(env.SANDBOX_OUTPUT_BYTES ?? 20000),
    },
    port: Number(env.PORT ?? 3000),
  };
}

export function loadEnvFile(env: NodeJS.ProcessEnv, path: string): void {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key) || env[key] !== undefined) continue;
    env[key] = unquoteEnvValue(line.slice(separator + 1).trim());
  }
}

function unquoteEnvValue(value: string): string {
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function parseAiConfig(env: NodeJS.ProcessEnv): AppConfig["ai"] | undefined {
  const legacyResponses = env.LLM_PROVIDER === "responses";
  const provider = env.AI_PROVIDER ?? (legacyResponses ? "openai" : undefined);
  const apiKey = env.AI_API_KEY ?? env.LLM_API_KEY;
  if (!provider || !apiKey) {
    return undefined;
  }
  const baseUrl = env.AI_BASE_URL ?? env.LLM_RESPONSES_ENDPOINT;
  const normalizedBaseUrl = baseUrl ? normalizeHttpsBaseUrl(baseUrl) : undefined;
  const reasoning = parseReasoning(env.AI_REASONING);
  const api = parseAiApi(env.AI_API);
  return {
    provider,
    ...(api ? { api } : {}),
    ...(normalizedBaseUrl ? { baseUrl: normalizedBaseUrl } : {}),
    model: env.AI_MODEL ?? env.LLM_MODEL ?? "gpt-5.5",
    apiKey,
    timeoutMs: Number(env.AI_TIMEOUT_MS ?? env.LLM_TIMEOUT_MS ?? 30_000),
    maxOutputTokens: Number(env.AI_MAX_OUTPUT_TOKENS ?? env.LLM_MAX_OUTPUT_TOKENS ?? 1200),
    ...(reasoning ? { reasoning } : {}),
  };
}

function normalizeHttpsBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("AI_BASE_URL must use HTTPS");
  }
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/responses\/?$/, "");
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

function parseAiApi(value: string | undefined): AiApi | undefined {
  if (value === "openai-responses") {
    return value;
  }
  return undefined;
}

function parseReasoning(value: string | undefined): AiReasoning | undefined {
  if (value === "minimal" || value === "low" || value === "medium" || value === "high" || value === "xhigh") {
    return value;
  }
  return undefined;
}

function parseBatch(value: string): EnabledBatch {
  if (value === "batch-a" || value === "batch-b" || value === "batch-c" || value === "full") {
    return value;
  }
  return "full";
}
