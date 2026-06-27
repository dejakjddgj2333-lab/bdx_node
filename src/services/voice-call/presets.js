const config = require('../../config')

/**
 * 语音通话厂商预设（已收敛为火山方舟 Agent Plan 单一入口）
 * 阶段二：TTS/ASR 分离模型，前后端编排。
 */
const VOICE_PROVIDER_PRESETS = {
  ark: {
    name: '火山方舟 Agent Plan 语音',
    // TTS / ASR 各自的 WebSocket 域名（已在 client 内硬编码，此处仅用于展示/回退）
    base_url: 'wss://openspeech.bytedance.com',
    tts_model: 'doubao-seed-tts-2.0',
    asr_model: 'doubao-seed-asr-2.0',
    tts_resource_id: 'seed-tts-2.0',
    asr_resource_id: 'volc.seedasr.sauc.duration',
    // 默认音色（后台 tts_voices.is_default 可覆盖；无配置时兜底）
    voices: ['zh_female_vv_uranus_bigtts'],
    voice_labels: {
      zh_female_vv_uranus_bigtts: 'Vivi 2.0'
    },
    voice_intros: {
      zh_female_vv_uranus_bigtts: '语调平稳、咬字柔和的治愈女声'
    },
    input_sample_rate: 16000,
    output_sample_rate: 24000
  }
}

function getVoiceProviderPreset(provider) {
  return VOICE_PROVIDER_PRESETS[provider] || VOICE_PROVIDER_PRESETS.ark
}

module.exports = {
  VOICE_PROVIDER_PRESETS,
  getVoiceProviderPreset
}
