---
id: practical-python-1.31
source_exercise_id: "1.31"
title: "Error handling"
section: "1.7 Functions"
source_path: "01_Introduction/07_Functions.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 1.31: Error handling

> Source: Practical Python Programming, `01_Introduction/07_Functions.md`.

### Exercise 1.31: Error handling

What happens if you try your function on a file with some missing fields?

```python
>>> portfolio_cost('Data/missing.csv')
Traceback (most recent call last):
    File "<stdin>", line 1, in <module>
    File "pcost.py", line 11, in portfolio_cost
    nshares    = int(fields[1])
ValueError: invalid literal for int() with base 10: ''
>>>
```

At this point, you’re faced with a decision. To make the program work
you can either sanitize the original input file by eliminating bad
lines or you can modify your code to handle the bad lines in some
manner.

Modify the `pcost.py` program to catch the exception, print a warning
message, and continue processing the rest of the file.

## 关联来源

- [[summaries/07_Functions]]
