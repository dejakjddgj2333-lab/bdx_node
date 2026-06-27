const Router = require('koa-router')
const { auth } = require('../middleware/auth')
const voiceController = require('../controllers/voice.controller')

const router = new Router({ prefix: '/voice-call' })

router.get('/provider', auth, voiceController.getCurrentProvider)
router.get('/voices', auth, voiceController.getVoices)

module.exports = router
