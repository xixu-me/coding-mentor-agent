---
doc_type: short
full_text: sources/01_Datatypes.md
---

# 01_Datatypes 摘要

本文介绍 Python 中用于表示和组织数据的基本方式，重点包括 `None`、元组（tuple）和字典（dictionary），并通过读取 `portfolio.csv` 中股票持仓数据的例子说明如何把原始字符串行转换为更适合计算和维护的数据结构。相关主题可连接到 Python数据类型、Python数据结构、元组、字典、CSV数据处理。

## 核心内容

### 基本数据类型与 `None`

Python 常见的原始数据类型包括：

- 整数：如 `100`
- 浮点数：如 `490.10`
- 字符串：如 `'GOOG'`

此外，`None` 用于表示可选值、缺失值或占位值：

```python
email_address = None
```

`None` 在条件判断中会被视为 `False`：

```python
if email_address:
    send_email(email_address, msg)
```

这使它适合表达“当前没有值”的语义。

## 数据结构：把多个值组织成对象

真实程序中的数据通常不是单个数字或字符串，而是由多个部分组成。例如一条股票持仓记录：

```text
100 shares of GOOG at $490.10
```

它可以拆分为三个字段：

- 股票名称或代码：`'GOOG'`
- 股数：`100`
- 价格：`490.10`

这类由多个相关字段组成的数据，可以用元组或字典表示。

## 元组：有序、不可变的简单记录

元组是把多个值组合在一起的结构：

```python
s = ('GOOG', 100, 490.1)
```

括号有时可以省略：

```python
s = 'GOOG', 100, 490.1
```

特殊形式包括：

```python
t = ()          # 空元组
w = ('GOOG', )  # 单元素元组，逗号必需
```

### 元组适合表示简单记录

元组常用于表示一个由多个部分构成的单一对象，例如数据库表中的一行：

```python
record = ('GOOG', 100, 490.1)
```

可以通过索引访问其内容：

```python
name = s[0]
shares = s[1]
price = s[2]
```

但元组是不可变的，不能直接修改元素：

```python
s[1] = 75
# TypeError: object does not support item assignment
```

若要“修改”，需要创建一个新元组并重新绑定变量：

```python
s = (s[0], 75, s[2])
```

这并不是修改原元组，而是丢弃旧值、创建新值。

## 元组打包与解包

元组的一个重要用途是把相关值打包成一个整体：

```python
s = ('GOOG', 100, 490.1)
```

随后可以一次性解包到多个变量中：

```python
name, shares, price = s
```

左侧变量数量必须与元组结构匹配，否则会报错：

```python
name, shares = s
# ValueError: too many values to unpack
```

元组打包和解包是 Python 中处理结构化返回值、记录和迭代数据的重要模式，可关联到 元组解包。

## 元组与列表的区别

虽然元组看起来像“只读列表”，但二者的惯用语义不同：

- 元组通常表示一个由多个字段组成的单一记录。
- 列表通常表示多个同类型或相似对象的集合。

例如：

```python
record = ('GOOG', 100, 490.1)        # 一个持仓记录
symbols = ['GOOG', 'AAPL', 'IBM']    # 多个股票代码
```

因此，选择元组还是列表不仅取决于是否可变，也取决于数据建模意图。

## 字典：键到值的映射

字典是一种键值映射结构，也称为哈希表或关联数组：

```python
s = {
    'name': 'GOOG',
    'shares': 100,
    'price': 490.1
}
```

字典通过键访问值：

```python
s['name']
s['shares']
s['price']
```

相比元组索引：

```python
s[2]
```

字典键名更具可读性：

```python
s['price']
```

### 字典的修改操作

字典可以自由修改、添加和删除字段：

```python
s['shares'] = 75          # 修改
s['date'] = '6/6/2007'   # 添加
del s['date']            # 删除
```

因此，字典适合字段较多、字段可能变化、需要清晰字段名的数据结构。

## 练习重点：把 CSV 原始行转换为可计算对象

文档通过 `csv.reader()` 读取 `Data/portfolio.csv`：

```python
import csv
f = open('Data/portfolio.csv')
rows = csv.reader(f)
next(rows)
row = next(rows)
```

