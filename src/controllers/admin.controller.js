const jwt = require('jsonwebtoken')
const path = require('path')
const fs = require('fs')
const multer = require('koa-multer')
const WebSocket = require('ws')
const config = require('../config')
const db = require('../utils/db')
const documentService = require('../services/document.service')
const embeddingService = require('../services/embedding.service')
const retrievalService = require('../services/retrieval.service')

// 内置 Provider 预设（标识 / 名称 / Base URL 固定）
// 阶段一收敛后对话与图像 Provider 均为 'ark'；ark.base_url 是对话用 planBaseUrl，
// 图像 baseUrl 另取 config.ai.ark.planV3BaseUrl（见 ai.service.js ArkImageProvider），不读此字段。
const PROVIDER_PRESETS = {
  ark: { name: '火山方舟', base_url: 'https://ark.cn-beijing.volces.com/api/plan' },
  deepseek: { name: 'DeepSeek', base_url: 'https://api.deepseek.com' },
  qwen: { name: '通义千问', base_url: 'https://dashscope.aliyuncs.com' },
  claude: { name: 'Claude', base_url: 'https://api.anthropic.com' },
  doubao: { name: '豆包', base_url: 'https://ark.cn-beijing.volces.com/api/v3' },
  moonshot: { name: 'Kimi', base_url: 'https://api.moonshot.cn/v1' },
  qianfan: { name: '文心一言', base_url: 'https://qianfan.baidubce.com/v2' },
  zhipu: { name: '智谱 GLM', base_url: 'https://open.bigmodel.cn/api/paas/v4' },
  xinghuo: { name: '讯飞星火', base_url: 'https://spark-api-open.xf-yun.com/v1' },
  minimax: { name: 'MiniMax', base_url: 'https://api.minimax.chat/v1' }
}

const { VOICE_PROVIDER_PRESETS, getVoiceProviderPreset } = require('../services/voice-call/presets')

function getProviderPreset(provider) {
  return PROVIDER_PRESETS[provider] || null
}

function formatVoiceProvider(row) {
  const preset = getVoiceProviderPreset(row.provider)
  return {
    ...row,
    apiKey: maskKey(row.api_key),
    hasKey: !!row.api_key,
    api_key: undefined,
    voices: preset?.voices || [],
    voice_labels: preset?.voice_labels || {},
    voice_intros: preset?.voice_intros || {}
  }
}

/**
 * 获取 Provider 远程模型列表 URL
 * 各厂商 OpenAI 兼容接口的 models 端点不一致
 */
function getRemoteModelsUrl(provider, baseUrl) {
  if (provider === 'qwen') {
    return `${baseUrl}/compatible-mode/v1/models`
  }
  if (provider === 'claude') {
    return `${baseUrl}/v1/models`
  }
  return `${baseUrl}/models`
}

const { success, error } = require('../utils/response')
const logger = require('../utils/logger')

// 文档上传配置
const knowledgeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(config.upload.path, 'knowledge')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`
    cb(null, unique)
  }
})

const knowledgeUpload = multer({
  storage: knowledgeStorage,
  limits: { fileSize: config.upload.maxSize }
})

// ======================== 工具函数 ========================

function parseMs(exp) {
  const num = parseInt(exp, 10)
  if (isNaN(num)) return 86400000
  if (exp.includes('d')) return num * 86400000
  if (exp.includes('h')) return num * 3600000
  if (exp.includes('m')) return num * 60000
  if (exp.includes('s')) return num * 1000
  return num * 1000
}

function maskKey(key = '') {
  if (!key) return ''
  if (key.length <= 8) return '****'
  return key.slice(0, 4) + '****' + key.slice(-4)
}

// 文件名从 multipart latin1 字节恢复为 UTF-8（浏览器默认上传 UTF-8 文件名）
function decodeFilename(name = '') {
  try {
    const buf = Buffer.from(name, 'latin1')
    if (Buffer.isUtf8 && Buffer.isUtf8(buf)) {
      return buf.toString('utf8')
    }
  } catch (e) {}
  return name
}

// 校验字符串中是否包含 UTF-8 解码失败的替换字符
function assertNoReplacementChar(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.includes('�')) {
      return false
    }
  }
  return true
}

function formatProvider(row) {
  return {
    ...row,
    apiKey: maskKey(row.api_key),
    hasKey: !!row.api_key,
    api_key: undefined
  }
}

async function logAdminAction(ctx, action, targetTable, targetId, detail = null) {
  try {
    await db.insert(
      'INSERT INTO admin_logs (action, target_table, target_id, detail, ip) VALUES (?, ?, ?, ?, ?)',
      [action, targetTable, targetId, detail ? JSON.stringify(detail) : null, ctx.ip]
    )
  } catch (e) {
    logger.error('[Admin] 记录操作日志失败:', e.message)
  }
}

// ======================== 认证 ========================

async function login(ctx) {
  const { password } = ctx.request.body

  if (!password) {
    return error(ctx, '请输入管理员密码', 400)
  }

  if (password !== config.admin.password) {
    logger.warn(`[Admin] 登录密码错误，IP: ${ctx.ip}`)
    return error(ctx, '密码错误', 400)
  }

  const token = jwt.sign(
    { isAdmin: true, username: 'admin' },
    config.admin.jwtSecret,
    { expiresIn: config.admin.jwtExpiresIn }
  )

  logger.info(`[Admin] 管理员登录成功，IP: ${ctx.ip}`)
  await logAdminAction(ctx, 'admin_login', null, null, null)

  success(ctx, {
    token,
    expiresAt: Date.now() + parseMs(config.admin.jwtExpiresIn)
  }, '登录成功')
}

async function profile(ctx) {
  success(ctx, { username: ctx.state.admin.username || 'admin' })
}

async function logout(ctx) {
  await logAdminAction(ctx, 'admin_logout', null, null, null)
  success(ctx, null, '退出成功')
}

// ======================== Dashboard ========================

async function stats(ctx) {
  const [users, conversations, messages, documents, activeModels, activeProviders] = await Promise.all([
    db.queryOne('SELECT COUNT(*) AS total FROM users'),
    db.queryOne('SELECT COUNT(*) AS total FROM conversations'),
    db.queryOne('SELECT COUNT(*) AS total FROM messages'),
    db.queryOne('SELECT COUNT(*) AS total FROM documents'),
    db.queryOne('SELECT COUNT(*) AS total FROM ai_models WHERE is_active = TRUE'),
    db.queryOne('SELECT COUNT(*) AS total FROM model_providers WHERE is_active = TRUE')
  ])

  const recentUsers = await db.query(
    'SELECT id, username, nickname, created_at FROM users ORDER BY id DESC LIMIT 5'
  )
  const recentDocs = await db.query(
    `SELECT d.id, d.original_name, d.parse_status, d.created_at, k.name AS knowledge_base_name
     FROM documents d
     LEFT JOIN knowledge_bases k ON d.knowledge_base_id = k.id
     ORDER BY d.id DESC LIMIT 5`
  )

  success(ctx, {
    usersTotal: users.total,
    conversationsTotal: conversations.total,
    messagesTotal: messages.total,
    documentsTotal: documents.total,
    activeModels: activeModels.total,
    activeProviders: activeProviders.total,
    recentUsers,
    recentDocuments: recentDocs
  })
}

// ======================== 用户管理 ========================

async function listUsers(ctx) {
  const page = Math.max(1, parseInt(ctx.query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(ctx.query.pageSize) || 20))
  const search = (ctx.query.search || '').trim()
  const status = ctx.query.status

  let where = 'WHERE 1=1'
  const params = []

  if (search) {
    where += ` AND (username LIKE ? OR nickname LIKE ? OR phone LIKE ? OR email LIKE ?)`
    const like = `%${search}%`
    params.push(like, like, like, like)
  }

  if (status !== undefined && status !== '') {
    where += ` AND status = ?`
    params.push(parseInt(status))
  }

  const countRow = await db.queryOne(
    `SELECT COUNT(*) AS total FROM users ${where}`,
    params
  )

  const list = await db.queryRaw(
    `SELECT id, username, nickname, avatar, phone, email, vip_level, status,
            daily_quota, used_quota, created_at
     FROM users ${where}
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]
  )

  success(ctx, {
    list,
    pagination: {
      page,
      pageSize,
      total: countRow.total,
      totalPages: Math.ceil(countRow.total / pageSize)
    }
  })
}

