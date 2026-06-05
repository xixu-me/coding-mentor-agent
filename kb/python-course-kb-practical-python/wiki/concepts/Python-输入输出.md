---
sources: [summaries/02_Logging.md, summaries/06_Design_discussion.md, summaries/05_Main_module.md, summaries/03_Error_checking.md, summaries/02_More_functions.md, summaries/03_Formatting.md, summaries/00_Overview.md, summaries/07_Functions.md, summaries/06_Files.md, summaries/04_Strings.md, summaries/03_Numbers.md, summaries/02_Hello_world.md]
brief: Python 输入输出涵盖终端、文件、命令行、环境变量与标准流的数据交换。
---

# Python 输入输出

Python 输入输出指程序从外部环境读取数据，并把处理结果显示、写入或传递回外部环境的方式。入门阶段最常见的是 `print()` 和 `input()`；随着程序开始处理真实数据，输入输出会扩展到文件读写、逐行读取、CSV 解析、字符串格式化、字节串、编码、标准输入输出、命令行参数、环境变量、退出码，以及对列表、元组、集合、字典等数据结构的展示与转换。

在 [[summaries/02_Hello_world]] 中，`print()` 和 `input()` 用于展示基础交互；在 [[summaries/04_Strings]] 中，字符串、f-string、`str()`、`bytes`、编码与解码进一步扩展了文本输入输出能力；在 [[summaries/06_Files]] 中，输入输出从终端扩展到文件，介绍了 `open()`、`read()`、`write()`、`with`、逐行读取和 gzip 文件读取等标准 I/O 模式；在 [[summaries/03_Formatting]] 中，重点讨论了如何把数据输出成整齐的表格，包括字段宽度、对齐方式、小数精度、货币符号和表头分隔线；在 [[summaries/05_Main_module]] 中，输入输出进一步进入命令行脚本场景，涉及 `sys.argv`、`sys.stdin`、`sys.stdout`、`sys.stderr`、环境变量和程序退出。

因此，Python 输入输出不仅是“打印文本”或“读取文件”，更是数据处理流程的一部分：程序读取数据，将其组织为 Python容器 或 序列，经过清洗、转换和计算，再通过 Python格式化字符串、Python字符串格式化、[[concepts/表格化输出]]、文件写入、标准输出或命令行接口生成可读结果。

相关主题包括 Python字符串、Python格式化字符串、Python字符串格式化、Unicode与编码、Python字节串、Python文件读写、[[concepts/上下文管理器]]、文本处理、CSV数据处理、Python数据类型、Python容器、序列、[[concepts/列表推导式]]、Python对象模型、REPL、Python解释器、Python程序入口、命令行工具设计、标准输入输出与管道、环境变量 和 程序退出码与错误处理。

## 输入输出在数据处理中的位置

Python 程序通常围绕数据流动展开：

1. 从用户、文件、终端、命令行参数、环境变量、网络或其他来源读取数据；
2. 将输入内容解析为字符串、数字、列表、字典等对象；
3. 使用循环、函数、推导式或数据结构处理这些对象；
4. 将结果格式化并输出到终端、文件、标准输出、标准错误或其他目标；
5. 在命令行脚本中，用退出码向外部环境报告成功或失败。

因此，输入输出与 Python数据类型、Python容器 和 Python对象模型 密切相关。输入通常先以文本或字节形式进入程序，随后被转换为合适的数据对象；输出则常常把对象转换为可读文本。

例如，读取 CSV 文件时，程序最初得到的是一行行字符串；经过 `split()`、`int()`、`float()` 等处理后，字符串字段会变成数字或结构化数据；最后再用 `print()`、`write()` 或格式化字符串输出计算结果。这正体现了“Working With Data”章节所强调的数据处理路径。

[[summaries/03_Formatting]] 进一步补充了这个路径的最后一步：当程序已经计算出结果后，直接打印 Python 对象往往只适合调试；若要面向用户展示，就需要控制列宽、对齐、小数位数、表头和分隔线，把数据转成结构化报表。

[[summaries/05_Main_module]] 则把这一流程放入真实脚本环境：数据可能来自 `sys.argv` 指定的文件名，结果默认写到 `sys.stdout`，错误信息写到 `sys.stderr`，程序最终通过退出码告诉 shell 是否成功。

## 输出：`print()`

`print()` 是 Python 中最基础的输出函数，用于在终端或交互环境中打印文本和值。

```python
print('Hello world!')
```

