import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  generateEmbedding,
  generateNovelAnalysis,
  generateNovelCandidates,
} from './ai/siliconflow'
import {
  clearNovels,
  deleteNovel,
  getAllNovels,
  getAllNovelsForExport,
  importNovels,
  updateNovelAnalysis,
  updateNovelEmbedding,
} from './storage/novels'
import {
  clearSiliconFlowApiKey,
  getSiliconFlowApiKey,
  saveSiliconFlowApiKey,
} from './storage/settings'
import { cosineSimilarity } from './utils/vector'
import './novel-manager.css'

export default function NovelManager({ mode, surface = 'page' }) {
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
  const [embeddingNovelIds, setEmbeddingNovelIds] = useState(() => new Set())
  const [embeddingFailedNovelIds, setEmbeddingFailedNovelIds] = useState(
    () => new Set(),
  )
  const [isBatchEmbedding, setIsBatchEmbedding] = useState(false)
  const [popupSearchMode, setPopupSearchMode] = useState('semantic')
  const [semanticQuery, setSemanticQuery] = useState('')
  const [semanticResults, setSemanticResults] = useState(null)
  const [isSemanticSearching, setIsSemanticSearching] = useState(false)
  const [aiGuessQuery, setAiGuessQuery] = useState('')
  const [aiGuessInfo, setAiGuessInfo] = useState(null)
  const [aiGuessCandidates, setAiGuessCandidates] = useState(null)
  const [isAiGuessing, setIsAiGuessing] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    refreshNovels()
    loadApiKeyStatus()
  }, [])

  const keywordFilteredNovels = useMemo(
    () => filterNovelsByKeyword(novels, searchQuery),
    [novels, searchQuery],
  )
  const appMode = mode || (surface === 'popup' ? 'popup' : 'options')
  const isPopupMode = appMode === 'popup'
  const surfaceClass = isPopupMode ? 'popup' : 'page'
  const hasUnembeddedNovels = novels.some((novel) => !hasNovelEmbedding(novel))
  const hasEmbeddedNovels = novels.some(hasNovelEmbedding)
  const isPopupSemanticMode = popupSearchMode === 'semantic'
  const isPopupKeywordMode = popupSearchMode === 'keyword'
  const isPopupGuessMode = popupSearchMode === 'guess'
  const needsPopupApiKey = isPopupSemanticMode || isPopupGuessMode
  const displayedNovels =
    semanticResults ??
    (isPopupMode && !isPopupKeywordMode ? novels : keywordFilteredNovels)
  const unanalyzedDisplayedNovels = useMemo(
    () => displayedNovels.filter((novel) => !hasNovelAnalysis(novel)),
    [displayedNovels],
  )
  const unembeddedDisplayedNovels = useMemo(
    () => displayedNovels.filter((novel) => !hasNovelEmbedding(novel)),
    [displayedNovels],
  )
  const isKeywordSearchMode = searchQuery.trim().length > 0
  const isSemanticSearchMode = semanticResults !== null

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
      setSemanticResults(null)
      setAiGuessInfo(null)
      setAiGuessCandidates(null)
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
      setSemanticResults((currentResults) =>
        currentResults
          ? currentResults.filter((currentNovel) => currentNovel.id !== novel.id)
          : currentResults,
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
      setSemanticQuery('')
      setSemanticResults(null)
      setAiGuessQuery('')
      setAiGuessInfo(null)
      setAiGuessCandidates(null)
      setEmbeddingFailedNovelIds(new Set())
      showStatus('已清空全部小说数据', 'success')
    } catch {
      showStatus('清空失败，请稍后重试', 'error')
    }
  }

  function handleKeywordSearchChange(event) {
    setSearchQuery(event.target.value)
    setSemanticResults(null)
  }

  function handlePopupSearchModeClick(nextMode) {
    setPopupSearchMode(nextMode)
    setStatusMessage('')

    if (nextMode === 'semantic') {
      setSearchQuery('')
      setAiGuessQuery('')
      setAiGuessInfo(null)
      setAiGuessCandidates(null)
      return
    }

    if (nextMode === 'keyword') {
      setSemanticQuery('')
      setSemanticResults(null)
      setAiGuessQuery('')
      setAiGuessInfo(null)
      setAiGuessCandidates(null)
      return
    }

    if (nextMode === 'guess') {
      setSearchQuery('')
      setSemanticQuery('')
      setSemanticResults(null)
      setAiGuessInfo(null)
      setAiGuessCandidates(null)
    }
  }

  function handlePopupSearchInputChange(event) {
    const nextValue = event.target.value

    if (isPopupSemanticMode) {
      setSemanticQuery(nextValue)
      setSemanticResults(null)
      return
    }

    if (isPopupGuessMode) {
      setAiGuessQuery(nextValue)
      setAiGuessInfo(null)
      setAiGuessCandidates(null)
      return
    }

    setSearchQuery(nextValue)
    setSemanticResults(null)
  }

  function handleClearPopupSearchInput() {
    setStatusMessage('')

    if (isPopupSemanticMode) {
      setSemanticQuery('')
      setSemanticResults(null)
      return
    }

    if (isPopupGuessMode) {
      setAiGuessQuery('')
      setAiGuessInfo(null)
      setAiGuessCandidates(null)
      return
    }

    setSearchQuery('')
    setSemanticResults(null)
  }

  function handlePopupSearchSubmit(event) {
    if (isPopupSemanticMode) {
      handleSemanticSearchSubmit(event)
      return
    }

    if (isPopupGuessMode) {
      handleAiGuessSubmit(event)
      return
    }

    event.preventDefault()
    setSemanticResults(null)
    setAiGuessInfo(null)
    setAiGuessCandidates(null)

    if (!searchQuery.trim()) {
      showStatus('请输入关键词', 'error')
      return
    }

    showStatus(`关键词检索完成，匹配 ${keywordFilteredNovels.length} 条`, 'success')
  }

  async function handleAiGuessSubmit(event) {
    event.preventDefault()

    const query = aiGuessQuery.trim()

    if (!query) {
      showStatus('请输入你记得的剧情', 'error')
      return
    }

    const inputGuidance = getAiGuessInputGuidance(query)

    if (inputGuidance) {
      setAiGuessInfo(inputGuidance)
      setAiGuessCandidates([])
      setSemanticResults(null)
      showStatus(inputGuidance.message, 'warning')
      return
    }

    const apiKey = await getSiliconFlowApiKey().catch(() => '')

    setHasApiKey(Boolean(apiKey))

    if (!apiKey) {
      showStatus('请先在设置页配置 SiliconFlow API Key', 'error')
      return
    }

    setIsAiGuessing(true)
    setAiGuessInfo(null)
    setAiGuessCandidates(null)
    setSemanticResults(null)
    setStatusMessage('')

    try {
      const result = await generateNovelCandidates({
        apiKey,
        query,
      })

      setAiGuessInfo({
        status: result.status,
        message: result.message,
        followUpQuestions: result.followUpQuestions,
      })

      if (result.status === 'need_more_info') {
        setAiGuessCandidates([])
        showStatus('信息还不够，AI 暂时无法给出可靠候选', 'warning')
        return
      }

      setAiGuessCandidates(result.candidates)
      showStatus(
        `AI 猜书完成，返回 ${result.candidates.length} 个推测候选`,
        'success',
      )
    } catch (error) {
      setAiGuessInfo(null)
      setAiGuessCandidates([])
      showStatus(getFriendlyApiErrorMessage(error), 'error')
    } finally {
      setIsAiGuessing(false)
    }
  }

  async function handleGenerateEmbedding(novel) {
    if (embeddingNovelIds.has(novel.id)) {
      return
    }

    const apiKey = await getSiliconFlowApiKey().catch(() => '')

    setHasApiKey(Boolean(apiKey))

    if (!apiKey) {
      showStatus(
        isPopupMode
          ? '请先在设置页配置 SiliconFlow API Key'
          : '请先填写并保存 SiliconFlow API Key',
        'error',
      )
      return
    }

    const embeddingText = buildNovelEmbeddingText(novel)

    if (!embeddingText) {
      showStatus('小说数据不足，无法生成向量', 'error')
      return
    }

    markNovelEmbedding(novel.id, true)
    markNovelEmbeddingFailed(novel.id, false)
    setStatusMessage('')

    try {
      const embedding = await generateEmbedding({
        apiKey,
        text: embeddingText,
      })
      const updatedNovel = await updateNovelEmbedding(novel.id, embedding)

      replaceNovel(updatedNovel)
      showStatus(`《${novel.title}》向量已生成`, 'success')
    } catch (error) {
      markNovelEmbeddingFailed(novel.id, true)
      showStatus(getFriendlyApiErrorMessage(error), 'error')
    } finally {
      markNovelEmbedding(novel.id, false)
    }
  }

  async function handleBatchEmbeddingClick() {
    if (isBatchEmbedding) {
      return
    }

    const candidates = unembeddedDisplayedNovels

    if (candidates.length === 0) {
      showStatus('当前列表没有待生成向量的小说', 'info')
      return
    }

    const apiKey = await getSiliconFlowApiKey().catch(() => '')

    setHasApiKey(Boolean(apiKey))

    if (!apiKey) {
      showStatus('请先填写并保存 SiliconFlow API Key', 'error')
      return
    }

    setIsBatchEmbedding(true)
    showStatus(`准备生成 ${candidates.length} 条小说向量...`, 'info')

    let successCount = 0
    let failedCount = 0
    let skippedCount = 0

    for (const novel of candidates) {
      const embeddingText = buildNovelEmbeddingText(novel)

      if (!embeddingText) {
        skippedCount += 1
        continue
      }

      markNovelEmbedding(novel.id, true)
      markNovelEmbeddingFailed(novel.id, false)

      try {
        const embedding = await generateEmbedding({
          apiKey,
          text: embeddingText,
        })
        const updatedNovel = await updateNovelEmbedding(novel.id, embedding)

        replaceNovel(updatedNovel)
        successCount += 1
      } catch {
        markNovelEmbeddingFailed(novel.id, true)
        failedCount += 1
      } finally {
        markNovelEmbedding(novel.id, false)
      }
    }

    setIsBatchEmbedding(false)
    showStatus(
      `批量生成向量完成：成功 ${successCount} 条，失败 ${failedCount} 条，跳过 ${skippedCount} 条`,
      failedCount > 0 ? 'warning' : 'success',
    )
  }

  async function handleSemanticSearchSubmit(event) {
    event.preventDefault()

    const query = semanticQuery.trim()

    if (!query) {
      showStatus('请输入剧情描述', 'error')
      return
    }

    const apiKey = await getSiliconFlowApiKey().catch(() => '')

    setHasApiKey(Boolean(apiKey))

    if (!apiKey) {
      showStatus(
        isPopupMode
          ? '请先在设置页配置 SiliconFlow API Key'
          : '请先填写并保存 SiliconFlow API Key',
        'error',
      )
      return
    }

    const searchableNovels = novels.filter(hasNovelEmbedding)

    if (searchableNovels.length === 0) {
      setSemanticResults([])
      showStatus(
        isPopupMode
          ? '暂无可语义搜索的小说，请到设置页批量生成向量'
          : '暂无可语义搜索的小说，请先生成小说向量',
        'warning',
      )
      return
    }

    setIsSemanticSearching(true)
    setStatusMessage('')

    try {
      const queryEmbedding = await generateEmbedding({
        apiKey,
        text: query,
      })
      const results = searchableNovels
        .map((novel) => ({
          ...novel,
          similarity: cosineSimilarity(queryEmbedding, novel.embedding),
        }))
        .sort((novelA, novelB) => novelB.similarity - novelA.similarity)
        .slice(0, 10)

      setSearchQuery('')
      setSemanticResults(results)
      showStatus(
        results.length > 0
          ? `语义搜索完成，展示 Top ${results.length}`
          : '暂无语义搜索结果',
        results.length > 0 ? 'success' : 'warning',
      )
    } catch (error) {
      showStatus(getFriendlyApiErrorMessage(error), 'error')
    } finally {
      setIsSemanticSearching(false)
    }
  }

  function handleClearSemanticSearch() {
    setSemanticQuery('')
    setSemanticResults(null)
    setStatusMessage('')
  }

  function handleOpenSettingsClick() {
    const runtimeApi = globalThis.chrome?.runtime

    if (runtimeApi?.openOptionsPage) {
      const openResult = runtimeApi.openOptionsPage()

      if (openResult?.catch) {
        openResult.catch(() => {
          openOptionsFallback(runtimeApi)
        })
      }

      return
    }

    openOptionsFallback(runtimeApi)
  }

  function openOptionsFallback(runtimeApi) {
    const optionsUrl =
      runtimeApi?.getURL?.('src/options/index.html') || 'src/options/index.html'

    try {
      const openedWindow = window.open(optionsUrl, '_blank', 'noopener,noreferrer')

      if (!openedWindow) {
        window.location.href = optionsUrl
      }
    } catch {
      showStatus('无法打开设置页', 'error')
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
      showStatus(getFriendlyApiErrorMessage(error), 'error')
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
    setSemanticResults((currentResults) =>
      currentResults
        ? currentResults.map((novel) =>
            novel.id === updatedNovel.id
              ? { ...updatedNovel, similarity: novel.similarity }
              : novel,
          )
        : currentResults,
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

  function markNovelEmbedding(novelId, generating) {
    setEmbeddingNovelIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (generating) {
        nextIds.add(novelId)
      } else {
        nextIds.delete(novelId)
      }

      return nextIds
    })
  }

  function markNovelEmbeddingFailed(novelId, failed) {
    setEmbeddingFailedNovelIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (failed) {
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

  if (isPopupMode) {
    return (
      <main className={`novel-manager ${surfaceClass}`}>
        <header className="manager-header">
          <div>
            <h1>Novel Recall</h1>
          </div>
          <div className="header-actions">
            <span className="novel-count">{novels.length} 条</span>
            <button
              type="button"
              className="settings-icon-button"
              aria-label="打开设置页"
              title="打开设置页"
              onClick={handleOpenSettingsClick}
            >
              ⚙
            </button>
          </div>
        </header>

        {needsPopupApiKey && !hasApiKey && !isCheckingApiKey ? (
          <div className="light-notice" role="status">
            <span>请先在设置页配置 SiliconFlow API Key</span>
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={handleOpenSettingsClick}
            >
              打开设置页
            </button>
          </div>
        ) : null}

        {isPopupSemanticMode && hasUnembeddedNovels ? (
          <div className="light-notice">
            <span>
              {hasEmbeddedNovels
                ? '部分小说尚未生成向量，请到设置页批量生成'
                : '请先到设置页生成小说向量'}
            </span>
            <button
              type="button"
              className="secondary-button compact-button"
              onClick={handleOpenSettingsClick}
            >
              打开设置页
            </button>
          </div>
        ) : null}

        <section className="popup-search-panel" aria-label="小说搜索">
          <form
            className="popup-search-form"
            onSubmit={handlePopupSearchSubmit}
          >
            <div className="search-mode-switch" aria-label="搜索模式">
              <button
                type="button"
                className={`search-mode-button ${
                  isPopupSemanticMode ? 'active' : ''
                }`}
                aria-pressed={isPopupSemanticMode}
                onClick={() => handlePopupSearchModeClick('semantic')}
              >
                剧情检索
              </button>
              <button
                type="button"
                className={`search-mode-button ${
                  isPopupKeywordMode ? 'active' : ''
                }`}
                aria-pressed={isPopupKeywordMode}
                onClick={() => handlePopupSearchModeClick('keyword')}
              >
                关键词检索
              </button>
              <button
                type="button"
                className={`search-mode-button ${
                  isPopupGuessMode ? 'active' : ''
                }`}
                aria-pressed={isPopupGuessMode}
                onClick={() => handlePopupSearchModeClick('guess')}
              >
                AI 猜书
              </button>
            </div>
            {isPopupGuessMode ? (
              <p className="mode-description">
                AI 会根据剧情描述生成可能的候选小说，结果可能不准确，请自行核验。
              </p>
            ) : null}
            <div className="search-input-wrap">
              <input
                type="search"
                value={
                  isPopupSemanticMode
                    ? semanticQuery
                    : isPopupGuessMode
                      ? aiGuessQuery
                      : searchQuery
                }
                onChange={handlePopupSearchInputChange}
                placeholder={
                  isPopupSemanticMode
                    ? '请输入剧情描述，例如：女主重生回高中，男主暗恋她'
                    : isPopupGuessMode
                      ? '请输入你记得的剧情，例如：女主重生回高中，男主暗恋她'
                      : '搜索书名、作者、角色名、标签、简介关键词'
                }
                aria-label={
                  isPopupSemanticMode
                    ? '剧情检索'
                    : isPopupGuessMode
                      ? 'AI 猜书'
                      : '关键词检索'
                }
              />
              {(isPopupSemanticMode
                ? semanticQuery
                : isPopupGuessMode
                  ? aiGuessQuery
                  : searchQuery) ? (
                <button
                  type="button"
                  className="icon-button search-clear-button"
                  aria-label="清空搜索"
                  title="清空搜索"
                  onClick={handleClearPopupSearchInput}
                >
                  ×
                </button>
              ) : null}
            </div>
            <button
              type="submit"
              disabled={
                (isPopupSemanticMode && isSemanticSearching) ||
                (isPopupGuessMode && isAiGuessing)
              }
            >
              {isPopupSemanticMode
                ? isSemanticSearching
                  ? '检索中'
                  : '剧情检索'
                : isPopupGuessMode
                  ? isAiGuessing
                    ? '猜书中'
                    : 'AI 猜书'
                : '关键词检索'}
            </button>
          </form>
        </section>

        {statusMessage ? (
          <p className={`status-message ${statusType}`} role="status">
            {statusMessage}
          </p>
        ) : null}

        {isPopupGuessMode ? (
          <AiGuessResultsSection
            resultInfo={aiGuessInfo}
            candidates={aiGuessCandidates}
            isGuessing={isAiGuessing}
          />
        ) : (
          <NovelListSection
            displayedNovels={displayedNovels}
            isLoading={isLoading}
            isKeywordSearchMode={isKeywordSearchMode}
            isSemanticSearchMode={isSemanticSearchMode}
            emptyLabel="暂无小说数据"
            renderNovel={(novel) => (
              <NovelListItem key={novel.id} novel={novel} compact />
            )}
          />
        )}
      </main>
    )
  }

  return (
    <main className={`novel-manager ${surfaceClass}`}>
      <header className="manager-header">
        <div>
          <h1>Novel Recall 设置</h1>
          <p>本地小说管理后台</p>
        </div>
        <span className="novel-count">{novels.length} 条</span>
      </header>

      <section className="manager-section" aria-labelledby="settings-title">
        <div className="section-heading">
          <h2 id="settings-title">设置</h2>
          <p>
            {isCheckingApiKey
              ? '正在读取 API Key 状态'
              : hasApiKey
                ? 'SiliconFlow API Key 已保存'
                : '保存 API Key 后可使用 AI 分析和语义搜索'}
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

      <section className="manager-section" aria-labelledby="data-title">
        <div className="section-heading">
          <h2 id="data-title">数据管理</h2>
          <p>导入、导出和清空本地 IndexedDB 小说数据。</p>
        </div>
        <div className="toolbar-actions admin-actions">
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
              isBatchAnalyzing ||
              isBatchEmbedding
            }
          >
            清空全部
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

      <section className="manager-section" aria-labelledby="ai-title">
        <div className="section-heading">
          <h2 id="ai-title">AI 处理</h2>
          <p>批量生成小说结构化标签和语义搜索向量。</p>
        </div>
        <div className="toolbar-actions admin-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={handleBatchAnalyzeClick}
            disabled={
              unanalyzedDisplayedNovels.length === 0 ||
              isImporting ||
              isExporting ||
              isBatchAnalyzing ||
              isBatchEmbedding
            }
          >
            {isBatchAnalyzing
              ? '批量分析中'
              : `批量分析未分析小说 (${unanalyzedDisplayedNovels.length})`}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleBatchEmbeddingClick}
            disabled={
              unembeddedDisplayedNovels.length === 0 ||
              isImporting ||
              isExporting ||
              isBatchAnalyzing ||
              isBatchEmbedding
            }
          >
            {isBatchEmbedding
              ? '批量生成中'
              : `批量生成未生成向量 (${unembeddedDisplayedNovels.length})`}
          </button>
        </div>
      </section>

      {statusMessage ? (
        <p className={`status-message ${statusType}`} role="status">
          {statusMessage}
        </p>
      ) : null}

      <section className="manager-section library-section" aria-labelledby="library-title">
        <div className="section-heading">
          <h2 id="library-title">小说库</h2>
          <p>查看、搜索、分析、生成向量和删除单条小说。</p>
        </div>
        <div className="search-input-wrap">
          <input
            type="search"
            value={searchQuery}
            onChange={handleKeywordSearchChange}
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

        <NovelListSection
          displayedNovels={displayedNovels}
          isLoading={isLoading}
          isKeywordSearchMode={isKeywordSearchMode}
          isSemanticSearchMode={isSemanticSearchMode}
          emptyLabel="暂无小说数据"
          renderNovel={(novel) => (
            <NovelListItem
              key={novel.id}
              novel={novel}
              isAnalyzing={analyzingNovelIds.has(novel.id)}
              isEmbedding={embeddingNovelIds.has(novel.id)}
              embeddingFailed={embeddingFailedNovelIds.has(novel.id)}
              onAnalyze={() => handleAnalyzeNovel(novel)}
              onGenerateEmbedding={() => handleGenerateEmbedding(novel)}
              onDelete={() => handleDeleteClick(novel)}
              showManagementActions
            />
          )}
        />
      </section>
    </main>
  )
}

