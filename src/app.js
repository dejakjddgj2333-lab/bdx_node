const Koa = require('koa')
const http = require('http')
const WebSocket = require('ws')
const bodyParser = require('koa-bodyparser')
const cors = require('@koa/cors')
const static = require('koa-static')
const path = require('path')

const config = require('./config')
const errorHandler = require('./middleware/errorHandler')
const routes = require('./routes')
const logger = require('./utils/logger')
const dbInit = require('./utils/db-init')
const VoiceCallWebSocket = require('./websocket/voice-call.ws')

// 静态文件服务（上传的文件），以 /uploads 为前缀访问
function serveUploads(root) {
  const serve = static(root)
  return async (ctx, next) => {
    if (!ctx.path.startsWith('/uploads/')) {
      return await next()
    }
    const originalPath = ctx.path
    ctx.path = ctx.path.replace('/uploads', '') || '/'
    try {
      await serve(ctx, async () => {
        ctx.path = originalPath
        await next()
      })
    } catch (err) {
      ctx.path = originalPath
      if (err.status === 400 && err.message === 'Malicious Path') {
        ctx.status = 404
        ctx.body = { code: 404, message: 'Not found' }
        return
      }
      throw err
    }
    ctx.path = originalPath
  }
}

function createApp() {
  const app = new Koa()

  // 全局错误处理
  app.use(errorHandler)

  // CORS
  app.use(cors({
    origin: '*',
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept']
  }))

  app.use(serveUploads(path.join(__dirname, '../uploads')))
  app.use(static(path.join(__dirname, '../web')))

  // 请求体解析
  app.use(bodyParser({
    jsonLimit: '10mb',
    formLimit: '10mb'
  }))

  // 注册路由
  app.use(routes.routes())
  app.use(routes.allowedMethods())

  return app
}

async function start() {
  // 数据库初始化（自动创建缺失的表/列）
  await dbInit.init()

  const app = createApp()
  const server = http.createServer(app.callback())

  // 创建 WebSocket 服务器（语音通话）
  const voiceCallWss = new WebSocket.Server({
    server,
    path: '/ws/voice-call'
  })
  new VoiceCallWebSocket(voiceCallWss)

  const PORT = config.port || 3001

  server.listen(PORT, () => {
    logger.info(`[OK] 服务器启动成功，端口: ${PORT}`)
    logger.info(`[OK] 上传文件访问: http://localhost:${PORT}/uploads/`)
    logger.info(`[OK] 语音通话WebSocket: ws://localhost:${PORT}/ws/voice-call`)
  })
}

start().catch(err => {
  logger.error('[App] 启动失败:', err)
  process.exit(1)
})
