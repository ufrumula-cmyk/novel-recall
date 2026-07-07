const CHAT_COMPLETIONS_URL = 'https://api.siliconflow.cn/v1/chat/completions'
const EMBEDDINGS_URL = 'https://api.siliconflow.cn/v1/embeddings'
const CHAT_MODEL = 'deepseek-ai/DeepSeek-V3'
const EMBEDDING_MODEL = 'BAAI/bge-m3'
const MAX_INTRO_LENGTH = 3000
const MAX_EMBEDDING_INPUT_LENGTH = 7000

export async function generateNovelAnalysis({ apiKey, novel }) {
  const response = await fetch(CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            '你是小说资料分析助手。只根据用户提供的小说元数据生成结构化中文信息。只返回严格 JSON，不要返回 Markdown 或额外解释。',
        },
        {
          role: 'user',
          content: buildNovelAnalysisPrompt(novel),
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(await getSiliconFlowErrorMessage(response))
  }

  const data = await response.json()
  const rawContent = data.choices?.[0]?.message?.content

  if (typeof rawContent !== 'string' || !rawContent.trim()) {
    throw new Error('SiliconFlow 未返回分析内容')
  }

  return parseNovelAnalysis(rawContent)
}

export async function generateEmbedding({ apiKey, text }) {
  const input = cleanText(text).slice(0, MAX_EMBEDDING_INPUT_LENGTH)

  if (!input) {
    throw new Error('向量文本为空')
  }

  const response = await fetch(EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input,
    }),
  })

  if (!response.ok) {
    throw new Error(await getSiliconFlowErrorMessage(response))
  }

  const data = await response.json()
  const embedding = data.data?.[0]?.embedding

  if (!isNumberArray(embedding)) {
    throw new Error('SiliconFlow 未返回有效向量')
  }

  return embedding
}

function buildNovelAnalysisPrompt(novel) {
  return [
    '请根据下面的小说元数据生成结构化信息。',
    '',
    '要求：',
    '1. 只返回严格 JSON，不要返回 Markdown。',
    '2. summary 是不超过 80 字的小说简介总结。',
    '3. plotKeywords 是 3 到 8 个中文剧情关键词。',
    '4. characterTags 是 2 到 6 个中文人设标签。',
    '5. genreTags 是 2 到 6 个中文题材标签。',
    '6. 只能基于给出的标题、作者、分类、标签和简介判断，不要编造未提供的正文情节。',
    '7. JSON 格式必须是 {"summary":"...","plotKeywords":["..."],"characterTags":["..."],"genreTags":["..."]}',
    '',
    `标题：${cleanText(novel.title)}`,
    `作者：${cleanText(novel.author) || '未知'}`,
    `分类：${cleanText(novel.category) || '未分类'}`,
    `状态：${cleanText(novel.status) || '未知'}`,
    `原标签：${normalizeArray(novel.tags).join('，') || '无'}`,
    `简介：${cleanText(novel.intro).slice(0, MAX_INTRO_LENGTH)}`,
  ].join('\n')
}

function parseNovelAnalysis(rawContent) {
  const parsed = parseJsonObject(rawContent)
  const summary = cleanText(parsed.summary).slice(0, 80)
  const plotKeywords = normalizeArray(parsed.plotKeywords).slice(0, 8)
  const characterTags = normalizeArray(parsed.characterTags).slice(0, 6)
  const genreTags = normalizeArray(parsed.genreTags).slice(0, 6)

  if (
    !summary ||
    plotKeywords.length === 0 ||
    characterTags.length === 0 ||
    genreTags.length === 0
  ) {
    throw new Error('SiliconFlow 返回的 JSON 字段不完整')
  }

  return {
    summary,
    plotKeywords,
    characterTags,
    genreTags,
  }
}

function parseJsonObject(rawContent) {
  try {
    return JSON.parse(rawContent)
  } catch {
    const jsonStart = rawContent.indexOf('{')
    const jsonEnd = rawContent.lastIndexOf('}')

    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      throw new Error('SiliconFlow 返回格式解析失败')
    }

    try {
      return JSON.parse(rawContent.slice(jsonStart, jsonEnd + 1))
    } catch {
      throw new Error('SiliconFlow 返回格式解析失败')
    }
  }
}

function normalizeArray(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return [
    ...new Set(
      value
        .filter((item) => typeof item === 'string' || typeof item === 'number')
        .map((item) => String(item).trim())
        .filter(Boolean),
    ),
  ]
}

function isNumberArray(value) {
  return Array.isArray(value) && value.every((item) => Number.isFinite(item))
}

async function getSiliconFlowErrorMessage(response) {
  try {
    const data = await response.json()
    const message = data.error?.message || data.message

    if (typeof message === 'string' && message.trim()) {
      return sanitizeError(message.trim().slice(0, 160))
    }
  } catch {
    // Fall through to the generic HTTP message below.
  }

  return `SiliconFlow 请求失败 (${response.status})`
}

function cleanText(value) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return ''
  }

  return String(value).trim()
}

function sanitizeError(message) {
  return message.replace(/(?:sk|sf)-[A-Za-z0-9_-]+/g, '***')
}
