import type { EnabledBatch, IntentRoute, ToolEnvelope, ToolGroupId } from "../types.js";
import { assertSandboxFilePath } from "../security/path.js";
import { redactText, sanitizeExternalContent } from "../security/redaction.js";
import { getEnabledToolNames } from "./registry.js";

export type ToolPolicyGroup = ToolGroupId;
export type ToolCaller = "model" | "workflow" | "api";

export type ToolCapability =
  | "kb.read"
  | "sandbox.run_python"
  | "sandbox.run_pytest"
  | "learning.read"
  | "learning.write_event"
  | "learning.update_mastery"
  | "exercise.generate"
  | "exercise.validate_generated"
  | "exercise.read_private_evaluator"
  | "practice.contract"
  | "practice.review"
  | "project.manage"
  | "project.read"
  | "project.review"
  | "resource.recommend"
  | "diagnostic.update_state";

export type ToolEvidenceResultCode =
  | "allowed_success"
  | "allowed_failure"
  | "blocked_group"
  | "blocked_tool"
  | "blocked_capability"
  | "blocked_params"
  | "blocked_caller"
  | "runtime_unavailable"
  | "runtime_timeout"
  | "runtime_error";

export type ToolRiskLevel = "low" | "medium" | "high";

export type ToolPolicyContext = {
  sessionId?: string | null;
  turnId?: string | null;
};

export type ToolPolicyDecision = {
  allowed: boolean;
  resultCode: ToolEvidenceResultCode;
  reason?: string;
  policyGroup: ToolPolicyGroup;
  caller: ToolCaller;
  toolName?: string;
  capabilities: ToolCapability[];
  riskLevel: ToolRiskLevel;
};

export type ToolExposureRule = {
  caller: ToolCaller;
  groups: readonly ToolPolicyGroup[];
};

export type ToolParamPolicyInput = {
  group: ToolPolicyGroup;
  caller: ToolCaller;
  toolName: string;
  params: unknown;
  context: ToolPolicyContext;
};

export type ToolParamPolicy = (input: ToolParamPolicyInput) => string | undefined;

export type ToolDefinition = {
  name: string;
  capabilities: readonly ToolCapability[];
  kind: "model_tool" | "workflow_action";
  riskLevel: ToolRiskLevel;
  evidencePolicy: "always" | "on_failure" | "never";
  exposure: readonly ToolExposureRule[];
  validateParams?: ToolParamPolicy;
};

export type ToolGroupPolicy = {
  group: ToolPolicyGroup;
  allowedCapabilities: readonly ToolCapability[];
  notes?: string;
};

export type ComputedToolPolicy = {
  group: ToolPolicyGroup;
  enabledBatch: EnabledBatch;
  modelVisibleTools: readonly string[];
  workflowCapabilities: readonly ToolCapability[];
  apiTools: readonly string[];
};

