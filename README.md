# Novel Recall

Novel Recall 是一个本地优先的小说数据管理扩展。第一阶段只做小说元数据的本地导入、保存、检索、删除和导出，不接入 AI 服务，不读取网页正文，也不保存完整小说正文。

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

明确不包含：

- 不接入 SiliconFlow。
- 不调用 Chat Completion。
- 不生成 embedding。
- 不做语义搜索。
- 不做晋江、番茄、起点等页面适配。
- 不写爬虫、反爬、破解、模拟登录或采集逻辑。
- 不采集小说正文、免费章节正文、VIP/付费章节正文。
- 不调用 App 私有接口。
- 不从盗版小说站采集数据。
- 不保存、展示、导出完整小说正文。

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

导出内容是包含 `novels` 数组的 JSON 对象。导出只包含 NovelItem 字段，不包含 API Key，不包含构建产物，也不包含完整小说正文。

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
  NovelManager.jsx        第一阶段小说管理界面
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
    novels.js             IndexedDB 小说存储、导入、导出、删除、清空
```

## 隐私与数据安全

- 小说数据保存在当前浏览器本地 IndexedDB。
- 当前阶段不需要 API Key，也没有 API Key 输入框。
- 当前阶段没有 background service worker、content script 或 host permissions。
- 当前阶段不会自动读取网页、不会自动索引网页、不会调用外部 AI API。
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
