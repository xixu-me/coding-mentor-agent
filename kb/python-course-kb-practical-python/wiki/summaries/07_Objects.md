---
doc_type: short
full_text: sources/07_Objects.md
---

# 07_Objects 总结

本文介绍 Python 的内部对象模型，重点说明赋值、引用、对象身份、浅拷贝与深拷贝、类型检查，以及“一切皆对象”的含义。核心思想是：Python 变量只是名字，值才是真正的对象；赋值不会复制对象，只会复制引用。相关主题可连接到 [[concepts/Python-对象模型]]、[[concepts/可变性与引用]]、[[concepts/Python-拷贝语义]]、一等对象。

## 赋值不是复制

Python 中许多操作本质上都是“赋值”或“存储引用”：

```python
a = value
s[n] = value
s.append(value)
d['key'] = value
```

这些操作都不会复制被赋的值，而只是复制对象引用。也就是说，多个变量或容器元素可能指向同一个底层对象。

例如：

```python
a = [1, 2, 3]
b = a
c = [a, b]
```

这里实际上只有一个列表对象 `[1, 2, 3]`，但有多个引用指向它：`a`、`b`、`c[0]`、`c[1]`。如果修改列表：

```python
a.append(999)
```

那么通过 `a`、`b`、`c` 看到的内容都会变化。这是 Python 中 [[concepts/可变性与引用]] 的典型陷阱。

## 重新赋值不会覆盖旧对象

重新赋值不会修改旧对象本身，而是让变量名绑定到另一个对象：

```python
a = [1, 2, 3]
b = a
a = [4, 5, 6]
```

此时：

```python
print(a)  # [4, 5, 6]
print(b)  # [1, 2, 3]
```

关键原则：**变量是名字，不是内存位置。**

这也是理解 [[concepts/Python-对象模型]] 的基础。

## 共享可变对象的风险

如果不了解引用共享，程序中很容易出现意外的数据污染：以为自己在修改“私有副本”，实际上却修改了其他代码也在使用的同一个对象。

这也是 Python 中 `int`、`float`、`str` 等基础类型设计为不可变对象的重要原因之一：不可变对象即使被多个引用共享，也不会因为原地修改而互相影响。

## 对象身份与 `is`

`is` 用于判断两个变量是否引用同一个对象：

```python
a = [1, 2, 3]
b = a
a is b  # True
```

对象身份可以通过 `id()` 查看：

```python
id(a)
id(b)
```

如果两个变量指向同一个对象，它们的 `id()` 相同。

但通常情况下，比较对象内容应使用 `==`，而不是 `is`：

```python
a = [1, 2, 3]
b = a
c = [1, 2, 3]

 a is b  # True
 a is c  # False
 a == c  # True
```

`is` 比较身份，`==` 比较值。这个区别是 [[concepts/Python-对象模型]] 中的重要概念。

## 浅拷贝

列表和字典可以创建拷贝，例如：

```python
a = [2, 3, [100, 101], 4]
b = list(a)
```

此时 `a` 和 `b` 是两个不同的外层列表：

```python
a is b  # False
```

但其中的内部对象仍然被共享：

```python
a[2].append(102)
b[2]  # [100, 101, 102]
a[2] is b[2]  # True
```

这种只复制外层容器、不递归复制内部对象的行为称为浅拷贝。它属于 [[concepts/Python-拷贝语义]] 的核心内容。

## 深拷贝

如果需要复制对象以及它包含的所有嵌套对象，可以使用 `copy.deepcopy()`：

```python
import copy

a = [2, 3, [100, 101], 4]
b = copy.deepcopy(a)

a[2].append(102)
b[2]  # [100, 101]
a[2] is b[2]  # False
```

深拷贝适用于需要完全隔离嵌套可变结构的场景，但也可能带来额外开销和复杂性。

## 名字、值与类型

Python 中变量名本身没有类型，类型属于对象值：

```python
a = 42
b = 'Hello World'

type(a)  # int
type(b)  # str
```

`type()` 可以查看对象类型。类型名通常也可以作为构造或转换函数使用，例如 `int()`、`str()`、`float()`。

## 类型检查

可以使用 `isinstance()` 判断对象是否属于某种类型：

```python
if isinstance(a, list):
    print('a is a list')
```

也可以检查是否属于多个类型之一：

```python
if isinstance(a, (list, tuple)):
    print('a is a list or tuple')
```

不过，文章提醒不要过度使用类型检查。过多类型判断会增加代码复杂度。通常只有在防止常见误用时才值得加入类型检查。

## 一切皆对象

Python 中数字、字符串、列表、函数、异常、类、实例、模块等都是对象。所有可以被命名的东西，都可以作为数据传递、放入容器、作为参数使用。

