const WebSocket = require('ws')
const OpenAIRealtimeAdapter = require('./openai-adapter')
const logger = require('../../utils/logger')

/**
 * 阿里百炼 Qwen-Omni-Realtime 适配器
 * 协议与 OpenAI Realtime 兼容，仅连接 URL 不同。
 */
class QwenRealtimeAdapter extends OpenAIRealtimeAdapter {
  async connect() {
    const url = `${this.baseUrl}/api-ws/v1/realtime?model=${encodeURIComponent(this.realtimeModel)}`
    logger.info(`[QwenAdapter] 连接上游: ${url}`)
    const headers = {
      Authorization: `Bearer ${this.apiKey}`
    }
    return new WebSocket(url, { headers })
  }
}

module.exports = QwenRealtimeAdapter
