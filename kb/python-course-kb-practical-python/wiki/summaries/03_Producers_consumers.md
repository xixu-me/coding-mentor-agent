---
doc_type: short
full_text: sources/03_Producers_consumers.md
---

# 03_Producers_consumers 总结

本文讲解如何利用 Python 生成器 组织生产者-消费者问题，并把多个处理步骤串联成惰性执行的 [[concepts/数据流管道]]。核心思想是：`yield` 负责生产值，`for` 循环负责消费值；中间处理函数既消费上游数据，又通过 `yield` 向下游继续生产数据。

## 核心概念

### 生产者与消费者

生成器天然适合表达 [[concepts/生产者消费者模式]]：

```python
# Producer
def follow(f):
    while True:
        yield line

# Consumer
for line in follow(f):
    ...
```

其中：

- 生产者通过 `yield` 产生数据。
- 消费者通过 `for` 循环逐项取得数据。
- 数据不会一次性全部生成，而是按需、增量流动。

这使生成器特别适合处理日志跟踪、实时数据流、大文件读取等场景。

## 生成器管道

本文将处理流程抽象为类似 Unix 管道的结构：

```text
producer -> processing -> processing -> consumer
```

管道通常包含三类组件：

### 1. 生产者

生产者一般是生成器，也可以是列表、元组等可迭代对象。

```python
def producer():
    yield item
```

它负责向管道输入初始数据。

### 2. 中间处理阶段

中间阶段既是消费者，也是生产者：

```python
def processing(s):
    for item in s:
        yield newitem
```

它可以：

- 转换数据；
- 过滤数据；
- 重组数据结构；
- 将原始文本解析为更有意义的对象。

这是 惰性求值 的重要应用：每个阶段只在下游请求数据时才处理一个元素。

### 3. 最终消费者

消费者通常是一个 `for` 循环：

```python
def consumer(s):
    for item in s:
        ...
```

它接收最终处理结果，并执行打印、写入、展示或其他副作用操作。

## 管道的组装方式

一个典型管道可以这样搭建：

```python
a = producer()
b = processing(a)
c = consumer(b)
```

数据会从 `producer()` 增量流入 `processing()`，最后由 `consumer()` 消费。各阶段之间通过迭代协议连接，而不是显式调用彼此的内部逻辑。

## 练习 6.8：简单过滤管道

文中首先构造了一个简单的过滤生成器：

```python
def filematch(lines, substr):
    for line in lines:
        if substr in line:
            yield line
```

它不负责打开文件，只处理传入的行序列。这体现了良好的管道组件设计：每个函数只完成单一职责。

示例用法：

```python
from follow import follow

lines = follow('Data/stocklog.csv')
ibm = filematch(lines, 'IBM')
for line in ibm:
    print(line)
```

这里形成了如下数据流：

```text
follow(logfile) -> filematch(lines, 'IBM') -> print
```

## 练习 6.9：与 csv.reader 组合

生成器管道不仅可以连接自定义生成器，也可以连接标准库中接受可迭代对象的函数。

```python
from follow import follow
import csv

lines = follow('Data/stocklog.csv')
rows = csv.reader(lines)
for row in rows:
    print(row)
```

`follow()` 产生文本行，`csv.reader()` 消费这些行并产生拆分后的列表。这个例子说明，只要对象遵守 迭代协议，就能自然接入管道。

## 练习 6.10：构建更多管道组件

随后文档构建了更完整的股票行情解析管道。

### 解析 CSV 行

```python
def parse_stock_data(lines):
    rows = csv.reader(lines)
    return rows
```

### 选择特定列

```python
def select_columns(rows, indices):
    for row in rows:
        yield [row[index] for index in indices]
```

该阶段将完整 CSV 行缩减为需要的字段，例如股票名、价格、涨跌额：

```python
rows = select_columns(rows, [0, 1, 4])
```

### 转换数据类型

```python
def convert_types(rows, types):
    for row in rows:
        yield [func(val) for func, val in zip(types, row)]
```

这一步把字符串转换为合适类型，例如：

```python
[str, float, float]
```

### 构造字典

```python
def make_dicts(rows, headers):
    for row in rows:
        yield dict(zip(headers, row))
```

最终每条股票数据被转换为结构化字典：

```python
{'name': 'BA', 'price': 98.35, 'change': 0.16}
```

### 封装完整解析流程

```python
def parse_stock_data(lines):
    rows = csv.reader(lines)
    rows = select_columns(rows, [0, 1, 4])
    rows = convert_types(rows, [str, float, float])
    rows = make_dicts(rows, ['name', 'price', 'change'])
    return rows
```

这个函数把多个管道阶段封装为一个更高层接口，是 函数组合 在数据处理中的应用。

## 练习 6.11：过滤数据

文档继续加入一个过滤阶段：

```python
def filter_symbols(rows, names):
    for row in rows:
        if row['name'] in names:
            yield row
```

它根据投资组合中的股票名称过滤实时行情：

```python
import report

portfolio = report.read_portfolio('Data/portfolio.csv')
rows = parse_stock_data(follow('Data/stocklog.csv'))
rows = filter_symbols(rows, portfolio)
for row in rows:
    print(row)
```

这里展示了生成器管道的一项重要能力：可以在不中断整体流式处理的前提下插入过滤逻辑。

## 练习 6.12：组合成实时股票行情器

最后要求实现：

```python
def ticker(portfile, logfile, fmt):
    ...
```

该函数应把以下步骤整合起来：

1. 读取投资组合文件；
2. 使用 `follow()` 追踪股票日志；
3. 解析 CSV 数据；
4. 选择并转换字段；
5. 构造字典；
6. 根据投资组合过滤股票；
7. 按指定格式输出，例如 `txt` 或 `csv`。

示例输出包括文本表格：

```text
      Name      Price     Change
---------- ---------- ----------
        GE      37.14      -0.18
      MSFT      29.96      -0.09
```

以及 CSV 格式：

```text
Name,Price,Change
IBM,102.79,-0.28
CAT,78.04,-0.48
```

这说明管道不仅可用于数据转换，也能作为应用程序架构的一部分。

## 关键思想

- `yield` 是生产者，`for` 循环是消费者。
- 生成器可以被串联成增量执行的数据处理管道。
- 管道中的中间阶段既消费上游数据，又生产下游数据。
- 每个阶段应保持简单、单一职责，便于组合和复用。
- 标准库中接受可迭代对象的工具，如 `csv.reader()`，可以自然融入生成器管道。
- 通过封装多个阶段，可以构建更高级的数据处理接口。
- 该模式适合实时日志处理、数据清洗、数据过滤、格式转换等场景。

## 相关概念

- 生成器
- 迭代协议
- [[concepts/生产者消费者模式]]
- [[concepts/数据流管道]]
- 惰性求值
- 函数组合
- [[concepts/流式数据处理]]

## Related Concepts
- [[concepts/迭代协议与生成器]]
- [[concepts/CSV-数据处理]]
- [[concepts/文件读写]]
- [[concepts/表格化输出]]
- [[concepts/字典与数据建模]]
- [[concepts/函数]]
- [[concepts/模块与-import]]
- [[concepts/生成器表达式]]
