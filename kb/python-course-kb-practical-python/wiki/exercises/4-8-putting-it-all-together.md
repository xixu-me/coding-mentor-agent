---
id: practical-python-4.8
source_exercise_id: "4.8"
title: "Putting it all together"
section: "4.2 Inheritance"
source_path: "04_Classes_objects/02_Inheritance.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 4.8: Putting it all together

> Source: Practical Python Programming, `04_Classes_objects/02_Inheritance.md`.

### Exercise 4.8: Putting it all together

Modify the `report.py` program so that the `portfolio_report()` function takes
an optional argument specifying the output format. For example:

```python
>>> report.portfolio_report('Data/portfolio.csv', 'Data/prices.csv', 'txt')
      Name     Shares      Price     Change
---------- ---------- ---------- ----------
        AA        100       9.22     -22.98
       IBM         50     106.28      15.18
       CAT        150      35.46     -47.98
      MSFT        200      20.89     -30.34
        GE         95      13.48     -26.89
      MSFT         50      20.89     -44.21
       IBM        100     106.28      35.84
>>>
```

Modify the main program so that a format can be given on the command line:

```bash
bash $ python3 report.py Data/portfolio.csv Data/prices.csv csv
Name,Shares,Price,Change
AA,100,9.22,-22.98
IBM,50,106.28,15.18
CAT,150,35.46,-47.98
MSFT,200,20.89,-30.34
GE,95,13.48,-26.89
MSFT,50,20.89,-44.21
IBM,100,106.28,35.84
bash $
```

### Discussion

Writing extensible code is one of the most common uses of inheritance
in libraries and frameworks.  For example, a framework might instruct
you to define your own object that inherits from a provided base
class.  You're then told to fill in various methods that implement
various bits of functionality.

Another somewhat deeper concept is the idea of "owning your
abstractions."  In the exercises, we defined *our own class* for
formatting a table.  You may look at your code and tell yourself "I should
just use a formatting library or something that someone else already
made instead!"  No, you should use BOTH your class and a library.
Using your own class promotes loose coupling and is more flexible.
As long as your application uses the programming interface of your class,
you can change the internal implementation to work in any way that you
want.  You can write all-custom code.  You can use someone's third
party package.  You swap out one third-party package for a different
package when you find a better one.  It doesn't matter--none of
your application code will break as long as you preserve the
interface.   That's a powerful idea and it's one of the reasons why
you might consider inheritance for something like this.

That said, designing object oriented programs can be extremely
difficult.  For more information, you should probably look for books
on the topic of design patterns (although understanding what happened
in this exercise will take you pretty far in terms of using objects in
a practically useful way).

[Contents](../Contents.md) \| [Previous (4.1 Classes)](01_Class.md) \| [Next (4.3 Special methods)](03_Special_methods.md)

## 关联来源

- [[summaries/02_Inheritance]]
