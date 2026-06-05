import type {
  AppRuntime,
  GuidanceLoopState,
  LearningFrontier,
  ModelRequestContext,
  PracticeMode,
  TutorAgentAction,
  TutorAgentActionKind,
  TutorAgentTurnPlan,
  TutorAgentValidationResult,
} from "../types.js";
import { AppError } from "../types.js";
import { redactText, summarizeText } from "../security/redaction.js";
import { deriveLearningFrontier } from "./learning-frontier.js";
import { deriveGuidanceLoopState } from "./guidance-loop-state.js";
import {
  createOrResumeTutorAgentState,
  recordGuidedAnswerJudgement,
  recordTutorAgentAction,
  saveTutorAgentFrontierSnapshot,
} from "./tutor-agent-store.js";
import { buildPracticeOutcomeMessage, requestExplicitPractice } from "./practice-workflow.js";

const MAX_AGENT_RESPONSE_CHARS = 1600;
const MAX_AGENT_FIELD_CHARS = 700;

export function validateTutorAgentAction(candidate: unknown, frontier: LearningFrontier): TutorAgentValidationResult {
  const action = normalizeTutorAgentAction(candidate);
  if (!action) return reject("malformed_action", "Tutor action must be a bounded structured object.");
  if (frontier.status === "paused" && action.action_kind !== "explain_status") {
    return reject("frontier_paused", "The learning frontier is paused and only status/recovery guidance is allowed.");
  }
  if (action.action_kind === "explain_status") {
    return accept();
  }
  if (!frontier.allowed_action_kinds.includes(action.action_kind)) {
    return reject("action_kind_not_allowed", "Action kind is not allowed by the current frontier.");
  }
  if (!action.concept_id) return reject("missing_concept", "A learning action needs a concept id.");
  const current = frontier.current_concept_id;
  const remediation = new Set(frontier.allowed_remediation_concept_ids);
  if (action.action_kind === "request_structured_practice") {
    const requested = action.requested_backend_action?.concept_ids?.length
      ? action.requested_backend_action.concept_ids
      : [action.concept_id];
    if (frontier.allowed_practice_concept_ids.length === 0) {
      return reject("practice_not_allowed", "Structured practice is not allowed at this point.");
    }
    const allowedPractice = new Set(frontier.allowed_practice_concept_ids);
    if (requested.length === 0 || requested.some((conceptId) => !allowedPractice.has(conceptId))) {
      return reject("practice_not_allowed", "Structured practice target is outside the allowed practice frontier.");
    }
    return accept();
  }
  if (action.action_kind === "propose_next_concept") {
    if (!frontier.allowed_next_concept_ids.includes(action.concept_id)) {
      return reject("next_concept_not_allowed", "Next concept is outside the allowed progression frontier.");
    }
    return accept();
  }
  if (frontier.blocked_concept_ids.includes(action.concept_id)) {
    return reject("concept_outside_frontier", "The action targets a blocked concept.");
  }
  if (action.action_kind === "remediate_concept") {
    return remediation.has(action.concept_id)
      ? accept()
      : reject("concept_outside_frontier", "Remediation target is outside the allowed frontier.");
  }
  if (current && action.concept_id !== current && !remediation.has(action.concept_id)) {
    return reject("concept_outside_frontier", "Teaching action target is outside the active concept frontier.");
  }
  return accept();
}

