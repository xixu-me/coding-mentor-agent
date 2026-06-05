---
doc_type: short
full_text: sources/01_Python.md
---

# 01_Python 总结

## 核心内容

本文是课程的 Python 入门开篇，介绍了 Python 的基本定位、获取方式、诞生背景，以及为什么应当从 命令行与终端 中学习和使用 Python。文档随后通过一组练习引导学习者使用 Python 交互式解释器完成计算、查询帮助、粘贴代码和调用网络 API 等任务。

## Python 是什么

Python 是一种解释型、高级编程语言，常被归类为“脚本语言”，与 Perl、Tcl、Ruby 等语言有相似之处。其语法部分受到 C 语言影响。

Python 由 Guido van Rossum 于 1990 年左右创建，名称来自 Monty Python。

## 获取与版本要求

课程建议从 [Python.org](https://www.python.org/) 获取 Python，并安装 Python 3.6 或更新版本。课程笔记和解答使用 Python 3.6，这是原课程材料的历史基线；当前学习建议使用仍受官方维护的 Python 3.x 版本。

如果在练习中 `import urllib.request` 失败，通常说明正在使用 Python 2；本课程要求使用 Python 3。

## Python 的设计动机

Guido van Rossum 创建 Python 的初衷，是在 C 语言和 Bourne shell 之间提供一种更高层次的语言。

背景是：

- 用 C 编写系统管理工具太慢；
- 用 shell 完成某些任务又不够合适；
- 因此需要一种能够“桥接 C 和 shell”的语言。

这说明 Python 从诞生之初就强调 脚本语言、系统自动化与高层表达能力。

## 在机器上运行 Python

Python 通常作为一个可从终端或命令 shell 启动的程序安装在机器上。用户可以在终端输入：

```bash
python
```

进入交互式解释器后，可以直接输入 Python 语句，例如：

```python
>>> print("hello world")
hello world
```

文档强调：虽然有许多非终端环境可以编写 Python，但如果能够在终端中运行、调试和交互式使用 Python，就能成为更强的 Python 程序员。终端被视为 Python 的“原生环境”。

## 练习 1.1：把 Python 当作计算器

第一个练习要求在 Python 交互模式中进行算术计算。

示例问题：Lucky Larry 以每股 235.14 美元买入 75 股 Google 股票，现在价格为每股 711.25 美元，卖出后利润为：

```python
>>> (711.25 - 235.14) * 75
35708.25
```

文档还介绍了交互式解释器中的 `_` 变量，它代表上一次计算结果。例如经纪人抽成 20% 后，Larry 保留 80%：

```python
>>> _ * 0.80
28566.600000000002
```

这一练习展示了 Python交互式解释器 作为快速计算工具的用途。

## 练习 1.2：使用 help() 获取帮助

第二个练习介绍 Python 内置的 `help()` 命令：

- `help(abs)`：查看 `abs()` 函数帮助；
- `help(round)`：查看 `round()` 函数帮助；
- `help()`：进入交互式帮助查看器。

注意：`help()` 不能直接用于 `for`、`if`、`while` 等基本语句，例如 `help(for)` 会导致语法错误。可以尝试使用字符串形式：

```python
help("for")
```

如果仍无法获得帮助，则应查阅互联网或官方文档。文档建议访问 <https://docs.python.org/3/>，并在库参考的内置函数部分查找 `abs()` 的文档。

相关主题：Python内置函数、Python文档与帮助系统。

## 练习 1.3：复制粘贴与手动输入

课程鼓励学习者手动输入交互式代码，而不是直接复制粘贴。原因是：初学者通过放慢速度、亲自输入并思考代码，会更好地建立语言感觉。

如果必须复制粘贴，应注意：

- 只复制 `>>>` 提示符之后的代码；
- 不要复制提示符本身；
- 复制到第一个空行或下一个 `>>>` 之前为止；
- 粘贴后可能需要按一次回车运行；
- 基础 Python shell 中一次不能粘贴多个交互式命令。

示例代码包括：

```python
>>> 12 + 20
32
```

跨行表达式：

```python
>>> (3 + 4
         + 5 + 6)
18
```

以及 `for` 循环：

```python
>>> for i in range(5):
        print(i)

0
1
2
3
4
```

该练习引出 Python代码输入与交互、Python缩进 和 交互式编程学习方法 等主题。

## 练习 1.4：公交车到站查询示例

第四个练习展示了一个更高级但直观的 Python 示例：使用 Python 下载网页、解析 XML，并提取芝加哥 CTA 公交到站预测信息。

原始示例使用：

```python
>>> import urllib.request
>>> u = urllib.request.urlopen('http://ctabustracker.com/bustime/map/getStopPredictions.jsp?stop=14791&route=22')
>>> from xml.etree.ElementTree import parse
>>> doc = parse(u)
>>> for pt in doc.findall('.//pt'):
        print(pt.text)
```

示例输出：

```text
6 MIN
18 MIN
28 MIN
```

文档指出，通过约 6 行代码，学习者已经完成了：

- 下载网页；
- 解析 XML 文档；
- 提取有用信息；
- 输出公交车到站预测。

这展示了 Python 在 [[concepts/Python-网络请求]]、[[concepts/XML-解析]] 和快速自动化任务中的表达力。

## API 失效与更新说明

文档特别说明，原来的公交 API 已经失效。后来有用户提供了修改后的版本，但需要申请自己的 API key：

```python
import urllib.request
u = urllib.request.urlopen('http://www.ctabustracker.com/bustime/api/v2/getpredictions?key=REDACTED_PLACEHOLDER&rt=22&stpid=14791')
from xml.etree.ElementTree import parse
doc = parse(u)
print("Arrival time in minutes:")
for pt in doc.findall('.//prdctdn'):
        print(pt.text)
```

这也提醒学习者：外部 API 并不永久稳定，依赖网络服务的示例可能随着时间变化而失效。该示例主要用于展示网络请求与 XML 解析思路，不保证 URL 长期可用；实际练习可改用本地 XML 示例文件或课程当前仓库说明。

## 代理与环境变量

如果工作环境需要 HTTP 代理，可能需要设置 `HTTP_PROXY` 环境变量：

```python
>>> import os
>>> os.environ['HTTP_PROXY'] = 'http://yourproxy.server.com'
```

这部分涉及 环境变量 和网络环境配置。

## 重要学习建议

本文反复强调几个入门学习原则：

1. 优先掌握在终端中运行 Python；
2. 使用交互式解释器进行实验；
3. 初学时尽量手动输入代码，而不是复制粘贴；
4. 善用 `help()` 和官方文档；
5. 不必在第一个高级网络示例中完全理解所有细节，后续课程并不依赖 XML 解析。

## 可延伸的概念页

- Python：Python 的语言定位、历史与用途。
- Python交互式解释器：`>>>` 提示符、即时执行、`_` 变量等。
- 命令行与终端：Python 的原生运行环境。
- Python文档与帮助系统：`help()`、官方文档与内置函数参考。
- 脚本语言：Python 在 C 与 shell 之间的角色。
- [[concepts/Python-网络请求]]：使用 `urllib.request` 获取远程资源。
- [[concepts/XML-解析]]：使用 `xml.etree.ElementTree` 解析 XML 数据。
- [[concepts/环境变量与进程环境]]：通过 `os.environ` 配置运行环境。

## Related Concepts
- [[concepts/Python-交互式解释器]]
- [[concepts/Python-文档与帮助系统]]
- [[concepts/Python-开发环境]]
- [[concepts/课程练习工作流]]
- [[concepts/模块与-import]]
- [[concepts/函数]]
