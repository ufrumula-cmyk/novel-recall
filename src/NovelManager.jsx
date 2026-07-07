import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  clearNovels,
  deleteNovel,
  getAllNovels,
  getAllNovelsForExport,
  importNovels,
} from './storage/novels'
import './novel-manager.css'

export default function NovelManager({ surface = 'page' }) {
  const [novels, setNovels] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState('info')
  const [isLoading, setIsLoading] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    refreshNovels()
  }, [])

  const displayedNovels = useMemo(
    () => filterNovelsByKeyword(novels, searchQuery),
    [novels, searchQuery],
  )
  const isSearchMode = searchQuery.trim().length > 0

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
            disabled={novels.length === 0 || isImporting || isExporting}
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

function NovelListItem({ novel, onDelete }) {
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

        {novel.summary ? <p className="novel-summary">{novel.summary}</p> : null}

        {novel.tags?.length > 0 ? (
          <div className="tag-list" aria-label="标签">
            {novel.tags.map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}

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
