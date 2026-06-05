---
sources: [summaries/01_Packages.md, summaries/03_Returning_functions.md, summaries/02_Classes_encapsulation.md, summaries/01_Dicts_revisited.md, summaries/01_Class.md, summaries/00_Overview.md, summaries/04_Modules.md]
brief: Python 命名空间是名称到对象的映射，作用域规定名称查找的范围与顺序。
---

# Python 命名空间与作用域

## 概念定义

**Python 命名空间**是“名称到对象”的映射关系；**作用域**决定某段代码在查找名称时，可以访问哪些命名空间，以及查找顺序是什么。

从实现角度看，Python 的很多命名空间本质上都由字典支撑：模块的全局名称保存在模块的 `__dict__` 中，类的属性和方法保存在类的 `__dict__` 中，普通实例的属性通常保存在实例的 `__dict__` 中。也就是说，Python 对象系统很大程度上可以理解为“字典之上的一层协议”。这与 [[summaries/01_Dicts_revisited]] 中关于 `__dict__`、`__class__`、`__bases__` 和 `__mro__` 的讨论直接相关。

在 [[summaries/04_Modules]] 中，模块被介绍为一种重要的命名空间：每个 `.py` 文件都是一个模块，模块内部定义的全局变量、函数和类共同构成该模块的命名空间。

在 [[summaries/01_Class]] 中，类和方法进一步展示了 Python 作用域规则的一个重要特点：**类定义会创建类对象及其属性，但类代码块并不会让方法体自动获得一个“类内部作用域”来直接查找其他方法**。在实例方法中操作对象，必须通过 `self` 显式访问实例属性或实例方法。

相关主题包括 Python对象模型、属性查找、Python模块、类与实例 和 self参数。

## 命名空间的基本形式

Python 程序运行时会在不同层次维护名称绑定。常见命名空间包括：

- **内置命名空间**：如 `len`、`str`、`dict` 等内置名称。
- **模块命名空间**：每个 `.py` 文件执行后形成的全局名称集合，保存在模块对象的 `__dict__` 中。
- **函数局部命名空间**：函数调用时由参数和局部变量组成。
- **类命名空间**：类定义体执行后形成的类属性和方法集合，保存在类对象的 `__dict__` 中。
- **实例命名空间**：对象实例上保存的属性集合，普通对象通常通过实例的 `__dict__` 保存。

这些命名空间共同构成 Python 程序中的名称组织体系。理解它们之间的边界，是理解 Python模块、类与实例、实例属性 和 self参数 的基础。

## 命名空间与字典

Python 中很多命名空间都可以直接观察为字典。

例如，普通字典是名称到值的映射：

```python
stock = {
    'name': 'GOOG',
    'shares': 100,
    'price': 490.1
}
```

类似地，模块、类和实例也维护名称到对象的映射：

```python
module.__dict__     # 模块命名空间
Class.__dict__      # 类命名空间
obj.__dict__        # 实例命名空间
```

因此，点号访问常常可以被理解为对某个命名空间的查询：

```python
foo.x          # 查询模块 foo 中的 x
Stock.cost     # 查询类 Stock 中的 cost
s.name         # 查询实例 s 或其类层次中的 name
```

不过，点号访问并不只是简单字典查找。对于对象属性，Python 还会应用完整的 属性查找 规则，包括实例字典、类字典、继承链、描述符和方法绑定等机制。本文重点关注与命名空间和作用域相关的基础部分。

## 模块命名空间

Python 中任何源文件都可以作为模块：

```python
# foo.py
x = 42

def grok(a):
    print(x)
```

当另一个文件导入它时：

```python
import foo

foo.grok(2)
print(foo.x)
```

这里的 `foo` 是模块名，也是访问该模块命名空间的入口。

模块命名空间中通常包含：

- 顶层变量，例如 `x = 42`
- 顶层函数定义，例如 `def grok(a): ...`
- 顶层类定义，例如 `class Stock: ...`
- 导入语句绑定的名称
- 模块执行结束后仍然存在的全局名称

模块对象的底层字典可以通过 `foo.__dict__` 或模块内部的 `globals()` 观察。例如：

```python
# foo.py
x = 42

def bar():
    ...

def spam():
    ...
```

模块命名空间大致类似：

