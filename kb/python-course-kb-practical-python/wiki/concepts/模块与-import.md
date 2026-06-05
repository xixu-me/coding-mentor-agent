---
sources: [summaries/07_Objects.md, summaries/09_Packages__00_Overview.md, summaries/03_Program_organization__00_Overview.md, summaries/Contents.md, summaries/03_Distribution.md, summaries/02_Third_party.md, summaries/01_Packages.md, summaries/02_Logging.md, summaries/01_Testing.md, summaries/05_Decorated_methods.md, summaries/04_Function_decorators.md, summaries/03_Producers_consumers.md, summaries/01_Dicts_revisited.md, summaries/02_Inheritance.md, summaries/01_Class.md, summaries/06_Design_discussion.md, summaries/05_Main_module.md, summaries/04_Modules.md, summaries/02_More_functions.md, summaries/01_Script.md, summaries/00_Overview.md, summaries/05_Collections.md, summaries/02_Containers.md, summaries/01_Datatypes.md, summaries/07_Functions.md, summaries/06_Files.md, summaries/04_Strings.md, summaries/03_Numbers.md, summaries/01_Python.md, summaries/00_Setup.md]
brief: 模块与 import 是 Python 组织代码、查找依赖并复用库的核心机制。
---

# 模块与 import

## 概念概述

在 Python 中，**模块**通常就是一个 `.py` 源文件，里面可以包含变量、函数、类以及可执行语句。`import` 是把其他模块、标准库或第三方库引入当前程序的机制。二者共同构成 Python 程序组织的基础，使代码可以从单个脚本逐步发展为多个文件协作的程序，并进一步演化为可维护、可复用、可分发的包结构。

[[summaries/04_Modules]] 明确指出：任何 Python 源文件都是一个模块；导入模块时，Python 会加载并执行该文件；模块自身形成一个独立的 命名空间。因此，模块与 `import` 不只是引用另一个文件的语法，而是 Python 组织程序、隔离名称、复用函数和管理多文件项目的核心机制。

[[summaries/05_Main_module]] 进一步补充了模块作为程序入口的另一面：Python 没有固定的 `main()` 函数，而是有**主模块**。启动解释器时传入的文件就是主模块；当一个文件作为主程序运行时，它的 `__name__` 会被设置为 `__main__`。这使同一个 `.py` 文件既可以作为命令行脚本运行，也可以作为库模块被 `import` 导入。

[[summaries/01_Packages]] 则把模块与 `import` 推进到更大的代码组织层面：当多个模块增长为一个应用时，通常不应继续把所有 `.py` 文件平铺在顶层目录，而应把相关模块放入包目录中，例如 `porty/`。包会形成新的导入命名空间，因此导入关系会从 `import report` 变成 `import porty.report`、`from porty import report` 或 `from . import fileparse`。这说明 `import` 不仅是跨文件复用语法，也是理解 Python包结构、Python项目组织、Python相对导入、Python命令行入口、[[concepts/代码分发]] 的基础。

[[summaries/02_Third_party]] 进一步把 `import` 放到 Python 生态系统中理解：除了本地模块和标准库模块，Python 还有大量第三方模块。第三方模块通常通过 PyPI 查找、通过 `pip` 安装，并被放入当前 Python 环境的 `site-packages` 目录。能否成功 `import` 一个模块，不仅取决于代码中写了什么，还取决于模块是否位于当前解释器的 `sys.path` 搜索路径中，以及第三方包是否安装在当前 Python 环境里。这使模块与 `import` 自然连接到 第三方模块、PyPI、pip、site packages、Python 虚拟环境 和 [[concepts/依赖管理]]。

在 [[summaries/00_Setup]] 所介绍的课程设置中，作者特别强调本课程不建议主要使用 Jupyter Notebook，而是建议在真实的文件系统、编辑器和终端环境中编写程序。其中一个重要原因就是课程会涉及函数、模块、`import` 语句、命令行运行、跨多个源文件的重构、包结构组织、第三方包安装和环境隔离。这些内容只有在实际创建 `.py` 文件、运行脚本、调整文件结构、创建虚拟环境时，才能得到充分练习。

## 为什么需要模块

随着程序变大，把所有代码都写在一个文件中会带来几个问题：

- 文件过长，难以阅读；
- 不同功能混杂在一起，难以维护；
- 相同逻辑容易被复制粘贴；
- 修改一处代码可能影响整个脚本；
- 测试和调试变得困难；
- 多个程序之间难以共享通用逻辑；
- 命令行入口、数据处理和业务计算混在一起，难以复用；
- 后续难以整理成包，也难以交给他人安装和使用。

模块化的目标是把程序拆成相对独立、职责清晰的部分。例如，一个文件负责读取数据，一个文件负责计算结果，另一个文件负责命令行运行逻辑。这样可以让程序结构更清楚，也方便在后续练习中进行重构。

这与 Python 程序组织 密切相关。函数负责在单个文件内部组织可复用逻辑，而模块负责在多个文件之间组织可复用逻辑。当模块数量继续增加时，就需要进一步考虑 Python包结构：如何把相关模块放在同一个包中，如何设计清晰的导入关系，如何让项目能被他人理解、安装和复用。

[[summaries/07_Functions]] 中把 `pcost.py` 的脚本代码改造成 `portfolio_cost(filename)` 函数，是从脚本式代码走向模块化代码的第一步；[[summaries/04_Modules]] 中进一步要求把 CSV 解析逻辑放入 `fileparse.py`，让 `report.py` 和 `pcost.py` 通过导入复用它；[[summaries/05_Main_module]] 则要求把脚本入口整理成 `main(argv)`，使程序既可导入测试，也可从命令行运行；[[summaries/01_Packages]] 最后要求把这些松散文件整理进 `porty/` 包，并调整导入方式，使项目结构更接近真实应用。

## 模块就是源文件

一个 Python 源文件就是一个模块。例如：

```python
# foo.py
def grok(a):
    ...

def spam(b):
    ...
```

另一个程序可以导入它：

```python
# program.py
import foo

a = foo.grok(2)
b = foo.spam('Hello')
```

模块名通常直接来自文件名：

