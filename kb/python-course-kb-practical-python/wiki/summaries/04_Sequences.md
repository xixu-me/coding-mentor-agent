---
doc_type: short
full_text: sources/04_Sequences.md
---

# 04_Sequences 总结

本文介绍 Python 中的Python序列及其常见操作，包括字符串、列表、元组、切片、循环遍历、`range()`、`enumerate()`、元组解包与 `zip()`。重点是如何用更 Pythonic 的方式处理有序数据，尤其是在 CSV 数据处理中利用表头构造字典，从而写出更通用的程序。

## 序列数据类型

Python 有三种常见的序列类型：

- 字符串：如 `'Hello'`，是字符序列。
- 列表：如 `[1, 4, 5]`。
- 元组：如 `('GOOG', 100, 490.1)`。

所有序列都具有以下共同特征：

- 有序。
- 可用整数索引访问元素。
- 可用 `len()` 获取长度。
- 支持负索引，例如 `b[-1]` 表示最后一个元素。

序列还支持复制与连接：

- `s * n`：复制序列。
- `s + t`：连接同类型序列。

需要注意，序列连接要求两边类型相同。例如元组只能与元组连接，不能直接与列表连接。

## 切片

Python切片用于从序列中提取子序列，语法为：

```python
s[start:end]
```

关键规则：

- `start` 和 `end` 是整数索引。
- 切片包含 `start`，不包含 `end`，类似数学中的半开区间。
- 省略 `start` 时默认为序列开头。
- 省略 `end` 时默认为序列结尾。

示例：

```python
a = [0,1,2,3,4,5,6,7,8]

a[2:5]    # [2,3,4]
a[-5:]    # [4,5,6,7,8]
a[:3]     # [0,1,2]
```

## 列表的切片赋值与删除

列表支持对切片重新赋值或删除：

```python
a = [0,1,2,3,4,5,6,7,8]
a[2:4] = [10,11,12]
```

切片赋值不要求新旧片段长度相同，因此可以改变列表长度。

删除切片：

```python
del a[2:4]
```

这体现了列表作为可变序列的特点，而字符串和元组则不可变。

## 序列归约操作

一些内置函数可以把序列归约为单个值：

- `sum(s)`：求和。
- `min(s)`：最小值。
- `max(s)`：最大值。

这些函数不仅可用于数字列表，也可用于字符串列表等可比较对象。例如字符串会按字典序比较。

## 遍历序列

`for` 循环可以直接遍历序列中的元素：

```python
for x in s:
    ...
```

每次迭代时，当前元素会赋给迭代变量。循环结束后，迭代变量仍保留最后一次的值。

本文强调：如果只是遍历元素，应直接使用 `for x in data`，不要写成：

```python
for n in range(len(data)):
    print(data[n])
```

这种写法不够 Pythonic，效率较低，也更难阅读。若需要索引，应使用 `enumerate()`。

## break 与 continue

`break` 用于提前退出循环：

```python
for name in namelist:
    if name == 'Jake':
        break
```

`break` 只退出最内层循环。

`continue` 用于跳过当前元素，进入下一次迭代：

```python
for line in lines:
    if line == '\n':
        continue
```

这常用于忽略空行、无效数据或不需要处理的元素。

## range()：整数序列迭代

如果需要计数，应使用 `range()`：

```python
for i in range(100):
    ...
```

语法：

```python
range([start,] end [,step])
```

规则：

- `end` 不包含在结果中，与切片规则一致。
- `start` 可选，默认是 `0`。
- `step` 可选，默认是 `1`。
- `range()` 按需生成值，不会实际存储完整的大范围数字。

示例：

```python
range(100)       # 0 到 99
range(10, 20)    # 10 到 19
range(10, 50, 2) # 10, 12, ..., 48
```

## enumerate()：带计数器的遍历

enumerate函数用于在遍历序列时同时获得索引和值：

```python
names = ['Elwood', 'Jake', 'Curtis']
for i, name in enumerate(names):
    ...
```

通用形式：

```python
enumerate(sequence, start=0)
```

`start` 可指定计数起点。典型用途是在读取文件时跟踪行号：

```python
with open(filename) as f:
    for lineno, line in enumerate(f, start=1):
        ...
```

这比手动维护计数器更简洁，也略快。

## 多变量迭代与元组解包

如果序列中的元素是元组，可以在 `for` 循环中直接解包：

```python
points = [(1, 4), (10, 40), (23, 14)]

for x, y in points:
    ...
```

每个元组会被拆分到多个迭代变量中。变量数量必须与元组元素数量一致。

这属于Python解包的重要应用。

## zip()：组合多个序列

