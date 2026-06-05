---
sources: [summaries/05_Object_model__00_Overview.md, summaries/01_Testing.md, summaries/05_Decorated_methods.md, summaries/03_Returning_functions.md, summaries/01_Iteration_protocol.md, summaries/02_Classes_encapsulation.md]
brief: Python property 用普通属性语法封装读取、赋值、验证与计算逻辑。
---

# Python property 属性

Python 的 `property` 是一种用于创建“受管理属性”的机制。它允许类把方法包装成看起来像普通属性的接口，从而在保持 `obj.attr` 访问语法不变的同时，加入读取、赋值、类型检查、计算值等逻辑。

该概念在 [[summaries/02_Classes_encapsulation]] 中用于说明 Python 类的封装方式，尤其是如何在没有强制私有成员机制的语言中，通过约定和属性管理实现更稳定的公共接口。在 [[summaries/03_Returning_functions]] 中，`property` 又被用作闭包生成重复属性代码的例子，展示了它不仅能手写，也可以由函数动态创建。

## 核心思想

普通属性可以直接读取和修改：

```python
s.shares = 100
```

但如果类希望限制 `shares` 必须是整数，直接暴露属性就不够安全：

```python
s.shares = "hundred"
s.shares = [1, 0, 0]
```

传统做法可能是写 getter/setter 方法：

```python
def get_shares(self):
    return self._shares

def set_shares(self, value):
    if not isinstance(value, int):
        raise TypeError('Expected int')
    self._shares = value
```

但这样会改变外部调用方式：

```python
s.set_shares(50)
```

`property` 的价值在于：它让类可以继续提供普通属性语法，同时在背后执行方法逻辑。

## 基本写法

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

使用方式仍然像普通属性：

```python
s = Stock('IBM', 50, 91.1)
s.shares      # 调用 getter
s.shares = 75 # 调用 setter
```

这里的 `shares` 是公共接口，`_shares` 是内部存储细节。前导下划线 `_` 表示该名称属于内部实现，不建议外部代码直接访问。这与 python encapsulation 密切相关。

## getter 与 setter

`property` 通常由两个部分组成：

- getter：读取属性时触发；
- setter：给属性赋值时触发。

例如：

```python
@property
def shares(self):
    return self._shares
```

当执行：

```python
s.shares
```

会调用 getter。

```python
@shares.setter
def shares(self, value):
    if not isinstance(value, int):
        raise TypeError('Expected int')
    self._shares = value
```

当执行：

```python
s.shares = 75
```

会调用 setter。

setter 也会在类内部赋值时触发，包括 `__init__()` 中的赋值：

```python
def __init__(self, name, shares, price):
    self.shares = shares  # 调用 setter
```

因此，初始化阶段和后续修改阶段可以共用同一套验证逻辑。

## property 与私有属性的关系

`property` 经常与私有属性约定一起使用：

- 公共属性名：`shares`
- 内部存储名：`_shares`

外部代码使用：

```python
s.shares
```

类内部的 property 方法使用：

```python
self._shares
```

这并不意味着整个类都必须使用 `_shares`。在多数情况下，类的其他代码也可以继续使用 `self.shares`，从而让 setter 的检查逻辑持续生效。

这体现了 Python 的封装风格：不是强制禁止访问内部字段，而是通过命名约定与公共接口设计来表达意图。相关主题包括 object oriented programming 和 managed attributes。

## 用于计算属性

`property` 不只用于校验赋值，也常用于计算属性。

例如，股票持仓成本可以由 `shares * price` 计算得出：

```python
class Stock:
    def __init__(self, name, shares, price):
        self.name = name
        self.shares = shares
        self.price = price

    @property
    def cost(self):
        return self.shares * self.price
```

调用时不需要括号：

```python
s = Stock('GOOG', 100, 490.1)
s.cost
# 49010.0
```

这隐藏了 `cost` 实际上是由方法计算得出的事实。调用者只需要知道它是对象上的一个可读属性。

## 统一访问接口

没有 `property` 时，对象接口可能不一致：

```python
s.shares   # 数据属性
s.cost()   # 方法调用
```

这会让使用者困惑：为什么一个值需要括号，另一个不需要？

使用 `property` 后，可以统一为：

```python
s.shares
s.cost
```

这种统一访问方式体现了封装的核心思想：调用者不需要关心数据是直接存储的，还是即时计算出来的。类可以在不改变外部接口的情况下调整内部实现。

## 与装饰器语法的关系

`@property` 使用 Python 的装饰器语法：

```python
@property
def cost(self):
    return self.shares * self.price
```

`@` 表示把紧随其后的函数定义交给某个装饰器处理。这里 `property` 会把方法转换成属性描述符，使它能够通过属性访问语法调用。

因此，`property` 也与 python decorators 相关。它本质上把函数对象转换成一个实现属性访问协议的对象，也与 descriptor 有关。

## 用闭包生成 property

当一个类有多个字段都需要相同的验证逻辑时，手写 `property` 会产生大量重复代码。例如 `name` 要求是 `str`，`shares` 要求是 `int`，`price` 要求是 `float`，每个字段都需要类似的 getter、setter 和类型检查。

[[summaries/03_Returning_functions]] 展示了一种利用 closure 生成 `property` 的写法：

```python
def typedproperty(name, expected_type):
    private_name = '_' + name

    @property
    def prop(self):
        return getattr(self, private_name)

    @prop.setter
    def prop(self, value):
        if not isinstance(value, expected_type):
            raise TypeError(f'Expected {expected_type}')
        setattr(self, private_name, value)

    return prop
```

