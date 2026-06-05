---
sources: [summaries/08_Testing_debugging__00_Overview.md, summaries/Contents.md, summaries/03_Debugging.md]
brief: Python pdb 是内置命令行调试器，用于断点、单步执行和检查程序状态。
---

# Python pdb 调试器

Python `pdb` 是 Python 标准库提供的命令行调试器，用于在程序运行过程中暂停执行、检查变量、查看调用栈、设置断点并逐步执行代码。它是 Python 调试工作流中的核心工具之一，尤其适合定位异常、理解程序执行路径和检查运行时状态。

相关来源：[[summaries/03_Debugging]]

## 核心作用

`pdb` 的主要用途是让开发者在程序执行过程中获得控制权，而不是只能在程序崩溃后阅读错误信息。

它可以帮助回答以下问题：

- 程序执行到了哪里？
- 当前函数的参数是什么？
- 当前变量的值是什么？
- 调用栈是怎样的？
- 某段代码为什么会被执行？
- 某个异常发生前程序状态是什么？

这些能力使 `pdb` 成为比单纯 `print()` 调试更系统的调试工具。

相关概念：debugging、traceback、call stack

## 在代码中进入调试器

在 Python 3.7 及以上版本中，可以使用内置函数 `breakpoint()` 手动进入调试器：

```python
def some_function():
    ...
    breakpoint()      # 执行到这里时进入调试器
    ...
```

当程序运行到 `breakpoint()` 时，会暂停执行并进入 `pdb` 交互界面。此时可以查看变量、检查函数参数、单步执行后续代码，或继续运行程序。

在较早版本的 Python 中，常见写法是：

```python
import pdb

pdb.set_trace()
```

`pdb.set_trace()` 和 `breakpoint()` 的用途类似，都是在指定位置启动调试器。现代代码中通常优先使用 `breakpoint()`，但在旧教程、旧项目或兼容性代码中仍可能看到 `pdb.set_trace()`。

相关概念：breakpoints、runtime state

## 在调试器下运行整个程序

除了在代码中插入断点，也可以从命令行直接让整个程序在 `pdb` 下运行：

```bash
python3 -m pdb someprogram.py
```

这种方式会在程序第一条语句执行前进入调试器。它适合以下场景：

- 希望从程序启动阶段开始观察执行过程。
- 还不确定应该在哪里设置断点。
- 需要在运行前配置多个断点。
- 想逐步理解一个陌生脚本的执行流程。

相关概念：repl、debugging

## 常用 pdb 命令

进入 `pdb` 后，会看到类似 `(Pdb)` 的提示符。常用命令包括：

| 命令 | 作用 |
|---|---|
| `help` | 查看帮助信息 |
| `w` / `where` | 打印当前调用栈 |
| `d` / `down` | 在调用栈中向下移动一层 |
| `u` / `up` | 在调用栈中向上移动一层 |
| `b loc` / `break loc` | 设置断点 |
| `s` / `step` | 单步执行，进入函数调用 |
| `c` / `continue` | 继续执行直到下一个断点或程序结束 |
| `l` / `list` | 显示当前位置附近的源代码 |
| `a` / `args` | 打印当前函数的参数 |
| `!statement` | 执行一条 Python 语句 |

这些命令覆盖了调试中最常见的动作：查看位置、移动栈帧、设置断点、控制执行、检查数据。

## 设置断点

断点用于告诉调试器：程序执行到某个位置时暂停。

`pdb` 支持多种断点位置写法：

```text
(Pdb) b 45            # 当前文件第 45 行
(Pdb) b file.py:45    # file.py 文件第 45 行
(Pdb) b foo           # 当前文件中的 foo() 函数
(Pdb) b module.foo    # 某个模块中的 foo() 函数
```

断点非常适合用于定位：

- 某个函数是否被调用。
- 某行代码执行前变量是什么值。
- 程序在哪一步进入了错误状态。
- 某个分支条件是否如预期生效。

相关概念：breakpoints

## pdb 与 traceback 的关系

当程序崩溃时，Python 会输出 traceback。traceback 告诉我们异常发生的位置和调用链，但它通常只能展示崩溃后的静态信息。

`pdb` 则允许开发者在程序运行中主动停下来，检查更丰富的上下文：

- 当前变量值
- 函数参数
- 对象状态
- 调用栈层级
- 即将执行的代码

因此，常见调试流程可以是：

1. 先阅读 traceback，找到异常位置。
2. 在可疑位置附近设置 `breakpoint()`。
3. 重新运行程序。
4. 在 `pdb` 中检查状态并逐步执行。
5. 验证错误假设并修复代码。

相关概念：traceback、exceptions

## pdb 与 print 调试的区别

`print()` 调试简单直接，适合快速输出变量值或确认代码路径。但当问题更复杂时，`pdb` 更灵活：

| 方法 | 优点 | 局限 |
|---|---|---|
| `print()` 调试 | 简单、低门槛、无需学习命令 | 需要反复修改代码；输出可能混乱；难以动态探索 |
| `pdb` 调试 | 可暂停程序、动态查看变量、单步执行、检查调用栈 | 需要熟悉调试器命令 |

在实践中，两者并不冲突。可以先用 `print(repr(x))` 快速确认现象，再用 `pdb` 深入检查状态。

相关概念：print debugging、repr

## 典型使用场景

`pdb` 尤其适合以下调试任务：

- 程序抛出异常，但 traceback 不够直观。
- 函数调用链较深，需要查看调用栈。
- 某个变量在运行过程中变成了意外值。
- 需要确认条件分支、循环或函数调用顺序。
- 需要在运行时执行临时语句验证假设。
- 阅读陌生代码时，想观察程序实际执行路径。

## 实践建议

使用 `pdb` 时可以遵循以下思路：

1. 从 traceback 的最后一行确认异常类型和错误信息。
2. 找到最接近问题的代码位置。
3. 添加 `breakpoint()` 或用 `python3 -m pdb` 启动程序。
4. 用 `where` 查看调用栈。
5. 用 `args` 查看当前函数参数。
6. 用 `list` 查看附近源码。
7. 用 `step` 单步执行，或用 `continue` 跳到下一个断点。
8. 用 `!statement` 执行临时表达式或检查对象状态。

## 小结

`pdb` 是 Python 内置的交互式调试器。它补充了 traceback 和 `print()` 调试的不足，让开发者能够在程序运行中暂停、观察和控制执行。掌握 `breakpoint()`、`python3 -m pdb` 和常用 `pdb` 命令，是 Python 调试能力的重要基础。

相关页面：[[summaries/03_Debugging]]、debugging、traceback、breakpoints、call stack、print debugging

See also: [[summaries/Contents]]

See also: [[summaries/08_Testing_debugging__00_Overview]]