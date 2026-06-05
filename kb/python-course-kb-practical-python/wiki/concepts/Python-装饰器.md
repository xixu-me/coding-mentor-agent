---
sources: [summaries/07_Advanced_Topics__00_Overview.md, summaries/05_Decorated_methods.md, summaries/04_Function_decorators.md, summaries/03_Returning_functions.md, summaries/02_Anonymous_function.md, summaries/01_Variable_arguments.md, summaries/00_Overview.md]
brief: Python 装饰器是在不改写主体代码的前提下包装、扩展函数或方法行为的机制。
---

# Python 装饰器

Python 装饰器是一种用于**修改、包装或扩展函数与方法行为**的机制。它通常以 `@decorator_name` 的形式写在函数或方法定义之前，使程序员能够在不直接改写原函数主体的情况下，为其增加日志、计时、权限检查、缓存、替代构造、属性访问等额外逻辑。

在 [[summaries/00_Overview]] 中，装饰器被列为第 7 章“高级主题”的核心内容之一。[[summaries/03_Returning_functions]] 说明，装饰器建立在“函数可以返回函数”和 [[concepts/闭包]] 的基础之上；[[summaries/04_Function_decorators]] 展示了装饰器如何从重复代码问题中自然产生；[[summaries/05_Decorated_methods]] 则进一步说明，装饰器不仅能用于普通函数，也广泛用于类定义中的特殊方法，例如 `@staticmethod`、`@classmethod` 和 `@property`。

## 基本思想

装饰器的核心思想包括：

- 函数是对象，可以被赋值、传递和返回；
- 一个函数可以接收另一个函数作为参数；
- 一个函数也可以返回新的函数；
- 返回的内部函数可以通过 [[concepts/闭包]] 保留外部变量；
- 装饰器通过“包裹”原函数，在调用前、调用后或调用过程中插入额外行为；
- `@decorator` 只是语法糖，本质上等价于重新绑定函数名；
- 在类定义中，装饰器还可以改变方法绑定方式，例如是否自动接收 `self` 或 `cls`。

因此，装饰器与 函数式编程、[[concepts/闭包]]、Python函数参数、lambda、包装函数、横切关注点、Python类方法与静态方法、属性 和 面向对象编程 等概念密切相关。

## 从重复代码到装饰器

[[summaries/04_Function_decorators]] 用日志示例说明装饰器的动机。假设有一个简单函数：

```python
def add(x, y):
    return x + y
```

如果希望调用函数时打印日志，可能会写成：

```python
def add(x, y):
    print('Calling add')
    return x + y
```

再有一个函数 `sub()`，也可能写成：

```python
def sub(x, y):
    print('Calling sub')
    return x - y
```

这就产生了明显的重复：每个函数都要手写类似的日志逻辑。重复代码不仅编写繁琐，也难以维护；如果以后想改变日志格式，就必须修改许多函数。

装饰器正是为这类问题提供结构化解决方案：把与核心业务无关、但需要横跨多个函数的逻辑集中起来。这类逻辑常被称为 横切关注点，例如日志、计时、权限、缓存、参数检查等。

## 包装函数：装饰器的核心模式

为了消除重复，可以写一个函数来“制造带日志的新函数”：

```python
def logged(func):
    def wrapper(*args, **kwargs):
        print('Calling', func.__name__)
        return func(*args, **kwargs)
    return wrapper
```

这里的结构非常重要：

- `logged(func)` 接收原函数 `func`；
- 内部定义 `wrapper(*args, **kwargs)`；
- `wrapper` 在调用原函数前打印日志；
- `wrapper` 使用 `func(*args, **kwargs)` 调用原函数；
- `logged()` 返回 `wrapper`，而不是直接执行原函数。

使用方式如下：

```python
def add(x, y):
    return x + y

logged_add = logged(add)
```

调用 `logged_add(3, 4)` 时，实际执行的是 `wrapper`：

```python
>>> logged_add(3, 4)
Calling add
7
```

这种 `wrapper` 就是 包装函数：它包裹另一个函数，在保持原函数核心行为的同时添加额外处理。

## 装饰器语法糖

由于“用包装函数包裹函数”的模式在 Python 中非常常见，Python 提供了专门语法：

```python
@logged
def add(x, y):
    return x + y
```

它等价于：

