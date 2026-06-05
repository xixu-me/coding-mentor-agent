---
doc_type: short
full_text: sources/06_Files.md
---

# 06_Files 总结

本文介绍 Python 中的基础文件管理，包括如何打开、读取、写入和关闭文件，以及在实际数据处理任务中逐行读取文本文件的方法。它以 `portfolio.csv` 为例，展示如何从 CSV 文本中读取股票持仓数据并计算总成本。相关主题包括 Python文件读写、[[concepts/上下文管理器]]、文本处理、CSV数据处理。

## 核心内容

### 文件输入与输出

Python 使用内置函数 `open()` 打开文件：

```python
f = open('foo.txt', 'rt')     # 以文本模式读取
g = open('bar.txt', 'wt')     # 以文本模式写入
```

常见模式包括：

- `'rt'`：read text，文本读取模式。
- `'wt'`：write text，文本写入模式。

读取整个文件：

```python
data = f.read()
```

也可以限制读取的最大字节数：

```python
data = f.read(maxbytes)
```

写入文本：

```python
g.write('some text')
```

使用完文件后应关闭：

```python
f.close()
g.close()
```

不过手动关闭容易遗漏，因此推荐使用 `with` 语句。

## 使用 `with` 自动管理文件

推荐写法：

```python
with open(filename, 'rt') as file:
    # 使用 file
    ...
```

`with` 语句会在缩进代码块结束后自动关闭文件，不需要显式调用 `close()`。这体现了 Python 的 [[concepts/上下文管理器]] 机制，是处理文件资源的标准做法。

## 常见读取文件方式

### 一次性读取整个文件

```python
with open('foo.txt', 'rt') as file:
    data = file.read()
```

这种方式简单，但如果文件很大，会一次性占用较多内存，因此不总是最佳选择。

### 逐行读取文件

```python
with open(filename, 'rt') as file:
    for line in file:
        # 处理每一行
```

文件对象可以直接用于 `for` 循环，循环会自动逐行读取，直到文件结束。这是处理大文本文件的常用方式。

## 常见写入文件方式

### 使用 `write()` 写入字符串

```python
with open('outfile', 'wt') as out:
    out.write('Hello World\n')
```

### 将 `print()` 输出重定向到文件

```python
with open('outfile', 'wt') as out:
    print('Hello World', file=out)
```

这说明 `print()` 不只能输出到终端，也可以通过 `file=` 参数输出到文件对象。

## 练习 1.26：文件预备知识

练习使用 `Data/portfolio.csv` 文件。该文件包含股票投资组合数据，格式类似：

```text
name,shares,price
"AA",100,32.20
"IBM",50,91.10
...
```

### 查看当前工作目录

可以用 `os.getcwd()` 查看 Python 当前运行目录：

```python
import os
os.getcwd()
```

这有助于确认相对路径 `Data/portfolio.csv` 是否能被正确找到。

### 原始字符串表示与格式化输出

读取整个文件后，在交互式解释器中直接输入变量名：

```python
data
```

会显示字符串的原始表示，包括引号和转义字符，如 `\n`。

而使用：

```python
print(data)
```

会显示实际格式化后的文本内容。

这一区别有助于理解 Python 字符串的“表示形式”和“打印结果”。

## 使用 `next()` 跳过或读取单行

如果需要手动读取一行，比如跳过 CSV 文件的表头，可以使用 `next()`：

```python
f = open('Data/portfolio.csv', 'rt')
headers = next(f)
for line in f:
    print(line, end='')
f.close()
```

`next(f)` 会返回文件中的下一行。`for line in f` 本质上也在内部反复调用 `next()`。通常不需要手动调用 `next()`，除非要显式读取或跳过某一行。

## 基础文本拆分处理

读取每一行后，可以用 `split()` 将 CSV 行按逗号拆开：

```python
headers = next(f).split(',')

for line in f:
    row = line.split(',')
    print(row)
```

示例输出：

```python
['"AA"', '100', '32.20\n']
```

这展示了最基础的 文本处理 和 CSV数据处理 思路：读取文本行、拆分字段、进一步转换数据类型。

## 练习 1.27：读取数据文件并计算总成本

任务是编写 `pcost.py`，读取 `portfolio.csv`，并计算购买所有股票的总成本。

CSV 文件列含义：

- `name`：股票名称。
- `shares`：股数。
- `price`：购买价格。

每一行的成本计算方式：

```python
cost = shares * price
```

其中需要将字符串转换为数字：

```python
int(s)      # 转为整数
float(s)    # 转为浮点数
```

最终输出示例：

```bash
Total cost 44671.15
```

该练习把文件读取、字符串拆分、类型转换和累加计算结合起来，是后续数据处理程序的基础。

## 练习 1.28：其他类型的“文件”

并非所有文件都能直接用内置 `open()` 处理。例如 gzip 压缩文件需要使用 `gzip` 模块：

```python
import gzip

with gzip.open('Data/portfolio.csv.gz', 'rt') as f:
    for line in f:
        print(line, end='')
```

关键点是必须指定 `'rt'` 文本模式。否则读取到的会是字节字符串，而不是普通文本字符串。

这说明 Python 中很多对象都可以表现得“像文件一样”，只要它们支持类似的读取接口。这与 文件类对象 相关。

## 关于是否应使用 Pandas

文中指出，Pandas 确实可以方便地读取 CSV 文件，但本课程重点不是 Pandas，而是标准 Python 的基础能力。

使用 CSV 文件的原因是：

- CSV 格式常见，容易理解。
- 可以直接用标准 Python 处理。
- 适合演示文件读取、字符串处理、循环、类型转换等核心语言特性。

因此，在实际工作中可以使用 Pandas，但在本课程中会继续使用标准 Python 功能，以强化基础编程能力。

## 关键概念

- Python文件读写：使用 `open()`、`read()`、`write()`、`close()` 进行基本文件操作。
- [[concepts/上下文管理器]]：使用 `with` 自动管理文件关闭。
- 逐行读取：通过 `for line in file` 高效处理文本文件。
- 文本处理：使用 `split()` 等方法处理读取到的文本行。
- CSV数据处理：从逗号分隔文本中提取字段并转换类型。
- 文件类对象：普通文件和 gzip 文件都可通过类似接口逐行读取。

## 主要收获

本文的核心贡献是建立 Python 文件处理的基本模式：优先使用 `with open(...)` 打开文件，通过 `read()` 或逐行迭代读取内容，必要时用 `next()` 跳过表头，并结合字符串拆分与类型转换完成简单数据分析任务。

## Related Concepts
- [[concepts/文件读写]]
- [[concepts/CSV-数据处理]]
- [[concepts/字符串处理]]
- [[concepts/Python-输入输出]]
- [[concepts/迭代协议与生成器]]
- [[concepts/变量与数据类型]]
- [[concepts/模块与-import]]
- [[concepts/课程练习工作流]]
- [[concepts/Python-开发环境]]
