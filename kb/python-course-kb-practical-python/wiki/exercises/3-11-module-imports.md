---
id: practical-python-3.11
source_exercise_id: "3.11"
title: "Module imports"
section: "3.4 Modules"
source_path: "03_Program_organization/04_Modules.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 3.11: Module imports

> Source: Practical Python Programming, `03_Program_organization/04_Modules.md`.

### Exercise 3.11: Module imports

In section 3, we created a general purpose function `parse_csv()` for
parsing the contents of CSV datafiles.

Now, we’re going to see how to use that function in other programs.
First, start in a new shell window.  Navigate to the folder where you
have all your files. We are going to import them.

Start Python interactive mode.

```shell
bash % python3
Python 3.6.1 (v3.6.1:69c0db5050, Mar 21 2017, 01:21:04)
[GCC 4.2.1 (Apple Inc. build 5666) (dot 3)] on darwin
Type "help", "copyright", "credits" or "license" for more information.
>>>
```

Once you’ve done that, try importing some of the programs you
previously wrote.  You should see their output exactly as before.
Just to emphasize, importing a module runs its code.

```python
>>> import bounce
... watch output ...
>>> import mortgage
... watch output ...
>>> import report
... watch output ...
>>>
```

If none of this works, you’re probably running Python in the wrong directory.
Now, try importing your `fileparse` module and getting some help on it.

```python
>>> import fileparse
>>> help(fileparse)
... look at the output ...
>>> dir(fileparse)
... look at the output ...
>>>
```

Try using the module to read some data:

```python
>>> portfolio = fileparse.parse_csv('Data/portfolio.csv',select=['name','shares','price'], types=[str,int,float])
>>> portfolio
... look at the output ...
>>> pricelist = fileparse.parse_csv('Data/prices.csv',types=[str,float], has_headers=False)
>>> pricelist
... look at the output ...
>>> prices = dict(pricelist)
>>> prices
... look at the output ...
>>> prices['IBM']
106.11
>>>
```

Try importing a function so that you don’t need to include the module name:

```python
>>> from fileparse import parse_csv
>>> portfolio = parse_csv('Data/portfolio.csv', select=['name','shares','price'], types=[str,int,float])
>>> portfolio
... look at the output ...
>>>
```

## 关联来源

- [[summaries/04_Modules]]
