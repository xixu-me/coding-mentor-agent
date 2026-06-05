---
sources: [summaries/02_More_functions.md, summaries/01_Datatypes.md]
brief: `None` 是 Python 中表示无值、缺失或无显式返回结果的特殊对象。
---

# None 与缺失值

`None` 是 Python 中用于表示“没有值”“缺失值”“尚未设置”或“没有显式返回结果”的特殊对象。它常被用作占位符，表示某个变量、字段、参数或函数结果当前没有可用数据，但相关名字或结构本身仍然存在。

相关来源：[[summaries/01_Datatypes]]、[[summaries/02_More_functions]]。

## 基本含义

在 Python 中，可以把变量赋值为 `None`：

```python
email_address = None
```

这表示 `email_address` 目前没有有效的邮箱地址。它不是空字符串 `''`，也不是数字 `0`，而是一个专门表达“无值”的对象。

`None` 常用于以下场景：

- 可选字段暂时没有值
- 数据缺失或未知
- 函数没有显式返回值
- 初始化变量，稍后再赋予真实数据
- 表示某项配置、参数或属性未提供
- 表示某个函数调用完成了操作，但没有产生有意义的返回结果

相关主题包括 Python数据类型、Python数据结构 和 Python返回值。

## None 在条件判断中的行为

`None` 在条件判断中会被视为 `False`：

```python
if email_address:
    send_email(email_address, msg)
```

在这个例子中，如果 `email_address` 是 `None`，条件不会成立，邮件发送逻辑不会执行。

这种写法常用于“只有当值存在时才执行某个操作”的场景。不过，如果业务逻辑需要明确区分 `None`、空字符串、空列表或数字 `0`，应使用更明确的判断，例如：

```python
if email_address is not None:
    ...
```

## None 与其他“空值”的区别

虽然 `None`、空字符串、空列表和数字 `0` 在条件判断中都可能表现为 `False`，但它们的语义不同：

```python
None      # 没有值 / 缺失值
''        # 有一个字符串，但内容为空
[]        # 有一个列表，但列表中没有元素
0         # 有一个数字，值为零
```

因此，`None` 更强调“值不存在”，而不是“值存在但为空”。

例如：

```python
email_address = None
```

表示还没有邮箱地址；而：

```python
email_address = ''
```

表示邮箱地址字段存在，但内容是空字符串。这两种情况在数据建模中可能具有不同含义。

## 函数返回值中的 None

在 [[summaries/02_More_functions]] 中，`None` 的一个重要来源是函数返回值。

Python 函数使用 `return` 返回结果：

```python
def square(x):
    return x * x
```

如果函数没有显式返回值，或者只写了 `return` 而没有跟任何表达式，Python 会自动返回 `None`：

```python
def bar(x):
    statements
    return

a = bar(4)      # a = None
```

没有 `return` 语句时也是如此：

```python
def foo(x):
    statements

b = foo(4)      # b = None
```

这意味着，调用函数后得到 `None` 不一定表示出错，也可能只是该函数本来就是为了执行某个操作，而不是为了计算并返回一个值。

例如，一个只负责打印信息、修改对象或写入文件的函数，可能自然返回 `None`：

```python
def greeting(name):
    print('Hello', name)

result = greeting('Dave')   # result 是 None
```

相关概念：Python函数设计、Python返回值。

## None 与可选参数

在函数设计中，`None` 常被用来表示某个可选参数没有被调用者提供。虽然 [[summaries/02_More_functions]] 中展示了使用布尔默认值的例子：

```python
def read_prices(filename, debug=False):
    ...
```

但对于更一般的“可选配置”或“可选数据”，`None` 也常作为默认值：

```python
def parse_record(row, converter=None):
    if converter is not None:
        row = converter(row)
    return row
```

这类设计可以表达：如果调用者没有提供 `converter`，就使用默认处理逻辑。

不过，是否使用 `None` 作为默认参数，要取决于语义：

- `debug=False` 表示调试功能默认关闭。
- `select=None` 可以表示没有指定列选择。
- `types=None` 可以表示没有指定类型转换。

在构建通用函数时，使用清晰的默认值有助于提升函数接口的可读性。可选参数通常也适合用关键字参数调用，例如：

```python
parse_csv('Data/portfolio.csv', select=['name', 'shares'])
parse_csv('Data/prices.csv', has_headers=False)
```

相关概念：关键字参数、可配置接口、函数抽象。

## None 在数据结构中的作用

在处理真实数据时，经常会遇到字段缺失的情况。例如一条股票记录可能包含名称、股数和价格：

```python
record = {
    'name': 'GOOG',
    'shares': 100,
    'price': 490.1
}
```

如果某个字段暂时未知，可以用 `None` 表示：

```python
record = {
    'name': 'GOOG',
    'shares': 100,
    'price': None
}
```

这说明 `price` 这个字段存在，但当前没有价格数据。

这种方式尤其适合与 字典 搭配使用，因为字典通过字段名表达数据含义，`None` 可以明确标记某个字段的值缺失。

## 与 CSV 数据处理的关系

