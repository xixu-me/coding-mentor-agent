---
doc_type: short
full_text: sources/01_Dicts_revisited.md
---

# 01_Dicts_revisited 总结

本文重新审视 Python 字典，说明 Python 的模块、对象、类、继承和方法调用机制在很大程度上都建立在字典之上。核心观点是：Python 对象系统可以理解为“字典之上的一层协议”。

## 核心主题

- 字典不仅是普通数据结构，也是 Python 解释器实现中的关键机制。
- 模块、实例和类都通过 `__dict__` 保存名称到对象的映射。
- 属性访问 `obj.name` 本质上会触发一套字典查找流程。
- 类共享方法和类变量，实例保存各自独立的数据。
- 继承通过 `__bases__` 和 `__mro__` 扩展属性查找路径。
- 多重继承依赖 MRO 和 C3 线性化算法。
- `super()` 委托给 MRO 中的“下一个类”，是 mixin 模式的关键。

相关主题可整理为 Python对象模型、属性查找、继承与MRO、mixin模式。

## 字典与模块

Python 模块中的全局变量和函数都保存在模块字典中。

例如模块 `foo.py`：

```python
x = 42

def bar():
    ...

def spam():
    ...
```

可以通过 `foo.__dict__` 或 `globals()` 看到类似结构：

```python
{
    'x': 42,
    'bar': <function bar>,
    'spam': <function spam>
}
```

这说明模块命名空间本质上是一个字典。该思想与 Python命名空间 密切相关。

## 字典与对象实例

用户自定义对象的实例数据保存在实例自己的 `__dict__` 中。

```python
s = Stock('GOOG', 100, 490.1)
s.__dict__
```

结果类似：

```python
{
    'name': 'GOOG',
    'shares': 100,
    'price': 490.1
}
```

在构造函数中给 `self` 赋值，实际就是向实例字典写入键值对：

```python
class Stock:
    def __init__(self, name, shares, price):
        self.name = name
        self.shares = shares
        self.price = price
```

每个实例都有自己的独立字典：

```python
s = Stock('GOOG', 100, 490.1)
t = Stock('AAPL', 50, 123.45)
```

因此，如果创建 100 个实例，就会有 100 个保存实例数据的字典。

## 类字典与共享成员

类本身也有一个字典，用于保存类定义中的方法和类变量。可通过 `Stock.__dict__` 查看。

```python
class Stock:
    def __init__(self, name, shares, price):
        self.name = name
        self.shares = shares
        self.price = price

    def cost(self):
        return self.shares * self.price

    def sell(self, nshares):
        self.shares -= nshares
```

类字典中会包含：

```python
{
    '__init__': <function>,
    'cost': <function>,
    'sell': <function>
}
```

实例数据位于实例字典，方法位于类字典。所有实例通过类共享这些方法。

## 实例与类的连接

每个实例都通过 `__class__` 指向其所属类。

```python
s.__class__
```

实例字典保存实例特有数据，类字典保存所有实例共享的数据和方法。

这一结构可以概括为：

1. `s.__dict__`：实例自己的属性。
2. `s.__class__`：实例所属类。
3. `s.__class__.__dict__`：类中定义的方法和类变量。

## 属性访问机制

对象属性访问使用点号操作：

```python
x = obj.name      # 读取
obj.name = value  # 设置
del obj.name      # 删除
```

这些操作都与底层字典相关。

### 设置与删除属性

设置属性会修改实例的 `__dict__`：

```python
s.shares = 50
s.date = '6/7/2007'
```

此时实例字典可能变成：

```python
{
    'name': 'GOOG',
    'shares': 50,
    'price': 490.1,
    'date': '6/7/2007'
}
```

删除属性也会从实例字典中移除键：

```python
del s.shares
```

Python 默认不限制实例属性必须在 `__init__()` 中预先声明。也可以直接修改 `__dict__`：

