---
id: practical-python-2.26
source_exercise_id: "2.26"
title: "The Big Picture"
section: "2.7 Objects"
source_path: "02_Working_with_data/07_Objects.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 2.26: The Big Picture

> Source: Practical Python Programming, `02_Working_with_data/07_Objects.md`.

### Exercise 2.26: The Big Picture

Using the techniques in this exercise, you could write statements that
easily convert fields from just about any column-oriented datafile
into a Python dictionary.

Just to illustrate, suppose you read data from a different datafile like this:

```python
>>> f = open('Data/dowstocks.csv')
>>> rows = csv.reader(f)
>>> headers = next(rows)
>>> row = next(rows)
>>> headers
['name', 'price', 'date', 'time', 'change', 'open', 'high', 'low', 'volume']
>>> row
['AA', '39.48', '6/11/2007', '9:36am', '-0.18', '39.67', '39.69', '39.45', '181800']
>>>
```

Let’s convert the fields using a similar trick:

```python
>>> types = [str, float, str, str, float, float, float, float, int]
>>> converted = [func(val) for func, val in zip(types, row)]
>>> record = dict(zip(headers, converted))
>>> record
{'volume': 181800, 'name': 'AA', 'price': 39.48, 'high': 39.69,
'low': 39.45, 'time': '9:36am', 'date': '6/11/2007', 'open': 39.67,
'change': -0.18}
>>> record['name']
'AA'
>>> record['price']
39.48
>>>
```

Bonus: How would you modify this example to additionally parse the
`date` entry into a tuple such as `(6, 11, 2007)`?

Spend some time to ponder what you’ve done in this exercise. We’ll
revisit these ideas a little later.

[Contents](../Contents.md) \| [Previous (2.6 List Comprehensions)](06_List_comprehension.md) \| [Next (3 Program Organization)](../03_Program_organization/00_Overview.md)

## 关联来源

- [[summaries/07_Objects]]
