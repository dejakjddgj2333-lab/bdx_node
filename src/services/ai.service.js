const config = require('../config')
const db = require('../utils/db')
const logger = require('../utils/logger')

/**
 * AI服务 - 火山方舟 Agent Plan 单入口
 * 阶段一：对话能力收敛到方舟 Plan（chat/completions + responses 联网搜索）
 */

class AIService {
  constructor() {
    // 兜底模型列表（与 DB 种子 migrate-ark-plan.sql 一致：11 个方舟 Plan 模型）
    this.fallbackModels = [
      { id: 1,  name: '豆包 Seed 2.0 Pro',  provider: 'ark', model_id: 'doubao-seed-2.0-pro',  description: '字节豆包旗舰对话模型，综合能力强，支持联网搜索', is_default: true,  is_active: true, supports_web_search: true,  max_tokens: 8192, sort_order: 0 },
      { id: 2,  name: '豆包 Seed 2.0 Code', provider: 'ark', model_id: 'doubao-seed-2.0-code', description: '豆包编程专用模型，擅长代码生成与调试',         is_default: false, is_active: true, supports_web_search: false, max_tokens: 8192, sort_order: 1 },
      { id: 3,  name: '豆包 Seed 2.0 Lite', provider: 'ark', model_id: 'doubao-seed-2.0-lite', description: '豆包轻量版本，响应快、成本低',                  is_default: false, is_active: true, supports_web_search: false, max_tokens: 8192, sort_order: 2 },
      { id: 4,  name: '豆包 Seed 2.0 Mini', provider: 'ark', model_id: 'doubao-seed-2.0-mini', description: '豆包最小体积版本，适合轻量场景',               is_default: false, is_active: true, supports_web_search: false, max_tokens: 8192, sort_order: 3 },
      { id: 5,  name: 'GLM-5.2',           provider: 'ark', model_id: 'glm-5.2',              description: '智谱 GLM 5.2 通用对话模型',                     is_default: false, is_active: true, supports_web_search: false, max_tokens: 8192, sort_order: 4 },
      { id: 6,  name: 'Kimi K2.7 Code',    provider: 'ark', model_id: 'kimi-k2.7-code',       description: '月之暗面 Kimi K2.7 编程增强模型',             is_default: false, is_active: true, supports_web_search: false, max_tokens: 8192, sort_order: 5 },
      { id: 7,  name: 'DeepSeek V4 Pro',   provider: 'ark', model_id: 'deepseek-v4-pro',      description: 'DeepSeek V4 Pro 旗舰对话模型',                is_default: false, is_active: true, supports_web_search: false, max_tokens: 8192, sort_order: 6 },
      { id: 8,  name: 'DeepSeek V4 Flash', provider: 'ark', model_id: 'deepseek-v4-flash',    description: 'DeepSeek V4 Flash 轻量快速模型',              is_default: false, is_active: true, supports_web_search: false, max_tokens: 8192, sort_order: 7 },
      { id: 9,  name: 'MiniMax M3',        provider: 'ark', model_id: 'minimax-m3',           description: 'MiniMax M3 通用对话模型',                     is_default: false, is_active: true, supports_web_search: false, max_tokens: 8192, sort_order: 8 },
      { id: 10, name: 'MiniMax M2.7',      provider: 'ark', model_id: 'minimax-m2.7',         description: 'MiniMax M2.7 对话模型',                       is_default: false, is_active: true, supports_web_search: false, max_tokens: 8192, sort_order: 9 },
      { id: 11, name: 'Kimi K2.6',         provider: 'ark', model_id: 'kimi-k2.6',            description: '月之暗面 Kimi K2.6 长文本对话模型',           is_default: false, is_active: true, supports_web_search: false, max_tokens: 8192, sort_order: 10 }
    ]
  }

  /**
   * 从数据库获取模型信息
   */
  async getModelInfo(modelId) {
    try {
      const row = await db.queryOne(
        'SELECT * FROM ai_models WHERE model_id = ? LIMIT 1',
        [modelId]
      )
      if (row) return row
    } catch (e) {
      logger.error('[AIService] 读取模型配置失败:', e.message)
    }
    return this.fallbackModels.find(m => m.model_id === modelId) || null
  }

