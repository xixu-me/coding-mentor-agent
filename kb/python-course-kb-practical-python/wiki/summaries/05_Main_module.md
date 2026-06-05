---
doc_type: short
full_text: sources/05_Main_module.md
---

# 05_Main_module 总结

本文介绍 Python 中“主程序/主模块”的概念，以及如何把模块组织成可导入、可执行的命令行脚本。核心主题包括 `__name__ == '__main__'` 惯用法、`main()` 程序模板、命令行参数、标准输入输出、环境变量、程序退出和 Unix `#!` 脚本启动方式。

## 主函数与 Python 主模块

许多语言有显式的主函数，例如 C/C++ 的 `int main(...)` 或 Java 的 `public static void main(...)`。它们是程序启动后首先执行的入口。

Python 没有固定的 `main` 函数或方法，而是有“主模块”（main module）：

- 启动解释器时传入的源文件就是主模块。
- 文件名不重要，谁被解释器首先执行，谁就是主模块。
- 例如：`python3 prog.py` 中，`prog.py` 就是主模块。

相关概念可扩展为 Python模块与导入机制、Python程序入口。

## `__main__` 检查

Python 脚本中常见的入口保护写法是：

```python
if __name__ == '__main__':
    statements
```

含义：

- 当文件作为主程序运行时，`__name__` 被设置为 `'__main__'`。
- 当文件被 `import` 导入时，`__name__` 通常是模块名，不会等于 `'__main__'`。
- 因此，放在该条件块中的代码只会在脚本直接运行时执行，不会在被导入时自动执行。

这种写法使一个 Python 文件既可以作为脚本运行，也可以作为库模块被导入。

## 主程序与库导入

同一个 Python 文件可以有两种使用方式：

```bash
python3 prog.py
```

表示作为主程序运行。

```python
import prog
```

表示作为库导入。

通常不希望“主程序逻辑”在导入时自动执行，因为导入模块时往往只是想使用其中的函数、类或变量。因此，模块中可执行的测试、命令行处理、打印输出等逻辑应放入：

```python
if __name__ == '__main__':
    ...
```

这体现了 Python 模块设计中的一个重要原则：将可复用逻辑与命令行入口分离。相关主题可归入 Python脚本与库的双重用途。

## 常见程序模板

一个典型 Python 程序结构如下：

```python
# prog.py
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

该模板的优点：

- 顶部集中导入依赖。
- 中间定义可复用函数。
- 将主流程放入 `main()`。
- 用 `if __name__ == '__main__'` 控制是否执行主流程。

这有助于测试、导入复用和命令行执行。

## 命令行工具

Python 常用于编写命令行工具，例如：

```bash
python3 report.py portfolio.csv prices.csv
```

命令行工具通常从 shell/terminal 中执行，用于：

- 自动化任务
- 后台作业
- 数据处理
- 文件转换
- 报告生成
- 管道处理

这部分与 命令行工具设计、Python自动化脚本 有关。

## 命令行参数：`sys.argv`

命令行本质上是一组文本字符串。运行：

```bash
python3 report.py portfolio.csv prices.csv
```

对应的参数列表可从 `sys.argv` 获取：

```python
sys.argv  # ['report.py', 'portfolio.csv', 'prices.csv']
```

常见处理方式：

```python
import sys

if len(sys.argv) != 3:
    raise SystemExit(f'Usage: {sys.argv[0]} portfile pricefile')

portfile = sys.argv[1]
pricefile = sys.argv[2]
```

要点：

- `sys.argv[0]` 是脚本名。
- 后续元素是用户传入的参数。
- 参数数量错误时，可抛出 `SystemExit` 并打印用法说明。

## 标准输入输出：stdio

Python 中标准输入输出对象位于 `sys` 模块：

```python
sys.stdout
sys.stderr
sys.stdin
```

默认行为：

- `print()` 输出到 `sys.stdout`。
- `input()` 从 `sys.stdin` 读取。
- traceback 和错误信息输出到 `sys.stderr`。

stdio 对象和普通文件类似，但它们可能连接到：

- 终端
- 文件
- 管道
- 其他进程

例如：

```bash
python3 prog.py > results.txt
cmd1 | python3 prog.py | cmd2
```

这说明 Python 脚本可以自然地参与 shell 重定向和管道工作流。相关概念可扩展为 标准输入输出与管道。

## 环境变量

环境变量由 shell 设置，例如：

```bash
setenv NAME dave
setenv RSH ssh
python3 prog.py
```

在 Python 中可通过 `os.environ` 访问：

```python
import os

