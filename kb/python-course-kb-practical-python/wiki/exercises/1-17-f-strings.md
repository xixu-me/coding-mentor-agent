---
id: practical-python-1.17
source_exercise_id: "1.17"
title: "f-strings"
section: "1.4 Strings"
source_path: "01_Introduction/04_Strings.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 1.17: f-strings

> Source: Practical Python Programming, `01_Introduction/04_Strings.md`.

### Exercise 1.17: f-strings

Sometimes you want to create a string and embed the values of
variables into it.

To do that, use an f-string. For example:

```python
>>> name = 'IBM'
>>> shares = 100
>>> price = 91.1
>>> f'{shares} shares of {name} at ${price:0.2f}'
'100 shares of IBM at $91.10'
>>>
```

Modify the `mortgage.py` program from [Exercise 1.10](03_Numbers.md) to create its output using f-strings.
Try to make it so that output is nicely aligned.

## 关联来源

- [[summaries/04_Strings]]