- `foo.py` 对应模块名 `foo`；
- `report.py` 对应模块名 `report`；
- `fileparse.py` 对应模块名 `fileparse`；
- `pcost.py` 对应模块名 `pcost`。

导入后，通常通过 `模块名.名称` 的方式访问模块中的函数、变量或类。这种写法清楚地说明名称来自哪个模块，也能减少不同文件之间的命名冲突。

## import 的基本作用

`import` 语句用于在一个 Python 文件中使用另一个 Python 文件或库中的代码。例如：

```python
import math

print(math.sqrt(16))
```

这里 `math` 是 Python 标准库中的模块，`sqrt()` 是该模块提供的平方根函数。导入模块后，通过 `math.sqrt()` 访问其中的函数。

也可以导入自己编写的模块：

```python
import report

report.print_report()
```

如果当前目录中有一个 `report.py` 文件，Python 就可以把它作为模块导入。课程练习通常要求学习者在 `Work/` 目录中创建程序文件，因此理解当前工作目录、文件位置和模块导入之间的关系非常重要。

在后续主题中，`import` 的作用会继续扩展：它不仅用于导入同一目录中的文件，也用于导入包中的模块、标准库模块和通过包管理工具安装的第三方模块。因此，理解 `import` 是理解 第三方模块、Python 标准库 和 [[concepts/依赖管理]] 的基础。

## 模块是命名空间

模块是一组命名值的集合，也可以理解为一个 命名空间。模块中的全局变量、函数和类构成该模块的命名空间。

例如，两个文件都可以定义变量 `x`：

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

这两个 `x` 并不是同一个变量：

- `foo.py` 中的是 `foo.x`；
- `bar.py` 中的是 `bar.x`。

因此，不同模块可以使用相同名称而不会互相冲突。核心结论是：**模块是隔离的**。

包结构本质上是在更高层次上继续利用这种隔离机制：把多个相关模块组织到一个命名空间层级中。例如，`report.py` 放在 `porty/` 包中以后，它的完整模块名可以是 `porty.report`，而不是顶层的 `report`。这让大型项目更容易避免命名冲突，也让代码来源更清楚。

## 模块也是执行环境

模块不仅是命名空间，也是其中代码的封闭执行环境。模块中的全局变量绑定到该模块自身，而不是绑定到导入它的文件。

例如：

```python
# foo.py
x = 42

def grok(a):
    print(x)
```

这里 `grok()` 中引用的 `x` 是 `foo.py` 里的全局变量。即使其他文件也定义了 `x`，也不会改变 `foo.grok()` 使用的变量。

可以把每个源文件理解为自己的独立执行世界：它有自己的全局作用域，有自己的名字集合，也有自己的执行上下文。这与 Python 变量作用域 和 命名空间 密切相关。

## 导入会执行整个模块

`import` 的一个关键事实是：**导入模块会执行模块文件中的所有顶层语句**。

也就是说，当执行：

```python
import foo
```

Python 会从上到下执行 `foo.py` 中的语句，直到文件结束。执行结束后，模块命名空间中保留下来的全局名称，就是该模块可供外部访问的内容。

因此，如果模块顶层包含打印、创建文件、计算结果或其他脚本语句，那么这些语句会在导入时立即运行。[[summaries/04_Modules]] 的练习要求学习者导入之前写过的 `bounce`、`mortgage`、`report` 等程序，并观察它们像直接运行一样产生输出，目的就是强调：**导入模块并不是只读取函数定义，它会运行顶层代码**。

这也是为什么可复用模块通常应该避免在顶层执行太多任务。更好的做法是：

- 把可复用逻辑放入函数；
- 顶层只保留必要的定义；
- 把命令行入口逻辑放入 `main()`；
- 使用 `if __name__ == '__main__'` 控制直接运行时才执行的语句。

这个主题与 Python 主模块、Python 脚本 和 命令行工具设计 密切相关。它也关系到后续的 [[concepts/代码分发]]：如果一个模块在被导入时就执行大量副作用，别人很难把它当作库来安全使用。

## import as：给模块取本地别名

可以在导入时给模块取一个本地别名：

```python
import math as m

def rectangular(r, theta):
    x = r * m.cos(theta)
    y = r * m.sin(theta)
    return x, y
```

`import math as m` 与 `import math` 的模块加载机制相同，只是当前文件中用 `m` 这个名字引用模块。

常见用途包括：

- 缩短较长的模块名；
- 避免当前文件中的名称冲突；
- 遵循社区惯例，例如 `import numpy as np`。

需要注意：别名只在当前文件中有效。它不会改变模块本身的名称，也不会改变其他文件导入该模块的方式。

## from module import name：导入特定名称

还可以从模块中导入某些名称到当前命名空间：

```python
from math import sin, cos

def rectangular(r, theta):
    x = r * cos(theta)
    y = r * sin(theta)
    return x, y
```

这样就可以直接写 `cos(theta)` 和 `sin(theta)`，不必写 `math.cos(theta)` 和 `math.sin(theta)`。

这种方式适合频繁使用少数几个名称的情况。但它也有代价：当前文件中名称来源不如 `模块名.名称` 明确，而且可能与本地名称冲突。

更重要的是，`from math import sin, cos` 并不表示 Python 只加载 `sin` 和 `cos`。模块仍然会作为整体加载和执行。导入完成后，Python 只是把模块中的 `sin` 和 `cos` 名称复制到当前命名空间。

## 不同导入形式不会改变模块本质

以下三种写法在模块加载层面本质相同：

```python
import math
import math as m
from math import cos, sin
```

它们的差异主要在于当前文件中如何引用名称，而不是模块如何工作。

关键点包括：

- `import` 总是加载并执行整个模块；
- 模块仍然是独立命名空间；
- `import module as name` 只是改变当前文件中的本地引用名；
- `from module import name` 只是把模块中的某些名称引入当前作用域；
- 导入形式不会取消模块的隔离性，也不会改变模块的全局变量绑定方式。

因此，学习 `import` 时不能只记语法，还要理解模块执行、命名空间、作用域、主模块入口、搜索路径和安装环境之间的关系。

## 模块只加载一次与 sys.modules

Python 中每个模块通常只加载并执行一次。重复执行同一个 `import` 语句时，Python 不会重新运行模块文件，而是返回已经加载过的模块对象。