读取出的行是字符串列表：

```python
['AA', '100', '32.20']
```

直接计算会失败：

```python
cost = row[1] * row[2]
# TypeError: can't multiply sequence by non-int of type 'str'
```

原因是 `row[1]` 和 `row[2]` 都是字符串，需要转换为数字。

## 使用元组表示 CSV 行

可以把原始行转换成元组：

```python
t = (row[0], int(row[1]), float(row[2]))
```

得到：

```python
('AA', 100, 32.2)
```

此后可以计算总成本：

```python
cost = t[1] * t[2]
```

结果可能显示为：

```python
3220.0000000000005
```

这不是 Python 数学错误，而是二进制浮点数无法精确表示某些十进制小数造成的正常现象。可用格式化输出隐藏误差：

```python
print(f'{cost:0.2f}')
# 3220.00
```

该主题可关联到 [[concepts/浮点数精度]]。

## 使用字典表示 CSV 行

也可以把同一行转换为字典：

```python
d = {
    'name': row[0],
    'shares': int(row[1]),
    'price': float(row[2])
}
```

计算成本更具可读性：

```python
cost = d['shares'] * d['price']
```

修改字段也更直接：

```python
d['shares'] = 75
```

还可以添加新属性：

```python
d['date'] = (6, 11, 2007)
d['account'] = 12345
```

这展示了字典在表示可变、具名字段记录时的优势。

## 字典的常见迭代与视图操作

### 转为列表或直接迭代

把字典转为列表会得到所有键：

```python
list(d)
```

直接遍历字典时，迭代得到的也是键：

```python
for k in d:
    print(k)
```

若要访问键和值，可以手动查找：

```python
for k in d:
    print(k, '=', d[k])
```

### `keys()` 方法

`d.keys()` 返回一个特殊的 `dict_keys` 视图对象：

```python
keys = d.keys()
```

该对象不是静态拷贝，而是字典键集合的动态视图。如果原字典发生变化，`keys` 也会反映变化：

```python
del d['account']
# keys 中也不再包含 'account'
```

### `items()` 方法

`d.items()` 返回键值对视图，每个元素是一个 `(key, value)` 元组：

```python
for k, v in d.items():
    print(k, '=', v)
```

这结合了字典迭代与元组解包，是处理键值对的常见 Python 写法。

### 用 `dict()` 从键值对创建字典

如果已有键值对元组序列，可以用 `dict()` 构造字典：

```python
items = d.items()
d = dict(items)
```

这说明字典和由二元组组成的序列之间可以相互转换。

## 关键结论

- `None` 表示缺失值或占位值，并在条件判断中视为 `False`。
- 元组适合表示固定结构的简单记录，具有有序、不可变、可打包解包等特性。
- 字典适合表示字段较多、需要具名访问、可能修改的数据记录。
- 从 CSV 读出的数据通常是字符串，需要转换为合适类型后才能计算。
- 浮点数计算可能出现微小误差，这是二进制浮点表示的正常结果。
- `dict.keys()` 和 `dict.items()` 返回动态视图，可用于遍历和构造新的数据结构。

## 与其他主题的联系

- Python数据类型：整数、浮点数、字符串和 `None` 的基础语义。
- Python数据结构：元组、列表、字典在数据建模中的不同角色。
- 元组：固定结构记录、不可变性、打包与解包。
- 字典：键值映射、可变记录、动态视图。
- CSV数据处理：从原始文本行转换为可计算对象。
- [[concepts/浮点数精度]]：十进制小数在二进制浮点中的表示误差。

## Related Concepts
- [[concepts/元组与解包]]
- [[concepts/None-与缺失值]]
- [[concepts/字典与数据建模]]
- [[concepts/CSV-数据处理]]
- [[concepts/变量与数据类型]]
- [[concepts/Python-不可变对象]]
- [[concepts/Python-可变对象]]
- [[concepts/Python-容器]]
- [[concepts/列表与序列]]
- [[concepts/Python-对象模型]]
- [[concepts/文件读写]]
- [[concepts/模块与-import]]
- [[concepts/字符串处理]]
- [[concepts/Python-交互式解释器]]
