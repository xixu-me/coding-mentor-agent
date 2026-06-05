---
sources: [summaries/07_Advanced_Topics__00_Overview.md, summaries/04_Function_decorators.md, summaries/03_Returning_functions.md, summaries/02_Anonymous_function.md, summaries/01_Variable_arguments.md, summaries/00_Overview.md]
brief: Python 函数参数定义调用接口，并支撑可变参数、解包、透传和装饰器包装。
---

# Python 函数参数

Python 函数参数是函数定义与函数调用之间的接口：函数通过参数接收外部数据，并在函数体内使用这些数据完成计算或产生行为。在 [[summaries/00_Overview]] 中，“可变参数函数”被列为第 7 章高级主题之一；[[summaries/01_Variable_arguments]] 进一步说明了 `*args`、`**kwargs`、参数解包和参数透传等机制；[[summaries/04_Function_decorators]] 则展示了这些机制如何成为Python装饰器和函数包装器的基础。

理解函数参数，不只是理解“函数需要几个输入”，还包括：调用时实参如何绑定到形参、额外参数如何被收集、已有数据结构如何被展开为参数，以及包装函数如何把参数继续传递给其他函数。

## 基本含义

在 Python 中，函数参数通常出现在函数定义中：

```python
def add(x, y):
    return x + y
```

这里的 `x` 和 `y` 是形参。调用函数时传入的具体值称为实参：

```python
add(2, 3)
```

参数机制让函数可以被复用：同一个函数逻辑可以处理不同输入。

## 常见参数类型

Python 函数参数可以分为几类。

### 1. 位置参数

位置参数按照调用时的顺序匹配：

```python
def greet(name, message):
    print(message, name)

greet("Alice", "Hello")
```

这里 `"Alice"` 绑定到 `name`，`"Hello"` 绑定到 `message`。

位置参数适合参数数量较少、含义清晰、顺序自然的函数调用。

### 2. 关键字参数

关键字参数通过参数名显式传值，因此顺序可以改变：

```python
greet(message="Hello", name="Alice")
```

这种方式提高了可读性，尤其适合参数较多、参数含义需要强调，或有多个可选配置项的函数。

### 3. 默认参数

默认参数允许函数在调用者没有提供某个参数时使用预设值：

```python
def greet(name, message="Hello"):
    print(message, name)
```

调用时可以省略 `message`：

```python
greet("Alice")
```

默认参数常用于给函数提供合理的默认行为，同时允许调用者在需要时覆盖。

### 4. 可变位置参数 `*args`

可变位置参数允许函数接收任意数量的额外位置实参：

```python
def f(x, *args):
    ...
```

调用：

```python
f(1, 2, 3, 4, 5)
```

在函数内部：

```python
# x -> 1
# args -> (2, 3, 4, 5)
```

普通参数先按规则绑定，剩余的位置实参会被收集进一个元组。`args` 只是惯用名称，也可以使用其他变量名，但 `*` 才是语法关键。

一个典型例子是接收一个或多个数并计算平均值：

```python
def avg(x, *more):
    return float(x + sum(more)) / (1 + len(more))
```

调用示例：

```python
avg(10, 11)             # 10.5
avg(3, 4, 5)            # 4.0
avg(1, 2, 3, 4, 5, 6)   # 3.5
```

这里 `x` 保证至少提供一个值，`*more` 收集额外值。这种写法适合“至少需要一个参数，但允许更多参数”的场景。

相关主题可参见 可变参数。

### 5. 可变关键字参数 `**kwargs`

可变关键字参数允许函数接收任意数量的额外关键字实参：

```python
def f(x, y, **kwargs):
    ...
```

调用：

```python
f(2, 3, flag=True, mode="fast", header="debug")
```

在函数内部：

```python
# x -> 2
# y -> 3
# kwargs -> {'flag': True, 'mode': 'fast', 'header': 'debug'}
```

额外关键字参数会被收集进一个字典。`kwargs` 同样只是惯用名称，`**` 才是语法关键。

这种机制常用于接收配置项、可选行为开关、底层函数选项，或构建更灵活的 API。

## 同时使用 `*args` 和 `**kwargs`

函数可以同时接收任意数量的位置参数和关键字参数：

```python
def f(*args, **kwargs):
    ...
```

调用：

```python
f(2, 3, flag=True, mode="fast", header="debug")
```

函数内部得到：

```python
# args -> (2, 3)
# kwargs -> {'flag': True, 'mode': 'fast', 'header': 'debug'}
```

这种函数几乎可以接收任意组合的调用参数，因此常见于：

1. 编写包装函数。
2. 编写装饰器。
3. 将参数转发给另一个函数。
4. 构建需要兼容多种调用形式的通用接口。

例如在 Python装饰器 中，包装器常见写法是：

```python
def wrapper(*args, **kwargs):
    return func(*args, **kwargs)
```

这里同时发生两件事：

- `wrapper(*args, **kwargs)` 中的 `*args` 和 `**kwargs` 负责接收调用者传入的任意参数。
- `func(*args, **kwargs)` 中的 `*args` 和 `**kwargs` 负责把这些参数原样展开并传给被包装函数。