已加载模块记录在 `sys.modules` 中：

```python
import sys
sys.modules
```

`sys.modules` 是一个字典，保存当前解释器中已经加载的模块。

这会带来一个常见困惑：如果你在交互式解释器中导入了某个模块，然后修改了它的源代码，再次执行 `import`，通常不会看到修改后的效果。因为 Python 会从 `sys.modules` 中返回缓存的旧模块。

在课程练习中，最安全的做法通常是：

- 修改模块源代码后，退出并重启 Python 解释器；
- 然后重新导入模块；
- 避免误以为代码没有保存或函数没有生效。

这个主题可以进一步连接到 Python 导入缓存 和 交互式测试。

## Python 如何查找模块：sys.path

Python 导入模块时，会按照搜索路径列表查找模块。这个列表保存在 `sys.path` 中：

```python
import sys
print(sys.path)
```

`sys.path` 通常包含：

- 当前工作目录或脚本相关目录；
- Python 标准库目录；
- 当前 Python 环境的 `site-packages` 目录；
- 通过环境变量或其他方式添加的路径。

如果要导入的模块不在这些目录中，就会触发 `ImportError` 或 `ModuleNotFoundError`。因此，很多“模块找不到”的问题并不是模块内容有错，而是解释器启动位置、包结构、环境选择或安装位置不正确。

当前工作目录通常位于搜索路径前面。因此，如果你在 `Work/` 目录中启动 Python，就可以直接导入同一目录下的 `fileparse.py`、`report.py`、`pcost.py` 等文件。

可以手动追加搜索路径：

```python
import sys
sys.path.append('/project/foo/pyfiles')
```

也可以通过环境变量 `PYTHONPATH` 添加路径：

```bash
env PYTHONPATH=/project/foo/pyfiles python3
```

不过，[[summaries/04_Modules]] 强调：一般不应频繁手动修改模块搜索路径。对课程练习而言，更推荐在正确的 `Work/` 目录中运行解释器和脚本。对真实项目而言，更推荐把代码整理成包、使用合适的运行方式或安装到环境中。

[[summaries/02_Third_party]] 也强调，`sys.path` 是理解第三方模块导入问题的关键。如果一个包已经安装但仍然无法导入，常见原因可能是：你正在运行的不是安装该包的那个 Python 解释器，或者该包所在的 `site-packages` 不在当前解释器的 `sys.path` 中。

## 查看模块实际加载位置

一个非常实用的调试技巧是：在 REPL 中导入模块后，直接查看模块对象。Python 通常会显示模块来自哪个文件路径。

例如标准库模块：

```python
>>> import re
>>> re
<module 're' from '/usr/local/lib/python3.x/re.py'>
```

第三方模块通常位于 `site-packages`：

```python
>>> import numpy
>>> numpy
<module 'numpy' from '/usr/local/lib/python3.x/site-packages/numpy/__init__.py'>
```

这可以用来回答几个重要问题：

- 当前导入的到底是哪一个模块？
- 是否导入了预期环境中的包？
- 是否有本地文件遮蔽了标准库或第三方库？
- 第三方包是否安装到了当前解释器可见的位置？

例如，如果当前目录中有一个名为 `re.py`、`csv.py` 或 `numpy.py` 的文件，可能会意外遮蔽标准库或第三方模块。查看模块路径可以快速发现这类问题。

## 标准库模块

Python 自带一个很大的标准库，常被称为“batteries included”。标准库提供了许多已经写好的模块，程序员可以通过 `import` 直接使用，避免重复造轮子。

例如使用数学函数：

```python
import math
x = math.sqrt(10)
```

又如访问网络资源：

```python
import urllib.request
u = urllib.request.urlopen('http://www.python.org/')
data = u.read()
```

标准库模块通常来自 Python 安装目录下的库目录，例如 `/usr/local/lib/python3.x/re.py`。可以通过查看模块对象确认实际位置。这里的 `python3.x` 是版本占位，实际路径取决于本机 Python 版本：

```python
import re
print(re)
```

这些例子说明，模块可以把复杂功能封装在一个命名空间下。用户只需要导入模块并调用其中的函数，不必关心底层实现细节。这与 Python 标准库、代码复用 密切相关。

## csv 模块：用库替代手写解析

在前面的文件处理练习中，CSV 文件可以通过字符串的 `split(',')` 手动拆分。但 [[summaries/07_Functions]] 推荐使用 Python 标准库中的 `csv` 模块：

```python
import csv

f = open('Data/portfolio.csv')
rows = csv.reader(f)
headers = next(rows)

for row in rows:
    print(row)

f.close()
```

`csv` 模块会处理很多底层细节，例如：

- 正确拆分逗号分隔字段；
- 处理字段中的引号；
- 去掉 CSV 中用于包裹文本的双引号；
- 避免简单 `split(',')` 在复杂数据上出错。

这体现了 `import` 的实际价值：当标准库已经提供可靠工具时，应优先导入并使用它，而不是手写脆弱的解析逻辑。这个主题连接到 [[concepts/CSV-数据处理]]、Python 文件处理 和 数据解析。

## 第三方模块

第三方模块是 Python 生态的重要组成部分。它们不是 Python 标准安装的一部分，而是由社区、公司或个人发布的额外包。通常可以在 Python Package Index，也就是 PyPI 中查找，也可以通过搜索具体主题找到相关库。

第三方模块和标准库模块一样使用 `import`：

```python
import numpy
import pandas
```

但不同之处在于：第三方模块通常需要先安装到当前 Python 环境中。安装后，它们一般位于该环境的 `site-packages` 目录中。

例如：

```python
>>> import numpy
>>> numpy
<module 'numpy' from '/usr/local/lib/python3.x/site-packages/numpy/__init__.py'>
```

这说明第三方模块问题本质上同时涉及三件事：

1. 代码中写了正确的 `import`；
2. 包已经安装；
3. 包安装在当前正在运行的 Python 解释器可见的路径中。

因此，第三方模块是 `import` 机制与 [[concepts/依赖管理]] 的交汇点。

## 使用 pip 安装第三方模块

安装第三方模块最常见的工具是 `pip`。推荐使用：

```bash
python3 -m pip install packagename
```

或在某个已激活的环境中使用：

