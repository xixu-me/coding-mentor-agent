---
id: practical-python-4.9
source_exercise_id: "4.9"
title: "Better output for printing objects"
section: "4.3 Special Methods"
source_path: "04_Classes_objects/03_Special_methods.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 4.9: Better output for printing objects

> Source: Practical Python Programming, `04_Classes_objects/03_Special_methods.md`.

### Exercise 4.9: Better output for printing objects

Modify the `Stock` object that you defined in `stock.py`
so that the `__repr__()` method produces more useful output.  For
example:

```python
>>> goog = Stock('GOOG', 100, 490.1)
>>> goog
Stock('GOOG', 100, 490.1)
>>>
```

See what happens when you read a portfolio of stocks and view the
resulting list after you have made these changes.  For example:

```
>>> import report
>>> portfolio = report.read_portfolio('Data/portfolio.csv')
>>> portfolio
... see what the output is ...
>>>
```

## 关联来源

- [[summaries/03_Special_methods]]
