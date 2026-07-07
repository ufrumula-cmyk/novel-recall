import { openDB } from 'idb'

const DB_NAME = 'novel-recall-db'
const DB_VERSION = 1
const STORE_NAME = 'novels'
const TEXT_LIMITS = {
  id: 160,
  title: 240,
  author: 120,
  platform: 120,
  url: 1200,
  intro: 4000,
  category: 120,
  status: 80,
  wordCount: 80,
  updateTime: 120,
  summary: 4000,
}
const EXPORT_FIELDS = [
  'id',
  'title',
  'author',
  'platform',
  'url',
  'intro',
  'tags',
  'category',
  'status',
  'wordCount',
  'updateTime',
  'summary',
  'plotKeywords',
  'characterTags',
  'genreTags',
  'embedding',
  'source',
  'createdAt',
  'updatedAt',
]
const VALID_SOURCES = new Set(['import', 'manual', 'web'])

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    const store = db.createObjectStore(STORE_NAME, {
      keyPath: 'id',
    })

    store.createIndex('title', 'title')
    store.createIndex('author', 'author')
    store.createIndex('url', 'url')
    store.createIndex('createdAt', 'createdAt')
    store.createIndex('updatedAt', 'updatedAt')
  },
})

export async function getAllNovels() {
  const db = await dbPromise
  const novels = await db.getAllFromIndex(STORE_NAME, 'updatedAt')

  return novels.reverse()
}

export async function getAllNovelsForExport() {
  const novels = await getAllNovels()

  return novels.map(toExportNovel)
}

export async function saveNovel(rawNovel) {
  const db = await dbPromise
  const existing = rawNovel?.id ? await db.get(STORE_NAME, rawNovel.id) : null
  const normalizedNovel = normalizeNovel(rawNovel, {
    defaultSource: rawNovel?.source || 'manual',
    existingNovel: existing,
  })

  if (!normalizedNovel) {
    throw new Error('小说数据格式错误')
  }

  await db.put(STORE_NAME, normalizedNovel)

  return normalizedNovel
}

export async function updateNovelAnalysis(novelId, analysis) {
  const db = await dbPromise
  const existingNovel = await db.get(STORE_NAME, novelId)

  if (!existingNovel) {
    throw new Error('小说不存在')
  }

  const updatedNovel = removeEmptyFields({
    ...existingNovel,
    summary: normalizeString(analysis.summary, TEXT_LIMITS.summary),
    plotKeywords: normalizeStringArray(analysis.plotKeywords),
    characterTags: normalizeStringArray(analysis.characterTags),
    genreTags: normalizeStringArray(analysis.genreTags),
    updatedAt: Date.now(),
  })

  await db.put(STORE_NAME, updatedNovel)

  return updatedNovel
}