```python
def add(x, y):
    return x + y

add = logged(add)
```

也就是说，装饰器并不是神秘的新机制，而是以下步骤的简写：

1. Python 创建原函数对象 `add`；
2. 将该函数对象传入装饰器函数 `logged(add)`；
3. 装饰器返回一个新函数 `wrapper`；
4. 名字 `add` 被重新绑定到 `wrapper`；
5. 以后调用 `add(...)` 时，实际调用的是包装函数。

因此，装饰器会替换原函数对象，但包装函数通常会在内部继续调用原函数。

## 函数返回函数：装饰器的前提

[[summaries/03_Returning_functions]] 展示了如下模式：

```python
def add(x, y):
    def do_add():
        print('Adding', x, y)
        return x + y
    return do_add
```

调用 `add(3, 4)` 时，并不会立刻执行加法，而是返回内部函数 `do_add`：

```python
>>> a = add(3, 4)
>>> a()
Adding 3 4
7
```

这说明 Python 函数可以动态创建并返回另一个函数。装饰器正是建立在这一能力之上：

1. 外层函数接收一个函数；
2. 内层函数包装原函数；
3. 外层函数返回这个内层包装函数；
4. 原函数名被重新绑定到包装后的函数。

## 与闭包的关系

许多装饰器依赖 [[concepts/闭包]]。当内部函数被返回，并且它引用了外部函数作用域中的变量时，这个内部函数会保留所需的变量环境。

例如：

```python
def trace(func):
    def wrapper(*args, **kwargs):
        print(f"Calling {func.__name__}")
        return func(*args, **kwargs)
    return wrapper
```

这里 `wrapper` 捕获了外层作用域中的 `func`。即使 `trace()` 已经执行结束，`wrapper` 之后仍然能够调用原函数。这正是 [[summaries/03_Returning_functions]] 中强调的闭包特性：

> 闭包 = 函数 + 该函数运行所需的外部变量环境。

在装饰器中，这个“外部变量环境”通常至少包含被装饰的原函数，也可能包含配置参数、计数器、缓存字典、权限规则或统计状态等额外信息。

## 参数转发：`*args` 与 `**kwargs`

装饰器通常希望适用于许多不同签名的函数，因此包装函数往往写成：

```python
def wrapper(*args, **kwargs):
    return func(*args, **kwargs)
```

这与 Python函数参数 密切相关：

- `*args` 接收任意数量的位置参数；
- `**kwargs` 接收任意数量的关键字参数；
- 调用 `func(*args, **kwargs)` 可以把参数原样转发给被包装函数。

如果没有这种参数转发能力，装饰器就很难通用于不同函数。

## 函数元数据：`__name__` 与 `__module__`

[[summaries/04_Function_decorators]] 还强调，函数对象具有元数据属性，例如：

```python
def add(x, y):
    return x + y

add.__name__     # 'add'
add.__module__   # '__main__'
```

这些属性在装饰器中常用于日志、调试和诊断。例如日志装饰器可以使用 `func.__name__` 打印被调用函数的名称：

```python
print('Calling', func.__name__)
```

计时装饰器也可以同时使用模块名和函数名来输出更清晰的性能信息。

需要注意的是，基础装饰器会把原函数名重新绑定到 `wrapper`，因此如果不额外处理，最终函数的 `__name__`、文档字符串等元数据可能会丢失。在更完整的实践中，通常会使用 `functools.wraps` 保留这些信息。

## 示例：计时装饰器 `timethis`

[[summaries/04_Function_decorators]] 的练习要求实现一个 `timethis(func)` 装饰器，用来测量函数执行时间。基本实现如下：

```python
import time

def timethis(func):
    def wrapper(*args, **kwargs):
        start = time.time()
        r = func(*args, **kwargs)
        end = time.time()
        print('%s.%s: %f' % (func.__module__, func.__name__, end-start))
        return r
    return wrapper
```

使用方式：

```python
@timethis
def countdown(n):
    while n > 0:
        n -= 1

countdown(10000000)
```

可能输出：

```text
__main__.countdown: 0.076562
```

这个例子展示了装饰器作为性能诊断工具的典型用途：无需修改 `countdown()` 的主体，就能为它增加运行时间统计。

## 装饰器解决什么问题

装饰器常用于抽离与核心业务无关的重复逻辑，例如：

