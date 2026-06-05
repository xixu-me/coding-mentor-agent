---
doc_type: short
full_text: sources/02_More_functions.md
---

# 02_More_functions 总结

本文深入讲解 Python 函数的调用方式、默认参数、返回值、作用域、参数传递语义，并通过一系列练习逐步构建一个通用的 CSV 文件解析函数 `parse_csv()`。它承接前文脚本化程序的基础，为后续错误检查和更健壮的数据处理做准备。

## 函数调用方式

Python 函数可以用两种主要方式调用：

- **位置参数**：按定义顺序传入参数。
- **关键字参数**：显式指定参数名，提高可读性。

示例：

```python
def read_prices(filename, debug):
    ...

prices = read_prices('prices.csv', True)
prices = read_prices(filename='prices.csv', debug=True)
```

对于布尔开关、调试选项、可选行为等参数，推荐使用关键字参数，因为：

```python
parse_data(data, False, True)
```

难以理解，而下面的形式更清晰：

```python
parse_data(data, ignore_errors=True)
parse_data(data, debug=True)
parse_data(data, debug=True, ignore_errors=True)
```

相关概念：Python函数设计、关键字参数

## 默认参数

函数参数可以指定默认值，使其成为可选参数：

```python
def read_prices(filename, debug=False):
    ...
```

调用时可以省略默认参数：

```python
d = read_prices('prices.csv')
e = read_prices('prices.dat', True)
```

注意：带默认值的参数必须放在参数列表末尾，也就是所有必需参数应先出现。

## 参数命名与 API 设计

函数参数名应短小但有意义。原因包括：

- 调用者可能使用关键字参数调用函数。
- 开发工具和帮助文档会显示参数名。
- 好的参数名能让函数接口更自解释。

例如：

```python
d = read_prices('prices.csv', debug=True)
```

这里 `debug` 明确表达了参数用途。

## 返回值

`return` 语句用于从函数返回值：

```python
def square(x):
    return x * x
```

如果函数没有显式返回值，或仅写 `return` 而不带表达式，则返回 `None`：

```python
def bar(x):
    statements
    return

 def foo(x):
    statements
```

这两个函数调用结果都会是 `None`。

## 多个返回值

Python 函数实际只能返回一个对象，但可以返回一个元组，从而实现“多个返回值”的效果：

```python
def divide(a, b):
    q = a // b
    r = a % b
    return q, r
```

调用时可以解包：

```python
x, y = divide(37, 5)   # x = 7, y = 2
```

也可以作为一个元组接收：

```python
x = divide(37, 5)      # x = (7, 2)
```

相关概念：元组解包、Python返回值

## 变量作用域

Python 中变量根据定义位置分为：

- **全局变量**：定义在函数外部。
- **局部变量**：定义在函数内部。

```python
x = value  # 全局变量

def foo():
    y = value  # 局部变量
```

### 局部变量

函数内部赋值产生的变量是局部变量，只在函数调用期间存在，调用结束后不可访问。

示例：

```python
def read_portfolio(filename):
    portfolio = []
    for line in open(filename):
        fields = line.split(',')
        s = (fields[0], int(fields[1]), float(fields[2]))
        portfolio.append(s)
    return portfolio
```

其中 `filename`、`portfolio`、`line`、`fields`、`s` 都是局部变量。

函数调用结束后，外部不能访问 `fields`：

```python
>>> fields
NameError: name 'fields' is not defined
```

局部变量也不会与函数外部的同名变量冲突。

### 全局变量

函数可以读取同一文件中的全局变量：

```python
name = 'Dave'

def greeting():
    print('Hello', name)
```

但函数内部的赋值默认会创建局部变量，而不是修改全局变量：

```python
name = 'Dave'

def spam():
    name = 'Guido'

spam()
print(name)  # Dave
```

核心规则：函数中的所有赋值默认都是局部赋值。

### 修改全局变量

如果必须修改全局变量，需要使用 `global` 声明：