export async function importNovels(payload) {
  const rawNovels = getNovelArrayFromPayload(payload)
  const db = await dbPromise
  let importedCount = 0
  let skippedCount = 0
  let failedCount = 0

  for (const rawNovel of rawNovels) {
    const normalizedNovel = normalizeNovel(rawNovel, {
      defaultSource: 'import',
    })

    if (!normalizedNovel) {
      failedCount += 1
      continue
    }

    try {
      if (await hasDuplicateNovel(db, normalizedNovel)) {
        skippedCount += 1
        continue
      }

      await db.add(STORE_NAME, normalizedNovel)
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

export async function deleteNovel(novelId) {
  const db = await dbPromise

  await db.delete(STORE_NAME, novelId)
}

export async function clearNovels() {
  const db = await dbPromise

  await db.clear(STORE_NAME)
}

function getNovelArrayFromPayload(payload) {
  if (Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray(payload?.novels)) {
    return payload.novels
  }

  throw new Error('导入文件必须是 NovelItem 数组或包含 novels 数组的对象')
}

function normalizeNovel(rawNovel, { defaultSource, existingNovel } = {}) {
  if (!rawNovel || typeof rawNovel !== 'object') {
    return null
  }

  const now = Date.now()
  const title = normalizeString(rawNovel.title, TEXT_LIMITS.title)
  const intro = normalizeString(rawNovel.intro, TEXT_LIMITS.intro)

  if (!title || !intro) {
    return null
  }

  const createdAt =
    normalizeTimestamp(rawNovel.createdAt) || existingNovel?.createdAt || now
  const updatedAt = normalizeTimestamp(rawNovel.updatedAt) || now
  const source = normalizeSource(rawNovel.source, defaultSource)

  return removeEmptyFields({
    id:
      normalizeString(rawNovel.id, TEXT_LIMITS.id) ||
      createImportedNovelId(rawNovel),
    title,
    author: normalizeString(rawNovel.author, TEXT_LIMITS.author),
    platform: normalizeString(rawNovel.platform, TEXT_LIMITS.platform),
    url: normalizeUrl(rawNovel.url),
    intro,
    tags: normalizeStringArray(rawNovel.tags),
    category: normalizeString(rawNovel.category, TEXT_LIMITS.category),
    status: normalizeString(rawNovel.status, TEXT_LIMITS.status),
    wordCount: normalizeString(rawNovel.wordCount, TEXT_LIMITS.wordCount),
    updateTime: normalizeString(rawNovel.updateTime, TEXT_LIMITS.updateTime),
    summary: normalizeString(rawNovel.summary, TEXT_LIMITS.summary),
    plotKeywords: normalizeStringArray(rawNovel.plotKeywords),
    characterTags: normalizeStringArray(rawNovel.characterTags),
    genreTags: normalizeStringArray(rawNovel.genreTags),
    embedding: normalizeEmbedding(rawNovel.embedding),
    source,
    createdAt,
    updatedAt,
  })
}

async function hasDuplicateNovel(db, novel) {
  const existingById = await db.get(STORE_NAME, novel.id)

  if (existingById) {
    return true
  }

  if (novel.url) {
    const matchesByUrl = await db.getAllFromIndex(STORE_NAME, 'url', novel.url)

    if (matchesByUrl.length > 0) {
      return true
    }
  }

  const allNovels = await db.getAll(STORE_NAME)
  const novelKey = getNovelIdentityKey(novel)

  return allNovels.some((existingNovel) => {
    if (novel.url || existingNovel.url) {
      return false
    }

    return getNovelIdentityKey(existingNovel) === novelKey
  })
}

function getNovelIdentityKey(novel) {
  return [novel.title, novel.author || '']
    .map((value) => value.trim().toLocaleLowerCase())
    .join('\n')
}

function toExportNovel(novel) {
  return EXPORT_FIELDS.reduce((exportedNovel, field) => {
    if (Object.prototype.hasOwnProperty.call(novel, field)) {
      exportedNovel[field] = novel[field]
    }

    return exportedNovel
  }, {})
}

function removeEmptyFields(novel) {
  return Object.fromEntries(
    Object.entries(novel).filter(([_key, value]) => {
      if (value === '') {
        return false
      }

      if (Array.isArray(value) && value.length === 0) {
        return false
      }

      return value !== undefined && value !== null
    }),
  )
}

function normalizeString(value, maxLength = 240) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return ''
  }

  return String(value).trim().slice(0, maxLength)
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return [
    ...new Set(
      value
        .filter((item) => typeof item === 'string' || typeof item === 'number')
        .map((item) => String(item).trim())
        .filter(Boolean)
        .slice(0, 80),
    ),
  ]
}

function normalizeEmbedding(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item) => typeof item === 'number' && Number.isFinite(item))
}

function normalizeSource(value, fallback = 'import') {
  const source = normalizeString(value, 20)

  if (VALID_SOURCES.has(source)) {
    return source
  }

  return VALID_SOURCES.has(fallback) ? fallback : 'import'
}

function normalizeTimestamp(value) {
  if (Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }

  if (typeof value === 'string' && value.trim()) {
    const timestamp = new Date(value).getTime()

    return Number.isNaN(timestamp) ? 0 : timestamp
  }

  return 0
}

function normalizeUrl(value) {
  const url = normalizeString(value, TEXT_LIMITS.url)

  if (!url) {
    return ''
  }

  try {
    const parsedUrl = new URL(url)

    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
      ? parsedUrl.toString()
      : ''
  } catch {
    return ''
  }
}

function createImportedNovelId(rawNovel) {
  const sourceText = [
    rawNovel.title,
    rawNovel.author,
    rawNovel.platform,
    rawNovel.url,
  ]
    .filter((value) => typeof value === 'string' || typeof value === 'number')
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join('|')

  if (!sourceText) {
    return crypto.randomUUID()
  }

  return `novel-${hashText(sourceText)}`
}

function hashText(text) {
  let hash = 2166136261

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(36)
}
