---
doc_type: short
full_text: sources/03_Special_methods.md
---

# 03_Special_methods 总结

本文介绍 Python 类中用于定制对象行为的“特殊方法”（special methods / magic methods），并说明字符串表示、运算符重载、容器协议、方法调用过程、绑定方法以及动态属性访问的基本机制。相关主题可连接到 Python特殊方法、对象表示、[[concepts/绑定方法]]、[[concepts/动态属性访问]]。

## 核心主题

### 特殊方法的作用

Python 类可以定义以双下划线开头和结尾的方法，例如 `__init__`、`__repr__`。这些方法对解释器具有特殊意义，用于让用户自定义对象在内置语法、函数和操作符中的行为。

示例：

```python
class Stock(object):
    def __init__(self):
        ...
    def __repr__(self):
        ...
```

本文强调：Python 中许多“看似内置”的行为，实际上会转化为对对象特殊方法的调用。这是 Python数据模型 的重要组成部分。

## 字符串转换相关特殊方法

对象通常有两种字符串表示：

- `str(obj)`：面向用户的、适合打印的友好表示。
- `repr(obj)`：面向程序员的、更精确或更可复现的表示。

例如 `datetime.date` 对象：

```python
>>> print(d)
2012-12-21
>>> d
datetime.date(2012, 12, 21)
```

类可以通过以下方法控制这两种表示：

```python
class Date(object):
    def __init__(self, year, month, day):
        self.year = year
        self.month = month
        self.day = day

    def __str__(self):
        return f'{self.year}-{self.month}-{self.day}'

    def __repr__(self):
        return f'Date({self.year},{self.month},{self.day})'
```

### `__repr__()` 的约定

`__repr__()` 通常应返回一个字符串，使其在可能的情况下能通过 `eval()` 重建原对象。例如：

```python
Date(2012,12,21)
```

如果无法做到可重建，则应返回清晰、便于调试的表示。这与 对象表示 和 调试友好代码 密切相关。

## 数学运算相关特殊方法

Python 的数学运算符会转换为对象上的特殊方法调用。例如：

```python
a + b       a.__add__(b)
a - b       a.__sub__(b)
a * b       a.__mul__(b)
a / b       a.__truediv__(b)
a // b      a.__floordiv__(b)
a % b       a.__mod__(b)
a ** b      a.__pow__(b)
-a          a.__neg__()
abs(a)      a.__abs__()
```

这说明类可以通过实现这些方法来自定义数学行为，也就是常说的运算符重载。相关概念可整理为 运算符重载。

## 容器访问相关特殊方法

为了让自定义对象表现得像序列、列表、字典或其他容器，可以实现以下特殊方法：

```python
len(x)      x.__len__()
x[a]        x.__getitem__(a)
x[a] = v    x.__setitem__(a,v)
del x[a]    x.__delitem__(a)
```

示例结构：

```python
class Sequence:
    def __len__(self):
        ...
    def __getitem__(self,a):
        ...
    def __setitem__(self,a,v):
        ...
    def __delitem__(self,a):
        ...
```

这体现了 Python 的协议式设计：对象不需要继承某个特定基类，只要实现相应方法，就能参与对应语法。这与 Python协议 和 容器协议 相关。

## 方法调用的两步过程

调用方法实际上分为两步：

1. 属性查找：使用 `.` 操作符取得方法对象。
2. 函数调用：使用 `()` 调用该方法。

示例：

```python
>>> s = Stock('GOOG',100,490.10)
>>> c = s.cost  # 查找
>>> c
<bound method Stock.cost of <Stock object at 0x590d0>>
>>> c()         # 调用
49010.0
```

这解释了为什么 `s.cost` 和 `s.cost()` 是不同的：前者只是取得一个方法对象，后者才真正执行方法。

## 绑定方法

尚未被 `()` 调用的方法对象称为绑定方法（bound method）。它已经绑定到某个具体实例，因此之后调用时会自动作用于该实例。

```python
>>> s = Stock('GOOG', 100, 490.10)
>>> c = s.cost
>>> c()
49010.0
```

绑定方法常导致隐蔽错误，尤其是忘记加括号时：

```python
print('Cost : %0.2f' % s.cost)
```

这里传入的是方法对象，而不是方法返回值，因此会触发类型错误。

另一个典型错误：

```python
f = open(filename, 'w')
f.close     # 没有真正关闭文件
```

正确写法应为：

```python
f.close()
```

