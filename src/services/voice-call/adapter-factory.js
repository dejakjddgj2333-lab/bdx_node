const config = require('../../config')
const db = require('../../utils/db')
const { getVoiceProviderPreset } = require('./presets')

/**
 * 读取当前语音厂商配置（已收敛为方舟 Plan）
 * 优先 voice_providers 表，回退 .env 的 ARK_API_KEY
 * 默认音色优先读 tts_voices.is_default，回退 preset
 */
async function loadCurrentVoiceProvider() {
  const row = await db.queryOne(
    "SELECT * FROM voice_providers WHERE provider = 'ark' AND is_active = TRUE LIMIT 1"
  )

  const preset = getVoiceProviderPreset('ark')
  const apiKey = (row && row.api_key) || config.ai.ark.apiKey || ''

  // 默认音色：优先 tts_voices 表 is_default
  let defaultVoice = (row && row.default_voice) || null
  if (!defaultVoice) {
    try {
      const v = await db.queryOne(
        'SELECT speaker FROM tts_voices WHERE is_default = TRUE AND is_active = TRUE LIMIT 1'
      )
      if (v) defaultVoice = v.speaker
    } catch (e) {
      // tts_voices 表可能尚未建（迁移未跑），忽略
    }
  }
  if (!defaultVoice) defaultVoice = preset.voices[0]

  return {
    provider: 'ark',
    name: (row && row.name) || preset.name,
    api_key: apiKey,
    base_url: (row && row.base_url) || preset.base_url,
    tts_model: (row && row.realtime_model) || preset.tts_model,
    default_voice: defaultVoice,
    preset
  }
}

module.exports = {
  loadCurrentVoiceProvider
}
