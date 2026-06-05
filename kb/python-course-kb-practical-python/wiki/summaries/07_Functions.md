---
doc_type: short
full_text: sources/07_Functions.md
---

# 07_Functions 总结

本文介绍了 Python 程序组织的基础工具：自定义函数、标准库函数、异常处理，以及如何把脚本改造成可复用、可测试、可从命令行调用的程序。它延续前一节文件处理内容，将 `pcost.py` 逐步重构为函数式、健壮且更接近真实使用场景的程序。

## 核心内容

### 自定义函数

函数用于封装可复用代码。一个函数通常包含：

- `def` 关键字定义函数
- 参数列表接收输入
- 函数体执行任务
- `return` 显式返回结果
- 可选的文档字符串说明用途

示例：

```python
def sumcount(n):
    '''
    Returns the sum of the first n integers
    '''
    total = 0
    while n > 0:
        total += n
        n -= 1
    return total
```

调用函数：

```python
a = sumcount(100)
```

函数是组织较大程序的重要方式，也是代码复用和测试的基础。相关主题可扩展为 python functions、code reuse。

### 文档字符串

如果函数的第一条语句是字符串，它会成为函数的文档字符串，可以通过 `help()` 查看。

```python
def greeting(name):
    'Issues a greeting'
    print('Hello', name)
```

这体现了 Python 中“代码即文档”的轻量实践，可关联 documentation。

## 标准库函数与模块

Python 自带大型标准库，通过 `import` 使用模块中的函数和对象。

示例：

```python
import math
x = math.sqrt(10)

import urllib.request
u = urllib.request.urlopen('http://www.python.org/')
data = u.read()
```

本文只做简要介绍，后续会更深入讨论模块和库。这里强调标准库可以避免重复造轮子，是 Python 实用性的核心来源之一。相关主题：python standard library、modules and imports。

## 错误与异常

函数通过异常报告错误。未处理的异常会中断函数执行，甚至导致整个程序停止。

示例：

```python
>>> int('N/A')
Traceback (most recent call last):
File "<stdin>", line 1, in <module>
ValueError: invalid literal for int() with base 10: 'N/A'
```

异常信息通常包含：

- 发生了什么错误
- 错误发生的位置
- traceback，即导致错误的一系列函数调用路径

这些信息对调试非常重要。相关主题：python exceptions、debugging。

## 捕获和处理异常

异常可以用 `try-except` 捕获并处理。

```python
for line in file:
    fields = line.split(',')
    try:
        shares = int(fields[1])
    except ValueError:
        print("Couldn't parse", line)
```

要注意：`except` 后的异常名称必须匹配实际可能发生的错误类型，例如 `ValueError`。

本文指出，在实际编程中，很难提前知道所有可能发生的错误。异常处理经常是在程序崩溃后补充的，即发现“忘了处理某类错误”之后再修正。相关主题：error handling、robust programming。

## 抛出异常

可以用 `raise` 主动抛出异常。

```python
raise RuntimeError('What a kerfuffle')
```

如果没有被 `try-except` 捕获，程序会终止并显示 traceback。

这说明异常不仅是系统自动产生的错误机制，也可以作为程序设计中的显式错误报告工具。相关主题：exception raising。

## 练习与实践路径

### 练习 1.29：定义函数

要求定义简单的 `greeting(name)` 函数，理解：

- 函数定义
- 参数传递
- 函数调用
- 文档字符串
- `help()` 查看函数说明

### 练习 1.30：把脚本改造成函数

将前一节中的 `pcost.py` 脚本改造成：

```python
def portfolio_cost(filename):
    ...
```

该函数接收文件名，读取投资组合数据，并返回总成本。

示例调用：

```python
cost = portfolio_cost('Data/portfolio.csv')
print('Total cost:', cost)
```

还可以通过交互模式测试：

```bash
python3 -i pcost.py
```

然后调用：

```python
>>> portfolio_cost('Data/portfolio.csv')
44671.15
```

这一练习强调：将脚本逻辑封装为函数后，代码更容易测试、复用和调试。相关主题：script to function、interactive testing。

### 练习 1.31：错误处理

当输入文件包含缺失字段时，程序可能崩溃：

```python
ValueError: invalid literal for int() with base 10: ''
```

练习要求修改 `pcost.py`：

- 捕获异常
- 打印警告信息
- 跳过坏数据行
- 继续处理剩余文件

这里引入了处理脏数据的两种策略：

1. 清理原始输入文件
2. 修改程序，使其能容忍并处理坏数据

这与现实数据处理高度相关，可关联 data cleaning、fault tolerance。

### 练习 1.32：使用 `csv` 标准库

推荐使用 Python 的 `csv` 模块处理 CSV 文件，而不是手动 `split(',')`。

示例：

```python
import csv
f = open('Data/portfolio.csv')
rows = csv.reader(f)
headers = next(rows)
```

`csv` 模块可以处理许多底层细节，例如：

- 正确拆分逗号分隔字段
- 处理引号
- 去除字段中的双引号
- 更可靠地解析 CSV 数据

这体现了使用标准库替代手写解析逻辑的价值。相关主题：csv processing、data parsing。

### 练习 1.33：从命令行读取参数

原始程序中输入文件名被硬编码：

```python
cost = portfolio_cost('Data/portfolio.csv')
```

练习要求改用 `sys.argv` 从命令行获取参数：

```python
import sys

if len(sys.argv) == 2:
    filename = sys.argv[1]
else:
    filename = 'Data/portfolio.csv'

cost = portfolio_cost(filename)
print('Total cost:', cost)
```

`sys.argv` 是命令行参数列表。这样程序既可以使用默认文件，也可以由用户指定输入文件。

运行方式：

```bash
python3 pcost.py Data/portfolio.csv
```

这一节把程序从“学习用脚本”推进到“可配置命令行工具”的形式。相关主题：command line arguments、python scripts。

## 关键思想

- 函数是组织、复用和测试代码的基本单位。
- `return` 用于明确给出函数结果。
- 文档字符串让函数具备内置说明。
- Python 标准库提供大量现成工具，应该优先使用。
- 异常是 Python 中报告和处理错误的主要机制。
- `try-except` 可以让程序在遇到坏数据时继续运行。
- `raise` 可以主动报告程序中的异常状态。
- 将脚本逻辑封装为函数后，可以更方便地交互测试。
- 使用 `csv` 模块比手动拆分 CSV 文本更可靠。
- 使用 `sys.argv` 可以让脚本接收命令行参数，减少硬编码。

## 与前后内容的关系

本文承接 [[summaries/06_Files]] 中的文件读取和投资组合成本计算示例，将其进一步封装为函数，并加入错误处理、标准库解析和命令行参数。它也为后续“处理数据”部分打下基础，尤其是围绕 CSV 文件、异常数据、可复用程序结构等主题。

## Related Concepts
- [[concepts/命令行参数]]
- [[concepts/函数]]
- [[concepts/异常处理]]
- [[concepts/CSV-数据处理]]
- [[concepts/模块与-import]]
- [[concepts/main-函数与脚本结构]]
- [[concepts/文件读写]]
- [[concepts/Python-交互式解释器]]
- [[concepts/Python-文档与帮助系统]]
- [[concepts/测试-日志与调试]]
- [[concepts/字符串处理]]
- [[concepts/Python-输入输出]]