name = os.environ['NAME']
```

`os.environ` 是一个类似字典的对象，保存当前进程环境变量。程序对环境变量的修改会反映到之后由该程序启动的子进程中。

相关主题可归入 环境变量、Python进程环境。

## 程序退出

Python 程序退出可通过异常机制完成：

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

要点：

- `SystemExit` 是用于终止程序的异常。
- 非零退出码表示错误。
- 字符串参数可用于输出提示信息。

相关概念可扩展为 程序退出码与错误处理。

## `#!` 行与可执行脚本

在 Unix 系统中，可以在脚本第一行加入 shebang：

```python
#!/usr/bin/env python3
```

然后赋予可执行权限：

```bash
chmod +x prog.py
```

之后即可直接运行：

```bash
prog.py
```

说明：

- `#!` 行告诉系统用哪个解释器运行脚本。
- `#!/usr/bin/env python3` 会在环境路径中查找 `python3`。
- Windows 的 Python Launcher 也会查看 `#!` 行以判断 Python 版本。

相关主题可归入 shebang与脚本执行。

## 命令行脚本模板

最终推荐的命令行脚本模板如下：

```python
#!/usr/bin/env python3
# prog.py

import modules

def spam():
    ...

def blah():
    ...

def main(argv):
    # Parse command line args, environment, etc.
    ...

if __name__ == '__main__':
    import sys
    main(sys.argv)
```

该模板综合了本文的主要实践：

- 使用 shebang 支持直接执行。
- 将业务逻辑封装在函数中。
- `main(argv)` 接收参数列表，便于测试和交互调用。
- 仅在作为主程序运行时导入 `sys` 并调用 `main(sys.argv)`。
- 保持模块导入时无副作用。

## 练习内容

### Exercise 3.15：添加 `main()` 函数

要求修改 `report.py`：

- 添加一个接受命令行参数列表的 `main()` 函数。
- 能够在交互式环境中调用：

```python
import report
report.main(['report.py', 'Data/portfolio.csv', 'Data/prices.csv'])
```

并输出股票报告。

同时修改 `pcost.py`，使其也有类似的 `main()`：

```python
import pcost
pcost.main(['pcost.py', 'Data/portfolio.csv'])
```

输出总成本。

### Exercise 3.16：制作可执行脚本

要求进一步修改 `report.py` 和 `pcost.py`，使它们能在命令行执行：

```bash
python3 report.py Data/portfolio.csv Data/prices.csv
python3 pcost.py Data/portfolio.csv
```

这要求脚本使用 `if __name__ == '__main__'` 调用 `main(sys.argv)`，从而兼顾导入复用与命令行运行。

## 核心结论

本文的关键贡献是把 Python 程序从“直接写一串顶层语句”推进到更规范的脚本结构：

1. Python 没有内建 `main()`，但有主模块概念。
2. `if __name__ == '__main__'` 是区分直接运行与导入复用的标准方式。
3. 将主逻辑封装进 `main(argv)` 可以提高可测试性和可维护性。
4. 命令行脚本通常需要处理 `sys.argv`、stdio、环境变量和退出码。
5. 使用 shebang 与可执行权限可以让 Python 文件像普通 Unix 命令一样运行。

这些实践共同构成了 Python 命令行程序的基本结构，与 Python程序入口、命令行工具设计、标准输入输出与管道 密切相关。

## Related Concepts
- [[concepts/环境变量与进程环境]]
- [[concepts/main-函数与脚本结构]]
- [[concepts/命令行参数]]
- [[concepts/Python-输入输出]]
- [[concepts/模块与-import]]
- [[concepts/异常处理]]
- [[concepts/函数]]
- [[concepts/Python-开发环境]]
- [[concepts/文件读写]]
- [[concepts/测试-日志与调试]]
