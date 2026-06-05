import type { AgentPracticeProgressUpdateOutcome, AgentPracticeReviewConfidence, AgentPracticeReviewStatus, AppRuntime, DiagnosticFeedback, EvidenceSummary, GuidanceLoopState, LearningProgressDecision, ModelRequestContext, PracticeExerciseArtifact, PracticeOutcome, PracticeSubmissionMetadata, SandboxResult, StudentIntent, ToolEnvelope } from "../types.js";
import { AppError } from "../types.js";
import { requireLocalSession } from "../db/validators.js";
import { createId, nowIso } from "../security/ids.js";
import { redactText, summarizeText } from "../security/redaction.js";
import { assertWithinRateLimit, recordSecurityEvent } from "../security/rate-limit.js";
import { persistTurnContextRecords, prepareTurnModelContext } from "./context-management.js";
import { runPython } from "../tools/code-tools.js";
import {
  loadAgentPracticeReviewSummariesForTurns,
  loadActivePracticeContractSummary,
  loadLatestAgentPracticeReviewSummary,
  recordAgentReview,
  requestLearningProgressUpdate,
  runStudentCode,
} from "../tools/agentic-practice-tools.js";
import { executeToolThroughGate } from "./tool-gate.js";
import { assertInitialDiagnosticComplete, getDiagnosticProgressSummary } from "./diagnostics.js";
import type { AdaptiveDiagnosticProgress } from "./diagnostic-strategy.js";
import { assertCatalogAvailable, getActiveCatalogConcepts, getCatalogConceptById, getCatalogProgressPolicyInputMap, getCatalogUnits } from "./course-catalog.js";
import { conceptProgressFromProjection, PROGRESS_POLICY } from "./progress-policy.js";
import { rankProgressRecommendations } from "./recommendations.js";
import { deriveLearningProgressDecision } from "./learning-progress-decision.js";
import { attachProgressEvidenceToReview, loadLatestProgressEvidenceSummary, loadProgressEvidenceSummariesForTurns } from "./progress-evidence.js";
import { deriveLearningFrontier } from "./learning-frontier.js";
import { deriveGuidanceLoopState } from "./guidance-loop-state.js";
import { buildPracticeOutcomeMessage, loadLatestPracticeOutcome, requestExplicitPractice } from "./practice-workflow.js";
import { recordTutorAgentSafetyRejection, runTutorAgentTurn } from "./tutor-agent-runtime.js";
import { createOrResumeTutorAgentState, loadLatestTutorAgentFrontier, loadRecentTutorAgentActions, loadTutorAgentActionsForTurns, loadTutorAgentState } from "./tutor-agent-store.js";

const MAX_MODEL_MESSAGE_CHARS = 4000;
const MAX_MODEL_CODE_CHARS = 20000;

type PostMessageBody = {
  message: string;
  code?: string;
  attachments?: unknown[];
  practice_submission?: PracticeSubmissionMetadata;
};

export function createSession(runtime: AppRuntime, body: { resume?: boolean }): { session_id: string; stream_url: string } {
  if (body.resume) {
    const existing = runtime.db.query<{ id: string }>("SELECT id FROM agent_sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1").get();
    if (existing) {
      return { session_id: existing.id, stream_url: `/api/sessions/${existing.id}/events` };
    }
  }
  const id = createId("sess");
  const now = nowIso();
  runtime.db.query("INSERT INTO agent_sessions(id, pi_session_id, pi_session_file, status, started_at) VALUES (?, ?, ?, ?, ?)").run([
    id,
    `pi_${id}`,
    `.app/sessions/${id}.jsonl`,
    "active",
    now,
  ]);
  return { session_id: id, stream_url: `/api/sessions/${id}/events` };
}

export async function postMessage(runtime: AppRuntime, sessionId: string, body: PostMessageBody): Promise<{ accepted: true; turn_id: string }> {
  requireLocalSession(runtime, sessionId);
  const practiceSubmission = normalizePracticeSubmission(runtime, sessionId, body.practice_submission);
  const effectiveBody: PostMessageBody = practiceSubmission
    ? {
      ...body,
      message: buildPracticeSubmissionMessage(runtime, sessionId, practiceSubmission),
      code: practiceSubmission.code,
      practice_submission: practiceSubmission,
    }
    : body;
  validateModelInput(runtime, sessionId, effectiveBody);
  if (effectiveBody.attachments && effectiveBody.attachments.length > 0) {
    throw new AppError("VALIDATION_ERROR", "Attachments are disabled for MVP until upload safety rules are implemented");
  }
  const now = nowIso();
  const turnId = createId("turn");
  const preparedContext = prepareTurnModelContext(runtime, sessionId, turnId, {
    message: effectiveBody.message,
    code: effectiveBody.code,
    practice_submission: practiceSubmission,
  });
  if (preparedContext.route?.intent !== "safety_refusal") {
    assertWithinRateLimit(runtime, sessionId, "model");
  }
  const userMessageId = createId("msg");
  const assistantMessageId = createId("msg");
  runtime.db.transaction(() => {
    runtime.db.query("INSERT INTO session_turns(id, session_id, status, user_message_summary, code_ref, assistant_message_summary, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run([
      turnId,
      sessionId,
      "streaming",
      summarizeText(effectiveBody.message, 500),
      effectiveBody.code ? `code_${turnId}` : null,
      null,
      now,
      null,
    ]);
    persistTurnContextRecords(runtime, sessionId, turnId, preparedContext, now);
    runtime.db.query("INSERT INTO session_messages(id, session_id, turn_id, message_id, role, content_redacted_text, code_ref, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run([
      createId("msg"),
      sessionId,
      turnId,
      userMessageId,
      "user",
      redactText(effectiveBody.message, 4000),
      effectiveBody.code ? `code_${turnId}` : null,
      now,
    ]);
  });

  let assistantText: string;
  try {
    assistantText = await generateTurnAssistantText(runtime, sessionId, turnId, effectiveBody, preparedContext.context);
  } catch (error) {
    const appError = finalizeTurnError(runtime, sessionId, turnId, error);
    throw appError;
  }

  runtime.db.transaction(() => {
    runtime.db.query("UPDATE session_turns SET status = ?, assistant_message_summary = ?, ended_at = ? WHERE id = ? AND session_id = ?").run([
      "done",
      summarizeText(assistantText, 500),
      nowIso(),
      turnId,
      sessionId,
    ]);
    runtime.db.query("INSERT INTO session_messages(id, session_id, turn_id, message_id, role, content_redacted_text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run([
      createId("msg"),
      sessionId,
      turnId,
      assistantMessageId,
      "assistant",
      assistantText,
      now,
    ]);
    appendSseEvent(runtime, sessionId, turnId, "message_delta", { type: "message_delta", turn_id: turnId, message_id: assistantMessageId, seq: 1, delta: assistantText });
    appendSseEvent(runtime, sessionId, turnId, "done", { type: "done", turn_id: turnId });
  });
  return { accepted: true, turn_id: turnId };
}

