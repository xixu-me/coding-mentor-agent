---
sources: [summaries/09_Packages__00_Overview.md, summaries/03_Program_organization__00_Overview.md, summaries/Contents.md, summaries/01_Packages.md, summaries/02_Logging.md, summaries/01_Testing.md, summaries/02_Customizing_iteration.md, summaries/02_Inheritance.md, summaries/06_Design_discussion.md, summaries/05_Main_module.md, summaries/04_Modules.md, summaries/01_Script.md, summaries/00_Overview.md, summaries/07_Functions.md]
brief: 说明如何用 main(argv)、入口保护和包外脚本组织可复用 Python 命令行程序。
---

# main 函数与脚本结构

“main 函数与脚本结构”指的是把 Python 程序组织成清晰的几层：可复用的函数定义、组合业务流程的顶层函数、处理运行环境的 `main()` 或 `main(argv)`，以及只在脚本被直接运行时触发的入口逻辑。随着程序从单文件脚本发展为模块、包和应用目录，良好的入口结构还需要处理包内模块的运行方式、顶层脚本的位置、命令行参数、日志配置、退出码和导入副作用。

这个主题贯穿了从简单脚本到可维护应用的演变过程：[[summaries/07_Functions]] 展示了把固定脚本改造成可传参函数的第一步；[[summaries/01_Script]] 强调应把计算、读取、输出等主要操作都封装成函数；[[summaries/05_Main_module]] 说明 Python 没有固定的 `main` 函数，而是通过“主模块”、`__name__ == '__main__'`、`sys.argv`、标准输入输出、环境变量和退出码来构造完整脚本入口；[[summaries/02_Logging]] 补充了入口层的诊断职责：日志系统通常应在主程序启动阶段统一配置；[[summaries/01_Packages]] 则进一步说明，当代码被组织进包后，包内模块不应直接用文件路径运行，而应使用 `python -m package.module` 或包外顶层脚本启动。

相关主题包括 python functions、code reuse、python scripts、模块化编程、函数抽象、Python模块与导入机制、Python程序入口、命令行工具设计、Python日志记录、程序诊断、关注点分离、Python模块与包、Python导入机制、Python相对导入、Python命令行入口 和 Python应用结构。

## 核心思想

Python 很容易写成一个从上到下执行语句的脚本：

```python
statement1
statement2
statement3
```

这种方式适合短小实验，但程序增长后会出现问题：功能缠在一起、重复代码增多、难以测试、难以复用、导入文件时会意外执行代码，包化后还可能因为运行方式错误导致导入失败。

更好的做法是：

1. 把主要计算逻辑封装进函数。
2. 把读取数据、生成报告、打印输出等任务分别组织成函数。
3. 用一个顶层业务函数组合完整流程。
4. 用 `main()` 或 `main(argv)` 处理脚本入口、命令行参数、环境变量、日志配置和退出状态。
5. 用 `if __name__ == '__main__':` 确保入口逻辑只在直接运行时执行。
6. 避免把输入文件名、运行配置、日志输出策略等值永久写死在业务函数内部。
7. 让同一个文件既可以作为脚本运行，也可以在交互环境或其他程序中导入和调用。
8. 如果代码位于包中，使用 `python -m package.module` 或包外顶层脚本启动，而不是直接运行包内 `.py` 文件。
9. 将库代码、顶层脚本、数据文件和文档分层放置，避免把应用入口和包内部实现混在一起。

这体现了 程序结构、code reuse、Python脚本与库的双重用途 和 Python应用结构 的核心原则。

## Python 没有固定 main 函数，但有主模块

许多语言有显式入口函数，例如 C/C++ 的：

```c
int main(int argc, char *argv[]) {
    ...
}
```

或 Java 的：

```java
class myprog {
    public static void main(String args[]) {
        ...
    }
}
```

这些 `main` 函数是程序启动后首先执行的入口。

Python 不要求定义一个特殊的 `main` 函数。Python 的入口概念是“主模块”（main module）：启动解释器时传入的源文件或模块就是主模块。