输出结果：

```text
Hello world!
```

这是许多 Python 初学程序的第一行代码，也是理解 Python解释器 和 REPL 交互方式的重要入口。

## 打印变量和值

`print()` 可以直接打印变量。需要注意的是，输出的是变量当前绑定的值，而不是变量名本身。

```python
x = 100
print(x)
```

输出：

```text
100
```

这与 Python基础语法 中的变量概念相关：变量只是值的名字，程序运行时会根据变量当前引用的对象进行输出。更深入地看，这也连接到 Python对象模型：变量名引用对象，`print()` 显示对象的字符串形式。

## 打印多个值

`print()` 可以接收多个参数。多个值之间默认用空格分隔。

```python
name = 'Jake'
print('My name is', name)
```

输出：

```text
My name is Jake
```

这种写法常用于简单调试或显示程序状态。例如在 [[summaries/02_Hello_world]] 的西尔斯大厦纸币示例中：

```python
print(day, num_bills, num_bills * bill_thickness)
```

它会依次输出天数、纸币数量和当前纸币堆高度。

不过，逗号分隔打印只能提供粗略输出。如果要控制列宽、小数位数或对齐方式，应使用 f-string、`format()` 或 `%` 格式化。

## 默认换行行为与 `end`

`print()` 默认会在输出末尾添加一个换行符。因此连续调用两次 `print()` 会产生两行输出。

```python
print('Hello')
print('My name is', 'Jake')
```

输出：

```text
Hello
My name is Jake
```

换行本质上对应字符串中的转义字符 `\n`。在 [[summaries/04_Strings]] 中，字符串转义序列被系统介绍，例如：

```python
'\n'   # 换行
'\t'   # 制表符
'\\'  # 反斜杠
```

如果不想让 `print()` 自动换行，可以通过 `end` 参数指定输出结尾。

```python
print('Hello', end=' ')
print('My name is', 'Jake')
```

输出：

```text
Hello My name is Jake
```

在逐行读取文件时，`end` 特别常见。因为从文件中读到的每一行通常已经包含末尾换行符，如果直接 `print(line)`，会额外再打印一个换行，导致行间出现空行。因此常写成：

```python
with open('Data/portfolio.csv', 'rt') as f:
    for line in f:
        print(line, end='')
```

这展示了终端输出与 Python文件读写 的结合。

## 标准输入、标准输出与标准错误

在命令行程序中，输入输出通常通过三个标准流完成：

```python
sys.stdin
sys.stdout
sys.stderr
```

它们都是类似文件的对象：

- `sys.stdin`：标准输入，默认通常连接到键盘或上游管道；
- `sys.stdout`：标准输出，`print()` 默认写入这里；
- `sys.stderr`：标准错误，错误信息、traceback 和诊断信息通常写入这里。

例如：

```python
import sys

print('normal output')              # 默认写到 sys.stdout
print('error message', file=sys.stderr)
```

标准流不一定连接到终端，也可能连接到文件或管道：

```bash
python3 prog.py > results.txt
cmd1 | python3 prog.py | cmd2
```

这使 Python 脚本可以自然地参与 shell 工作流。相关主题见 标准输入输出与管道、命令行工具设计 和 文件类对象。

## 字符串是输出的核心形式

Python 的文本输出最终通常以字符串形式呈现。字符串可以用单引号、双引号或三引号表示：

```python
print('Hello')
print("Hello")
print('''Hello
World''')
```

三引号字符串可以跨多行，并保留文本中的换行和格式，因此适合输出较长说明、帮助文本或多行模板。

在输出中，数值、布尔值、列表、字典等对象会被转换为文本形式显示。例如：

```python
x = 42
print(x)
```

等价地，可以显式使用 `str()` 将对象转换为字符串：

```python
x = 42
text = str(x)
print(text)
```

`str()` 的结果通常与 `print()` 打印该对象时看到的文本一致。相关概念见 Python类型转换 和 Python字符串。

## 输出数据结构

随着程序开始处理数据，输出对象往往不再只是单个数字或字符串，而是 Python容器，例如列表、元组、集合和字典。

```python
names = ['AA', 'IBM', 'MSFT']
prices = {'IBM': 91.10, 'MSFT': 51.23}

print(names)
print(prices)
```

这种直接输出适合快速检查对象内容，尤其适合在 REPL 中探索。但如果面向用户展示结果，通常需要格式化输出，例如逐行打印、对齐列、控制数字精度，或将容器中的数据转换成表格文本。

