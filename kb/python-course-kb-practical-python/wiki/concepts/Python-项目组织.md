---
sources: [summaries/03_Program_organization__00_Overview.md, summaries/09_Packages__00_Overview.md]
brief: Python 项目组织说明脚本、模块、包、数据文件、测试和打包配置如何形成可维护项目结构。
---

# Python 项目组织

## 概念定义

Python 项目组织是把代码、数据、脚本、包、测试和说明文件放在清晰位置的实践。课程从单文件脚本开始，逐步引入函数、模块、包、应用目录和分发配置，目标是让代码更容易运行、测试、复用和交付。

这个主题连接 [[concepts/main-函数与脚本结构]]、[[concepts/模块与-import]]、[[concepts/Python-包结构]]、[[concepts/代码分发]] 和 [[concepts/库接口设计]]。

## 从脚本到项目

早期练习通常从一个脚本开始：

```text
pcost.py
report.py
```

随着程序变大，公共逻辑会被提取到模块，入口脚本只负责解析参数和调用库函数。再往后，多个模块会被组织进包目录。

## 典型项目元素

- 源代码模块和包；
- 命令行入口脚本；
- 数据文件和示例文件；
- README 或使用说明；
- 测试文件；
- 打包元数据和构建配置；
- 虚拟环境和依赖说明。

## 设计目标

好的项目组织应让读者快速回答：

- 从哪里运行程序；
- 哪些文件是库代码；
- 哪些文件是输入数据；
- 哪些函数可以被复用；
- 如何安装依赖；
- 如何运行测试；
- 如何把项目交给别人。

## 相关概念

- [[concepts/main-函数与脚本结构]]
- [[concepts/模块与-import]]
- [[concepts/Python-包结构]]
- [[concepts/代码分发]]
- [[concepts/依赖管理]]
