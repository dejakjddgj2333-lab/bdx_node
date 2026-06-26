const Router = require('koa-router')
const adminAuth = require('../middleware/adminAuth')
const adminController = require('../controllers/admin.controller')

const router = new Router({ prefix: '/admin' })

// 认证
router.post('/login', adminController.login)
router.post('/logout', adminAuth, adminController.logout)
router.get('/profile', adminAuth, adminController.profile)

// Dashboard
router.get('/stats', adminAuth, adminController.stats)

// 用户管理
router.get('/users', adminAuth, adminController.listUsers)
router.get('/users/:id', adminAuth, adminController.getUser)
router.put('/users/:id', adminAuth, adminController.updateUser)
router.delete('/users/:id', adminAuth, adminController.deleteUser)

// 知识库管理
router.get('/knowledge-bases', adminAuth, adminController.listKnowledgeBases)
router.post('/knowledge-bases', adminAuth, adminController.createKnowledgeBase)
router.put('/knowledge-bases/:id', adminAuth, adminController.updateKnowledgeBase)
router.delete('/knowledge-bases/:id', adminAuth, adminController.deleteKnowledgeBase)
router.post('/knowledge-bases/:id/search', adminAuth, adminController.searchKnowledgeBase)

// 文档管理
router.get('/knowledge-bases/:id/documents', adminAuth, adminController.listDocuments)
router.post('/knowledge-bases/:id/documents', adminAuth, adminController.knowledgeUpload.single('file'), adminController.uploadDocument)
router.delete('/documents/:id', adminAuth, adminController.deleteDocument)
router.put('/documents/:id', adminAuth, adminController.updateDocument)
router.post('/documents/:id/reparse', adminAuth, adminController.reparseDocument)
router.post('/documents/:id/rebuild-embedding', adminAuth, adminController.rebuildEmbedding)
router.get('/documents/:id/chunks', adminAuth, adminController.listDocumentChunks)

// 模型 Provider 配置
router.get('/model-provider-presets', adminAuth, adminController.listProviderPresets)
router.get('/model-providers', adminAuth, adminController.listProviders)
router.post('/model-providers', adminAuth, adminController.createProvider)
router.put('/model-providers/:id', adminAuth, adminController.updateProvider)
router.delete('/model-providers/:id', adminAuth, adminController.deleteProvider)
router.post('/model-providers/:id/test', adminAuth, adminController.testProvider)
router.get('/model-providers/:id/models', adminAuth, adminController.listRemoteModels)

// 语音通话厂商配置
router.get('/voice-provider-presets', adminAuth, adminController.listVoiceProviderPresets)
router.get('/voice-providers', adminAuth, adminController.listVoiceProviders)
router.post('/voice-providers', adminAuth, adminController.createVoiceProvider)
router.put('/voice-providers/:id', adminAuth, adminController.updateVoiceProvider)
router.delete('/voice-providers/:id', adminAuth, adminController.deleteVoiceProvider)
router.post('/voice-providers/:id/current', adminAuth, adminController.setCurrentVoiceProvider)
router.post('/voice-providers/:id/test', adminAuth, adminController.testVoiceProvider)

// 模型管理
router.get('/models', adminAuth, adminController.listModels)
router.post('/models', adminAuth, adminController.createModel)
router.put('/models/:id', adminAuth, adminController.updateModel)
router.delete('/models/:id', adminAuth, adminController.deleteModel)

// 绘图模型管理
router.get('/image-models', adminAuth, adminController.listImageModels)
router.post('/image-models', adminAuth, adminController.createImageModel)
router.put('/image-models/:id', adminAuth, adminController.updateImageModel)
router.delete('/image-models/:id', adminAuth, adminController.deleteImageModel)

// 系统设置
router.get('/system-settings', adminAuth, adminController.listSystemSettings)
router.put('/system-settings', adminAuth, adminController.updateSystemSetting)

// 首页推荐语配置
router.get('/prompt-suggestions', adminAuth, adminController.listPromptSuggestions)
router.post('/prompt-suggestions', adminAuth, adminController.createPromptSuggestion)
router.put('/prompt-suggestions/:id', adminAuth, adminController.updatePromptSuggestion)
router.delete('/prompt-suggestions/:id', adminAuth, adminController.deletePromptSuggestion)

module.exports = router
