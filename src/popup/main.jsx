import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  canExtractFromUrl,
  extractReadableContentFromTab,
} from '../extraction/readability'
import { clearArticles, getAllArticles, saveArticle } from '../storage/articles'
import './style.css'

function Popup() {
  const [articles, setArticles] = useState([])
  const [statusMessage, setStatusMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    getAllArticles()
      .then(setArticles)
      .catch((error) => {
        console.log('Recall: failed to load articles', error)
      })
  }, [])

  const handleSaveClick = async () => {
    const tabsApi = globalThis.chrome?.tabs

    if (!tabsApi) {
      console.log('Recall: Chrome tabs API is unavailable')
      setStatusMessage('当前浏览器不支持读取标签页')
      return
    }

    setIsSaving(true)
    setStatusMessage('')

    try {
      const tab = await queryActiveTab(tabsApi)

      if (!tab) {
        console.log('Recall: no active tab found')
        setStatusMessage('未找到当前标签页')
        return
      }

      if (typeof tab.id !== 'number' || !tab.url) {
        console.log('Recall: active tab has no usable URL')
        setStatusMessage('当前页面无法保存')
        return
      }

      if (!canExtractFromUrl(tab.url)) {
        setStatusMessage('当前页面不支持正文提取')
        return
      }

      const extractedArticle = await extractReadableContentFromTab(tab.id, tab.url)

      if (!extractedArticle) {
        setStatusMessage('当前页面正文提取失败')
        return
      }

      await saveArticle({
        title: extractedArticle.title || tab.title || '无标题页面',
        url: tab.url,
        content: extractedArticle.content,
        excerpt: extractedArticle.excerpt,
        wordCount: extractedArticle.wordCount,
      })

      setArticles(await getAllArticles())
      setStatusMessage('已保存当前页面')
    } catch (error) {
      console.log('Recall: failed to save article', error)
      setStatusMessage('当前页面正文提取失败')
    } finally {
      setIsSaving(false)
    }
  }

  const handleClearClick = () => {
    clearArticles()
      .then(() => {
        setArticles([])
        setStatusMessage('已清空收藏')
      })
      .catch((error) => {
        console.log('Recall: failed to clear articles', error)
        setStatusMessage('清空收藏失败')
      })
  }

  return (
    <main className="popup">
      <h1>Recall</h1>
      <div className="actions">
        <button type="button" onClick={handleSaveClick} disabled={isSaving}>
          {isSaving ? '正在保存...' : '保存当前页面'}
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={handleClearClick}
          disabled={articles.length === 0}
        >
          清空收藏
        </button>
      </div>
      {statusMessage ? (
        <p className="status-message" role="status">
          {statusMessage}
        </p>
      ) : null}
      <section className="favorites" aria-label="收藏列表">
        {articles.length > 0 ? (
          <div className="favorite-list">
            {articles.map((article) => (
              <article className="favorite-item" key={article.id}>
                <h2>{article.title}</h2>
                <p className="article-url">{article.url}</p>
                {article.excerpt ? (
                  <p className="article-excerpt">{article.excerpt}</p>
                ) : null}
                <div className="article-meta">
                  <time dateTime={article.createdAt}>
                    {new Date(article.createdAt).toLocaleString()}
                  </time>
                  {article.wordCount ? <span>{article.wordCount} 字</span> : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="placeholder">暂无收藏</div>
        )}
      </section>
    </main>
  )
}

function queryActiveTab(tabsApi) {
  return new Promise((resolve, reject) => {
    tabsApi.query({ active: true, currentWindow: true }, ([tab]) => {
      const error = globalThis.chrome?.runtime?.lastError

      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(tab)
    })
  })
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
)
