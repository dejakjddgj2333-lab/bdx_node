/**
 * 火山方舟语音（TTS/ASR）字节帧协议层
 *
 * 移植自官方 protocols.py。TTS 与 ASR 共用同一套 4 字节头二进制帧，
 * 区别仅在 flag：TTS 请求用 WithEvent（带 event + session_id），
 * ASR 请求用 PositiveSeq/NegativeSeq（带 sequence）。
 *
 * 帧格式（发送）：
 *   header(4B) [ + event(4B) + session_id(变长)  当 WithEvent
 *               | + sequence(4B)                  当 PositiveSeq/NegativeSeq ]
 *   + payload_size(4B uint32 BE) + payload(bytes)
 *
 * header:
 *   byte0 = (version=1 << 4) | header_size=1   => 0x11
 *   byte1 = (msg_type << 4) | flags
 *   byte2 = (serialization << 4) | compression
 *   byte3 = reserved 0x00
 */

// ---- 消息类型 ----
const MsgType = {
  FullClientRequest: 0b0001,
  AudioOnlyClient: 0b0010,
  FullServerResponse: 0b1001,
  AudioOnlyServer: 0b1011,
  FrontEndResultServer: 0b1100,
  Error: 0b1111
}

// ---- flag 位 ----
const Flag = {
  NoSeq: 0b0000,
  PositiveSeq: 0b0001,
  LastNoSeq: 0b0010,
  NegativeSeq: 0b0011,
  WithEvent: 0b0100
}

// ---- 序列化 ----
const Serialization = { Raw: 0, JSON: 0b0001 }
// ---- 压缩 ----
const Compression = { None: 0, Gzip: 0b0001 }

// ---- TTS 事件 ----
const TTSEvent = {
  StartConnection: 1,
  FinishConnection: 2,
  ConnectionStarted: 50,
  ConnectionFailed: 51,
  ConnectionFinished: 52,
  StartSession: 100,
  CancelSession: 101,
  FinishSession: 102,
  SessionStarted: 150,
  SessionCanceled: 151,
  SessionFinished: 152,
  SessionFailed: 153,
  UsageResponse: 154,
  TaskRequest: 200,
  TTSSentenceStart: 350,
  TTSSentenceEnd: 351,
  TTSResponse: 352,
  TTSEnded: 359
}

// 不带 session_id 的事件（连接级）
const NO_SESSION_EVENTS = new Set([
  TTSEvent.StartConnection,
  TTSEvent.FinishConnection,
  TTSEvent.ConnectionStarted,
  TTSEvent.ConnectionFailed,
  TTSEvent.ConnectionFinished
])

const zlib = require('zlib')

/**
 * 序列化一条消息为 Buffer
 * @param {object} m { type, flag, event?, sessionId?, sequence?, payload(Buffer), serialization?, compression? }
 */
function marshal(m) {
  const type = m.type
  const flag = m.flag
  const serialization = m.serialization ?? Serialization.JSON
  const compression = m.compression ?? Compression.None
  const payload = m.payload || Buffer.alloc(0)

  const header = Buffer.alloc(4)
  header[0] = 0x11
  header[1] = (type << 4) | flag
  header[2] = (serialization << 4) | compression
  header[3] = 0x00

  const parts = [header]

  if (flag === Flag.WithEvent) {
    const ev = Buffer.alloc(4)
    ev.writeInt32BE(m.event || 0, 0)
    parts.push(ev)
    if (!NO_SESSION_EVENTS.has(m.event || 0)) {
      const sid = Buffer.from(m.sessionId || '', 'utf8')
      const sidSize = Buffer.alloc(4)
      sidSize.writeUInt32BE(sid.length, 0)
      parts.push(sidSize, sid)
    }
  } else if (flag === Flag.PositiveSeq || flag === Flag.NegativeSeq) {
    const seq = Buffer.alloc(4)
    let seqVal = m.sequence || 0
    if (flag === Flag.NegativeSeq) seqVal = -Math.abs(seqVal)
    seq.writeInt32BE(seqVal, 0)
    parts.push(seq)
  }

  const psize = Buffer.alloc(4)
  psize.writeUInt32BE(payload.length, 0)
  parts.push(psize, payload)

  return Buffer.concat(parts)
}