直接运行文件：

```bash
python3 prog.py
```

此时 `prog.py` 是主模块。

以模块方式运行：

```bash
python3 -m porty.report
```

此时 `porty.report` 被作为主模块执行，但仍保留包上下文，因此更适合运行包内模块。

所以，在 Python 中，`main()` 不是语言强制要求的特殊函数，而是一种程序组织惯例。我们通常主动定义一个 `main()` 或 `main(argv)`，让脚本结构更清晰、更容易测试，也更容易与包结构配合。

## `__name__ == '__main__'`：直接运行与导入的分界线

Python 文件既可以直接运行，也可以被导入：

```bash
python3 prog.py
```

表示作为主程序运行。

```python
import prog
```

表示作为库模块导入。

在两种情况下，模块都有一个 `__name__` 变量：

- 如果文件被直接运行，`__name__` 会被设置为 `'__main__'`。
- 如果文件被 `import` 导入，`__name__` 通常是模块名，例如 `'prog'`。
- 如果包内模块通过 `python -m porty.report` 运行，它也会以主模块身份执行，但模块解析仍遵循包路径。

标准入口保护写法是：

```python
if __name__ == '__main__':
    statements
```

放在这个 `if` 块里的语句只会在脚本被直接运行时执行，不会在导入时执行。这一点非常重要：通常不希望模块一被导入就读取文件、打印报告、启动任务、配置全局日志或退出进程。

更常见的结构是：

```python
def main():
    ...

if __name__ == '__main__':
    main()
```

对于命令行程序，更推荐：

```python
def main(argv):
    ...

if __name__ == '__main__':
    import sys
    main(sys.argv)
```

这种模式让文件被导入时只暴露函数、类和常量，而不会自动执行主程序逻辑。

## 从脚本到函数

在 [[summaries/07_Functions]] 中，`pcost.py` 的例子展示了一个典型重构过程：原本程序直接读取固定文件并计算投资组合成本，后来被改造成函数：

```python
def portfolio_cost(filename):
    ...
    # 读取文件并计算总成本
    ...
    return total_cost
```

然后在脚本底部调用：

```python
cost = portfolio_cost('Data/portfolio.csv')
print('Total cost:', cost)
```

这种结构的好处是：

- `portfolio_cost()` 可以被重复调用。
- 可以传入不同文件名，而不是只能处理一个固定文件。
- 可以在 Python 交互模式中测试函数。
- 程序的“计算逻辑”和“运行方式”开始分离。

例如使用：

```bash
python3 -i pcost.py
```

进入交互模式后，可以直接调用：

```python
>>> portfolio_cost('Data/portfolio.csv')
44671.15
```

这体现了 interactive testing 的价值：把代码封装成函数后，更容易单独测试和调试。

## 把所有主要操作都组织为函数

[[summaries/01_Script]] 进一步指出：如果脚本有用，它往往会继续增长，最后可能变成关键应用；如果不提前整理，程序会变成难以维护的“大团乱麻”。因此，应尽量把每个主要任务都放进函数中。

例如读取价格数据可以封装为：

```python
def read_prices(filename):
    prices = {}
    with open(filename) as f:
        f_csv = csv.reader(f)
        for row in f_csv:
            prices[row[0]] = float(row[1])
    return prices
```

这样同一逻辑可以用于多个输入：

```python
oldprices = read_prices('oldprices.csv')
newprices = read_prices('newprices.csv')
```

对报表程序来说，不仅数据读取应该是函数，计算和输出也应该是函数。例如可以把打印逻辑封装成：

```python
def print_report(report):
    headers = ('Name', 'Shares', 'Price', 'Change')
    print('%10s %10s %10s %10s' % headers)
    print(('-' * 10 + ' ') * len(headers))
    for row in report:
        print('%10s %10d %10.2f %10.2f' % row)
```

这样，脚本末尾就不再混杂表头格式化、循环打印、数据计算等细节，而只剩下更高层的调用关系。

## 顶层业务函数：把执行流程打包

