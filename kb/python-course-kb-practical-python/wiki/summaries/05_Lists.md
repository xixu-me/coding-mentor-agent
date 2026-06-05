---
doc_type: short
full_text: sources/05_Lists.md
---

# 05_Lists 摘要

本文介绍 Python列表：Python 中用于保存有序值集合的主要数据类型。列表支持创建、索引、修改、遍历、查找、删除、排序，以及与字符串之间的拆分和连接。

## 核心概念

### 创建列表

列表使用方括号字面量创建：

```python
names = ['Elwood', 'Jake', 'Curtis']
nums = [39, 38, 42, 65, 111]
```

字符串也可以通过 `split()` 拆分为列表：

```python
line = 'GOOG,100,490.10'
row = line.split(',')
# ['GOOG', '100', '490.10']
```

这体现了 Python字符串 与列表之间的常见转换关系。

## 列表基本操作

### 添加与拼接

- `append(x)`：在末尾添加元素。
- `insert(i, x)`：在指定位置插入元素。
- `+`：拼接两个列表，产生新列表。
- `*`：重复列表内容。

```python
names.append('Murphy')
names.insert(2, 'Aretha')

[1, 2, 3] + ['a', 'b']
# [1, 2, 3, 'a', 'b']

[1, 2, 3] * 3
# [1, 2, 3, 1, 2, 3, 1, 2, 3]
```

### 索引、负索引与修改

列表是有序序列，使用整数索引访问，索引从 `0` 开始；负索引从末尾开始计数。

```python
names[0]   # 第一个元素
names[-1]  # 最后一个元素
```

列表是可变对象，可以直接修改某个位置的元素：

```python
names[1] = 'Joliet Jake'
```

这与字符串等不可变序列形成对比，可归入 Python序列 的更大主题。

### 长度与成员测试

- `len(list)`：返回列表长度。
- `in`：判断元素是否存在。
- `not in`：判断元素是否不存在。

```python
len(names)
'Elwood' in names
'Britney' not in names
```

## 遍历与查找

使用 `for` 循环遍历列表中的元素：

```python
for name in names:
    print(name)
```

使用 `index()` 查找某个值第一次出现的位置：

```python
names.index('Curtis')
```

注意：

- 如果元素出现多次，`index()` 只返回第一次出现的位置。
- 如果元素不存在，会抛出 `ValueError`。

## 删除元素

列表元素可以按值或按索引删除：

```python
names.remove('Curtis')  # 按值删除
del names[1]            # 按索引删除
```

删除后列表不会留下“空洞”，后续元素会自动前移。若使用 `remove()` 删除重复元素，只会删除第一个匹配项。

## 排序

列表可使用 `sort()` 进行原地排序：

```python
s = [10, 1, 7, 3]
s.sort()
# [1, 3, 7, 10]
```

反向排序：

```python
s.sort(reverse=True)
```

`sort()` 会修改原列表，不创建新列表。若希望保留原列表并得到排序结果，应使用 `sorted()`：

```python
t = sorted(s)
```

## 列表不等于数学向量

列表的 `+` 和 `*` 并不是数学向量或矩阵运算：

```python
[1, 2, 3] * 2
# [1, 2, 3, 1, 2, 3]

[1, 2, 3] + [10, 11, 12]
# [1, 2, 3, 10, 11, 12]
```

因此，Python 列表不适合作为 MATLAB、Octave、R 中那种向量或矩阵的直接替代。若需要数值计算，应使用类似 NumPy 的库，可关联到 Python数值计算。

## 练习要点

### Exercise 1.19：提取与重新赋值

通过股票代码字符串：

```python
symbols = 'HPQ,AAPL,IBM,MSFT,YHOO,DOA,GOOG'
symlist = symbols.split(',')
```

练习内容包括：

- 使用正索引与负索引访问元素。
- 修改指定位置的值。
- 使用切片提取子列表。
- 创建空列表并用 `append()` 添加元素。
- 使用切片赋值替换列表的一部分。

切片赋值会根据右侧列表长度自动调整左侧列表大小：

```python
symlist[-2:] = mysyms
```

### Exercise 1.20：遍历列表元素

使用 `for` 循环逐个处理列表元素：

```python
for s in symlist:
    print('s =', s)
```

### Exercise 1.21：成员测试

练习使用 `in` 与 `not in` 检查股票代码是否在列表中：

```python
'AIG' in symlist
'AA' in symlist
'CAT' not in symlist
```

### Exercise 1.22：添加、插入与删除

练习以下方法：

- `append('RHT')`：末尾追加。
- `insert(1, 'AA')`：插入到第二个位置。
- `remove('MSFT')`：删除指定值。
- `index('YHOO')`：查找第一次出现的位置。
- `count('YHOO')`：统计出现次数。

该练习强调：列表允许重复值，但 `remove()` 只删除第一个匹配项。

### Exercise 1.23：排序

使用 `sort()` 对列表排序，或通过 `reverse=True` 反向排序：

```python
symlist.sort()
symlist.sort(reverse=True)
```

重点是理解原地修改：排序会直接改变 `symlist` 本身。

### Exercise 1.24：重新连接为字符串

使用字符串的 `join()` 方法将字符串列表连接为一个字符串：

```python
','.join(symlist)
':'.join(symlist)
''.join(symlist)
```

这与前面的 `split()` 构成互逆式的常见模式：

- `split()`：字符串 → 列表
- `join()`：列表 → 字符串

相关主题：Python字符串处理。

### Exercise 1.25：列表可以包含任意对象

列表可以包含不同类型对象，甚至嵌套列表：

```python
nums = [101, 102, 103]
items = ['spam', symlist, nums]
```

可以通过多重索引访问嵌套结构：

```python
items[1][1]
items[2][1]
```

但文档建议保持列表结构简单。通常一个列表应保存同一种类型的值，例如全是数字或全是字符串。混合不同类型、构造过度复杂的嵌套列表，会降低代码可读性并增加理解难度。

## 关键结论

- 列表是 Python 中最常用的有序集合类型之一。
- 列表可变，支持按索引修改、插入、删除和切片赋值。
- 列表支持遍历、成员测试、查找、计数和排序。
- `sort()` 是原地排序，`sorted()` 返回新列表。
- 列表的 `+` 和 `*` 是拼接与重复，不是数学向量运算。
- `split()` 和 `join()` 是字符串与字符串列表之间转换的核心工具。
- 虽然列表能包含任意对象和嵌套结构，但实际编程中应优先保持简单、一致的数据结构。

## Related Concepts
- [[concepts/Python-可变对象]]
- [[concepts/列表与序列]]
- [[concepts/字符串处理]]
- [[concepts/Python-不可变对象]]
- [[concepts/变量与数据类型]]
- [[concepts/Python-控制流与缩进]]
- [[concepts/迭代协议与生成器]]
- [[concepts/CSV-数据处理]]
