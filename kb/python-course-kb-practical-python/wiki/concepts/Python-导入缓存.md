---
sources: [summaries/04_Modules.md]
brief: Python 导入缓存说明 import 后模块对象会保存在 sys.modules 中，后续导入通常复用同一模块对象。
---

# Python 导入缓存

## 概念定义

Python 导入缓存是 `import` 机制的一部分。模块第一次导入时会被执行并创建模块对象；之后该模块对象会保存在 `sys.modules` 中，后续导入通常直接复用缓存对象，而不会重新执行整个模块文件。

这个主题连接 [[concepts/模块与-import]]、[[concepts/Python-命名空间与作用域]] 和 [[concepts/动态属性访问]]。

## 为什么会有缓存

导入缓存可以避免同一模块被反复执行，也能保证多个地方导入同一模块时看到的是同一个模块对象。

```python
import sys
import math

"math" in sys.modules
```

`sys.modules` 是一个字典，键通常是模块名，值是模块对象。

## 对调试的影响

如果你在 REPL 中导入了一个模块，然后修改了模块源文件，再次执行 `import module` 通常不会重新加载新代码。初学者常见的困惑是：“我已经改了文件，为什么行为没变？”

最简单可靠的处理方式是重启解释器。对于交互调试，也可以了解 `importlib.reload()`，但不要把它作为常规程序逻辑的一部分。

## 常见误区

- `import` 不是简单文本粘贴；
- 模块顶层代码只在首次导入时执行一次；
- 修改源文件不等于修改已加载的模块对象；
- 不同解释器进程有各自的导入缓存。

## 相关概念

- [[concepts/模块与-import]]
- [[concepts/Python-命名空间与作用域]]
- [[concepts/动态属性访问]]
- [[concepts/Python-开发环境]]
