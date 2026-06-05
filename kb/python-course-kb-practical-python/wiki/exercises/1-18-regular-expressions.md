---
id: practical-python-1.18
source_exercise_id: "1.18"
title: "Regular Expressions"
section: "1.4 Strings"
source_path: "01_Introduction/04_Strings.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 1.18: Regular Expressions

> Source: Practical Python Programming, `01_Introduction/04_Strings.md`.

### Exercise 1.18: Regular Expressions

One limitation of the basic string operations is that they don't
support any kind of advanced pattern matching.  For that, you
need to turn to Python's `re` module and regular expressions.
Regular expression handling is a big topic, but here is a short
example:

```python
>>> text = 'Today is 3/27/2018. Tomorrow is 3/28/2018.'
>>> # Find all occurrences of a date
>>> import re
>>> re.findall(r'\d+/\d+/\d+', text)
['3/27/2018', '3/28/2018']
>>> # Replace all occurrences of a date with replacement text
>>> re.sub(r'(\d+)/(\d+)/(\d+)', r'\3-\1-\2', text)
'Today is 2018-3-27. Tomorrow is 2018-3-28.'
>>>
```

For more information about the `re` module, see the official documentation at
[https://docs.python.org/library/re.html](https://docs.python.org/3/library/re.html).


### Commentary

As you start to experiment with the interpreter, you often want to
know more about the operations supported by different objects.  For
example, how do you find out what operations are available on a
string?

Depending on your Python environment, you might be able to see a list
of available methods via tab-completion.  For example, try typing
this:

```python
>>> s = 'hello world'
>>> s.<tab key>
>>>
```

If hitting tab doesn't do anything, you can fall back to the
builtin-in `dir()` function.  For example:

```python
>>> s = 'hello'
>>> dir(s)
['__add__', '__class__', '__contains__', ..., 'find', 'format',
'index', 'isalnum', 'isalpha', 'isdigit', 'islower', 'isspace',
'istitle', 'isupper', 'join', 'ljust', 'lower', 'lstrip', 'partition',
'replace', 'rfind', 'rindex', 'rjust', 'rpartition', 'rsplit',
'rstrip', 'split', 'splitlines', 'startswith', 'strip', 'swapcase',
'title', 'translate', 'upper', 'zfill']
>>>
```

`dir()` produces a list of all operations that can appear after the `(.)`.
Use the `help()` command to get more information about a specific operation:

```python
>>> help(s.upper)
Help on built-in function upper:

upper(...)
    S.upper() -> string

    Return a copy of the string S converted to uppercase.
>>>
```

[Contents](../Contents.md) \| [Previous (1.3 Numbers)](03_Numbers.md) \| [Next (1.5 Lists)](05_Lists.md)

## 关联来源

- [[summaries/04_Strings]]
