---
doc_type: short
full_text: sources/02_Customizing_iteration.md
---

# 02_Customizing_iteration 总结

本文介绍如何用生成器函数自定义 Python 的迭代行为。核心思想是：如果想定义一种新的迭代模式，应优先考虑使用带有 `yield` 的生成器函数，因为它能把数据生产逻辑封装成可被 `for` 循环直接消费的对象。

## 核心概念

### 生成器用于定义迭代

生成器是包含 `yield` 语句的函数，用来定义自定义迭代逻辑。例如倒计时：

```python
def countdown(n):
    while n > 0:
        yield n
        n -= 1
```

调用 `countdown(10)` 不会立即执行函数体，而是返回一个生成器对象。生成器对象实现了 Python 迭代协议，因此可以被 `for` 循环使用，也可以手动调用 `__next__()` 获取下一个值。

相关主题：生成器、迭代协议、yield。

### `yield` 的执行模型

`yield` 会产生一个值，同时暂停函数执行。下一次调用 `__next__()` 时，函数会从暂停处继续运行。

当生成器函数执行结束时，会触发 `StopIteration`，这与列表、元组、字典、文件等对象在 `for` 循环中遵循的底层迭代机制一致。

## 示例：文件内容匹配生成器

文档通过 `filematch(filename, substr)` 展示了如何把“逐行搜索文件并返回匹配行”的逻辑封装为生成器：

```python
def filematch(filename, substr):
    with open(filename, 'r') as f:
        for line in f:
            if substr in line:
                yield line
```

这样，复杂的数据筛选逻辑可以隐藏在函数内部，而外部仍然可以用自然的 `for` 循环消费结果：

```python
for line in filematch('Data/portfolio.csv', 'IBM'):
    print(line, end='')
```

这个例子体现了生成器的一个重要价值：把自定义数据生产过程变成可复用的迭代器。

相关主题：文件处理、惰性求值、数据过滤。

## 示例：监控流式数据源

文档进一步展示了生成器在实时数据源中的应用。`Data/stocksim.py` 会持续向 `Data/stocklog.csv` 写入模拟股票行情数据。程序可以打开该文件，移动到文件末尾，然后不断调用 `readline()` 检查是否有新数据追加。

基本逻辑类似 Unix 的 `tail -f`：

```python
f = open('Data/stocklog.csv')
f.seek(0, os.SEEK_END)

while True:
    line = f.readline()
    if line == '':
        time.sleep(0.1)
        continue
    # 消费 line
```

这里的 `readline()` 用法不同于常规文件读取。它不是一次性遍历已有内容，而是反复探测文件末尾是否出现了新行。

相关主题：流式数据、日志监控、tail f模式。

## 将数据生产逻辑封装为 `follow()` 生成器

Exercise 6.6 的重点是把文件跟踪逻辑抽取为通用生成器函数 `follow(filename)`。这样，文件读取和数据消费可以分离：

```python
def follow(filename):
    f = open(filename)
    f.seek(0, os.SEEK_END)
    while True:
        line = f.readline()
        if line == '':
            time.sleep(0.1)
            continue
        yield line
```

使用时可以写成：

```python
for line in follow('Data/stocklog.csv'):
    print(line, end='')
```

股票行情程序也可以改写为只负责消费数据：

```python
if __name__ == '__main__':
    for line in follow('Data/stocklog.csv'):
        fields = line.split(',')
        name = fields[0].strip('"')
        price = float(fields[1])
        change = float(fields[4])
        if change < 0:
            print(f'{name:>10s} {price:>10.2f} {change:>10.2f}')
```

这体现了生成器的设计优势：生产者逻辑和消费者逻辑可以解耦。相关主题：[[concepts/生产者消费者模式]]、生成器管道。

## 示例：只监控投资组合中的股票

Exercise 6.7 要求修改 `follow.py`，让程序只显示投资组合中已有股票的行情：

```python
if __name__ == '__main__':
    import report

    portfolio = report.read_portfolio('Data/portfolio.csv')

    for line in follow('Data/stocklog.csv'):
        fields = line.split(',')
        name = fields[0].strip('"')
        price = float(fields[1])
        change = float(fields[4])
        if name in portfolio:
            print(f'{name:>10s} {price:>10.2f} {change:>10.2f}')
```

这里依赖 `Portfolio` 类支持 `in` 运算符，即实现 `__contains__()`。这与前一节 [[summaries/01_Iteration_protocol]] 中介绍的迭代协议和容器协议相关。

相关主题：容器协议、__contains__、投资组合数据模型。

## 主要收获

1. 生成器函数是自定义迭代模式的首选工具。
2. 调用生成器函数只会创建生成器对象，不会立即执行函数体。
3. `yield` 会产出一个值并暂停函数，下一次迭代时继续执行。
4. 生成器对象遵循 Python 的迭代协议，可被 `for` 循环自然消费。
5. 生成器可以把复杂的数据生产逻辑封装为通用、可复用的函数。
6. `follow()` 示例展示了生成器在实时日志、股票行情、服务器监控等流式场景中的应用。
7. 将生产者与消费者分离，是后续 [[concepts/生产者消费者模式]] 和生成器管道设计的基础。

## 与前后章节的联系

本文建立在 [[summaries/01_Iteration_protocol]] 对迭代协议的介绍之上，展示如何通过生成器函数实现同样的低层协议。它也为下一节 [[summaries/03_Producers_consumers]] 中更系统的生产者/消费者模型和数据处理管道奠定基础。

## Related Concepts
- [[concepts/流式数据处理]]
- [[concepts/迭代协议与生成器]]
- [[concepts/文件读写]]
- [[concepts/CSV-数据处理]]
- [[concepts/字符串处理]]
- [[concepts/表格化输出]]
- [[concepts/main-函数与脚本结构]]
- [[concepts/特殊方法]]
- [[concepts/Python-容器]]
- [[concepts/测试-日志与调试]]
- [[concepts/上下文管理器]]
