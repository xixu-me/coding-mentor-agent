---
id: practical-python-1.24
source_exercise_id: "1.24"
title: "Putting it all back together"
section: "1.5 Lists"
source_path: "01_Introduction/05_Lists.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 1.24: Putting it all back together

> Source: Practical Python Programming, `01_Introduction/05_Lists.md`.

### Exercise 1.24: Putting it all back together

Want to take a list of strings and join them together into one string?
Use the `join()` method of strings like this (note: this looks funny at first).

```python
>>> a = ','.join(symlist)
>>> a
'YHOO,RHT,HPQ,GOOG,AIG,AAPL,AA'
>>> b = ':'.join(symlist)
>>> b
'YHOO:RHT:HPQ:GOOG:AIG:AAPL:AA'
>>> c = ''.join(symlist)
>>> c
'YHOORHTHPQGOOGAIGAAPLAA'
>>>
```

## 关联来源

- [[summaries/05_Lists]]
