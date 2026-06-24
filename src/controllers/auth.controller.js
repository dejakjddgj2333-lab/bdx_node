const jwt = require('jsonwebtoken')
const config = require('../config')
const db = require('../utils/db')
const { success, error } = require('../utils/response')
const logger = require('../utils/logger')
const redis = require('../utils/redis')
const { getMobileByToken } = require('../utils/aliyun-dypns')
const { sendEmailCode } = require('../utils/mailer')

const EMAIL_CODE_PREFIX = 'login:email:code:'
const EMAIL_CODE_TTL = 300 // 5分钟

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

/**
 * 生成6位数字验证码
 */
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * 格式化返回用户信息
 */
function formatUser(user) {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    vipLevel: user.vip_level,
  }
}

/**
 * 根据手机号/邮箱查找或创建用户
 */
async function createOrLoginUser({ phone, email, appleId, nickname, loginType }) {
  let user = null

  if (phone) {
    user = await db.queryOne('SELECT * FROM users WHERE phone = ?', [phone])
  } else if (email) {
    user = await db.queryOne('SELECT * FROM users WHERE email = ?', [email])
  } else if (appleId) {
    user = await db.queryOne('SELECT * FROM users WHERE apple_id = ?', [appleId])
  }

  if (!user) {
    // 自动生成 username，保证唯一性
    const username = phone || email || `apple_${appleId.slice(-8)}`
    const defaultNickname = nickname || username.replace(/@.*/, '')

    const userId = await db.insert(
      'INSERT INTO users (username, phone, email, apple_id, nickname, login_type, status) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [username, phone || null, email || null, appleId || null, defaultNickname, loginType]
    )
    await db.insert('INSERT INTO user_settings (user_id) VALUES (?)', [userId])
    user = await db.queryOne('SELECT * FROM users WHERE id = ?', [userId])
  }

  if (user.status === 0) {
    throw new Error('账号已被禁用')
  }

  return {
    token: generateToken(user.id),
    user: formatUser(user),
  }
}

/**
 * 阿里云手机号一键登录
 */
async function oneClickLogin(ctx) {
  const { token } = ctx.request.body
  if (!token) {
    return error(ctx, '缺少一键登录 token', 400)
  }

  if (!config.aliyun.accessKeyId || !config.aliyun.accessKeySecret) {
    logger.error('[OneClickLogin] 阿里云密钥未配置')
    return error(ctx, '服务端未配置一键登录', 500)
  }

  try {
    const phone = await getMobileByToken(token)
    if (!phone) {
      return error(ctx, '一键登录验证失败，请尝试邮箱登录', 400)
    }

    const result = await createOrLoginUser({
      phone,
      loginType: 'phone',
      nickname: phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'),
    })

    success(ctx, result, '登录成功')
  } catch (err) {
    logger.error('[OneClickLogin] 失败:', err)
    error(ctx, err.message || '一键登录服务异常，请尝试邮箱登录', 500)
  }
}

/**
 * 发送邮箱验证码
 */
async function sendEmailCodeCtrl(ctx) {
  const { email } = ctx.request.body
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return error(ctx, '邮箱格式不正确', 400)
  }

  if (!config.smtp.user || !config.smtp.pass) {
    logger.error('[SendEmailCode] SMTP 未配置')
    return error(ctx, '服务端未配置邮件服务', 500)
  }

  const code = generateCode()
  const key = EMAIL_CODE_PREFIX + email

  try {
    await redis.setex(key, EMAIL_CODE_TTL, code)
    await sendEmailCode(email, code)
    success(ctx, null, '验证码已发送')
  } catch (err) {
    logger.error('[SendEmailCode] 失败:', err)
    error(ctx, '验证码发送失败', 500)
  }
}

/**
 * 邮箱验证码登录
 */
async function emailLogin(ctx) {
  const { email, code } = ctx.request.body
  if (!email || !code) {
    return error(ctx, '邮箱和验证码不能为空', 400)
  }

  const key = EMAIL_CODE_PREFIX + email
  const cachedCode = await redis.get(key)

  if (!cachedCode || cachedCode !== code) {
    return error(ctx, '验证码错误或已过期', 400)
  }

  await redis.del(key)

  try {
    const result = await createOrLoginUser({
      email,
      loginType: 'email',
      nickname: email.split('@')[0],
    })

    await db.update(
      'UPDATE users SET email_verified_at = NOW() WHERE email = ?',
      [email]
    )

    success(ctx, result, '登录成功')
  } catch (err) {
    logger.error('[EmailLogin] 失败:', err)
    error(ctx, err.message || '登录失败', 500)
  }
}

/**
 * Apple Sign In 登录
 * 前端完成 Apple 授权后，把 identityToken + userIdentifier 传给后端校验
 */
async function appleLogin(ctx) {
  const { identityToken, userIdentifier, email, nickname } = ctx.request.body

  if (!identityToken || !userIdentifier) {
    return error(ctx, '缺少 Apple 登录凭证', 400)
  }

  // TODO: 生产环境建议用 jsonwebtoken + Apple 公钥验证 identityToken 签名
  // 这里简化处理：信任前端传来的 userIdentifier（首次登录时一定要把 userIdentifier 存起来）

  try {
    const result = await createOrLoginUser({
      appleId: userIdentifier,
      email: email || null,
      nickname: nickname || null,
      loginType: 'apple',
    })

    success(ctx, result, '登录成功')
  } catch (err) {
    logger.error('[AppleLogin] 失败:', err)
    error(ctx, err.message || 'Apple 登录失败', 500)
  }
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

module.exports = {
  oneClickLogin,
  sendEmailCode: sendEmailCodeCtrl,
  emailLogin,
  appleLogin,
  refreshToken,
}
