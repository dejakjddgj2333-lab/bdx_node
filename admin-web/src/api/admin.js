import request from './request'

export default {
  // 认证
  login(password) {
    return request.post('/login', { password })
  },
  logout() {
    return request.post('/logout')
  },
  profile() {
    return request.get('/profile')
  },

  // Dashboard
  stats() {
    return request.get('/stats')
  },

  // 用户管理
  getUsers(params) {
    return request.get('/users', { params })
  },
  getUser(id) {
    return request.get(`/users/${id}`)
  },
  updateUser(id, data) {
    return request.put(`/users/${id}`, data)
  },
  deleteUser(id) {
    return request.delete(`/users/${id}`)
  },

  // 知识库管理
  getKnowledgeBases(params) {
    return request.get('/knowledge-bases', { params })
  },
  createKnowledgeBase(data) {
    return request.post('/knowledge-bases', data)
  },
  updateKnowledgeBase(id, data) {
    return request.put(`/knowledge-bases/${id}`, data)
  },
  deleteKnowledgeBase(id) {
    return request.delete(`/knowledge-bases/${id}`)
  },
  getDocuments(kbId, params) {
    return request.get(`/knowledge-bases/${kbId}/documents`, { params })
  },
  uploadDocument(kbId, file, onProgress) {
    const formData = new FormData()
    formData.append('file', file)
    return request.post(`/knowledge-bases/${kbId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
    })
  },
  deleteDocument(id) {
    return request.delete(`/documents/${id}`)
  },
  reparseDocument(id) {
    return request.post(`/documents/${id}/reparse`)
  },
  rebuildEmbedding(id) {
    return request.post(`/documents/${id}/rebuild-embedding`)
  },
  updateDocument(id, data) {
    return request.put(`/documents/${id}`, data)
  },
  getDocumentChunks(id, params) {
    return request.get(`/documents/${id}/chunks`, { params })
  },
  searchKnowledgeBase(kbId, data) {
    return request.post(`/knowledge-bases/${kbId}/search`, data)
  },

  // 模型 Provider 配置
  getProviderPresets() {
    return request.get('/model-provider-presets')
  },
  getProviders() {
    return request.get('/model-providers')
  },
  createProvider(data) {
    return request.post('/model-providers', data)
  },
  updateProvider(id, data) {
    return request.put(`/model-providers/${id}`, data)
  },
  deleteProvider(id) {
    return request.delete(`/model-providers/${id}`)
  },
  testProvider(id) {
    return request.post(`/model-providers/${id}/test`)
  },
  getRemoteModels(id) {
    return request.get(`/model-providers/${id}/models`)
  },

  // 语音通话厂商配置
  getVoiceProviderPresets() {
    return request.get('/voice-provider-presets')
  },
  getVoiceProviders() {
    return request.get('/voice-providers')
  },
  createVoiceProvider(data) {
    return request.post('/voice-providers', data)
  },
  updateVoiceProvider(id, data) {
    return request.put(`/voice-providers/${id}`, data)
  },
  deleteVoiceProvider(id) {
    return request.delete(`/voice-providers/${id}`)
  },
  setCurrentVoiceProvider(id) {
    return request.post(`/voice-providers/${id}/current`)
  },
  testVoiceProvider(id) {
    return request.post(`/voice-providers/${id}/test`)
  },

  // TTS 音色库
  getTtsVoices() {
    return request.get('/tts-voices')
  },
  createTtsVoice(data) {
    return request.post('/tts-voices', data)
  },
  updateTtsVoice(id, data) {
    return request.put(`/tts-voices/${id}`, data)
  },
  deleteTtsVoice(id) {
    return request.delete(`/tts-voices/${id}`)
  },
  setDefaultTtsVoice(id) {
    return request.post(`/tts-voices/${id}/default`)
  },
  syncTtsVoices() {
    return request.post('/tts-voices/sync')
  },

  // 模型管理
  getModels() {
    return request.get('/models')
  },
  createModel(data) {
    return request.post('/models', data)
  },
  updateModel(id, data) {
    return request.put(`/models/${id}`, data)
  },
  deleteModel(id) {
    return request.delete(`/models/${id}`)
  },

  // 绘图模型管理
  getImageModels() {
    return request.get('/image-models')
  },
  createImageModel(data) {
    return request.post('/image-models', data)
  },
  updateImageModel(id, data) {
    return request.put(`/image-models/${id}`, data)
  },
  deleteImageModel(id) {
    return request.delete(`/image-models/${id}`)
  },

  // 系统设置
  getSystemSettings() {
    return request.get('/system-settings')
  },
  updateSystemSetting(key, value) {
    return request.put('/system-settings', { key, value })
  },

  // 首页推荐语配置
  getPromptSuggestions() {
    return request.get('/prompt-suggestions')
  },
  createPromptSuggestion(data) {
    return request.post('/prompt-suggestions', data)
  },
  updatePromptSuggestion(id, data) {
    return request.put(`/prompt-suggestions/${id}`, data)
  },
  deletePromptSuggestion(id) {
    return request.delete(`/prompt-suggestions/${id}`)
  }
}