export const TOOL_GROUP_POLICIES: Record<ToolPolicyGroup, ToolGroupPolicy> = {
  kb_read_tools: {
    group: "kb_read_tools",
    allowedCapabilities: ["kb.read", "learning.read", "learning.write_event"],
    notes: "Concept explanation and basic KB-backed answers. Only bounded concept explanation events may be written.",
  },
  code_understanding_tools: {
    group: "code_understanding_tools",
    allowedCapabilities: ["kb.read", "sandbox.run_python", "learning.write_event"],
    notes: "Read and lightweight code execution for explanation.",
  },
  debugging_tools: {
    group: "debugging_tools",
    allowedCapabilities: ["kb.read", "sandbox.run_python", "learning.write_event"],
    notes: "Debugging assistance with Python execution. Mastery writes remain workflow-owned.",
  },
  exercise_generation_tools: {
    group: "exercise_generation_tools",
    allowedCapabilities: ["kb.read", "learning.read", "exercise.generate", "exercise.validate_generated"],
    notes: "Generate/select exercises. Generated evaluator validation is workflow-only.",
  },
  exercise_submission_tools: {
    group: "exercise_submission_tools",
    allowedCapabilities: ["sandbox.run_pytest", "exercise.read_private_evaluator", "learning.write_event", "learning.update_mastery"],
    notes: "Model calls the grading facade; private evaluator and pytest execution are workflow-only.",
  },
  agent_practice_authoring_tools: {
    group: "agent_practice_authoring_tools",
    allowedCapabilities: ["kb.read", "learning.read", "practice.contract"],
    notes: "Tutor-agent authoring of frozen review-practice contracts. No evaluator, sandbox, or mastery access.",
  },
  agent_practice_review_tools: {
    group: "agent_practice_review_tools",
    allowedCapabilities: ["learning.read", "learning.write_event", "learning.update_mastery", "sandbox.run_python", "practice.contract", "practice.review"],
    notes: "Tutor-agent review of active practice submissions using bounded sandbox evidence and server-validated progress requests.",
  },
  diagnostic_tools: {
    group: "diagnostic_tools",
    allowedCapabilities: ["learning.read", "learning.write_event", "learning.update_mastery", "diagnostic.update_state"],
    notes: "Diagnostic scoring and state updates should be workflow-owned.",
  },
  progress_read_tools: {
    group: "progress_read_tools",
    allowedCapabilities: ["learning.read"],
    notes: "Progress queries are read-only.",
  },
  resource_recommendation_tools: {
    group: "resource_recommendation_tools",
    allowedCapabilities: ["kb.read", "learning.read", "learning.write_event", "resource.recommend"],
    notes: "Recommendation creation may be workflow-owned or exposed as a bounded facade.",
  },
  project_tools: {
    group: "project_tools",
    allowedCapabilities: ["kb.read", "learning.read", "learning.write_event", "sandbox.run_pytest", "project.read", "project.manage"],
    notes: "Project tools may be model-visible; pytest remains workflow-only inside submission/review facades.",
  },
  read_only_tools: {
    group: "read_only_tools",
    allowedCapabilities: ["kb.read", "learning.read"],
    notes: "Fallback group for clarification and safe default flows.",
  },
  no_tools: {
    group: "no_tools",
    allowedCapabilities: [],
    notes: "Safety refusal and blocked routes.",
  },
};

const KB_READ_GROUPS: ToolPolicyGroup[] = [
  "kb_read_tools",
  "code_understanding_tools",
  "debugging_tools",
  "exercise_generation_tools",
  "agent_practice_authoring_tools",
  "agent_practice_review_tools",
  "resource_recommendation_tools",
  "project_tools",
  "read_only_tools",
];

const LEARNING_READ_GROUPS: ToolPolicyGroup[] = [
  "kb_read_tools",
  "exercise_generation_tools",
  "agent_practice_authoring_tools",
  "diagnostic_tools",
  "progress_read_tools",
  "resource_recommendation_tools",
  "project_tools",
  "read_only_tools",
];