  /**
   * 从数据库获取方舟 Provider 配置（API Key + Base URL）
   * 收敛后 provider 名固定 'ark'：读 model_providers 表 provider='ark' 行，
   * 回退到 config.ai.ark。base_url 存的是 planBaseUrl（https://ark.cn-beijing.volces.com/api/plan）。
   */
  async getProviderConfig(providerName = 'ark') {
    try {
      const row = await db.queryOne(
        'SELECT * FROM model_providers WHERE provider = ? AND is_active = TRUE LIMIT 1',
        [providerName]
      )
      if (row && row.api_key) {
        return { apiKey: row.api_key, baseUrl: row.base_url }
      }
    } catch (e) {
      logger.error('[AIService] 读取 Provider 配置失败:', e.message)
    }

    // 回退到 config.ai.ark（.env）
    const arkConfig = config.ai.ark
    if (arkConfig) {
      return { apiKey: arkConfig.apiKey, baseUrl: arkConfig.planBaseUrl }
    }

    return { apiKey: '', baseUrl: '' }
  }

  /**
   * 解析模型对应的 Provider 名称与配置
   * 收敛后：modelInfo.provider 恒为 'ark'（DB 种子已是）；
   * 找不到 modelInfo 时兜底 'ark'，不再按 modelId 前缀分发多厂商。
   */
  async resolveProvider(modelId) {
    const modelInfo = await this.getModelInfo(modelId)
    const providerName = modelInfo?.provider || 'ark'

    const providerConfig = await this.getProviderConfig(providerName)
    return { providerName, providerConfig, modelInfo }
  }

  /**
   * 发送对话请求（非流式）
   */
  async chatCompletion(modelId, messages, options = {}) {
    const { providerName, providerConfig, modelInfo } = await this.resolveProvider(modelId)

    if (modelInfo && !modelInfo.is_active) {
      throw new Error(`模型 ${modelId} 已禁用`)
    }

    const mergedOptions = {
      ...options,
      maxTokens: modelInfo?.max_tokens || options.maxTokens
    }

    // 模型若支持联网搜索，走方舟 Plan Responses API
    if (modelInfo?.supports_web_search) {
      const provider = new DoubaoWebSearchProvider(providerConfig)
      return provider.chatCompletion(modelId, messages, mergedOptions)
    }

    const provider = createProvider(providerName, providerConfig)
    return provider.chatCompletion(modelId, messages, mergedOptions)
  }

  /**
   * 发送流式对话请求
   */
  async *streamChatCompletion(modelId, messages, options = {}) {
    const { providerName, providerConfig, modelInfo } = await this.resolveProvider(modelId)

    if (modelInfo && !modelInfo.is_active) {
      throw new Error(`模型 ${modelId} 已禁用`)
    }

    const mergedOptions = {
      ...options,
      maxTokens: modelInfo?.max_tokens || options.maxTokens
    }

    // 模型若支持联网搜索，走方舟 Plan Responses API
    if (modelInfo?.supports_web_search) {
      const provider = new DoubaoWebSearchProvider(providerConfig)
      yield* provider.streamChatCompletion(modelId, messages, mergedOptions)
      return
    }

    const provider = createProvider(providerName, providerConfig)
    yield* provider.streamChatCompletion(modelId, messages, mergedOptions)
  }

  /**
   * 获取可用模型列表
   */
  async getAvailableModels() {
    try {
      const rows = await db.query(
        'SELECT * FROM ai_models ORDER BY sort_order ASC, id ASC'
      )
      if (rows && rows.length > 0) {
        return rows
      }
    } catch (e) {
      logger.error('[AIService] 读取可用模型列表失败:', e.message)
    }
    return this.fallbackModels
  }

  /**
   * 获取可用绘图模型列表
   */
  async getAvailableImageModels() {
    try {
      const rows = await db.query(
        'SELECT * FROM image_models WHERE is_active = TRUE ORDER BY sort_order ASC, id ASC'
      )
      return rows || []
    } catch (e) {
      logger.error('[AIService] 读取可用绘图模型列表失败:', e.message)
      return []
    }
  }

