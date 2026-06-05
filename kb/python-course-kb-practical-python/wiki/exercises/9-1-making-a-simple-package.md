---
id: practical-python-9.1
source_exercise_id: "9.1"
title: "Making a simple package"
section: "9.1 Packages"
source_path: "09_Packages/01_Packages.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 9.1: Making a simple package

> Source: Practical Python Programming, `09_Packages/01_Packages.md`.

### Exercise 9.1: Making a simple package

Make a directory called `porty/` and put all of the above Python
files into it.  Additionally create an empty `__init__.py` file and
put it in the directory.  You should have a directory of files
like this:

```
porty/
    __init__.py
    fileparse.py
    follow.py
    pcost.py
    portfolio.py
    report.py
    stock.py
    tableformat.py
    ticker.py
    typedproperty.py
```

Remove the file `__pycache__` that's sitting in your directory.  This
contains pre-compiled Python modules from before.  We want to start
fresh.

Try importing some of package modules:

```python
>>> import porty.report
>>> import porty.pcost
>>> import porty.ticker
```

If these imports fail, go into the appropriate file and fix the
module imports to include a package-relative import.   For example,
a statement such as `import fileparse` might change to the
following:

```
# report.py
from . import fileparse
...
```

If you have a statement such as `from fileparse import parse_csv`, change
the code to the following:

```
# report.py
from .fileparse import parse_csv
...
```

## 关联来源

- [[summaries/01_Packages]]
