import { expect, test } from "@playwright/test";

const diagnosticProgress = {
  answered: 0,
  total: 5,
  effective_answered: 0,
  min_questions: 3,
  min_effective_answers: 3,
  soft_cap: 5,
  hard_cap: 8,
  estimated_remaining_min: 3,
  estimated_remaining_max: 5,
  current_focus_concept_ids: [],
  completion_confidence: 0,
  placement_confidence: 0,
  leading_start_concept_id: null,
  leading_start_label: null,
  runner_up_start_concept_id: null,
  confidence_margin: 0,
  current_focus_boundary_ids: [],
  diagnostic_status: "active",
};

test("intro message keeps readable line width at the review viewport", async ({ page }) => {
  await page.route("**/api/sessions", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ session_id: "layout-session", stream_url: "/api/sessions/layout-session/events" }),
    });
  });
  await page.route("**/api/sessions/layout-session/snapshot", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        session_id: "layout-session",
        last_event_id: null,
        turns: [],
        active_exercise: null,
        active_project_step: null,
      }),
    });
  });
  await page.route("**/api/sessions/layout-session/events", async (route) => {
    await route.fulfill({
      contentType: "text/event-stream",
      body: "",
    });
  });
  await page.route("**/api/progress/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        profile_summary: "",
        current_level: "",
        current_goal: null,
        course_progress_percent: 0,
        current_chapter_id: "intro",
        current_chapter_title: "入门",
        diagnostic: { ...diagnosticProgress, completed: false },
        diagnostic_feedback: null,
        curriculum: [],
        mastery: [],
        weak_concepts: [],
        recommendations: [],
      }),
    });
  });
  await page.route("**/api/diagnostics/next", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        diagnostic_id: "diagnostic-layout",
        completed: false,
        progress: diagnosticProgress,
      }),
    });
  });

  await page.setViewportSize({ width: 627, height: 694 });
  await page.goto("/");

  const introMessage = page.locator("section.conversation-column article.message.assistant").first();
  await expect(introMessage.getByText("先完成初始测评来确定起点水平，然后查看学习起点和下一步建议。")).toBeVisible();

  const metrics = await introMessage.locator(".markdown-content").evaluate((markdown) => {
    const paragraph = markdown.querySelector("p");
    const markdownRect = markdown.getBoundingClientRect();
    const paragraphRect = paragraph?.getBoundingClientRect();
    return {
      markdownWidth: markdownRect.width,
      paragraphWidth: paragraphRect?.width ?? 0,
    };
  });

  expect(metrics.markdownWidth).toBeGreaterThan(300);
  expect(metrics.paragraphWidth).toBeGreaterThan(metrics.markdownWidth * 0.75);
  await expect(page.locator(".diagnostic-card.diagnostic-note")).toHaveCount(0);
  await expect(page.getByText("测评进行中")).toHaveCount(0);
  await expect(page.getByText("先确定学习起点", { exact: true })).toHaveCount(0);
});

test("active initial diagnostic does not show the diagnostic gate notice", async ({ page }) => {
  await page.route("**/api/sessions", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ session_id: "diagnostic-session", stream_url: "/api/sessions/diagnostic-session/events" }),
    });
  });
  await page.route("**/api/sessions/diagnostic-session/snapshot", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        session_id: "diagnostic-session",
        last_event_id: null,
        turns: [],
        active_exercise: null,
        active_project_step: null,
      }),
    });
  });
  await page.route("**/api/sessions/diagnostic-session/events", async (route) => {
    await route.fulfill({
      contentType: "text/event-stream",
      body: "",
    });
  });
  await page.route("**/api/progress/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        profile_summary: "",
        current_level: "",
        current_goal: null,
        course_progress_percent: 0,
        current_chapter_id: "intro",
        current_chapter_title: "入门",
        diagnostic: { ...diagnosticProgress, completed: false },
        diagnostic_feedback: null,
        curriculum: [],
        mastery: [],
        weak_concepts: [],
        recommendations: [],
      }),
    });
  });
  await page.route("**/api/diagnostics/next", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        diagnostic_id: "diagnostic-active",
        completed: false,
        progress: diagnosticProgress,
        question: {
          id: "question-1",
          concept_ids: ["dict"],
          type: "multiple_choice",
          prompt_md: "以下代码执行后，变量 `d` 的内容是什么？",
          choices: [
            { id: "a", text: "{'name': 'Alice', 'age': 20}" },
            { id: "b", text: "{'name': 'Alice', 'age': 21, 'city': 'Beijing'}" },
            { id: "c", text: "{'name': 'Alice', 'city': 'Beijing'}" },
          ],
          estimated_seconds: 45,
        },
      }),
    });
  });

  await page.setViewportSize({ width: 1044, height: 694 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "确定起点水平" })).toBeVisible();
  await expect(page.getByRole("button", { name: "提交测评" })).toBeVisible();
  await expect(page.locator(".diagnostic-card.diagnostic-note")).toHaveCount(0);
  await expect(page.locator(".diagnostic-card.loading-card")).toHaveCount(0);
  await expect(page.getByText("正在整理学习状态...")).toHaveCount(0);
  await expect(page.getByText("测评进行中")).toHaveCount(0);
  await expect(page.getByText("先确定学习起点", { exact: true })).toHaveCount(0);
});
