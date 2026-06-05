import { completeSimple as piCompleteSimple, getModel as piGetModel } from "@earendil-works/pi-ai";
import type { AssistantMessage, Context, Model, SimpleStreamOptions } from "@earendil-works/pi-ai";
import type { AiApi, AiReasoning, TutorResponder } from "../types.js";
import { AppError } from "../types.js";
import { buildModelPrompt } from "./respond.js";

export type PiAiTutorConfig = {
  provider: string;
  api?: AiApi;
  model: string;
  baseUrl?: string;
  apiKey: string;
  instructions: string;
  timeoutMs: number;
  maxOutputTokens: number;
  reasoning?: AiReasoning;
};

export type PiAiTutorDeps = {
  getModel?: (provider: string, model: string) => Model<any> | undefined;
  completeSimple?: (model: Model<any>, context: Context, options?: SimpleStreamOptions) => Promise<AssistantMessage>;
};

export function createPiAiTutor(config: PiAiTutorConfig, deps: PiAiTutorDeps = {}): TutorResponder {
  const getModel = deps.getModel ?? ((provider, model) => piGetModel(provider as any, model as any) as Model<any> | undefined);
  const completeSimple = deps.completeSimple ?? piCompleteSimple;
  const baseUrl = config.baseUrl ? normalizeHttpsBaseUrl(config.baseUrl) : undefined;
  return {
    generate: async (request) => {
      const model = resolvePiAiModel(config, getModel, baseUrl);
      if (!model) {
        throw new AppError("MODEL_UNAVAILABLE", "模型配置不可用，无法生成导师回复。", 503, true);
      }
      const response = await completeSimple(model, buildPiAiContext(config, request), {
        apiKey: config.apiKey,
        timeoutMs: config.timeoutMs,
        maxTokens: config.maxOutputTokens,
        ...(config.reasoning ? { reasoning: config.reasoning } : {}),
      });
      const text = extractText(response).trim();
      if (!text) {
        throw new AppError("MODEL_UNAVAILABLE", "模型服务未返回可展示文本，无法生成导师回复。", 503, true);
      }
      return text;
    },
  };
}

function resolvePiAiModel(
  config: PiAiTutorConfig,
  getModel: NonNullable<PiAiTutorDeps["getModel"]>,
  baseUrl: string | undefined,
): Model<any> | undefined {
  if (config.api === "openai-responses") {
    return createOpenAIResponsesModel(config, baseUrl);
  }
  const model = getModel(config.provider, config.model);
  return model && baseUrl ? { ...model, baseUrl } : model;
}

function createOpenAIResponsesModel(config: PiAiTutorConfig, baseUrl: string | undefined): Model<"openai-responses"> {
  return {
    id: config.model,
    name: config.model,
    api: "openai-responses",
    provider: config.provider,
    baseUrl: baseUrl ?? defaultBaseUrlForProvider(config.provider),
    reasoning: true,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 256000,
    maxTokens: Math.max(config.maxOutputTokens, 8192),
  };
}

function defaultBaseUrlForProvider(provider: string): string {
  if (provider === "xai") {
    return "https://api.x.ai/v1";
  }
  return "https://api.openai.com/v1";
}

function buildPiAiContext(config: PiAiTutorConfig, request: Parameters<TutorResponder["generate"]>[0]): Context {
  return {
    systemPrompt: config.instructions,
    messages: [{
      role: "user",
      content: buildModelPrompt(request.message, request.code, request.context),
      timestamp: Date.now(),
    }],
  };
}

function normalizeHttpsBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("AI_BASE_URL must use HTTPS");
  }
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/responses\/?$/, "");
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

function extractText(message: AssistantMessage): string {
  return message.content.flatMap((block) => block.type === "text" ? [block.text] : []).join("\n");
}
