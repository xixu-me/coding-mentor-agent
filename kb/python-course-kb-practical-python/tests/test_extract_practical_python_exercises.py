from pathlib import Path

import importlib.util
import sys


def load_module(path: Path):
    spec = importlib.util.spec_from_file_location("extract_practical_python_exercises", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_extracts_exercises_without_exposing_solution_code(tmp_path):
    kb = tmp_path / "kb"
    notes = kb / "raw" / "notes" / "01_Introduction"
    solutions = kb / "private" / "solutions" / "Solutions" / "1_1"
    exercises = kb / "wiki" / "exercises"
    private = kb / "private"
    notes.mkdir(parents=True)
    solutions.mkdir(parents=True)

    (notes / "01_Python.md").write_text(
        "\n".join(
            [
                "# 1.1 Python",
                "",
                "Some lesson text.",
                "",
                "## Exercises",
                "",
                "### Exercise 1.1: Using Python as a Calculator",
                "",
                "Try simple expressions.",
                "",
                "### Exercise 1.2: Intentionally left blank (skip)",
                "",
                "Skip this one.",
                "",
                "## Next Section",
                "",
                "Not part of exercise 1.2.",
            ]
        ),
        encoding="utf-8",
    )
    (solutions / "answer.py").write_text("print('secret solution')\n", encoding="utf-8")

    script_path = Path(__file__).resolve().parents[1] / "scripts" / "extract_practical_python_exercises.py"
    module = load_module(script_path)
    result = module.extract_exercises(
        notes_dir=kb / "raw" / "notes",
        out_dir=exercises,
        private_dir=private,
        solutions_dir=kb / "private" / "solutions" / "Solutions",
    )

    assert result.exercises_written == 2
    assert result.solutions_mapped == 1

    first = exercises / "1-1-using-python-as-a-calculator.md"
    second = exercises / "1-2-intentionally-left-blank-skip.md"
    assert first.exists()
    assert second.exists()

    first_text = first.read_text(encoding="utf-8")
    second_text = second.read_text(encoding="utf-8")
    solution_map = (private / "exercise-solutions-map.json").read_text(encoding="utf-8")

    assert "has_private_solution: true" in first_text
    assert "student_visible_solution: false" in first_text
    assert "secret solution" not in first_text
    assert '"practical-python-1.1": "solutions/Solutions/1_1"' in solution_map
    assert "skip: true" in second_text
    assert "Not part of exercise 1.2." not in second_text
