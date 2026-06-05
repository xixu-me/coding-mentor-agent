---
sources: [summaries/07_Objects.md, summaries/06_Generators__00_Overview.md, summaries/02_Working_with_data__00_Overview.md, summaries/04_More_generators.md, summaries/02_Customizing_iteration.md, summaries/01_Iteration_protocol.md, summaries/03_Special_methods.md, summaries/06_List_comprehension.md, summaries/05_Collections.md, summaries/03_Formatting.md, summaries/02_Containers.md, summaries/01_Datatypes.md, summaries/00_Overview.md]
brief: Python 容器通过统一协议组织、访问、迭代和封装多个对象。
---

# Python 容器

Python 容器是用于保存、组织和访问多个对象的数据结构。它们既包括内置类型，例如 `list`、`tuple`、`set`、`dict`，也包括标准库 collections模块 中的专用容器，以及用户通过特殊方法实现的自定义容器。

容器不仅是“装数据”的结构，也是 Python 统一语法和协议体系的一部分。一个对象如果实现了适当的特殊方法，就可以像内置容器一样支持 `for` 循环、`len()`、索引、切片、成员测试、赋值和删除等操作。这一点把容器与 Python迭代协议、Python特殊方法、Python数据模型、容器协议 和 Pythonic设计 紧密联系起来。

在 [[summaries/00_Overview]] 中，“Working With Data”章节将容器作为处理数据的重要主题之一，并介绍 Python 的核心数据结构：tuples、lists、sets 和 dictionaries。[[summaries/02_Containers]] 说明了这些容器在真实数据处理中的选择方式：列表适合有序数据，字典适合通过键快速查找，集合适合唯一元素和成员测试。[[summaries/05_Collections]] 展示了标准库 `collections` 模块如何在内置容器之上提供更专门的数据处理工具，例如 `Counter`、`defaultdict` 和 `deque`。[[summaries/03_Special_methods]] 和 [[summaries/01_Iteration_protocol]] 则从底层机制说明：容器行为由特殊方法和迭代协议驱动，自定义对象也可以通过这些协议融入 Python 语言。

## 核心含义

容器的作用是把多个值组合在一起，使程序能够：

- 存储一组相关数据
- 按顺序或按键访问数据
- 遍历多个元素
- 增加、删除或更新元素
- 表达集合关系或映射关系
- 支持更复杂的数据组织方式
- 从文件、表格或其他外部数据源构造内存中的数据结构
- 对数据进行统计、分组、索引或保留历史记录
- 通过统一协议支持 `for x in obj`、`len(x)`、`x[a]`、`x[a] = v`、`del x[a]`、`x in obj` 等语法

Python 中常见的内置容器包括：

- `tuple`：元组
- `list`：列表
- `set`：集合
- `dict`：字典

此外，标准库 collections模块 还提供了若干专用容器或容器变体，例如：

- `Counter`：用于计数和汇总
- `defaultdict`：用于带默认值的映射，尤其适合一对多分组
- `deque`：用于双端队列和固定长度历史记录

这些容器与 Python数据类型 密切相关，也构成了 序列、[[concepts/列表推导式]]、CSV文件处理、字典与映射、Python对象模型、Python特殊方法、容器协议 和 Python迭代协议 等主题的基础。

## 主要内置容器类型

### 1. 列表 `list`

列表是有序、可变的容器，适合保存一组需要动态修改的数据。当数据顺序有意义，并且需要追加、删除或替换元素时，通常应选择列表。

常见用途包括：

- 保存一批项目
- 按位置访问元素
- 追加、删除或替换元素
- 配合循环或 [[concepts/列表推导式]] 进行数据转换
- 保存从文件中读取出来的一组记录
- 作为自定义容器内部的底层存储

例如，股票投资组合可以表示为“元组的列表”：

```python
portfolio = [
    ('GOOG', 100, 490.1),
    ('IBM', 50, 91.3),
    ('CAT', 150, 83.44)
]
```

