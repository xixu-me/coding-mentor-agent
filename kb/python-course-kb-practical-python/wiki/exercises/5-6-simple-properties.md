---
id: practical-python-5.6
source_exercise_id: "5.6"
title: "Simple Properties"
section: "5.2 Classes and Encapsulation"
source_path: "05_Object_model/02_Classes_encapsulation.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 5.6: Simple Properties

> Source: Practical Python Programming, `05_Object_model/02_Classes_encapsulation.md`.

### Exercise 5.6: Simple Properties

Properties are a useful way to add "computed attributes" to an object.
In `stock.py`, you created an object `Stock`.  Notice that on your
object there is a slight inconsistency in how different kinds of data
are extracted:

```python
>>> from stock import Stock
>>> s = Stock('GOOG', 100, 490.1)
>>> s.shares
100
>>> s.price
490.1
>>> s.cost()
49010.0
>>>
```

Specifically, notice how you have to add the extra () to `cost` because it is a method.

You can get rid of the extra () on `cost()` if you turn it into a property.
Take your `Stock` class and modify it so that the cost calculation works like this:

```python
>>> ================================ RESTART ================================
>>> from stock import Stock
>>> s = Stock('GOOG', 100, 490.1)
>>> s.cost
49010.0
>>>
```

Try calling `s.cost()` as a function and observe that it
doesn't work now that `cost` has been defined as a property.

```python
>>> s.cost()
... fails ...
>>>
```

Making this change will likely break your earlier `pcost.py` program.
You might need to go back and get rid of the `()` on the `cost()` method.

## 关联来源

- [[summaries/02_Classes_encapsulation]]
