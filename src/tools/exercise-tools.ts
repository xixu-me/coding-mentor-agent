import { AppError, type AppRuntime, type PracticeExerciseArtifact, type ToolEnvelope } from "../types.js";
import { requirePublishedExercise } from "../db/validators.js";
import { createId, nowIso, stableHash } from "../security/ids.js";
import { errorEnvelope, okEnvelope } from "./envelope.js";
import { runPytest } from "./code-tools.js";
import { assertValid, GradeSubmissionParams, SelectExerciseParams } from "./schemas.js";
import { executeToolThroughGate } from "../server/tool-gate.js";
import { assertInitialDiagnosticComplete } from "../server/diagnostics.js";
import { assertCatalogAvailable, getCatalogConceptById, getCatalogProgressPolicyInputMap, getLatestCatalogRun } from "../server/course-catalog.js";
import { evidenceWeightForOutcome, recordEvidenceAndProject, type ProjectionOutcome } from "../server/progress-policy.js";
import { deriveLearningProgressDecision } from "../server/learning-progress-decision.js";

type ToolRunContext = {
  sessionId?: string | null;
  turnId?: string | null;
};

type ExerciseRow = {
  id: string;
  title: string;
  difficulty: number;
  concept_ids_json: string;
  prompt_md: string;
  public_tests: string | null;
  status?: string;
  catalog_status?: string;
  skip?: number;
  private_solution?: number;
};

type GeneratedExerciseRow = {
  id: string;
  concept_ids_json: string;
  difficulty: number;
  prompt_md: string;
  starter_code: string | null;
  sample_cases_json: string;
  evaluator_private_ref: string;
  evaluator_hash: string;
  validation_status: string;
};

export async function selectExercise(runtime: AppRuntime, params: unknown, context: ToolRunContext = {}): Promise<ToolEnvelope<{
  exercise: PracticeExerciseArtifact;
  recommendation_id: string;
}>> {
  const started = Date.now();
  try {
    if (context.sessionId) {
      const decision = deriveLearningProgressDecision(runtime, { sessionId: context.sessionId });
      if (decision.practice_state === "locked_by_diagnostic" || decision.practice_state === "locked_by_stale_catalog" || decision.practice_state === "guidance_first") {
        throw new AppError("DIAGNOSTIC_REQUIRED", "完成当前课程目录下的初始测评后才能生成练习。", 409);
      }
    }
    assertCatalogAvailable(runtime);
    const input = assertValid<{ concept_ids?: string[]; difficulty?: number; mode?: string }>(SelectExerciseParams, params);
    const conceptIds = normalizeRequestedConceptIds(runtime, input.concept_ids);
    const difficulty = normalizeDifficulty(input.difficulty);
    const generated = selectGeneratedExercise(runtime, conceptIds, difficulty);
    if (generated) {
      return okEnvelope("select_exercise", started, {
        exercise: generated,
        recommendation_id: `practice:${generated.id}`,
      });
    }
    const published = selectPublishedExercise(runtime, conceptIds, difficulty);
    if (published) {
      return okEnvelope("select_exercise", started, {
        exercise: published,
        recommendation_id: `practice:${published.id}`,
      });
    }
    throw new AppError("EXERCISE_CONTENT_UNAVAILABLE", "当前 KB 没有声明可验证的公开练习或生成练习策略，无法生成练习。", 503, true);
  } catch (error) {
    return errorEnvelope("select_exercise", started, error);
  }
}

