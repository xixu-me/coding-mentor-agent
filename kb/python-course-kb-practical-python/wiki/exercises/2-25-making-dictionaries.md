---
id: practical-python-2.25
source_exercise_id: "2.25"
title: "Making dictionaries"
section: "2.7 Objects"
source_path: "02_Working_with_data/07_Objects.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 2.25: Making dictionaries

> Source: Practical Python Programming, `02_Working_with_data/07_Objects.md`.

### Exercise 2.25: Making dictionaries

Remember how the `dict()` function can easily make a dictionary if you
have a sequence of key names and values?  Let’s make a dictionary from
the column headers:

```python
>>> headers
['name', 'shares', 'price']
>>> converted
['AA', 100, 32.2]
>>> dict(zip(headers, converted))
{'price': 32.2, 'name': 'AA', 'shares': 100}
>>>
```

Of course, if you’re up on your list-comprehension fu, you can do the
whole conversion in a single step using a dict-comprehension:

```python
>>> { name: func(val) for name, func, val in zip(headers, types, row) }
{'price': 32.2, 'name': 'AA', 'shares': 100}
>>>
```

## 关联来源

- [[summaries/07_Objects]]