function finalizeTurnError(runtime: AppRuntime, sessionId: string, turnId: string, error: unknown): AppError {
  const appError = toAppError(error);
  const now = nowIso();
  runtime.db.transaction(() => {
    runtime.db.query("UPDATE session_turns SET status = ?, assistant_message_summary = ?, ended_at = ? WHERE id = ? AND session_id = ?").run([
      "error",
      summarizeText(`${appError.code}: ${appError.message}`, 500),
      now,
      turnId,
      sessionId,
    ]);
    appendSseEvent(runtime, sessionId, turnId, "error", {
      type: "error",
      turn_id: turnId,
      code: appError.code,
      message: appError.message,
      retryable: appError.retryable,
    });
    appendSseEvent(runtime, sessionId, turnId, "done", { type: "done", turn_id: turnId });
  });
  return appError;
}

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new AppError("INTERNAL_ERROR", "本地服务处理本轮消息时失败。", 500, true);
}

export async function startDiagnosticGuidance(runtime: AppRuntime, sessionId: string): Promise<{ accepted: true; turn_id: string }> {
  requireLocalSession(runtime, sessionId);
  assertInitialDiagnosticComplete(runtime, sessionId);
  const decision = deriveLearningProgressDecision(runtime, { sessionId });
  if (decision.diagnostic_state !== "completed") {
    throw new AppError("DIAGNOSTIC_REQUIRED", "完成当前目录下的初始测评后才能开始导师指导。", 409);
  }
  const frontier = deriveLearningFrontier(runtime, { sessionId, decision });
  createOrResumeTutorAgentState(runtime, {
    sessionId,
    diagnosticSessionId: frontier.diagnostic_session_id,
    currentConceptId: frontier.current_concept_id,
    status: frontier.status,
  });
  return postMessage(runtime, sessionId, {
    message: "开始导师指导。",
    attachments: [],
  });
}

async function collectDebugEvidence(
  runtime: AppRuntime,
  sessionId: string,
  turnId: string,
  code: string | undefined,
  context: ModelRequestContext,
): Promise<ToolEnvelope<SandboxResult> | undefined> {
  if (context.route?.intent !== "debugging" || !code?.trim()) return undefined;
  const result = await executeToolThroughGate(runtime, {
    sessionId,
    turnId,
    toolName: "run_python",
    params: { code },
    invoke: () => runPython(runtime, { code }),
  }) as ToolEnvelope<SandboxResult>;
  const evidence = runtime.db.query<{ id: string; tool_name: string; result_code: string; summary_json: string; redacted: number }>(
    "SELECT id, tool_name, result_code, summary_json, redacted FROM tool_evidence WHERE turn_id = ? ORDER BY created_at DESC LIMIT 1",
  ).get([turnId]);
  if (evidence && context.bundle) {
    const toolSummary: EvidenceSummary = {
      evidence_id: evidence.id,
      tool_name: evidence.tool_name,
      result_code: evidence.result_code,
      summary: evidence.summary_json,
      redacted: evidence.redacted === 1,
    };
    context.bundle.untrusted_inputs.tool_outputs = [toolSummary];
    const trace = runtime.db.query<{ included_sources_json: string }>(
      "SELECT included_sources_json FROM context_traces WHERE turn_id = ?",
    ).get([turnId]);
    const included = new Set<string>(parseStringArray(trace?.included_sources_json));
    included.add("tool_evidence");
    runtime.db.query("UPDATE context_traces SET included_sources_json = ? WHERE turn_id = ?").run([
      JSON.stringify([...included]),
      turnId,
    ]);
  }
  return result;
}

function composeDebugResponseFromEvidence(evidence: ToolEnvelope<SandboxResult>, code?: string): string {
  const result = evidence.data;
  if (result.status === "syntax_error") {
    const line = extractLineNumber(result.traceback ?? result.stderr) ?? 1;
    const detail = summarizeText(result.stderr || result.traceback || "语法错误", 180);
    return `沙箱运行结果是 SyntaxError，位置在第 ${line} 行附近。证据：${detail}。先检查这一行的语句末尾，例如 for、while、if、def 这类语句通常需要英文冒号 ':'，补完后再运行一次。`;
  }
  if (result.status === "runtime_error") {
    const line = extractLineNumber(result.traceback ?? result.stderr);
    const location = line ? `第 ${line} 行附近` : "报错位置";
    const detail = summarizeText(result.stderr || result.traceback || "运行时错误", 220);
    return `沙箱复现了运行时错误，${location}需要先看。证据：${detail}。下一步先定位第一条 traceback 指向的表达式，再检查变量类型和值。`;
  }
  if (result.status === "timeout") {
    return "沙箱运行超时，没有得到正常输出。优先检查循环退出条件是否会变化，尤其是 while 条件和循环体里的状态更新。";
  }
  if (result.status === "passed") {
    const output = summarizeText(result.stdout || "没有输出", 160);
    return `沙箱没有复现报错，程序正常结束。观察到的输出是：${output}。如果你预期不同，把题目要求或样例输出贴出来，我们再对比逻辑差异。`;
  }
  if (result.status === "sandbox_error") {
    const staticObservation = staticDebugObservation(code);
    return `沙箱暂时不可用，代码没有实际执行。${staticObservation ?? "只能先做静态检查；优先看第一处语法结构、缩进和变量名是否一致。"}`;
  }
  const detail = summarizeText(result.stderr || result.traceback || evidence.message, 220);
  return `沙箱返回 ${result.status}，代码没有得到可确认的通过结果。证据：${detail}。先处理这条证据对应的第一处问题，再继续看后续逻辑。`;
}

function extractLineNumber(text: string): number | undefined {
  const match = text.match(/line\s+(\d+)/i);
  return match ? Number(match[1]) : undefined;
}

