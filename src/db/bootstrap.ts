import type { AppRuntime } from "../types.js";
import { nowIso } from "../security/ids.js";

export function initializeLocalProfile(runtime: AppRuntime): void {
  const now = nowIso();
  runtime.db.query("INSERT OR IGNORE INTO local_profile(id, display_name, profile_json, created_at, updated_at) VALUES ('local', NULL, ?, ?, ?)").run([
    JSON.stringify({
      profile_summary: "Python 课程学习者，尚未完成首次诊断。",
      current_level: "未诊断",
      current_goal: null,
    }),
    now,
    now,
  ]);
}
