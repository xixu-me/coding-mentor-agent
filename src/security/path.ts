import { existsSync, realpathSync, statSync } from "node:fs";
import { extname, isAbsolute, resolve, sep } from "node:path";
import { AppError } from "../types.js";

const DENIED_SEGMENTS = new Set(["..", ".openkb", "reports", "explorations"]);
const DENIED_FILES = new Set(["AGENTS.md", "log.md", ".env"]);

export function ensureRelativeSafePath(path: string, allowedExtensions: string[]): void {
  if (!path || isAbsolute(path) || path.includes("\\") || path.split("/").some((segment) => DENIED_SEGMENTS.has(segment))) {
    throw new AppError("KB_PATH_DENIED", "Path is outside the allowed wiki directories");
  }
  const file = path.split("/").at(-1) ?? "";
  if (DENIED_FILES.has(file) || file.startsWith(".")) {
    throw new AppError("KB_PATH_DENIED", "Path is not allowed");
  }
  if (!allowedExtensions.includes(extname(path).toLowerCase())) {
    throw new AppError("VALIDATION_ERROR", "File extension is not allowed");
  }
}

export function resolveInside(root: string, relativePath: string, allowedExtensions: string[]): string {
  ensureRelativeSafePath(relativePath, allowedExtensions);
  const rootResolved = realpathSync.native(root);
  const candidate = resolve(rootResolved, relativePath);
  if (!candidate.startsWith(rootResolved + sep) && candidate !== rootResolved) {
    throw new AppError("KB_PATH_DENIED", "Resolved path escaped the wiki root");
  }
  if (!existsSync(candidate)) {
    throw new AppError("KB_NOT_FOUND", "Knowledge base file not found", 404);
  }
  const real = realpathSync.native(candidate);
  if (!real.startsWith(rootResolved + sep)) {
    throw new AppError("KB_PATH_DENIED", "Real path escaped the wiki root");
  }
  const stat = statSync(real);
  if (!stat.isFile()) {
    throw new AppError("KB_PATH_DENIED", "Only files can be read");
  }
  return real;
}

export function assertSandboxFilePath(path: string): void {
  const allowed = new Set([".py", ".txt", ".csv", ".json"]);
  if (!path || isAbsolute(path) || path.includes("\\") || path.split("/").some((segment) => segment === ".." || segment.startsWith("."))) {
    throw new AppError("VALIDATION_ERROR", "Sandbox file paths must be relative safe paths");
  }
  if (!allowed.has(extname(path).toLowerCase())) {
    throw new AppError("VALIDATION_ERROR", "Sandbox file extension is not allowed");
  }
}