在较好的脚本结构中，文件末尾不应包含大量计算语句，而应调用一个顶层业务函数。[[summaries/01_Script]] 中的 `report.py` 重构目标是创建：

```python
def portfolio_report(portfolio_filename, prices_filename):
    portfolio = read_portfolio(portfolio_filename)
    prices = read_prices(prices_filename)
    report = make_report(portfolio, prices)
    print_report(report)
```

然后文件最后只需要：

```python
portfolio_report('Data/portfolio.csv', 'Data/prices.csv')
```

这种顶层函数的价值在于，它把完整程序执行流程包装成一个可调用操作。于是同一程序可以很容易用于不同输入：

```python
portfolio_report('Data/portfolio2.csv', 'Data/prices.csv')
```

也可以批量运行：

```python
files = ['Data/portfolio.csv', 'Data/portfolio2.csv']
for name in files:
    print(f'{name:-^43s}')
    portfolio_report(name, 'Data/prices.csv')
    print()
```

这正是 code reuse 和 程序结构 的核心：底层函数完成具体任务，顶层函数组合这些任务，脚本入口只负责启动。

## main 函数的角色

虽然 Python 没有语言级别的 `main()` 要求，但在结构化脚本中，`main()` 通常扮演“入口控制器”的角色。它不一定负责核心业务算法，而是负责：

- 读取命令行参数。
- 检查参数数量和格式。
- 读取环境变量或配置。
- 初始化日志系统等全局运行设置。
- 调用核心函数或顶层业务函数。
- 打印结果。
- 报告错误。
- 决定程序退出状态。

一个基础版本可以写成：

```python
import sys

def portfolio_cost(filename):
    ...
    return total_cost

def main():
    if len(sys.argv) == 2:
        filename = sys.argv[1]
    else:
        filename = 'Data/portfolio.csv'

    cost = portfolio_cost(filename)
    print('Total cost:', cost)

if __name__ == '__main__':
    main()
```

更推荐的形式是让 `main()` 显式接收参数列表：

```python
def main(argv):
    if len(argv) != 2:
        raise SystemExit(f'Usage: {argv[0]} portfoliofile')
    filename = argv[1]
    cost = portfolio_cost(filename)
    print('Total cost:', cost)

if __name__ == '__main__':
    import sys
    main(sys.argv)
```

这种 `main(argv)` 写法有几个优势：

- `main()` 不直接依赖全局 `sys.argv`，更容易测试。
- 可以在交互环境中模拟命令行调用。
- 文件被导入时不会自动执行脚本逻辑。
- 命令行接口和核心业务逻辑分离得更清楚。
- 后续添加日志配置、环境变量读取、错误退出等入口逻辑时位置明确。
- 代码被放入包中后，包外顶层脚本也可以直接调用同一个 `main(argv)`。

例如 [[summaries/05_Main_module]] 中要求 `report.py` 支持：

```python
>>> import report
>>> report.main(['report.py', 'Data/portfolio.csv', 'Data/prices.csv'])
```

也要求 `pcost.py` 支持：

```python
>>> import pcost
>>> pcost.main(['pcost.py', 'Data/portfolio.csv'])
```

当这些模块被组织进包后，调用方式可能变成：

```python
>>> from porty import report
>>> report.main(['report.py', 'portfolio.csv', 'prices.csv', 'txt'])
```

这说明 `main(argv)` 不只是命令行入口，也是一种可测试、可复用、可被顶层脚本转发调用的程序接口。

## 包中的 main：不要直接运行包内文件

[[summaries/01_Packages]] 增加了一个重要约束：当代码被放入包目录后，直接用文件路径运行包内模块通常会破坏导入。

假设结构如下：

```text
porty/
    __init__.py
    pcost.py
    report.py
    fileparse.py
```

如果直接运行：

```bash
python porty/pcost.py
```

可能会失败。原因是 Python 此时把 `pcost.py` 当作单独脚本，而不是包 `porty` 中的模块来执行。解释器无法正确识别包上下文，`sys.path` 和相对导入都会出现问题。

