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

// 注册各模块路由
router.use(authRoutes.routes())
router.use(userRoutes.routes())
router.use(chatRoutes.routes())
router.use(agentRoutes.routes())
router.use(voiceRoutes.routes())
router.use(meetingRoutes.routes())
router.use(adminRoutes.routes())

module.exports = router
