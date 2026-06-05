---
doc_type: short
full_text: sources/03_Returning_functions.md
---

# 03_Returning_functions 总结

## 核心主题

本文介绍 Python 中“函数返回函数”的模式，并由此引出 闭包 的概念。闭包允许内部函数在外部函数已经执行结束后，仍然保留并使用外部函数中的局部变量。这一机制是回调、延迟执行、装饰器以及代码生成式抽象的重要基础。

## 返回函数

示例函数 `add(x, y)` 在内部定义 `do_add()`，然后返回该内部函数：

```python
def add(x, y):
    def do_add():
        print('Adding', x, y)
        return x + y
    return do_add
```

调用 `add(3, 4)` 并不会立即执行加法，而是返回一个函数对象：

```python
>>> a = add(3,4)
>>> a()
Adding 3 4
7
```

这里的关键点是：`a` 绑定到了内部函数 `do_add`，稍后调用 `a()` 时才真正执行加法逻辑。

## 局部变量的保留

内部函数 `do_add()` 使用了外部函数 `add(x, y)` 的参数 `x` 和 `y`。即使 `add()` 已经返回，`do_add()` 仍然能够访问这些值：

```python
>>> a = add(3,4)
>>> a()
Adding 3 4
7
```

这说明 Python 不只是返回了函数代码本身，还保留了该函数运行所需的外部变量环境。

## 闭包

当一个内部函数被作为结果返回，并且它依赖外部函数作用域中的变量时，这个内部函数称为 闭包。

闭包的本质可以理解为：

> 闭包 = 函数 + 该函数所需的外部变量环境

在示例中，`do_add` 是一个闭包，因为它携带了 `x` 和 `y` 的值，使其可以在未来某个时间点正确执行。

## 闭包的用途

文中指出闭包是 Python 的重要特性，常见用途包括：

- 回调函数
- 延迟求值或延迟执行
- 装饰器
- 避免重复代码
- 动态创建函数或属性

## 延迟执行

文中通过 `after(seconds, func)` 展示延迟执行：

```python
def after(seconds, func):
    import time
    time.sleep(seconds)
    func()
```

使用方式：

```python
def greeting():
    print('Hello Guido')

after(30, greeting)
```

`after` 会等待一段时间后再调用传入函数。

闭包在这里的作用是可以携带额外上下文。例如：

```python
def add(x, y):
    def do_add():
        print(f'Adding {x} + {y} -> {x+y}')
    return do_add

after(30, add(2, 3))
```

`add(2, 3)` 返回的 `do_add` 闭包携带了 `x = 2` 和 `y = 3`，因此可以在 30 秒后仍然知道要执行哪个加法。

## 用闭包减少重复代码

闭包不仅能保存状态，还可以用来“生成代码”，从而减少重复模式。

文中以带类型检查的 `property` 为例。原始写法中，每个属性都需要重复编写 getter、setter 和类型检查逻辑：

```python
@property
def shares(self):
    return self._shares

@shares.setter
def shares(self, value):
    if not isinstance(value, int):
        raise TypeError('Expected int')
    self._shares = value
```

为避免重复，可以定义一个工厂函数 `typedproperty(name, expected_type)`：

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

这里 `prop` 是闭包，它保留了：

- `name`
- `private_name`
- `expected_type`

因此每次调用 `typedproperty()` 都会生成一个带特定名称和类型检查规则的属性对象。

## 类型检查属性示例

使用 `typedproperty` 可以简化 `Stock` 类：

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

如果尝试赋予错误类型，例如：

```python
s.shares = '100'
```

应当触发 `TypeError`。

这展示了闭包与 属性、描述符机制 之间的联系：虽然 `property` 本身是 Python 提供的描述符对象，但闭包可以帮助动态构造这些属性。

## 使用 lambda 进一步简化

为了减少 `typedproperty('shares', int)` 这类重复调用，可以定义三个辅助函数：

```python
String = lambda name: typedproperty(name, str)
Integer = lambda name: typedproperty(name, int)
Float = lambda name: typedproperty(name, float)
```

然后 `Stock` 类可以写成：

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

这说明 lambda 函数 和闭包可以配合使用，用来构造更简洁的接口。

## 练习内容

### Exercise 7.7：使用闭包避免重复

创建 `typedproperty.py`，实现 `typedproperty(name, expected_type)`，并用它为 `Stock` 类定义带类型检查的属性。

### Exercise 7.8：简化函数调用

在 `typedproperty.py` 中添加：

```python
String = lambda name: typedproperty(name, str)
Integer = lambda name: typedproperty(name, int)
Float = lambda name: typedproperty(name, float)
```

然后用 `String`、`Integer`、`Float` 重写 `Stock` 类的属性定义。

### Exercise 7.9：实践应用

修改 `stock.py`，让其中的 `Stock` 类使用前面定义的类型化属性。

## 关键结论

- Python 函数可以返回另一个函数。
- 返回的内部函数如果引用了外部函数的变量，就形成 闭包。
- 闭包会保留函数未来执行所需的变量环境。
- 闭包常用于回调、延迟执行、装饰器和减少重复代码。
- 闭包可以作为“函数工厂”或“属性工厂”，动态生成带有特定行为的函数或对象。
- `typedproperty` 示例展示了如何用闭包封装重复的类型检查属性逻辑。
- `lambda` 可用于进一步包装闭包工厂函数，让调用接口更简洁。

## Related Concepts
- [[concepts/延迟执行]]
- [[concepts/闭包]]
- [[concepts/函数作为对象]]
- [[concepts/Python-property-属性]]
- [[concepts/动态属性访问]]
- [[concepts/Python-装饰器]]
- [[concepts/回调函数]]
- [[concepts/函数]]
- [[concepts/Python-命名空间与作用域]]
- [[concepts/Python-函数参数]]
- [[concepts/Python-封装与访问约定]]
- lambda 函数
- [[concepts/类与对象]]
- [[concepts/异常处理]]