```python
{
    'x': 42,
    'bar': <function bar>,
    'spam': <function spam>
}
```

这说明模块并不是一个抽象的“文件名容器”，而是一个真实的对象；它的全局变量和函数都作为名称绑定保存在模块字典中。

## 模块之间的名称隔离

不同模块可以使用相同的名称，而不会互相冲突。

例如：

```python
# foo.py
x = 42

def grok(a):
    ...
```

```python
# bar.py
x = 37

def spam(a):
    ...
```

这两个 `x` 不是同一个变量：

- `foo.py` 中的 `x` 是 `foo.x`
- `bar.py` 中的 `x` 是 `bar.x`

因此，模块天然提供了隔离机制。可以把每个模块看作一个独立的小环境。

这也是 Python模块 的核心价值之一：模块不仅组织代码，也防止全局名称互相污染。

## 模块作为函数的全局环境

模块会成为其中函数的外部环境。

```python
# foo.py
x = 42

def grok(a):
    print(x)
```

函数 `grok()` 中访问的 `x` 来自它所在模块 `foo.py` 的全局命名空间，而不是调用它的那个文件。

也就是说，函数定义时所在的模块决定了它的全局作用域。

```python
# program.py
import foo

x = 100
foo.grok(1)   # 输出 42，而不是 100
```

这里 `program.py` 中的 `x = 100` 不会影响 `foo.grok()` 对 `x` 的查找，因为 `grok()` 的全局作用域属于 `foo` 模块。

## 全局变量是“模块级全局”

在 Python 中，所谓“全局变量”并不是整个解释器范围内唯一的全局变量，而是**模块级全局变量**。

例如：

```python
# foo.py
x = 42
```

这个 `x` 的完整含义是：

```python
foo.x
```

因此，更准确地说：

- Python 的全局变量属于某个模块。
- 每个模块都有自己的全局命名空间。
- 不同模块中的同名全局变量彼此独立。
- 函数查找全局变量时，通常查找的是它定义所在模块的全局命名空间。

这一点对于理解大型程序的组织方式非常重要。

## `import` 与命名空间

普通导入会把模块对象绑定到当前命名空间：

```python
import math

math.sin(1.0)
```

这里发生了两件事：

1. Python 加载并执行 `math` 模块。
2. 当前文件中获得一个名称 `math`，它引用该模块对象。

之后访问模块内部名称时，需要通过模块名前缀：

```python
math.sin
math.cos
math.pi
```

这种写法清楚地保留了命名空间边界。

## `import as` 与本地绑定

可以给导入的模块取别名：

```python
import math as m

m.sin(1.0)
```

这并不会改变模块本身，也不会改变模块内部命名空间。它只是把当前文件中的本地名称从 `math` 改成了 `m`。

因此：

```python
import math as m
```

可以理解为：

- 加载 `math` 模块。
- 在当前命名空间中创建名称 `m`。
- 让 `m` 引用 `math` 模块对象。

相关内容见 Python导入机制。

## `from module import name` 与名称复制

另一种导入方式是：

```python
from math import sin, cos

sin(1.0)
cos(1.0)
```

这种写法会把模块中的指定名称复制到当前命名空间。

需要注意：

- 它仍然会加载整个模块。
- 它不会改变模块的隔离性。
- 它只是让当前作用域中多了 `sin` 和 `cos` 这两个名称。

也就是说：

```python
from math import sin
```

并不是只加载 `sin` 这个函数，而是先加载 `math` 模块，再把 `math.sin` 绑定到当前命名空间中的 `sin`。

## 命名冲突风险

使用 `from module import name` 时，模块名前缀被省略，代码更短，但也可能增加名称冲突风险。

例如：

```python
from math import sin

def sin(x):
    return x
```

此时后定义的 `sin` 会覆盖前面导入的 `sin` 名称。

相比之下：

```python
import math
```

使用 `math.sin()` 可以保留命名空间边界，更容易看出名称来自哪里。

因此，在较大程序中，普通 `import module` 往往更清晰；而 `from module import name` 适合导入少量高频使用且含义明确的名称。

## 类命名空间

`class` 语句会定义一个新的类对象。类定义体中出现的名称会形成类命名空间。例如：

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

执行这段类定义后，模块命名空间中会出现名称 `Player`，它引用一个类对象；而类对象内部又包含 `__init__`、`move`、`damage` 等名称。