正确做法是从包所在的上级目录运行模块：

```bash
python -m porty.pcost
```

或：

```bash
python3 -m porty.report portfolio.csv prices.csv txt
```

这样 Python 会按照模块路径解析 `porty.report`，包内导入也能正常工作。这是 Python命令行入口 和 Python导入机制 的关键实践。

## 包内导入与脚本结构

包化不仅影响运行方式，也影响模块之间的导入方式。原先单文件目录中可能写：

```python
import fileparse
```

包化后，`fileparse` 不再是顶层模块，而是包内模块。应改成绝对导入：

```python
from porty import fileparse
```

或包相对导入：

```python
from . import fileparse
```

如果原来写的是：

```python
from fileparse import parse_csv
```

包内可改为：

```python
from .fileparse import parse_csv
```

这与 main 函数的关系在于：一个模块如果希望既能被导入，又能作为包内命令运行，就必须避免依赖“当前工作目录刚好包含某个同名文件”的偶然条件。包内模块应该使用清晰的包路径或相对导入，并通过 `python -m package.module` 或包外入口脚本启动。

相关主题包括 Python模块与包、Python相对导入、modules and imports 和 Python模块与导入机制。

## 包外顶层脚本：更友好的命令行入口

虽然 `python -m package.module` 是运行包内模块的正确方式，但对最终用户来说可能不够自然。[[summaries/01_Packages]] 提供了另一种常见方案：在包外创建一个顶层脚本，由它调用包内模块的 `main(argv)`。

例如：

```python
#!/usr/bin/env python3
# print-report.py
import sys
from porty.report import main
main(sys.argv)
```

目录结构应类似：

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

运行方式：

```bash
cd porty-app
python3 print-report.py portfolio.csv prices.csv txt
```

这种模式把职责划分得很清楚：

- `print-report.py` 是命令行入口，负责处理启动形式。
- `porty.report.main(argv)` 是程序入口函数，负责参数和流程控制。
- `porty` 包内模块是可复用库代码。
- 数据文件、README、脚本等位于应用顶层，而不是包内部。

这体现了 命令行工具设计、Python应用结构 和 关注点分离。

## `__init__.py` 与顶层接口

在包结构中，`__init__.py` 可以为空，也可以用来整理包的公共接口。例如：

```python
# porty/__init__.py
from .pcost import portfolio_cost
from .report import portfolio_report
```

这样用户可以直接写：

```python
from porty import portfolio_cost
portfolio_cost('portfolio.csv')
```

而不必写：

```python
from porty import pcost
pcost.portfolio_cost('portfolio.csv')
```

不过，`__init__.py` 中应谨慎放置会产生副作用的代码。它适合导出函数、类和常量，不适合读取文件、启动程序或配置全局日志。真正的运行入口仍应放在 `main(argv)` 或包外脚本中。

## 日志配置属于入口层

[[summaries/02_Logging]] 为脚本结构补充了一个重要实践：普通模块可以发出日志，但日志行为通常应由主程序在启动阶段配置。

模块内部只需要创建 logger 并记录事件：

```python
import logging
log = logging.getLogger(__name__)

def parse_csv(...):
    ...
    try:
        row = [func(val) for func, val in zip(types, row)]
    except ValueError as e:
        log.warning("Row %d: Couldn't convert %s", rowno, row)
        log.debug("Row %d: Reason %s", rowno, e)
        continue
```

这里的 `fileparse.py` 只说明“发生了什么”：某一行不能转换、原因是什么。它不应该决定日志写到屏幕还是文件，也不应该决定默认显示 `DEBUG` 还是只显示 `WARNING`。

这些运行策略应放在程序入口处，例如：

```python
def main(argv):
    import logging
    logging.basicConfig(
        filename='app.log',
        filemode='w',
        level=logging.WARNING,
    )
    ...
```

或放在 `if __name__ == '__main__':` 保护块附近：

```python
if __name__ == '__main__':
    import sys
    import logging
    logging.basicConfig(level=logging.WARNING)
    main(sys.argv)
```