```python
name = 'Dave'

def spam():
    global name
    name = 'Guido'
```

但文中强调应尽量避免 `global`。如果函数需要修改外部状态，更好的设计通常是使用类来封装状态。

相关概念：Python作用域、全局变量、状态管理

## 参数传递：引用而非复制

调用函数时，参数名会绑定到传入对象上。传入的值不会被复制。

如果传入的是可变对象，例如列表或字典，函数可以原地修改它：

```python
def foo(items):
    items.append(42)

a = [1, 2, 3]
foo(a)
print(a)  # [1, 2, 3, 42]
```

关键点：函数不会自动获得输入参数的副本。

## 修改对象 vs 重新绑定变量

文中强调了一个重要区别：

- 修改对象：影响调用者持有的同一个对象。
- 重新赋值变量名：只改变局部变量绑定，不影响外部变量。

修改对象：

```python
def foo(items):
    items.append(42)

a = [1, 2, 3]
foo(a)
print(a)  # [1, 2, 3, 42]
```

重新绑定局部变量：

```python
def bar(items):
    items = [4, 5, 6]

b = [1, 2, 3]
bar(b)
print(b)  # [1, 2, 3]
```

变量赋值不会覆盖内存，而是让名字绑定到新的对象。

相关概念：[[concepts/Python-可变对象]]、[[concepts/变量绑定]]、[[concepts/Python-参数传递]]

## 练习目标：构建通用 CSV 解析函数

练习部分围绕 `Work/fileparse.py` 展开，目标是把前面 `read_portfolio()` 和 `read_prices()` 中重复的底层 CSV 处理逻辑抽象成一个通用函数 `parse_csv()`。

该函数最终支持：

- 打开 CSV 文件。
- 使用 `csv.reader()` 读取内容。
- 跳过空行。
- 将带表头的 CSV 转换为字典列表。
- 选择指定列。
- 对字段执行类型转换。
- 支持无表头文件。
- 支持自定义分隔符。

相关概念：CSV解析、数据清洗、函数抽象

## Exercise 3.3：读取 CSV 为字典列表

初始版本的 `parse_csv()` 将 CSV 文件解析成字典列表：

```python
import csv

def parse_csv(filename):
    '''
    Parse a CSV file into a list of records
    '''
    with open(filename) as f:
        rows = csv.reader(f)
        headers = next(rows)
        records = []
        for row in rows:
            if not row:
                continue
            record = dict(zip(headers, row))
            records.append(record)
    return records
```

核心机制：

- 第一行作为表头。
- 每一行数据与表头通过 `zip(headers, row)` 配对。
- 使用 `dict()` 转换成字典。
- 所有记录组成列表返回。

示例结果：

```python
[{'price': '32.20', 'name': 'AA', 'shares': '100'}, ...]
```

此时所有字段仍是字符串，尚不能直接用于数值计算。

## Exercise 3.4：选择指定列

接着扩展 `parse_csv()`，增加 `select` 可选参数，用于只读取部分列：

```python
shares_held = parse_csv('Data/portfolio.csv', select=['name', 'shares'])
```

关键步骤是把列名映射为列索引：

```python
indices = [headers.index(colname) for colname in select]
```

例如：

```python
headers = ['name', 'date', 'time', 'shares', 'price']
select = ['name', 'shares']
indices = [0, 3]
```

读取每行后，用索引过滤字段：

```python
row = [row[index] for index in indices]
```

该练习体现了列表推导式、索引映射和数据投影的组合应用。

相关概念：[[concepts/列表推导式]]、列选择、数据投影

## Exercise 3.5：执行类型转换

进一步扩展 `parse_csv()`，增加 `types` 参数，用于对字段执行类型转换：

```python
portfolio = parse_csv('Data/portfolio.csv', types=[str, int, float])
```

转换逻辑：

```python
if types:
    row = [func(val) for func, val in zip(types, row)]
```

