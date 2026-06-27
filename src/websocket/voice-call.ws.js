const WebSocket = require('ws')
const url = require('url')
const logger = require('../utils/logger')
const config = require('../config')

/**
 * 语音通话 WebSocket —— 转发到 Python 语音微服务
 *
 * 阶段三：Node 只做鉴权 + 透传，语音编排（全双工 / 分段）由 Python 微服务负责。
 * 按 env VOICE_SERVICE_URL 切换微服务（v1 分段 / v2 全双工），对外协议一致。
 *
 * 对 App 协议不变：
 *   上行 { type:'audio', audio:base64 }  / { type:'stop' }
 *   下行 { type:'state'/'tts.audio'/'error' }
 *
 * 认证仍由 Node 做（JWT token 校验），转发时把 voice/prompt 透传给微服务。
 */
class VoiceCallWebSocket {
  constructor(wss) {
    this.wss = wss
    this.setup()
  }

  setup() {
    this.wss.on('connection', (clientWs, req) => this.handleConnection(clientWs, req))
  }

  async handleConnection(clientWs, req) {
    const query = url.parse(req.url, true).query
    const token = query.token

    // 1. Node 鉴权（JWT）
    if (!token) {
      clientWs.close(4001, '缺少token')
      return
    }
    let userId
    try {
      const jwt = require('jsonwebtoken')
      const decoded = jwt.verify(token, config.jwt.secret)
      userId = decoded.userId || decoded.id
      logger.info(`[VoiceCall] 用户连接: ${userId}`)
    } catch (err) {
      clientWs.close(4002, 'token无效')
      return
    }

    // 2. 连接 Python 语音微服务
    const serviceUrl = process.env.VOICE_SERVICE_URL || 'ws://localhost:3003/ws/voice-call'
    // 透传 voice / prompt 给微服务
    const targetUrl = `${serviceUrl}?voice=${encodeURIComponent(query.voice || '')}&prompt=${encodeURIComponent(query.prompt || '')}`

    let upstreamWs
    try {
      upstreamWs = new WebSocket(targetUrl)
    } catch (e) {
      logger.error('[VoiceCall] 连接语音微服务失败:', e.message)
      clientWs.close(4003, '语音服务不可用')
      return
    }

    let upstreamReady = false
    const messageQueue = []

    // 3. 等微服务就绪
    await new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('语音微服务连接超时')), 15000)
      upstreamWs.once('open', () => {
        clearTimeout(to)
        upstreamReady = true
        logger.info(`[VoiceCall] 已连接语音微服务: ${userId}`)
        resolve()
      })
      upstreamWs.once('error', (err) => {
        clearTimeout(to)
        logger.error('[VoiceCall] 语音微服务错误:', err.message)
        reject(err)
      })
    }).catch((err) => {
      this.safeSend(clientWs, JSON.stringify({ type: 'error', message: '语音服务不可用: ' + err.message }))
      try { clientWs.close(4003, '语音服务不可用') } catch (e) {}
    })

    if (!upstreamReady || upstreamWs.readyState !== WebSocket.OPEN) {
      try { upstreamWs.close() } catch (e) {}
      return
    }

    // 4. App -> 微服务
    let upCount = 0
    clientWs.on('message', (data, isBinary) => {
      upCount++
      if (upCount <= 3) {
        const preview = Buffer.isBuffer(data) ? data.toString('utf8').slice(0, 80) : String(data).slice(0, 80)
        logger.info(`[VoiceCall] App消息#${upCount} binary=${isBinary} upstream=${upstreamWs.readyState}: ${preview}`)
      }
      if (upstreamWs.readyState !== WebSocket.OPEN) {
        if (upCount <= 3) logger.warn(`[VoiceCall] 微服务未就绪，丢弃#${upCount}`)
        return
      }
      try {
        upstreamWs.send(data, { binary: isBinary })
      } catch (e) {
        logger.error('[VoiceCall] 转发到微服务失败:', e.message)
      }
    })

    // 5. 微服务 -> App
    let downCount = 0
    upstreamWs.on('message', (data) => {
      if (clientWs.readyState !== WebSocket.OPEN) return
      try {
        clientWs.send(data)
        downCount++
        if (downCount <= 5) logger.info(`[VoiceCall] 微服务->App #${downCount}: ${data.toString().slice(0, 80)}`)
      } catch (e) {
        logger.error('[VoiceCall] 转发到App失败:', e.message)
      }
    })

    // 6. 断连处理
    const cleanup = () => {
      if (upstreamWs.readyState === WebSocket.OPEN || upstreamWs.readyState === WebSocket.CONNECTING) {
        try { upstreamWs.close() } catch (e) {}
      }
    }
    clientWs.on('close', () => {
      logger.info(`[VoiceCall] 客户端断开: ${userId}`)
      cleanup()
    })
    clientWs.on('error', (err) => logger.error(`[VoiceCall] 客户端错误: ${userId}`, err.message))

    upstreamWs.on('close', () => {
      logger.info(`[VoiceCall] 微服务断开: ${userId}`)
      if (clientWs.readyState === WebSocket.OPEN) {
        this.safeSend(clientWs, JSON.stringify({ type: 'error', message: '语音服务已断开' }))
        try { clientWs.close(4004, '语音服务断开') } catch (e) {}
      }
    })
    upstreamWs.on('error', (err) => logger.error('[VoiceCall] 微服务错误:', err.message))
  }

  safeSend(clientWs, data) {
    if (clientWs.readyState === WebSocket.OPEN) {
      try { clientWs.send(data) } catch (e) {}
    }
  }
}

module.exports = VoiceCallWebSocket
