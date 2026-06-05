---
id: practical-python-6.11
source_exercise_id: "6.11"
title: "Filtering data"
section: "6.3 Producers, Consumers and Pipelines"
source_path: "06_Generators/03_Producers_consumers.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 6.11: Filtering data

> Source: Practical Python Programming, `06_Generators/03_Producers_consumers.md`.

### Exercise 6.11: Filtering data

Write a function that filters data.  For example:

```python
# ticker.py
...

def filter_symbols(rows, names):
    for row in rows:
        if row['name'] in names:
            yield row
```

Use this to filter stocks to just those in your portfolio:

```python
import report
portfolio = report.read_portfolio('Data/portfolio.csv')
rows = parse_stock_data(follow('Data/stocklog.csv'))
rows = filter_symbols(rows, portfolio)
for row in rows:
    print(row)
```

## 关联来源

- [[summaries/03_Producers_consumers]]
