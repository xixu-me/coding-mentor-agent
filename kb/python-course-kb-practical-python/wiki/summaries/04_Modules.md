---
doc_type: short
full_text: sources/04_Modules.md
---

# 04_Modules 总结

## 核心主题

本文介绍 Python 中的Python模块：任何 `.py` 源文件都是一个模块；模块通过 `import` 加载和执行，并形成独立的命名空间。文档还说明了不同导入形式、模块加载缓存、模块搜索路径，以及如何把通用函数拆分到多个文件中复用。

## 模块与导入

- 任意 Python 源文件都可以作为模块，例如 `foo.py`。
- `import foo` 会加载并执行 `foo.py` 中的所有顶层语句。
- 导入后，需要通过模块名前缀访问其中的函数或变量：
  - `foo.grok(2)`
  - `foo.spam('Hello')`
- 模块名直接来自文件名：`foo.py` 对应模块名 `foo`。

## 模块是命名空间

模块是一组命名值的集合，也可以理解为一个命名空间。

- 模块中的全局变量、函数和类构成该模块的命名空间。
- 不同模块可以定义相同名称而不会冲突。
- 例如：
  - `foo.py` 中的 `x` 是 `foo.x`
  - `bar.py` 中的 `x` 是 `bar.x`

重要结论：**模块彼此隔离**。

## 模块作为执行环境

模块不仅是命名空间，也是其中代码的封闭环境。

```python
# foo.py
x = 42

def grok(a):
    print(x)
```

在这个例子中，`grok()` 使用的全局变量 `x` 绑定到它所在模块 `foo.py` 的全局作用域。每个源文件都是自己的“小宇宙”。

## 模块执行机制

导入模块时，Python 会从上到下执行模块中的所有语句，直到文件结束。

模块命名空间最终包含：

- 导入完成后仍存在的全局变量
- 函数定义
- 类定义
- 其他顶层赋值结果

因此，如果模块顶层包含打印、创建文件、运行计算等脚本语句，那么这些语句会在导入时立即运行。这一点与后续的Python主模块和 `if __name__ == '__main__'` 主题密切相关。

## `import as`

可以在导入时给模块取一个本地别名：

```python
import math as m
```

这只改变当前文件中引用模块的名字，不改变模块本身，也不改变模块加载机制。

常见用途：

- 缩短长模块名
- 避免命名冲突
- 遵循惯例，如 `import numpy as np`

## `from module import name`

可以从模块中导入特定名称到当前命名空间：

```python
from math import sin, cos
```

这样可以直接调用：

```python
cos(theta)
sin(theta)
```

而不必写：

```python
math.cos(theta)
math.sin(theta)
```

但需要注意：`from math import sin, cos` 仍然会加载整个 `math` 模块，只是在加载完成后把指定名称复制到当前作用域。

## 导入形式不会改变模块本质

以下导入方式在模块加载层面本质相同：

```python
import math
import math as m
from math import cos, sin
```

关键点：

- 模块仍然作为独立环境存在。
- 导入时仍会执行整个模块文件。
- `import as` 只是改变当前文件中的引用名。
- `from ... import ...` 只是把模块中的某些名称引入当前作用域。

## 模块只加载一次

Python 每个模块通常只加载并执行一次。重复导入不会重新执行模块文件，而是返回已加载模块的引用。

已加载模块保存在：

```python
sys.modules
```

`sys.modules` 是一个字典，记录当前解释器中已经加载的所有模块。

这会带来一个常见陷阱：

- 如果修改了模块源码后，在同一个 Python 解释器中再次 `import`，通常不会看到修改结果。
- 因为 Python 会直接使用 `sys.modules` 中缓存的旧模块。
- 最安全的做法是退出并重启解释器。

这与Python导入缓存相关。

## 模块搜索路径

Python 使用 `sys.path` 查找模块。

```python
import sys
sys.path
```

`sys.path` 是一个路径列表，通常当前工作目录位于最前面。