function staticDebugObservation(code?: string): string | undefined {
  const firstLine = code?.split(/\r?\n/)[0] ?? "";
  if (/^\s*(for|while|if|elif|else|def|class)\b/.test(firstLine) && !firstLine.trimEnd().endsWith(":")) {
    return "静态观察：第 1 行像是控制流或定义语句，但末尾缺少英文冒号 ':'。先补冒号，再重新运行验证。";
  }
  const listMatch = code?.match(/^\s*([A-Za-z_]\w*)\s*=\s*\[([^\]]*)\]/m);
  const accessMatch = code?.match(/print\(\s*([A-Za-z_]\w*)\[(\d+)\]\s*\)/m);
  if (listMatch && accessMatch && listMatch[1] === accessMatch[1]) {
    const items = listMatch[2]!.split(",").map((item) => item.trim()).filter(Boolean);
    const index = Number(accessMatch[2]);
    if (Number.isInteger(index) && index >= items.length) {
      const lastIndex = Math.max(0, items.length - 1);
      return `静态观察：列表有 ${items.length} 个元素，合法索引是 0 到 ${lastIndex}，但代码访问了索引 ${index}。先把索引改到范围内，或在访问前检查列表长度。`;
    }
  }
  return undefined;
}

async function generateAssistantText(
  runtime: AppRuntime,
  sessionId: string,
  turnId: string,
  message: string,
  code: string | undefined,
  context: ModelRequestContext,
): Promise<string> {
  if (context.route?.intent === "safety_refusal") {
    if (shouldRecordTutorAgentSafetyRejection(runtime, sessionId)) {
      recordTutorAgentSafetyRejection(runtime, { sessionId, turnId });
    }
    return composeSafetyRefusalResponse();
  }
  if (!runtime.tutor) {
    throw new AppError("MODEL_UNAVAILABLE", "未配置可用的外部模型，无法生成导师回复。", 503, true);
  }
  try {
    return await runtime.tutor.generate({ message, code, context });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("MODEL_UNAVAILABLE", "外部模型调用失败，无法生成导师回复。", 503, true);
  }
}

async function generateTurnAssistantText(
  runtime: AppRuntime,
  sessionId: string,
  turnId: string,
  body: PostMessageBody,
  context: ModelRequestContext,
): Promise<string> {
  if (body.practice_submission?.kind === "practice_submission") {
    return reviewPracticeSubmissionWithTools(runtime, sessionId, turnId, body.practice_submission, context);
  }
  if (context.route?.intent === "exercise_request") {
    if (shouldUseTutorAgentRuntime(runtime, sessionId, context)) {
      const assistantText = await runTutorAgentTurn(runtime, {
        sessionId,
        turnId,
        message: body.message,
        code: body.code,
        context,
        allowStructuredPractice: true,
        initialActionOnly: false,
      });
      return ensureTutorNextStep(assistantText, "exercise_request");
    }
    const outcome = await requestExplicitPractice(runtime, {
      sessionId,
      turnId,
      conceptIds: context.route.target_concept_ids,
      source: "chat",
    });
    return ensureTutorNextStep(buildPracticeOutcomeMessage(outcome), "exercise_request", outcome);
  }
  if (shouldUseTutorAgentRuntime(runtime, sessionId, context)) {
    const assistantText = await runTutorAgentTurn(runtime, {
      sessionId,
      turnId,
      message: body.message,
      code: body.code,
      context,
      allowStructuredPractice: body.message.trim() !== "开始导师指导。",
      initialActionOnly: body.message.trim() === "开始导师指导。",
    });
    return ensureTutorNextStep(assistantText, context.route?.intent ?? "clarification");
  }
  await collectDebugEvidence(runtime, sessionId, turnId, body.code, context);
  const assistantText = await generateAssistantText(runtime, sessionId, turnId, body.message, body.code, context);
  return ensureTutorNextStep(assistantText, context.route?.intent ?? "clarification");
}

async function reviewPracticeSubmissionWithTools(
  runtime: AppRuntime,
  sessionId: string,
  turnId: string,
  submission: PracticeSubmissionMetadata,
  context: ModelRequestContext,
): Promise<string> {
  const contract = assertActivePracticeSubmission(runtime, sessionId, submission);
  const run = await executeToolThroughGate(runtime, {
    sessionId,
    turnId,
    allowedToolGroup: "agent_practice_review_tools",
    caller: "model",
    toolName: "run_student_code",
    params: {
      practice_contract_id: contract.id,
      code: submission.code,
    },
    invoke: () => runStudentCode(runtime, {
      practice_contract_id: contract.id,
      code: submission.code,
    }, { sessionId, turnId }),
  }) as ToolEnvelope<SandboxResult>;
  const reviewStatus = reviewStatusFromExecution(run);
  const confidence = reviewStatus === "passed" ? "high" : run.data?.status === "sandbox_error" ? "low" : "medium";
  const executionSummary = summarizeExecutionEvidence(run);
  const evidenceResultCode = run.ok && run.data?.status === "passed" ? "allowed_success" : "allowed_failure";
  const review = await executeToolThroughGate(runtime, {
    sessionId,
    turnId,
    allowedToolGroup: "agent_practice_review_tools",
    caller: "model",
    toolName: "record_agent_review",
    params: {
      practice_contract_id: contract.id,
      submitted_code: submission.code,
      review_status: reviewStatus,
      confidence,
      evidence_refs: [{ tool_name: "run_student_code", result_code: evidenceResultCode, summary: executionSummary }],
      learner_facing_summary: learnerReviewSummary(reviewStatus, executionSummary),
    },
    invoke: () => recordAgentReview(runtime, {
      practice_contract_id: contract.id,
      submitted_code: submission.code,
      review_status: reviewStatus,
      confidence,
      evidence_refs: [{ tool_name: "run_student_code", result_code: evidenceResultCode, summary: executionSummary }],
      learner_facing_summary: learnerReviewSummary(reviewStatus, executionSummary),
    }, { sessionId, turnId }),
  }) as ToolEnvelope<{ review: { id: string } }>;
  let progress: ToolEnvelope<AgentPracticeProgressUpdateOutcome> | null = null;
  if (review.ok && review.data.review?.id) {
    progress = await executeToolThroughGate(runtime, {
      sessionId,
      turnId,
      allowedToolGroup: "agent_practice_review_tools",
      caller: "model",
      toolName: "request_learning_progress_update",
      params: { review_id: review.data.review.id },
      invoke: () => requestLearningProgressUpdate(runtime, { review_id: review.data.review.id }, { sessionId, turnId }),
    }) as ToolEnvelope<AgentPracticeProgressUpdateOutcome>;
  }
  const progressEffect = progress?.data.progress_effect ?? "not_recorded";
  const nextStep = reviewStatus === "passed"
    ? "下一步继续发送你的目标；如果学习前沿还没解锁新概念，我会安排同概念的后续小任务。"
    : "下一步先按上面的运行证据改一处，再提交同一个练习。";
  const reviewText = [
    "我已把你的代码作为本次练习提交来评阅。",
    "",
    `评阅过程：调用 run_student_code 运行学生代码；结果摘要：${executionSummary}`,
    `评阅结果：${reviewStatus}，置信度：${confidence}。`,
    `概念证据：${progressEffect === "recorded" ? `已记录${formatRecordedConcepts(runtime, progress?.data.recorded_concept_ids ?? [])}` : "未记录"}${progress?.data.reason ? `（${progress.data.reason}）` : ""}。`,
    `课程总进度仍按整体掌握度计算。`,
    nextStep,
  ].join("\n");
  if (!shouldUseTutorAgentRuntime(runtime, sessionId, context)) return reviewText;
  const tutorText = await runTutorAgentTurn(runtime, {
    sessionId,
    turnId,
    message: buildPracticeReviewTutorMessage(reviewStatus, confidence, executionSummary, progressEffect),
    code: submission.code,
    context,
    allowStructuredPractice: false,
    initialActionOnly: false,
  });
  return `${reviewText}\n\n${tutorText}`;
}

