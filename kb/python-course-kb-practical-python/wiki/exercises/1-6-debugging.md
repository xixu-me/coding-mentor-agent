---
id: practical-python-1.6
source_exercise_id: "1.6"
title: "Debugging"
section: "1.2 A First Program"
source_path: "01_Introduction/02_Hello_world.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 1.6: Debugging

> Source: Practical Python Programming, `01_Introduction/02_Hello_world.md`.

### Exercise 1.6: Debugging

The following code fragment contains code from the Sears tower problem.  It also has a bug in it.

```python
# sears.py

bill_thickness = 0.11 * 0.001    # Meters (0.11 mm)
sears_height   = 442             # Height (meters)
num_bills      = 1
day            = 1

while num_bills * bill_thickness < sears_height:
    print(day, num_bills, num_bills * bill_thickness)
    day = days + 1
    num_bills = num_bills * 2

print('Number of days', day)
print('Number of bills', num_bills)
print('Final height', num_bills * bill_thickness)
```

Copy and paste the code that appears above in a new program called `sears.py`.
When you run the code you will get an error message that causes the
program to crash like this:

```code
Traceback (most recent call last):
  File "sears.py", line 10, in <module>
    day = days + 1
NameError: name 'days' is not defined
```

Reading error messages is an important part of Python code. If your program
crashes, the very last line of the traceback message is the actual reason why the
the program crashed. Above that, you should see a fragment of source code and then
an identifying filename and line number.

* Which line is the error?
* What is the error?
* Fix the error
* Run the program successfully


[Contents](../Contents.md) \| [Previous (1.1 Python)](01_Python.md) \| [Next (1.3 Numbers)](03_Numbers.md)

## 关联来源

- [[summaries/02_Hello_world]]
