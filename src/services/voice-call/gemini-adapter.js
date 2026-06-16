const VoiceCallAdapter = require('./adapter-base')

/**
 * Gemini Live API 适配器
 *
 * Gemini Live 协议要点：
 * - WebSocket 地址：wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key={API_KEY}
 * - 模型、音色在首个 setup 消息里配置
 * - 客户端音频通过 realtimeInput.mediaChunks 发送
 * - 服务端返回 serverContent.modelTurn.parts（含 audio/pcm）
 * - 输入采样率 16kHz，输出采样率 24kHz（与预设一致）
 *
 * 为兼容前端 OpenAI Realtime 流程：
 * - 收到首个 session.update → 转为 setup 消息发送
 * - input_audio_buffer.append → realtimeInput
 * - setupComplete → session.created（让前端继续发送配置并开始录音）
 * - serverContent.modelTurn.parts 音频 → response.audio.delta
 * - serverContent.turnComplete → response.done
 */
class GeminiLiveAdapter extends VoiceCallAdapter {
  constructor(config, preset) {
    super(config, preset)
    this._setupSent = false
    this._pendingSetup = null
  }

  async connect() {
    const url = `${this.baseUrl}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(this.apiKey)}`
    return new (require('ws'))(url)
  }

  translateClientEvent(event) {
    if (!event || typeof event !== 'object') {
      return [{ payload: JSON.stringify(event), isBinary: false }]
    }

    const type = event.type

    // 首个 session.update 转为 setup
    if (type === 'session.update') {
      const setup = this._buildSetup(event)
      this._setupSent = true
      return [{ payload: JSON.stringify(setup), isBinary: false }]
    }

    // 后续再收到 session.update：Gemini 不支持运行时改音色，忽略
    if (type === 'session.update' && this._setupSent) {
      return []
    }

    // 音频输入
    if (type === 'input_audio_buffer.append' && typeof event.audio === 'string') {
      // 前端输入 16kHz，Gemini 也要求 16kHz，理论上无需重采样；
      // 但保留 resampleInputAudio 调用以防御配置变化。
      const audio = this.inputSampleRate === 16000
        ? event.audio
        : this.resampleInputAudio(event.audio)

      return [{
        payload: JSON.stringify({
          realtimeInput: {
            mediaChunks: [{
              mimeType: 'audio/pcm;rate=16000',
              data: audio
            }]
          }
        }),
        isBinary: false
      }]
    }

    // response.create 等事件 Gemini 不需要，忽略
    if (type === 'response.create') {
      return []
    }

    // 其他未知事件直接忽略（避免发送不支持的协议事件导致连接断开）
    return []
  }

  translateUpstreamMessage(data) {
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
      const results = []

      if (event.setupComplete !== undefined) {
        results.push({
          payload: JSON.stringify({ type: 'session.created', session: { id: 'gemini-live-session' } }),
          isBinary: false
        })
      }

      if (event.serverContent) {
        const serverContent = event.serverContent

        // 音频数据
        if (serverContent.modelTurn?.parts) {
          for (const part of serverContent.modelTurn.parts) {
            if (part.inlineData?.mimeType?.startsWith('audio/pcm') && typeof part.inlineData.data === 'string') {
              let pcm16 = Buffer.from(part.inlineData.data, 'base64')
              // Gemini 输出 24kHz，前端播放器也是 24kHz，正常无需重采样
              if (this.outputSampleRate !== 24000) {
                pcm16 = this.resampleOutputAudio(pcm16)
              }
              results.push({
                payload: JSON.stringify({
                  type: 'response.audio.delta',
                  delta: pcm16.toString('base64')
                }),
                isBinary: false
              })
            }

            // 文本/转录
            if (typeof part.text === 'string' && part.text.length > 0) {
              results.push({
                payload: JSON.stringify({
                  type: 'response.audio_transcript.delta',
                  delta: part.text
                }),
                isBinary: false
              })
            }
          }
        }

        // 服务端完成一轮响应
        if (serverContent.turnComplete) {
          results.push({
            payload: JSON.stringify({ type: 'response.done' }),
            isBinary: false
          })
        }

        // 被用户打断
        if (serverContent.interrupted) {
          results.push({
            payload: JSON.stringify({ type: 'input_audio_buffer.speech_started' }),
            isBinary: false
          })
        }
      }

      if (results.length > 0) {
        return results
      }
    } catch (_) {
      // 解析失败按原样透传
    }

    return [{ payload: data, isBinary: Buffer.isBuffer(data) }]
  }

  _buildSetup(sessionUpdateEvent) {
    const session = sessionUpdateEvent.session || {}
    const voice = session.voice || this.config.default_voice || this.preset.voices[0] || 'Puck'

    return {
      setup: {
        model: this.realtimeModel,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice
              }
            }
          }
        }
      }
    }
  }
}

module.exports = GeminiLiveAdapter
