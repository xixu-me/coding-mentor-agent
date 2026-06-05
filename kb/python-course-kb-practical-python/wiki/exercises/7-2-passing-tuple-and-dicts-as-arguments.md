---
id: practical-python-7.2
source_exercise_id: "7.2"
title: "Passing tuple and dicts as arguments"
section: "7.1 Variable Arguments"
source_path: "07_Advanced_Topics/01_Variable_arguments.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 7.2: Passing tuple and dicts as arguments

> Source: Practical Python Programming, `07_Advanced_Topics/01_Variable_arguments.md`.

### Exercise 7.2: Passing tuple and dicts as arguments

Suppose you read some data from a file and obtained a tuple such as
this:

```
>>> data = ('GOOG', 100, 490.1)
>>>
```

Now, suppose you wanted to create a `Stock` object from this
data.  If you try to pass `data` directly, it doesn't work:

```
>>> from stock import Stock
>>> s = Stock(data)
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
TypeError: __init__() takes exactly 4 arguments (2 given)
>>>
```

This is easily fixed using `*data` instead.  Try this:

```python
>>> s = Stock(*data)
>>> s
Stock('GOOG', 100, 490.1)
>>>
```

If you have a dictionary, you can use `**` instead. For example:

```python
>>> data = { 'name': 'GOOG', 'shares': 100, 'price': 490.1 }
>>> s = Stock(**data)
Stock('GOOG', 100, 490.1)
>>>
```

## 关联来源

- [[summaries/01_Variable_arguments]]
