---
doc_type: short
full_text: sources/02_Inheritance.md
---

# 02_Inheritance 总结

## 核心主题

本文介绍 Python 中的继承机制，以及如何用继承编写可扩展、可定制的程序。重点不仅在语法本身，还在于通过继承定义稳定接口，让应用代码与具体实现解耦，形成可插拔的设计。相关主题可连接到 python inheritance、object oriented programming、polymorphism、extensible design。

## 继承基础

继承用于基于已有类创建更专门的新类：

```python
class Parent:
    ...

class Child(Parent):
    ...
```

其中：

- `Child` 是派生类或子类。
- `Parent` 是基类或父类。
- 父类写在类名后的括号中。

继承的核心用途是扩展已有代码，包括：

- 添加新方法。
- 重定义已有方法。
- 为实例添加新属性。

例如已有 `Stock` 类：

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

可以通过继承创建 `MyStock`，添加新行为：

```python
class MyStock(Stock):
    def panic(self):
        self.sell(self.shares)
```

也可以重定义已有方法：

```python
class MyStock(Stock):
    def cost(self):
        return 1.25 * self.shares * self.price
```

重定义的方法会替代父类中的同名方法，而其他未重定义的方法仍然来自父类。

## 方法覆盖与 `super()`

当子类希望扩展父类方法，而不是完全替换它时，应使用 `super()` 调用父类版本：

```python
class MyStock(Stock):
    def cost(self):
        actual_cost = super().cost()
        return 1.25 * actual_cost
```

`super()` 表示“调用继承链中的上一个实现”。这让子类可以复用父类逻辑，并在其基础上添加额外行为。

在 Python 2 中写法更繁琐：

```python
actual_cost = super(MyStock, self).cost()
```

## `__init__` 与继承

如果子类重定义了 `__init__()`，通常必须显式调用父类的 `__init__()`，否则父类负责初始化的属性不会被创建：

```python
class MyStock(Stock):
    def __init__(self, name, shares, price, factor):
        super().__init__(name, shares, price)
        self.factor = factor

    def cost(self):
        return self.factor * super().cost()
```

这体现了继承中的一个常见模式：

1. 父类初始化通用状态。
2. 子类通过 `super().__init__()` 复用父类初始化。
3. 子类再初始化自身新增的状态。

## 继承的用途

继承有两类常见用途。

### 1. 表达类型层次结构

例如：

```python
class Shape:
    ...

class Circle(Shape):
    ...

class Rectangle(Shape):
    ...
```

这表达了“Circle 是一种 Shape”的关系，即典型的 is-a 关系。

可以使用 `isinstance()` 检查实例是否属于父类类型：

```python
c = Circle(4.0)
isinstance(c, Shape)   # True
```

重要原则：理想情况下，凡是能处理父类实例的代码，也应该能处理子类实例。这与 polymorphism 和面向对象替换原则相关。

### 2. 编写可扩展代码

更实用的用途是框架式扩展。例如框架提供一个基类，用户继承它并重写部分方法：

```python
class CustomHandler(TCPHandler):
    def handle_request(self):
        ...
```

父类包含通用逻辑，子类只负责定制特定行为。这是很多库和框架使用继承的主要原因。

## `object` 基类

Python 中所有类最终都继承自 `object`。

有时会看到：

```python
class Shape(object):
    ...
```

在现代 Python 中，即使不显式写 `object`，类也会隐式继承自 `object`。显式写法主要是 Python 2 时代遗留下来的习惯。

## 多重继承

Python 允许一个类同时继承多个父类：

```python
class Mother:
    ...

class Father:
    ...

class Child(Mother, Father):
    ...
```

`Child` 会继承两个父类的功能。但多重继承涉及复杂的方法解析顺序等细节，文中提醒：除非清楚自己在做什么，否则不要轻易使用。

## 练习主题：用继承解决可扩展输出格式问题

练习部分围绕 `report.py` 中的 `print_report()` 函数展开。原始函数只能输出固定的纯文本表格：

```python
def print_report(reportdata):
    headers = ('Name','Shares','Price','Change')
    print('%10s %10s %10s %10s' % headers)
    print(('-'*10 + ' ')*len(headers))
    for row in reportdata:
        print('%10s %10d %10.2f %10.2f' % row)
```

问题是：如果希望支持纯文本、HTML、CSV、XML 等多种输出格式，把所有逻辑都写进一个巨大函数会导致代码难以维护。继承提供了更好的可扩展方案。

## 抽象基类：`TableFormatter`

练习首先要求创建 `tableformat.py`，定义一个表格格式化器基类：

```python
class TableFormatter:
    def headings(self, headers):
        '''
        Emit the table headings.
        '''
        raise NotImplementedError()

    def row(self, rowdata):
        '''
        Emit a single row of table data.
        '''
        raise NotImplementedError()
```

这个类本身不实现具体功能，而是规定接口：

- `headings(headers)`：输出表头。
- `row(rowdata)`：输出一行数据。

它相当于一个“设计规范”或抽象基类。具体格式化器通过继承它并实现这些方法。

随后 `print_report()` 被改写为接收一个 formatter 对象：