/**
 * 解析上游返回的一帧为对象
 * @param {Buffer|Uint8Array} data
 * @returns {object} { msgType, flags, event, sequence, sessionId, connectId, payload(Buffer), isLast, errorCode }
 */
function parseMessage(data) {
  const buf = Buffer.from(data)
  if (buf.length < 4) throw new Error('帧过短')

  const headerSize = buf[0] & 0x0f // 一般=1
  const msgType = buf[1] >> 4
  const flags = buf[1] & 0x0f
  const serialization = buf[2] >> 4
  const compression = buf[2] & 0x0f

  let offset = headerSize * 4
  let sequence = 0
  let event = 0
  let sessionId = ''
  let connectId = ''
  let errorCode = 0

  // sequence（PositiveSeq/NegativeSeq）—— ASR 响应常见
  if (flags === Flag.PositiveSeq || flags === Flag.NegativeSeq) {
    if (offset + 4 <= buf.length) {
      sequence = buf.readInt32BE(offset)
      offset += 4
    }
  }

  // event + session_id（+ connect_id 仅 FullServerResponse）—— WithEvent
  // 注意：AudioOnlyServer(11) 的音频包只有 event + session_id + payload，
  //       没有 connect_id；FullServerResponse(9) 才有 connect_id。
  if (flags === Flag.WithEvent) {
    if (offset + 4 <= buf.length) {
      event = buf.readInt32BE(offset)
      offset += 4
    }
    // session_id
    if (offset + 4 <= buf.length) {
      const sidSize = buf.readUInt32BE(offset)
      offset += 4
      if (sidSize > 0 && offset + sidSize <= buf.length) {
        sessionId = buf.toString('utf8', offset, offset + sidSize)
        offset += sidSize
      }
    }
    // connect_id —— 仅 FullServerResponse(9) 带
    if (msgType === MsgType.FullServerResponse && offset + 4 <= buf.length) {
      const cidSize = buf.readUInt32BE(offset)
      offset += 4
      if (cidSize > 0 && cidSize < 200 && offset + cidSize <= buf.length) {
        connectId = buf.toString('utf8', offset, offset + cidSize)
        offset += cidSize
      }
    }
  }

  let payload = Buffer.alloc(0)

  if (msgType === MsgType.Error) {
    if (offset + 4 <= buf.length) {
      errorCode = buf.readInt32BE(offset)
      offset += 4
    }
  }

  // payload_size + payload
  if (offset + 4 <= buf.length) {
    const payloadSize = buf.readUInt32BE(offset)
    offset += 4
    if (payloadSize > 0 && offset + payloadSize <= buf.length) {
      payload = buf.slice(offset, offset + payloadSize)
      offset += payloadSize
    }
  } else if (offset < buf.length) {
    // 某些 AudioOnlyServer 可能直接是裸音频（无 size 前缀）兜底
    payload = buf.slice(offset)
  }

  // 解压
  if (compression === Compression.Gzip && payload.length > 0) {
    try {
      payload = zlib.gunzipSync(payload)
    } catch (e) {
      // 解压失败保留原样
    }
  }

  return {
    msgType,
    flags,
    event,
    sequence,
    sessionId,
    connectId,
    payload,
    isLast: (flags & 0b10) !== 0, // LastNoSeq 或 NegativeSeq
    errorCode,
    serialization
  }
}

/** 工具：JSON Buffer */
function jsonBuf(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8')
}

module.exports = {
  MsgType,
  Flag,
  Serialization,
  Compression,
  TTSEvent,
  NO_SESSION_EVENTS,
  marshal,
  parseMessage,
  jsonBuf
}
