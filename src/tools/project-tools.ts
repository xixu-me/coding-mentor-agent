import type { AppRuntime, ToolEnvelope } from "../types.js";
import { AppError } from "../types.js";
import { requireLocalProjectPlan, requireUnlockedProjectStep } from "../db/validators.js";
import { assertSandboxFilePath } from "../security/path.js";
import { createId, nowIso, stableHash } from "../security/ids.js";
import { redactText, summarizeText } from "../security/redaction.js";
import { errorEnvelope, okEnvelope } from "./envelope.js";
import { assertValid, ProjectPlanParams, ProjectStateParams, RecommendProjectNextStepParams, RecordProjectProgressParams, ReviewProjectCodeParams, SubmitProjectStepParams } from "./schemas.js";
import { runPytest } from "./code-tools.js";
import { executeToolThroughGate } from "../server/tool-gate.js";

type ToolRunContext = {
  sessionId?: string | null;
  turnId?: string | null;
};

export async function createProjectPlan(runtime: AppRuntime, params: unknown): Promise<ToolEnvelope<{ project_plan_id: string; active_step_id: string }>> {
  const started = Date.now();
  try {
    assertValid<{ project_goal: string; preferred_difficulty?: number }>(ProjectPlanParams, params);
    throw new AppError("PROJECT_CONTENT_UNAVAILABLE", "当前 KB 没有声明可验证的项目元数据或项目生成策略，无法创建项目。", 503, true);
  } catch (error) {
    return errorEnvelope("create_project_plan", started, error, { project_plan_id: "", active_step_id: "" });
  }
}

export async function getProjectState(runtime: AppRuntime, params: unknown): Promise<ToolEnvelope<{
  project_plan: { id: string; title: string; status: string; summary: string };
  steps: Array<{ id: string; order: number; title: string; status: string; acceptance_criteria: string[] }>;
  active_step_id?: string;
}>> {
  const started = Date.now();
  try {
    const input = assertValid<{ project_plan_id?: string }>(ProjectStateParams, params);
    const plan = input.project_plan_id
      ? runtime.db.query<{ id: string; title: string; status: string; summary: string | null }>("SELECT id, title, status, summary FROM project_plans WHERE id = ?").get([input.project_plan_id])
      : runtime.db.query<{ id: string; title: string; status: string; summary: string | null }>("SELECT id, title, status, summary FROM project_plans WHERE status = 'active' ORDER BY created_at DESC LIMIT 1").get();
    if (!plan) {
      throw new Error("No project plan exists");
    }
    const steps = runtime.db.query<{ id: string; step_order: number; title: string; status: string; acceptance_criteria_json: string }>(
      "SELECT id, step_order, title, status, acceptance_criteria_json FROM project_steps WHERE project_plan_id = ? ORDER BY step_order ASC",
    ).all([plan.id]);
    const activeStepId = steps.find((step) => step.status === "active")?.id;
    const data = {
      project_plan: { id: plan.id, title: plan.title, status: plan.status, summary: plan.summary ?? "" },
      steps: steps.map((step) => ({
        id: step.id,
        order: step.step_order,
        title: step.title,
        status: step.status,
        acceptance_criteria: (step.status === "pending" ? JSON.parse(step.acceptance_criteria_json).slice(0, 1) : JSON.parse(step.acceptance_criteria_json)) as string[],
      })),
      ...(activeStepId ? { active_step_id: activeStepId } : {}),
    };
    return okEnvelope("get_project_state", started, data);
  } catch (error) {
    return errorEnvelope("get_project_state", started, error);
  }
}

