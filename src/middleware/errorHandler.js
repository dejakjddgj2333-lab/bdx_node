const logger = require('../utils/logger')

module.exports = async (ctx, next) => {
  try {
    await next()
  } catch (err) {
    logger.error('服务器错误:', err)

    const status = err.status || err.statusCode || 500
    const message = err.message || '服务器内部错误'

    ctx.status = status
    ctx.body = {
      code: err.code || status,
      message,
      data: null,
      timestamp: Date.now()
    }
  }
}