  /**
   * 获取默认绘图模型
   */
  async getDefaultImageModel() {
    try {
      const row = await db.queryOne(
        'SELECT * FROM image_models WHERE is_active = TRUE AND is_default = TRUE LIMIT 1'
      )
      if (row) return row
    } catch (e) {
      logger.error('[AIService] 读取默认绘图模型失败:', e.message)
    }
    const fallback = await db.queryOne(
      'SELECT * FROM image_models WHERE is_active = TRUE ORDER BY sort_order ASC, id ASC LIMIT 1'
    )
    return fallback
  }

  /**
   * 生成图片
   */
  async generateImage({ modelId, prompt, negativePrompt, size, style, n = 1 }) {
    const modelInfo = await this.getImageModelInfo(modelId)
    if (!modelInfo) {
      throw new Error('绘图模型不存在')
    }
    if (!modelInfo.is_active) {
      throw new Error('绘图模型已禁用')
    }

    // 图像 Provider 收敛为单一方舟；baseUrl 固定取 planV3BaseUrl（见 ArkImageProvider 构造），
    // 不读 getProviderConfig 返回的 base_url（那是对话用的 planBaseUrl，会污染图像接口）。
    const providerConfig = await this.getProviderConfig(modelInfo.provider)
    if (!providerConfig.apiKey) {
      throw new Error(`${modelInfo.provider} API Key 未配置`)
    }

    const provider = createImageProvider(modelInfo.provider, providerConfig)
    // 方舟 Plan 出图请求体固定：model/prompt/size/n/output_format/response_format/watermark；
    // 不透传 negative_prompt/style/config（Plan 示例无这些字段）。negativePrompt/style 仅在调用层留存。
    return provider.generateImage({
      model: modelInfo.model_id,
      prompt,
      size,
      n
    })
  }

  /**
   * 从数据库获取绘图模型信息
   */
  async getImageModelInfo(modelId) {
    try {
      return await db.queryOne(
        'SELECT * FROM image_models WHERE model_id = ? LIMIT 1',
        [modelId]
      )
    } catch (e) {
      logger.error('[AIService] 读取绘图模型配置失败:', e.message)
      return null
    }
  }
}

// ======================== Provider 工厂 ========================

// 收敛后：对话 Provider 统一为方舟 ArkChatProvider（Plan chat/completions）。
// 联网搜索模型由 chatCompletion/streamChatCompletion 直接 new DoubaoWebSearchProvider，不经此工厂。
function createProvider(name, providerConfig) {
  return new ArkChatProvider(providerConfig)
}

function createImageProvider(name, providerConfig) {
  // 图像 Provider 收敛为单一方舟（ArkImageProvider）。name 收敛后恒为 'ark'，
  // 保留入参仅为兼容 generateImage 的调用签名。
  return new ArkImageProvider(providerConfig)
}

// ======================== 方舟对话 Provider ========================
// 火山方舟 Agent Plan：chat/completions 接口，Bearer 认证。
// baseUrl = config.ai.ark.planBaseUrl（https://ark.cn-beijing.volces.com/api/plan），
// 请求路径 /chat/completions。流式/非流式均支持。
class ArkChatProvider {
  constructor(providerConfig = {}) {
    this.apiKey = providerConfig.apiKey || config.ai.ark.apiKey || ''
    this.baseUrl = providerConfig.baseUrl || config.ai.ark.planBaseUrl
  }

  buildRequestBody(model, messages, options = {}, stream = false) {
    return {
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      stream
    }
  }

