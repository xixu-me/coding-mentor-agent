---
id: practical-python-6.7
source_exercise_id: "6.7"
title: "Watching your portfolio"
section: "6.2 Customizing Iteration"
source_path: "06_Generators/02_Customizing_iteration.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: true
skip: false
---

# Exercise 6.7: Watching your portfolio

> Source: Practical Python Programming, `06_Generators/02_Customizing_iteration.md`.

### Exercise 6.7: Watching your portfolio

Modify the `follow.py` program so that it watches the stream of stock
data and prints a ticker showing information for only those stocks
in a portfolio.  For example:

```python
if __name__ == '__main__':
    import report

    portfolio = report.read_portfolio('Data/portfolio.csv')

    for line in follow('Data/stocklog.csv'):
        fields = line.split(',')
        name = fields[0].strip('"')
        price = float(fields[1])
        change = float(fields[4])
        if name in portfolio:
            print(f'{name:>10s} {price:>10.2f} {change:>10.2f}')
```

Note: For this to work, your `Portfolio` class must support the `in`
operator.  See [Exercise 6.3](01_Iteration_protocol) and make sure you
implement the `__contains__()` operator.

### Discussion

Something very powerful just happened here.  You moved an interesting iteration pattern
(reading lines at the end of a file) into its own little function.   The `follow()` function
is now this completely general purpose utility that you can use in any program.  For
example, you could use it to watch server logs, debugging logs, and other similar data sources.
That's kind of cool.

[Contents](../Contents.md) \| [Previous (6.1 Iteration Protocol)](01_Iteration_protocol.md) \| [Next (6.3 Producer/Consumer)](03_Producers_consumers.md)

## 关联来源

- [[summaries/02_Customizing_iteration]]
