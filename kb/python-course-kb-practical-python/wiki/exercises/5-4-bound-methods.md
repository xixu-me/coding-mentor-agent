---
id: practical-python-5.4
source_exercise_id: "5.4"
title: "Bound methods"
section: "5.1 Dictionaries Revisited"
source_path: "05_Object_model/01_Dicts_revisited.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 5.4: Bound methods

> Source: Practical Python Programming, `05_Object_model/01_Dicts_revisited.md`.

### Exercise 5.4: Bound methods

A subtle feature of Python is that invoking a method actually involves
two steps and something known as a bound method.   For example:

```python
>>> s = goog.sell
>>> s
<bound method Stock.sell of Stock('GOOG', 100, 490.1)>
>>> s(25)
>>> goog.shares
75
>>>
```

Bound methods actually contain all of the pieces needed to call a
method.  For instance, they keep a record of the function implementing
the method:

```python
>>> s.__func__
<function sell at 0x10049af50>
>>>
```

This is the same value as found in the `Stock` dictionary.

```python
>>> Stock.__dict__['sell']
<function sell at 0x10049af50>
>>>
```

Bound methods also record the instance, which is the `self`
argument.

```python
>>> s.__self__
Stock('GOOG',75,490.1)
>>>
```

When you invoke the function using `()` all of the pieces come
together.  For example, calling `s(25)` actually does this:

```python
>>> s.__func__(s.__self__, 25)    # Same as s(25)
>>> goog.shares
50
>>>
```

## 关联来源

- [[summaries/01_Dicts_revisited]]
