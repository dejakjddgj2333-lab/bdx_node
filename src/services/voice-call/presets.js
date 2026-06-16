const config = require('../../config')

/**
 * 语音通话厂商预设
 * 后端各模块统一从此文件读取，避免多处维护。
 */
const VOICE_PROVIDER_PRESETS = {
  openai: {
    name: 'OpenAI Realtime',
    base_url: 'wss://api.openai.com',
    realtime_model: 'gpt-4o-realtime-preview-2024-12-17',
    voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
    voice_labels: {
      alloy: '合金',
      echo: '回声',
      fable: '寓言',
      onyx: '玛瑙',
      nova: '新星',
      shimmer: '微光'
    },
    input_sample_rate: 24000,
    output_sample_rate: 24000
  },
  gemini: {
    name: 'Gemini Live',
    base_url: 'wss://generativelanguage.googleapis.com',
    realtime_model: 'models/gemini-3.1-flash-live-preview',
    voices: ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'],
    voice_labels: {
      Puck: '帕克',
      Charon: '卡戎',
      Kore: '科瑞',
      Fenrir: '芬里尔',
      Aoede: '阿欧德'
    },
    input_sample_rate: 16000,
    output_sample_rate: 24000
  },
  doubao: {
    name: '豆包实时语音',
    base_url: 'wss://ws.ark.cn-beijing.volces.com',
    realtime_model: 'doubao-realtime-v1',
    voices: ['zhiyan_lily', 'zhiyan_yunxi', 'zhiyan_yunjian', 'zhiyan_boy'],
    voice_labels: {
      zhiyan_lily: '知言 · 莉莉',
      zhiyan_yunxi: '知言 · 云曦',
      zhiyan_yunjian: '知言 · 云健',
      zhiyan_boy: '知言 · 男孩'
    },
    input_sample_rate: 16000,
    output_sample_rate: 16000
  },
  qwen: {
    name: '阿里百炼实时多模态',
    base_url: 'wss://dashscope.aliyuncs.com',
    realtime_model: config.ai.qwen.realtimeModel || 'qwen3.5-omni-plus-realtime',
    voices: ['zhiyan', 'xiaogang', 'xiaomei'],
    voice_labels: {
      zhiyan: '知言',
      xiaogang: '小刚',
      xiaomei: '小美'
    },
    input_sample_rate: 24000,
    output_sample_rate: 24000
  }
}

function getVoiceProviderPreset(provider) {
  return VOICE_PROVIDER_PRESETS[provider] || null
}

module.exports = {
  VOICE_PROVIDER_PRESETS,
  getVoiceProviderPreset
}