在从 CSV、数据库或外部 API 读取数据时，原始数据可能包含空字段、无效字段或缺失字段。此时常需要把这些值转换为 `None`，以便后续程序统一处理。

例如，从 CSV 中读取到空价格字段：

```python
row = ['AA', '100', '']
```

可以转换为：

```python
price = float(row[2]) if row[2] else None
```

然后构造记录：

```python
d = {
    'name': row[0],
    'shares': int(row[1]),
    'price': price
}
```

这与 [[summaries/01_Datatypes]] 中介绍的思想一致：从 CSV 读取到的原始字符串行通常需要被解释和转换，才能成为更适合计算和维护的数据结构。

在 [[summaries/02_More_functions]] 的 `parse_csv()` 练习中，CSV 解析函数逐步支持列选择、类型转换、无表头文件和自定义分隔符：

```python
parse_csv('Data/portfolio.csv', select=['name', 'shares'], types=[str, int])
```

这类通用解析函数通常会使用默认参数表达“未启用某项可选功能”。例如：

```python
def parse_csv(filename, select=None, types=None, has_headers=True, delimiter=','):
    ...
```

其中：

- `select=None` 表示不选择特定列，读取全部列。
- `types=None` 表示不进行类型转换。
- `has_headers=True` 表示默认输入文件有表头。

这里的 `None` 不是数据字段中的缺失值，而是函数接口层面的“未指定选项”。这体现了 `None` 在 Python 中既可用于数据建模，也可用于 API 设计。

相关主题包括 CSV数据处理、CSV解析、类型转换 和 文件解析。

## 使用 None 时的注意事项

### 1. 计算前需要检查

如果某个数值字段可能是 `None`，不能直接参与数学运算：

```python
price = None
cost = shares * price   # TypeError
```

应先判断是否存在有效值：

```python
if price is not None:
    cost = shares * price
```

这在处理 [[concepts/浮点数精度]]、价格、数量等数值数据时尤其重要。

### 2. 判断 None 通常使用 `is`

判断一个变量是否为 `None`，推荐使用：

```python
if value is None:
    ...

if value is not None:
    ...
```

而不是：

```python
if value == None:
    ...
```

因为 `None` 是一个特殊的单例对象，用 `is` 判断身份更准确，也更符合 Python 惯例。

### 3. 不要混淆“缺失”和“空”

如果业务逻辑需要区分“没有值”和“空值”，就应该显式使用 `None` 表示缺失。

例如：

```python
middle_name = None  # 未提供中间名信息
middle_name = ''    # 明确提供了空字符串
```

在简单程序中二者可能没有明显区别，但在数据处理、表单提交、数据库同步等场景中，这种区别可能非常重要。

### 4. 注意函数是否真的返回了值

如果调用函数后得到 `None`，应检查函数定义中是否包含有效的 `return`：

```python
def compute_cost(shares, price):
    cost = shares * price

result = compute_cost(100, 32.2)   # result 是 None
```

这里函数虽然计算了 `cost`，但没有返回它。正确写法是：

```python
def compute_cost(shares, price):
    cost = shares * price
    return cost
```

这类错误在初学函数时很常见。理解“没有 `return` 就返回 `None`”是掌握 Python函数设计 的关键之一。

## None 与局部变量、参数传递的关系

`None` 本身只是一个对象，变量名可以绑定到它，就像绑定到字符串、数字、列表或字典一样。

在函数中，变量赋值默认是局部的：

```python
def foo():
    value = None
```

这里的 `value` 是局部变量，只在函数调用期间存在。函数结束后，这个局部变量不会保留在外部作用域中。

同时，函数参数传递的是对象引用，而不是对象副本。虽然 `None` 是不可变的特殊对象，通常不会被“修改”，但它经常出现在参数默认值、返回值和数据字段中，用来表达某种状态。

相关概念：Python作用域、Python参数传递、变量绑定。

## 与元组和字典的关系

在 [[summaries/01_Datatypes]] 中，元组和字典都被用来表示一条股票持仓记录：

```python
t = ('AA', 100, 32.2)
```

或：

```python
d = {
    'name': 'AA',
    'shares': 100,
    'price': 32.2
}
```

如果某个值缺失，也可以把 `None` 放入这些结构中：

```python
t = ('AA', 100, None)
```

```python
d = {
    'name': 'AA',
    'shares': 100,
    'price': None
}
```

不过，在表达缺失字段时，字典通常更清晰，因为键名可以说明哪个字段缺失：

```python
d['price'] is None
```

比使用元组索引更具可读性：

```python
t[2] is None
```

这也呼应了 [[summaries/01_Datatypes]] 中的观点：当数据字段较多、需要清晰字段名或可能修改时，字典 通常比 元组 更易读、更灵活。

## 小结

`None` 是 Python 中表达缺失值和无返回结果的核心机制。它可以表示变量或字段当前没有有效值，也可以表示函数没有显式返回任何对象。在数据处理程序中，`None` 帮助程序明确区分“值不存在”和“值存在但为空”；在函数设计中，`None` 常用于默认参数、可选配置和没有返回值的函数结果。

相关概念：Python数据类型、Python数据结构、字典、元组、CSV数据处理、Python返回值、Python函数设计。