---
sources: [summaries/05_Object_model__00_Overview.md, summaries/05_Decorated_methods.md, summaries/03_Returning_functions.md, summaries/01_Iteration_protocol.md, summaries/02_Classes_encapsulation.md, summaries/00_Overview.md]
brief: Python 通过命名约定、property 与对象模型惯用法实现非强制式封装。
---

# Python 封装与访问约定

Python 的封装机制不同于许多传统面向对象语言。它通常不依赖语言层面的 `private`、`protected` 等强制访问控制，而是依靠命名约定、程序员共识、属性管理机制和对象设计惯用法来表达“哪些成员属于公共接口，哪些成员只是内部实现”。这一特点在 [[summaries/05_Object_model__00_Overview]] 中被作为理解 Python 对象内部工作机制的重要入口提出，并在 [[summaries/02_Classes_encapsulation]] 中通过私有属性、`property` 和 `__slots__` 得到进一步展开。

## 核心思想

Python 的对象系统强调灵活性、透明性和约定。对象的属性和方法通常可以被外部代码直接访问、检查和修改，这使得 Python 看起来不像某些语言那样“严格封装”。来自其他面向对象语言的程序员常会觉得 Python 类机制缺少一些熟悉功能：没有强制访问控制，`self` 参数显式出现，对象操作似乎像“自由发挥”。

但这种开放性并不等于没有封装。Python 的封装重点不是“让外部代码绝对无法访问内部状态”，而是“清楚表达哪些名称是稳定接口，哪些名称只是实现细节”。常见手段包括：

- 用命名约定表达访问意图；
- 用清晰的 API 设计区分公开接口和内部实现；
- 用 `property` 等机制在保持属性访问语法的同时加入验证、计算或控制逻辑；
- 在必要时用 `__slots__` 限制对象可拥有的属性集合；
- 信任程序员遵守约定，而不是由语言强制禁止访问。

这种风格体现了 Python 社区常见的理念：代码应当清晰、直接，并且程序员应对自己的行为负责。

## 与传统访问控制的区别

在许多面向对象语言中，类成员可以通过关键字控制访问范围，例如：

- `private`：只能在类内部访问；
- `protected`：允许子类或同包访问；
- `public`：允许外部访问。

而 Python 中没有完全对应的强制机制。类的属性通常存放在对象内部结构中，并可通过点号语法访问。这与 字典与属性存储、Python对象模型 和 类与实例 密切相关。

因此，Python 的封装不是“禁止外部访问”，而是“告诉外部代码哪些东西不应该依赖”。外部代码仍然可以访问对象内部，但如果它依赖了内部属性，就承担了未来实现变化带来的风险。

## Python 对象开放性的影响

[[summaries/05_Object_model__00_Overview]] 指出，Python 对象的工作方式对其他语言背景的程序员可能显得过于开放：没有访问修饰符，`self` 显式传递，对象内部状态似乎很容易被外部触碰。[[summaries/02_Classes_encapsulation]] 进一步强调，Python 中关于类和对象的很多东西确实都是开放的：

- 可以检查对象内部属性；
- 可以修改对象属性；
- 通常可以动态添加新属性；
- 没有强制性的私有成员访问控制。

这种开放性带来很强的灵活性，也让调试、交互式探索和元编程更加方便。但它也意味着类设计者需要更清楚地区分：

- 哪些名称是稳定的公共 API；
- 哪些名称只是当前实现细节；
- 哪些属性可以被外部安全修改；
- 哪些状态必须通过受控接口维护不变量。

Python 封装的重点不是把对象完全封闭起来，而是管理调用者对对象内部结构的依赖。

## `self` 与封装边界

Python 实例方法显式接收 `self` 参数，这一点常让来自其他语言的程序员感到陌生。`self` 并不是特殊的访问控制机制，而是 Python 对象模型中表达“当前实例”的普通约定。

这种显式性有助于理解封装边界：

```python
class Account:
    def __init__(self):
        self._balance = 0

    def deposit(self, amount):
        self._balance += amount
```

这里 `self._balance` 明确表示实例上的内部状态，`deposit()` 则是外部代码应优先使用的公共操作。Python 不阻止外部访问 `account._balance`，但单下划线表明它不是稳定公共接口。

因此，`self`、属性访问和命名约定共同构成了 Python 封装风格的一部分。理解这一点需要结合 Python对象模型、属性访问 和 字典与属性存储。

## 常见访问约定

### 1. 公开属性和方法

普通名称通常表示公开接口，例如：

```python
class Account:
    def deposit(self, amount):
        self.balance += amount
```

这里的 `deposit` 和 `balance` 都是普通名称，外部代码可以直接访问。在设计良好的类中，公开方法和公开属性应构成相对稳定的接口。调用者可以合理依赖这些名称，而类的内部实现则可以在不破坏接口的前提下变化。

Python 允许直接暴露简单数据属性。例如：

```python
class Stock:
    def __init__(self, name, shares, price):
        self.name = name
        self.shares = shares
        self.price = price
```

