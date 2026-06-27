/**
 * 火山方舟 Plan TTS 客户端（单流 unidirectional/stream）
 *
 * 接口：wss://openspeech.bytedance.com/api/v3/plan/tts/unidirectional/stream
 * 认证：X-Api-Key + X-Api-Resource-Id: seed-tts-2.0
 *
 * 单流：一次性发送全部文本，流式接收音频片段。简单可靠，适合逐句合成。
 * 流程：连接 → 发 full_client_request(含文本) → 收 TTSResponse 音频(AudioOnlyServer) → SessionFinished → 关闭
 *
 * 音频格式：format=pcm, sample_rate=24000, 单声道 16bit
 */
const WebSocket = require('ws')
const { v4: uuidv4 } = require('uuid')
const logger = require('../../utils/logger')
const { MsgType, Flag, marshal, parseMessage, jsonBuf, TTSEvent } = require('./plan-protocol')

const TTS_URL = 'wss://openspeech.bytedance.com/api/v3/plan/tts/unidirectional/stream'
const RESOURCE_ID = 'seed-tts-2.0'

class PlanTtsClient {
  /**
   * @param {object} opts { apiKey, speaker, sampleRate=24000, format='pcm' }
   */
  constructor(opts) {
    this.apiKey = opts.apiKey
    this.speaker = opts.speaker || 'zh_female_vv_uranus_bigtts'
    this.sampleRate = opts.sampleRate || 24000
    this.format = opts.format || 'pcm'
  }

  /**
   * 合成一段文本，流式回调音频。每次调用独立建连。
   * @param {string} text
   * @param {function(Buffer)} onAudio 每收到一块 PCM 调用
   */
  async synthesize(text, onAudio) {
    return new Promise((resolve, reject) => {
      const connectId = uuidv4()
      const ws = new WebSocket(TTS_URL, {
        headers: {
          'X-Api-Key': this.apiKey,
          'X-Api-Resource-Id': RESOURCE_ID,
          'X-Api-Connect-Id': connectId,
          'X-Control-Require-Usage-Tokens-Return': '*'
        },
        maxPayload: 16 * 1024 * 1024
      })

      let done = false
      const finish = (err) => {
        if (done) return
        done = true
        try { ws.close() } catch (e) {}
        if (err) reject(err)
        else resolve()
      }

      const timeout = setTimeout(() => finish(new Error('TTS 合成超时')), 20000)

      ws.on('message', (data) => {
        let msg
        try {
          msg = parseMessage(data)
        } catch (e) {
          logger.error('[TTS] 解析帧失败:', e.message)
          return
        }

        // 音频包
        if (msg.msgType === MsgType.AudioOnlyServer && msg.payload && msg.payload.length > 0) {
          try { onAudio(msg.payload) } catch (e) {}
          return
        }

        // 错误
        if (msg.msgType === MsgType.Error) {
          clearTimeout(timeout)
          finish(new Error(`TTS 错误 code=${msg.errorCode}: ${msg.payload.toString('utf8')}`))
          return
        }

        // SessionFinished / TTSEnded → 合成完成
        if (msg.event === TTSEvent.SessionFinished || msg.event === TTSEvent.TTSEnded ||
            msg.event === TTSEvent.ConnectionFinished) {
          clearTimeout(timeout)
          finish()
        }
      })

      ws.on('error', (err) => {
        clearTimeout(timeout)
        finish(err)
      })

      ws.on('close', () => {
        clearTimeout(timeout)
        finish()
      })

      // 连接打开后发送一次性请求
      ws.once('open', () => {
        const req = {
          req_params: {
            text,
            speaker: this.speaker,
            audio_params: {
              format: this.format,
              sample_rate: this.sampleRate,
              enable_timestamp: false
            }
          }
        }
        ws.send(marshal({
          type: MsgType.FullClientRequest,
          flag: Flag.NoSeq,
          payload: jsonBuf(req)
        }))
      })
    })
  }

  // 单流无连接常驻，close/start 为空实现（保持接口兼容）
  async connect() {}
  async close() {}
}

module.exports = PlanTtsClient
