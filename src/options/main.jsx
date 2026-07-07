import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  clearOpenAIApiKey,
  getOpenAIApiKey,
  saveOpenAIApiKey,
} from '../storage/settings'
import './style.css'

function OptionsPage() {
  const [apiKey, setApiKey] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState('info')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    getOpenAIApiKey()
      .then(setApiKey)
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
      setStatusMessage('请输入 API Key')
      return
    }

    setIsSaving(true)

    try {
      await saveOpenAIApiKey(trimmedApiKey)
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
      await clearOpenAIApiKey()
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

  return (
    <main className="options-page">
      <section className="settings-panel" aria-labelledby="settings-title">
        <h1 id="settings-title">Recall 设置</h1>
        <form className="settings-form" onSubmit={handleSave}>
          <label htmlFor="api-key">API Key</label>
          <input
            id="api-key"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            autoComplete="off"
            placeholder="sk-..."
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
