import json
import re
from pathlib import Path


KB_ROOT = Path(__file__).resolve().parents[1]
WIKI_ROOT = KB_ROOT / "wiki"
PRIVATE_ROOT = KB_ROOT / "private"
RAW_ROOT = KB_ROOT / "raw"
CONFIG_PATH = KB_ROOT / ".openkb" / "config.yaml"

WIKILINK_RE = re.compile(r"\[\[([^\]]+)\]\]")
TODO_RE = re.compile(r"\b(TODO|FIXME|TBD)\b", re.IGNORECASE)
XXX_RE = re.compile(r"(?<!\.)\bXXX\b")
PROMPT_INJECTION_RE = re.compile(
    r"(ignore previous instructions|disregard previous instructions|reveal the system prompt)",
    re.IGNORECASE,
)

VISIBLE_FORBIDDEN_PATTERNS = (
    "../private",
    "private/solutions",
    ".openkb",
    "wiki/AGENTS",
    "wiki/log",
    "student_visible_solution: true",
    "ADD_YOUR_API_KEY_HERE",
)

SUPPORTED_OPENKB_CONFIG_KEYS = {
    "api_base",
    "language",
    "model",
    "openai_base_url",
    "pageindex_threshold",
    "source_commit",
    "source_repo",
}

REMOVED_CONCEPT_ALIAS_TARGETS = {
    "concepts/CSV 数据处理",
    "concepts/main 函数与脚本结构",
    "concepts/模块与 import",
    "concepts/测试、日志与调试",
}

REQUIRED_ENHANCEMENT_CONCEPTS = {
    "concepts/Python-参数传递",
    "concepts/变量绑定",
    "concepts/数据清洗与类型转换",
    "concepts/Python-真值测试",
    "concepts/现代-Python-打包实践",
    "concepts/Python-项目组织",
    "concepts/Python-导入缓存",
    "concepts/文件类对象",
    "concepts/Python-网络请求",
    "concepts/XML-解析",
    "concepts/标准输入输出与管道",
    "concepts/pip-与-PyPI",
    "concepts/site-packages",
    "concepts/Python-包结构",
    "concepts/可变性与引用",
    "concepts/软件测试",
    "concepts/Python-自省",
}

OVERLAP_SCOPE_PAGES = {
    "concepts/变量与数据类型.md",
    "concepts/Python-对象模型.md",
    "concepts/Python-可变对象.md",
    "concepts/Python-不可变对象.md",
    "concepts/Python-拷贝语义.md",
    "concepts/浅拷贝与深拷贝.md",
    "concepts/包与虚拟环境.md",
    "concepts/依赖管理.md",
    "concepts/代码分发.md",
    "concepts/可变性与引用.md",
}


def wiki_markdown_files() -> list[Path]:
    files = []
    for path in WIKI_ROOT.rglob("*.md"):
        rel = path.relative_to(WIKI_ROOT)
        if rel.name in {"AGENTS.md", "log.md"}:
            continue
        if rel.parts and rel.parts[0] == "reports":
            continue
        files.append(path)
    return sorted(files)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def rel(path: Path) -> str:
    return path.relative_to(KB_ROOT).as_posix()


def frontmatter_value(text: str, key: str) -> str | None:
    lines = text.splitlines()
    if not lines or lines[0] != "---":
        return None
    for line in lines[1:]:
        if line == "---":
            return None
        if line.startswith(f"{key}:"):
            value = line.split(":", 1)[1].strip()
            return value.strip("\"'")
    return None


def extract_wikilink_target(raw: str) -> str:
    target = raw.split("|", 1)[0].split("#", 1)[0].strip().strip("/")
    if target.endswith(".md"):
        target = target[:-3]
    return target


def index_lines_for_section(section_name: str) -> list[str]:
    lines = read_text(WIKI_ROOT / "index.md").splitlines()
    header = f"## {section_name}"
    try:
        start = lines.index(header) + 1
    except ValueError:
        return []

    section = []
    for line in lines[start:]:
        if line.startswith("## "):
            break
        if line.startswith("- "):
            section.append(line)
    return section