export async function submitProjectStep(runtime: AppRuntime, params: unknown, context: ToolRunContext = {}): Promise<ToolEnvelope<{
  submission_id: string;
  status: "passed" | "needs_revision" | "error";
  review_summary: { passed: boolean; message: string; concept_ids: string[] };
  next_action: string;
}>> {
  const started = Date.now();
  try {
    const input = assertValid<{ project_plan_id: string; project_step_id: string; code: string; files?: Array<{ path: string; content: string }> }>(SubmitProjectStepParams, params);
    requireLocalProjectPlan(runtime, input.project_plan_id);
    requireUnlockedProjectStep(runtime, input.project_plan_id, input.project_step_id);
    for (const file of input.files ?? []) assertSandboxFilePath(file.path);
    const step = runtime.db.query<{ concept_ids_json: string; title: string; step_order: number }>(
      "SELECT concept_ids_json, title, step_order FROM project_steps WHERE id = ? AND project_plan_id = ?",
    ).get([input.project_step_id, input.project_plan_id]);
    const publicTests = loadProjectPublicTests(step?.step_order ?? 1);
    const sandbox = await executeToolThroughGate(runtime, {
      sessionId: context.sessionId ?? null,
      turnId: context.turnId ?? null,
      allowedToolGroup: "project_tools",
      caller: "workflow",
      toolName: "run_pytest",
      params: {
        code: input.code,
        public_tests: publicTests,
        policy: { test_source: "project_step_definition", evaluator_visibility: "public" },
      },
      invoke: () => runPytest(runtime, {
        code: input.code,
        public_tests: publicTests,
      }),
    });
    const passed = sandbox.ok && sandbox.data.status === "passed";
    const submissionId = createId("psub");
    const review = {
      passed,
      message: passed ? "当前步骤的公开模块测试通过，可以继续下一步。" : "当前代码还需要修改；先确保能运行并满足当前步骤验收标准。",
      concept_ids: step ? JSON.parse(step.concept_ids_json) as string[] : [],
    };
    const now = nowIso();
    runtime.db.transaction(() => {
      runtime.db.query(
        "INSERT INTO project_step_submissions(id, project_plan_id, project_step_id, session_id, turn_id, code_hash, code_snapshot, status, review_summary_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run([
        submissionId,
        input.project_plan_id,
        input.project_step_id,
        context.sessionId ?? null,
        context.turnId ?? null,
        stableHash(input.code),
        input.code,
        passed ? "passed" : "needs_revision",
        JSON.stringify(review),
        now,
      ]);
      runtime.db.query("UPDATE project_steps SET latest_submission_id = ?, status = ?, updated_at = ? WHERE id = ? AND project_plan_id = ?").run([
        submissionId,
        passed ? "passed" : "active",
        now,
        input.project_step_id,
        input.project_plan_id,
      ]);
      if (passed) {
        const next = runtime.db.query<{ id: string }>(
          "SELECT id FROM project_steps WHERE project_plan_id = ? AND status = 'pending' ORDER BY step_order ASC LIMIT 1",
        ).get([input.project_plan_id]);
        if (next) {
          runtime.db.query("UPDATE project_steps SET status = 'active', updated_at = ? WHERE id = ? AND project_plan_id = ?").run([now, next.id, input.project_plan_id]);
        }
      }
    });
    return okEnvelope("submit_project_step", started, {
      submission_id: submissionId,
      status: passed ? "passed" : "needs_revision",
      review_summary: review,
      next_action: passed ? "进入下一个项目步骤。" : "先补齐当前步骤的条件判断和输出。",
    });
  } catch (error) {
    return errorEnvelope("submit_project_step", started, error, {
      submission_id: "",
      status: "error",
      review_summary: { passed: false, message: "", concept_ids: [] },
      next_action: "",
    });
  }
}

function loadProjectPublicTests(_stepOrder: number): string {
  throw new AppError("PROJECT_CONTENT_UNAVAILABLE", "当前项目步骤没有 KB 声明的公开测试，无法评阅项目提交。", 503, true);
}

export async function recommendProjectNextStep(runtime: AppRuntime, params: unknown): Promise<ToolEnvelope<{ step_id: string; reason: string }>> {
  const started = Date.now();
  try {
    const input = assertValid<{ project_plan_id: string }>(RecommendProjectNextStepParams, params);
    requireLocalProjectPlan(runtime, input.project_plan_id);
    const state = await getProjectState(runtime, input);
    const active = state.data.steps?.find((step) => step.status === "active");
    return okEnvelope("recommend_project_next_step", started, { step_id: active?.id ?? "", reason: "继续当前已解锁项目步骤。" });
  } catch (error) {
    return errorEnvelope("recommend_project_next_step", started, error, { step_id: "", reason: "" });
  }
}

