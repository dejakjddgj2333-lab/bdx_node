const {
  AccessToken,
  RoomServiceClient,
  WebhookReceiver
} = require('livekit-server-sdk')
const config = require('../../config')
const logger = require('../../utils/logger')

const { url, apiKey, apiSecret, tokenTtl } = config.livekit

function ensureConfigured() {
  if (!url || !apiKey || !apiSecret) {
    throw new Error('LiveKit 未配置，请在 .env 中设置 LIVEKIT_URL/LIVEKIT_API_KEY/LIVEKIT_API_SECRET')
  }
}

let roomServiceClient = null
function getRoomService() {
  ensureConfigured()
  if (!roomServiceClient) {
    // RoomServiceClient 需要 http(s) 地址；把 ws(s) 协议换成 http(s)
    const httpUrl = url.replace(/^ws/, 'http')
    roomServiceClient = new RoomServiceClient(httpUrl, apiKey, apiSecret)
  }
  return roomServiceClient
}

/**
 * 签发参会者 AccessToken
 * @param {object} opts
 * @param {string} opts.roomName 房间名
 * @param {string} opts.identity 参会者唯一标识（用用户ID，杜绝冒名）
 * @param {string} [opts.name] 显示名
 * @param {boolean} [opts.canPublish] 是否可发布音视频
 * @param {object} [opts.metadata] 附加元数据
 * @returns {Promise<string>} JWT token
 */
async function createToken({ roomName, identity, name, canPublish = true, metadata }) {
  ensureConfigured()
  const at = new AccessToken(apiKey, apiSecret, {
    identity: String(identity),
    name: name || String(identity),
    ttl: tokenTtl,
    metadata: metadata ? JSON.stringify(metadata) : undefined
  })
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish,
    canSubscribe: true,
    canPublishData: true
  })
  // 新版 SDK 的 toJwt() 返回 Promise
  return await at.toJwt()
}

/**
 * 主动创建房间（可选，用于预设元数据/超时）。
 * 入会其实不需要先建房，LiveKit 会在首个参会者加入时自动建房。
 */
async function createRoom(roomName, opts = {}) {
  const svc = getRoomService()
  return svc.createRoom({
    name: roomName,
    emptyTimeout: opts.emptyTimeout ?? 300, // 空房间 5 分钟后自动销毁
    maxParticipants: opts.maxParticipants ?? 0,
    metadata: opts.metadata ? JSON.stringify(opts.metadata) : undefined
  })
}

/** 结束/删除房间，强制所有人离开 */
async function deleteRoom(roomName) {
  const svc = getRoomService()
  return svc.deleteRoom(roomName)
}

/** 列出房间内参会者 */
async function listParticipants(roomName) {
  const svc = getRoomService()
  return svc.listParticipants(roomName)
}

/** 踢出指定参会者 */
async function removeParticipant(roomName, identity) {
  const svc = getRoomService()
  return svc.removeParticipant(roomName, String(identity))
}

/**
 * 更新参会者发布权限（主持人授予/收回说话、视频、屏幕共享）。
 * permission 为原子更新——必须把期望的全部权限一次性写齐。
 * canPublish 为 true 且 canPublishSources 留空时，允许发布所有来源
 * （麦克风/摄像头/屏幕共享）；为 false 时禁止任何发布，LiveKit 会自动
 * 取消该参会者已发布的轨道，并向其推送权限变更事件。
 * @param {string} roomName
 * @param {string|number} identity
 * @param {boolean} canPublish
 */
async function updateParticipant(roomName, identity, canPublish) {
  const svc = getRoomService()
  return svc.updateParticipant(roomName, String(identity), {
    permission: {
      canSubscribe: true,
      canPublish: Boolean(canPublish),
      canPublishData: true
    }
  })
}

let webhookReceiver = null
function getWebhookReceiver() {
  ensureConfigured()
  if (!webhookReceiver) {
    webhookReceiver = new WebhookReceiver(apiKey, apiSecret)
  }
  return webhookReceiver
}

/**
 * 校验并解析 LiveKit webhook 事件
 * @param {string} body 原始请求体（必须是字符串，不能是已解析对象）
 * @param {string} authHeader Authorization 头
 */
async function receiveWebhook(body, authHeader) {
  const receiver = getWebhookReceiver()
  return receiver.receive(body, authHeader)
}

function isConfigured() {
  return Boolean(url && apiKey && apiSecret)
}

module.exports = {
  createToken,
  createRoom,
  deleteRoom,
  listParticipants,
  removeParticipant,
  updateParticipant,
  receiveWebhook,
  isConfigured,
  livekitUrl: url
}
