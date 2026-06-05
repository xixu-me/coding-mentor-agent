import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import type { AppRuntime, ToolEnvelope } from "../types.js";
import { AppError } from "../types.js";
import { sanitizeExternalContent, summarizeText } from "../security/redaction.js";
import { resolveInside } from "../security/path.js";
import { getActiveCatalogConcepts } from "../server/course-catalog.js";
import { errorEnvelope, okEnvelope } from "./envelope.js";
import {
  assertValid,
  KbGetPageContentParams,
  KbOverviewParams,
  KbReadConceptParams,
  KbReadFileParams,
  KbReadImageParams,
  KbReadSummaryParams,
  KbSearchParams,
} from "./schemas.js";

type KbPageData = {
  title: string;
  body: string;
  metadata: {
    path: string;
    sources?: string[];
    brief?: string;
  };
};

type KbCandidate = {
  source_type: "concept" | "summary" | "source_page_hint";
  path: string;
  title: string;
  brief?: string;
  score: number;
  reason: string;
  next_tool: "kb_read_concept" | "kb_read_summary" | "kb_read_file" | "kb_get_page_content";
  pages?: number[];
};

const WIKI_LINK_RE = /\[\[(concepts|summaries|sources)\/([^\]]+)\]\](?:\s*[—-]\s*([^\n]+))?/g;

export async function kbOverview(runtime: AppRuntime, params: unknown): Promise<ToolEnvelope<{
  kb_version: string;
  title: string;
  concept_count: number;
  summary_count: number;
  core_concepts: Array<{ id: string; name: string; path: string }>;
  lint_status?: { status: "unknown" | "passed" | "failed"; report_id?: string };
}>> {
  const started = Date.now();
  try {
    const input = assertValid<{ include_lint?: boolean }>(KbOverviewParams, params);
    const activeConcepts = getActiveCatalogConcepts(runtime);
    const conceptCount = activeConcepts.length;
    const summaryCount = safeList(join(runtime.config.kbRoot, "summaries"), ".md").length;
    const title = parseTitle(readOptional(join(runtime.config.kbRoot, "index.md")) ?? "") || "Practical Python Course KB";
    const lint = input.include_lint ? await kbLintStatus(runtime, {}) : undefined;
    return okEnvelope("kb_overview", started, {
      kb_version: runtime.config.kbVersion,
      title,
      concept_count: conceptCount,
      summary_count: summaryCount,
      core_concepts: activeConcepts.map((concept) => ({ id: concept.id, name: concept.name, path: concept.kb_path ?? concept.source_path ?? "" })),
      lint_status: lint?.data,
    });
  } catch (error) {
    return errorEnvelope("kb_overview", started, error);
  }
}

export async function kbReadConcept(runtime: AppRuntime, params: unknown): Promise<ToolEnvelope<KbPageData>> {
  const started = Date.now();
  try {
    const input = assertValid<{ concept_name: string }>(KbReadConceptParams, params);
    const requested = input.concept_name.trim();
    const concept = resolveConcept(runtime, requested);
    if (!concept) {
      throw new AppError("KB_NOT_FOUND", `Concept not found: ${requested}`, 404);
    }
    const page = readKbPage(runtime, concept.path);
    return okEnvelope("kb_read_concept", started, {
      ...page,
      title: concept.name,
      metadata: { ...page.metadata, path: concept.path },
    }, "OK", { source: concept.path });
  } catch (error) {
    return errorEnvelope("kb_read_concept", started, error);
  }
}

export async function kbSearch(runtime: AppRuntime, params: unknown): Promise<ToolEnvelope<{
  query: string;
  strategy: "wiki_navigation";
  candidates: KbCandidate[];
}>> {
  const started = Date.now();
  try {
    const input = assertValid<{ query: string; limit?: number; scope?: "all" | "concepts" | "summaries" | "sources" }>(KbSearchParams, params);
    const limit = input.limit ?? 5;
    const query = input.query.trim();
    const pages = buildNavigationPages(runtime);
    const scored = pages
      .filter((page) => input.scope === undefined || input.scope === "all" || page.scope === input.scope)
      .map((page) => scoreCandidate(query, page))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "zh-CN"))
      .slice(0, limit);
    return okEnvelope("kb_search", started, {
      query,
      strategy: "wiki_navigation",
      candidates: scored,
    });
  } catch (error) {
    return errorEnvelope("kb_search", started, error, { query: "", strategy: "wiki_navigation", candidates: [] });
  }
}