可以通过整数索引访问列表元素：

```python
portfolio[0]    # ('GOOG', 100, 490.1)
portfolio[2]    # ('CAT', 150, 83.44)
```

列表也可以从空列表开始构造，并通过 `.append()` 添加项目：

```python
records = []
records.append(('GOOG', 100, 490.10))
records.append(('IBM', 50, 91.3))
```

在 [[summaries/02_Containers]] 的练习中，`read_portfolio(filename)` 读取 `Data/portfolio.csv`，并把每一行转换为一个持仓记录，再追加到列表中。这体现了列表在 CSV文件处理 和 数据建模 中的常见用法。

### 2. 元组 `tuple`

元组是有序、不可变的容器。它与列表类似，也可以按位置访问元素，但创建后通常不能修改。

常见用途包括：

- 表示固定结构的数据
- 从函数返回多个值
- 用作不可变记录
- 在需要稳定结构时替代列表
- 作为字典中的复合键

例如，一条股票持仓可以用三元组表示：

```python
holding = ('IBM', 50, 91.1)
```

列表中的每个元素也可以是元组，从而形成类似二维表的数据结构：

```python
portfolio[row][column]
```

不过，使用数字列号访问字段有时可读性较差。因此后续常会用字典或对象来表示结构化记录。

元组属于 序列 类型的一种，因此支持索引、切片和迭代等序列操作。它也与 序列解包 密切相关，例如：

```python
for name, shares, price in portfolio:
    total += shares * price
```

这种写法比反复使用 `s[0]`、`s[1]`、`s[2]` 更清晰。

### 3. 字典 `dict`

字典是键值对容器，用于建立 key 到 value 的映射关系。它适合需要通过名称、编号或其他键进行快速随机查找的场景。

常见用途包括：

- 通过名称、编号或其他键快速查找值
- 表示结构化记录
- 统计数据
- 构建查找表或配置对象
- 将外部表格数据转换为可查询的数据结构
- 作为更专门映射容器的基础，例如 `Counter` 和 `defaultdict`

例如，股票价格表可以表示为字典：

```python
prices = {
    'GOOG': 513.25,
    'CAT': 87.22,
    'IBM': 93.37,
    'MSFT': 44.12
}
```

访问时使用键，而不是整数位置：

```python
prices['IBM']
prices['GOOG']
```

在 [[summaries/02_Containers]] 中，`read_prices(filename)` 读取 `Data/prices.csv`，并构造一个“股票代码到当前价格”的字典。这种结构非常适合后续根据投资组合中的股票名快速查找当前价格。

#### 字典查找与默认值

字典可以用 `in` 判断键是否存在：

```python
if key in d:
    # key 存在
else:
    # key 不存在
```

也可以用 `.get()` 在键不存在时提供默认值：

```python
value = d.get(key, default)
```

例如：

```python
prices.get('IBM', 0.0)    # 93.37
prices.get('SCOX', 0.0)   # 0.0
```

这在处理不完整数据时很有用，也与 健壮文件读取 和 数据清洗 有关。标准库中的 `defaultdict` 进一步扩展了这种“默认值”思想：访问不存在的键时，它会自动创建默认值，从而减少显式判断代码。

#### 字典表示结构化记录

除了作为查找表，字典也可以表示一条结构化记录。例如，一条股票持仓可以写成：

```python
holding = {
    'name': 'IBM',
    'shares': 50,
    'price': 91.1
}
```

由多条记录组成的投资组合就可以表示为“字典的列表”：

```python
portfolio = [
    {'name': 'AA', 'shares': 100, 'price': 32.2},
    {'name': 'IBM', 'shares': 50, 'price': 91.1}
]
```

访问字段时使用字段名：

```python
portfolio[1]['shares']
```

这种形式通常比元组列表更易读，因为代码直接表达了字段含义，而不是依赖列号。

#### 复合键与不可变性

