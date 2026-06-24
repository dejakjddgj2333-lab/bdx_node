const Router = require('koa-router')
const authController = require('../controllers/auth.controller')

const router = new Router()

// 手机号一键登录（阿里云号码认证）
router.post('/auth/one-click-login', authController.oneClickLogin)

// 邮箱验证码登录
router.post('/auth/email/send-code', authController.sendEmailCode)
router.post('/auth/email/login', authController.emailLogin)

// Apple Sign In
router.post('/auth/apple-login', authController.appleLogin)

// Token 刷新
router.post('/auth/refresh', authController.refreshToken)

module.exports = router
