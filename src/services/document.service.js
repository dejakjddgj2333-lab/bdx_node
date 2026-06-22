const fs = require('fs')
const path = require('path')
const mammoth = require('mammoth')
const db = require('../utils/db')
const config = require('../config')
const logger = require('../utils/logger')
const embeddingService = require('./embedding.service')

/**
 * 文档处理服务
 * 解析文本 → 切块 → Embedding → 写入 document_chunks
 */

// 切块参数（按字符近似）
const CHUNK_SIZE = parseInt(process.env.RAG_CHUNK_SIZE, 10) || 600
const CHUNK_OVERLAP = parseInt(process.env.RAG_CHUNK_OVERLAP, 10) || 80

/**
 * 根据 file_url 还原磁盘绝对路径
 */
function resolveFilePath(fileUrl) {
  if (!fileUrl) return null
  return path.join(config.upload.path, fileUrl.replace(/^\/uploads\//, ''))
}

/**
 * 解析文档为纯文本
 */
async function extractText(filePath, fileType = '', originalName = '') {
  const ext = (path.extname(originalName || filePath) || '').toLowerCase()
  const type = (fileType || '').toLowerCase()

  // PDF
  if (ext === '.pdf' || type.includes('pdf')) {
    const pdfParse = require('pdf-parse')
    const buffer = fs.readFileSync(filePath)
    const data = await pdfParse(buffer)
    return data.text || ''
  }

  // Word docx
  if (ext === '.docx' || type.includes('officedocument.wordprocessingml')) {
    const result = await mammoth.extractRawText({ path: filePath })
    return result.value || ''
  }

  // 旧版 .doc 暂不支持（mammoth 仅支持 docx）
  if (ext === '.doc') {
    throw new Error('暂不支持旧版 .doc 格式，请转换为 .docx 后上传')
  }

  // txt / md / 其他文本
  return fs.readFileSync(filePath, 'utf-8')
}

/**
 * 文本归一化：统一换行、压缩多余空白
 */
function normalizeText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/[^\S\n]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * 文本切块
 * 优先按段落聚合到 CHUNK_SIZE，过长段落按字符滑动切分，块间保留 overlap
 */
function chunkText(text) {
  const normalized = normalizeText(text)
  if (!normalized) return []

  const paragraphs = normalized.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
  const chunks = []
  let current = ''

  const pushCurrent = () => {
    const trimmed = current.trim()
    if (trimmed) chunks.push(trimmed)
    current = ''
  }

  for (const para of paragraphs) {
    if (para.length > CHUNK_SIZE) {
      // 先结算已有缓冲
      pushCurrent()
      // 长段落滑动切分
      let start = 0
      while (start < para.length) {
        const end = Math.min(start + CHUNK_SIZE, para.length)
        chunks.push(para.slice(start, end).trim())
        if (end >= para.length) break
        start = end - CHUNK_OVERLAP
        if (start < 0) start = 0
      }
      continue
    }

    if (current.length + para.length + 1 > CHUNK_SIZE) {
      pushCurrent()
    }
    current += (current ? '\n' : '') + para
  }
  pushCurrent()

  return chunks.filter(c => c.length > 0)
}

/**
 * 处理单个文档：解析 → 切块 → embedding → 入库
 * @param {number} documentId
 */
async function processDocument(documentId) {
  const doc = await db.queryOne('SELECT * FROM documents WHERE id = ?', [documentId])
  if (!doc) {
    throw new Error('文档不存在')
  }

  await db.update(
    "UPDATE documents SET parse_status = 'parsing', parse_error = NULL WHERE id = ?",
    [documentId]
  )

  try {
    const filePath = resolveFilePath(doc.file_url)
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error('文档文件不存在，请重新上传')
    }

    // 1. 解析文本
    const rawText = await extractText(filePath, doc.file_type, doc.original_name)
    const text = normalizeText(rawText || '')
    if (!text) {
      throw new Error('未能从文档中解析出文本内容')
    }

    // 2. 切块
    const chunks = chunkText(text)
    if (chunks.length === 0) {
      throw new Error('切块结果为空')
    }

    // 3. Embedding
    const vectors = await embeddingService.embedTexts(chunks)
    if (vectors.length !== chunks.length) {
      throw new Error(`向量数量(${vectors.length})与分块数量(${chunks.length})不一致`)
    }

    // 4. 清理旧分块并写入
    await db.update('DELETE FROM document_chunks WHERE document_id = ?', [documentId])

    for (let i = 0; i < chunks.length; i++) {
      const vec = vectors[i] || []
      await db.insert(
        `INSERT INTO document_chunks
         (document_id, knowledge_base_id, chunk_index, content, token_count, embedding, embedding_dim)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          documentId,
          doc.knowledge_base_id || null,
          i,
          chunks[i],
          chunks[i].length,
          JSON.stringify(vec),
          vec.length
        ]
      )
    }

    await db.update(
      `UPDATE documents
       SET parse_status = 'completed', chunk_count = ?, parse_error = NULL,
           parse_result = ?, parsed_at = NOW()
       WHERE id = ?`,
      [chunks.length, text.slice(0, 2000), documentId]
    )

    logger.info(`[Document] 文档 ${documentId} 解析完成，共 ${chunks.length} 块`)
    return { chunkCount: chunks.length, textLength: text.length }
  } catch (err) {
    logger.error(`[Document] 文档 ${documentId} 解析失败:`, err.message)
    await db.update(
      "UPDATE documents SET parse_status = 'failed', parse_error = ? WHERE id = ?",
      [String(err.message || err).slice(0, 1000), documentId]
    )
    throw err
  }
}

/**
 * 异步触发解析（不阻塞请求）
 */
function processDocumentAsync(documentId) {
  setImmediate(() => {
    processDocument(documentId).catch(err => {
      logger.error(`[Document] 后台解析 ${documentId} 异常:`, err.message)
    })
  })
}

module.exports = {
  CHUNK_SIZE,
  CHUNK_OVERLAP,
  extractText,
  chunkText,
  normalizeText,
  processDocument,
  processDocumentAsync
}
