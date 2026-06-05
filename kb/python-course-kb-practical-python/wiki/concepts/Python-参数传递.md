---
sources: [summaries/02_More_functions.md, summaries/07_Objects.md]
brief: Python 参数传递是把实参对象绑定到函数局部参数名，而不是复制对象本身。
---

# Python 参数传递

## 概念定义

Python 调用函数时，会把传入的对象绑定到函数内部的参数名。参数名是局部变量，指向调用者传入的同一个对象；调用本身不会复制对象，也不会把外部变量“传进去”。

这个机制连接 [[concepts/变量绑定]]、[[concepts/Python-对象模型]]、[[concepts/Python-可变对象]] 和 [[concepts/函数]]。它解释了为什么修改可变对象会影响调用者，而重新给参数名赋值不会改变调用者的变量。

## 核心规则

- `def f(x): ...` 中的 `x` 是函数局部名字。
- 调用 `f(obj)` 时，`x` 绑定到 `obj` 所引用的对象。
- 如果 `x` 引用的是可变对象，`x.append(...)`、`x[key] = ...` 等原地修改会改变同一个对象。
- 如果执行 `x = other`，只是让局部名字 `x` 重新绑定，不会改变调用者的变量。
- 参数传递不等同于 C 语言中的传值或传引用；更准确地说，是对象引用的名字绑定。

## 典型示例

```python
def add_item(items):
    items.append("new")

names = ["old"]
add_item(names)
print(names)       # ['old', 'new']
```

`items` 和 `names` 指向同一个列表，因此原地修改可见。

```python
def replace_item(items):
    items = ["new"]

names = ["old"]
replace_item(names)
print(names)       # ['old']
```

这里的赋值只让局部名字 `items` 绑定到新列表，外部 `names` 不变。

## 设计提示

函数是否修改传入对象，应当成为接口约定的一部分。如果函数会原地修改列表、字典或对象，调用者需要知道这一点；如果不希望产生副作用，可以在函数内部创建新对象并返回结果。

## 相关概念

- [[concepts/变量绑定]]
- [[concepts/Python-可变对象]]
- [[concepts/Python-不可变对象]]
- [[concepts/Python-拷贝语义]]
- [[concepts/函数]]
