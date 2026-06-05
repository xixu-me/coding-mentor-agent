---
doc_type: short
full_text: sources/04_More_generators.md
---

# 04_More_generators 总结

本节继续扩展 Python generator 相关主题，重点介绍generator expression、生成器的设计价值，以及标准库 itertools 中常见的迭代工具。

## 核心内容

### 生成器表达式

生成器表达式是列表推导式的生成器版本，语法形式类似：

```python
(<expression> for i in s if <conditional>)
```

示例：

```python
a = [1, 2, 3, 4]
b = (2*x for x in a)
for i in b:
    print(i)
```

它与列表推导式的主要区别是：

- 不会一次性构造完整列表；
- 主要用途是迭代；
- 一旦被消费，就不能重复使用；
- 更适合只需要遍历一次结果的计算场景。

例如：

```python
sum(x*x for x in a)
```

这里生成器表达式直接作为函数参数传入 `sum()`，避免创建中间列表。

### 可组合的迭代处理

生成器表达式可以应用于任何可迭代对象，并且可以串联形成处理链：

```python
a = [1, 2, 3, 4]
b = (x*x for x in a)
c = (-x for x in b)
```

这种方式体现了 pipeline 思想：每一步只负责一个转换，数据按需流动，而不是一次性存储所有中间结果。

典型场景是对文件流进行过滤，例如跳过注释行：

```python
f = open('somefile.txt')
lines = (line for line in f if not line.startswith('#'))
for line in lines:
    ...
f.close()
```

这种写法像是对数据流施加过滤器，通常更快且内存占用更低。

## 为什么使用生成器

本节总结了生成器的几个重要优点：

### 更自然地表达迭代问题

很多问题本质上就是遍历一系列数据并进行操作，例如：

- 搜索；
- 替换；
- 修改；
- 过滤；
- 转换。

生成器让这些问题可以用清晰的迭代逻辑表达。

### 更高的内存效率

生成器按需产生值，而不是构造大型列表。因此它特别适合：

- 大数据序列；
- 日志文件；
- 网络数据；
- 实时流式数据；
- 只遍历一次的计算任务。

这与一次性构造完整列表形成鲜明对比。

### 鼓励代码复用

生成器将“如何迭代”与“如何使用迭代结果”分离。这样可以构建一组可复用的迭代工具，并通过组合实现不同的数据处理流程。

这也是 iterator 和 generator 在数据处理程序中非常重要的原因。

## itertools 模块

`itertools` 是 Python 标准库中专门用于处理迭代器和生成器的模块。它提供了一系列常用的迭代模式，例如：

```python
itertools.chain(s1, s2)
itertools.count(n)
itertools.cycle(s)
itertools.dropwhile(predicate, s)
itertools.groupby(s)
itertools.repeat(s, n)
itertools.tee(s, ncopies)
```

文档中还列出了一些旧式 Python 2 名称，如：

```python
itertools.ifilter(predicate, s)
itertools.imap(function, s1, ... sN)
itertools.izip(s1, ... , sN)
```

这些工具的共同特点是：

- 都以迭代方式处理数据；
- 不强制创建完整中间结果；
- 实现常见迭代模式；
- 可与生成器表达式和生成器函数组合使用。

## 练习要点

### Exercise 6.13：生成器表达式

练习展示生成器表达式与列表推导式的区别：

```python
nums = [1, 2, 3, 4, 5]
squares = (x*x for x in nums)
```

第一次遍历会输出平方值，但第二次遍历不会再产生任何结果，因为生成器只能消费一次。

### Exercise 6.14：作为函数参数的生成器表达式

练习比较：

```python
sum([x*x for x in nums])
sum(x*x for x in nums)
```

两者结果相同，但第二种不创建中间列表，在处理大规模数据时更节省内存。

练习要求将 `portfolio.py` 中某些列表推导式改写为生成器表达式。

### Exercise 6.15：代码简化

生成器表达式可以替代一些简单的生成器函数。例如：

```python
def filter_symbols(rows, names):
    for row in rows:
        if row['name'] in names:
            yield row
```

可以简化为：

```python
rows = (row for row in rows if row['name'] in names)
```

练习要求在 `ticker.py` 中适当使用生成器表达式简化代码。

## 关键结论

- 生成器表达式是列表推导式的惰性版本。
- 它适合只需要遍历一次的计算。
- 生成器可以减少内存使用，并支持流式处理。
- 多个生成器可以组成数据处理管道。
- `itertools` 提供了丰富的迭代工具，可用于构建更强大的迭代逻辑。
- 简单的生成器函数有时可以用生成器表达式替代，从而让代码更简洁。

## 相关概念

- generator
- generator expression
- iterator
- itertools
- lazy evaluation
- pipeline
- memory efficiency

## Related Concepts
- [[concepts/itertools-模块]]
- [[concepts/生成器表达式]]
- [[concepts/迭代协议与生成器]]
- [[concepts/数据流管道]]
- [[concepts/流式数据处理]]
- [[concepts/列表推导式]]
- [[concepts/文件读写]]
- [[concepts/生产者消费者模式]]
- [[concepts/Python-容器]]
- [[concepts/函数]]
