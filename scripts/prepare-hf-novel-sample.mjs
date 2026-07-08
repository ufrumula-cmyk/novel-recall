import { createReadStream } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_LIMIT = 100
const MIN_INTRO_LENGTH = 20
const CONTENT_INTRO_LIMIT = 400
const TITLE_FIELDS = ['title', 'name', 'book_name', 'novel_name']
const AUTHOR_FIELDS = ['author']
const CATEGORY_FIELDS = ['category']
const TAG_FIELDS = ['tags']
const DIRECT_INTRO_FIELDS = ['intro', 'summary', 'description', 'desc']
const CONTENT_INTRO_FIELDS = ['content', 'text']

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (!options.input || !options.output) {
    printUsage()
    process.exitCode = 1
    return
  }

  const limit = parseLimit(options.limit)
  const novels = await collectNovels(options.input, limit)

  await mkdir(path.dirname(path.resolve(options.output)), { recursive: true })
  await writeFile(options.output, `${JSON.stringify(novels, null, 2)}\n`, 'utf8')

  console.log(`Converted ${novels.length} records to ${options.output}`)
}

function parseArgs(args) {
  const options = {}

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (!arg.startsWith('--')) {
      continue
    }

    const key = arg.slice(2)
    const value = args[index + 1]

    if (!value || value.startsWith('--')) {
      options[key] = ''
      continue
    }

    options[key] = value
    index += 1
  }

  return options
}

function parseLimit(value) {
  if (value === undefined) {
    return DEFAULT_LIMIT
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('--limit must be a positive integer')
  }

  return parsed
}

async function collectNovels(inputPath, limit) {
  const ext = path.extname(inputPath).toLowerCase()

  if (ext === '.csv') {
    return collectCsvNovels(inputPath, limit)
  }

  const records = await readRecords(inputPath)
  const novels = []

  for (const record of records) {
    appendNovel(novels, record)

    if (novels.length >= limit) {
      break
    }
  }

  return novels
}

async function readRecords(inputPath) {
  const ext = path.extname(inputPath).toLowerCase()
  const raw = await readFile(inputPath, 'utf8')

  if (ext === '.jsonl') {
    return parseJsonLines(raw)
  }

  if (ext === '.json') {
    return parseJson(raw)
  }

  throw new Error(`Unsupported input file type: ${ext || '(none)'}. Use .json, .jsonl, or .csv.`)
}

async function collectCsvNovels(inputPath, limit) {
  const novels = []

  for await (const record of streamCsvRecords(inputPath)) {
    appendNovel(novels, record)

    if (novels.length >= limit) {
      break
    }
  }

  return novels
}

function appendNovel(novels, record) {
  if (!isPlainObject(record)) {
    return
  }

  const novel = toNovelItem(record, novels.length + 1)

  if (novel) {
    novels.push(novel)
  }
}

async function* streamCsvRecords(inputPath) {
  const stream = createReadStream(inputPath, {
    encoding: 'utf8',
    highWaterMark: 1024 * 1024,
  })
  const parser = createStreamingCsvParser()
  let headers = null

  try {
    for await (const chunk of stream) {
      for (const row of parser.push(chunk)) {
        if (!headers) {
          headers = readCsvHeaders(row)
          continue
        }

        if (isEmptyCsvRow(row)) {
          continue
        }

        yield rowToRecord(headers, row)
      }
    }

    for (const row of parser.end()) {
      if (!headers) {
        headers = readCsvHeaders(row)
        continue
      }

      if (isEmptyCsvRow(row)) {
        continue
      }

      yield rowToRecord(headers, row)
    }
  } finally {
    stream.destroy()
  }
}

function createStreamingCsvParser() {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let quotePending = false
  let skipNextLf = false
  let charOffset = 0

  return {
    push(chunk) {
      rows.length = 0

      for (let index = 0; index < chunk.length; index += 1) {
        const char = chunk[index]
        charOffset += 1

        if (skipNextLf) {
          skipNextLf = false

          if (char === '\n') {
            continue
          }
        }

        if (inQuotes) {
          if (quotePending) {
            if (char === '"') {
              field += '"'
              quotePending = false
              continue
            }

            inQuotes = false
            quotePending = false
          } else if (char === '"') {
            quotePending = true
            continue
          } else {
            field += char
            continue
          }
        }

        handleOutsideQuote(char)
      }

      return [...rows]
    },

    end() {
      rows.length = 0

      if (quotePending) {
        inQuotes = false
        quotePending = false
      }

      if (inQuotes) {
        throw new Error('Invalid CSV: found an unclosed quoted field. Please check quotes or line breaks in the source file.')
      }

      if (field || row.length > 0) {
        emitRow()
      }

      return [...rows]
    },
  }

  function handleOutsideQuote(char) {
    if (char === '"') {
      if (field.length === 0) {
        inQuotes = true
        return
      }

      throw new Error(`Invalid CSV quote at character ${charOffset}. Quotes must wrap the whole field or be escaped as "".`)
    }

    if (char === ',') {
      emitField()
      return
    }

    if (char === '\r' || char === '\n') {
      emitRow()

      if (char === '\r') {
        skipNextLf = true
      }
      return
    }

    field += char
  }

  function emitField() {
    row.push(field)
    field = ''
  }

  function emitRow() {
    emitField()
    rows.push(row)
    row = []
  }
}