export async function runTutorAgentTurn(
  runtime: AppRuntime,
  input: {
    sessionId: string;
    turnId: string;
    message: string;
    code?: string;
    context: ModelRequestContext;
    allowStructuredPractice?: boolean;
    initialActionOnly?: boolean;
  },
): Promise<string> {
  const frontier = deriveLearningFrontier(runtime, { sessionId: input.sessionId });
  const state = createOrResumeTutorAgentState(runtime, {
    sessionId: input.sessionId,
    diagnosticSessionId: frontier.diagnostic_session_id,
    currentConceptId: frontier.current_concept_id,
    status: frontier.status,
  });
  saveTutorAgentFrontierSnapshot(runtime, {
    stateId: state.state_id,
    sessionId: input.sessionId,
    turnId: input.turnId,
    frontier,
  });
  const validationFrontier = input.allowStructuredPractice === false
    ? { ...frontier, allowed_practice_concept_ids: [] }
    : frontier;
  let loopState = deriveGuidanceLoopState(runtime, { sessionId: input.sessionId });
  const candidate = await proposeTutorTurnPlan(runtime, input, validationFrontier, loopState);
  let plan = normalizeTutorAgentTurnPlan(candidate);
  if (!plan) {
    const validation = reject("malformed_action", "Tutor action must be a bounded structured object.");
    recordTutorAgentAction(runtime, {
      stateId: state.state_id,
      sessionId: input.sessionId,
      turnId: input.turnId,
      action: null,
      validation,
    });
    throw new AppError("MODEL_OUTPUT_INVALID", "外部模型返回的导师动作无法通过结构校验。", 502, true);
  }

  let validationRepairAttempted = false;
  for (;;) {
    const responseParts: string[] = [];
    let shouldRetryWithRepairedPlan = false;
    for (const action of plan.actions) {
      let validation = validateTutorAgentAction(action, validationFrontier);
      if (validation.accepted) {
        validation = validateGuidanceLoopAction(action, loopState);
      }
      if (validation.accepted && action.action_kind === "request_structured_practice") {
        validation = validatePracticeReadiness(input, loopState);
      }
      const recorded = recordTutorAgentAction(runtime, {
        stateId: state.state_id,
        sessionId: input.sessionId,
        turnId: input.turnId,
        action,
        validation,
      });
      if (!validation.accepted) {
        if (!validationRepairAttempted && responseParts.length === 0) {
          validationRepairAttempted = true;
          const repairedCandidate = await proposeTutorTurnValidationRepairPlan(runtime, input, validationFrontier, loopState, action, validation);
          const repairedPlan = normalizeTutorAgentTurnPlan(repairedCandidate);
          if (!repairedPlan) {
            throw new AppError("MODEL_OUTPUT_INVALID", "外部模型修正后的导师动作仍无法通过结构校验。", 502, true);
          }
          plan = repairedPlan;
          shouldRetryWithRepairedPlan = true;
          break;
        }
        throw new AppError("TUTOR_ACTION_REJECTED", `外部模型提出的导师动作未通过服务端校验：${validation.code}`, 502, true);
      }
      if (action.concept_id && action.concept_id !== state.current_concept_id) {
        createOrResumeTutorAgentState(runtime, {
          sessionId: input.sessionId,
          diagnosticSessionId: frontier.diagnostic_session_id,
          currentConceptId: action.concept_id,
          status: "active",
        });
      }
      if (action.action_kind === "evaluate_guided_answer" && action.concept_id) {
        recordGuidedAnswerJudgement(runtime, {
          sessionId: input.sessionId,
          turnId: input.turnId,
          agentActionId: recorded.action_id,
          conceptId: action.concept_id,
          judgement: judgementFromAction(action, input.message),
          confidence: 0.86,
          misconceptionSummary: action.expected_learning_signal,
        });
        loopState = deriveGuidanceLoopState(runtime, { sessionId: input.sessionId });
        responseParts.push(action.learner_facing_response);
        continue;
      }
      if (action.action_kind === "request_structured_practice" && !input.initialActionOnly) {
        const targetConceptIds = action.requested_backend_action?.concept_ids?.length
          ? action.requested_backend_action.concept_ids
          : action.concept_id ? [action.concept_id] : [];
        const outcome = await requestExplicitPractice(runtime, {
          sessionId: input.sessionId,
          turnId: input.turnId,
          source: "agent",
          agentActionId: recorded.action_id,
          conceptIds: targetConceptIds,
          practiceMode: explicitPracticeMode(input, loopState),
        });
        responseParts.push(action.learner_facing_response);
        return `${preferredPlanResponse(plan, responseParts)}\n\n${buildPracticeOutcomeMessage(outcome)}`;
      }
      if (
        action.action_kind === "explain_concept"
        || action.action_kind === "ask_guided_question"
        || action.action_kind === "remediate_concept"
        || action.action_kind === "review_practice_result"
      ) {
        loopState = deriveGuidanceLoopState(runtime, { sessionId: input.sessionId });
      }
      responseParts.push(action.learner_facing_response);
    }
    if (shouldRetryWithRepairedPlan) continue;
    return preferredPlanResponse(plan, responseParts);
  }
}

