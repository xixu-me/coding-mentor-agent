---
doc_type: short
full_text: sources/01_Packages.md
---

# 9.1 Packages 总结

本文介绍如何把一组 Python 模块组织成包（package），以及包化后在导入、脚本运行和应用目录结构上的关键变化。核心主题包括：Python模块与包、Python导入机制、Python应用结构。

## 模块与包

任何 Python 源文件都是一个模块：

```python
# foo.py
def grok(a):
    ...
def spam(b):
    ...
```

使用 `import foo` 会加载并执行该模块，然后通过模块名访问其中的对象：

```python
import foo

a = foo.grok(2)
b = foo.spam('Hello')
```

当程序变大时，不适合把所有 `.py` 文件都放在顶层目录。更常见的做法是把相关模块放入一个包目录中：

```text
porty/
    __init__.py
    pcost.py
    report.py
    fileparse.py
```

创建包的基本步骤：

1. 选择一个包名并创建同名目录，例如 `porty/`。
2. 在目录中添加 `__init__.py`，该文件可以为空。
3. 把相关源文件放入该目录。

## 包作为导入命名空间

包会形成一个导入命名空间，因此导入路径变成多级形式：

```python
import porty.report
port = porty.report.read_portfolio('port.csv')
```

也可以使用其他导入写法：

```python
from porty import report
port = report.read_portfolio('portfolio.csv')

from porty.report import read_portfolio
port = read_portfolio('portfolio.csv')
```

这些写法体现了包在组织大型代码库时的价值：模块不再漂浮在顶层，而是归属于一个明确的命名空间。

## 包化后的两个常见问题

把文件移入包目录后，通常会遇到两个问题：

1. 同一个包内部模块之间的导入会失效。
2. 直接运行包内模块作为主脚本会失效。

这两个问题都与 Python导入机制 和 `sys.path` 有关。

## 问题一：包内导入必须调整

假设目录结构如下：

```text
porty/
    __init__.py
    pcost.py
    report.py
    fileparse.py
```

原先在 `report.py` 中可能写：

```python
import fileparse
```

包化后，这种写法会失败，因为 `fileparse` 不再是顶层模块，而是 `porty` 包中的子模块。

应改成绝对导入：

```python
from porty import fileparse
```

或者使用包相对导入：

```python
from . import fileparse
```

如果原来写的是：

```python
from fileparse import parse_csv
```

则可改成：

```python
from .fileparse import parse_csv
```

相对导入使用 `.` 表示当前包，优点是包名将来改变时，内部导入不需要全部重写。

## 问题二：不能直接运行包内脚本

包化后，直接运行包内模块通常会失败：

```bash
python porty/pcost.py
```

原因是此时 Python 把该文件当作单独脚本运行，不能正确识别它所在的包结构，`sys.path` 和包上下文不符合预期，导致导入失败。

正确做法是使用 `-m` 以模块方式运行：

```bash
python -m porty.pcost
```

如果需要传入参数，也可以这样运行：

```bash
python3 -m porty.report portfolio.csv prices.csv txt
```

这会让 Python 按照包模块路径解析 `porty.report`，从而正确处理包内导入。

## `__init__.py` 的作用

`__init__.py` 的主要作用是把包内模块“缝合”在一起，并决定包顶层暴露哪些名称。

例如：

```python
# porty/__init__.py
from .pcost import portfolio_cost
from .report import portfolio_report
```

这样使用者可以直接从包顶层导入函数：

```python
from porty import portfolio_cost
portfolio_cost('portfolio.csv')
```

而不必写成：

```python
from porty import pcost
pcost.portfolio_cost('portfolio.csv')
```

因此，`__init__.py` 不只是包标记文件，也可以作为包的公共接口入口。

## 顶层脚本方案

虽然 `python -m package.module` 是推荐方式，但对用户来说可能不够自然。另一种做法是在包外创建一个顶层脚本，由它调用包内逻辑。

例如：

```python
#!/usr/bin/env python3
# pcost.py
import porty.pcost
import sys
porty.pcost.main(sys.argv)
```

