const db = require('../utils/db')
const { success, error } = require('../utils/response')

/**
 * 获取用户信息
 */
async function getProfile(ctx) {
  const userId = ctx.state.user.userId

  const user = await db.queryOne(
    `SELECT id, username, nickname, avatar, phone, email,
            vip_level, created_at
     FROM users WHERE id = ?`,
    [userId]
  )

  if (!user) {
    return error(ctx, '用户不存在', 404)
  }

  success(ctx, user)
}

/**
 * 更新用户信息
 */
async function updateProfile(ctx) {
  const userId = ctx.state.user.userId
  const { nickname, avatar, phone, email } = ctx.request.body

  await db.update(
    'UPDATE users SET nickname = ?, avatar = ?, phone = ?, email = ? WHERE id = ?',
    [nickname, avatar, phone, email, userId]
  )

  const user = await db.queryOne(
    'SELECT id, username, nickname, avatar, phone, email FROM users WHERE id = ?',
    [userId]
  )

  success(ctx, user, '更新成功')
}

/**
 * 获取用户设置
 */
async function getSettings(ctx) {
  const userId = ctx.state.user.userId

  const settings = await db.queryOne(
    'SELECT * FROM user_settings WHERE user_id = ?',
    [userId]
  )

  success(ctx, settings)
}

/**
 * 更新用户设置
 */
async function updateSettings(ctx) {
  const userId = ctx.state.user.userId
  const { theme, fontSize, autoPlay, language } = ctx.request.body

  const existing = await db.queryOne(
    'SELECT id FROM user_settings WHERE user_id = ?',
    [userId]
  )

  if (existing) {
    await db.update(
      'UPDATE user_settings SET theme = ?, font_size = ?, auto_play = ?, language = ? WHERE user_id = ?',
      [theme, fontSize, autoPlay, language, userId]
    )
  } else {
    await db.insert(
      'INSERT INTO user_settings (user_id, theme, font_size, auto_play, language) VALUES (?, ?, ?, ?, ?)',
      [userId, theme, fontSize, autoPlay, language]
    )
  }

  const settings = await db.queryOne(
    'SELECT * FROM user_settings WHERE user_id = ?',
    [userId]
  )

  success(ctx, settings, '设置已更新')
}

module.exports = {
  getProfile,
  updateProfile,
  getSettings,
  updateSettings
}
