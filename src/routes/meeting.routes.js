const Router = require('koa-router')
const { auth } = require('../middleware/auth')
const meetingController = require('../controllers/meeting.controller')

const router = new Router({ prefix: '/meetings' })

// Webhook 免鉴权（由 LiveKit SDK 验签），必须放在 auth 路由之前
router.post('/webhook', meetingController.webhook)

// 创建会议
router.post('/', auth, meetingController.createMeeting)
// 入会：签发 LiveKit token
router.post('/:roomName/token', auth, meetingController.joinMeeting)
// 会议详情 + 参会者
router.get('/:roomName', auth, meetingController.getMeeting)
// 结束会议（仅主持人）
router.post('/:roomName/end', auth, meetingController.endMeeting)

module.exports = router
