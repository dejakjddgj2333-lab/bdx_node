const config = require('../../config')
const db = require('../../utils/db')
const { getVoiceProviderPreset, VOICE_PROVIDER_PRESETS } = require('./presets')
const OpenAIRealtimeAdapter = require('./openai-adapter')
const QwenRealtimeAdapter = require('./qwen-adapter')
const GeminiLiveAdapter = require('./gemini-adapter')
const DoubaoRealtimeAdapter = require('./doubao-adapter')

/**
 * 从数据库读取当前启用的语音厂商配置
 * 如果没有配置，回退到 .env 中配置的 qwen
 */
async function loadCurrentVoiceProvider() {
  const row = await db.queryOne(
    'SELECT * FROM voice_providers WHERE is_current = TRUE AND is_active = TRUE LIMIT 1'
  )

  if (row && row.provider && VOICE_PROVIDER_PRESETS[row.provider]) {
    const preset = getVoiceProviderPreset(row.provider)
    const envKey = config.ai[row.provider]?.apiKey || ''
    return {
      provider: row.provider,
      name: row.name || preset.name,
      api_key: row.api_key || envKey,
      base_url: row.base_url || preset.base_url,
      realtime_model: row.realtime_model || preset.realtime_model,
      default_voice: row.default_voice || preset.voices[0] || null,
      preset
    }
  }

  // 回退默认：qwen
  const qwenPreset = getVoiceProviderPreset('qwen')
  return {
    provider: 'qwen',
    name: qwenPreset.name,
    api_key: config.ai.qwen.apiKey,
    base_url: qwenPreset.base_url,
    realtime_model: qwenPreset.realtime_model,
    default_voice: qwenPreset.voices[0] || null,
    preset: qwenPreset
  }
}

/**
 * 创建对应厂商的 Adapter 实例
 */
function createVoiceAdapter(providerConfig) {
  const preset = providerConfig.preset || getVoiceProviderPreset(providerConfig.provider)
  if (!preset) {
    throw new Error(`未知语音厂商: ${providerConfig.provider}`)
  }

  switch (providerConfig.provider) {
    case 'openai':
      return new OpenAIRealtimeAdapter(providerConfig, preset)
    case 'qwen':
      return new QwenRealtimeAdapter(providerConfig, preset)
    case 'gemini':
      return new GeminiLiveAdapter(providerConfig, preset)
    case 'doubao':
      return new DoubaoRealtimeAdapter(providerConfig, preset)
    default:
      throw new Error(`未实现语音厂商: ${providerConfig.provider}`)
  }
}

module.exports = {
  loadCurrentVoiceProvider,
  createVoiceAdapter
}
