# Recall

Recall 是一个本地优先的 Chrome 扩展，用于保存网页、抽取正文、生成摘要与标签，并支持基于本地向量的自然语言搜索。

项目基于 Manifest V3、Vite、React、CRXJS、IndexedDB、Readability 和 SiliconFlow API 构建，适合作为浏览器扩展、AI 应用、本地数据管理和语义搜索方向的展示项目。

## 项目简介

Recall 的核心思路是把用户浏览过的高价值网页保存成本地知识库：

- 网页正文保存在浏览器本地 IndexedDB 中。
- 摘要、标签和向量由 SiliconFlow API 生成。
- 搜索时只调用一次 query embedding，本地完成 cosine similarity 排序。
- 自动索引默认关闭，只在用户主动开启后处理普通网页。
- API Key 存储在 `chrome.storage.local`，不写入代码，也不保存到 IndexedDB。

## 核心功能

- 保存当前 Chrome 标签页的标题和 URL。
- 支持用户开启后的自动索引模式，浏览普通网页时自动保存内容页。
- Popup 显示最近一次自动索引状态，方便判断页面为什么保存、跳过或失败。
- 使用 `@mozilla/readability` 抽取网页正文。
- 使用 IndexedDB 持久化保存文章。
- 使用 SiliconFlow Chat Completions 生成中文摘要和标签。
- 使用 SiliconFlow Embeddings 生成文章向量。
- 使用自然语言搜索已收藏内容。
- 在本地计算 cosine similarity 并展示 Top 5 结果。
- 支持按来源筛选全部收藏、手动收藏和自动索引。
- 支持打开原网页和删除单条收藏。
- 在 Options Page 中配置和清除 SiliconFlow API Key。

## 技术栈

- Chrome Extension Manifest V3
- Vite
- React
- CRXJS
- IndexedDB
- `idb`
- `@mozilla/readability`
- SiliconFlow Chat Completions API
- SiliconFlow Embeddings API

## 项目架构

```text
src/
  ai/
    siliconflow.js        SiliconFlow 摘要、标签、向量接口
  auto-index/
    extract.js            自动索引保守正文抽取
    messages.js           自动索引消息类型
    rules.js              自动索引过滤规则与阈值
  background/
    index.js              自动索引后台保存与 AI 生成
  content/
    auto-index.js         页面停留后的自动正文抽取
  extraction/
    readability.js        页面 DOM 快照与正文抽取
  options/
    index.html            设置页 HTML 入口
    main.jsx              设置页 React 逻辑
    style.css             设置页样式
  popup/
    index.html            Popup HTML 入口
    main.jsx              Popup 主流程与交互
    style.css             Popup 样式
  storage/
    articles.js           IndexedDB 文章存储
    settings.js           chrome.storage.local 设置存储
  utils/
    vector.js             cosine similarity 工具
  manifest.js             Chrome 扩展清单
```

## 功能流程

1. 用户在 popup 中点击 `保存当前页面`。
2. 扩展读取当前 active tab 的 `title` 和 `url`。
3. 扩展通过 `chrome.scripting.executeScript` 获取当前页面 DOM 快照。
4. Readability 从 DOM 中抽取正文纯文本。
5. 文章基础信息写入 IndexedDB，包括 `title`、`url`、`content`、`excerpt` 和 `wordCount`。
6. 如果已配置 SiliconFlow API Key，继续生成 `summary`、`tags` 和 `embedding`。
7. Popup 展示收藏列表、摘要、标签、向量状态和保存时间。
8. 用户输入自然语言搜索时，Recall 生成 query embedding。
9. 本地计算 query embedding 与文章 embedding 的 cosine similarity。
10. 按相似度排序展示 Top 5 搜索结果。

自动索引流程：

1. 用户在 Options Page 中主动开启 `自动索引模式`。
2. Content script 只在普通 `http://` 和 `https://` 页面运行。
3. 页面停留超过 15 秒后，Recall 使用保守正文抽取策略读取 `article`、`main`、`[role="main"]` 或 `body` 文本。
4. 正文少于 500 字、重复 URL、本地地址或敏感页面会被跳过。
5. Background service worker 再次检查开关和 URL 去重后写入 IndexedDB。
6. 如果已配置 SiliconFlow API Key，自动生成摘要、标签和向量。
7. 最近一次自动索引状态会保存到 `chrome.storage.local`，并展示在 popup 中。