这种结构体现了 关注点分离：

- 库模块负责完成任务并发出诊断信息。
- 主程序负责决定诊断信息如何输出。
- 用户或部署环境可以调整日志级别、输出文件、消息格式等。

例如开发时可以打开调试信息：

```python
logging.getLogger('fileparse').setLevel(logging.DEBUG)
```

生产或安静模式下可以只保留严重错误：

```python
logging.getLogger('fileparse').setLevel(logging.CRITICAL)
```

因此，良好的 `main()` 不仅处理命令行参数，也常常是集中初始化运行配置的位置，包括日志、环境变量、默认文件名和退出策略。相关主题包括 Python日志记录、程序诊断、[[concepts/异常处理]] 和 模块化程序设计。

## 命令行参数与 `sys.argv`

命令行本质上是一组文本字符串。例如：

```bash
python3 report.py portfolio.csv prices.csv
```

在 Python 中，这些字符串保存在 `sys.argv` 中：

```python
sys.argv  # ['report.py', 'portfolio.csv', 'prices.csv']
```

通常：

- `sys.argv[0]` 是脚本名或模块启动名。
- `sys.argv[1:]` 是用户传入的参数。
- 参数数量不符合预期时，应给出用法说明并退出。

例如：

```python
import sys

if len(sys.argv) != 3:
    raise SystemExit(f'Usage: {sys.argv[0]} portfile pricefile')

portfile = sys.argv[1]
pricefile = sys.argv[2]
```

在结构化脚本中，这段逻辑通常放进 `main(argv)`：

```python
def main(argv):
    if len(argv) != 3:
        raise SystemExit(f'Usage: {argv[0]} portfile pricefile')
    portfile = argv[1]
    pricefile = argv[2]
    portfolio_report(portfile, pricefile)
```

相关主题包括 command line arguments、python standard library 和 命令行工具设计。

## 标准输入输出与脚本结构

命令行脚本经常需要和 shell 配合工作。Python 中的标准输入输出对象位于 `sys` 模块：

```python
sys.stdout
sys.stderr
sys.stdin
```

默认情况下：

- `print()` 输出到 `sys.stdout`。
- `input()` 从 `sys.stdin` 读取。
- traceback 和错误信息输出到 `sys.stderr`。

这些对象像普通文件一样工作，但它们可能连接到终端、文件、管道或其他进程。例如：

```bash
python3 prog.py > results.txt
```

或：

```bash
cmd1 | python3 prog.py | cmd2
```

因此，良好的脚本结构应当意识到输出不一定只显示在屏幕上。程序如果遵守标准输入输出约定，就更容易参与 shell 重定向和管道工作流。日志输出也应避免和正常数据输出混淆：普通结果通常走 `stdout`，错误或诊断信息通常走 `stderr` 或日志文件。相关主题包括 [[concepts/标准输入输出与管道]]。

## 环境变量与运行环境

脚本入口有时还需要读取环境变量。环境变量由 shell 设置，例如：

```bash
setenv NAME dave
setenv RSH ssh
python3 prog.py
```

在 Python 中可以通过 `os.environ` 访问：

```python
import os

name = os.environ['NAME']
```

`os.environ` 是类似字典的对象，保存当前进程环境变量。程序对环境变量的修改也会反映到之后由该程序启动的子进程中。

在脚本结构中，环境变量读取通常属于入口层或配置层，而不应散落在核心业务函数中。这样可以保持核心函数更接近“黑盒”：给定参数，返回结果。相关主题包括 环境变量 和 Python进程环境。

## 程序退出与退出码

命令行程序需要通过退出码告诉外部环境运行是否成功。Python 程序退出通常通过 `SystemExit` 完成：

```python
raise SystemExit
raise SystemExit(exitcode)
raise SystemExit('Informative message')
```

也可以使用：

```python
import sys
sys.exit(exitcode)
```

一般约定：

- 退出码 `0` 表示成功。
- 非零退出码表示错误。
- 字符串形式的 `SystemExit` 可用于显示提示信息。