Python 字典的键必须是不可变对象。字符串、数字、元组等可以作为键；列表、集合和字典不能作为键，因为它们是可变对象。

元组可用于表示复合键：

```python
holidays = {
    (1, 1): 'New Years',
    (3, 14): 'Pi day',
    (9, 13): "Programmer's day"
}
```

访问时可以写作：

```python
holidays[3, 14]
```

这体现了 可变性与不可变性 对容器设计的重要影响。

### 4. 集合 `set`

集合是无序、不重复元素的容器，主要用于表达数学意义上的集合关系。

常见用途包括：

- 去除重复值
- 判断成员是否存在
- 求并集、交集、差集等集合运算
- 表达唯一元素集合
- 比较两个数据源中的元素差异

集合强调“元素是否存在”，而不是“元素位于哪个位置”。

示例：

```python
tech_stocks = {'IBM', 'AAPL', 'MSFT'}
```

集合非常适合成员测试：

```python
'IBM' in tech_stocks    # True
'FB' in tech_stocks     # False
```

也常用于去重：

```python
names = ['IBM', 'AAPL', 'GOOG', 'IBM', 'GOOG', 'YHOO']
unique = set(names)
```

集合还支持常见集合运算：

```python
s1 = {'a', 'b', 'c'}
s2 = {'c', 'd'}

s1 | s2    # 并集
s1 & s2    # 交集
s1 - s2    # 差集
```

这些操作使集合适合用于比较名称列表、股票代码集合或文件中的唯一记录。

## 容器与迭代协议

[[summaries/01_Iteration_protocol]] 说明了 Python 容器最重要的共同能力之一：可迭代。许多对象都支持迭代，包括字符串、字典、列表、元组、集合和文件对象。

例如：

```python
for c in 'hello':
    ...       # 逐字符迭代

for k in {'name': 'Dave', 'password': 'foo'}:
    ...       # 默认逐键迭代

for i in [1, 2, 3, 4]:
    ...       # 逐元素迭代

for line in open('foo.txt'):
    ...       # 逐行迭代
```

`for` 循环背后依赖 Python迭代协议。语句：

```python
for x in obj:
    # statements
```

大致等价于：

```python
_iter = obj.__iter__()
while True:
    try:
        x = _iter.__next__()
        # statements
    except StopIteration:
        break
```

关键点包括：

- `obj.__iter__()` 返回一个迭代器对象。
- 迭代器通过 `__next__()` 逐个返回元素。
- 当没有更多元素时，`__next__()` 抛出 `StopIteration`。
- `for` 循环自动捕获 `StopIteration` 并结束。
- 内置函数 `next(it)` 是调用 `it.__next__()` 的简写。

因此，可迭代性不是 `for` 循环的表面特性，而是容器接口的重要组成部分。一个对象只要实现合适的 `__iter__()`，就可以参与 `for` 循环和许多依赖迭代的 Python 工具。

文件对象也是迭代协议的典型例子。对文件调用 `next(f)` 会读取下一行；读到文件末尾时抛出 `StopIteration`。这说明“容器式”行为并不局限于内存中的列表或字典，也可以用于流式数据源。

## 容器协议与特殊方法

[[summaries/03_Special_methods]] 从 Python 数据模型的角度说明：容器操作本质上会调用对象上的特殊方法。也就是说，`len(x)`、`x[a]`、`x[a] = v`、`del x[a]`、`x in obj` 并不是只适用于内置容器的语法糖；只要一个类实现了相应的特殊方法，它就可以表现得像容器。

常见容器操作与特殊方法的对应关系是：

```python
iter(x)     x.__iter__()
next(it)    it.__next__()
len(x)      x.__len__()
x[a]        x.__getitem__(a)
x[a] = v    x.__setitem__(a, v)
del x[a]    x.__delitem__(a)
y in x      x.__contains__(y)  # 如果定义了该方法
```

一个自定义容器类通常会实现类似结构：

