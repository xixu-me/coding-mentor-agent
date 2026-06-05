---
doc_type: short
full_text: sources/02_Hello_world.md
---

# 02_Hello_world 总结

本文是 Python 入门课程的第一个实践程序章节，围绕如何运行解释器、使用交互式 REPL、创建并执行 `.py` 文件，以及理解最基础的 Python 语法结构展开。它为后续学习数字、表达式、控制流和调试奠定基础。相关主题可延伸为 Python解释器、REPL、Python基础语法、调试与错误信息。

## 运行 Python

Python 程序总是在解释器中运行。解释器通常是一个基于控制台的程序，可以从终端或命令行启动：

```bash
python3
```

启动后会进入 Python 提示符环境。虽然初学者可能更常使用 IDE，但掌握在终端中运行 Python 仍然是重要技能，因为很多课程练习和调试操作都假设学习者能直接与解释器交互。

## 交互模式与 REPL

启动 Python 后会进入交互模式，也称为 REPL（Read-Eval-Print Loop，读取-求值-打印循环）。在该模式中输入语句会立即执行，无需经历传统的编辑、编译、运行、调试循环。

示例：

```python
>>> print('hello world')
hello world
>>> 37*42
1554
>>> for i in range(5):
...     print(i)
...
0
1
2
3
4
```

REPL 的关键提示符包括：

- `>>>`：开始输入新语句。
- `...`：继续输入多行语句，例如循环体或条件块。
- 空行：结束多行输入并执行。

交互模式中，下划线 `_` 保存上一次表达式的结果：

```python
>>> 37 * 42
1554
>>> _ * 2
3108
```

但这一行为只适用于交互模式，不应在普通程序文件中依赖 `_`。

## 创建和运行程序文件

Python 程序通常写在 `.py` 文件中，例如：

```python
# hello.py
print('hello world')
```

可以使用任意文本编辑器创建该文件。执行程序时，在终端中调用 Python：

```bash
python hello.py
```

在 Windows 上，可能需要指定解释器完整路径，例如：

```text
c:\python36\python hello.py
```

如果 Python 安装配置正确，也可能直接运行脚本文件名。

## 示例程序：西尔斯大厦纸币问题

章节通过一个指数增长问题展示 Python 程序结构：假设第一天在芝加哥西尔斯大厦旁放 1 张美元纸币，此后每天纸币数量翻倍，问纸币堆多长时间会超过大厦高度。

核心程序：

```python
bill_thickness = 0.11 * 0.001 # Meters (0.11 mm)
sears_height = 442 # Height (meters)
num_bills = 1
day = 1

while num_bills * bill_thickness < sears_height:
    print(day, num_bills, num_bills * bill_thickness)
    day = day + 1
    num_bills = num_bills * 2

print('Number of days', day)
print('Number of bills', num_bills)
print('Final height', num_bills * bill_thickness)
```

程序展示了变量、表达式、`while` 循环、缩进代码块、打印输出和循环终止条件等核心概念。运行结果表明，第 23 天纸币高度超过大厦，高度约为 461.37344 米。

## 语句

Python 程序由一系列语句组成：

```python
a = 3 + 4
b = a * 2
print(b)
```

每条语句通常以换行结束，程序按从上到下的顺序执行，直到文件末尾或流程控制改变执行路径。

## 注释

注释是不会被执行的文本，用于解释代码：

```python
a = 3 + 4
# This is a comment
b = a * 2
```

Python 使用 `#` 表示注释，从 `#` 开始直到行尾的内容都会被解释器忽略。

## 变量与命名规则

变量是值的名字。Python 变量名可以包含：

- 大小写字母；
- 下划线 `_`；
- 数字，但数字不能作为第一个字符。

示例：

```python
height = 442   # 合法
_height = 442  # 合法
height2 = 442  # 合法
2height = 442  # 非法
```

## 类型与动态类型

Python 变量不需要声明类型。类型属于右侧的值，而不是变量名本身：

```python
height = 442           # 整数
height = 442.0         # 浮点数
height = 'Really tall' # 字符串
```

这说明 Python 是动态类型语言：同一个变量名在程序执行过程中可以绑定到不同类型的值。相关主题可归入 动态类型。

## 大小写敏感

Python 区分大小写。以下是三个不同变量：

```python
name = 'Jake'
Name = 'Elwood'
NAME = 'Guido'
```

Python 语言关键字必须使用小写：

```python
while x < 0:   # 正确
WHILE x < 0:   # 错误
```

## while 循环

`while` 语句用于重复执行一组语句：

```python
while num_bills * bill_thickness < sears_height:
    print(day, num_bills, num_bills * bill_thickness)
    day = day + 1
    num_bills = num_bills * 2
```