function buildPracticeReviewTutorMessage(
  reviewStatus: AgentPracticeReviewStatus,
  confidence: AgentPracticeReviewConfidence,
  executionSummary: string,
  progressEffect: string,
): string {
  return [
    "练习提交已完成工具评阅，请基于当前 practice_contract、review、tool evidence 和学习前沿决定下一步导师动作。",
    `评阅结果：${reviewStatus}`,
    `置信度：${confidence}`,
    `运行证据摘要：${executionSummary}`,
    `学习进度记录状态：${progressEffect}`,
  ].join("\n");
}

function formatRecordedConcepts(runtime: AppRuntime, conceptIds: string[]): string {
  const labels = conceptIds
    .map((conceptId) => getCatalogConceptById(runtime, conceptId, { includeInactive: true })?.name ?? conceptId)
    .filter(Boolean)
    .slice(0, 5);
  return labels.length > 0 ? `：${labels.join("、")}` : "";
}

function shouldUseTutorAgentRuntime(runtime: AppRuntime, sessionId: string, context: ModelRequestContext): boolean {
  const intent = context.route?.intent;
  if (intent === "safety_refusal" || intent === "debugging" || intent === "diagnostic_answer") {
    return false;
  }
  const decision = deriveLearningProgressDecision(runtime, { sessionId });
  return decision.diagnostic_state === "completed" && decision.handoff_state === "guidance_started";
}

function normalizePracticeSubmission(
  runtime: AppRuntime,
  sessionId: string,
  value: PracticeSubmissionMetadata | undefined,
): PracticeSubmissionMetadata | undefined {
  if (!value) return undefined;
  if (value.kind !== "practice_submission") {
    throw new AppError("VALIDATION_ERROR", "Unsupported submission metadata");
  }
  if (typeof value.practice_contract_id !== "string" || !value.practice_contract_id.trim()) {
    throw new AppError("VALIDATION_ERROR", "Practice contract id is required");
  }
  if (typeof value.code !== "string" || !value.code.trim() || value.code.length > MAX_MODEL_CODE_CHARS) {
    throw new AppError("VALIDATION_ERROR", "练习代码为空或过长，请调整后再提交。");
  }
  const active = loadActivePracticeContractSummary(runtime, sessionId);
  if (!active || active.id !== value.practice_contract_id) {
    throw new AppError("PRACTICE_CONTRACT_NOT_FOUND", "当前练习不存在或已经不是本会话的活动练习。", 409);
  }
  return {
    kind: "practice_submission",
    practice_contract_id: value.practice_contract_id,
    code: value.code,
  };
}

function buildPracticeSubmissionMessage(runtime: AppRuntime, sessionId: string, submission: PracticeSubmissionMetadata): string {
  const contract = assertActivePracticeSubmission(runtime, sessionId, submission);
  return [
    `提交练习：${contract.title}`,
    "",
    "```python",
    submission.code.trimEnd(),
    "```",
  ].join("\n");
}

function assertActivePracticeSubmission(
  runtime: AppRuntime,
  sessionId: string,
  submission: PracticeSubmissionMetadata,
): NonNullable<ReturnType<typeof loadActivePracticeContractSummary>> {
  const active = loadActivePracticeContractSummary(runtime, sessionId);
  if (!active || active.id !== submission.practice_contract_id) {
    throw new AppError("PRACTICE_CONTRACT_NOT_FOUND", "当前练习不存在或已经不是本会话的活动练习。", 409);
  }
  return active;
}

function reviewStatusFromExecution(run: ToolEnvelope<SandboxResult>): "passed" | "partial" | "needs_revision" | "blocked_by_error" {
  if (!run.ok) return "blocked_by_error";
  switch (run.data.status) {
    case "passed":
      return "passed";
    case "syntax_error":
    case "runtime_error":
    case "failed":
      return "needs_revision";
    case "timeout":
    case "resource_limit":
    case "sandbox_error":
      return "blocked_by_error";
    default:
      return "partial";
  }
}

function summarizeExecutionEvidence(run: ToolEnvelope<SandboxResult>): string {
  if (!run.ok) return summarizeText(run.message, 300);
  const stdout = run.data.stdout ? `stdout=${summarizeText(run.data.stdout, 160)}` : "";
  const stderr = run.data.stderr || run.data.traceback ? `stderr=${summarizeText(redactSandboxSourceLines(run.data.stderr || run.data.traceback || ""), 220)}` : "";
  return summarizeText([`status=${run.data.status}`, stdout, stderr].filter(Boolean).join("; "), 500);
}

function redactSandboxSourceLines(value: string): string {
  const output: string[] = [];
  let redactNextSourceLine = false;
  for (const line of value.split(/\r?\n/)) {
    if (/File "<student-code>"/.test(line)) {
      output.push(line);
      redactNextSourceLine = true;
      continue;
    }
    if (redactNextSourceLine && /^\s+\S/.test(line)) {
      output.push("    <student-code-line>");
      redactNextSourceLine = false;
      continue;
    }
    if (/^\s*\^+\s*$/.test(line)) {
      output.push("    <error-position>");
      continue;
    }
    output.push(line);
  }
  return output.join("\n");
}