这也是 [[summaries/00_Overview]] 和 [[summaries/03_Formatting]] 中“处理数据”主题与输入输出相交的地方：数据结构负责组织数据，格式化输出负责让结果可读。

## 原始表示与格式化输出

在 REPL 中，直接输入变量名和使用 `print()` 可能产生不同显示效果。例如读取文件后：

```python
with open('Data/portfolio.csv', 'rt') as f:
    data = f.read()
```

在交互式提示符中直接输入：

```python
data
```

Python 会显示字符串的原始表示，其中包含引号和转义字符：

```python
'name,shares,price\n"AA",100,32.20\n...'
```

而使用：

```python
print(data)
```

会显示真正格式化后的多行文本：

```text
name,shares,price
"AA",100,32.20
...
```

这一区别有助于理解：REPL 展示的是对象的表示形式，而 `print()` 面向用户输出更可读的文本。

## 使用 f-string 构造格式化输出

当需要把变量值嵌入字符串时，推荐使用 f-string。它可以让输出语句更清晰，也能控制数字精度、宽度和对齐方式。

```python
name = 'IBM'
shares = 100
price = 91.1

print(f'{shares} shares of {name} at ${price:0.2f}')
```

输出：

```text
100 shares of IBM at $91.10
```

f-string 的一般形式是：

```python
f'{expression:format}'
```

其中 `expression` 是要计算并插入的表达式，`format` 是格式说明。格式说明位于冒号 `:` 后面，常用于控制类型、宽度、对齐和精度。

例如：

```python
print(f'{name:>10s} {shares:>10d} {price:>10.2f}')
```

输出类似：

```text
       IBM        100      91.10
```

格式说明中的含义包括：

- `>10s`：字符串右对齐，占 10 个字符宽度；
- `<10s`：字符串左对齐，占 10 个字符宽度；
- `^10s`：字符串居中，占 10 个字符宽度；
- `>10d`：整数右对齐，占 10 个字符宽度；
- `>10.2f`：浮点数右对齐，占 10 个字符宽度，保留 2 位小数；
- `0.2f`：浮点数保留 2 位小数；
- `*>16,.2f`：用 `*` 填充，右对齐，占 16 位，带千位分隔符，保留 2 位小数。

这与 Python格式化字符串、Python字符串格式化、[[summaries/03_Numbers]]、[[summaries/04_Strings]] 和 [[summaries/03_Formatting]] 相关。尤其是在输出金额、表格、计算结果、容器内容或数据处理结果时，f-string 比简单逗号分隔打印更适合生成整齐、可读的文本。

## 数字格式化

数字输出常见需求包括控制小数位数、字段宽度、对齐方向、填充字符和千位分隔符。

```python
value = 42863.1

print(value)
print(f'{value:0.4f}')
print(f'{value:>16.2f}')
print(f'{value:<16.2f}')
print(f'{value:*>16,.2f}')
```

输出效果包括：

```text
42863.1
42863.1000
        42863.10
42863.10
*******42,863.10
```

这说明格式化并不只是“美化输出”，还会影响数值结果的可读性。例如财务报表通常需要固定两位小数，较大的数值可能需要千位分隔符，而表格列则需要统一宽度。

格式化结果本身也是字符串，可以保存到变量中，而不必立即打印：

```python
text = f'{value:0.4f}'
```

## 表格化输出

[[summaries/03_Formatting]] 的核心应用场景是把数据输出为整齐表格。例如股票报表可以显示名称、股数、当前价格和价格变化：

```text
      Name     Shares      Price     Change
---------- ---------- ---------- ----------
        AA        100       9.22     -22.98
       IBM         50     106.28      15.18
       CAT        150      35.46     -47.98
```

这种输出通常分为三步：

1. 先收集结构化数据，例如由元组组成的列表；
2. 打印表头和分隔线；
3. 逐行格式化输出每条记录。

例如：

```python
report = [
    ('AA', 100, 9.22, -22.98),
    ('IBM', 50, 106.28, 15.18),
]

for name, shares, price, change in report:
    print(f'{name:>10s} {shares:>10d} {price:>10.2f} {change:>10.2f}')
```

也可以使用旧式 `%` 格式化：

```python
for row in report:
    print('%10s %10d %10.2f %10.2f' % row)
```

如果价格需要显示货币符号，可以先把价格格式化为字符串，再按列宽输出：

