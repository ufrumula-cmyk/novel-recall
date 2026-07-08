# Novel Recall 搜索质量评估

## 为什么评估语义搜索效果

Novel Recall 同时提供关键词检索、剧情语义检索和 AI 猜书候选。关键词检索适合查找明确出现过的书名、作者、标签或简介词；剧情语义检索适合用自然语言描述想看的设定、人物关系或情节方向；AI 猜书适合在本地库没有满意结果时，让大模型生成可能候选。通过固定 demo 数据和固定 query 评估，可以更稳定地观察不同入口的差异，而不是只依赖字面词命中。

## 对比对象

- 关键词检索：只使用本地字段匹配，不调用 SiliconFlow。
- 剧情语义检索：对 query 生成 embedding，并与本地小说 embedding 做 cosine similarity 排序。
- AI 猜书候选：调用 SiliconFlow Chat Completion 生成可能的小说候选；信息不足时应返回追问，不读取平台页面，不联网搜索，不把结果当成已验证事实。

建议先导入 `examples/demo-novels.json`，再在 options 页面为 demo 小说生成 AI 分析和向量，最后在 popup 中分别测试关键词检索、剧情检索与 AI 猜书。

## 测试 Query

| query | expectedTitle |
| --- | --- |
| 女主重生回高中，和同桌一起努力学习成长 | 回到十七岁的晴天 |
| 古代女主进入朝堂文书院，破解家族旧案和权谋布局 | 长安棋局 |
| 末世前整理物资仓库，带邻里做社区互助和囤货 | 极昼仓库 |
| 少年从矿镇出发修炼升级，靠炼器和阵法守护家乡 | 星火九阶 |
| 新人剪辑师和青年演员在剧组互相鼓励，甜甜恋爱 | 片场微光 |
| 档案管理员发现旧案线索，和民警一起推理破案 | 雨夜档案室 |
| 图书馆沉浸式房间解谜，队友合作通过十二个关卡 | 十二扇安全门 |
| 小师妹从药草灵田开始修仙，慢慢成长承担责任 | 云阶小师妹 |
| 合约婚姻里的都市男女一起改造老街，先婚后爱 | 合约春风 |
| 穿进书里成为反派师姐，认真道歉修补关系洗白 | 反派今天认真改错 |

## 评估表格模板

| query | expectedTitle | keywordTop5Hit | semanticTop5Hit | semanticRank | aiGuessMentioned | notes |
| --- | --- | --- | --- | --- | --- | --- |
|  |  | yes/no | yes/no |  | yes/no |  |

记录建议：

- `keywordTop5Hit`：关键词检索前 5 条是否包含 expectedTitle。
- `semanticTop5Hit`：剧情语义检索前 5 条是否包含 expectedTitle。
- `semanticRank`：expectedTitle 在语义检索结果中的名次。
- `aiGuessMentioned`：AI 猜书候选是否提到 expectedTitle 或明显相近的候选；如果返回追问，可在 notes 记录 `need_more_info`。该字段只用于观察，不代表候选真实存在。
- `notes`：记录 query 是否太短、是否含多个题材、是否需要补充 AI 分析或重新生成向量。

## 数据合规边界

- 不要使用敏感数据集作为公开展示数据。
- `examples/demo-novels.json` 是公开展示用的手写虚构数据。
- Chinese-web-novel 只用于本地功能测试，不作为公开 demo 数据提交。
- 不提交 `sample.csv`、`data.csv`、转换生成的 JSON 或任何真实数据集文件。
- 不爬取晋江、番茄、起点或其他平台页面。
- 不采集小说章节正文、免费章节正文、VIP/付费章节正文。
- 不绕过验证码、反爬、字体加密、JS 加密、复制限制或任何平台限制。
