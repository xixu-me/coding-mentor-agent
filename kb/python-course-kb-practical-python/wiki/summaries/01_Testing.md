---
doc_type: short
full_text: sources/01_Testing.md
---

# 01_Testing 总结

本文介绍 Python 中测试的基本思想与实践方式，强调动态语言缺少编译期检查，因此需要通过运行代码和系统化测试来发现问题。核心内容包括 `assert` 断言、契约式编程、内联冒烟测试、标准库 `unittest`、第三方工具 `pytest`，以及围绕 `Stock` 类编写单元测试的练习。

## 测试的重要性

Python 的动态特性使测试对大多数应用至关重要：

- 没有编译器帮助提前发现大量类型或接口错误。
- 发现 bug 的主要方式是运行代码。
- 测试需要尽可能覆盖程序功能，验证代码行为符合预期。

文章用一句话概括态度：测试很棒，调试很糟。也就是说，主动编写测试比事后依赖调试更可靠。

相关概念：[[concepts/软件测试]]、Python动态类型

## `assert` 断言

`assert` 是程序内部检查机制。如果表达式不为真，就会抛出 `AssertionError`。

```python
assert <expression> [, 'Diagnostic message']
```

示例：

```python
assert isinstance(10, int), 'Expected int'
```

`assert` 适合用于检查程序内部不变量和假设，不适合用于校验用户输入。例如，不应依赖 `assert` 检查 Web 表单提交的数据。

相关概念：[[concepts/断言]]、程序不变量

## 契约式编程

契约式编程，也称 Design by Contract，是大量使用断言来定义组件接口规格的一种设计方法。

例如，可以在函数入口检查参数类型：

```python
def add(x, y):
    assert isinstance(x, int), 'Expected int'
    assert isinstance(y, int), 'Expected int'
    return x + y
```

这样可以尽早发现调用者传入了不符合预期的参数：

```python
>>> add('2', '3')
AssertionError: Expected int
```

这种方式将函数对调用者的要求明确写进代码中，有助于定位接口使用错误。

相关概念：契约式编程、接口设计、类型检查

## 内联测试

断言也可以用作简单测试：

```python
def add(x, y):
    return x + y

assert add(2, 2) == 4
```

这种测试直接放在模块代码中。它的优点是：如果代码明显损坏，导入模块时就会失败。

不过，内联断言不适合做全面测试，更适合作为基础的“冒烟测试”：确认函数在最简单的例子上是否能正常工作。

相关概念：冒烟测试、测试组织

## `unittest` 模块

Python 标准库提供 `unittest` 模块，用于编写结构化单元测试。

假设有业务代码：

```python
# simple.py

def add(x, y):
    return x + y
```

可以创建单独的测试文件：

```python
# test_simple.py

import simple
import unittest
```

测试类必须继承自 `unittest.TestCase`：

```python
class TestAdd(unittest.TestCase):
    ...
```

测试方法必须以 `test` 开头，否则不会被测试运行器自动识别：

```python
class TestAdd(unittest.TestCase):
    def test_simple(self):
        r = simple.add(2, 2)
        self.assertEqual(r, 5)

    def test_str(self):
        r = simple.add('hello', 'world')
        self.assertEqual(r, 'helloworld')
```

相关概念：[[concepts/单元测试]]、Python unittest、测试用例

## `unittest` 常用断言

`unittest.TestCase` 提供多种断言方法，用于表达不同测试期望：

```python
self.assertTrue(expr)                  # 判断表达式为 True
self.assertEqual(x, y)                 # 判断 x == y
self.assertNotEqual(x, y)              # 判断 x != y
self.assertAlmostEqual(x, y, places)   # 判断数值近似相等
self.assertRaises(exc, callable, ...)  # 判断调用会抛出指定异常
```

这些只是部分方法，`unittest` 还提供了更多断言、测试运行器和结果收集功能。

相关概念：测试断言、异常测试

## 运行 `unittest`

测试文件通常包含如下入口：

```python
if __name__ == '__main__':
    unittest.main()
```

