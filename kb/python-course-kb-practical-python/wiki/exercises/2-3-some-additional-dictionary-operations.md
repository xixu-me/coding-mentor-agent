---
id: practical-python-2.3
source_exercise_id: "2.3"
title: "Some additional dictionary operations"
section: "2.1 Datatypes and Data structures"
source_path: "02_Working_with_data/01_Datatypes.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 2.3: Some additional dictionary operations

> Source: Practical Python Programming, `02_Working_with_data/01_Datatypes.md`.

### Exercise 2.3: Some additional dictionary operations

If you turn a dictionary into a list, you’ll get all of its keys:

```python
>>> list(d)
['name', 'shares', 'price', 'date', 'account']
>>>
```

Similarly, if you use the `for` statement to iterate on a dictionary,
you will get the keys:

```python
>>> for k in d:
        print('k =', k)

k = name
k = shares
k = price
k = date
k = account
>>>
```

Try this variant that performs a lookup at the same time:

```python
>>> for k in d:
        print(k, '=', d[k])

name = AA
shares = 75
price = 32.2
date = (6, 11, 2007)
account = 12345
>>>
```

You can also obtain all of the keys using the `keys()` method:

```python
>>> keys = d.keys()
>>> keys
dict_keys(['name', 'shares', 'price', 'date', 'account'])
>>>
```

`keys()` is a bit unusual in that it returns a special `dict_keys` object.

This is an overlay on the original dictionary that always gives you
the current keys—even if the dictionary changes. For example, try
this:

```python
>>> del d['account']
>>> keys
dict_keys(['name', 'shares', 'price', 'date'])
>>>
```

Carefully notice that the `'account'` disappeared from `keys` even
though you didn’t call `d.keys()` again.

A more elegant way to work with keys and values together is to use the
`items()` method. This gives you `(key, value)` tuples:

```python
>>> items = d.items()
>>> items
dict_items([('name', 'AA'), ('shares', 75), ('price', 32.2), ('date', (6, 11, 2007))])
>>> for k, v in d.items():
        print(k, '=', v)

name = AA
shares = 75
price = 32.2
date = (6, 11, 2007)
>>>
```

If you have tuples such as `items`, you can create a dictionary using
the `dict()` function. Try it:

```python
>>> items
dict_items([('name', 'AA'), ('shares', 75), ('price', 32.2), ('date', (6, 11, 2007))])
>>> d = dict(items)
>>> d
{'name': 'AA', 'shares': 75, 'price':32.2, 'date': (6, 11, 2007)}
>>>
```

[Contents](../Contents.md) \| [Previous (1.6 Files)](../01_Introduction/06_Files.md) \| [Next (2.2 Containers)](02_Containers.md)

## 关联来源

- [[summaries/01_Datatypes]]
