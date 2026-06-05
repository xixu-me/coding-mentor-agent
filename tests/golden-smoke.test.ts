import { describe, expect, it } from "vitest";
import { createSession, getSessionSnapshot, postMessage } from "../src/server/services.js";
import { createTestRuntime } from "./utils/runtime.js";

describe("golden case smoke set", () => {
  it("does not teach concept lessons from local fallback templates", async () => {
    await expect(askWithoutTutor("return 有什么用？和 print 有什么区别？")).rejects.toMatchObject({
      code: "MODEL_UNAVAILABLE",
    });
  });

  it("does not predict code output from local fallback templates", async () => {
    await expect(askWithoutTutor("这段代码输出什么？", "x = 1\nx = x + 1\nprint(x)\n")).rejects.toMatchObject({
      code: "MODEL_UNAVAILABLE",
    });
  });

  it("locates list index errors for debug_index_error_001", async () => {
    const answer = await ask("为什么列表报错？", "items = [10, 20]\nprint(items[2])\n");
    expect(answer).toContain("索引");
    expect(answer).toContain("0");
    expect(answer).toContain("1");
  });

  it("does not point learners to a removed run button", async () => {
    await expect(askWithoutTutor("请评阅我的练习", "name = 'Ada'\nprint(name)\n")).rejects.toMatchObject({
      code: "MODEL_UNAVAILABLE",
    });
  });
});

async function ask(message: string, code?: string): Promise<string> {
  const runtime = await createTestRuntime();
  const session = createSession(runtime, { resume: false });
  await postMessage(runtime, session.session_id, { message, code, attachments: [] });
  const snapshot = getSessionSnapshot(runtime, session.session_id);
  return snapshot.turns[0]?.assistant_messages[0]?.text ?? "";
}

async function askWithoutTutor(message: string, code?: string): Promise<string> {
  const runtime = await createTestRuntime({ tutor: null });
  const session = createSession(runtime, { resume: false });
  await postMessage(runtime, session.session_id, { message, code, attachments: [] });
  const snapshot = getSessionSnapshot(runtime, session.session_id);
  return snapshot.turns[0]?.assistant_messages[0]?.text ?? "";
}
