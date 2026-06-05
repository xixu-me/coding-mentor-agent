---
doc_type: short
full_text: sources/01_Variable_arguments.md
---

# 01_Variable_arguments 总结

本文讲解 Python 函数中的可变参数机制，包括位置可变参数 `*args`、关键字可变参数 `**kwargs`，以及如何用 `*` 和 `**` 将元组、字典展开为函数调用参数。这些技巧常用于编写更灵活的函数接口、对象构造、包装器和参数透传。相关主题可进一步整理为 Python函数参数、可变参数、参数解包、函数包装器。

## 核心内容

### 位置可变参数：`*args`

函数定义中使用 `*args` 可以接收任意数量的额外位置参数：

```python
def f(x, *args):
    ...
```

调用：

```python
f(1, 2, 3, 4, 5)
```

结果是：

```python
# x -> 1
# args -> (2, 3, 4, 5)
```

也就是说，除普通参数 `x` 之外的额外位置参数会被收集到一个元组中。

## 关键字可变参数：`**kwargs`

函数定义中使用 `**kwargs` 可以接收任意数量的额外关键字参数：

```python
def f(x, y, **kwargs):
    ...
```

调用：

```python
f(2, 3, flag=True, mode='fast', header='debug')
```

结果是：

```python
# x -> 2
# y -> 3
# kwargs -> {'flag': True, 'mode': 'fast', 'header': 'debug'}
```

额外的关键字参数会被收集到一个字典中。

## 同时使用 `*args` 和 `**kwargs`

可以同时接收任意数量的位置参数和关键字参数：

```python
def f(*args, **kwargs):
    ...
```

调用：

```python
f(2, 3, flag=True, mode='fast', header='debug')
```

函数内部得到：

```python
# args -> (2, 3)
# kwargs -> {'flag': True, 'mode': 'fast', 'header': 'debug'}
```

这种形式可以接收几乎任意组合的函数参数，常见于：

- 编写包装函数或装饰器
- 将参数原样传递给另一个函数
- 为函数接口预留扩展能力

这与 函数包装器 和 参数透传 密切相关。

## 参数解包：传入元组和字典

### 使用 `*` 展开元组

如果已有一个元组，可以在调用函数时用 `*` 将其展开为位置参数：

```python
numbers = (2, 3, 4)
f(1, *numbers)      # 等价于 f(1, 2, 3, 4)
```

这在从文件、数据库或其他数据源读入结构化记录后非常有用。

### 使用 `**` 展开字典

如果已有一个字典，可以用 `**` 将其展开为关键字参数：

```python
options = {
    'color': 'red',
    'delimiter': ',',
    'width': 400
}

f(data, **options)
# 等价于 f(data, color='red', delimiter=',', width=400)
```

这种技巧适合将配置项、解析选项或对象字段直接传给函数。

## 练习要点

### 练习 7.1：简单的可变参数函数

定义一个计算平均值的函数：

```python
def avg(x, *more):
    return float(x + sum(more)) / (1 + len(more))
```

示例：

```python
avg(10, 11)          # 10.5
avg(3, 4, 5)         # 4.0
avg(1, 2, 3, 4, 5, 6) # 3.5
```

这里 `x` 保证至少有一个参数，`*more` 收集剩余参数。这种写法适合需要“至少一个值，但可接收更多值”的函数。

### 练习 7.2：用元组和字典创建对象

假设有一条股票数据：

```python
data = ('GOOG', 100, 490.1)
```

如果直接调用：

```python
s = Stock(data)
```

会失败，因为 `Stock.__init__()` 期望多个独立参数，而不是一个元组。正确做法是：

```python
s = Stock(*data)
```

如果数据是字典：

```python
data = {'name': 'GOOG', 'shares': 100, 'price': 490.1}
s = Stock(**data)
```

这要求字典键名与构造函数参数名一致。

### 练习 7.3：简化实例列表创建

原始代码中从字典列表构建 `Stock` 对象：

```python
portfolio = [Stock(d['name'], d['shares'], d['price']) for d in portdicts]
```

可以改写为：

```python
portfolio = [Stock(**d) for d in portdicts]
```

这样更简洁，也更直接表达“字典字段映射到构造函数参数”的意图。

### 练习 7.4：参数透传

`read_portfolio()` 可以通过 `**opts` 接收额外选项，并传递给 `fileparse.parse_csv()`：

```python
def read_portfolio(filename, **opts):
    with open(filename) as lines:
        portdicts = fileparse.parse_csv(
            lines,
            select=['name', 'shares', 'price'],
            types=[str, int, float],
            **opts
        )

    portfolio = [Stock(**d) for d in portdicts]
    return Portfolio(portfolio)
```

这样调用者可以控制底层解析函数的行为，例如：

```python
port = report.read_portfolio('Data/missing.csv')
```

默认显示错误；也可以通过额外参数关闭错误输出：

```python
port = report.read_portfolio('Data/missing.csv', silence_errors=True)
```

这体现了 `**kwargs` 在接口扩展和参数透传中的作用。

## 关键概念

- `*args`：收集额外位置参数，结果是元组。
- `**kwargs`：收集额外关键字参数，结果是字典。
- `*tuple`：调用函数时将元组展开为位置参数。
- `**dict`：调用函数时将字典展开为关键字参数。
- 参数透传：外层函数接收可选参数，并传递给内层函数。
- 对象构造简化：当字典键与构造函数参数名一致时，可用 `ClassName(**dict)` 创建对象。

## 实践意义

本文的主要价值在于展示 Python 函数调用模型的灵活性。掌握 `*args`、`**kwargs` 和参数解包后，可以：

1. 编写参数数量不固定的函数。
2. 简化从结构化数据创建对象的代码。
3. 让高层函数暴露底层函数的可选行为。
4. 编写更通用的包装器和适配函数。
5. 降低重复的字段访问代码，提高可维护性。

这些技巧是理解 Python 函数接口设计、库封装和数据驱动对象构造的重要基础。

## Related Concepts
- [[concepts/Python-函数参数]]
- [[concepts/元组与解包]]
- [[concepts/字典与数据建模]]
- [[concepts/库接口设计]]
- [[concepts/函数]]
- [[concepts/Python-装饰器]]
- [[concepts/CSV-数据处理]]
- [[concepts/CSV-数据处理]]
- [[concepts/列表推导式]]
- [[concepts/类与对象]]
- [[concepts/异常处理]]
