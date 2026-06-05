---
id: practical-python-2.2
source_exercise_id: "2.2"
title: "Dictionaries as a data structure"
section: "2.1 Datatypes and Data structures"
source_path: "02_Working_with_data/01_Datatypes.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 2.2: Dictionaries as a data structure

> Source: Practical Python Programming, `02_Working_with_data/01_Datatypes.md`.

### Exercise 2.2: Dictionaries as a data structure

An alternative to a tuple is to create a dictionary instead.

```python
>>> d = {
        'name' : row[0],
        'shares' : int(row[1]),
        'price'  : float(row[2])
    }
>>> d
{'name': 'AA', 'shares': 100, 'price': 32.2 }
>>>
```

Calculate the total cost of this holding:

```python
>>> cost = d['shares'] * d['price']
>>> cost
3220.0000000000005
>>>
```

Compare this example with the same calculation involving tuples
above. Change the number of shares to 75.

```python
>>> d['shares'] = 75
>>> d
{'name': 'AA', 'shares': 75, 'price': 32.2 }
>>>
```

Unlike tuples, dictionaries can be freely modified. Add some
attributes:

```python
>>> d['date'] = (6, 11, 2007)
>>> d['account'] = 12345
>>> d
{'name': 'AA', 'shares': 75, 'price':32.2, 'date': (6, 11, 2007), 'account': 12345}
>>>
```

## 关联来源

- [[summaries/01_Datatypes]]
