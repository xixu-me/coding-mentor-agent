from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path


EXERCISE_RE = re.compile(r"^### Exercise\s+(\d+)\.(\d+)\s*:?\s*(.*?)\s*$")
HEADING_RE = re.compile(r"^(#|##)\s+(.+?)\s*$")


@dataclass(frozen=True)
class ExtractResult:
    exercises_written: int
    solutions_mapped: int


def slugify(text: str) -> str:
    slug = text.lower().replace("`", "")
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")[:80] or "exercise"


def yaml_string(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', "'") + '"'


def find_section_title(lines: list[str], fallback: str) -> str:
    for line in lines:
        match = HEADING_RE.match(line)
        if match:
            return match.group(2).strip()
    return fallback


def find_exercises(lines: list[str]) -> list[tuple[int, str, str, str]]:
    matches: list[tuple[int, str, str, str]] = []
    for index, line in enumerate(lines):
        match = EXERCISE_RE.match(line)
        if match:
            major, minor, title = match.groups()
            matches.append((index, major, minor, title.strip() or "Untitled"))
    return matches


def exercise_end(lines: list[str], start: int, next_start: int | None) -> int:
    if next_start is not None:
        return next_start
    for index in range(start + 1, len(lines)):
        if lines[index].startswith("## ") and not lines[index].startswith("### "):
            return index
    return len(lines)


def write_exercise_page(
    *,
    out_dir: Path,
    source_id: str,
    title: str,
    section_title: str,
    source_path: str,
    body: str,
    has_solution: bool,
    skip: bool,
    source_commit: str,
) -> None:
    major, minor = source_id.split(".", 1)
    filename = f"{major}-{minor}-{slugify(title)}.md"
    path = out_dir / filename
    ex_id = f"practical-python-{source_id}"

    commit_line = f'source_commit: "{source_commit}"\n' if source_commit else ""
    page = (
        "---\n"
        f"id: {ex_id}\n"
        f'source_exercise_id: "{source_id}"\n'
        f"title: {yaml_string(title)}\n"
        f"section: {yaml_string(section_title)}\n"
        f'source_path: "{source_path}"\n'
        'source_repo: "https://github.com/dabeaz-course/practical-python"\n'
        f"{commit_line}"
        "student_visible_solution: false\n"
        f"has_private_solution: {str(has_solution).lower()}\n"
        f"skip: {str(skip).lower()}\n"
        "---\n\n"
        f"# Exercise {source_id}: {title}\n\n"
        f"> Source: Practical Python Programming, `{source_path}`.\n\n"
        f"{body}\n"
    )
    path.write_text(page, encoding="utf-8")


def extract_exercises(
    *,
    notes_dir: Path,
    out_dir: Path,
    private_dir: Path,
    solutions_dir: Path,
    source_commit: str = "",
) -> ExtractResult:
    notes_dir = notes_dir.resolve()
    out_dir = out_dir.resolve()
    private_dir = private_dir.resolve()
    solutions_dir = solutions_dir.resolve()

    out_dir.mkdir(parents=True, exist_ok=True)
    private_dir.mkdir(parents=True, exist_ok=True)

    solution_map: dict[str, str] = {}
    exercises_written = 0

    for source in sorted(notes_dir.rglob("*.md")):
        source_path = source.relative_to(notes_dir).as_posix()
        lines = source.read_text(encoding="utf-8").splitlines()
        section_title = find_section_title(lines, source_path)
        exercise_matches = find_exercises(lines)

        for index, (start, major, minor, title) in enumerate(exercise_matches):
            next_start = exercise_matches[index + 1][0] if index + 1 < len(exercise_matches) else None
            end = exercise_end(lines, start, next_start)
            source_id = f"{major}.{minor}"
            ex_id = f"practical-python-{source_id}"
            body = "\n".join(lines[start:end]).strip()
            solution_path = solutions_dir / f"{major}_{minor}"
            has_solution = solution_path.exists()
            skip = "intentionally left blank" in title.lower() or "skip" in title.lower()

            if has_solution:
                solution_map[ex_id] = solution_path.relative_to(private_dir).as_posix()

            write_exercise_page(
                out_dir=out_dir,
                source_id=source_id,
                title=title,
                section_title=section_title,
                source_path=source_path,
                body=body,
                has_solution=has_solution,
                skip=skip,
                source_commit=source_commit,
            )
            exercises_written += 1

    (private_dir / "exercise-solutions-map.json").write_text(
        json.dumps(solution_map, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return ExtractResult(exercises_written=exercises_written, solutions_mapped=len(solution_map))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract Practical Python exercises into OpenKB exercise pages.")
    parser.add_argument("--kb-root", type=Path, required=True)
    parser.add_argument("--source-commit", default="")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    kb_root = args.kb_root.resolve()
    result = extract_exercises(
        notes_dir=kb_root / "raw" / "notes",
        out_dir=kb_root / "wiki" / "exercises",
        private_dir=kb_root / "private",
        solutions_dir=kb_root / "private" / "solutions" / "Solutions",
        source_commit=args.source_commit,
    )
    print(f"exercises_written={result.exercises_written}")
    print(f"solutions_mapped={result.solutions_mapped}")


if __name__ == "__main__":
    main()