```bash
python -m pip install pandas
```

这种写法比直接运行 `pip install ...` 更清楚，因为它明确表示：使用当前这个 `python` 对应的 `pip` 来安装包。这样可以减少“包安装到了另一个 Python 里”的混淆。

安装完成后，包通常会进入当前 Python 环境的 `site-packages`。如果安装成功但 `import` 失败，应检查：

- 当前运行的是不是同一个 Python；
- `python -m pip` 对应的解释器是否与运行程序的解释器一致；
- 模块所在目录是否出现在 `sys.path` 中；
- 是否在虚拟环境外安装、却在虚拟环境内运行，或反过来；
- 是否有同名本地文件遮蔽了第三方包。

## site-packages 与安装位置

`site-packages` 是 Python 环境中存放第三方包的常见目录。标准库通常在 Python 安装的库目录中，而第三方包通常在 `site-packages` 中。

这一区分很重要：

- 标准库通常随 Python 安装而来；
- 第三方模块通常由 `pip` 等工具安装；
- 当前 Python 环境可能有自己的 `site-packages`；
- 虚拟环境也会有独立的 `site-packages`。

因此，“我已经安装了这个包”并不一定意味着当前程序能导入它。更精确的问题应该是：**这个包是否安装到了当前正在运行的 Python 环境的 `site-packages` 中？**

这也是 [[summaries/02_Third_party]] 推荐通过查看模块对象来调试导入问题的原因。

## 虚拟环境与 import

安装第三方包时，经常会遇到权限、系统 Python、公司管理环境、依赖冲突等问题。例如：

- 使用的是操作系统自带的 Python；
- 使用的是公司批准的统一 Python 安装；
- 没有权限向全局 Python 安装包；
- 不同项目需要不同版本的依赖；
- 全局安装包可能污染其他项目。

常见解决方案是创建 Python 虚拟环境。使用标准库 `venv` 可以创建一个独立环境：

```bash
python -m venv mypython
```

激活后：

```bash
source mypython/bin/activate
```

提示符可能变成：

```text
(mypython) bash %
```

此时运行的 `python` 和 `pip` 会指向虚拟环境。安装第三方包：

```bash
python -m pip install pandas
```

包会安装到该虚拟环境自己的 `site-packages` 中，而不是系统 Python 的全局目录。随后，在该虚拟环境中运行 Python 才能直接 `import pandas`。

这说明，`import` 的结果依赖于当前环境。不同虚拟环境可以有不同版本的同一个包，也可以一个环境有某个包、另一个环境没有。因此，理解模块导入时必须同时理解当前 shell 激活了哪个环境、当前 `python` 命令指向哪里，以及包安装到了哪里。

## 第三方依赖与应用程序

如果只是实验和试用不同包，虚拟环境通常已经足够。但如果你正在开发一个应用程序，并且它依赖特定第三方包，问题会更复杂：

- 如何声明项目依赖哪些包；
- 如何记录依赖版本；
- 如何让别人复现同样的环境；
- 如何在部署时安装依赖；
- 如何避免不同项目之间的依赖冲突；
- 如何把自己的代码和依赖关系一起分发。

[[summaries/02_Third_party]] 没有给出固定方案，而是建议参考 Python Packaging User Guide，因为 Python 打包和依赖管理实践一直在演进。对本概念而言，关键原则是：`import` 看似是一行语法，但背后要求代码结构、安装环境、搜索路径和依赖声明彼此一致。

## 本地库模块：fileparse、report 与 pcost

[[summaries/04_Modules]] 的练习展示了本地模块如何协作。课程前面已经创建了一个通用 CSV 解析函数 `parse_csv()`，现在要把它放在 `fileparse.py` 中，并在其他程序中导入使用。

例如：

```python
import fileparse

portfolio = fileparse.parse_csv(
    'Data/portfolio.csv',
    select=['name', 'shares', 'price'],
    types=[str, int, float]
)
```

也可以只导入函数名：

```python
from fileparse import parse_csv

portfolio = parse_csv(
    'Data/portfolio.csv',
    select=['name', 'shares', 'price'],
    types=[str, int, float]
)
```

随后，`report.py` 应该复用 `fileparse.parse_csv()` 来实现：

- `read_portfolio()`；
- `read_prices()`。

再进一步，`pcost.py` 应该复用 `report.read_portfolio()` 来计算投资组合成本。

[[summaries/05_Main_module]] 在此基础上继续要求：`report.py` 和 `pcost.py` 应该各自拥有 `main(argv)` 函数，并通过 `if __name__ == '__main__'` 从命令行入口调用。这样它们既可以被导入测试：

```python
import pcost
pcost.main(['pcost.py', 'Data/portfolio.csv'])
```

也可以作为脚本运行：

```bash
python3 pcost.py Data/portfolio.csv
```

最终形成三个协作模块：

1. `fileparse.py`：提供通用的 `parse_csv()` 函数，负责 CSV 数据解析。
2. `report.py`：生成股票报表，同时提供 `read_portfolio()`、`read_prices()` 和 `main(argv)`，并使用 `fileparse.parse_csv()`。
3. `pcost.py`：计算投资组合成本，使用 `report.read_portfolio()`，并提供自己的 `main(argv)` 命令行入口。

这个结构体现了 代码复用 和 模块化设计：底层通用工具放在一个模块中，较高层程序通过导入使用它，而不是复制粘贴同样的解析逻辑。它也为后续学习包结构做准备：当本地模块越来越多时，就需要把相关模块进一步组织进包中。

## 从模块到包

模块是单个 `.py` 文件；包则是把多个相关模块组织在一起的更高层结构。[[summaries/01_Packages]] 给出的例子是把多个顶层文件：

```text
pcost.py
report.py
fileparse.py
```

整理成一个包目录：

```text
porty/
    __init__.py
    pcost.py
    report.py
    fileparse.py
```

创建包通常需要：

1. 选择一个包名，例如 `porty`；
2. 创建同名目录；
3. 在目录中添加 `__init__.py`，该文件可以为空；
4. 把相关源文件移动到包目录中。

包会成为新的导入命名空间。原来可能写：

```python
import report
```

包化后则可能写：

```python
import porty.report
port = porty.report.read_portfolio('portfolio.csv')
```

