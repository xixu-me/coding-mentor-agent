import type { AppRuntime } from "../types.js";
import { AppError } from "../types.js";

export function requireLocalSession(runtime: AppRuntime, sessionId: string): void {
  const row = runtime.db.query<{ id: string; status: string }>("SELECT id, status FROM agent_sessions WHERE id = ?").get([sessionId]);
  if (!row || row.status === "archived") {
    throw new AppError("SESSION_NOT_FOUND", "Local session not found or archived", 404);
  }
}

export function requireLocalTurn(runtime: AppRuntime, sessionId: string, turnId: string): void {
  requireLocalSession(runtime, sessionId);
  const row = runtime.db.query<{ id: string }>("SELECT id FROM session_turns WHERE session_id = ? AND id = ?").get([sessionId, turnId]);
  if (!row) {
    throw new AppError("SESSION_NOT_FOUND", "Turn does not belong to this local session", 404);
  }
}

export function requirePublishedDiagnostic(runtime: AppRuntime, questionId: string): void {
  const row = runtime.db.query<{ id: string }>("SELECT id FROM diagnostic_questions WHERE id = ? AND status = 'published'").get([questionId]);
  if (!row) {
    throw new AppError("FORBIDDEN", "Diagnostic question is not published", 403);
  }
}

export function requirePublishedExercise(runtime: AppRuntime, exerciseId: string): void {
  const row = runtime.db.query<{ id: string }>("SELECT id FROM exercises WHERE id = ? AND status = 'published'").get([exerciseId]);
  if (!row) {
    throw new AppError("FORBIDDEN", "Exercise is not published", 403);
  }
}

export function requireLocalProjectPlan(runtime: AppRuntime, projectPlanId: string): void {
  const row = runtime.db.query<{ id: string }>("SELECT id FROM project_plans WHERE id = ?").get([projectPlanId]);
  if (!row) {
    throw new AppError("FORBIDDEN", "Project plan not found", 403);
  }
}

export function requireUnlockedProjectStep(runtime: AppRuntime, projectPlanId: string, projectStepId: string): void {
  requireLocalProjectPlan(runtime, projectPlanId);
  const row = runtime.db.query<{ id: string; status: string }>(
    "SELECT id, status FROM project_steps WHERE project_plan_id = ? AND id = ?",
  ).get([projectPlanId, projectStepId]);
  if (!row) {
    throw new AppError("FORBIDDEN", "Project step does not belong to this plan", 403);
  }
  if (row.status !== "active") {
    throw new AppError("FORBIDDEN", "Project step is not unlocked", 403);
  }
}

export function assertConceptIdsKnown(runtime: AppRuntime, conceptIds: string[]): void {
  for (const id of conceptIds) {
    const row = runtime.db.query<{ id: string }>("SELECT id FROM concepts WHERE id = ?").get([id]);
    if (!row) {
      throw new AppError("VALIDATION_ERROR", `Unknown concept id: ${id}`);
    }
  }
}

export function assertMistakeTagIdsKnown(runtime: AppRuntime, mistakeTagIds: string[]): void {
  for (const id of mistakeTagIds) {
    const row = runtime.db.query<{ id: string }>("SELECT id FROM mistake_tags WHERE id = ?").get([id]);
    if (!row) {
      throw new AppError("VALIDATION_ERROR", `Unknown mistake tag id: ${id}`);
    }
  }
}
