---
sources: [summaries/03_Distribution.md, summaries/09_Packages__00_Overview.md]
brief: 现代 Python 打包实践区分课程中的传统 setup.py 示例与当前 pyproject.toml 和构建工具流程。
---

# 现代 Python 打包实践

## 概念定义

现代 Python 打包实践关注如何用当前工具描述项目元数据、构建分发物并安装包。Practical Python Programming 使用 `setup.py`、`MANIFEST.in` 和 `python setup.py sdist` 作为传统最小示例，用来说明源码分发的基本思想；实际新项目通常应参考 Python Packaging User Guide，并使用 `pyproject.toml` 与构建工具。

这个页面用于连接 [[concepts/代码分发]]、[[concepts/包与虚拟环境]]、[[concepts/依赖管理]]、[[concepts/Python-包结构]] 和 [[concepts/pip-与-PyPI]]。

## 课程示例的定位

课程中的传统流程是：

```shell
python setup.py sdist
python -m pip install dist/porty-0.0.1.tar.gz
```

它适合帮助学习者理解：

- 项目需要元数据；
- 分发物可以安装到 Python 环境；
- 非 Python 资源文件需要被纳入分发包；
- 安装后应在虚拟环境中验证。

它不应被理解为现代项目唯一推荐流程。

## 当前实践的基本方向

现代项目通常会把构建系统和项目元数据放在 `pyproject.toml` 中，并通过构建前端创建分发物：

```shell
python -m build
```

具体构建后端、元数据字段和发布流程会随项目需求变化，因此本 KB 只保留原则说明，不把某个工具组合写成长期固定答案。

## 稳定原则

- 项目结构要清晰；
- 包名、版本、依赖和入口要明确；
- 构建过程应可重复；
- 安装后应在干净环境中验证；
- 当前工具实践应以 Python Packaging User Guide 为准。

## 相关概念

- [[concepts/代码分发]]
- [[concepts/包与虚拟环境]]
- [[concepts/依赖管理]]
- [[concepts/Python-项目组织]]
- [[concepts/Python-包结构]]