```python
for name, shares, price, change in report:
    price_text = f'${price:0.2f}'
    print(f'{name:>10s} {shares:>10d} {price_text:>10s} {change:>10.2f}')
```

这种模式与 [[concepts/表格化输出]]、股票投资组合报表、数据处理流程 和 CSV数据处理 密切相关。它体现了一个重要设计原则：先计算并组织数据，再统一负责展示格式。

## `format_map()`、`format()` 与 `%` 格式化

如果数据已经保存在字典中，可以使用 `format_map()` 按字段名取值并格式化：

```python
s = {
    'name': 'IBM',
    'shares': 100,
    'price': 91.1
}

text = '{name:>10s} {shares:10d} {price:10.2f}'.format_map(s)
print(text)
```

`format()` 方法也可以执行字符串格式化，既支持关键字参数，也支持位置参数：

```python
'{name:>10s} {shares:10d} {price:10.2f}'.format(
    name='IBM', shares=100, price=91.1
)

'{:>10s} {:10d} {:10.2f}'.format('IBM', 100, 91.1)
```

Python 还支持较早的 `%` 字符串格式化方式：

```python
'The value is %d' % 3
'%5d %-5d %10d' % (3, 4, 5)
'%0.2f' % (3.1415926,)
```

虽然在普通文本输出中 f-string 往往更推荐，但 `%` 格式化仍然有一个重要用途：它是字节串 `bytes` 上可用的格式化方式。

```python
b'%s has %d messages' % (b'Dave', 37)
b'%b has %d messages' % (b'Dave', 37)
```

这把字符串格式化和 Python字节串、Unicode与编码 联系起来。

## 输入：`input()`

`input()` 用于从用户那里读取一行文本。它通常会先显示一个提示信息，然后等待用户输入。

```python
name = input('Enter your name:')
print('Your name is', name)
```

`input()` 的返回值永远是文本字符串，即使用户输入的是数字也是如此。

```python
age = input('Age: ')
```

如果用户输入 `42`，变量 `age` 的值是字符串 `'42'`，而不是整数 `42`。如果要用于数值计算，需要显式转换：

```python
age = int(input('Age: '))
```

这一点连接了 Python输入输出、Python字符串 和 Python类型转换：输入首先是文本，程序再根据需要解析为数字或其他类型。

在 [[summaries/02_Hello_world]] 中，`input()` 被描述为适合小型程序、学习练习、简单调试和临时交互。但它并不广泛用于复杂真实程序中的主要交互方式。大型程序通常会使用命令行参数、配置文件、图形界面、网络接口、数据库或文件输入输出等更系统的方式。

## 命令行参数：`sys.argv`

在命令行工具中，用户通常不是通过 `input()` 交互输入，而是在启动程序时传入参数。例如：

```bash
python3 report.py portfolio.csv prices.csv
```

命令行本质上是一组文本字符串，可通过 `sys.argv` 获取：

```python
import sys

sys.argv
# ['report.py', 'portfolio.csv', 'prices.csv']
```

其中：

- `sys.argv[0]` 是脚本名；
- `sys.argv[1]`、`sys.argv[2]` 等是用户传入的参数；
- 所有参数起初都是字符串，需要时再转换类型。

常见参数检查方式如下：

```python
import sys

if len(sys.argv) != 3:
    raise SystemExit(f'Usage: {sys.argv[0]} portfile pricefile')

portfile = sys.argv[1]
pricefile = sys.argv[2]
```

这种输入方式非常适合自动化、后台任务、批处理和 shell 管道。它与 命令行工具设计、Python程序入口 和 Python脚本与库的双重用途 密切相关。

## 文件输入：`open()` 与 `read()`

除了从键盘或命令行读取，程序最常见的输入来源之一是文件。在 [[summaries/06_Files]] 中，Python 使用内置函数 `open()` 打开文件：

```python
f = open('foo.txt', 'rt')
```

其中 `'rt'` 表示以文本模式读取。打开后可以一次性读取全部内容：

```python
data = f.read()
```

也可以限制读取的最大字节数：

```python
data = f.read(maxbytes)
```

使用完文件后应关闭：

```python
f.close()
```

不过手动关闭容易遗漏，因此实际代码中更推荐使用 `with`。

## 使用 `with` 管理文件资源

文件应该被正确关闭。推荐写法是使用 `with` 语句：

```python
with open(filename, 'rt') as file:
    data = file.read()
```

