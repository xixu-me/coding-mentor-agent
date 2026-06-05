---
id: practical-python-3.2
source_exercise_id: "3.2"
title: "Creating a top-level function for program execution"
section: "3.1 Scripting"
source_path: "03_Program_organization/01_Script.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: true
skip: false
---

# Exercise 3.2: Creating a top-level function for program execution

> Source: Practical Python Programming, `03_Program_organization/01_Script.md`.

### Exercise 3.2: Creating a top-level function for program execution

Take the last part of your program and package it into a single
function `portfolio_report(portfolio_filename, prices_filename)`.
Have the function work so that the following function call creates the
report as before:

```python
portfolio_report('Data/portfolio.csv', 'Data/prices.csv')
```

In this final version, your program will be nothing more than a series
of function definitions followed by a single function call to
`portfolio_report()` at the very end (which executes all of the steps
involved in the program).

By turning your program into a single function, it becomes easy to run
it on different inputs.  For example, try these statements
interactively after running your program:

```python
>>> portfolio_report('Data/portfolio2.csv', 'Data/prices.csv')
... look at the output ...
>>> files = ['Data/portfolio.csv', 'Data/portfolio2.csv']
>>> for name in files:
        print(f'{name:-^43s}')
        portfolio_report(name, 'Data/prices.csv')
        print()

... look at the output ...
>>>
```

### Commentary

Python makes it very easy to write relatively unstructured scripting code
where you just have a file with a sequence of statements in it. In the
big picture, it's almost always better to utilize functions whenever
you can.  At some point, that script is going to grow and you'll wish
you had a bit more organization.  Also, a little known fact is that Python
runs a bit faster if you use functions.

[Contents](../Contents.md) \| [Previous (2.7 Object Model)](../02_Working_with_data/07_Objects.md) \| [Next (3.2 More on Functions)](02_More_functions.md)

## 关联来源

- [[summaries/01_Script]]