- 日志记录；
- 性能计时；
- 权限检查；
- 参数验证；
- 缓存；
- 事务管理；
- 调试辅助；
- 延迟执行或回调适配；
- 方法绑定方式声明；
- 替代构造器；
- 属性式访问。

例如，如果多个函数都需要记录调用时间，可以用一个装饰器统一处理，而不必在每个函数内部重复编写计时代码。这样能让业务函数保持简洁，也能让附加逻辑集中维护。

在类中，装饰器还可以把“这个函数应该如何作为方法被访问”表达得更清楚。例如 `@classmethod` 可以把“从 CSV 构造对象”的逻辑放回类本身，避免让外部模块了解太多类的内部构造细节。

## 与延迟执行和回调的关系

[[summaries/03_Returning_functions]] 使用 `after(seconds, func)` 展示了函数可以被保存并稍后执行：

```python
def after(seconds, func):
    import time
    time.sleep(seconds)
    func()
```

闭包可以携带额外信息，使函数在未来调用时仍然知道自己需要哪些数据：

```python
def add(x, y):
    def do_add():
        print(f'Adding {x} + {y} -> {x+y}')
    return do_add

after(30, add(2, 3))
```

这里 `do_add` 保留了 `x = 2` 和 `y = 3`。装饰器中的包装函数也使用同样的机制：它可以把原函数、配置参数和其他状态保存起来，等到真正调用时再执行。因此，装饰器与 回调函数、延迟执行 有天然联系。

## 参数化装饰器

由于闭包可以保留外层变量，装饰器还可以进一步扩展为“带参数的装饰器”。这类装饰器通常多包一层函数，用来保存配置：

```python
def repeat(n):
    def decorator(func):
        def wrapper(*args, **kwargs):
            result = None
            for _ in range(n):
                result = func(*args, **kwargs)
            return result
        return wrapper
    return decorator

@repeat(3)
def hello():
    print("Hello")
```

这里：

- `repeat(3)` 先执行，返回真正的装饰器 `decorator`；
- `decorator` 接收原函数 `hello`；
- `wrapper` 同时闭包保存了 `n` 和 `func`；
- 调用 `hello()` 时，实际调用的是 `wrapper()`。

这与 [[summaries/03_Returning_functions]] 中 `typedproperty(name, expected_type)` 的思想类似：外层函数接收配置，内部函数或对象保留配置并在之后使用。

## 与减少重复代码的关系

[[summaries/03_Returning_functions]] 强调闭包可以用于避免重复代码，尤其是“写函数来制造函数”或“写函数来制造属性”。例如 `typedproperty(name, expected_type)` 会根据属性名和期望类型生成带类型检查的 `property`：

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

这个例子虽然主要展示的是闭包与 `property`，但它和装饰器共享同一个抽象模式：

- 外层函数接收配置；
- 内层函数使用这些配置；
- 内层函数被返回并在之后运行；
- 重复逻辑被集中到一个可复用的工厂函数中。

因此，理解闭包如何减少重复代码，有助于理解装饰器为什么适合处理日志、计时、权限检查、缓存、属性验证等横切逻辑。

## 与 lambda 的关系

[[summaries/03_Returning_functions]] 还展示了用 lambda 简化闭包工厂调用：

```python
String = lambda name: typedproperty(name, str)
Integer = lambda name: typedproperty(name, int)
Float = lambda name: typedproperty(name, float)
```

虽然装饰器通常不直接依赖 `lambda`，但二者都体现了 Python 中函数是一等对象的思想。`lambda` 可以用来创建轻量级函数，而装饰器和闭包则常用于创建更复杂、可复用的函数包装逻辑。

## 装饰器与方法

装饰器不仅能用于普通函数，也常用于类中的方法。[[summaries/05_Decorated_methods]] 介绍了类定义中几个常见的预定义装饰器：

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

这些装饰器的作用不是简单地添加日志或计时，而是声明方法与类、实例、属性访问之间的关系：

- 普通实例方法会自动接收实例对象 `self`；
- `@staticmethod` 定义静态方法，不自动接收 `self` 或 `cls`；
- `@classmethod` 定义类方法，自动接收类对象 `cls`；
- `@property` 把方法转换成属性式访问。

