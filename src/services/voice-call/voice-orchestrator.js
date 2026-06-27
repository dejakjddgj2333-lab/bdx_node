/**
 * 语音编排器（ASR→LLM→TTS，App 只播语音不显文字）
 *
 * 流程：
 *   收 App PCM16 16k → 能量VAD判停 → 整段送 ASR(demo) → LLM → TTS单流 → 回App音频
 *
 * 下行事件（发给前端）：
 *   { type:'state', state }   listening/thinking/speaking
 *   { type:'tts.audio', audio:base64 }  PCM16 24kHz
 *   { type:'error', message }
 *   注意：不发 asr.text/llm.text（App 不显文字）
 *
 * 上行（前端）：
 *   { type:'audio', audio:base64 }  PCM16 16kHz
 *   { type:'stop' }
 */
const PlanTtsClient = require('./plan-tts-client')
const { recognize } = require('./asr-service')
const aiService = require('../ai.service')
const logger = require('../../utils/logger')

const SILENCE_THRESHOLD = 150       // 峰值阈值，说话峰值 200+
const SILENCE_DURATION_MS = 800     // 静音持续判定说完
const MIN_SPEECH_MS = 300           // 最短说话时长
const MAX_SPEECH_MS = 8000          // 单轮最长（防过长）
const SAMPLE_RATE = 16000

class VoiceOrchestrator {
  constructor(opts) {
    this.apiKey = opts.apiKey
    this.speaker = opts.speaker
    this.systemPrompt = opts.systemPrompt || '你是北斗星AI语音助手，回答简洁自然，适合口语，控制在两三句内。'
    this.aiModel = opts.aiModel || 'doubao-seed-2.0-pro'
    this.onSend = opts.onSend || (() => {})

    this.tts = new PlanTtsClient({
      apiKey: this.apiKey,
      speaker: this.speaker,
      sampleRate: 24000,
      format: 'pcm'
    })

    this.state = 'idle'
    this.pcmBuffer = []        // 当前轮音频块
    this.speechStart = 0
    this.lastVoiceTime = 0
    this.silenceTimer = null
    this.hasSpeech = false
    this._stopped = false
  }

  async start() {
    this._stopped = false
    this._setState('listening')
    logger.info('[Orchestrator] 启动，进入聆听')
  }

  async handleAudio(base64Audio) {
    if (this._stopped) return
    if (this.state !== 'listening') {
      // thinking/speaking 期间忽略音频（不做打断检测，简化）
      return
    }

    const pcm = Buffer.from(base64Audio, 'base64')
    const energy = this._pcmEnergy(pcm)
    const now = Date.now()
    const isVoice = energy > SILENCE_THRESHOLD

    if (isVoice) {
      if (!this.hasSpeech) {
        this.hasSpeech = true
        this.speechStart = now
      }
      this.lastVoiceTime = now
      this.pcmBuffer.push(pcm)
      this._resetSilenceTimer()
      // 超长强制结束
      if (now - this.speechStart > MAX_SPEECH_MS) {
        this._onSpeechEnd()
      }
    } else if (this.hasSpeech) {
      this.pcmBuffer.push(pcm)
      if (now - this.lastVoiceTime > SILENCE_DURATION_MS) {
        this._onSpeechEnd()
      } else {
        this._resetSilenceTimer()
      }
    }
  }

  _resetSilenceTimer() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer)
    this.silenceTimer = setTimeout(() => {
      if (this.hasSpeech && Date.now() - this.lastVoiceTime > SILENCE_DURATION_MS) {
        this._onSpeechEnd()
      }
    }, SILENCE_DURATION_MS + 200)
  }

  async _onSpeechEnd() {
    if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null }
    if (!this.hasSpeech) return
    this.hasSpeech = false

    const duration = Date.now() - this.speechStart
    if (duration < MIN_SPEECH_MS) {
      this.pcmBuffer = []
      return
    }

    const pcm = Buffer.concat(this.pcmBuffer)
    this.pcmBuffer = []
    logger.info(`[Orchestrator] 说话结束，${duration}ms，${pcm.length}字节，送 ASR`)

    this._setState('thinking')

    try {
      const text = await recognize(pcm)
      logger.info(`[Orchestrator] ASR: "${text}"`)
      if (!text || !text.trim()) {
        this._setState('listening')
        return
      }

      this._setState('speaking')
      await this._runLLMAndTTS(text)
      this._setState('listening')
    } catch (e) {
      logger.error('[Orchestrator] 处理失败:', e.message)
      this.onSend({ type: 'error', message: e.message })
      this._setState('listening')
    }
  }

  async _runLLMAndTTS(text) {
    const messages = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: text }
    ]
    let sentenceBuf = ''
    const stream = aiService.streamChatCompletion(this.aiModel, messages)
    for await (const chunk of stream) {
      if (this._stopped) break
      sentenceBuf += chunk
      const m = sentenceBuf.match(/^(.*?[。！？!?\n])(.*)/s)
      if (m) {
        const sentence = m[1]
        sentenceBuf = m[2]
        await this._speak(sentence)
      }
    }
    if (sentenceBuf.trim() && !this._stopped) {
      await this._speak(sentenceBuf)
    }
    this.onSend({ type: 'turn.end' })
  }

  async _speak(sentence) {
    if (!sentence.trim()) return
    try {
      await this.tts.synthesize(sentence, (pcm) => {
        if (this._stopped) return
        this.onSend({ type: 'tts.audio', audio: pcm.toString('base64') })
      })
    } catch (e) {
      logger.error('[Orchestrator] TTS 失败:', e.message)
    }
  }

  _setState(state) {
    this.state = state
    this.onSend({ type: 'state', state })
  }

  _pcmEnergy(pcm) {
    if (pcm.length < 2) return 0
    let max = 0
    const step = Math.max(2, Math.floor(pcm.length / 256 / 2) * 2)
    for (let i = 0; i + 1 < pcm.length; i += step) {
      const s = Math.abs(pcm.readInt16LE(i))
      if (s > max) max = s
    }
    return max
  }

  async stop() {
    this._stopped = true
    if (this.silenceTimer) clearTimeout(this.silenceTimer)
    try { await this.tts.close() } catch (e) {}
    this._setState('idle')
    logger.info('[Orchestrator] 已停止')
  }
}

module.exports = VoiceOrchestrator