也可以写：

```python
from porty import report
port = report.read_portfolio('portfolio.csv')
```

或者：

```python
from porty.report import read_portfolio
port = read_portfolio('portfolio.csv')
```

从模块到包的动机包括：

- 模块数量增多后，需要分组管理；
- 不同功能需要更清晰的层次结构；
- 代码要被多个程序或多个项目复用；
- 项目需要安装到 Python 环境中；
- 代码准备交给别人使用；
- 项目需要声明第三方依赖；
- 命令行工具、库代码和测试代码需要分开组织。

因此，模块与 `import` 是包的基础。理解了单文件模块的导入、命名空间、执行时机、搜索路径、主模块入口和环境安装位置，才能进一步理解包中的模块如何互相引用，以及如何把项目整理成可分发的形式。

## 包内导入：绝对导入与相对导入

包化后，一个重要变化是：**同一包内部模块之间的导入不能再假设彼此都在顶层目录**。

例如，原来 `report.py` 和 `fileparse.py` 同在一个目录中时，可能写：

```python
import fileparse
```

但移动到包中以后：

```text
porty/
    __init__.py
    report.py
    fileparse.py
```

`fileparse` 不再是顶层模块，而是 `porty.fileparse`。因此在 `report.py` 中应改成包绝对导入：

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

包化后可以改为：

```python
from .fileparse import parse_csv
```

其中 `.` 表示当前包。这种写法的好处是，如果将来包名从 `porty` 改成别的名字，包内部导入不需要全部重写。

这一点是 Python相对导入 的核心：包内模块之间的依赖关系应明确表达为包内依赖，而不是依赖当前工作目录碰巧能找到某个同名文件。

## `__init__.py` 与包的公共接口

`__init__.py` 的基本作用是让目录成为包。在现代 Python 中，某些情况下即使没有 `__init__.py` 也可以形成命名空间包，但在课程语境中，创建普通包时应明确加入 `__init__.py`。

`__init__.py` 还可以用来把包内模块“缝合”起来，并定义包顶层暴露哪些名称。例如：

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

因此，`__init__.py` 不只是包标记文件，也可以作为包的公共接口入口。它让包的使用者不必了解内部所有模块文件名，只需使用包作者设计好的顶层 API。

## 主模块与 `__name__ == '__main__'`

许多语言有固定的主函数，例如 C/C++ 的 `main()` 或 Java 的 `public static void main()`。Python 没有强制规定的主函数，而是有**主模块**：

```bash
python3 prog.py
```

在这个命令中，`prog.py` 就是最先运行的源文件，也就是主模块。文件名不重要，启动解释器时传给 Python 的那个文件就是主模块。

Python 用模块全局变量 `__name__` 区分文件的运行方式：

- 如果文件被直接运行，`__name__ == '__main__'`；
- 如果文件被 `import` 导入，`__name__` 通常是模块名。

因此，标准写法是：

```python
if __name__ == '__main__':
    # 只在直接运行时执行
    ...
```

这让同一个文件可以有两种用途：

```bash
python3 prog.py      # 作为主程序运行
```

```python
import prog          # 作为库模块导入
```

通常不希望主程序逻辑在导入时自动执行。`if __name__ == '__main__'` 正是解决这个问题的惯用法。

## 包内脚本与 `python -m`

包化以后，主模块问题会多一层复杂性。直接运行包内文件通常会失败：

```bash
python porty/pcost.py
```

原因是 Python 此时是在运行一个单独文件，而不是以包模块身份运行 `porty.pcost`。这会导致包上下文和 `sys.path` 不正确，包内导入尤其是相对导入可能失效。

正确方式是使用 `-m` 选项，以模块路径运行：

```bash
python -m porty.pcost
```

或带参数运行：

```bash
python3 -m porty.report portfolio.csv prices.csv txt
```

这让 Python 从包命名空间中定位并执行模块，而不是把包内文件当作孤立脚本。这个主题连接到 Python命令行入口、Python 脚本 和 Python包结构。

## 常见程序模板

一个较规范的 Python 程序通常会把导入、函数定义和主入口分开：

```python
# prog.py
import modules

def spam():
    ...

def blah():
    ...

def main():
    ...

if __name__ == '__main__':
    main()
```

这种结构有几个优点：

- 模块导入时只定义函数，不立即运行主流程；
- 主流程集中在 `main()` 中，便于阅读；
- 可以在交互式环境或测试代码中直接调用函数；
- 可以避免导入模块时产生意外输出或副作用；
- 为命令行参数处理预留清晰入口；
- 为后续把代码整理成包、库或命令行工具打基础。

[[summaries/05_Main_module]] 推荐的命令行脚本模板进一步把参数列表传给 `main(argv)`：

```python
#!/usr/bin/env python3
# prog.py

import modules

def spam():
    ...

def blah():
    ...

def main(argv):
    # 解析命令行参数、环境变量等
    ...

if __name__ == '__main__':
    import sys
    main(sys.argv)
```

这种写法使 `main()` 可以在交互式解释器中手动调用，也可以在脚本直接运行时由 `sys.argv` 提供真实命令行参数。

## 命令行参数与 sys 模块

`sys` 是标准库中的一个重要模块。它提供与 Python 解释器和运行环境相关的功能，其中 `sys.argv` 用于读取命令行参数，`sys.path` 用于查看模块搜索路径，`sys.modules` 用于查看导入缓存。

例如：

```bash
python3 report.py portfolio.csv prices.csv
```

对应的参数列表是：

```python
sys.argv
# ['report.py', 'portfolio.csv', 'prices.csv']
```

常见处理方式如下：

```python
import sys

if len(sys.argv) != 3:
    raise SystemExit(f'Usage: {sys.argv[0]} portfile pricefile')

portfile = sys.argv[1]
pricefile = sys.argv[2]
```

要点包括：

- `sys.argv[0]` 是脚本名；
- 后续元素是用户输入的命令行参数；
- 命令行参数都是文本字符串；
- 参数数量错误时，可以用 `SystemExit` 显示用法并退出程序。

[[summaries/07_Functions]] 中较早展示了用 `sys.argv` 让 `pcost.py` 接受文件名；[[summaries/05_Main_module]] 则进一步要求把这种处理封装进 `main(argv)`，使程序可以这样交互式调用：

