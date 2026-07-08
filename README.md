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

## 使用公开数据集进行本地测试

仓库不包含任何原始公开数据集，也不包含生成后的小说样本 JSON。`data/` 和 `hf-cache/` 已加入 `.gitignore`，本地测试数据只用于验证 Novel Recall 的导入、AI 分析和语义搜索流程。

本地转换脚本位于：

```text
scripts/prepare-hf-novel-sample.mjs
```

脚本只读取你手动准备的本地文件，不会下载数据集，也不会访问晋江、番茄、起点或其他平台页面。小体积 `sample.csv` 可用于快速验证；如果后续手动准备大体积 `data.csv`，CSV 输入会使用流式读取，并在达到 `--limit` 条成功转换记录后停止继续读取。

支持输入格式：

- `.json`
- `.jsonl`
- `.csv`

运行示例：

```powershell
node scripts/prepare-hf-novel-sample.mjs --input data/raw.jsonl --output data/novels-sample.json --limit 100
```

```powershell
node scripts/prepare-hf-novel-sample.mjs --input D:\datasets\Chinese-web-novel\sample.csv --output D:\datasets\Chinese-web-novel\novels-sample.json --limit 100
```

```powershell
node scripts/prepare-hf-novel-sample.mjs --input D:\datasets\Chinese-web-novel\data.csv --output D:\datasets\Chinese-web-novel\novels-sample-50.json --limit 50
```

CSV 输入要求包含表头。脚本会自动识别 `title`、`name`、`book_name`、`novel_name`、`author`、`category`、`tags`、`intro`、`summary`、`description`、`desc`、`content`、`text` 等字段。CSV parser 支持中文、逗号、双引号和字段内换行；如果遇到未闭合引号等格式问题，会输出错误提示并退出。

转换规则：

- 标题优先使用 `title`、`name`、`book_name`、`novel_name`；缺失时生成 `测试小说 1`、`测试小说 2`。
- 作者优先使用 `author`；缺失时使用 `未知作者`。
- 简介优先使用 `intro`、`summary`、`description`、`desc`。
- 如果只能从 `content` 或 `text` 提取简介，只截取前 400 字左右，不导出完整正文。
- 简介太短的记录会跳过。
- `tags` 是数组时保留清洗后的字符串项；是字符串时按逗号、空格、斜杠、竖线切分；缺失时输出空数组。

输出 JSON 是 Novel Recall options 页面可直接导入的数组，例如：

```json
[
  {
    "title": "示例小说",
    "author": "未知作者",
    "platform": "Chinese-web-novel",
    "url": "",
    "intro": "用于检索测试的简介或文本摘要，不包含完整小说正文。",
    "tags": ["重生", "校园"],
    "category": "",
    "status": "",
    "wordCount": "",
    "source": "import"
  }
]
```

请不要把原始小说全文、`sample.csv`、`data.csv`、生成的大 JSON 或任何本地数据集文件提交到 Git。本项目不采集小说章节正文，不绕过任何平台限制，不写爬虫、反爬、模拟登录、验证码绕过或字体加密绕过代码。

## Demo 数据与搜索评估

仓库提供一份可公开展示的安全 demo 数据：

```text
examples/demo-novels.json
```

这份文件包含 12 条手写虚构小说简介，覆盖校园重生、古言权谋、末世囤货、玄幻升级、娱乐圈甜宠、悬疑破案、无限流、修仙成长、先婚后爱、穿书反派洗白、星际机甲和种田经营等题材。它不来自真实小说平台，不来自 Hugging Face 或 Chinese-web-novel 抽样数据，也不包含完整小说正文。

可在 Novel Recall options 页面直接导入 `examples/demo-novels.json`，用于演示 JSON 导入、关键词检索、AI 分析、向量生成和剧情语义检索流程。

搜索质量评估说明位于：

```text
docs/search-evaluation.md
```

该文档提供关键词检索与剧情语义检索的对比方法、10 条固定测试 query、预期命中的 demo 小说 title，以及评估表格模板。建议使用 demo 数据进行公开演示和可复现测试，不要使用敏感数据集作为公开展示数据。

数据合规边界：

- `examples/demo-novels.json` 是虚构手写数据，可用于公开 demo。
- Chinese-web-novel 只用于本地功能验证，不作为公开 demo 数据提交。
- 不提交 `sample.csv`、`data.csv`、转换生成的 JSON 或任何真实数据集文件。
- 不爬取晋江、番茄、起点或其他平台。
- 不采集网页正文、小说章节正文、免费章节正文、VIP/付费章节正文。
- 不绕过验证码、反爬、字体加密、JS 加密、复制限制或任何平台限制。

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
docs/
  search-evaluation.md    搜索质量评估说明
examples/
  demo-novels.json        可公开展示的手写虚构 demo 数据
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
data/
hf-cache/
*.jsonl
*.parquet
*.arrow
*.db
*.sqlite
sample.csv
data.csv
novels-sample.json
novels-sample-*.json
novels-data-*.json
```

请不要提交 API Key、构建产物、本地依赖目录、公开数据集原文件、生成样本 JSON 或小说正文数据。
