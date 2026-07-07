const CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4o-mini'
const MAX_CONTENT_LENGTH = 7000

export async function generateArticleInsights({ apiKey, title, url, content }) {
  const response = await fetch(CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            '你是一个网页阅读助手。只返回严格 JSON，不要返回 Markdown 或额外解释。',
        },
        {
          role: 'user',
          content: buildPrompt({ title, url, content }),
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(await getOpenAIErrorMessage(response))
  }

  const data = await response.json()
  const rawContent = data.choices?.[0]?.message?.content

  if (!rawContent) {
    throw new Error('OpenAI 未返回内容')
  }

  return parseInsights(rawContent)
}

function buildPrompt({ title, url, content }) {
  return [
    '请根据下面网页正文生成中文摘要和标签。',
    '',
    '要求：',
    '1. summary 为 100 到 200 字中文摘要。',
    '2. tags 为 3 到 6 个中文标签。',
    '3. 只返回 JSON：{"summary":"...","tags":["..."]}',
    '',
    `标题：${title}`,
    `URL：${url}`,
    '',
    `正文：${content.slice(0, MAX_CONTENT_LENGTH)}`,
  ].join('\n')
}

function parseInsights(rawContent) {
  try {
    const parsed = JSON.parse(rawContent)
    const summary =
      typeof parsed.summary === 'string' ? parsed.summary.trim() : ''
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags
          .filter((tag) => typeof tag === 'string')
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 6)
      : []

    if (!summary || tags.length < 3) {
      throw new Error('OpenAI JSON 内容不完整')
    }

    return {
      summary,
      tags,
    }
  } catch {
    throw new Error('OpenAI 返回格式解析失败')
  }
}

async function getOpenAIErrorMessage(response) {
  try {
    const data = await response.json()
    const message = data.error?.message

    if (typeof message === 'string' && message.trim()) {
      return sanitizeError(shortenError(message))
    }
  } catch {
    // Fall through to the generic HTTP message below.
  }

  return `OpenAI 请求失败 (${response.status})`
}

function shortenError(message) {
  return message.trim().slice(0, 120)
}

function sanitizeError(message) {
  return message.replace(/sk-[A-Za-z0-9_-]+/g, 'sk-***')
}
