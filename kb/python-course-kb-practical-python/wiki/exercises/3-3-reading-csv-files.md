---
id: practical-python-3.3
source_exercise_id: "3.3"
title: "Reading CSV Files"
section: "3.2 More on Functions"
source_path: "03_Program_organization/02_More_functions.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 3.3: Reading CSV Files

> Source: Practical Python Programming, `03_Program_organization/02_More_functions.md`.

### Exercise 3.3: Reading CSV Files

To start, let’s just focus on the problem of reading a CSV file into a
list of dictionaries.  In the file `fileparse.py`, define a
function that looks like this:

```python
# fileparse.py
import csv

def parse_csv(filename):
    '''
    Parse a CSV file into a list of records
    '''
    with open(filename) as f:
        rows = csv.reader(f)

        # Read the file headers
        headers = next(rows)
        records = []
        for row in rows:
            if not row:    # Skip rows with no data
                continue
            record = dict(zip(headers, row))
            records.append(record)

    return records
```

This function reads a CSV file into a list of dictionaries while
hiding the details of opening the file, wrapping it with the `csv`
module, ignoring blank lines, and so forth.

Try it out:

Hint: `python3 -i fileparse.py`.

```python
>>> portfolio = parse_csv('Data/portfolio.csv')
>>> portfolio
[{'price': '32.20', 'name': 'AA', 'shares': '100'}, {'price': '91.10', 'name': 'IBM', 'shares': '50'}, {'price': '83.44', 'name': 'CAT', 'shares': '150'}, {'price': '51.23', 'name': 'MSFT', 'shares': '200'}, {'price': '40.37', 'name': 'GE', 'shares': '95'}, {'price': '65.10', 'name': 'MSFT', 'shares': '50'}, {'price': '70.44', 'name': 'IBM', 'shares': '100'}]
>>>
```

This is good except that you can’t do any kind of useful calculation
with the data because everything is represented as a string.  We’ll
fix this shortly, but let’s keep building on it.

## 关联来源

- [[summaries/02_More_functions]]