当程序离开缩进代码块时，文件会自动关闭，不需要显式调用 `close()`。这体现了 Python 的 [[concepts/上下文管理器]] 机制，也是 Python文件读写 中最重要的惯用法之一。

## 逐行读取文件

虽然 `read()` 一次性读取整个文件很简单，但如果文件很大，或者需要逐行处理文本，通常应直接迭代文件对象：

```python
with open(filename, 'rt') as file:
    for line in file:
        print(line, end='')
```

文件对象可以作为迭代器使用。`for line in file` 会不断读取下一行，直到文件结束。这种方式节省内存，也更适合日志、CSV、配置文件等行式文本数据。

如果只想读取或跳过一行，例如跳过 CSV 表头，可以使用 `next()`：

```python
with open('Data/portfolio.csv', 'rt') as f:
    headers = next(f)
    for line in f:
        print(line, end='')
```

这里也体现了 序列 与迭代思想在文件输入中的作用。

## 文件输出：`write()` 与重定向 `print()`

程序也可以把输出写入文件。打开文件时使用 `'wt'` 表示以文本模式写入：

```python
with open('outfile', 'wt') as out:
    out.write('Hello World\n')
```

`write()` 写入的是字符串，因此如果要写入数字等其他对象，通常需要先转换为字符串或使用格式化字符串。

另一种常见方式是把 `print()` 的输出重定向到文件：

```python
with open('outfile', 'wt') as out:
    print('Hello World', file=out)
```

这说明 `print()` 不只可以输出到终端，也可以通过 `file=` 参数输出到任何类似文件的对象。终端输出、标准输出和文件输出因此共享一套相似的文本表达机制。

## 文本文件、拆分与数据处理

读取文本文件后，下一步通常是处理字符串。例如 `portfolio.csv` 中的每行包含股票名、股数和价格：

```text
name,shares,price
"AA",100,32.20
"IBM",50,91.10
```

可以跳过表头，然后按逗号拆分每一行：

```python
with open('Data/portfolio.csv', 'rt') as f:
    headers = next(f).split(',')
    for line in f:
        row = line.split(',')
        print(row)
```

读取到的数据最初都是字符串；拆分后得到的是列表；如果要进行计算，需要做类型转换：

```python
shares = int(row[1])
price = float(row[2])
cost = shares * price
```

例如计算投资组合总成本时，会综合使用文件读取、跳过表头、逐行循环、字符串拆分、列表索引、`int()` 和 `float()` 类型转换、累加计算，以及最后用 `print()` 或格式化字符串输出结果。

后续若要生成正式报表，可以把每行数据整理成元组或字典，再使用 f-string 输出固定宽度的列。这就是 [[summaries/03_Formatting]] 中股票报表练习的核心。

## 推导式与输入输出数据转换

当输入数据已经被读入列表或其他序列后，[[concepts/列表推导式]] 常用于简洁地转换数据。例如，把文本行转换为去除换行符后的列表：

```python
with open('symbols.txt', 'rt') as f:
    symbols = [line.strip() for line in f]
```

这里文件输入、字符串方法、列表构造和序列迭代结合在一起。推导式本身不是 I/O 操作，但它常出现在输入之后、输出之前的数据清洗和转换阶段。

## 其他类似文件的输入源

并非所有输入文件都是普通文本文件。例如 gzip 压缩文件不能直接用内置 `open()` 读取为普通文本，但可以使用标准库 `gzip`：

```python
import gzip

with gzip.open('Data/portfolio.csv.gz', 'rt') as f:
    for line in f:
        print(line, end='')
```

这里同样使用 `'rt'` 文本模式。如果忘记指定文本模式，读取到的可能是字节串，而不是普通字符串。

这说明 Python 中很多对象都可以表现得“像文件一样”：只要它们提供读取或写入接口，就可以用相似的方式进行 I/O。相关主题包括 文件类对象、Python文件读写 和 Python字节串。

## 文本输入输出与编码

在更底层的输入输出中，程序经常会遇到字节数据，而不是已经解码好的文本。例如网络通信、二进制文件、压缩文件或某些低层 I/O 会使用 `bytes`：

```python
data = b'Hello World\r\n'
```

字节串和普通字符串不同：

```python
data[0]   # 72，即字符 'H' 的 ASCII 编码值
```

要在字节和文本之间转换，需要使用编码和解码：

```python
text = data.decode('utf-8') # bytes -> str
data = text.encode('utf-8') # str -> bytes
```