因此，方法装饰器是理解 Python 对象模型、方法绑定机制、属性、描述符机制 和 面向对象编程 的重要入口。

## `@staticmethod`：静态方法

`@staticmethod` 用于定义静态方法。静态方法属于类的命名空间，但它不会自动接收实例对象，也不会自动接收类对象：

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

静态方法适合放置“与类有关，但不依赖实例状态或类状态”的辅助逻辑。例如：

- 类内部的工具函数；
- 实例创建或资源管理的辅助代码；
- 持久化、锁、系统资源管理等支持逻辑；
- 某些设计模式中的类级工具函数。

静态方法的关键特点是：函数逻辑被组织在类里，但调用时不会自动传入 `self` 或 `cls`。这与普通实例方法和类方法都不同。

## `@classmethod`：类方法

`@classmethod` 用于定义类方法。类方法调用时会自动接收类对象作为第一个参数，通常命名为 `cls`：

```python
class Foo:
    def bar(self):
        print(self)

    @classmethod
    def spam(cls):
        print(cls)
```

调用时：

```python
f = Foo()
f.bar()      # 打印实例 f
Foo.spam()   # 打印类 Foo
```

区别在于：

- 普通实例方法的第一个参数是实例 `self`；
- 类方法的第一个参数是类 `cls`；
- 类方法可以通过类本身调用，也可以通过实例调用；
- 类方法适合需要“知道当前类是谁”的逻辑。

`@classmethod` 与 Python类方法与静态方法、self与cls 密切相关。

## 类方法作为替代构造器

[[summaries/05_Decorated_methods]] 强调，类方法最常见的用途是定义 [[concepts/替代构造器]]。例如 `Date` 类可以通过 `today()` 根据当前日期创建实例：

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

这里最重要的一点是使用：

```python
return cls(...)
```

而不是写死：

```python
return Date(...)
```

这样做使构造逻辑对继承友好。如果有子类：

```python
class NewDate(Date):
    ...

d = NewDate.today()
```

调用 `NewDate.today()` 时，`cls` 是 `NewDate`，因此返回的是 `NewDate` 实例，而不是固定的 `Date` 实例。这体现了类方法在 Python继承 中的优势。

## 实践示例：`Portfolio.from_csv()`

[[summaries/05_Decorated_methods]] 的练习要求重构 `Portfolio` 对象的创建逻辑。原先的设计中，`report.py` 负责读取 CSV、解析字典、创建 `Stock` 对象，并最终构造 `Portfolio`：

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

这种写法让责任分散在多个地方：外部模块知道了太多 `Portfolio` 的内部构造细节。

改进后的设计让 `Portfolio` 自己维护内部列表，并通过 `append()` 保证其中只能加入 `Stock` 实例：

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

然后把“从 CSV 数据构造投资组合”的逻辑封装为类方法：

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

使用方式变为：

```python
from portfolio import Portfolio

with open('Data/portfolio.csv') as lines:
    port = Portfolio.from_csv(lines)
```

这个例子展示了 `@classmethod` 的设计价值：

- 把对象创建逻辑封装到类内部；
- 让外部代码不必了解类的内部表示；
- 用 `cls()` 而不是 `Portfolio()`，使构造逻辑支持继承；
- 通过 `append()` 集中维护类型检查和内部一致性；
- 让 `report.py` 等调用方更简洁。

这与 封装、面向对象设计、类型检查 和 [[concepts/替代构造器]] 密切相关。

## `@property`：属性式访问

`@property` 也是重要的内置装饰器。它把一个方法包装成属性访问形式，使调用者可以写：

```python
obj.name
```

而不是：

```python
obj.name()
```

在 [[summaries/03_Returning_functions]] 的 `typedproperty()` 示例中，`@property` 和 `@prop.setter` 被用于动态生成带类型检查的属性。这说明装饰器不只可以包装函数调用，也可以参与对象属性访问协议。更深入地看，`property` 与 描述符机制 有关。

## 函数装饰器与方法装饰器的区别

函数装饰器和方法装饰器共享同一个语法形式，但关注点有所不同：

- 普通函数装饰器通常用于在函数调用前后插入行为，例如日志、计时、缓存；
- 方法装饰器还可能改变函数在类中的绑定方式，例如是否接收 `self` 或 `cls`；
- `@staticmethod` 和 `@classmethod` 不只是“包装调用”，还改变了函数作为类属性被访问时的行为；
- `@property` 则改变访问方式，把方法调用转化为属性读取。

