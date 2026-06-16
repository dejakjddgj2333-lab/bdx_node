const Router = require('koa-router')
const authController = require('../controllers/auth.controller')

const router = new Router()

router.post('/auth/register', authController.register)
router.post('/auth/login', authController.login)
router.post('/auth/refresh', authController.refreshToken)

module.exports = router
