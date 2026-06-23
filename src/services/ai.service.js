const config = require('../config')
const db = require('../utils/db')
const logger = require('../utils/logger')

/**
 * AI服务 - 支持多模型切换
 * 统一封装各厂商API调用，支持从数据库动态读取模型配置与 API Key
 */

class AIService {
  constructor() {
    // 硬编码兜底模型列表
    this.fallbackModels = [
      {
        id: 1,
        name: 'DeepSeek V4 Pro',
        provider: 'deepseek',
        model_id: 'deepseek-v4-pro',
        description: 'DeepSeek最新对话模型，支持联网搜索',
        is_default: true,
        is_active: true,
        max_tokens: 8192,
        sort_order: 0
      },
      {
        id: 2,
        name: 'DeepSeek V4 Flash',
        provider: 'deepseek',
        model_id: 'deepseek-v4-flash',
        description: 'DeepSeek轻量快速模型，支持联网搜索',
        is_default: false,
        is_active: true,
        max_tokens: 8192,
        sort_order: 1
      },
      {
        id: 3,
        name: 'DeepSeek V3',
        provider: 'deepseek',
        model_id: 'deepseek-chat',
        description: 'DeepSeek对话模型，综合能力强',
        is_default: false,
        is_active: true,
        max_tokens: 8192,
        sort_order: 2
      },
      {
        id: 4,
        name: 'DeepSeek R1',
        provider: 'deepseek',
        model_id: 'deepseek-reasoner',
        description: 'DeepSeek推理模型，擅长逻辑推理和编程',
        is_default: false,
        is_active: true,
        max_tokens: 8192,
        sort_order: 3
      },
      {
        id: 5,
        name: '通义千问 Turbo',
        provider: 'qwen',
        model_id: 'qwen-turbo',
        description: '阿里云通义千问，中文理解优秀',
        is_default: false,
        is_active: true,
        max_tokens: 4096,
        sort_order: 4
      },
      {
        id: 6,
        name: '通义千问 Max',
        provider: 'qwen',
        model_id: 'qwen-max',
        description: '通义千问最强版本',
        is_default: false,
        is_active: true,
        max_tokens: 4096,
        sort_order: 5
      },
      {
        id: 7,
        name: 'Claude Sonnet',
        provider: 'claude',
        model_id: 'claude-sonnet-4-6',
        description: 'Anthropic Claude，英文能力出色',
        is_default: false,
        is_active: true,
        max_tokens: 4096,
        sort_order: 6
      }
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
   * 从数据库获取 Provider 配置（API Key + Base URL）
   */
  async getProviderConfig(providerName) {
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

    // 回退到 .env 配置
    const envConfig = config.ai[providerName]
    if (envConfig) {
      return { apiKey: envConfig.apiKey, baseUrl: envConfig.baseUrl }
    }

    return { apiKey: '', baseUrl: '' }
  }

  /**
   * 解析模型对应的 Provider 名称与配置
   */
  async resolveProvider(modelId) {
    const modelInfo = await this.getModelInfo(modelId)
    let providerName = modelInfo?.provider

    if (!providerName) {
      if (modelId.startsWith('deepseek')) providerName = 'deepseek'
      else if (modelId.startsWith('qwen') || modelId.startsWith('gpt')) providerName = 'qwen'
      else if (modelId.startsWith('claude')) providerName = 'claude'
      else if (modelId.startsWith('doubao') || modelId.startsWith('ark')) providerName = 'doubao'
      else if (modelId.startsWith('moonshot')) providerName = 'moonshot'
      else if (modelId.startsWith('glm')) providerName = 'zhipu'
      else if (modelId.startsWith('spark') || modelId.startsWith('xinghuo')) providerName = 'xinghuo'
      else if (modelId.startsWith('minimax')) providerName = 'minimax'
      else if (modelId.startsWith('ernie')) providerName = 'qianfan'
      else providerName = 'deepseek'
    }

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

    // 豆包模型若支持联网搜索，使用 Responses API
    if (modelInfo?.supports_web_search && providerName === 'doubao') {
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

    // 豆包模型若支持联网搜索，使用 Responses API
    if (modelInfo?.supports_web_search && providerName === 'doubao') {
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

    const providerConfig = await this.getProviderConfig(modelInfo.provider)
    if (!providerConfig.apiKey) {
      throw new Error(`${modelInfo.provider} API Key 未配置`)
    }

    const provider = createImageProvider(modelInfo.provider, providerConfig)
    return provider.generateImage({
      model: modelInfo.model_id,
      prompt,
      negativePrompt,
      size,
      style,
      n,
      config: modelInfo.config && typeof modelInfo.config === 'string' ? JSON.parse(modelInfo.config) : (modelInfo.config || {})
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

function createProvider(name, providerConfig) {
  switch (name) {
    case 'deepseek':
      return new DeepSeekProvider(providerConfig)
    case 'qwen':
      return new QwenProvider(providerConfig)
    case 'claude':
      return new ClaudeProvider(providerConfig)
    case 'doubao':
    case 'moonshot':
    case 'qianfan':
    case 'zhipu':
    case 'xinghuo':
    case 'minimax':
      return new OpenAICompatibleProvider(name, providerConfig)
    default:
      return new OpenAICompatibleProvider(name, providerConfig)
  }
}

function createImageProvider(name, providerConfig) {
  switch (name) {
    case 'doubao':
      return new DoubaoImageProvider(providerConfig)
    case 'openai':
      return new OpenAIImageProvider(providerConfig)
    default:
      return new OpenAIImageProvider(name, providerConfig)
  }
}

// ======================== DeepSeek Provider ========================

class DeepSeekProvider {
  constructor(providerConfig = {}) {
    this.apiKey = providerConfig.apiKey || ''
    this.baseUrl = providerConfig.baseUrl || 'https://api.deepseek.com'
  }

  async chatCompletion(model, messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('DeepSeek API Key未配置')
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
      throw new Error(`DeepSeek API错误: ${error}`)
    }

    return await response.json()
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

  async *streamChatCompletion(model, messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('DeepSeek API Key未配置')
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
      throw new Error(`DeepSeek API错误: ${error}`)
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
              // deepseek-v4-pro 会先输出 reasoning_content，再输出 content
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

// ======================== 通义千问 Provider ========================

class QwenProvider {
  constructor(providerConfig = {}) {
    this.apiKey = providerConfig.apiKey || ''
    this.baseUrl = providerConfig.baseUrl || 'https://dashscope.aliyuncs.com'
  }

  async chatCompletion(model, messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('通义千问 API Key未配置')
    }

    const response = await fetch(`${this.baseUrl}/compatible-mode/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`通义千问 API错误: ${error}`)
    }

    return await response.json()
  }

  async *streamChatCompletion(model, messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('通义千问 API Key未配置')
    }

    const response = await fetch(`${this.baseUrl}/compatible-mode/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
        stream: true
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`通义千问 API错误: ${error}`)
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
              const content = parsed.choices?.[0]?.delta?.content || ''
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

// ======================== Claude Provider ========================

class ClaudeProvider {
  constructor(providerConfig = {}) {
    this.apiKey = providerConfig.apiKey || ''
    this.baseUrl = providerConfig.baseUrl || 'https://api.anthropic.com'
  }

  async chatCompletion(model, messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('Claude API Key未配置')
    }

    const { system, claudeMessages } = this.convertMessages(messages)

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model.replace('claude-', 'claude-3-'),
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.7,
        system,
        messages: claudeMessages
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Claude API错误: ${error}`)
    }

    return await response.json()
  }

  async *streamChatCompletion(model, messages, options = {}) {
    if (!this.apiKey) {
      throw new Error('Claude API Key未配置')
    }

    const { system, claudeMessages } = this.convertMessages(messages)

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model.replace('claude-', 'claude-3-'),
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.7,
        system,
        messages: claudeMessages,
        stream: true
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Claude API错误: ${error}`)
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
              const content = parsed.delta?.text || ''
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

  convertMessages(messages) {
    let system = ''
    const claudeMessages = []

    for (const msg of messages) {
      if (msg.role === 'system') {
        system += msg.content + '\n'
      } else {
        claudeMessages.push({
          role: msg.role,
          content: msg.content
        })
      }
    }

    return { system: system.trim(), claudeMessages }
  }
}

// ======================== OpenAI 兼容通用 Provider ========================
// 用于豆包、Kimi、智谱、星火、MiniMax、文心一言等 OpenAI 兼容接口
class OpenAICompatibleProvider {
  constructor(name = 'openai', providerConfig = {}) {
    this.name = name
    this.apiKey = providerConfig.apiKey || ''
    this.baseUrl = providerConfig.baseUrl || ''
  }

  displayName() {
    const nameMap = {
      doubao: '豆包',
      moonshot: 'Kimi',
      qianfan: '文心一言',
      zhipu: '智谱 GLM',
      xinghuo: '讯飞星火',
      minimax: 'MiniMax'
    }
    return nameMap[this.name] || this.name
  }

  async chatCompletion(model, messages, options = {}) {
    if (!this.apiKey) {
      throw new Error(`${this.displayName()} API Key未配置`)
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
      throw new Error(`${this.displayName()} API错误: ${error}`)
    }

    return await response.json()
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

  async *streamChatCompletion(model, messages, options = {}) {
    if (!this.apiKey) {
      throw new Error(`${this.displayName()} API Key未配置`)
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
      throw new Error(`${this.displayName()} API错误: ${error}`)
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
              // 通用 OpenAI 兼容接口只取 content，避免解析 reasoning_content 造成差异
              const content = delta?.content || ''
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

// ======================== 豆包 Web Search Provider ========================
// 使用火山方舟 Responses API + web_search 工具实现联网搜索
class DoubaoWebSearchProvider {
  constructor(providerConfig = {}) {
    this.apiKey = providerConfig.apiKey || ''
    this.baseUrl = providerConfig.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3'
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
class OpenAIImageProvider {
  constructor(providerConfig = {}) {
    this.apiKey = providerConfig.apiKey || ''
    this.baseUrl = providerConfig.baseUrl || 'https://api.openai.com/v1'
  }

  async generateImage({ model, prompt, negativePrompt, size = '1024x1024', style, n = 1, config = {} }) {
    if (!this.apiKey) {
      throw new Error('API Key 未配置')
    }

    const body = {
      model,
      prompt,
      n,
      size,
      response_format: 'url'
    }
    if (style) body.style = style
    if (negativePrompt) body.negative_prompt = negativePrompt

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
      throw new Error(`图像生成失败: ${error}`)
    }

    const data = await response.json()
    const images = (data.data || []).map(item => item.url).filter(Boolean)
    return { images, revisedPrompt: data.data?.[0]?.revised_prompt || prompt }
  }
}

class DoubaoImageProvider extends OpenAIImageProvider {
  constructor(providerConfig = {}) {
    super(providerConfig)
    this.baseUrl = providerConfig.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3'
  }

  async generateImage({ model, prompt, negativePrompt, size = '1024x1024', style, n = 1, config = {} }) {
    if (!this.apiKey) {
      throw new Error('豆包 API Key 未配置')
    }

    // 豆包图像生成支持 OpenAI 兼容接口 /images/generations
    const body = {
      model,
      prompt,
      n,
      size,
      response_format: 'url'
    }

    // 部分豆包模型支持 quality/response_format，透传 config
    if (config.quality) body.quality = config.quality
    if (negativePrompt) body.negative_prompt = negativePrompt

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
      throw new Error(`豆包图像生成失败: ${error}`)
    }

    const data = await response.json()
    const images = (data.data || []).map(item => item.url).filter(Boolean)
    return { images, revisedPrompt: data.data?.[0]?.revised_prompt || prompt }
  }
}
