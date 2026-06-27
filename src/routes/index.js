const Router = require('koa-router')
const authRoutes = require('./auth.routes')
const userRoutes = require('./user.routes')
const chatRoutes = require('./chat.routes')
const agentRoutes = require('./agent.routes')
const voiceRoutes = require('./voice.routes')
const meetingRoutes = require('./meeting.routes')
const adminRoutes = require('./admin.routes')

const os = require('os')

const router = new Router({ prefix: '/api' })

// 禁止 CDN / 浏览器缓存所有 API 接口
router.use(async (ctx, next) => {
  ctx.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  ctx.set('Pragma', 'no-cache')
  ctx.set('Expires', '0')
  await next()
})

// 健康检查
router.get('/health', (ctx) => {
  ctx.body = {
    code: 0,
    message: 'ok',
    data: {
      time: new Date().toISOString(),
      hostname: os.hostname(),
      serverIp: Object.values(os.networkInterfaces())
        .flat()
        .find((iface) => iface && iface.family === 'IPv4' && !iface.internal)?.address || 'unknown',
    },
  }
})

// 内部 LLM 流式接口（供 Python 语音微服务调用，无 auth）
const aiService = require('../services/ai.service')
const Router2 = require('koa-router')
const internal = new Router2({ prefix: '/internal' })
internal.post('/llm/stream', async (ctx) => {
  const { text, model, systemPrompt } = ctx.request.body || {}
  if (!text || !text.trim()) {
    ctx.body = { code: 1, message: 'text 必填' }
    return
  }
  const messages = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: text })

  ctx.status = 200
  ctx.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' })
  ctx.respond = false
  try {
    const stream = aiService.streamChatCompletion(model || 'doubao-seed-2.0-lite', messages)
    for await (const chunk of stream) {
      ctx.res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`)
    }
    ctx.res.write('data: [DONE]\n\n')
  } catch (e) {
    ctx.res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`)
  }
  ctx.res.end()
})
router.use(internal.routes())

// 注册各模块路由
router.use(authRoutes.routes())
router.use(userRoutes.routes())
router.use(chatRoutes.routes())
router.use(agentRoutes.routes())
router.use(voiceRoutes.routes())
router.use(meetingRoutes.routes())
router.use(adminRoutes.routes())

module.exports = router
