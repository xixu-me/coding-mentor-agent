---
id: practical-python-8.3
source_exercise_id: "8.3"
title: "Adding Logging to a Program"
section: "8.2 Logging"
source_path: "08_Testing_debugging/02_Logging.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 8.3: Adding Logging to a Program

> Source: Practical Python Programming, `08_Testing_debugging/02_Logging.md`.

### Exercise 8.3: Adding Logging to a Program

To add logging to an application, you need to have some mechanism to
initialize the logging module in the main module.  One way to
do this is to include some setup code that looks like this:

```
# This file sets up basic configuration of the logging module.
# Change settings here to adjust logging output as needed.
import logging
logging.basicConfig(
    filename = 'app.log',            # Name of the log file (omit to use stderr)
    filemode = 'w',                  # File mode (use 'a' to append)
    level    = logging.WARNING,      # Logging level (DEBUG, INFO, WARNING, ERROR, or CRITICAL)
)
```

Again, you'd need to put this someplace in the startup steps of your
program.  For example, where would you put this in your `report.py` program?

[Contents](../Contents.md) \| [Previous (8.1 Testing)](01_Testing.md) \| [Next (8.3 Debugging)](03_Debugging.md)

## 关联来源

- [[summaries/02_Logging]]