async function getUser(ctx) {
  const { id } = ctx.params
  const user = await db.queryOne(
    `SELECT id, username, nickname, avatar, phone, email, vip_level, status,
            daily_quota, used_quota, created_at
     FROM users WHERE id = ?`,
    [id]
  )

  if (!user) {
    return error(ctx, '用户不存在', 404)
  }

  const [convCount, msgCount] = await Promise.all([
    db.queryOne('SELECT COUNT(*) AS total FROM conversations WHERE user_id = ?', [id]),
    db.queryOne('SELECT COUNT(*) AS total FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = ?)', [id])
  ])

  success(ctx, {
    ...user,
    conversationsCount: convCount.total,
    messagesCount: msgCount.total
  })
}

async function updateUser(ctx) {
  const { id } = ctx.params
  const { nickname, status, vip_level, daily_quota } = ctx.request.body

  const user = await db.queryOne('SELECT id FROM users WHERE id = ?', [id])
  if (!user) {
    return error(ctx, '用户不存在', 404)
  }

  const fields = []
  const values = []

  if (nickname !== undefined) {
    fields.push('nickname = ?')
    values.push(nickname)
  }
  if (status !== undefined) {
    fields.push('status = ?')
    values.push(status)
  }
  if (vip_level !== undefined) {
    fields.push('vip_level = ?')
    values.push(vip_level)
  }
  if (daily_quota !== undefined) {
    fields.push('daily_quota = ?')
    values.push(daily_quota)
  }

  if (fields.length === 0) {
    return error(ctx, '没有要更新的字段', 400)
  }

  values.push(id)
  await db.update(
    `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
    values
  )

  await logAdminAction(ctx, 'update_user', 'users', id, ctx.request.body)
  success(ctx, null, '更新成功')
}

async function deleteUser(ctx) {
  const { id } = ctx.params
  const user = await db.queryOne('SELECT id FROM users WHERE id = ?', [id])
  if (!user) {
    return error(ctx, '用户不存在', 404)
  }

  await db.update('DELETE FROM users WHERE id = ?', [id])
  await logAdminAction(ctx, 'delete_user', 'users', id, null)
  success(ctx, null, '删除成功')
}

// ======================== 知识库管理 ========================

async function listKnowledgeBases(ctx) {
  const page = Math.max(1, parseInt(ctx.query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(ctx.query.pageSize) || 20))
  const search = (ctx.query.search || '').trim()

  let where = 'WHERE 1=1'
  const params = []
  if (search) {
    where += ` AND name LIKE ?`
    params.push(`%${search}%`)
  }

  const countRow = await db.queryOne(
    `SELECT COUNT(*) AS total FROM knowledge_bases ${where}`,
    params
  )

  const list = await db.queryRaw(
    `SELECT k.*, COUNT(d.id) AS document_count
     FROM knowledge_bases k
     LEFT JOIN documents d ON d.knowledge_base_id = k.id
     ${where}
     GROUP BY k.id
     ORDER BY k.sort_order ASC, k.id DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]
  )

  success(ctx, {
    list,
    pagination: {
      page,
      pageSize,
      total: countRow.total,
      totalPages: Math.ceil(countRow.total / pageSize)
    }
  })
}

