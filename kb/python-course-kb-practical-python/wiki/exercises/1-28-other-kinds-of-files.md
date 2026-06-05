---
id: practical-python-1.28
source_exercise_id: "1.28"
title: "Other kinds of 'files'"
section: "1.6 File Management"
source_path: "01_Introduction/06_Files.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 1.28: Other kinds of "files"

> Source: Practical Python Programming, `01_Introduction/06_Files.md`.

### Exercise 1.28: Other kinds of "files"

What if you wanted to read a non-text file such as a gzip-compressed
datafile?  The builtin `open()` function won’t help you here, but
Python has a library module `gzip` that can read gzip compressed
files.

Try it:

```python
>>> import gzip
>>> with gzip.open('Data/portfolio.csv.gz', 'rt') as f:
        for line in f:
            print(line, end='')

... look at the output ...
>>>
```

Note: Including the file mode of `'rt'` is critical here.  If you forget that,
you'll get byte strings instead of normal text strings.

### Commentary:  Shouldn't we being using Pandas for this?

Data scientists are quick to point out that libraries like
[Pandas](https://pandas.pydata.org) already have a function for
reading CSV files.  This is true--and it works pretty well.
However, this is not a course on learning Pandas. Reading files
is a more general problem than the specifics of CSV files.
The main reason we're working with a CSV file is that it's a
familiar format to most coders and it's relatively easy to work with
directly--illustrating many Python features in the process.
So, by all means use Pandas when you go back to work.  For the
rest of this course however, we're going to stick with standard
Python functionality.

[Contents](../Contents.md) \| [Previous (1.5 Lists)](05_Lists.md) \| [Next (1.7 Functions)](07_Functions.md)

## 关联来源

- [[summaries/06_Files]]
