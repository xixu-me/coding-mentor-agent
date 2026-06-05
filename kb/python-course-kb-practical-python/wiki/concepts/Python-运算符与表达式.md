---
sources: [summaries/07_Objects.md, summaries/02_Anonymous_function.md, summaries/03_Special_methods.md, summaries/06_List_comprehension.md, summaries/04_Strings.md, summaries/03_Numbers.md]
brief: Python 运算符与表达式通过语法和特殊方法共同定义对象的计算、比较与逻辑行为。
---

# Python 运算符与表达式

Python 运算符与表达式是程序进行计算、比较、逻辑判断和对象交互的基础。在 [[summaries/03_Numbers]] 中，运算符主要围绕数字类型展开；在 [[summaries/03_Special_methods]] 中，进一步揭示了许多运算符背后其实会调用对象的特殊方法。这说明 Python 的表达式不仅是语法层面的计算形式，也是 Python特殊方法 和 Python数据模型 的一部分。

## 什么是表达式

表达式是由值、变量、运算符、函数调用、属性访问等组合而成的代码片段，执行后会产生一个结果。

例如：

```python
x + y
principal * (1 + rate / 12) - payment
b >= a and b <= c
abs(x)
obj.name
```

这些表达式可能产生数字、布尔值、字符串、对象属性或其他任意 Python 对象。

在 [[summaries/03_Numbers]] 的按揭贷款例子中，核心表达式是：

```python
principal = principal * (1 + rate / 12) - payment
```

它表示：先根据月利率更新本金，再扣除当月还款额。

从 [[summaries/03_Special_methods]] 的角度看，表达式中的某些操作还会被解释器转换为对特殊方法的调用。例如：

```python
a + b
```

在对象层面相当于尝试调用：

```python
a.__add__(b)
```

因此，Python 表达式既可以处理内置数字类型，也可以被自定义类扩展。

## 算术运算符

Python 中常见的数字算术运算符包括：

```text
x + y      加法
x - y      减法
x * y      乘法
x / y      除法，结果通常为 float
x // y     整除，向下取整
x % y      取模，返回余数
x ** y     幂运算
abs(x)     绝对值
```

示例：

```python
x = 10
y = 3

x + y    # 13
x - y    # 7
x * y    # 30
x / y    # 3.3333333333333335
x // y   # 3
x % y    # 1
x ** y   # 1000
```

需要特别注意：

- `/` 是普通除法，通常返回浮点数。
- `//` 是整除，返回向下取整后的结果。
- `%` 常用于判断倍数、循环周期、余数逻辑。
- `**` 用于指数运算。

这些内容与 Python数字类型、Python整数 和 [[concepts/浮点数精度]] 密切相关。

## 算术运算符与特殊方法

在 [[summaries/03_Special_methods]] 中，文档说明数学运算符会映射到对象上的特殊方法。常见对应关系如下：

```text
a + b       a.__add__(b)
a - b       a.__sub__(b)
a * b       a.__mul__(b)
a / b       a.__truediv__(b)
a // b      a.__floordiv__(b)
a % b       a.__mod__(b)
a ** b      a.__pow__(b)
-a          a.__neg__()
abs(a)      a.__abs__()
```

这意味着运算符不是只能用于内置数字类型。只要自定义类实现相应特殊方法，就可以参与这些表达式。例如，一个表示向量、金额、日期间隔或矩阵的类，可以通过实现 `__add__()`、`__sub__()` 等方法来支持 `+`、`-` 等运算。

这种机制通常称为 运算符重载。它体现了 Python 的协议式设计：对象不一定要继承某个固定基类，只要实现特定方法，就能适配相应语法。相关主题包括 Python特殊方法 和 Python协议。

不过，重载运算符时应遵守直觉语义。例如，`+` 通常表示合并或加法，`*` 通常表示重复或乘法。如果滥用，会降低代码可读性。

## 整除与取模

整除和取模经常一起使用：

```python
q = x // y   # 商
r = x % y    # 余数
```

例如：

```python
10 // 3   # 3
10 % 3    # 1
```

它们可以用来完成：

- 分页计算
- 时间换算
- 判断奇偶数
- 分组编号
- 循环周期控制

例如判断偶数：

```python
if n % 2 == 0:
    print('even')
```

从特殊方法角度看，`//` 和 `%` 分别对应 `__floordiv__()` 和 `__mod__()`。因此，自定义类型也可以定义自己的“整除”和“取余”语义，但应谨慎设计，避免让表达式含义变得反直觉。

## 位运算符

整数还支持位运算符：

```text
x << n     左移
x >> n     右移
x & y      按位与
x | y      按位或
x ^ y      按位异或
~x         按位取反
```

这些运算符直接作用于整数的二进制表示。

示例：

```python
x = 0b1010
y = 0b1100

x & y   # 0b1000
x | y   # 0b1110
x ^ y   # 0b0110
```

在对象层面，它们也有对应的特殊方法：

