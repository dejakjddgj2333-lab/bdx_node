/**
 * 火山方舟 Plan ASR 客户端（双流 bigmodel_async，增量转写）
 *
 * 接口：wss://openspeech.bytedance.com/api/v3/plan/sauc/bigmodel_async
 * 认证：X-Api-Key + X-Api-Resource-Id: volc.seedasr.sauc.duration
 *
 * 协议（与 TTS 同一套字节帧，但请求用 sequence 而非 event）：
 *   1. full_client_request（PositiveSeq，seq=1）：JSON 配置（audio 格式/采样率/模型参数），gzip 压缩
 *   2. 多个 audio_only_request（PositiveSeq，递增 seq）：gzip 压缩的音频分片
 *   3. 最后一个 audio_only_request（NegativeSeq，seq=-N）：标记结束
 *
 * 响应：
 *   SERVER_FULL_RESPONSE(0b1001)：含转写结果 payload_msg（含 result/text/utterances）
 *   最后包 is_last_package=True（flags & 0b10）
 *   SERVER_ERROR_RESPONSE(0b1111)：错误
 */
const WebSocket = require('ws')
const zlib = require('zlib')
const { v4: uuidv4 } = require('uuid')
const logger = require('../../utils/logger')
const { MsgType, Flag, Serialization, Compression, marshal, parseMessage, jsonBuf } = require('./plan-protocol')

const ASR_URL = 'wss://openspeech.bytedance.com/api/v3/plan/sauc/bigmodel_async'
const RESOURCE_ID = 'volc.seedasr.sauc.duration'

class PlanAsrClient {
  /**
   * @param {object} opts { apiKey, sampleRate=16000, onText(增量文本回调), onDone(最终文本) }
   */
  constructor(opts) {
    this.apiKey = opts.apiKey
    this.sampleRate = opts.sampleRate || 16000
    this.onText = opts.onText || (() => {})
    this.onDone = opts.onDone || (() => {})
    this.ws = null
    this.seq = 1
    this.requestId = uuidv4()
    this.connectId = this.requestId
    this._closed = false
    this._fullText = ''
  }

  async connect() {
    const headers = {
      'X-Api-Key': this.apiKey,
      'X-Api-Resource-Id': RESOURCE_ID,
      'X-Api-Request-Id': this.requestId,
      'X-Api-Connect-Id': this.connectId,
      'X-Api-Sequence': '-1'
    }
    this.ws = new WebSocket(ASR_URL, { headers, maxPayload: 16 * 1024 * 1024 })

    await new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('ASR 连接超时')), 15000)
      this.ws.once('open', () => { clearTimeout(to); resolve() })
      this.ws.once('error', (e) => { clearTimeout(to); reject(e) })
    })

    this.ws.on('message', (data) => this._onMessage(data))
    this.ws.on('close', (code) => {
      this._closed = true
      logger.info(`[ASR] 连接关闭 code=${code}`)
    })
    this.ws.on('error', (err) => logger.error('[ASR] 连接错误:', err.message))

    // 发送 full_client_request（初始配置）
    // format='pcm'：前端发裸 PCM16（无 WAV 头），用 pcm 格式直传
    const payload = {
      user: { uid: 'bdx' },
      audio: {
        format: 'pcm',
        codec: 'raw',
        rate: this.sampleRate,
        bits: 16,
        channel: 1
      },
      request: {
        model_name: 'bigmodel',
        enable_itn: true,
        enable_punc: true,
        enable_ddc: true,
        show_utterances: true,
        enable_nonstream: false
      }
    }
    const compressed = zlib.gzipSync(jsonBuf(payload))
    this.ws.send(marshal({
      type: MsgType.FullClientRequest,
      flag: Flag.PositiveSeq,
      sequence: this.seq,
      serialization: Serialization.JSON,
      compression: Compression.Gzip,
      payload: compressed
    }))
    this.seq++
    logger.info('[ASR] 连接已建立，已发送初始配置')
  }

  /**
   * 发送一块 PCM16 音频分片（base64 或 Buffer）
   * @param {Buffer} pcmChunk PCM16 mono 16kHz 片段
   * @param {boolean} isLast 是否最后一片
   */
  sendAudio(pcmChunk, isLast = false) {
    if (this._closed || !this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this._lastChunk = pcmChunk
    const compressed = zlib.gzipSync(pcmChunk)
    const flag = isLast ? Flag.NegativeSeq : Flag.PositiveSeq
    this.ws.send(marshal({
      type: MsgType.AudioOnlyClient,
      flag,
      sequence: this.seq,
      payload: compressed
    }))
    if (!isLast) this.seq++
  }

  /** 标记音频结束：发最后一个包，NegativeSeq（seq 取负） */
  finish() {
    if (this._closed || !this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const lastChunk = this._lastChunk || Buffer.alloc(0)
    const flag = Flag.NegativeSeq
    const compressed = zlib.gzipSync(lastChunk)
    logger.info(`[ASR] finish: seq=${this.seq} chunkLen=${lastChunk.length}`)
    this.ws.send(marshal({
      type: MsgType.AudioOnlyClient,
      flag,
      sequence: this.seq,
      payload: compressed
    }))
    // isLast 不自增 seq
  }

  _onMessage(data) {
    let msg
    try {
      msg = parseMessage(data)
    } catch (e) {
      logger.error('[ASR] 解析帧失败:', e.message)
      return
    }

    // 全量诊断：每条上游消息的类型/seq/payload
    const payloadStr = msg.payload ? msg.payload.toString('utf8').slice(0, 300) : ''
    logger.info(`[ASR] recv msgType=${msg.msgType} flags=${msg.flags} seq=${msg.sequence} isLast=${msg.isLast} errCode=${msg.errorCode} payload=${payloadStr}`)

    if (msg.msgType === MsgType.Error) {
      logger.error(`[ASR] 错误 code=${msg.errorCode} payload=${msg.payload.toString('utf8')}`)
      return
    }

    if (msg.msgType === MsgType.FullServerResponse) {
      // 解析转写结果
      let result = null
      try {
        result = JSON.parse(msg.payload.toString('utf8'))
      } catch (e) {
        return
      }
      // 提取文本：兼容多种返回结构
      let text = ''
      const r = result.result
      if (typeof r === 'string') {
        text = r
      } else if (r && typeof r === 'object') {
        text = r.text || r.result || (Array.isArray(r.utterances) ? r.utterances.map(u => u.text || u.definite || '').join('') : '') || ''
      }
      if (!text && result.text) text = result.text
      if (!text && Array.isArray(result.utterances)) {
        text = result.utterances.map(u => u.text || u.definite || '').join('')
      }

      if (text) {
        this._fullText = text
        this.onText(text, msg.isLast)
      }

      if (msg.isLast) {
        this.onDone(this._fullText)
      }
    }
  }

  async close() {
    this._closed = true
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close()
    }
  }
}

module.exports = PlanAsrClient
