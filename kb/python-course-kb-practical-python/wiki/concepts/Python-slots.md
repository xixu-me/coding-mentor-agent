---
sources: [summaries/05_Object_model__00_Overview.md, summaries/02_Classes_encapsulation.md]
brief: Python __slots__ 用于限制实例属性集合，并可减少对象内存占用。
---

# Python __slots__

`__slots__` 是 Python 类中的一个特殊类属性，用于声明实例允许拥有的属性名称。它可以阻止对象动态添加未声明的属性，并让 Python 使用更紧凑的内部对象表示，从而减少内存占用。

该概念在 [[summaries/02_Classes_encapsulation]] 中作为 Python 封装机制的一部分出现，和 python encapsulation、python properties、python object memory 等主题密切相关。

## 基本含义

普通 Python 对象通常可以在运行时自由添加新属性：

```python
class Stock:
    def __init__(self, name, shares, price):
        self.name = name
        self.shares = shares
        self.price = price

s = Stock('GOOG', 100, 490.10)
s.blah = 42      # 通常是允许的
```

这种灵活性是 Python 对象模型的一部分，但也可能带来问题：

- 拼写错误会意外创建新属性；
- 对象结构不够固定；
- 每个实例通常需要维护一个 `__dict__`，带来额外内存开销。

`__slots__` 可以改变这种行为。

## 用法

在类中定义 `__slots__`，列出允许的实例属性名：

```python
class Stock:
    __slots__ = ('name', '_shares', 'price')

    def __init__(self, name, shares, price):
        self.name = name
        self._shares = shares
        self.price = price
```

这样，`Stock` 实例只能拥有 `name`、`_shares` 和 `price` 这些属性。

如果尝试设置未声明的属性，会抛出 `AttributeError`：

```python
s = Stock('GOOG', 100, 490.10)
s.name       # 'GOOG'
s.blah = 42  # AttributeError
```

在 [[summaries/02_Classes_encapsulation]] 中，示例展示了类似行为：

```python
s.price = 385.15
s.prices = 410.2
# AttributeError: 'Stock' object has no attribute 'prices'
```

这里 `prices` 可能只是 `price` 的拼写错误。使用 `__slots__` 后，这类错误会更早暴露。

## 与封装的关系

`__slots__` 有时看起来像一种封装工具，因为它限制了对象可以拥有的属性集合。但需要注意：

- 它不是严格意义上的访问控制；
- 它不会让属性变成真正私有；
- 它主要限制“能添加哪些属性”，而不是“谁能访问这些属性”。

例如，即使 `_shares` 被写入 `__slots__`，外部代码仍然可以访问它：

```python
s._shares
```

这与 Python 的整体封装哲学一致：Python 更多依赖命名约定，而不是强制私有权限。以下划线开头的属性，如 `_shares`，表示内部实现细节，应由程序员自觉避免直接访问。相关内容见 python encapsulation。

## 与 property 的配合

`__slots__` 经常和 `property` 一起出现。例如，公开属性 `shares` 可以通过 property 管理，而真实数据存储在 `_shares` 中：

```python
class Stock:
    __slots__ = ('name', '_shares', 'price')

    def __init__(self, name, shares, price):
        self.name = name
        self.shares = shares
        self.price = price

    @property
    def shares(self):
        return self._shares

    @shares.setter
    def shares(self, value):
        if not isinstance(value, int):
            raise TypeError('Expected int')
        self._shares = value
```

这里需要注意：

- `shares` 是一个 property，不是实际存储数据的普通实例属性；
- 实际值保存在 `_shares` 中；
- 因此 `__slots__` 中应包含 `_shares`，而不是一定要包含 `shares`；
- 对 `self.shares = value` 的赋值会触发 setter；
- setter 再把验证后的值写入 `self._shares`。

这种组合体现了 Python 中常见的受管理属性模式，相关内容见 python properties 和 managed attributes。

## 对 __dict__ 的影响

普通 Python 实例通常有一个实例字典 `__dict__`，用于保存动态属性：

```python
s.__dict__
```

使用 `__slots__` 后，如果没有显式把 `__dict__` 加入 slots，实例通常不再拥有普通的 `__dict__`。这意味着属性不再通过实例字典动态存储，而是通过更固定、更紧凑的结构保存。

因此，在使用 `__slots__` 的类上访问：

```python
s.__dict__
```

通常会失败，或者显示该实例没有 `__dict__`。

这正是 `__slots__` 能减少内存占用的原因之一。相关主题见 python object memory。

## 主要用途

`__slots__` 的主要用途包括：

1. **限制属性集合**  
   防止外部或内部代码随意添加未声明属性。

2. **发现拼写错误**  
   例如把 `price` 错写成 `prices` 时，普通对象会创建新属性，而 slots 对象会报错。

3. **节省内存**  
   对大量实例组成的数据结构尤其有用。

4. **略微提升性能**  
   因为对象内部表示更紧凑，某些属性访问场景可能更高效。

不过，[[summaries/02_Classes_encapsulation]] 明确强调：`__slots__` 最常见的用途是性能和内存优化，而不是普通日常代码中的封装工具。

## 适用场景

适合使用 `__slots__` 的情况：

- 类被用作轻量数据结构；
- 程序会创建大量实例；
- 实例属性集合固定；
- 内存占用是重要问题；
- 希望避免动态添加属性造成的错误。

例如：

```python
class Point:
    __slots__ = ('x', 'y')

    def __init__(self, x, y):
        self.x = x
        self.y = y
```

如果程序要创建数百万个 `Point` 对象，`__slots__` 可能带来明显内存收益。

## 不适用场景

不建议使用 `__slots__` 的情况：

- 普通业务类；
- 属性集合未来可能变化；
- 需要动态添加属性；
- 希望对象支持灵活调试或扩展；
- 没有明确的内存或性能压力。

过早使用 `__slots__` 可能让类变得不够灵活，也可能给继承、调试和扩展带来额外复杂性。

## 与私有属性的区别

`__slots__` 和私有属性约定是两个不同概念：

| 机制 | 作用 | 是否强制访问控制 |
|---|---|---|
| `_name` | 表示内部实现细节 | 否 |
| `property` | 管理属性访问、验证或计算 | 部分控制赋值逻辑 |
| `__slots__` | 限制实例属性集合、优化内存 | 否 |

例如：

```python
class Stock:
    __slots__ = ('name', '_shares', 'price')
```

这里 `_shares` 的下划线表示“内部使用”，而 `__slots__` 表示实例只能拥有这些属性。二者可以配合使用，但含义不同。

## 关键注意点

- `__slots__` 是类属性，不是实例属性。
- 它通常写成字符串元组，如 `('name', '_shares', 'price')`。
- 声明后，实例不能随意添加未列出的属性。
- 如果未包含 `__dict__`，实例通常没有普通实例字典。
- 它不等于私有属性，也不提供真正访问控制。
- 它最常用于大量小对象的内存优化。
- 日常代码中不应为了“看起来更封装”而滥用。

## 小结

`__slots__` 是 Python 提供的一种限制实例属性和优化对象内存布局的机制。它可以让类的实例只拥有预先声明的属性，并避免普通实例字典带来的额外开销。虽然它能帮助发现属性拼写错误，也能让对象结构更固定，但其核心价值主要在性能和内存优化，而不是强制封装。

在设计类时，应优先考虑清晰的公共接口、合理的命名约定和必要的 `property` 管理；只有在属性集合稳定且实例数量巨大时，才应考虑使用 `__slots__`。

See also: [[summaries/05_Object_model__00_Overview]]