export async function gradeSubmission(runtime: AppRuntime, params: unknown, context: ToolRunContext = {}): Promise<ToolEnvelope<{
  attempt_id: string;
  exercise_id: string;
  status: "passed" | "failed" | "syntax_error" | "runtime_error" | "timeout" | "sandbox_error";
  score: number;
  public_tests: { passed: number; total: number; failures: Array<{ name: string; message: string }> };
  hidden_tests: { passed: number; total: number; summary: string };
  mistake_tag_ids: string[];
  next_hint: string;
}>> {
  const started = Date.now();
  try {
    const input = assertValid<{ exercise_id: string; code: string; stdin?: string; hint_count?: number }>(GradeSubmissionParams, params);
    const generated = runtime.db.query<GeneratedExerciseRow>(
      "SELECT id, concept_ids_json, difficulty, prompt_md, starter_code, sample_cases_json, evaluator_private_ref, evaluator_hash, validation_status FROM generated_exercises WHERE id = ?",
    ).get([input.exercise_id]);
    const publicTests = generated ? await loadGeneratedEvaluatorThroughPolicy(runtime, generated, context) : loadPublishedExerciseTests(runtime, input.exercise_id);
    const sandbox = await executeToolThroughGate(runtime, {
      sessionId: context.sessionId ?? null,
      turnId: context.turnId ?? null,
      allowedToolGroup: "exercise_submission_tools",
      caller: "workflow",
      toolName: "run_pytest",
      params: {
        code: input.code,
        public_tests: publicTests,
        policy: {
          test_source: generated ? "generated_exercise_evaluator" : "exercise_evaluator",
          evaluator_visibility: generated ? "private" : "public",
        },
      },
      invoke: () => runPytest(runtime, { code: input.code, public_tests: publicTests }),
    });
    const tests = sandbox.data.test_results ?? [];
    const passed = tests.filter((test) => test.passed).length;
    const total = tests.length || (sandbox.ok && sandbox.data.status === "passed" ? 1 : 1);
    const status = sandbox.ok ? (sandbox.data.status === "passed" ? "passed" : sandbox.data.status === "syntax_error" ? "syntax_error" : sandbox.data.status === "runtime_error" ? "runtime_error" : sandbox.data.status === "timeout" ? "timeout" : "failed") : "sandbox_error";
    const score = status === "passed" ? 100 : Math.round((passed / total) * 100);
    const attemptId = createId("att");
    const resultSummary = {
      status,
      public_tests: {
        passed: status === "passed" && tests.length === 0 ? 1 : passed,
        total,
        failures: tests.filter((test) => !test.passed).slice(0, 5).map((test) => ({ name: test.name, message: test.message })),
      },
    };
    const conceptIds = generated ? parseStringArray(generated.concept_ids_json) : loadExerciseConceptIds(runtime, input.exercise_id);
    const outcome = projectionOutcomeForGrade(status, input.hint_count ?? 0);
    const now = nowIso();
    const policyInputs = getCatalogProgressPolicyInputMap(runtime);
    runtime.db.transaction(() => {
      recordExerciseAttempt(runtime, {
        attemptId,
        exerciseId: input.exercise_id,
        code: input.code,
        status,
        score,
        hintCount: input.hint_count ?? 0,
        resultSummary,
        mistakeTagIds: status === "passed" ? [] : ["output_format"],
        generated: Boolean(generated),
        sessionId: context.sessionId ?? null,
        turnId: context.turnId ?? null,
        createdAt: now,
      });
      for (const conceptId of conceptIds) {
        const concept = getCatalogConceptById(runtime, conceptId, { includeInactive: true });
        if (!concept) {
          throw new AppError("CATALOG_CONCEPT_NOT_FOUND", "练习评分引用了未知课程概念。", 400);
        }
        recordEvidenceAndProject(runtime, {
          sourceType: "exercise",
          sourceId: attemptId,
          sessionId: context.sessionId ?? null,
          turnId: context.turnId ?? null,
          conceptId,
          outcome,
          difficulty: generated?.difficulty ?? loadExerciseDifficulty(runtime, input.exercise_id),
          score,
          evaluatorConfidence: sandbox.ok ? 0.95 : 0,
          evidenceWeight: evidenceWeightForOutcome(outcome),
          catalogVersion: concept.catalog_version ?? getLatestCatalogRun(runtime)?.kb_version ?? runtime.config.kbVersion,
          summary: resultSummary,
          hintCount: input.hint_count ?? 0,
          prerequisiteCentrality: policyInputs.get(conceptId)?.prerequisite_weight ?? 0,
          audit: {
            toolCallId: `projection:${attemptId}:${conceptId}`,
            status,
            score,
            conceptIds: [conceptId],
          },
          createdAt: now,
        });
      }
    });
    return okEnvelope("grade_submission", started, {
      attempt_id: attemptId,
      exercise_id: input.exercise_id,
      status,
      score,
      public_tests: resultSummary.public_tests,
      hidden_tests: { passed: 0, total: 0, summary: "" },
      mistake_tag_ids: status === "passed" ? [] : ["output_format"],
      next_hint: status === "passed" ? "可以进入下一题。" : "先用样例输入手动检查输出格式和边界条件。",
    });
  } catch (error) {
    return errorEnvelope("grade_submission", started, error);
  }
}

