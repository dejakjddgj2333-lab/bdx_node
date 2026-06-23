const Router = require('koa-router')
const chatController = require('../controllers/chat.controller')
const { auth } = require('../middleware/auth')

const router = new Router()

// 可用模型列表
router.get('/models', auth, chatController.getModels)

// 绘图模型
router.get('/image-models', auth, chatController.getImageModels)
router.get('/image-quota', auth, chatController.getImageQuota)
router.post('/generate-image', auth, chatController.generateImage)
router.get('/paintings', auth, chatController.listPaintings)

// 图片上传
router.post('/chat/upload-image', auth, chatController.chatImageUpload.single('file'), chatController.uploadChatImage)

// 首页推荐语
router.get('/prompt-suggestions', auth, chatController.getPromptSuggestions)

// 会话管理
router.get('/conversations', auth, chatController.getConversations)
router.post('/conversations', auth, chatController.createConversation)
router.get('/conversations/:id', auth, chatController.getConversationDetail)
router.put('/conversations/:id', auth, chatController.updateConversation)
router.delete('/conversations/:id', auth, chatController.deleteConversation)

// 消息
router.get('/conversations/:id/messages', auth, chatController.getMessages)
router.post('/chat/send', auth, chatController.sendMessage)
router.post('/chat/stream', auth, chatController.streamChat)

module.exports = router