function learnerReviewSummary(status: "passed" | "partial" | "needs_revision" | "blocked_by_error", evidence: string): string {
  if (status === "passed") return `代码可以运行，运行证据支持通过：${evidence}`;
  if (status === "blocked_by_error") return `本次还不能形成可靠通过结论：${evidence}`;
  return `本次需要修改后再提交：${evidence}`;
}

function practiceExerciseFromContract(contract: NonNullable<ReturnType<typeof loadActivePracticeContractSummary>>): PracticeExerciseArtifact {
  return {
    id: contract.id,
    practice_contract_id: contract.id,
    title: contract.title,
    difficulty: contract.difficulty,
    concept_ids: contract.concept_ids,
    prompt_md: contract.prompt_md,
    starter_code: contract.starter_code,
    expected_behavior: contract.expected_behavior,
    acceptance_checklist: contract.acceptance_checklist,
    samples: contract.visible_examples.map((example) => ({
      stdin: typeof example.stdin === "string" ? example.stdin : "",
      stdout: typeof example.stdout === "string" ? example.stdout : typeof example.code === "string" ? example.code : "",
    })),
    hint_level: 0,
    submission: { endpoint: `/api/sessions/${encodeURIComponent(contract.session_id)}/messages`, enabled: true },
  };
}

function shouldRecordTutorAgentSafetyRejection(runtime: AppRuntime, sessionId: string): boolean {
  const decision = deriveLearningProgressDecision(runtime, { sessionId });
  return decision.diagnostic_state === "completed" && decision.handoff_state === "guidance_started";
}

function composeSafetyRefusalResponse(): string {
  return "我不能执行忽略课程规则、索要内部材料或绕过学习流程的请求。请把问题改成 Python 概念、调试现象或你的思路，我会按课程范围帮助你。";
}

export function ensureTutorNextStep(text: string, intent: StudentIntent, outcome?: PracticeOutcome): string {
  const cleaned = stripIndefinitePendingEnding(text.trim());
  if (hasConcreteNextStep(cleaned)) return cleaned;
  return `${cleaned}\n\n${fallbackNextStep(intent, outcome)}`;
}

function stripIndefinitePendingEnding(text: string): string {
  return text
    .replace(/(?:我会|我现在|正在)?(?:为你)?(?:挑选|生成|准备).{0,18}(?:请稍等|稍等|稍后)[。.!！\s]*$/u, "")
    .replace(/(?:请稍等|稍等一下|稍后给你)[。.!！\s]*$/u, "")
    .trim();
}

function hasConcreteNextStep(text: string): boolean {
  return /(下一步|先|请|可以|继续|点击|完成|提交|选择|运行|检查|告诉我|贴出|重试|开始导师指导|完成初始测评)/u.test(text);
}

function fallbackNextStep(intent: StudentIntent, outcome?: PracticeOutcome): string {
  if (outcome) return outcome.next_step;
  switch (intent) {
    case "concept_explanation":
      return "下一步请用一句话复述这个概念，或贴一小段代码让我帮你判断是否用对。";
    case "progress_query":
      return "下一步请选择一个当前薄弱概念，我会按你的进度继续讲解。";
    case "debugging":
      return "下一步先按上面的证据改一处代码，再运行一次并把新结果发来。";
    case "safety_refusal":
      return "下一步请把请求改成 Python 概念解释、调试现象或课程内练习问题。";
    case "exercise_request":
      return "下一步请完成初始测评或指定一个当前课程概念后再请求练习。";
    default:
      return "下一步请告诉我你想解释概念、检查代码，还是开始一个练习。";
  }
}

