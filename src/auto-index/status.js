import { canAutoIndexPage } from './rules'

export const AUTO_INDEX_STATUS = {
  SUCCESS: 'success',
  SKIPPED: 'skipped',
  FAILED: 'failed',
}

export const AUTO_INDEX_REASON = {
  DISABLED: '自动索引关闭',
  NON_HTTP: '非 http/https 页面',
  SENSITIVE: '敏感页面',
  SHORT_CONTENT: '正文过短',
  DUPLICATE_URL: 'URL 已保存',
  HIDDEN_PAGE: '页面不可见',
  EXTRACTION_FAILED: '正文抽取失败',
  SAVED: '已自动保存',
  BACKGROUND_UNAVAILABLE: '后台通信失败',
  INVALID_ARTICLE: '正文抽取失败',
  SAVE_FAILED: '自动保存失败',
}

export function getPageSkipReason({ url, title = '', hasSensitiveForm = false }) {
  if (!isHttpOrHttpsUrl(url)) {
    return AUTO_INDEX_REASON.NON_HTTP
  }

  if (!canAutoIndexPage(url, title) || hasSensitiveForm) {
    return AUTO_INDEX_REASON.SENSITIVE
  }

  return ''
}

function isHttpOrHttpsUrl(url) {
  try {
    const parsedUrl = new URL(url)

    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  } catch {
    return false
  }
}