```python
class Sequence:
    def __iter__(self):
        ...

    def __len__(self):
        ...

    def __getitem__(self, a):
        ...

    def __setitem__(self, a, v):
        ...

    def __delitem__(self, a):
        ...

    def __contains__(self, item):
        ...
```

这体现了 Python 的协议式设计：对象不一定要继承某个特定的容器基类，只要实现约定的特殊方法，就可以参与相应语法。这一思想与 Python协议、Python特殊方法、Python数据模型 和 容器协议 密切相关。

从使用者角度看，容器协议带来的好处是统一性：

- 不同容器都可以用 `for` 遍历。
- 不同容器都可以使用 `len()` 获取长度。
- 序列、映射或自定义容器都可以使用 `[]` 访问元素。
- 可变容器可以通过 `x[a] = v` 修改元素。
- 可变容器可以通过 `del x[a]` 删除元素。
- 容器可以通过 `in` 表达成员测试。

从设计者角度看，容器协议使类能够自然融入 Python 语言。例如，一个类如果表示某种记录集合、表格、缓存、队列、索引结构或业务对象集合，就可以通过实现这些特殊方法来提供熟悉的容器接口。

## 自定义容器：`Portfolio` 示例

[[summaries/01_Iteration_protocol]] 使用 `Portfolio` 展示了如何把一个普通列表封装成更高级的业务容器。最初，投资组合可能只是 `Stock` 对象的列表：

```python
portfolio = [Stock('AA', 100, 32.2), Stock('IBM', 50, 91.1)]
```

后来可以引入一个 `Portfolio` 类，在内部保存这个列表，并添加业务方法：

```python
class Portfolio:
    def __init__(self, holdings):
        self._holdings = holdings

    @property
    def total_cost(self):
        return sum([s.shares * s.price for s in self._holdings])

    def tabulate_shares(self):
        from collections import Counter
        total_shares = Counter()
        for s in self._holdings:
            total_shares[s.name] += s.shares
        return total_shares
```

这样做体现了 对象封装：内部仍然使用列表，但对外暴露的是更符合业务语义的对象，例如 `portfolio.total_cost`。

不过，如果原有程序依赖：

```python
for s in portfolio:
    ...
```

那么 `Portfolio` 必须支持迭代。修复方式是实现 `__iter__()`，并把迭代委托给内部列表：

```python
class Portfolio:
    def __init__(self, holdings):
        self._holdings = holdings

    def __iter__(self):
        return self._holdings.__iter__()
```

这样，`Portfolio` 实例就可以像普通列表一样用于 `for` 循环，但同时又保留了封装和业务方法。

更完整的容器还可以实现：

```python
class Portfolio:
    def __init__(self, holdings):
        self._holdings = holdings

    def __iter__(self):
        return self._holdings.__iter__()

    def __len__(self):
        return len(self._holdings)

    def __getitem__(self, index):
        return self._holdings[index]

    def __contains__(self, name):
        return any([s.name == name for s in self._holdings])

    @property
    def total_cost(self):
        return sum([s.shares * s.price for s in self._holdings])
```

此时可以使用标准容器语法：

```python
len(portfolio)
portfolio[0]
portfolio[0:3]
'IBM' in portfolio
```

这个例子说明：自定义容器不只是“包一层列表”，而是通过协议决定它如何参与 Python 语言。一个容器越能使用 Python 的通用词汇，例如迭代、索引、切片、长度和成员测试，就越符合 Pythonic设计。

## 容器与对象表示

容器经常在交互式环境、日志和调试输出中被直接打印或查看。此时，容器中元素的表示方式会显著影响可读性。

[[summaries/03_Special_methods]] 中的 `Stock` 示例要求为对象实现更有用的 `__repr__()`：

```python
>>> goog = Stock('GOOG', 100, 490.1)
>>> goog
Stock('GOOG', 100, 490.1)
```

当多个 `Stock` 对象被放入列表后，查看整个列表时，列表会使用每个元素的 `repr()` 表示。因此，如果对象的 `__repr__()` 写得清晰，那么包含这些对象的容器也会更容易检查和调试。

