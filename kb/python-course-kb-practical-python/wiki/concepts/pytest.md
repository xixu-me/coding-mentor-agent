---
sources: [summaries/08_Testing_debugging__00_Overview.md, summaries/01_Testing.md]
brief: pytest 是一个简洁、自动发现测试的 Python 第三方测试框架。
---

# pytest

`pytest` 是 Python 生态中流行的第三方测试工具，用于编写、发现和运行测试。相较于标准库中的 `unittest`，`pytest` 通常语法更简洁，入门成本较低，同时也具备强大的扩展能力。

本文概念来自 [[summaries/01_Testing]]。

## 核心定义

`pytest` 是一个测试框架，主要用于：

- 编写单元测试和功能测试；
- 自动发现测试文件和测试函数；
- 执行测试并报告成功、失败和异常信息；
- 使用普通的 Python `assert` 表达测试预期。

在 [[summaries/01_Testing]] 中，`pytest` 被作为 Python 标准库 `unittest` 的替代方案介绍。文档指出，`unittest` 的优势是内置于 Python、随处可用，但不少程序员认为它写法较冗长；而 `pytest` 能让测试文件更简洁。

相关概念：软件测试、[[concepts/单元测试]]、Python unittest

## 与 unittest 的对比

在 `unittest` 中，测试通常需要：

1. 导入 `unittest`；
2. 定义继承自 `unittest.TestCase` 的测试类；
3. 编写以 `test` 开头的方法；
4. 使用 `self.assertEqual()`、`self.assertTrue()` 等断言方法；
5. 通过 `unittest.main()` 或测试运行器执行。

而在 `pytest` 中，简单测试可以直接写成普通函数，并使用 Python 内置的 `assert`：

```python
# test_simple.py
import simple

def test_simple():
    assert simple.add(2, 2) == 4

def test_str():
    assert simple.add('hello', 'world') == 'helloworld'
```

这种写法省去了测试类和大量 `self.assert...` 方法调用，使测试代码更接近普通 Python 代码。

相关概念：测试断言、[[concepts/断言]]、测试用例

## 测试发现机制

`pytest` 会自动发现测试。通常只要测试文件和测试函数遵循命名约定，例如：

- 文件名类似 `test_*.py`；
- 函数名以 `test_` 开头；

`pytest` 就能找到这些测试并运行。

在 [[summaries/01_Testing]] 中，运行方式示例为：

```bash
python -m pytest
```

执行该命令后，`pytest` 会自动收集测试并运行它们。

相关概念：测试发现、测试运行器

## 使用 assert 编写测试

`pytest` 的一个重要特点是直接使用 Python 的 `assert` 语句表达测试条件：

```python
assert simple.add(2, 2) == 4
```

这与 `unittest` 中的写法形成对比：

```python
self.assertEqual(simple.add(2, 2), 4)
```

这种风格有几个优点：

- 更短；
- 更直观；
- 更接近普通 Python 表达式；
- 降低初学者编写测试的门槛。

不过，`assert` 在测试中的用途不同于生产代码中的内部不变量检查。生产代码中的 `assert` 更适合表达“理论上永远应该成立”的内部条件；测试代码中的 `assert` 则用于表达被测代码的预期行为。

相关概念：[[concepts/断言]]、冒烟测试、程序不变量

## 适用场景

`pytest` 适用于多种 Python 测试场景，包括：

- 测试单个函数的返回值；
- 测试类和对象的行为；
- 测试属性计算是否正确；
- 测试方法调用后的状态变化；
- 测试异常是否按预期抛出；
- 为大型项目组织自动化测试套件。

在 [[summaries/01_Testing]] 的上下文中，如果使用 `pytest` 测试一个简单的 `add()` 函数，可以不创建测试类，只需定义测试函数。

相关概念：面向对象测试、属性测试、异常测试

## 与 Python 测试理念的关系

[[summaries/01_Testing]] 强调：由于 Python 是动态语言，没有编译器帮助提前捕获大量错误，因此测试非常重要。`pytest` 正是服务于这一需求的工具之一。

它帮助开发者更容易地：

- 编写测试；
- 频繁运行测试；
- 快速发现行为错误；
- 用测试保护已有功能；
- 在修改代码时降低回归风险。

因此，`pytest` 不只是一个命令行工具，而是 Python 项目中实践 软件测试 和 [[concepts/单元测试]] 的常用基础设施。

## 核心要点

- `pytest` 是 Python 第三方测试框架。
- 它通常比标准库 `unittest` 更简洁。
- 测试可以写成普通函数。
- 测试预期可以直接用 Python `assert` 表达。
- 可通过 `python -m pytest` 运行测试。
- `pytest` 会自动发现符合命名约定的测试。
- 它适合从简单脚本到大型应用的测试实践。

## 相关页面

- [[summaries/01_Testing]]：介绍 Python 测试、断言、`unittest` 和 `pytest`。
- 软件测试：测试在软件开发中的总体作用。
- [[concepts/单元测试]]：对函数、类、模块等小单元进行验证。
- Python unittest：Python 标准库测试框架。
- [[concepts/断言]]：用表达式检查程序假设或测试预期。
- 测试发现：测试框架自动查找测试文件和测试函数的机制。

See also: [[summaries/08_Testing_debugging__00_Overview]]