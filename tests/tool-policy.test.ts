import { describe, expect, it } from "vitest";
import type { ToolGroupId } from "../src/types.js";
import {
  getModelVisibleTools,
  getPolicyForRoute,
  TOOL_GROUP_POLICIES,
  TOOL_REGISTRY,
  validateToolCallPolicy,
} from "../src/tools/tool-policy.js";

const ALL_TOOL_GROUPS: ToolGroupId[] = [
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

describe("tool policy", () => {
  it("covers every current ToolGroupId exactly once", () => {
    expect(Object.keys(TOOL_GROUP_POLICIES).sort()).toEqual([...ALL_TOOL_GROUPS].sort());
    expect(getPolicyForRoute({ allowed_tool_group: "debugging_tools" }).group).toBe("debugging_tools");
    expect(getPolicyForRoute(undefined).group).toBe("no_tools");
  });

  it("derives model-visible tools from group policy and enabled batch", () => {
    const batchCReadOnly = getModelVisibleTools({ group: "read_only_tools", enabledBatch: "batch-c" });
    expect(batchCReadOnly).toContain("kb_search");
    expect(batchCReadOnly).toContain("get_student_profile");
    expect(batchCReadOnly).not.toContain("kb_read_image");
    expect(batchCReadOnly).not.toContain("kb_lint_status");

    const fullReadOnly = getModelVisibleTools({ group: "read_only_tools", enabledBatch: "full" });
    expect(fullReadOnly).toContain("kb_read_image");
    expect(fullReadOnly).toContain("kb_lint_status");
  });

  it("keeps trusted exercise selection, grading, pytest, private evaluator, and mastery updates workflow-only", () => {
    const generationTools = getModelVisibleTools({ group: "exercise_generation_tools", enabledBatch: "full" });
    expect(generationTools).not.toContain("select_exercise");

    const exerciseTools = getModelVisibleTools({ group: "exercise_submission_tools", enabledBatch: "full" });
    expect(exerciseTools).not.toContain("grade_submission");
    expect(exerciseTools).toContain("tag_mistake");
    expect(exerciseTools).not.toContain("run_pytest");
    expect(exerciseTools).not.toContain("read_private_evaluator");
    expect(exerciseTools).not.toContain("update_mastery");

    const debugTools = getModelVisibleTools({ group: "debugging_tools", enabledBatch: "full" });
    expect(debugTools).toContain("run_python");
    expect(debugTools).not.toContain("run_pytest");
    expect(debugTools).not.toContain("update_mastery");
  });

  it("exposes bounded agentic practice tools while denying raw grading and private material", () => {
    const authoringTools = getModelVisibleTools({ group: "agent_practice_authoring_tools", enabledBatch: "full" });
    expect(authoringTools).toEqual(expect.arrayContaining([
      "get_recent_learning_context",
      "create_practice_contract",
    ]));
    expect(authoringTools).not.toContain("select_exercise");
    expect(authoringTools).not.toContain("grade_submission");

    const reviewTools = getModelVisibleTools({ group: "agent_practice_review_tools", enabledBatch: "full" });
    expect(reviewTools).toEqual(expect.arrayContaining([
      "get_active_practice_contract",
      "check_python_syntax",
      "run_student_code",
      "run_review_probe",
      "record_agent_review",
      "request_learning_progress_update",
    ]));
    expect(reviewTools).not.toContain("run_pytest");
    expect(reviewTools).not.toContain("read_private_evaluator");
    expect(reviewTools).not.toContain("update_mastery");

    const rawGrading = validateToolCallPolicy({
      group: "agent_practice_review_tools",
      caller: "model",
      enabledBatch: "full",
      toolName: "run_pytest",
      params: { code: "print('x')", public_tests: "def test_x(): pass" },
      context: { sessionId: "sess_1", turnId: "turn_1" },
    });
    expect(rawGrading.allowed).toBe(false);
    expect(["blocked_caller", "blocked_capability"]).toContain(rawGrading.resultCode);
  });

  it("requires server-owned turn context for agentic practice contract and review progress tools", () => {
    const missingContext = validateToolCallPolicy({
      group: "agent_practice_authoring_tools",
      caller: "model",
      enabledBatch: "full",
      toolName: "create_practice_contract",
      params: {
        concept_ids: ["loop"],
        title: "Loop practice",
        prompt_md: "Print 2 and 4.",
        expected_behavior: "stdout contains 2 and 4",
        acceptance_checklist: ["code runs"],
        review_rubric: "Use run evidence.",
        difficulty: 1,
        progress_eligible: true,
      },
      context: {},
    });
    expect(missingContext.allowed).toBe(false);
    expect(missingContext.resultCode).toBe("blocked_params");

    const boundedContract = validateToolCallPolicy({
      group: "agent_practice_authoring_tools",
      caller: "model",
      enabledBatch: "full",
      toolName: "create_practice_contract",
      params: {
        concept_ids: ["loop"],
        title: "Loop practice",
        prompt_md: "Print 2 and 4.",
        expected_behavior: "stdout contains 2 and 4",
        acceptance_checklist: ["code runs"],
        review_rubric: "Use run evidence.",
        difficulty: 1,
        progress_eligible: true,
      },
      context: { sessionId: "sess_1", turnId: "turn_1" },
    });
    expect(boundedContract.allowed).toBe(true);

    const arbitraryProgress = validateToolCallPolicy({
      group: "agent_practice_review_tools",
      caller: "model",
      enabledBatch: "full",
      toolName: "request_learning_progress_update",
      params: {
        review_id: "apr_1",
        mastery_level: 100,
        evidence_weight: 999,
      },
      context: { sessionId: "sess_1", turnId: "turn_1" },
    });
    expect(arbitraryProgress.allowed).toBe(false);
    expect(arbitraryProgress.resultCode).toBe("blocked_params");
  });

  it("blocks model callers from workflow-only pytest even in pytest-capable groups", () => {
    const decision = validateToolCallPolicy({
      group: "exercise_submission_tools",
      caller: "model",
      enabledBatch: "full",
      toolName: "run_pytest",
      params: { code: "print('x')", public_tests: "def test_x(): pass" },
      context: {},
    });

    expect(decision.allowed).toBe(false);
    expect(decision.resultCode).toBe("blocked_caller");
  });

  it("blocks model callers from trusted exercise selection and grading facades", () => {
    const selection = validateToolCallPolicy({
      group: "exercise_generation_tools",
      caller: "model",
      enabledBatch: "full",
      toolName: "select_exercise",
      params: { concept_ids: ["loop"], difficulty: 2 },
      context: { sessionId: "sess_1", turnId: "turn_1" },
    });
    expect(selection.allowed).toBe(false);
    expect(selection.resultCode).toBe("blocked_caller");

    const grading = validateToolCallPolicy({
      group: "exercise_submission_tools",
      caller: "model",
      enabledBatch: "full",
      toolName: "grade_submission",
      params: { exercise_id: "ex_1", code: "print(1)", evaluator_private_ref: "secret" },
      context: { sessionId: "sess_1", turnId: "turn_1" },
    });
    expect(grading.allowed).toBe(false);
    expect(grading.resultCode).toBe("blocked_caller");
  });

  it("requires server-owned test source metadata before workflow pytest is allowed", () => {
    const missingSource = validateToolCallPolicy({
      group: "project_tools",
      caller: "workflow",
      enabledBatch: "full",
      toolName: "run_pytest",
      params: { code: "print('x')", public_tests: "def test_x(): pass" },
      context: {},
    });
    expect(missingSource.allowed).toBe(false);
    expect(missingSource.resultCode).toBe("blocked_params");

    const withSource = validateToolCallPolicy({
      group: "project_tools",
      caller: "workflow",
      enabledBatch: "full",
      toolName: "run_pytest",
      params: {
        code: "print('x')",
        public_tests: "def test_x(): pass",
        policy: { test_source: "project_step_definition", evaluator_visibility: "public" },
      },
      context: {},
    });
    expect(withSource.allowed).toBe(true);
  });

  it("requires server-owned evaluation evidence for workflow mastery updates", () => {
    const missingEvidence = validateToolCallPolicy({
      group: "exercise_submission_tools",
      caller: "workflow",
      enabledBatch: "full",
      toolName: "update_mastery",
      params: {
        turn_id: "turn_1",
        concept_ids: ["loop"],
        outcome: "completed_with_hint",
        evidence: { summary: "natural language is not enough" },
      },
      context: {},
    });
    expect(missingEvidence.allowed).toBe(false);
    expect(missingEvidence.resultCode).toBe("blocked_params");

    const withAttempt = validateToolCallPolicy({
      group: "exercise_submission_tools",
      caller: "workflow",
      enabledBatch: "full",
      toolName: "update_mastery",
      params: {
        turn_id: "turn_1",
        concept_ids: ["loop"],
        outcome: "completed_with_hint",
        evidence: { attempt_id: "att_1", summary: "graded exercise attempt" },
      },
      context: {},
    });
    expect(withAttempt.allowed).toBe(true);
  });

  it("does not expose workflow-only registry entries as model tools", () => {
    const workflowOnly = Object.values(TOOL_REGISTRY)
      .filter((tool) => tool.kind === "workflow_action")
      .map((tool) => tool.name);
    const allModelTools = new Set(ALL_TOOL_GROUPS.flatMap((group) => getModelVisibleTools({ group, enabledBatch: "full" })));

    for (const toolName of workflowOnly) {
      expect(allModelTools.has(toolName)).toBe(false);
    }
    expect(workflowOnly).toContain("read_private_evaluator");
    expect(workflowOnly).toContain("update_mastery");
  });

  it("allows only bounded concept explanation learning events in kb read tools", () => {
    const conceptExplained = validateToolCallPolicy({
      group: "kb_read_tools",
      caller: "model",
      enabledBatch: "full",
      toolName: "record_learning_event",
      params: {
        event_type: "concept_explained",
        concept_ids: ["loop"],
        evidence: { session_turn_id: "turn_current", summary: "解释循环" },
      },
      context: { turnId: "turn_current" },
    });
    expect(conceptExplained.allowed).toBe(true);

    const wrongTurn = validateToolCallPolicy({
      group: "kb_read_tools",
      caller: "model",
      enabledBatch: "full",
      toolName: "record_learning_event",
      params: {
        event_type: "concept_explained",
        concept_ids: ["loop"],
        evidence: { session_turn_id: "turn_other", summary: "解释循环" },
      },
      context: { turnId: "turn_current" },
    });
    expect(wrongTurn.allowed).toBe(false);
    expect(wrongTurn.resultCode).toBe("blocked_params");

    const missingServerTurn = validateToolCallPolicy({
      group: "kb_read_tools",
      caller: "model",
      enabledBatch: "full",
      toolName: "record_learning_event",
      params: {
        event_type: "concept_explained",
        concept_ids: ["loop"],
        evidence: { session_turn_id: "turn_current", summary: "解释循环" },
      },
      context: {},
    });
    expect(missingServerTurn.allowed).toBe(false);
    expect(missingServerTurn.resultCode).toBe("blocked_params");

    const diagnosticCompleted = validateToolCallPolicy({
      group: "kb_read_tools",
      caller: "model",
      enabledBatch: "full",
      toolName: "record_learning_event",
      params: {
        event_type: "diagnostic_completed",
        concept_ids: ["loop"],
        evidence: { session_turn_id: "turn_current", summary: "不能在概念解释里完成诊断" },
      },
      context: { turnId: "turn_current" },
    });
    expect(diagnosticCompleted.allowed).toBe(false);
    expect(diagnosticCompleted.resultCode).toBe("blocked_params");

    const masteryUpdate = validateToolCallPolicy({
      group: "kb_read_tools",
      caller: "model",
      enabledBatch: "full",
      toolName: "update_mastery",
      params: {
        turn_id: "turn_current",
        concept_ids: ["loop"],
        outcome: "completed_with_hint",
        evidence: { attempt_id: "att_1", summary: "不允许" },
      },
      context: { turnId: "turn_current" },
    });
    expect(masteryUpdate.allowed).toBe(false);
  });
});
