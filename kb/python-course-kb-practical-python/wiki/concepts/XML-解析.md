---
sources: [summaries/01_Python.md]
brief: XML 解析是把 XML 文档转换成可查询结构，并从标签中提取需要的数据。
---

# XML 解析

## 概念定义

XML 解析是把 XML 文本或数据流转换成程序可查询的数据结构的过程。课程入门示例使用 `xml.etree.ElementTree.parse()` 解析公交 API 返回的数据，再用 `findall()` 查找目标标签。

这个主题连接 [[concepts/Python-网络请求]]、[[concepts/文件类对象]]、[[concepts/CSV-数据处理]] 和 [[concepts/数据清洗与类型转换]]。

## 基本流程

```python
from xml.etree.ElementTree import parse

doc = parse(source)
for item in doc.findall(".//prdctdn"):
    print(item.text)
```

`source` 可以是打开的文件，也可以是网络请求返回的文件类对象。解析后得到的对象可以按标签路径查询。

## 与 CSV 的区别

CSV 是行列结构，适合表格数据；XML 是带标签的树形结构，适合嵌套数据。两者都需要把外部文本转换成 Python 程序能处理的对象。

## 教学边界

Practical Python Programming 的后续主线不依赖 XML。该示例主要展示 Python 标准库和外部数据的组合能力，而不是要求学习者在入门阶段深入掌握 XML。

## 相关概念

- [[concepts/Python-网络请求]]
- [[concepts/文件类对象]]
- [[concepts/数据清洗与类型转换]]
- [[concepts/CSV-数据处理]]