export function recordTutorAgentSafetyRejection(
  runtime: AppRuntime,
  input: { sessionId: string; turnId: string },
): void {
  const frontier = deriveLearningFrontier(runtime, { sessionId: input.sessionId });
  const state = createOrResumeTutorAgentState(runtime, {
    sessionId: input.sessionId,
    diagnosticSessionId: frontier.diagnostic_session_id,
    currentConceptId: frontier.current_concept_id,
    status: frontier.status,
  });
  saveTutorAgentFrontierSnapshot(runtime, {
    stateId: state.state_id,
    sessionId: input.sessionId,
    turnId: input.turnId,
    frontier,
  });
  recordTutorAgentAction(runtime, {
    stateId: state.state_id,
    sessionId: input.sessionId,
    turnId: input.turnId,
    action: {
      action_kind: "explain_status",
      concept_id: frontier.current_concept_id,
      rationale: "Learner requested hidden or unsafe material; reject without invoking tools or changing practice state.",
      learner_facing_response: composeSafetyTutorRejection(frontier),
      expected_learning_signal: "unsafe_request_refused_without_side_effect",
    },
    validation: reject("safety_refusal", "Safety refusal requests cannot become tutor-agent learning or tool actions."),
    fallbackResponse: composeSafetyTutorRejection(frontier),
  });
}

function inferGuidedAnswerJudgement(message: string): "understood" | "partial" | "blocked" {
  const normalized = message.trim();
  if (!normalized) return "blocked";
  if (/(不知道|不会|不懂|卡住|完全没)/u.test(normalized)) return "blocked";
  if (/(可能|也许|不确定|是不是|应该|迷路|从哪|哪里继续|下一步|不太清楚)/u.test(normalized)) return "partial";
  return "understood";
}

function composeSafetyTutorRejection(frontier: LearningFrontier): string {
  return `我不能提供隐藏答案、内部材料或绕过学习流程的内容。我们继续停留在 ${frontier.current_concept_id ?? "当前概念"}，下一步请描述你的理解或提交可运行练习。`;
}

function validatePracticeReadiness(
  input: { context: ModelRequestContext; allowStructuredPractice?: boolean; initialActionOnly?: boolean },
  loopState: GuidanceLoopState,
): TutorAgentValidationResult {
  if (input.allowStructuredPractice === false || input.initialActionOnly) {
    return reject("auto_practice_not_ready", "Structured practice is disabled for this tutor turn.");
  }
  if (loopState.active_practice) {
    return reject("auto_practice_not_ready", "An active exercise already exists for this guidance loop.");
  }
  if (!loopState.auto_practice_allowed) {
    return reject("auto_practice_not_ready", `Automatic practice is not allowed: ${loopState.blocked_reasons.join(", ") || loopState.phase}.`);
  }
  return accept();
}

function validateGuidanceLoopAction(action: TutorAgentAction, loopState: GuidanceLoopState): TutorAgentValidationResult {
  if (action.action_kind === "explain_status") return accept();
  if (action.action_kind === "request_structured_practice") return accept();
  if (action.action_kind === "evaluate_guided_answer" && loopState.phase !== "awaiting_guided_answer") {
    return reject("guided_question_missing", "Guided answers can only be evaluated after an accepted guided question.");
  }
  if (action.action_kind === "propose_next_concept" && loopState.phase !== "review_practice_result") {
    return reject("practice_review_missing", "Next-concept progression requires reviewed practice evidence.");
  }
  if (loopState.phase === "active_practice") {
    return reject("active_practice_in_progress", "Active practice must be submitted or revised before replanning tutor guidance.");
  }
  if (loopState.phase === "need_explanation" && action.action_kind !== "explain_concept" && action.action_kind !== "remediate_concept") {
    return reject("concept_guidance_missing", "Concept explanation must precede guided questioning and practice.");
  }
  if (loopState.phase === "need_guided_question" && action.action_kind === "evaluate_guided_answer") {
    return reject("guided_question_missing", "A guided question must be asked before evaluating the learner answer.");
  }
  if (loopState.phase === "awaiting_guided_answer" && action.action_kind !== "evaluate_guided_answer" && action.action_kind !== "remediate_concept") {
    return reject("guided_answer_expected", "The learner response must be evaluated before replanning guidance or practice.");
  }
  return accept();
}

function explicitPracticeMode(input: { context: ModelRequestContext }, loopState: GuidanceLoopState): PracticeMode | undefined {
  if (loopState.auto_practice_mode) return loopState.auto_practice_mode;
  return input.context.route?.intent === "exercise_request" ? "standard" : undefined;
}