async function createKnowledgeBase(ctx) {
  const { name, description, is_active } = ctx.request.body
  if (!name || !name.trim()) {
    return error(ctx, '请输入知识库名称', 400)
  }

  const cleanName = name.trim()
  const cleanDesc = (description || '').trim()
  if (!assertNoReplacementChar(cleanName, cleanDesc)) {
    return error(ctx, '名称或描述包含非法字符，请使用 UTF-8 编码提交', 400)
  }

  const id = await db.insert(
    'INSERT INTO knowledge_bases (name, description, is_active) VALUES (?, ?, ?)',
    [cleanName, cleanDesc, is_active !== false]
  )

  await logAdminAction(ctx, 'create_knowledge_base', 'knowledge_bases', id, ctx.request.body)
  success(ctx, { id }, '创建成功')
}

async function updateKnowledgeBase(ctx) {
  const { id } = ctx.params
  const { name, description, is_active, sort_order } = ctx.request.body

  const kb = await db.queryOne('SELECT id FROM knowledge_bases WHERE id = ?', [id])
  if (!kb) {
    return error(ctx, '知识库不存在', 404)
  }

  const fields = []
  const values = []

  if (name !== undefined) {
    const cleanName = name.trim()
    if (!cleanName) {
      return error(ctx, '知识库名称不能为空', 400)
    }
    if (!assertNoReplacementChar(cleanName)) {
      return error(ctx, '名称包含非法字符，请使用 UTF-8 编码提交', 400)
    }
    fields.push('name = ?')
    values.push(cleanName)
  }
  if (description !== undefined) {
    const cleanDesc = description.trim()
    if (!assertNoReplacementChar(cleanDesc)) {
      return error(ctx, '描述包含非法字符，请使用 UTF-8 编码提交', 400)
    }
    fields.push('description = ?')
    values.push(cleanDesc)
  }
  if (is_active !== undefined) {
    fields.push('is_active = ?')
    values.push(is_active)
  }
  if (sort_order !== undefined) {
    fields.push('sort_order = ?')
    values.push(sort_order)
  }

  if (fields.length === 0) {
    return error(ctx, '没有要更新的字段', 400)
  }

  values.push(id)
  await db.update(
    `UPDATE knowledge_bases SET ${fields.join(', ')} WHERE id = ?`,
    values
  )

  await logAdminAction(ctx, 'update_knowledge_base', 'knowledge_bases', id, ctx.request.body)
  success(ctx, null, '更新成功')
}

async function deleteKnowledgeBase(ctx) {
  const { id } = ctx.params
  const kb = await db.queryOne('SELECT id FROM knowledge_bases WHERE id = ?', [id])
  if (!kb) {
    return error(ctx, '知识库不存在', 404)
  }

  // 关联文档解除关联
  await db.update('UPDATE documents SET knowledge_base_id = NULL WHERE knowledge_base_id = ?', [id])
  await db.update('DELETE FROM knowledge_bases WHERE id = ?', [id])
  await logAdminAction(ctx, 'delete_knowledge_base', 'knowledge_bases', id, null)
  success(ctx, null, '删除成功')
}

// ======================== 文档管理 ========================

async function listDocuments(ctx) {
  const { id } = ctx.params
  const page = Math.max(1, parseInt(ctx.query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(ctx.query.pageSize) || 20))

  const kb = await db.queryOne('SELECT id FROM knowledge_bases WHERE id = ?', [id])
  if (!kb) {
    return error(ctx, '知识库不存在', 404)
  }

  const countRow = await db.queryOne(
    'SELECT COUNT(*) AS total FROM documents WHERE knowledge_base_id = ?',
    [id]
  )

  const list = await db.queryRaw(
    `SELECT id, original_name, file_type, file_size, file_url, parse_status,
            chunk_count, parse_error, is_public, metadata, created_at, updated_at, parsed_at
     FROM documents
     WHERE knowledge_base_id = ?
     ORDER BY id DESC
     LIMIT ? OFFSET ?`,
    [id, pageSize, (page - 1) * pageSize]
  )

  success(ctx, {
    list,
    pagination: {
      page,
      pageSize,
      total: countRow.total,
      totalPages: Math.ceil(countRow.total / pageSize)
    }
  })
}

