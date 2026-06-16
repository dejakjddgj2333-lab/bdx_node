const WebSocket = require('ws')
const OpenAIRealtimeAdapter = require('./openai-adapter')

/**
 * 阿里百炼 Qwen-Omni-Realtime 适配器
 * 协议与 OpenAI Realtime 兼容，仅连接 URL 不同。
 */
class QwenRealtimeAdapter extends OpenAIRealtimeAdapter {
  async connect() {
    const url = `${this.baseUrl}/api-ws/v1/realtime?model=${encodeURIComponent(this.realtimeModel)}`
    const headers = {
      Authorization: `Bearer ${this.apiKey}`
    }
    return new WebSocket(url, { headers })
  }
}

module.exports = QwenRealtimeAdapter
