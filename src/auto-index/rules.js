export const AUTO_INDEX_DELAY_MS = 15_000
export const MIN_AUTO_INDEX_WORD_COUNT = 500

const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:'])
const BLOCKED_HOSTNAMES = new Set(['localhost', '127.0.0.1'])
const SENSITIVE_KEYWORDS = [
  'login',
  'signin',
  'auth',
  'account',
  'checkout',
  'payment',
  'pay',
  'order',
  'cart',
  'billing',
  'password',
  'settings',
  'profile',
  'admin',
  '登录',
  '注册',
  '认证',
  '账户',
  '账号',
  '结账',
  '支付',
  '付款',
  '订单',
  '购物车',
  '账单',
  '密码',
  '设置',
  '资料',
  '后台',
]

const SENSITIVE_FORM_SELECTOR = [
  'input[type="password"]',
  'input[autocomplete*="current-password" i]',
  'input[autocomplete*="new-password" i]',
  'input[autocomplete*="cc-" i]',
  'input[name*="password" i]',
  'input[name*="card" i]',
  'input[name*="credit" i]',
  'input[name*="billing" i]',
  'input[id*="password" i]',
  'input[id*="card" i]',
  'input[id*="credit" i]',
  'input[id*="billing" i]',
].join(',')
const FORM_FIELD_SELECTOR = [
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="search"])',
  'textarea',
  'select',
].join(',')

export function canAutoIndexPage(url, title = '') {
  const parsedUrl = parseUrl(url)

  if (!parsedUrl) {
    return false
  }

  if (!SUPPORTED_PROTOCOLS.has(parsedUrl.protocol)) {
    return false
  }

  if (
    BLOCKED_HOSTNAMES.has(parsedUrl.hostname) ||
    parsedUrl.hostname.startsWith('127.')
  ) {
    return false
  }

  return !hasSensitiveKeyword(parsedUrl, title)
}

export function hasSensitiveForm(pageDocument) {
  if (!pageDocument?.querySelector) {
    return false
  }

  if (pageDocument.querySelector(SENSITIVE_FORM_SELECTOR)) {
    return true
  }

  return Array.from(pageDocument.querySelectorAll('form')).some(
    (form) => form.querySelectorAll(FORM_FIELD_SELECTOR).length >= 3,
  )
}

function parseUrl(url) {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

function hasSensitiveKeyword(parsedUrl, title) {
  const pageText = [
    safeDecode(parsedUrl.pathname),
    safeDecode(parsedUrl.search),
    safeDecode(parsedUrl.hash),
    title,
  ]
    .join(' ')
    .toLowerCase()

  return SENSITIVE_KEYWORDS.some((keyword) => pageText.includes(keyword))
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
