const db = require('../utils/db')
const { success, error } = require('../utils/response')
const logger = require('../utils/logger')
const multer = require('koa-multer')
const sharp = require('sharp')
const path = require('path')
const fs = require('fs')
const config = require('../config')

// 头像上传配置
const avatarDir = path.join(config.upload.path, 'avatars')
if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true })
}

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.tmp'
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`)
  }
})

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('只允许上传图片文件'), false)
    }
  }
})

/**
 * 压缩头像并转为 WebP（宽度 256，等比缩放）
 */
async function compressAvatar(inputPath) {
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`
  const outputPath = path.join(avatarDir, filename)

  await sharp(inputPath)
    .resize({
      width: 256,
      withoutEnlargement: true
    })
    .webp({ quality: 80 })
    .toFile(outputPath)

  // 删除原始文件
  try {
    fs.unlinkSync(inputPath)
  } catch (e) {
    logger.error('[User] 删除原图失败:', e.message)
  }

  return {
    filename,
    url: `/uploads/avatars/${filename}`,
    size: fs.statSync(outputPath).size
  }
}

/**
 * 上传头像
 */
async function uploadAvatar(ctx) {
  const userId = ctx.state.user.userId
  const file = ctx.req.file
  if (!file) {
    return error(ctx, '请上传图片', 400)
  }

  try {
    const result = await compressAvatar(file.path)

    await db.update(
      'UPDATE users SET avatar = ? WHERE id = ?',
      [result.url, userId]
    )

    success(ctx, { avatar: result.url }, '上传成功')
  } catch (e) {
    logger.error('[User] 头像处理失败:', e.message)
    return error(ctx, '头像处理失败', 500)
  }
}

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

  // 禁止 CDN / 浏览器缓存用户资料接口
  ctx.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  ctx.set('Pragma', 'no-cache')
  ctx.set('Expires', '0')

  success(ctx, user)
}

/**
 * 更新用户信息（仅更新请求体中实际传入的字段，避免覆盖其它字段为空）
 */
async function updateProfile(ctx) {
  const userId = ctx.state.user.userId
  const { nickname, avatar, phone, email } = ctx.request.body

  const fields = []
  const params = []
  if (nickname !== undefined) {
    fields.push('nickname = ?')
    params.push(nickname)
  }
  if (avatar !== undefined) {
    fields.push('avatar = ?')
    params.push(avatar)
  }
  if (phone !== undefined) {
    fields.push('phone = ?')
    params.push(phone)
  }
  if (email !== undefined) {
    fields.push('email = ?')
    params.push(email)
  }

  if (fields.length > 0) {
    params.push(userId)
    await db.update(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      params
    )
  }

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
  updateSettings,
  avatarUpload,
  uploadAvatar
}
