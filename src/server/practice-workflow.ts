import type { AppRuntime, LearningProgressDecision, PracticeExerciseArtifact, PracticeMode, PracticeOutcome, PracticeTarget } from "../types.js";
import { AppError } from "../types.js";
import { requireLocalSession } from "../db/validators.js";
import { createId, nowIso } from "../security/ids.js";
import { getCatalogConceptById } from "./course-catalog.js";
import { deriveLearningProgressDecision } from "./learning-progress-decision.js";
import { deriveLearningFrontier } from "./learning-frontier.js";
import { executeToolThroughGate } from "./tool-gate.js";
import { selectExercise } from "../tools/exercise-tools.js";
import { persistPracticeContract } from "../tools/agentic-practice-tools.js";
import { assertAcceptedTutorAgentAction } from "./tutor-agent-store.js";

export async function requestExplicitPractice(
  runtime: AppRuntime,
  input: { sessionId: string; turnId?: string | null; conceptIds?: string[]; source?: "chat" | "ui" | "api" | "agent"; agentActionId?: string | null; practiceMode?: PracticeMode },
): Promise<PracticeOutcome> {
  requireLocalSession(runtime, input.sessionId);
  const decision = deriveLearningProgressDecision(runtime, { sessionId: input.sessionId });
  const agentConceptIds = input.source === "agent" ? requireAgentPracticeTarget(runtime, input) : null;
  const target = selectPracticeTarget(runtime, decision, agentConceptIds ?? input.conceptIds ?? [], input.source === "agent", input.practiceMode);
  if (isPracticeLocked(decision.practice_state)) {
    const outcome: PracticeOutcome = {
      schema_version: "practice_outcome.v1",
      kind: "practice_locked",
      reason: decision.practice_state,
      message: lockedMessage(decision),
      next_step: lockedNextStep(decision),
      target,
      evidence: { result_code: decision.practice_state },
      agent_action_id: input.agentActionId ?? undefined,
    };
    persistPracticeOutcome(runtime, input.sessionId, input.turnId ?? null, outcome, input.agentActionId ?? null);
    return outcome;
  }
  if (input.source === "agent") {
    const frontier = deriveLearningFrontier(runtime, { sessionId: input.sessionId, decision });
    const allowed = new Set(frontier.allowed_practice_concept_ids);
    if (target.concept_ids.length === 0 || target.concept_ids.some((conceptId) => !allowed.has(conceptId))) {
      const outcome: PracticeOutcome = {
        schema_version: "practice_outcome.v1",
        kind: "practice_locked",
        reason: "frontier_blocked",
        message: "当前导师动作还不能为这个概念创建结构化练习。",
        next_step: "下一步先回到当前概念解释或引导式追问，确认理解后再请求练习。",
        target,
        evidence: { result_code: "frontier_blocked" },
        agent_action_id: input.agentActionId ?? undefined,
      };
      persistPracticeOutcome(runtime, input.sessionId, input.turnId ?? null, outcome, input.agentActionId ?? null);
      return outcome;
    }
  }

  const selected = await executeToolThroughGate(runtime, {
    sessionId: input.sessionId,
    turnId: input.turnId ?? null,
    allowedToolGroup: "exercise_generation_tools",
    caller: "api",
    agentActionId: input.agentActionId ?? null,
    toolName: "select_exercise",
    params: {
      concept_ids: target.concept_ids,
      difficulty: target.difficulty,
      mode: "practice",
      provenance: target.provenance,
    },
    invoke: () => selectExercise(runtime, { concept_ids: target.concept_ids, difficulty: target.difficulty, mode: "practice" }, {
      sessionId: input.sessionId,
      turnId: input.turnId ?? null,
    }),
  });

  if (selected.ok && "exercise" in selected.data) {
    const outcome: PracticeOutcome = {
      schema_version: "practice_outcome.v1",
      kind: "exercise_ready",
      message: "已为你准备一道结构化练习。",
      next_step: "下一步在练习卡片里完成代码，提交后我会根据运行证据给出反馈。",
      target,
      evidence: { result_code: selected.code, tool_name: "select_exercise" },
      exercise: selected.data.exercise,
      recommendation_id: selected.data.recommendation_id,
      agent_action_id: input.agentActionId ?? undefined,
    };
    persistPracticeOutcome(runtime, input.sessionId, input.turnId ?? null, outcome, input.agentActionId ?? null);
    return outcome;
  }

  if (input.source === "agent" && selected.code === "EXERCISE_CONTENT_UNAVAILABLE") {
    const exercise = ensureAgenticPracticeContract(runtime, {
      sessionId: input.sessionId,
      turnId: input.turnId ?? null,
      agentActionId: input.agentActionId ?? null,
      target,
      practiceMode: input.practiceMode,
    });
    const outcome: PracticeOutcome = {
      schema_version: "practice_outcome.v1",
      kind: "exercise_ready",
      message: "已为你准备一道当前概念的练习。",
      next_step: "下一步在练习卡片里提交一次很小的尝试；我会根据运行证据继续指导。",
      target,
      evidence: { result_code: "AGENT_PRACTICE_CONTRACT_READY", tool_name: "create_practice_contract" },
      exercise,
      recommendation_id: `practice:${exercise.id}`,
      agent_action_id: input.agentActionId ?? undefined,
    };
    persistPracticeOutcome(runtime, input.sessionId, input.turnId ?? null, outcome, input.agentActionId ?? null);
    return outcome;
  }

  const outcome: PracticeOutcome = {
    schema_version: "practice_outcome.v1",
    kind: "practice_unavailable",
    reason: selected.code,
    message: "暂时没有可用的结构化练习。",
    next_step: selected.code === "CATALOG_CONCEPT_NOT_FOUND"
      ? "下一步请换一个当前课程目录中的概念，或先让导师解释你想练的知识点。"
      : "下一步先让导师解释这个概念，或稍后内容同步后再重试练习。",
    target,
    evidence: { result_code: selected.code, tool_name: "select_exercise" },
    agent_action_id: input.agentActionId ?? undefined,
  };
  persistPracticeOutcome(runtime, input.sessionId, input.turnId ?? null, outcome, input.agentActionId ?? null);
  return outcome;
}

