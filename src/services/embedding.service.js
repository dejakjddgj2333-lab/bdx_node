const db = require('../utils/db')
const config = require('../config')
const logger = require('../utils/logger')

/**
 * Embedding 服务
 * 使用火山方舟 Agent Plan doubao-embedding-vision（OpenAI 兼容接口）
 * 端点：{planV3BaseUrl}/embeddings
 */

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'doubao-embedding-vision'
const EMBEDDING_DIM = parseInt(process.env.EMBEDDING_DIM, 10) || 1024
// 方舟 embeddings 接口单次最多 10 条文本
const BATCH_SIZE = 10

/**
 * 读取方舟 Provider 配置（优先数据库 api_key，回退 config.ai.ark）
 * 注意：向量化 baseUrl 固定取 config.ai.ark.planV3BaseUrl
 * （model_providers.base_url 存的是对话用的 planBaseUrl，不能用于 embeddings）
 */
async function getArkConfig() {
  const env = config.ai.ark || {}
  const baseUrl = env.planV3BaseUrl || 'https://ark.cn-beijing.volces.com/api/plan/v3'
  try {
    const row = await db.queryOne(
      "SELECT api_key FROM model_providers WHERE provider = 'ark' AND is_active = TRUE LIMIT 1"
    )
    if (row && row.api_key) {
      return { apiKey: row.api_key, baseUrl }
    }
  } catch (e) {
    logger.error('[Embedding] 读取 ark Provider 配置失败:', e.message)
  }
  return { apiKey: env.apiKey || '', baseUrl }
}

/**
 * 调用一次 embeddings 接口
 */
async function embedBatch(inputs, { apiKey, baseUrl }) {
  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: inputs,
      dimensions: EMBEDDING_DIM,
      encoding_format: 'float'
    })
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Embedding 接口错误(${response.status}): ${text}`)
  }

  const data = await response.json()
  // OpenAI 兼容返回 { data: [{ index, embedding }] }，按 index 排序
  const sorted = (data.data || []).slice().sort((a, b) => a.index - b.index)
  return sorted.map(item => item.embedding)
}

/**
 * 批量生成 embedding
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
async function embedTexts(texts) {
  if (!Array.isArray(texts) || texts.length === 0) return []

  const cfg = await getArkConfig()
  if (!cfg.apiKey) {
    throw new Error('方舟 API Key 未配置，无法生成向量。请在后台「模型配置」中配置方舟 Key。')
  }

  const results = []
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const vectors = await embedBatch(batch, cfg)
    results.push(...vectors)
  }
  return results
}

/**
 * 生成单条文本向量
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embedText(text) {
  const [vec] = await embedTexts([text])
  return vec || []
}

/**
 * 余弦相似度
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

module.exports = {
  EMBEDDING_MODEL,
  EMBEDDING_DIM,
  embedTexts,
  embedText,
  cosineSimilarity
}
