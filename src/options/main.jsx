import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  getAllArticlesForExport,
  importArticles,
} from '../storage/articles'
import {
  clearSiliconFlowApiKey,
  getAutoIndexEnabled,
  getSiliconFlowApiKey,
  saveAutoIndexEnabled,
  saveSiliconFlowApiKey,
} from '../storage/settings'
import './style.css'

function OptionsPage() {
  const [apiKey, setApiKey] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState('info')
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingAutoIndex, setIsSavingAutoIndex] = useState(false)
  const [autoIndexEnabled, setAutoIndexEnabled] = useState(false)
  const [backupStatusMessage, setBackupStatusMessage] = useState('')
  const [backupStatusType, setBackupStatusType] = useState('info')
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    Promise.all([getSiliconFlowApiKey(), getAutoIndexEnabled()])
      .then(([storedApiKey, storedAutoIndexEnabled]) => {
        setApiKey(storedApiKey)
        setAutoIndexEnabled(storedAutoIndexEnabled)
      })
      .catch(() => {
        setStatusType('error')
        setStatusMessage('读取设置失败')
      })
  }, [])

  const handleSave = async (event) => {
    event.preventDefault()
    const trimmedApiKey = apiKey.trim()

    if (!trimmedApiKey) {
      setStatusType('error')
      setStatusMessage('请输入 SiliconFlow API Key')
      return
    }

    setIsSaving(true)

    try {
      await saveSiliconFlowApiKey(trimmedApiKey)
      setApiKey(trimmedApiKey)
      setStatusType('success')
      setStatusMessage('保存成功')
    } catch {
      setStatusType('error')
      setStatusMessage('保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  const handleClear = async () => {
    setIsSaving(true)

    try {
      await clearSiliconFlowApiKey()
      setApiKey('')
      setStatusType('success')
      setStatusMessage('已清除')
    } catch {
      setStatusType('error')
      setStatusMessage('清除失败')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAutoIndexChange = async (event) => {
    const nextEnabled = event.target.checked
    const previousEnabled = autoIndexEnabled

    setAutoIndexEnabled(nextEnabled)
    setIsSavingAutoIndex(true)

    try {
      await saveAutoIndexEnabled(nextEnabled)
      setStatusType('success')
      setStatusMessage(nextEnabled ? '自动索引已开启' : '自动索引已关闭')
    } catch {
      setAutoIndexEnabled(previousEnabled)
      setStatusType('error')
      setStatusMessage('自动索引设置保存失败')
    } finally {
      setIsSavingAutoIndex(false)
    }
  }

  const handleExportArticles = async () => {
    setIsExporting(true)
    setBackupStatusMessage('')

    try {
      const articles = await getAllArticlesForExport()
      const exportContent = JSON.stringify(articles, null, 2)
      const blob = new Blob([exportContent], {
        type: 'application/json;charset=utf-8',
      })
      const downloadUrl = URL.createObjectURL(blob)
      const downloadLink = document.createElement('a')

      downloadLink.href = downloadUrl
      downloadLink.download = `recall-export-${getTodayString()}.json`
      document.body.append(downloadLink)
      downloadLink.click()
      downloadLink.remove()
      URL.revokeObjectURL(downloadUrl)

      setBackupStatusType('success')
      setBackupStatusMessage(`已导出 ${articles.length} 条收藏`)
    } catch {
      setBackupStatusType('error')
      setBackupStatusMessage('导出失败，请稍后重试')
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleImportFileChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    if (!window.confirm('导入数据会合并到当前收藏中，确定继续吗？')) {
      return
    }

    setIsImporting(true)
    setBackupStatusMessage('')

    try {
      const fileContent = await file.text()
      const parsedContent = JSON.parse(fileContent)
      const articles = normalizeImportedPayload(parsedContent)
      const result = await importArticles(articles)

      setBackupStatusType('success')
      setBackupStatusMessage(
        `导入完成：成功 ${result.importedCount} 条，跳过重复 ${result.skippedCount} 条，失败 ${result.failedCount} 条`,
      )
    } catch {
      setBackupStatusType('error')
      setBackupStatusMessage('导入文件格式错误，请选择 Recall 导出的 JSON 文件')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <main className="options-page">
      <section className="settings-panel" aria-labelledby="settings-title">
        <h1 id="settings-title">Recall 设置</h1>
        <form className="settings-form" onSubmit={handleSave}>
          <label htmlFor="api-key">SiliconFlow API Key</label>
          <input
            id="api-key"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            autoComplete="off"
            placeholder="请输入 SiliconFlow API Key"
          />
          <div className="button-row">
            <button type="submit" disabled={isSaving}>
              保存
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handleClear}
              disabled={isSaving}
            >
              清除
            </button>
          </div>
        </form>
        <section className="auto-index-setting" aria-labelledby="auto-index-title">
          <div>
            <h2 id="auto-index-title">自动索引模式</h2>
            <p>
              开启后，Recall 会在普通网页停留超过 15 秒时尝试自动保存正文。
            </p>
          </div>
          <label className="toggle-control">
            <input
              type="checkbox"
              checked={autoIndexEnabled}
              onChange={handleAutoIndexChange}
              disabled={isSavingAutoIndex}
            />
            <span className="toggle-track" aria-hidden="true">
              <span className="toggle-thumb" />
            </span>
            <span className="toggle-text">
              {autoIndexEnabled ? '已开启' : '已关闭'}
            </span>
          </label>
        </section>
        <section className="backup-setting" aria-labelledby="backup-title">
          <div>
            <h2 id="backup-title">数据备份</h2>
            <p>
              导出和导入本地收藏文章数据。导出文件不包含 SiliconFlow API Key。
            </p>
          </div>
          <div className="backup-actions">
            <button
              type="button"
              onClick={handleExportArticles}
              disabled={isExporting || isImporting}
            >
              {isExporting ? '正在导出...' : '导出收藏数据'}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handleImportClick}
              disabled={isExporting || isImporting}
            >
              {isImporting ? '正在导入...' : '导入收藏数据'}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden-file-input"
            onChange={handleImportFileChange}
          />
          {backupStatusMessage ? (
            <p className={`status-message ${backupStatusType}`} role="status">
              {backupStatusMessage}
            </p>
          ) : null}
        </section>
        {statusMessage ? (
          <p className={`status-message ${statusType}`} role="status">
            {statusMessage}
          </p>
        ) : null}
      </section>
    </main>
  )
}

function normalizeImportedPayload(payload) {
  if (Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray(payload?.articles)) {
    return payload.articles
  }

  throw new Error('Invalid Recall export file')
}

function getTodayString() {
  return new Date().toISOString().slice(0, 10)
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <OptionsPage />
  </React.StrictMode>,
)
