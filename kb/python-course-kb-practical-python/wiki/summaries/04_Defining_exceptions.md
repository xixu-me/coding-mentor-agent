---
doc_type: short
full_text: sources/04_Defining_exceptions.md
---

# 04_Defining_exceptions 总结

本文介绍 Python 中如何定义用户自定义异常，以及为什么库代码应使用专用异常来表达特定的使用错误。

## 核心内容

### 自定义异常由类定义

Python 的用户自定义异常通过类来定义，并且通常继承自 `Exception`：

```python
class NetworkError(Exception):
    pass
```

要点：

- 异常本质上是类。
- 自定义异常应继承自 `Exception`。
- 很多自定义异常类不需要额外逻辑，类体中使用 `pass` 即可。

这与 python exceptions 和 python classes 相关。

## 异常层次结构

自定义异常也可以组织成继承层次，用于表达更细分的错误类型：

```python
class AuthenticationError(NetworkError):
     pass

class ProtocolError(NetworkError):
    pass
```

在这个例子中：

- `NetworkError` 是较通用的网络错误。
- `AuthenticationError` 和 `ProtocolError` 是更具体的网络错误。

这种设计允许调用方既可以捕获通用异常，也可以捕获特定异常，属于 exception hierarchy 的典型用法。

## 为什么库应定义自己的异常

练习强调：库通常应定义自己的异常类型，而不是只抛出 Python 内置异常。

原因是：

- 可以区分“普通编程错误”与“库主动报告的使用问题”。
- 调用方可以更精确地捕获和处理库层面的错误。
- API 的错误语义更清晰。

例如，`create_formatter()` 在收到未知格式名时，不应只依赖通用异常，而应抛出自定义的 `FormatError`：

```python
raise FormatError('Unknown table format %s' % name)
```

这与 api error design 和 library design 相关。

## 练习 4.11：定义自定义异常

练习要求修改上一节中的 `create_formatter()` 函数：

- 定义一个自定义异常 `FormatError`。
- 当用户传入无效格式名，例如 `'xls'` 时，抛出 `FormatError`。

示例行为：

```python
>>> from tableformat import create_formatter
>>> formatter = create_formatter('xls')
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
  File "tableformat.py", line 71, in create_formatter
    raise FormatError('Unknown table format %s' % name)
FormatError: Unknown table format xls
```

## 关键结论

- 自定义异常是继承自 `Exception` 的类。
- 简单异常类通常只需要 `pass`。
- 可以通过继承构建异常层次结构。
- 库代码应定义专用异常，以便清晰表达 API 使用错误。
- `FormatError` 是一个适合用于格式选择错误的自定义异常示例。

## Related Concepts
- [[concepts/异常处理]]
- [[concepts/库接口设计]]
- [[concepts/类与对象]]
- [[concepts/继承与多态]]
- [[concepts/表格化输出]]
