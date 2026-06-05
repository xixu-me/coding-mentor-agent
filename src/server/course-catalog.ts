import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, relative, resolve, sep } from "node:path";
import { AppError, type AppRuntime } from "../types.js";
import { nowIso } from "../security/ids.js";
import { sanitizeExternalContent, summarizeText } from "../security/redaction.js";

export type CatalogConcept = {
  id: string;
  name: string;
  unit: string | null;
  unit_id: string | null;
  aliases: string[];
  kb_path: string | null;
  catalog_status: "active" | "inactive";
  source_path: string | null;
  source_hash: string | null;
  catalog_version: string | null;
  order_index: number;
  diagnostic_eligible: boolean;
  metadata: Record<string, unknown>;
};

export type CatalogUnit = {
  id: string;
  title: string;
  order_index: number;
  catalog_status: "active" | "inactive";
};

export type SafeCatalogSummary = {
  catalog_version: string;
  concepts: Array<{ id: string; name: string; unit?: string; source_id?: string; brief?: string }>;
  units: Array<{ id: string; title: string; concept_ids: string[] }>;
};

export type CatalogProgressPolicyInput = {
  concept_id: string;
  role: string;
  unit_id: string | null;
  progress_weight: number;
  prerequisite_weight: number;
  prerequisite_blocker: boolean;
  prerequisite_ids: string[];
  downstream_concept_ids: string[];
  remediation_concept_ids: string[];
};

type ParsedCatalog = {
  catalogVersion: string;
  sourceHash: string;
  concepts: ParsedConcept[];
  units: ParsedUnit[];
  exercises: ParsedExercise[];
  mistakeTags: ParsedMistakeTag[];
  relations: ParsedRelation[];
};

export type CatalogSyncStatus = {
  id: string;
  kb_version: string;
  source_hash: string;
  status: "success" | "failed";
  error_summary: string | null;
};

type ParsedConcept = {
  id: string;
  name: string;
  unit: string;
  unitId: string;
  aliases: string[];
  previousIds: string[];
  relativePath: string;
  sourceHash: string;
  orderIndex: number;
  diagnosticEligible: boolean;
  metadata: Record<string, unknown>;
  body: string;
};

type ParsedUnit = {
  id: string;
  title: string;
  orderIndex: number;
  sourcePath?: string;
  sourceHash?: string;
  metadata: Record<string, unknown>;
};

type ParsedExercise = {
  id: string;
  title: string;
  difficulty: number;
  conceptIds: string[];
  promptMd: string;
  status: string;
  relativePath: string;
  sourceHash: string;
  orderIndex: number;
  privateSolution: boolean;
  skip: boolean;
  metadata: Record<string, unknown>;
};

type ParsedRelation = {
  sourceId: string;
  targetId: string;
  relationType: CatalogRelationType;
  weight: number;
  sourcePath?: string;
  sourceHash?: string;
  metadata: Record<string, unknown>;
};

type CatalogRelationType = "prerequisite" | "related" | "reinforces" | "follows" | "progression" | "remediation";

type ParsedMistakeTag = {
  id: string;
  name: string;
  description: string;
  conceptIds: string[];
  sourcePath: string;
  sourceHash: string;
  orderIndex: number;
  metadata: Record<string, unknown>;
};

type StrictCatalogManifest = {
  schema_version?: unknown;
  catalog_version?: unknown;
  units?: unknown;
  concepts?: unknown;
  exercises?: unknown;
  mistake_tags?: unknown;
  relations?: unknown;
  inventory?: unknown;
  course_setup?: unknown;
};

type StrictCatalogUnit = {
  id: string;
  title: string;
  order: number;
  source_path: string;
  metadata?: Record<string, unknown>;
};

type StrictCatalogConcept = {
  id: string;
  title: string;
  unit_id: string;
  source_path: string;
  order: number;
  diagnostic_scope: boolean;
  aliases?: string[];
  previous_ids?: string[];
  metadata?: Record<string, unknown>;
};

type StrictCatalogExercise = {
  id: string;
  title: string;
  source_path: string;
  concept_ids: string[];
  order: number;
  difficulty?: number;
  skip?: boolean;
  private_solution?: boolean;
  has_private_solution?: boolean;
  metadata?: Record<string, unknown>;
};

type StrictCatalogRelation = {
  from: string;
  to: string;
  type: string;
  weight?: number;
  source_path?: string;
  metadata?: Record<string, unknown>;
};

type StrictCatalogMistakeTag = {
  id: string;
  name: string;
  description: string;
  concept_ids: string[];
  source_path: string;
  order: number;
  metadata?: Record<string, unknown>;
};

type StrictInventoryEntry = {
  source_path?: unknown;
  status?: unknown;
  reason?: unknown;
};

type StrictCourseSetup = {
  title?: unknown;
  status?: unknown;
  source_paths?: unknown;
  reason?: unknown;
  metadata?: Record<string, unknown>;
};