const LEARNING_WRITE_GROUPS: ToolPolicyGroup[] = [
  "kb_read_tools",
  "code_understanding_tools",
  "debugging_tools",
  "exercise_submission_tools",
  "agent_practice_review_tools",
  "diagnostic_tools",
  "resource_recommendation_tools",
  "project_tools",
];

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  kb_overview: modelTool("kb_overview", ["kb.read"], KB_READ_GROUPS),
  kb_search: modelTool("kb_search", ["kb.read"], KB_READ_GROUPS),
  kb_read_concept: modelTool("kb_read_concept", ["kb.read"], KB_READ_GROUPS),
  kb_read_summary: modelTool("kb_read_summary", ["kb.read"], KB_READ_GROUPS),
  kb_read_file: modelTool("kb_read_file", ["kb.read"], KB_READ_GROUPS),
  kb_get_page_content: modelTool("kb_get_page_content", ["kb.read"], KB_READ_GROUPS),
  kb_read_image: modelTool("kb_read_image", ["kb.read"], KB_READ_GROUPS),
  kb_lint_status: modelTool("kb_lint_status", ["kb.read"], KB_READ_GROUPS),
  run_python: {
    name: "run_python",
    capabilities: ["sandbox.run_python"],
    kind: "model_tool",
    riskLevel: "high",
    evidencePolicy: "always",
    exposure: [
      { caller: "model", groups: ["code_understanding_tools", "debugging_tools"] },
      { caller: "workflow", groups: ["code_understanding_tools", "debugging_tools"] },
      { caller: "api", groups: ["code_understanding_tools", "debugging_tools"] },
    ],
    validateParams: validateRunPythonParams,
  },
  run_pytest: {
    name: "run_pytest",
    capabilities: ["sandbox.run_pytest"],
    kind: "workflow_action",
    riskLevel: "high",
    evidencePolicy: "always",
    exposure: [{ caller: "workflow", groups: ["exercise_submission_tools", "project_tools"] }],
    validateParams: validateRunPytestParams,
  },
  read_private_evaluator: {
    name: "read_private_evaluator",
    capabilities: ["exercise.read_private_evaluator"],
    kind: "workflow_action",
    riskLevel: "high",
    evidencePolicy: "always",
    exposure: [{ caller: "workflow", groups: ["exercise_submission_tools"] }],
    validateParams: validatePrivateEvaluatorParams,
  },
  validate_generated_exercise: {
    name: "validate_generated_exercise",
    capabilities: ["exercise.validate_generated"],
    kind: "workflow_action",
    riskLevel: "high",
    evidencePolicy: "always",
    exposure: [{ caller: "workflow", groups: ["exercise_generation_tools"] }],
  },
  select_exercise: workflowTool("select_exercise", ["exercise.generate"], ["exercise_generation_tools"], "medium", ["api"]),
  grade_submission: workflowTool("grade_submission", ["sandbox.run_pytest", "exercise.read_private_evaluator", "learning.write_event", "learning.update_mastery"], ["exercise_submission_tools"], "high", ["api"]),
  create_practice_contract: modelTool("create_practice_contract", ["practice.contract"], ["agent_practice_authoring_tools"], "medium", validatePracticeContractParams),
  get_active_practice_contract: modelTool("get_active_practice_contract", ["practice.contract", "learning.read"], ["agent_practice_review_tools"], "low", validateServerOwnedTurnParams),
  check_python_syntax: modelTool("check_python_syntax", ["sandbox.run_python", "practice.review"], ["agent_practice_review_tools"], "medium", validatePracticeReviewExecutionParams),
  run_student_code: modelTool("run_student_code", ["sandbox.run_python", "practice.review"], ["agent_practice_review_tools"], "high", validatePracticeReviewExecutionParams),
  run_review_probe: modelTool("run_review_probe", ["sandbox.run_python", "practice.review"], ["agent_practice_review_tools"], "high", validatePracticeReviewProbeParams),
  record_agent_review: modelTool("record_agent_review", ["practice.review", "learning.write_event"], ["agent_practice_review_tools"], "medium", validateRecordAgentReviewParams),
  request_learning_progress_update: modelTool("request_learning_progress_update", ["practice.review", "learning.update_mastery"], ["agent_practice_review_tools"], "high", validateReviewProgressRequestParams),
  get_student_profile: modelTool("get_student_profile", ["learning.read"], LEARNING_READ_GROUPS),
  get_concept_mastery: modelTool("get_concept_mastery", ["learning.read"], LEARNING_READ_GROUPS),
  get_recent_learning_context: modelTool("get_recent_learning_context", ["learning.read"], LEARNING_READ_GROUPS),
  record_learning_event: modelTool("record_learning_event", ["learning.write_event"], LEARNING_WRITE_GROUPS, "medium", validateLearningWriteParams),
  tag_mistake: modelTool("tag_mistake", ["learning.write_event"], ["debugging_tools", "exercise_submission_tools"], "medium"),
  update_mastery: {
    name: "update_mastery",
    capabilities: ["learning.update_mastery"],
    kind: "workflow_action",
    riskLevel: "high",
    evidencePolicy: "always",
    exposure: [{ caller: "workflow", groups: ["exercise_submission_tools", "diagnostic_tools", "project_tools"] }],
    validateParams: validateMasteryUpdateParams,
  },
  create_project_plan: withApiExposure(modelTool("create_project_plan", ["project.manage"], ["project_tools"], "medium"), ["project_tools"]),
  get_project_state: modelTool("get_project_state", ["project.read"], ["project_tools"]),
  recommend_project_next_step: modelTool("recommend_project_next_step", ["project.manage"], ["project_tools"], "medium"),
  submit_project_step: withApiExposure(modelTool("submit_project_step", ["project.manage"], ["project_tools"], "high"), ["project_tools"]),
  review_project_code: modelTool("review_project_code", ["project.manage"], ["project_tools"], "medium"),
  record_project_progress: modelTool("record_project_progress", ["project.manage", "learning.write_event"], ["project_tools"], "medium"),
};