def test_visible_wiki_markdown_is_structurally_clean():
    errors = []
    for path in wiki_markdown_files():
        text = read_text(path)
        lines = text.splitlines()

        if not any(line.startswith("# ") for line in lines):
            errors.append(f"{rel(path)} has no H1 heading")

        fence_count = sum(1 for line in lines if line.lstrip().startswith("```"))
        if fence_count % 2:
            errors.append(f"{rel(path)} has an unclosed fenced code block")

        if TODO_RE.search(text) or XXX_RE.search(text):
            errors.append(f"{rel(path)} contains TODO/FIXME/TBD/XXX marker")

    assert errors == []


def test_visible_wiki_wikilinks_resolve_to_explicit_pages():
    pages = {
        path.relative_to(WIKI_ROOT).with_suffix("").as_posix()
        for path in WIKI_ROOT.rglob("*.md")
    }
    errors = []

    for path in wiki_markdown_files():
        text = read_text(path)
        for raw_target in WIKILINK_RE.findall(text):
            target = extract_wikilink_target(raw_target)
            if not target:
                errors.append(f"{rel(path)} has an empty wikilink")
                continue
            if "/" not in target:
                errors.append(f"{rel(path)} uses non-explicit wikilink [[{raw_target}]]")
                continue
            if target not in pages:
                errors.append(f"{rel(path)} has broken wikilink [[{raw_target}]]")
            if target in REMOVED_CONCEPT_ALIAS_TARGETS:
                errors.append(f"{rel(path)} links to removed concept alias [[{raw_target}]]")

    assert errors == []


def test_visible_wiki_does_not_expose_internal_or_prompt_control_content():
    errors = []
    for path in wiki_markdown_files():
        text = read_text(path)
        for pattern in VISIBLE_FORBIDDEN_PATTERNS:
            if pattern in text:
                errors.append(f"{rel(path)} contains forbidden visible pattern: {pattern}")
        if PROMPT_INJECTION_RE.search(text):
            errors.append(f"{rel(path)} contains prompt-control wording")

    assert errors == []


def test_raw_and_visible_wiki_do_not_contain_api_key_placeholder():
    errors = []
    for root in (RAW_ROOT, WIKI_ROOT):
        for path in root.rglob("*"):
            if path.is_file() and path.suffix.lower() in {".md", ".yaml", ".yml", ".json", ".txt"}:
                if "ADD_YOUR_API_KEY_HERE" in read_text(path):
                    errors.append(f"{rel(path)} contains ADD_YOUR_API_KEY_HERE")

    assert errors == []


def test_private_solution_map_matches_non_visible_exercises():
    map_path = PRIVATE_ROOT / "exercise-solutions-map.json"
    solution_map = json.loads(read_text(map_path))
    exercise_ids = {}
    errors = []

    for path in sorted((WIKI_ROOT / "exercises").glob("*.md")):
        text = read_text(path)
        exercise_id = frontmatter_value(text, "id")
        if exercise_id:
            exercise_ids[exercise_id] = path

        has_private_solution = frontmatter_value(text, "has_private_solution") == "true"
        visible_solution = frontmatter_value(text, "student_visible_solution") == "true"

        if has_private_solution and not exercise_id:
            errors.append(f"{rel(path)} has a private solution but no exercise id")
        if has_private_solution and exercise_id not in solution_map:
            errors.append(f"{rel(path)} has no private solution map entry")
        if has_private_solution and visible_solution:
            errors.append(f"{rel(path)} exposes a private solution")

    for exercise_id, solution_rel in solution_map.items():
        if exercise_id not in exercise_ids:
            errors.append(f"private/exercise-solutions-map.json maps missing exercise {exercise_id}")
        solution_path = Path(solution_rel)
        if solution_path.is_absolute() or ".." in solution_path.parts:
            errors.append(f"private/exercise-solutions-map.json has unsafe path for {exercise_id}")
            continue
        if not solution_rel.startswith("solutions/"):
            errors.append(f"private/exercise-solutions-map.json maps {exercise_id} outside solutions/")
            continue
        if not (PRIVATE_ROOT / solution_path).exists():
            errors.append(f"private/exercise-solutions-map.json maps {exercise_id} to missing path")

    assert errors == []