```text
a << b      a.__lshift__(b)
a >> b      a.__rshift__(b)
a & b       a.__and__(b)
a | b       a.__or__(b)
a ^ b       a.__xor__(b)
~a          a.__invert__()
```

位运算在普通业务代码中不一定常见，但在底层编程、权限标志、网络协议、二进制数据处理中很有用。某些库也会利用这些符号表达领域特定操作，因此阅读代码时要结合对象类型理解运算符含义。

## 浮点数运算

浮点数支持大多数算术运算：

```text
x + y      加法
x - y      减法
x * y      乘法
x / y      除法
x // y     整除
x % y      取模
x ** y     幂运算
abs(x)     绝对值
```

但浮点数不支持整数的位运算。

在 [[summaries/03_Numbers]] 中，文档强调浮点数基于 IEEE 754 双精度表示，因此小数计算可能出现精度误差：

```python
>>> a = 2.1 + 4.2
>>> a == 6.3
False
>>> a
6.300000000000001
```

这说明在比较浮点数时，通常不应直接依赖精确相等，而应考虑误差范围。相关内容见 [[concepts/浮点数精度]]。

## 比较运算符

比较运算符用于比较两个值，并返回布尔值 `True` 或 `False`。

```text
x < y      小于
x <= y     小于等于
x > y      大于
x >= y     大于等于
x == y     等于
x != y     不等于
```

示例：

```python
x = 10
y = 20

x < y     # True
x == y    # False
x != y    # True
```

比较表达式通常用于 `if`、`while` 等控制结构：

```python
if principal > 0:
    print('loan remains')
```

在按揭贷款程序中，循环条件就是一个比较表达式：

```python
while principal > 0:
    ...
```

它表示只要剩余本金大于 0，就继续执行还款计算。相关主题包括 Python条件判断 和 Python循环。

虽然 [[summaries/03_Special_methods]] 主要列举的是数学和容器相关特殊方法，但比较运算同样属于 Python 数据模型的一部分。自定义对象可以定义自己的比较行为，使对象能参与排序、相等性判断或范围判断。

## 布尔逻辑运算符

Python 使用以下关键字组合布尔表达式：

```text
and     与
or      或
not     非
```

在 [[summaries/03_Numbers]] 中，示例代码展示了如何判断 `b` 是否处于 `a` 和 `c` 之间：

```python
if b >= a and b <= c:
    print('b is between a and c')
```

也可以用逻辑否定改写：

```python
if not (b < a or b > c):
    print('b is still between a and c')
```

这两个条件表达式表达的是同一个逻辑：`b` 没有小于下界，也没有大于上界。

布尔逻辑与 Python布尔值、布尔表达式 和 Python真值测试 相关。

## 容器表达式与特殊方法

表达式不仅包括数学运算，也包括容器访问。[[summaries/03_Special_methods]] 说明，常见容器操作也会映射到特殊方法：

```text
len(x)      x.__len__()
x[a]        x.__getitem__(a)
x[a] = v    x.__setitem__(a, v)
del x[a]    x.__delitem__(a)
```

例如：

```python
items[0]
prices['IBM']
len(portfolio)
```

这些表达式看起来像内置列表或字典操作，但自定义类也可以通过实现 `__len__()`、`__getitem__()`、`__setitem__()`、`__delitem__()` 来表现得像容器。

这与 容器协议、Python协议 和 Python特殊方法 相关。它进一步说明：Python 表达式的含义不仅由运算符本身决定，也由参与运算的对象类型决定。

## 属性访问与方法调用表达式

表达式还可以包含属性访问和方法调用：

```python
s.cost
s.cost()
obj.name
getattr(obj, 'name')
```

在 [[summaries/03_Special_methods]] 中，方法调用被解释为两步：

1. 使用 `.` 进行属性查找。
2. 使用 `()` 调用查找到的方法对象。

例如：

```python
c = s.cost  # 查找，得到绑定方法
c()         # 调用，执行方法
```

如果忘记 `()`，得到的只是一个 [[concepts/绑定方法]]，并不会执行方法：

```python
f.close     # 没有关闭文件
f.close()   # 正确关闭文件
```

这说明 `s.cost` 和 `s.cost()` 是两个不同表达式：前者产生方法对象，后者产生方法调用结果。

动态属性访问也可以写成表达式：

```python
getattr(obj, 'name')
```

它等价于：

```python
obj.name
```

但属性名可以由字符串变量决定，因此适合构建通用表格打印、序列化、报表生成等工具。相关主题包括 [[concepts/动态属性访问]]、反射 和 通用编程。

## 运算结果的类型

不同运算符和表达式可能产生不同类型的结果。

例如：

```python
10 + 3      # int
10 / 3      # float
10 // 3     # int
10 < 3      # bool
s.cost      # bound method
s.cost()    # 方法返回值
items[0]    # 容器元素
```

需要特别注意：

- 算术表达式通常产生数字。
- 比较表达式产生布尔值。
- 逻辑表达式用于组合多个条件。
- 普通除法 `/` 即使两个操作数都是整数，也会产生浮点数。
- 属性查找表达式可能产生普通值，也可能产生绑定方法。
- 容器访问表达式的结果取决于对象的 `__getitem__()` 实现。

