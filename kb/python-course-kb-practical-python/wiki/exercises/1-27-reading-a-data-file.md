---
id: practical-python-1.27
source_exercise_id: "1.27"
title: "Reading a data file"
section: "1.6 File Management"
source_path: "01_Introduction/06_Files.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: true
skip: false
---

# Exercise 1.27: Reading a data file

> Source: Practical Python Programming, `01_Introduction/06_Files.md`.

### Exercise 1.27: Reading a data file

Now that you know how to read a file, let’s write a program to perform a simple calculation.

The columns in `portfolio.csv` correspond to the stock name, number of
shares, and purchase price of a single stock holding.  Write a program called
`pcost.py` that opens this file, reads all lines, and calculates how
much it cost to purchase all of the shares in the portfolio.

*Hint: to convert a string to an integer, use `int(s)`. To convert a string to a floating point, use `float(s)`.*

Your program should print output such as the following:

```bash
Total cost 44671.15
```

## 关联来源

- [[summaries/06_Files]]
