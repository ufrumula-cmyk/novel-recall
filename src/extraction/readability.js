import { Readability } from '@mozilla/readability'

const EXCERPT_LENGTH = 180
const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:'])

function capturePageSnapshot() {
  return {
    html: document.documentElement.outerHTML,
    title: document.title,
    url: window.location.href,
  }
}

export function canExtractFromUrl(url) {
  try {
    return SUPPORTED_PROTOCOLS.has(new URL(url).protocol)
  } catch {
    return false
  }
}

export async function extractReadableContentFromTab(tabId, pageUrl) {
  const scriptingApi = globalThis.chrome?.scripting

  if (!scriptingApi) {
    throw new Error('Chrome scripting API is unavailable')
  }

  const [injectionResult] = await scriptingApi.executeScript({
    target: { tabId },
    func: capturePageSnapshot,
  })

  const snapshot = injectionResult?.result

  if (!snapshot?.html) {
    return null
  }

  const parsedDocument = new DOMParser().parseFromString(
    snapshot.html,
    'text/html',
  )

  const baseElement = parsedDocument.createElement('base')
  baseElement.href = pageUrl || snapshot.url
  parsedDocument.head?.prepend(baseElement)

  return extractReadableContentFromDocument(
    parsedDocument,
    pageUrl || snapshot.url,
    snapshot.title,
  )
}

export function extractReadableContentFromDocument(
  pageDocument,
  pageUrl,
  pageTitle,
) {
  const parsedDocument = pageDocument.cloneNode(true)
  const existingBaseElement = parsedDocument.querySelector('base')
  const baseElement = existingBaseElement || parsedDocument.createElement('base')
  baseElement.href = pageUrl

  if (!existingBaseElement) {
    parsedDocument.head?.prepend(baseElement)
  }

  const parsedArticle = new Readability(parsedDocument).parse()
  const content = normalizeText(parsedArticle?.textContent)

  if (!content) {
    return null
  }

  return {
    title: parsedArticle?.title || pageTitle,
    url: pageUrl,
    content,
    excerpt: createExcerpt(content),
    wordCount: countWords(content),
  }
}

function normalizeText(text = '') {
  return text.replace(/\s+/g, ' ').trim()
}

function createExcerpt(content) {
  const characters = Array.from(content)

  if (characters.length <= EXCERPT_LENGTH) {
    return content
  }

  return `${characters.slice(0, EXCERPT_LENGTH).join('')}...`
}

function countWords(content) {
  const cjkCharacters = content.match(/[\u3400-\u9fff]/g) || []
  const latinWords =
    content
      .replace(/[\u3400-\u9fff]/g, ' ')
      .match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g) || []

  return cjkCharacters.length + latinWords.length
}