这类模式也可归入 函数包装器 和 参数透传。

## 参数解包：用 `*` 和 `**` 调用函数

`*args` 和 `**kwargs` 出现在函数定义中时表示“收集参数”；而 `*` 和 `**` 出现在函数调用中时，通常表示“展开参数”。这两种方向相反但彼此配合的机制，是 [[summaries/01_Variable_arguments]] 的重点之一。

### 展开元组为位置参数

如果已有一个元组，可以在调用函数时用 `*` 将其展开为多个位置参数：

```python
numbers = (2, 3, 4)
f(1, *numbers)      # 等价于 f(1, 2, 3, 4)
```

这在从文件、数据库或解析器中读到一条记录后尤其有用。

例如有一条股票数据：

```python
data = ("GOOG", 100, 490.1)
```

如果 `Stock` 构造函数需要的是 `name`、`shares`、`price` 三个独立参数，那么直接传入元组会失败：

```python
s = Stock(data)     # 错误：传入的是一个元组对象
```

应使用：

```python
s = Stock(*data)
```

这等价于：

```python
s = Stock("GOOG", 100, 490.1)
```

相关主题可参见 参数解包。

### 展开字典为关键字参数

如果已有一个字典，可以用 `**` 将其展开为关键字参数：

```python
options = {
    "color": "red",
    "delimiter": ",",
    "width": 400
}

f(data, **options)
```

这等价于：

```python
f(data, color="red", delimiter=",", width=400)
```

同样，若字典键名与构造函数参数名一致，就可以直接创建对象：

```python
data = {"name": "GOOG", "shares": 100, "price": 490.1}
s = Stock(**data)
```

这种写法可以把原本冗长的字段访问：

```python
Stock(d["name"], d["shares"], d["price"])
```

简化为：

```python
Stock(**d)
```

前提是字典的键与函数或构造函数的参数名匹配。

## 参数透传

参数透传是指一个外层函数接收参数后，将其中一部分或全部继续传给另一个函数。`**kwargs` 在这种场景中尤其常见。

例如 `read_portfolio()` 可以暴露底层 `fileparse.parse_csv()` 的选项：

```python
def read_portfolio(filename, **opts):
    with open(filename) as lines:
        portdicts = fileparse.parse_csv(
            lines,
            select=["name", "shares", "price"],
            types=[str, int, float],
            **opts
        )

    portfolio = [Stock(**d) for d in portdicts]
    return Portfolio(portfolio)
```

调用者既可以使用默认行为：

```python
port = read_portfolio("Data/missing.csv")
```

也可以传入底层解析函数支持的选项：

```python
port = read_portfolio("Data/missing.csv", silence_errors=True)
```

这样，外层函数不需要显式声明底层函数的每一个可选参数，却仍然能把配置能力开放给调用者。

参数透传的优点包括：

1. 保持外层接口简洁。
2. 减少重复声明配置参数。
3. 便于包装、适配和扩展底层函数。
4. 允许高层 API 暴露底层 API 的部分能力。

但它也可能降低接口的显式性：调用者需要知道哪些选项最终会被传给底层函数。因此，在公共 API 中使用参数透传时，通常需要配合清晰文档。

## 参数与函数包装器

[[summaries/04_Function_decorators]] 展示了参数机制在函数包装器中的核心作用。包装器是一种围绕原函数添加额外处理的新函数，但它通常希望调用方式与原函数保持一致。

例如，一个日志包装器可以写成：

```python
def logged(func):
    def wrapper(*args, **kwargs):
        print('Calling', func.__name__)
        return func(*args, **kwargs)
    return wrapper
```

这里 `wrapper` 并不知道 `func` 的具体参数签名。`func` 可能是：

```python
def add(x, y):
    return x + y
```

也可能是其他参数数量和参数名称完全不同的函数。为了让包装器适配各种函数，`wrapper` 使用 `*args` 和 `**kwargs` 接收任意调用参数，再用 `func(*args, **kwargs)` 原样转发。

这说明可变参数不仅用于“函数本身需要任意数量输入”的场景，也用于“外层函数需要保持被包装函数调用兼容性”的场景。

## 参数与装饰器

装饰器本质上常常是“接收函数、返回包装函数”的函数。如下两段代码等价：

```python
def add(x, y):
    return x + y
add = logged(add)
```

以及：

```python
@logged
def add(x, y):
    return x + y
```

因此，Python装饰器依赖函数作为对象传递，也高度依赖参数透传。一个通用装饰器若想适用于不同函数，通常需要写成：

```python
def decorator(func):
    def wrapper(*args, **kwargs):
        # 额外逻辑
        result = func(*args, **kwargs)
        # 额外逻辑
        return result
    return wrapper
```

这种结构中：

- `func` 是被装饰的原函数。
- `wrapper` 是实际替代原函数名的新函数。
- `*args` 和 `**kwargs` 让 `wrapper` 能接收原函数可能需要的任意参数。
- `func(*args, **kwargs)` 保证原函数仍按调用者传入的参数执行。

