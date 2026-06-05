---
doc_type: short
full_text: sources/03_Numbers.md
---

# 03_Numbers 总结

本文是 Practical Python 第 1.3 节，围绕 Python 中的数字计算展开，介绍数字类型、常见算术与比较运算、类型转换，并通过按揭贷款程序练习巩固循环、累计和数值计算。

## 核心内容

### Python 的四类数字

Python 主要有四种数字相关类型：

- 布尔值 `bool`
- 整数 `int`
- 浮点数 `float`
- 复数 `complex`

本节重点讲解前三类。

## 布尔值 `bool`

布尔值只有两个取值：

```python
a = True
b = False
```

在数值上下文中，`True` 会被当作 `1`，`False` 会被当作 `0`：

```python
c = 4 + True   # 5
d = False
if d == 0:
    print('d is False')
```

但文档特别提醒：虽然布尔值可以像整数一样参与计算，但不推荐写这种代码，因为可读性较差。相关主题可整理为 Python布尔值 和 Python数字类型。

## 整数 `int`

Python 整数支持任意大小的有符号值，并支持多种进制写法：

```python
a = 37
b = -299392993727716627377128481812241231
c = 0x7fa8      # 十六进制
d = 0o253       # 八进制
e = 0b10001111  # 二进制
```

常见整数运算包括：

- 加减乘除：`+`、`-`、`*`、`/`
- 整除：`//`
- 取模：`%`
- 幂运算：`**`
- 位运算：`<<`、`>>`、`&`、`|`、`^`、`~`
- 绝对值：`abs(x)`

需要注意：普通除法 `/` 总是产生浮点数；整除 `//` 会执行向下取整除法。相关主题可归入 Python运算符 和 Python整数。

## 浮点数 `float`

浮点数可以使用小数或科学计数法表示：

```python
a = 37.45
b = 4e5        # 400000.0
c = -1.345e-10
```

Python 浮点数使用底层 CPU 的双精度 IEEE 754 表示方式，与 C 语言中的 `double` 类似：

- 大约 17 位精度
- 指数范围约为 `-308` 到 `308`

### 浮点数是不精确的

文档强调，浮点数表示十进制小数时可能不精确：

```python
>>> a = 2.1 + 4.2
>>> a == 6.3
False
>>> a
6.300000000000001
```

这不是 Python 特有的问题，而是底层浮点硬件表示方式导致的。这个主题适合扩展为 [[concepts/浮点数精度]]。

浮点数支持的常见运算与整数类似，但不包括位运算：

- `+`、`-`、`*`、`/`
- `//`
- `%`
- `**`
- `abs(x)`

更多数学函数位于 `math` 模块中：

```python
import math
math.sqrt(x)
math.sin(x)
math.cos(x)
math.tan(x)
math.log(x)
```

相关主题可链接到 Python标准库math模块。

## 数字比较与布尔表达式

数字支持常见关系运算符：

```python
x < y
x <= y
x > y
x >= y
x == y
x != y
```

可以使用逻辑运算符组合复杂条件：

- `and`
- `or`
- `not`

示例：

```python
if b >= a and b <= c:
    print('b is between a and c')

if not (b < a or b > c):
    print('b is still between a and c')
```

这部分与 Python条件判断、布尔表达式 和 Python比较运算 相关。

## 数字类型转换

可以使用类型名进行转换：

```python
a = int(x)
b = float(x)
```

示例：

```python
>>> a = 3.14159
>>> int(a)
3
>>> b = '3.14159'
>>> float(b)
3.14159
```

`int()` 会将浮点数截断为整数；`float()` 可以将包含合法数字格式的字符串转换为浮点数。相关主题可整理为 Python类型转换。

## 练习：按揭贷款计算

本节练习围绕 `mortgage.py` 展开，通过一个 30 年固定利率按揭贷款案例练习数值计算。

初始条件：

- 本金：`500000.0`
- 年利率：`0.05`
- 月供：`2684.11`
- 每月按 `rate / 12` 计息

基础程序：

```python
principal = 500000.0
rate = 0.05
payment = 2684.11
total_paid = 0.0

while principal > 0:
    principal = principal * (1+rate/12) - payment
    total_paid = total_paid + payment

print('Total paid', total_paid)
```

运行结果应为总支付金额 `966,279.6`。

这个例子体现了 Python循环、累计计算 和 金融计算。

### Exercise 1.8：额外还款

假设 Dave 在前 12 个月每月额外还款 `$1000`，需要修改程序：

- 计算新的总支付金额
- 计算还清贷款所需月份数

期望结果：

- 总支付：`929,965.62`
- 月数：`342`

### Exercise 1.9：通用额外还款计算器

进一步将额外还款参数化：

```python
extra_payment_start_month = 61
extra_payment_end_month = 108
extra_payment = 1000
```

程序需要根据这些变量决定哪些月份额外还款。问题是：如果 Dave 在还款五年后开始，连续四年每月额外还 `$1000`，最终需要支付多少？

这体现了将硬编码逻辑改造成可配置程序的思想，可链接到 参数化程序设计。

### Exercise 1.10：输出还款表

要求程序输出每个月的：

- 月份
- 累计支付金额
- 剩余本金

示例输出：

```text
1 2684.11 499399.22
2 5368.22 498795.94
...
310 880074.1 -1871.53
Total paid 880074.1
Months 310
```

这个练习强化了循环中的状态更新与格式化输出，可关联 表格输出 和 Python循环。

### Exercise 1.11：修正最后一个月的多付问题

在贷款最后一个月，固定月供可能超过剩余本金加当月利息，导致程序显示负本金。练习要求修正这个“最后一月多付”的问题，使总支付金额更准确。

这一点与金融计算中的边界条件处理相关，可归入 边界条件。

### Exercise 1.12：`bool("False")` 的谜题

文档最后提出问题：

```python
>>> bool("False")
True
```

虽然字符串内容是 `"False"`，但它是一个非空字符串，因此转换为布尔值时结果为 `True`。这说明 `bool()` 判断的是对象的真值，而不是解析字符串的语义内容。

相关主题可整理为 Python真值测试 和 Python类型转换。

## 关键收获

- Python 数字类型包括布尔值、整数、浮点数和复数。
- `bool` 在数值上对应 `1` 和 `0`，但不应滥用于算术表达式。
- Python 整数支持任意精度和多种进制表示。
- `/` 产生浮点数，`//` 表示整除。
- 浮点数基于 IEEE 754，不能精确表示所有十进制小数。
- 数字可以使用关系运算符比较，并可用 `and`、`or`、`not` 组合条件。
- `int()`、`float()`、`bool()` 等类型名可用于类型转换，但不同类型转换规则不同。
- 按揭贷款练习展示了循环、累计变量、条件逻辑、参数化和边界条件处理。

## Related Concepts
- [[concepts/Python-运算符与表达式]]
- [[concepts/变量与数据类型]]
- [[concepts/Python-控制流与缩进]]
- [[concepts/Python-交互式解释器]]
- [[concepts/Python-输入输出]]
- [[concepts/模块与-import]]
- [[concepts/课程练习工作流]]
