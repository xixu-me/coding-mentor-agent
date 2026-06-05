---
id: practical-python-2.23
source_exercise_id: "2.23"
title: "Extracting Data From CSV Files"
section: "2.6 List Comprehensions"
source_path: "02_Working_with_data/06_List_comprehension.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 2.23: Extracting Data From CSV Files

> Source: Practical Python Programming, `02_Working_with_data/06_List_comprehension.md`.

### Exercise 2.23: Extracting Data From CSV Files

Knowing how to use various combinations of list, set, and dictionary
comprehensions can be useful in various forms of data processing.
Here’s an example that shows how to extract selected columns from a
CSV file.

First, read a row of header information from a CSV file:

```python
>>> import csv
>>> f = open('Data/portfoliodate.csv')
>>> rows = csv.reader(f)
>>> headers = next(rows)
>>> headers
['name', 'date', 'time', 'shares', 'price']
>>>
```

Next, define a variable that lists the columns that you actually care about:

```python
>>> select = ['name', 'shares', 'price']
>>>
```

Now, locate the indices of the above columns in the source CSV file:

```python
>>> indices = [ headers.index(colname) for colname in select ]
>>> indices
[0, 3, 4]
>>>
```

Finally, read a row of data and turn it into a dictionary using a
dictionary comprehension:

```python
>>> row = next(rows)
>>> record = { colname: row[index] for colname, index in zip(select, indices) }   # dict-comprehension
>>> record
{'price': '32.20', 'name': 'AA', 'shares': '100'}
>>>
```

If you’re feeling comfortable with what just happened, read the rest
of the file:

```python
>>> portfolio = [ { colname: row[index] for colname, index in zip(select, indices) } for row in rows ]
>>> portfolio
[{'price': '91.10', 'name': 'IBM', 'shares': '50'}, {'price': '83.44', 'name': 'CAT', 'shares': '150'},
  {'price': '51.23', 'name': 'MSFT', 'shares': '200'}, {'price': '40.37', 'name': 'GE', 'shares': '95'},
  {'price': '65.10', 'name': 'MSFT', 'shares': '50'}, {'price': '70.44', 'name': 'IBM', 'shares': '100'}]
>>>
```

Oh my, you just reduced much of the `read_portfolio()` function to a single statement.

### Commentary

List comprehensions are commonly used in Python as an efficient means
for transforming, filtering, or collecting data.  Due to the syntax,
you don’t want to go overboard—try to keep each list comprehension as
simple as possible.  It’s okay to break things into multiple
steps. For example, it’s not clear that you would want to spring that
last example on your unsuspecting co-workers.

That said, knowing how to quickly manipulate data is a skill that’s
incredibly useful.  There are numerous situations where you might have
to solve some kind of one-off problem involving data imports, exports,
extraction, and so forth.  Becoming a guru master of list
comprehensions can substantially reduce the time spent devising a
solution.  Also, don't forget about the `collections` module.

[Contents](../Contents.md) \| [Previous (2.5 Collections)](05_Collections.md) \| [Next (2.7 Object Model)](07_Objects.md)

## 关联来源

- [[summaries/06_List_comprehension]]