```python
goog.__dict__['time'] = '9:45am'
goog.time
```

不过直接操作 `__dict__` 并不常见，正常代码应优先使用点号语法。

## 属性读取顺序

读取属性时，Python 会按顺序查找：

1. 实例自己的 `__dict__`。
2. 实例所属类的 `__dict__`。
3. 如果涉及继承，则继续查找父类。

例如：

```python
s.name
s.cost()
```

`name` 通常在实例字典中找到；`cost` 通常在类字典中找到。

这解释了为什么一个类中定义的方法可以被所有实例共享。该机制是 属性查找 的基础。

## 类变量与实例变量

在类体中直接赋值的变量是类变量，由所有实例共享：

```python
class Foo:
    a = 13

    def __init__(self, b):
        self.b = b
```

其中：

- `a` 是类变量，保存在 `Foo.__dict__` 中。
- `b` 是实例变量，保存在各个实例的 `__dict__` 中。

示例：

```python
f = Foo(10)
g = Foo(20)

f.a  # 13
g.a  # 13
f.b  # 10
g.b  # 20
```

如果修改类变量：

```python
Foo.a = 42
```

所有未覆盖该属性的实例都会看到新值：

```python
f.a  # 42
g.a  # 42
```

## 方法与绑定方法

调用实例方法其实涉及“绑定方法”机制。

```python
s = goog.sell
```

此时 `s` 是一个 bound method，即绑定方法。它包含两部分：

- `s.__func__`：真正实现该方法的函数对象。
- `s.__self__`：绑定到该方法的实例，即 `self`。

因此：

```python
s(25)
```

等价于：

```python
s.__func__(s.__self__, 25)
```

这说明方法调用的本质是：从类字典中找到函数，再把实例作为第一个参数 `self` 传入。相关主题可归入 Python方法绑定。

## 继承的实现

类可以继承其他类：

```python
class A(B, C):
    ...
```

父类保存在类的 `__bases__` 属性中：

```python
A.__bases__
```

继承会扩展属性查找路径：

1. 先查找实例字典。
2. 再查找当前类字典。
3. 如果没有找到，沿父类继续查找。

## 单继承与 MRO

在单继承中，从子类到父类只有一条路径。Python 会沿继承链向上查找，遇到第一个匹配项就停止。

```python
class A: pass
class B(A): pass
class C(A): pass
class D(B): pass
class E(D): pass
```

Python 会预先计算属性查找顺序，并保存在类的 `__mro__` 中：

```python
E.__mro__
```

结果类似：

```python
(E, D, B, A, object)
```

MRO 即 Method Resolution Order，方法解析顺序。Python 按照 MRO 顺序查找属性，先找到者胜出。

## 多重继承与 C3 线性化

多重继承没有唯一的向上路径，因此属性查找顺序更复杂。

```python
class A: pass
class B: pass
class C(A, B): pass
class D(B): pass
class E(C, D): pass
```

Python 使用协作式多重继承，并遵循两条直观规则：

1. 子类总是在父类之前检查。
2. 多个父类按声明顺序检查。

Python 会根据这些规则计算 MRO。例如：

```python
E.__mro__
```

可能得到：

```python
(E, C, A, D, B, object)
```

底层算法称为 C3 Linearization Algorithm。通常不需要掌握算法细节，但要记住：Python 通过 MRO 给复杂继承层次生成一个一致的线性查找顺序。

该部分是 继承与MRO 的核心内容。

## Mixin 模式

文中通过 `Dog`、`Bike`、`LoudDog`、`LoudBike` 展示了多重继承的一个重要用途：mixin。

原始代码中，`LoudDog.noise()` 和 `LoudBike.noise()` 有相同逻辑：

```python
return super().noise().upper()
```

可以把这段共同行为提取成一个 mixin 类：

```python
class Loud:
    def noise(self):
        return super().noise().upper()
```

然后组合使用：

