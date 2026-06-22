const WebSocket = require('ws')
const url = require('url')
const logger = require('../utils/logger')
const { loadCurrentVoiceProvider, createVoiceAdapter } = require('../services/voice-call/adapter-factory')

/**
 * 语音通话 WebSocket 处理
 * 前端 <-> 后端 <-> 上游实时语音厂商
 *
 * 前端统一使用 OpenAI Realtime 事件格式；后端通过 Adapter 把事件翻译为各厂商协议。
 */
class VoiceCallWebSocket {
  constructor(wss) {
    this.wss = wss
    this.setup()
  }

  setup() {
    this.wss.on('connection', (clientWs, req) => {
      this.handleConnection(clientWs, req)
    })
  }

  async handleConnection(clientWs, req) {
    // 1. 从 query 参数获取 token 并验证
    const query = url.parse(req.url, true).query
    const token = query.token

    if (!token) {
      logger.warn('[VoiceCall] 连接失败: 缺少token')
      clientWs.close(4001, '缺少token')
      return
    }

    let userId
    try {
      const jwt = require('jsonwebtoken')
      const config = require('../config')
      const decoded = jwt.verify(token, config.jwt.secret)
      userId = decoded.userId || decoded.id
      logger.info(`[VoiceCall] 用户连接: ${userId}`)
    } catch (err) {
      logger.warn('[VoiceCall] 连接失败: token无效')
      clientWs.close(4002, 'token无效')
      return
    }

    // 2. 加载当前语音厂商配置
    let providerConfig
    try {
      providerConfig = await loadCurrentVoiceProvider()
      logger.info(`[VoiceCall] 当前厂商: ${providerConfig.provider}, 模型: ${providerConfig.realtime_model}`)
    } catch (err) {
      logger.error('[VoiceCall] 加载语音厂商配置失败:', err.message)
      clientWs.close(4003, '语音服务配置错误')
      return
    }

    // App 端可通过 URL 参数传入选中的音色，优先使用 App 端选择
    // 若传入音色不在当前厂商预设列表中，则回退到当前厂商默认音色
    if (query.voice) {
      const validVoices = providerConfig.preset?.voices || []
      if (validVoices.includes(query.voice)) {
        providerConfig.default_voice = query.voice
        logger.info(`[VoiceCall] App 传入音色: ${query.voice}`)
      } else {
        const fallbackVoice = providerConfig.default_voice || validVoices[0] || ''
        providerConfig.default_voice = fallbackVoice
        logger.warn(`[VoiceCall] App 传入音色 ${query.voice} 不属于 ${providerConfig.provider}，已回退到 ${fallbackVoice}`)
      }
    }

    if (!providerConfig.api_key) {
      logger.error(`[VoiceCall] 未配置 ${providerConfig.provider} API Key`)
      clientWs.close(4003, '语音服务未配置')
      return
    }

    // 3. 创建 Adapter 并连接上游
    let adapter
    let upstreamWs
    try {
      adapter = createVoiceAdapter(providerConfig)
      logger.info(`[VoiceCall] Adapter 创建成功: ${providerConfig.provider}`)

      // 某些厂商（如 Gemini）不会主动发 session.created，需要后端先伪造一个，
      // 让前端按 OpenAI 流程发送 session.update。这些消息会被缓冲到上游就绪后发送。
      const initialEvents = adapter.getConnectionEstablishedEvents()
      if (initialEvents.length > 0) {
        logger.info(`[VoiceCall] 发送初始事件给客户端: ${userId}, count=${initialEvents.length}`)
        for (const msg of initialEvents) {
          this.safeSendClient(clientWs, msg.payload)
        }
      }

      upstreamWs = await adapter.connect()
      logger.info(`[VoiceCall] 正在连接 ${providerConfig.provider}: ${providerConfig.realtime_model}`)
    } catch (err) {
      const errInfo = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack}` : String(err)
      logger.error(`[VoiceCall] 创建 ${providerConfig.provider} 连接失败: ${errInfo}`)
      clientWs.close(4003, '无法连接语音服务')
      return
    }

    // 4. 在上游就绪前先缓冲客户端消息，避免 session.update / 首帧音频被丢弃
    const messageQueue = []
    let upstreamReady = false

    clientWs.on('message', (data) => {
      if (!upstreamReady) {
        messageQueue.push(data)
        return
      }
      this.forwardClientMessage(clientWs, upstreamWs, adapter, userId, data)
    })

    clientWs.on('close', (code, reason) => {
      logger.info(`[VoiceCall] 客户端断开: ${userId}, code=${code}`)
      if (upstreamWs.readyState === WebSocket.OPEN || upstreamWs.readyState === WebSocket.CONNECTING) {
        upstreamWs.close()
      }
    })

    clientWs.on('error', (err) => {
      logger.error(`[VoiceCall] 客户端错误: ${userId}`, err.message)
    })

    // 5. 等待上游连接成功
    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('上游语音服务连接超时'))
        }, 10000)

        upstreamWs.once('open', () => {
          clearTimeout(timeout)
          logger.info(`[VoiceCall] ${providerConfig.provider} 连接成功`)

          // 某些厂商（如 Gemini）要求连接成功后立即发送初始 setup 消息
          if (typeof adapter.sendSetup === 'function') {
            try {
              adapter.sendSetup(upstreamWs)
              logger.info(`[VoiceCall] ${providerConfig.provider} setup 消息已发送`)
            } catch (setupErr) {
              logger.error(`[VoiceCall] ${providerConfig.provider} setup 消息发送失败:`, setupErr.message)
            }
          }

          resolve()
        })

        upstreamWs.once('error', (err) => {
          clearTimeout(timeout)
          logger.error(`[VoiceCall] ${providerConfig.provider} 连接错误:`, err.message)
          reject(err)
        })
      })
    } catch (err) {
      logger.error(`[VoiceCall] 连接 ${providerConfig.provider} 失败:`, err.message)
      clientWs.close(4003, '语音服务连接失败')
      return
    }

    if (clientWs.readyState !== WebSocket.OPEN) {
      upstreamWs.terminate()
      return
    }

    // 6. 设置上游 -> 客户端转发及断连处理
    upstreamReady = true
    this.setupForwarding(clientWs, upstreamWs, adapter, userId, providerConfig.provider)

    // 7. 刷新缓冲的客户端消息
    if (messageQueue.length > 0) {
      logger.info(`[VoiceCall] 刷新客户端缓冲消息: ${userId}, count=${messageQueue.length}`)
      for (const data of messageQueue) {
        this.forwardClientMessage(clientWs, upstreamWs, adapter, userId, data)
      }
    }
  }

  /**
   * 转发客户端消息到上游
   */
  forwardClientMessage(clientWs, upstreamWs, adapter, userId, data) {
    let eventType = 'binary'
    let eventObj = null

    if (data instanceof Buffer) {
      const text = data.toString('utf8')
      if (text.startsWith('{')) {
        try {
          eventObj = JSON.parse(text)
          eventType = eventObj.type || 'unknown-json'
        } catch (e) {
          // 非 JSON 消息不记录
        }
      }
    } else if (typeof data === 'string' && data.startsWith('{')) {
      try {
        eventObj = JSON.parse(data)
        eventType = eventObj.type || 'unknown-json'
      } catch (e) {}
    }

    if (eventType === 'session.update') {
      logger.info(`[VoiceCall] 客户端配置: ${userId} provider=${adapter.provider} model=${eventObj.session?.model || '-'} voice=${eventObj.session?.voice || '-'} vad=${eventObj.session?.turn_detection?.type || '-'}`)
    }

    logger.info(`[VoiceCall] 客户端 -> ${adapter.provider} [${userId}] type=${eventType}`)

    if (upstreamWs.readyState !== WebSocket.OPEN) {
      logger.warn(`[VoiceCall] 上游连接未就绪，丢弃客户端消息: ${userId}, readyState=${upstreamWs.readyState}`)
      return
    }

    try {
      const messages = eventObj ? adapter.translateClientEvent(eventObj) : [{ payload: data, isBinary: Buffer.isBuffer(data) }]
      for (const msg of messages) {
        upstreamWs.send(msg.payload)
      }
    } catch (e) {
      logger.error(`[VoiceCall] 转发客户端消息失败: ${userId}`, e.message)
      this.safeSendClient(clientWs, JSON.stringify({ type: 'server.error', error: `转发失败: ${e.message}` }))
    }
  }

  setupForwarding(clientWs, upstreamWs, adapter, userId, providerName) {
    // 上游 -> 客户端
    upstreamWs.on('message', (data) => {
      try {
        const messages = adapter.translateUpstreamMessage(data)
        for (const msg of messages) {
          this.safeSendClient(clientWs, msg.payload)
        }

        // 记录上游返回的 JSON 事件
        let text = ''
        if (data instanceof Buffer) {
          text = data.toString('utf8')
        } else if (typeof data === 'string') {
          text = data
        }
        if (text.startsWith('{')) {
          try {
            const event = JSON.parse(text)
            const eventType = event.type || 'unknown-json'
            if (eventType === 'error') {
              logger.error(`[VoiceCall] ${providerName} 错误事件 [${userId}]:`, JSON.stringify(event))
            } else {
              logger.info(`[VoiceCall] ${providerName} -> 客户端 [${userId}] type=${eventType}`)
            }
          } catch (e) {}
        }
      } catch (e) {
        logger.error(`[VoiceCall] 转发出上游消息失败: ${userId}`, e.message)
      }
    })

    // 上游断开
    upstreamWs.on('close', (code, reason) => {
      const reasonText = reason ? reason.toString('utf8') : ''
      logger.info(`[VoiceCall] ${providerName} 断开: ${userId}, code=${code}, reason=${reasonText || '无'}`)
      const closeMsg = JSON.stringify({ type: 'server.error', error: '语音服务连接断开', code, reason: reasonText })
      this.safeSendClient(clientWs, closeMsg)
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(4004, '语音服务连接断开')
      }
    })

    upstreamWs.on('error', (err) => {
      logger.error(`[VoiceCall] ${providerName} 错误: ${userId}`, err.message)
      const errorMsg = JSON.stringify({ type: 'server.error', error: '语音服务错误: ' + err.message })
      this.safeSendClient(clientWs, errorMsg)
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(4005, '语音服务错误')
      }
    })
  }

  safeSendClient(clientWs, data) {
    if (clientWs.readyState === WebSocket.OPEN) {
      try {
        clientWs.send(data)
      } catch (e) {
        logger.error('[VoiceCall] 向客户端发送消息失败:', e.message)
      }
    }
  }
}

module.exports = VoiceCallWebSocket