这说明容器和 对象表示 之间存在实际联系：

- 容器负责组织多个对象。
- 元素对象的 `__repr__()` 决定容器显示时的可读性。
- 好的对象表示能改善列表、字典、集合和自定义容器的调试体验。

这一点在数据处理程序中很重要，因为投资组合、记录列表、查找表等结构经常需要在交互式解释器中直接查看。

## 容器与动态属性访问

容器既可以保存元组或字典，也可以保存普通对象。例如投资组合可以是 `Stock` 对象的列表，或者是一个封装了 `Stock` 对象列表的 `Portfolio` 容器。此时，如果想根据用户指定的字段名输出表格，就需要动态读取对象属性。

[[summaries/03_Special_methods]] 介绍了 `getattr()`：

```python
getattr(obj, 'name')          # 等同于 obj.name
setattr(obj, 'name', value)   # 等同于 obj.name = value
delattr(obj, 'name')          # 等同于 del obj.name
hasattr(obj, 'name')          # 判断属性是否存在
```

这使容器中的对象可以被通用代码处理。例如：

```python
columns = ['name', 'shares']
for colname in columns:
    print(colname, '=', getattr(s, colname))
```

在练习中，这个思想被扩展为 `print_table()`：它接收一组对象、用户指定的属性名列表，以及一个 `TableFormatter`，然后打印表格。这与 [[concepts/动态属性访问]]、表格格式化 和 对象属性驱动设计 有关。

因此，容器不仅能保存基础数据结构，也能保存对象；而 `getattr()` 等机制让“对象列表”可以像“记录表”一样被通用处理。

## `collections` 模块中的专用容器

内置容器已经能够解决大量问题，但某些常见数据处理任务如果只用普通 `dict` 或 `list`，代码会显得重复或不够直接。[[summaries/05_Collections]] 介绍的 collections模块 正是为这些专门场景提供更合适的容器。

### 1. `Counter`：计数和汇总

`Counter` 是一种专门用于计数的映射容器。它很适合统计某个键出现的次数，或把同一键对应的数值累加起来。

例如，投资组合中同一只股票可能出现多次：

```python
from collections import Counter

total_shares = Counter()
for name, shares, price in portfolio:
    total_shares[name] += shares
```

这样，重复出现的 `IBM`、`GOOG` 等股票会自动被合并到同一个统计项中：

```python
total_shares['IBM']     # 150
```

`Counter` 可以像字典一样通过键访问值，也提供了适合统计分析的方法，例如：

```python
holdings.most_common(3)
```

它还支持多个计数器相加：

```python
combined = holdings + holdings2
```

相同键的计数会被自动累加。这使 `Counter` 特别适合 [[concepts/数据计数与汇总]]、排名、频率分析以及多个数据源的统计合并。

在 `Portfolio.tabulate_shares()` 中使用 `Counter`，正是把专用容器嵌入自定义业务容器的例子。

### 2. `defaultdict`：一对多映射和自动默认值

`defaultdict` 是字典的一种变体。它在访问不存在的键时会自动创建默认值，因此非常适合“一个键对应多个值”的场景。

例如，要把股票名称映射到该股票的所有持仓记录，可以写成：

```python
from collections import defaultdict

holdings = defaultdict(list)
for name, shares, price in portfolio:
    holdings[name].append((shares, price))
```

如果用普通字典实现，通常需要先判断键是否存在，再决定是否创建空列表；而 `defaultdict(list)` 自动完成这一步。

这类容器适合：

- 数据分组
- 建立索引
- 一对多映射
- 按类别聚合记录
- 从表格数据构造查找结构

它与 字典与映射、数据分组 和 CSV文件处理 的关系非常密切。

### 3. `deque`：队列和有限历史记录

`deque` 是双端队列，适合高效地在两端添加或删除元素。[[summaries/05_Collections]] 中强调了它的一个典型用法：保存最近 N 个对象。

