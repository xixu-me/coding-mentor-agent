---
id: practical-python-1.7
source_exercise_id: "1.7"
title: "Dave's mortgage"
section: "1.3 Numbers"
source_path: "01_Introduction/03_Numbers.md"
source_repo: "https://github.com/dabeaz-course/practical-python"
source_commit: "93dca856b41c61a0a0f85ae334116e4c125629ea"
student_visible_solution: false
has_private_solution: false
skip: false
---

# Exercise 1.7: Dave's mortgage

> Source: Practical Python Programming, `01_Introduction/03_Numbers.md`.

### Exercise 1.7: Dave's mortgage

Dave has decided to take out a 30-year fixed rate mortgage of $500,000
with Guido’s Mortgage, Stock Investment, and Bitcoin trading
corporation.  The interest rate is 5% and the monthly payment is
$2684.11.

Here is a program that calculates the total amount that Dave will have
to pay over the life of the mortgage:

```python
# mortgage.py

principal = 500000.0
rate = 0.05
payment = 2684.11
total_paid = 0.0

while principal > 0:
    principal = principal * (1+rate/12) - payment
    total_paid = total_paid + payment

print('Total paid', total_paid)
```

Enter this program and run it. You should get an answer of `966,279.6`.

## 关联来源

- [[summaries/03_Numbers]]
