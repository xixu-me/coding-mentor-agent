---
id: practical-python-6.15
source_exercise_id: "6.15"
title: "Code simplification"
section: "6.4 More Generators"
source_path: "06_Generators/04_More_generators.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: true
skip: false
---

# Exercise 6.15: Code simplification

> Source: Practical Python Programming, `06_Generators/04_More_generators.md`.

### Exercise 6.15: Code simplification

Generators expressions are often a useful replacement for
small generator functions.  For example, instead of writing a
function like this:

```python
def filter_symbols(rows, names):
    for row in rows:
        if row['name'] in names:
            yield row
```

You could write something like this:

```python
rows = (row for row in rows if row['name'] in names)
```

Modify the `ticker.py` program to use generator expressions
as appropriate.


[Contents](../Contents.md) \| [Previous (6.3 Producer/Consumer)](03_Producers_consumers.md) \| [Next (7 Advanced Topics)](../07_Advanced_Topics/00_Overview.md)

## 关联来源

- [[summaries/04_More_generators]]
