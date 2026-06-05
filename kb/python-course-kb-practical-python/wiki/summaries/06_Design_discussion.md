---
doc_type: short
full_text: sources/06_Design_discussion.md
---

# 06_Design_discussion 总结

## 核心主题

本文讨论一个重要的库函数设计选择：函数参数应该接收“文件名”，还是接收“可迭代的行对象”。通过 `read_data()` 和 `parse_csv()` 的例子，文章说明了面向 可迭代对象 与 [[concepts/鸭子类型]] 的接口设计通常更灵活，也更适合可复用的代码库。

## 文件名 vs 可迭代对象

文中比较了两种 `read_data()` 设计：

第一种设计让函数接收文件名，并在函数内部打开文件：

```python
def read_data(filename):
    records = []
    with open(filename) as f:
        for line in f:
            ...
            records.append(r)
    return records
```

调用方式：

```python
d = read_data('file.csv')
```

第二种设计让函数接收已经可迭代的行对象：

```python
def read_data(lines):
    records = []
    for line in lines:
        ...
        records.append(r)
    return records
```

调用方式：

```python
with open('file.csv') as f:
    d = read_data(f)
```

两者可以产生相同结果，但第二种设计更灵活，因为它不绑定到“普通磁盘文件名”这一具体输入来源。

## 深层思想：鸭子类型

本文引入 [[concepts/鸭子类型]]：判断一个对象是否可用于某种目的，不依赖它的具体类型或类名，而依赖它是否具备所需行为。

经典表述是：

> 如果它看起来像鸭子、游泳像鸭子、叫声像鸭子，那么它大概就是鸭子。

在本文场景中，`read_data(lines)` 不关心 `lines` 是否真的是一个文件对象，只关心它能否被 `for line in lines` 迭代。因此，任何“像文件行一样可迭代”的对象都可以使用。

## 更灵活的输入来源

接收可迭代对象后，同一个解析函数可以处理多种输入：

```python
# CSV 文件
lines = open('data.csv')
data = read_data(lines)

# gzip 压缩文件
lines = gzip.open('data.csv.gz', 'rt')
data = read_data(lines)

# 标准输入
lines = sys.stdin
data = read_data(lines)

# 字符串列表
lines = ['ACME,50,91.1', 'IBM,75,123.45', ...]
data = read_data(lines)
```

这体现了 接口设计 中的重要原则：函数依赖更抽象的协议，而不是依赖具体实现。

## 库设计建议

文章提出的设计取向是：在编写代码库时，通常应当拥抱这种灵活性，而不是人为限制使用方式。

换句话说：

- 不要只接受文件名，如果函数真正需要的是“逐行文本”；
- 应该接收任何可迭代的文本行对象；
- 这样可以支持普通文件、压缩文件、标准输入、测试数据列表等多种来源；
- 这种设计更利于测试、复用和组合。

这与 函数抽象 和 库设计 密切相关。

## Exercise 3.17：从文件名改为类文件对象

练习要求修改 `fileparse.py` 中的 `parse_csv()` 函数。

原先的调用方式是：

```python
portfolio = fileparse.parse_csv('Data/portfolio.csv', types=[str,int,float])
```

也就是说，`parse_csv()` 原本接收文件名，并在函数内部打开文件。

修改后的目标是让它接收任意文件类对象或可迭代对象：

```python
import gzip
with gzip.open('Data/portfolio.csv.gz', 'rt') as file:
    port = fileparse.parse_csv(file, types=[str,int,float])
```

也可以直接传入字符串列表：

```python
lines = ['name,shares,price', 'AA,100,34.23', 'IBM,50,91.1', 'HPE,75,45.1']
port = fileparse.parse_csv(lines, types=[str,int,float])
```

这个练习强调：`parse_csv()` 的核心工作是解析“行”，因此它不应该强依赖文件名。

## 需要注意的陷阱：字符串本身也是可迭代对象

修改为接收可迭代对象后，如果仍然像以前一样传入文件名：

```python
port = fileparse.parse_csv('Data/portfolio.csv', types=[str,int,float])
```

会发生意外结果。原因是字符串也是 可迭代对象，函数会把文件名 `'Data/portfolio.csv'` 当作字符序列来迭代，而不是当作路径打开。

因此，代码可能会逐字符处理文件名，产生“疯狂”的输出。

文章提示可以加入安全检查，避免用户误传字符串文件名。例如，可以检测参数是否为字符串，如果是，则抛出错误或提示用户应传入已打开的文件对象。

## Exercise 3.18：修复现有函数

修改 `parse_csv()` 后，还需要调整 `report.py` 中的：

- `read_portfolio()`
- `read_prices()`

这两个函数原先可能直接把文件名传给 `parse_csv()`。现在应该由它们负责打开文件，然后把文件对象传给 `parse_csv()`。

修改后，已有的：

- `report.py`
- `pcost.py`

应保持原有行为不变。

这体现了一个常见重构模式：底层解析函数变得更通用，而上层函数负责处理具体输入来源。

## 关键收获

- 函数如果只需要“逐行输入”，就不应强制要求“文件名”。
- 接收可迭代对象比接收文件名更灵活。
- [[concepts/鸭子类型]] 让函数关注对象行为，而不是对象类型。
- 这种设计支持普通文件、gzip 文件、标准输入和测试用字符串列表。
- 灵活接口也会带来风险，例如字符串路径本身可迭代，需要额外安全检查。
- 库函数设计应尽量面向抽象协议，例如“可迭代文本行”，而不是面向具体资源，例如“磁盘文件”。

## 相关概念

- [[concepts/鸭子类型]]
- 可迭代对象
- 接口设计
- 库设计
- 函数抽象
- 文件处理
- CSV解析

## Related Concepts
- [[concepts/库接口设计]]
- [[concepts/CSV-数据处理]]
- [[concepts/文件读写]]
- [[concepts/迭代协议与生成器]]
- [[concepts/函数]]
- [[concepts/Python-输入输出]]
- [[concepts/上下文管理器]]
- [[concepts/字符串处理]]
- [[concepts/异常处理]]
- [[concepts/模块与-import]]
- [[concepts/main-函数与脚本结构]]