async function uploadDocument(ctx) {
  const { id } = ctx.params
  const file = ctx.req.file

  if (!file) {
    return error(ctx, '请上传文件', 400)
  }

  const kb = await db.queryOne('SELECT id FROM knowledge_bases WHERE id = ?', [id])
  if (!kb) {
    return error(ctx, '知识库不存在', 404)
  }

  // 找一个兜底用户满足外键约束（后台上传的文档归属系统）
  const fallbackUser = await db.queryOne('SELECT id FROM users ORDER BY id ASC LIMIT 1')
  const userId = fallbackUser ? fallbackUser.id : 0

  const originalName = decodeFilename(file.originalname)

  const docId = await db.insert(
    `INSERT INTO documents
     (user_id, knowledge_base_id, filename, original_name, file_url, file_type, file_size, parse_status, is_public)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      id,
      file.filename,
      originalName,
      `/uploads/knowledge/${file.filename}`,
      file.mimetype,
      file.size,
      'pending',
      true
    ]
  )

  await logAdminAction(ctx, 'upload_document', 'documents', docId, {
    knowledgeBaseId: id,
    originalName
  })

  // 异步触发解析 → 切块 → embedding → 入库
  documentService.processDocumentAsync(docId)

  success(ctx, { id: docId }, '上传成功，正在后台解析')
}

async function deleteDocument(ctx) {
  const { id } = ctx.params
  const doc = await db.queryOne('SELECT * FROM documents WHERE id = ?', [id])
  if (!doc) {
    return error(ctx, '文档不存在', 404)
  }

  // 删除物理文件
  if (doc.file_url) {
    const filePath = path.join(config.upload.path, doc.file_url.replace('/uploads/', ''))
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    } catch (e) {
      logger.error('[Admin] 删除文档文件失败:', e.message)
    }
  }

  await db.update('DELETE FROM documents WHERE id = ?', [id])
  await logAdminAction(ctx, 'delete_document', 'documents', id, null)
  success(ctx, null, '删除成功')
}

async function reparseDocument(ctx) {
  const { id } = ctx.params
  const doc = await db.queryOne('SELECT id FROM documents WHERE id = ?', [id])
  if (!doc) {
    return error(ctx, '文档不存在', 404)
  }

  await db.update(
    "UPDATE documents SET parse_status = 'pending', parse_result = NULL, parse_error = NULL, chunk_count = 0, updated_at = NOW() WHERE id = ?",
    [id]
  )
  await db.update('DELETE FROM document_chunks WHERE document_id = ?', [id])

  // 异步重新解析
  documentService.processDocumentAsync(id)

  await logAdminAction(ctx, 'reparse_document', 'documents', id, null)
  success(ctx, null, '已重新加入解析队列')
}

// 重算向量：不重新解析文本，仅用当前向量模型重新生成 embedding 并回写 document_chunks
async function rebuildEmbedding(ctx) {
  const { id } = ctx.params
  const doc = await db.queryOne('SELECT id FROM documents WHERE id = ?', [id])
  if (!doc) {
    return error(ctx, '文档不存在', 404)
  }

  const chunks = await db.query(
    'SELECT id, content FROM document_chunks WHERE document_id = ? ORDER BY chunk_index ASC',
    [id]
  )
  if (chunks.length === 0) {
    return error(ctx, '该文档暂无分块，请先解析', 400)
  }

  try {
    const texts = chunks.map(c => c.content || '')
    const vectors = await embeddingService.embedTexts(texts)
    if (vectors.length !== chunks.length) {
      return error(ctx, `向量数量(${vectors.length})与分块数量(${chunks.length})不一致`, 500)
    }

    for (let i = 0; i < chunks.length; i++) {
      const vec = vectors[i] || []
      await db.update(
        'UPDATE document_chunks SET embedding = ?, embedding_dim = ? WHERE id = ?',
        [JSON.stringify(vec), vec.length, chunks[i].id]
      )
    }

    await logAdminAction(ctx, 'rebuild_embedding', 'documents', id, {
      model: embeddingService.EMBEDDING_MODEL,
      chunkCount: chunks.length
    })
    success(ctx, { chunkCount: chunks.length, model: embeddingService.EMBEDDING_MODEL }, '重算向量完成')
  } catch (e) {
    logger.error('[Admin] 重算向量失败:', e.message)
    return error(ctx, e.message || '重算向量失败', 500)
  }
}

// 查看文档分块
async function listDocumentChunks(ctx) {
  const { id } = ctx.params
  const page = Math.max(1, parseInt(ctx.query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(ctx.query.pageSize) || 20))

  const doc = await db.queryOne('SELECT id, original_name FROM documents WHERE id = ?', [id])
  if (!doc) {
    return error(ctx, '文档不存在', 404)
  }

  const countRow = await db.queryOne(
    'SELECT COUNT(*) AS total FROM document_chunks WHERE document_id = ?',
    [id]
  )

  const list = await db.queryRaw(
    `SELECT id, chunk_index, content, token_count, embedding_dim, created_at
     FROM document_chunks
     WHERE document_id = ?
     ORDER BY chunk_index ASC
     LIMIT ? OFFSET ?`,
    [id, pageSize, (page - 1) * pageSize]
  )

  success(ctx, {
    documentName: doc.original_name,
    list,
    pagination: {
      page,
      pageSize,
      total: countRow.total,
      totalPages: Math.ceil(countRow.total / pageSize)
    }
  })
}

// 知识库检索测试
async function searchKnowledgeBase(ctx) {
  const { id } = ctx.params
  const { query, topK, minScore } = ctx.request.body || {}

  if (!query || !query.trim()) {
    return error(ctx, '请输入查询内容', 400)
  }

  const kb = await db.queryOne('SELECT id FROM knowledge_bases WHERE id = ?', [id])
  if (!kb) {
    return error(ctx, '知识库不存在', 404)
  }

  try {
    const results = await retrievalService.search({
      query: query.trim(),
      knowledgeBaseId: parseInt(id, 10),
      topK: Math.min(20, Math.max(1, parseInt(topK, 10) || retrievalService.DEFAULT_TOP_K)),
      minScore: minScore !== undefined ? Number(minScore) : retrievalService.DEFAULT_MIN_SCORE
    })
    success(ctx, { results })
  } catch (e) {
    logger.error('[Admin] 检索测试失败:', e.message)
    return error(ctx, e.message || '检索失败', 500)
  }
}

async function updateDocument(ctx) {
  const { id } = ctx.params
  const { is_public } = ctx.request.body
  const doc = await db.queryOne('SELECT id FROM documents WHERE id = ?', [id])
  if (!doc) {
    return error(ctx, '文档不存在', 404)
  }

  await db.update(
    'UPDATE documents SET is_public = ? WHERE id = ?',
    [is_public !== false, id]
  )
  await logAdminAction(ctx, 'update_document', 'documents', id, ctx.request.body)
  success(ctx, null, '更新成功')
}

// ======================== 模型 Provider 配置 ========================

async function listProviders(ctx) {
  const rows = await db.query(
    'SELECT * FROM model_providers ORDER BY sort_order ASC, id DESC'
  )
  success(ctx, rows.map(formatProvider))
}

async function listProviderPresets(ctx) {
  success(ctx, PROVIDER_PRESETS)
}

async function createProvider(ctx) {
  const { provider, api_key, is_active, sort_order } = ctx.request.body

  const preset = getProviderPreset(provider)
  if (!preset) {
    return error(ctx, '请选择内置 Provider', 400)
  }

  if (!api_key) {
    return error(ctx, '请输入 API Key', 400)
  }

  const existing = await db.queryOne('SELECT id FROM model_providers WHERE provider = ?', [provider])
  if (existing) {
    return error(ctx, 'Provider 已存在', 400)
  }

  const id = await db.insert(
    `INSERT INTO model_providers (provider, name, api_key, base_url, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [provider, preset.name, api_key, preset.base_url, is_active !== false, sort_order || 0]
  )

  await logAdminAction(ctx, 'create_model_provider', 'model_providers', id, { provider, name: preset.name })
  success(ctx, { id }, '创建成功')
}

async function updateProvider(ctx) {
  const { id } = ctx.params
  const { name, api_key, base_url, is_active, sort_order } = ctx.request.body

  const provider = await db.queryOne('SELECT * FROM model_providers WHERE id = ?', [id])
  if (!provider) {
    return error(ctx, 'Provider 不存在', 404)
  }

  const isPreset = !!getProviderPreset(provider.provider)

  const fields = []
  const values = []

  if (!isPreset && name !== undefined) {
    fields.push('name = ?')
    values.push(name)
  }
  if (api_key !== undefined) {
    fields.push('api_key = ?')
    values.push(api_key)
  }
  if (!isPreset && base_url !== undefined) {
    fields.push('base_url = ?')
    values.push(base_url)
  }
  if (is_active !== undefined) {
    fields.push('is_active = ?')
    values.push(is_active)
  }
  if (sort_order !== undefined) {
    fields.push('sort_order = ?')
    values.push(sort_order)
  }

  if (fields.length === 0) {
    return error(ctx, '没有要更新的字段', 400)
  }

  values.push(id)
  await db.update(
    `UPDATE model_providers SET ${fields.join(', ')} WHERE id = ?`,
    values
  )

  await logAdminAction(ctx, 'update_model_provider', 'model_providers', id, ctx.request.body)
  success(ctx, null, '更新成功')
}

async function deleteProvider(ctx) {
  const { id } = ctx.params
  const provider = await db.queryOne('SELECT id FROM model_providers WHERE id = ?', [id])
  if (!provider) {
    return error(ctx, 'Provider 不存在', 404)
  }

  await db.update('DELETE FROM model_providers WHERE id = ?', [id])
  await logAdminAction(ctx, 'delete_model_provider', 'model_providers', id, null)
  success(ctx, null, '删除成功')
}

async function testProvider(ctx) {
  const { id } = ctx.params
  const provider = await db.queryOne('SELECT * FROM model_providers WHERE id = ?', [id])
  if (!provider) {
    return error(ctx, 'Provider 不存在', 404)
  }

  if (!provider.is_active) {
    return error(ctx, 'Provider 已禁用', 400)
  }

  const start = Date.now()
  try {
    const url = getRemoteModelsUrl(provider.provider, provider.base_url)
    let headers = {}

    if (provider.provider === 'claude') {
      headers = {
        'x-api-key': provider.api_key,
        'anthropic-version': '2023-06-01'
      }
    } else {
      headers = { 'Authorization': `Bearer ${provider.api_key}` }
    }

    const res = await fetch(url, {
      method: 'GET',
      headers
    })

    if (!res.ok) {
      const text = await res.text()
      return success(ctx, {
        success: false,
        latency: Date.now() - start,
        error: text || '请求失败'
      })
    }

    return success(ctx, {
      success: true,
      latency: Date.now() - start
    })
  } catch (e) {
    return success(ctx, {
      success: false,
      latency: Date.now() - start,
      error: e.message
    })
  }
}

// ======================== 模型管理 ========================

async function listModels(ctx) {
  const rows = await db.query(
    'SELECT * FROM ai_models ORDER BY sort_order ASC, id ASC'
  )
  success(ctx, rows)
}

async function updateModel(ctx) {
  const { id } = ctx.params
  const { name, provider, model_id, description, is_active, is_default, max_tokens, sort_order, supports_vision, supports_web_search } = ctx.request.body

  const model = await db.queryOne('SELECT id FROM ai_models WHERE id = ?', [id])
  if (!model) {
    return error(ctx, '模型不存在', 404)
  }

  const fields = []
  const values = []

  if (name !== undefined) {
    fields.push('name = ?')
    values.push(name)
  }
  if (provider !== undefined) {
    if (!getProviderPreset(provider)) {
      return error(ctx, '请选择内置厂商', 400)
    }
    fields.push('provider = ?')
    values.push(provider)
  }
  if (model_id !== undefined) {
    const existing = await db.queryOne('SELECT id FROM ai_models WHERE model_id = ? AND id != ?', [model_id, id])
    if (existing) {
      return error(ctx, '模型 ID 已存在', 400)
    }
    fields.push('model_id = ?')
    values.push(model_id)
  }
  if (description !== undefined) {
    fields.push('description = ?')
    values.push(description)
  }
  if (is_active !== undefined) {
    fields.push('is_active = ?')
    values.push(is_active)
  }
  if (is_default !== undefined) {
    fields.push('is_default = ?')
    values.push(is_default)
  }
  if (max_tokens !== undefined) {
    fields.push('max_tokens = ?')
    values.push(max_tokens)
  }
  if (sort_order !== undefined) {
    fields.push('sort_order = ?')
    values.push(sort_order)
  }
  if (supports_vision !== undefined) {
    fields.push('supports_vision = ?')
    values.push(supports_vision)
  }
  if (supports_web_search !== undefined) {
    fields.push('supports_web_search = ?')
    values.push(supports_web_search)
  }

  if (fields.length === 0) {
    return error(ctx, '没有要更新的字段', 400)
  }

  await db.transaction(async (conn) => {
    if (is_default) {
      await conn.execute('UPDATE ai_models SET is_default = FALSE')
    }
    await conn.execute(
      `UPDATE ai_models SET ${fields.join(', ')} WHERE id = ?`,
      [...values, id]
    )
  })

  await logAdminAction(ctx, 'update_model', 'ai_models', id, ctx.request.body)
  success(ctx, null, '更新成功')
}

async function createModel(ctx) {
  const { name, provider, model_id, description, is_active, is_default, max_tokens, sort_order, supports_vision, supports_web_search } = ctx.request.body

  if (!name || !provider || !model_id) {
    return error(ctx, '请填写模型名称、厂商和模型 ID', 400)
  }

  if (!getProviderPreset(provider)) {
    return error(ctx, '请选择内置厂商', 400)
  }

  const existing = await db.queryOne('SELECT id FROM ai_models WHERE model_id = ?', [model_id])
  if (existing) {
    return error(ctx, '模型 ID 已存在', 400)
  }

  let newId
  await db.transaction(async (conn) => {
    if (is_default) {
      await conn.execute('UPDATE ai_models SET is_default = FALSE')
    }
    const [result] = await conn.execute(
      `INSERT INTO ai_models (name, provider, model_id, description, is_active, is_default, max_tokens, sort_order, supports_vision, supports_web_search)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, provider, model_id, description || '', is_active !== false, is_default === true, max_tokens || 4096, sort_order || 0, supports_vision === true, supports_web_search === true]
    )
    newId = result.insertId
  })

  await logAdminAction(ctx, 'create_model', 'ai_models', newId, ctx.request.body)
  success(ctx, { id: newId }, '创建成功')
}

async function deleteModel(ctx) {
  const { id } = ctx.params
  const model = await db.queryOne('SELECT id FROM ai_models WHERE id = ?', [id])
  if (!model) {
    return error(ctx, '模型不存在', 404)
  }

  await db.update('DELETE FROM ai_models WHERE id = ?', [id])
  await logAdminAction(ctx, 'delete_model', 'ai_models', id, null)
  success(ctx, null, '删除成功')
}

// ======================== 绘图模型管理 ========================

async function listImageModels(ctx) {
  const rows = await db.query(
    'SELECT * FROM image_models ORDER BY sort_order ASC, id ASC'
  )
  success(ctx, rows)
}

async function createImageModel(ctx) {
  const { name, provider, model_id, description, is_active, is_default, sort_order, supported_sizes, supported_styles, config } = ctx.request.body

  if (!name || !provider || !model_id) {
    return error(ctx, '请填写模型名称、厂商和模型 ID', 400)
  }

  if (!getProviderPreset(provider)) {
    return error(ctx, '请选择内置厂商', 400)
  }

  const existing = await db.queryOne('SELECT id FROM image_models WHERE model_id = ?', [model_id])
  if (existing) {
    return error(ctx, '模型 ID 已存在', 400)
  }

  let newId
  await db.transaction(async (conn) => {
    if (is_default) {
      await conn.execute('UPDATE image_models SET is_default = FALSE')
    }
    const [result] = await conn.execute(
      `INSERT INTO image_models (name, provider, model_id, description, is_active, is_default, sort_order, supported_sizes, supported_styles, config)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, provider, model_id, description || '', is_active !== false, is_default === true, sort_order || 0, JSON.stringify(supported_sizes || []), JSON.stringify(supported_styles || []), JSON.stringify(config || {})]
    )
    newId = result.insertId
  })

  await logAdminAction(ctx, 'create_image_model', 'image_models', newId, ctx.request.body)
  success(ctx, { id: newId }, '创建成功')
}

