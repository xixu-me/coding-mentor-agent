import { describe, expect, it } from "vitest";
import { createSession, getSessionSnapshot, postMessage, startDiagnosticGuidance } from "../src/server/services.js";
import { deriveLearningFrontier } from "../src/server/learning-frontier.js";
import { deriveGuidanceLoopState } from "../src/server/guidance-loop-state.js";
import { validateTutorAgentAction } from "../src/server/tutor-agent-runtime.js";
import { prepareTurnModelContext } from "../src/server/context-management.js";
import { persistPracticeOutcome, requestExplicitPractice } from "../src/server/practice-workflow.js";
import { createPracticeContract, recordAgentReview, requestLearningProgressUpdate } from "../src/tools/agentic-practice-tools.js";
import { getLatestCatalogRun } from "../src/server/course-catalog.js";
import { recordGuidedAnswerJudgement, saveTutorAgentFrontierSnapshot } from "../src/server/tutor-agent-store.js";
import { exportLocalData } from "../src/server/data-management.js";
import { createId, nowIso } from "../src/security/ids.js";
import { createTestRuntime } from "./utils/runtime.js";
import { insertGeneratedExerciseFixture, upsertMasteryFixture } from "./utils/content-fixtures.js";
import type { LearningFrontier } from "../src/types.js";

