---
sources: [summaries/01_Python.md, summaries/04_Strings.md, summaries/04_Modules.md, summaries/07_Objects.md]
brief: Python 自省是在运行时查看对象类型、属性、身份、文档和模块信息的能力。
---

# Python 自省

## 概念定义

Python 自省是指在程序运行时查看对象自身信息的能力。它包括查询对象类型、身份、属性、方法、文档字符串、模块路径和运行时状态。自省让学习者可以在 [[concepts/Python-交互式解释器]] 中探索对象，也让工具能够提供补全、帮助和调试信息。

## 常见工具

常见自省入口包括：

- `type(obj)`：查看对象类型；
- `id(obj)`：查看对象身份标识；
- `dir(obj)`：列出对象可访问的名称；
- `help(obj)`：查看对象、函数、类或模块的帮助信息；
- `obj.__dict__`：查看许多对象保存属性的字典；
- `module.__file__`：查看模块来源文件。

这些工具在课程中分散出现：[[summaries/01_Python]] 介绍 `help()`；[[summaries/04_Strings]] 用 `dir()` 探索字符串方法；[[summaries/04_Modules]] 说明导入模块后可以查看模块对象；[[summaries/07_Objects]] 用 `type()` 和 `id()` 解释 Python 对象模型。

## 与文档帮助的区别

[[concepts/Python-文档与帮助系统]] 更关注如何查询说明和学习 API；本页关注这些查询背后的运行时对象信息。两者经常一起使用：先用 `dir()` 找到对象有哪些方法，再用 `help()` 查看某个方法如何调用。

## 使用边界

自省适合学习、调试和编写通用工具，但不应替代清晰的接口设计。业务代码如果大量依赖对象内部属性或私有实现细节，可能会变得脆弱。优先使用公开方法、文档化接口和明确的数据结构。

## 相关概念

- [[concepts/Python-文档与帮助系统]]
- [[concepts/Python-交互式解释器]]
- [[concepts/Python-对象模型]]
- [[concepts/对象身份与相等性]]
- [[concepts/动态属性访问]]
- [[concepts/模块与-import]]