```python
import report
report.main(['report.py', 'Data/portfolio.csv', 'Data/prices.csv'])
```

也可以从命令行运行：

```bash
python3 report.py Data/portfolio.csv Data/prices.csv
```

这连接到 [[concepts/命令行参数]]、Python 脚本 和 [[concepts/课程练习工作流]]。

## 顶层脚本与包外入口

虽然 `python -m package.module` 是运行包内模块的正确方式，但对普通用户来说可能不够直观。[[summaries/01_Packages]] 提供了另一种做法：在包外创建一个顶层脚本，让它调用包内逻辑。

例如：

```python
#!/usr/bin/env python3
# print-report.py
import sys
from porty.report import main
main(sys.argv)
```

这个脚本应放在应用顶层目录，而不是包目录内部：

```text
porty-app/
    print-report.py
    porty/
        __init__.py
        report.py
        pcost.py
        fileparse.py
```

这样，`print-report.py` 负责命令行入口，`porty/` 负责可复用库代码。运行方式也更自然：

```bash
python3 print-report.py portfolio.csv prices.csv txt
```

这种结构体现了一个重要原则：**顶层脚本应位于包外，包内模块应主要作为库代码和可导入模块存在**。

## 标准输入输出、环境变量与程序退出

命令行脚本经常需要和操作系统环境交互。[[summaries/05_Main_module]] 将这些内容放在主模块主题下，说明模块化程序不仅要能被导入，还要能作为真实命令行工具运行。

标准输入输出对象位于 `sys` 模块中：

```python
sys.stdout
sys.stderr
sys.stdin
```

默认情况下：

- `print()` 输出到 `sys.stdout`；
- 输入从 `sys.stdin` 读取；
- traceback 和错误信息输出到 `sys.stderr`。

这些对象像普通文件一样工作，但可能连接到终端、文件或管道：

```bash
python3 prog.py > results.txt
cmd1 | python3 prog.py | cmd2
```

环境变量通过 `os.environ` 访问：

```python
import os

name = os.environ['NAME']
```

程序退出通常通过 `SystemExit` 或 `sys.exit()` 完成：

```python
raise SystemExit
raise SystemExit(1)
raise SystemExit('Informative message')
```

```python
import sys
sys.exit(1)
```

非零退出码通常表示错误。这些内容与 标准输入输出与管道、环境变量、程序退出码与错误处理 相关。

## shebang 与可执行脚本

在 Unix 系统中，可以在脚本第一行加入 `#!` 行，让系统知道用哪个解释器运行脚本：

```python
#!/usr/bin/env python3
```

然后赋予执行权限：

```bash
chmod +x prog.py
```

之后可以直接运行：

```bash
./prog.py
```

`#!/usr/bin/env python3` 会在环境路径中查找 `python3`。Windows 的 Python Launcher 也会查看 `#!` 行来判断语言版本。这个主题连接到 shebang与脚本执行 和 命令行工具设计。

## 应用目录结构

[[summaries/01_Packages]] 强调，只有一个包目录通常还不够。真实应用往往还包含数据文件、文档、示例、顶层脚本等内容。这些内容应该放在包目录之外。

一种常见结构是：

```text
porty-app/
    README.txt
    portfolio.csv
    prices.csv
    print-report.py
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

其中：

- `porty-app/` 是整个应用的容器；
- `porty/` 是包目录，只放库代码；
- `print-report.py` 是顶层脚本，位于包外；
- `portfolio.csv`、`prices.csv`、`README.txt` 等支持文件也位于包外。

运行代码时，应在应用顶层目录中启动 Python：

```bash
cd porty-app
python3 -m porty.report portfolio.csv prices.csv txt
```

或者运行包外脚本：

```bash
python3 print-report.py portfolio.csv prices.csv txt
```

这与 Python项目组织 和 Python应用结构 密切相关：代码组织不仅影响可读性，也直接影响导入是否成功、命令行入口是否可靠、项目是否容易交给他人使用。

## 函数、模块、包与可复用程序结构

模块化通常和函数化一起出现。一个常见的重构过程是：

1. 先把所有逻辑写在一个脚本中；
2. 再把重复或核心逻辑提取成函数；
3. 然后把函数放入可以被导入的模块；
4. 再把主流程放入 `main(argv)`；
5. 让一个较小的脚本入口负责命令行参数、环境变量、输入输出和退出码；
6. 当模块继续增多时，把相关模块组织成包；
7. 调整包内导入为绝对导入或相对导入；
8. 把顶层脚本、数据、文档放在包外的应用目录中；
9. 如果要交给他人使用，再考虑安装、第三方依赖和分发问题。

[[summaries/07_Functions]] 中的 `portfolio_cost(filename)` 就体现了第二步：

```python
def portfolio_cost(filename):
    ...
    return total_cost
```

函数化之后，程序不仅可以直接运行，也可以在交互模式中测试：

```bash
python3 -i pcost.py
```

然后调用：

```python
>>> portfolio_cost('Data/portfolio.csv')
44671.15
```

[[summaries/04_Modules]] 体现了后续步骤：把通用函数放进 `fileparse.py`，再让 `report.py` 和 `pcost.py` 导入使用。[[summaries/05_Main_module]] 则把脚本结构补齐：用 `main(argv)` 和 `__main__` 检查区分库导入与命令行运行。[[summaries/01_Packages]] 进一步说明，当这些模块增多后，应把它们整理成 `porty/` 包，并用 `python -m porty.module` 或包外顶层脚本来运行程序。[[summaries/02_Third_party]] 则继续说明，当程序依赖外部生态中的包时，还必须管理安装环境和第三方依赖。相关主题包括 Python 函数、脚本到函数的重构、交互式测试。

## 与异常处理的关系

模块和 `import` 本身并不直接处理错误，但导入标准库往往会配合异常处理来写出更健壮的程序。[[summaries/07_Functions]] 中，处理 CSV 投资组合文件时，如果某些字段缺失，转换整数可能引发 `ValueError`：

```python
try:
    shares = int(fields[1])
except ValueError:
    print('Could not parse', line)
