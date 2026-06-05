---
id: practical-python-1.33
source_exercise_id: "1.33"
title: "Reading from the command line"
section: "1.7 Functions"
source_path: "01_Introduction/07_Functions.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: true
skip: false
---

# Exercise 1.33: Reading from the command line

> Source: Practical Python Programming, `01_Introduction/07_Functions.md`.

### Exercise 1.33: Reading from the command line

In the `pcost.py` program, the name of the input file has been hardwired into the code:

```python
# pcost.py

def portfolio_cost(filename):
    ...
    # Your code here
    ...

cost = portfolio_cost('Data/portfolio.csv')
print('Total cost:', cost)
```

That’s fine for learning and testing, but in a real program you
probably wouldn’t do that.

Instead, you might pass the name of the file in as an argument to a
script. Try changing the bottom part of the program as follows:

```python
# pcost.py
import sys

def portfolio_cost(filename):
    ...
    # Your code here
    ...

if len(sys.argv) == 2:
    filename = sys.argv[1]
else:
    filename = 'Data/portfolio.csv'

cost = portfolio_cost(filename)
print('Total cost:', cost)
```

`sys.argv` is a list that contains passed arguments on the command line (if any).

To run your program, you’ll need to run Python from the
terminal.

For example, from bash on Unix:

```bash
bash % python3 pcost.py Data/portfolio.csv
Total cost: 44671.15
bash %
```

[Contents](../Contents.md) \| [Previous (1.6 Files)](06_Files.md) \| [Next (2.0 Working with Data)](../02_Working_with_data/00_Overview.md)

## 关联来源

- [[summaries/07_Functions]]
