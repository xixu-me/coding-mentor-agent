---
doc_type: short
full_text: sources/02_Anonymous_function.md
---

# 02_Anonymous_function 总结

本文讲解 Python 中的匿名函数 `lambda`，重点说明它如何作为 `sort()` 的 `key` 回调函数，用于按自定义字段对列表元素排序。

## 核心内容

### 列表原地排序

Python 列表可以使用 `sort()` 方法进行原地排序：

```python
s = [10, 1, 7, 3]
s.sort()
# [1, 3, 7, 10]
```

也可以通过 `reverse=True` 进行降序排序：

```python
s.sort(reverse=True)
# [10, 7, 3, 1]
```

这类简单数值列表排序很直接，但当列表元素是字典或对象时，需要指定排序依据。

## 使用 key 函数排序

对于字典列表，例如股票组合数据：

```python
{'name': 'IBM', 'price': 91.1, 'shares': 50}
```

如果要按股票名称排序，需要提供一个 `key` 函数：

```python
def stock_name(s):
    return s['name']

portfolio.sort(key=stock_name)
```

`sort()` 会对每个列表元素调用 `stock_name()`，并使用返回值作为排序依据。

这体现了 [[concepts/回调函数]] 的典型用法：调用者把一个函数传给另一个函数，由后者在合适时机调用它。

## 回调函数

文中指出，`key` 函数就是一种回调函数。`sort()` 方法会“回调”用户传入的函数，以获得每个元素的排序关键值。

这类函数通常有以下特点：

- 很短；
- 常常只包含一行逻辑；
- 往往只服务于一次操作；
- 不一定值得单独命名定义。

因此，Python 提供了 `lambda` 作为更简洁的写法。

## lambda：匿名函数

`lambda` 可以创建一个未命名函数，用于计算单个表达式。例如：

```python
portfolio.sort(key=lambda s: s['name'])
```

它等价于：

```python
def stock_name(s):
    return s['name']

portfolio.sort(key=stock_name)
```

但 `lambda` 更短，尤其适合这种只在当前调用中使用的小函数。

相关主题可整理为 lambda匿名函数、[[concepts/函数作为对象]] 和 高阶函数。

## lambda 的限制

`lambda` 在 Python 中受到较强限制：

- 只能包含单个表达式；
- 不能包含语句；
- 不能写普通的 `if`、`while` 等语句结构；
- 最常见用途是作为 `sort()`、`sorted()` 等函数的 `key` 参数。

因此，`lambda` 适合简单转换或字段提取，不适合复杂逻辑。复杂逻辑仍应使用普通 `def` 函数。

## 练习要点

### Exercise 7.5：按字段排序

读取股票组合数据后，先定义普通函数：

```python
def stock_name(s):
    return s.name
```

再按股票名称排序：

```python
portfolio.sort(key=stock_name)
```

该练习强调：`sort()` 不是直接比较整个对象，而是使用 `key` 函数返回的字段值进行比较。

### Exercise 7.6：使用 lambda 按字段排序

可以使用 `lambda` 按持股数量排序：

```python
portfolio.sort(key=lambda s: s.shares)
```

也可以按股票价格排序：

```python
portfolio.sort(key=lambda s: s.price)
```

这些例子说明，`lambda` 可以把一次性的字段提取逻辑直接写在函数调用中，避免额外定义命名函数。

## 关键概念

- lambda匿名函数：用 `lambda` 创建只包含单个表达式的匿名函数。
- [[concepts/回调函数]]：把函数传入另一个函数，由后者在执行过程中调用。
- 排序key函数：通过 `key` 参数指定排序依据。
- 高阶函数：接收函数作为参数的函数，例如 `sort(key=...)`。
- [[concepts/函数作为对象]]：Python 中函数可以赋值、传参和作为返回值使用。

## 总结

本文的核心思想是：当需要对复杂数据结构排序时，可以通过 `key` 函数指定排序依据；如果这个函数逻辑很简单且只使用一次，就可以用 `lambda` 写成匿名函数，使代码更简洁。

## Related Concepts
- [[concepts/排序-key-函数]]
- [[concepts/函数]]
- [[concepts/列表与序列]]
- [[concepts/Python-函数参数]]
- [[concepts/Python-运算符与表达式]]
- [[concepts/字典与数据建模]]
- [[concepts/类与对象]]
- [[concepts/绑定方法]]
- [[concepts/闭包]]
- [[concepts/Python-装饰器]]
