import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  generateArticleEmbedding,
  generateArticleInsights,
  generateQueryEmbedding,
} from '../ai/siliconflow'
import {
  canExtractFromUrl,
  extractReadableContentFromTab,
} from '../extraction/readability'
import {
  clearArticles,
  deleteArticle,
  getAllArticles,
  saveArticle,
} from '../storage/articles'
import {
  AUTO_INDEX_ENABLED_STORAGE_KEY,
  AUTO_INDEX_LAST_STATUS_STORAGE_KEY,
  getAutoIndexLastStatus,
  getAutoIndexEnabled,
  getSiliconFlowApiKey,
} from '../storage/settings'
import { cosineSimilarity } from '../utils/vector'
import './style.css'

function Popup() {
  const [articles, setArticles] = useState([])
  const [statusMessage, setStatusMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [autoIndexEnabled, setAutoIndexEnabled] = useState(false)
  const [autoIndexLastStatus, setAutoIndexLastStatus] = useState(null)

  useEffect(() => {
    getAllArticles()
      .then(setArticles)
      .catch((error) => {
        console.log('Recall: failed to load articles', error)
      })

    getSiliconFlowApiKey()
      .then((apiKey) => {
        setHasApiKey(Boolean(apiKey))
      })
      .catch(() => {
        setHasApiKey(false)
      })

    getAutoIndexEnabled()
      .then(setAutoIndexEnabled)
      .catch(() => {
        setAutoIndexEnabled(false)
      })

    getAutoIndexLastStatus()
      .then(setAutoIndexLastStatus)
      .catch(() => {
        setAutoIndexLastStatus(null)
      })

    const storageChangeApi = globalThis.chrome?.storage?.onChanged
    const handleStorageChange = (changes, areaName) => {
      if (
        areaName === 'local' &&
        Object.prototype.hasOwnProperty.call(
          changes,
          AUTO_INDEX_ENABLED_STORAGE_KEY,
        )
      ) {
        setAutoIndexEnabled(
          changes[AUTO_INDEX_ENABLED_STORAGE_KEY].newValue === true,
        )
      }

      if (
        areaName === 'local' &&
        Object.prototype.hasOwnProperty.call(
          changes,
          AUTO_INDEX_LAST_STATUS_STORAGE_KEY,
        )
      ) {
        setAutoIndexLastStatus(
          normalizeAutoIndexLastStatus(
            changes[AUTO_INDEX_LAST_STATUS_STORAGE_KEY].newValue,
          ),
        )
      }
    }

    storageChangeApi?.addListener(handleStorageChange)

    return () => {
      storageChangeApi?.removeListener(handleStorageChange)
    }
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

      const apiKey = await getSiliconFlowApiKey().catch(() => '')
      let aiFields = {
        summary: '',
        tags: [],
        aiStatus: 'skipped',
        aiError: '',
      }
      let embeddingFields = {
        embedding: [],
        embeddingStatus: 'skipped',
        embeddingError: '',
        embeddingModel: '',
        embeddedAt: '',
      }

      if (apiKey) {
        try {
          const insights = await generateArticleInsights({
            apiKey,
            title: extractedArticle.title || tab.title || '无标题页面',
            url: tab.url,
            content: extractedArticle.content,
          })

          aiFields = {
            summary: insights.summary,
            tags: insights.tags,
            aiStatus: 'completed',
            aiError: '',
          }
        } catch (aiError) {
          aiFields = {
            summary: '',
            tags: [],
            aiStatus: 'failed',
            aiError: getFriendlyErrorMessage(aiError),
          }
        }

        try {
          const embeddingResult = await generateArticleEmbedding({
            apiKey,
            title: extractedArticle.title || tab.title || '无标题页面',
            summary: aiFields.summary,
            tags: aiFields.tags,
            excerpt: extractedArticle.excerpt,
            content: extractedArticle.content,
          })

          embeddingFields = {
            embedding: embeddingResult.embedding,
            embeddingStatus: 'completed',
            embeddingError: '',
            embeddingModel: embeddingResult.embeddingModel,
            embeddedAt: embeddingResult.embeddedAt,
          }
        } catch (embeddingError) {
          embeddingFields = {
            embedding: [],
            embeddingStatus: 'failed',
            embeddingError: getFriendlyErrorMessage(embeddingError),
            embeddingModel: '',
            embeddedAt: '',
          }
        }
      }

      await saveArticle({
        title: extractedArticle.title || tab.title || '无标题页面',
        url: tab.url,
        content: extractedArticle.content,
        excerpt: extractedArticle.excerpt,
        wordCount: extractedArticle.wordCount,
        source: 'manual',
        ...aiFields,
        ...embeddingFields,
      })

      setArticles(await getAllArticles())
      setHasApiKey(Boolean(apiKey))
      setStatusMessage(
        getSaveStatusMessage({
          hasApiKey: Boolean(apiKey),
          aiStatus: aiFields.aiStatus,
          embeddingStatus: embeddingFields.embeddingStatus,
        }),
      )
    } catch (error) {
      console.log('Recall: failed to save article', error)
      setStatusMessage('当前页面正文提取失败')
    } finally {
      setIsSaving(false)
    }
  }

  const handleClearClick = () => {
    if (!window.confirm('确定要清空全部收藏吗？此操作不可恢复。')) {
      return
    }

    clearArticles()
      .then(() => {
        setArticles([])
        setSearchResults((currentResults) => (currentResults ? [] : null))
        setStatusMessage('已清空收藏')
      })
      .catch((error) => {
        console.log('Recall: failed to clear articles', error)
        setStatusMessage('清空收藏失败')
      })
  }

  const handleSearchQueryChange = (event) => {
    const nextQuery = event.target.value

    setSearchQuery(nextQuery)

    if (!nextQuery.trim()) {
      setSearchResults(null)
      setStatusMessage('')
    }
  }

  const handleDeleteArticleClick = async (articleId) => {
    if (!window.confirm('确定删除这条收藏吗？')) {
      return
    }

    try {
      await deleteArticle(articleId)
      const nextArticles = await getAllArticles()

      setArticles(nextArticles)
      setSearchResults((currentResults) =>
        currentResults
          ? currentResults.filter((article) => article.id !== articleId)
          : null,
      )
      setStatusMessage('已删除收藏')
    } catch {
      setStatusMessage('删除收藏失败，请稍后重试')
    }
  }

  const handleSearchSubmit = async (event) => {
    event.preventDefault()

    const query = searchQuery.trim()

    if (!query) {
      handleClearSearchClick()
      return
    }

    if (articles.length === 0) {
      setSearchResults(null)
      setStatusMessage('暂无收藏')
      return
    }

    setIsSearching(true)
    setStatusMessage('')

    try {
      const apiKey = await getSiliconFlowApiKey().catch(() => '')

      setHasApiKey(Boolean(apiKey))

      if (!apiKey) {
        setSearchResults(null)
        setStatusMessage('请先配置 SiliconFlow API Key')
        return
      }

      const searchableArticles = articles.filter(
        (article) =>
          article.embeddingStatus === 'completed' &&
          Array.isArray(article.embedding) &&
          article.embedding.length > 0,
      )

      if (searchableArticles.length === 0) {
        setSearchResults([])
        setStatusMessage('暂无可搜索的向量')
        return
      }

      const queryEmbedding = await generateQueryEmbedding({ apiKey, query })
      const results = searchableArticles
        .map((article) => ({
          ...article,
          similarity: cosineSimilarity(queryEmbedding, article.embedding),
        }))
        .sort((articleA, articleB) => articleB.similarity - articleA.similarity)
        .slice(0, 5)

      setSearchResults(results)
      setStatusMessage(
        results.length > 0 ? `找到 ${results.length} 条相关收藏` : '暂无匹配结果',
      )
    } catch {
      setSearchResults([])
      setStatusMessage('搜索失败，请稍后重试')
    } finally {
      setIsSearching(false)
    }
  }

  const handleClearSearchClick = () => {
    setSearchQuery('')
    setSearchResults(null)
    setStatusMessage('')
  }

  const handleOpenSettingsClick = () => {
    const runtimeApi = globalThis.chrome?.runtime

    if (!runtimeApi?.openOptionsPage) {
      setStatusMessage('无法打开设置页')
      return
    }

    try {
      const openResult = runtimeApi.openOptionsPage()

      if (openResult?.catch) {
        openResult.catch(() => {
          setStatusMessage('无法打开设置页')
        })
      }
    } catch {
      setStatusMessage('无法打开设置页')
    }
  }

  const handleOpenArticleClick = (url) => {
    if (!isValidHttpUrl(url)) {
      setStatusMessage('无法打开原网页：URL 无效')
      return
    }

    const tabsApi = globalThis.chrome?.tabs

    if (!tabsApi?.create) {
      setStatusMessage('当前浏览器不支持打开新标签页')
      return
    }

    tabsApi.create({ url }, () => {
      const error = globalThis.chrome?.runtime?.lastError

      if (error) {
        setStatusMessage('打开原网页失败')
      }
    })
  }

  const isSearchMode = searchResults !== null
  const displayedArticles = isSearchMode ? searchResults : articles
  const articleCountLabel = `${articles.length} 篇`

  return (
    <main className="popup">
      <header className="popup-header">
        <div>
          <h1>Recall</h1>
          <p>本地收藏</p>
        </div>
        <div className="header-actions">
          <span className="article-count">{articleCountLabel}</span>
          <button
            type="button"
            className="settings-icon-button"
            aria-label="打开设置"
            title="打开设置"
            onClick={handleOpenSettingsClick}
          >
            ⚙
          </button>
        </div>
      </header>
      <p
        className={`auto-index-status ${
          autoIndexEnabled ? 'enabled' : 'disabled'
        }`}
      >
        自动索引：{autoIndexEnabled ? '已开启' : '已关闭'}
      </p>
      {autoIndexLastStatus ? (
        <div
          className={`auto-index-last-status ${autoIndexLastStatus.status}`}
          role="status"
        >
          <div>
            <span>
              最近自动索引：
              {getAutoIndexStatusLabel(autoIndexLastStatus.status)}
            </span>
            <span>{autoIndexLastStatus.reason}</span>
            <time dateTime={autoIndexLastStatus.time}>
              {formatAutoIndexStatusTime(autoIndexLastStatus.time)}
            </time>
          </div>
          {autoIndexLastStatus.url ? (
            <p>{autoIndexLastStatus.url}</p>
          ) : null}
        </div>
      ) : null}
      <form className="search-form" onSubmit={handleSearchSubmit}>
        <div className="search-input-wrap">
          <input
            type="search"
            value={searchQuery}
            onChange={handleSearchQueryChange}
            placeholder="用自然语言搜索收藏内容"
            aria-label="搜索收藏内容"
          />
          {searchQuery || searchResults !== null ? (
            <button
              type="button"
              className="search-clear-button"
              aria-label="清空搜索"
              title="清空搜索"
              onClick={handleClearSearchClick}
              disabled={isSearching}
            >
              ×
            </button>
          ) : null}
        </div>
      </form>
      <div className="actions">
        <button type="button" onClick={handleSaveClick} disabled={isSaving}>
          {isSaving ? '正在保存...' : '保存当前页面'}
        </button>
        <button
          type="button"
          className="danger-button"
          onClick={handleClearClick}
          disabled={articles.length === 0}
        >
          清空收藏
        </button>
      </div>
      {hasApiKey === false ? (
        <p className="api-key-notice">
          未配置 SiliconFlow API Key，后续 AI 功能不可用。
        </p>
      ) : null}
      {statusMessage ? (
        <p className="status-message" role="status">
          {statusMessage}
        </p>
      ) : null}
      <section className="favorites" aria-label="收藏列表">
        {displayedArticles.length > 0 ? (
          <div className="favorite-list">
            {displayedArticles.map((article) => (
              <article className="favorite-item" key={article.id}>
                <button
                  type="button"
                  className="delete-article-button"
                  aria-label="删除收藏"
                  title="删除收藏"
                  onClick={(event) => {
                    event.stopPropagation()
                    handleDeleteArticleClick(article.id)
                  }}
                >
                  ×
                </button>
                <button
                  type="button"
                  className="article-title-button"
                  onClick={() => handleOpenArticleClick(article.url)}
                >
                  {article.title}
                </button>
                <p className="article-url">{article.url}</p>
                {article.excerpt ? (
                  <p className="article-excerpt">{article.excerpt}</p>
                ) : null}
                {article.summary ? (
                  <p className="article-summary">{article.summary}</p>
                ) : null}
                {article.tags?.length > 0 ? (
                  <div className="tag-list" aria-label="标签">
                    {article.tags.map((tag) => (
                      <span className="tag" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                {article.aiStatus === 'failed' ? (
                  <p className="ai-status">AI 摘要生成失败</p>
                ) : null}
                {article.aiStatus === 'skipped' ? (
                  <p className="ai-status">
                    未配置 SiliconFlow API Key，已跳过 AI 生成
                  </p>
                ) : null}
                {article.embeddingStatus ? (
                  <p className="embedding-status">
                    {getEmbeddingStatusLabel(article.embeddingStatus)}
                  </p>
                ) : null}
                <div className="article-meta">
                  <span>{getArticleSourceLabel(article.source)}</span>
                  <time dateTime={article.createdAt}>
                    {new Date(article.createdAt).toLocaleString()}
                  </time>
                  {article.wordCount ? <span>{article.wordCount} 字</span> : null}
                  {typeof article.similarity === 'number' ? (
                    <span>相似度 {article.similarity.toFixed(2)}</span>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="placeholder">
            {isSearchMode ? '暂无匹配结果' : '暂无收藏'}
          </div>
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

function getFriendlyErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message.replace(/(?:sk|sf)-[A-Za-z0-9_-]+/g, '***').slice(0, 160)
  }

  return 'AI 摘要生成失败'
}

function isValidHttpUrl(url) {
  try {
    const parsedUrl = new URL(url)

    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  } catch {
    return false
  }
}

function getSaveStatusMessage({ hasApiKey, aiStatus, embeddingStatus }) {
  if (!hasApiKey) {
    return '已保存当前页面，未配置 SiliconFlow API Key，已跳过 AI 生成'
  }

  if (aiStatus === 'completed' && embeddingStatus === 'completed') {
    return '已保存当前页面，摘要和向量已生成'
  }

  if (aiStatus === 'completed' && embeddingStatus === 'failed') {
    return '已保存当前页面并生成摘要，但向量生成失败'
  }

  if (aiStatus === 'failed' && embeddingStatus === 'completed') {
    return '已保存当前页面，摘要生成失败，向量已生成'
  }

  return '已保存当前页面，但 AI 摘要或向量生成失败'
}

function getEmbeddingStatusLabel(status) {
  if (status === 'completed') {
    return '向量已生成'
  }

  if (status === 'failed') {
    return '向量失败'
  }

  return '向量跳过'
}

function getArticleSourceLabel(source) {
  return source === 'auto' ? '自动索引' : '手动收藏'
}

function getAutoIndexStatusLabel(status) {
  if (status === 'success') {
    return '成功'
  }

  if (status === 'failed') {
    return '失败'
  }

  return '跳过'
}

function formatAutoIndexStatusTime(time) {
  const timestamp = new Date(time)

  if (Number.isNaN(timestamp.getTime())) {
    return ''
  }

  return timestamp.toLocaleString()
}

function normalizeAutoIndexLastStatus(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof value.status !== 'string' ||
    typeof value.reason !== 'string' ||
    typeof value.url !== 'string' ||
    typeof value.time !== 'string'
  ) {
    return null
  }

  return value
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
)
