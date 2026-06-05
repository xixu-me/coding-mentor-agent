---
id: practical-python-4.10
source_exercise_id: "4.10"
title: "An example of using getattr()"
section: "4.3 Special Methods"
source_path: "04_Classes_objects/03_Special_methods.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: true
skip: false
---

# Exercise 4.10: An example of using getattr()

> Source: Practical Python Programming, `04_Classes_objects/03_Special_methods.md`.

### Exercise 4.10: An example of using getattr()

`getattr()` is an alternative mechanism for reading attributes.  It can be used to
write extremely flexible code.  To begin, try this example:

```python
>>> import stock
>>> s = stock.Stock('GOOG', 100, 490.1)
>>> columns = ['name', 'shares']
>>> for colname in columns:
        print(colname, '=', getattr(s, colname))

name = GOOG
shares = 100
>>>
```

Carefully observe that the output data is determined entirely by the attribute
names listed in the `columns` variable.

In the file `tableformat.py`, take this idea and expand it into a generalized
function `print_table()` that prints a table showing
user-specified attributes of a list of arbitrary objects.  As with the
earlier `print_report()` function, `print_table()` should also accept
a `TableFormatter` instance to control the output format.  Here's how
it should work:

```python
>>> import report
>>> portfolio = report.read_portfolio('Data/portfolio.csv')
>>> from tableformat import create_formatter, print_table
>>> formatter = create_formatter('txt')
>>> print_table(portfolio, ['name','shares'], formatter)
      name     shares
---------- ----------
        AA        100
       IBM         50
       CAT        150
      MSFT        200
        GE         95
      MSFT         50
       IBM        100

>>> print_table(portfolio, ['name','shares','price'], formatter)
      name     shares      price
---------- ---------- ----------
        AA        100       32.2
       IBM         50       91.1
       CAT        150      83.44
      MSFT        200      51.23
        GE         95      40.37
      MSFT         50       65.1
       IBM        100      70.44
>>>
```

[Contents](../Contents.md) \| [Previous (4.2 Inheritance)](02_Inheritance.md) \| [Next (4.4 Exceptions)](04_Defining_exceptions.md)

## 关联来源

- [[summaries/03_Special_methods]]
