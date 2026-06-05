---
id: practical-python-1.16
source_exercise_id: "1.16"
title: "String Methods"
section: "1.4 Strings"
source_path: "01_Introduction/04_Strings.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 1.16: String Methods

> Source: Practical Python Programming, `01_Introduction/04_Strings.md`.

### Exercise 1.16: String Methods

At the Python interactive prompt, try experimenting with some of the string methods.

```python
>>> symbols.lower()
?
>>> symbols
?
>>>
```

Remember, strings are always read-only.  If you want to save the result of an operation, you need to place it in a variable:

```python
>>> lowersyms = symbols.lower()
>>>
```

Try some more operations:

```python
>>> symbols.find('MSFT')
?
>>> symbols[13:17]
?
>>> symbols = symbols.replace('SCO','DOA')
>>> symbols
?
>>> name = '   IBM   \n'
>>> name = name.strip()    # Remove surrounding whitespace
>>> name
?
>>>
```

## 关联来源

- [[summaries/04_Strings]]
