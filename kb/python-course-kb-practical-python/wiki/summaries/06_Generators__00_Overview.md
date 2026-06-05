---
doc_type: short
full_text: sources/06_Generators__00_Overview.md
---

# 06_Generators__00_Overview 摘要

本文件是第 6 章「Generators」的总览页，介绍 Python 中生成器相关主题的学习路线。它强调：迭代（如 `for` 循环）是 Python 最常见的编程模式之一，广泛用于处理列表、读取文件、查询数据库以及其他数据处理任务。

## 核心主题

- Python 迭代协议：本章首先引入 Python 的迭代协议，解释对象如何支持 `for` 循环等迭代行为。
- Python 生成器：生成器函数是 Python 中自定义和重新定义迭代行为的强大机制。
- 自定义迭代：通过生成器，程序员可以用更自然、更惰性的方式定义数据产生过程。
- 生产者消费者模型：本章进一步将生成器用于生产者/消费者问题和工作流建模。
- [[concepts/生成器表达式]]：章节还包括生成器表达式，用于以简洁语法构造惰性迭代序列。
- [[concepts/流式数据处理]]：总览指出本章最终会编写处理实时流式数据的程序，展示生成器在实际数据流场景中的价值。

## 章节结构

本章包含以下小节：

1. **6.1 Iteration Protocol**  
   介绍 Python 的迭代协议，是理解生成器和 `for` 循环机制的基础。

2. **6.2 Customizing Iteration with Generators**  
   说明如何使用生成器函数自定义迭代行为。

3. **6.3 Producer/Consumer Problems and Workflows**  
   探讨生成器在生产者/消费者问题和数据处理工作流中的应用。

4. **6.4 Generator Expressions**  
   介绍生成器表达式，展示更简洁的惰性迭代写法。

## 主要意义

该文档为生成器章节建立背景：Python 程序经常需要迭代，而生成器提供了一种灵活、可组合、适合流式处理的迭代抽象。它将后续内容从基础协议逐步推进到实际工作流和实时数据处理应用。

## Related Concepts
- [[concepts/迭代协议与生成器]]
- [[concepts/生产者消费者模式]]
- [[concepts/数据流管道]]
- [[concepts/Python-控制流与缩进]]
- [[concepts/Python-容器]]
