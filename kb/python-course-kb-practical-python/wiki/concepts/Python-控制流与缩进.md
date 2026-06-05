---
sources: [summaries/06_Generators__00_Overview.md, summaries/00_Overview.md, summaries/04_Sequences.md, summaries/05_Lists.md, summaries/03_Numbers.md, summaries/02_Hello_world.md]
brief: Python 控制流用条件、循环和缩进组织程序执行路径与代码块归属。
---

# Python 控制流与缩进

Python 控制流用于决定程序中哪些语句会被执行、何时执行以及重复执行多少次；缩进则是 Python 表示代码块归属关系的核心语法机制。二者密切相关：在 `if`、`while` 等控制语句后，缩进的语句块就是受该控制结构管理的代码。相关入门示例见 [[summaries/02_Hello_world]]，数字计算和贷款循环示例见 [[summaries/03_Numbers]]。

## 控制流的基本作用

默认情况下，Python 程序按从上到下的顺序逐条执行语句：

```python
a = 3 + 4
b = a * 2
print(b)
```

控制流语句会改变这种简单的顺序执行方式，例如：

- 使用 `while` 在条件成立时重复执行一组语句；
- 使用 `if` / `elif` / `else` 根据条件选择执行路径；
- 使用 `and`、`or`、`not` 组合更复杂的条件；
- 使用 `pass` 表示一个暂时为空的代码块。

这些机制构成了 Python 程序逻辑的基础，也与 Python基础语法、循环控制、条件控制、Python比较运算 和 布尔表达式 密切相关。

## 条件表达式与比较运算

控制流通常依赖布尔条件。Python 中常见的数字比较运算符包括：

```python
x < y      # 小于
x <= y     # 小于等于
x > y      # 大于
x >= y     # 大于等于
x == y     # 等于
x != y     # 不等于
```

这些比较表达式的结果是布尔值 `True` 或 `False`。例如：

```python
if principal > 0:
    print('loan still active')
```

如果 `principal > 0` 为真，缩进的语句会被执行；否则跳过。

Python 还可以用逻辑运算符组合条件：

- `and`：两个条件都为真时整体为真；
- `or`：至少一个条件为真时整体为真；
- `not`：取反。

例如：

```python
if b >= a and b <= c:
    print('b is between a and c')

if not (b < a or b > c):
    print('b is still between a and c')
```

这些表达式常用于控制程序分支，也常用于循环是否继续执行。相关内容见 [[summaries/03_Numbers]]、Python数字类型 和 Python真值测试。

## while 循环

`while` 语句用于在条件为真时重复执行代码块：

```python
while num_bills * bill_thickness < sears_height:
    print(day, num_bills, num_bills * bill_thickness)
    day = day + 1
    num_bills = num_bills * 2

print('Number of days', day)
```

在这个例子中，只要纸币堆高度仍小于大厦高度，循环体中的三条语句就会反复执行：

```python
    print(day, num_bills, num_bills * bill_thickness)
    day = day + 1
    num_bills = num_bills * 2
```

每轮循环都会：

1. 打印当前天数、纸币数量和总高度；
2. 将 `day` 增加 1；
3. 将 `num_bills` 翻倍。

当条件不再满足时，循环结束，程序继续执行未缩进的下一条语句：

```python
print('Number of days', day)
```

这个例子来自 [[summaries/02_Hello_world]] 中的西尔斯大厦纸币问题，展示了循环、变量更新和条件判断如何共同完成一个计算过程。

## 循环中的累计计算：按揭贷款示例

[[summaries/03_Numbers]] 中的按揭贷款程序进一步展示了 `while` 循环在数值计算中的作用。程序模拟每月还款过程：只要本金仍大于 0，就继续计息、扣除月供并累计已支付金额。

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

这里的控制流逻辑是：

1. 检查 `principal > 0`；
2. 如果仍欠款，就执行循环体；
3. 循环体中更新本金和累计付款；
4. 回到循环开头再次检查条件；
5. 当本金小于或等于 0 时退出循环。

这个例子说明，循环通常需要维护一组不断变化的状态变量，例如：

- `principal`：剩余本金；
- `total_paid`：累计支付金额；
- 进一步扩展时还可以加入 `month`：已还款月份数。

这类模式也可归入 累计计算、金融计算 和 Python循环。

## if 条件语句

`if` 语句用于根据条件决定是否执行某个代码块：

```python
if a > b:
    print('Computer says no')
else:
    print('Computer says yes')
```

如果 `a > b` 为真，就执行 `if` 下方缩进的代码；否则执行 `else` 下方缩进的代码。

当需要检查多个条件时，可以使用 `elif`：

```python
if a > b:
    print('Computer says no')
elif a == b:
    print('Computer says yes')
else:
    print('Computer says maybe')
```

执行逻辑是：

1. 先检查 `if` 条件；
2. 如果不满足，再依次检查 `elif` 条件；
3. 如果所有条件都不满足，执行 `else` 代码块。

`if`、`elif`、`else` 是 Python 中最基础的条件控制结构。

## 条件分支与参数化逻辑

在贷款计算练习中，条件语句可用于判断某个月是否需要额外还款。例如：

```python
extra_payment_start_month = 61
extra_payment_end_month = 108
extra_payment = 1000

if month >= extra_payment_start_month and month <= extra_payment_end_month:
    principal = principal - extra_payment
    total_paid = total_paid + extra_payment
```

这段逻辑表示：只有当当前月份处在指定区间内，才进行额外还款。它展示了控制流在程序参数化中的作用：程序不再把“前 12 个月额外还款”这类规则写死，而是根据变量决定执行路径。

