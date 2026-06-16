const db = require('../utils/db')
const { success, error } = require('../utils/response')
const aiService = require('../services/ai.service')
const logger = require('../utils/logger')
const multer = require('koa-multer')
const sharp = require('sharp')
const path = require('path')
const fs = require('fs')
const config = require('../config')

// 聊天图片上传配置
const chatImageDir = path.join(config.upload.path, 'chat-images')
if (!fs.existsSync(chatImageDir)) {
  fs.mkdirSync(chatImageDir, { recursive: true })
}

const chatImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, chatImageDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.tmp'
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`)
  }
})

const chatImageUpload = multer({
  storage: chatImageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('只允许上传图片文件'), false)
    }
  }
})

/**
 * 压缩聊天图片并转为 WebP
 */
async function compressChatImage(inputPath) {
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`
  const outputPath = path.join(chatImageDir, filename)

  await sharp(inputPath)
    .resize({
      width: 1536,
      height: 1536,
      fit: sharp.fit.inside,
      withoutEnlargement: true
    })
    .webp({ quality: 80 })
    .toFile(outputPath)

  // 删除原始文件
  try {
    fs.unlinkSync(inputPath)
  } catch (e) {
    logger.error('[Chat] 删除原图失败:', e.message)
  }

  return {
    filename,
    url: `/uploads/chat-images/${filename}`,
    size: fs.statSync(outputPath).size
  }
}

/**
 * 上传聊天图片
 */
async function uploadChatImage(ctx) {
  const file = ctx.req.file
  if (!file) {
    return error(ctx, '请上传图片', 400)
  }

  try {
    const result = await compressChatImage(file.path)
    success(ctx, { url: result.url, size: result.size }, '上传成功')
  } catch (e) {
    logger.error('[Chat] 图片压缩失败:', e.message)
    return error(ctx, '图片处理失败', 500)
  }
}

/**
 * 获取可用模型列表
 */
async function getModels(ctx) {
  const rows = await db.query(
    `SELECT id, name, provider, model_id, description, max_tokens, is_default, supports_vision, supports_web_search
     FROM ai_models
     WHERE is_active = TRUE
     ORDER BY sort_order ASC, id ASC`
  )

  const models = rows.map(row => ({
    id: row.model_id,
    name: row.name,
    provider: row.provider,
    description: row.description || '',
    maxTokens: row.max_tokens,
    isDefault: !!row.is_default,
    supportsVision: !!row.supports_vision,
    supportsWebSearch: !!row.supports_web_search
  }))

  success(ctx, models)
}

/**
 * 获取首页推荐语列表
 */
async function getPromptSuggestions(ctx) {
  const rows = await db.query(
    `SELECT id, title, prompt, sort_order
     FROM prompt_suggestions
     WHERE is_active = TRUE
     ORDER BY sort_order ASC, id ASC
     LIMIT 20`
  )
  success(ctx, rows)
}

/**
 * 获取会话列表
 */
async function getConversations(ctx) {
  const userId = ctx.state.user.userId
  const { page = 1, pageSize = 20 } = ctx.query

  const offset = (Number(page) - 1) * Number(pageSize)

  const conversations = await db.query(
    `SELECT c.*, a.name as agent_name, a.avatar as agent_avatar,
            (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
     FROM conversations c
     LEFT JOIN agents a ON c.agent_id = a.id
     WHERE c.user_id = ? AND c.status = 1
     ORDER BY c.is_pinned DESC, c.last_message_at DESC
     LIMIT ${Number(pageSize)} OFFSET ${offset}`,
    [userId]
  )

  success(ctx, conversations)
}

/**
 * 创建会话
 */
async function createConversation(ctx) {
  const userId = ctx.state.user.userId
  const { title, agentId, model = 'deepseek-v4-pro' } = ctx.request.body

  const conversationId = await db.insert(
    'INSERT INTO conversations (user_id, title, agent_id, model) VALUES (?, ?, ?, ?)',
    [userId, title || '新对话', agentId || null, model]
  )

  const conversation = await db.queryOne(
    'SELECT * FROM conversations WHERE id = ?',
    [conversationId]
  )

  success(ctx, conversation, '创建成功')
}

/**
 * 获取会话详情
 */
