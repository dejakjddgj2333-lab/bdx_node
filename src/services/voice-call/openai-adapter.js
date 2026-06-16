const WebSocket = require('ws')
const VoiceCallAdapter = require('./adapter-base')

/**
 * OpenAI Realtime API 适配器
 * 前端事件格式与 OpenAI Realtime 完全一致，主要做音频重采样。
 */
class OpenAIRealtimeAdapter extends VoiceCallAdapter {
  async connect() {
    const url = `${this.baseUrl}/v1/realtime?model=${encodeURIComponent(this.realtimeModel)}`
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      'OpenAI-Beta': 'realtime=v1'
    }
    return new WebSocket(url, { headers })
  }

  translateClientEvent(event) {
    if (event?.type === 'input_audio_buffer.append' && typeof event.audio === 'string') {
      return [{
        payload: JSON.stringify({
          ...event,
          audio: this.resampleInputAudio(event.audio)
        }),
        isBinary: false
      }]
    }
    return [{ payload: JSON.stringify(event), isBinary: false }]
  }
}

module.exports = OpenAIRealtimeAdapter