export function getPolicyForGroup(group: ToolGroupId | string | undefined): ToolGroupPolicy {
  return TOOL_GROUP_POLICIES[normalizeToolGroup(group)];
}

export function getPolicyForRoute(route: Pick<IntentRoute, "allowed_tool_group"> | undefined): ToolGroupPolicy {
  return getPolicyForGroup(route?.allowed_tool_group);
}

export function normalizeToolGroup(group: ToolGroupId | string | undefined): ToolPolicyGroup {
  return group && group in TOOL_GROUP_POLICIES ? group as ToolPolicyGroup : "no_tools";
}

export function getModelVisibleTools(input: { group: ToolPolicyGroup; enabledBatch: EnabledBatch }): string[] {
  const enabled = new Set(getEnabledToolNames(input.enabledBatch));
  const policy = getPolicyForGroup(input.group);
  return Object.values(TOOL_REGISTRY)
    .filter((tool) => tool.kind === "model_tool")
    .filter((tool) => tool.capabilities.every((capability) => policy.allowedCapabilities.includes(capability)))
    .filter((tool) => hasExposure(tool, "model", policy.group))
    .filter((tool) => enabled.has(tool.name))
    .map((tool) => tool.name);
}

export function computeToolPolicy(input: { group: ToolPolicyGroup; enabledBatch: EnabledBatch }): ComputedToolPolicy {
  const policy = getPolicyForGroup(input.group);
  return {
    group: policy.group,
    enabledBatch: input.enabledBatch,
    modelVisibleTools: getModelVisibleTools(input),
    workflowCapabilities: policy.allowedCapabilities.filter((capability) => hasWorkflowCapability(capability, policy.group)),
    apiTools: Object.values(TOOL_REGISTRY)
      .filter((tool) => hasExposure(tool, "api", policy.group))
      .filter((tool) => tool.capabilities.every((capability) => policy.allowedCapabilities.includes(capability)))
      .map((tool) => tool.name),
  };
}

export function validateToolCallPolicy(input: {
  group: ToolGroupId | string | undefined;
  caller: ToolCaller;
  enabledBatch: EnabledBatch;
  toolName: string;
  params: unknown;
  context: ToolPolicyContext;
}): ToolPolicyDecision {
  const policy = getPolicyForGroup(input.group);
  const tool = TOOL_REGISTRY[input.toolName];
  if (!tool) {
    return deny("blocked_tool", policy.group, input.caller, input.toolName, [], "Unknown tool", "medium");
  }
  if (!tool.capabilities.every((capability) => policy.allowedCapabilities.includes(capability))) {
    return deny("blocked_capability", policy.group, input.caller, input.toolName, [...tool.capabilities], "Capability is not allowed for this group", tool.riskLevel);
  }
  if (!hasExposure(tool, input.caller, policy.group)) {
    return deny("blocked_caller", policy.group, input.caller, input.toolName, [...tool.capabilities], "Caller is not allowed for this tool", tool.riskLevel);
  }
  if ((input.caller === "model" || input.caller === "api") && !getEnabledToolNames(input.enabledBatch).includes(input.toolName)) {
    return deny("blocked_tool", policy.group, input.caller, input.toolName, [...tool.capabilities], "Tool is not enabled by the active batch", tool.riskLevel);
  }
  const paramError = tool.validateParams?.({
    group: policy.group,
    caller: input.caller,
    toolName: input.toolName,
    params: input.params,
    context: input.context,
  });
  if (paramError) {
    return deny("blocked_params", policy.group, input.caller, input.toolName, [...tool.capabilities], paramError, tool.riskLevel);
  }
  return {
    allowed: true,
    resultCode: "allowed_success",
    policyGroup: policy.group,
    caller: input.caller,
    toolName: input.toolName,
    capabilities: [...tool.capabilities],
    riskLevel: tool.riskLevel,
  };
}

