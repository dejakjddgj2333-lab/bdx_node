const jwt = require('jsonwebtoken')
const config = require('../config')
const { error } = require('../utils/response')

/**
 * JWT认证中间件
 */
async function auth(ctx, next) {
  const token = ctx.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    return error(ctx, '请先登录', 401, 401)
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret)
    ctx.state.user = decoded
    await next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(ctx, '登录已过期，请重新登录', 401, 401)
    }
    return error(ctx, '登录状态无效', 401, 401)
  }
}

/**
 * 可选认证（未登录也能访问，但登录后会获取用户信息）
 */
async function optionalAuth(ctx, next) {
  const token = ctx.headers.authorization?.replace('Bearer ', '')

  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret)
      ctx.state.user = decoded
    } catch (err) {
      // 忽略错误，继续执行
    }
  }

  await next()
}

module.exports = {
  auth,
  optionalAuth
}
