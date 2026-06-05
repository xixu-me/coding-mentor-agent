import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getActiveCatalogConcepts,
  getCatalogDiagnosticsConcepts,
  getCatalogUnits,
  getLatestCatalogSyncStatus,
  getSafeCatalogSummary,
  syncCourseCatalog,
} from "../src/server/course-catalog.js";
import { createTestRuntime } from "./utils/runtime.js";
import { createTempDir } from "./utils/fs.js";
import { upsertMasteryFixture } from "./utils/content-fixtures.js";

describe("KB-driven course catalog", () => {
  it("syncs concepts, exercises, and catalog metadata from the configured KB", async () => {
    const runtime = await createTestRuntime();

    const concepts = getActiveCatalogConcepts(runtime);
    const units = getCatalogUnits(runtime);
    const loop = concepts.find((concept) => concept.id === "loop");
    const run = runtime.db.query<{ count: number; kb_version: string }>("SELECT COUNT(*) AS count, MAX(kb_version) AS kb_version FROM course_catalog_runs").get();
    const seededExercise = runtime.db.query<{ id: string }>("SELECT id FROM exercises WHERE id = 'ex_even_numbers'").get();
    const exerciseCount = runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM exercises WHERE catalog_status = 'active'").get();
    const activeTagSources = runtime.db.query<{ metadata_json: string; catalog_version: string }>(
      "SELECT metadata_json, catalog_version FROM mistake_tags WHERE catalog_status = 'active'",
    ).all();

    expect(concepts.length).toBeGreaterThan(20);
    expect(units.map((unit) => unit.title)).toEqual([
      "入门与基础",
      "数据处理",
      "程序组织",
      "类与对象",
      "对象模型",
      "生成器",
      "进阶主题",
      "测试与调试",
      "包与工程化",
    ]);
    expect(units.map((unit) => unit.title)).not.toContain("KB 概念");
    expect(units.map((unit) => unit.title)).not.toContain("Introduction");
    expect(loop).toMatchObject({
      id: "loop",
      source_path: "concepts/Python-控制流与缩进.md",
      catalog_status: "active",
      catalog_version: "practical-python-2026-05",
    });
    expect(loop?.source_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(run).toMatchObject({ count: 1, kb_version: "practical-python-2026-05" });
    expect(seededExercise).toBeUndefined();
    expect(exerciseCount?.count).toBeGreaterThan(20);
    expect(activeTagSources.length).toBeGreaterThan(0);
    expect(activeTagSources.every((tag) => JSON.parse(tag.metadata_json).source_type === "mistake_tag")).toBe(true);
    expect(activeTagSources.every((tag) => tag.catalog_version === "practical-python-2026-05")).toBe(true);
  });

  it("is idempotent and preserves mastery evidence across repeated syncs", async () => {
    const runtime = await createTestRuntime();
    upsertMasteryFixture(runtime, "loop", { mastery: 77, confidence: 0.88, readiness: 68, evidenceCount: 3 });

    const before = getActiveCatalogConcepts(runtime).length;
    syncCourseCatalog(runtime);
    syncCourseCatalog(runtime);
    const after = getActiveCatalogConcepts(runtime).length;
    const mastery = runtime.db.query<{ mastery_level: number; confidence: number; evidence_count: number }>(
      "SELECT mastery_level, confidence, evidence_count FROM concept_mastery WHERE concept_id = 'loop'",
    ).get();

    expect(after).toBe(before);
    expect(mastery).toMatchObject({ mastery_level: 77, confidence: 0.88, evidence_count: 3 });
  });

  it("marks missing catalog concepts inactive instead of deleting progress", async () => {
    const runtime = await createTestRuntime();
    upsertMasteryFixture(runtime, "loop", { mastery: 66, confidence: 0.8, readiness: 53, evidenceCount: 2 });
    const kbRoot = createStrictKb({
      concepts: [
        { id: "kb-minimal-concept", title: "Minimal Concept", unit_id: "minimal", source_path: "concepts/kb-minimal-concept.md", diagnostic_scope: true },
      ],
      units: [{ id: "minimal", title: "Minimal Unit", order: 1, source_path: "summaries/minimal.md" }],
    });
    runtime.config.kbRoot = kbRoot;
    runtime.config.kbVersion = "kb-minimal";

    syncCourseCatalog(runtime);

    const oldLoop = runtime.db.query<{ catalog_status: string }>("SELECT catalog_status FROM concepts WHERE id = 'loop'").get();
    const oldMastery = runtime.db.query<{ mastery_level: number; evidence_count: number }>(
      "SELECT mastery_level, evidence_count FROM concept_mastery WHERE concept_id = 'loop'",
    ).get();
    const minimal = runtime.db.query<{ id: string; catalog_status: string }>("SELECT id, catalog_status FROM concepts WHERE id = 'kb-minimal-concept'").get();

    expect(oldLoop?.catalog_status).toBe("inactive");
    expect(oldMastery).toMatchObject({ mastery_level: 66, evidence_count: 2 });
    expect(minimal).toMatchObject({ id: "kb-minimal-concept", catalog_status: "active" });
  });

  it("migrates declared previous concept IDs before upserting renamed concepts", async () => {
    const initialKb = createStrictKb({
      concepts: [
        { id: "old-concept", title: "Same Concept", unit_id: "intro", source_path: "concepts/old-concept.md", diagnostic_scope: true },
      ],
    });
    const runtime = await createTestRuntime({ kbRoot: initialKb, kbVersion: "old-catalog" });
    upsertMasteryFixture(runtime, "old-concept", { mastery: 82, confidence: 0.91, readiness: 75, evidenceCount: 4 });
    const renamedKb = createStrictKb({
      concepts: [
        { id: "new-concept", title: "Same Concept", unit_id: "intro", source_path: "concepts/new-concept.md", diagnostic_scope: true, previous_ids: ["old-concept"] },
      ],
    });
    runtime.config.kbRoot = renamedKb;
    runtime.config.kbVersion = "new-catalog";

    expect(() => syncCourseCatalog(runtime)).not.toThrow();

    const renamed = runtime.db.query<{ id: string; catalog_status: string }>("SELECT id, catalog_status FROM concepts WHERE id = 'new-concept'").get();
    const old = runtime.db.query<{ id: string; catalog_status: string; name: string }>("SELECT id, catalog_status, name FROM concepts WHERE id = 'old-concept'").get();
    const mastery = runtime.db.query<{ mastery_level: number; confidence: number; evidence_count: number }>(
      "SELECT mastery_level, confidence, evidence_count FROM concept_mastery WHERE concept_id = 'new-concept'",
    ).get();
    expect(renamed).toMatchObject({ id: "new-concept", catalog_status: "active" });
    expect(old).toMatchObject({ id: "old-concept", catalog_status: "inactive", name: "Same Concept [previous:old-concept]" });
    expect(mastery).toMatchObject({ mastery_level: 82, confidence: 0.91, evidence_count: 4 });

    syncCourseCatalog(runtime);
    const oldAfterRepeat = runtime.db.query<{ name: string }>("SELECT name FROM concepts WHERE id = 'old-concept'").get();
    expect(oldAfterRepeat?.name).toBe("Same Concept [previous:old-concept]");
  });

  it("returns bounded public catalog summaries without private or denied KB content", async () => {
    const runtime = await createTestRuntime();
    const summary = getSafeCatalogSummary(runtime, { conceptIds: ["loop"], limit: 3 });
    const json = JSON.stringify(summary);

    expect(summary.catalog_version).toBe("practical-python-2026-05");
    expect(summary.concepts.map((concept) => concept.id)).toContain("loop");
    expect(json).not.toMatch(/private_solution|solution|evaluator|\.openkb|reports|explorations|AGENTS\.md|log\.md|[A-Za-z]:\\/i);
  });

  it("syncs only manifest-owned mistake tags and preserves omitted tags inactive", async () => {
    const taggedKb = createStrictKb({
      mistakeTags: [
        {
          id: "kb-explicit-syntax",
          name: "Explicit Syntax",
          description: "Declared by the KB manifest.",
          concept_ids: ["intro-python"],
          source_path: "summaries/intro.md",
          order: 1,
        },
      ],
    });
    const runtime = await createTestRuntime({ kbRoot: taggedKb, kbVersion: "runtime-version" });
    const explicitTag = runtime.db.query<{ id: string; catalog_status: string; catalog_version: string; concept_ids_json: string; metadata_json: string }>(
      "SELECT id, catalog_status, catalog_version, concept_ids_json, metadata_json FROM mistake_tags WHERE id = 'kb-explicit-syntax'",
    ).get();

    expect(explicitTag).toMatchObject({
      id: "kb-explicit-syntax",
      catalog_status: "active",
      catalog_version: "strict-fixture",
    });
    expect(JSON.parse(explicitTag?.concept_ids_json ?? "[]")).toEqual(["intro-python"]);
    expect(JSON.parse(explicitTag?.metadata_json ?? "{}")).toMatchObject({ source_type: "mistake_tag" });

    const noTagKb = createStrictKb({});
    writePublicFile(noTagKb, "concepts/intro-python.md", "# Intro Python\n\nSyntaxError appears in public text but is not a declared tag.");
    runtime.config.kbRoot = noTagKb;
    syncCourseCatalog(runtime);

    const activeTags = runtime.db.query<{ id: string }>("SELECT id FROM mistake_tags WHERE catalog_status = 'active'").all();
    const oldTag = runtime.db.query<{ catalog_status: string }>("SELECT catalog_status FROM mistake_tags WHERE id = 'kb-explicit-syntax'").get();
    expect(activeTags).toEqual([]);
    expect(oldTag).toMatchObject({ catalog_status: "inactive" });
  });

  it("exposes diagnostic concepts from the active catalog rather than a fixed seed list", async () => {
    const runtime = await createTestRuntime();
    const active = getActiveCatalogConcepts(runtime);
    const diagnosticConcepts = getCatalogDiagnosticsConcepts(runtime);

    expect(diagnosticConcepts.length).toBeLessThan(active.length);
    expect(diagnosticConcepts.map((concept) => concept.id)).toContain("loop");
    expect(diagnosticConcepts.map((concept) => concept.id)).toContain("pytest");
  });

  it("uses manifest diagnostic eligibility and visible units exactly", async () => {
    const kbRoot = createStrictKb({
      units: [
        { id: "intro", title: "Intro Unit", order: 1, source_path: "summaries/intro.md" },
        { id: "data", title: "Data Unit", order: 2, source_path: "summaries/data.md" },
      ],
      concepts: [
        { id: "intro-python", title: "Intro Python", unit_id: "intro", source_path: "concepts/intro-python.md", diagnostic_scope: true },
        { id: "data-models", title: "Data Models", unit_id: "data", source_path: "concepts/data-models.md", diagnostic_scope: false },
      ],
      relations: [{ from: "data-models", to: "intro-python", type: "follows" }],
    });
    const runtime = await createTestRuntime({ kbRoot, kbVersion: "strict-fixture" });

    expect(getCatalogUnits(runtime).map((unit) => unit.title)).toEqual(["Intro Unit", "Data Unit"]);
    expect(getActiveCatalogConcepts(runtime).map((concept) => concept.id)).toEqual(["intro-python", "data-models"]);
    expect(getCatalogDiagnosticsConcepts(runtime).map((concept) => concept.id)).toEqual(["intro-python"]);
  });

  it("requires a manifest and does not fall back to scanning concept files", async () => {
    const kbRoot = createKbWithoutManifest();
    const runtime = await createTestRuntime({ kbRoot, kbVersion: "missing-manifest", skipCatalogSync: true });

    expect(() => syncCourseCatalog(runtime)).toThrow(/catalog manifest/i);
    expect(getLatestCatalogSyncStatus(runtime)?.status).toBe("failed");
    expect(getActiveCatalogConcepts(runtime)).toHaveLength(0);
  });

  it("requires manifest catalog version", async () => {
    const kbRoot = createStrictKb({});
    const manifestPath = join(kbRoot, "course.catalog.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
    delete manifest.catalog_version;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    const runtime = await createTestRuntime({ kbRoot, kbVersion: "runtime-only", skipCatalogSync: true });

    expect(() => syncCourseCatalog(runtime)).toThrow(/catalog_version/i);
    expect(getActiveCatalogConcepts(runtime)).toHaveLength(0);
  });

  it("rejects concepts without valid unit membership instead of creating a fallback unit", async () => {
    const kbRoot = createStrictKb({
      units: [{ id: "intro", title: "Intro Unit", order: 1, source_path: "summaries/intro.md" }],
      concepts: [
        { id: "orphan", title: "Orphan Concept", unit_id: "missing", source_path: "concepts/orphan.md", diagnostic_scope: true },
      ],
    });
    const runtime = await createTestRuntime({ kbRoot, kbVersion: "missing-unit", skipCatalogSync: true });

    expect(() => syncCourseCatalog(runtime)).toThrow(/unknown unit/i);
    expect(getCatalogUnits(runtime).map((unit) => unit.title)).not.toContain("KB 概念");
    expect(getActiveCatalogConcepts(runtime)).toHaveLength(0);
  });

  it("rejects mistake tags with unknown concept references", async () => {
    const kbRoot = createStrictKb({
      mistakeTags: [
        {
          id: "kb-bad-tag",
          name: "Bad Tag",
          description: "Invalid tag.",
          concept_ids: ["missing-concept"],
          source_path: "summaries/intro.md",
          order: 1,
        },
      ],
    });
    const runtime = await createTestRuntime({ kbRoot, kbVersion: "bad-tag", skipCatalogSync: true });

    expect(() => syncCourseCatalog(runtime)).toThrow(/unknown concept/i);
    expect(runtime.db.query<{ count: number }>("SELECT COUNT(*) AS count FROM mistake_tags WHERE catalog_status = 'active'").get()?.count).toBe(0);
  });

  it("rejects private or denied manifest source paths", async () => {
    const kbRoot = createStrictKb({
      units: [{ id: "intro", title: "Intro Unit", order: 1, source_path: "summaries/intro.md" }],
      concepts: [
        { id: "private-concept", title: "Private Concept", unit_id: "intro", source_path: "private\\solutions\\hidden.md", diagnostic_scope: true },
      ],
    });
    const runtime = await createTestRuntime({ kbRoot, kbVersion: "private-path", skipCatalogSync: true });

    expect(() => syncCourseCatalog(runtime)).toThrow(/denied catalog path/i);
    expect(getActiveCatalogConcepts(runtime)).toHaveLength(0);
  });

  it("requires omitted public concept and exercise files to be classified in manifest inventory", async () => {
    const kbRoot = createStrictKb({});
    writePublicFile(kbRoot, "concepts/unclassified-public-concept.md", "# Unclassified Concept\n");
    writePublicFile(kbRoot, "exercises/unclassified-public-exercise.md", "# Unclassified Exercise\n");
    const runtime = await createTestRuntime({ kbRoot, kbVersion: "unclassified-inventory", skipCatalogSync: true });

    expect(() => syncCourseCatalog(runtime)).toThrow(/unclassified public concept/i);
    expect(getLatestCatalogSyncStatus(runtime)?.status).toBe("failed");
    expect(getActiveCatalogConcepts(runtime)).toHaveLength(0);
  });

  it("keeps explicitly classified non-active inventory out of active runtime rows", async () => {
    const kbRoot = createStrictKb({
      manifestExtras: {
        inventory: {
          concepts: [
            { source_path: "concepts/support-note.md", status: "support", reason: "Reference note, not a teachable active concept yet." },
          ],
          exercises: [
            { source_path: "exercises/deferred-exercise.md", status: "deferred", reason: "Needs reviewed public prompt metadata before activation." },
          ],
        },
      },
    });
    writePublicFile(kbRoot, "concepts/support-note.md", "# Support Note\n");
    writePublicFile(kbRoot, "exercises/deferred-exercise.md", "# Deferred Exercise\n");
    const runtime = await createTestRuntime({ kbRoot, kbVersion: "classified-inventory" });

    expect(getActiveCatalogConcepts(runtime).map((concept) => concept.source_path)).not.toContain("concepts/support-note.md");
    const deferredExercise = runtime.db.query<{ id: string }>("SELECT id FROM exercises WHERE source_path = 'exercises/deferred-exercise.md'").get();
    expect(deferredExercise).toBeUndefined();
  });

  it("requires non-active inventory entries to include source path, accepted status, and reason", async () => {
    const kbRoot = createStrictKb({
      manifestExtras: {
        inventory: {
          concepts: [
            { source_path: "concepts/support-note.md", status: "support" },
          ],
        },
      },
    });
    writePublicFile(kbRoot, "concepts/support-note.md", "# Support Note\n");
    const runtime = await createTestRuntime({ kbRoot, kbVersion: "bad-inventory", skipCatalogSync: true });

    expect(() => syncCourseCatalog(runtime)).toThrow(/inventory.*reason/i);
  });

  it("requires public Course Setup content to be explicitly handled", async () => {
    const kbRoot = createStrictKb({});
    writePublicFile(kbRoot, "summaries/00_Setup.md", "# Course Setup\n");
    const runtime = await createTestRuntime({ kbRoot, kbVersion: "course-setup", skipCatalogSync: true });

    expect(() => syncCourseCatalog(runtime)).toThrow(/course setup/i);

    const manifestPath = join(kbRoot, "course.catalog.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
    manifest.course_setup = {
      title: "课程准备",
      status: "support",
      source_paths: ["summaries/00_Setup.md"],
      reason: "Environment setup is support material, not a progress concept.",
    };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    expect(() => syncCourseCatalog(runtime)).not.toThrow();
  });

  it("rejects active unit and concept ID overlap without catalog migration metadata", async () => {
    const kbRoot = createStrictKb({
      units: [{ id: "intro-python", title: "Intro Unit", order: 1, source_path: "summaries/intro.md" }],
      concepts: [
        { id: "intro-python", title: "Intro Python", unit_id: "intro-python", source_path: "concepts/intro-python.md", diagnostic_scope: true },
      ],
    });
    const runtime = await createTestRuntime({ kbRoot, kbVersion: "overlap", skipCatalogSync: true });

    expect(() => syncCourseCatalog(runtime)).toThrow(/unit.*concept.*overlap/i);
  });

  it("requires diagnostic concepts to declare a practice follow-up route", async () => {
    const kbRoot = createStrictKb({
      concepts: [
        { id: "intro-python", title: "Intro Python", unit_id: "intro", source_path: "concepts/intro-python.md", diagnostic_scope: true, metadata: { root_concept: true } },
      ],
    });
    const runtime = await createTestRuntime({ kbRoot, kbVersion: "missing-practice-route", skipCatalogSync: true });

    expect(() => syncCourseCatalog(runtime)).toThrow(/diagnostic concept intro-python.*follow-up/i);
  });

  it("requires exercises for non-diagnostic concepts to declare selection context", async () => {
    const kbRoot = createStrictKb({
      concepts: [
        { id: "intro-python", title: "Intro Python", unit_id: "intro", source_path: "concepts/intro-python.md", diagnostic_scope: true },
        { id: "advanced-topic", title: "Advanced Topic", unit_id: "intro", source_path: "concepts/advanced-topic.md", diagnostic_scope: false },
      ],
      exercises: [
        { id: "advanced-only", title: "Advanced Only", source_path: "exercises/advanced-only.md", concept_ids: ["advanced-topic"] },
      ],
      relations: [{ from: "advanced-topic", to: "intro-python", type: "follows" }],
    });
    const runtime = await createTestRuntime({ kbRoot, kbVersion: "missing-selection-context", skipCatalogSync: true });

    expect(() => syncCourseCatalog(runtime)).toThrow(/non-diagnostic.*selection context/i);
  });

  it("requires active non-root concepts to have explicit catalog relation structure", async () => {
    const kbRoot = createStrictKb({
      concepts: [
        { id: "intro-python", title: "Intro Python", unit_id: "intro", source_path: "concepts/intro-python.md", diagnostic_scope: true },
        { id: "next-topic", title: "Next Topic", unit_id: "intro", source_path: "concepts/next-topic.md", diagnostic_scope: false },
      ],
    });
    const runtime = await createTestRuntime({ kbRoot, kbVersion: "missing-relation", skipCatalogSync: true });

    expect(() => syncCourseCatalog(runtime)).toThrow(/non-root concept next-topic.*relation/i);
  });

  it("preserves safe relation metadata for diagnostic and recommendation workflows", async () => {
    const kbRoot = createStrictKb({
      concepts: [
        { id: "intro-python", title: "Intro Python", unit_id: "intro", source_path: "concepts/intro-python.md", diagnostic_scope: true },
        { id: "next-topic", title: "Next Topic", unit_id: "intro", source_path: "concepts/next-topic.md", diagnostic_scope: false },
      ],
      relations: [
        { from: "next-topic", to: "intro-python", type: "follows", metadata: { rationale: "Learner needs the intro before this topic.", private_solution_note: "must be removed" } },
      ],
    });
    const runtime = await createTestRuntime({ kbRoot, kbVersion: "relation-metadata" });
    const relation = runtime.db.query<{ metadata_json: string }>(
      "SELECT metadata_json FROM concept_relations WHERE source_concept_id = 'next-topic' AND target_concept_id = 'intro-python'",
    ).get();

    expect(JSON.parse(relation?.metadata_json ?? "{}")).toMatchObject({ rationale: "Learner needs the intro before this topic." });
    expect(relation?.metadata_json).not.toMatch(/private_solution_note/);
  });

  it("syncs expanded catalog relation types used by remediation and progression metadata", async () => {
    const kbRoot = createStrictKb({
      concepts: [
        { id: "intro-python", title: "Intro Python", unit_id: "intro", source_path: "concepts/intro-python.md", diagnostic_scope: true },
        { id: "next-topic", title: "Next Topic", unit_id: "intro", source_path: "concepts/next-topic.md", diagnostic_scope: false },
      ],
      relations: [
        { from: "next-topic", to: "intro-python", type: "progression", metadata: { rationale: "Progression relation for recommendations." } },
      ],
    });
    const runtime = await createTestRuntime({ kbRoot, kbVersion: "expanded-relations" });
    const relation = runtime.db.query<{ relation_type: string; metadata_json: string }>(
      "SELECT relation_type, metadata_json FROM concept_relations WHERE source_concept_id = 'next-topic' AND target_concept_id = 'intro-python'",
    ).get();

    expect(relation).toMatchObject({ relation_type: "progression" });
    expect(JSON.parse(relation?.metadata_json ?? "{}")).toMatchObject({ rationale: "Progression relation for recommendations." });
  });

  it("requires mistake taxonomy entries to include structured teaching metadata", async () => {
    const kbRoot = createStrictKb({
      mistakeTags: [
        {
          id: "kb-bad-tag",
          name: "Bad Tag",
          description: "Missing teaching metadata.",
          concept_ids: ["intro-python"],
          source_path: "summaries/intro.md",
          order: 1,
          metadata: {},
        },
      ],
    });
    const runtime = await createTestRuntime({ kbRoot, kbVersion: "bad-taxonomy", skipCatalogSync: true });

    expect(() => syncCourseCatalog(runtime)).toThrow(/mistake tag kb-bad-tag.*teaching metadata/i);
  });
});

type StrictKbInput = {
  units?: Array<{ id: string; title: string; order: number; source_path: string; metadata?: Record<string, unknown> }>;
  concepts?: Array<{ id: string; title: string; unit_id: string; source_path: string; diagnostic_scope: boolean; aliases?: string[]; previous_ids?: string[]; metadata?: Record<string, unknown> }>;
  exercises?: Array<{ id: string; title: string; source_path: string; concept_ids: string[]; difficulty?: number; skip?: boolean; metadata?: Record<string, unknown> }>;
  mistakeTags?: Array<{ id: string; name: string; description: string; concept_ids: string[]; source_path: string; order: number; metadata?: Record<string, unknown> }>;
  relations?: Array<{ from: string; to: string; type: string; weight?: number; metadata?: Record<string, unknown> }>;
  manifestExtras?: Record<string, unknown>;
  createFiles?: boolean;
};

function createKbWithoutManifest(): string {
  const root = createTempDir();
  mkdirSync(join(root, "concepts"), { recursive: true });
  writeFileSync(join(root, "index.md"), [
    "# Minimal KB",
    "",
    "## Concepts",
    "",
    "- [[concepts/no-manifest]] — This file must not be imported without a manifest.",
  ].join("\n"));
  writeFileSync(join(root, "concepts", "no-manifest.md"), "# No Manifest\n");
  return root;
}

function createStrictKb(input: StrictKbInput): string {
  const root = createTempDir();
  const units = input.units ?? [{ id: "intro", title: "Intro Unit", order: 1, source_path: "summaries/intro.md" }];
  const concepts = (input.concepts ?? [{ id: "intro-python", title: "Intro Python", unit_id: "intro", source_path: "concepts/intro-python.md", diagnostic_scope: true }])
    .map((concept, index) => ({
      order: index + 1,
      metadata: concept.metadata ?? {
        ...(index === 0 ? { root_concept: true } : {}),
        ...(concept.diagnostic_scope ? { generated_practice: { enabled: true, policy: "Generate safe practice from public concept metadata." } } : {}),
      },
      ...concept,
    }));
  const exercises = (input.exercises ?? []).map((exercise, index) => ({ order: index + 1, ...exercise }));
  const mistakeTags = (input.mistakeTags ?? []).map((tag) => ({
    metadata: {
      teaching_intent: "Identify and remediate this public KB mistake pattern.",
      evidence_type: "diagnostic_response",
      severity: "medium",
      symptoms: ["Observed learner answer matches this mistake pattern."],
      remediation_concept_ids: tag.concept_ids,
    },
    ...tag,
  }));
  mkdirSync(join(root, "concepts"), { recursive: true });
  mkdirSync(join(root, "summaries"), { recursive: true });
  mkdirSync(join(root, "exercises"), { recursive: true });
  writeFileSync(join(root, "course.catalog.json"), JSON.stringify({
    schema_version: "course_catalog.v1",
    catalog_version: "strict-fixture",
    units,
    concepts,
    exercises,
    mistake_tags: mistakeTags,
    relations: input.relations ?? [],
    ...(input.manifestExtras ?? {}),
  }, null, 2));
  if (input.createFiles !== false) {
    for (const unit of units) {
      writePublicFile(root, unit.source_path, `# ${unit.title}\n`);
    }
    for (const concept of concepts) {
      writePublicFile(root, concept.source_path, `# ${concept.title}\n\nPublic concept content.`);
    }
    for (const exercise of exercises) {
      writePublicFile(root, exercise.source_path, `# ${exercise.title}\n\nPublic exercise prompt.`);
    }
  }
  return root;
}

function writePublicFile(root: string, relativePath: string, content: string): void {
  const path = join(root, ...relativePath.split("/"));
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content);
}
