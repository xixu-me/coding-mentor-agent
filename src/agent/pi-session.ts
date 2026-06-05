import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { AppRuntime, ToolGroupId } from "../types.js";
import { buildCourseSystemPrompt, summarizeToolEnvelopeForModel } from "./prompt.js";
import { kbGetPageContent, kbLintStatus, kbOverview, kbReadConcept, kbReadFile, kbReadImage, kbReadSummary, kbSearch } from "../tools/kb-tools.js";
import { runPython, runPytest } from "../tools/code-tools.js";
import { gradeSubmission, selectExercise } from "../tools/exercise-tools.js";
import {
  checkPythonSyntax,
  createPracticeContract,
  getActivePracticeContract,
  recordAgentReview,
  requestLearningProgressUpdate,
  runReviewProbe,
  runStudentCode,
} from "../tools/agentic-practice-tools.js";
import { getConceptMastery, getRecentLearningContext, getStudentProfile, recordLearningEvent, tagMistake, updateMastery } from "../tools/progress-tools.js";
import { createProjectPlan, getProjectState, recommendProjectNextStep, recordProjectProgress, reviewProjectCode, submitProjectStep } from "../tools/project-tools.js";
import type { TSchema } from "@sinclair/typebox";
import type { ToolEnvelope } from "../types.js";
import { auditTool } from "../tools/envelope.js";
import { executeToolThroughGate } from "../server/tool-gate.js";
import { getModelVisibleTools } from "../tools/tool-policy.js";
import {
  GetConceptMasteryParams,
  GetRecentLearningContextParams,
  GetStudentProfileParams,
  GradeSubmissionParams,
  CreatePracticeContractParams,
  GetActivePracticeContractParams,
  KbGetPageContentParams,
  KbLintStatusParams,
  KbOverviewParams,
  KbReadConceptParams,
  KbReadFileParams,
  KbReadImageParams,
  KbReadSummaryParams,
  KbSearchParams,
  PracticeReviewExecutionParams,
  PracticeReviewProbeParams,
  ProjectPlanParams,
  ProjectStateParams,
  RecommendProjectNextStepParams,
  RecordAgentReviewParams,
  RecordLearningEventParams,
  RecordProjectProgressParams,
  RequestLearningProgressUpdateParams,
  ReviewProjectCodeParams,
  RunPythonParams,
  RunPytestParams,
  SelectExerciseParams,
  SubmitProjectStepParams,
  TagMistakeParams,
  UpdateMasteryParams,
} from "../tools/schemas.js";

type PiToolContext = {
  sessionId?: string | null;
  turnId?: string | null;
};

export async function createPiCourseSession(
  runtime: AppRuntime,
  allowedToolGroup: ToolGroupId = "read_only_tools",
  toolContext: PiToolContext = {},
): Promise<unknown> {
  const {
    AuthStorage,
    createAgentSession,
    DefaultResourceLoader,
    getAgentDir,
    ModelRegistry,
    SessionManager,
    SettingsManager,
  } = await import("@earendil-works/pi-coding-agent");

  const cwd = join(runtime.config.appDataDir, "runtime-cwd");
  const sessionDir = join(runtime.config.appDataDir, "pi-sessions");
  mkdirSync(cwd, { recursive: true });
  mkdirSync(sessionDir, { recursive: true });

  const settingsManager = SettingsManager.inMemory();
  const authStorage = AuthStorage.create(join(runtime.config.appDataDir, "auth.json"));
  const modelRegistry = ModelRegistry.create(authStorage);
  const agentDir = getAgentDir();
  const tools = getEnabledToolNamesForGroup(runtime.config.enabledBatch, allowedToolGroup);
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPromptOverride: () => buildCourseSystemPrompt({
      courseName: "Python 程序设计",
      kbVersion: runtime.config.kbVersion,
      enabledTools: tools,
    }),
    appendSystemPromptOverride: () => [],
  } as any);
  await resourceLoader.reload();

  return createAgentSession({
    cwd,
    agentDir,
    authStorage,
    modelRegistry,
    sessionManager: SessionManager.create(cwd, sessionDir),
    settingsManager,
    resourceLoader,
    noTools: "builtin",
    tools,
    customTools: buildPiToolDefinitions(runtime, allowedToolGroup, toolContext).filter((tool) => tools.includes(tool.name)),
  } as any);
}

export function getEnabledToolNamesForGroup(enabledBatch: AppRuntime["config"]["enabledBatch"], allowedToolGroup: ToolGroupId): string[] {
  return getModelVisibleTools({ group: allowedToolGroup, enabledBatch });
}

