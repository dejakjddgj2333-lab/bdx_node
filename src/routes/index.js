const Router = require('koa-router')
const authRoutes = require('./auth.routes')
const userRoutes = require('./user.routes')
const chatRoutes = require('./chat.routes')
const agentRoutes = require('./agent.routes')
const voiceRoutes = require('./voice.routes')
const meetingRoutes = require('./meeting.routes')
const adminRoutes = require('./admin.routes')

const router = new Router({ prefix: '/api' })

// 健康检查
router.get('/health', (ctx) => {
  ctx.body = { code: 0, message: 'ok', data: { time: new Date().toISOString() } }
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
