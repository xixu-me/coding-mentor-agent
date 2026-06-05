---
id: practical-python-5.5
source_exercise_id: "5.5"
title: "Inheritance"
section: "5.1 Dictionaries Revisited"
source_path: "05_Object_model/01_Dicts_revisited.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 5.5: Inheritance

> Source: Practical Python Programming, `05_Object_model/01_Dicts_revisited.md`.

### Exercise 5.5: Inheritance

Make a new class that inherits from `Stock`.

```
>>> class NewStock(Stock):
        def yow(self):
            print('Yow!')

>>> n = NewStock('ACME', 50, 123.45)
>>> n.cost()
6172.50
>>> n.yow()
Yow!
>>>
```

Inheritance is implemented by extending the search process for attributes.
The `__bases__` attribute has a tuple of the immediate parents:

```python
>>> NewStock.__bases__
(<class 'stock.Stock'>,)
>>>
```

The `__mro__` attribute has a tuple of all parents, in the order that
they will be searched for attributes.

```python
>>> NewStock.__mro__
(<class '__main__.NewStock'>, <class 'stock.Stock'>, <class 'object'>)
>>>
```

Here's how the `cost()` method of instance `n` above would be found:

```python
>>> for cls in n.__class__.__mro__:
        if 'cost' in cls.__dict__:
            break

>>> cls
<class '__main__.Stock'>
>>> cls.__dict__['cost']
<function cost at 0x101aed598>
>>>
```

[Contents](../Contents.md) \| [Previous (4.4 Exceptions)](../04_Classes_objects/04_Defining_exceptions.md) \| [Next (5.2 Encapsulation)](02_Classes_encapsulation.md)

## 关联来源

- [[summaries/01_Dicts_revisited]]
