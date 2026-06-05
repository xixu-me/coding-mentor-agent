---
doc_type: short
full_text: sources/02_Third_party.md
---

# 02_Third_party 总结

本文介绍 Python 第三方模块的基本使用背景：Python 自带大量标准库模块，但更丰富的生态来自第三方模块，通常可通过 PyPI 或搜索引擎查找。文章重点解释模块导入路径、标准库与第三方包的位置、`pip` 安装方式、常见权限与依赖问题，以及使用虚拟环境隔离项目依赖的基础流程。

## 核心内容

### Python 模块来源

Python 模块大致可分为两类：

- **标准库模块**：随 Python 安装一起提供，体现了 Python “batteries included”的理念。
- **第三方模块**：由社区或组织发布，通常可在 [Python Package Index](https://pypi.org/)（PyPI）中查找。

第三方依赖管理在 Python 中一直是持续演进的话题，本文只覆盖理解其基本机制所需的入门知识。相关主题可延伸为 Python 包管理、PyPI。

## 模块搜索路径：`sys.path`

Python 的 `import` 语句会按照 `sys.path` 中列出的目录顺序查找模块。

```python
import sys
sys.path
```

如果要导入的模块不在这些目录中，就会触发 `ImportError`。

这一点对排查导入问题非常重要：当模块无法导入、导入了错误版本，或行为与预期不一致时，首先应检查 Python 正在搜索哪些目录。相关概念可关联到 Python 导入机制。

## 查看模块实际加载位置

在 REPL 中直接查看一个已导入模块，可以显示该模块来自哪个文件路径，是调试 `import` 问题的实用技巧。

例如标准库模块：

```python
import re
re
```

可能显示：

```text
<module 're' from '/usr/local/lib/python3.x/re.py'>
```

第三方模块通常位于 `site-packages` 目录中，例如：

```python
import numpy
numpy
```

可能显示：

```text
<module 'numpy' from '/usr/local/lib/python3.x/site-packages/numpy/__init__.py'>
```

这说明：

- 标准库模块通常来自 Python 安装目录下的库目录。
- 第三方模块通常安装在 `site-packages` 中。
- 直接查看模块对象有助于确认实际导入的文件位置。
- 示例中的 `python3.x` 代表本机实际 Python 版本。

## 使用 `pip` 安装第三方模块

最常见的第三方包安装方式是使用 `pip`：

```bash
python3 -m pip install packagename
```

该命令会下载指定包，并安装到当前 Python 环境对应的 `site-packages` 目录中。

使用 `python -m pip` 的形式可以减少“pip 对应的不是当前 Python 解释器”的混淆。相关主题可扩展为 pip 与 site packages。

## 常见问题

安装第三方包时可能遇到的问题包括：

- 当前 Python 安装不由自己控制，例如公司批准的统一安装版本。
- 使用的是操作系统自带的 Python。
- 没有权限向全局 Python 环境安装包。
- 包之间或包与系统之间存在其他依赖问题。

这些问题说明，全局安装第三方包并不总是可靠或可行，因此需要隔离环境。

## 虚拟环境

解决包安装和环境污染问题的常见方法是创建 Python 虚拟环境。

使用标准 Python 安装时，可以通过 `venv` 创建一个独立环境：

```bash
python -m venv mypython
```

该命令会创建一个名为 `mypython` 的目录，其中包含一个独立的 Python 环境。在 Unix 系统中可通过以下方式激活：

```bash
source mypython/bin/activate
```

激活后，shell 提示符通常会变为类似：

```text
(mypython) bash %
```

此时运行的 `python` 命令将指向虚拟环境中的解释器。可以在该环境中安装包，例如：

```bash
python -m pip install pandas
```

虚拟环境适合实验、试用不同包，以及避免污染系统 Python。对于实际应用程序的依赖管理，还需要更系统地记录和复现依赖环境。

## 应用程序中的第三方依赖

如果开发的是一个应用程序，并且它依赖特定第三方包，问题不仅是“如何安装”，还包括：

- 如何创建包含应用代码与依赖的环境。
- 如何保存依赖版本。
- 如何让他人或部署系统复现同样的环境。
- 如何应对 Python 包管理生态工具不断变化的问题。

文章没有给出固定方案，而是建议参考 Python Packaging User Guide，因为 Python 打包与依赖管理实践一直在变化。该部分可与 Python 应用分发、[[concepts/依赖管理]] 关联。

## 练习

### Exercise 9.4：创建虚拟环境

练习要求复现以下流程：

1. 创建虚拟环境。
2. 激活虚拟环境。
3. 在虚拟环境中安装 `pandas`。

这能帮助理解第三方包并不是“安装到 Python 语言本身”，而是安装到某个具体 Python 环境中。

## 关键要点

- `sys.path` 决定 `import` 语句搜索模块的位置。
- 直接在 REPL 中查看模块对象，可以确认模块实际加载路径。
- 标准库模块通常位于 Python 安装目录；第三方模块通常位于 `site-packages`。
- `pip` 是安装第三方模块的常用工具。
- 权限、系统 Python、公司环境和依赖冲突都会导致安装问题。
- 虚拟环境为每个实验或项目提供独立 Python 环境。
- 应用程序级依赖管理比简单安装包更复杂，应参考官方 Python Packaging User Guide。

## Related Concepts
- [[concepts/包与虚拟环境]]
- [[concepts/模块与-import]]
- [[concepts/代码分发]]
- [[concepts/Python-交互式解释器]]
- [[concepts/Python-开发环境]]
- [[concepts/异常处理]]
