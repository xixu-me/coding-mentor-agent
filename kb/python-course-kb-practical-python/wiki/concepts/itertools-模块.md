---
sources: [summaries/04_More_generators.md]
brief: itertools 是 Python 中用于组合和处理迭代器的标准库工具模块。
---

# itertools 模块

`itertools` 是 Python 标准库中用于处理 iterator 和 generator 的工具模块。它提供了一组高效、惰性求值的函数，用来实现常见的迭代模式，特别适合与 generator expression 和数据处理 pipeline 配合使用。

相关来源：[[summaries/04_More_generators]]

## 核心定义

`itertools` 的主要作用是：

- 接收一个或多个可迭代对象；
- 以迭代方式逐个处理元素；
- 返回新的迭代器；
- 避免一次性构造完整中间列表；
- 支持流式、组合式的数据处理。

因此，`itertools` 与 lazy evaluation 和 memory efficiency 密切相关。

## 在生成器体系中的位置

在 [[summaries/04_More_generators]] 中，`itertools` 被介绍为生成器和迭代器编程的重要辅助模块。生成器表达式可以完成简单的过滤、映射和转换，而 `itertools` 则提供了更多可复用的迭代模式。

例如，生成器表达式可以写出：

```python
rows = (row for row in rows if row['name'] in names)
```

而 `itertools` 则可以进一步提供连接、重复、分组、跳过、复制等更复杂的迭代行为。

## 常见工具函数

文档中列出了若干 `itertools` 函数：

```python
itertools.chain(s1, s2)
itertools.count(n)
itertools.cycle(s)
itertools.dropwhile(predicate, s)
itertools.groupby(s)
itertools.ifilter(predicate, s)
itertools.imap(function, s1, ... sN)
itertools.repeat(s, n)
itertools.tee(s, ncopies)
itertools.izip(s1, ... , sN)
```

其中一些名称如 `ifilter`、`imap`、`izip` 属于 Python 2 风格；在 Python 3 中，相应功能通常由内置的 `filter()`、`map()`、`zip()` 提供，它们本身也返回惰性迭代器。

## 典型迭代模式

### chain：连接多个迭代对象

`itertools.chain(s1, s2)` 可以把多个可迭代对象串接成一个连续的迭代流。

适用场景：

- 合并多个数据源；
- 顺序处理多个文件；
- 避免创建 `s1 + s2` 这样的中间列表。

### count：生成无限计数序列

`itertools.count(n)` 从 `n` 开始持续产生数字。

它通常用于：

- 给数据流编号；
- 构造无限序列；
- 与 `zip()` 等函数组合。

因为它是无限迭代器，所以使用时通常需要配合终止条件。

### cycle：循环重复序列

`itertools.cycle(s)` 会不断重复遍历给定序列。

适用场景包括：

- 轮询任务；
- 周期性分配资源；
- 重复使用一组固定值。

### dropwhile：按条件跳过前缀

`itertools.dropwhile(predicate, s)` 会在条件为真时持续跳过元素，一旦条件变为假，就开始产生后续所有元素。

这适合处理带有头部说明、注释块或预热数据的流式输入。

### groupby：按相邻键分组

`itertools.groupby(s)` 用于把相邻元素按照某种键分组。

需要注意的是，`groupby` 只对相邻元素分组。如果想按全局键分组，通常需要先排序。

### repeat：重复产生同一个值

`itertools.repeat(s, n)` 会重复产生值 `s`，最多 `n` 次。

它可以用于：

- 构造固定参数流；
- 与 `map()` 或 `zip()` 组合；
- 替代手写重复循环。

### tee：复制迭代器

`itertools.tee(s, ncopies)` 可以把一个迭代器复制成多个独立迭代器。

这在需要多次消费同一数据流时有用。不过需要注意：如果多个副本消费进度差距很大，内部可能需要缓存未消费的数据。

## 设计思想

`itertools` 的核心思想不是“保存数据”，而是“描述迭代过程”。

这与 generator 的优势一致：

- 数据按需产生；
- 中间结果不必全部存入内存；
- 多个小工具可以组合成复杂流程；
- 迭代逻辑可以与业务处理逻辑分离。

这种思想特别适合处理：

- 大型文件；
- 日志流；
- 网络数据；
- 实时事件；
- 数据清洗管道；
- 一次性计算任务。

## 与生成器表达式的关系

generator expression 适合表达简单的过滤和转换，例如：

```python
lines = (line for line in f if not line.startswith('#'))
```

`itertools` 则适合表达更通用、更可复用的迭代模式。例如，当需要连接多个流、无限计数、循环重复或分组时，使用 `itertools` 往往比手写生成器函数更简洁。

两者可以组合使用：

```python
import itertools

lines = (line.strip() for line in f if not line.startswith('#'))
combined = itertools.chain(lines, other_lines)
```

这里生成器表达式负责过滤和清理，`chain()` 负责合并多个数据源。

## 为什么重要

`itertools` 重要的原因在于它把常见迭代模式标准化、工具化了。开发者不必为每个数据处理任务都手写循环或生成器函数，而是可以通过组合已有工具构建清晰的处理流程。

它体现了 [[summaries/04_More_generators]] 中强调的几个原则：

- 许多问题可以更自然地表达为迭代；
- 生成器和迭代器能提高内存效率；
- 数据处理可以构造成管道；
- 将“如何迭代”与“如何使用数据”分离，有助于代码复用。

## 注意事项

使用 `itertools` 时需要理解迭代器的一次性消费特性：

- 很多 `itertools` 函数返回的是迭代器，不是列表；
- 结果通常只能顺序消费；
- 某些迭代器可能是无限的，如 `count()` 和 `cycle()`；
- 如果需要重复遍历，可能要重新创建迭代器，或谨慎使用 `tee()`。

这些特性与 lazy evaluation 一致，但也要求调用者明确掌握数据流的生命周期。

## 相关概念

- iterator
- generator
- generator expression
- lazy evaluation
- memory efficiency
- pipeline
- [[summaries/04_More_generators]]