这里 `types` 是一组可调用对象，例如 `str`、`int`、`float`。它们与行中的字段一一配对，并把字符串转换成所需类型。

示例：

```python
{'price': 32.2, 'name': 'AA', 'shares': 100}
```

这一节展示了函数对象也可以作为数据传递。

相关概念：类型转换、高阶函数、可调用对象

## Exercise 3.6：处理无表头 CSV 文件

有些 CSV 文件没有表头，例如价格文件：

```csv
"AA",9.22
"AXP",24.85
"BA",44.85
```

此时无法构造字典，因为没有列名作为键。因此 `parse_csv()` 需要支持 `has_headers=False`，并返回元组列表：

```python
prices = parse_csv('Data/prices.csv', types=[str, float], has_headers=False)
```

结果形式：

```python
[('AA', 9.22), ('AXP', 24.85), ('BA', 44.85), ...]
```

这一扩展要求函数根据是否存在表头改变解析策略：

- 有表头：返回字典列表。
- 无表头：返回元组列表。

## Exercise 3.7：支持不同分隔符

虽然 CSV 常用逗号分隔，但实际数据也可能使用空格、制表符等分隔符。

例如 `portfolio.dat` 使用空格分隔：

```csv
name shares price
"AA" 100 32.20
"IBM" 50 91.10
```

`csv.reader()` 可以通过 `delimiter` 参数指定分隔符：

```python
rows = csv.reader(f, delimiter=' ')
```

于是 `parse_csv()` 增加 `delimiter` 参数：

```python
portfolio = parse_csv(
    'Data/portfolio.dat',
    types=[str, int, float],
    delimiter=' '
)
```

这使函数可以处理更广泛的结构化文本数据。

相关概念：文件解析、CSV模块、可配置接口

## 最终函数的设计意义

经过这些练习，`parse_csv()` 从一个简单函数逐步演化为一个可复用的数据解析工具。它体现了多个重要编程思想：

1. **隐藏低层细节**：调用者不需要关心文件打开、CSV 包装、跳过空行等细节。
2. **通过可选参数增强通用性**：`select`、`types`、`has_headers`、`delimiter` 让函数适应多种场景。
3. **用关键字参数提升可读性**：例如 `has_headers=False`、`delimiter=' '`。
4. **组合已有概念解决实际问题**：字典、元组、列表推导式、函数对象、文件读取等概念被整合到一个实用函数中。
5. **形成小型库函数**：该函数可以被其他程序导入和复用。

## 关键知识点汇总

- 函数可以通过位置参数或关键字参数调用。
- 可选参数应使用默认值，并通常放在参数列表末尾。
- 布尔标志和可选功能推荐使用关键字参数调用。
- 函数无显式返回值时返回 `None`。
- 多返回值本质上是返回元组。
- 函数内部赋值默认创建局部变量。
- 函数可以读取全局变量，但修改全局变量需要 `global`。
- 应尽量避免 `global`，改用更好的状态管理方式。
- 函数参数传递的是对象引用，不是对象副本。
- 修改可变对象会影响调用者；重新绑定局部变量不会。
- 通用函数可以通过可选参数逐步增强能力。
- `parse_csv()` 是函数抽象、数据解析和接口设计的综合练习。

## 可延伸的概念页面

- Python函数设计
- 关键字参数
- Python作用域
- Python参数传递
- [[concepts/变量绑定]]
- 可变对象
- CSV解析
- 类型转换
- 函数抽象
- 可配置接口

## Related Concepts
- [[concepts/函数]]
- [[concepts/CSV-数据处理]]
- [[concepts/Python-对象模型]]
- [[concepts/Python-可变对象]]
- [[concepts/元组与解包]]
- [[concepts/None-与缺失值]]
- [[concepts/文件读写]]
- [[concepts/上下文管理器]]
- [[concepts/字典与数据建模]]
- [[concepts/模块与-import]]
- [[concepts/Python-输入输出]]
- [[concepts/变量与数据类型]]
