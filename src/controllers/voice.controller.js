const db = require('../utils/db')
const { success, error } = require('../utils/response')
const { VOICE_PROVIDER_PRESETS, getVoiceProviderPreset } = require('../services/voice-call/presets')

// 语音通话厂商预设统一从 ../services/voice-call/presets.js 读取

/**
 * 获取当前语音通话厂商配置（供 App 使用，不含 api_key）
 */
async function getCurrentProvider(ctx) {
  const row = await db.queryOne(
    'SELECT * FROM voice_providers WHERE is_current = TRUE AND is_active = TRUE LIMIT 1'
  )

  let provider = 'qwen'
  let preset = VOICE_PROVIDER_PRESETS.qwen

  if (row && row.provider && VOICE_PROVIDER_PRESETS[row.provider]) {
    provider = row.provider
    preset = VOICE_PROVIDER_PRESETS[row.provider]
  }

  const realtimeModel = row?.realtime_model || preset.realtime_model
  const defaultVoice = row?.default_voice || preset.voices[0] || null
  const voices = preset.voices || []

  success(ctx, {
    provider,
    name: row?.name || preset.name,
    realtime_model: realtimeModel,
    voices,
    voice_labels: preset.voice_labels || {},
    voice_intros: preset.voice_intros || {},
    default_voice: defaultVoice
  })
}

module.exports = {
  getCurrentProvider
}
