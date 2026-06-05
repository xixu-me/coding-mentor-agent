---
id: practical-python-1.30
source_exercise_id: "1.30"
title: "Turning a script into a function"
section: "1.7 Functions"
source_path: "01_Introduction/07_Functions.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 1.30: Turning a script into a function

> Source: Practical Python Programming, `01_Introduction/07_Functions.md`.

### Exercise 1.30: Turning a script into a function

Take the code you wrote for the `pcost.py` program in [Exercise 1.27](06_Files.md)
and turn it into a function `portfolio_cost(filename)`.  This
function takes a filename as input, reads the portfolio data in that
file, and returns the total cost of the portfolio as a float.

To use your function, change your program so that it looks something
like this:

```python
def portfolio_cost(filename):
    ...
    # Your code here
    ...

cost = portfolio_cost('Data/portfolio.csv')
print('Total cost:', cost)
```

When you run your program, you should see the same output as before.
After you’ve run your program, you can also call your function
interactively by typing this:

```bash
bash $ python3 -i pcost.py
```

This will allow you to call your function from the interactive mode.

```python
>>> portfolio_cost('Data/portfolio.csv')
44671.15
>>>
```

Being able to experiment with your code interactively is useful for
testing and debugging.

## 关联来源

- [[summaries/07_Functions]]