这类逻辑通常应放在 `main()` 或入口层，而不是底层计算函数中。例如参数错误时：

```python
def main(argv):
    if len(argv) != 3:
        raise SystemExit(f'Usage: {argv[0]} portfile pricefile')
    ...
```

相关主题包括 程序退出码与错误处理、python exceptions 和 error handling。

## `#!` 行与可执行脚本

在 Unix 系统中，可以在脚本第一行加入 shebang：

```python
#!/usr/bin/env python3
```

完整脚本开头通常类似：

```python
#!/usr/bin/env python3
# prog.py
```

然后赋予可执行权限：

```bash
chmod +x prog.py
```

之后即可直接运行：

```bash
./prog.py
```

`#!` 行告诉系统用哪个解释器执行脚本。`#!/usr/bin/env python3` 会在当前环境路径中查找 `python3`，因此比写死解释器路径更灵活。Windows 的 Python Launcher 也会查看 `#!` 行来判断语言版本。

在包化应用中，shebang 通常用于包外顶层脚本，例如 `print-report.py`，而不是要求用户直接执行 `porty/report.py` 这样的包内文件。

相关主题包括 shebang与脚本执行 和 python scripts。

## 名称定义顺序与脚本结构

Python 中名称必须在实际使用前已经定义。变量和函数都遵循这一点：

```python
def square(x):
    return x*x

a = 42
b = a + 2
z = square(b)
```

因此，脚本通常采用如下布局：

1. 顶部导入模块。
2. 定义辅助函数和核心函数。
3. 定义顶层业务函数，如 `portfolio_report()`。
4. 定义入口函数，如 `main(argv)`。
5. 在文件末尾使用 `if __name__ == '__main__': main(sys.argv)`。

函数定义本身可以按不同顺序排列，只要在程序运行到调用语句之前，相关函数已经定义即可。常见风格是“自底向上”：先定义小而简单的构件，再定义依赖它们的高级函数，最后在末尾调用顶层函数。

```python
def read_prices(filename):
    ...

def make_report(portfolio, prices):
    ...

def print_report(report):
    ...

def portfolio_report(portfolio_filename, prices_filename):
    portfolio = read_portfolio(portfolio_filename)
    prices = read_prices(prices_filename)
    report = make_report(portfolio, prices)
    print_report(report)

def main(argv):
    if len(argv) != 3:
        raise SystemExit(f'Usage: {argv[0]} portfolio prices')
    portfolio_report(argv[1], argv[2])

if __name__ == '__main__':
    import sys
    main(sys.argv)
```

相关主题包括 自底向上设计 和 程序结构。

## 函数设计：黑盒、模块化与可预测性

[[summaries/01_Script]] 强调，理想函数应该像“黑盒”：

- 只依赖传入参数。
- 尽量避免全局变量。
- 避免神秘副作用。
- 相同输入应产生可理解、可预测的结果。

这使脚本更容易拆解、测试和组合。比如：

- `read_portfolio(filename)` 只负责读取投资组合。
- `read_prices(filename)` 只负责读取价格表。
- `make_report(portfolio, prices)` 只负责计算报表数据。
- `print_report(report)` 只负责输出格式化结果。
- `portfolio_report(portfolio_filename, prices_filename)` 负责组合完整流程。
- `main(argv)` 负责接收外部运行参数、初始化运行环境并启动程序。
- 包外脚本负责提供用户友好的命令行入口。

日志也是这种分工的例子：业务模块可以调用 `log.warning()` 或 `log.debug()` 描述诊断事件，但是否显示、写入哪个文件、最低级别是什么，应由入口层配置。这符合 模块化编程、可维护性 和 可预测性 的原则。

## 文档字符串与类型注解

良好的脚本结构不仅是拆函数，还包括让函数意图清楚。可以用文档字符串说明函数用途：

```python
def read_prices(filename):
    '''
    Read prices from a CSV file of name,price data
    '''
    ...
```

文档字符串会被 `help()`、IDE 和其他工具使用。好的文档字符串通常用一句话说明函数做什么，必要时补充参数说明和使用示例。