export async function reviewProjectCode(runtime: AppRuntime, params: unknown): Promise<ToolEnvelope<{ message: string; passed: boolean; code_excerpt: string }>> {
  const started = Date.now();
  try {
    const input = assertValid<{ project_plan_id: string; project_step_id: string; submission_id: string }>(ReviewProjectCodeParams, params);
    requireProjectStepBelongs(runtime, input.project_plan_id, input.project_step_id);
    const submission = runtime.db.query<{ review_summary_json: string; code_snapshot: string | null; status: string }>(
      "SELECT review_summary_json, code_snapshot, status FROM project_step_submissions WHERE id = ? AND project_plan_id = ? AND project_step_id = ?",
    ).get([input.submission_id, input.project_plan_id, input.project_step_id]);
    if (!submission) {
      throw new AppError("FORBIDDEN", "Project submission does not belong to this step", 403);
    }
    const review = JSON.parse(submission.review_summary_json) as { passed?: boolean; message?: string };
    return okEnvelope("review_project_code", started, {
      message: summarizeText(review.message ?? "项目提交已记录。", 600),
      passed: Boolean(review.passed),
      code_excerpt: redactText(submission.code_snapshot ?? "", 1200),
    });
  } catch (error) {
    return errorEnvelope("review_project_code", started, error, { message: "", passed: false, code_excerpt: "" });
  }
}

export async function recordProjectProgress(runtime: AppRuntime, params: unknown): Promise<ToolEnvelope<{ recorded: boolean; event_id: string }>> {
  const started = Date.now();
  try {
    const input = assertValid<{ project_plan_id: string; project_step_id: string; submission_id?: string; status: "started" | "submitted" | "passed" | "needs_revision"; summary: string }>(RecordProjectProgressParams, params);
    const step = requireProjectStepBelongs(runtime, input.project_plan_id, input.project_step_id);
    if (input.submission_id) {
      const submission = runtime.db.query<{ id: string }>(
        "SELECT id FROM project_step_submissions WHERE id = ? AND project_plan_id = ? AND project_step_id = ?",
      ).get([input.submission_id, input.project_plan_id, input.project_step_id]);
      if (!submission) {
        throw new AppError("FORBIDDEN", "Project submission does not belong to this step", 403);
      }
    }
    const eventId = createId("ev");
    const eventType = input.status === "passed" ? "project_step_completed" : "project_step_started";
    const payload = {
      project_plan_id: input.project_plan_id,
      project_step_id: input.project_step_id,
      submission_id: input.submission_id ?? null,
      status: input.status,
      summary: input.summary,
    };
    runtime.db.query(
      "INSERT OR IGNORE INTO learning_events(id, event_type, concept_ids_json, payload_json, evidence_json, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run([
      eventId,
      eventType,
      step.concept_ids_json,
      JSON.stringify(payload),
      JSON.stringify({ source: "record_project_progress" }),
      stableHash({ tool: "record_project_progress", ...payload }),
      nowIso(),
    ]);
    return okEnvelope("record_project_progress", started, { recorded: true, event_id: eventId });
  } catch (error) {
    return errorEnvelope("record_project_progress", started, error, { recorded: false, event_id: "" });
  }
}

function requireProjectStepBelongs(runtime: AppRuntime, projectPlanId: string, projectStepId: string): { concept_ids_json: string; status: string } {
  requireLocalProjectPlan(runtime, projectPlanId);
  const row = runtime.db.query<{ concept_ids_json: string; status: string }>(
    "SELECT concept_ids_json, status FROM project_steps WHERE project_plan_id = ? AND id = ?",
  ).get([projectPlanId, projectStepId]);
  if (!row) {
    throw new AppError("FORBIDDEN", "Project step does not belong to this plan", 403);
  }
  return row;
}
