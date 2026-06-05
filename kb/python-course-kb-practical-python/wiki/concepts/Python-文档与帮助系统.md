---
sources: [summaries/practical-python-attribution.md, summaries/03_Debugging.md, summaries/04_Modules.md, summaries/01_Script.md, summaries/07_Functions.md, summaries/04_Strings.md, summaries/01_Python.md]
brief: Python 文档与帮助系统用于查询、探索和说明对象、函数、模块与语言特性。
---

# Python 文档与帮助系统

## 概念定义

Python 文档与帮助系统 是指 Python 提供的一组学习、查询、[[concepts/Python-自省]] 和代码说明机制，用来帮助开发者理解函数、模块、对象、方法以及语言特性的用法。它既包括交互式解释器中的 `help()`、`dir()`、tab 自动补全等即时探索工具，也包括函数文档字符串、类型注解、IDE 提示、代码检查器以及 Python 官方文档网站等资料来源和辅助工具。

在 [[summaries/01_Python]] 中，这一概念主要通过练习 1.2 引入：学习者使用 `help()` 查看 `abs()` 和 `round()` 等内置函数的说明，并进一步到官方文档中查找内置函数参考。在 [[summaries/04_Strings]] 中，这一概念扩展到对象方法探索：学习者可以用 tab 补全、`dir()` 和 `help()` 查看字符串对象支持哪些操作，例如 `upper()`、`strip()`、`replace()` 等。在 [[summaries/01_Script]] 中，这一概念进一步扩展到函数设计：开发者应为自己编写的函数添加文档字符串和可选类型注解，使 `help()`、IDE 和其他工具能够显示更有用的信息。

## `help()` 命令

Python 的交互式环境内置了 `help()` 命令，可以直接查询对象的帮助信息。例如：

```python
help(abs)
help(round)
```

这两个命令分别用于查看：

- `abs()`：返回数字的绝对值；
- `round()`：对数字进行四舍五入或近似舍入。

如果只输入：

```python
help()
```

则会进入 Python 的交互式帮助查看器。此模式下可以输入主题名称，浏览更多帮助内容。

这体现了 Python交互式解释器 的一个重要优势：不仅能立即执行代码，还能直接查询语言和库的使用说明。`help()` 不只适用于内置函数，也适用于模块、类、对象方法以及自己编写的函数。

## `help()` 与自己编写的函数

[[summaries/01_Script]] 强调，函数不仅是组织脚本代码的工具，也应当通过文档字符串说明自身用途。例如：

```python
def read_prices(filename):
    '''
    Read prices from a CSV file of name,price data
    '''
    prices = {}
    with open(filename) as f:
        f_csv = csv.reader(f)
        for row in f_csv:
            prices[row[0]] = float(row[1])
    return prices
```

函数定义后紧跟的字符串称为文档字符串，即 doc string。它会被 `help()`、IDE 和其他工具读取：

```python
help(read_prices)
```

因此，文档字符串是 Python 帮助系统的重要组成部分。它把“代码如何使用”的说明直接放在代码附近，使函数既能被程序调用，也能被人和工具查询。

好的文档字符串通常包括：

- 一句话概括函数做什么；
- 必要时说明参数含义；
- 必要时说明返回值；
- 对复杂函数可提供简短使用示例。

这与 代码文档化、函数抽象 和 模块化编程 密切相关：函数越像清晰的黑盒，文档字符串就越能帮助使用者理解它的输入、输出和行为。

## 类型注解与工具提示

Python 函数还可以添加可选类型注解：

```python
def read_prices(filename: str) -> dict:
    '''
    Read prices from a CSV file of name,price data
    '''
    ...
```

类型注解不会改变程序运行行为，本身是信息性的。但它们可以被 IDE、代码检查器和其他工具使用，用来提供自动补全、类型提示、静态检查和更清晰的函数说明。

因此，[[concepts/类型注解]] 可以看作 Python 文档与帮助系统的补充层：

