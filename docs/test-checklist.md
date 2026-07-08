# Novel Recall 测试清单

## 构建

- [ ] 执行 `npm run build`。
- [ ] 构建成功，输出到 `dist/`。
- [ ] `dist/` 仍然不提交到 Git。

## Chrome 加载

- [ ] 打开 `chrome://extensions`。
- [ ] 开启开发者模式。
- [ ] 加载 `D:\code\NovelRecall\dist`。
- [ ] popup 可以打开。
- [ ] options 页面可以打开。

## Demo 数据

- [ ] 在 options 页面导入 `examples/demo-novels.json`。
- [ ] 小说数量正确。
- [ ] 列表展示标题、作者、简介、标签等信息。
- [ ] 标题有 URL 时可新标签打开，demo 数据 URL 可为空。

## API Key

- [ ] 未配置 API Key 时，AI 分析提示先配置。
- [ ] 未配置 API Key 时，向量生成提示先配置。
- [ ] 未配置 API Key 时，AI 猜书提示先配置。
- [ ] 输入 SiliconFlow API Key 后可以保存。
- [ ] 刷新 options 后仍显示已保存状态。
- [ ] 清除 API Key 后状态变为未保存。
- [ ] 导出 JSON 不包含 API Key。

## AI 分析

- [ ] 单条小说可以执行 AI 分析。
- [ ] 已分析小说显示“重新分析”。
- [ ] 批量分析未分析小说可用。
- [ ] 生成结果包含 `summary`、`plotKeywords`、`characterTags`、`genreTags`。
- [ ] 刷新页面后 AI 分析结果仍存在。
- [ ] AI 返回异常时页面不崩溃。

## 向量生成

- [ ] 单条小说可以生成向量。
- [ ] 已生成向量后显示“已生成向量”。
- [ ] 已生成向量小说可以重新生成。
- [ ] 批量生成未生成向量可用。
- [ ] 刷新页面后向量状态仍存在。
- [ ] UI 不展示完整 embedding 数组。

## 剧情检索

- [ ] popup 默认可进入剧情检索模式。
- [ ] 空 query 会提示请输入剧情描述。
- [ ] 无 API Key 时提示到设置页配置。
- [ ] 无小说向量时提示到设置页生成小说向量。
- [ ] 有 query embedding 和小说 embedding 时，结果按 similarity 降序展示。
- [ ] 结果显示 similarity 分数。

## 关键词检索

- [ ] 切换到关键词检索不调用 SiliconFlow。
- [ ] 可搜索 `title`。
- [ ] 可搜索 `author`。
- [ ] 可搜索 `category`。
- [ ] 可搜索 `intro`。
- [ ] 可搜索 `tags`。
- [ ] 可搜索 `summary`。
- [ ] 可搜索 `plotKeywords`。
- [ ] 可搜索 `characterTags`。
- [ ] 可搜索 `genreTags`。

## AI 猜书

- [ ] 切换到 AI 猜书模式。
- [ ] 无 API Key 时提示到设置页配置。
- [ ] 输入“啊啊啊不知道什么小说”时提示补充信息，不展示候选。
- [ ] 输入“女主重生了，暗恋男主”时提示信息过泛并追问。
- [ ] 输入较完整剧情时调用 Chat Completion 并展示候选。
- [ ] 候选显示书名、作者、匹配理由、匹配元素、置信度。
- [ ] 候选明确显示“AI 推测，未验证”。
- [ ] 不出现“未知小说1”“可能的书名”“候选小说”等占位候选。
- [ ] AI 猜书结果不写入 IndexedDB。
- [ ] AI 猜书结果不导出 JSON。

## 删除与清空

- [ ] 单条删除需要用户确认。
- [ ] 删除后列表更新。
- [ ] 清空全部只出现在 options 页面。
- [ ] 清空全部需要二次确认。
- [ ] 清空后 IndexedDB 小说列表为空。

## 导出 JSON

- [ ] options 页面可以导出 JSON。
- [ ] 导出文件包含小说元数据。
- [ ] 导出文件包含 AI 分析结果。
- [ ] 导出文件可以包含 embedding 字段。
- [ ] 导出文件不包含 API Key。
- [ ] 导出文件不包含完整小说正文或章节正文。

## 权限与边界

- [ ] manifest 只有 `storage` 权限。
- [ ] host permission 只有 `https://api.siliconflow.cn/*`。
- [ ] 没有 content script。
- [ ] 没有 background。
- [ ] 没有 tabs、history、cookies、webRequest 权限。
- [ ] 没有晋江、番茄、起点平台适配。
- [ ] 没有爬虫、网页采集、章节采集、反爬、模拟登录或验证码绕过代码。
