const Router = require('koa-router')
const userController = require('../controllers/user.controller')
const { auth } = require('../middleware/auth')

const router = new Router()

router.get('/user/profile', auth, userController.getProfile)
router.put('/user/profile', auth, userController.updateProfile)
router.get('/user/settings', auth, userController.getSettings)
router.put('/user/settings', auth, userController.updateSettings)

module.exports = router
