const jwt = require('jsonwebtoken')
const config = require('../config')
const { error } = require('../utils/response')

/**
 * 管理员 JWT 认证中间件
 */
async function adminAuth(ctx, next) {
  const token = ctx.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    return error(ctx, '请先登录', 401, 401)
  }

  let decoded
  try {
    decoded = jwt.verify(token, config.admin.jwtSecret)
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(ctx, '登录已过期，请重新登录', 401, 401)
    }
    return error(ctx, '登录状态无效', 401, 401)
  }

  if (!decoded || !decoded.isAdmin) {
    return error(ctx, '无管理员权限', 403, 403)
  }

  ctx.state.admin = decoded
  await next()
}

module.exports = adminAuth