这里 `typedproperty()` 是一个函数工厂：它接收属性名和期望类型，然后返回一个配置好的 `property` 对象。

内部函数 `prop()` 使用了外层函数中的变量：

- `name`
- `private_name`
- `expected_type`

即使 `typedproperty()` 已经执行结束，返回的 `property` 仍然能记住这些值。这是闭包的作用：返回的内部函数携带了它运行所需的外部变量环境。

## 类型化属性工厂

借助 `typedproperty()`，可以把 `Stock` 类写得更紧凑：

```python
from typedproperty import typedproperty

class Stock:
    name = typedproperty('name', str)
    shares = typedproperty('shares', int)
    price = typedproperty('price', float)

    def __init__(self, name, shares, price):
        self.name = name
        self.shares = shares
        self.price = price
```

创建实例时：

```python
s = Stock('IBM', 50, 91.1)
```

赋值会通过对应的 setter，因此类型检查仍然生效：

```python
s.shares = '100'   # TypeError
```

这个例子说明：`property` 不只是一种封装工具，也可以作为可组合的对象被函数动态生成。闭包负责保存每个属性的配置，`property` 负责把 getter/setter 接入属性访问语法。

## 用 lambda 简化 property 工厂调用

如果 `typedproperty('shares', int)` 这样的调用重复出现，也可以结合 lambda 定义更短的辅助函数：

```python
String = lambda name: typedproperty(name, str)
Integer = lambda name: typedproperty(name, int)
Float = lambda name: typedproperty(name, float)
```

然后类定义可以进一步简化为：

```python
class Stock:
    name = String('name')
    shares = Integer('shares')
    price = Float('price')

    def __init__(self, name, shares, price):
        self.name = name
        self.shares = shares
        self.price = price
```

这里的重点不是 `lambda` 本身，而是闭包、函数返回函数与 `property` 可以组合起来，用来消除重复代码并形成更清晰的声明式接口。

## property、闭包与代码生成

手写 `@property` 适合少量属性；当大量属性具有相同模式时，闭包工厂更合适。

两种方式的对比如下：

- 手写 `property`：逻辑直观，适合少量特殊属性；
- 闭包生成 `property`：减少重复，适合大量结构相似的属性；
- `lambda` 包装工厂：进一步简化常见类型的声明方式。

这种做法体现了 Python 中“函数可以创建函数或对象”的思想。它也为后续理解 python decorators 提供基础，因为装饰器同样常利用函数返回函数、闭包和延迟绑定环境。

## 常见用途

Python `property` 常见于以下场景：

1. **类型检查**

   ```python
   @shares.setter
   def shares(self, value):
       if not isinstance(value, int):
           raise TypeError('Expected int')
       self._shares = value
   ```

2. **值范围检查**

   例如限制价格不能为负数。

3. **计算属性**

   如 `cost = shares * price`。

4. **保持向后兼容**

   原本是普通属性的字段，可以在不改变外部调用方式的情况下升级为受管理属性。

5. **隐藏实现细节**

   外部代码只看到 `s.shares`，不知道内部是否存储为 `_shares`，也不知道是否有额外校验逻辑。

6. **减少重复属性代码**

   通过 `typedproperty()` 这类闭包工厂，批量生成具有相同访问和验证规则的属性。

## 注意事项

虽然 `property` 很有用，但不应滥用。

如果属性只是简单存储数据，没有校验、计算或封装需求，普通属性通常更清晰。[[summaries/02_Classes_encapsulation]] 特别强调：私有属性、properties、`__slots__` 等机制都有特定用途，但大多数日常代码不需要过度使用。

同样，闭包生成 `property` 也适合存在明显重复模式的场景。如果每个属性的逻辑都高度不同，显式写出 getter/setter 反而更易读。

## 与 __slots__ 的区别

`property` 与 `__slots__` 都可能出现在类封装设计中，但作用不同：

- `property` 管理属性访问逻辑；
- `__slots__` 限制实例允许拥有的属性名，并可减少内存占用。

例如，若 `shares` 使用 property，实际存储字段可能是 `_shares`，那么使用 `__slots__` 时需要声明 `_shares`：

```python
class Stock:
    __slots__ = ('name', '_shares', 'price')
```

如果用 `typedproperty('shares', int)` 生成属性，同样需要注意内部实际存储名是 `_shares`。

相关主题可见 python slots 和 python object memory。

## 小结

`property` 是 Python 中实现封装和统一接口的重要工具。它让类可以：

- 使用普通属性语法；
- 在读取属性时执行代码；
- 在赋值属性时进行验证；
- 把方法伪装成计算属性；
- 保持外部接口稳定；
- 隐藏内部实现细节；
- 与闭包结合，动态生成重复的属性管理代码。

它体现了 Python 面向对象设计中的一个重要原则：通过清晰的公共接口和命名约定来管理复杂性，而不是依赖严格的访问控制。同时，它也展示了 Python 函数式特性与面向对象特性的结合：函数、闭包、装饰器和属性机制可以共同构建简洁而灵活的类接口。

See also: [[summaries/01_Iteration_protocol]], [[summaries/03_Returning_functions]]

See also: [[summaries/05_Decorated_methods]]

See also: [[summaries/01_Testing]]

See also: [[summaries/05_Object_model__00_Overview]]