---
id: practical-python-6.13
source_exercise_id: "6.13"
title: "Generator Expressions"
section: "6.4 More Generators"
source_path: "06_Generators/04_More_generators.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 6.13: Generator Expressions

> Source: Practical Python Programming, `06_Generators/04_More_generators.md`.

### Exercise 6.13: Generator Expressions

Generator expressions are a generator version of a list comprehension.
For example:

```python
>>> nums = [1, 2, 3, 4, 5]
>>> squares = (x*x for x in nums)
>>> squares
<generator object <genexpr> at 0x109207e60>
>>> for n in squares:
...     print(n)
...
1
4
9
16
25
```

Unlike a list a comprehension, a generator expression can only be used once.
Thus, if you try another for-loop, you get nothing:

```python
>>> for n in squares:
...     print(n)
...
>>>
```

## 关联来源

- [[summaries/04_More_generators]]
