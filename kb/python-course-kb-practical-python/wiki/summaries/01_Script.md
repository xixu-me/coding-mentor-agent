---
doc_type: short
full_text: sources/01_Script.md
---

# 01_Script 总结

本文讲解 Python 脚本的基本组织方式，并强调随着脚本功能增长，应尽早用函数重构程序，以提升模块化编程、可读性、可复用性和可维护性。

## 什么是脚本

脚本是按顺序执行一系列语句并在结束后停止的程序：

```python
statement1
statement2
statement3
```

前面课程中编写的大多数程序本质上都是脚本。脚本起初可能很简单，但如果持续增加功能，很容易演变成难以维护的“混乱大文件”。因此，本文的核心建议是：把脚本逐步组织成一组清晰的函数。

## 名称必须先定义后使用

Python 中变量名和函数名必须在被使用前已经定义：

```python
def square(x):
    return x*x

a = 42
b = a + 2
z = square(b)
```

定义顺序很重要。通常会把变量和函数定义放在文件顶部，而把真正执行程序的代码放在末尾。

## 用函数组织任务

函数适合把“单一任务”的相关代码集中到一个地方。例如读取价格文件：

```python
def read_prices(filename):
    prices = {}
    with open(filename) as f:
        f_csv = csv.reader(f)
        for row in f_csv:
            prices[row[0]] = float(row[1])
    return prices
```

这样可以避免重复代码：

```python
oldprices = read_prices('oldprices.csv')
newprices = read_prices('newprices.csv')
```

这体现了函数抽象：把一段可复用逻辑封装为带名字的操作。

## 函数的本质

函数是“带名字的一系列语句”：

```python
def funcname(args):
    statement
    statement
    return result
```

Python 函数内部可以包含任何 Python 语句，例如 `import`、`print()`、`help()` 等。Python 没有专门限制某些语句只能出现在特定位置，这让函数使用更加统一。

## 函数定义顺序与调用顺序

函数可以按任意顺序定义，只要在程序执行到调用语句之前，该函数已经被定义即可：

```python
def foo(x):
    bar(x)

def bar(x):
    statements

foo(3)
```

或者先定义 `bar()` 再定义 `foo()` 也可以。关键不是文本顺序本身，而是运行时调用发生前，相关函数名已经存在。

## 自底向上的函数组织风格

常见风格是自底向上组织函数：先定义小而简单的构件，再定义依赖这些构件的较高级函数，最后在文件末尾调用顶层函数：

```python
def foo(x):
    ...

def bar(x):
    foo(x)

def spam(x):
    bar(x)

spam(42)
```

这种风格把函数视为积木：低层函数提供基础能力，高层函数组合这些能力完成更复杂任务。相关主题可连接到程序结构和自底向上设计。

## 函数设计原则

理想情况下，函数应像“黑盒”：

- 只依赖传入的参数；
- 避免使用全局变量；
- 避免神秘副作用；
- 输出结果应可预测。

主要目标是：

- 模块化编程：每个函数负责清晰的单一任务；
- 可预测性：相同输入应产生可理解、可重复的行为；
- 可维护性：修改某个任务时尽量不影响其他部分。

## 文档字符串

建议为函数编写文档字符串。文档字符串是函数定义后紧跟的字符串，会被 `help()`、IDE 和其他工具使用：

```python
def read_prices(filename):
    '''
    Read prices from a CSV file of name,price data
    '''
    ...
```

好的文档字符串通常包括：

- 一句话概括函数做什么；
- 必要时提供参数说明；
- 必要时提供简短使用示例。

这与代码文档化相关。

## 类型注解

函数定义可以添加可选类型提示：

```python
def read_prices(filename: str) -> dict:
    ...
```

类型注解不会改变 Python 程序运行行为，本身只是信息性的。但它们可以被 IDE、代码检查器和其他工具使用，用来辅助开发、检查错误和提升可读性。相关主题包括[[concepts/类型注解]]和静态分析。

## 练习 3.1：把程序组织为函数集合

练习要求修改之前的 `report.py`，让所有主要操作都由函数完成，包括计算和输出。

具体要求：

- 创建 `print_report(report)` 函数，用于打印报表；
- 修改程序末尾，使其只包含一系列函数调用，不再直接进行计算。

原本散落在脚本末尾的输出逻辑，例如打印表头、分隔线、逐行打印报表，都应封装到函数中。

## 练习 3.2：创建顶层执行函数

进一步要求把程序最后的执行流程封装成一个顶层函数：

```python
def portfolio_report(portfolio_filename, prices_filename):
    ...
```

这样可以通过一次函数调用生成报表：

```python
portfolio_report('Data/portfolio.csv', 'Data/prices.csv')
```

最终程序结构应变成：

1. 一系列函数定义；
2. 文件末尾只有一个对 `portfolio_report()` 的调用。

这种组织方式让程序更容易复用到不同输入文件：

```python
portfolio_report('Data/portfolio2.csv', 'Data/prices.csv')
```

也可以在循环中批量处理多个投资组合文件。

## 核心思想

本文强调：Python 很容易写成“从上到下执行语句”的非结构化脚本，但从长期看，应该尽早使用函数组织代码。原因包括：

- 脚本会随着需求增长而变复杂；
- 函数能减少重复代码；
- 函数让程序更容易测试、修改和复用；
- 顶层函数让程序可以方便地应用于不同输入；
- Python 中使用函数通常也会稍微提升运行效率。

## 相关概念

- 脚本：按顺序执行语句的程序形式。
- 函数抽象：把一组语句封装为可命名、可调用的操作。
- 模块化编程：把程序拆分成职责明确的小部件。
- 程序结构：组织定义、执行流程和依赖关系的方式。
- 自底向上设计：先构建简单函数，再组合为复杂功能。
- 代码文档化：通过文档字符串等方式解释代码意图。
- [[concepts/类型注解]]：为函数参数和返回值提供可选类型信息。
- 可维护性：让程序在增长后仍然容易理解和修改。

## Related Concepts
- [[concepts/函数]]
- [[concepts/main-函数与脚本结构]]
- [[concepts/Python-文档与帮助系统]]
- [[concepts/CSV-数据处理]]
- [[concepts/文件读写]]
- [[concepts/表格化输出]]
- [[concepts/模块与-import]]
- [[concepts/Python-交互式解释器]]
