---
sources: [summaries/07_Objects.md, summaries/01_Introduction__00_Overview.md, summaries/02_Logging.md, summaries/05_Decorated_methods.md, summaries/01_Variable_arguments.md, summaries/03_Producers_consumers.md, summaries/02_Customizing_iteration.md, summaries/01_Class.md, summaries/06_Design_discussion.md, summaries/04_Modules.md, summaries/03_Error_checking.md, summaries/02_More_functions.md, summaries/01_Script.md, summaries/05_Collections.md, summaries/04_Sequences.md, summaries/03_Formatting.md, summaries/02_Containers.md, summaries/01_Datatypes.md, summaries/07_Functions.md, summaries/06_Files.md, summaries/05_Lists.md, summaries/00_Overview.md]
brief: CSV 数据处理是把文本表格解析、转换并组织为可计算结构的过程。
---

# CSV 数据处理

CSV 数据处理是指使用程序读取、解析、清洗、转换、组织和计算 CSV（Comma-Separated Values，逗号分隔值）或类似分隔文本文件中的表格型数据。它通常是学习 Python 入门后接触的第一个实际数据任务，因为它能把文件处理、[[concepts/字符串处理]]、列表、元组、字典、集合、数据类型、[[concepts/函数]]、[[concepts/异常处理]]、Python 标准库、可迭代对象、一等对象、可变性与引用 和 Python 面向对象编程自然地结合起来。

在标准 Python 学习路径中，CSV 数据处理的重点不仅是“把文件读出来”，还包括理解文本文件如何被读取、每一行如何被解析为字段、字段如何转换为可计算的数据、如何把一行数据组织成元组、字典或对象、如何把多行数据放入列表、字典、集合或自定义容器、坏数据如何处理，以及程序如何从一次性脚本逐步演变为可复用、可测试、可配置、可从命令行运行的小工具。

[[summaries/07_Objects]] 为 CSV 数据处理补充了一个关键视角：Python 中变量只是名字，赋值不会复制对象，只会复制引用；函数、类型、模块、异常和普通数据一样都是对象。这解释了为什么可以把 `str`、`int`、`float` 放入列表，再用 `zip(types, row)` 批量转换 CSV 字段；也提醒我们，在处理行列表、记录字典和嵌套容器时，要注意共享可变对象可能带来的副作用。

## 在 Python 入门中的位置

在 [[summaries/00_Overview]] 中，CSV 数据处理被作为“Introduction to Python”章节的最终实践目标：学习者从零开始掌握如何编辑、运行和调试小程序，最终编写一个短脚本，读取 CSV 数据文件并执行简单计算。

[[summaries/06_Files]] 通过 `Data/portfolio.csv` 文件把这个目标具体化：打开文件、逐行读取、跳过表头、拆分字段、转换数字类型，并计算股票投资组合的总成本。

[[summaries/07_Functions]] 在此基础上要求把 `pcost.py` 脚本改造成 `portfolio_cost(filename)` 函数，加入异常处理以跳过坏数据行，使用标准库 `csv` 模块替代手动字符串拆分，并通过 `sys.argv` 从命令行接收输入文件名。

[[summaries/01_Datatypes]] 说明，从 CSV 读出的原始行只是字符串列表，例如 `['AA', '100', '32.20']`，要想计算和后续处理，通常需要把它转换为更有语义的数据对象，例如表示单条记录的元组，或带有字段名、可修改的字典。

[[summaries/02_Containers]] 把 CSV 数据处理推进到“数据组织”的层面：读取文件不只是逐行计算，还可以把整个投资组合读成“元组列表”或“字典列表”，把价格文件读成以股票代码为键的价格字典，并进一步组合这些结构来计算投资组合当前市值和盈亏。

[[summaries/04_Sequences]] 补充了处理 CSV 时非常重要的迭代和配对技巧：直接遍历序列、使用 `enumerate()` 记录行号、用元组解包处理结构化记录，以及用 `zip(headers, row)` 把表头和值配对成字典。

[[summaries/07_Objects]] 进一步解释了这些技巧为什么可行：Python 中一切皆对象，因此类型转换函数本身也可以作为数据保存到列表中，并在循环或推导式中调用。这让 CSV 字段转换可以从手写的 `int(row[1])`、`float(row[2])`，演变为更通用的 `func(val)` 模式。

[[summaries/02_More_functions]] 把 CSV 处理提升到“可复用库函数”的层面：它通过 `fileparse.py` 中的 `parse_csv()` 展示如何用函数参数、默认值、关键字参数和可选配置，把读取 CSV、选择列、类型转换、处理无表头文件、选择分隔符等重复逻辑封装成一个通用解析函数。

[[summaries/03_Error_checking]] 进一步补充通用 CSV 函数最容易被忽略的一面：错误检查与异常处理。对于语义上自相矛盾的参数组合，例如 `select` 需要表头而调用者却指定 `has_headers=False`，应主动抛出异常。对于真实文件中的缺失值、脏数据和转换失败，应捕获合适的异常、报告行号和原因，并允许调用者显式选择是否静默错误。

[[summaries/06_Design_discussion]] 继续推进 `parse_csv()` 的接口设计：它要求把函数从“接收文件名并在内部打开文件”改造成“接收任意文件类对象或可迭代行对象”。这样，同一个 CSV 解析函数不仅可以处理普通文件，还可以处理 gzip 压缩文件、标准输入、字符串列表或其他逐行产生文本的对象。

