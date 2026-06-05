import { Ajv } from "ajv";
import { Type, type TSchema } from "@sinclair/typebox";
import { AppError } from "../types.js";

const ajv = new Ajv({ allErrors: true, useDefaults: true, removeAdditional: "all" });

export const KbOverviewParams = Type.Object({ include_lint: Type.Optional(Type.Boolean({ default: false })) });
export const KbReadConceptParams = Type.Object({ concept_name: Type.String({ minLength: 1, maxLength: 80 }) });
export const KbSearchParams = Type.Object({
  query: Type.String({ minLength: 1, maxLength: 200 }),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 10, default: 5 })),
  scope: Type.Optional(Type.Union([Type.Literal("all"), Type.Literal("concepts"), Type.Literal("summaries"), Type.Literal("sources")])),
});
export const KbGetPageContentParams = Type.Object({
  doc_name: Type.String({ minLength: 1, maxLength: 120 }),
  pages: Type.String({ pattern: "^[0-9,\\- ]+$", maxLength: 60 }),
});
export const KbReadFileParams = Type.Object({
  path: Type.String({
    minLength: 1,
    maxLength: 240,
    pattern: "^(summaries|concepts|sources)/[A-Za-z0-9_./\\-\\u4e00-\\u9fa5 ]+\\.(md|json)$",
  }),
});
export const KbReadSummaryParams = Type.Object({ doc_name: Type.String({ minLength: 1, maxLength: 120 }) });
export const KbReadImageParams = Type.Object({
  path: Type.String({
    minLength: 1,
    maxLength: 240,
    pattern: "^sources/images/[A-Za-z0-9_./\\-\\u4e00-\\u9fa5 ]+\\.(png|jpg|jpeg|webp|gif|bmp)$",
  }),
});
export const KbLintStatusParams = Type.Object({});

export const RunPythonParams = Type.Object({
  code: Type.String({ minLength: 1, maxLength: 20000 }),
  stdin: Type.Optional(Type.String({ maxLength: 4000 })),
  files: Type.Optional(Type.Array(Type.Object({ path: Type.String({ maxLength: 120 }), content: Type.String({ maxLength: 20000 }) }), { maxItems: 10 })),
  limits: Type.Optional(Type.Object({
    timeout_ms: Type.Optional(Type.Integer({ minimum: 100, maximum: 5000 })),
    memory_mb: Type.Optional(Type.Integer({ minimum: 32, maximum: 256 })),
    output_bytes: Type.Optional(Type.Integer({ minimum: 1000, maximum: 20000 })),
  })),
});

export const RunPytestParams = Type.Object({
  code: Type.String({ minLength: 1, maxLength: 30000 }),
  public_tests: Type.String({ minLength: 1, maxLength: 30000 }),
  hidden_tests_ref: Type.Optional(Type.String({ maxLength: 120 })),
  limits: Type.Optional(Type.Object({
    timeout_ms: Type.Optional(Type.Integer({ minimum: 500, maximum: 10000 })),
    memory_mb: Type.Optional(Type.Integer({ minimum: 32, maximum: 256 })),
  })),
});

export const GetStudentProfileParams = Type.Object({});

export const SelectExerciseParams = Type.Object({
  concept_ids: Type.Optional(Type.Array(Type.String({ minLength: 1, maxLength: 80 }), { maxItems: 5 })),
  difficulty: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
  mode: Type.Optional(Type.Union([Type.Literal("practice"), Type.Literal("review"), Type.Literal("diagnostic")])),
});

export const GradeSubmissionParams = Type.Object({
  exercise_id: Type.String({ minLength: 1, maxLength: 120 }),
  code: Type.String({ minLength: 1, maxLength: 30000 }),
  stdin: Type.Optional(Type.String({ maxLength: 4000 })),
  hint_count: Type.Optional(Type.Integer({ minimum: 0, maximum: 10 })),
});

