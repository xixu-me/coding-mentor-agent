---
id: practical-python-6.3
source_exercise_id: "6.3"
title: "Making a more proper container"
section: "6.1 Iteration Protocol"
source_path: "06_Generators/01_Iteration_protocol.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: true
skip: false
---

# Exercise 6.3: Making a more proper container

> Source: Practical Python Programming, `06_Generators/01_Iteration_protocol.md`.

### Exercise 6.3: Making a more proper container

If making a container class, you often want to do more than just
iteration. Modify the `Portfolio` class so that it has some other
special methods like this:

```python
class Portfolio:
    def __init__(self, holdings):
        self._holdings = holdings

    def __iter__(self):
        return self._holdings.__iter__()

    def __len__(self):
        return len(self._holdings)

    def __getitem__(self, index):
        return self._holdings[index]

    def __contains__(self, name):
        return any([s.name == name for s in self._holdings])

    @property
    def total_cost(self):
        return sum([s.shares*s.price for s in self._holdings])

    def tabulate_shares(self):
        from collections import Counter
        total_shares = Counter()
        for s in self._holdings:
            total_shares[s.name] += s.shares
        return total_shares
```

Now, try some experiments using this new class:

```
>>> import report
>>> portfolio = report.read_portfolio('Data/portfolio.csv')
>>> len(portfolio)
7
>>> portfolio[0]
Stock('AA', 100, 32.2)
>>> portfolio[1]
Stock('IBM', 50, 91.1)
>>> portfolio[0:3]
[Stock('AA', 100, 32.2), Stock('IBM', 50, 91.1), Stock('CAT', 150, 83.44)]
>>> 'IBM' in portfolio
True
>>> 'AAPL' in portfolio
False
>>>
```

One important observation about this--generally code is considered
"Pythonic" if it speaks the common vocabulary of how other parts of
Python normally work.  For container objects, supporting iteration,
indexing, containment, and other kinds of operators is an important
part of this.

[Contents](../Contents.md) \| [Previous (5.2 Encapsulation)](../05_Object_model/02_Classes_encapsulation.md) \| [Next (6.2 Customizing Iteration)](02_Customizing_iteration.md)

## 关联来源

- [[summaries/01_Iteration_protocol]]