这种写法简洁自然，但也意味着外部代码可以给属性赋任意值：

```python
s = Stock('IBM', 50, 91.1)
s.shares = 100
s.shares = 'hundred'
s.shares = [1, 0, 0]
```

如果对象需要维护更严格的不变量，例如 `shares` 必须始终是整数，就需要进一步使用受管理属性。

### 2. 单下划线 `_name`

以单下划线开头的名称通常表示“内部使用”或“私有实现细节”，例如：

```python
class Account:
    def __init__(self):
        self._balance = 0
```

`_balance` 并不会被 Python 禁止访问：

```python
account._balance
```

但按照约定，外部代码不应直接依赖它。它表示这是类的内部实现细节，将来可能改变。

同样，在 `Stock` 示例中，受管理属性通常会把真实数据存在单下划线属性里：

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

这里 `_shares` 是内部存储细节，`shares` 才是公共接口。外部代码应使用 `s.shares`，而不是 `s._shares`。

一般来说，任何以下划线开头的变量、函数、方法或模块名，都应被视为内部实现。如果发现自己在外部直接使用这类名称，通常说明应该寻找更高层的公开接口。

### 3. 双下划线 `__name`

以双下划线开头的属性会触发名称改写，即 name mangling：

```python
class Account:
    def __init__(self):
        self.__balance = 0
```

Python 会将 `__balance` 改写为类似 `_Account__balance` 的形式。这并不是严格的私有访问控制，而是为了避免子类中名称冲突。

因此，双下划线更适合用于防止继承层级中的意外覆盖，而不是用于实现真正意义上的私有变量。多数日常代码中，单下划线约定已经足够表达“内部使用”的含义。

### 4. 属性接口 `property`

Python 可以通过 `property` 在保持属性访问语法的同时增加控制逻辑。这是 Python 封装中非常重要的惯用法，与 面向对象编程惯用法 和 Python属性与property 相关。

例如，可以先写一个简单类：

```python
class Stock:
    def __init__(self, name, shares, price):
        self.name = name
        self.shares = shares
        self.price = price
```

如果后来发现 `shares` 需要类型检查，不必把所有外部代码从 `s.shares = 50` 改成 `s.set_shares(50)`，而可以改用 `property`：

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

这样，外部代码仍然使用普通属性语法：

```python
s = Stock('IBM', 50, 91.1)
s.shares      # 调用 getter
s.shares = 75 # 调用 setter
```

`property` 的重要价值在于：

- 保持公共接口不变；
- 在赋值时执行验证逻辑；
- 隐藏内部存储名称，例如 `_shares`；
- 允许类内部的 `self.shares = shares` 同样经过 setter；
- 让对象从简单数据属性平滑演化为受管理属性。

这体现了 Python 封装的一个关键设计思想：一开始可以使用简单属性，等确实需要控制时再引入 `property`，而不必预先编写大量 getter/setter。

## 计算属性与统一访问

`property` 不仅可以管理存储属性，也可以把计算结果包装成属性。例如股票成本可以由 `shares * price` 计算得到：

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

这样调用者可以写：

```python
s = Stock('GOOG', 100, 490.1)
s.cost
```

而不是：

```python
s.cost()
```

这让对象接口更加统一。否则对象可能同时出现：

```python
s.shares  # 数据属性
s.cost()  # 方法
```

调用者会疑惑：为什么有些信息需要括号，有些不需要？使用 `property` 后，类可以隐藏“这个值是存储的还是计算的”这一实现细节。调用者只需关心对象提供了一个名为 `cost` 的属性式接口。

这种统一访问原则是 Python 对象设计中很有用的封装技巧：公共接口表达对象能提供什么，而不暴露它如何提供。

## 装饰器语法与 property

`@property` 使用的是 Python 装饰器语法：

```python
@property
def cost(self):
    return self.shares * self.price
```

`@` 表示把紧随其后的函数定义交给某个装饰器处理。这里 `property` 会把方法转换成属性描述符，使其可通过点号属性访问。相关主题可进一步连接到 Python装饰器。

setter 也使用装饰器形式：

```python
@shares.setter
def shares(self, value):
    ...
```

这种语法让 getter 和 setter 与同一个公共属性名绑定在一起，从而形成一个受管理属性。

## `__slots__` 与属性限制

除了命名约定和 `property`，Python 还提供 `__slots__` 来限制实例可以拥有的属性名：

```python
class Stock:
    __slots__ = ('name', '_shares', 'price')

    def __init__(self, name, shares, price):
        self.name = name
        self.shares = shares
        self.price = price
```

如果尝试设置未声明的属性，会抛出 `AttributeError`：

```python
s.prices = 410.2
# AttributeError: 'Stock' object has no attribute 'prices'
```

`__slots__` 可以带来几个效果：

- 防止因拼写错误意外创建新属性；
- 限制对象的属性集合；
- 改变实例的内部表示；
- 减少内存占用；
- 在大量数据结构对象中带来一定性能收益。

