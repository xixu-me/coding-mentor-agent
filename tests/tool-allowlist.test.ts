import { describe, expect, it } from "vitest";
import { BATCH_A_ALLOWLIST, FULL_MVP_ALLOWLIST, getEnabledToolNames } from "../src/tools/registry.js";
import { kbSearch } from "../src/tools/kb-tools.js";
import { createTestRuntime } from "./utils/runtime.js";

describe("tool allowlist", () => {
  it("keeps the batch A allowlist exactly aligned with the design document", () => {
    expect(BATCH_A_ALLOWLIST).toEqual([
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
    ]);
  });

  it("enables the full MVP tools only after their schemas and handlers exist", () => {
    expect(getEnabledToolNames("full")).toEqual(FULL_MVP_ALLOWLIST);
    expect(FULL_MVP_ALLOWLIST).toContain("submit_project_step");
    expect(FULL_MVP_ALLOWLIST).toContain("kb_read_image");
    expect(FULL_MVP_ALLOWLIST).toContain("kb_lint_status");
    expect(FULL_MVP_ALLOWLIST).not.toContain("read");
    expect(FULL_MVP_ALLOWLIST).not.toContain("bash");
    expect(FULL_MVP_ALLOWLIST).not.toContain("edit");
    expect(FULL_MVP_ALLOWLIST).not.toContain("write");
  });

  it("keeps batch C limited to project tools before final read-only resource tools", () => {
    expect(getEnabledToolNames("batch-c")).toContain("submit_project_step");
    expect(getEnabledToolNames("batch-c")).not.toContain("kb_read_image");
    expect(getEnabledToolNames("batch-c")).not.toContain("kb_lint_status");
    expect(getEnabledToolNames("full")).toContain("kb_read_image");
    expect(getEnabledToolNames("full")).toContain("kb_lint_status");
  });

  it("does not let kb_search return tools outside the enabled allowlist", async () => {
    const runtime = await createTestRuntime();
    const result = await kbSearch(runtime, { query: "循环", limit: 5, scope: "all" });
    expect(result.ok).toBe(true);
    for (const candidate of result.data.candidates) {
      expect(getEnabledToolNames("batch-a")).toContain(candidate.next_tool);
    }
  });
});
