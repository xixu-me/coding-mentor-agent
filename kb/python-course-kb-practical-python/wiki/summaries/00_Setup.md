---
doc_type: short
full_text: sources/00_Setup.md
---

# 00_Setup 总结

## 核心内容

本文是 Practical Python Programming 课程的设置与概览说明，主要介绍课程所需时间、Python 环境要求、仓库准备方式、目录结构、学习顺序以及解答代码的使用建议。

## 课程时长与投入

- 课程最初设计为 3 到 4 天的线下面授培训。
- 若完整学习，建议至少投入 25–35 小时。
- 不直接查看解答代码会更有挑战，但也更有助于掌握内容。

## Python 环境要求

课程只需要基础的 Python 3.6 或更新版本：

- 不依赖特定操作系统。
- 不要求特定编辑器或 IDE。
- 不需要额外 Python 工具链。
- 课程主体不依赖第三方包；第 9 章会出于教学目的演示如何在虚拟环境中安装第三方包，例如 `pandas`。

原课程要求 Python 3.6 或更新版本。以当前实践看，建议使用仍受官方维护的 Python 3.x 版本，并按本机平台选择合适安装包。

课程重点是编写脚本和小程序，尤其是处理文件中的数据。因此，学习者需要能方便地：

- 使用编辑器创建 Python 程序；
- 在 shell 或终端中运行程序；
- 读写并管理本地文件。

## 不建议使用 Jupyter Notebook

文中特别强调不建议使用 Jupyter Notebook 完成本课程。原因是课程不仅关注代码实验，还强调 Python 程序组织，包括：

- 函数；
- 模块；
- import 语句；
- 多文件源代码；
- 代码重构。

这些内容更适合在真实文件系统、编辑器和终端环境中练习，而不是在交互式 Notebook 中完成。

## 课程仓库准备

推荐学习者 fork 官方 GitHub 仓库：

- 官方仓库：https://github.com/dabeaz-course/practical-python

然后克隆到本地：

```bash
git clone https://github.com/yourname/practical-python
cd practical-python
```

如果不想 fork 或没有 GitHub 账号，也可以直接克隆官方仓库：

```bash
git clone https://github.com/dabeaz-course/practical-python
cd practical-python
```

fork 的好处是可以将自己的解答代码提交回个人仓库，形成完整的学习记录；直接克隆则只能在本地保存修改。

这一部分与 Git 与课程仓库管理 相关。

## 课程目录结构

所有编码工作都应在 `Work/` 目录中完成。

其中：

- `Work/`：学习者编写程序和完成练习的主要目录；
- `Work/Data/`：包含课程中使用的数据文件和相关脚本；
- `Solutions/`：包含部分练习的完整解答代码。

课程练习默认学习者在 `Work/` 目录中创建和运行程序，并经常访问 `Data/` 中的数据文件。这与 Python 文件处理 和 [[concepts/课程练习工作流]] 相关。

## 学习顺序

课程材料应按章节顺序完成，从第 1 章开始。

原因是后续章节会建立在前面章节写出的代码之上，许多后续练习会要求对已有代码进行小幅重构。因此，跳过前面内容可能会影响后续练习的连续性。

## 解答代码使用建议

`Solutions/` 目录提供了部分练习的完整解答。文档建议：

- 可以在需要提示时查看；
- 但为了获得最佳学习效果，应先尝试自己完成解答；
- 解答代码更适合作为参考，而不是直接复制。

## 关键观点

1. 本课程强调真实脚本开发环境，而不是纯交互式实验。
2. 学习者应熟悉编辑器、终端、文件系统和 Git 仓库的基本使用。
3. 所有练习应集中在 `Work/` 目录中完成，以符合课程假设。
4. 后续课程会持续复用和重构前面写过的代码，因此学习顺序很重要。
5. 解答代码可作为提示，但独立实现更有助于学习。

## 可延伸概念

- Python 程序组织
- Python 文件处理
- Git 与课程仓库管理
- [[concepts/课程练习工作流]]

## Related Concepts
- [[concepts/Git-与课程仓库管理]]
- [[concepts/Python-开发环境]]
- [[concepts/模块与-import]]
- [[concepts/文件读写]]
- [[concepts/main-函数与脚本结构]]
- [[concepts/函数]]
- [[concepts/包与虚拟环境]]
