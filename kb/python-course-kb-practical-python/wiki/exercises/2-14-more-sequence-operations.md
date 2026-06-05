---
id: practical-python-2.14
source_exercise_id: "2.14"
title: "More sequence operations"
section: "2.4 Sequences"
source_path: "02_Working_with_data/04_Sequences.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 2.14: More sequence operations

> Source: Practical Python Programming, `02_Working_with_data/04_Sequences.md`.

### Exercise 2.14: More sequence operations

Interactively experiment with some of the sequence reduction operations.

```python
>>> data = [4, 9, 1, 25, 16, 100, 49]
>>> min(data)
1
>>> max(data)
100
>>> sum(data)
204
>>>
```

Try looping over the data.

```python
>>> for x in data:
        print(x)

4
9
...
>>> for n, x in enumerate(data):
        print(n, x)

0 4
1 9
2 1
...
>>>
```

Sometimes the `for` statement, `len()`, and `range()` get used by
novices in some kind of horrible code fragment that looks like it
emerged from the depths of a rusty C program.

```python
>>> for n in range(len(data)):
        print(data[n])

4
9
1
...
>>>
```

Don’t do that! Not only does reading it make everyone’s eyes bleed,
it’s inefficient with memory and it runs a lot slower.  Just use a
normal `for` loop if you want to iterate over data.  Use `enumerate()`
if you happen to need the index for some reason.

## 关联来源

- [[summaries/04_Sequences]]