function buildPiToolDefinitions(runtime: AppRuntime, allowedToolGroup: ToolGroupId, toolContext: PiToolContext): any[] {
  const handlers: Record<string, (params: any) => Promise<ToolEnvelope>> = {
    kb_overview: (params) => kbOverview(runtime, params),
    kb_search: (params) => kbSearch(runtime, params),
    kb_read_concept: (params) => kbReadConcept(runtime, params),
    kb_read_summary: (params) => kbReadSummary(runtime, params),
    kb_read_file: (params) => kbReadFile(runtime, params),
    kb_get_page_content: (params) => kbGetPageContent(runtime, params),
    kb_read_image: (params) => kbReadImage(runtime, params),
    kb_lint_status: (params) => kbLintStatus(runtime, params),
    run_python: (params) => runPython(runtime, params),
    run_pytest: (params) => runPytest(runtime, params),
    select_exercise: (params) => selectExercise(runtime, params, toolContext),
    grade_submission: (params) => gradeSubmission(runtime, params, toolContext),
    create_practice_contract: (params) => createPracticeContract(runtime, params, toolContext),
    get_active_practice_contract: (params) => getActivePracticeContract(runtime, params, toolContext),
    check_python_syntax: (params) => checkPythonSyntax(runtime, params, toolContext),
    run_student_code: (params) => runStudentCode(runtime, params, toolContext),
    run_review_probe: (params) => runReviewProbe(runtime, params, toolContext),
    record_agent_review: (params) => recordAgentReview(runtime, params, toolContext),
    request_learning_progress_update: (params) => requestLearningProgressUpdate(runtime, params, toolContext),
    get_student_profile: () => getStudentProfile(runtime, { sessionId: toolContext.sessionId }),
    get_concept_mastery: (params) => getConceptMastery(runtime, params),
    get_recent_learning_context: (params) => getRecentLearningContext(runtime, params, toolContext),
    record_learning_event: (params) => recordLearningEvent(runtime, params),
    tag_mistake: (params) => tagMistake(runtime, params),
    update_mastery: (params) => updateMastery(runtime, params),
    create_project_plan: (params) => createProjectPlan(runtime, params),
    get_project_state: (params) => getProjectState(runtime, params),
    recommend_project_next_step: (params) => recommendProjectNextStep(runtime, params),
    submit_project_step: (params) => submitProjectStep(runtime, params),
    review_project_code: (params) => reviewProjectCode(runtime, params),
    record_project_progress: (params) => recordProjectProgress(runtime, params),
  };
  return Object.entries(handlers).map(([name, handler]) => ({
    name,
    label: name.replaceAll("_", " "),
    description: `Course MVP tool: ${name}`,
    parameters: toolSchemas[name],
    executionMode: "sequential",
    execute: async (_toolCallId: string, params: unknown) => {
      const sessionId = toolContext.sessionId ?? null;
      const turnId = toolContext.turnId ?? null;
      const serverOwnedParams = applyServerOwnedTurnParams(name, params, toolContext);
      const envelope = await executeToolThroughGate(runtime, {
        sessionId,
        turnId,
        allowedToolGroup,
        toolName: name,
        params: serverOwnedParams,
        invoke: () => handler(serverOwnedParams),
      });
      auditTool(runtime, {
        sessionId: sessionId ?? undefined,
        turnId: turnId ?? undefined,
        toolName: name,
        params: serverOwnedParams,
        result: envelope,
      });
      return toAgentToolResult(envelope);
    },
  }));
}

const toolSchemas: Record<string, TSchema> = {
  kb_overview: KbOverviewParams,
  kb_search: KbSearchParams,
  kb_read_concept: KbReadConceptParams,
  kb_read_summary: KbReadSummaryParams,
  kb_read_file: KbReadFileParams,
  kb_get_page_content: KbGetPageContentParams,
  kb_read_image: KbReadImageParams,
  kb_lint_status: KbLintStatusParams,
  run_python: RunPythonParams,
  run_pytest: RunPytestParams,
  select_exercise: SelectExerciseParams,
  grade_submission: GradeSubmissionParams,
  create_practice_contract: CreatePracticeContractParams,
  get_active_practice_contract: GetActivePracticeContractParams,
  check_python_syntax: PracticeReviewExecutionParams,
  run_student_code: PracticeReviewExecutionParams,
  run_review_probe: PracticeReviewProbeParams,
  record_agent_review: RecordAgentReviewParams,
  request_learning_progress_update: RequestLearningProgressUpdateParams,
  get_student_profile: GetStudentProfileParams,
  get_concept_mastery: GetConceptMasteryParams,
  get_recent_learning_context: GetRecentLearningContextParams,
  record_learning_event: RecordLearningEventParams,
  tag_mistake: TagMistakeParams,
  update_mastery: UpdateMasteryParams,
  create_project_plan: ProjectPlanParams,
  get_project_state: ProjectStateParams,
  recommend_project_next_step: RecommendProjectNextStepParams,
  submit_project_step: SubmitProjectStepParams,
  review_project_code: ReviewProjectCodeParams,
  record_project_progress: RecordProjectProgressParams,
};

function toAgentToolResult(envelope: ToolEnvelope): any {
  const text = summarizeToolEnvelopeForModel(envelope);
  return {
    content: [{ type: "text", text }],
    details: {
      ok: envelope.ok,
      code: envelope.code,
      message: envelope.message,
      metadata: envelope.metadata,
      summary: text,
    },
    isError: !envelope.ok,
  };
}

function applyServerOwnedTurnParams(toolName: string, params: unknown, toolContext: PiToolContext): unknown {
  if (!params || typeof params !== "object") return params;
  const record = { ...(params as Record<string, unknown>) };
  delete record.session_id;
  if (toolContext.turnId && ["tag_mistake", "update_mastery"].includes(toolName)) {
    record.turn_id = toolContext.turnId;
  } else {
    delete record.turn_id;
  }
  if (toolName === "record_learning_event" && toolContext.turnId) {
    const evidence = record.evidence && typeof record.evidence === "object"
      ? { ...(record.evidence as Record<string, unknown>) }
      : {};
    evidence.session_turn_id = toolContext.turnId;
    record.evidence = evidence;
  }
  return record;
}
