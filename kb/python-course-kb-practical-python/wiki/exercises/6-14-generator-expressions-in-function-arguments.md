---
id: practical-python-6.14
source_exercise_id: "6.14"
title: "Generator Expressions in Function Arguments"
section: "6.4 More Generators"
source_path: "06_Generators/04_More_generators.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 6.14: Generator Expressions in Function Arguments

> Source: Practical Python Programming, `06_Generators/04_More_generators.md`.

### Exercise 6.14: Generator Expressions in Function Arguments

Generator expressions are sometimes placed into function arguments.
It looks a little weird at first, but try this experiment:

```python
>>> nums = [1,2,3,4,5]
>>> sum([x*x for x in nums])    # A list comprehension
55
>>> sum(x*x for x in nums)      # A generator expression
55
>>>
```
In the above example, the second version using generators would
use significantly less memory if a large list was being manipulated.

In your `portfolio.py` file, you performed a few calculations
involving list comprehensions.  Try replacing these with
generator expressions.

## 关联来源

- [[summaries/04_More_generators]]