如果模块不在当前目录或标准库路径中，可以手动添加路径：

```python
import sys
sys.path.append('/project/foo/pyfiles')
```

也可以通过环境变量 `PYTHONPATH` 添加搜索路径：

```shell
env PYTHONPATH=/project/foo/pyfiles python3
```

不过，文档强调：一般不应频繁手动调整模块搜索路径。若出现导入问题，优先检查当前工作目录是否正确。

## 练习 3.11：模块导入

本练习要求在正确的工作目录中启动 Python 解释器，并导入之前写过的程序。

示例：

```python
import bounce
import mortgage
import report
```

重点观察：导入模块会运行其中的顶层代码，因此会看到程序输出。

随后导入 `fileparse` 模块：

```python
import fileparse
help(fileparse)
dir(fileparse)
```

并使用其中的 `parse_csv()` 函数读取数据：

```python
portfolio = fileparse.parse_csv(
    'Data/portfolio.csv',
    select=['name','shares','price'],
    types=[str,int,float]
)
```

也可以使用：

```python
from fileparse import parse_csv
```

这样就能直接调用：

```python
portfolio = parse_csv(...)
```

该练习强调代码复用：把通用 CSV 解析逻辑放入 `fileparse.py`，供其他程序导入使用。

## 练习 3.12：使用库模块改造 `report.py`

本练习要求修改之前的 `report.py`，让输入文件处理逻辑使用 `fileparse.parse_csv()`。

需要改造的函数包括：

- `read_portfolio()`
- `read_prices()`

目标是：

- 保持原有报表输出不变。
- 去除重复的 CSV 解析代码。
- 将通用解析逻辑集中在 `fileparse.py` 中。

这体现了模块化设计的基本思想：通用功能抽取成库模块，业务程序通过导入使用。

## 练习 3.13

此练习有意留空，跳过。

## 练习 3.14：更多库导入

本练习要求修改 `pcost.py`，使其使用 `report.read_portfolio()` 来读取投资组合数据。

原目标功能：

```python
import pcost
pcost.portfolio_cost('Data/portfolio.csv')
```

返回：

```python
44671.15
```

修改后，`pcost.py` 不再重复实现读取投资组合的逻辑，而是复用 `report.py` 中已有的 `read_portfolio()`。

## 最终程序结构

完成练习后，应形成三个相互协作的程序：

1. `fileparse.py`
   - 包含通用函数 `parse_csv()`。
   - 负责通用 CSV 文件解析。

2. `report.py`
   - 生成股票报表。
   - 包含 `read_portfolio()` 和 `read_prices()`。
   - 内部使用 `fileparse.parse_csv()`。

3. `pcost.py`
   - 计算投资组合成本。
   - 使用 `report.read_portfolio()`。

这种结构展示了从脚本式程序逐渐走向Python模块化编程的过程。

## 关键结论

- `.py` 文件就是模块。
- `import` 会执行整个模块文件。
- 模块形成独立命名空间，不同模块中的同名变量不会冲突。
- 模块中的全局变量绑定到其所在文件。
- `import as` 只是在当前文件中改名。
- `from module import name` 只是把模块中的名称复制到当前命名空间。
- 模块通常只加载一次，缓存于 `sys.modules`。
- Python 通过 `sys.path` 查找模块。
- 正确的工作目录对导入本地模块非常重要。
- 通过模块可以把通用函数抽取出来，实现更好的代码复用和程序组织。

## Related Concepts
- [[concepts/Python-命名空间与作用域]]
- [[concepts/模块与-import]]
- [[concepts/包与虚拟环境]]
- [[concepts/课程练习工作流]]
- [[concepts/函数]]
- [[concepts/CSV-数据处理]]
- [[concepts/文件读写]]
- [[concepts/Python-文档与帮助系统]]
- [[concepts/Python-交互式解释器]]
- [[concepts/main-函数与脚本结构]]