[[summaries/03_Producers_consumers]] 则把“可迭代行对象”这一思想进一步发展成流式管道：`follow()` 可以持续产生日志行，`csv.reader()` 可以消费这些行并产生字段列表，后续生成器可以选择列、转换类型、构造字典、过滤股票代码，最终由打印循环或格式化输出函数消费结果。

[[summaries/05_Decorated_methods]] 补充了面向对象层面的设计改进：当 CSV 文件用于构造某个类的实例时，可以把读取逻辑设计为类方法，例如 `Portfolio.from_csv(lines, **opts)`。这比让 `report.py` 之类的外部脚本同时负责解析 CSV、创建 `Stock`、构造 `Portfolio` 更清晰。

## 基本流程

一个典型的 CSV 数据处理脚本通常包含以下步骤：

1. **获得输入源**：可以是文件名、已打开的文件对象、gzip 文件、标准输入、字符串列表，或持续产生文本行的生成器。
2. **打开文件或接收行对象**：早期函数常接收文件名并在内部 `open()`；更通用的库函数可以接收任意可迭代的行对象。
3. **读取文件内容**：可以一次性读取整个文件，也可以逐行读取；对大文件或实时数据，通常应逐行处理。
4. **处理表头**：如果第一行是列名，通常需要单独读取、跳过，或用于构造字段名字典。
5. **解析行数据**：将每一行字符串拆分成字段，或使用 `csv.reader()` 解析。
6. **跳过无效行**：例如空行可以用 `if not row: continue` 跳过。
7. **清洗与转换**：去除换行符或多余空白，并将需要计算的字段从字符串转换为数字。
8. **组织为数据结构**：把原始字段列表转换为元组、字典、自定义类实例或其他更适合后续处理的对象。
9. **选择外层容器或流式输出**：可以用列表保存所有记录，也可以用生成器逐条产出记录，避免一次性保存全部数据。
10. **处理异常数据**：遇到缺失字段、非法数字、空行等问题时，打印警告、跳过坏行或采取其他策略。
11. **检查无意义配置**：例如不允许在 `has_headers=False` 时使用 `select` 按列名选择字段。
12. **执行计算或过滤**：例如求和、平均值、计数、筛选、查找、去重或简单统计。
13. **输出结果或构造对象**：将计算结果打印到屏幕、写入新文件、作为管道的最终消费阶段，或返回一个封装好的业务对象。

例如，`portfolio.csv` 中的每行数据表示一个股票持仓：股票名、股数和买入价格。处理时需要把 `shares` 字段转换为 `int`，把 `price` 字段转换为 `float`，再计算每行成本：

```python
cost = shares * price
```

所有行的成本累加后，就能得到整个投资组合的购买总成本。如果再读取 `prices.csv`，把当前价格保存到字典中，还能计算当前市值和盈亏。

## CSV 行本质上是序列，也是对象引用的集合

CSV 文件中的一行经过 `csv.reader()` 解析后，通常会变成一个列表：

```python
['AA', '100', '32.20']
```

列表是 Python 的一种序列，因此它具有顺序、索引和长度：

```python
row[0]      # 'AA'
row[1]      # '100'
row[2]      # '32.20'
len(row)    # 3
```

这说明 CSV 数据处理天然依赖 Python 序列：文件本身可以逐行迭代，每一行解析后是字段序列，多行记录可以保存为列表，每条记录也可以表示为元组、字典或对象。

不过，[[summaries/07_Objects]] 提醒我们：列表、字典等容器保存的是对象引用。赋值不会复制列表或字典本身，只会让另一个名字指向同一个对象：

```python
row = ['AA', '100', '32.20']
other = row
other[1] = '200'
print(row)     # ['AA', '200', '32.20']
```

在 CSV 处理中，这意味着如果多个变量或多个容器元素引用同一个可变记录，修改其中一个地方会影响所有引用。通常，逐行解析时每一行都是新列表，问题不明显；但如果人为复用同一个列表或字典来保存多条记录，就可能产生严重错误。

例如，下面这种写法是错误模式：

```python
record = {}
records = []
for row in rows:
    record['name'] = row[0]
    record['shares'] = int(row[1])
    record['price'] = float(row[2])
    records.append(record)      # 每次追加的是同一个字典对象
```

最终 `records` 中的多个元素可能都指向同一个字典。正确做法是每行创建一个新的记录对象：

```python
records = []
for row in rows:
    record = {
        'name': row[0],
        'shares': int(row[1]),
        'price': float(row[2])
    }
    records.append(record)
```

这体现了 Python对象模型、可变性与引用 在数据处理中的实际重要性。

## 从原始行到可计算对象

使用 `csv.reader()` 读取 CSV 文件时，每一行通常会得到一个字符串列表：

```python
import csv

f = open('Data/portfolio.csv')
rows = csv.reader(f)
headers = next(rows)
row = next(rows)
```

此时 `row` 可能是：

```python
['AA', '100', '32.20']
```

虽然第二、第三个字段看起来像数字，但它们仍然是字符串。直接计算会失败：

```python
cost = row[1] * row[2]
# TypeError: can't multiply sequence by non-int of type 'str'
```

因此，CSV 处理的核心步骤之一是解释原始文本，把字段转换成真正的数据类型：

```python
name = row[0]
shares = int(row[1])
price = float(row[2])
```

