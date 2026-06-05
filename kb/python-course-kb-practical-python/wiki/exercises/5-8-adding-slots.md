---
id: practical-python-5.8
source_exercise_id: "5.8"
title: "Adding slots"
section: "5.2 Classes and Encapsulation"
source_path: "05_Object_model/02_Classes_encapsulation.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: true
skip: false
---

# Exercise 5.8: Adding slots

> Source: Practical Python Programming, `05_Object_model/02_Classes_encapsulation.md`.

### Exercise 5.8: Adding slots

Modify the `Stock` class so that it has a `__slots__` attribute.  Then,
verify that new attributes can't be added:

```python
>>> ================================ RESTART ================================
>>> from stock import Stock
>>> s = Stock('GOOG', 100, 490.10)
>>> s.name
'GOOG'
>>> s.blah = 42
... see what happens ...
>>>
```

When you use `__slots__`, Python uses a more efficient
internal representation of objects.   What happens if you try to
inspect the underlying dictionary of `s` above?

```python
>>> s.__dict__
... see what happens ...
>>>
```

It should be noted that `__slots__` is most commonly used as an
optimization on classes that serve as data structures.  Using slots
will make such programs use far-less memory and run a bit faster.
You should probably avoid `__slots__` on most other classes however.

[Contents](../Contents.md) \| [Previous (5.1 Dictionaries Revisited)](01_Dicts_revisited.md) \| [Next (6 Generators)](../06_Generators/00_Overview.md)

## 关联来源

- [[summaries/02_Classes_encapsulation]]
