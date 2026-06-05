---
id: practical-python-3.10
source_exercise_id: "3.10"
title: "Silencing Errors"
section: "3.3 Error Checking"
source_path: "03_Program_organization/03_Error_checking.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: true
skip: false
---

# Exercise 3.10: Silencing Errors

> Source: Practical Python Programming, `03_Program_organization/03_Error_checking.md`.

### Exercise 3.10: Silencing Errors

Modify the `parse_csv()` function so that parsing error messages can
be silenced if explicitly desired by the user.  For example:

```python
>>> portfolio = parse_csv('Data/missing.csv', types=[str,int,float], silence_errors=True)
>>> portfolio
[{'price': 32.2, 'name': 'AA', 'shares': 100}, {'price': 91.1, 'name': 'IBM', 'shares': 50}, {'price': 83.44, 'name': 'CAT', 'shares': 150}, {'price': 40.37, 'name': 'GE', 'shares': 95}, {'price': 65.1, 'name': 'MSFT', 'shares': 50}]
>>>
```

Error handling is one of the most difficult things to get right in
most programs.  As a general rule, you shouldn’t silently ignore
errors.  Instead, it’s better to report problems and to give the user
an option to the silence the error message if they choose to do so.

[Contents](../Contents.md) \| [Previous (3.2 More on Functions)](02_More_functions.md) \| [Next (3.4 Modules)](04_Modules.md)

## 关联来源

- [[summaries/03_Error_checking]]
