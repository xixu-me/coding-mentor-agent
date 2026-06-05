---
doc_type: short
full_text: sources/05_Decorated_methods.md
---

# 05_Decorated_methods 总结

本文介绍 Python 类定义中常见的内置方法装饰器，说明它们如何改变方法与实例、类之间的绑定关系，并通过练习展示如何用 `@classmethod` 改进对象构造逻辑。

## 核心主题

本节属于 Python装饰器 与 Python面向对象编程 的交叉内容，重点讨论类方法定义中的预定义装饰器：

```python
class Foo:
    def bar(self, a):
        ...

    @staticmethod
    def spam(a):
        ...

    @classmethod
    def grok(cls, a):
        ...

    @property
    def name(self):
        ...
```

这些装饰器用于声明类中的特殊方法形式，改变方法调用时自动传入的第一个参数，或改变属性访问方式。

## 静态方法：`@staticmethod`

`@staticmethod` 用于定义静态方法。静态方法属于类的命名空间，但不会自动接收实例对象 `self`，也不会自动接收类对象 `cls`。

示例：

```python
class Foo(object):
    @staticmethod
    def bar(x):
        print('x =', x)

Foo.bar(2)
```

输出效果相当于：

```text
x = 2
```

静态方法常用于：

- 放置类内部的辅助逻辑；
- 管理实例创建、内存、系统资源、持久化、锁等相关支持代码；
- 实现某些设计模式中的类级工具函数。

它的特点是：函数逻辑与类相关，但不需要访问具体实例或类状态。

相关概念：静态方法、Python类。

## 类方法：`@classmethod`

`@classmethod` 用于定义类方法。类方法在调用时会自动接收类对象作为第一个参数，通常命名为 `cls`，而不是接收实例对象 `self`。

示例：

```python
class Foo:
    def bar(self):
        print(self)

    @classmethod
    def spam(cls):
        print(cls)
```

调用效果：

```python
f = Foo()
f.bar()      # 打印实例 f
Foo.spam()   # 打印类 Foo
```

区别在于：

- 普通实例方法的第一个参数是实例 `self`；
- 类方法的第一个参数是类 `cls`；
- 类方法可以通过类本身调用，也可以通过实例调用。

相关概念：类方法、self与cls。

## 类方法的主要用途：替代构造器

本文强调，类方法最常见的用途是定义“替代构造器”。

例如 `Date` 类可以用 `today()` 根据当前日期创建实例：

```python
class Date:
    def __init__(self, year, month, day):
        self.year = year
        self.month = month
        self.day = day

    @classmethod
    def today(cls):
        tm = time.localtime()
        return cls(tm.tm_year, tm.tm_mon, tm.tm_mday)


d = Date.today()
```

这里的关键点是：

```python
return cls(...)
```

而不是写死：

```python
return Date(...)
```

这样可以让构造逻辑适配继承。

## 类方法与继承

类方法可以正确处理继承场景。

示例：

```python
class Date:
    @classmethod
    def today(cls):
        tm = time.localtime()
        return cls(tm.tm_year, tm.tm_mon, tm.tm_mday)

class NewDate(Date):
    ...

 d = NewDate.today()
```

当 `NewDate.today()` 被调用时，`cls` 是 `NewDate`，因此返回的是 `NewDate` 实例，而不是固定的 `Date` 实例。

这说明类方法比硬编码类名更适合可继承的构造逻辑。

相关概念：[[concepts/替代构造器]]、Python继承。

## 练习 7.11：在实践中使用类方法

练习要求重构 `report.py` 和 `portfolio.py` 中 `Portfolio` 对象的创建逻辑。

原先的 `report.py` 中有类似代码：

```python
def read_portfolio(filename, **opts):
    with open(filename) as lines:
        portdicts = fileparse.parse_csv(lines,
                                        select=['name','shares','price'],
                                        types=[str,int,float],
                                        **opts)

    portfolio = [Stock(**d) for d in portdicts]
    return Portfolio(portfolio)
```

而 `Portfolio` 类的初始化方式是：

```python
class Portfolio:
    def __init__(self, holdings):
        self.holdings = holdings
```

作者指出，这种责任链比较混乱：

- CSV 解析逻辑在 `report.py`；
- `Stock` 对象创建逻辑在 `report.py`；
- `Portfolio` 只是被动接收已有列表；
- “如何从外部数据创建投资组合”的逻辑没有封装在 `Portfolio` 类中。

## 改进后的 `Portfolio` 设计

建议将 `Portfolio` 改成更清晰的容器类：

```python
import stock

class Portfolio:
    def __init__(self):
        self.holdings = []

    def append(self, holding):
        if not isinstance(holding, stock.Stock):
            raise TypeError('Expected a Stock instance')
        self.holdings.append(holding)
```

这个设计表达了更明确的含义：

- `Portfolio` 默认创建为空组合；
- 只能向其中追加 `Stock` 实例；
- 类型检查由 `Portfolio.append()` 负责；
- 类本身维护自己的内部一致性。

相关概念：封装、类型检查。

## 使用 `from_csv()` 作为替代构造器

为了从 CSV 文件创建 `Portfolio`，可以在类中定义类方法：

```python
import fileparse
import stock

class Portfolio:
    def __init__(self):
        self.holdings = []

    def append(self, holding):
        if not isinstance(holding, stock.Stock):
            raise TypeError('Expected a Stock instance')
        self.holdings.append(holding)

    @classmethod
    def from_csv(cls, lines, **opts):
        self = cls()
        portdicts = fileparse.parse_csv(lines,
                                        select=['name','shares','price'],
                                        types=[str,int,float],
                                        **opts)

        for d in portdicts:
            self.append(stock.Stock(**d))

        return self
```

调用方式变为：

```python
from portfolio import Portfolio

with open('Data/portfolio.csv') as lines:
    port = Portfolio.from_csv(lines)
```

这种写法将“如何从 CSV 数据构造投资组合”的责任放回 `Portfolio` 类内部，使代码更聚合、更易维护。

## 设计意义

本节的实践重点不是语法本身，而是对象设计责任的重新分配：

- `report.py` 不再负责知道 `Portfolio` 的内部构造过程；
- `Portfolio` 自己负责从 CSV 生成合法实例；
- `from_csv()` 作为替代构造器，使外部调用更简洁；
- 使用 `cls()` 而不是 `Portfolio()`，使该构造方式对继承友好。

这体现了 面向对象设计 中的重要原则：将与对象创建和内部一致性相关的逻辑封装到类自身。

## 小结

本文介绍了三类常见内置装饰器中的两个重点：

- `@staticmethod`：定义不接收 `self` 或 `cls` 的类内工具函数；
- `@classmethod`：定义接收类对象 `cls` 的方法，常用于替代构造器；
- `@property`：文中列出但未展开，通常用于将方法暴露为属性式访问。

其中 `@classmethod` 的核心价值在于：它能把构造逻辑封装到类中，并天然支持继承场景。练习通过 `Portfolio.from_csv()` 展示了这一点，使数据读取、对象创建与类型约束都集中到 `Portfolio` 类中。

## Related Concepts
- [[concepts/Python-staticmethod-与-classmethod]]
- [[concepts/Python-装饰器]]
- [[concepts/类与对象]]
- [[concepts/继承与多态]]
- [[concepts/CSV-数据处理]]
- [[concepts/Python-property-属性]]
- [[concepts/绑定方法]]
- [[concepts/Python-对象模型]]
- [[concepts/Python-封装与访问约定]]
- [[concepts/库接口设计]]
- [[concepts/文件读写]]
- [[concepts/字典与数据建模]]
- [[concepts/模块与-import]]
