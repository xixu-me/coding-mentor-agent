---
id: practical-python-7.3
source_exercise_id: "7.3"
title: "Creating a list of instances"
section: "7.1 Variable Arguments"
source_path: "07_Advanced_Topics/01_Variable_arguments.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 7.3: Creating a list of instances

> Source: Practical Python Programming, `07_Advanced_Topics/01_Variable_arguments.md`.

### Exercise 7.3: Creating a list of instances

In your `report.py` program, you created a list of instances
using code like this:

```python
def read_portfolio(filename):
    '''
    Read a stock portfolio file into a list of dictionaries with keys
    name, shares, and price.
    '''
    with open(filename) as lines:
        portdicts = fileparse.parse_csv(lines,
                               select=['name','shares','price'],
                               types=[str,int,float])

    portfolio = [ Stock(d['name'], d['shares'], d['price'])
                  for d in portdicts ]
    return Portfolio(portfolio)
```

You can simplify that code using `Stock(**d)` instead.  Make that change.

## 关联来源

- [[summaries/01_Variable_arguments]]