export const CreatePracticeContractParams = Type.Object({
  concept_ids: Type.Array(Type.String({ minLength: 1, maxLength: 80 }), { minItems: 1, maxItems: 5 }),
  title: Type.String({ minLength: 1, maxLength: 120 }),
  prompt_md: Type.String({ minLength: 1, maxLength: 4000 }),
  starter_code: Type.Optional(Type.String({ maxLength: 4000 })),
  expected_behavior: Type.String({ minLength: 1, maxLength: 1000 }),
  visible_examples: Type.Optional(Type.Array(Type.Object({}, { additionalProperties: true }), { maxItems: 5 })),
  acceptance_checklist: Type.Array(Type.String({ minLength: 1, maxLength: 300 }), { minItems: 1, maxItems: 8 }),
  allowed_solution_shape: Type.Optional(Type.String({ maxLength: 300 })),
  review_rubric: Type.String({ minLength: 1, maxLength: 1000 }),
  difficulty: Type.Integer({ minimum: 1, maximum: 5 }),
  progress_eligible: Type.Boolean(),
});

export const GetActivePracticeContractParams = Type.Object({
  practice_contract_id: Type.Optional(Type.String({ maxLength: 120 })),
});

export const PracticeReviewExecutionParams = Type.Object({
  practice_contract_id: Type.String({ minLength: 1, maxLength: 120 }),
  code: Type.String({ minLength: 1, maxLength: 20000 }),
  stdin: Type.Optional(Type.String({ maxLength: 4000 })),
});

export const PracticeReviewProbeParams = Type.Object({
  practice_contract_id: Type.String({ minLength: 1, maxLength: 120 }),
  code: Type.String({ minLength: 1, maxLength: 20000 }),
  probe_code: Type.String({ minLength: 1, maxLength: 4000 }),
});

export const RecordAgentReviewParams = Type.Object({
  practice_contract_id: Type.String({ minLength: 1, maxLength: 120 }),
  submitted_code: Type.String({ minLength: 1, maxLength: 20000 }),
  review_status: Type.Union([Type.Literal("passed"), Type.Literal("partial"), Type.Literal("needs_revision"), Type.Literal("blocked_by_error")]),
  confidence: Type.Union([Type.Literal("high"), Type.Literal("medium"), Type.Literal("low")]),
  evidence_refs: Type.Array(Type.Object({
    tool_name: Type.String({ minLength: 1, maxLength: 80 }),
    result_code: Type.String({ minLength: 1, maxLength: 80 }),
    summary: Type.String({ minLength: 1, maxLength: 500 }),
  }), { minItems: 1, maxItems: 10 }),
  learner_facing_summary: Type.String({ minLength: 1, maxLength: 1200 }),
});

export const RequestLearningProgressUpdateParams = Type.Object({
  review_id: Type.String({ minLength: 1, maxLength: 120 }),
});

export const UpdateMasteryParams = Type.Object({
  turn_id: Type.String({ minLength: 1, maxLength: 120 }),
  concept_ids: Type.Array(Type.String({ minLength: 1, maxLength: 80 }), { minItems: 1, maxItems: 5 }),
  outcome: Type.Union([
    Type.Literal("completed_independently"),
    Type.Literal("completed_with_hint"),
    Type.Literal("explained_mistake"),
    Type.Literal("failed_after_hints"),
    Type.Literal("repeated_mistake"),
  ]),
  difficulty: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
  hint_count: Type.Optional(Type.Integer({ minimum: 0, maximum: 10 })),
  evidence: Type.Object({
    attempt_id: Type.Optional(Type.String({ maxLength: 120 })),
    tool_call_id: Type.Optional(Type.String({ maxLength: 120 })),
    summary: Type.String({ minLength: 1, maxLength: 1000 }),
  }),
});

export const GetConceptMasteryParams = Type.Object({
  concept_ids: Type.Array(Type.String({ minLength: 1, maxLength: 80 }), { minItems: 1, maxItems: 5 }),
});

export const GetRecentLearningContextParams = Type.Object({
  concept_ids: Type.Optional(Type.Array(Type.String({ minLength: 1, maxLength: 80 }), { maxItems: 5 })),
  include_active_exercise: Type.Optional(Type.Boolean({ default: true })),
  include_active_project: Type.Optional(Type.Boolean({ default: true })),
  event_limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 10, default: 5 })),
});

