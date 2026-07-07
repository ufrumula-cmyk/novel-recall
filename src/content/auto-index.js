import {
  AUTO_INDEX_DELAY_MS,
  MIN_AUTO_INDEX_WORD_COUNT,
  hasSensitiveForm,
} from '../auto-index/rules'
import { AUTO_INDEX_ARTICLE_MESSAGE } from '../auto-index/messages'
import {
  AUTO_INDEX_REASON,
  AUTO_INDEX_STATUS,
  getPageSkipReason,
} from '../auto-index/status'
import { extractConservativeContentFromDocument } from '../auto-index/extract'
import {
  getAutoIndexEnabled,
  saveAutoIndexLastStatus,
} from '../storage/settings'

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
  const enabled = await getAutoIndexEnabled().catch(() => false)

  if (!enabled) {
    recordAutoIndexStatus({
      status: AUTO_INDEX_STATUS.SKIPPED,
      reason: AUTO_INDEX_REASON.DISABLED,
    })
    return
  }

  const pageSkipReason = getPageSkipReason({
    url: window.location.href,
    title: document.title,
    hasSensitiveForm: hasSensitiveForm(document),
  })

  if (pageSkipReason) {
    recordAutoIndexStatus({
      status: AUTO_INDEX_STATUS.SKIPPED,
      reason: pageSkipReason,
    })
    return
  }

  autoIndexTimer = window.setTimeout(captureCurrentPage, AUTO_INDEX_DELAY_MS)
}

async function captureCurrentPage() {
  const enabled = await getAutoIndexEnabled().catch(() => false)

  if (!enabled) {
    recordAutoIndexStatus({
      status: AUTO_INDEX_STATUS.SKIPPED,
      reason: AUTO_INDEX_REASON.DISABLED,
    })
    return
  }

  if (document.visibilityState === 'hidden') {
    recordAutoIndexStatus({
      status: AUTO_INDEX_STATUS.SKIPPED,
      reason: AUTO_INDEX_REASON.HIDDEN_PAGE,
    })
    return
  }

  const pageSkipReason = getPageSkipReason({
    url: window.location.href,
    title: document.title,
    hasSensitiveForm: hasSensitiveForm(document),
  })

  if (pageSkipReason) {
    recordAutoIndexStatus({
      status: AUTO_INDEX_STATUS.SKIPPED,
      reason: pageSkipReason,
    })
    return
  }

  const article = extractConservativeContentFromDocument(
    document,
    window.location.href,
    document.title,
  )

  if (!article) {
    recordAutoIndexStatus({
      status: AUTO_INDEX_STATUS.SKIPPED,
      reason: AUTO_INDEX_REASON.EXTRACTION_FAILED,
    })
    return
  }

  if (article.wordCount < MIN_AUTO_INDEX_WORD_COUNT) {
    recordAutoIndexStatus({
      status: AUTO_INDEX_STATUS.SKIPPED,
      reason: AUTO_INDEX_REASON.SHORT_CONTENT,
    })
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
  }).catch(() => {
    recordAutoIndexStatus({
      status: AUTO_INDEX_STATUS.FAILED,
      reason: AUTO_INDEX_REASON.BACKGROUND_UNAVAILABLE,
    })
  })
}

function recordAutoIndexStatus({ status, reason }) {
  saveAutoIndexLastStatus({
    status,
    reason,
    url: window.location.href,
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