- 文档字符串说明“函数做什么”；
- 类型注解说明“函数期望什么类型的输入，以及返回什么类型的结果”；
- `help()`、IDE 和检查工具把这些信息展示给开发者。

这也与 静态分析 相关：虽然 Python 是动态语言，但工具可以利用注解提前发现一部分潜在问题。

## 查询对象方法：以字符串为例

[[summaries/04_Strings]] 展示了如何查询对象支持的操作。对于一个字符串对象：

```python
s = 'hello world'
```

在某些 Python 环境中，可以尝试输入：

```python
s.<tab key>
```

如果环境支持 tab 补全，解释器或编辑器会显示字符串对象可用的方法。这对于探索 Python字符串 的操作非常有用，例如：

- `s.upper()`：转换为大写；
- `s.lower()`：转换为小写；
- `s.strip()`：去除首尾空白；
- `s.replace(old, new)`：替换文本；
- `s.find(t)`：查找子串位置；
- `s.split()`：拆分字符串；
- `s.join()`：拼接字符串列表。

如果 tab 补全不可用，可以使用 `dir()` 查看对象上可用的属性和方法。

## `dir()`：查看对象可用操作

`dir()` 是 Python 的内置自省函数，用于列出对象可访问的属性和方法。例如：

```python
s = 'hello'
dir(s)
```

它会返回一个列表，其中包含许多可以通过点号访问的名称，例如：

```python
['__add__', '__class__', '__contains__', ..., 'find', 'format',
 'index', 'isalnum', 'isalpha', 'isdigit', 'islower', 'isspace',
 'istitle', 'isupper', 'join', 'ljust', 'lower', 'lstrip', 'partition',
 'replace', 'rfind', 'rindex', 'rjust', 'rpartition', 'rsplit',
 'rstrip', 'split', 'splitlines', 'startswith', 'strip', 'swapcase',
 'title', 'translate', 'upper', 'zfill']
```

这说明 `dir()` 并不直接解释每个方法的作用，而是回答“这个对象有哪些可用操作”。在学习 Python字符串方法、Python内置函数 或其他对象接口时，`dir()` 是一个很实用的入口。

## `help()` 与对象方法

当通过 `dir()` 找到某个方法名后，可以继续用 `help()` 查看具体说明。例如：

```python
s = 'hello'
help(s.upper)
```

输出会说明 `upper()` 是字符串对象的内置方法，并返回一个转换为大写的新字符串：

```python
upper(...)
    S.upper() -> string

    Return a copy of the string S converted to uppercase.
```

这个例子也体现了 Python不可变对象 的一个要点：字符串方法通常不会原地修改原字符串，而是返回一个新的字符串。文档和帮助系统不仅告诉我们“有哪些方法”，还帮助理解这些方法的行为、参数和返回值。

## 对基本语句的限制

[[summaries/01_Python]] 特别提醒：`help()` 不能像查询函数那样直接查询某些 Python 基本语句。例如：

```python
help(for)
```

这会产生语法错误，因为 `for` 是 Python 语法关键字，不是可以作为普通对象传入的函数或变量。

对于这类语言语句，可以尝试使用字符串形式：

```python
help("for")
```

同理，也可以尝试：

```python
help("if")
help("while")
```

如果这种方式无法获得足够信息，就应转向 Python 官方文档或互联网搜索。

## 官方文档

Python 官方文档位于：

<https://docs.python.org/3/>

在 [[summaries/01_Python]] 中，课程要求学习者前往官方文档查找 `abs()` 函数的说明，并提示它位于库参考中与“内置函数”相关的部分。

在 [[summaries/04_Strings]] 中，官方文档也作为进一步学习资料出现。例如，字符串一节提到正则表达式时，建议查阅 `re` 模块官方文档：

<https://docs.python.org/3/library/re.html>

官方文档通常包括：