async function updateImageModel(ctx) {
  const { id } = ctx.params
  const { name, provider, model_id, description, is_active, is_default, sort_order, supported_sizes, supported_styles, config } = ctx.request.body

  const model = await db.queryOne('SELECT id FROM image_models WHERE id = ?', [id])
  if (!model) {
    return error(ctx, '绘图模型不存在', 404)
  }

  if (provider !== undefined && !getProviderPreset(provider)) {
    return error(ctx, '请选择内置厂商', 400)
  }

  const fields = []
  const values = []

  if (name !== undefined) { fields.push('name = ?'); values.push(name) }
  if (provider !== undefined) { fields.push('provider = ?'); values.push(provider) }
  if (model_id !== undefined) {
    const existing = await db.queryOne('SELECT id FROM image_models WHERE model_id = ? AND id != ?', [model_id, id])
    if (existing) {
      return error(ctx, '模型 ID 已存在', 400)
    }
    fields.push('model_id = ?'); values.push(model_id)
  }
  if (description !== undefined) { fields.push('description = ?'); values.push(description) }
  if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active) }
  if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(sort_order) }
  if (supported_sizes !== undefined) { fields.push('supported_sizes = ?'); values.push(JSON.stringify(supported_sizes)) }
  if (supported_styles !== undefined) { fields.push('supported_styles = ?'); values.push(JSON.stringify(supported_styles)) }
  if (config !== undefined) { fields.push('config = ?'); values.push(JSON.stringify(config)) }

  if (fields.length === 0) {
    return error(ctx, '没有要更新的字段', 400)
  }

  await db.transaction(async (conn) => {
    if (is_default) {
      await conn.execute('UPDATE image_models SET is_default = FALSE')
    }
    await conn.execute(
      `UPDATE image_models SET ${fields.join(', ')} WHERE id = ?`,
      [...values, id]
    )
  })

  await logAdminAction(ctx, 'update_image_model', 'image_models', id, ctx.request.body)
  success(ctx, null, '更新成功')
}