def test_openkb_config_uses_supported_keys_without_secrets():
    keys = set()
    text = read_text(CONFIG_PATH)
    errors = []

    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        key = stripped.split(":", 1)[0].strip()
        keys.add(key)

    unknown = keys - SUPPORTED_OPENKB_CONFIG_KEYS
    if unknown:
        errors.append(f".openkb/config.yaml has unsupported keys: {sorted(unknown)}")

    for forbidden in ("api_key", "secret", "token", "password"):
        if forbidden in text.lower():
            errors.append(f".openkb/config.yaml contains secret-like key text: {forbidden}")

    assert errors == []


def test_semantic_lint_known_findings_stay_fixed():
    errors = []
    overview = read_text(WIKI_ROOT / "summaries" / "00_Overview.md")
    index = read_text(WIKI_ROOT / "index.md")

    if "Practical Python Programming 课程总览" not in overview:
        errors.append("summaries/00_Overview.md is not a course overview")
    if "本文是课程第 9 章 **Packages（包）** 的总览页" in overview:
        errors.append("summaries/00_Overview.md still duplicates the Packages overview")

    setup_summary = read_text(WIKI_ROOT / "summaries" / "00_Setup.md")
    if "课程主体不依赖第三方包" not in setup_summary or "pandas" not in setup_summary:
        errors.append("summaries/00_Setup.md does not clarify third-party dependencies")
    if "仍受官方维护的 Python 3.x" not in setup_summary:
        errors.append("summaries/00_Setup.md does not clarify current Python version guidance")

    python_summary = read_text(WIKI_ROOT / "summaries" / "01_Python.md")
    if "原课程材料的历史基线" not in python_summary or "仍受官方维护的 Python 3.x" not in python_summary:
        errors.append("summaries/01_Python.md does not clarify Python 3.6 historical context")
    if "不保证 URL 长期可用" not in python_summary or "本地 XML 示例文件" not in python_summary:
        errors.append("summaries/01_Python.md does not clarify external API example stability")
    if "http://docs.python.org" in python_summary:
        errors.append("summaries/01_Python.md still uses HTTP docs.python.org link")

    if "[[summaries/practical-python-attribution]]" not in overview:
        errors.append("summaries/00_Overview.md does not link attribution")
    if "[[summaries/practical-python-attribution]]" not in index:
        errors.append("index.md does not link attribution")

    distribution_summary = read_text(WIKI_ROOT / "summaries" / "03_Distribution.md")
    code_distribution = read_text(WIKI_ROOT / "concepts" / "代码分发.md")
    packaging_env = read_text(WIKI_ROOT / "concepts" / "包与虚拟环境.md")
    for path, text in [
        ("summaries/03_Distribution.md", distribution_summary),
        ("concepts/代码分发.md", code_distribution),
        ("concepts/包与虚拟环境.md", packaging_env),
    ]:
        if "pyproject.toml" not in text or "python -m build" not in text:
            errors.append(f"{path} does not clarify modern packaging practice")
    if "summaries/00_Overview]] 同样把代码分发列为第 9 章" in code_distribution:
        errors.append("concepts/代码分发.md still treats summaries/00_Overview as Packages overview")

    iteration = read_text(WIKI_ROOT / "concepts" / "迭代协议与生成器.md")
    if "不应在现代 Python 3 新代码中使用" not in iteration:
        errors.append("concepts/迭代协议与生成器.md does not mark Python 2 i* iterator names as historical")
    iteration_summary = read_text(WIKI_ROOT / "summaries" / "01_Iteration_protocol.md")
    if "return sum([s.cost for s in self._holdings])" in iteration_summary:
        errors.append("summaries/01_Iteration_protocol.md still mixes Stock.cost property and method examples")
    special_methods = read_text(WIKI_ROOT / "concepts" / "特殊方法.md")
    if "return sum([s.cost for s in self._holdings])" in special_methods:
        errors.append("concepts/特殊方法.md still mixes Stock.cost property and method examples")
    for path in [
        WIKI_ROOT / "summaries" / "01_Python.md",
        WIKI_ROOT / "concepts" / "Python-开发环境.md",
        WIKI_ROOT / "concepts" / "Python-文档与帮助系统.md",
        WIKI_ROOT / "exercises" / "1-2-getting-help.md",
    ]:
        if "http://docs.python.org" in read_text(path):
            errors.append(f"{rel(path)} still uses HTTP docs.python.org link")

    for target in REMOVED_CONCEPT_ALIAS_TARGETS:
        if (WIKI_ROOT / f"{target}.md").exists():
            errors.append(f"{target}.md should not exist as an empty alias page")
        if f"[[{target}]]" in index:
            errors.append(f"index.md still lists removed alias [[{target}]]")

    for path in [
        WIKI_ROOT / "concepts" / "模块与-import.md",
        WIKI_ROOT / "concepts" / "包与虚拟环境.md",
        WIKI_ROOT / "summaries" / "02_Third_party.md",
    ]:
        if "/usr/local/lib/python3.6" in read_text(path):
            errors.append(f"{rel(path)} still uses version-specific python3.6 paths")

    assert errors == []


