---
id: practical-python-3.14
source_exercise_id: "3.14"
title: "Using more library imports"
section: "3.4 Modules"
source_path: "03_Program_organization/04_Modules.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: true
skip: false
---

# Exercise 3.14: Using more library imports

> Source: Practical Python Programming, `03_Program_organization/04_Modules.md`.

### Exercise 3.14: Using more library imports

In section 1, you wrote a program `pcost.py` that read a portfolio and computed its cost.

```python
>>> import pcost
>>> pcost.portfolio_cost('Data/portfolio.csv')
44671.15
>>>
```

Modify the `pcost.py` file so that it uses the `report.read_portfolio()` function.

### Commentary

When you are done with this exercise, you should have three
programs. `fileparse.py` which contains a general purpose
`parse_csv()` function.  `report.py` which produces a nice report, but
also contains `read_portfolio()` and `read_prices()` functions.  And
finally, `pcost.py` which computes the portfolio cost, but makes use
of the `read_portfolio()` function written for the `report.py` program.

[Contents](../Contents.md) \| [Previous (3.3 Error Checking)](03_Error_checking.md) \| [Next (3.5 Main Module)](05_Main_module.md)

## 关联来源

- [[summaries/04_Modules]]
