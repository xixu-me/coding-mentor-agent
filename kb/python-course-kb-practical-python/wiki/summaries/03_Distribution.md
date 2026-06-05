---
doc_type: short
full_text: sources/03_Distribution.md
---

# 03_Distribution 总结

本文介绍 Python 项目分发的最基础流程：通过 `setup.py` 描述项目元数据与包结构，通过 `MANIFEST.in` 声明额外文件，使用 `python setup.py sdist` 创建源码分发包，并让他人通过 `pip` 安装该包。该内容是课程中的传统入门示例，用于理解源码分发的基本思想；现代项目通常应参考 Python Packaging User Guide，并使用 `pyproject.toml` 与 `python -m build` 等当前实践。该主题也与 pip、虚拟环境 和 Python项目结构 相关。

## 核心内容

### 1. 创建 `setup.py`

项目顶层目录需要添加 `setup.py` 文件，用来描述包的基本元数据，并调用 `setuptools.setup()` 完成打包配置。

示例信息包括：

- `name`：包名，例如 `porty`
- `version`：版本号，例如 `0.0.1`
- `author` / `author_email`：作者信息
- `description`：项目描述
- `packages=setuptools.find_packages()`：自动发现项目中的 Python 包

这一步是 Python 代码能够被打包和安装的基础。

### 2. 创建 `MANIFEST.in`

如果项目中包含 Python 源码之外的额外文件，需要使用 `MANIFEST.in` 声明它们。

例如：

```text
include *.csv
```

这表示将顶层目录中的 `.csv` 文件包含进源码分发包。`MANIFEST.in` 应与 `setup.py` 放在同一目录。

### 3. 创建源码分发包

运行以下命令：

```bash
python setup.py sdist
```

该命令会在 `dist/` 目录下生成 `.tar.gz` 或 `.zip` 文件。这个文件就是可以分发给他人的 Python 源码包。

需要注意：这是课程材料中的传统最小流程，不应被理解为现代项目的唯一推荐做法。实际项目应优先查看 Python Packaging User Guide 中关于 `pyproject.toml`、构建后端和 `python -m build` 的当前说明。

### 4. 安装分发包

其他用户可以使用 `pip` 安装生成的分发文件，例如：

```bash
python -m pip install porty-0.0.1.tar.gz
```

这使自定义项目能够像普通第三方包一样被安装和使用。

## 重要观点

- 本文只覆盖 Python 打包分发的“最小可行流程”。
- `python setup.py sdist` 是传统示例；现代项目通常使用 `pyproject.toml` 和构建工具创建分发物。
- 实际项目可能涉及更复杂的问题，例如：
  - 第三方依赖管理
  - C/C++ 扩展模块
  - 非 Python 资源文件
  - 更完整的包元数据
  - 发布到包索引服务
- 课程建议更深入的内容参考 Python Packaging User Guide。

## 练习 9.5：制作一个包

练习要求将 Exercise 9.3 中创建的 `porty-app/` 项目进行打包：

1. 在项目顶层添加 `setup.py`
2. 添加 `MANIFEST.in`
3. 运行：

```bash
python setup.py sdist
```

4. 最后尝试将生成的包安装到 Python 虚拟环境中，以验证打包结果是否可用。

## 相关概念

- Python打包分发：如何把 Python 项目组织成可分发、可安装的软件包。
- Python项目结构：项目顶层目录、包发现、资源文件放置等结构性问题。
- pip：Python 包安装工具，用于安装源码包或第三方依赖。
- 虚拟环境：隔离安装与测试 Python 包的推荐环境。

## Related Concepts
- [[concepts/代码分发]]
- [[concepts/包与虚拟环境]]
- [[concepts/依赖管理]]
- [[concepts/模块与-import]]
- [[concepts/库接口设计]]
- [[concepts/Python-开发环境]]
- [[concepts/课程练习工作流]]