export const TagMistakeParams = Type.Object({
  turn_id: Type.String({ minLength: 1, maxLength: 120 }),
  concept_ids: Type.Array(Type.String({ minLength: 1, maxLength: 80 }), { maxItems: 5 }),
  mistake_tag_ids: Type.Array(Type.String({ minLength: 1, maxLength: 80 }), { minItems: 1, maxItems: 5 }),
  evidence: Type.Object({
    tool_call_id: Type.Optional(Type.String({ maxLength: 120 })),
    summary: Type.String({ minLength: 1, maxLength: 1000 }),
  }),
});

export const RecordLearningEventParams = Type.Object({
  event_type: Type.Union([
    Type.Literal("concept_explained"),
    Type.Literal("code_explained"),
    Type.Literal("debug_hint_given"),
    Type.Literal("independent_fixed"),
    Type.Literal("diagnostic_completed"),
    Type.Literal("profile_initialized"),
    Type.Literal("exercise_started"),
    Type.Literal("exercise_submitted"),
    Type.Literal("mistake_tagged"),
    Type.Literal("progress_viewed"),
    Type.Literal("recommendation_shown"),
    Type.Literal("project_step_started"),
    Type.Literal("project_step_completed"),
  ]),
  concept_ids: Type.Array(Type.String({ minLength: 1, maxLength: 80 }), { maxItems: 5 }),
  payload: Type.Optional(Type.Object({
    hint_count: Type.Optional(Type.Integer({ minimum: 0, maximum: 10 })),
    outcome: Type.Optional(Type.String({ maxLength: 80 })),
    diagnostic_id: Type.Optional(Type.String({ maxLength: 120 })),
    exercise_id: Type.Optional(Type.String({ maxLength: 120 })),
    attempt_id: Type.Optional(Type.String({ maxLength: 120 })),
  })),
  evidence: Type.Object({
    session_turn_id: Type.String({ minLength: 1, maxLength: 120 }),
    tool_call_id: Type.Optional(Type.String({ maxLength: 120 })),
    summary: Type.String({ maxLength: 1000 }),
  }),
});

export const ProjectPlanParams = Type.Object({
  project_goal: Type.String({ minLength: 1, maxLength: 200 }),
  preferred_difficulty: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
});
export const ProjectStateParams = Type.Object({ project_plan_id: Type.Optional(Type.String({ maxLength: 120 })) });
export const RecommendProjectNextStepParams = Type.Object({ project_plan_id: Type.String({ minLength: 1, maxLength: 120 }) });
export const SubmitProjectStepParams = Type.Object({
  project_plan_id: Type.String({ minLength: 1, maxLength: 120 }),
  project_step_id: Type.String({ minLength: 1, maxLength: 120 }),
  code: Type.String({ minLength: 1, maxLength: 20000 }),
  files: Type.Optional(Type.Array(Type.Object({ path: Type.String({ minLength: 1, maxLength: 120 }), content: Type.String({ maxLength: 20000 }) }), { maxItems: 8 })),
});
export const ReviewProjectCodeParams = Type.Object({
  project_plan_id: Type.String({ minLength: 1, maxLength: 120 }),
  project_step_id: Type.String({ minLength: 1, maxLength: 120 }),
  submission_id: Type.String({ minLength: 1, maxLength: 120 }),
});
export const RecordProjectProgressParams = Type.Object({
  project_plan_id: Type.String({ minLength: 1, maxLength: 120 }),
  project_step_id: Type.String({ minLength: 1, maxLength: 120 }),
  submission_id: Type.Optional(Type.String({ maxLength: 120 })),
  status: Type.Union([
    Type.Literal("started"),
    Type.Literal("submitted"),
    Type.Literal("passed"),
    Type.Literal("needs_revision"),
  ]),
  summary: Type.String({ minLength: 1, maxLength: 1000 }),
});

export function assertValid<T = any>(schema: TSchema, value: unknown): T {
  const validate = ajv.compile(schema);
  if (!validate(value)) {
    throw new AppError("VALIDATION_ERROR", ajv.errorsText(validate.errors));
  }
  return value as T;
}
