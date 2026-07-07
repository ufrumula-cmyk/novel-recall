import {
  generateArticleEmbedding,
  generateArticleInsights,
} from '../ai/siliconflow'
import { AUTO_INDEX_ARTICLE_MESSAGE } from '../auto-index/messages'
import {
  MIN_AUTO_INDEX_WORD_COUNT,
} from '../auto-index/rules'
import {
  AUTO_INDEX_REASON,
  AUTO_INDEX_STATUS,
  getPageSkipReason,
} from '../auto-index/status'
import { getArticleByUrl, saveArticle } from '../storage/articles'
import {
  getAutoIndexEnabled,
  getSiliconFlowApiKey,
  saveAutoIndexLastStatus,
} from '../storage/settings'

globalThis.chrome?.runtime?.onMessage.addListener(
  (message, _sender, sendResponse) => {
    if (message?.type !== AUTO_INDEX_ARTICLE_MESSAGE) {
      return false
    }

    handleAutoIndexArticle(message.article)
      .then((result) => {
        sendResponse(result)
      })
      .catch(async (error) => {
        const reason = getFriendlyErrorMessage(error)

        await recordAutoIndexStatus({
          status: AUTO_INDEX_STATUS.FAILED,
          reason,
          url: getRawArticleUrl(message.article),
        })
        sendResponse({
          ok: false,
          status: 'failed',
          reason,
        })
      })

    return true
  },
)

async function handleAutoIndexArticle(rawArticle) {
  const enabled = await getAutoIndexEnabled().catch(() => false)

  if (!enabled) {
    return finishAutoIndexStatus({
      status: AUTO_INDEX_STATUS.SKIPPED,
      reason: AUTO_INDEX_REASON.DISABLED,
      url: getRawArticleUrl(rawArticle),
    })
  }

  const article = normalizeAutoArticle(rawArticle)

  if (!article) {
    return finishAutoIndexStatus({
      status: AUTO_INDEX_STATUS.SKIPPED,
      reason: AUTO_INDEX_REASON.INVALID_ARTICLE,
      url: getRawArticleUrl(rawArticle),
    })
  }

  const pageSkipReason = getPageSkipReason({
    url: article.url,
    title: article.title,
  })

  if (pageSkipReason) {
    return finishAutoIndexStatus({
      status: AUTO_INDEX_STATUS.SKIPPED,
      reason: pageSkipReason,
      url: article.url,
    })
  }

  if (article.wordCount < MIN_AUTO_INDEX_WORD_COUNT) {
    return finishAutoIndexStatus({
      status: AUTO_INDEX_STATUS.SKIPPED,
      reason: AUTO_INDEX_REASON.SHORT_CONTENT,
      url: article.url,
    })
  }

  const existingArticle = await getArticleByUrl(article.url)

  if (existingArticle) {
    return finishAutoIndexStatus({
      status: AUTO_INDEX_STATUS.SKIPPED,
      reason: AUTO_INDEX_REASON.DUPLICATE_URL,
      url: article.url,
    })
  }

  const apiKey = await getSiliconFlowApiKey().catch(() => '')
  const autoCapturedAt = new Date().toISOString()
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
        title: article.title,
        url: article.url,
        content: article.content,
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
        title: article.title,
        summary: aiFields.summary,
        tags: aiFields.tags,
        excerpt: article.excerpt,
        content: article.content,
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

  const savedArticle = await saveArticle({
    ...article,
    ...aiFields,
    ...embeddingFields,
    source: 'auto',
    autoCapturedAt,
  })

  const result = await finishAutoIndexStatus({
    status: AUTO_INDEX_STATUS.SUCCESS,
    reason: AUTO_INDEX_REASON.SAVED,
    url: article.url,
  })

  return {
    ...result,
    articleId: savedArticle.id,
  }
}

function normalizeAutoArticle(article) {
  if (!article || typeof article !== 'object') {
    return null
  }

  const title = cleanText(article.title) || '无标题页面'
  const url = cleanText(article.url)
  const content = cleanText(article.content)
  const excerpt = cleanText(article.excerpt)
  const wordCount = Number(article.wordCount)

  if (!url || !content || !Number.isFinite(wordCount)) {
    return null
  }

  return {
    title,
    url,
    content,
    excerpt,
    wordCount,
  }
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function getRawArticleUrl(article) {
  return article && typeof article.url === 'string' ? article.url : ''
}

async function finishAutoIndexStatus({ status, reason, url }) {
  await recordAutoIndexStatus({ status, reason, url })

  return {
    ok: status !== AUTO_INDEX_STATUS.FAILED,
    status,
    reason,
  }
}

async function recordAutoIndexStatus({ status, reason, url }) {
  await saveAutoIndexLastStatus({
    status,
    reason,
    url,
  }).catch(() => {})
}

function getFriendlyErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message
      .replace(/(?:sk|sf)-[A-Za-z0-9_-]+/g, '***')
      .slice(0, 160)
  }

  return '自动索引失败'
}