function NovelListSection({
  displayedNovels,
  isLoading,
  isKeywordSearchMode,
  isSemanticSearchMode,
  emptyLabel,
  renderNovel,
}) {
  return (
    <section className="novel-list-section" aria-label="小说列表">
      <div className="list-summary">
        <span>
          {isSemanticSearchMode
            ? `语义结果 ${displayedNovels.length} 条`
            : isKeywordSearchMode
              ? `匹配 ${displayedNovels.length} 条`
              : '全部小说'}
        </span>
        {isLoading ? <span>读取中</span> : null}
      </div>

      {displayedNovels.length > 0 ? (
        <div className="novel-list">{displayedNovels.map(renderNovel)}</div>
      ) : (
        <div className="empty-state">
          {isSemanticSearchMode
            ? '暂无语义搜索结果'
            : isKeywordSearchMode
              ? '暂无匹配小说'
              : emptyLabel}
        </div>
      )}
    </section>
  )
}

function AiGuessResultsSection({
  resultInfo,
  candidates,
  isGuessing,
}) {
  const needsMoreInfo = resultInfo?.status === 'need_more_info'

  return (
    <section className="guess-result-section" aria-label="AI 猜书候选">
      <div className="list-summary">
        <span>
          {needsMoreInfo
            ? '需要补充信息'
            : candidates
            ? `AI 猜书候选 ${candidates.length} 条`
            : 'AI 猜书候选'}
        </span>
        {isGuessing ? <span>生成中</span> : null}
      </div>

      {needsMoreInfo ? (
        <div className="need-more-info-card">
          <strong>信息还不够，AI 暂时无法给出可靠候选</strong>
          <p>{resultInfo.message}</p>
          {resultInfo.followUpQuestions?.length > 0 ? (
            <ul>
              {resultInfo.followUpQuestions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {!needsMoreInfo ? (
        <div className="guess-disclaimer">AI 推测，未验证</div>
      ) : null}

      {!needsMoreInfo && candidates?.length > 0 ? (
        <div className="candidate-list">
          {candidates.map((candidate, index) => (
            <article
              className="candidate-item"
              key={`${candidate.title}-${candidate.author}-${index}`}
            >
              <div className="candidate-title-row">
                <h2>{candidate.title}</h2>
                <span className={`confidence-badge ${candidate.confidence}`}>
                  {getConfidenceLabel(candidate.confidence)}
                </span>
              </div>
              <div className="novel-meta">
                <span>{candidate.author || '未知作者'}</span>
                <span>AI 推测，未验证</span>
              </div>
              <p className="candidate-reason">{candidate.reason}</p>
              {candidate.matchedElements?.length > 0 ? (
                <div className="ai-guess-elements" aria-label="匹配元素">
                  <span className="ai-guess-elements-label">匹配元素：</span>
                  {candidate.matchedElements.map((element) => (
                    <span
                      className="ai-guess-element-pill matched"
                      key={`${candidate.title}-${element}`}
                    >
                      {element}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : !needsMoreInfo ? (
        <div className="empty-state">
          {isGuessing
            ? '正在生成 AI 猜书候选'
            : candidates
              ? '暂无 AI 猜书候选'
              : '输入剧情描述后生成 AI 猜书候选'}
        </div>
      ) : null}
    </section>
  )
}

function NovelListItem({
  novel,
  isAnalyzing = false,
  isEmbedding = false,
  embeddingFailed = false,
  onAnalyze,
  onGenerateEmbedding,
  onDelete,
  showManagementActions = false,
  compact = false,
}) {
  const hasAnalysis = hasNovelAnalysis(novel)
  const hasEmbedding = hasNovelEmbedding(novel)

  return (
    <article className={`novel-item ${compact ? 'compact' : ''}`}>
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
          {typeof novel.similarity === 'number' ? (
            <span>相似度 {novel.similarity.toFixed(3)}</span>
          ) : null}
        </div>

        <p className="novel-intro">
          {compact ? getNovelPreviewText(novel) : novel.intro}
        </p>

        {hasAnalysis && !compact ? <NovelAnalysisResult novel={novel} /> : null}

        {novel.tags?.length > 0 ? (
          <div className="tag-list" aria-label="标签">
            {novel.tags.map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {showManagementActions ? (
          <div className="novel-actions">
            <button
              type="button"
              className="secondary-button analysis-button"
              onClick={onAnalyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? '分析中' : hasAnalysis ? '重新分析' : 'AI 分析'}
            </button>
            <button
              type="button"
              className="secondary-button analysis-button"
              onClick={onGenerateEmbedding}
              disabled={isEmbedding}
            >
              {isEmbedding ? '生成中' : hasEmbedding ? '重新生成向量' : '生成向量'}
            </button>
            <span
              className={`embedding-state ${
                isEmbedding
                  ? 'loading'
                  : embeddingFailed
                    ? 'failed'
                    : hasEmbedding
                      ? 'ready'
                      : 'empty'
              }`}
            >
              {getEmbeddingStateLabel({
                isEmbedding,
                embeddingFailed,
                hasEmbedding,
              })}
            </span>
          </div>
        ) : null}

        <div className="novel-footer">
          <time dateTime={new Date(novel.updatedAt).toISOString()}>
            更新于 {formatTimestamp(novel.updatedAt)}
          </time>
        </div>
      </div>

      {showManagementActions ? (
        <button
          type="button"
          className="icon-button delete-button"
          aria-label={`删除 ${novel.title}`}
          title="删除"
          onClick={onDelete}
        >
          ×
        </button>
      ) : null}
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
      novel.category,
      novel.intro,
      novel.summary,
      ...(Array.isArray(novel.tags) ? novel.tags : []),
      ...(Array.isArray(novel.plotKeywords) ? novel.plotKeywords : []),
      ...(Array.isArray(novel.characterTags) ? novel.characterTags : []),
      ...(Array.isArray(novel.genreTags) ? novel.genreTags : []),
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

function getNovelPreviewText(novel) {
  const text =
    typeof novel.summary === 'string' && novel.summary.trim()
      ? novel.summary.trim()
      : novel.intro || ''

  return text.length > 140 ? `${text.slice(0, 140)}...` : text
}

function hasNovelEmbedding(novel) {
  return Array.isArray(novel.embedding) && novel.embedding.length > 0
}

function buildNovelEmbeddingText(novel) {
  return [
    ['标题', novel.title],
    ['作者', novel.author],
    ['分类', novel.category],
    ['标签', joinTextArray(novel.tags)],
    ['简介', novel.intro],
    ['AI总结', novel.summary],
    ['剧情关键词', joinTextArray(novel.plotKeywords)],
    ['人设标签', joinTextArray(novel.characterTags)],
    ['题材标签', joinTextArray(novel.genreTags)],
  ]
    .map(([label, value]) => {
      const text = typeof value === 'string' ? value.trim() : ''

      return text ? `${label}：${text}` : ''
    })
    .filter(Boolean)
    .join('\n')
}

function joinTextArray(value) {
  return Array.isArray(value)
    ? value
        .filter((item) => typeof item === 'string' || typeof item === 'number')
        .map((item) => String(item).trim())
        .filter(Boolean)
        .join('，')
    : ''
}

function getEmbeddingStateLabel({ isEmbedding, embeddingFailed, hasEmbedding }) {
  if (isEmbedding) {
    return '生成中'
  }

  if (embeddingFailed) {
    return '生成失败'
  }

  return hasEmbedding ? '已生成向量' : '未生成向量'
}

function getFriendlyApiErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message.replace(/(?:sk|sf)-[A-Za-z0-9_-]+/g, '***')
  }

  return '请求失败，请稍后重试'
}

function getAiGuessInputGuidance(query) {
  const normalizedQuery = query.replace(/\s+/g, '')
  const chineseCharCount = (normalizedQuery.match(/[\u4e00-\u9fff]/gu) || [])
    .length
  const concreteElementCount = getAiGuessConcreteElementCount(normalizedQuery)
  const defaultFollowUpQuestions = [
    '是现代、古代、校园、娱乐圈还是玄幻？',
    '还记得主角身份或职业吗？',
    '还记得一个关键剧情或反派设定吗？',
  ]

  if (chineseCharCount < 8 || isObviouslyMeaninglessGuessInput(normalizedQuery)) {
    return {
      status: 'need_more_info',
      message: '描述太少，请补充题材、人物关系或关键剧情。',
      followUpQuestions: defaultFollowUpQuestions,
    }
  }

  if (
    concreteElementCount < 3 ||
    isOverlyGenericRebirthRomance(normalizedQuery)
  ) {
    return {
      status: 'need_more_info',
      message: '这个描述太常见，AI 暂时无法给出可靠候选。',
      followUpQuestions: defaultFollowUpQuestions,
    }
  }

  return null
}

function getAiGuessConcreteElementCount(query) {
  return getAiGuessConcreteElements(query).length
}

function getAiGuessConcreteElements(query) {
  const hints = [
    '高中',
    '大学',
    '校园',
    '古代',
    '现代',
    '末世',
    '修仙',
    '娱乐圈',
    '星际',
    '朝堂',
    '豪门',
    '同桌',
    '青梅竹马',
    '师徒',
    '夫妻',
    '前任',
    '暗恋',
    '死对头',
    '契约婚姻',
    '女主',
    '男主',
    '权臣',
    '皇帝',
    '影帝',
    '学霸',
    '反派',
    '大小姐',
    '特工',
    '医生',
    '重生',
    '穿越',
    '复仇',
    '囤货',
    '破案',
    '考试',
    '高考',
    '逃生',
    '洗白',
    '逆袭',
    '前世',
    '这一世',
    '小时候',
    '多年后',
    '上一世',
    '甜文',
  ]

  return hints
    .filter((hint) => query.includes(hint))
    .sort((elementA, elementB) => query.indexOf(elementA) - query.indexOf(elementB))
}

function isObviouslyMeaninglessGuessInput(query) {
  const vaguePhrases = [
    '不知道',
    '不记得',
    '随便',
    '忘了',
    '没印象',
    '什么小说',
    '哪本书',
  ]
  const hasVaguePhrase = vaguePhrases.some((phrase) => query.includes(phrase))
  const hasNoiseRepeat = /([啊呀额呃嗯哈])\1{2,}/u.test(query)
  const concreteElementCount = getAiGuessConcreteElementCount(query)

  return (hasVaguePhrase && concreteElementCount < 3) || hasNoiseRepeat
}

function isOverlyGenericRebirthRomance(query) {
  const hasRebirth = query.includes('重生')
  const hasCrush = query.includes('暗恋')
  const hasLeadPair =
    (query.includes('女主') || query.includes('女主角')) &&
    (query.includes('男主') || query.includes('男主角'))
  const hasSpecificSetting = [
    '现代',
    '古代',
    '校园',
    '高中',
    '大学',
    '娱乐圈',
    '玄幻',
    '修仙',
    '末世',
    '星际',
    '职场',
    '年代',
    '朝堂',
  ].some((hint) => query.includes(hint))

  return hasRebirth && hasCrush && hasLeadPair && !hasSpecificSetting
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

function getConfidenceLabel(confidence) {
  if (confidence === 'high') {
    return '高置信度'
  }

  if (confidence === 'medium') {
    return '中置信度'
  }

  return '低置信度'
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