zip函数用于把多个序列按位置组合成元组迭代器：

```python
columns = ['name', 'shares', 'price']
values = ['GOOG', 100, 490.1]
pairs = zip(columns, values)
```

得到的逻辑结果类似：

```python
('name', 'GOOG'), ('shares', 100), ('price', 490.1)
```

`zip()` 返回迭代器，需要通过循环或 `list()` 消费。

常见用法是把列名和值组合起来构造字典：

```python
d = dict(zip(columns, values))
```

这是处理 CSV 数据时非常重要的技巧。

## 使用 zip() 处理 CSV 表头

在 `Data/portfolio.csv` 中，第一行是列名：

```python
headers = next(rows)
```

如果某一行数据为：

```python
row = ['AA', '100', '32.20']
```

则可使用：

```python
record = dict(zip(headers, row))
```

得到：

```python
{'name': 'AA', 'shares': '100', 'price': '32.20'}
```

这样，程序就不再依赖固定列号，而是通过字段名读取数据：

```python
nshares = int(record['shares'])
price = float(record['price'])
```

这一改动让 `portfolio_cost()` 能处理不同列顺序、甚至额外包含日期和时间列的 CSV 文件，只要文件中存在所需字段即可。这是从“固定格式解析”走向“基于字段名解析”的重要改进，属于CSV数据处理中的核心技巧。

## 用 enumerate() 改进错误报告

在处理包含缺失值的 CSV 文件时，可以用 `enumerate(rows, start=1)` 记录行号，并在转换失败时打印更有用的错误信息：

```python
for rowno, row in enumerate(rows, start=1):
    try:
        ...
    except ValueError:
        print(f'Row {rowno}: Bad row: {row}')
```

这样可以定位坏数据所在行，例如：

```text
Row 4: Couldn't convert: ['MSFT', '', '51.23']
Row 7: Couldn't convert: ['IBM', '', '70.44']
```

这体现了[[concepts/异常处理]]与迭代工具结合后在数据清洗中的实用价值。

## 反转字典数据

字典的 `items()` 返回 `(key, value)` 对。如果想得到 `(value, key)` 对，可以结合 `values()`、`keys()` 和 `zip()`：

```python
pricelist = list(zip(prices.values(), prices.keys()))
```

这样可以按价格进行比较、排序或求最大最小值：

```python
min(pricelist)
max(pricelist)
sorted(pricelist)
```

这也说明了元组比较规则：元组按元素从左到右逐项比较。因此 `(price, name)` 会优先按价格比较，价格相同再比较名称。

## zip() 的更多特性

`zip()` 不限于两个序列，可以组合任意多个序列：

```python
list(zip(a, b, c))
```

如果输入序列长度不同，`zip()` 会在最短序列耗尽时停止：

```python
a = [1, 2, 3, 4, 5, 6]
b = ['x', 'y', 'z']
list(zip(a, b))
# [(1, 'x'), (2, 'y'), (3, 'z')]
```

## 练习要点

本文练习围绕以下目标展开：

1. 使用 `range()` 进行正向、反向、步进计数。
2. 使用 `min()`、`max()`、`sum()` 对序列进行归约。
3. 用普通 `for` 循环和 `enumerate()` 遍历数据。
4. 避免 `range(len(data))` 这类低效且不清晰的写法。
5. 用 `enumerate()` 在错误提示中加入行号。
6. 用 `zip(headers, row)` 构造记录字典，提高 CSV 处理代码的通用性。
7. 用 `zip(values, keys)` 生成反转的字典视图，以便按值排序或比较。

## 核心思想

本文的核心贡献是展示 Python 序列生态中的几种基础但强大的模式：

- 用切片表达子序列。
- 用 `for` 直接遍历数据，而不是模仿 C 风格索引循环。
- 用 `enumerate()` 在需要索引时保持代码清晰。
- 用元组解包简化结构化数据遍历。
- 用 `zip()` 把来自不同位置的数据配对，尤其是把 CSV 表头和值组合成字典。

这些技术共同构成了 Python 数据处理的基础风格：更少依赖位置编号，更多依赖清晰的数据结构和可读的迭代模式。

## Related Concepts
- [[concepts/Python-切片]]
- [[concepts/列表与序列]]
- [[concepts/元组与解包]]
- [[concepts/迭代协议与生成器]]
- [[concepts/CSV-数据处理]]
- [[concepts/字典与数据建模]]
- [[concepts/Python-可变对象]]
- [[concepts/Python-不可变对象]]
- [[concepts/字符串处理]]
- [[concepts/文件读写]]
- [[concepts/Python-控制流与缩进]]
- [[concepts/表格化输出]]
