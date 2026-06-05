---
id: practical-python-3.7
source_exercise_id: "3.7"
title: "Picking a different column delimiter"
section: "3.2 More on Functions"
source_path: "03_Program_organization/02_More_functions.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: true
skip: false
---

# Exercise 3.7: Picking a different column delimiter

> Source: Practical Python Programming, `03_Program_organization/02_More_functions.md`.

### Exercise 3.7: Picking a different column delimiter

Although CSV files are pretty common, it’s also possible that you
could encounter a file that uses a different column separator such as
a tab or space.  For example, the file `Data/portfolio.dat` looks like
this:

```csv
name shares price
"AA" 100 32.20
"IBM" 50 91.10
"CAT" 150 83.44
"MSFT" 200 51.23
"GE" 95 40.37
"MSFT" 50 65.10
"IBM" 100 70.44
```

The `csv.reader()` function allows a different column delimiter to be given as follows:

```python
rows = csv.reader(f, delimiter=' ')
```

Modify your `parse_csv()` function so that it also allows the
delimiter to be changed.

For example:

```python
>>> portfolio = parse_csv('Data/portfolio.dat', types=[str, int, float], delimiter=' ')
>>> portfolio
[{'name': 'AA', 'shares': 100, 'price': 32.2}, {'name': 'IBM', 'shares': 50, 'price': 91.1}, {'name': 'CAT', 'shares': 150, 'price': 83.44}, {'name': 'MSFT', 'shares': 200, 'price': 51.23}, {'name': 'GE', 'shares': 95, 'price': 40.37}, {'name': 'MSFT', 'shares': 50, 'price': 65.1}, {'name': 'IBM', 'shares': 100, 'price': 70.44}]
>>>
```

### Commentary

If you’ve made it this far, you’ve created a nice library function
that’s genuinely useful.  You can use it to parse arbitrary CSV files,
select out columns of interest, perform type conversions, without
having to worry too much about the inner workings of files or the
`csv` module.

[Contents](../Contents.md) \| [Previous (3.1 Scripting)](01_Script.md) \| [Next (3.3 Error Checking)](03_Error_checking.md)

## 关联来源

- [[summaries/02_More_functions]]
