---
id: practical-python-2.18
source_exercise_id: "2.18"
title: "Tabulating with Counters"
section: "2.5 collections module"
source_path: "02_Working_with_data/05_Collections.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 2.18: Tabulating with Counters

> Source: Practical Python Programming, `02_Working_with_data/05_Collections.md`.

### Exercise 2.18: Tabulating with Counters

Suppose you wanted to tabulate the total number of shares of each stock.
This is easy using `Counter` objects. Try it:

```python
>>> portfolio = read_portfolio('Data/portfolio.csv')
>>> from collections import Counter
>>> holdings = Counter()
>>> for s in portfolio:
        holdings[s['name']] += s['shares']

>>> holdings
Counter({'MSFT': 250, 'IBM': 150, 'CAT': 150, 'AA': 100, 'GE': 95})
>>>
```

Carefully observe how the multiple entries for `MSFT` and `IBM` in `portfolio` get combined into a single entry here.

You can use a Counter just like a dictionary to retrieve individual values:

```python
>>> holdings['IBM']
150
>>> holdings['MSFT']
250
>>>
```

If you want to rank the values, do this:

```python
>>> # Get three most held stocks
>>> holdings.most_common(3)
[('MSFT', 250), ('IBM', 150), ('CAT', 150)]
>>>
```

Let’s grab another portfolio of stocks and make a new Counter:

```python
>>> portfolio2 = read_portfolio('Data/portfolio2.csv')
>>> holdings2 = Counter()
>>> for s in portfolio2:
          holdings2[s['name']] += s['shares']

>>> holdings2
Counter({'HPQ': 250, 'GE': 125, 'AA': 50, 'MSFT': 25})
>>>
```

Finally, let’s combine all of the holdings doing one simple operation:

```python
>>> holdings
Counter({'MSFT': 250, 'IBM': 150, 'CAT': 150, 'AA': 100, 'GE': 95})
>>> holdings2
Counter({'HPQ': 250, 'GE': 125, 'AA': 50, 'MSFT': 25})
>>> combined = holdings + holdings2
>>> combined
Counter({'MSFT': 275, 'HPQ': 250, 'GE': 220, 'AA': 150, 'IBM': 150, 'CAT': 150})
>>>
```

This is only a small taste of what counters provide. However, if you
ever find yourself needing to tabulate values, you should consider
using one.

### Commentary: collections module

The `collections` module is one of the most useful library modules
in all of Python.  In fact, we could do an extended tutorial on just
that.  However, doing so now would also be a distraction.  For now,
put `collections` on your list of bedtime reading for later.

[Contents](../Contents.md) \| [Previous (2.4 Sequences)](04_Sequences.md) \| [Next (2.6 List Comprehensions)](06_List_comprehension.md)

## 关联来源

- [[summaries/05_Collections]]