这种写法涉及多个重要主题：

- 用比较运算表达范围判断；
- 用 `and` 组合多个条件；
- 用变量参数化业务规则；
- 用 `if` 控制某段计算是否发生。

相关主题包括 参数化程序设计、Python运算符 和 边界条件。

## 缩进是 Python 语法的一部分

Python 使用缩进来表示语句分组，而不是像某些语言那样使用 `{}`。因此，缩进不仅是代码风格问题，也是语法问题。

例如：

```python
while num_bills * bill_thickness < sears_height:
    print(day, num_bills, num_bills * bill_thickness)
    day = day + 1
    num_bills = num_bills * 2

print('Number of days', day)
```

这里三条缩进语句属于 `while` 循环体，而最后一条未缩进的 `print()` 不属于循环，只会在循环结束后执行一次。

空行只影响可读性，不影响执行逻辑：

```python
    num_bills = num_bills * 2

print('Number of days', day)
```

上面的空行不会让最后的 `print()` 加入循环；真正决定归属关系的是缩进层级。

在贷款程序中同样如此：

```python
while principal > 0:
    principal = principal * (1+rate/12) - payment
    total_paid = total_paid + payment

print('Total paid', total_paid)
```

`print()` 未缩进，因此它只在整个贷款循环结束后执行一次。如果把它缩进到循环体内，就会每个月打印一次，这正是生成还款表时需要的控制流变化。

## 缩进最佳实践

[[summaries/02_Hello_world]] 给出的缩进建议包括：

- 使用空格，不使用制表符；
- 每一级缩进使用 4 个空格；
- 使用支持 Python 语法高亮和缩进辅助的编辑器；
- 同一个代码块中的缩进必须保持一致。

Python 对缩进的基本要求是：同一个代码块中的缩进必须一致。下面的代码是错误的：

```python
while num_bills * bill_thickness < sears_height:
    print(day, num_bills, num_bills * bill_thickness)
        day = day + 1 # ERROR
    num_bills = num_bills * 2
```

这里 `day = day + 1` 的缩进比同一循环体中的其他语句多，导致代码块结构不一致。

## pass：空代码块占位符

有时语法上需要一个代码块，但暂时还没有具体代码。这时可以使用 `pass`：

```python
if a > b:
    pass
else:
    print('Computer says false')
```

`pass` 是一个 no-op 语句，即“不执行任何操作”。它通常用于：

- 临时占位；
- 保持程序结构完整；
- 稍后再补充具体逻辑。

如果在需要代码块的位置完全不写内容，Python 会报错；使用 `pass` 可以明确表示“这里暂时什么都不做”。

## 控制流、变量更新与调试

控制流通常会和变量更新一起使用。例如在 `while` 循环中，如果忘记更新循环条件相关变量，可能导致无限循环；如果变量名写错，则会导致运行时错误。

在 [[summaries/02_Hello_world]] 的调试练习中，代码写成：

```python
day = days + 1
```

但 `days` 并未定义，因此运行时出现：

```text
NameError: name 'days' is not defined
```

正确写法应为：

```python
day = day + 1
```

贷款程序中也存在类似的控制流风险：

- 如果忘记减少 `principal`，`while principal > 0` 可能永远成立；
- 如果忘记增加 `month`，月份统计会错误；
- 如果最后一个月仍固定支付完整月供，可能出现本金变为负数的“多付”问题。

因此，循环中的状态更新、退出条件和边界条件必须一起检查。相关内容可连接到 调试与错误信息、Python异常与回溯 和 边界条件。

## 控制流中的边界条件

边界条件是控制流设计中很容易出错的部分。[[summaries/03_Numbers]] 的按揭贷款练习要求修正最后一个月的多付问题：当剩余本金加当月利息少于固定月供时，程序不应继续支付完整月供，而应只支付实际所需金额。

这类问题本质上是条件分支问题：

```python
if principal < payment:
    payment = principal
```

实际程序中还需要结合利息、额外还款和累计金额一起处理。关键思想是：循环退出前的最后一次迭代往往需要特殊判断，不能只依赖一般情况的计算公式。

## 常见初学者注意点

- `while` 和 `if` 行末需要冒号 `:`。
- 控制语句下面的受控代码必须缩进。
- 同一代码块中缩进必须一致。
- 未缩进的语句不属于上一层控制结构。
- 空行不改变代码块归属。
- Python 关键字必须小写，例如 `while` 正确，`WHILE` 错误。
- `pass` 可以用于暂时为空的 `if`、`else`、循环或函数体。
- 循环条件依赖的变量必须在循环中正确更新。
- 使用 `and`、`or`、`not` 组合条件时，要注意表达式的真实含义。
- 数字比较可能涉及浮点数精度问题，相关内容见 [[concepts/浮点数精度]]。

## 核心总结

Python 控制流由顺序执行、条件分支和循环重复共同组成；缩进则决定哪些语句属于同一个控制块。理解 `while`、`if`、`elif`、`else`、比较表达式、布尔逻辑与缩进规则，是编写 Python 程序的基础能力。无论是西尔斯大厦纸币问题，还是按揭贷款累计计算，核心都在于：用条件控制执行路径，用循环重复更新状态，并用缩进清楚表达代码块结构。

See also: [[summaries/05_Lists]]

See also: [[summaries/04_Sequences]]

See also: [[summaries/00_Overview]]

See also: [[summaries/06_Generators__00_Overview]]