`'utf-8'` 是常见字符编码，其他常见编码还包括 `'ascii'` 和 `'latin1'`。这部分与 Unicode与编码、Python字节串 和 [[summaries/04_Strings]] 密切相关。

对于入门阶段，可以先记住：

- 面向用户显示的通常是 `str` 文本；
- 文本模式文件读取通常返回 `str`；
- 底层 I/O、二进制文件或未指定文本模式的压缩文件可能返回 `bytes`；
- `encode()` 把文本编码为字节；
- `decode()` 把字节解码为文本；
- 打开文本文件时常用 `'rt'` 或 `'wt'`，其中 `t` 表示 text；
- `bytes` 的字符串格式化主要使用 `%` 格式化。

## 环境变量作为输入

环境变量是在 shell 或运行环境中设置的键值对。Python 程序可以通过 `os.environ` 读取它们：

```python
import os

name = os.environ['NAME']
```

从输入输出角度看，环境变量是一种“隐式输入”：用户不一定在命令行参数中传值，但程序仍然可以从运行环境中获得配置。例如用户名、路径、认证信息、运行模式等都可能通过环境变量传入。

需要注意：

- `os.environ` 类似字典；
- 读取不存在的键会触发错误，必要时可使用 `.get()`；
- 程序对环境变量的修改会影响之后由该程序启动的子进程；
- 环境变量常与 命令行工具设计、Python进程环境 和 环境变量 相关。

## 程序退出与错误输出

命令行程序除了产生文本输出，还需要向外部环境报告是否成功。Python 中常通过 `SystemExit` 或 `sys.exit()` 退出程序：

```python
raise SystemExit
raise SystemExit(1)
raise SystemExit('Usage: prog.py filename')
```

也可以写成：

```python
import sys
sys.exit(1)
```

非零退出码通常表示错误。若传入字符串，程序会输出提示信息并退出。这常用于参数数量错误、文件不存在、输入格式不正确等场景。

这部分与 程序退出码与错误处理 和 调试与错误信息 相关。良好的命令行程序通常把正常结果写到 `sys.stdout`，把错误、警告或用法说明写到 `sys.stderr`，并使用合适的退出码。

## 输入输出与主程序结构

[[summaries/05_Main_module]] 强调：Python 没有固定的 `main()` 函数，但有主模块概念。启动解释器时传入的文件就是主模块。为了让程序既能作为脚本运行，又能作为库导入，常使用：

```python
if __name__ == '__main__':
    main()
```

对于命令行工具，推荐让 `main()` 接收参数列表：

```python
def main(argv):
    if len(argv) != 3:
        raise SystemExit(f'Usage: {argv[0]} portfile pricefile')
    portfile = argv[1]
    pricefile = argv[2]
    ...

if __name__ == '__main__':
    import sys
    main(sys.argv)
```

这种结构对输入输出尤其重要：

- `main(argv)` 明确接收命令行输入；
- 函数内部可以打开文件、读取数据、生成报表并输出；
- 在交互环境中也可以手动调用 `main(['prog.py', 'in.csv', 'out.csv'])` 测试；
- 被 `import` 时不会自动执行命令行输入输出，避免导入副作用。

这与 Python程序入口、Python脚本与库的双重用途、命令行工具设计 和 [[summaries/07_Functions]] 密切相关。

## 原始字符串与路径、正则表达式输入

在处理文件路径或正则表达式时，反斜杠经常出现。普通字符串中反斜杠会引入转义序列，例如 `\n` 表示换行。为了避免混淆，可以使用原始字符串：

```python
path = r'c:\newdata\test'
print(path)
```

原始字符串常用于：

- Windows 文件路径；
- 正则表达式模式；
- 需要大量反斜杠的文本。

例如正则表达式常与文本输入输出结合，用于从文本中查找或替换模式：

```python
import re
text = 'Today is 3/27/2018. Tomorrow is 3/28/2018.'
print(re.findall(r'\d+/\d+/\d+', text))
```

相关主题见 [[concepts/正则表达式]]。

## 输入输出与调试

输入输出也是初学阶段最直接的调试工具。通过 `print()` 输出变量值，可以观察程序执行过程。例如：

```python
print(day, num_bills, num_bills * bill_thickness)
```

结合 f-string，可以让调试输出更清楚：

```python
print(f'day={day}, bills={num_bills}, height={num_bills * bill_thickness:0.2f}')
```

