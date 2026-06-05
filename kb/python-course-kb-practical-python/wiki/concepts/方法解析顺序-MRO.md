---
sources: [summaries/01_Dicts_revisited.md]
brief: MRO 是 Python 在继承层次中查找属性和方法时使用的线性解析顺序。
---

# 方法解析顺序 MRO

方法解析顺序（Method Resolution Order，MRO）是 Python 在类继承体系中查找属性和方法时使用的顺序。它把可能复杂的继承图转换成一个线性的类序列，Python 会按照这个序列依次查找，找到第一个匹配项后停止。

相关来源：[[summaries/01_Dicts_revisited]]。

## 为什么需要 MRO

Python 的对象系统大量依赖字典：

- 实例数据保存在实例的 `__dict__` 中。
- 类中定义的方法和类变量保存在类的 `__dict__` 中。
- 类与父类之间通过 `__bases__` 连接。

当读取一个属性时，例如：

```python
obj.name
```

Python 大致会按以下思路查找：

1. 先查找实例自身的 `obj.__dict__`。
2. 如果没有找到，再查找类的 `obj.__class__.__dict__`。
3. 如果类中仍未找到，就沿继承关系继续向父类查找。

在单继承中，父类路径通常是明确的一条链。但在多重继承中，一个类可能有多个父类，继承图不再只有唯一向上的路径。此时就需要 MRO 来确定稳定、明确的查找顺序。

这与 属性查找 和 Python对象模型 密切相关。

## `__mro__` 属性

Python 会为每个类预先计算 MRO，并保存在类的 `__mro__` 属性中。

例如单继承：

```python
class A: pass
class B(A): pass
class C(B): pass
```

查看：

```python
C.__mro__
```

可能得到：

```python
(<class '__main__.C'>,
 <class '__main__.B'>,
 <class '__main__.A'>,
 <class 'object'>)
```

这表示当 Python 在 `C` 的实例上查找方法或属性时，会按如下顺序查找：

1. `C`
2. `B`
3. `A`
4. `object`

第一个找到的定义会被使用。

## 单继承中的 MRO

在单继承中，MRO 通常很直观，因为从子类到根类只有一条路径。

例如：

```python
class A: pass
class B(A): pass
class C(A): pass
class D(B): pass
class E(D): pass
```

对于 `E`，MRO 类似：

```python
(E, D, B, A, object)
```

查找属性时，Python 会从 `E` 开始，沿着这条链向上查找。找到第一个匹配项后立即停止。

## 多重继承中的 MRO

多重继承使问题复杂化。

例如：

```python
class A: pass
class B: pass
class C(A, B): pass
class D(B): pass
class E(C, D): pass
```

当访问：

```python
e = E()
e.attr
```

Python 必须决定搜索顺序。它不能随意选择，否则会导致方法调用行为不稳定。

Python 的多重继承遵循协作式多重继承原则，MRO 需要满足两个核心规则：

1. 子类总是在父类之前被检查。
2. 多个父类按照类定义中声明的顺序被检查。

例如：

```python
class E(C, D):
    pass
```

表示 `C` 的优先级高于 `D`。

一个可能的 MRO 是：

```python
(E, C, A, D, B, object)
```

Python 会按照该顺序查找属性或方法。

## C3 线性化算法

Python 使用 C3 Linearization Algorithm（C3 线性化算法）来计算 MRO。

这个算法的目标是把继承图转换为一个线性序列，同时保持：

- 子类优先于父类。
- 父类列表中的声明顺序不被破坏。
- 继承体系中的顺序关系保持一致。

一般使用 Python 时，不需要掌握 C3 算法的全部细节。更重要的是理解：MRO 是 Python 为继承层次计算出来的权威查找顺序。

可以用如下方式观察任意类的 MRO：

```python
SomeClass.__mro__
```

或：

```python
SomeClass.mro()
```

## MRO 与 `super()`

`super()` 与 MRO 密切相关。

