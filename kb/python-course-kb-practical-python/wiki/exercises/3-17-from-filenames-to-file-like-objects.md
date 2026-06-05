---
id: practical-python-3.17
source_exercise_id: "3.17"
title: "From filenames to file-like objects"
section: "3.6 Design Discussion"
source_path: "03_Program_organization/06_Design_discussion.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 3.17: From filenames to file-like objects

> Source: Practical Python Programming, `03_Program_organization/06_Design_discussion.md`.

### Exercise 3.17: From filenames to file-like objects

You've now created a file `fileparse.py` that contained a
function `parse_csv()`.  The function worked like this:

```python
>>> import fileparse
>>> portfolio = fileparse.parse_csv('Data/portfolio.csv', types=[str,int,float])
>>>
```

Right now, the function expects to be passed a filename.  However, you
can make the code more flexible.  Modify the function so that it works
with any file-like/iterable object.  For example:

```
>>> import fileparse
>>> import gzip
>>> with gzip.open('Data/portfolio.csv.gz', 'rt') as file:
...      port = fileparse.parse_csv(file, types=[str,int,float])
...
>>> lines = ['name,shares,price', 'AA,100,34.23', 'IBM,50,91.1', 'HPE,75,45.1']
>>> port = fileparse.parse_csv(lines, types=[str,int,float])
>>>
```

In this new code, what happens if you pass a filename as before?

```
>>> port = fileparse.parse_csv('Data/portfolio.csv', types=[str,int,float])
>>> port
... look at output (it should be crazy) ...
>>>
```

Yes, you'll need to be careful.   Could you add a safety check to avoid this?

## 关联来源

- [[summaries/06_Design_discussion]]