或：

```python
#!/usr/bin/env python3
# print-report.py
import sys
from porty.report import main
main(sys.argv)
```

顶层脚本应放在包目录外：

```text
pcost.py       # 顶层脚本
porty/         # 包目录
    __init__.py
    pcost.py
```

这样脚本负责处理命令行入口，包负责提供可复用的库代码。

## 推荐应用结构

本文推荐一种常见应用目录组织方式：

```text
porty-app/
  README.txt
  script.py         # 顶层脚本
  porty/
    __init__.py
    pcost.py
    report.py
    fileparse.py
```

其中：

- `porty-app/` 是整个应用的容器。
- `README.txt`、数据文件、示例、脚本等放在顶层。
- `porty/` 只放库代码。
- 顶层脚本位于包目录外部。

更完整的练习结构为：

```text
porty-app/
    portfolio.csv
    prices.csv
    print-report.py
    README.txt
    porty/
        __init__.py
        fileparse.py
        follow.py
        pcost.py
        portfolio.py
        report.py
        stock.py
        tableformat.py
        ticker.py
        typedproperty.py
```

这种结构清晰地区分了应用外壳和可复用库代码，是 Python应用结构 的重要实践。

## 练习 9.1：创建简单包

练习要求把已有程序和支持模块统一放入 `porty/` 包中：

```text
porty/
    __init__.py
    fileparse.py
    follow.py
    pcost.py
    portfolio.py
    report.py
    stock.py
    tableformat.py
    ticker.py
    typedproperty.py
```

然后删除旧的 `__pycache__`，重新测试导入：

```python
>>> import porty.report
>>> import porty.pcost
>>> import porty.ticker
```

如果导入失败，需要把原先的顶层导入改成包相对导入，例如：

```python
from . import fileparse
```

或：

```python
from .fileparse import parse_csv
```

## 练习 9.2：创建应用目录

练习要求创建 `porty-app/`，并把 `porty/` 包移动进去，同时复制测试数据和 README：

```text
porty-app/
    portfolio.csv
    prices.csv
    README.txt
    porty/
        __init__.py
        fileparse.py
        follow.py
        pcost.py
        portfolio.py
        report.py
        stock.py
        tableformat.py
        ticker.py
        typedproperty.py
```

运行时应位于 `porty-app/` 顶层目录：

```bash
cd porty-app
python3 -m porty.report portfolio.csv prices.csv txt
```

这体现了一个重要原则：运行包内模块时，要从应用顶层目录启动，并使用模块路径而非文件路径。

## 练习 9.3：创建顶层脚本

为避免用户直接使用 `python -m`，练习要求创建顶层脚本 `print-report.py`：

```python
#!/usr/bin/env python3
# print-report.py
import sys
from porty.report import main
main(sys.argv)
```

该脚本放在 `porty-app/` 顶层，运行方式为：

```bash
python3 print-report.py portfolio.csv prices.csv txt
```

最终形成的结构中，顶层脚本负责命令行入口，`porty/` 包负责业务逻辑。

## 关键结论

- Python 源文件是模块，目录加 `__init__.py` 可形成包。
- 包提供命名空间，使大型代码更容易组织。
- 包内模块之间的导入应使用包路径或相对导入。
- 不应直接用文件路径运行包内模块，应使用 `python -m package.module`。
- 可在包外创建顶层脚本，作为更友好的命令行入口。
- 应用目录应把库代码、脚本、数据和文档分层组织。
- `__init__.py` 可用于定义包的顶层公共接口。

相关概念：Python模块与包、Python导入机制、Python相对导入、Python命令行入口、Python应用结构。

## Related Concepts
- [[concepts/包与虚拟环境]]
- [[concepts/模块与-import]]
- [[concepts/main-函数与脚本结构]]
- [[concepts/库接口设计]]
- [[concepts/命令行参数]]
- [[concepts/Python-命名空间与作用域]]
- [[concepts/Python-开发环境]]
- [[concepts/课程练习工作流]]
- [[concepts/代码分发]]