async function deleteImageModel(ctx) {
  const { id } = ctx.params
  const model = await db.queryOne('SELECT id FROM image_models WHERE id = ?', [id])
  if (!model) {
    return error(ctx, '绘图模型不存在', 404)
  }

  await db.update('DELETE FROM image_models WHERE id = ?', [id])
  await logAdminAction(ctx, 'delete_image_model', 'image_models', id, null)
  success(ctx, null, '删除成功')
}

// ======================== 系统设置 ========================

async function listSystemSettings(ctx) {
  const rows = await db.query('SELECT `key`, `value`, description, updated_at FROM system_settings ORDER BY `key` ASC')
  success(ctx, rows)
}

async function updateSystemSetting(ctx) {
  const { key, value } = ctx.request.body
  if (!key || value === undefined) {
    return error(ctx, '请提供 key 和 value', 400)
  }

  await db.update(
    'INSERT INTO system_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
    [key, String(value)]
  )

  await logAdminAction(ctx, 'update_system_setting', 'system_settings', key, ctx.request.body)
  success(ctx, null, '更新成功')
}

// ======================== 首页推荐语配置 ========================

async function listRemoteModels(ctx) {
  const { id } = ctx.params
  const provider = await db.queryOne('SELECT * FROM model_providers WHERE id = ?', [id])
  if (!provider) {
    return error(ctx, 'Provider 不存在', 404)
  }
  if (!provider.api_key) {
    return error(ctx, '请先配置 Provider 的 API Key', 400)
  }

  let url
  let headers = {}

  if (provider.provider === 'claude') {
    url = `${provider.base_url}/v1/models`
    headers = {
      'x-api-key': provider.api_key,
      'anthropic-version': '2023-06-01'
    }
  } else {
    url = getRemoteModelsUrl(provider.provider, provider.base_url)
    headers = { 'Authorization': `Bearer ${provider.api_key}` }
  }

  try {
    const res = await fetch(url, { method: 'GET', headers })
    if (!res.ok) {
      const text = await res.text()
      return error(ctx, `拉取模型列表失败: ${text || res.statusText}`, 500)
    }
    const data = await res.json()
    const list = (data.data || []).map(m => ({
      id: m.id,
      name: m.display_name || m.id
    }))
    success(ctx, list)
  } catch (e) {
    logger.error(`[Admin] 拉取 ${provider.provider} 模型列表失败:`, e.message)
    return error(ctx, `拉取模型列表失败: ${e.message}`, 500)
  }
}