- 教程：适合系统学习语言基础；
- 库参考：查询标准库模块、函数和类，例如 `re`、`math`、`csv` 等；
- 语言参考：解释 Python 语法和语义；
- 安装与使用说明：介绍不同平台上的安装和运行方式；
- 内置函数和内置类型参考：查询 `str`、`list`、`dict`、`abs()`、`round()` 等对象和函数的行为。

对于初学者而言，官方文档可能显得较为正式，但它是最权威、最准确的资料来源。交互式帮助适合快速确认用法，官方文档适合系统理解完整规则、边界情况和标准库能力。

## 内置函数与帮助系统的关系

`abs()`、`round()`、`dir()`、`help()`、`len()`、`str()` 等都属于 Python内置函数 或内置工具。它们无需导入模块即可直接使用，因此非常适合作为帮助系统和交互式探索的入门示例。

例如：

```python
>>> abs(-10)
10
>>> round(3.14159, 2)
3.14
>>> len('Hello')
5
>>> str(42)
'42'
```

使用 `help()` 可以了解这些函数接受什么参数、返回什么结果，以及某些边界情况如何处理。使用 `dir()` 则可以从一个对象出发，发现它提供了哪些可调用方法。

## 与脚本组织和函数设计的关系

[[summaries/01_Script]] 说明，Python 很容易写成一串从上到下执行的脚本语句，但随着程序增长，应尽量把代码组织成函数。文档与帮助系统在这个过程中扮演重要角色。

当脚本被重构为函数集合时，例如：

```python
def print_report(report):
    '''
    Print a formatted portfolio report.
    '''
    ...


def portfolio_report(portfolio_filename, prices_filename):
    '''
    Create a portfolio report from portfolio and price data files.
    '''
    ...
```

开发者可以通过：

```python
help(print_report)
help(portfolio_report)
```

快速了解每个函数的用途。这使程序不再只是“能运行的一串语句”，而成为一组带有说明、接口和职责边界的可复用构件。

这与以下主题相连：

- 程序结构：函数定义通常放在前面，执行调用放在末尾；
- 自底向上设计：小函数先定义，高层函数组合小函数；
- 函数抽象：函数把任务封装为可命名、可调用的操作；
- 模块化编程：文档字符串帮助说明每个模块化部件的职责；
- 可维护性：清晰的函数说明降低后续修改和复用成本。

换言之，文档字符串和类型注解不仅服务于查询，也服务于良好的程序设计。

## 与交互式学习的关系

Python 文档与帮助系统的价值不仅在于查询答案，还在于支持一种探索式学习方式。典型流程是：

1. 在 Python交互式解释器 中创建对象或输入表达式；
2. 直接尝试操作并观察结果；
3. 使用 tab 补全或 `dir()` 查看对象支持哪些操作；
4. 使用 `help()` 查看某个函数、方法或模块的说明；
5. 对自己编写的函数添加文档字符串，使其也能被 `help()` 查询；
6. 必要时添加类型注解，让 IDE 和检查工具提供更多辅助；
7. 遇到语言语句、标准库模块或复杂主题时查阅官方文档；
8. 将查询结果应用回实际代码中。

例如在学习 Python字符串 时，可以先尝试：

```python
symbols = 'AAPL,IBM,MSFT,YHOO,SCO'
symbols.lower()
symbols.find('MSFT')
symbols.replace('SCO', 'DOA')
```

然后使用：

```python
dir(symbols)
help(symbols.replace)
```

这样可以从“运行示例”进一步走向“主动发现和验证对象能力”。这与 交互式编程学习方法 密切相关。

## 文档、帮助与模块学习

当基础字符串方法不足以完成任务时，学习者需要转向标准库模块。例如 [[summaries/04_Strings]] 中介绍，普通字符串操作不支持高级模式匹配，此时应使用 `re` 模块和 [[concepts/正则表达式]]：

```python
import re
text = 'Today is 3/27/2018. Tomorrow is 3/28/2018.'
re.findall(r'\d+/\d+/\d+', text)
```

