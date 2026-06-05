// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { App } from "../src/frontend/App.js";
import { applySseEvent, createInitialViewModel, renderTextNode } from "../src/frontend/state.js";
import type { DiagnosticResponse, PracticeOutcome, ProgressResponse, SessionSnapshotResponse } from "../src/frontend/api.js";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type FetchCall = {
  path: string;
  init?: RequestInit;
};

class MockEventSource {
  static instances: MockEventSource[] = [];
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readonly listeners = new Map<string, EventListenerOrEventListenerObject>();
  closed = false;

  constructor(readonly url: string) {
    MockEventSource.instances.push(this);
    queueMicrotask(() => this.onopen?.());
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    this.listeners.set(type, listener);
  }

  close() {
    this.closed = true;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  MockEventSource.instances = [];
  document.body.innerHTML = "";
});

describe("frontend state reducer and safe rendering", () => {
  it("deduplicates and orders message deltas by turn, message, and seq", () => {
    let state = createInitialViewModel();
    state = applySseEvent(state, { type: "message_delta", turn_id: "turn_1", message_id: "msg_1", seq: 2, delta: "界" });
    state = applySseEvent(state, { type: "message_delta", turn_id: "turn_1", message_id: "msg_1", seq: 1, delta: "边" });
    state = applySseEvent(state, { type: "message_delta", turn_id: "turn_1", message_id: "msg_1", seq: 1, delta: "边" });
    expect(state.messages[0]?.text).toBe("边界");
  });

  it("renders untrusted content as text rather than HTML", () => {
    const node = renderTextNode("<img src=x onerror=alert(1)>");
    expect(node.textContent).toBe("<img src=x onerror=alert(1)>");
    expect((node as HTMLElement).innerHTML).toBe("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("renders assistant message markdown as structured content", async () => {
    mockAppFetch((path) => {
      if (path === "/api/sessions") return { session_id: "sess_1", stream_url: "/api/sessions/sess_1/events" };
      if (path === "/api/sessions/sess_1/snapshot") {
        return snapshotWithAssistant([
          "**重点**",
          "",
          "- 第 12 行需要补冒号",
          "",
          "```python",
          "for i in range(3):",
          "    print(i)",
          "```",
        ].join("\n"));
      }
      if (path === "/api/progress/me") return progressResponse({ completed: true });
      if (path === "/api/diagnostics/next") return completedDiagnosticResponse();
      throw new Error(`Unexpected fetch: ${path}`);
    });

    const app = await renderApp();
    await waitForText(app.container, "第 12 行需要补冒号");

    expect(app.container.querySelector(".message-body strong")?.textContent).toBe("重点");
    expect(app.container.querySelector(".message-body ul li")?.textContent).toContain("第 12 行需要补冒号");
    expect(app.container.querySelector(".message-body pre code")?.textContent).toContain("for i in range(3):");

    app.unmount();
  });

  it("keeps unsafe markdown HTML and URLs inert", async () => {
    mockAppFetch((path) => {
      if (path === "/api/sessions") return { session_id: "sess_1", stream_url: "/api/sessions/sess_1/events" };
      if (path === "/api/sessions/sess_1/snapshot") {
        return snapshotWithAssistant([
          "[危险链接](javascript:alert(1))",
          "",
          "<img src=x onerror=alert(1)>",
        ].join("\n"));
      }
      if (path === "/api/progress/me") return progressResponse({ completed: true });
      if (path === "/api/diagnostics/next") return completedDiagnosticResponse();
      throw new Error(`Unexpected fetch: ${path}`);
    });

    const app = await renderApp();
    await waitForText(app.container, "危险链接");

    expect(app.container.querySelector(".message-body img")).toBeNull();
    const unsafeLink = Array.from(app.container.querySelectorAll(".message-body a"))
      .find((link) => link.textContent === "危险链接");
    expect(unsafeLink).not.toBeUndefined();
    expect(unsafeLink?.getAttribute("href") ?? null).toBeNull();

    app.unmount();
  });

  it("only turns prose line references into clickable controls", async () => {
    mockAppFetch((path) => {
      if (path === "/api/sessions") return { session_id: "sess_1", stream_url: "/api/sessions/sess_1/events" };
      if (path === "/api/sessions/sess_1/snapshot") {
        return snapshotWithAssistant([
          "请看第 12 行。",
          "",
          "```python",
          "# 第 99 行只是代码注释",
          "```",
        ].join("\n"));
      }
      if (path === "/api/progress/me") return progressResponse({ completed: true });
      if (path === "/api/diagnostics/next") return completedDiagnosticResponse();
      throw new Error(`Unexpected fetch: ${path}`);
    });

    const app = await renderApp();
    await waitForText(app.container, "第 99 行只是代码注释");

    expect(Array.from(app.container.querySelectorAll(".message-body button.line-link"))
      .map((button) => button.textContent)).toEqual(["第 12 行"]);
    expect(app.container.querySelector(".message-body pre code")?.textContent).toContain("第 99 行");

    app.unmount();
  });

  it("preserves natural line breaks in chat messages", async () => {
    mockAppFetch((path) => {
      if (path === "/api/sessions") return { session_id: "sess_1", stream_url: "/api/sessions/sess_1/events" };
      if (path === "/api/sessions/sess_1/snapshot") return snapshotWithAssistant("第一行\n第二行");
      if (path === "/api/progress/me") return progressResponse({ completed: true });
      if (path === "/api/diagnostics/next") return completedDiagnosticResponse();
      throw new Error(`Unexpected fetch: ${path}`);
    });

    const app = await renderApp();
    await waitForText(app.container, "第一行");

    expect(app.container.querySelector(".message-body br")).not.toBeNull();

    app.unmount();
  });

  it("renders diagnostic prompt markdown code blocks without breaking choices", async () => {
    mockAppFetch((path) => {
      if (path === "/api/sessions") return { session_id: "sess_1", stream_url: "/api/sessions/sess_1/events" };
      if (path === "/api/sessions/sess_1/snapshot") return emptySnapshot();
      if (path === "/api/progress/me") return progressResponse({ completed: false });
      if (path === "/api/diagnostics/next") {
        return activeDiagnosticResponse([
          "下面代码输出什么？",
          "",
          "```python",
          "x = 2",
          "print(x + 3)",
          "```",
        ].join("\n"));
      }
      throw new Error(`Unexpected fetch: ${path}`);
    });

    const app = await renderApp();
    await waitForText(app.container, "下面代码输出什么？");

    expect(app.container.querySelector(".diagnostic-card pre code")?.textContent).toContain("print(x + 3)");
    expect(Array.from(app.container.querySelectorAll(".diagnostic-choices button")).map((button) => button.textContent)).toEqual(["A1 < 2", "B1 > 2"]);

    app.unmount();
  });

  it("keeps exercise prompt markdown intact in the render path", () => {
    const appSource = readFileSync(join(process.cwd(), "src", "frontend", "App.tsx"), "utf8");

    expect(appSource).not.toContain("normalizePrompt(exercise.prompt_md)");
    expect(appSource).not.toContain("function normalizePrompt");
    expect(appSource).toContain("text={exercise.prompt_md}");
  });

  it("renders GFM content while keeping images excluded", async () => {
    mockAppFetch((path) => {
      if (path === "/api/sessions") return { session_id: "sess_1", stream_url: "/api/sessions/sess_1/events" };
      if (path === "/api/sessions/sess_1/snapshot") {
        return snapshotWithAssistant([
          "| 项目 | 状态 |",
          "| --- | --- |",
          "| 循环 | OK |",
          "",
          "- [x] 已检查",
          "",
          "![alt](https://example.com/image.png)",
        ].join("\n"));
      }
      if (path === "/api/progress/me") return progressResponse({ completed: true });
      if (path === "/api/diagnostics/next") return completedDiagnosticResponse();
      throw new Error(`Unexpected fetch: ${path}`);
    });

    const app = await renderApp();
    await waitForText(app.container, "循环");

    expect(app.container.querySelector(".message-body table")?.textContent).toContain("状态");
    expect(app.container.querySelector(".message-body input[type='checkbox']")).not.toBeNull();
    expect(app.container.querySelector(".message-body img")).toBeNull();

    app.unmount();
  });

  it("does not present the adaptive diagnostic as a fixed total quiz", () => {
    const appSource = readFileSync(join(process.cwd(), "src", "frontend", "App.tsx"), "utf8");

    expect(appSource).toContain("estimated_remaining_min");
    expect(appSource).toContain("current_focus_concept_ids");
    expect(appSource).not.toContain("progress.diagnostic.answered}/${progress.diagnostic.total");
    expect(appSource).not.toContain("diagnostic.progress.answered + 1}/{diagnostic.progress.total");
  });

  it("keeps the diagnostic primary before completion without promising generated practice", async () => {
    const calls = mockAppFetch((path) => {
      if (path === "/api/sessions") return { session_id: "sess_1", stream_url: "/api/sessions/sess_1/events" };
      if (path === "/api/sessions/sess_1/snapshot") return emptySnapshot();
      if (path === "/api/progress/me") return progressResponse({ completed: false });
      if (path === "/api/diagnostics/next") return activeDiagnosticResponse();
      throw new Error(`Unexpected fetch: ${path}`);
    });

    const app = await renderApp();
    await waitForText(app.container, "确定起点水平");

    expect(app.container.textContent).toContain("继续判断学习起点，达到高置信后再进入后续学习");
    expect(app.container.textContent).not.toContain("达到高置信后再解锁练习");
    expect(app.container.textContent).not.toContain("完成初始测评后生成当前练习。");
    expect(calls.map((call) => call.path)).not.toContain("/api/exercises/next?session_id=sess_1");

    app.unmount();
  });

  it("shows diagnostic feedback after completed diagnostic boot without loading an exercise", async () => {
    const calls = mockAppFetch((path) => {
      if (path === "/api/sessions") return { session_id: "sess_1", stream_url: "/api/sessions/sess_1/events" };
      if (path === "/api/sessions/sess_1/snapshot") return emptySnapshot();
      if (path === "/api/progress/me") {
        return progressResponse({
          completed: true,
          currentLevel: "初级",
          currentGoal: "巩固：循环",
          diagnosticFeedback: {
            performance_summary: "基础表达式判断较稳定，分支题有少量犹豫。",
            mastery_summary: "已具备入门语法基础，条件判断适合作为下一步起点。",
            learning_start: "条件判断",
          },
        });
      }
      if (path === "/api/diagnostics/next") return completedDiagnosticResponse();
      if (path.startsWith("/api/exercises/next")) throw new Error("Exercise generation should not be requested automatically");
      throw new Error(`Unexpected fetch: ${path}`);
    });

    const app = await renderApp();
    await waitForText(app.container, "测评反馈");

    expect(app.container.textContent).toContain("测评表现");
    expect(app.container.textContent).toContain("基础表达式判断较稳定");
    expect(app.container.textContent).toContain("掌握情况");
    expect(app.container.textContent).toContain("已具备入门语法基础");
    expect(app.container.textContent).toContain("学习起点");
    expect(app.container.textContent).toContain("条件判断");
    expect(app.container.textContent).toContain("开始导师指导");
    const primaryActions = Array.from(app.container.querySelectorAll(".diagnostic-feedback button.primary"))
      .map((button) => button.textContent);
    expect(primaryActions).toEqual(["开始导师指导"]);
    expect(app.container.textContent).not.toContain("测评完成 6 题");
    expect(app.container.textContent).not.toContain("置信度");
    expect(app.container.textContent).not.toContain("判断依据");
    expect(app.container.textContent).not.toContain("优先巩固");
    expect(app.container.textContent).not.toContain("查看下一步学习建议");
    expect(app.container.textContent).not.toContain("学习建议已展开");
    expect(app.container.textContent).not.toContain("正在加载当前练习");
    expect(calls.some((call) => call.path.startsWith("/api/exercises/next"))).toBe(false);

    app.unmount();
  });

  it("uses conservative diagnostic feedback fallback when backend feedback is temporarily absent", async () => {
    mockAppFetch((path) => {
      if (path === "/api/sessions") return { session_id: "sess_1", stream_url: "/api/sessions/sess_1/events" };
      if (path === "/api/sessions/sess_1/snapshot") return emptySnapshot();
      if (path === "/api/progress/me") {
        return progressResponse({
          completed: true,
          currentLevel: "初级",
          currentGoal: null,
          weakConcepts: [],
          diagnosticFeedback: null,
        });
      }
      if (path === "/api/diagnostics/next") return completedDiagnosticResponse();
      throw new Error(`Unexpected fetch: ${path}`);
    });

    const app = await renderApp();
    await waitForText(app.container, "测评反馈");

    expect(app.container.textContent).toContain("已完成初始测评，表现可作为起点判断参考。");
    expect(app.container.textContent).toContain("已识别出适合继续学习的基础范围。");
    expect(app.container.textContent).toContain("开始导师指导");
    expect(app.container.textContent).not.toContain("优先巩固");

    app.unmount();
  });

  it("starts tutor guidance from completed feedback without requesting an exercise", async () => {
    let snapshotRequests = 0;
    const calls = mockAppFetch((path, init) => {
      if (path === "/api/sessions") return { session_id: "sess_1", stream_url: "/api/sessions/sess_1/events" };
      if (path === "/api/sessions/sess_1/snapshot") {
        snapshotRequests += 1;
        return snapshotRequests > 1
          ? snapshotWithAssistant("我们从学习起点开始，先梳理条件判断。")
          : emptySnapshot();
      }
      if (path === "/api/progress/me") return progressResponse({ completed: true });
      if (path === "/api/diagnostics/next") return completedDiagnosticResponse();
      if (path === "/api/sessions/sess_1/guidance/start") return { accepted: true, turn_id: "turn_guidance" };
      if (path.startsWith("/api/exercises/next")) throw new Error("Exercise generation should not be requested automatically");
      throw new Error(`Unexpected fetch: ${path} ${init?.method ?? "GET"}`);
    });

    const app = await renderApp();
    await waitForText(app.container, "开始导师指导");
    clickButton(app.container, "开始导师指导");
    await waitForText(app.container, "我们从学习起点开始");

    const guidanceCall = calls.find((call) => call.path === "/api/sessions/sess_1/guidance/start");
    expect(guidanceCall?.init?.method).toBe("POST");
    expect(calls.some((call) => call.path.startsWith("/api/exercises/next"))).toBe(false);

    app.unmount();
  });

  it("does not expose a direct practice action after guidance eligibility", async () => {
    const calls = mockAppFetch((path, init) => {
      if (path === "/api/sessions") return { session_id: "sess_1", stream_url: "/api/sessions/sess_1/events" };
      if (path === "/api/sessions/sess_1/snapshot") return emptySnapshot();
      if (path === "/api/progress/me") {
        return progressResponse({
          completed: true,
          progressDecision: {
            diagnostic_state: "completed",
            handoff_state: "guidance_started",
            practice_state: "available_after_explicit_request",
          },
        });
      }
      if (path === "/api/diagnostics/next") return completedDiagnosticResponse();
      if (path === "/api/sessions/sess_1/practice") throw new Error("Practice must be requested through tutor conversation");
      throw new Error(`Unexpected fetch: ${path}`);
    });

    const app = await renderApp();
    await waitForText(app.container, "开始导师指导");

    expect(app.container.textContent).not.toContain("开始练习");
    expect(calls.some((call) => call.path === "/api/sessions/sess_1/practice")).toBe(false);
    expect(app.container.querySelector(".exercise-card")).toBeNull();

    app.unmount();
  });

  it("hides explicit practice while practice state remains guidance-first", async () => {
    mockAppFetch((path) => {
      if (path === "/api/sessions") return { session_id: "sess_1", stream_url: "/api/sessions/sess_1/events" };
      if (path === "/api/sessions/sess_1/snapshot") return emptySnapshot();
      if (path === "/api/progress/me") {
        return progressResponse({
          completed: true,
          progressDecision: {
            diagnostic_state: "completed",
            handoff_state: "guidance_started",
            practice_state: "guidance_first",
          },
        });
      }
      if (path === "/api/diagnostics/next") return completedDiagnosticResponse();
      throw new Error(`Unexpected fetch: ${path}`);
    });

    const app = await renderApp();
    await waitForText(app.container, "开始导师指导");

    expect(app.container.textContent).not.toContain("开始练习");

    app.unmount();
  });

  it("does not call standalone practice endpoint to render unavailable outcomes", async () => {
    mockAppFetch((path) => {
      if (path === "/api/sessions") return { session_id: "sess_1", stream_url: "/api/sessions/sess_1/events" };
      if (path === "/api/sessions/sess_1/snapshot") return emptySnapshot();
      if (path === "/api/progress/me") {
        return progressResponse({
          completed: true,
          progressDecision: {
            diagnostic_state: "completed",
            handoff_state: "guidance_started",
            practice_state: "available_after_explicit_request",
          },
        });
      }
      if (path === "/api/diagnostics/next") return completedDiagnosticResponse();
      if (path === "/api/sessions/sess_1/practice") throw new Error("Standalone practice endpoint should not be used by the UI");
      throw new Error(`Unexpected fetch: ${path}`);
    });

    const app = await renderApp();
    await waitForText(app.container, "开始导师指导");

    expect(app.container.textContent).not.toContain("开始练习");
    expect(app.container.textContent).not.toContain("练习暂时不可用");
    expect(app.container.querySelector(".exercise-card")).toBeNull();

    app.unmount();
  });

  it("keeps showing active placement continuation after many diagnostic answers", async () => {
    mockAppFetch((path) => {
      if (path === "/api/sessions") return { session_id: "sess_1", stream_url: "/api/sessions/sess_1/events" };
      if (path === "/api/sessions/sess_1/snapshot") return emptySnapshot();
      if (path === "/api/progress/me") {
        return progressResponse({
          completed: false,
          currentLevel: "未诊断",
          currentGoal: null,
          weakConcepts: [],
          diagnostic: {
            ...diagnosticProgress(),
            answered: 42,
            total: 42,
            hard_cap: 42,
            estimated_remaining_min: 1,
            estimated_remaining_max: 3,
            current_focus_concept_ids: ["pytest"],
            placement_confidence: 0.54,
            leading_start_concept_id: "pytest",
            confidence_margin: 0.08,
            completed: false,
          },
        });
      }
      if (path === "/api/diagnostics/next") {
        return {
          diagnostic_id: "diag_first_use",
          completed: false,
          progress: {
            ...diagnosticProgress(),
            answered: 42,
            total: 42,
            hard_cap: 42,
            estimated_remaining_min: 1,
            estimated_remaining_max: 3,
            current_focus_concept_ids: ["pytest"],
            placement_confidence: 0.54,
            leading_start_concept_id: "pytest",
            confidence_margin: 0.08,
          },
          question: {
            id: "diag_q_42",
            concept_ids: ["pytest"],
            type: "multiple_choice",
            prompt_md: "pytest 中哪个断言会检查结果相等？",
            choices: [
              { id: "a", text: "assert result == expected" },
              { id: "b", text: "print(result)" },
            ],
            estimated_seconds: 60,
          },
        } satisfies DiagnosticResponse;
      }
      throw new Error(`Unexpected fetch: ${path}`);
    });

    const app = await renderApp();
    await waitForText(app.container, "确定起点水平");

    expect(app.container.textContent).toContain("已答 42 题");
    expect(app.container.textContent).toContain("pytest");
    expect(app.container.textContent).toContain("预计还需 1-3 题");
    expect(app.container.textContent).toContain("继续判断学习起点");
    expect(app.container.textContent).not.toContain("测评暂告一段落");
    expect(app.container.textContent).not.toContain("题数上限");
    expect(app.container.textContent).not.toContain("正在加载当前练习");

    app.unmount();
  });

  it("shows technical unavailable copy separately from placement judgement", async () => {
    mockAppFetch((path) => {
      if (path === "/api/sessions") return { session_id: "sess_1", stream_url: "/api/sessions/sess_1/events" };
      if (path === "/api/sessions/sess_1/snapshot") return emptySnapshot();
      if (path === "/api/progress/me") {
        return progressResponse({
          completed: false,
          diagnostic: {
            ...diagnosticProgress(),
            answered: 4,
            estimated_remaining_min: 1,
            estimated_remaining_max: 3,
            diagnostic_status: "technical_unavailable",
            completed: false,
          },
        });
      }
      if (path === "/api/diagnostics/next") {
        return {
          diagnostic_id: "diag_first_use",
          completed: false,
          progress: {
            ...diagnosticProgress(),
            answered: 4,
            estimated_remaining_min: 1,
            estimated_remaining_max: 3,
            diagnostic_status: "technical_unavailable",
          },
        } satisfies DiagnosticResponse;
      }
      throw new Error(`Unexpected fetch: ${path}`);
    });

    const app = await renderApp();
    await waitForText(app.container, "测评题暂时无法生成");

    expect(app.container.textContent).toContain("这是技术状态，不是学习起点判断");
    expect(app.container.textContent).not.toContain("暂未确认");
    expect(app.container.textContent).not.toContain("题数上限");

    app.unmount();
  });

  it("refreshes progress after diagnostic submission without requesting the next exercise", async () => {
    let diagnosticRequests = 0;
    let progressRequests = 0;
    const calls = mockAppFetch((path) => {
      if (path === "/api/sessions") return { session_id: "sess_1", stream_url: "/api/sessions/sess_1/events" };
      if (path === "/api/sessions/sess_1/snapshot") return emptySnapshot();
      if (path === "/api/progress/me") {
        progressRequests += 1;
        return progressResponse({
          completed: progressRequests > 1,
          currentLevel: progressRequests > 1 ? "初级" : "未诊断",
          currentGoal: progressRequests > 1 ? "巩固：条件" : null,
          weakConcepts: progressRequests > 1 ? [{ concept_id: "condition", name: "条件", reason: "建议先复习分支判断。" }] : [],
        });
      }
      if (path === "/api/diagnostics/next") {
        diagnosticRequests += 1;
        return diagnosticRequests > 1 ? completedDiagnosticResponse() : activeDiagnosticResponse();
      }
      if (path === "/api/diagnostics/diag_first_use/answers") return { accepted: true, completed: true, next_question_url: "/api/diagnostics/next" };
      if (path.startsWith("/api/exercises/next")) throw new Error("Exercise generation should not be requested automatically");
      throw new Error(`Unexpected fetch: ${path}`);
    });

    const app = await renderApp();
    await waitForText(app.container, "确定起点水平");
    clickButton(app.container, "A");
    clickButton(app.container, "提交测评");
    await waitForText(app.container, "测评反馈");

    expect(app.container.textContent).toContain("测评表现");
    expect(app.container.textContent).toContain("条件判断");
    expect(app.container.textContent).toContain("开始导师指导");
    expect(calls.filter((call) => call.path === "/api/progress/me")).toHaveLength(2);
    expect(calls.some((call) => call.path.startsWith("/api/exercises/next"))).toBe(false);

    app.unmount();
  });

  it("keeps tutor concept guidance text out of the structured exercise frame", async () => {
    mockAppFetch((path) => {
      if (path === "/api/sessions") return { session_id: "sess_1", stream_url: "/api/sessions/sess_1/events" };
      if (path === "/api/sessions/sess_1/snapshot") return snapshotWithAssistant("for 循环会重复执行一段代码。请写一个循环打印 1 到 3。");
      if (path === "/api/progress/me") return progressResponse({ completed: true });
      if (path === "/api/diagnostics/next") return completedDiagnosticResponse();
      throw new Error(`Unexpected fetch: ${path}`);
    });

    const app = await renderApp();
    await waitForText(app.container, "请写一个循环打印 1 到 3");

    expect(app.container.querySelector(".exercise-card")).toBeNull();
    expect(app.container.querySelector(".code-editor-mount")).toBeNull();

    app.unmount();
  });

  it("renders guidance loop phase below the owning tutor turn", async () => {
    mockAppFetch((path) => {
      if (path === "/api/sessions") return { session_id: "sess_1", stream_url: "/api/sessions/sess_1/events" };
      if (path === "/api/sessions/sess_1/snapshot") {
        return {
          ...emptySnapshot(),
          turns: [{
            turn_id: "turn_guidance",
            status: "done",
            user_message: { text: "继续" },
            assistant_messages: [{ message_id: "msg_guidance", text: "请在练习卡片里提交一次尝试。" }],
            tool_summaries: [],
            annotations: {
              tutor_actions: [{
                action_id: "ta_action_1",
                action_kind: "request_structured_practice",
                concept_id: "string",
                validation_status: "accepted",
                validation_code: "accepted",
              }],
              guidance_loop_state: {
                schema_version: "guidance_loop_state.v1",
                current_concept_id: "string",
                phase: "active_practice",
                latest_guided_answer_judgement: "understood",
                judgement_confidence: 0.86,
                explanation_count: 1,
                guided_question_count: 1,
                active_practice: true,
                active_exercise_id: "gex_1",
                latest_practice_result: null,
                auto_practice_allowed: false,
                auto_practice_mode: null,
                blocked_reasons: ["active_practice"],
              },
            },
          }],
          tutor_agent_state: {
            state_id: "ta_state_1",
            status: "active",
            current_concept_id: "string",
            catalog_version: "kb-test",
          },
          guidance_loop_state: {
            schema_version: "guidance_loop_state.v1",
            current_concept_id: "string",
            phase: "active_practice",
            latest_guided_answer_judgement: "understood",
            judgement_confidence: 0.86,
            explanation_count: 1,
            guided_question_count: 1,
            active_practice: true,
            active_exercise_id: "gex_1",
            latest_practice_result: null,
            auto_practice_allowed: false,
            auto_practice_mode: null,
            blocked_reasons: ["active_practice"],
          },
          recent_tutor_agent_actions: [{
            action_id: "ta_action_1",
            action_kind: "request_structured_practice",
            concept_id: "string",
            validation_status: "accepted",
            validation_code: "accepted",
          }],
        } satisfies SessionSnapshotResponse;
      }
      if (path === "/api/progress/me") return progressResponse({ completed: true });
      if (path === "/api/diagnostics/next") return completedDiagnosticResponse();
      throw new Error(`Unexpected fetch: ${path}`);
    });

    const app = await renderApp();
    await waitForText(app.container, "练习中");

    const assistantMessage = Array.from(app.container.querySelectorAll(".message.assistant"))
      .find((item) => item.textContent?.includes("请在练习卡片里提交一次尝试"));
    const evidencePanel = app.container.querySelector(".turn-evidence");
    expect(app.container.textContent).toContain("字符串");
    expect(app.container.textContent).toContain("结构化练习");
    expect((assistantMessage?.compareDocumentPosition(evidencePanel as Node) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    app.unmount();
  });

  it("restores active-practice exercise after existing chat messages near the composer", async () => {
    mockAppFetch((path) => {
      if (path === "/api/sessions") return { session_id: "sess_1", stream_url: "/api/sessions/sess_1/events" };
      if (path === "/api/sessions/sess_1/snapshot") {
        return activePracticeSnapshotWithMessages();
      }
      if (path === "/api/progress/me") return progressResponse({ completed: true });
      if (path === "/api/diagnostics/next") return completedDiagnosticResponse();
      throw new Error(`Unexpected fetch: ${path}`);
    });

    const app = await renderApp();
    await waitForText(app.container, "继续啊");

    const latestMessage = Array.from(app.container.querySelectorAll(".message"))
      .find((item) => item.textContent?.includes("继续啊"));
    const exerciseCard = app.container.querySelector(".exercise-card");
    const composer = app.container.querySelector(".composer");

    expect(app.container.textContent).toContain("练习中");
    expect(app.container.textContent).toContain("Loop fixture");
    expect(app.container.textContent).toContain("提交后由导师评阅");
    expect(app.container.querySelector(".submit-exercise")?.textContent).toBe("提交练习");
    expect(latestMessage?.compareDocumentPosition(exerciseCard as Node) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(exerciseCard?.compareDocumentPosition(composer as Node) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    app.unmount();
  });

  it("submits agentic practice as a real message turn instead of calling pre-grading", async () => {
    const calls = mockAppFetch((path, init) => {
      if (path === "/api/sessions") return { session_id: "sess_1", stream_url: "/api/sessions/sess_1/events" };
      if (path === "/api/sessions/sess_1/snapshot") return activePracticeSnapshotWithMessages();
      if (path === "/api/progress/me") return progressResponse({ completed: true });
      if (path === "/api/diagnostics/next") return completedDiagnosticResponse();
      if (path === "/api/sessions/sess_1/messages") return { accepted: true, turn_id: "turn_submit" };
      throw new Error(`Unexpected fetch: ${path}`);
    });

    const app = await renderApp();
    await waitForText(app.container, "Loop fixture");

    await act(async () => {
      (app.container.querySelector(".submit-exercise") as HTMLButtonElement).click();
      await Promise.resolve();
    });

    const exerciseSubmitCall = calls.find((call) => call.path.includes("/api/exercises/") && call.path.endsWith("/submissions"));
    const messageCall = calls.find((call) => call.path === "/api/sessions/sess_1/messages" && call.init?.method === "POST");
    const body = JSON.parse(String(messageCall?.init?.body ?? "{}"));

    expect(exerciseSubmitCall).toBeUndefined();
    expect(body.message).toContain("```python");
    expect(body.message).not.toContain("提交状态：passed");
    expect(body.practice_submission).toMatchObject({
      kind: "practice_submission",
      practice_contract_id: "pc_loop",
    });

    app.unmount();
  });

  it("renders agent review evidence below the practice review turn", async () => {
    mockAppFetch((path) => {
      if (path === "/api/sessions") return { session_id: "sess_1", stream_url: "/api/sessions/sess_1/events" };
      if (path === "/api/sessions/sess_1/snapshot") {
        const snapshot = activePracticeSnapshotWithMessages();
        return {
          ...snapshot,
          turns: [
            ...snapshot.turns,
            {
              turn_id: "turn_review",
              status: "done",
              user_message: { text: "提交练习：Loop fixture\n\n```python\nfor i in range(3)\n```" },
              assistant_messages: [{ message_id: "msg_review", text: "我已把你的代码作为本次练习提交来评阅。" }],
              tool_summaries: [{ tool_call_id: "tool_run", tool_name: "run_student_code", ok: true, code: "allowed_failure", summary: "SyntaxError on line 1" }],
              annotations: {
                tutor_actions: [],
                practice_review: {
                  id: "apr_1",
                  practice_contract_id: "pc_loop",
                  review_status: "needs_revision",
                  confidence: "medium",
                  evidence_refs: [{ tool_name: "run_student_code", result_code: "allowed_failure", summary: "SyntaxError on line 1" }],
                  learner_facing_summary: "先修正语法错误。",
                  progress_effect: "not_recorded",
                },
              },
            },
          ],
          latest_agent_practice_review: {
            id: "apr_1",
            practice_contract_id: "pc_loop",
            review_status: "needs_revision",
            confidence: "medium",
            evidence_refs: [{ tool_name: "run_student_code", result_code: "allowed_failure", summary: "SyntaxError on line 1" }],
            learner_facing_summary: "先修正语法错误。",
            progress_effect: "not_recorded",
          },
        } satisfies SessionSnapshotResponse;
      }
      if (path === "/api/progress/me") return progressResponse({ completed: true });
      if (path === "/api/diagnostics/next") return completedDiagnosticResponse();
      throw new Error(`Unexpected fetch: ${path}`);
    });

    const app = await renderApp();
    await waitForText(app.container, "run_student_code");

    const reviewMessage = Array.from(app.container.querySelectorAll(".message.assistant"))
      .find((item) => item.textContent?.includes("我已把你的代码作为本次练习提交来评阅"));
    const evidencePanel = Array.from(app.container.querySelectorAll(".turn-evidence"))
      .find((item) => item.textContent?.includes("评阅结果 需要修改"));
    expect(app.container.textContent).toContain("评阅结果 需要修改");
    expect(app.container.textContent).toContain("SyntaxError on line 1");
    expect(app.container.textContent).toContain("概念证据 未记录");
    expect((reviewMessage?.compareDocumentPosition(evidencePanel as Node) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    app.unmount();
  });

  it("distinguishes recorded concept evidence from aggregate course progress", async () => {
    mockAppFetch((path) => {
      if (path === "/api/sessions") return { session_id: "sess_1", stream_url: "/api/sessions/sess_1/events" };
      if (path === "/api/sessions/sess_1/snapshot") {
        const snapshot = activePracticeSnapshotWithMessages();
        return {
          ...snapshot,
          turns: [
            ...snapshot.turns,
            {
              turn_id: "turn_passed",
              status: "done",
              user_message: { text: "提交练习：Loop fixture\n\n```python\nfor i in range(3):\n    print(i)\n```" },
              assistant_messages: [{ message_id: "msg_passed", text: "我已把你的代码作为本次练习提交来评阅。" }],
              tool_summaries: [{ tool_call_id: "tool_run", tool_name: "run_student_code", ok: true, code: "allowed_success", summary: "status=passed; stdout=2 4" }],
              annotations: {
                tutor_actions: [],
                practice_review: {
                  id: "apr_passed",
                  practice_contract_id: "pc_loop",
                  review_status: "passed",
                  confidence: "high",
                  evidence_refs: [{ tool_name: "run_student_code", result_code: "allowed_success", summary: "status=passed; stdout=2 4" }],
                  learner_facing_summary: "代码可以运行。",
                  progress_effect: "recorded",
                  recent_progress_evidence_id: "apr_passed",
                  recorded_concept_ids: ["loop"],
                },
                progress_evidence: {
                  source_type: "tutor_review",
                  source_id: "apr_passed",
                  evidence_ids: ["evid_passed"],
                  review_id: "apr_passed",
                  practice_contract_id: "pc_loop",
                  concept_ids: ["loop"],
                  concepts: [{ concept_id: "loop", label: "循环结构" }],
                  progress_effect: "recorded",
                  review_status: "passed",
                  confidence: "high",
                  outcome: "completed_independently",
                  score: 100,
                  evidence_refs: [{ tool_name: "run_student_code", result_code: "allowed_success", summary: "status=passed; stdout=2 4" }],
                  reason: "progress evidence recorded",
                  created_at: "2026-05-18T18:04:30.135Z",
                },
              },
            },
          ],
          latest_agent_practice_review: {
            id: "apr_passed",
            practice_contract_id: "pc_loop",
            review_status: "passed",
            confidence: "high",
            evidence_refs: [{ tool_name: "run_student_code", result_code: "allowed_success", summary: "status=passed; stdout=2 4" }],
            learner_facing_summary: "代码可以运行。",
            progress_effect: "recorded",
            recent_progress_evidence_id: "apr_passed",
            recorded_concept_ids: ["loop"],
          },
        } satisfies SessionSnapshotResponse;
      }
      if (path === "/api/progress/me") {
        return progressResponse({
          completed: true,
          courseProgressPercent: 0,
          recentProgressEvidence: {
            source_type: "tutor_review",
            source_id: "apr_passed",
            evidence_ids: ["evid_passed"],
            review_id: "apr_passed",
            practice_contract_id: "pc_loop",
            concept_ids: ["loop"],
            concepts: [{ concept_id: "loop", label: "循环结构" }],
            progress_effect: "recorded",
            review_status: "passed",
            confidence: "high",
            outcome: "completed_independently",
            score: 100,
            evidence_refs: [{ tool_name: "run_student_code", result_code: "allowed_success", summary: "status=passed; stdout=2 4" }],
            reason: "progress evidence recorded",
            created_at: "2026-05-18T18:04:30.135Z",
          },
        });
      }
      if (path === "/api/diagnostics/next") return completedDiagnosticResponse();
      throw new Error(`Unexpected fetch: ${path}`);
    });

    const app = await renderApp();
    await waitForText(app.container, "概念证据 已记录：循环结构");

    expect(app.container.textContent).toContain("课程总进度 0%");
    expect(app.container.textContent).toContain("评阅结果 通过");
    expect(app.container.textContent).toContain("概念证据 已记录");
    expect(app.container.textContent).not.toContain("进度 已记录");

    app.unmount();
  });
});

function mockAppFetch(handler: (path: string, init?: RequestInit) => unknown): FetchCall[] {
  const calls: FetchCall[] = [];
  vi.stubGlobal("EventSource", MockEventSource);
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = typeof input === "string" ? input : input instanceof URL ? input.pathname + input.search : input.url;
    calls.push({ path, init });
    const body = handler(path, init);
    return {
      ok: true,
      statusText: "OK",
      json: async () => body,
    };
  }));
  return calls;
}

async function renderApp(): Promise<{ container: HTMLElement; unmount: () => void }> {
  const container = document.createElement("div");
  document.body.append(container);
  let root: Root | undefined;
  await act(async () => {
    root = createRoot(container);
    root.render(createElement(App));
  });
  return {
    container,
    unmount: () => root?.unmount(),
  };
}

async function waitForText(container: HTMLElement, text: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (container.textContent?.includes(text)) return;
    await act(async () => {
      await Promise.resolve();
    });
  }
  throw new Error(`Expected rendered text: ${text}\nActual: ${container.textContent ?? ""}`);
}

function clickButton(container: HTMLElement, text: string): void {
  const button = Array.from(container.querySelectorAll("button"))
    .find((item) => item.textContent?.includes(text));
  if (!button) {
    throw new Error(`Button not found: ${text}`);
  }
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function emptySnapshot(): SessionSnapshotResponse {
  return {
    session_id: "sess_1",
    last_event_id: null,
    turns: [],
    active_exercise: null,
    active_project_step: null,
  };
}

function snapshotWithAssistant(text: string): SessionSnapshotResponse {
  return {
    session_id: "sess_1",
    last_event_id: "1",
    turns: [{
      turn_id: "turn_1",
      status: "completed",
      user_message: { text: "" },
      assistant_messages: [{ message_id: "msg_1", text }],
      tool_summaries: [],
    }],
    active_exercise: null,
    active_project_step: null,
  };
}

function activePracticeSnapshotWithMessages(): SessionSnapshotResponse {
  return {
    session_id: "sess_1",
    last_event_id: "2",
    turns: [
      {
        turn_id: "turn_1",
        status: "done",
        user_message: { text: "好" },
        assistant_messages: [{ message_id: "msg_1", text: "已为你准备一道结构化练习。" }],
        tool_summaries: [],
      },
      {
        turn_id: "turn_2",
        status: "done",
        user_message: { text: "继续啊" },
        assistant_messages: [{ message_id: "msg_2", text: "请在练习卡片里提交一次尝试。" }],
        tool_summaries: [],
        annotations: {
          tutor_actions: [{
            action_id: "ta_action_1",
            action_kind: "explain_status",
            concept_id: "loop",
            validation_status: "accepted",
            validation_code: "accepted",
          }],
          guidance_loop_state: {
            schema_version: "guidance_loop_state.v1",
            current_concept_id: "loop",
            phase: "active_practice",
            latest_guided_answer_judgement: "understood",
            judgement_confidence: 0.86,
            explanation_count: 1,
            guided_question_count: 1,
            active_practice: true,
            active_exercise_id: "gex_loop",
            latest_practice_result: null,
            auto_practice_allowed: false,
            auto_practice_mode: null,
            blocked_reasons: ["active_practice"],
          },
        },
      },
    ],
      active_exercise: readyPracticeOutcome().exercise,
      active_practice_outcome: readyPracticeOutcome(),
    tutor_agent_state: {
      state_id: "ta_state_1",
      status: "active",
      current_concept_id: "loop",
      catalog_version: "kb-test",
    },
    guidance_loop_state: {
      schema_version: "guidance_loop_state.v1",
      current_concept_id: "loop",
      phase: "active_practice",
      latest_guided_answer_judgement: "understood",
      judgement_confidence: 0.86,
      explanation_count: 1,
      guided_question_count: 1,
      active_practice: true,
      active_exercise_id: "gex_loop",
      latest_practice_result: null,
      auto_practice_allowed: false,
      auto_practice_mode: null,
      blocked_reasons: ["active_practice"],
    },
    recent_tutor_agent_actions: [{
      action_id: "ta_action_1",
      action_kind: "explain_status",
      concept_id: "loop",
      validation_status: "accepted",
      validation_code: "accepted",
    }],
    active_project_step: null,
  };
}

function progressResponse(options: {
  completed: boolean;
  currentLevel?: string;
  currentGoal?: string | null;
  courseProgressPercent?: number;
  recentProgressEvidence?: ProgressResponse["recent_progress_evidence"];
  weakConcepts?: ProgressResponse["weak_concepts"];
  diagnostic?: ProgressResponse["diagnostic"];
  diagnosticFeedback?: ProgressResponse["diagnostic_feedback"];
  progressDecision?: Partial<ProgressResponse["progress_decision"]>;
}): ProgressResponse {
  return {
    profile_summary: options.completed ? "Python 课程学习者，已完成初始测评。" : "Python 课程学习者。",
    current_level: options.currentLevel ?? (options.completed ? "初级" : "未诊断"),
    current_goal: options.currentGoal ?? null,
    course_progress_percent: options.courseProgressPercent ?? (options.completed ? 12 : 0),
    recent_progress_evidence: options.recentProgressEvidence ?? null,
    current_chapter_id: options.completed ? "introduction" : "diagnostic",
    current_chapter_title: options.completed ? "入门与基础" : "初始测评",
    diagnostic: options.diagnostic ?? {
      ...diagnosticProgress(),
      completed: options.completed,
    },
    diagnostic_feedback: options.diagnosticFeedback !== undefined
      ? options.diagnosticFeedback
      : options.completed
        ? {
          performance_summary: "基础表达式判断较稳定。",
          mastery_summary: "已具备入门语法基础。",
          learning_start: "条件判断",
        }
        : null,
    curriculum: [
      { id: "introduction", title: "入门与基础", concept_ids: ["condition", "loop"], mastery_percent: options.completed ? 35 : 0, status: options.completed ? "current" : "upcoming" },
      { id: "working-with-data", title: "数据处理", concept_ids: ["list"], mastery_percent: 0, status: "upcoming" },
    ],
    mastery: [],
    weak_concepts: options.weakConcepts ?? [],
    recommendations: [],
    progress_decision: {
      schema_version: "learning_progress_decision.v1",
      diagnostic_state: options.completed ? "completed" : "active",
      handoff_state: options.completed ? "feedback_ready" : "not_ready",
      practice_state: options.completed ? "guidance_first" : "locked_by_diagnostic",
      reasons: [],
      current_level: options.currentLevel ?? (options.completed ? "初级" : null),
      current_goal: options.currentGoal ?? null,
      learning_start: options.completed ? { concept_id: "condition", label: "条件判断" } : null,
      current_unit: {
        id: options.completed ? "introduction" : "diagnostic",
        title: options.completed ? "入门与基础" : "初始测评",
        kind: options.completed ? "catalog" : "diagnostic",
        concept_ids: options.completed ? ["condition", "loop"] : [],
        reason: options.completed ? "active_diagnostic" : "active",
      },
      course_progress_percent: options.courseProgressPercent ?? (options.completed ? 12 : 0),
      recent_progress_evidence: options.recentProgressEvidence ?? null,
      diagnostic_focus: [],
      recommendation_focus: [],
      diagnostic_feedback: options.diagnosticFeedback === undefined ? null : options.diagnosticFeedback,
      provenance: {},
      ...options.progressDecision,
    },
  };
}

function readyPracticeOutcome(): Extract<PracticeOutcome, { kind: "exercise_ready" }> {
  return {
    schema_version: "practice_outcome.v1",
    kind: "exercise_ready",
    message: "已为你准备一道结构化练习。",
    next_step: "下一步在练习卡片里完成代码后提交。",
    target: { concept_ids: ["loop"], difficulty: 2, provenance: ["explicit_request"] },
    evidence: { result_code: "allowed_success" },
    exercise: {
      id: "pc_loop",
      title: "Loop fixture",
      difficulty: 2,
      concept_ids: ["loop"],
      prompt_md: "写一个循环。",
      samples: [],
      hint_level: 0,
    },
    recommendation_id: "practice:gex_loop",
  };
}

function activeDiagnosticResponse(promptMd = "下面哪个表达式会得到 True？"): DiagnosticResponse {
  return {
    diagnostic_id: "diag_first_use",
    completed: false,
    progress: diagnosticProgress(),
    question: {
      id: "diag_q_1",
      concept_ids: ["condition"],
      type: "multiple_choice",
      prompt_md: promptMd,
      choices: [
        { id: "a", text: "1 < 2" },
        { id: "b", text: "1 > 2" },
      ],
      estimated_seconds: 60,
    },
  };
}

function completedDiagnosticResponse(): DiagnosticResponse {
  return {
    diagnostic_id: "diag_first_use",
    completed: true,
    progress: diagnosticProgress(),
  };
}

function diagnosticProgress(): DiagnosticResponse["progress"] {
  return {
    answered: 6,
    total: 18,
    effective_answered: 6,
    min_questions: 3,
    min_effective_answers: 3,
    soft_cap: 9,
    hard_cap: 18,
    estimated_remaining_min: 0,
    estimated_remaining_max: 0,
    current_focus_concept_ids: ["condition"],
    completion_confidence: 0.82,
    placement_confidence: 0.82,
    leading_start_concept_id: "condition",
    leading_start_label: "条件判断",
    runner_up_start_concept_id: "loop",
    confidence_margin: 0.24,
    current_focus_boundary_ids: ["condition->loop"],
    diagnostic_status: "active",
  };
}
