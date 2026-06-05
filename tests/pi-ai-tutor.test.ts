import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AssistantMessage, Context, Model, SimpleStreamOptions } from "@earendil-works/pi-ai";
import { buildModelPrompt } from "../src/agent/respond.js";
import { createPiAiTutor } from "../src/agent/pi-ai-tutor.js";
import { loadConfig, loadEnvFile } from "../src/config.js";
import { createSession, postMessage } from "../src/server/services.js";
import { createTempDir } from "./utils/fs.js";
import { createTestRuntime } from "./utils/runtime.js";

describe("pi-ai LLM integration", () => {
  it("loads pi-ai provider config from AI environment variables without requiring tracked secrets", () => {
    const appDataDir = createTempDir();
    const config = loadConfig({
      APP_DATA_DIR: appDataDir,
      AI_PROVIDER: "openai",
      AI_BASE_URL: "https://api.example.test/v1",
      AI_MODEL: "gpt-5.5",
      AI_API_KEY: "test-api-key",
      AI_TIMEOUT_MS: "12345",
      AI_MAX_OUTPUT_TOKENS: "777",
      AI_REASONING: "medium",
    } as NodeJS.ProcessEnv);

    expect(config.ai).toMatchObject({
      provider: "openai",
      baseUrl: "https://api.example.test/v1",
      model: "gpt-5.5",
      apiKey: "test-api-key",
      timeoutMs: 12345,
      maxOutputTokens: 777,
      reasoning: "medium",
    });
  });

  it("loads an explicit pi-ai API override from AI environment variables", () => {
    const appDataDir = createTempDir();
    const config = loadConfig({
      APP_DATA_DIR: appDataDir,
      AI_PROVIDER: "xai",
      AI_API: "openai-responses",
      AI_BASE_URL: "https://api.example.test/v1",
      AI_MODEL: "grok-4.3",
      AI_API_KEY: "test-api-key",
    } as NodeJS.ProcessEnv);

    expect(config.ai).toMatchObject({
      provider: "xai",
      api: "openai-responses",
      baseUrl: "https://api.example.test/v1",
      model: "grok-4.3",
      apiKey: "test-api-key",
    });
  });

  it("loads legacy Responses environment variables as an OpenAI pi-ai provider", () => {
    const appDataDir = createTempDir();
    const config = loadConfig({
      APP_DATA_DIR: appDataDir,
      LLM_PROVIDER: "responses",
      LLM_RESPONSES_ENDPOINT: "https://api.example.test/v1/responses",
      LLM_MODEL: "gpt-5.5",
      LLM_API_KEY: "test-api-key",
      LLM_TIMEOUT_MS: "12345",
      LLM_MAX_OUTPUT_TOKENS: "777",
    } as NodeJS.ProcessEnv);

    expect(config.ai).toMatchObject({
      provider: "openai",
      baseUrl: "https://api.example.test/v1",
      model: "gpt-5.5",
      apiKey: "test-api-key",
      timeoutMs: 12345,
      maxOutputTokens: 777,
    });
  });

  it("loads local .env values without overriding existing process values", () => {
    const envPath = join(createTempDir(), ".env");
    writeFileSync(envPath, [
      "AI_PROVIDER=openai",
      "AI_MODEL=gpt-5.5",
      "AI_API_KEY=from-file",
      "AI_BASE_URL=https://api.example.test/v1",
    ].join("\n"));
    const env: NodeJS.ProcessEnv = { AI_API_KEY: "from-process" };

    loadEnvFile(env, envPath);

    expect(env.AI_PROVIDER).toBe("openai");
    expect(env.AI_MODEL).toBe("gpt-5.5");
    expect(env.AI_BASE_URL).toBe("https://api.example.test/v1");
    expect(env.AI_API_KEY).toBe("from-process");
  });

  it("generates tutor responses through pi-ai with server-side API key options", async () => {
    const calls: Array<{ model: Model<any>; context: Context; options?: SimpleStreamOptions }> = [];
    const tutor = createPiAiTutor({
      provider: "openai",
      model: "gpt-5.5",
      baseUrl: "https://api.example.test/v1",
      apiKey: "test-api-key",
      instructions: "course instructions",
      timeoutMs: 5000,
      maxOutputTokens: 900,
      reasoning: "medium",
    }, {
      getModel: () => createModel(),
      completeSimple: async (model, context, options) => {
        calls.push({ model, context, options });
        return createAssistantMessage("模型回答");
      },
    });

    const text = await tutor.generate({
      message: "解释 return 和 print",
      code: "def f():\n    return 1\n",
      context: {
        strategy: "full_recent",
        compacted: false,
        summary: null,
        recent_messages: [],
        current_input: { message: "解释 return 和 print" },
        omitted_turn_count: 0,
      },
    });

    expect(text).toBe("模型回答");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.model.baseUrl).toBe("https://api.example.test/v1");
    expect(calls[0]!.context.systemPrompt).toBe("course instructions");
    expect(calls[0]!.context.messages[0]).toMatchObject({ role: "user" });
    expect(calls[0]!.options).toMatchObject({
      apiKey: "test-api-key",
      timeoutMs: 5000,
      maxTokens: 900,
      reasoning: "medium",
    });
    expect(JSON.stringify(calls[0]!.context)).toContain("[本轮学生输入]");
    expect(JSON.stringify(calls[0]!.context)).toContain("[学生代码]");
    expect(JSON.stringify(calls[0]!.context)).not.toContain("test-api-key");
  });

  it("uses a custom Responses model when configured with an explicit openai-responses API", async () => {
    const calls: Array<{ model: Model<any>; context: Context; options?: SimpleStreamOptions }> = [];
    const tutor = createPiAiTutor({
      provider: "xai",
      api: "openai-responses",
      model: "grok-4.3",
      baseUrl: "https://api.example.test/v1",
      apiKey: "test-api-key",
      instructions: "course instructions",
      timeoutMs: 5000,
      maxOutputTokens: 900,
      reasoning: "medium",
    }, {
      getModel: () => ({
        ...createModel(),
        id: "grok-4.3",
        provider: "xai",
        api: "openai-completions",
      }),
      completeSimple: async (model, context, options) => {
        calls.push({ model, context, options });
        return createAssistantMessage("模型回答");
      },
    });

    const text = await tutor.generate({
      message: "解释列表下标",
      context: {
        strategy: "full_recent",
        compacted: false,
        summary: null,
        recent_messages: [],
        current_input: { message: "解释列表下标" },
        omitted_turn_count: 0,
      },
    });

    expect(text).toBe("模型回答");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.model).toMatchObject({
      id: "grok-4.3",
      name: "grok-4.3",
      provider: "xai",
      api: "openai-responses",
      baseUrl: "https://api.example.test/v1",
      reasoning: true,
      input: ["text"],
    });
    expect(calls[0]!.options).toMatchObject({
      apiKey: "test-api-key",
      timeoutMs: 5000,
      maxTokens: 900,
      reasoning: "medium",
    });
    expect(JSON.stringify(calls[0]!.context)).not.toContain("test-api-key");
  });

  it("rejects insecure custom base URLs before invoking pi-ai", () => {
    expect(() => createPiAiTutor({
      provider: "openai",
      model: "gpt-5.5",
      baseUrl: "http://api.example.test/v1",
      apiKey: "test-api-key",
      instructions: "course instructions",
      timeoutMs: 5000,
      maxOutputTokens: 900,
    }, {
      getModel: () => createModel(),
      completeSimple: async () => createAssistantMessage("unused"),
    })).toThrow(/HTTPS/);
  });

  it("reports model unavailability if the pi-ai request fails", async () => {
    const runtime = await createTestRuntime({
      tutor: createPiAiTutor({
        provider: "openai",
        model: "gpt-5.5",
        apiKey: "test-api-key",
        instructions: "course instructions",
        timeoutMs: 5000,
        maxOutputTokens: 900,
      }, {
        getModel: () => createModel(),
        completeSimple: async () => {
          throw new Error("bad upstream");
        },
      }),
    });
    const session = createSession(runtime, { resume: false });

    await expect(postMessage(runtime, session.session_id, {
      message: "这段代码为什么报错？",
      code: "for i in range(3)\n    print(i)",
      attachments: [],
    })).rejects.toMatchObject({ code: "MODEL_UNAVAILABLE" });

    const stored = runtime.db.query<{ content_redacted_text: string }>(
      "SELECT content_redacted_text FROM session_messages WHERE role = 'assistant' ORDER BY created_at DESC LIMIT 1",
    ).get();
    expect(stored).toBeUndefined();
  });

  it("keeps model prompt construction free of API keys", () => {
    const prompt = buildModelPrompt("解释循环", "print('ok')", {
      strategy: "full_recent",
      compacted: false,
      summary: null,
      recent_messages: [],
      current_input: { message: "解释循环" },
      omitted_turn_count: 0,
    });

    expect(prompt).toContain("[本轮学生输入]");
    expect(prompt).not.toMatch(/sk-[A-Za-z0-9]/);
  });
});

function createModel(): Model<any> {
  return {
    id: "gpt-5.5",
    name: "GPT 5.5",
    api: "openai-responses",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    reasoning: true,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 16000,
  };
}

function createAssistantMessage(text: string): AssistantMessage {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "openai-responses",
    provider: "openai",
    model: "gpt-5.5",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: Date.now(),
  };
}