describe("KB-grounded tutor agent", () => {
  it("starts guidance by creating or resuming tutor agent state and persisting the first accepted action", async () => {
    let tutorCalls = 0;
    const runtime = await createTestRuntime({
      tutor: {
        generate: async () => {
          tutorCalls += 1;
          return JSON.stringify(tutorCalls === 1
            ? {
                action_kind: "explain_concept",
                concept_id: "string",
                rationale: "诊断确认从字符串开始。",
                learner_facing_response: "我们先看字符串。字符串就是一段文本，先观察引号包住的值。",
                expected_learning_signal: "learner_can_identify_string_literal",
              }
            : {
                action_kind: "ask_guided_question",
                concept_id: "string",
                rationale: "The concept has been explained, so ask a bounded guided question.",
                learner_facing_response: "请用一句话说明字符串解决什么问题，并给一个最小例子。",
                expected_learning_signal: "learner_answers_string_guided_question",
              });
        },
      },
    });
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "string");

    const first = await startDiagnosticGuidance(runtime, session.session_id);
    const second = await startDiagnosticGuidance(runtime, session.session_id);

    expect(second.turn_id).not.toBe(first.turn_id);
    const states = runtime.db.query<{ id: string; current_concept_id: string; status: string }>(
      "SELECT id, current_concept_id, status FROM tutor_agent_states WHERE session_id = ?",
    ).all([session.session_id]);
    expect(states).toHaveLength(1);
    expect(states[0]).toMatchObject({ current_concept_id: "string", status: "active" });

    const actions = runtime.db.query<{ action_kind: string; concept_id: string; validation_status: string }>(
      "SELECT action_kind, concept_id, validation_status FROM tutor_agent_actions WHERE session_id = ? ORDER BY created_at ASC",
    ).all([session.session_id]);
    expect(actions).toEqual([
      expect.objectContaining({ action_kind: "explain_concept", concept_id: "string", validation_status: "accepted" }),
      expect.objectContaining({ action_kind: "ask_guided_question", concept_id: "string", validation_status: "accepted" }),
    ]);
    expect(getSessionSnapshot(runtime, session.session_id).active_exercise).toBeNull();
    const snapshot = getSessionSnapshot(runtime, session.session_id);
    expect(snapshot.turns[0]?.annotations?.tutor_actions.map((action) => action.action_kind)).toEqual([
      "explain_concept",
    ]);
    expect(snapshot.turns[1]?.annotations?.tutor_actions.map((action) => action.action_kind)).toEqual([
      "ask_guided_question",
    ]);
    expect(snapshot.turns[0]?.annotations?.guidance_loop_state).toMatchObject({
      current_concept_id: "string",
    });
  });

  it("derives a frontier from progress, catalog order, relations, and mastery", async () => {
    const runtime = await createTestRuntime();
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "string");
    addRelation(runtime, "string", "intro-python", "prerequisite");
    addRelation(runtime, "string", "variable", "remediation");
    upsertMasteryFixture(runtime, "intro-python", { mastery: 10, readiness: 8, confidence: 0.9, evidenceCount: 3, reviewPriority: 10 });

    const frontier = deriveLearningFrontier(runtime, { sessionId: session.session_id });

    expect(frontier).toMatchObject({
      schema_version: "learning_frontier.v1",
      status: "active",
      current_concept_id: "intro-python",
      selection_reason: "prerequisite_blocker",
    });
    expect(frontier.allowed_remediation_concept_ids).toEqual(expect.arrayContaining(["intro-python"]));
    expect(frontier.allowed_practice_concept_ids).toEqual(expect.arrayContaining(["intro-python"]));
    expect(frontier.blocked_concept_ids).toEqual(expect.arrayContaining(["string"]));
    expect(frontier.catalog_identity.run_id).toBe(getLatestCatalogRun(runtime)?.id);
  });

  it("rejects malformed, outside-frontier, premature-practice, paused, and invalid-next actions before tools run", async () => {
    const frontier: LearningFrontier = {
      schema_version: "learning_frontier.v1" as const,
      status: "active" as const,
      current_concept_id: "string",
      allowed_action_kinds: ["explain_concept", "ask_guided_question", "request_structured_practice", "propose_next_concept"],
      allowed_remediation_concept_ids: ["variable"],
      allowed_practice_concept_ids: [],
      allowed_next_concept_ids: ["list"],
      blocked_concept_ids: ["function"],
      selection_reason: "diagnostic_learning_start",
      catalog_identity: { run_id: "catalog_1", version: "v1" },
      reasons: [],
    };

    expect(validateTutorAgentAction({ action_kind: "explain_concept" }, frontier).accepted).toBe(false);
    expect(validateTutorAgentAction({
      action_kind: "explain_concept",
      concept_id: "function",
      learner_facing_response: "skip ahead",
      rationale: "bad",
      expected_learning_signal: "signal",
    }, frontier).code).toBe("concept_outside_frontier");
    expect(validateTutorAgentAction({
      action_kind: "request_structured_practice",
      concept_id: "string",
      requested_backend_action: { type: "structured_practice", concept_ids: ["string"] },
      learner_facing_response: "practice now",
      rationale: "too soon",
      expected_learning_signal: "practice",
    }, frontier).code).toBe("practice_not_allowed");
    expect(validateTutorAgentAction({
      action_kind: "propose_next_concept",
      concept_id: "function",
      learner_facing_response: "next",
      rationale: "bad",
      expected_learning_signal: "next",
    }, frontier).code).toBe("next_concept_not_allowed");
    expect(validateTutorAgentAction({
      action_kind: "explain_concept",
      concept_id: "string",
      learner_facing_response: "status",
      rationale: "paused",
      expected_learning_signal: "recover",
    }, { ...frontier, status: "paused", allowed_action_kinds: ["explain_status"] }).code).toBe("frontier_paused");
    expect(validateTutorAgentAction({
      action_kind: "explain_status",
      concept_id: "string",
      learner_facing_response: "continue the active exercise",
      rationale: "status",
      expected_learning_signal: "active_practice_status",
    }, frontier)).toMatchObject({ accepted: true, code: "accepted" });
  });

  it("requires validated agent action attribution for agent-owned practice and records it in tool evidence", async () => {
    const runtime = await createTestRuntime();
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "loop");
    markGuidanceStarted(runtime, session.session_id, "loop");
    insertGeneratedExerciseFixture(runtime, { conceptIds: ["loop"], difficulty: 2 });

    await expect(requestExplicitPractice(runtime, {
      sessionId: session.session_id,
      source: "agent",
      conceptIds: ["loop"],
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    const actionId = seedAcceptedAction(runtime, session.session_id, "loop", "request_structured_practice");
    const outcome = await requestExplicitPractice(runtime, {
      sessionId: session.session_id,
      source: "agent",
      agentActionId: actionId,
      conceptIds: ["loop"],
    });

    expect(outcome.kind).toBe("exercise_ready");
    expect(JSON.stringify(outcome)).toContain(actionId);
    const evidence = runtime.db.query<{ summary_json: string }>(
      "SELECT summary_json FROM tool_evidence WHERE tool_name = 'select_exercise' ORDER BY created_at DESC LIMIT 1",
    ).get();
    expect(evidence?.summary_json).toContain(`"agent_action_id":"${actionId}"`);
  });

  it("creates a concept-bound practice contract for validated agent practice when no trusted exercise content exists", async () => {
    const runtime = await createTestRuntime();
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "loop");
    markGuidanceStarted(runtime, session.session_id, "loop");
    const actionId = seedAcceptedAction(runtime, session.session_id, "loop", "request_structured_practice");

    const outcome = await requestExplicitPractice(runtime, {
      sessionId: session.session_id,
      source: "agent",
      agentActionId: actionId,
      conceptIds: ["loop"],
    });

    expect(outcome).toMatchObject({
      kind: "exercise_ready",
      agent_action_id: actionId,
      exercise: {
        concept_ids: ["loop"],
        submission: { enabled: true },
      },
    });
    expect(outcome.evidence).toMatchObject({
      result_code: "AGENT_PRACTICE_CONTRACT_READY",
      tool_name: "create_practice_contract",
    });
    expect(runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM practice_contracts WHERE session_id = ? AND tutor_agent_action_id = ?").get([session.session_id, actionId])?.count).toBe(1);
    expect(JSON.stringify(outcome)).toContain("循环");
    expect(JSON.stringify(outcome)).not.toMatch(/hidden_tests|evaluator_private|reference_solution|raw_prompt|private_ref/);
  });

  it("derives guidance loop readiness from accepted guidance, guided judgement, and active practice state", async () => {
    const runtime = await createTestRuntime({ tutor: null });
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "string");
    markGuidanceStarted(runtime, session.session_id, "string");
    seedAcceptedAction(runtime, session.session_id, "string", "explain_concept");
    const questionActionId = seedAcceptedAction(runtime, session.session_id, "string", "ask_guided_question");
    recordGuidedAnswerJudgement(runtime, {
      sessionId: session.session_id,
      turnId: null,
      agentActionId: questionActionId,
      conceptId: "string",
      judgement: "understood",
      confidence: 0.86,
      misconceptionSummary: "Learner can identify quoted text.",
    });

    const ready = deriveGuidanceLoopState(runtime, { sessionId: session.session_id });

    expect(ready).toMatchObject({
      schema_version: "guidance_loop_state.v1",
      current_concept_id: "string",
      phase: "practice_ready",
      latest_guided_answer_judgement: "understood",
      auto_practice_allowed: true,
      auto_practice_mode: "standard",
      active_practice: false,
    });

    insertGeneratedExerciseFixture(runtime, { conceptIds: ["string"], difficulty: 2 });
    const practiceActionId = seedAcceptedAction(runtime, session.session_id, "string", "request_structured_practice");
    await requestExplicitPractice(runtime, {
      sessionId: session.session_id,
      source: "agent",
      agentActionId: practiceActionId,
      conceptIds: ["string"],
    });

    const active = deriveGuidanceLoopState(runtime, { sessionId: session.session_id });
    expect(active).toMatchObject({
      phase: "active_practice",
      auto_practice_allowed: false,
      active_practice: true,
    });
    expect(active.blocked_reasons).toContain("active_practice");
  });

  it.each(["好", "继续啊"])("keeps active practice continuation accepted for learner reply %s", async (message) => {
    const runtime = await createTestRuntime({
      tutor: {
        generate: async () => JSON.stringify({
          action_kind: "explain_status",
          concept_id: "string",
          rationale: "An active practice is already waiting for a student submission.",
          learner_facing_response: "当前已经有一道练习在进行中。请先在练习卡片里提交一次尝试，我会根据运行证据继续指导。",
          expected_learning_signal: "learner_continues_active_practice",
        }),
      },
    });
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "string");
    markGuidanceStarted(runtime, session.session_id, "string");
    seedAcceptedAction(runtime, session.session_id, "string", "explain_concept");
    seedAcceptedAction(runtime, session.session_id, "string", "ask_guided_question");
    const practiceActionId = seedAcceptedAction(runtime, session.session_id, "string", "request_structured_practice");
    insertGeneratedExerciseFixture(runtime, { conceptIds: ["string"], difficulty: 2 });
    const outcome = await requestExplicitPractice(runtime, {
      sessionId: session.session_id,
      source: "agent",
      agentActionId: practiceActionId,
      conceptIds: ["string"],
    });
    expect(outcome).toMatchObject({ kind: "exercise_ready" });
    const outcomesBefore = countRows(runtime, "session_practice_outcomes", session.session_id);

    await postMessage(runtime, session.session_id, { message, attachments: [] });

    const snapshot = getSessionSnapshot(runtime, session.session_id);
    expect(snapshot.guidance_loop_state).toMatchObject({
      phase: "active_practice",
      active_practice: true,
    });
    expect(snapshot.active_practice_outcome).toMatchObject({ kind: "exercise_ready" });
    expect(snapshot.recent_tutor_agent_actions[0]).toMatchObject({
      action_kind: "explain_status",
      validation_status: "accepted",
      validation_code: "accepted",
    });
    expect(snapshot.current_concept_id).toBe("string");
    expect(countRows(runtime, "session_practice_outcomes", session.session_id)).toBe(outcomesBefore);
    expect(JSON.stringify(snapshot.turns.at(-1)?.assistant_messages ?? [])).toContain("练习卡片");
    expect(JSON.stringify(snapshot.turns.at(-1)?.assistant_messages ?? [])).not.toContain("action_kind_not_allowed");
  });

  it("keeps blocked guided answers in remediation instead of allowing automatic practice", async () => {
    const runtime = await createTestRuntime({ tutor: null });
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "string");
    markGuidanceStarted(runtime, session.session_id, "string");
    seedAcceptedAction(runtime, session.session_id, "string", "explain_concept");
    const questionActionId = seedAcceptedAction(runtime, session.session_id, "string", "ask_guided_question");
    recordGuidedAnswerJudgement(runtime, {
      sessionId: session.session_id,
      turnId: null,
      agentActionId: questionActionId,
      conceptId: "string",
      judgement: "blocked",
      confidence: 0.86,
      misconceptionSummary: "Learner is stuck.",
    });

    const state = deriveGuidanceLoopState(runtime, { sessionId: session.session_id });

    expect(state).toMatchObject({
      phase: "need_remediation",
      latest_guided_answer_judgement: "blocked",
      auto_practice_allowed: false,
      auto_practice_mode: null,
    });
    expect(state.blocked_reasons).toContain("guided_answer_blocked");
  });

  it("records guided-answer judgements as bounded events and low-weight tutor review evidence", async () => {
    const runtime = await createTestRuntime();
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "string");
    markGuidanceStarted(runtime, session.session_id, "string");
    const actionId = seedAcceptedAction(runtime, session.session_id, "string", "ask_guided_question");

    const result = recordGuidedAnswerJudgement(runtime, {
      sessionId: session.session_id,
      turnId: createId("turn"),
      agentActionId: actionId,
      conceptId: "string",
      judgement: "understood",
      confidence: 0.86,
      misconceptionSummary: "能识别字符串字面量。",
    });

    expect(result.event_id).toMatch(/^evt_/);
    const event = runtime.db.query<{ payload_json: string; evidence_json: string }>(
      "SELECT payload_json, evidence_json FROM learning_events WHERE id = ?",
    ).get([result.event_id]);
    expect(event?.payload_json).toContain('"judgement":"understood"');
    expect(event?.payload_json).not.toContain("rationale");

    const evidence = runtime.db.query<{ source_type: string; evidence_weight: number; summary_json: string }>(
      "SELECT source_type, evidence_weight, summary_json FROM learning_evidence WHERE source_id = ?",
    ).get([actionId]);
    expect(evidence).toMatchObject({ source_type: "tutor_review" });
    expect(evidence?.evidence_weight).toBeLessThan(0.5);
    expect(evidence?.summary_json).toContain('"validation_result":"accepted"');
  });

  it("adds bounded tutor agent state to context and snapshot without sensitive material", async () => {
    const runtime = await createTestRuntime();
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "string");
    markGuidanceStarted(runtime, session.session_id, "string");
    const actionId = seedAcceptedAction(runtime, session.session_id, "string", "ask_guided_question");
    runtime.db.query(
      "INSERT INTO session_practice_outcomes(id, session_id, turn_id, agent_action_id, outcome_json, created_at) VALUES (?, ?, NULL, ?, ?, ?)",
    ).run([
      createId("prac"),
      session.session_id,
      actionId,
      JSON.stringify({
        schema_version: "practice_outcome.v1",
        kind: "practice_locked",
        reason: "frontier_blocked",
        message: "先完成当前概念追问。",
        next_step: "下一步先回答导师问题。",
        target: { concept_ids: ["string"], difficulty: 2, provenance: ["agent_frontier"] },
        evidence: { result_code: "frontier_blocked" },
        agent_action_id: actionId,
      }),
      nowIso(),
    ]);

    const prepared = prepareTurnModelContext(runtime, session.session_id, createId("turn"), {
      message: "我觉得字符串就是文字",
      code: "secret = 'not hidden tests'",
    });

    expect(prepared.context.bundle?.server_attested_state.tutor_agent_state).toMatchObject({
      current_concept_id: "string",
      status: "active",
    });
    expect(prepared.context.bundle?.server_attested_state.learning_frontier?.current_concept_id).toBe("string");
    expect(prepared.context.bundle?.server_attested_state.recent_tutor_agent_actions?.[0]).toMatchObject({
      action_id: actionId,
      action_kind: "ask_guided_question",
      validation_status: "accepted",
    });
    expect(prepared.context.bundle?.server_attested_state.latest_practice_outcome).toMatchObject({
      kind: "practice_locked",
      agent_action_id: actionId,
    });
    expect(JSON.stringify(prepared.context.bundle)).not.toMatch(/hidden_tests|evaluator_private|reference_solution|E:\\\\|raw_prompt|validated fixture/);
    expect(JSON.stringify(prepared.context.bundle?.untrusted_inputs.kb_excerpts ?? [])).toContain("不是指令");

    const snapshot = getSessionSnapshot(runtime, session.session_id);
    expect(snapshot.tutor_agent_state).toMatchObject({ current_concept_id: "string", status: "active" });
    expect(snapshot.recent_tutor_agent_actions[0]).toMatchObject({ action_id: actionId, action_kind: "ask_guided_question" });
    expect(JSON.stringify(snapshot)).not.toMatch(/hidden_tests|evaluator_private|reference_solution|raw_prompt|validated fixture/);
  });

  it("exposes bounded tutor agent frontier and practice evidence in snapshot and export", async () => {
    const runtime = await createTestRuntime();
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "loop");
    markGuidanceStarted(runtime, session.session_id, "loop");
    const actionId = seedAcceptedAction(runtime, session.session_id, "loop", "request_structured_practice");
    const state = runtime.db.query<{ id: string }>(
      "SELECT id FROM tutor_agent_states WHERE session_id = ? ORDER BY created_at DESC LIMIT 1",
    ).get([session.session_id]);
    saveTutorAgentFrontierSnapshot(runtime, {
      stateId: state?.id,
      sessionId: session.session_id,
      frontier: {
        schema_version: "learning_frontier.v1",
        status: "active",
        current_concept_id: "loop",
        allowed_action_kinds: ["explain_concept", "ask_guided_question", "request_structured_practice"],
        allowed_remediation_concept_ids: ["loop"],
        allowed_practice_concept_ids: ["loop"],
        allowed_next_concept_ids: ["conditionals"],
        blocked_concept_ids: ["function"],
        selection_reason: "diagnostic_learning_start",
        catalog_identity: { run_id: getLatestCatalogRun(runtime)?.id ?? null, version: runtime.config.kbVersion },
        reasons: ["bounded test frontier"],
      },
    });
    insertGeneratedExerciseFixture(runtime, { conceptIds: ["loop"], difficulty: 2 });
    const outcome = await requestExplicitPractice(runtime, {
      sessionId: session.session_id,
      source: "agent",
      agentActionId: actionId,
      conceptIds: ["loop"],
    });

    const snapshot = getSessionSnapshot(runtime, session.session_id) as ReturnType<typeof getSessionSnapshot> & {
      latest_tutor_agent_frontier?: LearningFrontier | null;
    };
    const exported = exportLocalData(runtime) as ReturnType<typeof exportLocalData> & {
      tutor_agent_frontiers?: Array<Record<string, unknown>>;
      practice_outcomes?: Array<Record<string, unknown>>;
    };

    expect(outcome).toMatchObject({ kind: "exercise_ready", agent_action_id: actionId });
    expect(snapshot.latest_tutor_agent_frontier).toMatchObject({
      current_concept_id: "loop",
      allowed_practice_concept_ids: ["loop"],
    });
    expect(exported.tutor_agent_frontiers?.[0]).toMatchObject({
      session_id: session.session_id,
      current_concept_id: "loop",
      status: "active",
    });
    expect(JSON.stringify(exported.practice_outcomes)).toContain(actionId);
    expect(JSON.stringify({ snapshot, exported })).not.toMatch(/hidden_tests|evaluator_private|reference_solution|raw_prompt|validated fixture/);
  });

  it("routes post-guidance exercise requests through accepted tutor-agent practice attribution", async () => {
    const runtime = await createTestRuntime({
      tutor: {
        generate: async () => JSON.stringify({
          action_kind: "request_structured_practice",
          concept_id: "loop",
          rationale: "The learner asked for bounded practice after guidance.",
          learner_facing_response: "现在可以做一个循环练习。",
          expected_learning_signal: "learner_attempts_loop_practice",
          requested_backend_action: { type: "structured_practice", concept_ids: ["loop"] },
        }),
      },
    });
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "loop");
    markGuidanceStarted(runtime, session.session_id, "loop");
    seedAcceptedAction(runtime, session.session_id, "loop", "explain_concept");
    const questionActionId = seedAcceptedAction(runtime, session.session_id, "loop", "ask_guided_question");
    recordGuidedAnswerJudgement(runtime, {
      sessionId: session.session_id,
      turnId: null,
      agentActionId: questionActionId,
      conceptId: "loop",
      judgement: "understood",
      confidence: 0.86,
      misconceptionSummary: "Learner is ready for practice.",
    });
    insertGeneratedExerciseFixture(runtime, { conceptIds: ["loop"], difficulty: 2 });

    await postMessage(runtime, session.session_id, { message: "请给我一个当前概念的小练习。", attachments: [] });

    const snapshot = getSessionSnapshot(runtime, session.session_id);
    expect(snapshot.active_practice_outcome).toMatchObject({
      kind: "exercise_ready",
      agent_action_id: expect.stringMatching(/^ta_action_/),
    });
    expect(snapshot.recent_tutor_agent_actions[0]).toMatchObject({
      action_kind: "request_structured_practice",
      validation_status: "accepted",
    });
  });

  it("does not synthesize practice actions when the tutor model drifts during an explicit practice request", async () => {
    const runtime = await createTestRuntime({
      tutor: {
        generate: async () => JSON.stringify({
          action_kind: "explain_concept",
          concept_id: "loop",
          rationale: "The model drifted into explanation.",
          learner_facing_response: "先解释一下循环。",
          expected_learning_signal: "understand_loop",
        }),
      },
    });
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "loop");
    markGuidanceStarted(runtime, session.session_id, "loop");
    seedAcceptedAction(runtime, session.session_id, "loop", "explain_concept");
    const questionActionId = seedAcceptedAction(runtime, session.session_id, "loop", "ask_guided_question");
    recordGuidedAnswerJudgement(runtime, {
      sessionId: session.session_id,
      turnId: null,
      agentActionId: questionActionId,
      conceptId: "loop",
      judgement: "understood",
      confidence: 0.86,
      misconceptionSummary: "Learner is ready for practice.",
    });
    insertGeneratedExerciseFixture(runtime, { conceptIds: ["loop"], difficulty: 2 });

    await postMessage(runtime, session.session_id, { message: "我已经理解了，请给我一个练习。", attachments: [] });

    const snapshot = getSessionSnapshot(runtime, session.session_id);
    expect(snapshot.active_practice_outcome).toBeNull();
    expect(snapshot.recent_tutor_agent_actions[0]).toMatchObject({
      action_kind: "explain_concept",
      validation_status: "accepted",
    });
  });

  it("records guided-answer judgement evidence during post-guidance guided answer turns", async () => {
    const runtime = await createTestRuntime({
      tutor: {
        generate: async () => JSON.stringify({
          action_kind: "evaluate_guided_answer",
          concept_id: "string",
          rationale: "The learner answered the guided question.",
          learner_facing_response: "你的理解方向是对的，下一步用一句代码验证。",
          expected_learning_signal: "learner_can_explain_string_literal",
          requested_backend_action: { type: "guided_answer_judgement", concept_ids: ["string"] },
        }),
      },
    });
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "string");
    markGuidanceStarted(runtime, session.session_id, "string");
    seedAcceptedAction(runtime, session.session_id, "string", "explain_concept");
    seedAcceptedAction(runtime, session.session_id, "string", "ask_guided_question");

    await postMessage(runtime, session.session_id, { message: "我的理解是字符串就是被引号包住的文本。", attachments: [] });

    const exported = exportLocalData(runtime) as ReturnType<typeof exportLocalData> & {
      learning_events?: Array<Record<string, unknown>>;
    };
    expect(JSON.stringify(exported.learning_events)).toContain("guided_answer_judgement");
    expect(JSON.stringify(exported.learning_events)).toContain("understood");
    expect(JSON.stringify(exported.learning_events)).not.toMatch(/raw_prompt|hidden_tests|reference_solution/);
  });

  it("rejects a tutor judgement before a guided question exists instead of synthesizing the question", async () => {
    const runtime = await createTestRuntime({
      tutor: {
        generate: async () => JSON.stringify({
          action_kind: "evaluate_guided_answer",
          concept_id: "string",
          rationale: "The model tried to judge before asking.",
          learner_facing_response: "直接判断你的理解。",
          expected_learning_signal: "premature_judgement",
          requested_backend_action: { type: "guided_answer_judgement", concept_ids: ["string"] },
        }),
      },
    });
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "string");
    markGuidanceStarted(runtime, session.session_id, "string");
    seedAcceptedAction(runtime, session.session_id, "string", "explain_concept");

    await expect(postMessage(runtime, session.session_id, { message: "我有点迷路了，现在应该继续哪里？", attachments: [] })).rejects.toMatchObject({
      code: "TUTOR_ACTION_REJECTED",
    });

    const snapshot = getSessionSnapshot(runtime, session.session_id);
    expect(snapshot.active_practice_outcome).toBeNull();
    expect(snapshot.guidance_loop_state).toMatchObject({
      phase: "need_guided_question",
      guided_question_count: 0,
    });
    expect(snapshot.recent_tutor_agent_actions[0]).toMatchObject({
      action_kind: "evaluate_guided_answer",
      validation_status: "rejected",
      validation_code: "guided_question_missing",
    });
    const exported = exportLocalData(runtime) as ReturnType<typeof exportLocalData> & {
      learning_events?: Array<Record<string, unknown>>;
    };
    expect(exported.learning_events ?? []).toHaveLength(0);
  });

  it("automatically creates structured practice after a multi-action guided-answer turn plan", async () => {
    const runtime = await createTestRuntime({
      tutor: {
        generate: async () => JSON.stringify({
          learner_facing_response: "你的理解抓住了关键。现在给你一道当前概念练习。",
          actions: [
            {
              action_kind: "evaluate_guided_answer",
              concept_id: "string",
              rationale: "The learner answered the guided question.",
              learner_facing_response: "你的理解抓住了关键。",
              expected_learning_signal: "learner_can_explain_string_literal",
              requested_backend_action: { type: "guided_answer_judgement", concept_ids: ["string"] },
            },
            {
              action_kind: "request_structured_practice",
              concept_id: "string",
              rationale: "The learner is ready for standard structured practice.",
              learner_facing_response: "现在给你一道当前概念练习。",
              expected_learning_signal: "learner_attempts_structured_practice",
              requested_backend_action: { type: "structured_practice", concept_ids: ["string"] },
            },
          ],
        }),
      },
    });
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "string");
    markGuidanceStarted(runtime, session.session_id, "string");
    seedAcceptedAction(runtime, session.session_id, "string", "explain_concept");
    seedAcceptedAction(runtime, session.session_id, "string", "ask_guided_question");
    insertGeneratedExerciseFixture(runtime, { conceptIds: ["string"], difficulty: 2 });

    await postMessage(runtime, session.session_id, { message: "我已经能说明字符串的用途，准备继续。", attachments: [] });

    const snapshot = getSessionSnapshot(runtime, session.session_id);
    expect(snapshot.active_practice_outcome).toMatchObject({
      kind: "exercise_ready",
      agent_action_id: expect.stringMatching(/^ta_action_/),
    });
    expect(snapshot.guidance_loop_state).toMatchObject({
      phase: "active_practice",
      active_practice: true,
    });
    expect(snapshot.recent_tutor_agent_actions.slice(0, 2).map((action) => action.action_kind)).toEqual([
      "request_structured_practice",
      "evaluate_guided_answer",
    ]);
  });

  it("reports model unavailability for lost next-step replies instead of local guided-answer heuristics", async () => {
    const runtime = await createTestRuntime({ tutor: null });
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "string");
    markGuidanceStarted(runtime, session.session_id, "string");
    seedAcceptedAction(runtime, session.session_id, "string", "explain_concept");
    seedAcceptedAction(runtime, session.session_id, "string", "ask_guided_question");

    await expect(postMessage(runtime, session.session_id, {
      message: "我有点迷路了，现在应该从哪里继续？",
      attachments: [],
    })).rejects.toMatchObject({ code: "MODEL_UNAVAILABLE" });

    const snapshot = getSessionSnapshot(runtime, session.session_id);
    expect(snapshot.active_practice_outcome).toBeNull();
    expect(snapshot.guidance_loop_state?.latest_guided_answer_judgement).toBeNull();
    expect(countRows(runtime, "tutor_agent_actions", session.session_id)).toBe(2);
  });

  it("reports model unavailability for explicit practice requests instead of local scaffolded readiness", async () => {
    const runtime = await createTestRuntime({ tutor: null });
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "string");
    markGuidanceStarted(runtime, session.session_id, "string");
    seedAcceptedAction(runtime, session.session_id, "string", "explain_concept");
    seedAcceptedAction(runtime, session.session_id, "string", "ask_guided_question");

    await expect(postMessage(runtime, session.session_id, {
      message: "先给我一道练习试试。",
      attachments: [],
    })).rejects.toMatchObject({ code: "MODEL_UNAVAILABLE" });

    const snapshot = getSessionSnapshot(runtime, session.session_id);
    expect(snapshot.active_practice_outcome).toBeNull();
    expect(snapshot.guidance_loop_state?.latest_guided_answer_judgement).toBeNull();
    expect(countRows(runtime, "tutor_agent_actions", session.session_id)).toBe(2);
  });

  it("rejects automatic practice in a turn plan when guided readiness is blocked", async () => {
    const runtime = await createTestRuntime({
      tutor: {
        generate: async () => JSON.stringify({
          actions: [
            {
              action_kind: "request_structured_practice",
              concept_id: "string",
              rationale: "The model tried to skip readiness.",
              learner_facing_response: "直接做题。",
              expected_learning_signal: "practice_without_readiness",
              requested_backend_action: { type: "structured_practice", concept_ids: ["string"] },
            },
          ],
        }),
      },
    });
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "string");
    markGuidanceStarted(runtime, session.session_id, "string");
    seedAcceptedAction(runtime, session.session_id, "string", "explain_concept");
    const questionActionId = seedAcceptedAction(runtime, session.session_id, "string", "ask_guided_question");
    recordGuidedAnswerJudgement(runtime, {
      sessionId: session.session_id,
      turnId: null,
      agentActionId: questionActionId,
      conceptId: "string",
      judgement: "blocked",
      confidence: 0.86,
      misconceptionSummary: "Learner remains stuck.",
    });
    insertGeneratedExerciseFixture(runtime, { conceptIds: ["string"], difficulty: 2 });

    await expect(postMessage(runtime, session.session_id, { message: "继续", attachments: [] })).rejects.toMatchObject({
      code: "TUTOR_ACTION_REJECTED",
    });

    const snapshot = getSessionSnapshot(runtime, session.session_id);
    expect(snapshot.active_practice_outcome).toBeNull();
    expect(snapshot.recent_tutor_agent_actions[0]).toMatchObject({
      action_kind: "request_structured_practice",
      validation_status: "rejected",
      validation_code: "auto_practice_not_ready",
    });
  });

  it("keeps validation codes in audit rows without generating learner fallback copy", async () => {
    const runtime = await createTestRuntime({
      tutor: {
        generate: async () => JSON.stringify({
          action_kind: "propose_next_concept",
          concept_id: "function",
          rationale: "The model tried to skip ahead.",
          learner_facing_response: "直接进入函数。",
          expected_learning_signal: "skip_ahead",
        }),
      },
    });
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "string");
    markGuidanceStarted(runtime, session.session_id, "string");
    seedAcceptedAction(runtime, session.session_id, "string", "explain_concept");
    seedAcceptedAction(runtime, session.session_id, "string", "ask_guided_question");
    recordGuidedAnswerJudgement(runtime, {
      sessionId: session.session_id,
      turnId: null,
      agentActionId: seedAcceptedAction(runtime, session.session_id, "string", "evaluate_guided_answer"),
      conceptId: "string",
      judgement: "blocked",
      confidence: 0.86,
      misconceptionSummary: "Learner remains stuck.",
    });

    await expect(postMessage(runtime, session.session_id, { message: "继续", attachments: [] })).rejects.toMatchObject({
      code: "TUTOR_ACTION_REJECTED",
    });

    const snapshot = getSessionSnapshot(runtime, session.session_id);
    expect(snapshot.recent_tutor_agent_actions[0]).toMatchObject({
      validation_status: "rejected",
      validation_code: "next_concept_not_allowed",
    });
    const assistantText = JSON.stringify(snapshot.turns.at(-1)?.assistant_messages ?? []);
    expect(assistantText).not.toContain("next_concept_not_allowed");
    expect(assistantText).not.toContain("学习起点");
  });

  it("does not surface completed agentic practice outcomes as active exercise cards", async () => {
    const runtime = await createTestRuntime();
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "string");
    markGuidanceStarted(runtime, session.session_id, "string");

    const seeded = await seedCompletedAgenticPractice(runtime, session.session_id, "string");

    const snapshot = getSessionSnapshot(runtime, session.session_id);
    expect(snapshot.active_practice_contract).toBeNull();
    expect(snapshot.active_exercise).toBeNull();
    expect(snapshot.latest_agent_practice_review).toMatchObject({
      id: seeded.reviewId,
      review_status: "passed",
      progress_effect: "recorded",
    });
    expect(snapshot.guidance_loop_state).toMatchObject({
      phase: "review_practice_result",
      latest_practice_result: "passed",
    });
  });

  it("rejects invalid reviewed-practice progression instead of generating a local follow-up", async () => {
    let tutorCalls = 0;
    const runtime = await createTestRuntime({
      tutor: {
        generate: async () => {
          tutorCalls += 1;
          return JSON.stringify({
            action_kind: "propose_next_concept",
            concept_id: "string",
            rationale: "The model tried to continue after practice.",
            learner_facing_response: "继续进入后续小任务。",
            expected_learning_signal: "continue_after_practice",
          });
        },
      },
    });
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "string");
    markGuidanceStarted(runtime, session.session_id, "string");
    await seedCompletedAgenticPractice(runtime, session.session_id, "string");

    await expect(postMessage(runtime, session.session_id, { message: "进入后续小任务", attachments: [] })).rejects.toMatchObject({
      code: "TUTOR_ACTION_REJECTED",
    });

    const snapshot = getSessionSnapshot(runtime, session.session_id);
    expect(tutorCalls).toBe(2);
    expect(snapshot.recent_tutor_agent_actions[0]).toMatchObject({
      action_kind: "propose_next_concept",
      concept_id: "string",
      validation_status: "rejected",
      validation_code: "next_concept_not_allowed",
    });
    const assistantText = snapshot.turns.at(-1)?.assistant_messages[0]?.text ?? "";
    expect(assistantText).toBe("");
    expect(assistantText).not.toContain("我会继续停留在学习起点");
    expect(assistantText).not.toContain("不跳过知识库顺序");
  });

  it("lets the model choose the next KB concept after a passed root practice unlocks progression", async () => {
    let tutorCalls = 0;
    const runtime = await createTestRuntime({
      tutor: {
        generate: async () => {
          tutorCalls += 1;
          return JSON.stringify({
            action_kind: "propose_next_concept",
            concept_id: "variable",
            rationale: "The passed review recorded enough evidence to continue to the next KB concept.",
            learner_facing_response: "这次练习通过后，下一步进入变量与数据类型。",
            expected_learning_signal: "learner_moves_from_intro_to_variable",
            requested_backend_action: { type: "none", concept_ids: ["variable"] },
          });
        },
      },
    });
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "intro-python");
    markGuidanceStarted(runtime, session.session_id, "intro-python");
    await seedCompletedAgenticPractice(runtime, session.session_id, "intro-python");

    const frontier = deriveLearningFrontier(runtime, { sessionId: session.session_id });
    expect(frontier.allowed_next_concept_ids).toContain("variable");

    await postMessage(runtime, session.session_id, { message: "进入后续小任务", attachments: [] });

    const snapshot = getSessionSnapshot(runtime, session.session_id);
    expect(tutorCalls).toBe(1);
    expect(snapshot.recent_tutor_agent_actions[0]).toMatchObject({
      action_kind: "propose_next_concept",
      concept_id: "variable",
      validation_status: "accepted",
    });
    const assistantText = snapshot.turns.at(-1)?.assistant_messages[0]?.text ?? "";
    expect(assistantText).toContain("变量与数据类型");
    expect(assistantText).not.toContain("当前学习前沿还没有解锁下一个概念");
  });

  it("repairs a validation-rejected next-concept action through the external model", async () => {
    let tutorCalls = 0;
    const runtime = await createTestRuntime({
      tutor: {
        generate: async () => {
          tutorCalls += 1;
          if (tutorCalls === 1) {
            return JSON.stringify({
              action_kind: "propose_next_concept",
              concept_id: "intro-python",
              rationale: "The model used the completed concept instead of the allowed next concept.",
              learner_facing_response: "继续围绕当前概念。",
              expected_learning_signal: "invalid_next_concept",
            });
          }
          return JSON.stringify({
            action_kind: "propose_next_concept",
            concept_id: "variable",
            rationale: "The repair call selected the server-allowed next concept.",
            learner_facing_response: "这次练习通过后，下一步进入变量与数据类型。",
            expected_learning_signal: "learner_moves_from_intro_to_variable",
            requested_backend_action: { type: "none", concept_ids: ["variable"] },
          });
        },
      },
    });
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "intro-python");
    markGuidanceStarted(runtime, session.session_id, "intro-python");
    await seedCompletedAgenticPractice(runtime, session.session_id, "intro-python");

    await postMessage(runtime, session.session_id, { message: "进入后续小任务", attachments: [] });

    const snapshot = getSessionSnapshot(runtime, session.session_id);
    expect(tutorCalls).toBe(2);
    expect(snapshot.turns.at(-1)?.status).toBe("done");
    expect(snapshot.recent_tutor_agent_actions[0]).toMatchObject({
      action_kind: "propose_next_concept",
      concept_id: "variable",
      validation_status: "accepted",
    });
    expect(snapshot.recent_tutor_agent_actions[1]).toMatchObject({
      action_kind: "propose_next_concept",
      concept_id: "intro-python",
      validation_status: "rejected",
      validation_code: "next_concept_not_allowed",
    });
    expect(snapshot.turns.at(-1)?.assistant_messages[0]?.text).toContain("变量与数据类型");
  });

  it("repairs a malformed tutor action once through the external model before failing the turn", async () => {
    let tutorCalls = 0;
    const runtime = await createTestRuntime({
      tutor: {
        generate: async () => {
          tutorCalls += 1;
          if (tutorCalls === 1) return "这次练习通过了，继续学习变量。";
          return JSON.stringify({
            action_kind: "propose_next_concept",
            concept_id: "variable",
            rationale: "The repair call returned a bounded action for the server-allowed next concept.",
            learner_facing_response: "这次练习通过后，下一步进入变量与数据类型。",
            expected_learning_signal: "learner_moves_from_intro_to_variable",
            requested_backend_action: { type: "none", concept_ids: ["variable"] },
          });
        },
      },
    });
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "intro-python");
    markGuidanceStarted(runtime, session.session_id, "intro-python");
    await seedCompletedAgenticPractice(runtime, session.session_id, "intro-python");

    await postMessage(runtime, session.session_id, { message: "继续", attachments: [] });

    const snapshot = getSessionSnapshot(runtime, session.session_id);
    expect(tutorCalls).toBe(2);
    expect(snapshot.turns.at(-1)?.status).toBe("done");
    expect(snapshot.recent_tutor_agent_actions[0]).toMatchObject({
      action_kind: "propose_next_concept",
      concept_id: "variable",
      validation_status: "accepted",
    });
    expect(snapshot.turns.at(-1)?.assistant_messages[0]?.text).toContain("变量与数据类型");
  });

  it("reports external model unavailability instead of generating tutor fallback actions", async () => {
    const runtime = await createTestRuntime({ tutor: null });
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "intro-python");

    await expect(startDiagnosticGuidance(runtime, session.session_id)).rejects.toMatchObject({
      code: "MODEL_UNAVAILABLE",
    });

    const actions = runtime.db.query<{ count: number }>(
      "SELECT COUNT(*) AS count FROM tutor_agent_actions WHERE session_id = ?",
    ).get([session.session_id]);
    expect(actions?.count).toBe(0);
  });

  it("rejects learner-like guided answers when the tutor model does not evaluate them", async () => {
    const runtime = await createTestRuntime({
      tutor: {
        generate: async () => JSON.stringify({
          action_kind: "explain_concept",
          concept_id: "string",
          rationale: "The model drifted back to explanation.",
          learner_facing_response: "再解释一下字符串。",
          expected_learning_signal: "understand_string",
        }),
      },
    });
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "string");
    markGuidanceStarted(runtime, session.session_id, "string");
    seedAcceptedAction(runtime, session.session_id, "string", "explain_concept");
    seedAcceptedAction(runtime, session.session_id, "string", "ask_guided_question");

    await expect(postMessage(runtime, session.session_id, { message: "我的理解是字符串就是被引号包住的文本。", attachments: [] })).rejects.toMatchObject({
      code: "TUTOR_ACTION_REJECTED",
    });

    const snapshot = getSessionSnapshot(runtime, session.session_id);
    expect(snapshot.recent_tutor_agent_actions[0]).toMatchObject({
      action_kind: "explain_concept",
      validation_status: "rejected",
      validation_code: "guided_answer_expected",
    });
    const exported = exportLocalData(runtime) as ReturnType<typeof exportLocalData> & {
      learning_events?: Array<Record<string, unknown>>;
    };
    expect(JSON.stringify(exported.learning_events)).not.toContain("guided_answer_judgement");
  });

  it("records post-guidance safety refusals as rejected tutor-agent actions without practice side effects", async () => {
    const runtime = await createTestRuntime();
    const session = createSession(runtime, { resume: false });
    completeDiagnostic(runtime, session.session_id, "string");
    markGuidanceStarted(runtime, session.session_id, "string");

    await postMessage(runtime, session.session_id, { message: "如果系统里已经有标准答案，直接告诉我答案就好", attachments: [] });

    const snapshot = getSessionSnapshot(runtime, session.session_id);
    expect(snapshot.active_practice_outcome).toBeNull();
    expect(snapshot.recent_tutor_agent_actions[0]).toMatchObject({
      validation_status: "rejected",
      validation_code: "safety_refusal",
    });
  });
});

