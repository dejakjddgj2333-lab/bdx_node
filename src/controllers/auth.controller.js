const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const config = require('../config')
const db = require('../utils/db')
const { success, error } = require('../utils/response')

/**
 * 用户注册
 */
async function register(ctx) {
  const { username, password, nickname } = ctx.request.body

  if (!username || !password) {
    return error(ctx, '用户名和密码不能为空', 400)
  }

  if (password.length < 6) {
    return error(ctx, '密码长度不能少于6位', 400)
  }

  // 检查用户是否已存在
  const existingUser = await db.queryOne(
    'SELECT id FROM users WHERE username = ?',
    [username]
  )

  if (existingUser) {
    return error(ctx, '用户名已存在', 400)
  }

  // 加密密码
  const hashedPassword = await bcrypt.hash(password, 10)

  // 创建用户
  const userId = await db.insert(
    'INSERT INTO users (username, password, nickname) VALUES (?, ?, ?)',
    [username, hashedPassword, nickname || username]
  )

  // 创建默认设置
  await db.insert(
    'INSERT INTO user_settings (user_id) VALUES (?)',
    [userId]
  )

  const user = await db.queryOne(
    'SELECT id, username, nickname, avatar, created_at FROM users WHERE id = ?',
    [userId]
  )

  // 生成Token
  const token = generateToken(user.id)

  success(ctx, {
    user,
    token
  }, '注册成功')
}

/**
 * 用户登录
 */
async function login(ctx) {
  const { username, password } = ctx.request.body

  if (!username || !password) {
    return error(ctx, '用户名和密码不能为空', 400)
  }

  // 查找用户
  const user = await db.queryOne(
    'SELECT id, username, password, nickname, avatar, vip_level FROM users WHERE username = ?',
    [username]
  )

  if (!user) {
    return error(ctx, '用户名或密码错误', 400)
  }

  // 验证密码
  const isValid = await bcrypt.compare(password, user.password)
  if (!isValid) {
    return error(ctx, '用户名或密码错误', 400)
  }

  // 检查账号状态
  if (user.status === 0) {
    return error(ctx, '账号已被禁用', 403)
  }

  // 生成Token
  const token = generateToken(user.id)

  success(ctx, {
    user: {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      avatar: user.avatar,
      vipLevel: user.vip_level
    },
    token
  }, '登录成功')
}

/**
 * 刷新Token
 */
async function refreshToken(ctx) {
  const { token } = ctx.request.body

  try {
    const decoded = jwt.verify(token, config.jwt.secret)
    const newToken = generateToken(decoded.userId)
    success(ctx, { token: newToken }, '刷新成功')
  } catch (err) {
    error(ctx, 'Token无效或已过期', 401)
  }
}

/**
 * 生成JWT Token
 */
function generateToken(userId) {
  return jwt.sign(
    { userId: Number(userId) },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  )
}

module.exports = {
  register,
  login,
  refreshToken
}
