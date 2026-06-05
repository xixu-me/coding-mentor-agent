---
id: practical-python-7.5
source_exercise_id: "7.5"
title: "Sorting on a field"
section: "7.2 Anonymous Functions and Lambda"
source_path: "07_Advanced_Topics/02_Anonymous_function.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 7.5: Sorting on a field

> Source: Practical Python Programming, `07_Advanced_Topics/02_Anonymous_function.md`.

### Exercise 7.5: Sorting on a field

Try the following statements which sort the portfolio data
alphabetically by stock name.

```python
>>> def stock_name(s):
       return s.name

>>> portfolio.sort(key=stock_name)
>>> for s in portfolio:
           print(s)

... inspect the result ...
>>>
```

In this part, the `stock_name()` function extracts the name of a stock from
a single entry in the `portfolio` list.   `sort()` uses the result of
this function to do the comparison.

## 关联来源

- [[summaries/02_Anonymous_function]]
