export function cosineSimilarity(vectorA, vectorB) {
  if (!isNumberArray(vectorA) || !isNumberArray(vectorB)) {
    return 0
  }

  const length = Math.min(vectorA.length, vectorB.length)

  if (length === 0) {
    return 0
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let index = 0; index < length; index += 1) {
    const valueA = vectorA[index]
    const valueB = vectorB[index]

    dotProduct += valueA * valueB
    normA += valueA * valueA
    normB += valueB * valueB
  }

  if (normA === 0 || normB === 0) {
    return 0
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

function isNumberArray(value) {
  return Array.isArray(value) && value.every((item) => Number.isFinite(item))
}