```python
class LoudDog(Loud, Dog):
    pass

class LoudBike(Loud, Bike):
    pass
```

`Loud` 本身不能独立使用，它只是提供一个可混入的行为片段。通过多重继承，它可以给互不相关的类复用同一段功能。

这体现了 mixin模式 的典型用途：用小型类组合行为，而不是通过单一继承树表达所有关系。

## 为什么要使用 `super()`

覆盖方法时应使用 `super()`：

```python
class Loud:
    def noise(self):
        return super().noise().upper()
```

`super()` 并不简单表示“调用父类”，而是表示：调用 MRO 中的下一个类。

在多重继承中，你通常并不知道 MRO 中的下一个类具体是谁，因此硬编码某个父类方法会破坏协作式多重继承。`super()` 使多个类可以按照 MRO 顺序协同工作。

## 练习要点

### Exercise 5.1：实例表示

通过查看 `goog.__dict__` 和 `ibm.__dict__`，观察两个实例各自独立的数据字典。

### Exercise 5.2：修改实例数据

给 `goog` 添加新属性：

```python
goog.date = '6/11/2007'
```

只会影响 `goog.__dict__`，不会影响 `ibm.__dict__`。这说明实例属性是逐实例保存的。

也可以直接修改实例字典：

```python
goog.__dict__['time'] = '9:45am'
```

随后可通过 `goog.time` 访问。

### Exercise 5.3：类的作用

方法 `cost` 不在实例字典中，而在类字典中：

```python
Stock.__dict__['cost']
```

可以直接通过类字典中的函数调用：

```python
Stock.__dict__['cost'](goog)
```

这展示了 `self` 参数的真实传递方式。

添加类属性：

```python
Stock.foo = 42
```

所有实例都能访问：

```python
goog.foo
ibm.foo
```

但 `foo` 不在实例字典中，而是在类字典中。

### Exercise 5.4：绑定方法

将方法取出：

```python
s = goog.sell
```

得到的是绑定方法，包含函数和实例。调用：

```python
s(25)
```

等价于：

```python
s.__func__(s.__self__, 25)
```

### Exercise 5.5：继承

定义子类：

```python
class NewStock(Stock):
    def yow(self):
        print('Yow!')
```

实例 `n` 可以调用继承自 `Stock` 的 `cost()`，也可以调用自身定义的 `yow()`。

通过以下属性观察继承结构：

```python
NewStock.__bases__
NewStock.__mro__
```

查找 `cost()` 时，Python 会沿 `n.__class__.__mro__` 顺序查找各类的 `__dict__`，直到找到 `cost`。

## 关键结论

本文把 Python 对象系统拆解为几个核心机制：

- 模块是字典。
- 实例是带有 `__dict__` 的对象。
- 类也是带有 `__dict__` 的对象。
- 方法是类字典中的函数，通过绑定方法机制接收实例作为 `self`。
- 属性访问由实例字典、类字典和 MRO 共同决定。
- 继承是属性查找路径的扩展。
- 多重继承依赖 MRO 和 `super()` 实现协作。
- Mixin 是多重继承在 Python 中最常见、最实用的模式之一。

整体而言，理解 `__dict__`、`__class__`、`__bases__`、`__mro__` 和 `super()`，就能理解 Python 类与对象机制的大部分行为。

## Related Concepts
- [[concepts/方法解析顺序-MRO]]
- [[concepts/Mixin-模式]]
- [[concepts/Python-对象模型]]
- [[concepts/字典与数据建模]]
- [[concepts/Python-命名空间与作用域]]
- [[concepts/类与对象]]
- [[concepts/绑定方法]]
- [[concepts/继承与多态]]
- [[concepts/动态属性访问]]
- [[concepts/模块与-import]]
- [[concepts/函数]]
- [[concepts/特殊方法]]
- [[concepts/Python-可变对象]]
- [[concepts/鸭子类型]]