因此，可以从两个层次理解它：

- 在模块层面，`Player` 是模块命名空间中的一个名称。
- 在类层面，`move`、`damage` 等是类命名空间中的名称，通常作为实例方法使用。

类命名空间可以通过类对象的 `__dict__` 观察：

```python
Player.__dict__
```

对于一个股票类：

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

`Stock.__dict__` 中会包含类似名称：

```python
{
    '__init__': <function>,
    'cost': <function>,
    'sell': <function>
}
```

这说明方法定义本质上也是类命名空间中的名称绑定。所有实例共享同一个类字典中的方法。相关内容见 类与实例、实例方法 和 Python对象模型。

## 类定义不是方法体的隐式作用域

虽然类有自己的命名空间，但 Python 的类作用域有一个容易误解的地方：**类不会为实例方法体提供一个可以直接查找其他方法名的封闭作用域**。

例如：

```python
class Player:
    def move(self, dx, dy):
        self.x += dx
        self.y += dy

    def left(self, amt):
        move(-amt, 0)       # 错误：会查找全局 move 名称
        self.move(-amt, 0)  # 正确：通过实例调用方法
```

在 `left()` 内部，直接写：

```python
move(-amt, 0)
```

并不会自动找到同一个类中的 `move()` 方法。Python 会把 `move` 当作一个普通名称进行查找；在这里，它更像是在查找局部名称或模块级全局名称，而不是隐式查找 `Player.move`。

如果要调用当前对象的方法，必须显式写出：

```python
self.move(-amt, 0)
```

这体现了 Python 风格中的一个重要原则：**对象操作要显式写出对象本身**。

## 实例命名空间与 `self`

类创建出来的实例也有自己的命名空间。保存到 `self` 上的属性，就是实例命名空间中的名称。

```python
class Player:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.health = 100
```

创建两个实例：

```python
a = Player(2, 3)
b = Player(10, 20)
```

它们各自有独立的实例数据：

```python
a.x   # 2
b.x   # 10
```

这里的 `a.x` 和 `b.x` 虽然名称都叫 `x`，但属于两个不同实例的命名空间，因此互不冲突。

这与模块命名空间的隔离类似：

- `foo.x` 和 `bar.x` 是不同模块中的 `x`。
- `a.x` 和 `b.x` 是不同实例中的 `x`。

普通实例的属性通常保存在实例自己的 `__dict__` 中：

```python
class Stock:
    def __init__(self, name, shares, price):
        self.name = name
        self.shares = shares
        self.price = price
```

创建实例后：

```python
s = Stock('GOOG', 100, 490.10)
s.__dict__
```

结果类似：

```python
{
    'name': 'GOOG',
    'shares': 100,
    'price': 490.10
}
```

对 `self.name`、`self.shares`、`self.price` 的赋值，实际是在当前实例的命名空间中建立名称绑定。

每个实例都有自己的独立字典：

```python
goog = Stock('GOOG', 100, 490.10)
ibm = Stock('IBM', 50, 91.23)
```

`goog.__dict__` 和 `ibm.__dict__` 是两个不同的实例命名空间。修改一个实例的属性不会自动影响另一个实例。

在实例方法中，第一个参数通常命名为 `self`：

```python
class Stock:
    def __init__(self, name, shares, price):
        self.name = name
        self.shares = shares
        self.price = price

    def cost(self):
        return self.shares * self.price
```

当调用：

```python
s = Stock('GOOG', 100, 490.10)
s.cost()
```

Python 会把实例 `s` 自动作为第一个参数传给 `cost()`，也就是方法定义中的 `self`。因此，`self.shares` 和 `self.price` 指向的是当前实例自己的属性。

相关内容见 实例属性、实例方法 和 self参数。

## 修改实例命名空间

对象属性赋值、读取和删除都与命名空间有关：

```python
x = obj.name          # 读取
obj.name = value      # 设置
del obj.name          # 删除
```

对于普通实例，设置属性通常会更新实例的 `__dict__`：

```python
s = Stock('GOOG', 100, 490.10)
s.shares = 50
s.date = '6/7/2007'
```

此时 `s.__dict__` 可能变为：

```python
{
    'name': 'GOOG',
    'shares': 50,
    'price': 490.10,
    'date': '6/7/2007'
}
```