这一步体现了数据类型在数据处理中的重要性：外部文件中的内容通常先以文本形式进入程序，只有经过解析和类型转换，才能参与数学运算、比较、排序或统计。

## 一等对象与类型转换函数列表

[[summaries/07_Objects]] 中的练习展示了 CSV 转换的一种更通用写法：把转换函数本身放入列表。

```python
types = [str, int, float]
row = ['AA', '100', '32.20']
```

这里的 `str`、`int`、`float` 不是特殊语法，而是普通对象；更准确地说，它们是可以被调用的类型对象。因此可以像调用普通函数一样调用它们：

```python
types[1](row[1])      # int('100') -> 100
types[2](row[2])      # float('32.20') -> 32.2
```

再配合 `zip()`，可以把每个字段和对应转换函数配对：

```python
list(zip(types, row))
# [(str, 'AA'), (int, '100'), (float, '32.20')]
```

然后统一转换：

```python
converted = []
for func, val in zip(types, row):
    converted.append(func(val))
```

或写成列表推导式：

```python
converted = [func(val) for func, val in zip(types, row)]
# ['AA', 100, 32.2]
```

这是一种非常重要的 CSV 数据处理模式：把“每一列如何转换”的规则数据化。转换规则可以是内置类型，也可以是自定义函数。例如，要把日期字符串解析为元组，可以写：

```python
def parse_date(s):
    return tuple(map(int, s.split('/')))

types = [str, float, parse_date]
```

这种写法连接了 一等对象、[[concepts/函数]]、[[concepts/列表推导式]] 和数据清洗。

## 使用表头和 zip() 构造字段字典

CSV 文件的第一行通常包含表头：

```python
headers = ['name', 'shares', 'price']
```

某一行数据可能是：

```python
row = ['AA', '100', '32.20']
```

`zip()` 可以把两个序列按位置配对：

```python
list(zip(headers, row))
# [('name', 'AA'), ('shares', '100'), ('price', '32.20')]
```

再传给 `dict()`，就可以得到一条以字段名访问的记录：

```python
record = dict(zip(headers, row))
# {'name': 'AA', 'shares': '100', 'price': '32.20'}
```

如果同时有表头、转换函数和原始字段，可以一步生成带正确类型的字典：

```python
record = {
    name: func(val)
    for name, func, val in zip(headers, types, row)
}
# {'name': 'AA', 'shares': 100, 'price': 32.2}
```

这是 CSV 数据处理中非常重要的技巧。它把“列号驱动”的代码改造成“字段名驱动”的代码。只要 CSV 文件中存在这些列，即使列顺序改变，或者文件额外增加字段，代码也更容易维护。

需要注意，`zip()` 会在最短输入序列耗尽时停止。如果某行字段数量少于表头数量，缺失字段不会自动出现；如果某行字段数量多于表头数量，多余字段也不会进入字典。因此，在处理不可靠数据时，仍然需要额外的数据校验或异常处理。

## 使用列表、元组和字典组织记录

CSV 文件天然是多行记录的集合。读取并转换每一行后，经常需要把所有记录保存在一个列表中：

```python
records = []

with open('Data/portfolio.csv', 'rt') as f:
    rows = csv.reader(f)
    headers = next(rows)
    for row in rows:
        records.append((row[0], int(row[1]), float(row[2])))
```

一种简单方式是把转换后的字段打包成元组：

```python
t = (row[0], int(row[1]), float(row[2]))
```

元组适合表示固定结构的简单记录。元组也支持打包和解包：

```python
name, shares, price = t
cost = shares * price
```

另一种方式是把 CSV 行转换为字典：

```python
d = {
    'name': row[0],
    'shares': int(row[1]),
    'price': float(row[2])
}
```

这样计算成本时不再依赖数字索引，而是使用字段名：

```python
cost = d['shares'] * d['price']
```

字典版本更具可读性，尤其当字段数量增加时更明显。投资组合可以表示为“字典列表”：

```python
portfolio = [
    {'name': 'AA', 'shares': 100, 'price': 32.2},
    {'name': 'IBM', 'shares': 50, 'price': 91.1},
    {'name': 'CAT', 'shares': 150, 'price': 83.44}
]
```

## 浅拷贝、深拷贝与记录共享风险

在 CSV 数据处理中，经常会复制列表或字典。例如：

```python
records2 = list(records)
```

这只会创建一个新的外层列表，但列表中的记录对象仍然共享。如果 `records` 中的元素是字典，那么修改某条记录会影响两个列表中引用到的同一个字典：

```python
records2 = list(records)
records2[0]['shares'] = 200
print(records[0]['shares'])   # 也变成 200
```

这就是 拷贝语义 中的浅拷贝问题。对于简单的元组记录，通常风险较小，因为元组不可变；但对于字典、列表或嵌套结构，浅拷贝会共享内部对象。

如果确实需要完全独立的嵌套数据副本，可以使用 `copy.deepcopy()`：

```python
import copy
records2 = copy.deepcopy(records)
```

不过，深拷贝也可能带来额外开销。更常见的做法是明确数据所有权，避免不必要的共享，或在需要修改时为每条记录创建新字典。

## 使用 csv 标准库

Python 标准库提供了专门处理 CSV 的 `csv` 模块。相比手动字符串拆分，`csv.reader()` 能处理更多底层细节，例如引号、正确的逗号拆分，以及去除字段外层引号。

基本用法如下：

