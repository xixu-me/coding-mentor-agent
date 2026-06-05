---
id: practical-python-6.8
source_exercise_id: "6.8"
title: "Setting up a simple pipeline"
section: "6.3 Producers, Consumers and Pipelines"
source_path: "06_Generators/03_Producers_consumers.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 6.8: Setting up a simple pipeline

> Source: Practical Python Programming, `06_Generators/03_Producers_consumers.md`.

### Exercise 6.8: Setting up a simple pipeline

Let's see the pipelining idea in action.  Write the following
function:

```python
>>> def filematch(lines, substr):
        for line in lines:
            if substr in line:
                yield line

>>>
```

This function is almost exactly the same as the first generator
example in the previous exercise except that it's no longer
opening a file--it merely operates on a sequence of lines given
to it as an argument.  Now, try this:

```
>>> from follow import follow
>>> lines = follow('Data/stocklog.csv')
>>> ibm = filematch(lines, 'IBM')
>>> for line in ibm:
        print(line)

... wait for output ...
```

It might take awhile for output to appear, but eventually you
should see some lines containing data for IBM.

## 关联来源

- [[summaries/03_Producers_consumers]]