还可以添加可选类型注解：

```python
def read_prices(filename: str) -> dict:
    ...
```

类型注解不会改变运行行为，但能帮助 IDE、代码检查器和阅读者理解函数接口。相关主题包括 代码文档化、[[concepts/类型注解]] 和 静态分析。

## 为什么不要把所有代码写在顶层

如果把所有代码直接写在文件顶层，会带来几个问题：

- 文件一被导入就会执行计算或打印输出。
- 难以在其他程序中复用其中一部分逻辑。
- 难以针对核心计算写测试。
- 输入文件名等配置容易被硬编码。
- 读取、计算、输出等步骤容易混在一起。
- 日志配置、错误处理、命令行参数、环境变量等入口职责容易散落各处。
- 后续加入更多功能时结构会混乱。
- 很难把脚本变成稳定的命令行工具。
- 包化后直接运行包内文件容易破坏导入上下文。
- `__init__.py` 或普通模块中的顶层副作用会影响包的导入体验。

将程序拆成函数、顶层业务函数和入口逻辑，可以让代码更接近真实项目中的组织方式。即使最初只是短脚本，也应在功能增长时尽早重构。

## 与错误处理和日志的关系

脚本入口经常也是处理异常和配置诊断输出的合适位置之一。[[summaries/07_Functions]] 介绍了用 `try-except` 捕获错误，例如处理 CSV 文件中的坏数据：

```python
try:
    shares = int(fields[1])
except ValueError:
    print("Couldn't parse", line)
```

[[summaries/02_Logging]] 进一步指出，直接 `print()` 或完全 `pass` 都不够灵活。更好的方式是让模块记录不同级别的日志：

```python
except ValueError as e:
    log.warning("Couldn't parse : %s", line)
    log.debug("Reason : %s", e)
```

这样：

- 默认可以只看到 `WARNING` 及以上的消息。
- 调试时可以打开 `DEBUG` 查看详细原因。
- 生产环境中可以提高级别，只保留严重问题。
- 记录日志的代码和配置日志行为的代码保持分离。

在脚本结构中，异常处理可以有不同层次：

- 在底层函数中处理局部可恢复错误，例如跳过坏数据行。
- 在模块中用 logger 发出诊断信息，而不是直接决定输出策略。
- 在 `main()` 中处理影响整个程序运行的错误，例如文件不存在或参数错误。
- 在入口层配置日志输出位置、级别和格式。
- 对无法恢复的问题，可以用 `raise` 主动抛出异常。
- 对命令行参数错误，可以用 `raise SystemExit(...)` 给出提示并退出。

这与 python exceptions、error handling、robust programming、程序退出码与错误处理 和 Python日志记录 有关。

## 与标准库的关系

良好的脚本结构通常会结合标准库使用。例如：

- 用 `sys.argv` 读取命令行参数。
- 用 `sys.stdin`、`sys.stdout`、`sys.stderr` 参与标准输入输出。
- 用 `os.environ` 读取环境变量。
- 用 `logging` 记录和配置诊断信息。
- 用 `csv` 解析 CSV 文件。
- 用 `math`、`urllib.request` 等模块调用现成能力。

在 `pcost.py` 中，使用 `csv.reader()` 比手动 `split(',')` 更可靠，因为它能处理引号、逗号拆分等底层细节。相关主题包括 csv processing、data parsing、modules and imports 和 python standard library。

## 推荐脚本模板

一个通用 Python 程序模板可以写成：

```python
# prog.py

# Import statements
import modules

# Functions
def spam():
    ...

def blah():
    ...

# Main function
def main():
    ...

if __name__ == '__main__':
    main()
```

对于命令行脚本，更完整的模板是：

```python
#!/usr/bin/env python3
# prog.py

# Import statements
import modules

# Functions
def spam():
    ...

def blah():
    ...

# Main function
def main(argv):
    # Parse command line args, environment, logging, etc.
    ...

if __name__ == '__main__':
    import sys
    main(sys.argv)
```