function readCsvHeaders(row) {
  const headers = row.map((header) => header.trim())

  if (headers.every((header) => !header)) {
    throw new Error('CSV header row is empty.')
  }

  return headers
}

function isEmptyCsvRow(row) {
  return row.every((field) => field.trim() === '')
}

function parseJsonLines(raw) {
  return raw
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(stripBom(line))
      } catch (error) {
        throw new Error(`Invalid JSONL at line ${index + 1}: ${error.message}`)
      }
    })
}

function parseJson(raw) {
  const parsed = JSON.parse(stripBom(raw))

  if (Array.isArray(parsed)) {
    return parsed
  }

  if (!isPlainObject(parsed)) {
    throw new Error('JSON input must be an array or an object containing an array field.')
  }

  for (const key of ['novels', 'data', 'items', 'records']) {
    if (Array.isArray(parsed[key])) {
      return parsed[key]
    }
  }

  throw new Error('JSON object input must contain a novels, data, items, or records array.')
}

function rowToRecord(headers, row) {
  const record = {}

  headers.forEach((header, index) => {
    if (!header) {
      return
    }

    record[header] = row[index] ?? ''
  })

  return record
}

function toNovelItem(record, fallbackIndex) {
  const title = cleanText(getField(record, TITLE_FIELDS)) || `测试小说 ${fallbackIndex}`
  const author = cleanText(getField(record, AUTHOR_FIELDS)) || '未知作者'
  const intro = pickIntro(record)

  if (intro.length < MIN_INTRO_LENGTH) {
    return null
  }

  return {
    title,
    author,
    platform: 'Chinese-web-novel',
    url: '',
    intro,
    tags: parseTags(getField(record, TAG_FIELDS)),
    category: cleanText(getField(record, CATEGORY_FIELDS)),
    status: cleanText(getField(record, ['status'])),
    wordCount: cleanText(getField(record, ['wordCount', 'word_count', 'words'])),
    source: 'import',
  }
}

function pickIntro(record) {
  for (const field of DIRECT_INTRO_FIELDS) {
    const value = cleanText(getField(record, [field]))

    if (value) {
      return value
    }
  }

  for (const field of CONTENT_INTRO_FIELDS) {
    const value = cleanText(getField(record, [field]))

    if (value) {
      return truncateText(value, CONTENT_INTRO_LIMIT)
    }
  }

  return ''
}

function getField(record, names) {
  for (const name of names) {
    if (record[name] !== undefined) {
      return record[name]
    }
  }

  const normalizedNames = new Set(names.map(normalizeKey))

  for (const [key, value] of Object.entries(record)) {
    if (normalizedNames.has(normalizeKey(key))) {
      return value
    }
  }

  return ''
}

function parseTags(value) {
  if (Array.isArray(value)) {
    return value.map(cleanText).filter(Boolean)
  }

  if (typeof value !== 'string') {
    return []
  }

  return value
    .split(/[,，/／|｜\s]+/u)
    .map(cleanText)
    .filter(Boolean)
}

function cleanText(value) {
  if (value === undefined || value === null) {
    return ''
  }

  if (typeof value !== 'string') {
    return String(value).trim()
  }

  return value.replace(/\s+/gu, ' ').trim()
}

function truncateText(value, maxLength) {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength)}...`
}

function stripBom(value) {
  return value.replace(/^\uFEFF/u, '')
}

function normalizeKey(value) {
  return String(value).trim().toLowerCase()
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function printUsage() {
  console.log(`
Usage:
  node scripts/prepare-hf-novel-sample.mjs --input data/raw.jsonl --output data/novels-sample.json --limit 100
  node scripts/prepare-hf-novel-sample.mjs --input D:\\datasets\\Chinese-web-novel\\sample.csv --output D:\\datasets\\Chinese-web-novel\\novels-sample.json --limit 100
  node scripts/prepare-hf-novel-sample.mjs --input D:\\datasets\\Chinese-web-novel\\data.csv --output D:\\datasets\\Chinese-web-novel\\novels-sample-50.json --limit 50

Options:
  --input   Input .json, .jsonl, or .csv file
  --output  Output Novel Recall import JSON file
  --limit   Sample size, defaults to ${DEFAULT_LIMIT}
`)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})