export function validateWorkflowCapability(input: {
  group: ToolGroupId | string | undefined;
  capability: ToolCapability;
  caller: "workflow" | "api";
  params: unknown;
  context: ToolPolicyContext;
}): ToolPolicyDecision {
  const policy = getPolicyForGroup(input.group);
  if (!policy.allowedCapabilities.includes(input.capability)) {
    return deny("blocked_capability", policy.group, input.caller, undefined, [input.capability], "Capability is not allowed for this group", "high");
  }
  return {
    allowed: true,
    resultCode: "allowed_success",
    policyGroup: policy.group,
    caller: input.caller,
    capabilities: [input.capability],
    riskLevel: "high",
  };
}

export function sanitizeToolEnvelopeForEvidence(envelope: ToolEnvelope): unknown {
  return {
    ok: envelope.ok,
    code: envelope.code,
    message: sanitizeToolOutput(envelope.message, 300),
    data: sanitizeToolOutput(envelope.data, 700),
  };
}

export function sanitizeToolOutput(value: unknown, maxStringLength = 1200): unknown {
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeToolOutput(item, maxStringLength));
  }
  if (!value || typeof value !== "object") {
    if (typeof value === "string") return sanitizeExternalContent(value, maxStringLength);
    return value;
  }
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (/hidden|secret|token|key|password|private|evaluator|reference_solution|probe|assert|path/i.test(key)) {
      result[key] = "[redacted]";
    } else if (typeof item === "string" && /stderr|traceback/i.test(key)) {
      result[key] = sanitizeExternalContent(redactSandboxSourceLines(item), maxStringLength);
    } else if (typeof item === "string" && /stdout/i.test(key)) {
      result[key] = sanitizeExternalContent(item, Math.min(maxStringLength, 240));
    } else {
      result[key] = sanitizeToolOutput(item, maxStringLength);
    }
  }
  return result;
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

export function assertToolPolicyInvariants(): void {
  const errors: string[] = [];
  const groupNames = Object.keys(TOOL_GROUP_POLICIES).sort();
  const expectedGroups: ToolGroupId[] = [
    "kb_read_tools",
    "code_understanding_tools",
    "debugging_tools",
    "exercise_generation_tools",
    "exercise_submission_tools",
    "agent_practice_authoring_tools",
    "agent_practice_review_tools",
    "diagnostic_tools",
    "progress_read_tools",
    "resource_recommendation_tools",
    "project_tools",
    "read_only_tools",
    "no_tools",
  ];
  if (JSON.stringify(groupNames) !== JSON.stringify([...expectedGroups].sort())) {
    errors.push("Tool group policy coverage does not match ToolGroupId.");
  }
  for (const tool of Object.values(TOOL_REGISTRY)) {
    for (const exposure of tool.exposure) {
      for (const group of exposure.groups) {
        if (!(group in TOOL_GROUP_POLICIES)) errors.push(`${tool.name} references unknown group ${group}`);
      }
    }
  }
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}

function modelTool(
  name: string,
  capabilities: readonly ToolCapability[],
  groups: readonly ToolPolicyGroup[],
  riskLevel: ToolRiskLevel = "low",
  validateParams?: ToolParamPolicy,
): ToolDefinition {
  return {
    name,
    capabilities,
    kind: "model_tool",
    riskLevel,
    evidencePolicy: "always",
    exposure: [{ caller: "model", groups }],
    validateParams,
  };
}

function withApiExposure(tool: ToolDefinition, groups: readonly ToolPolicyGroup[]): ToolDefinition {
  return {
    ...tool,
    exposure: [...tool.exposure, { caller: "api", groups }],
  };
}

