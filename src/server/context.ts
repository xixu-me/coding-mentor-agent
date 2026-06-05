import type { AppRuntime, ModelContextMessage, ModelRequestContext } from "../types.js";
import { createId, nowIso } from "../security/ids.js";
import { redactText, summarizeText } from "../security/redaction.js";

const TURN_COMPACTION_THRESHOLD = 20;
const RECENT_TURNS_FOR_MODEL = 4;
const MODEL_CONTEXT_BUDGET_CHARS = 12_000;
const MODEL_CONTEXT_BUDGET_TRIGGER_RATIO = 0.6;
const MODEL_SUMMARY_LIMIT = 1200;
const BUSINESS_SUMMARY_LIMIT = 800;

type TurnRow = {
  id: string;
  user_message_summary: string | null;
  assistant_message_summary: string | null;
  started_at: string;
};

type MessageRow = {
  turn_id: string;
  message_id: string;
  role: "user" | "assistant" | "tool";
  content_redacted_text: string;
};

export function prepareModelContext(runtime: AppRuntime, sessionId: string, currentInput: { message: string; code?: string }): ModelRequestContext {
  const turns = runtime.db.query<TurnRow>(
    "SELECT id, user_message_summary, assistant_message_summary, started_at FROM session_turns WHERE session_id = ? ORDER BY started_at ASC, id ASC",
  ).all([sessionId]);
  const estimatedChars = estimateContextChars(turns, currentInput);
  const shouldCompact = turns.length >= TURN_COMPACTION_THRESHOLD || estimatedChars > MODEL_CONTEXT_BUDGET_CHARS * MODEL_CONTEXT_BUDGET_TRIGGER_RATIO;
  const recentTurns = turns.slice(-RECENT_TURNS_FOR_MODEL);
  const omittedTurnCount = Math.max(0, turns.length - recentTurns.length);
  const recentMessages = loadRecentMessages(runtime, sessionId, new Set(recentTurns.map((turn) => turn.id)));

  if (!shouldCompact) {
    const sessionSummary = runtime.db.query<{ summary: string | null }>("SELECT summary FROM agent_sessions WHERE id = ?").get([sessionId])?.summary ?? null;
    const summary = omittedTurnCount > 0 ? ensureCompaction(runtime, sessionId, turns, recentTurns.length) : sessionSummary;
    return {
      strategy: "full_recent",
      compacted: omittedTurnCount > 0,
      summary,
      recent_messages: recentMessages,
      current_input: normalizeCurrentInput(currentInput),
      omitted_turn_count: omittedTurnCount,
    };
  }

  const summary = ensureCompaction(runtime, sessionId, turns, recentTurns.length);
  return {
    strategy: "context_compaction",
    compacted: true,
    summary,
    recent_messages: recentMessages,
    current_input: normalizeCurrentInput(currentInput),
    omitted_turn_count: omittedTurnCount,
  };
}

