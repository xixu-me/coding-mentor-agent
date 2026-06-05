import type { AppRuntime, TutorResponder } from "../../src/types.js";
import { createId, nowIso, stableHash } from "../../src/security/ids.js";

export function diagnosticTutor(): TutorResponder {
  let index = 0;
  return {
    generate: async (request) => {
      index += 1;
      const conceptName = request.message.match(/知识点：([^\n]+)/)?.[1]?.trim() ?? "测试概念";
      return JSON.stringify({
        prompt_md: `测试诊断题 ${index}：${conceptName} 的这个小片段会输出什么？`,
        choices: [
          { id: "a", text: "正确选项" },
          { id: "b", text: "干扰项一" },
          { id: "c", text: "干扰项二" },
        ],
        answer_choice_id: "a",
        difficulty: 1,
      });
    },
  };
}

export function insertGeneratedExerciseFixture(
  runtime: AppRuntime,
  input: { id?: string; conceptIds?: string[]; difficulty?: number } = {},
): { id: string; evaluator: string } {
  const id = input.id ?? createId("gex");
  const conceptIds = input.conceptIds ?? ["loop"];
  const difficulty = input.difficulty ?? 2;
  const now = nowIso();
  const evaluator = [
    "def test_fixture_even_numbers():",
    "    assert True",
  ].join("\n");
  const evaluatorRef = `fixture_evaluator:${id}`;
  runtime.db.transaction(() => {
    runtime.db.query(
      "INSERT INTO generated_exercises(id, concept_ids_json, difficulty, prompt_md, starter_code, sample_cases_json, evaluator_type, evaluator_private_ref, reference_solution_private_ref, evaluator_hash, validation_report_json, common_mistake_probes_json, validation_status, context_trace_id, generator_model_version, generator_prompt_version, schema_version, sandbox_image_version, created_at) VALUES (?, ?, ?, ?, ?, ?, 'unit_tests', ?, ?, ?, ?, ?, 'validated', NULL, 'test-fixture', 'test-fixture', 'generated_exercise.v1', ?, ?)",
    ).run([
      id,
      JSON.stringify(conceptIds),
      difficulty,
      "测试夹具练习提示。",
      "",
      JSON.stringify([{ stdin: "", stdout: "" }]),
      evaluatorRef,
      `fixture_reference:${id}`,
      stableHash(evaluator),
      JSON.stringify({ schema_version: "test_generated_exercise_validation.v1", validation_status: "validated" }),
      JSON.stringify([]),
      runtime.config.sandboxImage,
      now,
    ]);
    runtime.db.query(
      "INSERT INTO generated_exercise_evaluators(id, generated_exercise_id, evaluator_private, reference_solution_private, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run([createId("evid"), id, evaluator, "pass\n", now]);
    runtime.db.query(
      "INSERT INTO exercises(id, title, difficulty, concept_ids_json, prompt_md, public_tests, hidden_tests_ref, status, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, ?, 'generated_private', 'test-fixture', ?, ?)",
    ).run([id, "测试夹具练习", difficulty, JSON.stringify(conceptIds), "测试夹具练习提示。", evaluatorRef, now, now]);
  });
  return { id, evaluator };
}

export function insertProjectPlanFixture(runtime: AppRuntime): { planId: string; activeStepId: string; pendingStepId: string } {
  const now = nowIso();
  const planId = createId("proj");
  const activeStepId = createId("step");
  const pendingStepId = createId("step");
  runtime.db.transaction(() => {
    runtime.db.query("INSERT INTO project_plans(id, title, status, summary, created_at, updated_at) VALUES (?, '测试夹具项目', 'active', '测试夹具项目摘要。', ?, ?)").run([
      planId,
      now,
      now,
    ]);
    runtime.db.query(
      "INSERT INTO project_steps(id, project_plan_id, step_order, title, concept_ids_json, status, acceptance_criteria_json, created_at, updated_at) VALUES (?, ?, 1, '测试夹具步骤一', ?, 'active', ?, ?, ?)",
    ).run([activeStepId, planId, JSON.stringify(["loop"]), JSON.stringify(["测试夹具验收"]), now, now]);
    runtime.db.query(
      "INSERT INTO project_steps(id, project_plan_id, step_order, title, concept_ids_json, status, acceptance_criteria_json, created_at, updated_at) VALUES (?, ?, 2, '测试夹具步骤二', ?, 'pending', ?, ?, ?)",
    ).run([pendingStepId, planId, JSON.stringify(["function"]), JSON.stringify(["测试夹具验收"]), now, now]);
  });
  return { planId, activeStepId, pendingStepId };
}

export function upsertMasteryFixture(
  runtime: AppRuntime,
  conceptId: string,
  input: { mastery?: number; confidence?: number; readiness?: number; evidenceCount?: number; reviewPriority?: number } = {},
): void {
  const now = nowIso();
  runtime.db.query(
    `INSERT INTO concept_mastery(
      concept_id, mastery_level, confidence, readiness, evidence_count, review_priority,
      version, last_practiced_at, last_evidence_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    ON CONFLICT(concept_id) DO UPDATE SET
      mastery_level = excluded.mastery_level,
      confidence = excluded.confidence,
      readiness = excluded.readiness,
      evidence_count = excluded.evidence_count,
      review_priority = excluded.review_priority,
      last_practiced_at = excluded.last_practiced_at,
      last_evidence_at = excluded.last_evidence_at,
      updated_at = excluded.updated_at`,
  ).run([
    conceptId,
    input.mastery ?? 50,
    input.confidence ?? 0.8,
    input.readiness ?? input.mastery ?? 50,
    input.evidenceCount ?? 1,
    input.reviewPriority ?? 1,
    now,
    now,
    now,
  ]);
}