如果程序需要日志，常见结构是：

```python
#!/usr/bin/env python3
import sys
import logging


def main(argv):
    logging.basicConfig(
        filename='app.log',
        level=logging.WARNING,
    )
    ...


if __name__ == '__main__':
    main(sys.argv)
```

这种结构综合了几个关键实践：

- 顶部集中导入依赖。
- 中间定义可复用函数。
- 小函数承担单一任务。
- 顶层函数组合完整流程。
- `main(argv)` 处理命令行参数和运行环境。
- 入口层集中处理日志配置等全局设置。
- `if __name__ == '__main__'` 控制脚本入口。
- 文件既能作为命令运行，也能作为库导入。

## 推荐包化应用模板

当程序增长为多模块应用时，可以采用 [[summaries/01_Packages]] 中的结构：

```text
porty-app/
    README.txt
    portfolio.csv
    prices.csv
    print-report.py      # 包外顶层脚本
    porty/               # 库代码包
        __init__.py
        pcost.py
        report.py
        fileparse.py
        portfolio.py
        stock.py
        tableformat.py
```

包内模块 `report.py` 可保持结构化入口：

```python
# porty/report.py
from . import fileparse


def portfolio_report(portfolio_filename, prices_filename, fmt='txt'):
    ...


def main(argv):
    if len(argv) != 4:
        raise SystemExit(f'Usage: {argv[0]} portfolio prices format')
    portfolio_report(argv[1], argv[2], argv[3])


if __name__ == '__main__':
    import sys
    main(sys.argv)
```

运行包内模块：

```bash
cd porty-app
python3 -m porty.report portfolio.csv prices.csv txt
```

或者通过包外脚本运行：

```python
#!/usr/bin/env python3
# print-report.py
import sys
from porty.report import main
main(sys.argv)
```

```bash
cd porty-app
python3 print-report.py portfolio.csv prices.csv txt
```

这个模板强调：

- 包内是库代码和可复用逻辑。
- 包外是用户入口、数据、文档和应用容器。
- 包内模块使用相对导入或包绝对导入。
- 包内模块用 `main(argv)` 暴露命令入口。
- 用户可用 `python -m package.module` 或包外脚本启动。

## 小结

main 函数与脚本结构的本质，是把脚本从“一串顶层语句”重构为“一组可复用函数 + 一个顶层业务流程 + 一个清晰入口”。函数负责完成具体任务，顶层函数负责组合任务，`main(argv)` 负责从外部环境接收输入、初始化运行配置、调用程序、输出结果并处理退出。

[[summaries/07_Functions]] 中的 `pcost.py` 展示了从硬编码脚本到可传参函数的转变；[[summaries/01_Script]] 进一步强调，应把读取、计算、输出等主要操作都组织为函数，并让程序末尾只保留顶层调用；[[summaries/05_Main_module]] 补全了 Python 主模块、`__name__ == '__main__'`、命令行参数、标准输入输出、环境变量、退出码和 shebang 等脚本运行机制；[[summaries/02_Logging]] 说明日志调用应分散在需要诊断的模块中，而日志配置应集中在主程序启动阶段；[[summaries/01_Packages]] 则把这个结构推进到包化应用：包内模块应使用正确导入方式，通过 `python -m package.module` 或包外顶层脚本运行，而不是直接执行包内文件。

这种结构能显著提升 Python 程序的复用性、可测试性、命令行可用性、诊断能力、包化兼容性和长期可维护性。

See also: [[summaries/00_Overview]]

See also: [[summaries/04_Modules]]

See also: [[summaries/05_Main_module]]

See also: [[summaries/06_Design_discussion]]

See also: [[summaries/02_Inheritance]]

See also: [[summaries/02_Customizing_iteration]]

See also: [[summaries/01_Testing]]

See also: [[summaries/02_Logging]]

See also: [[summaries/01_Packages]]

See also: [[summaries/Contents]]

See also: [[summaries/03_Program_organization__00_Overview]]

See also: [[summaries/09_Packages__00_Overview]]