```

在命令行脚本中，还需要处理参数数量错误、文件不存在、数据格式错误、模块路径错误等问题。[[summaries/05_Main_module]] 中展示的做法是：参数不正确时抛出 `SystemExit`，并给出用法说明。

包化和第三方依赖会带来新的导入错误，例如：

- 忘记把顶层导入改成包相对导入；
- 从错误的目录运行程序；
- 直接运行包内文件导致相对导入失败；
- 包目录中缺少 `__init__.py`；
- 本地模块名与标准库或第三方库重名；
- 第三方包没有安装；
- 包安装到了另一个 Python 环境；
- 虚拟环境没有激活；
- 当前解释器的 `sys.path` 中没有目标包所在目录。

模块化程序通常会把这些职责拆开：

- 数据读取模块负责读取和解析；
- 计算函数负责返回结果；
- 命令行脚本负责接收参数和显示输出；
- `main(argv)` 负责组织主流程；
- 包结构负责组织多个模块；
- 虚拟环境和依赖声明负责保证第三方模块可用；
- 异常处理逻辑负责在坏数据或错误输入时保持程序可理解、可诊断。

这连接到 错误处理、Python 异常 和 健壮程序设计。

## 与真实开发环境的关系

[[summaries/00_Setup]] 中明确指出，课程练习会涉及跨多个文件的源代码组织和重构，因此不推荐主要使用 Notebook。Notebook 适合探索和实验，但不太适合模拟真实的多文件项目结构。

学习模块与 `import` 时，需要熟悉以下操作：

- 使用编辑器创建多个 `.py` 文件；
- 在 shell 或终端中运行 Python 脚本；
- 理解程序运行时所在目录；
- 在同一目录或项目结构中导入其他模块；
- 使用标准库模块解决常见问题；
- 安装并导入第三方模块；
- 使用 `python -m pip install ...` 安装包；
- 使用虚拟环境隔离项目依赖；
- 使用 `help(module)` 查看模块文档；
- 使用 `dir(module)` 查看模块中定义的名称；
- 直接查看模块对象以确认加载路径；
- 随着代码增长，把函数从脚本中拆分到模块里；
- 用 `if __name__ == '__main__'` 避免导入时运行主程序；
- 用 `main(argv)` 让程序便于测试和命令行运行；
- 修改模块后重启解释器，避免导入缓存造成困惑；
- 在模块继续增多时，把相关模块组织成包；
- 包化后修正包内导入；
- 使用 `python -m package.module` 运行包内模块；
- 把顶层脚本放在包目录之外。

这些能力也与 [[concepts/课程练习工作流]]、Python 文件处理、Python项目组织 有关。

## 模块化与课程学习顺序

Practical Python Programming 的课程材料要求按章节顺序完成。原因之一是后续章节会建立在前面编写的代码基础上，并经常要求对已有代码做小幅重构。

这种重构往往会涉及模块和 `import`：

- 把原来写在一个脚本中的函数移动到单独模块；
- 让多个练习复用同一份函数代码；
- 将数据处理逻辑和命令行运行逻辑分离；
- 使用 `import` 避免重复复制代码；
- 使用标准库替代手写实现，例如用 `csv` 解析 CSV 文件；
- 使用 `sys.argv` 让脚本接受命令行参数；
- 使用 `fileparse.parse_csv()` 复用通用解析逻辑；
- 使用 `report.read_portfolio()` 复用投资组合读取逻辑；
- 为 `report.py` 和 `pcost.py` 添加 `main(argv)`；
- 使用 `if __name__ == '__main__'` 控制脚本入口；
- 调整文件结构以适应更复杂的程序；
- 把松散模块移动到 `porty/` 包中；
- 把 `import fileparse` 改成 `from . import fileparse` 或 `from .fileparse import parse_csv`；
- 使用 `python -m porty.report` 运行包内模块；
- 创建包外的 `print-report.py` 顶层脚本；
- 在课程结尾继续学习第三方模块安装、虚拟环境、依赖管理和代码分发。

因此，模块与 `import` 不只是语法知识，而是课程中逐步建立程序结构的重要工具。

## 与文件、仓库、环境和包结构的联系

课程建议学习者克隆或 fork 官方 GitHub 仓库，并在 `practical-python/Work/` 目录中完成所有编码工作。这个目录安排会影响模块导入和文件访问方式。

一个早期典型结构是：

```text
practical-python/
  Work/
    fileparse.py
    report.py
    pcost.py
    program.py
    Data/
      portfolio.csv
      prices.csv
```

在这种结构下，`program.py` 可以导入同一目录下的 `report.py`：

```python
import report
```

`report.py` 可以导入 `fileparse.py`：

```python
import fileparse
```

`pcost.py` 可以导入 `report.py`：

```python
import report
```

但在包化后的结构中，代码可能变成：

```text
porty-app/
    portfolio.csv
    prices.csv
    print-report.py
    README.txt
    porty/
        __init__.py
        fileparse.py
        report.py
        pcost.py