async function listPromptSuggestions(ctx) {
  const rows = await db.query(
    'SELECT id, title, prompt, is_active, sort_order, created_at FROM prompt_suggestions ORDER BY sort_order ASC, id ASC'
  )
  success(ctx, rows)
}

async function createPromptSuggestion(ctx) {
  const { title, prompt, is_active, sort_order } = ctx.request.body
  if (!title || !title.trim() || !prompt || !prompt.trim()) {
    return error(ctx, '请输入标题和提示词内容', 400)
  }

  const id = await db.insert(
    `INSERT INTO prompt_suggestions (title, prompt, is_active, sort_order)
     VALUES (?, ?, ?, ?)`,
    [title.trim(), prompt.trim(), is_active !== false, sort_order || 0]
  )

  await logAdminAction(ctx, 'create_prompt_suggestion', 'prompt_suggestions', id, ctx.request.body)
  success(ctx, { id }, '创建成功')
}

async function updatePromptSuggestion(ctx) {
  const { id } = ctx.params
  const { title, prompt, is_active, sort_order } = ctx.request.body

  const item = await db.queryOne('SELECT id FROM prompt_suggestions WHERE id = ?', [id])
  if (!item) {
    return error(ctx, '推荐语不存在', 404)
  }

  const fields = []
  const values = []

  if (title !== undefined) {
    const cleanTitle = title.trim()
    if (!cleanTitle) {
      return error(ctx, '标题不能为空', 400)
    }
    fields.push('title = ?')
    values.push(cleanTitle)
  }
  if (prompt !== undefined) {
    const cleanPrompt = prompt.trim()
    if (!cleanPrompt) {
      return error(ctx, '提示词内容不能为空', 400)
    }
    fields.push('prompt = ?')
    values.push(cleanPrompt)
  }
  if (is_active !== undefined) {
    fields.push('is_active = ?')
    values.push(is_active)
  }
  if (sort_order !== undefined) {
    fields.push('sort_order = ?')
    values.push(sort_order)
  }

  if (fields.length === 0) {
    return error(ctx, '没有要更新的字段', 400)
  }

  values.push(id)
  await db.update(
    `UPDATE prompt_suggestions SET ${fields.join(', ')} WHERE id = ?`,
    values
  )

  await logAdminAction(ctx, 'update_prompt_suggestion', 'prompt_suggestions', id, ctx.request.body)
  success(ctx, null, '更新成功')
}

async function deletePromptSuggestion(ctx) {
  const { id } = ctx.params
  const item = await db.queryOne('SELECT id FROM prompt_suggestions WHERE id = ?', [id])
  if (!item) {
    return error(ctx, '推荐语不存在', 404)
  }

  await db.update('DELETE FROM prompt_suggestions WHERE id = ?', [id])
  await logAdminAction(ctx, 'delete_prompt_suggestion', 'prompt_suggestions', id, null)
  success(ctx, null, '删除成功')
}

// ======================== 语音通话厂商配置 ========================

async function listVoiceProviderPresets(ctx) {
  success(ctx, VOICE_PROVIDER_PRESETS)
}

async function listVoiceProviders(ctx) {
  const rows = await db.query(
    'SELECT * FROM voice_providers ORDER BY sort_order ASC, id DESC'
  )
  success(ctx, rows.map(formatVoiceProvider))
}