对于这类模块，`help()` 可以提供快速入口：

```python
help(re)
help(re.findall)
```

但更完整的参数说明、模式语法和示例通常需要阅读官方文档。由此可见，`help()`、`dir()`、文档字符串、类型注解和官方文档并不是互相替代的关系，而是不同层次的查询工具：

- tab 补全：快速发现可用名称；
- `dir()`：列出对象属性和方法；
- `help()`：查看对象、函数、方法、模块的简要说明；
- 文档字符串：让自己编写的函数也能被帮助系统解释；
- 类型注解：为工具提供参数和返回值的类型信息；
- 官方文档：获得完整、权威、系统的解释。

## 学习意义

Python 文档与帮助系统的核心价值在于培养独立查找信息的能力。学习 Python 不应只依赖记忆语法或复制示例，而应逐渐熟悉以下工作方式：

1. 在 Python交互式解释器 中快速试验代码；
2. 使用 tab 补全或 `dir()` 发现对象能力；
3. 使用 `help()` 查看对象、函数和方法说明；
4. 为自己编写的函数添加清晰的文档字符串；
5. 在适当位置使用 [[concepts/类型注解]] 改善可读性和工具支持；
6. 遇到语言语句、标准库模块或复杂主题时查阅官方文档；
7. 对不清楚的概念进行搜索和验证；
8. 将查询结果应用回实际代码中。

这种方式与 [[summaries/01_Python]]、[[summaries/04_Strings]] 和 [[summaries/01_Script]] 中强调的学习方法一致：通过亲自输入、观察结果、查询文档、组织函数和反复实验来建立对 Python 的理解。

## 与其他概念的关系

- [[summaries/01_Python]]：首次介绍 `help()` 命令和官方文档查询。
- [[summaries/04_Strings]]：展示如何用 tab 补全、`dir()` 和 `help()` 探索字符串方法。
- [[summaries/01_Script]]：强调函数文档字符串、类型注解以及 `help()`、IDE 和工具对函数说明的利用。
- [[summaries/07_Functions]]：与函数定义、函数调用和函数说明密切相关。
- Python：文档与帮助系统是学习和使用 Python 的基础工具。
- Python交互式解释器：`help()`、`dir()` 和对象探索通常在交互式解释器中使用。
- Python内置函数：`abs()`、`round()`、`len()`、`str()`、`dir()` 等是帮助系统的典型查询对象。
- Python字符串：字符串方法的探索展示了文档与帮助系统在对象学习中的作用。
- Python字符串方法：可通过 `dir(s)` 和 `help(s.method)` 学习具体字符串方法。
- Python不可变对象：帮助文档常说明方法返回新对象而非原地修改。
- [[concepts/正则表达式]]：复杂文本处理需要查阅 `re` 模块帮助和官方文档。
- 交互式编程学习方法：查询帮助、试验代码和观察输出共同构成有效的入门学习流程。
- 代码文档化：文档字符串是让代码自带说明的重要方式。
- [[concepts/类型注解]]：为函数接口提供额外说明，并支持 IDE 与检查工具。
- 函数抽象：文档和帮助系统帮助使用者理解函数的输入、输出和职责。
- 模块化编程：清晰的函数说明使模块化代码更容易复用和维护。

## 小结

Python 文档与帮助系统让学习者能够在编程过程中即时查询函数、模块、对象方法和语言特性。`help()` 适合快速查看对象说明，`dir()` 适合发现对象可用操作，tab 补全适合交互式探索，文档字符串让自己编写的函数也能被解释，类型注解为工具提供更多上下文，官方文档则提供更完整和权威的参考。掌握这些工具，是从依赖示例走向独立编程、从简单脚本走向可维护程序的重要一步。

See also: [[summaries/04_Modules]]

See also: [[summaries/03_Debugging]]

See also: [[summaries/practical-python-attribution]]
