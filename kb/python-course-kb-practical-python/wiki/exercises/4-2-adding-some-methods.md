---
id: practical-python-4.2
source_exercise_id: "4.2"
title: "Adding some Methods"
section: "4.1 Classes"
source_path: "04_Classes_objects/01_Class.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 4.2: Adding some Methods

> Source: Practical Python Programming, `04_Classes_objects/01_Class.md`.

### Exercise 4.2: Adding some Methods

With classes, you can attach functions to your objects.  These are
known as methods and are functions that operate on the data
stored inside an object.  Add a `cost()` and `sell()` method to your
`Stock` object.  They should work like this:

```python
>>> import stock
>>> s = stock.Stock('GOOG', 100, 490.10)
>>> s.cost()
49010.0
>>> s.shares
100
>>> s.sell(25)
>>> s.shares
75
>>> s.cost()
36757.5
>>>
```

## 关联来源

- [[summaries/01_Class]]