async function proposeTutorTurnPlan(
  runtime: AppRuntime,
  input: {
    sessionId: string;
    turnId: string;
    message: string;
    code?: string;
    context: ModelRequestContext;
  },
  frontier: LearningFrontier,
  loopState: GuidanceLoopState,
): Promise<unknown> {
  if (!runtime.tutor) {
    throw new AppError("MODEL_UNAVAILABLE", "未配置可用的外部模型，无法生成导师动作。", 503, true);
  }
  try {
    const response = await runtime.tutor.generate({
      message: buildTutorAgentPrompt(input.message, frontier, loopState, input.context),
      code: input.code,
      context: input.context,
    });
    const parsed = parseCandidateJson(response);
    if (parsed) return parsed;
    const repaired = await runtime.tutor.generate({
      message: buildTutorAgentRepairPrompt(input.message, response, frontier, loopState, input.context),
      code: input.code,
      context: input.context,
    });
    return parseCandidateJson(repaired) ?? repaired;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("MODEL_UNAVAILABLE", "外部模型调用失败，无法生成导师动作。", 503, true);
  }
}

async function proposeTutorTurnValidationRepairPlan(
  runtime: AppRuntime,
  input: {
    sessionId: string;
    turnId: string;
    message: string;
    code?: string;
    context: ModelRequestContext;
  },
  frontier: LearningFrontier,
  loopState: GuidanceLoopState,
  rejectedAction: TutorAgentAction,
  validation: TutorAgentValidationResult,
): Promise<unknown> {
  if (!runtime.tutor) {
    throw new AppError("MODEL_UNAVAILABLE", "未配置可用的外部模型，无法修正导师动作。", 503, true);
  }
  try {
    const response = await runtime.tutor.generate({
      message: buildTutorAgentValidationRepairPrompt(input.message, rejectedAction, validation, frontier, loopState, input.context),
      code: input.code,
      context: input.context,
    });
    return parseCandidateJson(response) ?? response;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("MODEL_UNAVAILABLE", "外部模型调用失败，无法修正导师动作。", 503, true);
  }
}

function judgementFromAction(action: TutorAgentAction, message: string): "understood" | "partial" | "blocked" {
  if (/guided_answer_partial/u.test(action.expected_learning_signal)) return "partial";
  if (/guided_answer_blocked/u.test(action.expected_learning_signal)) return "blocked";
  if (/guided_answer_understood/u.test(action.expected_learning_signal)) return "understood";
  return inferGuidedAnswerJudgement(message);
}


function buildTutorAgentPrompt(message: string, frontier: LearningFrontier, loopState: GuidanceLoopState, context: ModelRequestContext): string {
  const feedback = context.bundle?.server_attested_state.learning_progress_decision?.diagnostic;
  const learningStart = context.bundle?.server_attested_state.learning_progress_decision?.learning_start;
  return [
    "你是 Python 课程导师智能体。请只返回一个 JSON 对象，不要返回 Markdown。",
    "JSON 可以是单个 action，也可以是 { actions: [...] } turn plan。每个 action 字段：action_kind, concept_id, rationale, learner_facing_response, expected_learning_signal, requested_backend_action。",
    "只有 guidance_loop_state.auto_practice_allowed=true 或学生明确练习请求通过后端校验时，才能请求 request_structured_practice；不要在普通文本中编造可提交练习。",
    "初始测评反馈：从后端确认的学习起点开始导师指导。",
    `学习起点：${learningStart?.label ?? frontier.current_concept_id ?? "当前学习起点"}`,
    `测评概况：已答 ${feedback?.answered ?? 0} 题，completed=${feedback?.completed ?? false}`,
    `当前 frontier: ${JSON.stringify(frontier)}`,
    `当前 guidance_loop_state: ${JSON.stringify(loopState ?? null)}`,
    `学习者消息: ${message}`,
  ].join("\n");
}

function buildTutorAgentRepairPrompt(
  message: string,
  previousOutput: string,
  frontier: LearningFrontier,
  loopState: GuidanceLoopState,
  context: ModelRequestContext,
): string {
  return [
    buildTutorAgentPrompt(message, frontier, loopState, context),
    "",
    "上一次输出不是合法 JSON tutor action，服务端无法执行。",
    `上一次输出摘要：${summarizeText(redactText(previousOutput, 800), 800)}`,
    "请重新只返回一个合法 JSON 对象。不要返回 Markdown、解释文字或代码围栏。",
  ].join("\n");
}

