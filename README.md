# Novel Recall

Novel Recall 是一个本地优先的小说数据管理扩展。第一阶段完成小说元数据的本地导入、保存、检索、删除和导出；第二阶段可选接入 SiliconFlow Chat Completion，根据用户导入的小说元数据生成结构化摘要和标签；第三阶段接入 SiliconFlow Embeddings，用本地 cosine similarity 做自然语言剧情语义搜索。

## 第一阶段范围

已实现：

- NovelItem 小说数据模型。
- 使用 IndexedDB 保存小说数据。
- 导入 JSON 小说数据。
- 导出 JSON 小说数据。
- 展示本地小说列表。
- 按 `title`、`author`、`intro`、`tags` 做普通关键词搜索。
- 删除单条小说数据。
- 清空全部小说数据，清空前需要二次确认。

## 第二阶段范围

已实现：

- 通过 UI 输入、保存和清除 SiliconFlow API Key。
- 使用 `chrome.storage.local` 保存 API Key，不写入 IndexedDB。
- 调用 SiliconFlow Chat Completion 生成小说结构化信息。
- 对单条小说生成 `summary`、`plotKeywords`、`characterTags`、`genreTags`。
- 将生成结果写回 IndexedDB。
- 在小说卡片中展示 AI 摘要、剧情关键词、人设标签和题材标签。
- 支持单条小说点击 `AI 分析` 或 `重新分析`。
- 支持批量分析当前列表中尚未分析的小说。
- 提供 loading、成功和失败状态提示。

AI 返回格式：

```json
{
  "summary": "不超过 80 字的小说简介总结",
  "plotKeywords": ["剧情关键词1", "剧情关键词2"],
  "characterTags": ["人设标签1", "人设标签2"],
  "genreTags": ["题材标签1", "题材标签2"]
}
```

当前仍明确不包含：

- 不做晋江、番茄、起点等页面适配。
- 不写爬虫、反爬、破解、模拟登录或采集逻辑。
- 不采集小说正文、免费章节正文、VIP/付费章节正文。
- 不调用 App 私有接口。
- 不从盗版小说站采集数据。
- 不保存、展示、导出完整小说正文。

## 第三阶段范围

已实现：

- 调用 SiliconFlow Embeddings 为小说生成向量。
- 单条小说支持 `生成向量` 和 `重新生成向量`。
- 支持批量生成当前列表中尚未生成的小说向量。
- 向量写入 IndexedDB 的 `NovelItem.embedding` 字段。
- 支持自然语言剧情语义搜索。
- 语义搜索会为用户输入的 query 生成 embedding。
- 本地使用 cosine similarity 计算 query embedding 与小说 embedding 的相似度。
- 搜索结果按 similarity 从高到低展示，默认展示 Top 10。
- 搜索结果显示 similarity 分数，例如 `0.823`。
- 保留普通关键词搜索作为关键词模式。

小说 embedding 文本由以下字段拼接：

```text
标题
作者
分类
标签
简介
AI总结
剧情关键词
人设标签
题材标签
```

不会拼接、生成、保存或展示小说正文、章节正文、免费章节正文或付费章节正文。

## 数据模型

```ts
export interface NovelItem {
  id: string;
  title: string;
  author?: string;
  platform?: string;
  url?: string;
  intro: string;
  tags?: string[];
  category?: string;
  status?: string;
  wordCount?: string;
  updateTime?: string;
  summary?: string;
  plotKeywords?: string[];
  characterTags?: string[];
  genreTags?: string[];
  embedding?: number[];
  source: "import" | "manual" | "web";
  createdAt: number;
  updatedAt: number;
}
```

当前代码中的类型声明位于 `src/novel.d.ts`。运行时存储逻辑位于 `src/storage/novels.js`。

## JSON 导入格式

导入文件可以是 NovelItem 数组：

