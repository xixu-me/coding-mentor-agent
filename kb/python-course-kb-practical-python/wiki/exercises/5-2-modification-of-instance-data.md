---
id: practical-python-5.2
source_exercise_id: "5.2"
title: "Modification of Instance Data"
section: "5.1 Dictionaries Revisited"
source_path: "05_Object_model/01_Dicts_revisited.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 5.2: Modification of Instance Data

> Source: Practical Python Programming, `05_Object_model/01_Dicts_revisited.md`.

### Exercise 5.2: Modification of Instance Data

Try setting a new attribute on one of the above instances:

```python
>>> goog.date = '6/11/2007'
>>> goog.__dict__
... look at output ...
>>> ibm.__dict__
... look at output ...
>>>
```

In the above output, you'll notice that the `goog` instance has a
attribute `date` whereas the `ibm` instance does not.  It is important
to note that Python really doesn't place any restrictions on
attributes.  For example, the attributes of an instance are not
limited to those set up in the `__init__()` method.

Instead of setting an attribute, try placing a new value directly into
the `__dict__` object:

```python
>>> goog.__dict__['time'] = '9:45am'
>>> goog.time
'9:45am'
>>>
```

Here, you really notice the fact that an instance is just a layer on
top of a dictionary.  Note: it should be emphasized that direct
manipulation of the dictionary is uncommon--you should always write
your code to use the (.) syntax.

## 关联来源

- [[summaries/01_Dicts_revisited]]