```python
import csv

with open('Data/portfolio.csv') as f:
    rows = csv.reader(f)
    headers = next(rows)
    for row in rows:
        print(row)
```

更完整的成本计算函数可以写成：

```python
import csv


def portfolio_cost(filename):
    total_cost = 0.0
    with open(filename, 'rt') as f:
        rows = csv.reader(f)
        headers = next(rows)
        for row in rows:
            shares = int(row[1])
            price = float(row[2])
            total_cost += shares * price
    return total_cost
```

`csv.reader()` 本身也体现了文件类对象思想：它并不要求输入必须是某个特定文件类型，而是要求输入对象能够产生文本行。它可以消费普通文件对象，也可以消费 `follow()` 这样的生成器输出。因此它既能用于一次性文件解析，也能自然接入生成器管道。

## 从专用读取函数到通用 parse_csv()

早期 CSV 程序通常会分别写出专用函数，例如：

```python
def read_portfolio(filename):
    ...

def read_prices(filename):
    ...
```

这些函数有明确用途，但它们往往包含大量重复的底层细节：打开文件、创建 `csv.reader()`、跳过表头、跳过空行、把字段转换为类型、构造字典或元组等。

[[summaries/02_More_functions]] 的核心练习是把这些重复逻辑抽象成 `fileparse.py` 中的通用函数 `parse_csv()`。最初版本可以把带表头的 CSV 文件读成字典列表：

```python
import csv


def parse_csv(lines):
    rows = csv.reader(lines)
    headers = next(rows)
    records = []
    for row in rows:
        if not row:
            continue
        records.append(dict(zip(headers, row)))
    return records
```

如果进一步加入列选择、类型转换、无表头、自定义分隔符、语义检查、错误报告和文件类对象接口，`parse_csv()` 就会成为一个小型通用库函数：

```python
def parse_csv(lines, select=None, types=None, has_headers=True,
              delimiter=',', silence_errors=False):
    ...
```

其中 `types` 参数正是 [[summaries/07_Objects]] 中“一等对象”思想的实际应用：类型和函数可以作为普通数据传入，再由解析函数调用。

## 文件名接口 vs 可迭代行对象接口

CSV 解析函数有两种常见接口设计。

第一种是接收文件名，在函数内部打开文件：

```python
def parse_csv(filename, types=None):
    with open(filename) as f:
        rows = csv.reader(f)
        ...
```

这种写法简单，适合早期脚本，但函数被限制在“可以用 `open()` 打开的文件名”上。

第二种是接收已经打开或已经准备好的行对象：

```python
def parse_csv(lines, types=None):
    rows = csv.reader(lines)
    ...
```

调用者负责提供可迭代的文本行：

```python
with open('Data/portfolio.csv') as f:
    portfolio = parse_csv(f, types=[str, int, float])
```

这种设计更灵活，因为 `parse_csv()` 真正需要的不是“文件名”，而是“能够逐行产生文本的对象”。这体现了 [[concepts/鸭子类型]] 和接口设计的原则：函数应该依赖它真正需要的最小能力，而不是依赖更具体的实现细节。

接收可迭代行对象的 `parse_csv()` 可以处理多种输入：普通 CSV 文件、gzip 压缩文件、标准输入、字符串列表，甚至持续产生文本的生成器。

## 字符串路径也是可迭代对象的陷阱

把 `parse_csv()` 改成接收可迭代行对象后，会出现一个重要陷阱：字符串本身也是可迭代对象。

如果新版本函数仍被这样调用：

```python
portfolio = parse_csv('Data/portfolio.csv', types=[str, int, float])
```

函数不会自动打开这个文件。相反，它会把字符串 `'Data/portfolio.csv'` 当作字符序列逐个迭代。这会导致非常奇怪的解析结果。

因此，当 CSV 解析函数从“文件名接口”改成“行对象接口”后，需要明确调整调用方式：

```python
with open('Data/portfolio.csv', 'rt') as f:
    portfolio = parse_csv(f, types=[str, int, float])
```

也可以加入安全检查，避免调用者误传字符串路径：

```python
def parse_csv(lines, types=None, **opts):
    if isinstance(lines, str):
        raise TypeError('parse_csv() expects a file-like object, not a filename')
    ...
```

这类检查可以使用 `isinstance()`，但 [[summaries/07_Objects]] 也提醒不要过度类型检查。类型检查应服务于防止常见误用，而不是把函数写得僵硬复杂。

## 用默认参数和关键字参数配置 CSV 解析

通用 CSV 函数的关键在于可配置性。`parse_csv()` 可以逐步加入默认参数：

```python
def parse_csv(lines, select=None, types=None, has_headers=True,
              delimiter=',', silence_errors=False):
    ...
```

这些参数体现了 Python 函数设计的原则：必需参数放在前面，可选参数使用默认值，布尔开关和可选功能适合用关键字参数调用。

例如：

```python
with open('Data/portfolio.csv') as f:
    parse_csv(f, select=['name', 'shares'])

with open('Data/portfolio.csv') as f:
    parse_csv(f, types=[str, int, float])

with open('Data/prices.csv') as f:
    parse_csv(f, types=[str, float], has_headers=False)

with open('Data/portfolio.dat') as f:
    parse_csv(f, types=[str, int, float], delimiter=' ')

with open('Data/missing.csv') as f:
    parse_csv(f, types=[str, int, float], silence_errors=True)
```