例如，处理文件时保存最近 N 行：

```python
from collections import deque

history = deque(maxlen=N)
with open(filename) as f:
    for line in f:
        history.append(line)
        ...
```

当设置 `maxlen=N` 后，`deque` 会自动保持固定长度。新元素加入且超过最大长度时，最旧的元素会被自动丢弃。

这种容器适合：

- 最近历史记录
- 滑动窗口
- 日志尾部追踪
- 流式数据处理
- 队列类算法

它扩展了普通列表在队列场景中的表达能力，也与 序列与队列 和 滑动窗口 相关。

## 容器与数据处理

在 [[summaries/00_Overview]] 所概述的章节结构中，容器位于 Python 数据处理主题的早期部分。这说明容器是进一步理解以下内容的基础：

- Python数据类型：容器本身也是数据类型。
- 序列：列表、元组和字符串等都具有序列行为。
- 格式化输出：容器中的数据常需要被转换为可读文本。
- collections模块：标准库提供了更多专用容器，扩展内置容器能力。
- [[concepts/列表推导式]]：列表等容器常通过推导式进行构造和转换。
- CSV文件处理：文件中的行和列经常被读入列表、元组、字典或对象列表。
- [[concepts/异常处理]]：读取真实数据时需要处理空行、缺失字段和转换错误。
- Python对象模型：理解容器需要进一步理解对象、引用、可变性等底层机制。
- Python特殊方法：容器语法背后由特殊方法驱动。
- Python迭代协议：`for` 循环和许多数据处理模式都依赖迭代。
- [[concepts/动态属性访问]]：对象容器可以通过属性名动态读取字段。

[[summaries/02_Containers]] 的股票投资组合示例展示了容器组合使用的典型模式：

- 用列表保存多条持仓记录。
- 用元组或字典表示每条持仓。
- 用字典保存当前价格查找表。
- 用集合进行成员测试、去重或比较。

[[summaries/05_Collections]] 则进一步展示了专用容器在类似数据上的增强用法：

- 用 `Counter` 汇总每只股票的总股数。
- 用 `defaultdict(list)` 把股票名映射到多条持仓记录。
- 用 `deque(maxlen=N)` 保存最近 N 条记录。

[[summaries/01_Iteration_protocol]] 和 [[summaries/03_Special_methods]] 则说明了容器行为的语言机制：

- `for x in obj` 调用 `obj.__iter__()`，并反复调用迭代器的 `__next__()`。
- `len(x)` 调用 `x.__len__()`。
- `x[a]` 调用 `x.__getitem__(a)`。
- `x[a] = v` 调用 `x.__setitem__(a)`。
- `del x[a]` 调用 `x.__delitem__(a)`。
- `x in obj` 可由 `obj.__contains__(x)` 支持。

这种组合比单独使用某一种容器更接近真实程序的数据组织方式：实际程序既会选择合适的数据结构，也会依赖 Python 的统一协议让不同结构拥有一致的使用体验。

## 容器组合模式

Python 程序经常把容器嵌套或封装使用，以表达更复杂的数据结构。

### 元组列表

“元组的列表”适合表示简单表格：

```python
portfolio = [
    ('AA', 100, 32.2),
    ('IBM', 50, 91.1)
]
```

优点是结构紧凑；缺点是字段含义依赖位置。

### 字典列表

“字典的列表”适合表示多条结构化记录：

```python
portfolio = [
    {'name': 'AA', 'shares': 100, 'price': 32.2},
    {'name': 'IBM', 'shares': 50, 'price': 91.1}
]
```

优点是字段名清晰，代码可读性更好。

### 对象列表

当记录具有行为或需要封装逻辑时，也可以使用“对象的列表”：

```python
portfolio = [
    Stock('AA', 100, 32.2),
    Stock('IBM', 50, 91.1)
]
```

