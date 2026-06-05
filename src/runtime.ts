import type { AppRuntime } from "./types.js";
import { openDatabase } from "./db/database.js";
import { initializeLocalProfile } from "./db/bootstrap.js";
import { loadConfig } from "./config.js";
import { DockerSandboxClient } from "./sandbox/docker-runner.js";
import { InMemoryRateLimiter } from "./security/rate-limit.js";
import { SandboxHttpClient } from "./sandbox/http-client.js";
import { createPiAiTutor } from "./agent/pi-ai-tutor.js";
import { buildCourseSystemPrompt } from "./agent/prompt.js";
import { getEnabledToolNames } from "./tools/registry.js";
import { syncCourseCatalog } from "./server/course-catalog.js";

export function createRuntime(): AppRuntime & { port: number } {
  const config = loadConfig();
  const db = openDatabase({ dbPath: config.dbPath });
  const runtime: AppRuntime & { port: number } = {
    db,
    config,
    port: config.port,
    sandbox: config.sandboxServiceUrl ? new SandboxHttpClient(config.sandboxServiceUrl) : new DockerSandboxClient({
      image: config.sandboxImage,
      timeoutMs: config.sandboxHardLimits.timeoutMs,
      pytestTimeoutMs: config.sandboxHardLimits.pytestTimeoutMs,
      memoryMb: config.sandboxHardLimits.memoryMb,
      outputBytes: config.sandboxHardLimits.outputBytes,
    }),
    rateLimiter: createRateLimiter(),
  };
  if (config.ai) {
    runtime.tutor = createPiAiTutor({
      provider: config.ai.provider,
      model: config.ai.model,
      baseUrl: config.ai.baseUrl,
      apiKey: config.ai.apiKey,
      timeoutMs: config.ai.timeoutMs,
      maxOutputTokens: config.ai.maxOutputTokens,
      reasoning: config.ai.reasoning,
      instructions: buildCourseSystemPrompt({
        courseName: "Python 程序设计",
        kbVersion: config.kbVersion,
        enabledTools: getEnabledToolNames(config.enabledBatch),
      }),
    });
  }
  initializeLocalProfile(runtime);
  syncCourseCatalog(runtime);
  return runtime;
}

function createRateLimiter(env: NodeJS.ProcessEnv = process.env): InMemoryRateLimiter {
  const modelMaxRequests = parseStudentLoopInt(env.STUDENT_LOOP_MODEL_RATE_LIMIT_MAX, "STUDENT_LOOP_MODEL_RATE_LIMIT_MAX", 1, 100);
  const modelWindowMs = parseStudentLoopInt(env.STUDENT_LOOP_MODEL_RATE_LIMIT_WINDOW_MS, "STUDENT_LOOP_MODEL_RATE_LIMIT_WINDOW_MS", 1000, 300_000);
  if (modelMaxRequests === undefined && modelWindowMs === undefined) {
    return new InMemoryRateLimiter();
  }
  return new InMemoryRateLimiter({
    model: {
      maxRequests: modelMaxRequests ?? 12,
      windowMs: modelWindowMs ?? 60_000,
    },
  });
}

function parseStudentLoopInt(value: string | undefined, name: string, minimum: number, maximum: number): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return parsed;
}
