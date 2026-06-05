---
id: practical-python-1.14
source_exercise_id: "1.14"
title: "String concatenation"
section: "1.4 Strings"
source_path: "01_Introduction/04_Strings.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 1.14: String concatenation

> Source: Practical Python Programming, `01_Introduction/04_Strings.md`.

### Exercise 1.14: String concatenation

Although string data is read-only, you can always reassign a variable
to a newly created string.

Try the following statement which concatenates a new symbol "GOOG" to
the end of `symbols`:

```python
>>> symbols = symbols + 'GOOG'
>>> symbols
'AAPL,IBM,MSFT,YHOO,SCOGOOG'
>>>
```

Oops!  That's not what you wanted. Fix it so that the `symbols` variable holds the value `'AAPL,IBM,MSFT,YHOO,SCO,GOOG'`.

```python
>>> symbols = ?
>>> symbols
'AAPL,IBM,MSFT,YHOO,SCO,GOOG'
>>>
```

Add `'HPQ'` to the front the string:

```python
>>> symbols = ?
>>> symbols
'HPQ,AAPL,IBM,MSFT,YHOO,SCO,GOOG'
>>>
```

In these examples, it might look like the original string is being
modified, in an apparent violation of strings being read only.  Not
so. Operations on strings create an entirely new string each
time. When the variable name `symbols` is reassigned, it points to the
newly created string.  Afterwards, the old string is destroyed since
it's not being used anymore.

## 关联来源

- [[summaries/04_Strings]]