这种结构与面向对象设计更接近。若 `Stock` 实现了清晰的 `__repr__()`，查看整个列表时会得到更有用的输出；若配合 `getattr()`，还可以根据字段名动态生成表格。这连接了 Python对象模型、对象表示 和 [[concepts/动态属性访问]]。

### 封装列表的业务容器

当对象列表本身具有业务意义时，可以把它封装成自定义容器。例如 `Portfolio` 内部保存 `Stock` 列表，但对外提供：

- `total_cost`：计算总成本
- `tabulate_shares()`：汇总每只股票股数
- `__iter__()`：支持遍历
- `__len__()`：支持长度
- `__getitem__()`：支持索引和切片
- `__contains__()`：支持成员测试

这种模式比直接暴露列表更清晰，因为它把业务逻辑集中在容器对象中，同时仍然保留 Python 容器的通用用法。

### 查找字典

“键到值的字典”适合快速查询：

```python
prices = {
    'IBM': 106.28,
    'MSFT': 20.89
}
```

在计算投资组合盈亏时，可以遍历持仓列表，并用股票名在价格字典中查找当前价格。

### 计数字典

当字典的值表示数量累计时，可以使用普通 `dict`，但 `Counter` 通常更直接：

```python
from collections import Counter

holdings = Counter()
for s in portfolio:
    holdings[s.name] += s.shares
```

这种模式适合把多条记录汇总为每个键的总量。

### 一对多映射

当一个键对应多个记录时，可以使用 `defaultdict(list)`：

```python
from collections import defaultdict

by_name = defaultdict(list)
for name, shares, price in portfolio:
    by_name[name].append((shares, price))
```

这种结构适合分组和索引，比手动维护“键是否存在”的逻辑更简洁。

### 固定长度历史队列

当只关心最近 N 个元素时，可以使用 `deque(maxlen=N)`：

```python
from collections import deque

history = deque(maxlen=10)
history.append('new event')
```

它会自动丢弃过旧的数据，适合流式处理和日志类程序。

### 自定义容器

当内置容器和 `collections` 中的工具不足以表达某种数据结构时，可以编写自定义类，并通过容器协议让它支持标准操作。例如，一个自定义表格、缓存、稀疏数组、记录集合或业务对象集合，可以根据需要实现：

- `__iter__()`：定义遍历方式。
- `__len__()`：定义长度。
- `__getitem__()`：定义索引、切片或键访问。
- `__setitem__()`：定义元素更新。
- `__delitem__()`：定义元素删除。
- `__contains__()`：定义成员测试。

这样，用户就能用熟悉的语法操作它：

```python
for record in records:
    ...

len(records)
records[0]
records['IBM'] = value
del records['OLD']
'IBM' in records
```

这说明“容器”既是数据结构选择问题，也是接口设计问题。

## 选择容器的基本思路

选择哪种容器，通常取决于数据的组织方式和操作需求：

- 需要有序并且可修改：使用 `list`
- 需要有序但固定不变：使用 `tuple`
- 需要唯一元素和集合运算：使用 `set`
- 需要键值映射和快速查找：使用 `dict`
- 需要表示一条固定字段记录：可使用 `tuple`
- 需要更可读的结构化记录：可使用 `dict`
- 需要记录同时具有数据和行为：可使用对象，并把多个对象放入 `list`
- 需要保存多条记录：常使用 `list` 包裹元组、字典或对象
- 需要把名称映射到数值：常使用 `dict`
- 需要统计每个键的数量或总量：使用 `Counter`
- 需要一个键对应多个值：使用 `defaultdict(list)`
- 需要自动创建默认值：使用 `defaultdict`
- 需要保存最近 N 个元素：使用 `deque(maxlen=N)`
- 需要封装业务逻辑但保留容器行为：编写自定义容器并实现迭代、长度、索引和成员测试
- 需要自定义容器语法：实现 `__iter__()`、`__len__()`、`__getitem__()`、`__contains__()` 等特殊方法

