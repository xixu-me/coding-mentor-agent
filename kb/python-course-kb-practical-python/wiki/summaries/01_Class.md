---
doc_type: short
full_text: sources/01_Class.md
---

# 01_Class 总结

本文介绍 Python 中 `class` 语句的基本用法，以及如何通过类创建新的对象。核心目标是从元组、字典等松散数据结构，过渡到以对象组织数据与行为的 面向对象编程 风格。

## 核心概念

### 面向对象编程

面向对象编程 是一种将程序组织为对象集合的编程技术。对象通常包含两部分：

- **数据**：对象的属性（attributes）
- **行为**：作用于对象的方法（methods）

例如 Python 列表 `nums` 是 `list` 的一个实例：

```python
nums = [1, 2, 3]
nums.append(4)
nums.insert(1, 10)
```

这里 `nums` 是对象实例，`append()` 和 `insert()` 是绑定到该实例上的方法。

## `class` 语句

`class` 用于定义一种新的对象类型。例如：

```python
class Player:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.health = 100

    def move(self, dx, dy):
        self.x += dx
        self.y += dy

    def damage(self, pts):
        self.health -= pts
```

类本身只是定义，类似函数定义，单独存在时不会创建对象或执行逻辑。真正被程序操作的是类创建出来的实例。

## 实例

实例是程序中实际操作的对象，通过“调用类”来创建：

```python
a = Player(2, 3)
b = Player(10, 20)
```

`a` 和 `b` 都是 `Player` 的实例，但它们是彼此独立的对象。

## 实例数据

每个实例都有自己的本地数据，通常在 `__init__()` 中初始化：

```python
class Player:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.health = 100
```

保存到 `self` 上的值就是实例属性，例如 `self.x`、`self.y`、`self.health`。不同实例的属性互不影响：

```python
a.x  # 2
b.x  # 10
```

Python 对实例属性的数量和类型没有固定限制。

## 实例方法

实例方法是定义在类中的函数，用来操作实例内部的数据：

```python
class Player:
    def move(self, dx, dy):
        self.x += dx
        self.y += dy
```

调用方法时，对象本身会自动作为第一个参数传入：

```python
a.move(1, 2)
```

等价于把 `a` 绑定到方法定义中的 `self`，把 `1` 绑定到 `dx`，把 `2` 绑定到 `dy`。`self` 只是约定名称，但 Python 风格要求使用它来表示当前实例。

## 类作用域注意事项

类定义不会像某些语言那样自动为方法名创建隐式作用域。在类的方法内部，如果要调用同一个对象上的其他方法，必须通过 `self` 显式引用：

```python
class Player:
    def move(self, dx, dy):
        self.x += dx
        self.y += dy

    def left(self, amt):
        move(-amt, 0)       # 错误：会查找全局函数 move
        self.move(-amt, 0)  # 正确：调用当前实例的方法
```

这一点强调了 Python 中对象操作的显式性：要操作实例，就必须明确写出实例引用。

## 练习主题

本节练习从前面章节的代码出发，将原本使用元组或字典表示的数据，改写为类实例。

### Exercise 4.1：用对象作为数据结构

此前股票持仓可以用元组表示：

```python
s = ('GOOG', 100, 490.10)
```

也可以用字典表示：

```python
s = {
    'name': 'GOOG',
    'shares': 100,
    'price': 490.10
}
```

本练习要求创建 `stock.py`，定义 `Stock` 类，用实例属性表示一笔股票持仓：

```python
class Stock:
    def __init__(self, name, shares, price):
        self.name = name
        self.shares = shares
        self.price = price
```

创建对象：

```python
a = stock.Stock('GOOG', 100, 490.10)
```

访问字段时，从字典写法：

```python
s['name']
s['price']
```

变为对象属性写法：

```python
s.name
s.price
```

该练习强调：类可以看作创建对象的“工厂”，每次调用类都会创建一个拥有独立数据的新实例。

### Exercise 4.2：添加方法

为 `Stock` 添加 `cost()` 和 `sell()` 方法，使对象不仅保存数据，还能封装与数据相关的行为：

```python
s = stock.Stock('GOOG', 100, 490.10)
s.cost()      # 49010.0
s.sell(25)
s.shares      # 75
s.cost()      # 36757.5
```

这体现了 数据与行为封装：股票对象既知道自己的字段，也知道如何计算成本和处理卖出操作。

### Exercise 4.3：创建实例列表

本练习将从 CSV 读取出来的字典列表转换为 `Stock` 实例列表：

```python
portfolio = [
    stock.Stock(d['name'], d['shares'], d['price'])
    for d in portdicts
]
```

然后通过对象方法计算总成本：

```python
sum([s.cost() for s in portfolio])
```

这展示了如何将外部数据解析结果转换为更结构化的对象模型。

### Exercise 4.4：在现有程序中使用类

最后要求修改 `report.py` 中的 `read_portfolio()`，使其返回 `Stock` 实例列表，而不是字典列表。同时调整 `report.py` 和 `pcost.py` 中的字段访问方式：

```python
s['shares']
```

改为：

```python
s.shares
```

修改后，原有功能应保持一致：

```python
pcost.portfolio_cost('Data/portfolio.csv')
# 44671.15

report.portfolio_report('Data/portfolio.csv', 'Data/prices.csv')
```

这一练习体现了 代码重构：在不大幅改变外部行为的情况下，替换内部数据表示，使程序结构更清晰。

## 关键收获

- 类是对象类型的定义，本身不会自动创建实例。
- 实例是由类调用产生的实际对象。
- 保存到 `self` 上的数据是实例数据，每个实例各自独立。
- 实例方法是绑定到对象上的函数，第一个参数始终是对象本身。
- Python 约定使用 `self` 表示当前实例。
- 在方法内部调用同一对象的其他方法时，必须写成 `self.method(...)`。
- 类可以替代字典或元组，用更清晰的属性访问和方法封装组织数据。
- 将程序从字典数据改为对象数据，是面向对象重构的基础步骤。

## 相关概念

- 面向对象编程
- 类与实例
- 实例属性
- 实例方法
- self参数
- 数据与行为封装
- 代码重构
- Python数据建模

## Related Concepts
- [[concepts/类与对象]]
- [[concepts/特殊方法]]
- [[concepts/Python-命名空间与作用域]]
- [[concepts/字典与数据建模]]
- [[concepts/Python-对象模型]]
- [[concepts/Python-可变对象]]
- [[concepts/函数]]
- [[concepts/模块与-import]]
- [[concepts/CSV-数据处理]]
- [[concepts/列表推导式]]
- [[concepts/表格化输出]]