  async chatCompletion(model, messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('火山方舟 API Key未配置')
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(this.buildRequestBody(model, messages, options, false))
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`火山方舟 API错误: ${error}`)
    }

    return await response.json()
  }

  async *streamChatCompletion(model, messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('火山方舟 API Key未配置')
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(this.buildRequestBody(model, messages, options, true))
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`火山方舟 API错误: ${error}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.trim())

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta
              // 优先 content；deepseek-v4-pro 等模型会先输出 reasoning_content，再输出 content
              const content = delta?.content || delta?.reasoning_content || ''
              if (content) {
                yield content
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}

// ======================== 方舟联网搜索 Provider ========================
// 使用火山方舟 Plan Responses API + web_search 工具实现联网搜索。
// baseUrl = config.ai.ark.planBaseUrl，请求路径 /responses
// （即 https://ark.cn-beijing.volces.com/api/plan/responses），Bearer 认证用 config.ai.ark.apiKey。
class DoubaoWebSearchProvider {
  constructor(providerConfig = {}) {
    this.apiKey = providerConfig.apiKey || config.ai.ark.apiKey || ''
    this.baseUrl = providerConfig.baseUrl || config.ai.ark.planBaseUrl
  }

  buildInput(messages) {
    return messages.map(msg => ({
      role: msg.role,
      content: Array.isArray(msg.content)
        ? msg.content.map(part => {
            if (part.type === 'text') {
              return { type: 'input_text', text: part.text }
            }
            if (part.type === 'image_url' && part.image_url) {
              return { type: 'input_image', image_url: part.image_url.url }
            }
            return { type: 'input_text', text: String(part) }
          })
        : [{ type: 'input_text', text: msg.content }]
    }))
  }

  buildRequestBody(model, messages, options = {}, stream = false) {
    return {
      model,
      input: this.buildInput(messages),
      tools: [{
        type: 'web_search',
        max_keyword: options.maxKeyword || 3,
        limit: options.searchLimit || 10
      }],
      max_tool_calls: options.maxToolCalls || 3,
      stream
    }
  }

  async chatCompletion(model, messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('豆包 API Key未配置')
    }

    const response = await fetch(`${this.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(this.buildRequestBody(model, messages, options, false))
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`豆包 Web Search API错误: ${error}`)
    }

    const data = await response.json()
    // Responses API 输出在 output 数组中，找到 message 类型的内容
    const text = data.output
      ?.filter(item => item.type === 'message')
      ?.map(item => item.content?.map(c => c.text).join(''))
      ?.join('')
    return {
      choices: [{
        message: { role: 'assistant', content: text || '' }
      }],
      usage: data.usage || {}
    }
  }

  async *streamChatCompletion(model, messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('豆包 API Key未配置')
    }

    const response = await fetch(`${this.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(this.buildRequestBody(model, messages, options, true))
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`豆包 Web Search API错误: ${error}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.trim())

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              // 流式回答文本在 output_text.delta 事件中
              if (parsed.type === 'response.output_text.delta') {
                const text = parsed.delta || ''
                if (text) yield text
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}

module.exports = new AIService()

// ======================== 图像生成 Provider ========================
// 火山方舟 Agent Plan 文生图：接口 /images/generations，Bearer 认证用 config.ai.ark.apiKey。
// baseUrl 固定取 config.ai.ark.planV3BaseUrl（https://ark.cn-beijing.volces.com/api/plan/v3），
// 不依赖 model_providers.base_url（该字段存对话用 planBaseUrl，会污染图像接口，参考 embedding.service）。
// 请求体固定：model/prompt/size(档位 1K/2K)/n/output_format(png)/response_format(url)/watermark(false)。
class ArkImageProvider {
  constructor(providerConfig = {}) {
    this.apiKey = providerConfig.apiKey || config.ai.ark.apiKey || ''
    this.baseUrl = config.ai.ark.planV3BaseUrl
  }

  async generateImage({ model, prompt, size = '1K', n = 1 }) {
    if (!this.apiKey) {
      throw new Error('火山方舟 API Key 未配置')
    }

    const body = {
      model,
      prompt,
      size,
      n,
      output_format: 'png',
      response_format: 'url',
      watermark: false
    }

    const response = await fetch(`${this.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`火山方舟图像生成失败: ${error}`)
    }

    const data = await response.json()
    const images = (data.data || []).map(item => item.url).filter(Boolean)
    return { images, revisedPrompt: data.data?.[0]?.revised_prompt || prompt }
  }
}