```

这时包外代码使用：

```python
from porty.report import main
```

包内代码则使用：

```python
from . import fileparse
```

或：

```python
from .fileparse import parse_csv
```

如果项目使用第三方包，还需要考虑当前运行环境。例如，使用 pandas 的程序可能只有在激活了相应虚拟环境并安装了 pandas 后才能运行：

```bash
source mypython/bin/activate
python -m pip install pandas
python myscript.py
```

因此，学习者需要同时理解：

- Python 如何通过 `sys.path` 查找模块；
- 程序如何定位数据文件；
- 从哪个目录运行脚本会影响相对路径；
- 标准库模块、本地模块、包内模块和第三方模块的区别；
- 导入模块会执行顶层代码；
- 主模块和普通导入模块的区别；
- 模块修改后可能因为缓存而没有立即重新加载；
- 项目目录结构如何支持代码组织；
- 什么时候需要从松散模块升级为包结构；
- 包内模块为什么不能再依赖旧的顶层导入方式；
- 第三方包是否安装在当前 Python 环境中；
- 虚拟环境如何改变 `python`、`pip`、`sys.path` 和 `site-packages`。

这也连接到 Git 与课程仓库管理，因为将代码保存在课程仓库中可以记录模块化、重构和项目组织过程中的历史变化。

## 学习时的注意点

学习模块与 `import` 时，应特别注意以下几点：

1. **模块名通常来自文件名**  
   例如 `report.py` 可以通过 `import report` 导入。

2. **导入会执行模块顶层代码**  
   如果模块顶层有 `print()`、文件写入或计算逻辑，导入时也会运行。

3. **模块是独立命名空间**  
   不同模块可以定义相同名称，例如 `foo.x` 和 `bar.x`，它们互不冲突。

4. **模块中的全局变量绑定到该模块**  
   函数内部引用的全局变量来自函数所在模块，而不是导入它的模块。

5. **标准库模块需要先导入再使用**  
   例如 `math.sqrt()` 需要先执行 `import math`，`csv.reader()` 需要先执行 `import csv`。

6. **第三方模块通常需要先安装再导入**  
   这涉及 第三方模块、pip 和 [[concepts/依赖管理]]。

7. **`import as` 只是本地改名**  
   它不会改变模块自身，也不会改变模块加载方式。

8. **`from module import name` 仍会加载整个模块**  
   它只是把指定名称复制到当前命名空间。

9. **不要把所有代码都留在顶层执行**  
   可复用逻辑通常应放入函数中，再由其他脚本导入调用。

10. **区分脚本、库模块和主模块**  
    同一个文件直接运行时是主模块，被导入时是普通库模块。

11. **使用 `if __name__ == '__main__'` 控制入口**  
    这样可以避免导入时运行命令行主流程。

12. **优先把主流程放入 `main(argv)`**  
    这样程序可以从命令行运行，也可以在交互式环境中传入测试参数。

13. **模块通常只加载一次**  
    修改模块源码后，在同一个解释器中重复 `import` 可能不会生效，必要时应重启解释器。

14. **注意当前工作目录和 `sys.path`**  
    很多找不到模块的问题，其实是因为 Python 不在正确目录中运行，或目标路径不在搜索路径中。

15. **用模块对象检查实际加载位置**  
    在 REPL 中查看 `re`、`numpy` 等模块对象，可以确认它来自标准库、`site-packages` 还是某个本地文件。

16. **优先使用标准库解决通用问题**  
    例如处理 CSV 文件时，`csv` 模块通常比手写 `split(',')` 更可靠。

17. **避免循环导入**  
    如果两个模块互相导入，程序结构可能变得混乱，甚至导致运行错误。

18. **在终端中运行程序更容易暴露真实问题**  
    例如模块找不到、相对路径错误、文件位置不正确、命令行参数缺失、虚拟环境未激活等问题，在真实项目环境中更容易被发现和理解。

19. **模块组织原则会影响后续打包和分发**  
    如果模块边界清晰、导入关系简单、入口逻辑明确，后续整理成包并交给他人使用会容易得多。

20. **包内导入需要包含包上下文**  
    包化后，`import fileparse` 往往应改为 `from . import fileparse` 或 `from .fileparse import parse_csv`。

21. **不要直接用文件路径运行包内模块**  
    `python porty/pcost.py` 可能破坏包上下文，应优先使用 `python -m porty.pcost`。

22. **顶层脚本应放在包外**  
    包目录保存库代码，应用顶层目录保存脚本、数据和文档。

23. **`__init__.py` 可以定义包的公共接口**  
    它可以从包内模块导入常用函数，让使用者从包顶层访问它们。

24. **使用 `python -m pip` 减少环境混淆**  
    这样能明确把包安装到当前 `python` 对应的环境中。

25. **虚拟环境会改变可导入的第三方包集合**  
    激活不同虚拟环境后，`sys.path` 和 `site-packages` 可能不同，导入结果也可能不同。

## 核心意义

模块与 `import` 是从写一个脚本走向组织一个程序的关键。它们让代码可以被拆分、复用、测试和重构，也让程序能够直接利用 Python 标准库和第三方生态中的大量现成工具。

在 Practical Python Programming 的学习路径中，`import` 先表现为使用标准库函数，例如 `math.sqrt()`、`csv.reader()`、`sys.argv`；随后表现为跨文件组织自己编写的函数和模块，例如 `fileparse.parse_csv()`、`report.read_portfolio()` 和 `pcost.portfolio_cost()`；再与主模块、`main(argv)`、`__name__ == '__main__'` 结合，使同一份代码既能被导入复用，又能作为命令行脚本运行；随后通向包结构、包内相对导入、`__init__.py`、`python -m package.module` 和顶层脚本；最后还会连接到第三方模块、PyPI、`pip`、`site-packages`、虚拟环境、依赖管理和代码分发。

掌握模块与 `import`，意味着理解 Python 如何执行文件、如何隔离名称、如何查找模块、如何缓存已导入模块、如何区分导入和直接运行、如何让多个源文件协同工作、如何把多个模块组织成包、如何确认模块实际加载位置，以及如何保证标准库、本地代码和第三方依赖都能被当前 Python 环境正确找到。这是把简单脚本逐步改造成结构清晰、可测试、可复用、可从命令行运行，并最终可组织成包、可交付给他人使用的程序的基础。

## See also

- [[summaries/01_Python]]
- [[summaries/03_Numbers]]
- [[summaries/04_Strings]]
- [[summaries/06_Files]]
- [[summaries/07_Functions]]
- [[summaries/01_Datatypes]]
- [[summaries/02_Containers]]
- [[summaries/05_Collections]]
- [[summaries/00_Overview]]
- [[summaries/01_Script]]
- [[summaries/02_More_functions]]
- [[summaries/04_Modules]]
- [[summaries/05_Main_module]]
- [[summaries/06_Design_discussion]]
- [[summaries/01_Class]]
- [[summaries/02_Inheritance]]
- [[summaries/01_Dicts_revisited]]
- [[summaries/03_Producers_consumers]]
- [[summaries/04_Function_decorators]]
- [[summaries/05_Decorated_methods]]
- [[summaries/01_Testing]]
- [[summaries/02_Logging]]
- [[summaries/01_Packages]]
- [[summaries/02_Third_party]]

See also: [[summaries/03_Distribution]]

See also: [[summaries/Contents]]

See also: [[summaries/03_Program_organization__00_Overview]]

See also: [[summaries/09_Packages__00_Overview]]

See also: [[summaries/07_Objects]]