这与 Python类型转换、Python数字类型 和 Python数据模型 有关。

## 布尔值参与数字运算

在 Python 中，`bool` 是数字体系的一部分。`True` 在数值上等于 `1`，`False` 在数值上等于 `0`。

例如：

```python
4 + True    # 5
False == 0  # True
```

但是 [[summaries/03_Numbers]] 明确提醒：虽然这在技术上可行，但不推荐写这种代码，因为它会降低可读性。

更清晰的代码应当将布尔逻辑和数值计算分开表达。

## 表达式在按揭贷款程序中的作用

[[summaries/03_Numbers]] 的练习使用按揭贷款程序展示了运算符与表达式的实际用途。

基础程序包含几个典型表达式：

```python
principal = principal * (1 + rate / 12) - payment
total_paid = total_paid + payment
```

其中：

- `rate / 12` 计算月利率。
- `1 + rate / 12` 得到月度本金增长倍数。
- `principal * (1 + rate / 12)` 计算计息后的本金。
- `- payment` 扣除当月还款。
- `total_paid + payment` 累加已支付总额。

后续练习加入额外还款、月份计数和表格输出，会进一步使用：

- 比较表达式判断当前月份是否在额外还款区间内。
- 算术表达式更新本金和累计支付金额。
- 循环条件判断贷款是否还清。
- 边界条件处理最后一个月是否多付。

这些练习连接到 累计计算、参数化程序设计、边界条件 和 金融计算。

## 表达式在通用对象处理中的作用

[[summaries/03_Special_methods]] 的练习展示了表达式在对象处理中的另一类用途：根据属性名动态读取对象数据。

例如：

```python
columns = ['name', 'shares']
for colname in columns:
    print(colname, '=', getattr(s, colname))
```

这里 `getattr(s, colname)` 是一个表达式，其结果由 `colname` 的值决定。它让代码不必写死属性名，可以处理用户指定的列。

这个思想可扩展为通用表格打印函数：

```python
print_table(portfolio, ['name', 'shares', 'price'], formatter)
```

这种写法把表达式、属性访问和格式化输出结合起来，适合构建灵活的报表系统。相关概念包括 表格格式化、对象属性驱动设计 和 [[concepts/动态属性访问]]。

## 常见注意事项

### 不要混淆 `/` 和 `//`

```python
5 / 2    # 2.5
5 // 2   # 2
```

如果需要精确的小数结果，使用 `/`；如果需要整数商，使用 `//`。

### 浮点数不要直接做精确相等判断

```python
2.1 + 4.2 == 6.3   # False
```

原因是浮点数表示存在误差。更稳妥的方式是比较差值是否足够小。

### 布尔值虽然像整数，但不要滥用

```python
score = 4 + True
```

这样的代码可以运行，但语义不清晰。更好的写法应显式表达业务含义。

### 不要忘记方法调用的括号

```python
s.cost    # 只是取得方法对象
s.cost()  # 才会真正执行方法
```

类似地：

```python
f.close   # 没有关闭文件
f.close() # 关闭文件
```

这是 [[concepts/绑定方法]] 相关的常见错误。

### 运算符重载应符合直觉

自定义类可以通过特殊方法支持 `+`、`-`、`[]`、`len()` 等表达式，但应让这些表达式的含义清晰、自然。

例如：

- `a + b` 应表现为某种合理的加法、合并或组合。
- `len(x)` 应返回对象的长度或规模。
- `x[a]` 应表示按键、索引或标签取值。

如果特殊方法的行为过于出人意料，会让表达式难以阅读和维护。

### 表达式应保持可读性

复杂表达式可以拆分为多个中间变量：

```python
monthly_rate = rate / 12
interest_factor = 1 + monthly_rate
principal = principal * interest_factor - payment
```

这样比把所有逻辑压缩在一行中更容易理解和调试。

## 小结

Python 运算符与表达式提供了构建计算逻辑和对象交互逻辑的基本工具：

- 算术运算符用于数值计算。
- 位运算符用于整数的二进制操作。
- 比较运算符返回布尔结果。
- 逻辑运算符组合多个条件。
- 容器表达式通过 `len()`、索引、赋值和删除操作访问对象内容。
- 属性访问和方法调用表达式用于读取对象状态和执行对象行为。
- 许多运算符和内置操作都会映射到对象的特殊方法。

在 [[summaries/03_Numbers]] 中，这些概念用于解释 Python 数字类型，并通过按揭贷款计算练习展示了它们在真实程序中的组合方式。在 [[summaries/03_Special_methods]] 中，这些概念进一步扩展到自定义对象，说明表达式的意义可以由类的特殊方法决定。

See also: [[summaries/04_Strings]]

See also: [[summaries/06_List_comprehension]]

See also: [[summaries/03_Special_methods]]

See also: [[summaries/02_Anonymous_function]]

See also: [[summaries/07_Objects]]