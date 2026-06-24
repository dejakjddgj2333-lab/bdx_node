const Redis = require('ioredis')
const config = require('../config')
const logger = require('./logger')

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  db: config.redis.db,
})

redis.on('connect', () => {
  logger.info('[Redis] 连接成功')
})

redis.on('error', (err) => {
  logger.error('[Redis] 连接错误:', err)
})

module.exports = redis