function workflowTool(
  name: string,
  capabilities: readonly ToolCapability[],
  groups: readonly ToolPolicyGroup[],
  riskLevel: ToolRiskLevel = "low",
  extraCallers: Array<"api"> = [],
): ToolDefinition {
  return {
    name,
    capabilities,
    kind: "workflow_action",
    riskLevel,
    evidencePolicy: "always",
    exposure: [
      { caller: "workflow", groups },
      ...extraCallers.map((caller) => ({ caller, groups })),
    ],
  };
}

function hasExposure(tool: ToolDefinition, caller: ToolCaller, group: ToolPolicyGroup): boolean {
  return tool.exposure.some((rule) => rule.caller === caller && rule.groups.includes(group));
}

function hasWorkflowCapability(capability: ToolCapability, group: ToolPolicyGroup): boolean {
  return Object.values(TOOL_REGISTRY).some((tool) =>
    tool.kind === "workflow_action"
    && tool.capabilities.includes(capability)
    && hasExposure(tool, "workflow", group),
  );
}

function deny(
  resultCode: ToolEvidenceResultCode,
  policyGroup: ToolPolicyGroup,
  caller: ToolCaller,
  toolName: string | undefined,
  capabilities: ToolCapability[],
  reason: string,
  riskLevel: ToolRiskLevel,
): ToolPolicyDecision {
  return { allowed: false, resultCode, reason, policyGroup, caller, toolName, capabilities, riskLevel };
}

function validateRunPythonParams(input: ToolParamPolicyInput): string | undefined {
  if (!input.params || typeof input.params !== "object") return "Parameters must be an object";
  const params = input.params as Record<string, unknown>;
  if (typeof params.code !== "string" || params.code.length === 0 || params.code.length > 20_000) {
    return "Python code is missing or too large";
  }
  if ("public_tests" in params || "hidden_tests" in params || "hidden_tests_ref" in params || "evaluator_private_ref" in params) {
    return "Python execution cannot receive evaluator or hidden-test material";
  }
  const files = params.files;
  if (files !== undefined) {
    if (!Array.isArray(files) || files.length > 10) return "Files must be a bounded array";
    try {
      for (const file of files) {
        if (!file || typeof file !== "object" || typeof (file as { path?: unknown }).path !== "string") return "Each file needs a path";
        assertSandboxFilePath((file as { path: string }).path);
      }
    } catch {
      return "File path is outside the sandbox workspace";
    }
  }
  return undefined;
}

function validateRunPytestParams(input: ToolParamPolicyInput): string | undefined {
  if (input.caller !== "workflow") return "Pytest execution is workflow-only";
  if (!input.params || typeof input.params !== "object") return "Parameters must be an object";
  const params = input.params as Record<string, unknown>;
  if (typeof params.code !== "string" || params.code.length === 0 || params.code.length > 30_000) {
    return "Pytest code is missing or too large";
  }
  if (typeof params.public_tests !== "string" || params.public_tests.length === 0 || params.public_tests.length > 30_000) {
    return "Pytest tests are missing or too large";
  }
  if ("hidden_tests" in params || "hidden_tests_ref" in params || "evaluator_private_ref" in params) {
    return "Private evaluator references cannot be supplied to pytest";
  }
  const policy = params.policy;
  if (!policy || typeof policy !== "object") return "Workflow pytest requires server-owned test source metadata";
  const testSource = (policy as { test_source?: unknown }).test_source;
  const allowedSources = input.group === "project_tools"
    ? ["project_step_definition"]
    : ["exercise_evaluator", "generated_exercise_evaluator"];
  if (typeof testSource !== "string" || !allowedSources.includes(testSource)) {
    return "Workflow pytest test source is not allowed for this group";
  }
  return undefined;
}

function requireServerOwnedTurn(input: ToolParamPolicyInput): string | undefined {
  if (!input.context.sessionId || !input.context.turnId) {
    return "Server-owned session and turn context are required";
  }
  return undefined;
}

