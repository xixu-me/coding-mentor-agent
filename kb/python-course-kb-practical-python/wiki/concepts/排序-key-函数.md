---
sources: [summaries/02_Anonymous_function.md]
brief: 排序 key 函数用于为复杂元素提取比较依据，从而控制排序顺序。
---

# 排序 key 函数

排序 key 函数是传给排序操作的一个函数，用于从每个待排序元素中提取“排序依据”。在 Python 中，常见用法是把它传给列表的 `sort()` 方法或内置函数 `sorted()` 的 `key` 参数。

相关来源：[[summaries/02_Anonymous_function]]

## 基本思想

对于简单列表，Python 可以直接比较元素：

```python
s = [10, 1, 7, 3]
s.sort()
# [1, 3, 7, 10]
```

但当列表元素是字典、对象或其他复杂结构时，Python 不一定知道应该按哪个字段排序。例如股票记录可能包含：

```python
{'name': 'IBM', 'price': 91.1, 'shares': 50}
```

这时需要明确告诉排序方法：按 `name`、`price`，还是 `shares` 排序。这个“告诉排序方法如何取比较值”的函数，就是排序 key 函数。

## 使用普通函数作为 key

在 [[summaries/02_Anonymous_function]] 中，文档先使用普通函数按股票名称排序：

```python
def stock_name(s):
    return s['name']

portfolio.sort(key=stock_name)
```

这里：

- `portfolio` 是待排序的列表；
- `sort()` 负责执行排序；
- `key=stock_name` 指定排序依据；
- `stock_name(s)` 接收一个元素 `s`，返回该元素的 `name` 字段；
- 排序时，Python 根据每个元素对应的 `name` 值决定顺序。

对于对象形式的数据，也可以提取对象属性：

```python
def stock_name(s):
    return s.name

portfolio.sort(key=stock_name)
```

## 使用 lambda 作为 key

如果 key 函数很短，并且只在当前排序中使用一次，可以使用 lambda匿名函数 简化代码：

```python
portfolio.sort(key=lambda s: s.name)
```

这等价于先定义：

```python
def stock_name(s):
    return s.name
```

再传入：

```python
portfolio.sort(key=stock_name)
```

使用 `lambda` 的优势是把一次性的字段提取逻辑直接写在排序调用中，使代码更紧凑。

## 常见排序字段示例

假设 `portfolio` 中的每个元素都有 `name`、`shares`、`price` 等属性，可以分别按不同字段排序。

按股票名称排序：

```python
portfolio.sort(key=lambda s: s.name)
```

按持股数量排序：

```python
portfolio.sort(key=lambda s: s.shares)
```

按股票价格排序：

```python
portfolio.sort(key=lambda s: s.price)
```

这些例子展示了排序 key 函数的核心作用：排序算法本身不变，但通过更换 key 函数，可以改变排序依据。

## 与回调函数的关系

排序 key 函数是一种典型的 [[concepts/回调函数]]。

调用者把函数传给 `sort()`：

```python
portfolio.sort(key=lambda s: s.price)
```

然后 `sort()` 在排序过程中会对每个元素调用这个函数，取得用于比较的值。也就是说，排序方法“回调”了用户提供的函数。

这也体现了 Python 中 [[concepts/函数作为对象]] 的特性：函数可以像普通值一样传递给另一个函数或方法。

## 与高阶函数的关系

接受函数作为参数的函数或方法通常称为 高阶函数。`sort(key=...)` 就具有高阶函数风格，因为它接受一个函数来定制自身行为。

排序 key 函数让排序操作更加通用：

- 排序算法由 `sort()` 提供；
- 排序规则由 `key` 函数提供；
- 两者分离，使代码更灵活。

## key 函数的特点

一个好的排序 key 函数通常具有以下特点：

- 接收一个列表元素作为参数；
- 返回一个可比较的值；
- 不修改原始数据；
- 逻辑尽量简单；
- 通常只负责字段提取或简单转换。

例如：

```python
lambda s: s.price
```

就是一个非常典型的 key 函数：它接收一个股票对象，返回其价格。

## key 函数与 reverse 参数

`key` 决定“按什么排序”，`reverse` 决定“升序还是降序”。二者可以组合使用：

```python
portfolio.sort(key=lambda s: s.price, reverse=True)
```

这表示按价格从高到低排序。

## 适用场景

排序 key 函数常用于：

- 按字典中的某个键排序；
- 按对象的某个属性排序；
- 按字符串长度排序；
- 按计算结果排序；
- 按复合规则排序。

例如按字符串长度排序：

```python
names = ['IBM', 'Microsoft', 'GE']
names.sort(key=len)
```

其中 `len` 也是一个函数，可直接作为 key 函数传入。

## 小结

排序 key 函数通过 `key` 参数为排序过程提供比较依据。它把“如何排序”的规则从排序算法中分离出来，使得同一个 `sort()` 方法可以用于各种复杂数据结构。对于简单的一次性字段提取，通常使用 lambda匿名函数；对于较复杂或需要复用的逻辑，则更适合使用普通命名函数。