这体现了 Python 的 一等对象 特性。

例如：

```python
import math
items = [abs, math, ValueError]

items[0](-45)       # abs(-45)
items[1].sqrt(2)    # math.sqrt(2)
```

甚至异常类也可以放在列表中并用于 `except`：

```python
try:
    x = int('not a number')
except items[2]:
    print('Failed!')
```

这种能力很强大，但也需要谨慎使用。能这样写并不代表总应该这样写。

## 练习 2.24：一等数据与类型转换函数

练习展示了如何利用“一切皆对象”的特性，把类型转换函数放入列表：

```python
types = [str, int, float]
```

读取 CSV 行后，原始数据都是字符串：

```python
row = ['AA', '100', '32.20']
```

可以用对应的转换函数处理字段：

```python
types[1](row[1])  # int('100') -> 100
types[2](row[2])  # float('32.20') -> 32.2
```

通过 `zip()` 将转换函数与字段配对：

```python
list(zip(types, row))
```

得到类似：

```python
[(str, 'AA'), (int, '100'), (float, '32.20')]
```

然后可统一转换：

```python
converted = []
for func, val in zip(types, row):
    converted.append(func(val))
```

也可以写成列表推导式：

```python
converted = [func(val) for func, val in zip(types, row)]
```

得到：

```python
['AA', 100, 32.2]
```

这一部分连接了 [[concepts/函数作为对象]]、[[concepts/列表推导式]] 与 [[concepts/数据清洗与类型转换]]。

## 练习 2.25：构造字典

将列名与转换后的值配对，可以用 `dict()` 创建字典：

```python
headers = ['name', 'shares', 'price']
converted = ['AA', 100, 32.2]

dict(zip(headers, converted))
```

结果：

```python
{'name': 'AA', 'shares': 100, 'price': 32.2}
```

也可以使用字典推导式一步完成转换和建表：

```python
{name: func(val) for name, func, val in zip(headers, types, row)}
```

这展示了如何把 CSV 行转换为结构化记录，是 [[concepts/数据清洗与类型转换]] 的实用模式。

## 练习 2.26：更大的应用图景

同样技巧可推广到其他面向列的数据文件。例如读取股票数据：

```python
headers = ['name', 'price', 'date', 'time', 'change', 'open', 'high', 'low', 'volume']
row = ['AA', '39.48', '6/11/2007', '9:36am', '-0.18', '39.67', '39.69', '39.45', '181800']
```

定义每列对应的转换函数：

```python
types = [str, float, str, str, float, float, float, float, int]
```

然后转换并构造记录：

```python
converted = [func(val) for func, val in zip(types, row)]
record = dict(zip(headers, converted))
```

得到的 `record` 可以通过字段名访问：

```python
record['name']
record['price']
```

文末还提出扩展问题：如何将 `date` 字段解析为 `(6, 11, 2007)` 这样的元组。这暗示可以自定义转换函数，而不仅限于内置类型函数。

## 核心要点

- 赋值不会复制对象，只会复制引用。
- 变量是名字，不是内存位置。
- 修改可变对象会影响所有共享该对象的引用。
- `is` 比较对象身份，`==` 比较对象值。
- 浅拷贝只复制外层容器，内部对象仍共享。
- 深拷贝会递归复制嵌套对象。
- 类型属于值，不属于变量名。
- `isinstance()` 可用于类型检查，但不应滥用。
- Python 中一切皆对象，函数、模块、异常也能作为普通数据使用。
- 一等对象特性可用于构建通用的数据转换流程。

## 相关概念

- [[concepts/Python-对象模型]]
- [[concepts/可变性与引用]]
- [[concepts/Python-拷贝语义]]
- 一等对象
- [[concepts/列表推导式]]
- [[concepts/数据清洗与类型转换]]

## Related Concepts
- [[concepts/Python-拷贝语义]]
- [[concepts/可变性与引用]]
- [[concepts/列表与序列]]
- [[concepts/Python-运算符与表达式]]
- [[concepts/对象身份与相等性]]
- [[concepts/浅拷贝与深拷贝]]
- [[concepts/Python-对象模型]]
- [[concepts/Python-可变对象]]
- [[concepts/Python-不可变对象]]
- [[concepts/变量与数据类型]]
- [[concepts/函数作为对象]]
- [[concepts/CSV-数据处理]]
- [[concepts/字典与数据建模]]
- [[concepts/Python-容器]]
- [[concepts/元组与解包]]
- [[concepts/鸭子类型]]
- [[concepts/文件读写]]
- [[concepts/模块与-import]]
- [[concepts/浮点数精度]]
