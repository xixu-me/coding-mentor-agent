---
id: practical-python-7.7
source_exercise_id: "7.7"
title: "Using Closures to Avoid Repetition"
section: "7.3 Returning Functions"
source_path: "07_Advanced_Topics/03_Returning_functions.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 7.7: Using Closures to Avoid Repetition

> Source: Practical Python Programming, `07_Advanced_Topics/03_Returning_functions.md`.

### Exercise 7.7: Using Closures to Avoid Repetition

One of the more powerful features of closures is their use in
generating repetitive code.  If you refer back to [Exercise
5.7](../05_Object_model/02_Classes_encapsulation), recall the code for
defining a property with type checking.

```python
class Stock:
    def __init__(self, name, shares, price):
        self.name = name
        self.shares = shares
        self.price = price
    ...
    @property
    def shares(self):
        return self._shares

    @shares.setter
    def shares(self, value):
        if not isinstance(value, int):
            raise TypeError('Expected int')
        self._shares = value
    ...
```

Instead of repeatedly typing that code over and over again, you can
automatically create it using a closure.

Make a file `typedproperty.py` and put the following code in
it:

```python
# typedproperty.py

def typedproperty(name, expected_type):
    private_name = '_' + name
    @property
    def prop(self):
        return getattr(self, private_name)

    @prop.setter
    def prop(self, value):
        if not isinstance(value, expected_type):
            raise TypeError(f'Expected {expected_type}')
        setattr(self, private_name, value)

    return prop
```

Now, try it out by defining a class like this:

```python
from typedproperty import typedproperty

class Stock:
    name = typedproperty('name', str)
    shares = typedproperty('shares', int)
    price = typedproperty('price', float)

    def __init__(self, name, shares, price):
        self.name = name
        self.shares = shares
        self.price = price
```

Try creating an instance and verifying that type-checking works.

```python
>>> s = Stock('IBM', 50, 91.1)
>>> s.name
'IBM'
>>> s.shares = '100'
... should get a TypeError ...
>>>
```

## 关联来源

- [[summaries/03_Returning_functions]]
