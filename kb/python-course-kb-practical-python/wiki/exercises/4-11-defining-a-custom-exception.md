---
id: practical-python-4.11
source_exercise_id: "4.11"
title: "Defining a custom exception"
section: "4.4 Defining Exceptions"
source_path: "04_Classes_objects/04_Defining_exceptions.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 4.11: Defining a custom exception

> Source: Practical Python Programming, `04_Classes_objects/04_Defining_exceptions.md`.

### Exercise 4.11: Defining a custom exception

It is often good practice for libraries to define their own exceptions.

This makes it easier to distinguish between Python exceptions raised
in response to common programming errors versus exceptions
intentionally raised by a library to a signal a specific usage
problem.

Modify the `create_formatter()` function from the last exercise so
that it raises a custom `FormatError` exception when the user provides
a bad format name.

For example:

```python
>>> from tableformat import create_formatter
>>> formatter = create_formatter('xls')
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
  File "tableformat.py", line 71, in create_formatter
    raise FormatError('Unknown table format %s' % name)
FormatError: Unknown table format xls
>>>
```

[Contents](../Contents.md) \| [Previous (4.3 Special methods)](03_Special_methods.md) \| [Next (5 Object Model)](../05_Object_model/00_Overview.md)

## 关联来源

- [[summaries/04_Defining_exceptions]]
