import { describe, expect, it } from "vitest";
import { kbGetPageContent, kbLintStatus, kbOverview, kbReadConcept, kbReadFile, kbReadImage, kbReadSummary, kbSearch } from "../src/tools/kb-tools.js";
import { createTestRuntime } from "./utils/runtime.js";

describe("OpenKB read-only tools", () => {
  it("summarizes the configured KB without accepting caller-provided paths", async () => {
    const runtime = await createTestRuntime();
    const result = await kbOverview(runtime, { include_lint: true });
    expect(result.ok).toBe(true);
    expect(result.data.title).toContain("Practical Python");
    expect(result.data.concept_count).toBeGreaterThan(10);
    expect(result.data.core_concepts.map((item) => item.id)).toContain("loop");
  });

  it("reads concepts by design concept name or alias", async () => {
    const runtime = await createTestRuntime();
    const result = await kbReadConcept(runtime, { concept_name: "循环结构" });
    expect(result.ok).toBe(true);
    expect(result.data.title).toContain("循环");
    expect(result.data.metadata.path).toMatch(/^concepts\//);
    expect(result.data.body).not.toContain("ignore previous instructions");
  });

  it("searches wiki navigation and excludes reports, logs, AGENTS, and openkb internals", async () => {
    const runtime = await createTestRuntime();
    const result = await kbSearch(runtime, { query: "pytest 调试", limit: 10, scope: "all" });
    expect(result.ok).toBe(true);
    expect(result.data.strategy).toBe("wiki_navigation");
    expect(result.data.candidates.length).toBeGreaterThan(0);
    for (const candidate of result.data.candidates) {
      expect(candidate.path).not.toMatch(/(^|\/)(reports|explorations|AGENTS\.md|log\.md|\.openkb|\.env)/);
      expect(candidate.next_tool).toMatch(/^kb_/);
    }
  });

  it("enforces read_file path boundaries with realpath checks", async () => {
    const runtime = await createTestRuntime();
    await expect(kbReadFile(runtime, { path: "../private/solutions/README.md" })).resolves.toMatchObject({
      ok: false,
      code: "KB_PATH_DENIED",
    });
    await expect(kbReadFile(runtime, { path: "AGENTS.md" as string })).resolves.toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
    });
  });

  it("reads summaries and page content through scoped APIs", async () => {
    const runtime = await createTestRuntime();
    const summary = await kbReadSummary(runtime, { doc_name: "01_Python" });
    expect(summary.ok).toBe(true);
    expect(summary.data.metadata.path).toBe("summaries/01_Python.md");

    const page = await kbGetPageContent(runtime, { doc_name: "01_Python", pages: "1" });
    expect(page.ok).toBe(true);
    expect(page.data.body.length).toBeGreaterThan(10);
  });

  it("reads KB images through a base64 envelope with path and size controls", async () => {
    const runtime = await createTestRuntime();
    const image = await kbReadImage(runtime, { path: "sources/images/07_Objects/shallow.png" });
    expect(image.ok).toBe(true);
    expect(image.data.path).toBe("sources/images/07_Objects/shallow.png");
    expect(image.data.mime_type).toBe("image/png");
    expect(image.data.bytes).toBeGreaterThan(1000);
    expect(image.data.base64).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(JSON.stringify(image.data)).not.toContain("E:\\");

    await expect(kbReadImage(runtime, { path: "sources/images/../01_Python.md" })).resolves.toMatchObject({
      ok: false,
      code: "KB_PATH_DENIED",
    });
    await expect(kbReadImage(runtime, { path: "sources/images/07_Objects/not-an-image.svg" })).resolves.toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
    });
  });

  it("returns lint status as a controlled summary without exposing reports", async () => {
    const runtime = await createTestRuntime();
    const lint = await kbLintStatus(runtime, {});
    expect(lint.ok).toBe(true);
    expect(["unknown", "passed", "failed"]).toContain(lint.data.status);
    expect(JSON.stringify(lint.data)).not.toMatch(/reports|explorations|E:\\|assert|hidden/i);

    const overview = await kbOverview(runtime, { include_lint: true });
    expect(overview.data.lint_status).toEqual(lint.data);
  });
});
