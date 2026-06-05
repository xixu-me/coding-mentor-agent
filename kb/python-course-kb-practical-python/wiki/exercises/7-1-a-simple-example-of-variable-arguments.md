---
id: practical-python-7.1
source_exercise_id: "7.1"
title: "A simple example of variable arguments"
section: "7.1 Variable Arguments"
source_path: "07_Advanced_Topics/01_Variable_arguments.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 7.1: A simple example of variable arguments

> Source: Practical Python Programming, `07_Advanced_Topics/01_Variable_arguments.md`.

### Exercise 7.1: A simple example of variable arguments

Try defining the following function:

```python
>>> def avg(x,*more):
        return float(x+sum(more))/(1+len(more))

>>> avg(10,11)
10.5
>>> avg(3,4,5)
4.0
>>> avg(1,2,3,4,5,6)
3.5
>>>
```

Notice how the parameter `*more` collects all of the extra arguments.

## 关联来源

- [[summaries/01_Variable_arguments]]
