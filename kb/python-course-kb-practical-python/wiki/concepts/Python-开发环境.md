---
sources: [summaries/09_Packages__00_Overview.md, summaries/03_Program_organization__00_Overview.md, summaries/01_Introduction__00_Overview.md, summaries/Contents.md, summaries/TheEnd.md, summaries/03_Distribution.md, summaries/02_Third_party.md, summaries/01_Packages.md, summaries/03_Debugging.md, summaries/01_Testing.md, summaries/05_Main_module.md, summaries/06_Files.md, summaries/02_Hello_world.md, summaries/01_Python.md, summaries/00_Overview.md, summaries/00_Setup.md]
brief: Python 开发环境是支持编写、运行、调试并组织 Python 脚本的基础工作配置。
---

# Python 开发环境

## 概念定义

Python 开发环境是指学习者或开发者用于编写、运行、调试和组织 Python 程序的一整套工作配置。它通常包括 Python 解释器、代码编辑器、终端或 shell、本地文件系统目录结构，以及可选的版本控制工具。

在本课程语境中，Python 开发环境并不是复杂的 IDE 或工具链，而是一套能够支持真实脚本开发的基础环境：可以启动 Python 解释器、输入交互式代码、创建 `.py` 文件、从终端运行程序、读取本地数据文件，并根据输出或错误信息不断修改代码。

[[summaries/00_Setup]] 强调，本课程不需要第三方 Python 包，也不依赖特定操作系统或编辑器；[[summaries/01_Introduction__00_Overview]] 说明第一章会从零开始介绍 Python 基础，训练学习者编辑、运行和调试小程序，并最终编写一个读取 CSV 数据文件、执行简单计算的脚本。[[summaries/00_Overview]] 也从课程整体角度说明，第一部分的目标是从基础语法逐步走向可运行的数据处理脚本。[[summaries/01_Python]] 进一步强调，终端或命令 shell 是 Python 的原生使用环境。[[summaries/02_Hello_world]] 则把这种环境要求落到第一个程序实践上：学习者必须能进入交互模式、创建 `.py` 文件，并在终端中运行脚本。

因此，Python 开发环境的核心不是“能打开某个工具”，而是能支持 Python入门 的基本循环：写代码、运行代码、观察结果、理解错误、修改程序，并逐渐把零散语法组织成真实脚本。它服务于第一章从 Introducing Python、A First Program、Numbers、Strings、Lists、Files 到 Functions 的递进路线，也为后续 数据处理 和 CSV文件 学习打下基础。

## 在课程中的基本要求

根据 [[summaries/00_Setup]]、[[summaries/01_Introduction__00_Overview]]、[[summaries/00_Overview]]、[[summaries/01_Python]] 和 [[summaries/02_Hello_world]]，Practical Python Programming 课程对开发环境的要求相对简单：

