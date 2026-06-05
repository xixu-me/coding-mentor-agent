from pathlib import Path
import os

from playwright.sync_api import sync_playwright, expect

BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:3000").rstrip("/")


def run_core_flow(page, *, take_screenshot=False):
    errors = []
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    page.goto(BASE_URL)
    page.wait_for_load_state("domcontentloaded")
    page.wait_for_selector("text=Python 课程伴学智能体")
    expect(page.get_by_text("Python 课程伴学智能体")).to_be_visible()
    expect(page.get_by_text("课程总进度", exact=False)).to_be_visible()
    progress_status = page.locator(".progress-status")
    expect(progress_status.get_by_text("课程总进度 待测评", exact=False)).to_be_visible()
    expect(progress_status.get_by_text("起点", exact=False)).to_be_visible()
    expect(progress_status.get_by_text("当前 初始测评", exact=False)).to_be_visible()
    expect(page.locator(".chapter-strip")).to_be_visible(timeout=15000)
    expect(page.locator(".chapter-chip")).to_have_count(9)
    expect(page.locator(".chapter-chip", has_text="入门与基础")).to_be_visible()
    expect(page.locator(".chapter-chip", has_text="数据处理")).to_be_visible()
    expect(page.get_by_role("heading", name="确定起点水平")).to_be_visible()
    expect(page.get_by_role("button", name="提交测评")).to_be_visible()
    expect(page.locator(".diagnostic-card.diagnostic-note")).to_have_count(0)
    expect(page.locator(".diagnostic-card.loading-card")).to_have_count(0)
    expect(page.get_by_text("正在整理学习状态...")).to_have_count(0)
    expect(page.get_by_text("测评进行中")).to_have_count(0)
    expect(page.get_by_text("先确定学习起点", exact=True)).to_have_count(0)
    expect(page.get_by_text("完成初始测评后生成当前练习。", exact=True)).to_have_count(0)
    expect(page.locator(".exercise-card .editor-host")).to_have_count(0)
    expect(page.get_by_role("button", name="提交练习")).to_have_count(0)
    expect(page.get_by_role("button", name="运行代码")).to_have_count(0)
    expect(page.get_by_text("代码工作区")).to_have_count(0)
    expect(page.get_by_label("向导师提问或说明你的思路")).to_be_visible()
    if take_screenshot:
        Path(".app").mkdir(exist_ok=True)
        page.screenshot(path=".app/playwright-smoke-desktop.png", full_page=True)
    if errors:
        raise AssertionError("\n".join(errors))


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    run_core_flow(page)
    page.close()

    browser.close()