这种调用方式比位置参数堆叠更清楚，尤其当参数是布尔标志或可选功能时，关键字参数能显著提高代码可读性。

## 选择列、类型转换和无表头文件

在很多场景中，只需要 CSV 文件中的一部分列。例如只读取股票名称和股数：

```python
with open('Data/portfolio.csv') as f:
    shares_held = parse_csv(f, select=['name', 'shares'])
```

核心问题是把列名映射成列索引：

```python
headers = ['name', 'date', 'time', 'shares', 'price']
select = ['name', 'shares']
indices = [headers.index(colname) for colname in select]
# [0, 3]
```

然后用这些索引过滤每一行：

```python
row = [row[index] for index in indices]
```

`select` 依赖表头。如果调用者同时指定 `select=[...]` 和 `has_headers=False`，就形成了语义上无意义的配置：没有列名，却要求按列名选择字段。此时应主动抛出异常：

```python
if select and not has_headers:
    raise RuntimeError('select argument requires column headers')
```

CSV 文件中的字段最初都是字符串。如果要计算，就需要类型转换。通用函数可以通过 `types` 参数接收一组转换函数：

```python
with open('Data/portfolio.csv') as f:
    portfolio = parse_csv(f, types=[str, int, float])
```

转换逻辑通常写成：

```python
if types:
    row = [func(val) for func, val in zip(types, row)]
```

有些 CSV 文件没有表头。例如价格文件可能是：

```csv
"AA",9.22
"AXP",24.85
"BA",44.85
```

没有表头时，无法用列名构造字典。因此通用解析函数可以使用 `has_headers=False`，并返回元组列表：

```python
with open('Data/prices.csv') as f:
    prices = parse_csv(f, types=[str, float], has_headers=False)
# [('AA', 9.22), ('AXP', 24.85), ('BA', 44.85), ...]
```

## 自定义分隔符

虽然 CSV 名字里有“逗号”，但现实中的表格文本也可能使用空格、制表符或其他字符分隔。例如 `portfolio.dat` 可能使用空格：

```csv
name shares price
"AA" 100 32.20
"IBM" 50 91.10
```

`csv.reader()` 支持指定分隔符：

```python
rows = csv.reader(f, delimiter=' ')
```

因此 `parse_csv()` 可以提供 `delimiter` 参数：

```python
with open('Data/portfolio.dat') as f:
    portfolio = parse_csv(
        f,
        types=[str, int, float],
        delimiter=' '
    )
```

这让同一个函数可以处理逗号分隔、空格分隔或其他类似格式的数据文件。

## 错误数据、ValueError 与行级恢复

真实 CSV 文件可能包含缺失、损坏或格式不正确的数据。例如某一行可能是：

```text
MSFT,,51.23
```

如果代码执行：

```python
shares = int(row[1])
```

就会触发：

```text
ValueError: invalid literal for int() with base 10: ''
```

在这种情况下，让整个文件处理失败未必是最佳选择。更常见的策略是捕获记录创建期间的 `ValueError`，报告问题行，然后跳过该行继续处理后续数据。

```python
try:
    row = [func(val) for func, val in zip(types, row)]
except ValueError as e:
    print(f'Row {rowno}: Couldn\'t convert {row}')
    print(f'Row {rowno}: Reason {e}')
    continue
```

这类错误处理有几个要点：

- 捕获范围应尽量窄，只捕获确实能处理的错误。
- 错误消息应包含行号，方便定位原始文件。
- 错误消息应包含具体原因，而不只是打印“出错了”。
- 坏行可以被跳过，但不应默认静默忽略。

有时调用者确实不想看到解析警告。此时可以提供 `silence_errors` 参数，但静默应该是调用者明确选择的行为，而不是函数偷偷做出的决定。

## CSV 数据处理的生成器管道形式

[[summaries/03_Producers_consumers]] 提供了另一种组织 CSV 处理的方式：不把解析结果一次性收集到列表中，而是把每个处理步骤写成生成器阶段。

生成器天然适合 [[concepts/生产者消费者模式]]：

```python
# Producer
def follow(f):
    ...
    yield line

# Consumer
for line in follow(f):
    ...
```

多个阶段可以串联为：

```text
producer -> processing -> processing -> consumer
```

在 CSV 场景中，生产者可以是一个持续跟踪日志文件的 `follow()` 函数；中间处理阶段可以是 `csv.reader()`、列选择、类型转换、字典构造、过滤；最终消费者可以是打印表格、写 CSV 输出或更新界面。

一个实时股票日志解析管道可以拆成多个小组件：

```python
def select_columns(rows, indices):
    for row in rows:
        yield [row[index] for index in indices]


def convert_types(rows, types):
    for row in rows:
        yield [func(val) for func, val in zip(types, row)]


def make_dicts(rows, headers):
    for row in rows:
        yield dict(zip(headers, row))
```

这些阶段可以封装成一个高层解析函数：

```python
def parse_stock_data(lines):
    rows = csv.reader(lines)
    rows = select_columns(rows, [0, 1, 4])
    rows = convert_types(rows, [str, float, float])
    rows = make_dicts(rows, ['name', 'price', 'change'])
    return rows
```

调用后得到的是一条字典流，而不是一个立即构造好的列表。只有当下游循环请求下一条记录时，上游才会读取、解析、转换和构造这一条数据。这就是惰性求值在 CSV 数据处理中的实际价值。

生成器管道还可以轻松加入过滤阶段。例如只保留投资组合中的股票：

