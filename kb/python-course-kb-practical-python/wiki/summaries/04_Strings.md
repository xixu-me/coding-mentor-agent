---
doc_type: short
full_text: sources/04_Strings.md
---

# 04_Strings 总结

本文介绍 Python 中用于处理文本的核心类型 `str`，涵盖字符串字面量、转义字符、Unicode 表示、索引与切片、常用操作和方法、不可变性、类型转换、字节串、原始字符串、f-string，以及与正则表达式的初步衔接。相关主题可延伸到 Python字符串、Unicode与编码、Python不可变对象、Python格式化字符串、[[concepts/正则表达式]]。

## 字符串字面量

Python 字符串可以用单引号、双引号或三引号表示：

```python
a = 'Yeah but no but yeah but...'
b = "computer says no"
c = '''
多行文本
会保留换行和格式
'''
```

要点：

- 单引号和双引号没有语义差别。
- 字符串必须用相同类型的引号开始和结束。
- 普通字符串通常只能写在一行。
- 三引号字符串可以跨多行，并保留其中的格式。

## 转义字符

转义序列用于表示不方便直接输入的字符或控制字符：

```python
'\n'   # 换行
'\r'   # 回车
'\t'   # 制表符
'\''   # 单引号
'\"'   # 双引号
'\\'  # 反斜杠
```

这与 Python字符串 和 文本表示 有关。

## Unicode 字符表示

Python 字符串中的字符在内部以 Unicode code point 表示。可以通过不同形式的转义指定具体字符：

```python
a = '\xf1'          # 'ñ'
b = '\u2200'        # '∀'
c = '\U0001D122'    # '𝄢'
d = '\N{FOR ALL}'   # '∀'
```

Unicode 字符数据库可用于查询字符编码。该部分与 Unicode与编码 密切相关。

## 字符串索引与切片

字符串可以像数组一样按位置访问字符，索引从 `0` 开始：

```python
a = 'Hello world'
a[0]    # 'H'
a[4]    # 'o'
a[-1]   # 'd'
```

负索引从字符串末尾开始计算。

切片使用 `:` 选择子串：

```python
a[:5]    # 'Hello'
a[6:]    # 'world'
a[3:8]   # 'lo wo'
a[-5:]   # 'world'
```

切片规则：

- 结束索引位置的字符不包含在结果中。
- 省略起始索引表示从开头开始。
- 省略结束索引表示一直到末尾。

这与 Python序列、索引与切片 相关。

## 字符串基本操作

常见字符串操作包括拼接、求长度、成员测试和重复：

```python
'Hello' + 'World'   # 拼接
len('Hello')        # 长度：5
'e' in 'Hello'      # True
'x' in 'Hello'      # False
'hi' not in 'Hello' # True
'Hello' * 5         # 重复
```

`in` 判断的是子串是否存在，而不仅仅是完整单词或独立符号。例如 `'AA' in 'AAPL,...'` 会返回 `True`，因为 `AA` 是 `AAPL` 的前两个字符。

## 字符串方法

字符串对象提供大量方法用于测试和处理文本。

### 去除空白

```python
s = '  Hello '
s.strip()   # 'Hello'
```

### 大小写转换

```python
s = 'Hello'
s.lower()   # 'hello'
s.upper()   # 'HELLO'
```

### 文本替换

```python
s = 'Hello world'
s.replace('Hello', 'Hallo')   # 'Hallo world'
```

### 常见方法列表

```python
s.endswith(suffix)
s.find(t)
s.index(t)
s.isalpha()
s.isdigit()
s.islower()
s.isupper()
s.join(slist)
s.lower()
s.replace(old, new)
s.rfind(t)
s.rindex(t)
s.split([delim])
s.startswith(prefix)
s.strip()
s.upper()
```

这些方法体现了 Python 对文本处理的内建支持，可归入 Python字符串方法。

## 字符串不可变性

字符串是不可变对象，创建后不能原地修改：

```python
s = 'Hello World'
s[1] = 'a'   # TypeError
```

所有看似修改字符串的操作，实际上都会创建一个新字符串。例如：

```python
symbols = symbols + ',GOOG'
symbols = symbols.replace('SCO', 'DOA')
```

变量名只是重新绑定到新字符串，原来的字符串没有被修改。这个概念与 Python不可变对象 和 变量绑定 相关。

## 字符串转换

`str()` 可以把任意值转换成字符串，结果通常与 `print()` 输出的文本一致：

```python
x = 42
str(x)   # '42'
```

这部分与 Python类型转换 相关。

## 字节串 bytes

字节串表示 8 位字节序列，常见于底层 I/O 或网络数据：

```python
data = b'Hello World\r\n'
```

常见字符串操作也可用于字节串：

```python
len(data)                         # 13
data[0:5]                         # b'Hello'
data.replace(b'Hello', b'Cruel')  # b'Cruel World\r\n'
```

但字节串索引返回整数：

```python
data[0]   # 72，即字符 'H' 的 ASCII 码
```

文本字符串和字节串之间需要通过编码转换：

