---
id: practical-python-6.9
source_exercise_id: "6.9"
title: "Setting up a more complex pipeline"
section: "6.3 Producers, Consumers and Pipelines"
source_path: "06_Generators/03_Producers_consumers.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 6.9: Setting up a more complex pipeline

> Source: Practical Python Programming, `06_Generators/03_Producers_consumers.md`.

### Exercise 6.9: Setting up a more complex pipeline

Take the pipelining idea a few steps further by performing
more actions.

```
>>> from follow import follow
>>> import csv
>>> lines = follow('Data/stocklog.csv')
>>> rows = csv.reader(lines)
>>> for row in rows:
        print(row)

['BA', '98.35', '6/11/2007', '09:41.07', '0.16', '98.25', '98.35', '98.31', '158148']
['AA', '39.63', '6/11/2007', '09:41.07', '-0.03', '39.67', '39.63', '39.31', '270224']
['XOM', '82.45', '6/11/2007', '09:41.07', '-0.23', '82.68', '82.64', '82.41', '748062']
['PG', '62.95', '6/11/2007', '09:41.08', '-0.12', '62.80', '62.97', '62.61', '454327']
...
```

Well, that's interesting.  What you're seeing here is that the output of the
`follow()` function has been piped into the `csv.reader()` function and we're
now getting a sequence of split rows.

## 关联来源

- [[summaries/03_Producers_consumers]]
