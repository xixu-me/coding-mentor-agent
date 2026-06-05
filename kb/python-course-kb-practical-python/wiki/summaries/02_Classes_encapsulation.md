---
doc_type: short
full_text: sources/02_Classes_encapsulation.md
---

# 02_Classes_encapsulation 总结

本文介绍 Python 中类与对象的封装方式，重点说明公共接口与内部实现的区别，以及 Python 如何通过命名约定、属性管理、`property` 和 `__slots__` 来实现较弱但实用的封装。

## 核心主题

### 公共接口与私有实现

类的一个重要作用是封装对象的数据和内部实现细节，同时向外部提供稳定的公共接口。外部代码应通过公共接口操作对象，而不应依赖对象的内部结构。

不过，Python 的对象系统非常开放：

- 可以轻易查看对象内部属性；
- 可以随意修改对象属性；
- 没有强制性的私有成员访问控制机制。

因此，Python 的封装主要依赖程序员遵守约定，而不是语言强制执行。这与 python encapsulation 和 object oriented programming 密切相关。

## 私有属性约定

Python 中，以下划线 `_` 开头的名称通常被视为“私有”或“内部实现细节”：

```python
class Person(object):
    def __init__(self, name):
        self._name = name
```

这种私有性只是约定，并不阻止外部访问：

```python
p = Person('Guido')
p._name = 'Dave'
```

一般规则是：变量、函数、模块名只要以下划线开头，就表示它们不属于公共接口。直接使用这类名称通常意味着代码正在依赖实现细节，应优先寻找更高层的公共功能。

## 简单属性的问题

普通 Python 类可以直接暴露属性：

```python
class Stock:
    def __init__(self, name, shares, price):
        self.name = name
        self.shares = shares
        self.price = price
```

这种写法简单直接，但缺点是无法限制属性值类型：

```python
s = Stock('IBM', 50, 91.1)
s.shares = 100
s.shares = "hundred"
s.shares = [1, 0, 0]
```

如果希望 `shares` 始终是整数，就需要引入某种属性管理机制。

## 访问器方法的问题

一种传统做法是使用 getter/setter 方法：

```python
class Stock:
    def __init__(self, name, shares, price):
        self.name = name
        self.set_shares(shares)
        self.price = price

    def get_shares(self):
        return self._shares

    def set_shares(self, value):
        if not isinstance(value, int):
            raise TypeError('Expected an int')
        self._shares = value
```

这种方式可以加入类型检查，但会破坏原有调用方式：

```python
s.shares = 50
```

必须改为：

```python
s.set_shares(50)
```

这会影响已有代码的兼容性。

## property：受管理的属性

Python 提供 `@property` 机制，使方法可以像普通属性一样访问，同时仍能在读取或赋值时执行自定义逻辑。

```python
class Stock:
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

现在，普通属性访问会触发 getter/setter：

```python
s = Stock('IBM', 50, 91.1)
s.shares      # 调用 @property
s.shares = 75 # 调用 @shares.setter
```

重要特点：

- 外部代码仍然使用 `s.shares`，无需改成 `s.get_shares()` 或 `s.set_shares()`；
- 类内部的 `self.shares = shares` 同样会触发 setter；
- 实际数据通常保存在私有属性中，如 `_shares`；
- 除 property 本身外，类中其他代码仍可以继续使用公共属性名 `shares`。

这一模式是 Python 中实现 managed attributes 的常见方式。

## 计算属性

`property` 也常用于把计算结果包装成属性。例如股票成本可以由 `shares * price` 计算得到：

```python
class Stock:
    @property
    def cost(self):
        return self.shares * self.price
```

这样调用者可以写：

```python
s = Stock('GOOG', 100, 490.1)
s.cost
```

而不是：

```python
s.cost()
```

这让对象接口更加统一：普通数据属性和计算属性都可以通过无括号的属性访问方式获得。

## 统一访问原则

如果一个对象既有数据属性，又有计算方法，接口可能显得不一致：

```python
s.cost()   # 方法
s.shares   # 数据属性
```

使用 `property` 后，调用方式可以统一为：

```python
s.cost
s.shares
```

这种设计隐藏了“数据是存储的还是计算的”这一实现细节，使公共接口更稳定。这一点体现了封装的核心价值：调用者不需要知道内部实现。

## 装饰器语法

`@property` 使用的是 Python 装饰器语法：

```python
@property
def cost(self):
    return self.shares * self.price
```

`@` 表示把紧随其后的函数定义交给某个装饰器处理。这里 `property` 会把方法转换成属性描述符。该主题可进一步关联到 python decorators。

## __slots__：限制属性集合

`__slots__` 可以限制实例允许拥有的属性名：

```python
class Stock:
    __slots__ = ('name', '_shares', 'price')

    def __init__(self, name, shares, price):
        self.name = name
```

如果尝试设置未声明的属性，会抛出 `AttributeError`：

```python
s.prices = 410.2
# AttributeError: 'Stock' object has no attribute 'prices'
```

`__slots__` 的作用包括：

- 防止拼写错误导致意外创建新属性；
- 限制对象使用方式；
- 减少对象内存占用；
- 在某些数据结构类中提高运行效率。

不过，本文强调 `__slots__` 主要是性能和内存优化工具，而不是日常封装的首选手段。多数普通类不需要使用它。该主题可关联到 python slots 和 python object memory。

## 练习要点

### 练习 5.6：简单 property

将 `Stock.cost()` 方法改为 `cost` 属性，使其调用方式从：

```python
s.cost()
```

变为：

```python
s.cost
```

改动后，`s.cost()` 将不再可用，因为 `cost` 已经是属性值，而不是可调用方法。相关程序如 `pcost.py` 也需要同步移除括号。

### 练习 5.7：property 与 setter

把 `shares` 改为受管理属性：

- 实际值存储在 `_shares`；
- 通过 `@property` 读取；
- 通过 `@shares.setter` 设置；
- setter 中检查值必须是整数；
- 非整数赋值时抛出 `TypeError`。

目标行为：

```python
s.shares = 50
s.shares = 'a lot'  # TypeError
```

### 练习 5.8：添加 __slots__

为 `Stock` 添加 `__slots__`，验证：

- 不能随意添加新属性，如 `s.blah = 42`；
- 使用 `__slots__` 后，实例通常不再有普通的 `__dict__`；
- 这说明对象内部表示发生变化，内存使用更高效。

## 关键结论

- Python 的封装主要依赖命名约定，而非强制访问控制。
- `_name` 这类前导下划线名称表示内部实现细节，不应被外部代码直接依赖。
- `property` 可以在保持属性访问语法不变的情况下加入验证、计算和封装逻辑。
- `property` 有助于提供统一接口，隐藏数据是存储的还是计算的。
- `__slots__` 可以限制属性集合并优化内存，但不应滥用。
- 私有属性、property 和 slots 都是有特定用途的工具，大多数日常代码不需要过度使用。

## 相关概念

- python encapsulation
- object oriented programming
- managed attributes
- python properties
- python decorators
- python slots
- python object memory

## Related Concepts
- [[concepts/Python-property-属性]]
- [[concepts/Python-slots]]
- [[concepts/Python-封装与访问约定]]
- [[concepts/类与对象]]
- [[concepts/Python-对象模型]]
- [[concepts/库接口设计]]
- [[concepts/动态属性访问]]
- [[concepts/异常处理]]
- [[concepts/字典与数据建模]]
- [[concepts/Python-命名空间与作用域]]
- [[concepts/特殊方法]]
