---
doc_type: short
full_text: sources/03_Error_checking.md
---

# 03_Error_checking 总结

本文补充说明 Python 中的错误检查与异常处理机制，重点包括：Python 的运行时错误模型、异常的抛出与捕获、异常传播、捕获范围控制、重新抛出、`finally` 与 `with` 的资源管理，以及在 `parse_csv()` 中处理脏数据的实践练习。相关主题可归入 Python异常处理、错误处理最佳实践、资源管理 与 CSV解析。

## 核心观点

Python 通常不会在函数调用前检查参数类型或取值。函数只要接收到的数据能支持函数体中的操作，就会运行；否则错误会在运行时以异常形式出现。

例如：

```python
def add(x, y):
    return x + y

add(3, 4)               # 7
add('Hello', 'World')   # 'HelloWorld'
add('3', '4')           # '34'
add(3, '4')             # TypeError
```

这体现了 Python 的动态类型特征：代码是否正确通常通过运行和测试来验证。因此，本文强调测试在 Python 程序可靠性中的重要性，相关内容可连接到 Python测试。

## 异常的基本用法

异常用于表示程序中的错误或非正常情况。

### 抛出异常

使用 `raise` 主动抛出异常：

```python
if name not in authorized:
    raise RuntimeError(f'{name} not authorized')
```

### 捕获异常

使用 `try-except` 捕获异常：

```python
try:
    authenticate(username)
except RuntimeError as e:
    print(e)
```

`except RuntimeError as e` 中的 `e` 是异常实例，保存了具体错误信息。虽然它是对象，但打印时通常表现得像字符串。

## 异常传播机制

异常会沿调用栈向上传播，直到遇到第一个匹配的 `except` 块。

如果某个函数中抛出了 `RuntimeError`，调用它的函数没有处理，异常会继续向上传递；一旦被某层 `except RuntimeError` 捕获，传播就停止，不会继续传给更外层调用者。

这说明异常处理具有“最近匹配处理者优先”的特性。捕获后，程序会从整个 `try-except` 结构之后的第一条语句继续执行。

## 内置异常

Python 提供了多种内置异常类型，异常名称通常暗示了错误原因。例如：

- `TypeError`：类型不支持某操作
- `ValueError`：值的格式或内容不合法
- `KeyError`：字典中找不到指定键
- `IndexError`：序列索引越界
- `ImportError`：模块导入失败
- `RuntimeError`：一般运行时错误
- `SyntaxError`：语法错误
- `KeyboardInterrupt`：用户中断程序

本文列举的异常包括：

```python
ArithmeticError
AssertionError
EnvironmentError
EOFError
ImportError
IndexError
KeyboardInterrupt
KeyError
MemoryError
NameError
ReferenceError
RuntimeError
SyntaxError
SystemError
TypeError
ValueError
```

完整列表应参考 Python 官方文档。

## 捕获多个异常

可以用多个 `except` 分别处理不同错误：

```python
try:
    ...
except LookupError as e:
    ...
except RuntimeError as e:
    ...
except IOError as e:
    ...
except KeyboardInterrupt as e:
    ...
```

如果多个异常的处理逻辑相同，可以将它们组合：

```python
try:
    ...
except (IOError, LookupError, RuntimeError) as e:
    ...
```

这属于 Python异常处理 中的异常分类处理策略。

## 捕获所有异常的风险

可以使用 `Exception` 捕获几乎所有普通异常：

```python
try:
    ...
except Exception:
    print('An error occurred')
```

但这通常是危险做法，因为它会隐藏真正的错误原因，使调试困难。例如：

```python
try:
    go_do_something()
except Exception:
    print('Computer says no')
```

这种写法会吞掉所有异常，包括意料之外的问题，例如依赖模块未安装、代码逻辑错误等。

更好的做法是至少打印异常原因：

```python
try:
    go_do_something()
except Exception as e:
    print('Computer says no. Reason :', e)
```

但总体原则是：只捕获你能合理处理的异常。不要捕获无法恢复的错误。相关主题可归入 错误处理最佳实践。

## 重新抛出异常

如果需要记录日志或执行某些补救动作，但仍希望调用者知道错误，可以在 `except` 中使用裸 `raise` 重新抛出当前异常：

```python
try:
    go_do_something()
except Exception as e:
    print('Computer says no. Reason :', e)
    raise
```

这种模式适合“记录后继续上抛”，避免错误被静默吞掉。

## 异常处理最佳实践

本文给出的核心建议是：

- 不要随意捕获异常。
- 让程序快速、明确地失败，即 “fail fast and loud”。
- 只有当你确实能够恢复并继续运行时，才捕获异常。
- 如果捕获所有异常，应提供查看或报告错误原因的机制。
- 对于“不应该发生”的无意义状态，可以主动检查并抛出异常。