function validateServerOwnedTurnParams(input: ToolParamPolicyInput): string | undefined {
  const contextError = requireServerOwnedTurn(input);
  if (contextError) return contextError;
  if (input.params !== undefined && (!input.params || typeof input.params !== "object")) return "Parameters must be an object";
  return undefined;
}

function validatePracticeContractParams(input: ToolParamPolicyInput): string | undefined {
  const contextError = requireServerOwnedTurn(input);
  if (contextError) return contextError;
  if (!input.params || typeof input.params !== "object") return "Parameters must be an object";
  const params = input.params as Record<string, unknown>;
  if ("session_id" in params || "turn_id" in params || "evaluator_private_ref" in params || "hidden_tests" in params || "private_solution" in params) {
    return "Practice contract cannot supply server-owned identifiers or private grading material";
  }
  const conceptIds = params.concept_ids;
  if (!Array.isArray(conceptIds) || conceptIds.length === 0 || conceptIds.length > 5 || conceptIds.some((item) => typeof item !== "string" || item.length === 0 || item.length > 80)) {
    return "Practice contract concept ids must be bounded";
  }
  for (const key of ["title", "prompt_md", "expected_behavior", "review_rubric"] as const) {
    if (typeof params[key] !== "string" || params[key].length === 0 || params[key].length > (key === "prompt_md" ? 4000 : 1000)) {
      return `Practice contract ${key} is missing or too large`;
    }
  }
  const checklist = params.acceptance_checklist;
  if (!Array.isArray(checklist) || checklist.length === 0 || checklist.length > 8 || checklist.some((item) => typeof item !== "string" || item.length === 0 || item.length > 300)) {
    return "Practice contract acceptance checklist must be bounded";
  }
  if (typeof params.difficulty !== "number" || params.difficulty < 1 || params.difficulty > 5) {
    return "Practice contract difficulty must be between 1 and 5";
  }
  if (typeof params.progress_eligible !== "boolean") {
    return "Practice contract progress eligibility is required";
  }
  return undefined;
}

function validatePracticeReviewExecutionParams(input: ToolParamPolicyInput): string | undefined {
  const contextError = requireServerOwnedTurn(input);
  if (contextError) return contextError;
  if (!input.params || typeof input.params !== "object") return "Parameters must be an object";
  const params = input.params as Record<string, unknown>;
  if ("public_tests" in params || "hidden_tests" in params || "hidden_tests_ref" in params || "evaluator_private_ref" in params || "private_solution" in params) {
    return "Review execution cannot receive evaluator or hidden-test material";
  }
  const contractId = params.practice_contract_id;
  if (contractId !== undefined && (typeof contractId !== "string" || contractId.length > 120)) {
    return "Practice contract id is too large";
  }
  const code = params.code;
  if (code !== undefined && (typeof code !== "string" || code.length === 0 || code.length > 20_000)) {
    return "Review execution code is missing or too large";
  }
  return undefined;
}

function validatePracticeReviewProbeParams(input: ToolParamPolicyInput): string | undefined {
  const executionError = validatePracticeReviewExecutionParams(input);
  if (executionError) return executionError;
  const params = input.params as Record<string, unknown>;
  const probeCode = params.probe_code;
  if (typeof probeCode !== "string" || probeCode.length === 0 || probeCode.length > 4000) {
    return "Review probe code is missing or too large";
  }
  if (/\b(open|exec|eval|compile|__import__|subprocess|socket|requests)\b/.test(probeCode)) {
    return "Review probe uses unsupported dynamic or host-access operations";
  }
  return undefined;
}

function validateRecordAgentReviewParams(input: ToolParamPolicyInput): string | undefined {
  const contextError = requireServerOwnedTurn(input);
  if (contextError) return contextError;
  if (!input.params || typeof input.params !== "object") return "Parameters must be an object";
  const params = input.params as Record<string, unknown>;
  if (typeof params.practice_contract_id !== "string" || params.practice_contract_id.length === 0 || params.practice_contract_id.length > 120) {
    return "Practice contract id is required";
  }
  if (!["passed", "partial", "needs_revision", "blocked_by_error"].includes(String(params.review_status))) {
    return "Review status is not allowed";
  }
  if (!["high", "medium", "low"].includes(String(params.confidence))) {
    return "Review confidence is not allowed";
  }
  if (typeof params.learner_facing_summary !== "string" || params.learner_facing_summary.length === 0 || params.learner_facing_summary.length > 1200) {
    return "Review summary is missing or too large";
  }
  return undefined;
}