export async function kbReadFile(runtime: AppRuntime, params: unknown): Promise<ToolEnvelope<KbPageData>> {
  const started = Date.now();
  try {
    if (typeof params === "object" && params && "path" in params && typeof params.path === "string" && params.path.includes("..")) {
      throw new AppError("KB_PATH_DENIED", "Path traversal is not allowed");
    }
    const input = assertValid<{ path: string }>(KbReadFileParams, params);
    const page = readKbPage(runtime, input.path);
    return okEnvelope("kb_read_file", started, page, "OK", { source: input.path });
  } catch (error) {
    return errorEnvelope("kb_read_file", started, error);
  }
}

export async function kbReadSummary(runtime: AppRuntime, params: unknown): Promise<ToolEnvelope<KbPageData>> {
  const started = Date.now();
  try {
    const input = assertValid<{ doc_name: string }>(KbReadSummaryParams, params);
    const docName = safeDocName(input.doc_name);
    const path = `summaries/${docName}.md`;
    const page = readKbPage(runtime, path);
    return okEnvelope("kb_read_summary", started, page, "OK", { source: path });
  } catch (error) {
    return errorEnvelope("kb_read_summary", started, error);
  }
}

export async function kbGetPageContent(runtime: AppRuntime, params: unknown): Promise<ToolEnvelope<KbPageData & { pages: number[] }>> {
  const started = Date.now();
  try {
    const input = assertValid<{ doc_name: string; pages: string }>(KbGetPageContentParams, params);
    const pages = parsePages(input.pages);
    const docName = safeDocName(input.doc_name);
    const markdownPath = `sources/${docName}.md`;
    const jsonPath = `sources/${docName}.json`;
    const path = existsSync(join(runtime.config.kbRoot, markdownPath)) ? markdownPath : jsonPath;
    const page = readKbPage(runtime, path);
    const chunks = splitPageLikeChunks(page.body);
    const selected = pages.map((pageNumber) => chunks[pageNumber - 1]).filter((item): item is string => Boolean(item));
    if (selected.length === 0) {
      throw new AppError("KB_NOT_FOUND", "Requested page content is outside the available range", 404);
    }
    return okEnvelope("kb_get_page_content", started, { ...page, body: selected.join("\n\n"), pages }, "OK", { source: path });
  } catch (error) {
    return errorEnvelope("kb_get_page_content", started, error);
  }
}

export async function kbReadImage(runtime: AppRuntime, params: unknown): Promise<ToolEnvelope<{
  path: string;
  mime_type: string;
  bytes: number;
  base64: string;
}>> {
  const started = Date.now();
  try {
    if (typeof params === "object" && params && "path" in params && typeof params.path === "string" && params.path.includes("..")) {
      throw new AppError("KB_PATH_DENIED", "Path traversal is not allowed");
    }
    const input = assertValid<{ path: string }>(KbReadImageParams, params);
    const real = resolveInside(runtime.config.kbRoot, input.path, [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]);
    const stat = statSync(real);
    const maxBytes = 1_000_000;
    if (stat.size > maxBytes) {
      throw new AppError("VALIDATION_ERROR", "Image is too large to return through the course tool");
    }
    const content = readFileSync(real);
    return okEnvelope("kb_read_image", started, {
      path: input.path,
      mime_type: imageMimeType(input.path),
      bytes: stat.size,
      base64: content.toString("base64"),
    }, "OK", { source: input.path });
  } catch (error) {
    return errorEnvelope("kb_read_image", started, error, { path: "", mime_type: "", bytes: 0, base64: "" });
  }
}

export async function kbLintStatus(_runtime: AppRuntime, _params: unknown): Promise<ToolEnvelope<{
  status: "unknown" | "passed" | "failed";
  report_id?: string;
}>> {
  const started = Date.now();
  return okEnvelope("kb_lint_status", started, { status: "unknown" });
}

