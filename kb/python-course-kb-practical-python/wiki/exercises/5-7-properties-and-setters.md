---
id: practical-python-5.7
source_exercise_id: "5.7"
title: "Properties and Setters"
section: "5.2 Classes and Encapsulation"
source_path: "05_Object_model/02_Classes_encapsulation.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 5.7: Properties and Setters

> Source: Practical Python Programming, `05_Object_model/02_Classes_encapsulation.md`.

### Exercise 5.7: Properties and Setters

Modify the `shares` attribute so that the value is stored in a
private attribute and that a pair of property functions are used to ensure
that it is always set to an integer value.  Here is an example of the expected
behavior:

```python
>>> ================================ RESTART ================================
>>> from stock import Stock
>>> s = Stock('GOOG',100,490.10)
>>> s.shares = 50
>>> s.shares = 'a lot'
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
TypeError: expected an integer
>>>
```

## 关联来源

- [[summaries/02_Classes_encapsulation]]