```python
text = data.decode('utf-8') # bytes -> str
data = text.encode('utf-8') # str -> bytes
```

常见编码包括 `'utf-8'`、`'ascii'`、`'latin1'`。这与 Unicode与编码、Python字节串 相关。

## 原始字符串 raw string

原始字符串使用前缀 `r`，其中的反斜杠不会被解释为转义序列：

```python
rs = r'c:\newdata\test'
```

实际内容按字面形式处理，常用于：

- Windows 文件路径
- 正则表达式
- 其他大量使用反斜杠的文本场景

这与 [[concepts/正则表达式]] 有直接联系。

## f-string 格式化字符串

f-string 用于在字符串中嵌入表达式，并支持格式控制：

```python
name = 'IBM'
shares = 100
price = 91.1

f'{name:>10s} {shares:10d} {price:10.2f}'
# '       IBM        100      91.10'

f'Cost = ${shares*price:0.2f}'
# 'Cost = $9110.00'
```

要点：

- f-string 需要 Python 3.6 或更高版本。
- `{}` 中可以放变量或表达式。
- 冒号后可写格式说明，如宽度、对齐、小数位数等。

相关主题：Python格式化字符串、Python输出格式化。

## 练习内容概览

本文练习围绕交互式解释器展开，主要目标是熟悉字符串行为。

### Exercise 1.13：字符和子串提取

使用如下字符串：

```python
symbols = 'AAPL,IBM,MSFT,YHOO,SCO'
```

练习内容：

- 用正索引提取字符。
- 用负索引提取末尾字符。
- 尝试修改字符并观察 `TypeError`，理解字符串不可变性。

### Exercise 1.14：字符串拼接

练习将 `'GOOG'` 添加到字符串末尾，以及将 `'HPQ'` 添加到开头。

重点是理解：

- 拼接产生新字符串。
- 变量重新绑定到新字符串。
- 原字符串没有被原地修改。

### Exercise 1.15：成员测试

通过 `in` 判断子串是否存在：

```python
'IBM' in symbols
'AA' in symbols
'CAT' in symbols
```

重点是理解 `in` 检查的是任意子串匹配，而不是按逗号分隔后的完整股票代码匹配。

### Exercise 1.16：字符串方法

练习：

- `lower()`：转换为小写。
- `find()`：查找子串位置。
- 切片提取子串。
- `replace()`：替换文本。
- `strip()`：去除首尾空白。

并再次强调：字符串方法返回新字符串，不修改原字符串。

### Exercise 1.17：f-string

要求修改前一节的 `mortgage.py` 程序，使用 f-string 生成格式整齐的输出。

该练习将字符串格式化与数值计算输出结合起来，连接到 [[summaries/03_Numbers]] 和 Python格式化字符串。

### Exercise 1.18：正则表达式

基础字符串方法不支持高级模式匹配。复杂文本搜索与替换需要使用 `re` 模块：

```python
import re
text = 'Today is 3/27/2018. Tomorrow is 3/28/2018.'

re.findall(r'\d+/\d+/\d+', text)
# ['3/27/2018', '3/28/2018']

re.sub(r'(\d+)/(\d+)/(\d+)', r'\3-\1-\2', text)
# 'Today is 2018-3-27. Tomorrow is 2018-3-28.'
```

这里展示了两个核心操作：

- `re.findall()`：查找所有匹配。
- `re.sub()`：按模式替换文本。

相关主题：[[concepts/正则表达式]]、Python文本处理。

## 使用 dir() 和 help() 探索对象方法

当需要查看字符串支持哪些操作时，可以使用：

```python
dir(s)
```

它会列出对象可用的方法和属性。

若要查看某个方法的说明，可使用：

```python
help(s.upper)
```

这体现了 Python 交互式探索和自省能力，相关主题包括 Python交互式解释器、Python自省。

## 核心结论

- Python 字符串是用于处理文本的基本类型。
- 字符串可以通过单引号、双引号、三引号表示。
- 转义字符用于表示换行、制表符、引号、反斜杠等特殊字符。
- 字符串内部基于 Unicode code point。
- 字符串支持索引、负索引和切片。
- 常用操作包括拼接、长度、成员测试和重复。
- 字符串方法返回新字符串，不会修改原字符串。
- 字符串是不可变对象。
- `str()` 可将对象转换为字符串。
- `bytes` 表示字节序列，需要通过 `encode()` 和 `decode()` 与文本互转。
- 原始字符串适合路径和正则表达式。
- f-string 是现代 Python 中推荐的字符串格式化方式。
- 更复杂的模式匹配应使用 `re` 模块。

## Related Concepts
- [[concepts/Unicode-与编码]]
- [[concepts/Python-不可变对象]]
- [[concepts/字符串处理]]
- [[concepts/Python-输入输出]]
- [[concepts/Python-文档与帮助系统]]
- [[concepts/变量与数据类型]]
- [[concepts/Python-交互式解释器]]
- [[concepts/列表与序列]]
- [[concepts/Python-运算符与表达式]]
- [[concepts/文件读写]]
- [[concepts/模块与-import]]