这种选择体现了 Python 编程中的一个重要思想：根据数据关系和操作需求选择合适的数据结构；当已有结构不足时，通过协议和特殊方法让自定义对象融入语言本身。

## 与对象模型的关系

Python 中的容器并不是简单的“值盒子”，而是对象。容器保存的是对象引用，这一点与 Python对象模型 密切相关。

因此，在使用容器时需要理解：

- 容器本身可以是可变或不可变对象。
- 容器内部元素也是对象。
- 多个变量可能引用同一个容器。
- 修改可变容器可能影响所有引用它的位置。
- 字典键必须满足不可变性要求。
- 嵌套容器会让引用关系更加复杂。
- 专用容器虽然行为更高层，但仍遵循 Python 对象和引用模型。
- 自定义容器通过特殊方法接入 Python 的容器语法。
- 容器中的对象如果定义了合适的 `__repr__()`，整体显示和调试体验会更好。
- 容器的可迭代性由 `__iter__()` 和迭代器的 `__next__()` 支持。

这些概念对理解 Python 程序的行为非常重要，尤其是在处理列表、字典、`defaultdict`、`Counter`、对象列表和自定义容器时。

## Pythonic 容器设计

[[summaries/01_Iteration_protocol]] 强调了一个重要观察：代码如果“说的是 Python 其他部分通用的语言”，通常会更 Pythonic。对于容器对象来说，这意味着不要只提供专用方法，而要尽量支持用户熟悉的操作。

一个设计良好的容器通常应该考虑：

- 能否被 `for` 循环遍历？
- 能否用 `len()` 获取大小？
- 能否用 `[]` 访问元素？
- 是否应该支持切片？
- 是否应该支持 `in` 成员测试？
- 是否需要支持元素更新或删除？
- 是否应该隐藏内部实现，同时保留自然的容器接口？

例如，`Portfolio` 可以隐藏 `_holdings` 内部列表，但通过 `__iter__()`、`__len__()`、`__getitem__()` 和 `__contains__()` 提供熟悉的容器行为。这样，调用者不需要知道内部到底是列表、元组还是其他数据结构，只需要按照 Python 容器的通用方式使用它。

这体现了 Python 容器设计的核心：协议比具体类型更重要。一个对象只要遵守相应协议，就能自然地参与 Python 的语言结构和工具生态。

## 小结

Python 容器是处理数据的基础工具。它们帮助程序组织多个对象，并通过不同结构表达不同的数据关系：列表表达有序集合，元组表达固定结构，集合表达唯一成员，字典表达键值映射。[[summaries/02_Containers]] 通过股票投资组合、价格表和盈亏计算示例说明，实际程序往往会组合使用多种容器来完成数据读取、查询和计算。

[[summaries/05_Collections]] 在此基础上补充了标准库中的专用容器：`Counter` 用于计数和汇总，`defaultdict` 用于分组和一对多映射，`deque` 用于队列和有限历史记录。[[summaries/03_Special_methods]] 揭示了容器语法背后的机制：`len()`、索引、赋值和删除操作都通过特殊方法实现。[[summaries/01_Iteration_protocol]] 进一步说明，`for` 循环依赖 `__iter__()`、`__next__()` 和 `StopIteration`，因此迭代是容器行为的核心部分之一。

理解这些容器及其适用场景，是继续学习 序列、collections模块、[[concepts/列表推导式]]、CSV文件处理、字典与映射、Python对象模型、Python特殊方法、容器协议 和 Python迭代协议 的前提。

See also: [[summaries/01_Datatypes]], [[summaries/02_Containers]], [[summaries/03_Formatting]], [[summaries/05_Collections]], [[summaries/06_List_comprehension]], [[summaries/03_Special_methods]], [[summaries/01_Iteration_protocol]]

See also: [[summaries/02_Customizing_iteration]]

See also: [[summaries/04_More_generators]]

See also: [[summaries/02_Working_with_data__00_Overview]]

See also: [[summaries/06_Generators__00_Overview]]

See also: [[summaries/07_Objects]]