export function buildPracticeOutcomeMessage(outcome: PracticeOutcome): string {
  return `${outcome.message}${outcome.kind === "exercise_ready" ? `\n\n练习：${outcome.exercise.title}` : ""}\n\n${outcome.next_step}`;
}

export function persistPracticeOutcome(runtime: AppRuntime, sessionId: string, turnId: string | null, outcome: PracticeOutcome, agentActionId: string | null = null): void {
  runtime.db.query(
    "INSERT INTO session_practice_outcomes(id, session_id, turn_id, agent_action_id, outcome_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run([createId("prac"), sessionId, turnId, agentActionId, JSON.stringify(outcome), nowIso()]);
}

export function loadLatestPracticeOutcome(runtime: AppRuntime, sessionId: string): PracticeOutcome | null {
  const row = runtime.db.query<{ outcome_json: string }>(
    "SELECT outcome_json FROM session_practice_outcomes WHERE session_id = ? ORDER BY created_at DESC LIMIT 1",
  ).get([sessionId]);
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.outcome_json) as PracticeOutcome;
    return parsed?.schema_version === "practice_outcome.v1" ? parsed : null;
  } catch {
    return null;
  }
}

function selectPracticeTarget(runtime: AppRuntime, decision: LearningProgressDecision, explicitConceptIds: string[], exactOnly = false, practiceMode?: PracticeMode): PracticeTarget {
  const provenance: string[] = [];
  const knownExplicit = uniqueKnownConceptIds(runtime, explicitConceptIds);
  let conceptIds = knownExplicit;
  if (conceptIds.length > 0) {
    provenance.push(exactOnly ? "agent_frontier" : "explicit_request");
  }
  if (practiceMode) provenance.push(`mode:${practiceMode}`);
  if (exactOnly) {
    return {
      concept_ids: conceptIds.slice(0, 3),
      difficulty: practiceDifficulty(decision, practiceMode),
      provenance: provenance.length > 0 ? provenance : ["agent_frontier_empty"],
    };
  }
  if (conceptIds.length === 0 && decision.learning_start?.concept_id) {
    conceptIds = uniqueKnownConceptIds(runtime, [decision.learning_start.concept_id]);
    if (conceptIds.length > 0) provenance.push("learning_start");
  }
  if (conceptIds.length === 0 && decision.weak_concepts.length > 0) {
    conceptIds = uniqueKnownConceptIds(runtime, decision.weak_concepts.map((item) => item.concept_id));
    if (conceptIds.length > 0) provenance.push("weak_concepts");
  }
  if (conceptIds.length === 0 && decision.recommendation_focus.length > 0) {
    conceptIds = uniqueKnownConceptIds(runtime, decision.recommendation_focus.flatMap((item) => [item.target_id, item.concept_id]));
    if (conceptIds.length > 0) provenance.push("recommendation_focus");
  }
  if (conceptIds.length === 0) {
    conceptIds = uniqueKnownConceptIds(runtime, decision.current_unit.concept_ids);
    if (conceptIds.length > 0) provenance.push("current_unit");
  }
  if (provenance.length === 0) provenance.push("catalog_fallback");
  return {
    concept_ids: conceptIds.slice(0, 3),
    difficulty: practiceDifficulty(decision, practiceMode),
    provenance,
  };
}