function readKbPage(runtime: AppRuntime, relativePath: string): KbPageData {
  const real = resolveInside(runtime.config.kbRoot, relativePath, [".md", ".json"]);
  const raw = readFileSync(real, "utf8");
  const { body, metadata } = parseFrontmatter(raw);
  const sanitized = sanitizeExternalContent(body);
  return {
    title: parseTitle(sanitized) || basename(relativePath).replace(/\.(md|json)$/i, ""),
    body: sanitized,
    metadata: {
      path: relativePath,
      sources: metadata.sources,
      brief: metadata.brief,
    },
  };
}

function imageMimeType(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".bmp") return "image/bmp";
  return "image/png";
}

function resolveConcept(runtime: AppRuntime, requested: string): { name: string; path: string } | undefined {
  const normalized = normalizeTerm(requested);
  const rows = runtime.db.query<{ id: string; name: string; aliases_json: string; kb_path: string | null }>(
    "SELECT id, name, aliases_json, kb_path FROM concepts WHERE catalog_status = 'active'",
  ).all();
  for (const row of rows) {
    const aliases = JSON.parse(row.aliases_json) as string[];
    const terms = [row.id, row.name, ...aliases, basename(row.kb_path ?? "", ".md")].map(normalizeTerm);
    if (terms.includes(normalized) || terms.some((term) => normalized.includes(term) || term.includes(normalized))) {
      return { name: row.name, path: row.kb_path ?? `concepts/${row.name}.md` };
    }
  }
  return undefined;
}

function buildNavigationPages(runtime: AppRuntime): Array<KbCandidate & { text: string; aliases: string[]; scope: "concepts" | "summaries" | "sources" }> {
  const pages: Array<KbCandidate & { text: string; aliases: string[]; scope: "concepts" | "summaries" | "sources" }> = [];
  for (const concept of getActiveCatalogConcepts(runtime)) {
    const path = concept.kb_path ?? concept.source_path ?? "";
    if (!path || isDeniedCandidate(path)) continue;
    pages.push({
      source_type: "concept",
      path,
      title: concept.name,
      brief: concept.aliases.join(" / "),
      score: 0,
      reason: "核心概念页匹配",
      next_tool: "kb_read_concept",
      text: `${concept.name} ${concept.aliases.join(" ")} ${readOptional(join(runtime.config.kbRoot, path)) ?? ""}`,
      aliases: [...concept.aliases],
      scope: "concepts",
    });
  }
  for (const file of safeList(join(runtime.config.kbRoot, "summaries"), ".md")) {
    const relative = `summaries/${file}`;
    const raw = readOptional(join(runtime.config.kbRoot, relative)) ?? "";
    pages.push({
      source_type: "summary",
      path: relative,
      title: parseTitle(raw) || basename(file, ".md"),
      brief: parseFrontmatter(raw).metadata.brief,
      score: 0,
      reason: "摘要页匹配",
      next_tool: "kb_read_summary",
      text: raw,
      aliases: [basename(file, ".md")],
      scope: "summaries",
    });
  }
  const index = readOptional(join(runtime.config.kbRoot, "index.md")) ?? "";
  for (const match of index.matchAll(WIKI_LINK_RE)) {
    const kind = match[1] as "concepts" | "summaries" | "sources";
    const stem = match[2] ?? "";
    const relative = `${kind}/${stem.endsWith(".md") ? stem : `${stem}.md`}`;
    if (isDeniedCandidate(relative) || pages.some((page) => page.path === relative)) {
      continue;
    }
    if (kind === "concepts") continue;
    pages.push({
      source_type: kind === "summaries" ? "summary" : "source_page_hint",
      path: relative,
      title: stem,
      brief: match[3]?.trim(),
      score: 0,
      reason: "index.md 导航项匹配",
      next_tool: kind === "sources" ? "kb_get_page_content" : "kb_read_summary",
      pages: kind === "sources" ? [1] : undefined,
      text: `${stem} ${match[3] ?? ""}`,
      aliases: [stem],
      scope: kind,
    });
  }
  return pages.filter((page) => !isDeniedCandidate(page.path));
}