## 本地运行方式

安装依赖：

```powershell
cd D:\code\Recall
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
D:\code\Recall\dist
```

## Chrome 加载方式

1. 打开 `chrome://extensions`。
2. 开启右上角的“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择 `D:\code\Recall\dist`。
5. 点击浏览器工具栏中的 Recall 图标打开 popup。

每次重新执行 `npm run build` 后，需要在 `chrome://extensions` 中刷新扩展。

## 使用说明

- 保存网页：打开目标网页，点击 Recall popup 中的 `保存当前页面`。
- 打开网页：在收藏列表或搜索结果中点击文章标题。
- 来源筛选：在 popup 中选择 `全部收藏`、`手动收藏` 或 `自动索引`。
- 搜索收藏：在搜索框输入自然语言问题，按 Enter 执行搜索。
- 退出搜索：点击搜索框右侧的 `×`，或清空输入内容，可退出搜索状态并恢复完整收藏列表。
- 删除单条收藏：点击文章卡片右上角的 `×`，确认后会从本地 IndexedDB 删除该条记录。
- 清空全部收藏：点击 `清空收藏`，清空前会二次确认。
- 自动索引：点击右上角齿轮图标打开设置，开启 `自动索引模式` 后，普通内容页停留超过 15 秒会尝试自动保存。
- 自动索引状态：popup 会显示最近一次自动索引的成功、跳过或失败原因。

## API Key 配置说明

Recall 使用 SiliconFlow API 生成摘要、标签和向量。
自动索引保存成功后，如果已配置 API Key，也会调用 SiliconFlow API，可能产生用量消耗。

配置方式：

1. 打开 Recall popup。
2. 点击右上角齿轮图标打开设置。
3. 输入 SiliconFlow API Key。
4. 点击 `保存`。

存储说明：

- API Key 保存在 `chrome.storage.local`。
- API Key 不会写死在代码中。
- API Key 不会保存到 IndexedDB。
- API Key 不应提交到 Git。

## 自动索引模式说明

- 自动索引模式默认关闭。
- Recall 不会读取全部浏览器历史记录，也不请求 `chrome.history` 权限。
- 只有用户主动开启后，才会处理之后浏览的普通 `http://` 和 `https://` 页面。
- 自动索引会跳过 `chrome://`、`edge://`、扩展页面、`about:`、`file://`、`localhost` 和 `127.0.0.1`。
- 自动索引会通过 URL、标题和表单特征跳过登录、支付、账户、购物车、账单、密码、设置、个人资料和后台管理等敏感页面。
- 正文少于 500 字的页面不会自动保存。
- 如果 URL 已经保存过，自动索引不会重复保存。
- 自动索引不会直接在目标页面 DOM 上运行 Readability，以减少严格 CSP 页面上的抽取失败。
- 最近一次自动索引状态只保存在本地 `chrome.storage.local`，不会上传到任何服务器。

## 当前限制

- 数据仅保存在当前浏览器本地，不支持云同步。
- 语义搜索只会检索已成功生成 embedding 的文章。
- 搜索结果暂时固定展示 Top 5。
- 部分动态页面或结构复杂页面可能无法被 Readability 正确抽取。
- `chrome://`、扩展页面等特殊页面无法保存。
- 自动索引采用保守正文抽取策略，部分强 CSP、单页应用、懒加载或复杂动态页面可能被跳过。
- AI 能力依赖用户自行配置 SiliconFlow API Key。
- 目前没有文章详情页、导入导出等管理功能。

## 浏览器兼容性

- Google Chrome 测试通过。
- Microsoft Edge 测试通过。
- QQ 浏览器测试通过。
- Firefox 临时加载测试通过。
- Firefox 当前未做正式签名发布，临时扩展在重启 Firefox 后会消失。
- 项目主要支持目标仍是 Chromium 系浏览器。

## 后续规划

- 文章详情页，展示完整正文、摘要和元信息。
- 单条收藏删除与重新生成 AI 信息。
- 本地数据导出和导入。
- 按标签、域名、时间筛选收藏。
- Options Page 中支持模型配置。
- 更完善的错误提示和状态诊断。
- 搜索结果的更丰富排序与过滤。

## 仓库说明

以下内容不会提交到 Git：

```text
node_modules/
dist/
.env
.env.local
```

请不要提交 API Key、构建产物或本地依赖目录。