这一区分很重要：

- 不需要检查所有参数类型，让错误自然暴露即可。
- 但如果参数组合本身在语义上无效，应主动报错。

例如，`parse_csv()` 中如果指定 `select`，就必须有列标题；因此当 `select` 与 `has_headers=False` 同时出现时，应抛出异常。

## `finally`：保证执行的清理逻辑

`finally` 用于指定无论是否发生异常都必须执行的代码：

```python
lock = Lock()
lock.acquire()
try:
    ...
finally:
    lock.release()
```

它常用于释放资源，例如：

- 锁
- 文件
- 网络连接
- 临时资源

这属于 资源管理 的基础模式。

## `with`：现代资源管理方式

现代 Python 中，很多 `try-finally` 资源释放逻辑可以用 `with` 替代：

```python
lock = Lock()
with lock:
    ...
```

离开 `with` 上下文后，资源会自动释放。

文件操作也是典型例子：

```python
with open(filename) as f:
    ...
```

`with` 定义了资源的使用上下文。当执行离开该上下文时，资源会被清理。不过，`with` 只适用于实现了上下文管理协议的对象。

## 练习 3.8：在 `parse_csv()` 中主动抛出异常

此前的 `parse_csv()` 支持用户通过 `select` 参数选择列，但该功能依赖 CSV 文件具有列标题。

因此，如果同时传入：

```python
select=['name', 'price']
has_headers=False
```

就应抛出异常：

```python
raise RuntimeError("select argument requires column headers")
```

示例：

```python
parse_csv('Data/prices.csv', select=['name','price'], has_headers=False)
```

应得到：

```python
RuntimeError: select argument requires column headers
```

该练习强调：不必检查所有输入类型，例如文件名是否为字符串、`types` 是否为列表等；这些错误可以让程序自然失败。但对于语义上自相矛盾的参数组合，应主动检查并报错。

## 练习 3.9：捕获脏数据导致的转换错误

现实中的 CSV 文件可能包含缺失、损坏或格式不正确的数据。例如 `Data/missing.csv` 中某些行的 `shares` 字段为空，转换为 `int` 时会抛出：

```python
ValueError: invalid literal for int() with base 10: ''
```

要求修改 `parse_csv()`：

- 在记录创建期间捕获 `ValueError`
- 对无法转换的行打印警告
- 警告包含行号
- 警告包含失败原因
- 跳过错误行，继续处理后续数据

示例输出：

```python
Row 4: Couldn't convert ['MSFT', '', '51.23']
Row 4: Reason invalid literal for int() with base 10: ''
Row 7: Couldn't convert ['IBM', '', '70.44']
Row 7: Reason invalid literal for int() with base 10: ''
```

最终返回的 `portfolio` 中只包含成功转换的记录。

该练习展示了异常处理的合理用途：输入数据不可靠，但程序可以跳过坏记录并继续工作。

## 练习 3.10：允许用户静默错误

继续修改 `parse_csv()`，增加类似 `silence_errors=True` 的参数，使用户可以主动关闭错误提示：

```python
portfolio = parse_csv(
    'Data/missing.csv',
    types=[str, int, float],
    silence_errors=True
)
```

此时坏记录仍会被跳过，但不打印警告信息。

本文强调：一般不应该静默忽略错误。更好的默认行为是报告问题，并允许用户显式选择是否静默。

## 关键收获

- Python 不会预先验证函数参数类型，错误通常在运行时出现。
- 异常通过 `raise` 抛出，通过 `try-except` 捕获。
- 异常会传播到第一个匹配的 `except`。
- 捕获过宽的异常会隐藏问题，降低可调试性。
- 最好只捕获能够实际处理和恢复的异常。
- 使用裸 `raise` 可以在记录错误后重新抛出异常。
- `finally` 保证清理代码总会运行。
- `with` 是现代 Python 中管理文件、锁等资源的推荐方式。
- 对无意义的参数组合应主动抛出异常。
- 对现实输入中的脏数据，可以捕获特定异常、报告问题并继续处理。

## 相关页面建议

- Python异常处理：异常抛出、捕获、传播、多异常处理与重新抛出。
- 错误处理最佳实践：何时捕获异常、何时快速失败、如何避免吞掉错误。
- 资源管理：`finally`、`with`、上下文管理器与资源释放。
- CSV解析：`parse_csv()` 的参数设计、类型转换、列选择与错误处理。
- Python测试：动态语言中通过测试验证程序行为的重要性。

## Related Concepts
- [[concepts/异常处理]]
- [[concepts/CSV-数据处理]]
- [[concepts/上下文管理器]]
- [[concepts/测试-日志与调试]]
- [[concepts/文件读写]]
- [[concepts/函数]]
- [[concepts/Python-输入输出]]
