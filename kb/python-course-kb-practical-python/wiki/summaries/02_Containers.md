---
doc_type: short
full_text: sources/02_Containers.md
---

# 02_Containers 总结

本文介绍 Python 中三类核心Python容器：列表、字典和集合，并通过股票投资组合与价格数据的读取练习，展示如何选择合适的数据结构来组织、查询和计算数据。

## 核心主题

程序经常需要处理大量对象，例如：

- 股票投资组合
- 股票价格表
- 多行 CSV 数据记录

Python 常用的三种容器选择是：

| 容器 | 特点 | 典型用途 |
|---|---|---|
| `list` | 有序，可包含任意对象 | 保存顺序重要的记录集合 |
| `dict` | 通过键快速查找值 | 根据名称、编号等键查询数据 |
| `set` | 无序、元素唯一 | 成员测试、去重、集合运算 |

## 列表作为容器

当数据顺序重要时，应使用列表。列表可以保存任意对象，包括元组、字典等复合结构。

示例：用列表保存股票持仓，每条记录是一个元组：

```python
portfolio = [
    ('GOOG', 100, 490.1),
    ('IBM', 50, 91.3),
    ('CAT', 150, 83.44)
]
```

可以通过整数索引访问：

```python
portfolio[0]   # ('GOOG', 100, 490.1)
portfolio[2]   # ('CAT', 150, 83.44)
```

## 构造列表

列表通常从空列表开始，通过 `.append()` 添加元素：

```python
records = []
records.append(('GOOG', 100, 490.10))
records.append(('IBM', 50, 91.3))
```

从文件读取 CSV 数据时，可以逐行解析并追加到列表中：

```python
records = []

with open('Data/portfolio.csv', 'rt') as f:
    next(f)  # 跳过表头
    for line in f:
        row = line.split(',')
        records.append((row[0], int(row[1]), float(row[2])))
```

这一模式是后续练习中 `read_portfolio(filename)` 的基础。

## 字典作为容器

字典适合需要根据键进行快速随机查找的场景。例如，用股票代码查找价格：

```python
prices = {
   'GOOG': 513.25,
   'CAT': 87.22,
   'IBM': 93.37,
   'MSFT': 44.12
}
```

访问方式：

```python
prices['IBM']
prices['GOOG']
```

与列表通过整数位置访问不同，字典通过具有语义的键访问，常让代码更清晰。

## 构造字典

字典可以从空字典开始构造：

```python
prices = {}
prices['GOOG'] = 513.25
prices['CAT'] = 87.22
prices['IBM'] = 93.37
```

从文件读取价格数据时，可以将股票名作为键、价格作为值：

```python
prices = {}

with open('Data/prices.csv', 'rt') as f:
    for line in f:
        row = line.split(',')
        prices[row[0]] = float(row[1])
```

文中提醒：`Data/prices.csv` 末尾可能存在空行，直接转换可能导致程序崩溃。因此读取真实文件时应处理空行或异常。这引出[[concepts/异常处理]]与数据清洗问题。

## 字典查找

可以用 `in` 判断键是否存在：

```python
if key in d:
    # 存在
else:
    # 不存在
```

也可以用 `.get()` 提供默认值，避免键不存在时报错：

```python
name = d.get(key, default)
```

示例：

```python
prices.get('IBM', 0.0)   # 93.37
prices.get('SCOX', 0.0)  # 0.0
```

这在计算投资组合当前市值时很有用，因为某些股票代码可能不在价格字典中。

## 复合键

Python 字典的键必须是不可变对象。元组可以作为字典键，因此适合表达复合索引：

```python
holidays = {
  (1, 1): 'New Years',
  (3, 14): 'Pi day',
  (9, 13): "Programmer's day",
}
```

访问时：

```python
holidays[3, 14]
```

列表、集合和字典不能作为键，因为它们是可变对象。这体现了可变性与不可变性在 Python 数据结构设计中的重要性。

## 集合

集合是无序且元素唯一的容器：

```python
tech_stocks = {'IBM', 'AAPL', 'MSFT'}
```

也可以用 `set()` 构造：

```python
tech_stocks = set(['IBM', 'AAPL', 'MSFT'])
```

集合常用于成员测试：

```python
'IBM' in tech_stocks  # True
'FB' in tech_stocks   # False
```

也常用于去重：