async function createVoiceProvider(ctx) {
  const { provider, api_key, is_active, sort_order } = ctx.request.body

  const preset = getVoiceProviderPreset(provider)
  if (!preset) {
    return error(ctx, '请选择内置语音厂商', 400)
  }

  if (!api_key) {
    return error(ctx, '请输入 API Key', 400)
  }

  const existing = await db.queryOne('SELECT id FROM voice_providers WHERE provider = ?', [provider])
  if (existing) {
    return error(ctx, '语音厂商已存在', 400)
  }

  const defaultVoice = preset.voices[0] || null
  const id = await db.insert(
    `INSERT INTO voice_providers (provider, name, api_key, base_url, realtime_model, default_voice, is_active, is_current, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [provider, preset.name, api_key, preset.base_url, preset.realtime_model, defaultVoice, is_active !== false, false, sort_order || 0]
  )

  await logAdminAction(ctx, 'create_voice_provider', 'voice_providers', id, { provider, name: preset.name })
  success(ctx, { id }, '创建成功')
}

async function updateVoiceProvider(ctx) {
  const { id } = ctx.params
  const { api_key, base_url, realtime_model, default_voice, is_active, sort_order } = ctx.request.body

  const provider = await db.queryOne('SELECT * FROM voice_providers WHERE id = ?', [id])
  if (!provider) {
    return error(ctx, '语音厂商不存在', 404)
  }

  const preset = getVoiceProviderPreset(provider.provider)
  const validVoices = preset?.voices || []

  const fields = []
  const values = []

  if (api_key !== undefined) {
    fields.push('api_key = ?')
    values.push(api_key)
  }
  if (base_url !== undefined) {
    fields.push('base_url = ?')
    values.push(base_url)
  }
  if (realtime_model !== undefined) {
    fields.push('realtime_model = ?')
    values.push(realtime_model)
  }
  if (default_voice !== undefined) {
    if (validVoices.length > 0 && !validVoices.includes(default_voice)) {
      return error(ctx, `无效音色，可选: ${validVoices.join(', ')}`, 400)
    }
    fields.push('default_voice = ?')
    values.push(default_voice)
  }
  if (is_active !== undefined) {
    fields.push('is_active = ?')
    values.push(is_active)
  }
  if (sort_order !== undefined) {
    fields.push('sort_order = ?')
    values.push(sort_order)
  }

  if (fields.length === 0) {
    return error(ctx, '没有要更新的字段', 400)
  }

  values.push(id)
  await db.update(
    `UPDATE voice_providers SET ${fields.join(', ')} WHERE id = ?`,
    values
  )

  await logAdminAction(ctx, 'update_voice_provider', 'voice_providers', id, ctx.request.body)
  success(ctx, null, '更新成功')
}

async function deleteVoiceProvider(ctx) {
  const { id } = ctx.params
  const provider = await db.queryOne('SELECT * FROM voice_providers WHERE id = ?', [id])
  if (!provider) {
    return error(ctx, '语音厂商不存在', 404)
  }

  if (provider.is_current) {
    return error(ctx, '不能删除当前正在使用的语音厂商，请先切换', 400)
  }

  await db.update('DELETE FROM voice_providers WHERE id = ?', [id])
  await logAdminAction(ctx, 'delete_voice_provider', 'voice_providers', id, null)
  success(ctx, null, '删除成功')
}

async function setCurrentVoiceProvider(ctx) {
  const { id } = ctx.params
  const provider = await db.queryOne('SELECT * FROM voice_providers WHERE id = ?', [id])
  if (!provider) {
    return error(ctx, '语音厂商不存在', 404)
  }
  if (!provider.is_active) {
    return error(ctx, '该语音厂商已禁用', 400)
  }
  if (!provider.api_key) {
    return error(ctx, '请先配置该厂商的 API Key', 400)
  }

  await db.transaction(async (conn) => {
    await conn.execute('UPDATE voice_providers SET is_current = FALSE')
    await conn.execute('UPDATE voice_providers SET is_current = TRUE WHERE id = ?', [id])
  })

  await logAdminAction(ctx, 'set_current_voice_provider', 'voice_providers', id, { provider: provider.provider })
  success(ctx, null, '已设为当前语音厂商')
}

function getVoiceProviderWsUrl(provider, preset, row) {
  const model = row.realtime_model || preset.realtime_model
  if (provider === 'qwen') {
    return `${row.base_url || preset.base_url}/api-ws/v1/realtime?model=${model}`
  }
  if (provider === 'openai') {
    return `${row.base_url || preset.base_url}/v1/realtime?model=${model}`
  }
  if (provider === 'gemini') {
    return `${row.base_url || preset.base_url}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${row.api_key}`
  }
  // 豆包实时语音 URL 需根据实际文档调整
  return `${row.base_url || preset.base_url}/realtime?model=${model}`
}

async function testVoiceProvider(ctx) {
  const { id } = ctx.params
  const row = await db.queryOne('SELECT * FROM voice_providers WHERE id = ?', [id])
  if (!row) {
    return error(ctx, '语音厂商不存在', 404)
  }
  if (!row.is_active) {
    return error(ctx, '该语音厂商已禁用', 400)
  }
  if (!row.api_key) {
    return error(ctx, '请先配置 API Key', 400)
  }

  const preset = getVoiceProviderPreset(row.provider)
  if (!preset) {
    return error(ctx, '未知语音厂商', 400)
  }

  const url = getVoiceProviderWsUrl(row.provider, preset, row)
  const start = Date.now()

  try {
    const headers = {}
    if (row.provider !== 'gemini') {
      headers.Authorization = `Bearer ${row.api_key}`
    }

    await new Promise((resolve, reject) => {
      const ws = new WebSocket(url, { headers })
      const timeout = setTimeout(() => {
        ws.terminate()
        reject(new Error('连接超时'))
      }, 10000)

      ws.once('open', () => {
        clearTimeout(timeout)
        ws.close()
        resolve()
      })

      ws.once('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })
    })

    return success(ctx, {
      success: true,
      latency: Date.now() - start
    })
  } catch (e) {
    return success(ctx, {
      success: false,
      latency: Date.now() - start,
      error: e.message
    })
  }
}

module.exports = {
  login,
  profile,
  logout,
  stats,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
  listKnowledgeBases,
  createKnowledgeBase,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  listDocuments,
  uploadDocument,
  deleteDocument,
  reparseDocument,
  rebuildEmbedding,
  updateDocument,
  listDocumentChunks,
  searchKnowledgeBase,
  knowledgeUpload,
  listProviders,
  listProviderPresets,
  createProvider,
  updateProvider,
  deleteProvider,
  testProvider,
  listRemoteModels,
  listModels,
  createModel,
  updateModel,
  deleteModel,
  listImageModels,
  createImageModel,
  updateImageModel,
  deleteImageModel,
  listSystemSettings,
  updateSystemSetting,
  listPromptSuggestions,
  createPromptSuggestion,
  updatePromptSuggestion,
  deletePromptSuggestion,
  listVoiceProviders,
  listVoiceProviderPresets,
  createVoiceProvider,
  updateVoiceProvider,
  deleteVoiceProvider,
  setCurrentVoiceProvider,
  testVoiceProvider
}
