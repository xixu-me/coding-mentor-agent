---
id: practical-python-7.6
source_exercise_id: "7.6"
title: "Sorting on a field with lambda"
section: "7.2 Anonymous Functions and Lambda"
source_path: "07_Advanced_Topics/02_Anonymous_function.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 7.6: Sorting on a field with lambda

> Source: Practical Python Programming, `07_Advanced_Topics/02_Anonymous_function.md`.

### Exercise 7.6: Sorting on a field with lambda

Try sorting the portfolio according the number of shares using a
`lambda` expression:

```python
>>> portfolio.sort(key=lambda s: s.shares)
>>> for s in portfolio:
        print(s)

... inspect the result ...
>>>
```

Try sorting the portfolio according to the price of each stock

```python
>>> portfolio.sort(key=lambda s: s.price)
>>> for s in portfolio:
        print(s)

... inspect the result ...
>>>
```

Note: `lambda` is a useful shortcut because it allows you to
define a special processing function directly in the call to `sort()` as
opposed to having to define a separate function first.

[Contents](../Contents.md) \| [Previous (7.1 Variable Arguments)](01_Variable_arguments.md) \| [Next (7.3 Returning Functions)](03_Returning_functions.md)

## 关联来源

- [[summaries/02_Anonymous_function]]
