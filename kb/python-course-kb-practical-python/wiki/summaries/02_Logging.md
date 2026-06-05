---
doc_type: short
full_text: sources/02_Logging.md
---

# 02_Logging 总结

## 核心主题

本文介绍 Python 标准库中的 `logging` 模块，说明如何用日志替代直接 `print()` 或静默忽略异常，从而让诊断信息的输出方式、详细程度和目的地变得可配置。相关主题可连接到 Python日志记录、[[concepts/异常处理]]、程序诊断。

## 为什么需要 logging

在解析文件或处理输入数据时，程序经常会遇到格式错误或类型转换失败。例如 `parse()` 或 `parse_csv()` 中可能捕获 `ValueError`。

传统处理方式有两个极端：

- 直接打印错误信息：适合调试或提醒用户，但不够灵活。
- 使用 `pass` 静默忽略：避免干扰用户，但可能掩盖问题。

这两种方式都不理想，因为真实程序往往需要根据运行环境选择不同策略：开发时希望看到详细原因，生产时可能只记录警告或只保留严重错误。`logging` 模块正是为这种可配置诊断而设计的。

## logging 的基本用法

模块通常先创建一个 logger：

```python
import logging
log = logging.getLogger(__name__)
```

使用 `__name__` 创建 logger 的好处是日志来源会自动对应当前模块名，例如 `fileparse`。这使得不同模块的日志可以被分别控制。

常用日志级别包括：

```python
log.critical(message, *args)
log.error(message, *args)
log.warning(message, *args)
log.info(message, *args)
log.debug(message, *args)
```

它们表示不同严重程度：

- `CRITICAL`：最严重的问题。
- `ERROR`：错误。
- `WARNING`：警告，默认通常会显示。
- `INFO`：普通运行信息。
- `DEBUG`：调试细节。

日志消息采用 `%` 风格格式化：

```python
log.warning("Couldn't parse : %s", line)
```

这比提前构造字符串更符合 logging 的使用习惯。

## 在异常处理中使用 logging

原来的异常处理可能是：

```python
except ValueError as e:
    print("Couldn't parse :", line)
    print("Reason :", e)
```

改成 logging 后：

```python
except ValueError as e:
    log.warning("Couldn't parse : %s", line)
    log.debug("Reason : %s", e)
```

这种写法把“发生了坏数据”作为 `warning`，把“具体异常原因”作为 `debug`。这样默认情况下用户可以看到主要问题，而开发者可以通过提高日志详细程度查看原因。

## logging 配置与调用分离

本文强调一个重要设计原则：产生日志的代码和配置日志行为的代码应当分离。

模块内部只负责发出日志：

```python
log.warning(...)
log.debug(...)
```

程序入口负责配置日志系统：

```python
import logging
logging.basicConfig(
    filename='app.log',
    level=logging.INFO,
)
```

这种分离让库代码不必关心日志写到哪里、格式是什么、显示哪些级别；这些都由主程序或运行环境决定。该思想与 关注点分离 有关。

## 练习 8.2：给模块添加日志

练习要求修改 `fileparse.py` 中的 `parse_csv()`，把类型转换失败时的 `print()` 替换为 `logging` 调用。

原代码中，当某一行转换失败时：

```python
print(f"Row {rowno}: Couldn't convert {row}")
print(f"Row {rowno}: Reason {e}")
```

修改后：

```python
log.warning("Row %d: Couldn't convert %s", rowno, row)
log.debug("Row %d: Reason %s", rowno, e)
```

这样做的效果是：

- 默认只看到 `WARNING` 及以上级别的信息。
- 如果配置 logger 为 `DEBUG`，可以看到更详细的异常原因。
- 如果设置为 `CRITICAL`，则普通警告和调试信息都会被关闭。

示例控制方式：

```python
logging.getLogger('fileparse').setLevel(logging.DEBUG)
```

或关闭大部分信息：

```python
logging.getLogger('fileparse').setLevel(logging.CRITICAL)
```

这说明 logger 可以按模块名独立控制，适合大型程序的诊断管理。

## 练习 8.3：给程序添加日志配置

要让整个应用使用 logging，需要在主程序启动阶段初始化日志系统。例如：

```python
import logging
logging.basicConfig(
    filename='app.log',
    filemode='w',
    level=logging.WARNING,
)
```

配置项含义：

- `filename`：日志输出文件；省略时通常输出到标准错误。
- `filemode`：写入模式，`w` 表示覆盖，`a` 表示追加。
- `level`：最低输出级别，如 `DEBUG`、`INFO`、`WARNING`、`ERROR`、`CRITICAL`。

本文提示应思考：在 `report.py` 这类主程序中，日志配置应放在程序启动入口，而不是放进通用工具模块。通常可放在 `if __name__ == '__main__':` 分支中。

## 关键收获

1. `logging` 比 `print()` 更适合程序诊断，因为它可配置、可分级、可按模块管理。
2. 日志级别允许区分警告、错误、调试细节等不同信息。
3. 库模块应只发出日志，不应决定日志写到哪里或显示多少。
4. 主程序负责一次性初始化 logging 配置。
5. 在异常处理中，可以用 `warning` 记录用户应知道的问题，用 `debug` 记录开发者需要的细节。

## 相关概念

- Python日志记录
- [[concepts/异常处理]]
- 程序诊断
- 关注点分离
- 模块化程序设计

## Related Concepts
- [[concepts/测试-日志与调试]]
- [[concepts/库接口设计]]
- [[concepts/main-函数与脚本结构]]
- [[concepts/CSV-数据处理]]
- [[concepts/文件读写]]
- [[concepts/模块与-import]]
- [[concepts/Python-输入输出]]
