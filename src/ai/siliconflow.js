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

export async function generateNovelCandidates({ apiKey, query }) {
  const description = cleanText(query).slice(0, MAX_INTRO_LENGTH)

  if (!description) {
    throw new Error('请输入剧情描述')
  }

  const response = await fetch(CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content:
            '你是小说猜书助手。你不能联网搜索，不能访问任何小说平台，不能把候选当成已验证事实。信息不足时必须追问，不能硬猜。只返回严格 JSON 对象，不要返回 Markdown 或额外解释。',
        },
        {
          role: 'user',
          content: buildNovelCandidatePrompt(description),
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
    throw new Error('AI 返回格式异常，请重试')
  }

  return parseNovelCandidates(rawContent)
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

function buildNovelCandidatePrompt(description) {
  return [
    '请根据用户记得的剧情描述，判断是否能生成可靠的“可能小说候选”。',
    '',
    '返回格式必须是严格 JSON 对象，包含 status、message、followUpQuestions、candidates。',
    '每个 candidate 必须包含 title、author、reason、matchedElements、confidence。',
    '',
    'status 只能是 candidates 或 need_more_info。',
    '',
    '判断规则：',
    '1. 如果用户描述过短、无意义、太泛、缺少关键剧情元素，返回 status: "need_more_info"。',
    '2. 至少需要 3 个以上较具体元素，才允许返回 candidates。例如：题材、时代背景、人物关系、身份设定、核心事件、结局印象、平台、主角名、特殊道具等。',
    '3. 如果输入虽然常见，但包含 3 个以上具体元素，例如“重生、高中、同桌、前世、暗恋、校园”，必须返回 status: "candidates"，可以使用 low 或 medium 置信度。',
    '4. 对“女主重生了，暗恋男主”这种只有极泛元素、缺少时代背景/地点/身份/关键事件的描述，必须返回 need_more_info，并追问：',
    '   - 是现代、古代、校园、娱乐圈还是玄幻？',
    '   - 还记得主角身份或职业吗？',
    '   - 还记得一个关键剧情或反派设定吗？',
    '5. 不要生成“未知小说1”“未知小说2”“未知小说3”“可能的书名”“候选小说”这类占位标题。',
    '6. 不要编造看起来像真实书名但没有把握的候选。',
    '7. 如果不能确定真实作品，但用户输入已有 3 个以上具体元素，可以返回低置信度候选，但 reason 必须包含“该候选基于题材元素推测，需用户自行核验。”',
    '8. 所有 candidates 都必须包含 title、author、reason、matchedElements、confidence。',
    '9. matchedElements 必须来自用户输入中的关键元素，例如：重生、高中、同桌、前世、暗恋、校园、甜文。',
    '10. candidates 最多返回 5 个；confidence 只能是 low、medium 或 high。',
    '',
    '安全边界：',
    '1. 你不能联网搜索，不能访问晋江、番茄、起点或任何小说平台。',
    '2. 不要提供链接，不要编造来源，不要声称候选已经核验。',
    '3. 候选只是 AI 推测，允许作者未知。',
    '4. 只返回严格 JSON 对象，不要返回 Markdown。',
    '',
    `剧情描述：${description}`,
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

function parseNovelCandidates(rawContent) {
  let parsed

  try {
    parsed = parseJsonObject(rawContent)
  } catch {
    throw new Error('AI 返回格式异常，请重试')
  }

  const status =
    parsed.status === 'candidates' || parsed.status === 'need_more_info'
      ? parsed.status
      : 'need_more_info'
  const message =
    cleanText(parsed.message).slice(0, 160) ||
    (status === 'candidates'
      ? 'AI 已生成可能候选，请自行核验。'
      : '信息还不够，AI 暂时无法给出可靠候选。')
  const followUpQuestions = normalizeArray(parsed.followUpQuestions).slice(0, 3)
  const candidates = normalizeCandidateArray(parsed.candidates)
    .map((candidate) => normalizeNovelCandidate(candidate))
    .filter(Boolean)
    .slice(0, 5)

  if (status === 'need_more_info') {
    return {
      status,
      message,
      followUpQuestions,
      candidates: [],
    }
  }

  if (candidates.length === 0) {
    return {
      status: 'need_more_info',
      message: '信息还不够，AI 暂时无法给出可靠候选。',
      followUpQuestions:
        followUpQuestions.length > 0
          ? followUpQuestions
          : [
              '是现代、古代、校园、娱乐圈还是玄幻？',
              '还记得主角身份或职业吗？',
              '还记得一个关键剧情或反派设定吗？',
            ],
      candidates: [],
    }
  }

  return {
    status: 'candidates',
    message,
    followUpQuestions,
    candidates,
  }
}

function normalizeCandidateArray(value) {
  if (Array.isArray(value)) {
    return value
  }

  if (value === undefined || value === null) {
    return []
  }

  throw new Error('AI 返回格式异常，请重试')
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

function normalizeNovelCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null
  }

  const title = cleanText(candidate.title)
  const reason = cleanText(candidate.reason).slice(0, 180)

  if (!title || !reason || isPlaceholderCandidateTitle(title)) {
    return null
  }

  const confidence = cleanText(candidate.confidence).toLowerCase()
  const safeConfidence = ['low', 'medium', 'high'].includes(confidence)
    ? confidence
    : 'low'

  return {
    title: title.slice(0, 80),
    author: cleanText(candidate.author).slice(0, 60) || '未知',
    reason,
    matchedElements: normalizeArray(candidate.matchedElements).slice(0, 8),
    confidence: safeConfidence,
  }
}

function isPlaceholderCandidateTitle(title) {
  return /^(未知|可能|候选|小说|书名|作品|未定|无名)/u.test(title) ||
    /^未知小说\s*\d*$/u.test(title) ||
    /^小说\s*\d+$/u.test(title) ||
    /^候选\s*\d+$/u.test(title)
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
