const SILICONFLOW_API_KEY_STORAGE_KEY = 'siliconFlowApiKey'
export const AUTO_INDEX_ENABLED_STORAGE_KEY = 'autoIndexEnabled'
export const AUTO_INDEX_LAST_STATUS_STORAGE_KEY = 'autoIndexLastStatus'

export async function getSiliconFlowApiKey() {
  const result = await storageGet(SILICONFLOW_API_KEY_STORAGE_KEY)
  const apiKey = result[SILICONFLOW_API_KEY_STORAGE_KEY]

  return typeof apiKey === 'string' ? apiKey : ''
}

export async function saveSiliconFlowApiKey(apiKey) {
  await storageSet({
    [SILICONFLOW_API_KEY_STORAGE_KEY]: apiKey.trim(),
  })
}

export async function clearSiliconFlowApiKey() {
  await storageRemove(SILICONFLOW_API_KEY_STORAGE_KEY)
}

export async function getAutoIndexEnabled() {
  const result = await storageGet(AUTO_INDEX_ENABLED_STORAGE_KEY)

  return result[AUTO_INDEX_ENABLED_STORAGE_KEY] === true
}

export async function saveAutoIndexEnabled(enabled) {
  await storageSet({
    [AUTO_INDEX_ENABLED_STORAGE_KEY]: Boolean(enabled),
  })
}

export async function getAutoIndexLastStatus() {
  const result = await storageGet(AUTO_INDEX_LAST_STATUS_STORAGE_KEY)
  const lastStatus = result[AUTO_INDEX_LAST_STATUS_STORAGE_KEY]

  if (!isAutoIndexLastStatus(lastStatus)) {
    return null
  }

  return lastStatus
}

export async function saveAutoIndexLastStatus({ status, reason, url }) {
  await storageSet({
    [AUTO_INDEX_LAST_STATUS_STORAGE_KEY]: {
      status,
      reason,
      url,
      time: new Date().toISOString(),
    },
  })
}

function getStorageArea() {
  const storageArea = globalThis.chrome?.storage?.local

  if (!storageArea) {
    throw new Error('Chrome storage API is unavailable')
  }

  return storageArea
}

function isAutoIndexLastStatus(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.status === 'string' &&
    typeof value.reason === 'string' &&
    typeof value.url === 'string' &&
    typeof value.time === 'string'
  )
}

function storageGet(key) {
  return new Promise((resolve, reject) => {
    getStorageArea().get(key, (result) => {
      const error = globalThis.chrome?.runtime?.lastError

      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve(result || {})
    })
  })
}

function storageSet(value) {
  return new Promise((resolve, reject) => {
    getStorageArea().set(value, () => {
      const error = globalThis.chrome?.runtime?.lastError

      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve()
    })
  })
}

function storageRemove(key) {
  return new Promise((resolve, reject) => {
    getStorageArea().remove(key, () => {
      const error = globalThis.chrome?.runtime?.lastError

      if (error) {
        reject(new Error(error.message))
        return
      }

      resolve()
    })
  })
}