function buildTutorAgentValidationRepairPrompt(
  message: string,
  rejectedAction: TutorAgentAction,
  validation: TutorAgentValidationResult,
  frontier: LearningFrontier,
  loopState: GuidanceLoopState,
  context: ModelRequestContext,
): string {
  return [
    buildTutorAgentPrompt(message, frontier, loopState, context),
    "",
    "上一次 JSON tutor action 已被服务端校验拒绝，不能执行。",
    `拒绝代码：${validation.code}`,
    `拒绝原因：${validation.reason}`,
    `被拒绝 action 摘要：${summarizeText(redactText(JSON.stringify(rejectedAction), 900), 900)}`,
    `允许的 action_kind：${JSON.stringify(frontier.allowed_action_kinds)}`,
    `允许的下一概念：${JSON.stringify(frontier.allowed_next_concept_ids)}`,
    `允许的练习概念：${JSON.stringify(frontier.allowed_practice_concept_ids)}`,
    "请基于当前 frontier 与 guidance_loop_state 重新返回一个可执行的 JSON action。",
    "如果要推进下一概念，concept_id 必须来自 allowed_next_concept_ids。",
    "如果正在评阅练习结果，请使用 review_practice_result 或在 allowed_next_concept_ids 中选择正确的下一概念。",
    "不要返回 Markdown、解释文字或代码围栏；只返回 JSON 对象。",
  ].join("\n");
}

function parseCandidateJson(response: string): unknown {
  const trimmed = response.trim();
  const jsonText = trimmed.startsWith("{") ? trimmed : trimmed.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) return null;
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

function normalizeTutorAgentAction(candidate: unknown): TutorAgentAction | null {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const record = candidate as Record<string, unknown>;
  if (!isActionKind(record.action_kind)) return null;
  const learnerResponse = stringField(record.learner_facing_response, MAX_AGENT_RESPONSE_CHARS);
  const rationale = stringField(record.rationale, MAX_AGENT_FIELD_CHARS);
  const signal = stringField(record.expected_learning_signal, MAX_AGENT_FIELD_CHARS);
  if (!learnerResponse || !rationale || !signal) return null;
  const backend = normalizeBackendAction(record.requested_backend_action);
  return {
    action_kind: record.action_kind,
    concept_id: stringField(record.concept_id, 120) ?? null,
    rationale,
    learner_facing_response: learnerResponse,
    expected_learning_signal: signal,
    requested_backend_action: backend,
  };
}

function normalizeTutorAgentTurnPlan(candidate: unknown): TutorAgentTurnPlan | null {
  const single = normalizeTutorAgentAction(candidate);
  if (single) return { actions: [single] };
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const record = candidate as Record<string, unknown>;
  if (!Array.isArray(record.actions)) return null;
  const actions = record.actions
    .map((item) => normalizeTutorAgentAction(item))
    .filter((item): item is TutorAgentAction => item !== null)
    .slice(0, 3);
  if (actions.length === 0) return null;
  return {
    actions,
    learner_facing_response: stringField(record.learner_facing_response, MAX_AGENT_RESPONSE_CHARS),
  };
}

function normalizeBackendAction(value: unknown): TutorAgentAction["requested_backend_action"] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const type = record.type === "structured_practice" || record.type === "guided_answer_judgement" || record.type === "none"
    ? record.type
    : undefined;
  if (!type) return undefined;
  const conceptIds = Array.isArray(record.concept_ids)
    ? record.concept_ids.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, 5)
    : undefined;
  return { type, concept_ids: conceptIds };
}

function preferredPlanResponse(plan: TutorAgentTurnPlan, responseParts: string[]): string {
  return plan.learner_facing_response ?? responseParts.join("\n\n");
}

function stringField(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? redactText(summarizeText(trimmed, maxLength), maxLength) : undefined;
}

function isActionKind(value: unknown): value is TutorAgentActionKind {
  return typeof value === "string" && [
    "explain_concept",
    "ask_guided_question",
    "evaluate_guided_answer",
    "remediate_concept",
    "request_structured_practice",
    "review_practice_result",
    "propose_next_concept",
    "explain_status",
  ].includes(value);
}

function accept(): TutorAgentValidationResult {
  return { accepted: true, code: "accepted", reason: "Accepted by tutor action validator." };
}

function reject(code: string, reason: string): TutorAgentValidationResult {
  return { accepted: false, code, reason };
}
