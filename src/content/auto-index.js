import {
  AUTO_INDEX_DELAY_MS,
  MIN_AUTO_INDEX_WORD_COUNT,
  canAutoIndexPage,
  hasSensitiveForm,
} from '../auto-index/rules'
import { AUTO_INDEX_ARTICLE_MESSAGE } from '../auto-index/messages'
import { extractReadableContentFromDocument } from '../extraction/readability'
import { getAutoIndexEnabled } from '../storage/settings'

let autoIndexTimer = null

startAutoIndexTimer()

window.addEventListener(
  'pagehide',
  () => {
    if (autoIndexTimer) {
      window.clearTimeout(autoIndexTimer)
    }
  },
  { once: true },
)

async function startAutoIndexTimer() {
  if (!canAutoIndexPage(window.location.href, document.title)) {
    return
  }

  if (hasSensitiveForm(document)) {
    return
  }

  const enabled = await getAutoIndexEnabled().catch(() => false)

  if (!enabled) {
    return
  }

  autoIndexTimer = window.setTimeout(captureCurrentPage, AUTO_INDEX_DELAY_MS)
}

async function captureCurrentPage() {
  const enabled = await getAutoIndexEnabled().catch(() => false)

  if (!enabled || document.visibilityState === 'hidden') {
    return
  }

  if (
    !canAutoIndexPage(window.location.href, document.title) ||
    hasSensitiveForm(document)
  ) {
    return
  }

  const article = extractReadableContentFromDocument(
    document,
    window.location.href,
    document.title,
  )

  if (!article || article.wordCount < MIN_AUTO_INDEX_WORD_COUNT) {
    return
  }

  await sendRuntimeMessage({
    type: AUTO_INDEX_ARTICLE_MESSAGE,
    article: {
      title: article.title || document.title || '无标题页面',
      url: window.location.href,
      content: article.content,
      excerpt: article.excerpt,
      wordCount: article.wordCount,
    },
  }).catch(() => {})
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    const runtimeApi = globalThis.chrome?.runtime

    if (!runtimeApi?.sendMessage) {
      reject(new Error('Chrome runtime API is unavailable'))
      return
    }

    runtimeApi.sendMessage(message, (response) => {
      const error = globalThis.chrome?.runtime?.lastError

      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(response)
    })
  })
}