然后可以直接运行测试文件：

```bash
python3 test_simple.py
```

如果测试失败，`unittest` 会报告失败的测试方法、调用栈和断言失败原因。例如 `self.assertEqual(r, 5)` 在实际结果为 `4` 时会显示：

```text
AssertionError: 4 != 5
```

测试输出会统计运行数量、耗时以及失败情况。

相关概念：测试运行器、测试失败报告

## 第三方测试工具：pytest

虽然 `unittest` 是标准库的一部分，优点是随 Python 可用，但许多程序员认为它较为冗长。文章介绍了常见替代方案 `pytest`。

使用 `pytest` 时，测试文件可以更简洁：

```python
# test_simple.py
import simple

def test_simple():
    assert simple.add(2, 2) == 4

def test_str():
    assert simple.add('hello', 'world') == 'helloworld'
```

运行方式：

```bash
python -m pytest
```

`pytest` 会自动发现测试并执行。文章指出，`pytest` 功能远不止这个例子，但入门通常很容易。

相关概念：[[concepts/pytest]]、测试发现、Python测试工具

## 练习：为 `Stock` 类编写单元测试

练习要求为之前实现的 `Stock` 类编写测试文件 `test_stock.py`。该类来自前面关于 typed-properties 的练习。

起始测试用于验证实例创建：

```python
import unittest
import stock

class TestStock(unittest.TestCase):
    def test_create(self):
        s = stock.Stock('GOOG', 100, 490.1)
        self.assertEqual(s.name, 'GOOG')
        self.assertEqual(s.shares, 100)
        self.assertEqual(s.price, 490.1)

if __name__ == '__main__':
    unittest.main()
```

运行成功时输出类似：

```text
.
----------------------------------------------------------------------
Ran 1 tests in 0.000s

OK
```

随后需要补充测试：

1. `s.cost` 属性是否返回正确值 `49010.0`。
2. `s.sell()` 方法是否能正确减少 `s.shares`。
3. `s.shares` 是否不能被设置为非整数值。

测试异常可以使用上下文管理器形式的 `assertRaises`：

```python
def test_bad_shares(self):
    s = stock.Stock('GOOG', 100, 490.1)
    with self.assertRaises(TypeError):
        s.shares = '100'
```

这个练习将单元测试应用到对象创建、属性计算、方法副作用和类型约束验证等场景。

相关概念：面向对象测试、属性测试、异常测试

## 核心要点

- Python 动态语言特性使测试尤其重要。
- `assert` 用于程序内部检查和不变量验证，不应用于用户输入验证。
- 契约式编程通过断言明确接口前置条件。
- 内联断言适合做简单冒烟测试，但不适合完整测试体系。
- `unittest` 是 Python 标准单元测试框架，基于 `TestCase`、`test_` 方法和断言方法。
- `unittest.main()` 可用于从脚本运行测试。
- `pytest` 提供更简洁的测试编写和自动发现机制。
- 编写测试应覆盖对象初始化、属性、方法行为和异常情况。

## 可延伸的概念页

- 软件测试：测试在软件开发中的作用与层次。
- [[concepts/单元测试]]：围绕函数、类和模块的最小粒度验证。
- [[concepts/断言]]：运行时假设检查与测试表达方式。
- 契约式编程：通过前置条件、后置条件和不变量设计接口。
- Python unittest：Python 标准测试框架的结构与用法。
- [[concepts/pytest]]：Python 第三方测试框架及其测试发现机制。
- 异常测试：验证代码在错误输入下是否抛出预期异常。

## Related Concepts
- [[concepts/测试-日志与调试]]
- [[concepts/测试-日志与调试]]
- [[concepts/异常处理]]
- [[concepts/库接口设计]]
- [[concepts/Python-开发环境]]
- [[concepts/模块与-import]]
- [[concepts/main-函数与脚本结构]]
- [[concepts/上下文管理器]]
- [[concepts/Python-property-属性]]
- [[concepts/类型注解]]
- [[concepts/鸭子类型]]