function normalizeRequestedConceptIds(runtime: AppRuntime, input?: string[]): string[] {
  const selected = (input ?? []).filter((conceptId) => getCatalogConceptById(runtime, conceptId));
  if (input?.length && selected.length === 0) {
    throw new AppError("CATALOG_CONCEPT_NOT_FOUND", "练习请求中的概念不在当前有效课程目录中。", 400);
  }
  return [...new Set(selected)].slice(0, 3);
}

function normalizeDifficulty(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 2;
  return Math.max(1, Math.min(5, Math.round(value)));
}

function selectGeneratedExercise(runtime: AppRuntime, conceptIds: string[], difficulty: number): PracticeExerciseArtifact | null {
  const rows = runtime.db.query<GeneratedExerciseRow>(
    "SELECT id, concept_ids_json, difficulty, prompt_md, starter_code, sample_cases_json, evaluator_private_ref, evaluator_hash, validation_status FROM generated_exercises WHERE validation_status = 'validated' ORDER BY created_at DESC",
  ).all();
  const row = chooseMatching(rows, conceptIds, difficulty);
  if (!row) return null;
  const exercise = runtime.db.query<{ title: string }>("SELECT title FROM exercises WHERE id = ?").get([row.id]);
  return {
    id: row.id,
    title: exercise?.title ?? "当前练习",
    difficulty: row.difficulty,
    concept_ids: parseStringArray(row.concept_ids_json),
    prompt_md: row.prompt_md,
    samples: parseSamples(row.sample_cases_json),
    hint_level: 0,
    submission: { endpoint: `/api/exercises/${encodeURIComponent(row.id)}/submissions`, enabled: true },
  };
}

function selectPublishedExercise(runtime: AppRuntime, conceptIds: string[], difficulty: number): PracticeExerciseArtifact | null {
  const rows = runtime.db.query<ExerciseRow>(
    `SELECT id, title, difficulty, concept_ids_json, prompt_md, public_tests, status, catalog_status, skip, private_solution
     FROM exercises
     WHERE catalog_status = 'active'
       AND status = 'published'
       AND public_tests IS NOT NULL
       AND skip = 0
     ORDER BY ABS(difficulty - ?) ASC, order_index ASC, id ASC`,
  ).all([difficulty]);
  const row = chooseMatching(rows, conceptIds, difficulty);
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    difficulty: row.difficulty,
    concept_ids: parseStringArray(row.concept_ids_json),
    prompt_md: row.prompt_md,
    samples: [],
    hint_level: 0,
    submission: { endpoint: `/api/exercises/${encodeURIComponent(row.id)}/submissions`, enabled: true },
  };
}

function chooseMatching<T extends { concept_ids_json: string; difficulty: number }>(rows: T[], conceptIds: string[], difficulty: number): T | null {
  const requested = new Set(conceptIds);
  const candidates = rows.filter((row) => {
    const rowConcepts = parseStringArray(row.concept_ids_json);
    return requested.size === 0 || rowConcepts.some((conceptId) => requested.has(conceptId));
  });
  return candidates.sort((left, right) => Math.abs(left.difficulty - difficulty) - Math.abs(right.difficulty - difficulty))[0] ?? null;
}