function parseStringArray(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function validateModelInput(runtime: AppRuntime, sessionId: string, body: { message: string; code?: string }): void {
  if (typeof body.message !== "string" || body.message.trim().length === 0) {
    throw new AppError("VALIDATION_ERROR", "Message is required");
  }
  if (body.message.length > MAX_MODEL_MESSAGE_CHARS || (body.code?.length ?? 0) > MAX_MODEL_CODE_CHARS) {
    recordSecurityEvent(runtime, {
      sessionId,
      eventType: "input_rejected",
      severity: "low",
      source: "model",
      description: "Rejected oversized model input before generation",
      payload: {
        message_chars: body.message.length,
        code_chars: body.code?.length ?? 0,
      },
    });
    throw new AppError("VALIDATION_ERROR", "输入过长，请缩短问题或代码后再发送。");
  }
}

export function getSessionSnapshot(runtime: AppRuntime, sessionId: string): {
  session_id: string;
  last_event_id: string | null;
  turns: Array<{
    turn_id: string;
    status: string;
    user_message: { text: string; code_ref?: string };
    assistant_messages: Array<{ message_id: string; text: string }>;
    turn_error?: { code: string; message: string; retryable: boolean };
    tool_summaries: Array<{ tool_call_id: string; tool_name: string; ok: boolean; code: string; summary: string }>;
    annotations?: {
      tutor_actions: ReturnType<typeof loadRecentTutorAgentActions>;
      guidance_loop_state?: GuidanceLoopState | null;
      practice_review?: ReturnType<typeof loadLatestAgentPracticeReviewSummary>;
      progress_evidence?: ReturnType<typeof loadLatestProgressEvidenceSummary>;
    };
  }>;
  active_exercise: PracticeExerciseArtifact | null;
  active_practice_outcome: PracticeOutcome | null;
  active_practice_contract: ReturnType<typeof loadActivePracticeContractSummary>;
  latest_agent_practice_review: ReturnType<typeof loadLatestAgentPracticeReviewSummary>;
  recent_progress_evidence: ReturnType<typeof loadLatestProgressEvidenceSummary>;
  tutor_agent_state: ReturnType<typeof loadTutorAgentState>;
  guidance_loop_state: GuidanceLoopState | null;
  recent_tutor_agent_actions: ReturnType<typeof loadRecentTutorAgentActions>;
  latest_tutor_agent_frontier: ReturnType<typeof loadLatestTutorAgentFrontier>;
  current_concept_id: string | null;
  active_project_step: null;
} {
  requireLocalSession(runtime, sessionId);
  const turns = runtime.db.query<{ id: string; status: string }>("SELECT id, status FROM session_turns WHERE session_id = ? ORDER BY started_at ASC").all([sessionId]);
  const last = runtime.db.query<{ id: string }>("SELECT id FROM session_sse_events WHERE session_id = ? ORDER BY seq DESC LIMIT 1").get([sessionId]);
  const activePracticeOutcome = loadLatestPracticeOutcome(runtime, sessionId);
  const activePracticeContract = loadActivePracticeContractSummary(runtime, sessionId);
  const latestAgentPracticeReview = loadLatestAgentPracticeReviewSummary(runtime, sessionId, activePracticeContract?.id);
  const recentProgressEvidence = loadLatestProgressEvidenceSummary(runtime, sessionId);
  const tutorAgentState = loadTutorAgentState(runtime, sessionId);
  const recentTutorAgentActions = loadRecentTutorAgentActions(runtime, sessionId, 5);
  const latestTutorAgentFrontier = loadLatestTutorAgentFrontier(runtime, sessionId);
  const guidanceLoopState = tutorAgentState ? deriveGuidanceLoopState(runtime, { sessionId }) : null;
  const activeExercise = resolveActiveSnapshotExercise(activePracticeContract, activePracticeOutcome);
  const turnIds = turns.map((turn) => turn.id);
  const tutorActionsByTurn = loadTutorAgentActionsForTurns(runtime, sessionId, turnIds);
  const progressEvidenceByTurn = loadProgressEvidenceSummariesForTurns(runtime, sessionId, turnIds);
  const reviewsByTurn = loadAgentPracticeReviewSummariesForTurns(runtime, sessionId, turnIds);
  const errorsByTurn = loadTurnErrors(runtime, sessionId, turnIds);
  return {
    session_id: sessionId,
    last_event_id: last?.id ?? null,
    turns: turns.map((turn) => {
      const messages = runtime.db.query<{ message_id: string; role: string; content_redacted_text: string; code_ref: string | null; tool_call_id: string | null; tool_name: string | null }>(
        "SELECT message_id, role, content_redacted_text, code_ref, tool_call_id, tool_name FROM session_messages WHERE session_id = ? AND turn_id = ? ORDER BY created_at ASC",
      ).all([sessionId, turn.id]);
      const user = messages.find((message) => message.role === "user");
      const turnProgressEvidence = progressEvidenceByTurn.get(turn.id) ?? null;
      const turnPracticeReview = attachProgressEvidenceToReview(reviewsByTurn.get(turn.id) ?? null, turnProgressEvidence);
      return {
        turn_id: turn.id,
        status: turn.status,
        user_message: { text: user?.content_redacted_text ?? "", code_ref: user?.code_ref ?? undefined },
        assistant_messages: messages.filter((message) => message.role === "assistant").map((message) => ({ message_id: message.message_id, text: message.content_redacted_text })),
        turn_error: errorsByTurn.get(turn.id),
        tool_summaries: messages.filter((message) => message.role === "tool").map((message) => ({
          tool_call_id: message.tool_call_id ?? "",
          tool_name: message.tool_name ?? "",
          ok: true,
          code: "OK",
          summary: message.content_redacted_text,
        })),
        annotations: {
          tutor_actions: tutorActionsByTurn.get(turn.id) ?? [],
          guidance_loop_state: (tutorActionsByTurn.get(turn.id)?.length ?? 0) > 0 ? guidanceLoopState : undefined,
          practice_review: turnPracticeReview,
          progress_evidence: turnProgressEvidence,
        },
      };
    }),
    active_exercise: activeExercise,
    active_practice_outcome: activePracticeOutcome,
    active_practice_contract: activePracticeContract,
    latest_agent_practice_review: attachProgressEvidenceToReview(latestAgentPracticeReview, recentProgressEvidence),
    recent_progress_evidence: recentProgressEvidence,
    tutor_agent_state: tutorAgentState,
    guidance_loop_state: guidanceLoopState,
    recent_tutor_agent_actions: recentTutorAgentActions,
    latest_tutor_agent_frontier: latestTutorAgentFrontier,
    current_concept_id: tutorAgentState?.current_concept_id ?? null,
    active_project_step: null,
  };
}

function resolveActiveSnapshotExercise(
  activePracticeContract: ReturnType<typeof loadActivePracticeContractSummary>,
  activePracticeOutcome: PracticeOutcome | null,
): PracticeExerciseArtifact | null {
  if (activePracticeContract) return practiceExerciseFromContract(activePracticeContract);
  if (activePracticeOutcome?.kind !== "exercise_ready") return null;
  return activePracticeOutcome.exercise.practice_contract_id ? null : activePracticeOutcome.exercise;
}

function loadTurnErrors(
  runtime: AppRuntime,
  sessionId: string,
  turnIds: string[],
): Map<string, { code: string; message: string; retryable: boolean }> {
  const result = new Map<string, { code: string; message: string; retryable: boolean }>();
  if (turnIds.length === 0) return result;
  const placeholders = turnIds.map(() => "?").join(", ");
  const rows = runtime.db.query<{ turn_id: string; payload_redacted_json: string }>(
    `SELECT turn_id, payload_redacted_json
     FROM session_sse_events
     WHERE session_id = ?
       AND event_type = 'error'
       AND turn_id IN (${placeholders})
     ORDER BY seq ASC`,
  ).all([sessionId, ...turnIds]);
  for (const row of rows) {
    const parsed = parseTurnError(row.payload_redacted_json);
    if (parsed) result.set(row.turn_id, parsed);
  }
  return result;
}

function parseTurnError(value: string): { code: string; message: string; retryable: boolean } | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const code = typeof parsed.code === "string" ? parsed.code : null;
    const message = typeof parsed.message === "string" ? parsed.message : null;
    if (!code || !message) return null;
    return { code, message, retryable: parsed.retryable !== false };
  } catch {
    return null;
  }
}

