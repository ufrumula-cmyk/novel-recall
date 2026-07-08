# Novel Recall 面试说明

## 一句话介绍

Novel Recall 是一个本地优先的小说记忆与检索 Chrome 扩展，帮助用户用“剧情描述”找回自己导入过的小说记录。

## 用户痛点

很多读者会记得设定、人物关系或关键剧情，但忘记书名、作者或平台。传统关键词检索依赖字面命中，当用户输入“女主重生回高中，男主暗恋她”这类自然语言描述时，很容易搜不到。

Novel Recall 的目标不是采集平台内容，而是把用户已经拥有的小说元数据整理成本地可检索知识库。

## 技术方案

- 用 JSON 导入小说元数据。
- 用 IndexedDB 做本地持久化。
- 用 SiliconFlow Chat Completion 提取摘要和结构化剧情标签。
- 用 SiliconFlow Embeddings 为小说和查询生成向量。
- 用本地 cosine similarity 计算相似度并排序。
- 用 Chrome popup 做轻量搜索入口，用 options 做管理后台。

## 核心流程

1. 用户导入小说 JSON。
2. 数据经过字段白名单过滤后写入 IndexedDB。
3. 用户配置 SiliconFlow API Key。
4. AI 分析生成摘要、剧情关键词、人设标签、题材标签。
5. 为小说生成 embedding 并保存到 NovelItem。
6. 用户在 popup 输入剧情描述。
7. 系统生成 query embedding。
8. 本地计算 query 和小说 embedding 的 cosine similarity。
9. 按分数从高到低展示结果。

## 为什么用 embedding

关键词检索只能匹配字面词。embedding 能把“重生回高中”“校园成长”“前世暗恋”这类语义接近但字面不完全相同的描述映射到相近向量空间，更适合剧情检索。

## 为什么用 cosine similarity

cosine similarity 关注向量方向而不是绝对长度，适合比较文本语义向量之间的相似程度。它实现简单、可解释、计算成本低，也能完全在本地完成排序。

## 为什么用 IndexedDB

小说库数据可能包含几十到几千条记录，字段也会随着 AI 分析和 embedding 增多。IndexedDB 比 localStorage 更适合存储结构化、大体积、异步读写的数据。

## 为什么无后端

这个项目的核心目标是本地优先和隐私边界清晰。无后端可以降低部署成本，减少用户数据离开浏览器的范围，也让项目更适合作为浏览器插件 demo。当前只有用户主动触发 AI 分析、向量生成或 AI 猜书时，才会调用 SiliconFlow。

## popup / options 架构说明

popup 是日常搜索入口，保持小而清晰：

- 剧情检索
- 关键词检索
- AI 猜书
- 简洁结果列表

options 是管理后台，承载重操作：

- API Key 设置
- JSON 导入导出
- 清空确认
- 批量 AI 分析
- 批量生成向量
- 单条删除和单条重跑

这样可以避免把设置、导入导出、清空和批处理都堆进浏览器小窗口。

## 数据来源与合规边界

- 公开 demo 数据是手写虚构的 `examples/demo-novels.json`。
- Chinese-web-novel 等公开数据集只用于用户本地测试，不作为公开 demo 数据提交。
- 仓库不提交 sample.csv、data.csv、生成 JSON 或真实小说正文。
- 项目不爬晋江、番茄、起点或其他平台。
- 项目不采集网页正文、章节正文、免费章节正文、VIP 或付费章节正文。
- 项目不绕过验证码、反爬、字体加密、JS 加密或复制限制。
- API Key 只保存在 `chrome.storage.local`，不写入 IndexedDB，不导出 JSON。

## 项目难点

- 在 popup 小窗口里控制信息密度，把搜索入口和管理后台拆开。
- 设计 JSON 导入白名单，避免把正文、章节等不该保存的字段写入模型。
- 让 AI 输出严格 JSON，并对异常返回做兜底，避免页面崩溃。
- 区分关键词检索、语义检索和 AI 猜书，避免把 AI 猜书误导成真实数据库检索。
- 保持 manifest 权限最小化，不引入 content script 或 background。

## 当前不足

- 语义检索质量依赖简介和 AI 标签质量。
- embedding 会让导出 JSON 变大。
- AI 猜书候选可能出现幻觉，只能作为未验证参考。
- 当前没有云同步或多设备同步。
- 当前没有自动去重、评分标注和复杂筛选。

## Roadmap

- 完善搜索评估记录，形成可复现测试集。
- 增加更细的筛选维度，例如题材、状态、字数、平台。
- 做用户确认后的 AI 猜书候选保存。
- 增加导入预览和重复记录合并。
- 优化错误提示、空状态和离线状态。

## 30 秒讲解稿

Novel Recall 是我做的一个本地优先小说检索扩展。它解决的是“记得剧情但忘了书名”的问题。用户可以导入自己的小说元数据，系统用 AI 提取摘要和标签，再生成 embedding。之后在 popup 里输入自然语言剧情描述，系统会生成 query embedding，并在本地用 cosine similarity 排序。整个项目没有后端，不爬平台，不采集章节正文，API Key 只保存在浏览器本地。

## 1 分钟讲解稿

Novel Recall 是一个 Chrome 扩展，用来管理和找回用户自己的小说记录。它分为 popup 和 options 两个界面：popup 只做日常搜索，包括剧情检索、关键词检索和 AI 猜书；options 做后台管理，包括 API Key、JSON 导入导出、AI 分析和向量生成。技术上，我用 IndexedDB 保存 NovelItem，用 SiliconFlow Chat Completion 生成摘要和剧情标签，用 Embeddings 生成小说向量和查询向量，然后本地计算 cosine similarity。这个项目重点不是爬数据，而是把用户手动导入的数据变成可搜索的本地知识库，所以 manifest 权限保持很小，没有 content script、background，也不读取网页正文。

## 面试可能被问的问题和回答

### 为什么不用传统数据库或后端？

当前数据规模和使用场景适合浏览器本地存储。无后端可以降低部署复杂度，也能减少用户数据离开浏览器的范围。

### 为什么不用 localStorage？

localStorage 同步阻塞、容量小，也不适合保存结构化对象和 embedding 数组。IndexedDB 更适合这种本地数据管理场景。

### embedding 文本怎么拼接？

拼接标题、作者、分类、标签、简介、AI 摘要、剧情关键词、人设标签和题材标签。不拼接小说正文，不保存章节正文。

### AI 猜书和语义检索有什么区别？

语义检索只在用户本地已导入的小说库里排序；AI 猜书是大模型根据描述生成未验证候选，不代表真实存在，也不联网搜索。

### 如何避免 API Key 泄漏？

API Key 只通过 UI 输入，保存到 `chrome.storage.local`。它不写入 IndexedDB，不进入导出 JSON，不写死在代码或 README。

### 如何处理 AI 返回格式异常？

调用层要求严格 JSON，解析层会做类型校验和兜底。如果格式异常，前端显示错误或追问提示，不让页面崩溃。

### 为什么不用 content script？

当前阶段只做本地小说库管理和用户主动触发的 AI 能力，不需要读取当前网页，因此不需要 content script，也避免了平台采集风险。

### 这个项目的边界是什么？

不做平台适配，不爬网页，不采集章节正文，不绕过任何平台限制。它只处理用户主动导入的数据和用户主动输入的查询。
