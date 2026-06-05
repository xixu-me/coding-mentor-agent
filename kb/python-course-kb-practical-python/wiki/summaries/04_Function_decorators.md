---
doc_type: short
full_text: sources/04_Function_decorators.md
---

# 04_Function_decorators 总结

本文介绍 Python 中的函数装饰器（function decorators），说明它们如何从“为多个函数重复添加相同逻辑”的需求中自然产生，并通过日志与计时示例展示装饰器的基本实现方式。

## 核心问题：重复的横切逻辑

文章从一个简单函数开始：

```python
def add(x, y):
    return x + y
```

如果希望在调用时打印日志，可能会写成：

```python
def add(x, y):
    print('Calling add')
    return x + y
```

类似逻辑若出现在多个函数中，例如 `sub()`，就会造成代码重复。重复代码不仅编写繁琐，也不利于维护；一旦日志格式或行为需要改变，就必须修改许多地方。

这个问题体现了典型的横切关注点：日志、计时、权限检查等逻辑并不属于函数的核心业务，但可能需要附加到许多函数上。

## 包装函数：为函数添加额外行为

为避免重复，可以编写一个函数，用来接收另一个函数并返回一个带有额外逻辑的新函数：

```python
def logged(func):
    def wrapper(*args, **kwargs):
        print('Calling', func.__name__)
        return func(*args, **kwargs)
    return wrapper
```

这里的关键点是：

- `logged(func)` 接收原始函数 `func`。
- 内部定义 `wrapper(*args, **kwargs)`，使其可以接受任意位置参数和关键字参数。
- `wrapper` 在调用原函数前打印日志。
- `wrapper` 最终返回 `func(*args, **kwargs)` 的结果。
- `logged()` 返回 `wrapper`，而不是直接执行原函数。

使用方式如下：

```python
def add(x, y):
    return x + y

logged_add = logged(add)
```

调用 `logged_add(3, 4)` 时，会先输出：

```text
Calling add
```

然后返回原函数计算结果 `7`。

这种结构称为包装函数（wrapper function）：它包裹另一个函数，添加一些额外处理，但整体表现应尽量像原函数一样。

## 装饰器语法

由于“用包装函数包裹另一个函数”在 Python 中非常常见，Python 提供了专门语法：

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

因此，装饰器本质上不是全新的机制，而是一种语法糖：

- 先定义函数；
- 将函数传给装饰器函数；
- 用装饰器返回的新函数重新绑定原函数名。

也就是说，`@logged` 表示用 `logged()` 来“装饰”紧随其后的函数定义。

## 装饰器的典型用途

本文强调，装饰器通常用于把重复出现的逻辑集中到一个地方，例如：

- 日志记录；
- 性能计时；
- 调试诊断；
- 参数检查；
- 权限控制；
- 缓存；
- 事务管理。

这些逻辑可以统一写在一个装饰器中，然后应用到多个函数上，从而减少重复并提升可维护性。

文章也提示，装饰器还有更多高级主题，例如：

- 在类中使用装饰器；
- 对方法进行装饰；
- 多个装饰器叠加；
- 保留原函数元数据；
- 装饰器带参数。

这些内容与后续的装饰方法和更深入的Python函数对象相关。

## 练习：实现计时装饰器 `timethis`

练习要求在 `timethis.py` 中实现一个 `timethis(func)` 装饰器，用来测量函数运行时间。

Python 函数对象具有一些内置属性，例如：

```python
add.__name__
add.__module__
```

其中：

- `__name__` 保存函数名；
- `__module__` 保存函数所在模块名。

计时装饰器的核心逻辑如下：

```python
start = time.time()
r = func(*args, **kwargs)
end = time.time()
print('%s.%s: %f' % (func.__module__, func.__name__, end-start))
```

完整结构应类似：

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

使用示例：

```python
from timethis import timethis

@timethis
def countdown(n):
    while n > 0:
        n -= 1

countdown(10000000)
```

可能输出：

```text
__main__.countdown : 0.076562
```

这个例子说明装饰器可以作为性能调优中的诊断工具，对任意函数添加运行时间统计，而不必修改函数主体。

## 关键概念

- 函数装饰器：通过 `@decorator` 语法把函数传给另一个函数，并用返回值替换原函数。
- 包装函数：包裹原函数并添加额外行为的新函数。
- [[concepts/闭包]]：内部函数 `wrapper` 捕获外部作用域中的 `func`。
- 可变参数：`*args` 和 `**kwargs` 让包装函数适配任意函数签名。
- 函数对象：函数可以作为参数传递、作为返回值返回，并拥有 `__name__`、`__module__` 等属性。
- 横切关注点：日志、计时等可被装饰器集中管理的重复辅助逻辑。

## 主要 takeaway

装饰器是对“函数包装”模式的简洁语法支持。它允许开发者把日志、计时等重复逻辑从业务函数中抽离出来，集中放入可复用的包装函数中，从而让原函数保持简洁，同时增强程序的可维护性与可扩展性。

## Related Concepts
- [[concepts/Python-装饰器]]
- [[concepts/函数作为对象]]
- [[concepts/Python-函数参数]]
- [[concepts/函数]]
- [[concepts/回调函数]]
- [[concepts/测试-日志与调试]]
- [[concepts/模块与-import]]
