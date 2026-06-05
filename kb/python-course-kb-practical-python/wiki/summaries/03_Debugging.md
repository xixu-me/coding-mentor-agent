---
doc_type: short
full_text: sources/03_Debugging.md
---

# 03_Debugging 总结

本文讲解 Python 程序崩溃后的基础调试方法，重点包括如何阅读 traceback、使用交互式解释器保留现场、用 `print()` 辅助排查，以及通过 Python 内置调试器 `pdb` 进行断点调试。

## 核心内容

### 1. 从 traceback 开始定位错误

当 Python 程序崩溃时，会输出 traceback，展示函数调用链和最终异常原因。

关键原则：

- traceback 的最后一行通常是崩溃的直接原因。
- 上方的 `File ... line ... in ...` 展示了调用栈，即程序如何一步步走到出错位置。
- 错误类型和错误信息非常重要，例如：
  - `AttributeError: 'int' object has no attribute 'append'`
  - 表示代码试图在整数对象上调用 `append()` 方法。

文中建议：如果 traceback 难以理解，可以把完整 traceback 粘贴到搜索引擎中查找相关解释。

相关概念：debugging、traceback、exceptions

## 2. 使用 `python3 -i` 保留崩溃现场

运行脚本时加上 `-i` 选项：

```bash
python3 -i blah.py
```

如果程序崩溃，Python 不会立即退出，而是进入交互式 REPL：

```python
>>>
```

这样可以在崩溃后继续检查解释器状态，例如：

- 查看变量值
- 调用函数
- 检查对象类型
- 复现局部问题

这种方式适合快速探索程序崩溃时的环境，是一种轻量级调试技巧。

相关概念：repl、debugging、runtime state

## 3. 使用 `print()` 调试

`print()` 调试是一种常见且实用的排查方式，通过在代码中输出变量和执行路径来理解程序行为。

本文特别强调：调试输出时应优先使用 `repr()`：

```python
def spam(x):
    print('DEBUG:', repr(x))
```

原因是：

- `print(x)` 输出的是面向用户的友好显示。
- `repr(x)` 输出的是更精确、面向开发者的表示形式。

示例：

```python
>>> from decimal import Decimal
>>> x = Decimal('3.4')
>>> print(x)
3.4
>>> print(repr(x))
Decimal('3.4')
```

在调试中，`repr()` 能揭示对象的真实类型和构造形式，减少误判。

相关概念：print debugging、repr、debugging

## 4. 在程序中手动启动调试器

Python 3.7+ 可以使用内置函数 `breakpoint()` 在代码中设置调试入口：

```python
def some_function():
    ...
    breakpoint()
    ...
```

程序执行到 `breakpoint()` 时会进入调试器，可以检查变量、单步执行、查看调用栈等。

旧版本 Python 中常见写法是：

```python
import pdb
pdb.set_trace()
```

`breakpoint()` 是现代推荐写法，而 `pdb.set_trace()` 仍会在旧教程或遗留代码中出现。

相关概念：pdb、breakpoints、debugging

## 5. 在调试器下运行整个程序

可以用 `pdb` 模块直接运行脚本：

```bash
python3 -m pdb someprogram.py
```

这样程序会在第一条语句前进入调试器，允许开发者提前设置断点、配置执行路径，并逐步观察程序运行。

常用 `pdb` 命令包括：

| 命令 | 作用 |
|---|---|
| `help` | 查看帮助 |
| `w` / `where` | 打印调用栈 |
| `d` / `down` | 向下移动一个栈帧 |
| `u` / `up` | 向上移动一个栈帧 |
| `b loc` / `break loc` | 设置断点 |
| `s` / `step` | 单步执行 |
| `c` / `continue` | 继续运行 |
| `l` / `list` | 列出源码 |
| `a` / `args` | 查看当前函数参数 |
| `!statement` | 执行 Python 语句 |

断点位置可以是：

```text
b 45            # 当前文件第 45 行
b file.py:45    # file.py 的第 45 行
b foo           # 当前文件中的 foo() 函数
b module.foo    # 某模块中的 foo() 函数
```

相关概念：pdb、breakpoints、call stack

## 练习

### Exercise 8.4: Bugs? What Bugs?

练习标题以玩笑方式强调：程序“能运行”并不代表没有 bug。调试是理解程序状态、定位异常和验证假设的重要过程。

## 关键收获

- traceback 是崩溃分析的第一入口，最后一行通常说明直接原因。
- `python3 -i script.py` 可以在脚本崩溃后保留交互式环境，方便检查状态。
- `print()` 调试简单有效，但输出调试信息时应优先使用 `repr()`。
- `breakpoint()` 是 Python 3.7+ 推荐的内置调试入口。
- `python3 -m pdb program.py` 可以从程序开始就进入调试器。
- `pdb` 支持调用栈查看、断点、单步执行、继续运行和动态执行语句等功能。

## 可延伸概念

- debugging：程序调试的一般策略与工具。
- traceback：Python 异常调用栈的阅读方法。
- pdb：Python 内置调试器的命令与工作流。
- repl：交互式解释器在调试中的用途。
- repr：对象精确表示与调试输出。
- breakpoints：断点在程序执行控制中的作用。

## Related Concepts
- [[concepts/调用栈与-traceback]]
- [[concepts/Python-pdb-调试器]]
- [[concepts/测试-日志与调试]]
- [[concepts/异常处理]]
- [[concepts/Python-交互式解释器]]
- [[concepts/课程练习工作流]]
- [[concepts/Python-开发环境]]
- [[concepts/断言]]
- [[concepts/Python-文档与帮助系统]]
- [[concepts/库接口设计]]
