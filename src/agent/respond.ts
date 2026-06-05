import type { AppRuntime, ModelRequestContext } from "../types.js";
import { AppError } from "../types.js";
import { createPiCourseSession } from "./pi-session.js";

export async function generateTutorResponse(
  runtime: AppRuntime,
  message: string,
  code?: string,
  context?: ModelRequestContext,
  toolContext: { sessionId?: string | null; turnId?: string | null } = {},
): Promise<string> {
  if (process.env.ENABLE_PI_AGENT === "true") {
    try {
      const created = await createPiCourseSession(runtime, context?.route?.allowed_tool_group, toolContext) as any;
      const session = created.session;
      let text = "";
      session.subscribe((event: any) => {
        if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
          text += event.assistantMessageEvent.delta;
        }
      });
      await session.prompt(buildModelPrompt(message, code, context));
      session.dispose?.();
      if (text.trim()) return text.trim();
    } catch {
      throw new AppError("MODEL_UNAVAILABLE", "外部模型调用失败，无法生成导师回复。", 503, true);
    }
  }
  throw new AppError("MODEL_UNAVAILABLE", "未配置可用的外部模型，无法生成导师回复。", 503, true);
}

export function buildModelPrompt(message: string, code?: string, context?: ModelRequestContext): string {
  const parts: string[] = [];
  if (context?.bundle) {
    parts.push(`[受控任务上下文]\n${JSON.stringify(context.bundle)}`);
  }
  if (context?.summary) {
    parts.push(`[受控模型上下文摘要:${context.strategy}]\n${context.summary}`);
  }
  if (context?.recent_messages.length) {
    parts.push([
      "[最近必要消息]",
      ...context.recent_messages.map((item) => `${item.role}:${item.text}`),
    ].join("\n"));
  }
  parts.push(`[本轮学生输入]\n${message}`);
  if (code) parts.push(`[学生代码]\n${code}`);
  return parts.join("\n\n");
}
