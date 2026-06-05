---
sources: [summaries/01_Python.md]
brief: Python 网络请求说明如何用标准库获取远程资源，并强调外部 API 示例的时效风险。
---

# Python 网络请求

## 概念定义

Python 网络请求是程序通过 HTTP 等协议获取远程资源的过程。课程入门示例使用 `urllib.request.urlopen()` 访问公交到站预测 API，目的是展示 Python 可以用少量代码连接外部服务。

这个主题连接 [[concepts/Python-开发环境]]、[[concepts/XML-解析]]、[[concepts/环境变量与进程环境]] 和 [[concepts/异常处理]]。

## 入门示例的定位

课程中的 CTA 公交 API 示例是历史示例，不保证长期可运行。外部 API 可能更换地址、要求 API key、限制访问频率、改用 HTTPS，或完全停止服务。

因此，该示例更适合理解思路：

- 打开远程 URL；
- 得到可读取的数据流；
- 把数据交给解析器；
- 提取需要的字段。

## 安全与稳定性提示

- 不要把真实 API key 写入文档或代码仓库；
- 优先使用 HTTPS；
- 对网络失败、超时和格式变化做错误处理；
- 教学练习可改用本地示例文件，减少外部服务依赖。

## 代理环境

在需要代理的环境中，程序可能依赖 `HTTP_PROXY`、`HTTPS_PROXY` 等环境变量。这属于运行环境配置，应与代码逻辑分开管理。

## 相关概念

- [[concepts/XML-解析]]
- [[concepts/环境变量与进程环境]]
- [[concepts/Python-开发环境]]
- [[concepts/异常处理]]