export function getProgressSummary(runtime: AppRuntime, options: { sessionId?: string | null } = {}): {
  profile_summary: string;
  current_level: string;
  current_goal: string | null;
  course_progress_percent: number;
  recent_progress_evidence: LearningProgressDecision["recent_progress_evidence"];
  current_chapter_id: string;
  current_chapter_title: string;
  diagnostic: AdaptiveDiagnosticProgress & { completed: boolean };
  diagnostic_feedback: DiagnosticFeedback | null;
  curriculum: Array<{ id: string; title: string; concept_ids: string[]; mastery_percent: number; status: "completed" | "current" | "upcoming" }>;
  mastery: Array<{ concept_id: string; name: string; mastery_level: number; confidence: number; review_priority: number }>;
  weak_concepts: Array<{ concept_id: string; name: string; reason: string }>;
  recommendations: Array<{ id: string; type: string; target_id: string; reason: string }>;
  progress_decision: LearningProgressDecision;
} {
  const decision = deriveLearningProgressDecision(runtime, { sessionId: options.sessionId });
  const profileRow = runtime.db.query<{ profile_json: string }>("SELECT profile_json FROM local_profile WHERE id = 'local'").get();
  const profile = profileRow ? JSON.parse(profileRow.profile_json) as { profile_summary?: string; current_level?: string; current_goal?: string | null } : {};
  return {
    profile_summary: profile.profile_summary ?? "Python 课程学习者。",
    current_level: decision.current_level ?? "未诊断",
    current_goal: decision.current_goal,
    course_progress_percent: decision.course_progress_percent,
    recent_progress_evidence: decision.recent_progress_evidence,
    current_chapter_id: decision.current_unit.id,
    current_chapter_title: decision.current_unit.title,
    diagnostic: decision.diagnostic as unknown as AdaptiveDiagnosticProgress & { completed: boolean },
    diagnostic_feedback: decision.diagnostic_feedback,
    curriculum: decision.curriculum,
    mastery: decision.mastery,
    weak_concepts: decision.weak_concepts,
    recommendations: decision.recommendation_focus
      .map((item) => ({ id: `${item.type}:${item.target_id}`, type: item.type, target_id: item.target_id, reason: item.reason })),
    progress_decision: decision,
  };
}

function buildDiagnosticFeedback(
  runtime: AppRuntime,
  options: { sessionId?: string | null; diagnostic?: AdaptiveDiagnosticProgress & { completed: boolean } } = {},
): DiagnosticFeedback | null {
  const diagnostic = options.diagnostic ?? getDiagnosticProgressSummary(runtime, { sessionId: options.sessionId });
  if (!diagnostic.completed) return null;
  const session = latestDiagnosticSession(runtime, options.sessionId);
  if (!session || session.status !== "completed") return null;
  const states = loadDiagnosticFeedbackStates(runtime, session.id);
  const profile = readLocalProfile(runtime);
  const learningStart = pickLearningStart(runtime, profile, diagnostic);
  return {
    performance_summary: summarizeDiagnosticPerformance(states),
    mastery_summary: summarizeDiagnosticMastery(states, learningStart),
    learning_start: learningStart,
  };
}

function fallbackDiagnosticFeedback(runtime: AppRuntime, options: { sessionId?: string | null }): DiagnosticFeedback {
  const diagnostic = getDiagnosticProgressSummary(runtime, { sessionId: options.sessionId });
  const profile = readLocalProfile(runtime);
  const learningStart = pickLearningStart(runtime, profile, diagnostic);
  return {
    performance_summary: "已完成初始测评，系统已记录你的答题表现。",
    mastery_summary: "系统已根据测评结果整理当前掌握情况。",
    learning_start: learningStart,
  };
}

function buildGuidanceStartMessage(feedback: DiagnosticFeedback): string {
  return [
    "开始导师指导。",
    "",
    "[初始测评反馈]",
    `测评表现：${feedback.performance_summary}`,
    `掌握情况：${feedback.mastery_summary}`,
    `学习起点：${feedback.learning_start}`,
    "",
    "请根据以上初始测评反馈，从学习起点开始指导我。先解释为什么从这里开始，然后讲第一个小概念。不要在普通聊天文本中直接布置需要提交的代码练习题。",
  ].join("\n");
}

function latestDiagnosticSession(runtime: AppRuntime, sessionId?: string | null): { id: string; status: string } | undefined {
  return sessionId
    ? runtime.db.query<{ id: string; status: string }>(
      "SELECT id, status FROM diagnostic_sessions WHERE session_id = ? ORDER BY started_at DESC LIMIT 1",
    ).get([sessionId])
    : runtime.db.query<{ id: string; status: string }>(
      "SELECT id, status FROM diagnostic_sessions ORDER BY started_at DESC LIMIT 1",
    ).get();
}

type DiagnosticFeedbackState = {
  concept_id: string;
  name: string | null;
  mastery: number;
  confidence: number;
  evidence_count: number;
  band: string;
  conflicting_evidence_count: number;
  catalog_order: number | null;
};

function loadDiagnosticFeedbackStates(runtime: AppRuntime, diagnosticSessionId: string): DiagnosticFeedbackState[] {
  return runtime.db.query<DiagnosticFeedbackState>(
    `SELECT
       s.concept_id,
       c.name,
       s.mastery,
       s.confidence,
       s.evidence_count,
       s.band,
       s.conflicting_evidence_count,
       c.order_index AS catalog_order
     FROM diagnostic_concept_state s
     LEFT JOIN concepts c ON c.id = s.concept_id
     WHERE s.diagnostic_session_id = ?
     ORDER BY COALESCE(c.order_index, 9999) ASC, s.concept_id ASC`,
  ).all([diagnosticSessionId]);
}