装饰器常用于处理横切关注点，例如日志、计时、调试、权限检查、缓存等。这些逻辑不属于函数的核心计算，但可能需要重复应用在许多函数上。参数透传使装饰器可以添加这些行为，同时尽量不改变原函数的调用接口。

## 计时装饰器中的参数

[[summaries/04_Function_decorators]] 的练习要求实现一个 `timethis(func)` 装饰器，用于统计函数执行时间：

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

这个例子同时体现了几个与参数相关的要点：

1. `wrapper(*args, **kwargs)` 让计时装饰器可以应用于任意函数。
2. `func(*args, **kwargs)` 把调用者参数完整传递给原函数。
3. `return r` 保留原函数返回值，使包装后的函数行为尽量不变。
4. `func.__module__` 和 `func.__name__` 使用函数对象元数据打印被调用函数的来源和名称。

例如：

```python
@timethis
def countdown(n):
    while n > 0:
        n -= 1
```

调用：

```python
countdown(10000000)
```

`n` 这个位置参数会先被 `wrapper` 的 `args` 收集，然后再被展开传给原始的 `countdown(n)`。

## 参数与对象构造

`*` 和 `**` 解包在对象构造中非常实用，特别是当数据已经以元组或字典形式存在时。

- 元组适合按位置构造对象：`Stock(*data)`。
- 字典适合按字段名构造对象：`Stock(**data)`。

其中字典解包往往更可读，因为字段名直接体现数据含义：

```python
{"name": "GOOG", "shares": 100, "price": 490.1}
```

这种模式常见于 CSV 解析、JSON 数据转换、数据库记录映射等场景，也与 面向对象编程 中的实例构造密切相关。

## 参数与高级主题的关系

Python 函数参数不仅是基础语法，也与多个高级主题密切相关。

- 在 lambda表达式 中，匿名函数同样可以接收参数。
- 在 [[concepts/闭包]] 中，函数参数可能与外部作用域变量一起被内部函数捕获和使用。
- 在 Python装饰器 中，装饰器通常需要用 `*args` 和 `**kwargs` 转发被包装函数的参数。
- 在 函数式编程 中，函数作为值传递时，参数签名决定函数如何组合和调用。
- 在 函数包装器 中，通用包装函数通常依赖 `*args` 和 `**kwargs` 保持调用兼容性。
- 在 参数解包 中，已有数据结构可以被展开为函数调用参数。
- 在 横切关注点 中，日志、计时等额外行为常通过装饰器统一添加，而装饰器依靠参数透传保持接口兼容。

因此，理解 Python 函数参数是理解更高级函数特性的基础。

## 为什么可变参数重要

可变参数函数让函数接口更加灵活，常见用途包括：

1. 编写可以处理任意数量输入的工具函数。
2. 包装其他函数并转发参数。
3. 构建通用 API，使调用者可以提供不同数量或不同名称的参数。
4. 在装饰器、回调、框架代码中保持函数签名的通用性。
5. 将配置项从外层函数传递到底层函数。
6. 简化从结构化数据创建对象的代码。
7. 为日志、计时等诊断逻辑提供不依赖具体函数签名的接入方式。

例如：

```python
def wrapper(*args, **kwargs):
    return func(*args, **kwargs)
```

这是 Python 中包装器、装饰器和适配函数的基础模式。它把“参数收集”和“参数展开”组合在一起，使外层函数可以透明地转发调用。

## 学习定位

根据 [[summaries/00_Overview]]，可变参数函数属于 Python 的“高级主题”之一，但它也是日常编码中经常遇到的功能。[[summaries/01_Variable_arguments]] 展示了它在平均值函数、对象构造、列表实例化和 CSV 解析参数透传中的实际用法。[[summaries/04_Function_decorators]] 进一步展示了它在日志装饰器和计时装饰器中的作用：如果没有 `*args` 和 `**kwargs`，通用装饰器就很难适配不同函数的调用方式。

学习 Python 函数参数时，可以按以下顺序理解：

1. 固定位置参数和关键字参数如何绑定。
2. 默认参数如何提供可选行为。
3. `*args` 如何收集额外位置参数。
4. `**kwargs` 如何收集额外关键字参数。
5. `*tuple` 和 `**dict` 如何在调用时展开已有数据。
6. 包装器如何组合“收集”和“展开”实现参数透传。
7. 装饰器如何利用通用参数签名在不改变函数主体的情况下添加额外行为。

进一步深入时，还需要理解函数调用规则、参数绑定顺序、默认参数陷阱、关键字专用参数，以及装饰器中的签名保留问题。

## 相关概念

- [[summaries/00_Overview]]
- [[summaries/01_Variable_arguments]]
- [[summaries/02_Anonymous_function]]
- [[summaries/03_Returning_functions]]
- [[summaries/04_Function_decorators]]
- 可变参数
- 参数解包
- 参数透传
- 函数包装器
- lambda表达式
- [[concepts/闭包]]
- Python装饰器
- 横切关注点
- 函数式编程
- 面向对象编程

See also: [[summaries/07_Advanced_Topics__00_Overview]]