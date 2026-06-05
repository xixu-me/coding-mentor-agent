---
doc_type: short
full_text: sources/06_List_comprehension.md
---

# 06_List_comprehension 总结

## 核心主题

本文介绍 Python 中的列表推导式（list comprehension），说明如何用简洁表达式对序列进行转换、过滤、查询和数据提取，并进一步扩展到集合推导式与字典推导式。它延续了前文关于 [[summaries/05_Collections|集合与字典等容器]] 的内容，并为后续的数据处理、对象模型和程序结构打下基础。

## 列表推导式的基本形式

列表推导式用于从一个已有序列创建新列表。基本语法是：

```python
[expression for variable_name in sequence]
```

等价于：

```python
result = []
for variable_name in sequence:
    result.append(expression)
```

示例：

```python
a = [1, 2, 3, 4, 5]
b = [2*x for x in a]
# [2, 4, 6, 8, 10]
```

也可以对字符串列表进行转换：

```python
names = ['Elwood', 'Jake']
a = [name.lower() for name in names]
# ['elwood', 'jake']
```

这体现了 序列转换 的常见模式：对输入序列中的每个元素应用某种操作，生成一个新序列。

## 过滤数据

列表推导式可以带 `if` 条件，只保留满足条件的元素：

```python
[expression for variable_name in sequence if condition]
```

等价于：

```python
result = []
for variable_name in sequence:
    if condition:
        result.append(expression)
```

示例：

```python
a = [1, -5, 4, 2, -2, 10]
b = [2*x for x in a if x > 0]
# [2, 8, 4, 20]
```

这里同时完成了两件事：

1. 过滤：只选择 `x > 0` 的元素；
2. 转换：对每个保留元素计算 `2*x`。

这是一种典型的 数据过滤 与 数据转换 组合模式。

## 常见用途

列表推导式特别适合处理由字典组成的数据集合，例如股票投资组合数据。

### 提取字段

从一组股票记录中提取名称：

```python
stocknames = [s['name'] for s in stocks]
```

这类操作属于 字段提取：从复杂记录中抽取特定字段，形成新的列表。

### 类数据库查询

可以使用条件筛选记录：

```python
a = [s for s in stocks if s['price'] > 100 and s['shares'] > 50]
```

这类似对内存中的序列执行简单查询，是 数据查询 的基础形式。

### 与聚合函数结合

列表推导式常与 `sum()` 等函数结合完成归约：

```python
cost = sum([s['shares'] * s['price'] for s in stocks])
```

这里列表推导式先把每条记录映射为金额，`sum()` 再把金额列表归约为总值。这是 映射归约 的简单示例。

## 练习重点

## Exercise 2.19：熟悉列表推导式语法

示例：

```python
nums = [1, 2, 3, 4]
squares = [x * x for x in nums]
# [1, 4, 9, 16]

twice = [2 * x for x in nums if x > 2]
# [6, 8]
```

该练习强调列表推导式会生成一个新列表，而不是原地修改原列表。

## Exercise 2.20：序列归约

使用单条语句计算投资组合成本：

```python
portfolio = read_portfolio('Data/portfolio.csv')
cost = sum([s['shares'] * s['price'] for s in portfolio])
# 44671.15
```

使用当前市场价格计算投资组合当前价值：

```python
value = sum([s['shares'] * prices[s['name']] for s in portfolio])
# 28686.1
```

这两个例子展示了“先映射、后归约”的模式：

```python
[s['shares'] * s['price'] for s in portfolio]
```

生成每一项持仓成本，然后：

```python
sum(...)
```

将所有成本汇总。

相关概念：映射归约、序列归约、投资组合数据处理。

## Exercise 2.21：数据查询

本文展示了多个基于投资组合数据的查询示例。

### 查询持股数超过 100 的记录

```python
more100 = [s for s in portfolio if s['shares'] > 100]
```

### 查询名称为 MSFT 或 IBM 的持仓

```python
msftibm = [s for s in portfolio if s['name'] in {'MSFT', 'IBM'}]
```

这里使用集合 `{'MSFT', 'IBM'}` 作为成员测试目标，体现了 集合成员测试 的便利性。

### 查询总成本超过 10000 美元的持仓

```python
cost10k = [s for s in portfolio if s['shares'] * s['price'] > 10000]
```

