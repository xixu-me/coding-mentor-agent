---
id: practical-python-2.15
source_exercise_id: "2.15"
title: "A practical enumerate() example"
section: "2.4 Sequences"
source_path: "02_Working_with_data/04_Sequences.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 2.15: A practical enumerate() example

> Source: Practical Python Programming, `02_Working_with_data/04_Sequences.md`.

### Exercise 2.15: A practical enumerate() example

Recall that the file `Data/missing.csv` contains data for a stock
portfolio, but has some rows with missing data.  Using `enumerate()`,
modify your `pcost.py` program so that it prints a line number with
the warning message when it encounters bad input.

```python
>>> cost = portfolio_cost('Data/missing.csv')
Row 4: Couldn't convert: ['MSFT', '', '51.23']
Row 7: Couldn't convert: ['IBM', '', '70.44']
>>>
```

To do this, you’ll need to change a few parts of your code.

```python
...
for rowno, row in enumerate(rows, start=1):
    try:
        ...
    except ValueError:
        print(f'Row {rowno}: Bad row: {row}')
```

## 关联来源

- [[summaries/04_Sequences]]