删除属性会从实例命名空间中移除名称：

```python
del s.shares
```

Python 默认不会限制实例属性必须在 `__init__()` 中声明。也可以直接操作实例字典：

```python
goog.__dict__['time'] = '9:45am'
goog.time             # '9:45am'
```

这说明实例确实可以被看作字典之上的对象层。不过，直接操作 `__dict__` 并不常见；正常代码应优先使用点号语法，因为它更清晰，也能配合属性访问协议中的其他机制。

## 属性访问也是命名空间访问

无论是模块、类还是实例，点号访问都可以看成对某个命名空间中名称的访问：

```python
math.sin       # 模块 math 中的 sin
foo.x          # 模块 foo 中的 x
Player.move    # 类 Player 中的 move
s.name         # 实例 s 中的 name，或通过属性查找规则找到的名称
```

在 [[summaries/01_Class]] 的练习中，股票持仓从字典表示：

```python
s = {
    'name': 'GOOG',
    'shares': 100,
    'price': 490.10
}
```

改为类实例表示：

```python
s = Stock('GOOG', 100, 490.10)
```

访问方式也从字典键访问：

```python
s['name']
s['shares']
s['price']
```

变为属性访问：

```python
s.name
s.shares
s.price
```

这不仅是语法变化，也表示数据被放入了对象实例的命名空间中。结合方法后，对象还可以把数据和相关行为组织在一起，例如：

```python
s.cost()
s.sell(25)
```

这与 数据与行为封装 和 Python数据建模 相关。

## 实例属性、类属性与查找顺序

读取对象属性时，名称可能存在于多个命名空间中。对普通实例而言，基本查找思路是：

1. 先查找实例自己的 `__dict__`。
2. 如果没有找到，再查找实例所属类的 `__dict__`。
3. 如果类中也没有找到，并且存在继承，则继续沿继承顺序查找父类。

例如：

```python
s = Stock('GOOG', 100, 490.10)

s.name     # 通常在 s.__dict__ 中找到
s.cost()   # 通常在 Stock.__dict__ 中找到
```

`name` 是实例数据，因此位于实例命名空间；`cost` 是类中定义的方法，因此位于类命名空间。

类属性也遵循这一逻辑：

```python
Stock.foo = 42

goog.foo   # 42
ibm.foo    # 42
```

`foo` 并不在 `goog.__dict__` 或 `ibm.__dict__` 中，而在 `Stock.__dict__` 中。实例之所以能访问它，是因为实例查找失败后会继续查找类命名空间。

这就是类变量与实例变量的重要区别：

```python
class Foo:
    a = 13                  # 类变量

    def __init__(self, b):
        self.b = b          # 实例变量
```

- `Foo.a` 保存在类命名空间中，通常由所有实例共享。
- `f.b`、`g.b` 分别保存在不同实例的命名空间中。

如果修改类变量：

```python
Foo.a = 42
```

所有未在实例上覆盖该名称的对象都会看到新值。

相关内容见 属性查找、类变量与实例变量 和 Python对象模型。

## 方法绑定与命名空间

类字典中的方法最初只是函数对象：

```python
Stock.__dict__['sell']
```

当通过实例访问方法时：

```python
s = goog.sell
```

得到的是一个绑定方法。绑定方法把两个东西组合在一起：

- `s.__func__`：类命名空间中的原始函数对象。
- `s.__self__`：当前实例，也就是将作为 `self` 传入的对象。

因此：

```python
s(25)
```

等价于：

```python
s.__func__(s.__self__, 25)
```

这解释了为什么定义方法时需要显式写出 `self`，但调用方法时不需要手动传入实例。方法调用连接了类命名空间中的函数和实例命名空间中的数据。

该机制与 实例方法、self参数 和 Python方法绑定 密切相关。

## 继承、MRO 与属性查找

继承会扩展属性查找路径。类的直接父类保存在 `__bases__` 中：

```python
class NewStock(Stock):
    def yow(self):
        print('Yow!')

NewStock.__bases__
```

类的完整查找顺序保存在 `__mro__` 中：

```python
NewStock.__mro__
```

结果类似：

```python
(NewStock, Stock, object)
```

当执行：

```python
n = NewStock('ACME', 50, 123.45)
n.cost()
```

