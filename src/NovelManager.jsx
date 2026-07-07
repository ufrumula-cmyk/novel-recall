import React, { useEffect, useMemo, useRef, useState } from 'react'
import { generateNovelAnalysis } from './ai/siliconflow'
import {
  clearNovels,
  deleteNovel,
  getAllNovels,
  getAllNovelsForExport,
  importNovels,
  updateNovelAnalysis,
} from './storage/novels'
import {
  clearSiliconFlowApiKey,
  getSiliconFlowApiKey,
  saveSiliconFlowApiKey,
} from './storage/settings'
import './novel-manager.css'

export default function NovelManager({ surface = 'page' }) {
  const [novels, setNovels] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState('info')
  const [isLoading, setIsLoading] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(true)
  const [isSavingApiKey, setIsSavingApiKey] = useState(false)
  const [analyzingNovelIds, setAnalyzingNovelIds] = useState(() => new Set())
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    refreshNovels()
    loadApiKeyStatus()
  }, [])

  const displayedNovels = useMemo(
    () => filterNovelsByKeyword(novels, searchQuery),
    [novels, searchQuery],
  )
  const unanalyzedDisplayedNovels = useMemo(
    () => displayedNovels.filter((novel) => !hasNovelAnalysis(novel)),
    [displayedNovels],
  )
  const isSearchMode = searchQuery.trim().length > 0

  async function loadApiKeyStatus() {
    setIsCheckingApiKey(true)

    try {
      const storedApiKey = await getSiliconFlowApiKey()

      setHasApiKey(Boolean(storedApiKey))
    } catch {
      showStatus('读取 API Key 状态失败，请确认在扩展页面中使用', 'error')
    } finally {
      setIsCheckingApiKey(false)
    }
  }

  async function refreshNovels() {
    setIsLoading(true)

    try {
      setNovels(await getAllNovels())
    } catch {
      showStatus('读取本地小说数据失败', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSaveApiKey(event) {
    event.preventDefault()

    const trimmedApiKey = apiKeyInput.trim()

    if (!trimmedApiKey) {
      showStatus('请先输入 SiliconFlow API Key', 'error')
      return
    }

    setIsSavingApiKey(true)

    try {
      await saveSiliconFlowApiKey(trimmedApiKey)
      setApiKeyInput('')
      setHasApiKey(true)
      showStatus('SiliconFlow API Key 已保存', 'success')
    } catch {
      showStatus('API Key 保存失败，请确认在扩展页面中使用', 'error')
    } finally {
      setIsSavingApiKey(false)
    }
  }

  async function handleClearApiKey() {
    setIsSavingApiKey(true)

    try {
      await clearSiliconFlowApiKey()
      setApiKeyInput('')
      setHasApiKey(false)
      showStatus('SiliconFlow API Key 已清除', 'success')
    } catch {
      showStatus('API Key 清除失败，请稍后重试', 'error')
    } finally {
      setIsSavingApiKey(false)
    }
  }

  async function handleImportFileChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    setIsImporting(true)
    setStatusMessage('')

    try {
      const fileContent = await file.text()
      const parsedPayload = JSON.parse(fileContent)
      const result = await importNovels(parsedPayload)

      await refreshNovels()
      showStatus(
        `导入完成：新增 ${result.importedCount} 条，跳过 ${result.skippedCount} 条，失败 ${result.failedCount} 条`,
        result.failedCount > 0 ? 'warning' : 'success',
      )
    } catch {
      showStatus('导入失败：请选择符合 NovelItem 结构的 JSON 文件', 'error')
    } finally {
      setIsImporting(false)
    }
  }

  async function handleExportClick() {
    setIsExporting(true)
    setStatusMessage('')

    try {
      const exportPayload = {
        app: 'Novel Recall',
        schemaVersion: 1,
        exportedAt: Date.now(),
        novels: await getAllNovelsForExport(),
      }
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: 'application/json;charset=utf-8',
      })
      const downloadUrl = URL.createObjectURL(blob)
      const downloadLink = document.createElement('a')

      downloadLink.href = downloadUrl
      downloadLink.download = `novel-recall-export-${getTodayString()}.json`
      document.body.append(downloadLink)
      downloadLink.click()
      downloadLink.remove()
      URL.revokeObjectURL(downloadUrl)
      showStatus(`已导出 ${exportPayload.novels.length} 条小说数据`, 'success')
    } catch {
      showStatus('导出失败，请稍后重试', 'error')
    } finally {
      setIsExporting(false)
    }
  }

  async function handleDeleteClick(novel) {
    if (!window.confirm(`确定删除《${novel.title}》吗？`)) {
      return
    }

    try {
      await deleteNovel(novel.id)
      setNovels((currentNovels) =>
        currentNovels.filter((currentNovel) => currentNovel.id !== novel.id),
      )
      showStatus('已删除小说数据', 'success')
    } catch {
      showStatus('删除失败，请稍后重试', 'error')
    }
  }

  async function handleClearClick() {
    if (!window.confirm('确定要清空全部小说吗？此操作不可恢复。')) {
      return
    }

    if (!window.confirm('请再次确认：清空后无法恢复，是否继续？')) {
      return
    }

    try {
      await clearNovels()
      setNovels([])
      setSearchQuery('')
      showStatus('已清空全部小说数据', 'success')
    } catch {
      showStatus('清空失败，请稍后重试', 'error')
    }
  }

  async function handleAnalyzeNovel(novel) {
    if (analyzingNovelIds.has(novel.id)) {
      return
    }

    const apiKey = await getSiliconFlowApiKey().catch(() => '')

    setHasApiKey(Boolean(apiKey))

    if (!apiKey) {
      showStatus('请先填写并保存 SiliconFlow API Key', 'error')
      return
    }

    markNovelAnalyzing(novel.id, true)
    setStatusMessage('')

    try {
      const analysis = await generateNovelAnalysis({ apiKey, novel })
      const updatedNovel = await updateNovelAnalysis(novel.id, analysis)

      replaceNovel(updatedNovel)
      showStatus(`《${novel.title}》AI 分析已完成`, 'success')
    } catch (error) {
      showStatus(getFriendlyAiErrorMessage(error), 'error')
    } finally {
      markNovelAnalyzing(novel.id, false)
    }
  }

  async function handleBatchAnalyzeClick() {
    if (isBatchAnalyzing) {
      return
    }

    const candidates = unanalyzedDisplayedNovels

    if (candidates.length === 0) {
      showStatus('当前列表没有待分析小说', 'info')
      return
    }

    const apiKey = await getSiliconFlowApiKey().catch(() => '')

    setHasApiKey(Boolean(apiKey))

    if (!apiKey) {
      showStatus('请先填写并保存 SiliconFlow API Key', 'error')
      return
    }

    setIsBatchAnalyzing(true)
    showStatus(`准备分析 ${candidates.length} 条小说...`, 'info')

    let successCount = 0
    let failedCount = 0

    for (const novel of candidates) {
      markNovelAnalyzing(novel.id, true)

      try {
        const analysis = await generateNovelAnalysis({ apiKey, novel })
        const updatedNovel = await updateNovelAnalysis(novel.id, analysis)

        replaceNovel(updatedNovel)
        successCount += 1
      } catch {
        failedCount += 1
      } finally {
        markNovelAnalyzing(novel.id, false)
      }
    }

    setIsBatchAnalyzing(false)
    showStatus(
      `批量分析完成：成功 ${successCount} 条，失败 ${failedCount} 条`,
      failedCount > 0 ? 'warning' : 'success',
    )
  }

  function replaceNovel(updatedNovel) {
    setNovels((currentNovels) =>
      currentNovels.map((novel) =>
        novel.id === updatedNovel.id ? updatedNovel : novel,
      ),
    )
  }

  function markNovelAnalyzing(novelId, analyzing) {
    setAnalyzingNovelIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (analyzing) {
        nextIds.add(novelId)
      } else {
        nextIds.delete(novelId)
      }

      return nextIds
    })
  }

  function showStatus(message, type) {
    setStatusMessage(message)
    setStatusType(type)
  }

  return (
    <main className={`novel-manager ${surface}`}>
      <header className="manager-header">
        <div>
          <h1>Novel Recall</h1>
          <p>本地小说数据管理</p>
        </div>
        <span className="novel-count">{novels.length} 条</span>
      </header>

      <section className="api-key-panel" aria-label="SiliconFlow API Key 设置">
        <div>
          <h2>AI 分析</h2>
          <p>
            {isCheckingApiKey
              ? '正在读取 API Key 状态'
              : hasApiKey
                ? 'SiliconFlow API Key 已保存'
                : '保存 API Key 后可生成剧情、人设和题材标签'}
          </p>
        </div>
        <form className="api-key-form" onSubmit={handleSaveApiKey}>
          <input
            type="password"
            value={apiKeyInput}
            onChange={(event) => setApiKeyInput(event.target.value)}
            placeholder="输入 SiliconFlow API Key"
            aria-label="SiliconFlow API Key"
            autoComplete="off"
          />
          <div className="api-key-actions">
            <button type="submit" disabled={isSavingApiKey}>
              {isSavingApiKey ? '保存中' : '保存'}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handleClearApiKey}
              disabled={isSavingApiKey || !hasApiKey}
            >
              清除
            </button>
          </div>
        </form>
      </section>

      <section className="manager-toolbar" aria-label="小说数据操作">
        <div className="search-input-wrap">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索标题、作者、简介、标签"
            aria-label="搜索标题、作者、简介、标签"
          />
          {searchQuery ? (
            <button
              type="button"
              className="icon-button search-clear-button"
              aria-label="清空搜索"
              title="清空搜索"
              onClick={() => setSearchQuery('')}
            >
              ×
            </button>
          ) : null}
        </div>

        <div className="toolbar-actions">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting || isExporting}
          >
            {isImporting ? '导入中' : '导入 JSON'}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleExportClick}
            disabled={isImporting || isExporting}
          >
            {isExporting ? '导出中' : '导出 JSON'}
          </button>
          <button
            type="button"
            className="danger-button"
            onClick={handleClearClick}
            disabled={
              novels.length === 0 ||
              isImporting ||
              isExporting ||
              isBatchAnalyzing
            }
          >
            清空全部
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleBatchAnalyzeClick}
            disabled={
              unanalyzedDisplayedNovels.length === 0 ||
              isImporting ||
              isExporting ||
              isBatchAnalyzing
            }
          >
            {isBatchAnalyzing
              ? '批量分析中'
              : `批量分析未分析小说 (${unanalyzedDisplayedNovels.length})`}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden-file-input"
          onChange={handleImportFileChange}
        />
      </section>

      {statusMessage ? (
        <p className={`status-message ${statusType}`} role="status">
          {statusMessage}
        </p>
      ) : null}

      <section className="novel-list-section" aria-label="小说列表">
        <div className="list-summary">
          <span>{isSearchMode ? `匹配 ${displayedNovels.length} 条` : '全部小说'}</span>
          {isLoading ? <span>读取中</span> : null}
        </div>

        {displayedNovels.length > 0 ? (
          <div className="novel-list">
            {displayedNovels.map((novel) => (
              <NovelListItem
                key={novel.id}
                novel={novel}
                isAnalyzing={analyzingNovelIds.has(novel.id)}
                onAnalyze={() => handleAnalyzeNovel(novel)}
                onDelete={() => handleDeleteClick(novel)}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            {isSearchMode ? '暂无匹配小说' : '暂无小说数据'}
          </div>
        )}
      </section>
    </main>
  )
}

function NovelListItem({ novel, isAnalyzing, onAnalyze, onDelete }) {
  const hasAnalysis = hasNovelAnalysis(novel)

  return (
    <article className="novel-item">
      <div className="novel-item-main">
        <div className="novel-title-row">
          <h2>
            {novel.url ? (
              <a
                className="novel-title-link"
                href={novel.url}
                target="_blank"
                rel="noreferrer"
              >
                {novel.title}
              </a>
            ) : (
              novel.title
            )}
          </h2>
          <span className="source-badge">{getSourceLabel(novel.source)}</span>
        </div>

        <div className="novel-meta">
          {novel.author ? <span>{novel.author}</span> : null}
          {novel.platform ? <span>{novel.platform}</span> : null}
          {novel.category ? <span>{novel.category}</span> : null}
          {novel.status ? <span>{novel.status}</span> : null}
          {novel.wordCount ? <span>{novel.wordCount}</span> : null}
          {novel.updateTime ? <span>{novel.updateTime}</span> : null}
        </div>

        <p className="novel-intro">{novel.intro}</p>

        {hasAnalysis ? <NovelAnalysisResult novel={novel} /> : null}

        {novel.tags?.length > 0 ? (
          <div className="tag-list" aria-label="标签">
            {novel.tags.map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="novel-actions">
          <button
            type="button"
            className="secondary-button analysis-button"
            onClick={onAnalyze}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? '分析中' : hasAnalysis ? '重新分析' : 'AI 分析'}
          </button>
        </div>

        <div className="novel-footer">
          <time dateTime={new Date(novel.updatedAt).toISOString()}>
            更新于 {formatTimestamp(novel.updatedAt)}
          </time>
        </div>
      </div>

      <button
        type="button"
        className="icon-button delete-button"
        aria-label={`删除 ${novel.title}`}
        title="删除"
        onClick={onDelete}
      >
        ×
      </button>
    </article>
  )
}

function NovelAnalysisResult({ novel }) {
  return (
    <section className="analysis-result" aria-label="AI 分析结果">
      {novel.summary ? <p className="novel-summary">{novel.summary}</p> : null}
      <AnalysisTagGroup label="剧情" tags={novel.plotKeywords} />
      <AnalysisTagGroup label="人设" tags={novel.characterTags} />
      <AnalysisTagGroup label="题材" tags={novel.genreTags} />
    </section>
  )
}

function AnalysisTagGroup({ label, tags }) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return null
  }

  return (
    <div className="analysis-tag-group">
      <span className="analysis-tag-label">{label}</span>
      <div className="tag-list">
        {tags.map((tag) => (
          <span className="tag analysis-tag" key={`${label}-${tag}`}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

function filterNovelsByKeyword(novels, query) {
  const keyword = query.trim().toLocaleLowerCase()

  if (!keyword) {
    return novels
  }

  return novels.filter((novel) => {
    const searchableText = [
      novel.title,
      novel.author,
      novel.intro,
      ...(Array.isArray(novel.tags) ? novel.tags : []),
    ]
      .filter(Boolean)
      .join('\n')
      .toLocaleLowerCase()

    return searchableText.includes(keyword)
  })
}

function hasNovelAnalysis(novel) {
  return Boolean(
    novel.summary ||
      novel.plotKeywords?.length > 0 ||
      novel.characterTags?.length > 0 ||
      novel.genreTags?.length > 0,
  )
}

function getFriendlyAiErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message.replace(/(?:sk|sf)-[A-Za-z0-9_-]+/g, '***')
  }

  return 'AI 分析失败，请稍后重试'
}

function getSourceLabel(source) {
  if (source === 'manual') {
    return '手动'
  }

  if (source === 'web') {
    return '网页'
  }

  return '导入'
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleString()
}

function getTodayString() {
  return new Date().toISOString().slice(0, 10)
}