```json
[
  {
    "id": "novel-example-001",
    "title": "示例小说",
    "author": "某作者",
    "platform": "本地整理",
    "url": "https://example.com/novel/1",
    "intro": "这里是小说简介，不是正文。",
    "tags": ["仙侠", "群像"],
    "category": "男频",
    "status": "连载",
    "wordCount": "120万字",
    "updateTime": "2026-07-07",
    "source": "import",
    "createdAt": 1783429200000,
    "updatedAt": 1783429200000
  }
]
```

也可以是包含 `novels` 数组的对象：

```json
{
  "app": "Novel Recall",
  "schemaVersion": 1,
  "novels": []
}
```

导入时会按白名单字段写入 IndexedDB。未知字段会被忽略，`content`、`chapters`、正文文本等字段不会进入当前数据模型。

## JSON 导出格式

导出文件名类似：

```text
novel-recall-export-YYYY-MM-DD.json
```

导出内容是包含 `novels` 数组的 JSON 对象。导出只包含 NovelItem 字段，不包含 SiliconFlow API Key，不包含构建产物，也不包含完整小说正文。

第二阶段生成的 `summary`、`plotKeywords`、`characterTags`、`genreTags` 属于 NovelItem 字段，会随小说数据一起导出。第三阶段生成的 `embedding` 也属于 NovelItem 字段，会随小说数据一起导出；UI 只显示“已生成向量”等状态，不展示完整 embedding 数组。

## 本地运行

安装依赖：

```powershell
cd D:\code\NovelRecall
npm install
```

启动开发服务：

```powershell
npm run dev
```

生成扩展构建产物：

```powershell
npm run build
```

构建产物会输出到：

```text
D:\code\NovelRecall\dist
```

`dist/` 不应提交到 Git。

## Chrome 加载方式

1. 打开 `chrome://extensions`。
2. 开启右上角的“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择 `D:\code\NovelRecall\dist`。
5. 点击浏览器工具栏中的 Novel Recall 图标打开管理界面。

每次重新执行 `npm run build` 后，需要在 `chrome://extensions` 中刷新扩展。

## 项目结构

```text
src/
  ai/
    siliconflow.js        SiliconFlow Chat Completion 与 Embeddings 调用
  NovelManager.jsx        小说管理与 AI 分析界面
  manifest.js             Chrome 扩展清单
  novel-manager.css       管理界面样式
  novel.d.ts              NovelItem 类型声明
  options/
    index.html            Options HTML 入口
    main.jsx              Options React 入口
  popup/
    index.html            Popup HTML 入口
    main.jsx              Popup React 入口
  storage/
    settings.js           chrome.storage.local API Key 存储
    novels.js             IndexedDB 小说存储、导入、导出、删除、清空、AI 结果和向量更新
  utils/
    vector.js             本地 cosine similarity 计算
```

## 隐私与数据安全

- 小说数据保存在当前浏览器本地 IndexedDB。
- SiliconFlow API Key 保存在当前浏览器的 `chrome.storage.local`。
- API Key 不会写入代码、README、IndexedDB 或导出 JSON。
- 点击 AI 分析时，Novel Recall 会把该小说的 `title`、`author`、`category`、`status`、`tags`、`intro` 发送给 SiliconFlow Chat Completion，用于生成摘要和标签。
- 点击生成向量时，Novel Recall 会把该小说的标题、作者、分类、标签、简介、AI 摘要和 AI 标签发送给 SiliconFlow Embeddings，用于生成小说 embedding。
- 使用语义搜索时，Novel Recall 会把用户输入的剧情描述 query 发送给 SiliconFlow Embeddings，用于生成 query embedding。
- 除 SiliconFlow Chat Completion 和 SiliconFlow Embeddings 外，Novel Recall 不会把小说简介或 query 发送给其他服务。
- 当前阶段没有 background service worker 或 content script。
- manifest 仅包含 `storage` 权限和 `https://api.siliconflow.cn/*` 这一项 host permission。
- 当前阶段不会自动读取网页、不会自动索引网页、不会采集平台页面。
- 导入和导出只处理用户手动选择或保存的 JSON 文件。

## Git 忽略项

以下内容不应提交：

```text
node_modules/
dist/
.env
.env.local
.agents/
```

请不要提交 API Key、构建产物或本地依赖目录。
