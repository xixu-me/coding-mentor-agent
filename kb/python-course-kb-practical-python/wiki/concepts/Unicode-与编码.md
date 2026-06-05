---
sources: [summaries/04_Strings.md]
brief: Unicode 与编码解释字符如何表示为码点，以及文本如何转换为字节。
---

# Unicode 与编码

Unicode 与编码是理解 Python 文本处理的核心概念：**Unicode 负责给字符编号，编码负责把这些编号转换成字节序列**。在 Python 中，普通字符串 `str` 表示文本，字节串 `bytes` 表示原始字节；两者之间需要通过编码和解码互相转换。

相关来源：[[summaries/04_Strings]]。

## 核心区分

### Unicode：字符的统一编号系统

Unicode 是一个字符集标准，它为世界上大量文字、符号、表情、数学符号等分配唯一编号。这个编号通常称为 **code point**，即“码点”。

例如在 [[summaries/04_Strings]] 中提到，Python 字符串中的每个字符在内部都可以看作一个 Unicode 码点：

```python
a = '\xf1'          # 'ñ'
b = '\u2200'        # '∀'
c = '\U0001D122'    # '𝄢'
d = '\N{FOR ALL}'   # '∀'
```

这里：

- `\xf1` 使用较短的十六进制转义形式。
- `\u2200` 使用 4 位十六进制 Unicode 转义。
- `\U0001D122` 使用 8 位十六进制 Unicode 转义。
- `\N{FOR ALL}` 使用 Unicode 字符名称。

这些写法都是在字符串字面量中直接指定字符。

### 编码：字符与字节之间的转换规则

计算机底层处理的是字节，而不是抽象字符。编码规定了如何把 Unicode 字符转换为字节，以及如何把字节还原为字符。

常见编码包括：

- `utf-8`
- `ascii`
- `latin1`

在 Python 中，文本字符串和字节串的转换方式如下：

```python
text = data.decode('utf-8') # bytes -> str
data = text.encode('utf-8') # str -> bytes
```

这说明：

- `decode()`：按指定编码把字节解码为文本。
- `encode()`：按指定编码把文本编码为字节。

## Python 中的 str 与 bytes

### str：文本字符串

`str` 是 Python 中表示文本的类型。它面向字符，而不是原始字节。

例如：

```python
s = 'Hello world'
s[0]    # 'H'
s[-1]   # 'd'
```

对 `str` 进行索引时，得到的是字符。

这与 Python字符串、索引与切片 相关。

### bytes：字节串

`bytes` 用于表示 8 位字节序列，常见于文件、网络、底层 I/O 等场景：

```python
data = b'Hello World\r\n'
```

字节串与字符串很像，也支持一些常见操作：

```python
len(data)                         # 13
data[0:5]                         # b'Hello'
data.replace(b'Hello', b'Cruel')  # b'Cruel World\r\n'
```

但一个重要区别是：**对 bytes 进行索引时，返回的是整数，而不是字符**。

```python
data[0]   # 72，即 'H' 的 ASCII 编码值
```

这体现了 `bytes` 的本质：它不是字符序列，而是整数形式的字节序列。

相关概念：Python字节串、Python字符串。

## 为什么需要编码

文本在程序中通常以 `str` 的形式处理，但当文本需要进入或离开程序时，往往必须变成字节。例如：

- 写入文件
- 从文件读取
- 通过网络发送
- 接收网络数据
- 与操作系统或外部程序交互

这些场景下，必须明确或隐含地使用某种编码。

例如：

```python
text = '∀'
data = text.encode('utf-8')
```

此时 `text` 是字符意义上的文本，`data` 是字节意义上的表示。

反过来：

```python
text = data.decode('utf-8')
```

如果解码时使用了错误的编码，可能会产生乱码或抛出错误。

## UTF-8 的重要性

`utf-8` 是现代系统中最常用的 Unicode 编码方式之一。它的特点包括：

- 可以表示所有 Unicode 字符。
- 对英文和 ASCII 字符兼容性好。
- 在互联网、文件格式、源代码、API 数据交换中非常常见。

在 [[summaries/04_Strings]] 中，文本与字节之间的示例使用的就是 `utf-8`：

```python
text = data.decode('utf-8')
data = text.encode('utf-8')
```

## 字符串转义与 Unicode

Python 字符串字面量中可以使用转义序列表示特殊字符。普通控制字符包括：

```python
'\n'   # 换行
'\r'   # 回车
'\t'   # 制表符
'\\'  # 反斜杠
```

Unicode 字符也可以通过转义表示：

```python
'\u2200'        # '∀'
'\U0001D122'    # '𝄢'
'\N{FOR ALL}'   # '∀'
```

这些转义发生在 Python 源代码层面，用于告诉解释器应该创建哪个字符。

相关概念：Python字符串、文本表示。

## 原始字符串与编码的区别

原始字符串使用 `r` 前缀，例如：

```python
rs = r'c:\newdata\test'
```

它的作用是让反斜杠不按普通转义序列解释，常用于：

- 文件路径
- 正则表达式

需要注意：**原始字符串并不是一种编码**。它只是改变 Python 源代码中字面量的反斜杠解释方式。字符串创建出来后，仍然是普通的 `str` 文本对象。

相关概念：[[concepts/正则表达式]]、Python字符串。

## 常见误区

### 误区一：字符等于字节

字符不是字节。一个字符在不同编码下可能对应不同的字节序列。比如非 ASCII 字符在 UTF-8 中通常占多个字节。

### 误区二：bytes 是另一种字符串

`bytes` 与 `str` 相似，但语义不同：

- `str` 表示文本字符。
- `bytes` 表示原始字节。

因此，不能随意混用二者。需要显式使用 `encode()` 或 `decode()`。

### 误区三：编码只在中文等非英文文本中重要

即使处理英文文本，编码也仍然存在。ASCII、UTF-8、Latin-1 等都可能影响数据如何被解释。只是英文字符通常在多种编码中表现相同，因此问题不容易暴露。

## 与 Python 字符串不可变性的关系

无论是 `str` 还是 `bytes`，都具有不可变特征。对文本或字节数据进行替换、转换、编码、解码时，通常都会创建新对象，而不是原地修改原对象。

例如：

```python
s = 'Hello'
t = s.upper()      # 创建新字符串

data = b'Hello'
new = data.replace(b'Hello', b'Hi')  # 创建新 bytes
```

相关概念：Python不可变对象。

## 实践建议

- 在程序内部，优先使用 `str` 处理文本。
- 在读写文件、网络通信、二进制协议等边界处，明确使用编码。
- 常规情况下优先选择 `utf-8`。
- 遇到 `bytes` 时，先确认它使用什么编码，再调用 `decode()`。
- 需要输出文本为字节时，使用 `encode()`。
- 不要把原始字符串 `r'...'` 和字符编码混淆。

## 相关页面

- [[summaries/04_Strings]]
- Python字符串
- Python字节串
- Python不可变对象
- 文本表示
- [[concepts/正则表达式]]