```python
def filter_symbols(rows, names):
    for row in rows:
        if row['name'] in names:
            yield row
```

这类管道特别适合大文件、实时日志、行情数据、持续输入和多阶段数据清洗。

## 用类方法封装 CSV 到对象的构造

早期程序可能把 CSV 解析、业务对象创建和容器构造散落在外部脚本中。例如 `report.py` 中可能有这样的函数：

```python
def read_portfolio(filename, **opts):
    with open(filename) as lines:
        portdicts = fileparse.parse_csv(lines,
                                        select=['name','shares','price'],
                                        types=[str,int,float],
                                        **opts)

    portfolio = [Stock(**d) for d in portdicts]
    return Portfolio(portfolio)
```

这种写法虽然能工作，但责任分布比较混乱。[[summaries/05_Decorated_methods]] 建议把 `Portfolio` 设计成更清晰的容器类，并用 `@classmethod` 定义一个 CSV 替代构造器：

```python
import fileparse
import stock

class Portfolio:
    def __init__(self):
        self.holdings = []

    def append(self, holding):
        if not isinstance(holding, stock.Stock):
            raise TypeError('Expected a Stock instance')
        self.holdings.append(holding)

    @classmethod
    def from_csv(cls, lines, **opts):
        self = cls()
        portdicts = fileparse.parse_csv(lines,
                                        select=['name','shares','price'],
                                        types=[str,int,float],
                                        **opts)

        for d in portdicts:
            self.append(stock.Stock(**d))

        return self
```

调用方式变成：

```python
from portfolio import Portfolio

with open('Data/portfolio.csv') as lines:
    port = Portfolio.from_csv(lines)
```

这个设计的意义在于：

- `Portfolio` 自己负责从 CSV 数据创建合法实例。
- 外部代码不需要知道 `Portfolio` 的内部存储结构。
- `from_csv()` 把解析、`Stock` 创建和类型检查组织到同一个类职责中。
- 使用 `cls()` 而不是写死 `Portfolio()`，让该构造方式对继承友好。
- 这体现了面向对象设计、封装、类方法和 [[concepts/替代构造器]] 在数据处理中的实际用途。

## 字典保存查找表与组合多个 CSV 数据源

字典不仅可以表示“一行记录”，还可以表示从 CSV 文件构造出的查找表。典型例子是 `Data/prices.csv`，其中每行包含股票代码和当前价格：

```csv
"AA",9.22
"AXP",24.85
"BA",44.85
```

读取后可以组织成价格字典：

```python
prices = {
    'AA': 9.22,
    'AXP': 24.85,
    'BA': 44.85
}
```

这种结构的关键价值是快速随机查找：

```python
prices['IBM']
prices['MSFT']
```

如果已有通用 `parse_csv()`，则可以把无表头的价格文件读成元组列表，再转换成字典：

```python
with open('Data/prices.csv', 'rt') as f:
    prices = dict(parse_csv(f, types=[str, float], has_headers=False))
```

更真实的 CSV 处理任务往往不止读取一个文件。股票示例中可以把两个文件结合起来：

- `portfolio.csv`：保存持仓，包括股票名、股数、买入价。
- `prices.csv` 或 `stocklog.csv`：保存当前价格或实时价格变化。

计算原始成本：

```python
cost = 0.0
for s in portfolio:
    cost += s['shares'] * s['price']
```

计算当前市值：

```python
value = 0.0
for s in portfolio:
    current_price = prices[s['name']]
    value += s['shares'] * current_price
```

如果投资组合已经被封装为 `Portfolio` 对象，则类似计算也可以逐步移动到类的方法中，让数据和相关行为靠得更近。

## 元组、字典、列表、集合、生成器和对象的角色区别

在 CSV 数据处理中，列表、元组、字典、集合、生成器和自定义类经常同时出现，但它们的语义不同：

```python
row = ['AA', '100', '32.20']          # csv.reader 产生的原始字段列表
t = ('AA', 100, 32.2)                # 转换后的固定结构记录
d = {'name': 'AA', 'shares': 100, 'price': 32.2}  # 带字段名的记录
portfolio = [d]                      # 多条记录组成的有序集合
prices = {'AA': 9.22, 'IBM': 106.28} # 按股票代码查找价格
symbols = {'AA', 'IBM'}              # 唯一股票代码集合
port = Portfolio.from_csv(lines)     # 封装了持仓和行为的业务对象
```

一般来说：

- 列表常用于表示多个项目的有序集合，例如多行记录或多个股票代码。
- 元组常用于表示一个由多个字段组成的固定记录。
- 字典常用于表示字段名明确、可读性强、可修改的记录，或用于构造按键快速查找的映射表。
- 集合常用于表示无序且唯一的项目集合，例如所有出现过的股票代码。
- 生成器常用于表示尚未全部生成的记录流，适合大文件、实时输入和管道式处理。
- 自定义类适合表达具有业务含义、内部约束和相关行为的数据模型，例如 `Stock` 和 `Portfolio`。

选择哪种结构并不只是语法问题，也是在表达数据模型：一行 CSV 数据到底只是临时字段列表，还是固定记录，还是带有具名属性的业务对象；多行数据应该保留顺序，还是应该按键查找，还是只关心唯一值，还是只需要按需流动。

## 使用集合去重和成员测试

CSV 文件中经常会有重复值。例如一个投资组合文件中可能多次持有同一股票：

