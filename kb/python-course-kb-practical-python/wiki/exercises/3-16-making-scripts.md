---
id: practical-python-3.16
source_exercise_id: "3.16"
title: "Making Scripts"
section: "3.5 Main Module"
source_path: "03_Program_organization/05_Main_module.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: true
skip: false
---

# Exercise 3.16: Making Scripts

> Source: Practical Python Programming, `03_Program_organization/05_Main_module.md`.

### Exercise 3.16: Making Scripts

Modify the `report.py` and `pcost.py` programs so that they can
execute as a script on the command line:

```bash
bash $ python3 report.py Data/portfolio.csv Data/prices.csv
      Name     Shares      Price     Change
---------- ---------- ---------- ----------
        AA        100       9.22     -22.98
       IBM         50     106.28      15.18
       CAT        150      35.46     -47.98
      MSFT        200      20.89     -30.34
        GE         95      13.48     -26.89
      MSFT         50      20.89     -44.21
       IBM        100     106.28      35.84

bash $ python3 pcost.py Data/portfolio.csv
Total cost: 44671.15
```

[Contents](../Contents.md) \| [Previous (3.4 Modules)](04_Modules.md) \| [Next (3.6 Design Discussion)](06_Design_discussion.md)

## 关联来源

- [[summaries/05_Main_module]]
