---
id: practical-python-2.21
source_exercise_id: "2.21"
title: "Data Queries"
section: "2.6 List Comprehensions"
source_path: "02_Working_with_data/06_List_comprehension.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 2.21: Data Queries

> Source: Practical Python Programming, `02_Working_with_data/06_List_comprehension.md`.

### Exercise 2.21: Data Queries

Try the following examples of various data queries.

First, a list of all portfolio holdings with more than 100 shares.

```python
>>> more100 = [ s for s in portfolio if s['shares'] > 100 ]
>>> more100
[{'price': 83.44, 'name': 'CAT', 'shares': 150}, {'price': 51.23, 'name': 'MSFT', 'shares': 200}]
>>>
```

All portfolio holdings for MSFT and IBM stocks.

```python
>>> msftibm = [ s for s in portfolio if s['name'] in {'MSFT','IBM'} ]
>>> msftibm
[{'price': 91.1, 'name': 'IBM', 'shares': 50}, {'price': 51.23, 'name': 'MSFT', 'shares': 200},
  {'price': 65.1, 'name': 'MSFT', 'shares': 50}, {'price': 70.44, 'name': 'IBM', 'shares': 100}]
>>>
```

A list of all portfolio holdings that cost more than $10000.

```python
>>> cost10k = [ s for s in portfolio if s['shares'] * s['price'] > 10000 ]
>>> cost10k
[{'price': 83.44, 'name': 'CAT', 'shares': 150}, {'price': 51.23, 'name': 'MSFT', 'shares': 200}]
>>>
```

## 关联来源

- [[summaries/06_List_comprehension]]
