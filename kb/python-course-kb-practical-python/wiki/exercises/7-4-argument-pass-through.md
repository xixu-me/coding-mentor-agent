---
id: practical-python-7.4
source_exercise_id: "7.4"
title: "Argument pass-through"
section: "7.1 Variable Arguments"
source_path: "07_Advanced_Topics/01_Variable_arguments.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: true
skip: false
---

# Exercise 7.4: Argument pass-through

> Source: Practical Python Programming, `07_Advanced_Topics/01_Variable_arguments.md`.

### Exercise 7.4: Argument pass-through

The `fileparse.parse_csv()` function has some options for changing the
file delimiter and for error reporting.  Maybe you'd like to expose those
options to the `read_portfolio()` function above.   Make this change:

```
def read_portfolio(filename, **opts):
    '''
    Read a stock portfolio file into a list of dictionaries with keys
    name, shares, and price.
    '''
    with open(filename) as lines:
        portdicts = fileparse.parse_csv(lines,
                                        select=['name','shares','price'],
                                        types=[str,int,float],
                                        **opts)

    portfolio = [ Stock(**d) for d in portdicts ]
    return Portfolio(portfolio)
```

Once you've made the change, trying reading a file with some errors:

```python
>>> import report
>>> port = report.read_portfolio('Data/missing.csv')
Row 4: Couldn't convert ['MSFT', '', '51.23']
Row 4: Reason invalid literal for int() with base 10: ''
Row 7: Couldn't convert ['IBM', '', '70.44']
Row 7: Reason invalid literal for int() with base 10: ''
>>>
```

Now, try silencing the errors:

```python
>>> import report
>>> port = report.read_portfolio('Data/missing.csv', silence_errors=True)
>>>
```

[Contents](../Contents.md) \| [Previous (6.4 Generator Expressions)](../06_Generators/04_More_generators.md) \| [Next (7.2 Anonymous Functions)](02_Anonymous_function.md)

## 关联来源

- [[summaries/01_Variable_arguments]]