这一节强调：在 Python 中，方法也是对象；访问方法和调用方法是两个不同动作。相关概念可连接到 [[concepts/绑定方法]]、一等对象。

## 动态属性访问

除了使用点号语法访问属性，Python 还提供一组内置函数用于动态操作属性：

```python
getattr(obj, 'name')          # 等同于 obj.name
setattr(obj, 'name', value)   # 等同于 obj.name = value
delattr(obj, 'name')          # 等同于 del obj.name
hasattr(obj, 'name')          # 判断属性是否存在
```

示例：

```python
if hasattr(obj, 'x'):
    x = getattr(obj, 'x')
else:
    x = None
```

`getattr()` 还可以提供默认值：

```python
x = getattr(obj, 'x', None)
```

动态属性访问允许程序根据字符串形式的字段名获取对象属性，是构建通用工具、表格打印器、序列化器等代码的重要基础。相关主题包括 [[concepts/动态属性访问]]、反射、通用编程。

## 练习 4.9：改进对象打印输出

练习要求修改 `stock.py` 中的 `Stock` 类，使 `__repr__()` 返回更有用的表示，例如：

```python
>>> goog = Stock('GOOG', 100, 490.1)
>>> goog
Stock('GOOG', 100, 490.1)
```

然后观察当读取投资组合并查看列表时，输出会发生什么变化：

```python
>>> import report
>>> portfolio = report.read_portfolio('Data/portfolio.csv')
>>> portfolio
```

该练习的重点是：列表在显示元素时会使用元素的 `repr()`，因此定义良好的 `__repr__()` 会显著改善调试和交互式查看体验。

## 练习 4.10：使用 `getattr()` 构建通用表格打印函数

练习展示了 `getattr()` 的灵活性：

```python
>>> import stock
>>> s = stock.Stock('GOOG', 100, 490.1)
>>> columns = ['name', 'shares']
>>> for colname in columns:
        print(colname, '=', getattr(s, colname))

name = GOOG
shares = 100
```

输出完全由 `columns` 中列出的属性名决定。练习要求在 `tableformat.py` 中将这个思想扩展为通用函数 `print_table()`：

- 输入任意对象列表。
- 输入用户指定的属性名列表。
- 输入 `TableFormatter` 实例控制输出格式。

目标用法：

```python
>>> import report
>>> portfolio = report.read_portfolio('Data/portfolio.csv')
>>> from tableformat import create_formatter, print_table
>>> formatter = create_formatter('txt')
>>> print_table(portfolio, ['name','shares'], formatter)
```

进一步也可以打印更多列：

```python
>>> print_table(portfolio, ['name','shares','price'], formatter)
```

该练习把动态属性访问和格式化输出结合起来，是通用报表生成的基础，也与 表格格式化、对象属性驱动设计 相关。

## 关键结论

- Python 的许多语言特性由特殊方法驱动。
- `__str__()` 控制用户友好的字符串表示，`__repr__()` 控制程序员友好的表示。
- 数学运算符和容器操作都会映射到相应特殊方法。
- 方法调用分为“查找”和“调用”两步，忘记 `()` 会得到绑定方法而非执行结果。
- `getattr()`、`setattr()`、`delattr()`、`hasattr()` 支持基于字符串的动态属性访问。
- 动态属性访问能让函数处理任意对象和任意字段，是构建灵活工具的重要技巧。

## 可沉淀的概念页

- Python特殊方法：整理双下划线方法如何定制对象行为。
- 对象表示：比较 `str()`、`repr()`、`__str__()`、`__repr__()` 的用途。
- 运算符重载：说明数学符号如何映射到特殊方法。
- 容器协议：总结 `__len__()`、`__getitem__()` 等容器相关方法。
- [[concepts/绑定方法]]：解释方法查找、实例绑定和调用之间的区别。
- [[concepts/动态属性访问]]：总结 `getattr()` 等函数在通用编程中的用途。
- Python协议：归纳 Python 中“实现方法即实现协议”的设计思想。

## Related Concepts
- [[concepts/特殊方法]]
- [[concepts/Python-对象模型]]
- [[concepts/类与对象]]
- [[concepts/Python-运算符与表达式]]
- [[concepts/Python-容器]]
- [[concepts/表格化输出]]
- [[concepts/鸭子类型]]
- [[concepts/迭代协议与生成器]]
- [[concepts/库接口设计]]
- [[concepts/测试-日志与调试]]
- [[concepts/上下文管理器]]