function ensureAgenticPracticeContract(
  runtime: AppRuntime,
  input: { sessionId: string; turnId: string | null; agentActionId: string | null; target: PracticeTarget; practiceMode?: PracticeMode },
): PracticeExerciseArtifact {
  const conceptIds = input.target.concept_ids.slice(0, 3);
  const primaryConcept = conceptIds[0] ? getCatalogConceptById(runtime, conceptIds[0]) : null;
  const conceptLabel = primaryConcept?.name ?? conceptIds[0] ?? "当前概念";
  const prompt = [
    `围绕「${conceptLabel}」写一小段 Python 代码，做一次最小可运行尝试。`,
    input.practiceMode === "scaffolded" || input.practiceMode === "micro"
      ? "可以只写 1-3 行，重点是让代码能运行，并体现你对这个概念的一点理解。"
      : "重点是让代码能运行，并体现你对当前概念的基本理解。",
  ].join("\n\n");
  const contract = persistPracticeContract(runtime, {
    session_id: input.sessionId,
    turn_id: input.turnId,
    tutor_agent_action_id: input.agentActionId,
    concept_ids: conceptIds,
    title: `${conceptLabel}练习`,
    prompt_md: prompt,
    starter_code: "# 写一小段 Python 代码\n",
    expected_behavior: "代码能够在 Python 解释器中运行，并体现当前概念的基本用法。",
    visible_examples: [],
    acceptance_checklist: ["代码可以运行", `代码体现「${conceptLabel}」的一个基本用法`, "输出或变量变化与代码意图一致"],
    allowed_solution_shape: "single_file_python",
    review_rubric: "先运行学生代码，再对照验收清单判断是否通过；不使用隐藏测试或私有答案。",
    difficulty: input.target.difficulty,
    progress_eligible: true,
  });
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
    samples: [],
    hint_level: input.practiceMode === "standard" ? 0 : 1,
    submission: { endpoint: `/api/sessions/${encodeURIComponent(input.sessionId)}/messages`, enabled: true },
  };
}

function requireAgentPracticeTarget(
  runtime: AppRuntime,
  input: { sessionId: string; agentActionId?: string | null; conceptIds?: string[] },
): string[] {
  if (!input.agentActionId) {
    throw new AppError("VALIDATION_ERROR", "Agent-owned practice requires a validated agent action id.");
  }
  const conceptIds = input.conceptIds ?? [];
  if (conceptIds.length === 0) {
    throw new AppError("VALIDATION_ERROR", "Agent-owned practice requires frontier-validated concept ids.");
  }
  assertAcceptedTutorAgentAction(runtime, {
    sessionId: input.sessionId,
    actionId: input.agentActionId,
    conceptIds,
    expectedKind: "request_structured_practice",
  });
  return conceptIds;
}

function uniqueKnownConceptIds(runtime: AppRuntime, conceptIds: string[]): string[] {
  return [...new Set(conceptIds.filter((conceptId) => getCatalogConceptById(runtime, conceptId)))].slice(0, 3);
}

function conservativeDifficulty(decision: LearningProgressDecision): number {
  if (decision.reasons.some((reason) => /low_confidence|hard_cap/i.test(reason))) return 1;
  if ((decision.diagnostic.placement_confidence ?? 1) < 0.7) return 1;
  return 2;
}

function practiceDifficulty(decision: LearningProgressDecision, practiceMode?: PracticeMode): number {
  if (practiceMode === "scaffolded" || practiceMode === "micro") return 1;
  return conservativeDifficulty(decision);
}

function isPracticeLocked(practiceState: LearningProgressDecision["practice_state"]): boolean {
  return practiceState === "locked_by_diagnostic"
    || practiceState === "locked_by_stale_catalog"
    || practiceState === "guidance_first";
}

function lockedMessage(decision: LearningProgressDecision): string {
  if (decision.practice_state === "locked_by_stale_catalog") {
    return "当前课程目录已更新，需要先刷新初始测评结果后才能生成练习。";
  }
  if (decision.practice_state === "guidance_first") {
    return "已完成初始测评，但需要先开始导师指导，才能生成普通练习。";
  }
  if (decision.diagnostic_state === "technical_unavailable") {
    return "测评题暂时无法生成，普通练习仍保持锁定。";
  }
  return "需要先完成初始测评，才能生成普通练习。";
}

function lockedNextStep(decision: LearningProgressDecision): string {
  if (decision.practice_state === "locked_by_stale_catalog") {
    return "下一步请重新完成当前目录下的初始测评，再请求练习。";
  }
  if (decision.practice_state === "guidance_first") {
    return "下一步请先点击或请求开始导师指导；导师会从测评确认的学习起点讲解，然后你可以明确请求练习。";
  }
  return "下一步先完成初始测评；完成后可以开始导师指导，再明确请求练习。";
}
