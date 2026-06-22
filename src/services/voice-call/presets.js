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
    voice_intros: {
      alloy: '中性自然，适合日常对话',
      echo: '成熟稳重男声',
      fable: '明亮清晰女声',
      onyx: '低沉有力男声',
      nova: '活泼亲和女声',
      shimmer: '年轻温柔女声'
    },
    input_sample_rate: 24000,
    output_sample_rate: 24000
  },
  gemini: {
    name: 'Gemini Live',
    base_url: 'wss://generativelanguage.googleapis.com',
    realtime_model: 'models/gemini-3.1-flash-live-preview',
    // Gemini 语音合成官方音色列表：
    // https://ai.google.dev/gemini-api/docs/interactions/speech-generation?hl=zh-cn#voices
    voices: ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Zephyr', 'Leda', 'Orus', 'Callirrhoe', 'Algieba'],
    voice_labels: {
      Puck: '帕克',
      Charon: '卡戎',
      Kore: '科瑞',
      Fenrir: '芬里尔',
      Aoede: '阿欧德',
      Zephyr: '泽菲尔',
      Leda: '勒达',
      Orus: '奥鲁斯',
      Callirrhoe: '卡利罗厄',
      Algieba: '阿尔吉巴'
    },
    voice_intros: {
      Puck: '默认女声，清晰自然',
      Charon: '低沉磁性男声',
      Kore: '年轻活泼女声',
      Fenrir: '浑厚有力男声',
      Aoede: '抒情柔和女声',
      Zephyr: '轻快明亮女声',
      Leda: '温暖亲和女声',
      Orus: '沉稳成熟男声',
      Callirrhoe: '清脆悦耳女声',
      Algieba: '柔和叙事女声'
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
    voice_intros: {
      zhiyan_lily: '温柔亲切女声',
      zhiyan_yunxi: '知性沉稳女声',
      zhiyan_yunjian: '成熟稳重男声',
      zhiyan_boy: '阳光少年男声'
    },
    input_sample_rate: 16000,
    output_sample_rate: 16000
  },
  qwen: {
    name: '阿里百炼实时多模态',
    base_url: 'wss://dashscope.aliyuncs.com',
    realtime_model: config.ai.qwen.realtimeModel || 'qwen3.5-omni-plus-realtime',
    // 音色取自 Qwen3.5-Omni-Realtime 系列官方列表：
    // https://help.aliyun.com/zh/model-studio/omni-voice-list
    voices: ['Tina', 'Cindy', 'Serena', 'Ethan', 'Raymond', 'Qiao', 'Momo', 'Li'],
    voice_labels: {
      Tina: 'Tina',
      Cindy: 'Cindy',
      Serena: 'Serena',
      Ethan: 'Ethan',
      Raymond: 'Raymond',
      Qiao: 'Qiao',
      Momo: 'Momo',
      Li: 'Li'
    },
    voice_intros: {
      Tina: '默认女声，自然清晰',
      Cindy: '活泼轻快女声',
      Serena: '沉稳优雅女声',
      Ethan: '沉稳自然男声',
      Raymond: '成熟磁性男声',
      Qiao: '亲和中文女声',
      Momo: '可爱灵动女声',
      Li: '自然偏低男声'
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