def test_followup_enhancements_are_indexed_and_scoped():
    index_text = read_text(WIKI_ROOT / "index.md")
    errors = []

    document_lines = index_lines_for_section("Documents")
    exercise_lines = index_lines_for_section("Exercises")
    concept_lines = index_lines_for_section("Concepts")

    summary_targets = {
        path.relative_to(WIKI_ROOT).with_suffix("").as_posix()
        for path in (WIKI_ROOT / "summaries").glob("*.md")
    }
    indexed_documents = {
        extract_wikilink_target(WIKILINK_RE.search(line).group(1))
        for line in document_lines
        if WIKILINK_RE.search(line)
    }
    if summary_targets != indexed_documents:
        errors.append("index.md Documents section is not synced with summaries/")

    for line in document_lines:
        if " — " not in line or "type:" not in line or "source:" not in line:
            errors.append(f"Document index line lacks metadata: {line}")

    exercise_targets = {
        path.relative_to(WIKI_ROOT).with_suffix("").as_posix()
        for path in (WIKI_ROOT / "exercises").glob("*.md")
    }
    indexed_exercises = {
        extract_wikilink_target(WIKILINK_RE.search(line).group(1))
        for line in exercise_lines
        if WIKILINK_RE.search(line)
    }
    if exercise_targets != indexed_exercises:
        errors.append("index.md Exercises section is not synced with exercises/")

    for line in exercise_lines:
        for field in ("id:", "title:", "section:", "private_solution:", "skip:"):
            if field not in line:
                errors.append(f"Exercise index line lacks {field} metadata: {line}")

    for target in REQUIRED_ENHANCEMENT_CONCEPTS:
        if not (WIKI_ROOT / f"{target}.md").exists():
            errors.append(f"Missing enhancement concept page: {target}")
        if f"[[{target}]]" not in index_text:
            errors.append(f"index.md does not list enhancement concept: {target}")

    for line in concept_lines:
        if " — " not in line:
            errors.append(f"Concept index line lacks one-line brief: {line}")

    for rel_path in OVERLAP_SCOPE_PAGES:
        text = read_text(WIKI_ROOT / rel_path)
        if "## 本页边界" not in text:
            errors.append(f"{rel_path} lacks scope boundary section")

    assert errors == []
