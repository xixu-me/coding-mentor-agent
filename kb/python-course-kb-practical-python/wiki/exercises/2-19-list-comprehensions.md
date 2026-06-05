---
id: practical-python-2.19
source_exercise_id: "2.19"
title: "List comprehensions"
section: "2.6 List Comprehensions"
source_path: "02_Working_with_data/06_List_comprehension.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 2.19: List comprehensions

> Source: Practical Python Programming, `02_Working_with_data/06_List_comprehension.md`.

### Exercise 2.19: List comprehensions

Try a few simple list comprehensions just to become familiar with the syntax.

```python
>>> nums = [1,2,3,4]
>>> squares = [ x * x for x in nums ]
>>> squares
[1, 4, 9, 16]
>>> twice = [ 2 * x for x in nums if x > 2 ]
>>> twice
[6, 8]
>>>
```

Notice how the list comprehensions are creating a new list with the
data suitably transformed or filtered.

## 关联来源

- [[summaries/06_List_comprehension]]