async function getConversationDetail(ctx) {
  const userId = ctx.state.user.userId
  const { id } = ctx.params

  const conversation = await db.queryOne(
    `SELECT c.*, a.name as agent_name, a.avatar as agent_avatar,
            a.system_prompt, a.welcome_message
     FROM conversations c
     LEFT JOIN agents a ON c.agent_id = a.id
     WHERE c.id = ? AND c.user_id = ?`,
    [id, userId]
  )

  if (!conversation) {
    return error(ctx, '会话不存在', 404)
  }

  success(ctx, conversation)
}

/**
 * 更新会话
 */
async function updateConversation(ctx) {
  const userId = ctx.state.user.userId
  const { id } = ctx.params
  const { title, isPinned } = ctx.request.body

  const updates = []
  const values = []

  if (title !== undefined) {
    updates.push('title = ?')
    values.push(title)
  }
  if (isPinned !== undefined) {
    updates.push('is_pinned = ?')
    values.push(isPinned ? 1 : 0)
  }

  if (updates.length === 0) {
    return success(ctx, null, '无需更新')
  }

  values.push(id, userId)

  await db.update(
    `UPDATE conversations SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
    values
  )

  success(ctx, null, '更新成功')
}

/**
 * 删除会话
 */
async function deleteConversation(ctx) {
  const userId = ctx.state.user.userId
  const { id } = ctx.params

  await db.update(
    'UPDATE conversations SET status = 0 WHERE id = ? AND user_id = ?',
    [id, userId]
  )

  success(ctx, null, '删除成功')
}

/**
 * 获取消息列表
 */
async function getMessages(ctx) {
  const userId = ctx.state.user.userId
  const { id } = ctx.params
  const { page = 1, pageSize = 50 } = ctx.query

  // 验证会话归属
  const conversation = await db.queryOne(
    'SELECT id FROM conversations WHERE id = ? AND user_id = ?',
    [id, userId]
  )

  if (!conversation) {
    return error(ctx, '会话不存在', 404)
  }

  const msgOffset = (Number(page) - 1) * Number(pageSize)

  const messages = await db.query(
    `SELECT * FROM messages
     WHERE conversation_id = ?
     ORDER BY created_at ASC
     LIMIT ${Number(pageSize)} OFFSET ${msgOffset}`,
    [id]
  )

  success(ctx, messages)
}

/**
 * 发送消息（非流式）
 */
async function sendMessage(ctx) {
  const userId = ctx.state.user.userId
  const { conversationId, content, model } = ctx.request.body

  if (!isValidContent(content)) {
    return error(ctx, '消息内容不能为空', 400)
  }

  // 获取会话信息
  const conversation = await db.queryOne(
    `SELECT c.*, a.system_prompt
     FROM conversations c
     LEFT JOIN agents a ON c.agent_id = a.id
     WHERE c.id = ? AND c.user_id = ?`,
    [conversationId, userId]
  )

  if (!conversation) {
    return error(ctx, '会话不存在', 404)
  }

  const useModel = model || conversation.model || 'deepseek-v4-pro'
  const modelInfo = await aiService.getModelInfo(useModel)
  if (hasImagePart(content) && modelInfo && !modelInfo.supports_vision) {
    return error(ctx, '当前模型不支持图片', 400)
  }

  const { content: contentStr, contentType } = serializeContent(content)

  // 保存用户消息
  await db.insert(
    'INSERT INTO messages (conversation_id, role, content, content_type) VALUES (?, ?, ?, ?)',
    [conversationId, 'user', contentStr, contentType]
  )

  // 构建消息历史
  const messages = resolveImageUrls(await buildMessageHistory(conversation), ctx.origin)

  // 调用AI
  const response = await aiService.chatCompletion(useModel, messages)

  const assistantContent = response.choices?.[0]?.message?.content || ''

  // 保存AI回复
  const assistantMessageId = await db.insert(
    'INSERT INTO messages (conversation_id, role, content, content_type, model, tokens_used) VALUES (?, ?, ?, ?, ?, ?)',
    [conversationId, 'assistant', assistantContent, 'text', useModel, response.usage?.total_tokens || 0]
  )

  // 更新会话最后消息时间
  await db.update(
    'UPDATE conversations SET last_message_at = NOW() WHERE id = ?',
    [conversationId]
  )

  const assistantMessage = await db.queryOne(
    'SELECT * FROM messages WHERE id = ?',
    [assistantMessageId]
  )

  success(ctx, assistantMessage)
}

/**
 * 流式对话
 */
async function streamChat(ctx) {
  const userId = ctx.state.user.userId
  const { conversationId, content, model } = ctx.request.body

  if (!isValidContent(content)) {
    return error(ctx, '消息内容不能为空', 400)
  }

  // 获取会话
  const conversation = await db.queryOne(
    `SELECT c.*, a.system_prompt
     FROM conversations c
     LEFT JOIN agents a ON c.agent_id = a.id
     WHERE c.id = ? AND c.user_id = ?`,
    [conversationId, userId]
  )

  if (!conversation) {
    return error(ctx, '会话不存在', 404)
  }

  const useModel = model || conversation.model || 'deepseek-v4-pro'
  const modelInfo = await aiService.getModelInfo(useModel)
  if (hasImagePart(content) && modelInfo && !modelInfo.supports_vision) {
    return error(ctx, '当前模型不支持图片', 400)
  }

  const { content: contentStr, contentType } = serializeContent(content)

  // 保存用户消息
  await db.insert(
    'INSERT INTO messages (conversation_id, role, content, content_type) VALUES (?, ?, ?, ?)',
    [conversationId, 'user', contentStr, contentType]
  )

  // 设置SSE响应头
  ctx.status = 200
  ctx.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  })
  ctx.respond = false

  const requestOrigin = ctx.origin
  const messages = resolveImageUrls(await buildMessageHistory(conversation), requestOrigin)

  let fullContent = ''
  const messageId = Date.now().toString()

  try {
    const stream = aiService.streamChatCompletion(useModel, messages)

    for await (const chunk of stream) {
      fullContent += chunk
      ctx.res.write(`data: ${JSON.stringify({
        id: messageId,
        text: chunk,
        done: false
      })}\n\n`)
    }

    // 保存AI回复
    await db.insert(
      'INSERT INTO messages (conversation_id, role, content, content_type, model, status) VALUES (?, ?, ?, ?, ?, ?)',
      [conversationId, 'assistant', fullContent, 'text', useModel, 'completed']
    )

    // 更新会话
    const title = conversation.title === '新对话' ? extractTextPreview(content, 20) : conversation.title
    await db.update(
      'UPDATE conversations SET last_message_at = NOW(), title = ? WHERE id = ?',
      [title, conversationId]
    )

    ctx.res.write(`data: ${JSON.stringify({
      id: messageId,
      text: '',
      done: true
    })}\n\n`)

  } catch (err) {
    logger.error('流式对话错误:', err)
    ctx.res.write(`data: ${JSON.stringify({
      id: messageId,
      error: err.message,
      done: true
    })}\n\n`)
  }

  ctx.res.end()
}

/**
 * 判断消息内容是否有效
 */
function isValidContent(content) {
  if (content === null || content === undefined) return false
  if (typeof content === 'string') return content.trim().length > 0
  if (Array.isArray(content)) return content.length > 0
  return false
}

/**
 * 序列化消息内容用于存储
 */
function serializeContent(content) {
  if (typeof content === 'string') {
    return { content, contentType: 'text' }
  }
  if (Array.isArray(content)) {
    return { content: JSON.stringify(content), contentType: 'mixed' }
  }
  return { content: String(content), contentType: 'text' }
}

/**
 * 反序列化数据库消息
 */
function deserializeMessage(msg) {
  if (msg.content_type === 'text' || !msg.content_type) {
    return { role: msg.role, content: msg.content }
  }
  try {
    return { role: msg.role, content: JSON.parse(msg.content) }
  } catch (e) {
    return { role: msg.role, content: msg.content }
  }
}

/**
 * 内容中是否包含图片
 */
function hasImagePart(content) {
  if (typeof content === 'string' || !Array.isArray(content)) return false
  return content.some(part => part && part.type === 'image_url')
}

/**
 * 提取文本预览（用于生成会话标题）
 */
function extractTextPreview(content, maxLen = 20) {
  if (typeof content === 'string') return content.slice(0, maxLen)
  if (Array.isArray(content)) {
    return content
      .filter(part => part && part.type === 'text')
      .map(part => part.text)
      .join('')
      .slice(0, maxLen)
  }
  return ''
}

/**
 * 将消息内容转换为模型需要的格式
 * keepImages 为 false 时，图片会被替换为 [图片] 占位文字
 */
function formatMessageForModel(msg, keepImages) {
  const content = msg.content
  if (typeof content === 'string') {
    return { role: msg.role, content }
  }
  if (!Array.isArray(content)) {
    return { role: msg.role, content: String(content) }
  }
  if (keepImages) {
    return { role: msg.role, content }
  }

  const replaced = content.map(part => {
    if (part && part.type === 'image_url') {
      return { type: 'text', text: '[图片]' }
    }
    return part
  })

  if (replaced.every(part => part && part.type === 'text')) {
    return { role: msg.role, content: replaced.map(part => part.text).join('') }
  }

  return { role: msg.role, content: replaced }
}

/**
 * 把消息中的本地图片 URL 处理为外部模型可访问的形式
 * 1. 若配置了 PUBLIC_URL，拼接成公网绝对 URL
 * 2. 否则将本地图片文件转为 base64 data URL（避免 localhost 无法被外部访问）
 */
function resolveImageUrls(messages, origin) {
  for (const msg of messages) {
    if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part && part.type === 'image_url' && part.image_url && typeof part.image_url.url === 'string') {
          part.image_url.url = resolveImageUrl(part.image_url.url, origin)
        }
      }
    }
  }
  return messages
}

function resolveImageUrl(url, origin) {
  if (!url) return url

  // 已经是完整 URL 或 data URL，无需处理
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url
  }

  // 配置了公网地址，优先使用公网 URL
  const publicUrl = config.upload.publicUrl
  if (publicUrl) {
    return `${publicUrl.replace(/\/$/, '')}${url}`
  }

  // 本地开发环境：把图片文件转成 base64，让外部模型直接读取
  if (url.startsWith('/uploads/')) {
    const filePath = path.join(config.upload.path, url.replace('/uploads/', ''))
    try {
      const data = fs.readFileSync(filePath)
      const base64 = data.toString('base64')
      return `data:image/webp;base64,${base64}`
    } catch (e) {
      logger.warn('[Chat] 本地图片转 base64 失败，回退到 origin URL:', e.message)
    }
  }

  // 最后的 fallback：用请求 origin 拼接
  if (origin) {
    return `${origin}${url}`
  }

  return url
}

/**
 * 构建消息历史
 * 保留最近 VISION_CONTEXT_IMAGE_MESSAGES 条含图消息的图片，更早的图片替换为 [图片]
 */
async function buildMessageHistory(conversation) {
  const VISION_CONTEXT_IMAGE_MESSAGES = 2
  const messages = []

  // 添加智能体系统提示词
  if (conversation.system_prompt) {
    messages.push({
      role: 'system',
      content: conversation.system_prompt
    })
  }

  // 获取历史消息（最近20条）
  const historyMessages = await db.query(
    `SELECT role, content, content_type FROM messages
     WHERE conversation_id = ? AND status = 'completed'
     ORDER BY created_at DESC
     LIMIT 20`,
    [conversation.id]
  )

  // 按时间正序排列
  historyMessages.reverse()

  // 从最新的消息往前数，标记哪些含图消息可以保留图片
  let imageMessageCount = 0
  for (let i = historyMessages.length - 1; i >= 0; i--) {
    const parsed = deserializeMessage(historyMessages[i])
    if (hasImagePart(parsed.content)) {
      imageMessageCount++
      historyMessages[i]._keepImages = imageMessageCount <= VISION_CONTEXT_IMAGE_MESSAGES
    } else {
      historyMessages[i]._keepImages = true
    }
  }

  for (const msg of historyMessages) {
    const parsed = deserializeMessage(msg)
    messages.push(formatMessageForModel(parsed, msg._keepImages))
  }

  return messages
}

module.exports = {
  uploadChatImage,
  chatImageUpload,
  getModels,
  getPromptSuggestions,
  getConversations,
  createConversation,
  getConversationDetail,
  updateConversation,
  deleteConversation,
  getMessages,
  sendMessage,
  streamChat
}
