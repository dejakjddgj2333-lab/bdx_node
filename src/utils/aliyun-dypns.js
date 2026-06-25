const OpenApi = require('@alicloud/openapi-client')
// @alicloud/dypnsapi20170525 是 Darabonba 生成的 SDK，CommonJS 下：
// - Client 类挂在 .default 上（直接 new 模块对象会报 "is not a constructor"）
// - 各请求类（GetMobileRequest 等）挂在模块顶层
const Dypnsapi = require('@alicloud/dypnsapi20170525')
const Dypnsapi20170525 = Dypnsapi.default
const { GetMobileRequest } = Dypnsapi
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
  const req = new GetMobileRequest({
    accessToken: token,
  })
  const res = await client.getMobile(req)
  const body = res.body || {}
  logger.info('[AliyunDypns] 取号响应:', JSON.stringify(body))
  if (body.code !== 'OK') {
    throw new Error(`阿里云取号失败: ${body.code} ${body.message || ''}`.trim())
  }
  return body.getMobileResultDTO?.mobile || null
}

module.exports = { getMobileByToken }
