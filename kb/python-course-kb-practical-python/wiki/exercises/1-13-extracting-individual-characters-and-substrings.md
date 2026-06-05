---
id: practical-python-1.13
source_exercise_id: "1.13"
title: "Extracting individual characters and substrings"
section: "1.4 Strings"
source_path: "01_Introduction/04_Strings.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 1.13: Extracting individual characters and substrings

> Source: Practical Python Programming, `01_Introduction/04_Strings.md`.

### Exercise 1.13: Extracting individual characters and substrings

Strings are arrays of characters. Try extracting a few characters:

```python
>>> symbols[0]
?
>>> symbols[1]
?
>>> symbols[2]
?
>>> symbols[-1]        # Last character
?
>>> symbols[-2]        # Negative indices are from end of string
?
>>>
```

In Python, strings are read-only.

Verify this by trying to change the first character of `symbols` to a lower-case 'a'.

```python
>>> symbols[0] = 'a'
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
TypeError: 'str' object does not support item assignment
>>>
```

## 关联来源

- [[summaries/04_Strings]]