`cost` 并不在 `n.__dict__` 中，也不在 `NewStock.__dict__` 中，于是 Python 会沿 `NewStock.__mro__` 继续查找，在 `Stock.__dict__` 中找到 `cost`。

因此，继承不是把父类方法复制到子类或实例中，而是扩展名称查找路径。

在多重继承中，Python 使用 MRO，即 Method Resolution Order，决定类层次中的属性查找顺序。MRO 遵循协作式多重继承规则：

- 子类总是在父类之前检查。
- 多个父类按声明顺序参与排序。
- Python 使用 C3 线性化算法生成一致的查找序列。

`super()` 也依赖 MRO。它不是简单表示“调用父类”，而是表示“调用 MRO 中的下一个类”。这对 继承与MRO 和 mixin模式 尤其重要。

## 作用域与代码组织

理解命名空间与作用域，有助于更好地组织程序。

在 [[summaries/04_Modules]] 的练习中，代码逐渐被拆分为多个模块：

- `fileparse.py`：提供通用 `parse_csv()` 函数
- `report.py`：生成股票报表，并提供 `read_portfolio()`、`read_prices()`
- `pcost.py`：计算投资组合成本，复用 `report.read_portfolio()`

这种结构依赖模块命名空间来隔离职责：

```python
import fileparse

portfolio = fileparse.parse_csv(...)
```

函数 `parse_csv()` 属于 `fileparse` 模块，因此它的完整名称是：

```python
fileparse.parse_csv
```

这种命名方式既表达了函数来源，也避免了和其他模块中的同名函数冲突。

在 [[summaries/01_Class]] 的练习中，`Stock` 类被放入 `stock.py`：

```python
import stock

s = stock.Stock('GOOG', 100, 490.10)
```

这里同时涉及两层命名空间：

- `stock.Stock`：模块 `stock` 中的类名称。
- `s.name`、`s.shares`、`s.price`：实例 `s` 中的属性名称。

当程序继续修改 `report.py` 和 `pcost.py`，把字典访问改为对象属性访问时，本质上是在调整程序的数据组织方式：从“字典键命名空间”转向“实例属性命名空间”。这也是 代码重构 的一个常见方向。

## 与模块执行的关系

命名空间不是静态声明出来的，而是在模块执行过程中逐步建立的。

当 Python 导入模块时，会从上到下执行模块中的所有顶层语句。执行完成后，模块命名空间中保留下来的全局名称就是该模块对外可访问的内容。

例如：

```python
# sample.py
x = 1
y = 2

def add():
    return x + y

class Stock:
    pass
```

导入后：

```python
import sample

sample.x
sample.y
sample.add
sample.Stock
```

这些名称都是模块执行后保存在 `sample` 命名空间中的对象。

这与 Python模块加载与缓存 相关：模块通常只执行一次，之后重复导入会使用缓存中的模块对象。

## 常见误解

### 误解一：不同文件里的全局变量会互相冲突

不会。不同模块有不同的全局命名空间。

```python
foo.x
bar.x
```

它们是两个不同名称。

### 误解二：`from module import name` 只加载模块的一部分

不会。它仍然加载并执行整个模块，只是把指定名称绑定到当前命名空间。

### 误解三：函数使用调用方的全局变量

通常不会。函数的全局作用域由它定义所在的模块决定，而不是由调用它的位置决定。

### 误解四：`import as` 改变了模块名

不会。它只改变当前文件中的本地绑定名称。

```python
import math as m
```

模块仍然是 `math`，当前文件只是用 `m` 这个名字引用它。

### 误解五：类内部的方法可以直接调用同类中的其他方法

不能直接这样理解。类确实有类命名空间，但实例方法体不会自动把同类方法名放入局部作用域。

```python
class Player:
    def move(self, dx, dy):
        ...

    def left(self, amt):
        move(-amt, 0)       # 通常错误
        self.move(-amt, 0)  # 正确
```

如果要操作当前实例，应该通过 `self` 明确访问。

### 误解六：不同实例中的同名属性是同一个变量

不是。每个实例都有自己的属性命名空间。

```python
a = Stock('GOOG', 100, 490.10)
b = Stock('AAPL', 50, 122.34)

a.shares  # a 自己的 shares
b.shares  # b 自己的 shares
```