因此，理解装饰器既需要掌握函数式编程模型，也需要理解 Python 的类、实例、属性查找和方法绑定机制。

## 学习定位

根据 [[summaries/00_Overview]]，Python 装饰器属于“高级主题”中的基础入门内容。结合 [[summaries/03_Returning_functions]]、[[summaries/04_Function_decorators]] 与 [[summaries/05_Decorated_methods]]，学习装饰器前应先掌握以下前置概念：

- 函数定义与调用；
- 参数传递，尤其是 `*args` 和 `**kwargs`；
- 函数作为一等对象；
- 函数可以作为参数传递；
- 函数可以作为返回值；
- [[concepts/闭包]] 如何保存外部变量；
- 函数对象的元数据，如 `__name__` 和 `__module__`；
- 类、实例、实例方法、类方法、静态方法和属性；
- `self` 与 `cls` 的区别；
- 继承对类方法构造逻辑的影响。

## 常见注意点

使用装饰器时需要注意：

- 装饰器会替换原函数对象；
- 包装函数应正确转发参数和返回值；
- 包装函数通常需要使用 `*args` 和 `**kwargs` 兼容不同函数签名；
- 如果不处理元数据，原函数的名称、文档字符串等信息可能丢失；
- 多个装饰器叠加时，执行顺序需要仔细理解；
- 参数化装饰器会增加一层函数调用结构；
- 闭包保存的是外部环境，理解变量捕获有助于避免调试困难；
- 方法装饰器会影响 `self`、`cls` 的传入方式；
- `@classmethod` 中应优先使用 `cls()` 而不是硬编码类名，以支持继承；
- `@staticmethod` 不应依赖实例或类状态；
- 装饰器虽然强大，但过度使用会降低代码可读性。

## 相关概念

- [[summaries/00_Overview]]：第 7 章高级主题总览，列出函数装饰器作为核心学习内容之一。
- [[summaries/03_Returning_functions]]：介绍返回函数、闭包、延迟执行和用闭包减少重复代码，是理解装饰器的重要前置内容。
- [[summaries/04_Function_decorators]]：介绍函数装饰器、包装函数、日志装饰器和计时装饰器。
- [[summaries/05_Decorated_methods]]：介绍方法装饰器，尤其是 `@staticmethod`、`@classmethod` 和 `@property`。
- 函数式编程：装饰器依赖函数作为一等对象的思想。
- [[concepts/闭包]]：许多装饰器通过闭包保存被包装函数和配置状态。
- 包装函数：装饰器通常通过 wrapper 函数包裹原函数。
- 横切关注点：日志、计时、权限等适合由装饰器集中管理的重复辅助逻辑。
- Python函数参数：装饰器常使用 `*args` 和 `**kwargs` 转发参数。
- lambda：与装饰器一样体现函数对象和函数工厂思想，可用于简化函数生成。
- 回调函数：装饰器和闭包都常用于把函数保存起来稍后调用。
- 延迟执行：闭包可携带上下文供未来执行，装饰器也常封装延迟行为。
- Python类方法与静态方法：`@classmethod` 和 `@staticmethod` 是装饰器在类方法定义中的典型应用。
- self与cls：理解实例方法与类方法第一个参数差异的关键概念。
- [[concepts/替代构造器]]：`@classmethod` 最常见的用途之一。
- Python继承：类方法使用 `cls` 能让构造逻辑适配子类。
- 属性：`@property` 是装饰器在对象属性访问中的典型应用。
- 描述符机制：`property`、方法绑定和部分装饰器行为与描述符协议相关。
- 封装：类方法可把对象构造逻辑集中到类内部。
- 面向对象设计：方法装饰器帮助表达对象创建、属性访问和方法绑定的设计意图。
- 面向对象编程：方法装饰器帮助理解 Python 类和方法绑定机制。

See also: [[summaries/01_Variable_arguments]]

See also: [[summaries/02_Anonymous_function]]

See also: [[summaries/03_Returning_functions]]

See also: [[summaries/04_Function_decorators]]

See also: [[summaries/05_Decorated_methods]]

See also: [[summaries/07_Advanced_Topics__00_Overview]]