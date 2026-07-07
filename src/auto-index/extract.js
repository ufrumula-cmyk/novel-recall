import { MIN_AUTO_INDEX_WORD_COUNT } from './rules'

const EXCERPT_LENGTH = 180
const CONTENT_SELECTORS = ['article', 'main', '[role="main"]', 'body']

export function extractConservativeContentFromDocument(
  pageDocument,
  pageUrl,
  pageTitle,
) {
  const candidates = CONTENT_SELECTORS.flatMap((selector, selectorIndex) =>
    Array.from(pageDocument.querySelectorAll(selector)).map((element) =>
      createCandidate(element, selectorIndex),
    ),
  ).filter((candidate) => candidate.content)

  const bestCandidate =
    candidates.find(
      (candidate) => candidate.wordCount >= MIN_AUTO_INDEX_WORD_COUNT,
    ) || [...candidates].sort(compareCandidates)[0]

  if (!bestCandidate) {
    return null
  }

  return {
    title: pageTitle,
    url: pageUrl,
    content: bestCandidate.content,
    excerpt: createExcerpt(bestCandidate.content),
    wordCount: countWords(bestCandidate.content),
  }
}

function createCandidate(element, selectorIndex) {
  const content = normalizeText(element.innerText || element.textContent || '')
  const wordCount = countWords(content)

  return {
    content,
    selectorIndex,
    wordCount,
  }
}

function compareCandidates(candidateA, candidateB) {
  if (candidateA.wordCount !== candidateB.wordCount) {
    return candidateB.wordCount - candidateA.wordCount
  }

  return candidateA.selectorIndex - candidateB.selectorIndex
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
