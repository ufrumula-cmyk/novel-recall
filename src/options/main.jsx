import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
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
        {statusMessage ? (
          <p className={`status-message ${statusType}`} role="status">
            {statusMessage}
          </p>
        ) : null}
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <OptionsPage />
  </React.StrictMode>,
)
