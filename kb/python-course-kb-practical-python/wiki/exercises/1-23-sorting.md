---
id: practical-python-1.23
source_exercise_id: "1.23"
title: "Sorting"
section: "1.5 Lists"
source_path: "01_Introduction/05_Lists.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 1.23: Sorting

> Source: Practical Python Programming, `01_Introduction/05_Lists.md`.

### Exercise 1.23: Sorting

Want to sort a list?  Use the `sort()` method. Try it out:

```python
>>> symlist.sort()
>>> symlist
['AA', 'AAPL', 'AIG', 'GOOG', 'HPQ', 'RHT', 'YHOO']
>>>
```

Want to sort in reverse? Try this:

```python
>>> symlist.sort(reverse=True)
>>> symlist
['YHOO', 'RHT', 'HPQ', 'GOOG', 'AIG', 'AAPL', 'AA']
>>>
```

Note: Sorting a list modifies its contents 'in-place'.  That is, the elements of the list are shuffled around, but no new list is created as a result.

## 关联来源

- [[summaries/05_Lists]]