在处理文件和数据结构时，`print()` 也常用于检查读取结果，例如打印每一行、打印拆分后的列表、打印字典内容、打印累计总数等。不过，`print()` 调试只能提供简单观察。随着程序复杂度提升，通常还需要结合错误回溯、断点调试、日志系统等工具。

在命令行程序中，调试或错误信息最好与正常输出分开：正常结果写到 `sys.stdout`，诊断信息写到 `sys.stderr`。这样即使用户把正常输出重定向到文件，错误信息仍然可以显示在终端。

## 与 REPL 的关系

在 REPL 中，输入输出表现得更直接：

- 用户在提示符 `>>>` 后输入表达式或语句；
- Python 立即执行；
- 表达式结果或 `print()` 输出直接显示在终端中。

例如：

```python
>>> print('hello world')
hello world
>>> 37 * 42
1554
```

在 REPL 中，即使没有显式调用 `print()`，表达式的结果也会被显示出来。但在 `.py` 程序文件中，如果希望看到结果，通常需要使用 `print()`。

REPL 也是探索字符串、文件读取、容器对象、命令行函数和输入输出行为的好地方。例如 [[summaries/05_Main_module]] 中的练习要求把 `report.py` 和 `pcost.py` 改成带有 `main(argv)` 的程序后，可以这样测试：

```python
>>> import report
>>> report.main(['report.py', 'Data/portfolio.csv', 'Data/prices.csv'])
```

这种方式把命令行输入模拟为普通列表，便于交互式调试。

## 使用 `dir()` 和 `help()` 探索输入输出相关对象

当需要知道字符串或文件对象支持哪些操作时，可以使用 Python 的自省工具：

```python
s = 'hello'
dir(s)
help(s.upper)
```

文件对象也可以被探索：

```python
f = open('Data/portfolio.csv', 'rt')
dir(f)
help(f.read)
f.close()
```

这对学习文本处理、输出格式化和文件读写接口很有帮助，也与 Python自省、Python交互式解释器 相关。

## 常见初学注意点

- `print()` 输出的是值，不是变量名。
- 多个 `print()` 参数默认用空格分隔。
- `print()` 默认在末尾换行。
- 可以用 `end` 参数改变结尾行为。
- 可以用 `file=` 参数把 `print()` 输出到文件或 `sys.stderr`。
- 文件逐行打印时常用 `print(line, end='')`，避免额外空行。
- 换行、制表符等可以通过字符串转义字符表示。
- `input()` 返回的是用户输入的文本字符串。
- 如果输入内容要参与数值计算，需要用 `int()`、`float()` 等进行转换。
- 真实命令行工具通常更多使用 `sys.argv`，而不是反复调用 `input()`。
- `sys.argv` 中的参数全部是字符串，`sys.argv[0]` 是脚本名。
- `sys.stdin`、`sys.stdout`、`sys.stderr` 是标准输入、输出和错误流。
- stdout 可被重定向到文件，也可通过管道连接其他命令。
- 错误和诊断信息通常应写到 stderr。
- f-string 适合把变量和表达式嵌入输出文本，并控制格式。
- `{expression:format}` 可以指定字段宽度、对齐方式、小数精度、填充字符和千位分隔符。
- 表格输出通常需要统一列宽、表头、分隔线和逐行格式化。
- `format_map()` 适合从字典取值并格式化输出。
- `format()` 支持位置参数和关键字参数，但通常比 f-string 冗长。
- `%` 格式化是旧式写法，但仍常见，并且是 `bytes` 可用的格式化方式。
- `str()` 可以把对象转换成字符串形式。
- 直接打印容器适合调试，面向用户时通常需要更清晰的格式化输出。
- `open(filename, 'rt')` 用于文本读取，`open(filename, 'wt')` 用于文本写入。
- 读取整个文件可用 `read()`，处理大文件或行式文本时更推荐逐行迭代。
- 使用 `with open(...) as f` 可以自动关闭文件，优于手动 `close()`。
- `next(f)` 可以读取或跳过文件中的单行，例如跳过 CSV 表头。
- 文件读取到的内容通常是字符串，计算前需要拆分和类型转换。
- 读取后的数据常会被组织为列表、元组、字典等容器再继续处理。
- 底层 I/O 可能使用 `bytes`，需要通过 `encode()` 和 `decode()` 与文本互转。
- gzip 等压缩文件可通过相应库读取，并应注意使用 `'rt'` 文本模式。
- 环境变量可通过 `os.environ` 读取，是命令行程序常见的配置输入来源。
- 命令行程序可用 `raise SystemExit(...)` 或 `sys.exit(...)` 退出。
- 非零退出码通常表示错误。
- `main(argv)` 能让脚本输入更容易测试，也能避免导入模块时自动执行 I/O。
- 在程序文件中，表达式本身通常不会自动显示结果，需要显式调用 `print()`。