```python
def print_report(reportdata, formatter):
    formatter.headings(['Name','Shares','Price','Change'])
    for name, shares, price, change in reportdata:
        rowdata = [ name, str(shares), f'{price:0.2f}', f'{change:0.2f}' ]
        formatter.row(rowdata)
```

这样，`print_report()` 不再关心输出格式，只依赖统一接口。这是 loose coupling 的体现。

## 具体格式化器实现

### 纯文本格式：`TextTableFormatter`

```python
class TextTableFormatter(TableFormatter):
    '''
    Emit a table in plain-text format
    '''
    def headings(self, headers):
        for h in headers:
            print(f'{h:>10s}', end=' ')
        print()
        print(('-'*10 + ' ')*len(headers))

    def row(self, rowdata):
        for d in rowdata:
            print(f'{d:>10s}', end=' ')
        print()
```

它产生与原始程序相同的固定宽度表格输出。

### CSV 格式：`CSVTableFormatter`

```python
class CSVTableFormatter(TableFormatter):
    '''
    Output portfolio data in CSV format.
    '''
    def headings(self, headers):
        print(','.join(headers))

    def row(self, rowdata):
        print(','.join(rowdata))
```

它通过逗号连接字段，输出 CSV 格式。

### HTML 格式：`HTMLTableFormatter`

练习要求实现一个 HTML 表格行格式化器，输出形式类似：

```html
<tr><th>Name</th><th>Shares</th><th>Price</th><th>Change</th></tr>
<tr><td>AA</td><td>100</td><td>9.22</td><td>-22.98</td></tr>
```

这说明新增格式只需要新增一个继承 `TableFormatter` 的类，而无需修改 `print_report()` 的核心逻辑。

## 多态：同一接口，不同对象

练习 4.7 强调 polymorphism：如果程序期望一个 `TableFormatter` 对象，那么无论传入的是 `TextTableFormatter`、`CSVTableFormatter` 还是 `HTMLTableFormatter`，程序都可以正常工作。

关键在于所有子类都实现了同一组方法：

- `headings()`
- `row()`

因此 `print_report()` 可以写成面向接口的代码，而不是面向具体类的代码。

## 工厂函数：`create_formatter(name)`

为了避免在 `portfolio_report()` 中写大量 `if/elif` 判断，练习要求把格式选择逻辑移动到 `tableformat.py` 中：

```python
def create_formatter(name):
    ...
```

它根据 `'txt'`、`'csv'`、`'html'` 等简短名称创建相应格式化器。

然后 `portfolio_report()` 变为：

```python
def portfolio_report(portfoliofile, pricefile, fmt='txt'):
    portfolio = read_portfolio(portfoliofile)
    prices = read_prices(pricefile)
    report = make_report_data(portfolio, prices)

    formatter = tableformat.create_formatter(fmt)
    print_report(report, formatter)
```

这样，报表生成逻辑与格式对象创建逻辑分离，代码更清晰，也更容易扩展。

## 命令行集成

练习 4.8 要求让 `report.py` 支持从命令行指定输出格式：

```bash
python3 report.py Data/portfolio.csv Data/prices.csv csv
```

这使程序可以按用户输入输出不同格式，例如 CSV：

```text
Name,Shares,Price,Change
AA,100,9.22,-22.98
IBM,50,106.28,15.18
```

## “拥有自己的抽象”

讨论部分提出一个重要设计思想：拥有自己的抽象。

即使已有第三方表格格式化库，也不意味着应用代码应该直接依赖该库。更好的做法是：

1. 应用代码依赖自己定义的 `TableFormatter` 接口。
2. 具体实现可以使用自定义代码，也可以调用第三方库。
3. 将来如果替换第三方库，只要保持 `TableFormatter` 接口不变，应用代码就无需修改。

这体现了：

- 松耦合。
- 可替换实现。
- 面向接口编程。
- 框架和库中常见的扩展模式。

相关概念可连接到 interface design、abstraction、design patterns。

## 关键收获

- 继承允许子类扩展父类：添加方法、重写方法、增加属性。
- `super()` 用于调用父类实现，尤其适合扩展而非完全替换父类行为。
- 子类重写 `__init__()` 时，通常应调用 `super().__init__()` 完成父类初始化。
- 继承可以表达“is-a”类型关系，但更常见的实践价值是构建可扩展框架。
- 抽象基类可以定义接口，具体子类负责实现。
- 多态让同一段代码可以处理不同具体类型的对象。
- 工厂函数可以把对象创建逻辑从业务逻辑中分离出来。
- “拥有自己的抽象”能让应用代码与具体实现、第三方库保持松耦合。

## 与后续内容的关系

本文是面向对象编程章节的一部分，承接类的基础知识，并为后续特殊方法、多态、接口设计和框架式编程打基础。它展示了继承不只是语法机制，更是一种组织可扩展程序结构的设计工具。

## Related Concepts
- [[concepts/继承与多态]]
- [[concepts/类与对象]]
- [[concepts/库接口设计]]
- [[concepts/表格化输出]]
- [[concepts/鸭子类型]]
- [[concepts/特殊方法]]
- [[concepts/命令行参数]]
- [[concepts/main-函数与脚本结构]]
- [[concepts/模块与-import]]
- [[concepts/异常处理]]