很多人把 `super()` 理解为“调用父类方法”，但在 Python 中，更准确的说法是：

> `super()` 调用 MRO 中的下一个类。

例如：

```python
class Loud:
    def noise(self):
        return super().noise().upper()
```

这里的 `super().noise()` 并不固定指向某一个具体父类，而是由当前对象所属类的 MRO 决定。

在多重继承中，这一点尤其重要。因为 MRO 中的“下一个类”可能不是代码表面上最直观的父类。

这也是 mixin模式 能工作的关键。

## MRO 与 Mixin 模式

Mixin 是多重继承的常见用途。它通常提供一个小片段行为，不能单独使用，而是和其他类组合。

例如：

```python
class Loud:
    def noise(self):
        return super().noise().upper()

class Dog:
    def noise(self):
        return 'Bark'

class LoudDog(Loud, Dog):
    pass
```

对于 `LoudDog`，MRO 大致是：

```python
(LoudDog, Loud, Dog, object)
```

调用：

```python
LoudDog().noise()
```

查找过程是：

1. 在 `LoudDog` 中查找 `noise`，未找到。
2. 在 `Loud` 中找到 `noise`。
3. 执行 `Loud.noise()`。
4. `super().noise()` 根据 MRO 继续到 `Dog.noise()`。
5. 得到 `'Bark'`，再转换为大写 `'BARK'`。

如果定义顺序改成：

```python
class LoudDog(Dog, Loud):
    pass
```

MRO 会变化，`Dog.noise()` 可能先被找到，`Loud.noise()` 就不会参与调用。因此，在使用 mixin 时，基类顺序非常重要。

## MRO 与属性查找示例

假设有一个继承自 `Stock` 的类：

```python
class NewStock(Stock):
    def yow(self):
        print('Yow!')
```

创建实例：

```python
n = NewStock('ACME', 50, 123.45)
```

调用：

```python
n.cost()
```

如果 `NewStock` 自己没有定义 `cost`，Python 会沿 `NewStock.__mro__` 查找：

```python
NewStock.__mro__
```

结果类似：

```python
(<class '__main__.NewStock'>,
 <class 'stock.Stock'>,
 <class 'object'>)
```

查找过程可以近似理解为：

```python
for cls in n.__class__.__mro__:
    if 'cost' in cls.__dict__:
        break
```

最终会在 `Stock.__dict__` 中找到 `cost` 方法。

这个例子来自 [[summaries/01_Dicts_revisited]]，展示了继承如何通过扩展属性查找路径来实现。

## 实践要点

使用 MRO 时应记住：

- `__mro__` 是 Python 实际使用的属性和方法查找顺序。
- 单继承中的 MRO 通常是从子类一路到父类再到 `object`。
- 多重继承中的 MRO 由 C3 线性化算法计算。
- 多重继承中，父类声明顺序会影响 MRO。
- `super()` 调用的是 MRO 中的下一个类，而不一定是某个固定父类。
- 使用 mixin 时，类的排列顺序会直接影响行为。

## 常见误解

### 误解一：`super()` 就是调用父类

不完全正确。`super()` 调用的是 MRO 中的下一个类。单继承时它看起来像是在调用父类，但多重继承中情况更复杂。

### 误解二：多重继承按树形结构递归查找

Python 实际上不会临时在继承树中随意搜索，而是使用预先计算好的线性 MRO。

### 误解三：类定义中写在后面的父类无关紧要

父类顺序非常重要。例如：

```python
class X(A, B):
    pass
```

与：

```python
class X(B, A):
    pass
```

可能产生不同的 MRO，从而导致不同的方法解析结果。

## 总结

MRO 是 Python 对象系统中理解继承、方法调用和多重继承的核心概念。它规定了 Python 在实例、类和父类之间查找属性与方法的顺序。理解 MRO 有助于正确使用 `super()`、设计 mixin、分析继承行为，并避免多重继承中的隐蔽错误。

相关概念：属性查找、Python对象模型、mixin模式、[[concepts/绑定方法]]。