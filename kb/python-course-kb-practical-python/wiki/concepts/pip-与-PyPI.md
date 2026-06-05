---
sources: [summaries/02_Third_party.md, summaries/09_Packages__00_Overview.md]
brief: pip 与 PyPI 说明 Python 第三方包如何被查找、下载、安装到当前环境并参与 import。
---

# pip 与 PyPI

## 概念定义

PyPI 是 Python Package Index，即 Python 社区常用的第三方包索引。`pip` 是常用的包安装工具，可以从包索引或本地分发文件安装第三方包。

这个主题连接 [[concepts/依赖管理]]、[[concepts/包与虚拟环境]]、[[concepts/site-packages]]、[[concepts/模块与-import]] 和 [[concepts/现代-Python-打包实践]]。

## 安装命令

课程建议使用以下形式安装包：

```shell
python -m pip install packagename
```

这种写法让 `pip` 明确绑定到当前 `python` 解释器，减少“安装到另一个 Python 环境”的混淆。

## 安装后发生了什么

安装成功后，包通常会进入当前 Python 环境的 [[concepts/site-packages]] 目录。程序能否 `import` 该包，取决于当前解释器的搜索路径是否包含对应安装位置。

## 与虚拟环境的关系

虚拟环境会创建独立的 Python 环境和安装目录。激活虚拟环境后运行 `python -m pip install ...`，包通常安装到该虚拟环境自己的 `site-packages` 中，而不会影响系统 Python。

## 相关概念

- [[concepts/site-packages]]
- [[concepts/依赖管理]]
- [[concepts/包与虚拟环境]]
- [[concepts/模块与-import]]
- [[concepts/代码分发]]
