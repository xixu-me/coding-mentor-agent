---
id: practical-python-1.29
source_exercise_id: "1.29"
title: "Defining a function"
section: "1.7 Functions"
source_path: "01_Introduction/07_Functions.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 1.29: Defining a function

> Source: Practical Python Programming, `01_Introduction/07_Functions.md`.

### Exercise 1.29: Defining a function

Try defining a simple function:

```python
>>> def greeting(name):
        'Issues a greeting'
        print('Hello', name)

>>> greeting('Guido')
Hello Guido
>>> greeting('Paula')
Hello Paula
>>>
```

If the first statement of a function is a string, it serves as documentation.
Try typing a command such as `help(greeting)` to see it displayed.

## 关联来源

- [[summaries/07_Functions]]