这些例子说明列表推导式可以作为一种轻量级的数据查询工具，在无需数据库的情况下快速筛选内存数据。

## Exercise 2.22：数据提取、集合推导式与字典推导式

### 提取元组列表

从投资组合中构造 `(name, shares)` 元组列表：

```python
name_shares = [(s['name'], s['shares']) for s in portfolio]
```

结果类似：

```python
[('AA', 100), ('IBM', 50), ('CAT', 150), ('MSFT', 200), ...]
```

### 集合推导式

如果把方括号换成花括号，并且只生成值，就得到集合推导式：

```python
names = {s['name'] for s in portfolio}
```

它会生成唯一股票名称集合：

```python
{'AA', 'GE', 'IBM', 'MSFT', 'CAT'}
```

集合推导式适合去重和提取不同值，对应 集合推导式 与 去重。

### 字典推导式

如果在花括号中使用 `key: value` 形式，就得到字典推导式：

```python
holdings = {name: 0 for name in names}
```

然后可以遍历投资组合，把每只股票的总持股数累加进去：

```python
for s in portfolio:
    holdings[s['name']] += s['shares']
```

也可以用字典推导式从 `prices` 字典中筛选出投资组合涉及的价格：

```python
portfolio_prices = {name: prices[name] for name in names}
```

相关概念：字典推导式、集合推导式、字典数据建模。

## Exercise 2.23：从 CSV 文件中提取数据

本文最后展示了如何组合列表推导式和字典推导式，从 CSV 文件中选择特定列。

### 读取表头

```python
import csv
f = open('Data/portfoliodate.csv')
rows = csv.reader(f)
headers = next(rows)
# ['name', 'date', 'time', 'shares', 'price']
```

### 指定需要的列

```python
select = ['name', 'shares', 'price']
```

### 找出这些列在原 CSV 中的位置

```python
indices = [headers.index(colname) for colname in select]
# [0, 3, 4]
```

### 使用字典推导式构造记录

```python
row = next(rows)
record = {colname: row[index] for colname, index in zip(select, indices)}
```

这里 `zip(select, indices)` 把目标列名和对应索引配对，然后字典推导式用这些配对构造记录。

### 用单条语句读取剩余数据

```python
portfolio = [
    {colname: row[index] for colname, index in zip(select, indices)}
    for row in rows
]
```

这个例子展示了推导式在 CSV数据处理、字段选择 和 数据导入 中的强大表达力。不过文章也提醒：过度嵌套的推导式可能降低可读性，必要时应拆成多个步骤。

## 历史背景

列表推导式来自数学中的集合构造记号（set-builder notation）。例如：

```python
a = [x * x for x in s if x > 0]
```

对应数学形式：

```text
a = {x^2 | x ∈ s, x > 0}
```

虽然其灵感来自数学，但在日常 Python 编程中，更实用的理解是：它是一种简洁的数据处理语法。

## 实践建议

文章强调列表推导式非常常用，也很高效，适合：

- 转换列表元素；
- 过滤序列数据；
- 提取字典字段；
- 构造元组列表；
- 去重并生成集合；
- 构造字典；
- 配合 `sum()` 等函数完成归约；
- 快速处理 CSV 等半结构化数据。

但也要注意可读性：

- 推导式应尽量保持简单；
- 复杂逻辑可以拆成多个步骤；
- 不要为了炫技写出难以维护的嵌套表达式；
- 数据处理任务中也可以结合 `collections` 模块进一步简化代码。

## 关键概念

- [[concepts/列表推导式]]：用表达式从序列生成新列表。
- 集合推导式：用类似语法生成集合，常用于去重。
- 字典推导式：用 `key: value` 表达式生成字典。
- 数据过滤：通过 `if` 条件筛选序列元素。
- 数据转换：对每个元素应用表达式生成新值。
- 数据查询：在内存数据结构上执行条件筛选。
- 映射归约：先用推导式映射，再用 `sum()` 等函数归约。
- CSV数据处理：从 CSV 中选择列并构造结构化记录。
- 代码可读性：推导式虽强大，但应避免过度复杂。

## Related Concepts
- [[concepts/Python-交互式解释器]]
- [[concepts/Python-容器]]
- [[concepts/文件读写]]
- [[concepts/元组与解包]]
- [[concepts/迭代协议与生成器]]
- [[concepts/Python-运算符与表达式]]
- [[concepts/浮点数精度]]
