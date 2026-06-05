---
sources: [summaries/01_Packages.md, summaries/09_Packages__00_Overview.md]
brief: Python 包结构说明如何用目录和 __init__.py 把多个模块组织成可导入、可分发的包。
---

# Python 包结构

## 概念定义

Python 包结构是把多个模块组织到目录中，并通过包名进行导入的方式。包让一组相关模块拥有共同命名空间，便于复用、安装和分发。

这个主题连接 [[concepts/模块与-import]]、[[concepts/Python-项目组织]]、[[concepts/代码分发]]、[[concepts/包与虚拟环境]] 和 [[concepts/main-函数与脚本结构]]。

## 基本结构

```text
porty-app/
    porty/
        __init__.py
        fileparse.py
        report.py
        stock.py
```

`porty/` 是包目录，包内模块可通过包名导入：

```python
from porty import report
```

## 包结构解决的问题

- 避免所有模块堆在项目顶层；
- 形成清晰命名空间；
- 支持包内模块之间的导入；
- 为安装和分发提供稳定结构；
- 让库代码和入口脚本分离。

## 与脚本的关系

包中的模块通常应优先作为库代码被导入。需要命令行入口时，可以在顶层脚本或专门入口中调用包内函数，而不是把所有逻辑写在脚本文件顶层。

## 相关概念

- [[concepts/模块与-import]]
- [[concepts/Python-项目组织]]
- [[concepts/代码分发]]
- [[concepts/现代-Python-打包实践]]
- [[concepts/main-函数与脚本结构]]
