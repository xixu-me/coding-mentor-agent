---
id: practical-python-2.11
source_exercise_id: "2.11"
title: "Adding some headers"
section: "2.3 Formatting"
source_path: "02_Working_with_data/03_Formatting.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: true
skip: false
---

# Exercise 2.11: Adding some headers

> Source: Practical Python Programming, `02_Working_with_data/03_Formatting.md`.

### Exercise 2.11: Adding some headers

Suppose you had a tuple of header names like this:

```python
headers = ('Name', 'Shares', 'Price', 'Change')
```

Add code to your program that takes the above tuple of headers and
creates a string where each header name is right-aligned in a
10-character wide field and each field is separated by a single space.

```python
'      Name     Shares      Price      Change'
```

Write code that takes the headers and creates the separator string between the headers and data to follow.
This string is just a bunch of "-" characters under each field name. For example:

```python
'---------- ---------- ---------- -----------'
```

When you’re done, your program should produce the table shown at the top of this exercise.

```
      Name     Shares      Price     Change
---------- ---------- ---------- ----------
        AA        100       9.22     -22.98
       IBM         50     106.28      15.18
       CAT        150      35.46     -47.98
      MSFT        200      20.89     -30.34
        GE         95      13.48     -26.89
      MSFT         50      20.89     -44.21
       IBM        100     106.28      35.84
```

## 关联来源

- [[summaries/03_Formatting]]