不过，`__slots__` 更常被视为内存和性能优化工具，而不是日常封装的主要手段。使用 `__slots__` 后，实例通常不再拥有普通的 `__dict__`，这会影响对象的动态扩展能力。因此，多数普通业务类不需要使用它。相关内容可连接到 Python对象模型 和 字典与属性存储。

## 来源文档中的关键观点

[[summaries/05_Object_model__00_Overview]] 是“Python 对象内部机制”一章的导览。它提出，本章会解释 Python 对象与类如何在内部工作，并回应其他语言背景程序员常见的困惑：

- Python 没有 `private`、`protected` 这样的访问控制；
- 实例方法中的 `self` 参数显得特殊；
- 对象属性与方法的使用方式看起来非常开放；
- 尽管不理解内部细节也可以写 Python，但理解对象模型有助于写出更符合 Python 风格的代码。

该导览还把本章分为两个方向：一是重新讨论字典与对象实现，二是介绍封装技巧。因此，Python 封装不能孤立理解，它与对象属性如何存储、属性如何查找、类与实例如何关联等问题紧密相连。

[[summaries/00_Overview]] 指出，来自其他语言的程序员常会觉得 Python 的类机制缺少一些功能，例如没有明确访问控制、`self` 参数需要显式出现、对象操作看起来较为自由。但这种“自由”并不是无结构的混乱。理解 Python 类和对象的内部机制后，可以更好地理解为什么 Python 采用这种设计，以及如何用惯用法实现合理的封装。

[[summaries/02_Classes_encapsulation]] 则进一步说明，Python 的封装依赖以下工具和约定：

- 单下划线表示内部实现；
- 普通属性可以直接暴露，但可能缺乏验证；
- `property` 可以在不改变调用代码的情况下加入 getter、setter 和计算逻辑；
- 计算属性可以让接口更加统一；
- `__slots__` 可以限制属性集合并优化内存；
- 私有属性、property 和 slots 都应按需使用，不应过度设计。

## 封装在 Python 中的实际意义

Python 封装的重点不是隐藏一切，而是管理依赖关系：

- 哪些属性和方法是外部代码可以稳定使用的？
- 哪些细节只是当前实现的一部分？
- 类的内部状态是否可以在不破坏外部代码的情况下修改？
- API 是否清晰地表达了对象的职责？
- 是否可以在保持接口稳定的前提下改变内部实现？

换句话说，Python 封装关注的是接口与实现的分离，而不是通过语言机制强行阻止访问。

一个典型演化路径是：

1. 初始版本使用简单公开属性；
2. 当需要验证、计算或兼容旧接口时，引入 `property`；
3. 当实例数量巨大且内存成为问题时，考虑 `__slots__`；
4. 始终通过命名约定表达公共 API 与内部细节的边界。

## 优点与风险

### 优点

- 代码更简洁，减少样板访问器方法；
- 调试和交互式探索更方便；
- 对象模型透明，便于理解运行时行为；
- 可以在需要时逐步引入 `property` 等控制机制；
- 公共接口可以保持稳定，内部实现可以逐步演化；
- 计算属性可让对象接口更加统一。

### 风险

- 外部代码可能误用内部属性；
- 缺少强制访问限制可能导致对象状态被破坏；
- 如果命名约定不清晰，类的公共 API 边界会变模糊；
- 团队协作中需要共同遵守约定；
- 过度使用私有属性、property 或 `__slots__` 会增加复杂度；
- 将方法改为 property 后，原本使用 `obj.method()` 的代码需要改为 `obj.method`。

## 与 Python 对象模型的关系

Python 的封装方式与其对象模型紧密相关。对象属性通常可动态添加、查询和修改，这种机制使 Python 类更灵活，但也要求程序员理解属性查找、实例字典和类字典等内部机制。

`property` 依赖属性访问机制工作；`__slots__` 则改变对象属性的存储方式。单下划线和双下划线等命名规则虽然只是约定或名称改写，但它们同样建立在 Python 对象属性访问和命名解析机制之上。这些内容进一步说明，Python 的封装并不是独立的语法特性，而是建立在其对象模型和属性机制之上的设计风格。

相关内容可进一步连接到：

- Python对象模型
- 类与实例
- 字典与属性存储
- 属性访问
- 面向对象编程惯用法
- Python属性与property
- Python装饰器

## 总结

Python 封装与访问约定体现了一种“约定优于强制”的设计风格。它不通过严格的访问修饰符限制对象成员，而是通过命名规则、API 设计、`property`、计算属性和 `__slots__` 等惯用法来区分公开接口与内部实现。

理解这一点，有助于从传统面向对象语言的思维切换到更符合 Python 风格的对象设计方式：先保持接口简单清晰，在确实需要控制、验证、计算或优化时，再使用相应机制增强封装。同时，理解 Python对象模型 和 字典与属性存储 能帮助解释为什么 Python 的封装看起来开放，却仍然可以形成清晰、稳定、可维护的对象接口。

See also: [[summaries/01_Iteration_protocol]]

See also: [[summaries/03_Returning_functions]]

See also: [[summaries/05_Decorated_methods]]