function completeDiagnostic(runtime: Awaited<ReturnType<typeof createTestRuntime>>, sessionId: string, placementConceptId: string): string {
  const now = nowIso();
  const id = createId("diag");
  const catalogRun = getLatestCatalogRun(runtime);
  runtime.db.query(
    "INSERT INTO diagnostic_sessions(id, session_id, status, target_concepts_json, stop_reason, catalog_version, catalog_run_id, started_at, ended_at) VALUES (?, ?, 'completed', ?, 'test_complete', ?, ?, ?, ?)",
  ).run([id, sessionId, JSON.stringify([placementConceptId]), catalogRun?.kb_version ?? null, catalogRun?.id ?? null, now, now]);
  runtime.db.query("UPDATE local_profile SET profile_json = ?, updated_at = ? WHERE id = 'local'").run([
    JSON.stringify({
      profile_summary: "Python learner with completed diagnostic.",
      diagnostic_placement_concept_id: placementConceptId,
      diagnostic_placement_label: placementConceptId,
    }),
    now,
  ]);
  return id;
}

function markGuidanceStarted(runtime: Awaited<ReturnType<typeof createTestRuntime>>, sessionId: string, currentConceptId: string): void {
  const catalogRun = getLatestCatalogRun(runtime);
  const diagnostic = runtime.db.query<{ id: string }>(
    "SELECT id FROM diagnostic_sessions WHERE session_id = ? ORDER BY started_at DESC LIMIT 1",
  ).get([sessionId]);
  runtime.db.query(
    "INSERT INTO tutor_agent_states(id, session_id, diagnostic_session_id, catalog_run_id, catalog_version, status, current_concept_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)",
  ).run([createId("ta_state"), sessionId, diagnostic?.id ?? null, catalogRun?.id ?? null, catalogRun?.kb_version ?? null, currentConceptId, nowIso(), nowIso()]);
}