只要 `while` 后面的条件表达式为真，缩进块中的语句就会持续执行。循环结束后，程序继续执行后续未缩进的语句。

该主题可连接到 循环控制。

## 缩进

Python 使用缩进表示语句分组，而不是使用花括号。以下缩进语句共同构成 `while` 循环体：

```python
    print(day, num_bills, num_bills * bill_thickness)
    day = day + 1
    num_bills = num_bills * 2
```

未缩进的语句不属于循环体：

```python
print('Number of days', day)
```

空行只影响可读性，不影响程序执行。

缩进最佳实践：

- 使用空格而不是制表符；
- 每一级缩进使用 4 个空格；
- 使用支持 Python 的编辑器；
- 同一代码块内缩进必须一致。

缩进不一致会导致语法错误或逻辑错误。相关主题可见 Python缩进。

## 条件语句

`if` 语句用于条件执行：

```python
if a > b:
    print('Computer says no')
else:
    print('Computer says yes')
```

多个条件可以用 `elif` 表示：

```python
if a > b:
    print('Computer says no')
elif a == b:
    print('Computer says yes')
else:
    print('Computer says maybe')
```

这构成 Python 基础控制流的一部分，可链接到 条件控制。

## print 输出

`print()` 函数用于输出一行文本：

```python
print('Hello world!')
```

打印变量时，输出的是变量当前绑定的值，而不是变量名：

```python
x = 100
print(x)
```

传入多个值时，`print()` 默认用空格分隔：

```python
name = 'Jake'
print('My name is', name)
```

`print()` 默认在末尾添加换行。可通过 `end` 参数修改结尾内容：

```python
print('Hello', end=' ')
print('My name is', 'Jake')
```

输出结果为：

```text
Hello My name is Jake
```

## 用户输入

`input()` 函数用于读取用户键入的一行文本：

```python
name = input('Enter your name:')
print('Your name is', name)
```

`input()` 会先显示提示信息，然后返回用户输入的字符串。它适合小程序、学习练习和简单调试，但在真实大型程序中并不常作为主要交互方式。

## pass 空语句

`pass` 用于表示空代码块：

```python
if a > b:
    pass
else:
    print('Computer says false')
```

它也称为 no-op 语句，即“不执行任何操作”。通常用作占位符，方便之后补充代码。

## 练习 1.5：弹跳球

练习要求编写 `bounce.py`：一个橡皮球从 100 米高度落下，每次反弹到上一次下落高度的 `3/5`，打印前 10 次反弹高度。

目标输出类似：

```text
1 60.0
2 36.0
3 21.599999999999998
...
10 0.6046617599999998
```

可以使用 `round()` 函数将结果四舍五入到 4 位，以获得更整洁的输出：

```text
1 60.0
2 36.0
3 21.6
...
10 0.6047
```

这个练习强化变量更新、循环计数和浮点数显示问题。

## 练习 1.6：调试

练习提供了一个带错误的 `sears.py` 版本：

```python
day = days + 1
```

运行后会出现：

```text
NameError: name 'days' is not defined
```

关键调试要点：

- 回溯信息（traceback）的最后一行通常说明真正的错误原因；
- 回溯中会显示文件名、行号和出错代码片段；
- 本例错误是变量名写错：应使用 `day`，而不是未定义的 `days`；
- 修正为：

```python
day = day + 1
```

该练习强调阅读错误信息是 Python 编程的重要技能，相关主题可整理为 Python异常与回溯 和 调试与错误信息。

## 核心收获

- Python 程序运行在解释器中，可通过终端或 IDE 使用。
- REPL 适合探索、实验和快速调试。
- `.py` 文件用于保存可重复运行的程序。
- Python 程序由顺序执行的语句组成。
- `#` 用于注释。
- 变量无需声明类型，Python 是动态类型语言。
- Python 区分大小写，关键字必须小写。
- `while`、`if`、`elif`、`else` 构成基础控制流。
- 缩进是 Python 语法的一部分，用于定义代码块。
- `print()` 输出文本，`input()` 获取用户输入。
- `pass` 可作为空代码块占位符。
- 阅读 traceback 是定位和修复错误的关键能力。

## Related Concepts
- [[concepts/Python-控制流与缩进]]
- [[concepts/Python-输入输出]]
- [[concepts/Python-交互式解释器]]
- [[concepts/Python-开发环境]]
- [[concepts/变量与数据类型]]
- [[concepts/测试-日志与调试]]
- [[concepts/课程练习工作流]]
- [[concepts/异常处理]]
- [[concepts/函数]]
- [[concepts/main-函数与脚本结构]]
