---
sources: [summaries/01_Datatypes.md, summaries/03_Numbers.md]
brief: Python 真值测试说明对象在 if、while、and、or 等布尔上下文中如何被判定为真或假。
---

# Python 真值测试

## 概念定义

真值测试是 Python 在条件语句中判断对象“真”或“假”的规则。`if value:` 不要求 `value` 必须是 `bool`；Python 会按对象自身的真值规则解释它。

这个主题连接 [[concepts/None-与缺失值]]、[[concepts/变量与数据类型]]、[[concepts/Python-容器]] 和 [[concepts/异常处理]]。

## 常见假值

以下对象在布尔上下文中为假：

- `None`
- `False`
- 数字零，例如 `0`、`0.0`
- 空字符串 `""`
- 空列表 `[]`
- 空元组 `()`
- 空字典 `{}`
- 空集合 `set()`

其他大多数对象为真。

## 字符串不是语义解析

```python
bool("False")   # True
bool("0")       # True
bool("")        # False
```

`bool()` 不会理解字符串内容的自然语言含义。非空字符串为真，即使它的文本是 `"False"`。

## 条件判断中的设计

```python
if value is None:
    ...
```

当你想检测“缺失值”时，通常应明确使用 `is None`，而不是 `if not value:`。后者会把 `0`、空字符串和空容器也当作假。

## 相关概念

- [[concepts/None-与缺失值]]
- [[concepts/变量与数据类型]]
- [[concepts/Python-容器]]
- [[concepts/异常处理]]
