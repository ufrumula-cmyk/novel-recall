import { openDB } from 'idb'

const DB_NAME = 'recall-db'
const DB_VERSION = 2
const STORE_NAME = 'articles'

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

export async function saveArticle({ title, url, content, excerpt, wordCount }) {
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
    createdAt,
  }

  await db.put(STORE_NAME, article)

  return article
}

export async function clearArticles() {
  const db = await dbPromise

  await db.clear(STORE_NAME)
}
