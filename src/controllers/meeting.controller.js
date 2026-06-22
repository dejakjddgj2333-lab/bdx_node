const { v4: uuidv4 } = require('uuid')
const db = require('../utils/db')
const { success, error } = require('../utils/response')
const livekit = require('../services/meeting/livekit.service')

/**
 * 创建会议
 * body: { title? }
 */
async function createMeeting(ctx) {
  if (!livekit.isConfigured()) {
    return error(ctx, '会议服务未配置，请联系管理员', 503, 200)
  }

  const userId = ctx.state.user.userId
  const { title } = ctx.request.body || {}

  // 房间名用短 uuid，避免暴露自增 id，且全局唯一
  const roomName = 'mt_' + uuidv4().replace(/-/g, '').slice(0, 16)
  const meetingTitle = (title && String(title).trim()) || '快速会议'

  const meetingId = await db.insert(
    'INSERT INTO meetings (room_name, title, host_user_id, status) VALUES (?, ?, ?, ?)',
    [roomName, meetingTitle, userId, 'active']
  )

  success(ctx, {
    id: meetingId,
    room_name: roomName,
    title: meetingTitle,
    host_user_id: userId,
    status: 'active'
  })
}

/**
 * 入会：校验后签发 LiveKit token
 * params: roomName
 */
async function joinMeeting(ctx) {
  if (!livekit.isConfigured()) {
    return error(ctx, '会议服务未配置，请联系管理员', 503, 200)
  }

  const userId = ctx.state.user.userId
  const { roomName } = ctx.params

  const meeting = await db.queryOne(
    'SELECT * FROM meetings WHERE room_name = ? LIMIT 1',
    [roomName]
  )
  if (!meeting) {
    return error(ctx, '会议不存在', 404, 200)
  }
  if (meeting.status === 'ended') {
    return error(ctx, '会议已结束', 410, 200)
  }

  // 取用户昵称作为显示名
  const user = await db.queryOne(
    'SELECT id, nickname, username FROM users WHERE id = ? LIMIT 1',
    [userId]
  )
  const displayName = user?.nickname || user?.username || ('用户' + userId)

  const token = await livekit.createToken({
    roomName,
    identity: userId,
    name: displayName,
    canPublish: true,
    metadata: { userId, nickname: displayName }
  })

  // 记录/更新参会者
  await db.query(
    `INSERT INTO meeting_participants (meeting_id, user_id, joined_at)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE joined_at = NOW(), left_at = NULL`,
    [meeting.id, userId]
  )

  success(ctx, {
    token,
    url: livekit.livekitUrl,
    room_name: roomName,
    identity: String(userId),
    name: displayName,
    is_host: meeting.host_user_id === userId
  })
}

/**
 * 会议详情 + 实时参会者
 * params: roomName
 */
async function getMeeting(ctx) {
  const { roomName } = ctx.params
  const meeting = await db.queryOne(
    'SELECT * FROM meetings WHERE room_name = ? LIMIT 1',
    [roomName]
  )
  if (!meeting) {
    return error(ctx, '会议不存在', 404, 200)
  }

  let participants = []
  if (livekit.isConfigured() && meeting.status === 'active') {
    try {
      const list = await livekit.listParticipants(roomName)
      participants = list.map((p) => ({
        identity: p.identity,
        name: p.name,
        joined_at: p.joinedAt ? Number(p.joinedAt) : null
      }))
    } catch (e) {
      // 房间可能尚未真正创建（无人入会），忽略
      participants = []
    }
  }

  success(ctx, {
    id: meeting.id,
    room_name: meeting.room_name,
    title: meeting.title,
    host_user_id: meeting.host_user_id,
    status: meeting.status,
    created_at: meeting.created_at,
    ended_at: meeting.ended_at,
    participants
  })
}

/**
 * 结束会议（仅主持人）
 * params: roomName
 */
async function endMeeting(ctx) {
  const userId = ctx.state.user.userId
  const { roomName } = ctx.params

  const meeting = await db.queryOne(
    'SELECT * FROM meetings WHERE room_name = ? LIMIT 1',
    [roomName]
  )
  if (!meeting) {
    return error(ctx, '会议不存在', 404, 200)
  }
  if (meeting.host_user_id !== userId) {
    return error(ctx, '只有主持人可以结束会议', 403, 200)
  }
  if (meeting.status === 'ended') {
    return success(ctx, { room_name: roomName, status: 'ended' })
  }

  if (livekit.isConfigured()) {
    try {
      await livekit.deleteRoom(roomName)
    } catch (e) {
      // 房间可能不存在于 LiveKit（无人入会过），忽略
    }
  }

  await db.update(
    'UPDATE meetings SET status = ?, ended_at = NOW() WHERE id = ?',
    ['ended', meeting.id]
  )

  success(ctx, { room_name: roomName, status: 'ended' })
}

/**
 * LiveKit Webhook：免 JWT，用 SDK 验签
 * 需要原始请求体，路由处用 rawBody
 */
async function webhook(ctx) {
  try {
    const authHeader = ctx.headers.authorization || ''
    const rawBody = ctx.request.rawBody || JSON.stringify(ctx.request.body || {})
    const event = await livekit.receiveWebhook(rawBody, authHeader)

    if (event.event === 'room_finished' && event.room?.name) {
      await db.update(
        'UPDATE meetings SET status = ?, ended_at = NOW() WHERE room_name = ? AND status != ?',
        ['ended', event.room.name, 'ended']
      )
    } else if (event.event === 'participant_left' && event.room?.name && event.participant?.identity) {
      const meeting = await db.queryOne(
        'SELECT id FROM meetings WHERE room_name = ? LIMIT 1',
        [event.room.name]
      )
      if (meeting) {
        await db.update(
          'UPDATE meeting_participants SET left_at = NOW() WHERE meeting_id = ? AND user_id = ?',
          [meeting.id, Number(event.participant.identity)]
        )
      }
    }

    ctx.status = 200
    ctx.body = { ok: true }
  } catch (e) {
    // 验签失败等
    ctx.status = 200
    ctx.body = { ok: false }
  }
}

module.exports = {
  createMeeting,
  joinMeeting,
  getMeeting,
  endMeeting,
  webhook
}