const NON_ACTIVE_INVENTORY_STATUSES = new Set(["deferred", "support", "excluded"]);
const COURSE_SETUP_STATUSES = new Set(["onboarding", ...NON_ACTIVE_INVENTORY_STATUSES]);
const CATALOG_RELATION_TYPES = new Set<CatalogRelationType>(["prerequisite", "related", "reinforces", "follows", "progression", "remediation"]);
const DANGEROUS_METADATA_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function syncCourseCatalog(runtime: AppRuntime): { runId: string; conceptCount: number; unitCount: number; exerciseCount: number; relationCount: number } {
  const now = nowIso();
  try {
    const parsed = parseCourseCatalog(runtime.config.kbRoot);
    const runId = catalogRunId(parsed.catalogVersion, parsed.sourceHash);
    runtime.db.transaction(() => {
      upsertUnits(runtime, parsed.units, parsed.catalogVersion, now);
      upsertConcepts(runtime, parsed.concepts, parsed.catalogVersion, now);
      upsertExercises(runtime, parsed.exercises, parsed.catalogVersion, now);
      upsertMistakeTags(runtime, parsed.mistakeTags, parsed.catalogVersion, now);
      syncRelations(runtime, parsed.relations, parsed.catalogVersion, now);
      markMissingInactive(runtime, "course_units", parsed.units.map((unit) => unit.id));
      markMissingInactive(runtime, "concepts", parsed.concepts.map((concept) => concept.id), "source_type = 'kb_concept'");
      markMissingInactive(runtime, "exercises", parsed.exercises.map((exercise) => exercise.id), "status = 'kb_catalog'");
      markMissingInactive(runtime, "mistake_tags", parsed.mistakeTags.map((tag) => tag.id));
      runtime.db.query(
        "INSERT OR REPLACE INTO course_catalog_runs(id, kb_root, kb_version, source_hash, status, concept_count, unit_count, exercise_count, relation_count, error_summary, created_at) VALUES (?, ?, ?, ?, 'success', ?, ?, ?, ?, NULL, ?)",
      ).run([
        runId,
        runtime.config.kbRoot,
        parsed.catalogVersion,
        parsed.sourceHash,
        parsed.concepts.length,
        parsed.units.length,
        parsed.exercises.length,
        parsed.relations.length,
        now,
      ]);
    });
    return { runId, conceptCount: parsed.concepts.length, unitCount: parsed.units.length, exerciseCount: parsed.exercises.length, relationCount: parsed.relations.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const runId = catalogRunId(runtime.config.kbVersion, message);
    runtime.db.query(
      "INSERT OR REPLACE INTO course_catalog_runs(id, kb_root, kb_version, source_hash, status, error_summary, created_at) VALUES (?, ?, ?, ?, 'failed', ?, ?)",
    ).run([runId, runtime.config.kbRoot, runtime.config.kbVersion, hashText(message), summarizeText(message, 500), now]);
    throw error;
  }
}

export function getLatestCatalogRun(runtime: AppRuntime): { id: string; kb_version: string; source_hash: string } | undefined {
  return runtime.db.query<{ id: string; kb_version: string; source_hash: string }>(
    "SELECT id, kb_version, source_hash FROM course_catalog_runs WHERE status = 'success' ORDER BY created_at DESC LIMIT 1",
  ).get();
}

export function getLatestCatalogSyncStatus(runtime: AppRuntime): CatalogSyncStatus | undefined {
  return runtime.db.query<CatalogSyncStatus>(
    "SELECT id, kb_version, source_hash, status, error_summary FROM course_catalog_runs ORDER BY created_at DESC, id DESC LIMIT 1",
  ).get();
}

export function assertCatalogAvailable(runtime: AppRuntime): void {
  const latest = getLatestCatalogSyncStatus(runtime);
  if (latest?.status === "success") return;
  const detail = latest?.error_summary ? `：${latest.error_summary}` : "";
  throw new AppError("CATALOG_UNAVAILABLE", `课程目录不可用${detail}`, 503, true);
}

export function getActiveCatalogConcepts(runtime: AppRuntime): CatalogConcept[] {
  return runtime.db.query<ConceptRow>(
    `SELECT id, name, unit, unit_id, aliases_json, kb_path, catalog_status, source_path, source_hash, catalog_version, order_index, diagnostic_eligible, metadata_json
     FROM concepts
     WHERE catalog_status = 'active'
     ORDER BY order_index ASC, name COLLATE NOCASE ASC, id ASC`,
  ).all().map(toCatalogConcept);
}

export function getCatalogDiagnosticsConcepts(runtime: AppRuntime): CatalogConcept[] {
  return runtime.db.query<ConceptRow>(
    `SELECT id, name, unit, unit_id, aliases_json, kb_path, catalog_status, source_path, source_hash, catalog_version, order_index, diagnostic_eligible, metadata_json
     FROM concepts
     WHERE catalog_status = 'active' AND diagnostic_eligible = 1
     ORDER BY order_index ASC, name COLLATE NOCASE ASC, id ASC`,
  ).all().map(toCatalogConcept);
}

export function getCatalogConceptById(runtime: AppRuntime, conceptId: string, options: { includeInactive?: boolean } = {}): CatalogConcept | undefined {
  const row = runtime.db.query<ConceptRow>(
    `SELECT id, name, unit, unit_id, aliases_json, kb_path, catalog_status, source_path, source_hash, catalog_version, order_index, diagnostic_eligible, metadata_json
     FROM concepts
     WHERE id = ? ${options.includeInactive ? "" : "AND catalog_status = 'active'"}`,
  ).get([conceptId]);
  return row ? toCatalogConcept(row) : undefined;
}

export function getCatalogUnits(runtime: AppRuntime): CatalogUnit[] {
  return runtime.db.query<CatalogUnit>(
    "SELECT id, title, order_index, catalog_status FROM course_units WHERE catalog_status = 'active' ORDER BY order_index ASC, title ASC",
  ).all();
}

export function getSafeCatalogSummary(runtime: AppRuntime, options: { conceptIds?: string[]; limit?: number } = {}): SafeCatalogSummary {
  const limit = Math.max(1, Math.min(20, options.limit ?? 8));
  const requested = new Set(options.conceptIds ?? []);
  const concepts = getActiveCatalogConcepts(runtime)
    .filter((concept) => requested.size === 0 || requested.has(concept.id))
    .slice(0, limit)
    .map((concept) => ({
      id: concept.id,
      name: concept.name,
      unit: concept.unit ?? undefined,
      source_id: concept.source_path ?? undefined,
      brief: typeof concept.metadata.brief === "string" ? sanitizeExternalContent(concept.metadata.brief, 180) : undefined,
    }));
  const conceptIdsByUnit = new Map<string, string[]>();
  for (const concept of getActiveCatalogConcepts(runtime)) {
    if (!concept.unit_id) continue;
    const list = conceptIdsByUnit.get(concept.unit_id) ?? [];
    if (list.length < 20) list.push(concept.id);
    conceptIdsByUnit.set(concept.unit_id, list);
  }
  return {
    catalog_version: getLatestCatalogRun(runtime)?.kb_version ?? runtime.config.kbVersion,
    concepts,
    units: getCatalogUnits(runtime).slice(0, limit).map((unit) => ({
      id: unit.id,
      title: unit.title,
      concept_ids: conceptIdsByUnit.get(unit.id) ?? [],
    })),
  };
}

export function getCatalogConceptOrderMap(runtime: AppRuntime): Map<string, number> {
  return new Map(getActiveCatalogConcepts(runtime).map((concept) => [concept.id, concept.order_index]));
}

export function getCatalogProgressPolicyInputs(runtime: AppRuntime): CatalogProgressPolicyInput[] {
  const concepts = getActiveCatalogConcepts(runtime);
  const activeIds = new Set(concepts.map((concept) => concept.id));
  const relations = runtime.db.query<{
    source_concept_id: string;
    target_concept_id: string;
    relation_type: CatalogRelationType;
    weight: number;
    metadata_json: string;
  }>(
    `SELECT source_concept_id, target_concept_id, relation_type, weight, metadata_json
     FROM concept_relations
     WHERE source_type = 'kb_catalog'`,
  ).all().filter((relation) => activeIds.has(relation.source_concept_id) && activeIds.has(relation.target_concept_id));
  return concepts.map((concept) => {
    const incoming = relations.filter((relation) => relation.target_concept_id === concept.id);
    const outgoing = relations.filter((relation) => relation.source_concept_id === concept.id);
    const metadata = concept.metadata;
    const role = typeof metadata.role === "string"
      ? metadata.role
      : metadata.root_concept === true
        ? "root"
        : concept.diagnostic_eligible
          ? "core"
          : "support";
    const declaredWeight = numberFromMetadata(metadata.progress_weight) ?? numberFromMetadata(metadata.weight) ?? undefined;
    const prerequisiteWeight = Math.max(
      role === "root" ? 4 : role === "core" ? 2 : 1,
      declaredWeight ?? 0,
      ...incoming
        .filter((relation) => ["prerequisite", "progression", "follows", "reinforces"].includes(relation.relation_type))
        .map((relation) => relation.weight + relationMetadataWeight(relation.metadata_json)),
    );
    const prerequisiteIds = outgoing
      .filter((relation) => ["prerequisite", "follows", "progression"].includes(relation.relation_type))
      .map((relation) => relation.target_concept_id);
    const downstreamConceptIds = incoming
      .filter((relation) => ["prerequisite", "follows", "progression", "reinforces"].includes(relation.relation_type))
      .map((relation) => relation.source_concept_id);
    const remediationConceptIds = [
      ...outgoing.filter((relation) => relation.relation_type === "remediation").map((relation) => relation.target_concept_id),
      ...stringArrayFromMetadata(metadata, "remediation_concept_ids"),
    ].filter((conceptId) => activeIds.has(conceptId));
    return {
      concept_id: concept.id,
      role,
      unit_id: concept.unit_id,
      progress_weight: Math.max(0.25, declaredWeight ?? (role === "root" ? 1.4 : role === "core" ? 1.1 : 0.8)),
      prerequisite_weight: round2(prerequisiteWeight),
      prerequisite_blocker: role === "root" || prerequisiteWeight >= 2 || downstreamConceptIds.length > 0,
      prerequisite_ids: [...new Set(prerequisiteIds)],
      downstream_concept_ids: [...new Set(downstreamConceptIds)],
      remediation_concept_ids: [...new Set(remediationConceptIds)],
    };
  });
}

export function getCatalogProgressPolicyInputMap(runtime: AppRuntime): Map<string, CatalogProgressPolicyInput> {
  return new Map(getCatalogProgressPolicyInputs(runtime).map((input) => [input.concept_id, input]));
}

function relationMetadataWeight(metadataJson: string): number {
  const metadata = parseObject(metadataJson);
  return numberFromMetadata(metadata.weight) ?? numberFromMetadata(metadata.priority) ?? 0;
}

function numberFromMetadata(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseCourseCatalog(kbRoot: string): ParsedCatalog {
  const manifestSource = readStrictCatalogManifest(kbRoot);
  const manifest = parseManifestJson(manifestSource.raw, manifestSource.path);
  const catalogVersion = requiredString(manifest.catalog_version, "catalog_version");
  const units = parseManifestUnits(kbRoot, manifest);
  const concepts = parseManifestConcepts(kbRoot, manifest, units);
  const exercises = parseManifestExercises(kbRoot, manifest, concepts);
  const mistakeTags = parseManifestMistakeTags(kbRoot, manifest, concepts);
  const relations = parseManifestRelations(kbRoot, manifest, concepts);
  validateManifestStrategy(kbRoot, manifest, units, concepts, exercises, mistakeTags, relations);
  const sourceHash = hashText(JSON.stringify({
    manifest: manifestSource.hash,
    units: units.map((unit) => [unit.id, unit.sourceHash]),
    concepts: concepts.map((concept) => [concept.id, concept.sourceHash]),
    exercises: exercises.map((exercise) => [exercise.id, exercise.sourceHash]),
    mistakeTags: mistakeTags.map((tag) => [tag.id, tag.sourceHash, tag.conceptIds]),
    relations: relations.map((relation) => [relation.sourceId, relation.targetId, relation.relationType, relation.metadata]),
  }));
  return { catalogVersion, sourceHash, concepts, units, exercises, mistakeTags, relations };
}

function readStrictCatalogManifest(kbRoot: string): { path: string; raw: string; hash: string } {
  const candidates = [
    join(kbRoot, ".openkb", "catalog.json"),
    join(kbRoot, "course.catalog.json"),
  ];
  for (const path of candidates) {
    const raw = readOptional(path);
    if (raw !== undefined) return { path, raw, hash: hashText(raw) };
  }
  throw new Error("Catalog manifest not found in configured KB root");
}

function parseManifestJson(raw: string, path: string): StrictCatalogManifest {
  try {
    const parsed = JSON.parse(raw) as StrictCatalogManifest;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("manifest must be a JSON object");
    }
    return parsed;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid catalog manifest ${path}: ${detail}`);
  }
}

function parseManifestUnits(kbRoot: string, manifest: StrictCatalogManifest): ParsedUnit[] {
  const units = manifestArray<StrictCatalogUnit>(manifest.units, "units");
  if (units.length === 0) throw new Error("Catalog manifest must define at least one unit");
  const seen = new Set<string>();
  return units.map((unit, index) => {
    const id = requiredString(unit.id, `units[${index}].id`);
    const title = requiredString(unit.title, `units[${index}].title`);
    const order = requiredInteger(unit.order, `units[${index}].order`);
    const sourcePath = requiredString(unit.source_path, `units[${index}].source_path`);
    const raw = readPublicCatalogFile(kbRoot, sourcePath);
    assertUnique(seen, id, "unit");
    return {
      id,
      title,
      orderIndex: order,
      sourcePath,
      sourceHash: hashText(raw),
      metadata: safeMetadata({ ...(plainRecord(unit.metadata) ?? {}), source_type: "unit" }),
    };
  }).sort((left, right) => left.orderIndex - right.orderIndex || left.title.localeCompare(right.title, "zh-CN"));
}

function parseManifestConcepts(kbRoot: string, manifest: StrictCatalogManifest, units: ParsedUnit[]): ParsedConcept[] {
  const concepts = manifestArray<StrictCatalogConcept>(manifest.concepts, "concepts");
  if (concepts.length === 0) throw new Error("Catalog manifest must define at least one concept");
  const unitIds = new Set(units.map((unit) => unit.id));
  const seen = new Set<string>();
  return concepts.map((concept, index) => {
    const id = requiredString(concept.id, `concepts[${index}].id`);
    const name = requiredString(concept.title, `concepts[${index}].title`);
    const unitId = requiredString(concept.unit_id, `concepts[${index}].unit_id`);
    if (!unitIds.has(unitId)) throw new Error(`Catalog concept ${id} references unknown unit ${unitId}`);
    const unit = units.find((item) => item.id === unitId)!;
    const orderIndex = requiredInteger(concept.order, `concepts[${index}].order`);
    const relativePath = requiredString(concept.source_path, `concepts[${index}].source_path`);
    const raw = readPublicCatalogFile(kbRoot, relativePath);
    const { body, metadata } = parseFrontmatter(raw);
    const diagnosticEligible = requiredBoolean(concept.diagnostic_scope, `concepts[${index}].diagnostic_scope`);
    assertUnique(seen, id, "concept");
    return {
      id,
      name,
      unit: unit.title,
      unitId,
      aliases: uniqueStrings([...(arrayValue(concept.aliases)), basename(relativePath, ".md"), name].filter((item) => item !== id && item !== name)),
      previousIds: uniqueStrings(arrayValue(concept.previous_ids)),
      relativePath,
      sourceHash: hashText(raw),
      orderIndex,
      diagnosticEligible,
      metadata: safeMetadata({
        ...(plainRecord(concept.metadata) ?? {}),
        brief: stringValue(metadata.brief),
        source_type: "concept",
      }),
      body,
    };
  }).sort((left, right) => left.orderIndex - right.orderIndex || left.name.localeCompare(right.name, "zh-CN"));
}

function parseManifestExercises(kbRoot: string, manifest: StrictCatalogManifest, concepts: ParsedConcept[]): ParsedExercise[] {
  const exercises = manifestArray<StrictCatalogExercise>(manifest.exercises ?? [], "exercises");
  const activeConceptIds = new Set(concepts.map((concept) => concept.id));
  const seen = new Set<string>();
  return exercises.map((exercise, index) => {
    const id = requiredString(exercise.id, `exercises[${index}].id`);
    const title = requiredString(exercise.title, `exercises[${index}].title`);
    const relativePath = requiredString(exercise.source_path, `exercises[${index}].source_path`);
    const conceptIds = uniqueStrings(arrayValue(exercise.concept_ids));
    if (conceptIds.length === 0) throw new Error(`Catalog exercise ${id} must reference at least one concept`);
    const unknownConcept = conceptIds.find((conceptId) => !activeConceptIds.has(conceptId));
    if (unknownConcept) throw new Error(`Catalog exercise ${id} references unknown concept ${unknownConcept}`);
    const raw = readPublicCatalogFile(kbRoot, relativePath);
    const { body } = parseFrontmatter(raw);
    const orderIndex = requiredInteger(exercise.order, `exercises[${index}].order`);
    const difficulty = typeof exercise.difficulty === "number" ? Math.max(1, Math.min(5, Math.round(exercise.difficulty))) : 2;
    assertUnique(seen, id, "exercise");
    return {
      id,
      title,
      difficulty,
      conceptIds,
      promptMd: sanitizeExternalContent(body, 4000),
      status: "kb_catalog",
      relativePath,
      sourceHash: hashText(raw),
      orderIndex,
      privateSolution: booleanValue(exercise.has_private_solution, booleanValue(exercise.private_solution, false)),
      skip: booleanValue(exercise.skip, false),
      metadata: safeMetadata({ ...(plainRecord(exercise.metadata) ?? {}), source_type: "exercise" }),
    };
  }).sort((left, right) => left.orderIndex - right.orderIndex || left.title.localeCompare(right.title, "zh-CN"));
}

function parseManifestRelations(kbRoot: string, manifest: StrictCatalogManifest, concepts: ParsedConcept[]): ParsedRelation[] {
  const conceptIds = new Set(concepts.map((concept) => concept.id));
  const relations: ParsedRelation[] = [];
  for (const [index, relation] of manifestArray<StrictCatalogRelation>(manifest.relations ?? [], "relations").entries()) {
    const sourceId = requiredString(relation.from, `relations[${index}].from`);
    const targetId = requiredString(relation.to, `relations[${index}].to`);
    const relationType = requiredRelationType(relation.type, `relations[${index}].type`);
    if (!conceptIds.has(sourceId)) throw new Error(`Catalog relation references unknown source concept ${sourceId}`);
    if (!conceptIds.has(targetId)) throw new Error(`Catalog relation references unknown target concept ${targetId}`);
    const sourcePath = stringValue(relation.source_path);
    const sourceHash = sourcePath ? hashText(readPublicCatalogFile(kbRoot, sourcePath)) : undefined;
    relations.push({
      sourceId,
      targetId,
      relationType,
      weight: typeof relation.weight === "number" && relation.weight >= 0 ? relation.weight : 1,
      sourcePath,
      sourceHash,
      metadata: safeMetadata(plainRecord(relation.metadata) ?? {}),
    });
  }
  return uniqueRelations(relations);
}

function parseManifestMistakeTags(kbRoot: string, manifest: StrictCatalogManifest, concepts: ParsedConcept[]): ParsedMistakeTag[] {
  const tags = manifestArray<StrictCatalogMistakeTag>(manifest.mistake_tags ?? [], "mistake_tags");
  const activeConceptIds = new Set(concepts.map((concept) => concept.id));
  const seen = new Set<string>();
  return tags.map((tag, index) => {
    const id = requiredString(tag.id, `mistake_tags[${index}].id`);
    const name = requiredString(tag.name, `mistake_tags[${index}].name`);
    const description = requiredString(tag.description, `mistake_tags[${index}].description`);
    const sourcePath = requiredString(tag.source_path, `mistake_tags[${index}].source_path`);
    const orderIndex = requiredInteger(tag.order, `mistake_tags[${index}].order`);
    const conceptIds = uniqueStrings(arrayValue(tag.concept_ids));
    if (conceptIds.length === 0) throw new Error(`Catalog mistake tag ${id} must reference at least one concept`);
    const unknownConcept = conceptIds.find((conceptId) => !activeConceptIds.has(conceptId));
    if (unknownConcept) throw new Error(`Catalog mistake tag ${id} references unknown concept ${unknownConcept}`);
    const raw = readPublicCatalogFile(kbRoot, sourcePath);
    assertUnique(seen, id, "mistake tag");
    return {
      id,
      name,
      description,
      conceptIds,
      sourcePath,
      sourceHash: hashText(raw),
      orderIndex,
      metadata: safeMetadata({ ...(plainRecord(tag.metadata) ?? {}), source_type: "mistake_tag" }),
    };
  }).sort((left, right) => left.orderIndex - right.orderIndex || left.name.localeCompare(right.name, "zh-CN"));
}

function validateManifestStrategy(
  kbRoot: string,
  manifest: StrictCatalogManifest,
  units: ParsedUnit[],
  concepts: ParsedConcept[],
  exercises: ParsedExercise[],
  mistakeTags: ParsedMistakeTag[],
  relations: ParsedRelation[],
): void {
  validateActiveIdentity(units, concepts);
  const inventory = parseManifestInventory(kbRoot, manifest);
  validatePublicInventoryCoverage(kbRoot, "concept", "concepts", concepts.map((concept) => concept.relativePath), inventory.concepts);
  validatePublicInventoryCoverage(kbRoot, "exercise", "exercises", exercises.map((exercise) => exercise.relativePath), inventory.exercises);
  validateCourseSetupHandling(kbRoot, manifest.course_setup);
  validateDiagnosticPracticeRoutes(concepts, exercises);
  validateNonDiagnosticExerciseContext(concepts, exercises);
  validateRelationStructure(concepts, relations);
  validateMistakeTaxonomy(mistakeTags, new Set(concepts.map((concept) => concept.id)));
}

function validateActiveIdentity(units: ParsedUnit[], concepts: ParsedConcept[]): void {
  const unitIds = new Set(units.map((unit) => unit.id));
  const overlapping = concepts.find((concept) => unitIds.has(concept.id));
  if (overlapping) {
    throw new Error(`Catalog unit and concept id overlap: ${overlapping.id}`);
  }
}

function parseManifestInventory(kbRoot: string, manifest: StrictCatalogManifest): { concepts: InventoryEntry[]; exercises: InventoryEntry[] } {
  const inventory = manifest.inventory === undefined ? undefined : plainRecord(manifest.inventory);
  if (manifest.inventory !== undefined && !inventory) {
    throw new Error("Catalog manifest field inventory must be an object");
  }
  return {
    concepts: parseInventoryEntries(kbRoot, inventory?.concepts, "inventory.concepts", "concepts"),
    exercises: parseInventoryEntries(kbRoot, inventory?.exercises, "inventory.exercises", "exercises"),
  };
}

type InventoryEntry = {
  sourcePath: string;
  status: string;
  reason: string;
};

function parseInventoryEntries(kbRoot: string, value: unknown, field: string, expectedDirectory: "concepts" | "exercises"): InventoryEntry[] {
  const entries = manifestArray<StrictInventoryEntry>(value ?? [], field);
  const seen = new Set<string>();
  return entries.map((entry, index) => {
    const sourcePath = normalizeCatalogPath(requiredString(entry.source_path, `${field}[${index}].source_path`));
    if (!sourcePath.startsWith(`${expectedDirectory}/`)) {
      throw new Error(`Catalog ${field}[${index}].source_path must reference ${expectedDirectory}/`);
    }
    const status = requiredString(entry.status, `${field}[${index}].status`);
    if (!NON_ACTIVE_INVENTORY_STATUSES.has(status)) {
      throw new Error(`Catalog ${field}[${index}].status must be one of deferred, support, excluded`);
    }
    const reason = requiredString(entry.reason, `${field}[${index}].reason`);
    readPublicCatalogFile(kbRoot, sourcePath);
    assertUnique(seen, sourcePath, `${field} source_path`);
    return { sourcePath, status, reason };
  });
}

function validatePublicInventoryCoverage(
  kbRoot: string,
  kind: "concept" | "exercise",
  directory: "concepts" | "exercises",
  activeSourcePaths: string[],
  inventoryEntries: InventoryEntry[],
): void {
  const publicPaths = new Set(listPublicCatalogFiles(kbRoot, directory));
  const activePaths = new Set(activeSourcePaths.map(normalizeCatalogPath));
  const inventoryPaths = new Set<string>();
  for (const entry of inventoryEntries) {
    if (activePaths.has(entry.sourcePath)) {
      throw new Error(`Catalog inventory ${entry.sourcePath} duplicates an active ${kind} source path`);
    }
    inventoryPaths.add(entry.sourcePath);
  }
  for (const publicPath of publicPaths) {
    if (!activePaths.has(publicPath) && !inventoryPaths.has(publicPath)) {
      throw new Error(`Unclassified public ${kind} file: ${publicPath}`);
    }
  }
}

function validateCourseSetupHandling(kbRoot: string, value: unknown): void {
  const setupPaths = ["summaries/00_Setup.md", "sources/00_Setup.md"].filter((sourcePath) => publicCatalogFileExists(kbRoot, sourcePath));
  if (setupPaths.length === 0) return;
  const setup = plainRecord(value);
  if (!setup) {
    throw new Error("Course Setup content exists but manifest.course_setup is missing");
  }
  const status = requiredString(setup.status, "course_setup.status");
  if (!COURSE_SETUP_STATUSES.has(status)) {
    throw new Error("Catalog course_setup.status must be one of onboarding, deferred, support, excluded");
  }
  const sourcePaths = requiredStringArray(setup.source_paths, "course_setup.source_paths").map(normalizeCatalogPath);
  for (const sourcePath of setupPaths) {
    if (!sourcePaths.includes(sourcePath)) {
      throw new Error(`Course Setup content ${sourcePath} is not listed in course_setup.source_paths`);
    }
  }
  for (const sourcePath of sourcePaths) {
    readPublicCatalogFile(kbRoot, sourcePath);
  }
  if (status !== "onboarding") {
    requiredString(setup.reason, "course_setup.reason");
  }
}

function validateDiagnosticPracticeRoutes(concepts: ParsedConcept[], exercises: ParsedExercise[]): void {
  const activeExerciseIds = new Set(exercises.map((exercise) => exercise.id));
  const usableExercisesByConcept = new Map<string, string[]>();
  for (const exercise of exercises) {
    if (exercise.skip) continue;
    for (const conceptId of exercise.conceptIds) {
      const conceptExercises = usableExercisesByConcept.get(conceptId) ?? [];
      conceptExercises.push(exercise.id);
      usableExercisesByConcept.set(conceptId, conceptExercises);
    }
  }
  for (const concept of concepts.filter((item) => item.diagnosticEligible)) {
    if ((usableExercisesByConcept.get(concept.id)?.length ?? 0) > 0) continue;
    if (hasGeneratedPracticePolicy(concept.metadata)) continue;
    const remediationExerciseIds = stringArrayFromMetadata(concept.metadata, "remediation_exercise_ids");
    if (remediationExerciseIds.length > 0 && remediationExerciseIds.every((exerciseId) => activeExerciseIds.has(exerciseId))) continue;
    if (stringValue(concept.metadata.diagnostic_deferral_reason)) continue;
    throw new Error(`Catalog diagnostic concept ${concept.id} must declare a practice follow-up route`);
  }
}

function validateNonDiagnosticExerciseContext(concepts: ParsedConcept[], exercises: ParsedExercise[]): void {
  const conceptById = new Map(concepts.map((concept) => [concept.id, concept]));
  const activeConceptIds = new Set(concepts.map((concept) => concept.id));
  for (const exercise of exercises) {
    if (exercise.skip) continue;
    const targetConcepts = exercise.conceptIds.map((conceptId) => conceptById.get(conceptId)).filter((concept): concept is ParsedConcept => concept !== undefined);
    if (targetConcepts.length === 0 || targetConcepts.some((concept) => concept.diagnosticEligible)) continue;
    const prerequisiteConceptIds = stringArrayFromMetadata(exercise.metadata, "prerequisite_concept_ids");
    const remediationConceptIds = stringArrayFromMetadata(exercise.metadata, "remediation_concept_ids");
    const unknownReference = [...prerequisiteConceptIds, ...remediationConceptIds].find((conceptId) => !activeConceptIds.has(conceptId));
    if (unknownReference) {
      throw new Error(`Catalog exercise ${exercise.id} selection context references unknown concept ${unknownReference}`);
    }
    if (hasSelectionContext(exercise.metadata) || prerequisiteConceptIds.length > 0 || remediationConceptIds.length > 0) continue;
    throw new Error(`Catalog non-diagnostic exercise ${exercise.id} must declare selection context`);
  }
}

function validateRelationStructure(concepts: ParsedConcept[], relations: ParsedRelation[]): void {
  const relationSources = new Set(relations.map((relation) => relation.sourceId));
  for (const concept of concepts) {
    if (concept.metadata.root_concept === true) continue;
    if (!relationSources.has(concept.id)) {
      throw new Error(`Catalog non-root concept ${concept.id} must declare at least one relation`);
    }
  }
}

function validateMistakeTaxonomy(mistakeTags: ParsedMistakeTag[], activeConceptIds: Set<string>): void {
  for (const tag of mistakeTags) {
    const metadata = tag.metadata;
    if (!stringValue(metadata.teaching_intent)
      || !stringValue(metadata.evidence_type)
      || !stringValue(metadata.severity)
      || stringArrayFromMetadata(metadata, "symptoms").length === 0
      || stringArrayFromMetadata(metadata, "remediation_concept_ids").length === 0) {
      throw new Error(`Catalog mistake tag ${tag.id} must include structured teaching metadata`);
    }
    const unknownRemediation = stringArrayFromMetadata(metadata, "remediation_concept_ids").find((conceptId) => !activeConceptIds.has(conceptId));
    if (unknownRemediation) {
      throw new Error(`Catalog mistake tag ${tag.id} references unknown remediation concept ${unknownRemediation}`);
    }
  }
}

function upsertUnits(runtime: AppRuntime, units: ParsedUnit[], catalogVersion: string, now: string): void {
  for (const unit of units) {
    runtime.db.query(
      "INSERT INTO course_units(id, title, order_index, catalog_status, source_path, source_hash, catalog_version, metadata_json, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, order_index = excluded.order_index, catalog_status = 'active', source_path = excluded.source_path, source_hash = excluded.source_hash, catalog_version = excluded.catalog_version, metadata_json = excluded.metadata_json, updated_at = excluded.updated_at",
    ).run([unit.id, unit.title, unit.orderIndex, unit.sourcePath ?? null, unit.sourceHash ?? null, catalogVersion, JSON.stringify(unit.metadata), now, now]);
  }
}

function upsertConcepts(runtime: AppRuntime, concepts: ParsedConcept[], catalogVersion: string, now: string): void {
  for (const concept of concepts) {
    prepareDeclaredPreviousConcept(runtime, concept, now);
    runtime.db.query(
      `INSERT INTO concepts(
        id, name, unit, aliases_json, kb_path, created_at, updated_at, unit_id, catalog_status,
        source_type, source_path, source_hash, catalog_version, order_index, previous_ids_json,
        metadata_json, diagnostic_eligible
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 'kb_concept', ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        unit = excluded.unit,
        aliases_json = excluded.aliases_json,
        kb_path = excluded.kb_path,
        updated_at = excluded.updated_at,
        unit_id = excluded.unit_id,
        catalog_status = 'active',
        source_type = 'kb_concept',
        source_path = excluded.source_path,
        source_hash = excluded.source_hash,
        catalog_version = excluded.catalog_version,
        order_index = excluded.order_index,
        previous_ids_json = excluded.previous_ids_json,
        metadata_json = excluded.metadata_json,
        diagnostic_eligible = excluded.diagnostic_eligible`,
    ).run([
      concept.id,
      concept.name,
      concept.unit,
      JSON.stringify(concept.aliases),
      concept.relativePath,
      now,
      now,
      concept.unitId,
      concept.relativePath,
      concept.sourceHash,
      catalogVersion,
      concept.orderIndex,
      JSON.stringify(concept.previousIds),
      JSON.stringify(concept.metadata),
      concept.diagnosticEligible ? 1 : 0,
    ]);
    migrateDeclaredPreviousConceptReferences(runtime, concept);
  }
}

function prepareDeclaredPreviousConcept(runtime: AppRuntime, concept: ParsedConcept, now: string): void {
  if (concept.previousIds.length === 0) return;
  for (const previousId of concept.previousIds) {
    if (previousId === concept.id) continue;
    const previous = runtime.db.query<{ id: string; name: string }>("SELECT id, name FROM concepts WHERE id = ?").get([previousId]);
    if (!previous) continue;
    runtime.db.query("UPDATE concepts SET name = ?, catalog_status = 'inactive', updated_at = ? WHERE id = ?").run([
      historicalConceptName(previous.name, previousId),
      now,
      previousId,
    ]);
  }
}

function migrateDeclaredPreviousConceptReferences(runtime: AppRuntime, concept: ParsedConcept): void {
  for (const previousId of concept.previousIds) {
    if (previousId !== concept.id) {
      migrateConceptReferences(runtime, previousId, concept.id);
    }
  }
}

function migrateConceptReferences(runtime: AppRuntime, previousId: string, newId: string): void {
  migrateConceptMasteryReference(runtime, previousId, newId);
  runtime.db.query("UPDATE learning_evidence SET concept_id = ? WHERE concept_id = ?").run([newId, previousId]);
  runtime.db.query("UPDATE diagnostic_concept_state SET concept_id = ? WHERE concept_id = ?").run([newId, previousId]);
  runtime.db.query("UPDATE concept_relations SET source_concept_id = ? WHERE source_concept_id = ?").run([newId, previousId]);
  runtime.db.query("UPDATE concept_relations SET target_concept_id = ? WHERE target_concept_id = ?").run([newId, previousId]);
}

function migrateConceptMasteryReference(runtime: AppRuntime, previousId: string, newId: string): void {
  const previous = runtime.db.query<{ mastery_level: number; confidence: number; readiness: number; evidence_count: number; review_priority: number; last_evidence_at: string | null; updated_at: string }>(
    "SELECT mastery_level, confidence, readiness, evidence_count, review_priority, last_evidence_at, updated_at FROM concept_mastery WHERE concept_id = ?",
  ).get([previousId]);
  if (!previous) return;
  const current = runtime.db.query<{ mastery_level: number; confidence: number; readiness: number; evidence_count: number; review_priority: number; last_evidence_at: string | null; updated_at: string }>(
    "SELECT mastery_level, confidence, readiness, evidence_count, review_priority, last_evidence_at, updated_at FROM concept_mastery WHERE concept_id = ?",
  ).get([newId]);
  if (!current) {
    runtime.db.query("UPDATE concept_mastery SET concept_id = ? WHERE concept_id = ?").run([newId, previousId]);
    return;
  }
  runtime.db.query(
    "UPDATE concept_mastery SET mastery_level = ?, confidence = ?, readiness = ?, evidence_count = ?, review_priority = ?, last_evidence_at = ?, updated_at = ? WHERE concept_id = ?",
  ).run([
    Math.max(current.mastery_level, previous.mastery_level),
    Math.max(current.confidence, previous.confidence),
    Math.max(current.readiness, previous.readiness),
    Math.max(current.evidence_count, previous.evidence_count),
    Math.min(current.review_priority, previous.review_priority),
    (current.last_evidence_at ?? "") > (previous.last_evidence_at ?? "") ? current.last_evidence_at : previous.last_evidence_at,
    current.updated_at > previous.updated_at ? current.updated_at : previous.updated_at,
    newId,
  ]);
  runtime.db.query("DELETE FROM concept_mastery WHERE concept_id = ?").run([previousId]);
}

function historicalConceptName(name: string, previousId: string): string {
  const suffix = ` [previous:${previousId}]`;
  return name.endsWith(suffix) ? name : `${name}${suffix}`;
}

function upsertExercises(runtime: AppRuntime, exercises: ParsedExercise[], catalogVersion: string, now: string): void {
  for (const exercise of exercises) {
    runtime.db.query(
      `INSERT INTO exercises(
        id, title, difficulty, concept_ids_json, prompt_md, public_tests, hidden_tests_ref,
        status, version, created_at, updated_at, catalog_status, source_path, source_hash,
        catalog_version, order_index, private_solution, skip, metadata_json
      ) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        difficulty = excluded.difficulty,
        concept_ids_json = excluded.concept_ids_json,
        prompt_md = excluded.prompt_md,
        public_tests = NULL,
        hidden_tests_ref = NULL,
        status = excluded.status,
        version = excluded.version,
        updated_at = excluded.updated_at,
        catalog_status = 'active',
        source_path = excluded.source_path,
        source_hash = excluded.source_hash,
        catalog_version = excluded.catalog_version,
        order_index = excluded.order_index,
        private_solution = excluded.private_solution,
        skip = excluded.skip,
        metadata_json = excluded.metadata_json`,
    ).run([
      exercise.id,
      exercise.title,
      exercise.difficulty,
      JSON.stringify(exercise.conceptIds),
      exercise.promptMd,
      exercise.status,
      "kb_catalog.v1",
      now,
      now,
      exercise.relativePath,
      exercise.sourceHash,
      catalogVersion,
      exercise.orderIndex,
      exercise.privateSolution ? 1 : 0,
      exercise.skip ? 1 : 0,
      JSON.stringify(exercise.metadata),
    ]);
  }
}

function upsertMistakeTags(runtime: AppRuntime, tags: ParsedMistakeTag[], catalogVersion: string, now: string): void {
  for (const tag of tags) {
    runtime.db.query(
      `INSERT INTO mistake_tags(
        id, name, description, created_at, catalog_status, source_path, source_hash,
        catalog_version, concept_ids_json, metadata_json, order_index
      ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        catalog_status = 'active',
        source_path = excluded.source_path,
        source_hash = excluded.source_hash,
        catalog_version = excluded.catalog_version,
        concept_ids_json = excluded.concept_ids_json,
        metadata_json = excluded.metadata_json,
        order_index = excluded.order_index`,
    ).run([
      tag.id,
      tag.name,
      tag.description,
      now,
      tag.sourcePath,
      tag.sourceHash,
      catalogVersion,
      JSON.stringify(tag.conceptIds),
      JSON.stringify(tag.metadata),
      tag.orderIndex,
    ]);
  }
}

function syncRelations(runtime: AppRuntime, relations: ParsedRelation[], catalogVersion: string, now: string): void {
  runtime.db.query("DELETE FROM concept_relations WHERE source_type = 'kb_catalog'").run();
  for (const relation of relations) {
    runtime.db.query(
      "INSERT OR IGNORE INTO concept_relations(source_concept_id, target_concept_id, relation_type, weight, source_type, source_path, source_hash, catalog_version, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, 'kb_catalog', ?, ?, ?, ?, ?, ?)",
    ).run([relation.sourceId, relation.targetId, relation.relationType, relation.weight, relation.sourcePath ?? null, relation.sourceHash ?? null, catalogVersion, JSON.stringify(relation.metadata), now, now]);
  }
}

function markMissingInactive(runtime: AppRuntime, table: "course_units" | "concepts" | "exercises" | "mistake_tags", activeIds: string[], extraWhere?: string): void {
  const where = extraWhere ? ` AND ${extraWhere}` : "";
  if (activeIds.length === 0) {
    runtime.db.query(`UPDATE ${table} SET catalog_status = 'inactive' WHERE catalog_status = 'active'${where}`).run();
    return;
  }
  const placeholders = activeIds.map(() => "?").join(", ");
  runtime.db.query(`UPDATE ${table} SET catalog_status = 'inactive' WHERE catalog_status = 'active' AND id NOT IN (${placeholders})${where}`).run(activeIds);
}

function parseFrontmatter(raw: string): { body: string; metadata: Record<string, unknown> } {
  if (!raw.startsWith("---")) return { body: raw, metadata: {} };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { body: raw, metadata: {} };
  const frontmatter = raw.slice(3, end);
  const metadata: Record<string, unknown> = {};
  for (const line of frontmatter.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_\-]+):\s*(.*)$/);
    if (!match) continue;
    metadata[match[1]!] = parseScalar(match[2] ?? "");
  }
  return { body: raw.slice(end + 4).trimStart(), metadata };
}

function parseScalar(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1).split(",").map((item) => unquote(item.trim())).filter(Boolean);
  }
  return unquote(trimmed);
}

function readOptional(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

function safeList(dir: string, extension: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension) && !isDeniedCatalogPath(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "zh-CN"));
}

function readPublicCatalogFile(kbRoot: string, relativePath: string): string {
  const normalizedPath = relativePath.replace(/\\/g, "/");
  if (isDeniedCatalogPath(normalizedPath)) {
    throw new Error(`Denied catalog path: ${relativePath}`);
  }
  if (!/\.(md|json)$/i.test(normalizedPath)) {
    throw new Error(`Catalog path must reference a public markdown or JSON file: ${relativePath}`);
  }
  const root = resolve(statSync(kbRoot).isDirectory() ? kbRoot : "");
  const fullPath = resolve(root, ...normalizedPath.split("/"));
  const rel = relative(root, fullPath);
  if (rel.startsWith("..") || rel.includes(`..${sep}`) || rel === "..") {
    throw new Error("Catalog path escaped KB root");
  }
  return readFileSync(fullPath, "utf8");
}

function publicCatalogFileExists(kbRoot: string, relativePath: string): boolean {
  try {
    readPublicCatalogFile(kbRoot, relativePath);
    return true;
  } catch {
    return false;
  }
}

function listPublicCatalogFiles(kbRoot: string, directory: "concepts" | "exercises"): string[] {
  return safeList(join(kbRoot, directory), ".md").map((fileName) => `${directory}/${fileName}`);
}

function normalizeCatalogPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.?\//, "");
}

function manifestArray<T>(value: unknown, field: string): T[] {
  if (!Array.isArray(value)) throw new Error(`Catalog manifest field ${field} must be an array`);
  return value as T[];
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Catalog manifest field ${field} must be a non-empty string`);
  }
  return value.trim();
}

function requiredInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`Catalog manifest field ${field} must be an integer`);
  }
  return value;
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Catalog manifest field ${field} must be a boolean`);
  }
  return value;
}

function requiredRelationType(value: unknown, field: string): CatalogRelationType {
  const relationType = requiredString(value, field);
  if (!CATALOG_RELATION_TYPES.has(relationType as CatalogRelationType)) {
    throw new Error(`Catalog manifest field ${field} must be a supported relation type`);
  }
  return relationType as CatalogRelationType;
}

function requiredStringArray(value: unknown, field: string): string[] {
  const values = arrayValue(value);
  if (!Array.isArray(value) || values.length === 0) {
    throw new Error(`Catalog manifest field ${field} must be a non-empty string array`);
  }
  return values;
}

function plainRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function assertUnique(seen: Set<string>, id: string, kind: string): void {
  if (seen.has(id)) throw new Error(`Duplicate catalog ${kind} id: ${id}`);
  seen.add(id);
}

function safeMetadata(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (DANGEROUS_METADATA_KEYS.has(key) || value === undefined || /private|solution|evaluator|hidden|absolute|path_local/i.test(key)) continue;
    const safeValue = safeMetadataValue(value);
    if (safeValue !== undefined) output[key] = safeValue;
  }
  return output;
}

function safeMetadataValue(value: unknown): unknown {
  if (typeof value === "string") return sanitizeExternalContent(value, 500);
  if (Array.isArray(value)) return value.map(safeMetadataValue).filter((item) => item !== undefined);
  if (value && typeof value === "object") return safeMetadata(plainRecord(value) ?? {});
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  return undefined;
}

function toCatalogConcept(row: ConceptRow): CatalogConcept {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    unit_id: row.unit_id,
    aliases: parseStringArray(row.aliases_json),
    kb_path: row.kb_path,
    catalog_status: row.catalog_status,
    source_path: row.source_path,
    source_hash: row.source_hash,
    catalog_version: row.catalog_version,
    order_index: row.order_index,
    diagnostic_eligible: row.diagnostic_eligible === 1,
    metadata: parseObject(row.metadata_json),
  };
}

type ConceptRow = {
  id: string;
  name: string;
  unit: string | null;
  unit_id: string | null;
  aliases_json: string;
  kb_path: string | null;
  catalog_status: "active" | "inactive";
  source_path: string | null;
  source_hash: string | null;
  catalog_version: string | null;
  order_index: number;
  diagnostic_eligible: number;
  metadata_json: string;
};

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function arrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function stringArrayFromMetadata(metadata: Record<string, unknown>, key: string): string[] {
  return uniqueStrings(arrayValue(metadata[key]));
}

function hasGeneratedPracticePolicy(metadata: Record<string, unknown>): boolean {
  const generatedPractice = metadata.generated_practice;
  if (generatedPractice === true) return true;
  const policy = plainRecord(generatedPractice);
  return policy?.enabled === true || typeof metadata.practice_policy === "string";
}

function hasSelectionContext(metadata: Record<string, unknown>): boolean {
  const selectionContext = metadata.selection_context;
  if (typeof selectionContext === "string" && selectionContext.trim().length > 0) return true;
  const context = plainRecord(selectionContext);
  return context !== undefined && Object.keys(context).length > 0;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uniqueRelations(relations: ParsedRelation[]): ParsedRelation[] {
  const result = new Map<string, ParsedRelation>();
  for (const relation of relations) {
    result.set(`${relation.sourceId}:${relation.targetId}:${relation.relationType}`, relation);
  }
  return [...result.values()];
}

function slugify(input: string): string {
  const trimmed = stripMarkdownExtension(input)
    .trim()
    .toLowerCase()
    .replace(/['"`]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return trimmed || `item_${hashText(input).slice(0, 8)}`;
}

function stripMarkdownExtension(input: string): string {
  return input.replace(/\.(md|json)$/i, "");
}

function unquote(input: string): string {
  return input.replace(/^["']|["']$/g, "");
}

function hashText(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function catalogRunId(kbVersion: string, sourceHash: string): string {
  return `catalog_${hashText(`${kbVersion}:${sourceHash}`).slice(0, 20)}`;
}

function isDeniedCatalogPath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  return /(^|\/)(reports|explorations|AGENTS\.md|log\.md|\.openkb|\.env|private|solutions|raw)(\/|$)/i.test(normalized)
    || extname(normalized).toLowerCase() === ".env";
}