function validateReviewProgressRequestParams(input: ToolParamPolicyInput): string | undefined {
  const contextError = requireServerOwnedTurn(input);
  if (contextError) return contextError;
  if (!input.params || typeof input.params !== "object") return "Parameters must be an object";
  const params = input.params as Record<string, unknown>;
  if (typeof params.review_id !== "string" || params.review_id.length === 0 || params.review_id.length > 120) {
    return "Review id is required";
  }
  const forbidden = ["score", "mastery", "mastery_level", "readiness", "evidence_weight", "projection", "concept_ids", "outcome"];
  if (forbidden.some((key) => key in params)) {
    return "Progress request cannot supply projection values";
  }
  return undefined;
}

function validateLearningWriteParams(input: ToolParamPolicyInput): string | undefined {
  if (!input.params || typeof input.params !== "object") return "Parameters must be an object";
  const params = input.params as Record<string, unknown>;
  if (typeof params.event_type !== "string") return "Learning event type is required";
  const evidence = params.evidence;
  const sessionTurnId = evidence && typeof evidence === "object"
    ? (evidence as { session_turn_id?: unknown }).session_turn_id
    : undefined;
  if (input.context.turnId && sessionTurnId !== input.context.turnId) {
    return "Learning event must belong to the current server-owned turn";
  }
  if (input.group === "kb_read_tools") {
    if (input.caller !== "model") return "Concept explanation learning events are model-only";
    if (!input.context.turnId) return "Concept explanation events require a server-owned current turn";
    if (params.event_type !== "concept_explained") {
      return "Concept explanation flows may only record concept_explained events";
    }
    const conceptIds = params.concept_ids;
    if (!Array.isArray(conceptIds) || conceptIds.length === 0 || conceptIds.length > 5 || conceptIds.some((item) => typeof item !== "string")) {
      return "Concept explanation events need bounded concept ids";
    }
    const summary = evidence && typeof evidence === "object" ? (evidence as { summary?: unknown }).summary : undefined;
    if (typeof summary !== "string" || summary.trim().length === 0 || summary.length > 1000) {
      return "Concept explanation evidence summary is required and bounded";
    }
  }
  if (params.event_type === "diagnostic_completed" && input.caller === "model") {
    return "Diagnostic completion is workflow-owned";
  }
  return undefined;
}

function validatePrivateEvaluatorParams(input: ToolParamPolicyInput): string | undefined {
  if (input.caller !== "workflow") return "Private evaluator reads are workflow-only";
  if (!input.params || typeof input.params !== "object") return "Parameters must be an object";
  const params = input.params as Record<string, unknown>;
  if (typeof params.exercise_id !== "string" || params.exercise_id.length === 0) return "Exercise id is required";
  const policy = params.policy;
  if (!policy || typeof policy !== "object" || (policy as { evaluator_visibility?: unknown }).evaluator_visibility !== "private") {
    return "Private evaluator reads require private evaluator metadata";
  }
  return undefined;
}

function validateMasteryUpdateParams(input: ToolParamPolicyInput): string | undefined {
  if (input.caller !== "workflow") return "Mastery updates are workflow-owned";
  if (!input.params || typeof input.params !== "object") return "Parameters must be an object";
  const evidence = (input.params as { evidence?: unknown }).evidence;
  if (!evidence || typeof evidence !== "object") return "Mastery updates require evaluation evidence";
  const record = evidence as { attempt_id?: unknown; tool_call_id?: unknown };
  if (typeof record.attempt_id !== "string" && typeof record.tool_call_id !== "string") {
    return "Mastery updates require server-owned attempt or tool evidence";
  }
  return undefined;
}

export function sanitizePolicyReason(reason: string | undefined): string | undefined {
  return reason ? redactText(reason, 300) : undefined;
}

assertToolPolicyInvariants();
