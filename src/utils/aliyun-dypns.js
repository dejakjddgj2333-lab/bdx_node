const OpenApi = require('@alicloud/openapi-client')
const Dypnsapi20170525 = require('@alicloud/dypnsapi20170525')
const config = require('../config')
const logger = require('./logger')

function createClient() {
  const c = new OpenApi.Config({
    accessKeyId: config.aliyun.accessKeyId,
    accessKeySecret: config.aliyun.accessKeySecret,
  })
  c.endpoint = 'dypnsapi.aliyuncs.com'
  return new Dypnsapi20170525(c)
}

/**
 * 通过阿里云一键登录 token 换取手机号
 * @param {string} token 客户端 SDK 返回的 accessToken
 * @returns {Promise<string | null>}
 */
async function getMobileByToken(token) {
  const client = createClient()
  const req = new Dypnsapi20170525.GetMobileRequest({
    accessToken: token,
  })
  const res = await client.getMobile(req)
  logger.info('[AliyunDypns] 取号响应:', JSON.stringify(res.body))
  return res.body?.getMobileResponseDTO?.mobile
}

module.exports = { getMobileByToken }