- 安装 Python 3.6 或更新版本；
- 推荐从 [Python.org](https://www.python.org/) 获取基础安装；
- 不依赖特定操作系统；
- 不强制使用某个编辑器或 IDE；
- 不需要第三方 Python 包；
- 能够在终端或 shell 中输入 `python` 或 `python3` 启动解释器；
- 能够识别并使用 `>>>` 和 `...` 等交互式提示符；
- 能够在本地文件系统中创建、编辑和保存 `.py` 文件；
- 能够通过 shell 或终端执行 Python 程序；
- 能够访问课程目录中的数据文件；
- 能够阅读程序输出和 traceback 错误信息；
- 能够随着课程推进，从简单表达式过渡到读取 CSV 文件并执行计算的脚本。

课程笔记和解答使用 Python 3.6。[[summaries/01_Python]] 中还提醒，如果 `import urllib.request` 失败，很可能是因为正在使用 Python 2；本课程需要 Python 3.6 或更新版本。

这说明课程关注的是 Python 编程本身，而不是某个特定工具的使用。开发环境的重点在于帮助学习者完成基础动作：编写程序、运行程序、使用交互式解释器做实验、定位问题，并把短小练习逐渐发展为可重复执行的脚本。

## 终端是 Python 的原生环境

[[summaries/01_Python]] 和 [[summaries/02_Hello_world]] 都强调，Python 通常安装为一个可以从终端或命令 shell 启动的程序。学习者应能在终端中输入：

```bash
python
```

或在部分系统中输入：

```bash
python3
```

进入交互式解释器后，可以直接输入语句，例如：

```python
>>> print("hello world")
hello world
```

这类 `>>>` 提示符代表 Python交互式解释器。它非常适合入门阶段进行即时实验，例如把 Python 当作计算器：

```python
>>> (711.25 - 235.14) * 75
35708.25
```

从开发环境角度看，终端能力非常重要，因为它连接了两种学习方式：

1. 在交互式解释器中快速试验表达式、函数和小片段；
2. 在 `.py` 文件中保存代码，并从命令行重复运行完整脚本。

因此，命令行与终端 不是附属工具，而是本课程 Python 开发环境的核心组成部分。如果学习者不熟悉 shell 或终端，[[summaries/01_Python]] 建议先完成一个简短的终端教程，再继续课程。

[[summaries/02_Hello_world]] 进一步指出，即使学习者使用 IDE，也应该弄清楚如何打开解释器或终端运行 Python。课程后续许多内容都默认学习者能够直接与解释器交互。

## 交互式解释器、REPL 与即时实验

启动 Python 后会进入交互模式，也称 REPL（Read-Eval-Print Loop，读取-求值-打印循环）。在该模式中，输入的语句会立即执行，不需要经历传统的编辑、编译、运行、调试循环。

典型交互如下：

```python
>>> print('hello world')
hello world
>>> 37 * 42
1554
>>> for i in range(5):
...     print(i)
...
0
1
2
3
4
```

其中：

- `>>>` 表示可以开始输入一条新语句；
- `...` 表示正在继续输入多行语句，例如循环体或条件块；
- 输入空行通常表示结束多行输入并执行；
- `_` 在交互模式中保存上一次表达式的结果。

例如：

```python
>>> 37 * 42
1554
>>> _ * 2
3108
```

不过，[[summaries/02_Hello_world]] 特别提醒：`_` 保存上一次结果这一点只适用于交互模式，不应在普通程序文件中依赖它。

交互式解释器适合：

- 把 Python 当作计算器；
- 快速测试数字、字符串、列表等基础 数据类型；
- 调用内置函数并观察结果；
- 试验小段代码；
- 学习 `help()` 和官方文档；
- 在编写脚本前验证表达式、循环条件或函数调用。

这部分与 Python代码输入与交互 和 交互式编程学习方法 密切相关。它对应 [[summaries/01_Introduction__00_Overview]] 中“从零开始学习 Python 基础”的第一步：先能运行最小代码，再逐渐理解语言结构。

## 创建和运行 `.py` 程序文件

交互模式适合实验，但真实程序通常保存在 `.py` 文件中。[[summaries/02_Hello_world]] 用第一个程序说明了这一点：

```python
# hello.py
print('hello world')
```

学习者可以用任意文本编辑器创建这个文件，然后在终端中运行：

```bash
python hello.py
```

或：

```bash
python3 hello.py
```

在 Windows 上，可能需要指定 Python 解释器的完整路径，例如：

```text
c:\python36\python hello.py
```

如果 Python 安装和文件关联配置正确，也可能直接输入脚本名运行：

```text
C:\SomeFolder>hello.py
```

脚本文件适合：

- 保存可重复执行的程序；
- 编写函数；
- 读取本地文件；
- 组织较长代码；
- 使用 `import` 导入模块；
- 将多个步骤组合成完整数据处理流程；
- 进行后续重构和模块化。

[[summaries/01_Introduction__00_Overview]] 描述的第一章“Introduction to Python”正是从认识 Python 和编写第一个程序开始，逐步学习数字、字符串、列表、文件和函数。最终目标不是停留在一行表达式，而是能写出读取 CSV 文件并完成简单计算的程序。这与 Python 文件处理、CSV文件、[[concepts/函数]] 和 Python 程序组织 直接相关。

## 第一章学习路径对开发环境的要求

[[summaries/01_Introduction__00_Overview]] 将 Python 入门部分组织为七个主题：

1. Introducing Python；
2. A First Program；
3. Numbers；
4. Strings；
5. Lists；
6. Files；
7. Functions。

这一路线要求开发环境同时支持交互式探索和脚本式开发。学习者起初需要能启动解释器、输入简单表达式和 `print()` 调用；随后需要能创建文件、运行程序、观察输出；再往后，需要能在脚本中处理数字、字符串、列表，读取文件，并把代码组织成函数。

因此，Python 开发环境必须支撑以下渐进式任务：

- 用交互式解释器理解基本表达式和语句；
- 用 `.py` 文件保存第一个程序；
- 在终端中重复运行脚本；
- 在脚本中练习 基础数据类型，包括数字、字符串和列表；
- 读取本地数据文件，理解文件路径和当前工作目录；
- 使用函数封装计算逻辑；
- 最终组合这些能力，编写读取 CSV 数据并执行简单计算的程序。

这说明开发环境不是课程之外的准备工作，而是 Python 入门学习本身的一部分。没有一个能稳定运行脚本、显示错误、访问文件的环境，学习者就很难完成从语法学习到实际数据处理的过渡。

## 第一个程序对开发环境的要求

[[summaries/02_Hello_world]] 中的 `hello.py` 和 `sears.py` 示例说明，一个最小可用的 Python 开发环境至少要支持三件事：

1. 打开解释器并在 REPL 中实验；
2. 用编辑器创建和修改 `.py` 文件；
3. 从终端运行这些文件并查看输出。

例如，西尔斯大厦纸币问题使用一个脚本模拟纸币数量每天翻倍，直到堆叠高度超过大厦高度。这个程序涉及变量赋值、表达式、`while` 循环、缩进块和 `print()` 输出：

```python
bill_thickness = 0.11 * 0.001
sears_height = 442
num_bills = 1
day = 1

while num_bills * bill_thickness < sears_height:
    print(day, num_bills, num_bills * bill_thickness)
    day = day + 1
    num_bills = num_bills * 2

print('Number of days', day)
```

这个例子说明，开发环境并不只是安装 Python，还要能支持学习者反复执行“修改代码—运行程序—观察输出”的循环。输出表格、循环终止条件、最终结果是否正确，都需要通过运行脚本来验证。

这也把开发环境与 Python基础语法、循环控制、Python缩进 和 Python异常与回溯 联系起来。

## 与 Python 入门学习路径的关系

[[summaries/01_Introduction__00_Overview]] 描述的第一部分以循序渐进的方式组织内容：从认识 Python 和编写第一个程序开始，逐步学习数字、字符串、列表、文件和函数，最后组合这些基础能力完成一个简单的数据处理脚本。

因此，Python 开发环境需要支持以下学习活动：

1. 在终端中启动 Python；
2. 使用交互式解释器尝试表达式和简单语句；
3. 编写和运行第一个 Python 程序；
4. 反复实验数字、字符串、列表等基础 数据类型；
5. 保存短小示例程序，便于修改和重新运行；
6. 读取本地文件，尤其是课程提供的数据文件；
7. 定义函数并组织较长一点的脚本；
8. 调试语法错误、路径错误、导入错误、变量名错误和逻辑错误；
9. 将多个基础知识组合成一个读取 CSV 文件并完成计算的程序。

这使开发环境成为课程学习路径的一部分：它既服务于语法入门，也服务于后续 数据处理、CSV文件 和 Python 文件处理 等主题。

## 调试与错误信息是开发环境的一部分

一个合格的 Python 开发环境不仅要能运行正确程序，也要能清楚显示错误信息。[[summaries/02_Hello_world]] 的调试练习展示了这一点：

```python
day = days + 1
```

由于 `days` 没有定义，运行脚本会得到类似错误：

```text
Traceback (most recent call last):
  File "sears.py", line 10, in <module>
    day = days + 1
NameError: name 'days' is not defined
```

这个例子强调了几条早期调试原则：

- 程序崩溃时，traceback 最后一行通常给出真正原因；
- traceback 会指出文件名、行号和出错代码片段；
- `NameError` 常常意味着变量名写错或尚未定义；
- 修复后应重新运行程序确认问题解决。

因此，开发环境必须让学习者能够看到完整 traceback，而不是只看到“运行失败”。这与 调试与错误信息、Python异常与回溯 和 [[concepts/课程练习工作流]] 直接相关。

## 使用 help() 与官方文档

[[summaries/01_Python]] 将 `help()` 作为早期练习的一部分，这说明一个完整的开发环境还应支持学习者在本地探索 Python 文档。

常见用法包括：

```python
help(abs)
help(round)
help()
```

其中，`help()` 可以进入交互式帮助查看器。对于 `abs()`、`round()` 等 Python内置函数，这种方式很适合快速查看函数用途和调用方式。

[[summaries/02_Hello_world]] 的弹跳球练习也提示可以使用 `round()` 清理浮点数输出，这说明帮助系统不仅用于查资料，也可以直接服务于练习中的函数探索。

需要注意的是，`help()` 不能直接用于 `for`、`if`、`while` 等基本语句，例如 `help(for)` 会导致语法错误。可以尝试：

```python
help("for")
```

如果本地帮助不足，还应查阅 <https://docs.python.org/3/>。这将开发环境扩展为“本地实验 + 官方文档 + 必要时网络搜索”的学习系统。相关主题包括 Python文档与帮助系统。

## 为什么强调本地脚本开发环境

课程中的大量练习涉及从文件读取数据、编写小型脚本、组织多个源代码文件，以及逐步重构已有程序。一个合适的 Python 开发环境应该能支持以下活动：

1. 使用编辑器创建 Python 文件；
2. 在终端中运行脚本；
3. 访问课程目录中的数据文件；
4. 在多个文件之间组织代码；
5. 使用 `import` 导入模块；
6. 对已有代码进行重构；
7. 根据运行结果和错误信息调试程序。

这些内容与 Python 程序组织、Python 文件处理 和 [[concepts/课程练习工作流]] 密切相关。尤其是在第一部分中，学习者需要通过真实 `.py` 文件练习 [[concepts/字符串处理]]、列表、[[concepts/函数]] 和文件读写，而不是只在孤立的交互片段中完成练习。

[[summaries/02_Hello_world]] 的弹跳球练习进一步体现了这一点。学习者需要在 `Work/` 目录中创建或修改 `bounce.py`，运行程序，检查前 10 次反弹高度的输出，并可选地用 `round()` 改善显示。这是最早出现的“创建文件并运行脚本”的练习工作流。

[[summaries/01_Python]] 中的公交车到站示例也体现了本地环境的价值。学习者可以在 Python 中导入标准库模块、发起 [[concepts/Python-网络请求]]、解析 [[concepts/XML-解析]] 数据，并输出结果。即使这个 API 后来失效，示例仍展示了 Python 开发环境如何把解释器、标准库、网络和真实数据连接在一起。

## 不推荐使用 Jupyter Notebook

[[summaries/00_Setup]] 特别指出，不建议使用 Jupyter Notebook 完成本课程。

原因并不是 Notebook 不适合 Python，而是它更适合交互式实验和探索；本课程更强调真实程序开发中的组织方式，例如：

- 函数定义；
- 模块拆分；
- `import` 语句；
- 多文件项目结构；
- 源代码重构；
- 从命令行运行程序；
- 围绕本地数据文件编写可重复执行的脚本。

[[summaries/01_Python]] 和 [[summaries/02_Hello_world]] 鼓励学习者在交互式解释器中手动输入代码，但这并不等同于把全部学习过程放在 Notebook 单元格中。课程更希望学习者掌握终端、解释器和 `.py` 文件之间的切换能力。

[[summaries/01_Introduction__00_Overview]] 提到的最终目标是编写一个读取 CSV 数据文件并执行简单计算的脚本。这样的目标更接近命令行脚本和本地文件处理场景，因此普通 `.py` 文件、编辑器和终端组成的开发环境更能贴合课程训练重点。

## 手动输入、复制粘贴与学习节奏

[[summaries/01_Python]] 强调，课程虽然以网页形式展示代码，但初学者应尽量手动输入交互式代码样例，而不是直接复制粘贴。

这样做的原因是：

- 手动输入会迫使学习者观察语法细节；
- 输入过程中更容易注意括号、冒号、缩进和引号；
- 运行错误能帮助学习者理解解释器反馈；
- 放慢速度有助于形成对语言的直觉。

[[summaries/02_Hello_world]] 中的多行 REPL 示例进一步说明，学习者必须理解 `>>>` 与 `...` 的区别。包含缩进的代码，例如：

```python
for i in range(5):
    print(i)
```

在交互环境中需要正确输入缩进，并通过空行结束代码块。如果复制粘贴，应只复制提示符后的代码，不要复制 `>>>` 或 `...` 提示符本身。

这部分与 Python代码输入与交互、Python缩进 和 交互式编程学习方法 相关。它说明开发环境不仅是软件配置，也包含正确的学习操作方式。

## 推荐的工作方式

课程建议学习者克隆或 fork 官方 GitHub 仓库，并在本地完成练习。典型流程是：

```bash
git clone https://github.com/yourname/practical-python
cd practical-python
```

如果没有 GitHub 账号，也可以直接克隆官方仓库：

```bash
git clone https://github.com/dabeaz-course/practical-python
cd practical-python
```

这体现出开发环境不仅包括 Python 本身，也包括项目目录和代码管理方式。相关内容可见 Git 与课程仓库管理。

在实际学习中，推荐的基本循环是：

1. 打开终端并进入课程目录；
2. 在需要时启动 Python 交互式解释器做小实验；
3. 在课程目录中打开编辑器；
4. 在 `Work/` 目录下创建或修改 `.py` 文件；
5. 在终端中运行程序，例如 `python bounce.py` 或 `python sears.py`；
6. 根据输出或 traceback 错误信息修改代码；
7. 在需要时读取 `Data/` 中的 CSV 或其他数据文件；
8. 随课程推进，将简单程序逐渐组织成函数和模块。

这个循环贯穿 [[summaries/01_Introduction__00_Overview]] 所列出的 Python 入门主题，也为后续更复杂的数据处理章节打下基础。

## 目录结构的重要性

在本课程中，开发环境还包括固定的课程目录布局：

- `Work/`：学习者完成编码练习的主要位置；
- `Work/Data/`：课程使用的数据文件和脚本；
- `Solutions/`：部分练习的参考解答。

[[summaries/02_Hello_world]] 明确说明，从第一组需要创建 Python 文件的练习开始，课程默认学习者在 `practical-python/Work/` 目录中编辑文件。例如，弹跳球练习使用 `Work/bounce.py`，调试练习要求创建 `sears.py`。

课程练习默认学习者在 `Work/` 目录下编写程序，并经常访问 `Data/` 中的数据文件。因此，如果开发环境没有正确设置目录位置，后续练习可能会遇到文件路径错误或运行上下文不一致的问题。

这种目录意识在第一部分就很重要，因为学习者最终会读取 CSV 数据文件并进行简单计算。也就是说，文件路径、当前工作目录和脚本所在位置并不是附属细节，而是 Python 文件处理 和 CSV文件 学习中的基础条件。

## 网络、API 与环境变量

虽然本课程初期不要求深入掌握网络编程，[[summaries/01_Python]] 仍通过公交车到站查询示例展示了 Python 标准库的实际能力。示例使用：

- `urllib.request` 发起 HTTP 请求；
- `xml.etree.ElementTree` 解析 XML；
- `for` 循环提取并打印到站时间。

这个练习说明，一个基础 Python 开发环境不仅能运行算术表达式，也能使用标准库访问外部资源、处理结构化数据，并快速完成自动化任务。

同时，文档也提醒外部 API 可能失效，部分服务可能需要 API key。这是开发环境与真实世界交互时常见的问题：代码正确并不保证外部服务永久可用。

如果工作环境需要 HTTP 代理，可能还需要设置 `HTTP_PROXY` 环境变量：

```python
>>> import os
>>> os.environ['HTTP_PROXY'] = 'http://yourproxy.server.com'
```

这部分与 [[concepts/环境变量与进程环境]]、[[concepts/Python-网络请求]] 和 [[concepts/XML-解析]] 有关。它提醒学习者：开发环境有时还包括网络配置、代理设置和外部服务访问条件。

## 核心原则

Python 开发环境在本课程中的核心原则是：简单、真实、终端友好、面向脚本开发。

具体来说：

1. 简单：只需要 Python 3.6+，不需要额外依赖；
2. 官方：推荐从 Python.org 获取基础安装；
3. 本地：在本机文件系统中管理代码和数据；
4. 终端驱动：能够从 shell 或终端启动解释器、运行脚本；
5. 交互可试验：能够使用 `>>>` 解释器快速测试表达式和函数；
6. 文件导向：通过 `.py` 文件组织代码，而不是主要依赖 Notebook 单元格；
7. 项目化：围绕课程仓库和 `Work/` 目录完成练习；
8. 可查文档：能够使用 `help()` 和官方文档理解函数与语言特性；
9. 可调试：支持学习者观察错误、阅读 traceback、修改代码并重新运行；
10. 可演进：支持后续章节对已有代码进行修改、函数化、模块化和重构；
11. 数据就绪：能够读取本地数据文件，特别是 CSV 文件，并执行简单计算。

从 [[summaries/01_Introduction__00_Overview]] 的角度看，这套环境的价值在于帮助学习者把零散的语法知识转化为可运行的小程序，并进一步转化为能够处理真实数据文件的脚本。从 [[summaries/01_Python]] 的角度看，它帮助学习者理解 Python 的原生运行方式：在终端中启动解释器、直接实验代码，并逐步走向真实程序开发。从 [[summaries/02_Hello_world]] 的角度看，它则是完成第一个 `hello.py`、第一个循环脚本和第一次 traceback 调试的必要条件。

## 相关概念

- [[summaries/00_Setup]]
- [[summaries/00_Overview]]
- [[summaries/01_Introduction__00_Overview]]
- [[summaries/01_Python]]
- [[summaries/02_Hello_world]]
- Python入门
- Python基础
- Python交互式解释器
- 命令行与终端
- Python文档与帮助系统
- Python内置函数
- Python代码输入与交互
- Python缩进
- 交互式编程学习方法
- Python基础语法
- 基础数据类型
- 循环控制
- 调试与错误信息
- Python异常与回溯
- Python 程序组织
- Python 文件处理
- Git 与课程仓库管理
- [[concepts/课程练习工作流]]
- 数据类型
- [[concepts/字符串处理]]
- 列表
- [[concepts/函数]]
- 数据处理
- CSV文件
- [[concepts/Python-网络请求]]
- XML解析
- 环境变量

See also: [[summaries/06_Files]]

See also: [[summaries/05_Main_module]]

See also: [[summaries/01_Testing]]

See also: [[summaries/03_Debugging]]

See also: [[summaries/01_Packages]]

See also: [[summaries/02_Third_party]]

See also: [[summaries/03_Distribution]]

See also: [[summaries/TheEnd]]

See also: [[summaries/Contents]]

See also: [[summaries/03_Program_organization__00_Overview]]

See also: [[summaries/09_Packages__00_Overview]]