修改 `a.shares` 不会自动影响 `b.shares`。

### 误解七：实例只能拥有 `__init__()` 中声明的属性

不是。普通 Python 对象通常可以在运行时添加新属性：

```python
goog.date = '6/11/2007'
```

这会把 `date` 加入 `goog` 的实例命名空间，但不会加入其他实例的命名空间。

### 误解八：方法对象本身保存在每个实例中

通常不是。方法函数保存在类命名空间中，实例访问方法时会产生绑定方法，把类中的函数和当前实例组合起来。实例字典中通常只保存实例数据，而不保存类中定义的方法。

### 误解九：继承会把父类属性复制到子类或实例

不是。继承主要扩展属性查找路径。Python 会沿类的 `__mro__` 查找名称，而不是把所有父类成员复制到每个子类或实例中。

## 实践建议

- 使用模块名前缀保留清晰的命名空间边界。
- 把通用函数放入专门模块，例如 `fileparse.py`。
- 把相关数据与行为放入类中，例如用 `Stock` 表示股票持仓。
- 在实例方法中始终通过 `self` 访问实例属性和实例方法。
- 区分类变量和实例变量：共享数据放在类上，逐对象数据放在实例上。
- 理解 `obj.attr` 可能先查实例，再查类，再查继承链。
- 避免直接修改 `obj.__dict__`，除非是在调试、教学或元编程场景中。
- 避免在多个模块中依赖隐式共享的全局变量。
- 谨慎使用 `from module import *`，它会污染当前命名空间并增加冲突风险。
- 如果某个名称来自其他模块，优先让代码读者能看出它的来源。
- 如果某个名称属于对象实例，优先通过清晰的属性名表达其含义，例如 `s.shares`。
- 在多重继承或 mixin 中使用 `super()`，避免硬编码父类调用破坏 MRO 协作。

## 相关页面

- [[summaries/04_Modules]]：介绍模块、导入、命名空间、模块搜索路径和练习。
- [[summaries/01_Class]]：介绍类、实例、实例属性、实例方法和类作用域注意事项。
- [[summaries/01_Dicts_revisited]]：说明模块、实例、类、方法、继承和 MRO 背后的字典机制。
- [[summaries/00_Overview]]：课程整体概览。
- Python模块：模块作为 `.py` 文件、代码组织单位和命名空间。
- Python导入机制：不同导入语句如何加载模块和绑定名称。
- Python模块加载与缓存：模块只加载一次以及 `sys.modules` 的作用。
- 模块化设计：通过拆分文件和复用函数组织程序。
- 代码复用：通过库模块减少重复实现。
- 类与实例：类定义与对象实例之间的关系。
- 实例属性：保存在对象实例上的数据名称。
- 实例方法：绑定到实例并操作实例数据的函数。
- self参数：实例方法中表示当前对象的显式参数。
- 数据与行为封装：把数据及其相关操作组织到对象中。
- 属性查找：对象属性读取时在实例、类和继承链中的查找规则。
- Python对象模型：Python 对象、类、字典和方法绑定的底层关系。
- Python方法绑定：实例方法访问时函数与实例如何组合成绑定方法。
- 继承与MRO：继承层次中的方法解析顺序。
- mixin模式：通过多重继承组合可复用行为片段。
- 类变量与实例变量：类级共享名称与实例级独立名称的区别。

## 核心结论

Python 的命名空间与作用域机制使程序中的名称有明确归属。模块提供模块级全局命名空间，函数使用其定义所在模块作为全局环境，类创建类命名空间，实例保存各自独立的属性命名空间。导入语句只是把模块或其中名称绑定到当前命名空间；实例方法也不会隐式查找同类中的方法，必须通过 `self` 显式访问当前对象。

从实现角度看，模块、类和普通实例的命名空间都与字典紧密相关：模块名称在模块 `__dict__` 中，类属性和方法在类 `__dict__` 中，实例属性在实例 `__dict__` 中。属性访问则在这些命名空间之间按规则查找，并在继承场景中沿 `__mro__` 扩展查找路径。理解这些规则，是掌握 Python模块、Python导入机制、类与实例、属性查找 和 Python 对象系统的基础。

See also: [[summaries/02_Classes_encapsulation]]

See also: [[summaries/03_Returning_functions]]

See also: [[summaries/01_Packages]]