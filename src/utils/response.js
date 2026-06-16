/**
 * 统一响应格式
 */

function success(ctx, data = null, message = 'success') {
  ctx.body = {
    code: 0,
    message,
    data,
    timestamp: Date.now()
  }
}

function error(ctx, message = 'error', code = 500, statusCode = 200) {
  ctx.status = statusCode
  ctx.body = {
    code,
    message,
    data: null,
    timestamp: Date.now()
  }
}

module.exports = {
  success,
  error
}
