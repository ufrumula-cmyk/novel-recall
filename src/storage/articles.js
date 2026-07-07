import { openDB } from 'idb'

const DB_NAME = 'recall-db'
const DB_VERSION = 4
const STORE_NAME = 'articles'
const EXPORT_FIELDS = [
  'title',
  'url',
  'content',
  'excerpt',
  'wordCount',
  'summary',
  'tags',
  'embedding',
  'aiStatus',
  'embeddingStatus',
  'createdAt',
  'source',
  'autoCapturedAt',
  'embeddedAt',
  'embeddingModel',
]

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db, _oldVersion, _newVersion, transaction) {
    const store = db.objectStoreNames.contains(STORE_NAME)
      ? transaction.objectStore(STORE_NAME)
      : db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
        })

    if (!store.indexNames.contains('url')) {
      store.createIndex('url', 'url', { unique: true })
    }

    if (!store.indexNames.contains('createdAt')) {
      store.createIndex('createdAt', 'createdAt')
    }
  },
})

export async function getAllArticles() {
  const db = await dbPromise
  const articles = await db.getAllFromIndex(STORE_NAME, 'createdAt')

  return articles.reverse()
}

export async function getAllArticlesForExport() {
  const articles = await getAllArticles()

  return articles.map(toExportArticle)
}

export async function getArticleByUrl(url) {
  const db = await dbPromise

  return db.getFromIndex(STORE_NAME, 'url', url)
}

export async function saveArticle({
  title,
  url,
  content,
  excerpt,
  wordCount,
  summary = '',
  tags = [],
  aiStatus = 'skipped',
  aiError = '',
  embedding = [],
  embeddingStatus = 'skipped',
  embeddingError = '',
  embeddingModel = '',
  embeddedAt = '',
  source = 'manual',
  autoCapturedAt = '',
}) {
  const db = await dbPromise
  const existing = await db.getFromIndex(STORE_NAME, 'url', url)
  const createdAt = new Date().toISOString()
  const article = {
    ...existing,
    id: existing?.id || crypto.randomUUID(),
    title,
    url,
    content,
    excerpt,
    wordCount,
    summary,
    tags,
    aiStatus,
    aiError,
    embedding,
    embeddingStatus,
    embeddingError,
    embeddingModel,
    embeddedAt,
    source,
    autoCapturedAt:
      source === 'auto'
        ? autoCapturedAt || createdAt
        : existing?.autoCapturedAt || '',
    createdAt,
  }

  await db.put(STORE_NAME, article)

  return article
}

export async function clearArticles() {
  const db = await dbPromise

  await db.clear(STORE_NAME)
}

export async function deleteArticle(articleId) {
  const db = await dbPromise

  await db.delete(STORE_NAME, articleId)
}

export async function importArticles(importedArticles) {
  if (!Array.isArray(importedArticles)) {
    throw new Error('导入文件格式错误')
  }

  const db = await dbPromise
  let importedCount = 0
  let skippedCount = 0
  let failedCount = 0

  for (const rawArticle of importedArticles) {
    const article = normalizeImportedArticle(rawArticle)

    if (!article) {
      failedCount += 1
      continue
    }

    try {
      const existing = await db.getFromIndex(STORE_NAME, 'url', article.url)

      if (existing) {
        skippedCount += 1
        continue
      }

      await db.add(STORE_NAME, {
        ...article,
        id: crypto.randomUUID(),
      })
      importedCount += 1
    } catch {
      failedCount += 1
    }
  }

  return {
    importedCount,
    skippedCount,
    failedCount,
  }
}

function toExportArticle(article) {
  return EXPORT_FIELDS.reduce((exportedArticle, field) => {
    exportedArticle[field] = article[field] ?? getDefaultExportValue(field)

    return exportedArticle
  }, {})
}

function normalizeImportedArticle(article) {
  if (!article || typeof article !== 'object') {
    return null
  }

  const url = normalizeString(article.url)

  if (!isHttpUrl(url)) {
    return null
  }

  return {
    title: normalizeString(article.title) || '无标题页面',
    url,
    content: normalizeString(article.content),
    excerpt: normalizeString(article.excerpt),
    wordCount: normalizeNumber(article.wordCount),
    summary: normalizeString(article.summary),
    tags: Array.isArray(article.tags)
      ? article.tags
          .filter((tag) => typeof tag === 'string')
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [],
    embedding: Array.isArray(article.embedding)
      ? article.embedding
          .filter((item) => typeof item === 'number')
          .filter(Number.isFinite)
      : [],
    aiStatus: normalizeString(article.aiStatus) || 'skipped',
    embeddingStatus: normalizeString(article.embeddingStatus) || 'skipped',
    createdAt:
      normalizeDateString(article.createdAt) || new Date().toISOString(),
    source: article.source === 'auto' ? 'auto' : 'manual',
    autoCapturedAt: normalizeDateString(article.autoCapturedAt),
    embeddedAt: normalizeDateString(article.embeddedAt),
    embeddingModel: normalizeString(article.embeddingModel),
  }
}

function getDefaultExportValue(field) {
  if (field === 'tags' || field === 'embedding') {
    return []
  }

  if (field === 'wordCount') {
    return 0
  }

  if (field === 'source') {
    return 'manual'
  }

  return ''
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function normalizeDateString(value) {
  const text = normalizeString(value)

  if (!text) {
    return ''
  }

  const date = new Date(text)

  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function isHttpUrl(url) {
  try {
    const parsedUrl = new URL(url)

    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  } catch {
    return false
  }
}
