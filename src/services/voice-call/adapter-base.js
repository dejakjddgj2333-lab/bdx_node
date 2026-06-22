const { resamplePcm16Mono } = require('./resampler')

/**
 * 语音通话上游厂商适配器基类
 *
 * 前端统一使用 OpenAI Realtime 事件格式；子类负责：
 * 1. 建立上游 WebSocket 连接（认证、URL、model 参数）
 * 2. translateClientEvent(event): 把前端事件翻译为上游消息列表
 * 3. translateUpstreamMessage(data): 把上游返回翻译为前端消息列表
 */
class VoiceCallAdapter {
  /**
   * @param {Object} config 当前 voice_providers 表中的一行配置
   * @param {Object} preset 厂商预设（来自 presets.js）
   */
  constructor(config, preset) {
    this.config = config
    this.preset = preset
  }

  get provider() {
    return this.config.provider
  }

  get name() {
    return this.config.name || this.preset.name
  }

  get apiKey() {
    return this.config.api_key || ''
  }

  get baseUrl() {
    return this.config.base_url || this.preset.base_url
  }

  get realtimeModel() {
    return this.config.realtime_model || this.preset.realtime_model
  }

  get inputSampleRate() {
    return this.preset.input_sample_rate || 24000
  }

  get outputSampleRate() {
    return this.preset.output_sample_rate || 24000
  }

  /**
   * 建立上游 WebSocket 连接
   * 子类必须实现并返回 WebSocket 实例
   */
  async connect() {
    throw new Error('子类必须实现 connect()')
  }

  /**
   * 转换前端事件为上游消息
   * @param {Object} event 已解析的 JSON 事件对象
   * @returns {Array<{payload: string|Buffer, isBinary: boolean}>}
   */
  translateClientEvent(event) {
    // 默认透传（适用于 OpenAI 兼容协议）
    return [{ payload: JSON.stringify(event), isBinary: false }]
  }

  /**
   * 转换上游返回为前端消息
   * @param {Buffer|string} data 上游原始消息
   * @returns {Array<{payload: string|Buffer, isBinary: boolean}>}
   */
  translateUpstreamMessage(data) {
    // 默认透传
    return [{ payload: data, isBinary: Buffer.isBuffer(data) }]
  }

  /**
   * 连接建立后应立即发给客户端的事件列表（用于协议不主动推送 session.created 的厂商）
   * @returns {Array<{payload: string|Buffer, isBinary: boolean}>}
   */
  getConnectionEstablishedEvents() {
    return []
  }

  /**
   * 辅助：把前端 16kHz 音频重采样到上游所需采样率
   * @param {string} base64Audio base64 PCM16 16kHz mono
   * @returns {string} base64 PCM16 目标采样率 mono
   */
  resampleInputAudio(base64Audio) {
    const inputBuffer = Buffer.from(base64Audio, 'base64')
    const outputBuffer = resamplePcm16Mono(inputBuffer, 16000, this.inputSampleRate)
    return outputBuffer.toString('base64')
  }

  /**
   * 辅助：把上游输出音频重采样为前端 24kHz
   * @param {Buffer} pcmBuffer 上游 PCM16 mono
   * @returns {Buffer}
   */
  resampleOutputAudio(pcmBuffer) {
    return resamplePcm16Mono(pcmBuffer, this.outputSampleRate, 24000)
  }
}

module.exports = VoiceCallAdapter