```python
names = ['IBM', 'AAPL', 'GOOG', 'IBM', 'GOOG', 'YHOO']
```

如果只想知道出现过哪些股票，可以转换为集合：

```python
unique = set(names)
```

集合会自动去重。它也适合快速成员测试：

```python
tech_stocks = {'IBM', 'AAPL', 'MSFT'}

'IBM' in tech_stocks  # True
'FB' in tech_stocks   # False
```

在实时管道中，集合也常作为过滤条件使用。例如 `filter_symbols(rows, names)` 可以用股票代码集合快速判断某条记录是否应该继续传给下游。

## 浮点数计算与显示

在处理价格、金额等 CSV 字段时，经常会用到浮点数。例如：

```python
cost = 100 * 32.2
```

结果可能显示为：

```python
3220.0000000000005
```

这不是 Python 的数学错误，而是二进制浮点数无法精确表示某些十进制小数造成的正常现象。输出时可以通过格式化控制显示：

```python
print(f'{cost:0.2f}')
# 3220.00
```

因此，在 CSV 数据处理中看到很小的浮点误差并不罕见。相关主题包括 [[concepts/浮点数精度]] 和格式化输出。

## 资源管理：with、finally 与文件关闭

CSV 处理几乎总会涉及文件资源。最推荐的写法是使用 `with open(...)`：

```python
with open('Data/portfolio.csv', 'rt') as f:
    rows = csv.reader(f)
    for row in rows:
        ...
```

`with` 定义了资源的使用上下文。当执行离开该上下文时，文件会自动关闭，即使中途发生异常也一样。这是 [[concepts/上下文管理器]] 和资源管理在文件处理中的典型应用。

在更底层的写法中，可以用 `try-finally` 保证资源释放：

```python
f = open('Data/portfolio.csv', 'rt')
try:
    rows = csv.reader(f)
    for row in rows:
        ...
finally:
    f.close()
```

当 `parse_csv()` 或 `Portfolio.from_csv()` 接收文件类对象后，打开和关闭文件的责任通常转移给调用者或上层函数。因此调用时更应使用 `with`。

## 从命令行指定 CSV 文件

在学习阶段，文件名常被硬编码在程序中：

```python
cost = portfolio_cost('Data/portfolio.csv')
```

但真实程序通常应允许用户从命令行传入文件名。可以使用标准库 `sys` 模块读取命令行参数：

```python
import sys

if len(sys.argv) == 2:
    filename = sys.argv[1]
else:
    filename = 'Data/portfolio.csv'

cost = portfolio_cost(filename)
print('Total cost:', cost)
```

如果底层 `parse_csv()` 或类方法 `from_csv()` 已经改为接收文件对象，则命令行脚本通常先从命令行获得文件名，再由业务函数或主程序打开文件并传入解析器。

## 文件模式、压缩 CSV 与标准输入

处理 CSV 文件时通常使用文本读取模式：

```python
open('Data/portfolio.csv', 'rt')
```

写入 CSV 或其他文本结果时，可以使用：

```python
open('outfile.csv', 'wt')
```

CSV 数据不一定总是普通文本文件，也可能经过 gzip 压缩。此时可以使用标准库 `gzip`：

```python
import gzip

with gzip.open('Data/portfolio.csv.gz', 'rt') as f:
    portfolio = parse_csv(f, types=[str, int, float])
```

同样，它也可以处理标准输入：

```python
import sys

records = parse_csv(sys.stdin, types=[str, int, float])
```

甚至可以处理测试用的字符串列表：

```python
lines = [
    'name,shares,price',
    'AA,100,34.23',
    'IBM,50,91.1',
    'HPE,75,45.1'
]
portfolio = parse_csv(lines, types=[str, int, float])
```

这说明很多对象都可以表现得“像文件一样”：只要它们支持逐行读取或逐行迭代，就可以放入类似的处理流程中。这与文件类对象、可迭代对象、[[concepts/鸭子类型]] 和生成器密切相关。

## 标准 Python 与 Pandas 的关系

在实际数据工作中，Pandas 等库确实可以更方便地读取 CSV 文件。但在入门阶段，直接使用标准 Python 处理 CSV 有重要意义：

- 能理解文件本质上是文本流。
- 能练习逐行读取和字符串拆分。
- 能掌握显式类型转换的必要性。
- 能理解为什么原始字段列表往往需要转换为元组、字典等更有语义的数据结构。
- 能理解为什么多行记录通常需要列表、查找表通常需要字典、唯一值通常需要集合。
- 能掌握直接遍历序列、使用 `enumerate()` 获取行号、使用 `zip()` 配对表头和值等 Pythonic 迭代模式。
- 能理解函数、类型和异常也是对象，因此可以把转换函数放入列表并按列调用。
- 能理解赋值只是引用绑定，从而避免在记录列表中错误共享同一个可变字典或列表。
- 能看清数据清洗、解析和计算的基本步骤。
- 能理解异常处理为什么对真实数据很重要。
- 能学习如何把脚本封装为函数并进行交互测试。
- 能进一步学习如何把重复解析逻辑抽象成 `parse_csv()` 这样的通用库函数。
- 能体会默认参数、关键字参数和函数接口设计对可复用代码的重要性。
- 能理解文件名接口与文件类对象接口的差异。
- 能体会 [[concepts/鸭子类型]] 如何让数据处理函数支持普通文件、压缩文件、标准输入和测试数据。
- 能理解生成器和 [[concepts/数据流管道]] 如何把 CSV 处理扩展到实时数据和大文件场景。
- 能理解 `@classmethod` 和 `from_csv()` 如何把 CSV 构造逻辑封装进业务类中。
- 能为后续使用高级库打下更扎实的基础。

