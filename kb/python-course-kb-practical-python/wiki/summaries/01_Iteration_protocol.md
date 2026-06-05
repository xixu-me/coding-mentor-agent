---
doc_type: short
full_text: sources/01_Iteration_protocol.md
---

# 01_Iteration_protocol 总结

本文介绍 Python 中无处不在的 Python迭代协议，解释 `for` 循环背后的底层机制，并通过 `Portfolio` 示例说明如何让自定义对象表现得像标准容器。

## 核心内容

### 1. 迭代无处不在

Python 中许多对象都支持迭代，包括：

- 字符串：逐字符迭代
- 字典：默认逐键迭代
- 列表、元组：逐元素迭代
- 文件对象：逐行迭代

示例：

```python
for x in obj:
    ...
```

这种统一的使用方式来自 Python 的迭代协议。

## 2. `for` 循环背后的机制

`for` 语句本质上会执行以下步骤：

```python
_iter = obj.__iter__()
while True:
    try:
        x = _iter.__next__()
        # statements
    except StopIteration:
        break
```

关键点：

- `obj.__iter__()` 返回一个迭代器对象。
- 迭代器通过 `__next__()` 逐个返回元素。
- 当没有更多元素时，抛出 `StopIteration`。
- `for` 循环会自动捕获 `StopIteration` 并结束循环。

这说明所有能用于 `for` 循环的对象都实现了底层的 Python迭代协议。

## 3. 手动迭代

文档通过列表演示了手动调用迭代器：

```python
a = [1, 9, 4, 25, 16]
i = a.__iter__()
i.__next__()
```

连续调用 `__next__()` 会依次得到列表元素，直到列表耗尽并抛出 `StopIteration`。

Python 内置函数 `next()` 是调用迭代器 `__next__()` 方法的简写：

```python
next(i)
```

文件对象也是迭代器的一种典型示例。对文件调用 `next(f)` 会逐行读取内容；文件读到末尾时同样抛出 `StopIteration`。

## 4. 让自定义对象支持迭代

如果自定义对象内部包装了列表或其他可迭代对象，可以通过实现 `__iter__()` 让它支持 `for` 循环。

示例：

```python
class Portfolio:
    def __init__(self, holdings):
        self._holdings = holdings

    def __iter__(self):
        return self._holdings.__iter__()
```

这里 `Portfolio` 是对持仓列表的封装。通过把迭代行为委托给内部列表 `_holdings`，`Portfolio` 实例就可以像列表一样被遍历：

```python
for s in portfolio:
    ...
```

这体现了 对象封装 与 Python特殊方法 的结合：对象可以隐藏内部数据结构，同时暴露符合 Python 习惯的操作接口。

## 5. `Portfolio` 示例：从列表封装到可迭代容器

文档要求创建 `portfolio.py`，定义 `Portfolio` 类：

```python
class Portfolio:
    def __init__(self, holdings):
        self._holdings = holdings

    @property
    def total_cost(self):
        return sum([s.shares * s.price for s in self._holdings])

    def tabulate_shares(self):
        from collections import Counter
        total_shares = Counter()
        for s in self._holdings:
            total_shares[s.name] += s.shares
        return total_shares
```

随后修改 `report.py` 中的 `read_portfolio()`，让它返回 `Portfolio` 实例，而不是普通列表。

问题在于：原有程序可能依赖对投资组合的遍历。如果 `Portfolio` 没有实现 `__iter__()`，程序会崩溃，因为它不再是可迭代对象。

修复方式是添加：

```python
def __iter__(self):
    return self._holdings.__iter__()
```

这样既保留了封装，又兼容原来依赖迭代的代码。

## 6. 使用属性表达聚合行为

`Portfolio` 类还提供了 `total_cost` 属性，用于计算总成本：

```python
@property
def total_cost(self):
    return sum([s.shares * s.price for s in self._holdings])
```

这使 `pcost.py` 可以简化为：

```python
def portfolio_cost(filename):
    portfolio = report.read_portfolio(filename)
    return portfolio.total_cost
```

这是一种更面向对象的设计：成本计算逻辑属于 `Portfolio`，而不是散落在外部函数中。

## 7. 构造更完整的容器对象

除了迭代，一个更“像 Python 容器”的类通常还应支持：

- `len(obj)`：通过 `__len__()`
- 索引访问：通过 `__getitem__()`
- 切片访问：同样由 `__getitem__()` 支持
- 成员测试：通过 `__contains__()`

完整示例：

```python
class Portfolio:
    def __init__(self, holdings):
        self._holdings = holdings

    def __iter__(self):
        return self._holdings.__iter__()

    def __len__(self):
        return len(self._holdings)

    def __getitem__(self, index):
        return self._holdings[index]

    def __contains__(self, name):
        return any([s.name == name for s in self._holdings])

    @property
    def total_cost(self):
        return sum([s.shares * s.price for s in self._holdings])

    def tabulate_shares(self):
        from collections import Counter
        total_shares = Counter()
        for s in self._holdings:
            total_shares[s.name] += s.shares
        return total_shares
```

支持这些特殊方法后，可以进行如下操作：

```python
len(portfolio)
portfolio[0]
portfolio[0:3]
'IBM' in portfolio
```

这些行为共同构成了 Python容器协议 的重要部分。

## 8. Pythonic 设计思想

本文最后强调：所谓 “Pythonic” 的代码，往往意味着对象能够使用 Python 生态中通用的表达方式。

对于容器对象来说，重要的不只是保存数据，还要支持 Python 用户熟悉的操作：

- 可迭代
- 可索引
- 可切片
- 可求长度
- 可进行成员测试

通过实现 `__iter__()`、`__len__()`、`__getitem__()`、`__contains__()` 等特殊方法，自定义类可以自然融入 Python 语言环境，而无需调用笨重的专用方法。

## 关键概念

- Python迭代协议：`__iter__()`、`__next__()` 与 `StopIteration` 共同定义迭代机制。
- Python特殊方法：通过双下划线方法让对象支持语言内置语法。
- Python容器协议：容器对象通常应支持迭代、长度、索引和成员测试。
- 对象封装：`Portfolio` 封装内部列表，同时暴露更高级的业务接口。
- Pythonic设计：让自定义对象遵循 Python 既有词汇和操作习惯。

## 主要收获

1. `for` 循环依赖 `__iter__()` 和 `__next__()`。
2. 迭代结束通过 `StopIteration` 表示。
3. `next()` 是调用迭代器 `__next__()` 的内置快捷方式。
4. 自定义类只要实现 `__iter__()`，就可以支持 `for` 循环。
5. 封装列表时，可以把迭代、索引、长度等操作委托给内部列表。
6. 实现常见特殊方法能让自定义对象更符合 Pythonic 风格。

## Related Concepts
- [[concepts/迭代协议与生成器]]
- [[concepts/Python-容器]]
- [[concepts/特殊方法]]
- [[concepts/Python-对象模型]]
- [[concepts/列表与序列]]
- [[concepts/文件读写]]
- [[concepts/异常处理]]
- [[concepts/Python-property-属性]]
- [[concepts/Python-封装与访问约定]]
- [[concepts/库接口设计]]
- [[concepts/鸭子类型]]
- [[concepts/Python-切片]]
