---
id: practical-python-6.12
source_exercise_id: "6.12"
title: "Putting it all together"
section: "6.3 Producers, Consumers and Pipelines"
source_path: "06_Generators/03_Producers_consumers.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: true
skip: false
---

# Exercise 6.12: Putting it all together

> Source: Practical Python Programming, `06_Generators/03_Producers_consumers.md`.

### Exercise 6.12: Putting it all together

In the `ticker.py` program, write a function `ticker(portfile, logfile, fmt)`
that creates a real-time stock ticker from a given portfolio, logfile,
and table format.  For example::

```python
>>> from ticker import ticker
>>> ticker('Data/portfolio.csv', 'Data/stocklog.csv', 'txt')
      Name      Price     Change
---------- ---------- ----------
        GE      37.14      -0.18
      MSFT      29.96      -0.09
       CAT      78.03      -0.49
        AA      39.34      -0.32
...

>>> ticker('Data/portfolio.csv', 'Data/stocklog.csv', 'csv')
Name,Price,Change
IBM,102.79,-0.28
CAT,78.04,-0.48
AA,39.35,-0.31
CAT,78.05,-0.47
...
```

### Discussion

Some lessons learned: You can create various generator functions and
chain them together to perform processing involving data-flow
pipelines.  In addition, you can create functions that package a
series of pipeline stages into a single function call (for example,
the `parse_stock_data()` function).

[Contents](../Contents.md) \| [Previous (6.2 Customizing Iteration)](02_Customizing_iteration.md) \| [Next (6.4 Generator Expressions)](04_More_generators.md)

## 关联来源

- [[summaries/03_Producers_consumers]]
