const OpenAIRealtimeAdapter = require('./openai-adapter')
const logger = require('../../utils/logger')

/**
 * 豆包实时语音适配器（火山方舟Realtime API）
 *
 * 火山方舟Realtime API与OpenAI Realtime高度兼容：
 * - 连接地址：wss://ws.ark.cn-beijing.volces.com/api/v3/realtime?model=doubao-realtime-v1
 * - 认证：Authorization: Bearer {api_key}
 * - 事件格式：与OpenAI Realtime基本一致
 * - 音频采样率：输入16kHz（与前端录音一致，无需重采样），输出16kHz
 *
 * 注意：Flutter播放器固定以24kHz播放，因此需要把上游返回的16kHz音频
 * 重采样到24kHz后再下发给客户端。
 */
class DoubaoRealtimeAdapter extends OpenAIRealtimeAdapter {
  async connect() {
    const url = `${this.baseUrl}/api/v3/realtime?model=${encodeURIComponent(this.realtimeModel)}`
    logger.info(`[DoubaoAdapter] 连接上游: ${url}`)
    const headers = {
      Authorization: `Bearer ${this.apiKey}`
    }
    return new (require('ws'))(url, { headers })
  }

  translateUpstreamMessage(data) {
    // 非JSON消息（理论上不应出现）直接透传
    let text = ''
    if (Buffer.isBuffer(data)) {
      text = data.toString('utf8')
    } else if (typeof data === 'string') {
      text = data
    } else {
      return [{ payload: data, isBinary: Buffer.isBuffer(data) }]
    }

    if (!text.startsWith('{')) {
      return [{ payload: data, isBinary: Buffer.isBuffer(data) }]
    }

    try {
      const event = JSON.parse(text)
      if (event?.type === 'response.audio.delta' && typeof event.delta === 'string') {
        const pcm16 = Buffer.from(event.delta, 'base64')
        const resampled = this.resampleOutputAudio(pcm16)
        event.delta = resampled.toString('base64')
        return [{ payload: JSON.stringify(event), isBinary: false }]
      }
    } catch (_) {
      // 解析失败时按原样透传
    }

    return [{ payload: data, isBinary: Buffer.isBuffer(data) }]
  }
}

module.exports = DoubaoRealtimeAdapter