function parseSamples(value: string): Array<{ stdin: string; stdout: string }> {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => item && typeof item === "object" ? item as { stdin?: unknown; stdout?: unknown } : null)
      .filter((item): item is { stdin?: unknown; stdout?: unknown } => item !== null)
      .map((item) => ({
        stdin: typeof item.stdin === "string" ? item.stdin : "",
        stdout: typeof item.stdout === "string" ? item.stdout : "",
      }));
  } catch {
    return [];
  }
}

function projectionOutcomeForGrade(status: string, hintCount: number): ProjectionOutcome {
  if (status === "passed") return hintCount > 0 ? "completed_with_hint" : "completed_independently";
  return hintCount > 0 ? "failed_after_hints" : "repeated_mistake";
}

function loadGeneratedEvaluator(runtime: AppRuntime, exerciseId: string): string {
  const evaluator = runtime.db.query<{ evaluator_private: string }>(
    "SELECT evaluator_private FROM generated_exercise_evaluators WHERE generated_exercise_id = ?",
  ).get([exerciseId]);
  if (!evaluator) throw new Error("Generated evaluator is missing");
  return evaluator.evaluator_private;
}

async function loadGeneratedEvaluatorThroughPolicy(runtime: AppRuntime, generated: GeneratedExerciseRow, context: ToolRunContext): Promise<string> {
  const started = Date.now();
  const access = await executeToolThroughGate(runtime, {
    sessionId: context.sessionId ?? null,
    turnId: context.turnId ?? null,
    allowedToolGroup: "exercise_submission_tools",
    caller: "workflow",
    toolName: "read_private_evaluator",
    params: {
      exercise_id: generated.id,
      evaluator_ref: generated.evaluator_private_ref,
      policy: { evaluator_visibility: "private" },
    },
    invoke: async () => okEnvelope("read_private_evaluator", started, {
      exercise_id: generated.id,
      evaluator_ref: generated.evaluator_private_ref,
      loaded: true,
    }),
  });
  if (!access.ok) {
    throw new Error(access.message);
  }
  return loadGeneratedEvaluator(runtime, generated.id);
}

function loadPublishedExerciseTests(runtime: AppRuntime, exerciseId: string): string {
  requirePublishedExercise(runtime, exerciseId);
  const row = runtime.db.query<ExerciseRow>("SELECT id, title, difficulty, concept_ids_json, prompt_md, public_tests FROM exercises WHERE id = ?").get([exerciseId]);
  if (!row?.public_tests) {
    throw new Error("Exercise has no public tests");
  }
  return row.public_tests;
}

function loadExerciseConceptIds(runtime: AppRuntime, exerciseId: string): string[] {
  const row = runtime.db.query<{ concept_ids_json: string }>("SELECT concept_ids_json FROM exercises WHERE id = ?").get([exerciseId]);
  return row ? parseStringArray(row.concept_ids_json) : [];
}

function loadExerciseDifficulty(runtime: AppRuntime, exerciseId: string): number {
  return runtime.db.query<{ difficulty: number }>("SELECT difficulty FROM exercises WHERE id = ?").get([exerciseId])?.difficulty ?? 2;
}

function recordExerciseAttempt(
  runtime: AppRuntime,
  input: {
    attemptId: string;
    exerciseId: string;
    code: string;
    status: string;
    score: number;
    hintCount: number;
    resultSummary: unknown;
    mistakeTagIds: string[];
    generated: boolean;
    sessionId?: string | null;
    turnId?: string | null;
    createdAt?: string;
  },
): void {
  runtime.db.query(
    "INSERT INTO exercise_attempts(id, exercise_id, session_id, turn_id, code_hash, code_snapshot, status, score, hint_count, result_summary_json, mistake_tag_ids_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run([
    input.attemptId,
    input.exerciseId,
    input.sessionId ?? null,
    input.turnId ?? null,
    stableHash(input.code),
    input.code,
    input.status,
    input.score,
    input.hintCount,
    JSON.stringify(input.resultSummary),
    JSON.stringify(input.mistakeTagIds),
    input.createdAt ?? nowIso(),
  ]);
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
