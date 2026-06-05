import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "coding-mentor-agent-"));
}
