const SILICONFLOW_API_KEY_STORAGE_KEY = 'siliconFlowApiKey'
export const AUTO_INDEX_ENABLED_STORAGE_KEY = 'autoIndexEnabled'

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

function getStorageArea() {
  const storageArea = globalThis.chrome?.storage?.local

  if (!storageArea) {
    throw new Error('Chrome storage API is unavailable')
  }

  return storageArea
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
