---
sources: [summaries/07_Advanced_Topics__00_Overview.md, summaries/05_Decorated_methods.md]
brief: staticmethod 与 classmethod 是用于定义类级方法行为的 Python 内置装饰器。
---

# Python staticmethod 与 classmethod

`@staticmethod` 与 `@classmethod` 是 Python 类定义中常用的内置装饰器，用于改变方法与实例、类之间的绑定方式。它们都把函数放在类的命名空间中，但对调用时自动传入的参数有不同规则。

相关来源：[[summaries/05_Decorated_methods]]

## 核心区别

在普通实例方法中，第一个参数通常是 `self`，表示当前实例：

```python
class Foo:
    def bar(self):
        print(self)
```

调用实例方法时：

```python
f = Foo()
f.bar()
```

Python 会自动把实例 `f` 作为第一个参数传入 `bar()`。

而 `@staticmethod` 和 `@classmethod` 改变了这种默认绑定方式：

```python
class Foo:
    @staticmethod
    def spam(a):
        ...

    @classmethod
    def grok(cls, a):
        ...
```

- `@staticmethod`：不会自动接收实例 `self`，也不会自动接收类 `cls`。
- `@classmethod`：自动接收类对象作为第一个参数，通常命名为 `cls`。

相关概念：Python面向对象编程、Python装饰器、self与cls

## `@staticmethod`：静态方法

`@staticmethod` 用于定义静态方法。静态方法属于类，但不依赖具体实例，也不依赖类对象本身。

示例：

```python
class Foo:
    @staticmethod
    def bar(x):
        print('x =', x)

Foo.bar(2)
```

输出：

```text
x = 2
```

这里调用 `Foo.bar(2)` 时，Python 不会额外传入 `self` 或 `cls`，参数 `x` 就是调用者显式传入的 `2`。

## 静态方法适合什么场景

静态方法适合表示“逻辑上属于这个类，但不需要访问实例状态或类状态”的函数。

常见用途包括：

- 类内部的辅助函数；
- 与类相关的工具逻辑；
- 管理实例创建、资源、持久化、锁等支持代码；
- 某些设计模式中的类级工具函数。

例如，一个类可能需要一些格式化、校验、转换等辅助逻辑。如果这些逻辑不需要访问 `self` 或 `cls`，可以定义为静态方法。

## `@classmethod`：类方法

`@classmethod` 用于定义类方法。类方法调用时会自动接收类对象作为第一个参数，通常命名为 `cls`。

示例：

```python
class Foo:
    def bar(self):
        print(self)

    @classmethod
    def spam(cls):
        print(cls)
```

调用：

```python
f = Foo()
f.bar()      # 打印实例 f
Foo.spam()   # 打印类 Foo
```

普通实例方法中的 `self` 指向对象实例；类方法中的 `cls` 指向类本身。

这使得类方法可以访问类对象，并用类对象创建新实例或操作类级状态。

## 类方法最常见用途：替代构造器

在 [[summaries/05_Decorated_methods]] 中，`@classmethod` 最重要的用途是定义“替代构造器”。

例如，普通构造器可能要求传入年月日：

```python
class Date:
    def __init__(self, year, month, day):
        self.year = year
        self.month = month
        self.day = day
```

如果希望提供一个“创建今天日期”的构造方式，可以写成类方法：

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
```

调用：

```python
d = Date.today()
```

这里 `today()` 不需要调用者手动准备年月日，而是由类方法内部根据当前时间构造对象。

相关概念：[[concepts/替代构造器]]、封装

## 为什么类方法适合继承

类方法的一个重要优点是继承友好。

如果在类方法中使用：

```python
return cls(...)
```

而不是：

```python
return Date(...)
```

那么当子类调用该方法时，`cls` 会自动变成子类。

示例：

```python
class Date:
    @classmethod
    def today(cls):
        tm = time.localtime()
        return cls(tm.tm_year, tm.tm_mon, tm.tm_mday)

class NewDate(Date):
    pass

d = NewDate.today()
```

此时 `NewDate.today()` 中的 `cls` 是 `NewDate`，所以返回的是 `NewDate` 实例，而不是写死的 `Date` 实例。

这正是 `@classmethod` 在对象构造中比静态方法或硬编码类名更灵活的地方。

相关概念：Python继承、面向对象设计

## 实践示例：`Portfolio.from_csv()`

在 [[summaries/05_Decorated_methods]] 的练习中，`@classmethod` 被用于重构 `Portfolio` 对象的创建过程。

原来的设计中，读取 CSV、解析数据、创建 `Stock` 对象、创建 `Portfolio` 对象的逻辑分散在外部函数中。这会导致责任不清晰。

改进后的设计是让 `Portfolio` 自己负责从 CSV 创建实例：

```python
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

使用方式：

```python
with open('Data/portfolio.csv') as lines:
    port = Portfolio.from_csv(lines)
```

这个例子体现了类方法的典型价值：

- 将对象创建逻辑封装进类；
- 让外部代码不必知道类的内部构造过程；
- 保持类型检查和内部一致性；
- 使用 `cls()` 支持未来的子类扩展。

相关概念：对象构造、类型检查、封装

## 选择 `staticmethod` 还是 `classmethod`

可以用以下判断标准：

### 使用 `@staticmethod` 的情况

当方法满足以下条件时，可以考虑静态方法：

- 逻辑属于这个类的语义范围；
- 不需要访问实例属性；
- 不需要访问类对象；
- 只是一个放在类中的辅助函数。

### 使用 `@classmethod` 的情况

当方法满足以下条件时，应优先考虑类方法：

- 需要知道当前调用的类；
- 需要创建当前类或子类的实例；
- 需要实现替代构造器；
- 需要与继承机制协同工作；
- 需要访问或修改类级状态。

## 对比总结

| 方法类型 | 装饰器 | 自动传入参数 | 常见用途 |
|---|---|---|---|
| 实例方法 | 无 | `self`，当前实例 | 操作实例状态 |
| 静态方法 | `@staticmethod` | 无 | 类相关辅助函数 |
| 类方法 | `@classmethod` | `cls`，当前类 | 替代构造器、继承友好的类级逻辑 |

## 关键理解

`staticmethod` 和 `classmethod` 都是类定义中的方法组织工具，但它们表达的设计意图不同：

- `@staticmethod` 表示“这个函数与类有关，但不需要类或实例参与”；
- `@classmethod` 表示“这个方法作用于类本身，并且可能需要根据当前类创建对象”。

在面向对象设计中，`@classmethod` 尤其适合把对象创建逻辑放回类内部，使代码更清晰、更封装，也更适合继承扩展。

See also: [[summaries/07_Advanced_Topics__00_Overview]]