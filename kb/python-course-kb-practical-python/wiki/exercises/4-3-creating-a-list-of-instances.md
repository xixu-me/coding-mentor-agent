---
id: practical-python-4.3
source_exercise_id: "4.3"
title: "Creating a list of instances"
section: "4.1 Classes"
source_path: "04_Classes_objects/01_Class.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 4.3: Creating a list of instances

> Source: Practical Python Programming, `04_Classes_objects/01_Class.md`.

### Exercise 4.3: Creating a list of instances

Try these steps to make a list of Stock instances from a list of
dictionaries. Then compute the total cost:

```python
>>> import fileparse
>>> with open('Data/portfolio.csv') as lines:
...     portdicts = fileparse.parse_csv(lines, select=['name','shares','price'], types=[str,int,float])
...
>>> portfolio = [ stock.Stock(d['name'], d['shares'], d['price']) for d in portdicts]
>>> portfolio
[<stock.Stock object at 0x10c9e2128>, <stock.Stock object at 0x10c9e2048>, <stock.Stock object at 0x10c9e2080>,
 <stock.Stock object at 0x10c9e25f8>, <stock.Stock object at 0x10c9e2630>, <stock.Stock object at 0x10ca6f748>,
 <stock.Stock object at 0x10ca6f7b8>]
>>> sum([s.cost() for s in portfolio])
44671.15
>>>
```

## 关联来源

- [[summaries/01_Class]]