function scoreCandidate(query: string, page: KbCandidate & { text: string; aliases: string[] }): KbCandidate {
  const q = normalizeTerm(query);
  const title = normalizeTerm(page.title);
  const aliases = page.aliases.map(normalizeTerm);
  const text = normalizeTerm(page.text.slice(0, 4000));
  let score = 0;
  if (title === q || title.includes(q) || q.includes(title)) score += 8;
  if (aliases.some((alias) => alias && (q.includes(alias) || alias.includes(q)))) score += 6;
  if (text.includes(q)) score += 4;
  for (const token of expandQueryTerms(q)) {
    if (token && text.includes(token)) score += page.source_type === "concept" ? 3 : 2;
  }
  if (page.source_type === "concept") score += 1;
  return { ...page, score, reason: score >= 8 ? "标题或别名精确匹配" : page.reason };
}

function expandQueryTerms(query: string): string[] {
  const synonyms: Record<string, string[]> = {
    "循环": ["for", "while", "range", "遍历"],
    "返回值": ["return", "函数"],
    "输出": ["print", "格式化"],
    "调试": ["traceback", "pytest", "pdb"],
    "列表": ["list", "序列"],
  };
  return [...new Set([query, ...Object.entries(synonyms).flatMap(([key, values]) => (query.includes(key) ? values : []))])];
}

function parseFrontmatter(raw: string): { body: string; metadata: { sources?: string[]; brief?: string } } {
  if (!raw.startsWith("---")) {
    return { body: raw, metadata: {} };
  }
  const end = raw.indexOf("\n---", 3);
  if (end === -1) {
    return { body: raw, metadata: {} };
  }
  const fm = raw.slice(3, end);
  const body = raw.slice(end + 4).trimStart();
  const sources = fm.match(/^sources:\s*\[(.*)\]/m)?.[1]?.split(",").map((item) => item.trim()).filter(Boolean);
  const brief = fm.match(/^brief:\s*(.+)$/m)?.[1]?.trim();
  return { body, metadata: { sources, brief } };
}

function parseTitle(raw: string): string {
  return raw.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "";
}

function safeList(dir: string, extension: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension) && !isDeniedCandidate(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function readOptional(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

function safeDocName(docName: string): string {
  const cleaned = docName.trim().replace(/\.md$/i, "");
  if (!/^[A-Za-z0-9_.\-\u4e00-\u9fa5 ]{1,120}$/.test(cleaned) || cleaned.includes("..")) {
    throw new AppError("VALIDATION_ERROR", "Invalid document name");
  }
  return cleaned;
}

function parsePages(input: string): number[] {
  const pages = new Set<number>();
  for (const part of input.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.includes("-")) {
      const [startRaw, endRaw] = trimmed.split("-");
      const start = Number(startRaw);
      const end = Number(endRaw);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start <= 0 || end < start) {
        throw new AppError("VALIDATION_ERROR", "Invalid page range");
      }
      for (let page = start; page <= end; page += 1) pages.add(page);
    } else {
      const page = Number(trimmed);
      if (!Number.isInteger(page) || page <= 0) throw new AppError("VALIDATION_ERROR", "Invalid page number");
      pages.add(page);
    }
  }
  const result = [...pages].slice(0, 5);
  if (result.length === 0) throw new AppError("VALIDATION_ERROR", "At least one page is required");
  return result;
}

function splitPageLikeChunks(body: string): string[] {
  const chunks = body.split(/\n(?=##?\s+)/).filter(Boolean);
  return chunks.length > 0 ? chunks : [body];
}

function normalizeTerm(input: string): string {
  return input.toLowerCase().replace(/\.(md|json)$/g, "").replace(/[`\s_\-：:，,。./\\]/g, "");
}

function isDeniedCandidate(path: string): boolean {
  return /(^|\/)(reports|explorations|AGENTS\.md|log\.md|\.openkb|\.env|private|solutions)(\/|$)/i.test(path);
}
