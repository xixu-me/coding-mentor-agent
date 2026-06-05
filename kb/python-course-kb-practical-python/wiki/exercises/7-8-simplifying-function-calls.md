---
id: practical-python-7.8
source_exercise_id: "7.8"
title: "Simplifying Function Calls"
section: "7.3 Returning Functions"
source_path: "07_Advanced_Topics/03_Returning_functions.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 7.8: Simplifying Function Calls

> Source: Practical Python Programming, `07_Advanced_Topics/03_Returning_functions.md`.

### Exercise 7.8: Simplifying Function Calls

In the above example, users might find calls such as
`typedproperty('shares', int)` a bit verbose to type--especially if
they're repeated a lot.  Add the following definitions to the
`typedproperty.py` file:

```python
String = lambda name: typedproperty(name, str)
Integer = lambda name: typedproperty(name, int)
Float = lambda name: typedproperty(name, float)
```

Now, rewrite the `Stock` class to use these functions instead:

```python
class Stock:
    name = String('name')
    shares = Integer('shares')
    price = Float('price')

    def __init__(self, name, shares, price):
        self.name = name
        self.shares = shares
        self.price = price
```

Ah, that's a bit better.   The main takeaway here is that closures and `lambda`
can often be used to simplify code and eliminate annoying repetition.  This
is often good.

## 关联来源

- [[summaries/03_Returning_functions]]
