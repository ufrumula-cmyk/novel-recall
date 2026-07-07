const OPENAI_API_KEY_STORAGE_KEY = 'openaiApiKey'

export async function getOpenAIApiKey() {
  const result = await storageGet(OPENAI_API_KEY_STORAGE_KEY)
  const apiKey = result[OPENAI_API_KEY_STORAGE_KEY]

  return typeof apiKey === 'string' ? apiKey : ''
}

export async function saveOpenAIApiKey(apiKey) {
  await storageSet({
    [OPENAI_API_KEY_STORAGE_KEY]: apiKey.trim(),
  })
}

export async function clearOpenAIApiKey() {
  await storageRemove(OPENAI_API_KEY_STORAGE_KEY)
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