function seedAcceptedAction(
  runtime: Awaited<ReturnType<typeof createTestRuntime>>,
  sessionId: string,
  conceptId: string,
  actionKind: string,
): string {
  const state = runtime.db.query<{ id: string }>("SELECT id FROM tutor_agent_states WHERE session_id = ? ORDER BY created_at DESC LIMIT 1").get([sessionId]);
  const actionId = createId("ta_action");
  runtime.db.query(
    `INSERT INTO tutor_agent_actions(
      id, state_id, session_id, turn_id, action_kind, concept_id, action_json,
      validation_status, validation_code, validation_reason, learner_facing_response, created_at
    ) VALUES (?, ?, ?, NULL, ?, ?, ?, 'accepted', 'accepted', NULL, ?, ?)`,
  ).run([
    actionId,
    state?.id ?? null,
    sessionId,
    actionKind,
    conceptId,
    JSON.stringify({
      action_kind: actionKind,
      concept_id: conceptId,
      learner_facing_response: "现在做一个结构化练习。",
      rationale: "validated fixture",
      expected_learning_signal: "practice",
    }),
    "现在做一个结构化练习。",
    nowIso(),
  ]);
  return actionId;
}

async function seedCompletedAgenticPractice(
  runtime: Awaited<ReturnType<typeof createTestRuntime>>,
  sessionId: string,
  conceptId: string,
): Promise<{ contractId: string; reviewId: string }> {
  seedAcceptedAction(runtime, sessionId, conceptId, "explain_concept");
  const questionActionId = seedAcceptedAction(runtime, sessionId, conceptId, "ask_guided_question");
  recordGuidedAnswerJudgement(runtime, {
    sessionId,
    turnId: null,
    agentActionId: questionActionId,
    conceptId,
    judgement: "understood",
    confidence: 0.86,
    misconceptionSummary: "Learner is ready for practice.",
  });
  const now = nowIso();
  const turnId = createId("turn");
  runtime.db.query(
    "INSERT INTO session_turns(id, session_id, status, user_message_summary, started_at, ended_at) VALUES (?, ?, 'done', 'contract', ?, ?)",
  ).run([turnId, sessionId, now, now]);
  const contract = await createPracticeContract(runtime, {
    concept_ids: [conceptId],
    title: "已完成的智能体练习",
    prompt_md: "写一小段代码验证当前概念。",
    starter_code: "print('ok')\n",
    expected_behavior: "代码可以运行。",
    visible_examples: [],
    acceptance_checklist: ["代码可以运行"],
    allowed_solution_shape: "single_file_python",
    review_rubric: "基于运行证据评阅。",
    difficulty: 1,
    progress_eligible: true,
  }, { sessionId, turnId });
  if (!contract.ok) throw new Error(`Failed to seed practice contract: ${contract.code}`);
  persistPracticeOutcome(runtime, sessionId, turnId, {
    schema_version: "practice_outcome.v1",
    kind: "exercise_ready",
    message: "已为你准备一道当前概念的练习。",
    next_step: "下一步提交代码。",
    target: { concept_ids: [conceptId], difficulty: 1, provenance: ["agent_frontier"] },
    evidence: { result_code: "AGENT_PRACTICE_CONTRACT_READY", tool_name: "create_practice_contract" },
    exercise: {
      id: contract.data.contract.id,
      practice_contract_id: contract.data.contract.id,
      title: contract.data.contract.title,
      difficulty: contract.data.contract.difficulty,
      concept_ids: contract.data.contract.concept_ids,
      prompt_md: contract.data.contract.prompt_md,
      starter_code: contract.data.contract.starter_code,
      expected_behavior: contract.data.contract.expected_behavior,
      acceptance_checklist: contract.data.contract.acceptance_checklist,
      samples: [],
      hint_level: 0,
      submission: { endpoint: `/api/sessions/${encodeURIComponent(sessionId)}/messages`, enabled: true },
    },
    recommendation_id: `practice:${contract.data.contract.id}`,
  }, null);
  const review = await recordAgentReview(runtime, {
    practice_contract_id: contract.data.contract.id,
    submitted_code: "print('ok')\n",
    review_status: "passed",
    confidence: "high",
    evidence_refs: [{ tool_name: "run_student_code", result_code: "allowed_success", summary: "stdout ok" }],
    learner_facing_summary: "运行通过。",
  }, { sessionId, turnId });
  if (!review.ok) throw new Error(`Failed to seed practice review: ${review.code}`);
  const progress = await requestLearningProgressUpdate(runtime, { review_id: review.data.review.id }, { sessionId, turnId });
  if (progress.data.progress_effect !== "recorded") {
    throw new Error(`Failed to seed recorded progress: ${progress.data.reason ?? progress.code}`);
  }
  return { contractId: contract.data.contract.id, reviewId: review.data.review.id };
}

function countRows(
  runtime: Awaited<ReturnType<typeof createTestRuntime>>,
  tableName: "session_practice_outcomes" | "tutor_agent_actions",
  sessionId: string,
): number {
  const row = runtime.db.query<{ count: number }>(`SELECT COUNT(*) AS count FROM ${tableName} WHERE session_id = ?`).get([sessionId]);
  return Number(row?.count ?? 0);
}

function addRelation(
  runtime: Awaited<ReturnType<typeof createTestRuntime>>,
  source: string,
  target: string,
  relationType: "prerequisite" | "remediation",
): void {
  const now = nowIso();
  runtime.db.query(
    "INSERT OR REPLACE INTO concept_relations(source_concept_id, target_concept_id, relation_type, weight, source_type, source_path, source_hash, catalog_version, metadata_json, created_at, updated_at) VALUES (?, ?, ?, 3, 'kb_catalog', NULL, NULL, ?, '{}', ?, ?)",
  ).run([source, target, relationType, runtime.config.kbVersion, now, now]);
}