function readLocalProfile(runtime: AppRuntime): Record<string, unknown> {
  const profileRow = runtime.db.query<{ profile_json: string }>("SELECT profile_json FROM local_profile WHERE id = 'local'").get();
  if (!profileRow) return {};
  try {
    const parsed = JSON.parse(profileRow.profile_json);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function pickLearningStart(runtime: AppRuntime, profile: Record<string, unknown>, diagnostic: AdaptiveDiagnosticProgress): string {
  const profilePlacementLabel = stringValue(profile.diagnostic_placement_label);
  if (profilePlacementLabel) return profilePlacementLabel;
  if (diagnostic.leading_start_label) return diagnostic.leading_start_label;
  const profilePlacementId = stringValue(profile.diagnostic_placement_concept_id);
  const profilePlacementName = profilePlacementId
    ? runtime.db.query<{ name: string }>("SELECT name FROM concepts WHERE id = ?").get([profilePlacementId])?.name
    : undefined;
  if (profilePlacementName) return profilePlacementName;
  const currentLevel = stringValue(profile.current_level);
  return currentLevel && currentLevel !== "未诊断" ? currentLevel : "当前学习起点";
}

function summarizeDiagnosticPerformance(states: DiagnosticFeedbackState[]): string {
  const assessed = states.filter((state) => state.evidence_count > 0);
  if (assessed.length === 0) return "已完成初始测评，系统已记录你的答题表现。";
  const stable = assessed.filter((state) => state.mastery >= 70 && state.confidence >= 0.7 && state.conflicting_evidence_count === 0);
  const unstable = assessed.filter((state) => state.mastery < 70 || state.band === "weak" || state.band === "learning" || state.conflicting_evidence_count > 0);
  const stableText = labelList(stable);
  const unstableText = labelList(unstable);
  if (stableText && unstableText) return `${stableText}表现较稳定，${unstableText}仍需巩固。`;
  if (stableText) return `${stableText}表现较稳定。`;
  if (unstableText) return `${unstableText}相关题目仍有波动。`;
  return "已完成初始测评，系统已记录你的答题表现。";
}

function summarizeDiagnosticMastery(states: DiagnosticFeedbackState[], learningStart: string): string {
  const assessed = states.filter((state) => state.evidence_count > 0);
  if (assessed.length === 0) return `建议从${learningStart}开始，边学边确认掌握情况。`;
  const ready = assessed.filter((state) => state.mastery >= 70 && state.confidence >= 0.7);
  const needs = assessed.filter((state) => state.mastery < 70 || state.band === "weak" || state.band === "learning");
  const readyText = labelList(ready);
  const needsText = labelList(needs);
  if (readyText && needsText) return `已具备${readyText}基础，建议补齐${needsText}。`;
  if (needsText) return `建议先巩固${needsText}，再继续推进后续内容。`;
  if (readyText) return `已具备${readyText}基础，建议从${learningStart}继续推进。`;
  return `建议从${learningStart}开始，边学边确认掌握情况。`;
}

function labelList(states: DiagnosticFeedbackState[], limit = 3): string {
  return [...new Map(states.map((state) => [state.concept_id, state.name ?? state.concept_id])).values()]
    .slice(0, limit)
    .join("、");
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function buildCurriculumProgress(
  runtime: AppRuntime,
  mastery: Array<{ concept_id: string; mastery_level: number; confidence: number; readiness: number; evidence_count: number }>,
  diagnosticCompleted: boolean,
): Array<{ id: string; title: string; concept_ids: string[]; mastery_percent: number; status: "completed" | "current" | "upcoming" }> {
  const masteryByConcept = new Map(mastery.map((item) => [item.concept_id, item]));
  const policyByConcept = getCatalogProgressPolicyInputMap(runtime);
  const concepts = getActiveCatalogConcepts(runtime);
  const conceptsByUnit = new Map<string, string[]>();
  for (const concept of concepts) {
    const unitId = concept.unit_id ?? "unassigned";
    const list = conceptsByUnit.get(unitId) ?? [];
    list.push(concept.id);
    conceptsByUnit.set(unitId, list);
  }
  const chapters = getCatalogUnits(runtime).map((unit) => {
    const conceptIds = conceptsByUnit.get(unit.id) ?? [];
    const weightedProgress = conceptIds.map((conceptId) => {
      const policy = policyByConcept.get(conceptId);
      return {
        progress: conceptProgressFromProjection(masteryByConcept.get(conceptId)),
        weight: policy?.progress_weight ?? 1,
      };
    });
    const rawMasteryPercent = weightedProgress.length === 0 ? 0 : Math.round(weightedAverage(weightedProgress));
    const prerequisiteCap = prerequisiteReadinessCap(policyByConcept, masteryByConcept, conceptIds);
    const masteryPercent = Math.min(rawMasteryPercent, prerequisiteCap);
    return {
      id: unit.id,
      title: unit.title,
      concept_ids: conceptIds,
      mastery_percent: masteryPercent,
      status: "upcoming" as const,
    };
  });

  if (!diagnosticCompleted) return chapters;

  const nextChapterIndex = chapters.findIndex((chapter) => chapter.mastery_percent < PROGRESS_POLICY.unitCompletionThreshold);
  if (nextChapterIndex === -1) {
    return chapters.map((chapter) => ({ ...chapter, status: "completed" as const }));
  }
  return chapters.map((chapter, index) => ({
    ...chapter,
    status: index < nextChapterIndex ? "completed" : index === nextChapterIndex ? "current" : "upcoming",
  }));
}

function computeCourseProgressPercent(
  curriculum: Array<{ mastery_percent: number }>,
  diagnosticCompleted: boolean,
): number {
  if (!diagnosticCompleted) return 0;
  const chapterProgress = curriculum.length === 0 ? 0 : average(curriculum.map((chapter) => chapter.mastery_percent));
  return Math.max(0, Math.min(100, Math.round(chapterProgress)));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weightedAverage(values: Array<{ progress: number; weight: number }>): number {
  const totalWeight = values.reduce((sum, value) => sum + value.weight, 0);
  if (totalWeight <= 0) return 0;
  return values.reduce((sum, value) => sum + value.progress * value.weight, 0) / totalWeight;
}

function prerequisiteReadinessCap(
  policyByConcept: ReturnType<typeof getCatalogProgressPolicyInputMap>,
  masteryByConcept: Map<string, { mastery_level: number; confidence: number; readiness: number; evidence_count: number }>,
  conceptIds: string[],
): number {
  let cap = 100;
  for (const conceptId of conceptIds) {
    const policy = policyByConcept.get(conceptId);
    for (const prerequisiteId of policy?.prerequisite_ids ?? []) {
      const prerequisite = masteryByConcept.get(prerequisiteId);
      const progress = conceptProgressFromProjection(prerequisite);
      if (progress < PROGRESS_POLICY.readinessThreshold) {
        cap = Math.min(cap, progress);
      }
    }
  }
  return cap;
}

function appendSseEvent(runtime: AppRuntime, sessionId: string, turnId: string, eventType: string, payload: unknown): void {
  const nextSeq = (runtime.db.query<{ seq: number }>("SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM session_sse_events WHERE session_id = ?").get([sessionId])?.seq ?? 1);
  const eventId = `evt_${String(nextSeq).padStart(6, "0")}`;
  runtime.db.query("INSERT INTO session_sse_events(id, session_id, turn_id, seq, event_type, payload_redacted_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run([
    eventId,
    sessionId,
    turnId,
    nextSeq,
    eventType,
    redactText(payload, 4000),
    nowIso(),
  ]);
}