function ensureCompaction(runtime: AppRuntime, sessionId: string, turns: TurnRow[], recentTurnCount: number): string {
  const sourceTurnCount = turns.length;
  const existing = runtime.db.query<{ summary_text: string }>(
    "SELECT summary_text FROM model_context_compactions WHERE session_id = ? AND source_turn_count = ? ORDER BY created_at DESC LIMIT 1",
  ).get([sessionId, sourceTurnCount]);
  if (existing) return existing.summary_text;

  const olderTurns = turns.slice(0, Math.max(0, turns.length - recentTurnCount));
  const summary = buildDeterministicCompactionSummary(olderTurns, sourceTurnCount);
  const now = nowIso();
  runtime.db.transaction(() => {
    runtime.db.query(
      "INSERT INTO model_context_compactions(id, session_id, source_turn_count, summary_text, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run([createId("cmp"), sessionId, sourceTurnCount, summary, now]);
    runtime.db.query("UPDATE agent_sessions SET summary = ? WHERE id = ?").run([summarizeText(summary, BUSINESS_SUMMARY_LIMIT), sessionId]);
  });
  return summary;
}

function loadRecentMessages(runtime: AppRuntime, sessionId: string, turnIds: Set<string>): ModelContextMessage[] {
  if (turnIds.size === 0) return [];
  return runtime.db.query<MessageRow>(
    "SELECT turn_id, message_id, role, content_redacted_text FROM session_messages WHERE session_id = ? ORDER BY created_at ASC, id ASC",
  ).all([sessionId])
    .filter((message) => turnIds.has(message.turn_id))
    .map((message) => ({
      role: message.role,
      text: redactText(message.content_redacted_text, 1200),
      turn_id: message.turn_id,
      message_id: message.message_id,
    }));
}

function buildDeterministicCompactionSummary(olderTurns: TurnRow[], sourceTurnCount: number): string {
  const joined = olderTurns.map((turn) => `${turn.user_message_summary ?? ""} ${turn.assistant_message_summary ?? ""}`).join("\n");
  const topics = inferTopics(joined);
  const mistakes = inferMistakes(joined);
  const summary = {
    summary_kind: "context_compaction",
    source_turn_count: sourceTurnCount,
    summarized_turn_count: olderTurns.length,
    student_goal: null,
    current_level: inferLevel(joined),
    recent_topics: topics,
    persistent_mistakes: mistakes,
    successful_patterns: inferSuccessfulPatterns(joined),
    open_tasks: inferOpenTasks(joined),
    recommended_next: inferRecommendation(topics, mistakes) ?? null,
  };
  return redactText(JSON.stringify(summary), MODEL_SUMMARY_LIMIT);
}

function inferTopics(text: string): string[] {
  const topics: string[] = [];
  if (/(循环|for\b|while\b|range\b)/i.test(text)) topics.push("循环结构");
  if (/(列表|list|索引|index)/i.test(text)) topics.push("列表与索引");
  if (/(函数|def\b|return\b)/i.test(text)) topics.push("函数与返回值");
  if (/(条件|if\b|elif\b|else\b)/i.test(text)) topics.push("条件分支");
  if (/(字符串|string|str\b)/i.test(text)) topics.push("字符串处理");
  return topics.slice(0, 5);
}

function inferMistakes(text: string): string[] {
  const mistakes: string[] = [];
  if (/(冒号|expected ':'|SyntaxError)/i.test(text)) mistakes.push("控制流语句末尾容易漏冒号");
  if (/(缩进|IndentationError)/i.test(text)) mistakes.push("代码块缩进需要保持一致");
  if (/(越界|IndexError|索引)/i.test(text)) mistakes.push("访问列表前需要确认索引范围");
  if (/(输出格式|空格|换行)/i.test(text)) mistakes.push("需要核对输出格式");
  return mistakes.slice(0, 5);
}

function inferSuccessfulPatterns(text: string): string[] {
  if (/(passed|通过|完成|正确)/i.test(text)) {
    return ["能根据反馈继续修正代码"];
  }
  return [];
}

function inferOpenTasks(text: string): string[] {
  if (/(练习|exercise|项目|project)/i.test(text)) {
    return ["继续完成当前练习或项目步骤"];
  }
  return [];
}

function inferRecommendation(topics: string[], mistakes: string[]): string | undefined {
  if (mistakes.some((mistake) => mistake.includes("冒号"))) {
    return "先完成一个控制流语法检查练习，再提交练习验证。";
  }
  if (topics.includes("循环结构")) {
    return "继续练习循环变量范围、边界和循环体缩进。";
  }
  return undefined;
}

function inferLevel(text: string): string {
  if (/(函数|文件|项目|pytest|mypy)/i.test(text)) return "进阶基础";
  if (/(循环|列表|条件|字符串)/i.test(text)) return "初级";
  return "未明确";
}

function estimateContextChars(turns: TurnRow[], currentInput: { message: string; code?: string }): number {
  const history = turns.reduce((sum, turn) => sum + (turn.user_message_summary?.length ?? 0) + (turn.assistant_message_summary?.length ?? 0), 0);
  return history + currentInput.message.length + (currentInput.code?.length ?? 0);
}

function normalizeCurrentInput(input: { message: string; code?: string }): { message: string; code?: string } {
  return {
    message: redactText(input.message, 4000),
    code: input.code ? redactText(input.code, 20_000) : undefined,
  };
}
