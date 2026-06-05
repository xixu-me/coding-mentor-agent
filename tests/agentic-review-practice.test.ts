import { describe, expect, it } from "vitest";
import {
  createPracticeContract,
  getActivePracticeContract,
  recordAgentReview,
  requestLearningProgressUpdate,
  runReviewProbe,
  runStudentCode,
} from "../src/tools/agentic-practice-tools.js";
import { exportLocalData } from "../src/server/data-management.js";
import { loadLatestProgressEvidenceSummary } from "../src/server/progress-evidence.js";
import { createSession, getProgressSummary, getSessionSnapshot, postMessage } from "../src/server/services.js";
import { createId, nowIso, stableHash } from "../src/security/ids.js";
import { summarizeText } from "../src/security/redaction.js";
import { createTestRuntime } from "./utils/runtime.js";
import { completeInitialDiagnosticFixture } from "./utils/diagnostic-fixtures.js";

describe("agentic review practice data", () => {
  it("creates active practice contracts, reviews submissions, and records progress only after high-confidence evidence", async () => {
    const runRequests: string[] = [];
    const runtime = await createTestRuntime({
      sandbox: {
        runPython: async (request) => {
          runRequests.push(request.code);
          return { status: "passed", exit_code: 0, stdout: "2\n4\n", stderr: "", duration_ms: 1, truncated: false };
        },
        runPytest: async () => ({ status: "sandbox_error", exit_code: 1, stdout: "", stderr: "", duration_ms: 1, truncated: false, test_results: [] }),
        lint: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", duration_ms: 1, truncated: false }),
      },
    });
    const session = createSession(runtime, { resume: false });
    completeInitialDiagnosticFixture(runtime, session.session_id, { conceptId: "loop" });
    runtime.db.query(
      "INSERT INTO session_turns(id, session_id, status, user_message_summary, started_at) VALUES ('turn_contract', ?, 'done', 'contract', ?)",
    ).run([session.session_id, "2026-05-18T00:00:00.000Z"]);

    const contract = await createPracticeContract(runtime, {
      concept_ids: ["loop"],
      title: "偶数循环练习",
      prompt_md: "输出 1 到 5 中的偶数。",
      starter_code: "for i in range(1, 6):\n    pass\n",
      expected_behavior: "输出 2 和 4，不输出奇数。",
      visible_examples: [{ description: "expected output", code: "2\n4" }],
      acceptance_checklist: ["代码可以运行", "输出 2 和 4", "不输出奇数"],
      allowed_solution_shape: "single_file_python",
      review_rubric: "基于运行输出和验收清单评阅。",
      difficulty: 1,
      progress_eligible: true,
    }, { sessionId: session.session_id, turnId: "turn_contract" });

    expect(contract.ok).toBe(true);
    expect(contract.data.contract.title).toBe("偶数循环练习");

    const active = await getActivePracticeContract(runtime, {}, { sessionId: session.session_id, turnId: "turn_contract" });
    expect(active.data.contract?.acceptance_checklist).toContain("输出 2 和 4");

    const reviewedCode = "for i in range(1, 6):\n    if i % 2 == 0:\n        print(i)\n";
    const execution = await runStudentCode(runtime, {
      practice_contract_id: contract.data.contract.id,
      code: reviewedCode,
    }, { sessionId: session.session_id, turnId: "turn_contract" });
    expect(execution.ok).toBe(true);
    expect(execution.data.stdout).toBe("2\n4\n");
    expect(runRequests[0]).toBe(reviewedCode);

    const review = await recordAgentReview(runtime, {
      practice_contract_id: contract.data.contract.id,
      submitted_code: reviewedCode,
      review_status: "passed",
      confidence: "high",
      evidence_refs: [{ tool_name: "run_student_code", result_code: "allowed_success", summary: "stdout matched checklist" }],
      learner_facing_summary: "运行输出符合验收清单。",
    }, { sessionId: session.session_id, turnId: "turn_contract" });
    expect(review.ok).toBe(true);
    expect(review.data.review.submitted_code_hash).toBe(stableHash(reviewedCode));

    const progress = await requestLearningProgressUpdate(runtime, { review_id: review.data.review.id }, { sessionId: session.session_id, turnId: "turn_contract" });
    expect(progress.data.progress_effect).toBe("recorded");
    expect(progress.data.recorded_concept_ids).toEqual(["loop"]);
    expect(runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM learning_evidence WHERE source_type = 'tutor_review' AND source_id = ?").get([review.data.review.id])?.count).toBe(1);

    const duplicate = await requestLearningProgressUpdate(runtime, { review_id: review.data.review.id }, { sessionId: session.session_id, turnId: "turn_contract" });
    expect(duplicate.data.progress_effect).toBe("not_recorded");
    expect(runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM learning_evidence WHERE source_type = 'tutor_review' AND source_id = ?").get([review.data.review.id])?.count).toBe(1);

    const evidenceSummary = loadLatestProgressEvidenceSummary(runtime, session.session_id);
    expect(evidenceSummary).toMatchObject({
      source_type: "tutor_review",
      source_id: review.data.review.id,
      review_id: review.data.review.id,
      practice_contract_id: contract.data.contract.id,
      concept_ids: ["loop"],
      concepts: [{ concept_id: "loop", label: "循环结构" }],
      progress_effect: "recorded",
      review_status: "passed",
      outcome: "completed_independently",
      score: 100,
    });
    expect(evidenceSummary?.evidence_refs).toEqual([
      { tool_name: "run_student_code", result_code: "allowed_success", summary: "stdout matched checklist" },
    ]);
    const summaryJson = JSON.stringify(evidenceSummary);
    expect(summaryJson).not.toContain(reviewedCode);
    expect(summaryJson).not.toMatch(/hidden_tests|evaluator_private|private_solution|raw prompt|sk-/i);

    const progressSummary = getProgressSummary(runtime, { sessionId: session.session_id });
    expect(progressSummary.course_progress_percent).toBe(progressSummary.progress_decision.course_progress_percent);
    expect(progressSummary.recent_progress_evidence).toMatchObject({
      source_id: review.data.review.id,
      concept_ids: ["loop"],
      progress_effect: "recorded",
    });

    const snapshot = getSessionSnapshot(runtime, session.session_id);
    expect(snapshot.recent_progress_evidence).toMatchObject({
      source_id: review.data.review.id,
      concept_ids: ["loop"],
    });
    expect(snapshot.latest_agent_practice_review).toMatchObject({
      id: review.data.review.id,
      recent_progress_evidence_id: review.data.review.id,
      recorded_concept_ids: ["loop"],
    });

    const exported = exportLocalData(runtime);
    expect(exported.recent_progress_evidence).toEqual([
      expect.objectContaining({
        source_type: "tutor_review",
        source_id: review.data.review.id,
        review_id: review.data.review.id,
        practice_contract_id: contract.data.contract.id,
        concept_ids: ["loop"],
        progress_effect: "recorded",
      }),
    ]);
    expect(JSON.stringify(exported.recent_progress_evidence)).not.toContain(reviewedCode);
  });

  it("preserves learner code and probe formatting for review probe execution", async () => {
    const runRequests: string[] = [];
    const runtime = await createTestRuntime({
      sandbox: {
        runPython: async (request) => {
          runRequests.push(request.code);
          return { status: "passed", exit_code: 0, stdout: "ok\n", stderr: "", duration_ms: 1, truncated: false };
        },
        runPytest: async () => ({ status: "sandbox_error", exit_code: 1, stdout: "", stderr: "", duration_ms: 1, truncated: false, test_results: [] }),
        lint: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", duration_ms: 1, truncated: false }),
      },
    });
    const session = createSession(runtime, { resume: false });
    runtime.db.query(
      "INSERT INTO session_turns(id, session_id, status, user_message_summary, started_at) VALUES ('turn_probe', ?, 'done', 'contract', ?)",
    ).run([session.session_id, "2026-05-18T00:00:00.000Z"]);
    const contract = await createPracticeContract(runtime, {
      concept_ids: ["loop"],
      title: "探针保真练习",
      prompt_md: "输出偶数。",
      expected_behavior: "输出 2 和 4。",
      acceptance_checklist: ["代码可以运行"],
      review_rubric: "基于运行证据评阅。",
      difficulty: 1,
      progress_eligible: false,
    }, { sessionId: session.session_id, turnId: "turn_probe" });
    const code = "for i in range(1, 6):\n    if i % 2 == 0:\n        print(i)\n";
    const probeCode = "print('probe ok')\n";

    const result = await runReviewProbe(runtime, {
      practice_contract_id: contract.data.contract.id,
      code,
      probe_code: probeCode,
    }, { sessionId: session.session_id, turnId: "turn_probe" });

    expect(result.ok).toBe(true);
    expect(runRequests[0]).toBe([
      "# Agent-generated review probe. This is review evidence, not a hidden evaluator.",
      code,
      "",
      probeCode,
    ].join("\n"));
    expect(summarizeText(code)).toBe("for i in range(1, 6): if i % 2 == 0: print(i)");
  });

  it("does not update progress from low-confidence review evidence", async () => {
    const runtime = await createTestRuntime();
    const session = createSession(runtime, { resume: false });
    runtime.db.query(
      "INSERT INTO session_turns(id, session_id, status, user_message_summary, started_at) VALUES ('turn_low', ?, 'done', 'contract', ?)",
    ).run([session.session_id, "2026-05-18T00:00:00.000Z"]);
    const contract = await createPracticeContract(runtime, {
      concept_ids: ["loop"],
      title: "低置信练习",
      prompt_md: "输出偶数。",
      expected_behavior: "输出偶数。",
      acceptance_checklist: ["代码可以运行"],
      review_rubric: "基于运行证据评阅。",
      difficulty: 1,
      progress_eligible: true,
    }, { sessionId: session.session_id, turnId: "turn_low" });
    const review = await recordAgentReview(runtime, {
      practice_contract_id: contract.data.contract.id,
      submitted_code: "print(2)",
      review_status: "passed",
      confidence: "low",
      evidence_refs: [{ tool_name: "check_python_syntax", result_code: "allowed_success", summary: "syntax only" }],
      learner_facing_summary: "方向可能正确，但证据不足。",
    }, { sessionId: session.session_id, turnId: "turn_low" });

    const progress = await requestLearningProgressUpdate(runtime, { review_id: review.data.review.id }, { sessionId: session.session_id, turnId: "turn_low" });

    expect(progress.data.progress_effect).toBe("not_recorded");
    expect(runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM learning_evidence WHERE source_id = ?").get([review.data.review.id])?.count).toBe(0);
  });

  it("rejects progress updates when the review contract is outside the current frontier", async () => {
    const runtime = await createTestRuntime();
    const session = createSession(runtime, { resume: false });
    completeInitialDiagnosticFixture(runtime, session.session_id, { conceptId: "loop" });
    runtime.db.query(
      "INSERT INTO session_turns(id, session_id, status, user_message_summary, started_at) VALUES ('turn_frontier', ?, 'done', 'contract', ?)",
    ).run([session.session_id, "2026-05-18T00:00:00.000Z"]);
    const contract = await createPracticeContract(runtime, {
      concept_ids: ["dict"],
      title: "字典练习",
      prompt_md: "写一个字典。",
      expected_behavior: "代码可以运行。",
      acceptance_checklist: ["代码可以运行"],
      review_rubric: "基于运行证据评阅。",
      difficulty: 1,
      progress_eligible: true,
    }, { sessionId: session.session_id, turnId: "turn_frontier" });
    const review = await recordAgentReview(runtime, {
      practice_contract_id: contract.data.contract.id,
      submitted_code: "print({'a': 1})",
      review_status: "passed",
      confidence: "high",
      evidence_refs: [{ tool_name: "run_student_code", result_code: "allowed_success", summary: "ran successfully" }],
      learner_facing_summary: "代码可以运行。",
    }, { sessionId: session.session_id, turnId: "turn_frontier" });

    const progress = await requestLearningProgressUpdate(runtime, { review_id: review.data.review.id }, { sessionId: session.session_id, turnId: "turn_frontier" });

    expect(progress.data.progress_effect).toBe("not_recorded");
    expect(progress.data.reason).toContain("outside the current learning frontier");
    expect(runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM learning_evidence WHERE source_id = ?").get([review.data.review.id])?.count).toBe(0);
  });

  it("exports bounded practice contract and review evidence without raw submitted code", async () => {
    const runtime = await createTestRuntime({ skipCatalogSync: true });
    const now = "2026-05-18T00:00:00.000Z";
    runtime.db.query(
      "INSERT INTO agent_sessions(id, pi_session_id, status, started_at) VALUES ('sess_review', 'pi_review', 'active', ?)",
    ).run([now]);
    runtime.db.query(
      "INSERT INTO session_turns(id, session_id, status, user_message_summary, started_at) VALUES ('turn_review', 'sess_review', 'done', 'practice', ?)",
    ).run([now]);
    runtime.db.query(
      `INSERT INTO practice_contracts(
        id, session_id, turn_id, tutor_agent_action_id, concept_ids_json, title, prompt_md, starter_code,
        expected_behavior, visible_examples_json, acceptance_checklist_json, allowed_solution_shape,
        review_rubric, difficulty, progress_eligible, status, created_at, updated_at
      ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run([
      "pc_review",
      "sess_review",
      "turn_review",
      JSON.stringify(["loop"]),
      "偶数循环练习",
      "输出 1 到 5 中的偶数。",
      "for i in range(1, 6):\n    pass\n",
      "输出 2 和 4，不输出奇数。",
      JSON.stringify([{ code: "2\n4", description: "expected output" }]),
      JSON.stringify(["代码可以运行", "输出 2 和 4", "不输出奇数"]),
      "single_file_python",
      "基于运行输出和验收清单评阅。",
      1,
      1,
      "active",
      now,
      now,
    ]);
    runtime.db.query(
      `INSERT INTO agent_practice_reviews(
        id, practice_contract_id, session_id, turn_id, submitted_code_hash, review_status,
        confidence, evidence_refs_json, learner_facing_summary, progress_effect, progress_reason,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run([
      "apr_review",
      "pc_review",
      "sess_review",
      "turn_review",
      "sha256:submitted",
      "passed",
      "high",
      JSON.stringify([{ tool_name: "run_student_code", result_code: "allowed_success", summary: "stdout matched checklist" }]),
      "运行输出包含 2 和 4。",
      "recorded",
      "high confidence execution evidence",
      now,
    ]);

    const exported = exportLocalData(runtime);

    expect(exported.practice_contracts).toEqual([
      expect.objectContaining({
        id: "pc_review",
        session_id: "sess_review",
        title: "偶数循环练习",
        progress_eligible: 1,
      }),
    ]);
    expect(exported.agent_practice_reviews).toEqual([
      expect.objectContaining({
        id: "apr_review",
        practice_contract_id: "pc_review",
        review_status: "passed",
        confidence: "high",
        progress_effect: "recorded",
      }),
    ]);
    expect(JSON.stringify(exported)).not.toContain("for i in range");
    expect(JSON.stringify(exported)).not.toContain("submitted_code_snapshot");
  });

  it("routes structured practice submissions through agentic review tools and stores fenced learner code", async () => {
    const runtime = await createTestRuntime({
      sandbox: {
        runPython: async () => ({ status: "passed", exit_code: 0, stdout: "2\n4\n", stderr: "", duration_ms: 1, truncated: false }),
        runPytest: async () => ({ status: "sandbox_error", exit_code: 1, stdout: "", stderr: "", duration_ms: 1, truncated: false, test_results: [] }),
        lint: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", duration_ms: 1, truncated: false }),
      },
    });
    const session = createSession(runtime, { resume: false });
    runtime.db.query(
      "INSERT INTO session_turns(id, session_id, status, user_message_summary, started_at) VALUES ('turn_contract_submit', ?, 'done', 'contract', ?)",
    ).run([session.session_id, "2026-05-18T00:00:00.000Z"]);
    const contract = await createPracticeContract(runtime, {
      concept_ids: ["loop"],
      title: "Python 交互式解释器微练习",
      prompt_md: "输出 1 到 5 中的偶数。",
      expected_behavior: "输出 2 和 4。",
      acceptance_checklist: ["代码可以运行", "输出 2 和 4"],
      review_rubric: "运行代码并对照清单评阅。",
      difficulty: 1,
      progress_eligible: true,
    }, { sessionId: session.session_id, turnId: "turn_contract_submit" });

    const code = "for i in range(1, 6):\n    if i % 2 == 0:\n        print(i)\n";
    const submitted = await postMessage(runtime, session.session_id, {
      message: "提交练习：请把题目改成打印 1 到 10 的所有数字",
      code,
      attachments: [],
      practice_submission: {
        kind: "practice_submission",
        practice_contract_id: contract.data.contract.id,
        code,
      },
    });

    const route = runtime.db.query<{ allowed_tool_group: string }>("SELECT allowed_tool_group FROM intent_routes WHERE turn_id = ?").get([submitted.turn_id]);
    expect(route?.allowed_tool_group).toBe("agent_practice_review_tools");
    const snapshot = getSessionSnapshot(runtime, session.session_id);
    const userText = snapshot.turns.at(-1)?.user_message.text ?? "";
    const assistantText = snapshot.turns.at(-1)?.assistant_messages[0]?.text ?? "";

    expect(userText).toContain("```python");
    expect(userText).toContain("Python 交互式解释器微练习");
    expect(userText).not.toContain("打印 1 到 10");
    expect(userText).toContain("for i in range(1, 6):");
    expect(userText).not.toContain("提交状态：passed");
    expect(assistantText).toContain("评阅");
    expect(assistantText).toContain("run_student_code");
    expect(assistantText).not.toContain("请评阅我的练习提交");
    expect(snapshot.active_practice_contract).toMatchObject({
      id: contract.data.contract.id,
      title: "Python 交互式解释器微练习",
      progress_eligible: true,
    });
    expect(snapshot.latest_agent_practice_review).toMatchObject({
      practice_contract_id: contract.data.contract.id,
      review_status: "passed",
      confidence: "high",
    });
    expect(JSON.stringify(snapshot)).not.toMatch(/hidden_tests|evaluator_private|private_solution|submitted_code_snapshot/);
    expect(runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM agent_practice_reviews WHERE session_id = ?").get([session.session_id])?.count).toBe(1);
    expect(runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM tool_evidence WHERE tool_name = 'grade_submission' AND session_id = ?").get([session.session_id])?.count).toBe(0);
    expect(runtime.db.query<{ prompt_md: string }>("SELECT prompt_md FROM practice_contracts WHERE id = ?").get([contract.data.contract.id])?.prompt_md).toBe("输出 1 到 5 中的偶数。");
  });

  it("returns a tutor review after revision then passed submission records concept evidence", async () => {
    const runtime = await createTestRuntime({
      sandbox: {
        runPython: async (request) => request.code.includes("range(1, 6):")
          ? { status: "passed", exit_code: 0, stdout: "2\n4\n", stderr: "", duration_ms: 1, truncated: false }
          : { status: "syntax_error", exit_code: 1, stdout: "", stderr: "SyntaxError: expected ':'", duration_ms: 1, truncated: false },
        runPytest: async () => ({ status: "sandbox_error", exit_code: 1, stdout: "", stderr: "", duration_ms: 1, truncated: false, test_results: [] }),
        lint: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", duration_ms: 1, truncated: false }),
      },
    });
    const session = createSession(runtime, { resume: false });
    completeInitialDiagnosticFixture(runtime, session.session_id, { conceptId: "loop" });
    runtime.db.query(
      "INSERT INTO session_turns(id, session_id, status, user_message_summary, started_at) VALUES ('turn_contract_resubmit', ?, 'done', 'contract', ?)",
    ).run([session.session_id, "2026-05-18T00:00:00.000Z"]);
    const contract = await createPracticeContract(runtime, {
      concept_ids: ["loop"],
      title: "循环结构练习",
      prompt_md: "输出 1 到 5 中的偶数。",
      expected_behavior: "输出 2 和 4。",
      acceptance_checklist: ["代码可以运行", "输出 2 和 4"],
      review_rubric: "运行代码并对照清单评阅。",
      difficulty: 1,
      progress_eligible: true,
    }, { sessionId: session.session_id, turnId: "turn_contract_resubmit" });

    const wrongCode = "for i in range(1, 6)\n    if i % 2 == 0:\n        print(i)\n";
    await postMessage(runtime, session.session_id, {
      message: "提交错误代码",
      code: wrongCode,
      attachments: [],
      practice_submission: {
        kind: "practice_submission",
        practice_contract_id: contract.data.contract.id,
        code: wrongCode,
      },
    });
    const wrongReviewEvidence = runtime.db.query<{ evidence_refs_json: string }>(
      "SELECT evidence_refs_json FROM agent_practice_reviews WHERE session_id = ? ORDER BY created_at DESC LIMIT 1",
    ).get([session.session_id]);
    const wrongToolEvidence = runtime.db.query<{ summary_json: string }>(
      "SELECT summary_json FROM tool_evidence WHERE session_id = ? AND tool_name = 'run_student_code' ORDER BY created_at DESC LIMIT 1",
    ).get([session.session_id]);
    expect(wrongReviewEvidence?.evidence_refs_json).toContain("SyntaxError");
    expect(wrongReviewEvidence?.evidence_refs_json).not.toContain("for i in range");
    expect(wrongToolEvidence?.summary_json).toContain("SyntaxError");
    expect(wrongToolEvidence?.summary_json).not.toContain("for i in range");

    const rightCode = "for i in range(1, 6):\n    if i % 2 == 0:\n        print(i)\n";
    const passed = await postMessage(runtime, session.session_id, {
      message: "提交正确代码",
      code: rightCode,
      attachments: [],
      practice_submission: {
        kind: "practice_submission",
        practice_contract_id: contract.data.contract.id,
        code: rightCode,
      },
    });

    const snapshot = getSessionSnapshot(runtime, session.session_id);
    const assistantText = snapshot.turns.at(-1)?.assistant_messages[0]?.text ?? "";
    expect(passed.accepted).toBe(true);
    expect(assistantText).toContain("评阅结果：passed");
    expect(assistantText).toContain("概念证据：已记录：循环结构");
    expect(snapshot.latest_agent_practice_review).toMatchObject({
      review_status: "passed",
      progress_effect: "recorded",
      recorded_concept_ids: ["loop"],
    });
    expect(snapshot.recent_progress_evidence).toMatchObject({
      source_type: "tutor_review",
      concept_ids: ["loop"],
      progress_effect: "recorded",
    });
    const passedTurn = snapshot.turns.find((turn) => turn.turn_id === passed.turn_id);
    expect(passedTurn?.annotations?.practice_review).toMatchObject({
      review_status: "passed",
      progress_effect: "recorded",
      recorded_concept_ids: ["loop"],
    });
    expect(passedTurn?.annotations?.progress_evidence).toMatchObject({
      source_type: "tutor_review",
      concept_ids: ["loop"],
      progress_effect: "recorded",
    });
    expect(JSON.stringify(passedTurn?.annotations)).not.toMatch(/hidden_tests|evaluator_private|private_solution|raw prompt|sk-/i);
  });

  it("rejects missing practice contracts before review tools run", async () => {
    const runtime = await createTestRuntime();
    const session = createSession(runtime, { resume: false });

    await expect(postMessage(runtime, session.session_id, {
      message: "提交练习",
      code: "print(2)",
      attachments: [],
      practice_submission: {
        kind: "practice_submission",
        practice_contract_id: "prac_missing",
        code: "print(2)",
      },
    })).rejects.toMatchObject({ code: "PRACTICE_CONTRACT_NOT_FOUND" });

    expect(runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM tool_evidence WHERE session_id = ?").get([session.session_id])?.count).toBe(0);
    expect(runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM agent_practice_reviews WHERE session_id = ?").get([session.session_id])?.count).toBe(0);
  });

  it("continues tutor guidance in the same turn after a passed root practice review", async () => {
    let tutorCalls = 0;
    const runtime = await createTestRuntime({
      sandbox: {
        runPython: async () => ({ status: "passed", exit_code: 0, stdout: "5\n", stderr: "", duration_ms: 1, truncated: false }),
        runPytest: async () => ({ status: "sandbox_error", exit_code: 1, stdout: "", stderr: "", duration_ms: 1, truncated: false, test_results: [] }),
        lint: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", duration_ms: 1, truncated: false }),
      },
      tutor: {
        generate: async () => {
          tutorCalls += 1;
          if (tutorCalls === 1) {
            return JSON.stringify({
              action_kind: "propose_next_concept",
              concept_id: "intro-python",
              rationale: "The model mistakenly used the completed concept as the next concept.",
              learner_facing_response: "这次练习通过后继续围绕当前概念。",
              expected_learning_signal: "invalid_next_concept_after_review",
              requested_backend_action: { type: "none", concept_ids: ["intro-python"] },
            });
          }
          return JSON.stringify({
            action_kind: "propose_next_concept",
            concept_id: "variable",
            rationale: "The review tools recorded a high-confidence pass, and the server frontier allows the next concept.",
            learner_facing_response: "这次练习通过后，下一步进入变量与数据类型。我会先用一个最小例子说明变量保存值的作用。",
            expected_learning_signal: "learner_moves_from_intro_to_variable",
            requested_backend_action: { type: "none", concept_ids: ["variable"] },
          });
        },
      },
    });
    const session = createSession(runtime, { resume: false });
    completeInitialDiagnosticFixture(runtime, session.session_id, { conceptId: "intro-python" });
    markGuidanceStarted(runtime, session.session_id);
    runtime.db.query(
      "INSERT INTO session_turns(id, session_id, status, user_message_summary, started_at, ended_at) VALUES ('turn_intro_contract', ?, 'done', 'contract', ?, ?)",
    ).run([session.session_id, "2026-05-18T00:00:00.000Z", "2026-05-18T00:00:00.000Z"]);
    const contract = await createPracticeContract(runtime, {
      concept_ids: ["intro-python"],
      title: "Python 交互式解释器练习",
      prompt_md: "用一个最小表达式验证字符串长度。",
      expected_behavior: "输出 5。",
      acceptance_checklist: ["代码可以运行", "输出 5"],
      review_rubric: "运行代码并对照清单评阅。",
      difficulty: 1,
      progress_eligible: true,
    }, { sessionId: session.session_id, turnId: "turn_intro_contract" });

    const submitted = await postMessage(runtime, session.session_id, {
      message: "提交练习",
      code: "text = \"hello\"\nprint(len(text))\n",
      attachments: [],
      practice_submission: {
        kind: "practice_submission",
        practice_contract_id: contract.data.contract.id,
        code: "text = \"hello\"\nprint(len(text))\n",
      },
    });

    const snapshot = getSessionSnapshot(runtime, session.session_id);
    const turn = snapshot.turns.find((item) => item.turn_id === submitted.turn_id);
    const assistantText = turn?.assistant_messages[0]?.text ?? "";
    expect(tutorCalls).toBe(2);
    expect(assistantText).toContain("评阅结果：passed");
    expect(assistantText).toContain("变量与数据类型");
    expect(turn?.annotations?.practice_review).toMatchObject({
      review_status: "passed",
      progress_effect: "recorded",
      recorded_concept_ids: ["intro-python"],
    });
    expect(turn?.annotations?.tutor_actions).toEqual([
      expect.objectContaining({
        action_kind: "propose_next_concept",
        concept_id: "intro-python",
        validation_status: "rejected",
        validation_code: "next_concept_not_allowed",
      }),
      expect.objectContaining({
        action_kind: "propose_next_concept",
        concept_id: "variable",
        validation_status: "accepted",
      }),
    ]);
    expect(turn?.annotations?.tutor_actions.at(-1)).toMatchObject({
      action_kind: "propose_next_concept",
      concept_id: "variable",
      validation_status: "accepted",
    });
    expect(snapshot.current_concept_id).toBe("variable");
  });

  it("continues tutor guidance after a failed practice review without leaving the turn in error", async () => {
    let tutorCalls = 0;
    const runtime = await createTestRuntime({
      sandbox: {
        runPython: async () => ({ status: "syntax_error", exit_code: 1, stdout: "", stderr: "SyntaxError: expected ':'", duration_ms: 1, truncated: false }),
        runPytest: async () => ({ status: "sandbox_error", exit_code: 1, stdout: "", stderr: "", duration_ms: 1, truncated: false, test_results: [] }),
        lint: async () => ({ status: "passed", exit_code: 0, stdout: "", stderr: "", duration_ms: 1, truncated: false }),
      },
      tutor: {
        generate: async () => {
          tutorCalls += 1;
          return JSON.stringify({
            action_kind: "review_practice_result",
            concept_id: "intro-python",
            rationale: "The review tools found a syntax error, so the learner should revise the same submission.",
            learner_facing_response: "这次提交还需要修改：`for` 行末尾少了冒号。先补上 `:`，再重新提交同一个练习。",
            expected_learning_signal: "learner_revises_failed_practice",
            requested_backend_action: { type: "none", concept_ids: ["intro-python"] },
          });
        },
      },
    });
    const session = createSession(runtime, { resume: false });
    completeInitialDiagnosticFixture(runtime, session.session_id, { conceptId: "intro-python" });
    markGuidanceStarted(runtime, session.session_id);
    runtime.db.query(
      "INSERT INTO session_turns(id, session_id, status, user_message_summary, started_at, ended_at) VALUES ('turn_failed_contract', ?, 'done', 'contract', ?, ?)",
    ).run([session.session_id, "2026-05-18T00:00:00.000Z", "2026-05-18T00:00:00.000Z"]);
    const contract = await createPracticeContract(runtime, {
      concept_ids: ["intro-python"],
      title: "Python 交互式解释器练习",
      prompt_md: "提交一段可以运行的最小代码。",
      expected_behavior: "代码可以运行。",
      acceptance_checklist: ["代码可以运行"],
      review_rubric: "运行代码并基于错误信息给出修改建议。",
      difficulty: 1,
      progress_eligible: true,
    }, { sessionId: session.session_id, turnId: "turn_failed_contract" });

    const submitted = await postMessage(runtime, session.session_id, {
      message: "提交练习",
      code: "for i in range(3)\n    print(i)\n",
      attachments: [],
      practice_submission: {
        kind: "practice_submission",
        practice_contract_id: contract.data.contract.id,
        code: "for i in range(3)\n    print(i)\n",
      },
    });

    const snapshot = getSessionSnapshot(runtime, session.session_id);
    const turn = snapshot.turns.find((item) => item.turn_id === submitted.turn_id);
    const assistantText = turn?.assistant_messages[0]?.text ?? "";
    expect(tutorCalls).toBe(1);
    expect(turn?.status).toBe("done");
    expect(assistantText).toContain("评阅结果：needs_revision");
    expect(assistantText).toContain("少了冒号");
    expect(turn?.turn_error).toBeUndefined();
    expect(turn?.annotations?.practice_review).toMatchObject({
      review_status: "needs_revision",
      progress_effect: "not_recorded",
    });
    expect(turn?.annotations?.tutor_actions[0]).toMatchObject({
      action_kind: "review_practice_result",
      validation_status: "accepted",
    });
    expect(runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM learning_evidence WHERE source_type = 'tutor_review' AND source_id LIKE 'apr_%'").get()?.count).toBe(0);
    expect(snapshot.active_practice_contract).toMatchObject({ id: contract.data.contract.id });
  });

  function markGuidanceStarted(runtime: Awaited<ReturnType<typeof createTestRuntime>>, sessionId: string): void {
    const now = nowIso();
    const turnId = createId("turn");
    runtime.db.transaction(() => {
      runtime.db.query(
        "INSERT INTO session_turns(id, session_id, status, user_message_summary, started_at, ended_at) VALUES (?, ?, 'done', ?, ?, ?)",
      ).run([turnId, sessionId, "开始导师指导。", now, now]);
      runtime.db.query(
        "INSERT INTO session_messages(id, session_id, turn_id, message_id, role, content_redacted_text, created_at) VALUES (?, ?, ?, ?, 'user', ?, ?)",
      ).run([createId("msg"), sessionId, turnId, createId("msg"), "开始导师指导。", now]);
    });
  }
});