## 学习意义

CSV 数据处理适合作为早期 Python 实践项目，因为它具备以下特点：

- 数据格式简单，容易观察和调试。
- 能直接练习文件读取、字符串拆分和数字计算。
- 任务规模可控，适合编写短脚本。
- 能自然引出数据处理、文件处理、程序结构等后续主题。
- 能帮助学习者理解“真实数据通常先以文本形式出现，程序需要先解析再计算”。
- 能展示从原始字符串列表到元组、字典、对象等结构化记录的建模过程。
- 能展示列表、字典和集合在实际数据任务中的不同角色。
- 能展示从硬编码脚本到函数化程序、命令行工具的演进过程。
- 能进一步展示从专用函数到通用解析库函数的抽象过程。
- 能展示从外部脚本构造对象到类方法替代构造器的封装过程。
- 能通过坏数据和空行示例理解 [[concepts/异常处理]] 和数据清洗的必要性。
- 能通过 `enumerate()` 学会生成带行号的错误报告。
- 能通过 `zip(headers, row)` 学会构造更通用的字段名字典，减少对固定列号的依赖。
- 能通过 `[func(val) for func, val in zip(types, row)]` 理解 一等对象 在实际数据转换中的价值。
- 能通过浅拷贝和引用共享问题理解 可变性与引用、拷贝语义 对数据结构安全性的影响。
- 能通过 `select`、`types`、`has_headers`、`delimiter`、`silence_errors` 等参数理解可配置接口设计。
- 能通过 `select` 与 `has_headers=False` 的冲突理解何时应主动抛出异常。
- 能通过 `ValueError` 的捕获理解如何跳过脏数据并继续处理。
- 能通过“文件名 vs 可迭代行对象”的设计选择理解更灵活的库接口。
- 能通过字符串路径误传问题理解灵活性带来的边界条件。
- 能通过 gzip 文件、标准输入、字符串列表和 `follow()` 生成器理解文件类对象与鸭子类型。
- 能通过生成器管道理解数据如何在生产者、中间处理阶段和消费者之间增量流动。
- 能通过 `Portfolio.from_csv()` 理解类方法、[[concepts/替代构造器]]、封装和 Python 继承在数据处理中的作用。
- 能通过价格计算认识 [[concepts/浮点数精度]] 等实际编程细节。
- 能通过投资组合和价格表的组合计算理解跨文件数据整合。

## 与后续学习的关系

CSV 数据处理通常是从基础编程进入实际数据工作的桥梁。掌握它之后，学习者可以进一步学习更复杂的数据清洗、表格数据分析、自动化脚本、流式处理、面向对象建模，以及使用专门库处理结构化数据。

它也为后续“Working With Data”类内容奠定实践基础：无论未来使用标准库、Pandas，还是数据库工具，核心思想都类似——从外部数据源读取记录，解析字段，转换类型，组织数据结构，处理异常数据，并从中计算出有用结果。

从 [[summaries/06_Files]] 到 [[summaries/07_Functions]]，CSV 数据处理的学习路径逐渐清晰：先理解文件和文本，再封装为函数，然后加入错误处理、标准库解析和命令行参数。[[summaries/01_Datatypes]] 进一步说明，读取数据之后还需要选择合适的数据结构来表达记录。[[summaries/02_Containers]] 强调，程序还需要选择合适的外层容器。[[summaries/04_Sequences]] 补充了序列遍历、`enumerate()`、元组解包和 `zip()` 这些关键迭代工具。[[summaries/07_Objects]] 说明类型转换函数可以作为一等对象传递和调用，同时提醒在记录列表、字典和嵌套结构中注意引用共享、浅拷贝与深拷贝。[[summaries/02_More_functions]] 说明，真实项目中应把重复的 CSV 解析逻辑抽象成通用函数。[[summaries/03_Error_checking]] 把这个通用函数推向更真实的使用环境。[[summaries/06_Design_discussion]] 把重点放在接口抽象上：通用 CSV 解析函数最好接收任意可迭代行对象，而不是只接收文件名。[[summaries/03_Producers_consumers]] 把这一接口抽象扩展为生成器管道。[[summaries/05_Decorated_methods]] 则说明，当 CSV 数据对应明确业务对象时，可以进一步用 `@classmethod` 把读取和构造逻辑封装进类本身。

See also: [[summaries/05_Lists]], [[summaries/06_Files]], [[summaries/07_Functions]], [[summaries/01_Datatypes]], [[summaries/02_Containers]], [[summaries/03_Formatting]], [[summaries/04_Sequences]], [[summaries/05_Collections]], [[summaries/01_Script]], [[summaries/02_More_functions]], [[summaries/03_Error_checking]], [[summaries/04_Modules]], [[summaries/06_Design_discussion]], [[summaries/03_Producers_consumers]], [[summaries/01_Class]], [[summaries/02_Customizing_iteration]], [[summaries/01_Variable_arguments]], [[summaries/05_Decorated_methods]], [[summaries/07_Objects]]

See also: [[summaries/02_Logging]]

See also: [[summaries/01_Introduction__00_Overview]]