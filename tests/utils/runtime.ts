import { join } from "node:path";
import { openDatabase } from "../../src/db/database.js";
import { initializeLocalProfile } from "../../src/db/bootstrap.js";
import { syncCourseCatalog } from "../../src/server/course-catalog.js";
import { InMemoryRateLimiter } from "../../src/security/rate-limit.js";
import type { AppRuntime, RateLimiter, SandboxClient, TutorResponder } from "../../src/types.js";
import { createTempDir } from "./fs.js";

export async function createTestRuntime(options: {
  sandbox?: SandboxClient;
  rateLimiter?: RateLimiter;
  tutor?: TutorResponder | null;
  appDataDir?: string;
  dbPath?: string;
  kbRoot?: string;
  kbVersion?: string;
  skipCatalogSync?: boolean;
} = {}): Promise<AppRuntime> {
  const dir = options.appDataDir ?? createTempDir();
  const dbPath = options.dbPath ?? ":memory:";
  const db = openDatabase({ dbPath });
  const kbRoot = options.kbRoot ?? join(process.cwd(), "kb", "python-course-kb-practical-python", "wiki");
  const runtime: AppRuntime = {
    db,
    config: {
      appDataDir: dir,
      dbPath,
      kbRoot,
      kbVersion: options.kbVersion ?? "kb-test",
      enabledBatch: "full",
      sandboxImage: "python:3.13-slim-bookworm",
      sandboxServiceUrl: undefined,
      sandboxHardLimits: {
        timeoutMs: 3000,
        pytestTimeoutMs: 8000,
        memoryMb: 128,
        outputBytes: 20000,
      },
    },
    sandbox: options.sandbox ?? {
      runPython: async () => ({ status: "sandbox_error", exit_code: 1, stdout: "", stderr: "Docker daemon unavailable in test runtime", traceback: "", duration_ms: 1, truncated: false }),
      runPytest: async () => ({ status: "sandbox_error", exit_code: 1, stdout: "", stderr: "Docker daemon unavailable in test runtime", traceback: "", duration_ms: 1, truncated: false, test_results: [] }),
      lint: async () => ({ status: "sandbox_error", exit_code: 1, stdout: "", stderr: "Docker daemon unavailable in test runtime", traceback: "", duration_ms: 1, truncated: false }),
    },
    rateLimiter: options.rateLimiter ?? new InMemoryRateLimiter(),
    tutor: options.tutor === null ? undefined : options.tutor ?? createDeterministicTestTutor(),
  };
  initializeLocalProfile(runtime);
  if (!options.skipCatalogSync) {
    syncCourseCatalog(runtime);
  }
  return runtime;
}

function createDeterministicTestTutor(): TutorResponder {
  return {
    generate: async (request) => {
      if (request.message.startsWith("你是 Python 课程导师智能体。")) {
        return JSON.stringify(testTutorAgentAction(request));
      }
      if (request.code && /for\s+\w+\s+in\s+range\([^)]*\)\s*\n/u.test(request.code)) {
        return "沙箱运行发现 SyntaxError，位置在第 1 行。下一步先补上冒号，再重新观察运行结果。";
      }
      if (request.code && /items\s*=\s*\[10,\s*20\][\s\S]*items\[2\]/u.test(request.code)) {
        return "沙箱运行发现列表索引越界：这个列表的有效索引是 0 和 1。下一步先把索引改到范围内再试。";
      }
      return "测试导师回复。下一步继续说明你的理解或提交可验证代码。";
    },
  };
}

function testTutorAgentAction(request: Parameters<TutorResponder["generate"]>[0]): Record<string, unknown> {
  const frontier = request.context.bundle?.server_attested_state.learning_frontier;
  const loopState = request.context.bundle?.server_attested_state.guidance_loop_state;
  const conceptId = frontier?.current_concept_id ?? "intro-python";
  const phase = loopState?.phase;
  if (phase === "active_practice") {
    return {
      action_kind: "explain_status",
      concept_id: conceptId,
      rationale: "Test provider keeps the active practice visible until the learner submits.",
      learner_facing_response: "当前已经有练习在进行中。下一步请在练习卡片里提交一次尝试。",
      expected_learning_signal: "learner_continues_active_practice",
    };
  }
  if (phase === "need_guided_question") {
    return {
      action_kind: "ask_guided_question",
      concept_id: conceptId,
      rationale: "Test provider asks the required guided question after explanation.",
      learner_facing_response: "请用一句话说明当前概念解决什么问题，并给一个最小例子。",
      expected_learning_signal: "learner_answers_guided_question",
      requested_backend_action: { type: "none", concept_ids: conceptId ? [conceptId] : [] },
    };
  }
  if (phase === "awaiting_guided_answer") {
    return {
      action_kind: "evaluate_guided_answer",
      concept_id: conceptId,
      rationale: "Test provider records the learner answer as guided-answer evidence.",
      learner_facing_response: "你的理解可以作为当前概念的学习证据。下一步继续做一个小任务。",
      expected_learning_signal: "guided_answer_understood",
      requested_backend_action: { type: "guided_answer_judgement", concept_ids: conceptId ? [conceptId] : [] },
    };
  }
  if (phase === "practice_ready" && request.context.route?.intent === "exercise_request") {
    return {
      action_kind: "request_structured_practice",
      concept_id: conceptId,
      rationale: "Test provider requests structured practice after readiness evidence.",
      learner_facing_response: "现在给你一道当前概念练习。",
      expected_learning_signal: "learner_attempts_structured_practice",
      requested_backend_action: { type: "structured_practice", concept_ids: conceptId ? [conceptId] : [] },
    };
  }
  if (phase === "review_practice_result" && (frontier?.allowed_next_concept_ids?.length ?? 0) > 0) {
    const next = frontier!.allowed_next_concept_ids[0]!;
    return {
      action_kind: "propose_next_concept",
      concept_id: next,
      rationale: "Test provider advances to the server-allowed next concept after practice review.",
      learner_facing_response: `这次练习已通过。下一步进入 ${next}。`,
      expected_learning_signal: "learner_moves_to_next_allowed_concept",
      requested_backend_action: { type: "none", concept_ids: [next] },
    };
  }
  return {
    action_kind: "explain_concept",
    concept_id: conceptId,
    rationale: "Test provider explains the server-selected current concept.",
    learner_facing_response: "我们从学习起点开始。先看当前概念解决什么问题，再做一个最小例子。",
    expected_learning_signal: "learner_can_restate_current_concept",
    requested_backend_action: { type: "none", concept_ids: conceptId ? [conceptId] : [] },
  };
}