## 相关概念

- [[summaries/02_Hello_world]]：首次介绍 `print()`、`input()`、REPL 和基础程序运行方式。
- [[summaries/03_Numbers]]：介绍数值计算，常与格式化输出结合展示结果。
- [[summaries/04_Strings]]：介绍字符串、f-string、字节串、编码、转义字符和文本处理。
- [[summaries/06_Files]]：介绍文件打开、读取、写入、关闭、逐行处理和 gzip 文件读取。
- [[summaries/03_Formatting]]：集中介绍 f-string、`format_map()`、`format()`、`%` 格式化以及表格输出。
- [[summaries/05_Main_module]]：介绍命令行脚本中的 `sys.argv`、标准 I/O、环境变量、程序退出和 `main(argv)` 模板。
- [[summaries/00_Overview]]：概括“Working With Data”章节，说明数据结构、格式化输出、序列、推导式和对象模型在数据处理中的位置。
- [[summaries/07_Functions]]：函数可封装输入、处理和输出逻辑，使程序结构更清晰。
- [[summaries/02_More_functions]]：补充函数组织方式，与封装 I/O 逻辑相关。
- [[summaries/03_Error_checking]]：补充错误检查，与输入验证、错误输出和退出处理相关。
- Python解释器：Python 程序运行和交互输入输出的执行环境。
- REPL：交互式输入、求值和输出循环。
- Python基础语法：变量、语句、注释、缩进等输入输出代码的基础背景。
- Python数据类型：输入内容需要转换为合适类型，输出对象也依赖其类型表现。
- Python容器：列表、元组、集合和字典常用于组织输入数据并生成输出结果。
- 序列：字符串、列表、元组和文件迭代都体现序列化处理思想。
- [[concepts/列表推导式]]：常用于输入数据读取后的清洗、转换和构造。
- Python对象模型：解释变量引用对象、对象如何转换为可打印表示。
- Python字符串：输入输出中文本表示的核心类型。
- Python格式化字符串：使用 f-string 等方式生成结构化输出文本。
- Python字符串格式化：系统整理 f-string、`format()`、`format_map()` 和 `%` 格式化。
- [[concepts/表格化输出]]：把结构化数据按列宽、对齐、精度和表头输出为表格。
- 股票投资组合报表：围绕 `portfolio.csv`、`prices.csv` 和 `report.py` 的系列数据处理练习。
- Python文件读写：使用 `open()`、`read()`、`write()`、`close()` 和 `with` 处理文件。
- [[concepts/上下文管理器]]：使用 `with` 自动管理文件等资源的生命周期。
- 文本处理：对输入文本进行拆分、清理、转换和分析。
- CSV数据处理：处理逗号分隔文本数据并转换字段类型。
- 数据处理流程：从读取、解析、组织、计算到格式化输出的整体路径。
- 元组解包：表格输出中常用于把一行记录拆成多个变量。
- 文件类对象：具有文件式读取/写入接口的对象，如普通文件、标准流和 gzip 文件。
- Unicode与编码：解释文本和字节之间的转换。
- Python字节串：低层 I/O 中常见的字节序列类型。
- [[concepts/正则表达式]]：对输入文本进行高级模式匹配与替换。
- 调试与错误信息：通过输出和错误信息理解程序行为。
- 循环控制：循环中常用 `print()` 输出每次迭代的状态。
- Python程序入口：说明主模块、`__name__ == '__main__'` 和 `main()` 模板。
- Python脚本与库的双重用途：解释同一文件如何既能导入复用，又能作为脚本执行。
- 命令行工具设计：组织命令行参数、标准流、错误处理和退出码。
- 标准输入输出与管道：解释 stdin、stdout、stderr、重定向和 shell 管道。
- 环境变量：说明从运行环境读取配置输入。
- Python进程环境：说明程序与其环境、子进程之间的关系。
- 程序退出码与错误处理：说明 `SystemExit`、`sys.exit()` 和非零退出码。

See also: [[summaries/06_Design_discussion]]

See also: [[summaries/02_Logging]]