```python
names = ['IBM', 'AAPL', 'GOOG', 'IBM', 'GOOG', 'YHOO']
unique = set(names)
```

## 集合操作

集合支持常见的数学集合运算：

```python
unique.add('CAT')
unique.remove('YHOO')

s1 = {'a', 'b', 'c'}
s2 = {'c', 'd'}

s1 | s2   # 并集 {'a', 'b', 'c', 'd'}
s1 & s2   # 交集 {'c'}
s1 - s2   # 差集 {'a', 'b'}
```

这些操作适合用于比较不同数据源中的名称、代码或记录集合。

## 练习 2.4：元组列表表示投资组合

练习要求在 `Work/report.py` 中实现：

```python
def read_portfolio(filename):
    ...
```

该函数读取 `Data/portfolio.csv`，并返回一个由元组组成的列表：

```python
[
    ('AA', 100, 32.2),
    ('IBM', 50, 91.1),
    ...
]
```

每个元组包含：

1. 股票名
2. 股数
3. 买入价格

可以通过二维索引访问：

```python
portfolio[row][column]
```

也可以通过元组解包让代码更清晰：

```python
total = 0.0
for name, shares, price in portfolio:
    total += shares * price
```

该练习体现了CSV文件处理、数据建模和序列解包。

## 练习 2.5：字典列表表示投资组合

练习要求将每条股票记录从元组改为字典：

```python
{
    'name': 'AA',
    'shares': 100,
    'price': 32.2
}
```

整体结构变成“字典的列表”：

```python
[
    {'name': 'AA', 'shares': 100, 'price': 32.2},
    {'name': 'IBM', 'shares': 50, 'price': 91.1},
    ...
]
```

访问字段时不再依赖数字列号，而是通过字段名：

```python
portfolio[1]['shares']
```

计算总成本：

```python
total = 0.0
for s in portfolio:
    total += s['shares'] * s['price']
```

这种结构更可读，也更接近现实中的结构化记录。调试较大的列表或字典时，可以使用：

```python
from pprint import pprint
pprint(portfolio)
```

## 练习 2.6：用字典保存价格表

练习要求实现：

```python
def read_prices(filename):
    ...
```

该函数读取 `Data/prices.csv`，返回一个价格字典：

```python
{
    'IBM': 106.28,
    'MSFT': 20.89,
    ...
}
```

此结构适合根据股票代码快速查询当前价格：

```python
prices['IBM']
prices['MSFT']
```

文中特别强调 `prices.csv` 可能包含空行，使用 `csv.reader()` 时空行会产生空列表：

```python
[]
```

因此实现时需要考虑：

- 用 `if` 判断跳过无效行
- 或用 `try/except` 捕获异常

这部分是对健壮文件读取的入门实践。

## 练习 2.7：计算投资组合盈亏

最后一个练习要求把前面的两个结构结合起来：

- `read_portfolio()` 返回持仓列表
- `read_prices()` 返回当前价格字典

然后计算：

1. 投资组合原始成本
2. 当前市场价值
3. 盈利或亏损

这展示了列表与字典的互补关系：

- 列表保存多条持仓记录
- 字典根据股票代码快速查找当前价格

该模式是后续更完整报表程序的基础。

## 关键收获

- 列表适合保存有序记录集合。
- 元组可用于表示固定字段的简单记录。
- 字典适合通过语义化键访问字段或快速查找数据。
- 集合适合去重、成员测试和集合运算。
- 字典键必须是不可变对象，元组可以作为复合键。
- 真实文件输入可能包含空行或坏数据，程序需要防御性处理。
- 使用字典列表表示结构化记录通常比元组列表更易读。
- 股票投资组合示例展示了Python数据结构在实际数据处理中的组合使用。

## Related Concepts
- [[concepts/集合与集合运算]]
- [[concepts/Python-容器]]
- [[concepts/列表与序列]]
- [[concepts/字典与数据建模]]
- [[concepts/CSV-数据处理]]
- [[concepts/元组与解包]]
- [[concepts/文件读写]]
- [[concepts/上下文管理器]]
- [[concepts/Python-可变对象]]
- [[concepts/Python-不可变对象]]
- [[concepts/字符串处理]]
- [[concepts/函数]]
- [[concepts/模块与-import]]
- [[concepts/Python-交互式解释器]]
- [[concepts/测试-日志与调试]]
