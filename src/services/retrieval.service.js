const db = require('../utils/db')
const logger = require('../utils/logger')
const embeddingService = require('./embedding.service')

/**
 * 检索服务
 * 提问 → Embedding → 读取 Chunk → 余弦相似度 → TopK
 */

const DEFAULT_TOP_K = 5
const DEFAULT_MIN_SCORE = 0.2

function parseEmbedding(raw) {
  if (!raw) return null
  if (Array.isArray(raw)) return raw
  try {
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

/**
 * 在指定知识库内检索
 * @param {object} opts
 * @param {string} opts.query 查询文本
 * @param {number} [opts.knowledgeBaseId] 限定知识库；不传则全库检索（仅公开文档）
 * @param {number} [opts.topK]
 * @param {number} [opts.minScore]
 * @param {boolean} [opts.publicOnly] 仅检索已公开文档（App 端用）
 * @returns {Promise<Array<{id,document_id,content,score,chunk_index,document_name}>>}
 */
async function search(opts = {}) {
  const {
    query,
    knowledgeBaseId,
    topK = DEFAULT_TOP_K,
    minScore = DEFAULT_MIN_SCORE,
    publicOnly = false
  } = opts

  if (!query || !query.trim()) return []

  // 1. 查询向量
  const queryVec = await embeddingService.embedText(query.trim())
  if (!queryVec || queryVec.length === 0) {
    throw new Error('查询向量生成失败')
  }

  // 2. 读取候选分块
  const params = []
  let where = 'WHERE c.embedding IS NOT NULL'
  if (knowledgeBaseId) {
    where += ' AND c.knowledge_base_id = ?'
    params.push(knowledgeBaseId)
  }
  if (publicOnly) {
    where += ' AND d.is_public = TRUE'
  }
  where += " AND d.parse_status = 'completed'"

  const rows = await db.queryRaw(
    `SELECT c.id, c.document_id, c.chunk_index, c.content, c.embedding,
            d.original_name AS document_name
     FROM document_chunks c
     JOIN documents d ON d.id = c.document_id
     ${where}`,
    params
  )

  if (!rows || rows.length === 0) return []

  // 3. 余弦相似度
  const scored = []
  for (const row of rows) {
    const vec = parseEmbedding(row.embedding)
    if (!vec || vec.length !== queryVec.length) continue
    const score = embeddingService.cosineSimilarity(queryVec, vec)
    scored.push({
      id: row.id,
      document_id: row.document_id,
      document_name: row.document_name,
      chunk_index: row.chunk_index,
      content: row.content,
      score
    })
  }

  // 4. 排序取 TopK
  scored.sort((a, b) => b.score - a.score)
  return scored.filter(item => item.score >= minScore).slice(0, topK)
}

/**
 * 将检索结果拼接为可注入 system prompt 的上下文文本
 */
function buildContext(results) {
  if (!results || results.length === 0) return ''
  return results
    .map((r, i) => `【资料${i + 1}｜${r.document_name || '文档'}】\n${r.content}`)
    .join('\n\n')
}

module.exports = {
  DEFAULT_TOP_K,
  DEFAULT_MIN_SCORE,
  search,
  buildContext
}
