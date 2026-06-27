const db = require('../utils/db')
const { success, error } = require('../utils/response')
const { VOICE_PROVIDER_PRESETS, getVoiceProviderPreset } = require('../services/voice-call/presets')

/**
 * 获取当前语音配置（供 App 使用，不含 api_key）
 */
async function getCurrentProvider(ctx) {
  const row = await db.queryOne(
    "SELECT * FROM voice_providers WHERE provider = 'ark' AND is_active = TRUE LIMIT 1"
  )

  const preset = getVoiceProviderPreset('ark')

  // 默认音色优先读 tts_voices.is_default
  let defaultVoice = (row && row.default_voice) || null
  // 暴露给 App 的音色列表 + 标签
  let voices = []
  let voiceLabels = {}
  let voiceIntros = {}
  try {
    const rows = await db.query(
      `SELECT speaker, name, description FROM tts_voices
       WHERE is_active = TRUE AND is_exposed = TRUE ORDER BY sort_order ASC, id ASC`
    )
    voices = rows.map(r => r.speaker)
    for (const r of rows) {
      voiceLabels[r.speaker] = r.name
      voiceIntros[r.speaker] = r.description || ''
    }
    if (!defaultVoice) {
      defaultVoice = voices[0] || null
    }
  } catch (e) { /* tts_voices 表未建，用 preset 兜底 */ }
  if (!defaultVoice) defaultVoice = preset.voices[0]
  if (voices.length === 0) {
    voices = preset.voices
    voiceLabels = preset.voice_labels
    voiceIntros = preset.voice_intros
  }

  success(ctx, {
    provider: 'ark',
    name: (row && row.name) || preset.name,
    tts_model: (row && row.realtime_model) || preset.tts_model,
    voices,
    voice_labels: voiceLabels,
    voice_intros: voiceIntros,
    default_voice: defaultVoice
  })
}

/**
 * 获取可选音色列表（从 tts_voices 表，仅暴露给 App 的）
 */
async function getVoices(ctx) {
  try {
    const rows = await db.query(
      `SELECT speaker, name, gender, description, trial_url
       FROM tts_voices
       WHERE is_active = TRUE AND is_exposed = TRUE
       ORDER BY sort_order ASC, id ASC`
    )
    success(ctx, rows)
  } catch (e) {
    // tts_voices 表可能未建，返回预设兜底
    const preset = getVoiceProviderPreset('ark')
    success(ctx, preset.voices.map((v, i) => ({
      speaker: v,
      name: preset.voice_labels[v] || v,
      gender: '',
      description: preset.voice_intros[v] || '',
      trial_url: ''
    })))
  }
}

module.exports = {
  getCurrentProvider,
  getVoices
}
