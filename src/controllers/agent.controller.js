const db = require('../utils/db')
const { success, error } = require('../utils/response')

/**
 * 获取智能体列表
 */
async function getAgents(ctx) {
  const { category, search, page = 1, pageSize = 20 } = ctx.query

  let whereClause = 'WHERE a.status = 1 AND a.is_public = 1'
  const params = []

  if (category) {
    whereClause += ' AND category = ?'
    params.push(category)
  }

  if (search) {
    whereClause += ' AND (name LIKE ? OR description LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }

  const offset = (Number(page) - 1) * Number(pageSize)

  const agents = await db.query(
    `SELECT a.id, a.name, a.description, a.avatar, a.category,
            a.is_official, a.use_count, a.rating, a.welcome_message,
            a.created_at,
            u.nickname as creator_nickname, u.avatar as creator_avatar
     FROM agents a
     LEFT JOIN users u ON a.creator_id = u.id
     ${whereClause}
     ORDER BY a.is_official DESC, a.use_count DESC
     LIMIT ${Number(pageSize)} OFFSET ${offset}`,
    params
  )

  // 获取分类列表
  const categories = await db.query(
    "SELECT DISTINCT category FROM agents WHERE status = 1 AND category IS NOT NULL AND category != ''"
  )

  // 获取总数
  const countResult = await db.queryOne(
    `SELECT COUNT(*) as total FROM agents a ${whereClause}`,
    params
  )

  success(ctx, {
    list: agents,
    categories: categories.map(c => c.category).filter(Boolean),
    pagination: {
      page: Number(page),
      pageSize: Number(pageSize),
      total: countResult.total
    }
  })
}

/**
 * 获取智能体详情
 */
async function getAgentDetail(ctx) {
  const { id } = ctx.params

  const agent = await db.queryOne(
    `SELECT a.id, a.name, a.description, a.avatar, a.system_prompt,
            a.welcome_message, a.category, a.is_official, a.use_count,
            a.rating, a.created_at,
            u.nickname as creator_nickname, u.avatar as creator_avatar
     FROM agents a
     LEFT JOIN users u ON a.creator_id = u.id
     WHERE a.id = ? AND a.status = 1`,
    [id]
  )

  if (!agent) {
    return error(ctx, '智能体不存在', 404)
  }

  // 增加使用次数
  await db.update(
    'UPDATE agents SET use_count = use_count + 1 WHERE id = ?',
    [id]
  )

  success(ctx, agent)
}

/**
 * 创建智能体
 */
async function createAgent(ctx) {
  const userId = ctx.state.user.userId
  const { name, description, avatar, systemPrompt, welcomeMessage, category, isPublic = true } = ctx.request.body

  if (!name?.trim()) {
    return error(ctx, '智能体名称不能为空', 400)
  }

  if (!systemPrompt?.trim()) {
    return error(ctx, '系统提示词不能为空', 400)
  }

  const agentId = await db.insert(
    `INSERT INTO agents (creator_id, name, description, avatar, system_prompt,
                         welcome_message, category, is_public)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, name.trim(), description?.trim() || '', avatar,
     systemPrompt.trim(), welcomeMessage?.trim() || '',
     category || '自定义', isPublic ? 1 : 0]
  )

  const agent = await db.queryOne(
    'SELECT * FROM agents WHERE id = ?',
    [agentId]
  )

  success(ctx, agent, '创建成功')
}

/**
 * 更新智能体
 */
async function updateAgent(ctx) {
  const userId = ctx.state.user.userId
  const { id } = ctx.params
  const { name, description, avatar, systemPrompt, welcomeMessage, category, isPublic } = ctx.request.body

  // 检查权限
  const existing = await db.queryOne(
    'SELECT id FROM agents WHERE id = ? AND creator_id = ?',
    [id, userId]
  )

  if (!existing) {
    return error(ctx, '智能体不存在或无权限', 404)
  }

  const updates = []
  const values = []

  if (name !== undefined) { updates.push('name = ?'); values.push(name.trim()) }
  if (description !== undefined) { updates.push('description = ?'); values.push(description.trim()) }
  if (avatar !== undefined) { updates.push('avatar = ?'); values.push(avatar) }
  if (systemPrompt !== undefined) { updates.push('system_prompt = ?'); values.push(systemPrompt.trim()) }
  if (welcomeMessage !== undefined) { updates.push('welcome_message = ?'); values.push(welcomeMessage.trim()) }
  if (category !== undefined) { updates.push('category = ?'); values.push(category) }
  if (isPublic !== undefined) { updates.push('is_public = ?'); values.push(isPublic ? 1 : 0) }

  if (updates.length === 0) {
    return success(ctx, null, '无需更新')
  }

  values.push(id)

  await db.update(
    `UPDATE agents SET ${updates.join(', ')} WHERE id = ?`,
    values
  )

  const agent = await db.queryOne(
    'SELECT * FROM agents WHERE id = ?',
    [id]
  )

  success(ctx, agent, '更新成功')
}

/**
 * 删除智能体
 */
async function deleteAgent(ctx) {
  const userId = ctx.state.user.userId
  const { id } = ctx.params

  const existing = await db.queryOne(
    'SELECT id FROM agents WHERE id = ? AND creator_id = ?',
    [id, userId]
  )

  if (!existing) {
    return error(ctx, '智能体不存在或无权限', 404)
  }

  await db.update(
    'UPDATE agents SET status = 0 WHERE id = ?',
    [id]
  )

  success(ctx, null, '删除成功')
}

module.exports = {
  getAgents,
  getAgentDetail,
  createAgent,
  updateAgent,
  deleteAgent
}
