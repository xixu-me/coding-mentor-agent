---
doc_type: short
full_text: sources/05_Collections.md
---

# 05_Collections 总结

本文介绍 Python 标准库 `collections` 模块中几个常用的数据处理工具，重点包括 `Counter`、`defaultdict` 和 `deque`，展示它们如何简化计数、分组索引和保留有限历史记录等任务。相关主题可延伸为 Python标准库、[[concepts/数据计数与汇总]]、字典与映射、序列与队列。

## 核心主题

`collections` 模块提供了多种专门的数据结构，适合处理常见但用普通 `dict`、`list` 实现会显得繁琐的数据管理问题。

本文重点场景包括：

- 统计每只股票的总持仓数量
- 将一个键映射到多个值
- 保存最近 N 条历史记录

## 使用 `Counter` 进行计数与汇总

当需要统计某类对象的累计数量时，可以使用 `collections.Counter`。

示例数据中，同一只股票可能出现多次：

```python
portfolio = [
    ('GOOG', 100, 490.1),
    ('IBM', 50, 91.1),
    ('CAT', 150, 83.44),
    ('IBM', 100, 45.23),
    ('GOOG', 75, 572.45),
    ('AA', 50, 23.15)
]
```

如果希望计算每只股票的总股数，可以创建一个空的 `Counter`，然后逐项累加：

```python
from collections import Counter

total_shares = Counter()
for name, shares, price in portfolio:
    total_shares[name] += shares
```

这样，重复出现的股票名会被合并到同一个计数项中。例如：

```python
total_shares['IBM']
```

结果为：

```python
150
```

这说明 `IBM` 的两条记录被汇总为总股数 150。

## `Counter` 的字典行为与排序功能

`Counter` 可以像普通字典一样通过键访问值：

```python
holdings['IBM']
holdings['MSFT']
```

同时，它还提供了计数对象常用的额外方法。例如，可以使用 `most_common()` 获取持仓数量最多的股票：

```python
holdings.most_common(3)
```

返回结果类似：

```python
[('MSFT', 250), ('IBM', 150), ('CAT', 150)]
```

这使得 `Counter` 不仅适合做统计，也适合做排名和频率分析。

## 合并多个 `Counter`

`Counter` 支持直接相加，这对合并多个数据源中的统计结果非常方便。

例如有两个投资组合：

```python
combined = holdings + holdings2
```

合并后，相同股票的股数会自动相加：

```python
Counter({'MSFT': 275, 'HPQ': 250, 'GE': 220, 'AA': 150, 'IBM': 150, 'CAT': 150})
```

这体现了 `Counter` 在数据汇总、聚合和表格化统计中的优势。

## 使用 `defaultdict` 处理一对多映射

当一个键需要关联多个值时，普通字典需要手动检查键是否存在，而 `defaultdict` 可以自动为新键创建默认值。

示例：将股票名称映射到该股票的所有交易记录：

```python
from collections import defaultdict

holdings = defaultdict(list)
for name, shares, price in portfolio:
    holdings[name].append((shares, price))
```

访问 `IBM` 时会得到它对应的多条记录：

```python
holdings['IBM']
```

结果：

```python
[(50, 91.1), (100, 45.23)]
```

`defaultdict(list)` 的作用是：当访问一个不存在的键时，自动创建一个空列表作为默认值，因此可以直接调用 `.append()`。

这类模式常用于：

- 分组数据
- 建立索引
- 一对多映射
- 按类别聚合记录

相关概念可连接到 字典与映射 和 数据分组。

## 使用 `deque` 保存有限历史记录

如果需要保存最近 N 个元素，可以使用 `collections.deque`。

示例：保存文件处理中最近 N 行内容：

```python
from collections import deque

history = deque(maxlen=N)
with open(filename) as f:
    for line in f:
        history.append(line)
        ...
```

当设置 `maxlen=N` 后，`deque` 会自动维持固定长度。新元素加入时，如果超过最大长度，最旧的元素会被自动丢弃。

这适合用于：

- 最近历史记录
- 滑动窗口
- 日志尾部追踪
- 流式数据处理

相关主题可扩展为 序列与队列、滑动窗口。

## 练习 2.18：使用 `Counter` 表格化统计

练习要求在交互模式中运行 `report.py`，加载股票投资组合数据：

```bash
python3 -i report.py
```

然后使用 `read_portfolio('Data/portfolio.csv')` 读取投资组合，并通过 `Counter` 汇总每只股票的持仓总数：

```python
from collections import Counter

holdings = Counter()
for s in portfolio:
    holdings[s['name']] += s['shares']
```

结果示例：

```python
Counter({'MSFT': 250, 'IBM': 150, 'CAT': 150, 'AA': 100, 'GE': 95})
```

该练习强调：当原始数据中同一股票有多条记录时，`Counter` 可以自然地将这些记录合并为单个统计项。

随后练习又读取第二个投资组合 `portfolio2.csv`，创建另一个 `Counter`，并用加法合并两个统计结果。

## 关键收获

- `collections` 是 Python 中非常实用的标准库模块，适合处理专门的数据管理问题。
- `Counter` 用于计数、汇总、排名和合并统计结果。
- `defaultdict` 用于简化默认值处理，尤其适合一对多映射和分组。
- `deque` 适合保存固定长度的历史记录或实现队列类数据结构。
- 遇到表格化统计、索引构建、分组聚合等问题时，应优先考虑 `collections` 模块。

## 延伸阅读方向

本文最后指出，`collections` 模块内容丰富，值得后续深入学习。除了本文介绍的 `Counter`、`defaultdict` 和 `deque`，该模块还包含其他有用工具，可作为 Python 数据结构和标准库学习的重要部分。

## Related Concepts
- [[concepts/队列与滑动窗口]]
- [[concepts/Python-容器]]
- [[concepts/字典与数据建模]]
- [[concepts/列表与序列]]
- [[concepts/模块与-import]]
- [[concepts/元组与解包]]
- [[concepts/Python-交互式解释器]]
- [[concepts/文件读写]]
- [[concepts/上下文管理器]]
- [[concepts/迭代协议与生成器]]
- [[concepts/CSV-数据处理]]
