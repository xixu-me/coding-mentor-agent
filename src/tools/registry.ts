import type { EnabledBatch } from "../types.js";

export const BATCH_A_ALLOWLIST = [
  "kb_overview",
  "kb_search",
  "kb_read_concept",
  "kb_read_summary",
  "kb_read_file",
  "kb_get_page_content",
  "run_python",
  "get_student_profile",
  "get_concept_mastery",
  "get_recent_learning_context",
  "record_learning_event",
] as const;

export const BATCH_B_ALLOWLIST = [
  "run_pytest",
  "select_exercise",
  "grade_submission",
  "tag_mistake",
  "update_mastery",
  "create_practice_contract",
  "get_active_practice_contract",
  "check_python_syntax",
  "run_student_code",
  "run_review_probe",
  "record_agent_review",
  "request_learning_progress_update",
] as const;

export const BATCH_C_ALLOWLIST = [
  "create_project_plan",
  "get_project_state",
  "recommend_project_next_step",
  "submit_project_step",
  "review_project_code",
  "record_project_progress",
] as const;

export const FULL_MVP_ALLOWLIST = [
  ...BATCH_A_ALLOWLIST,
  ...BATCH_B_ALLOWLIST,
  ...BATCH_C_ALLOWLIST,
  "kb_read_image",
  "kb_lint_status",
] as const;

export function getEnabledToolNames(batch: EnabledBatch): string[] {
  if (batch === "batch-a") {
    return [...BATCH_A_ALLOWLIST];
  }
  if (batch === "batch-b") {
    return [...BATCH_A_ALLOWLIST, ...BATCH_B_ALLOWLIST];
  }
  if (batch === "batch-c") {
    return [...BATCH_A_ALLOWLIST, ...BATCH_B_ALLOWLIST, ...BATCH_C_ALLOWLIST];
  }
  if (batch === "full") {
    return [...FULL_MVP_ALLOWLIST];
  }
  return [...BATCH_A_ALLOWLIST];
}
