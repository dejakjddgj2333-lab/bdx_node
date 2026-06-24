const nodemailer = require('nodemailer')
const config = require('../config')

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
})

async function sendEmailCode(email, code) {
  await transporter.sendMail({
    from: `"北斗星AI" <${config.smtp.from}>`,
    to: email,
    subject: '您的登录验证码',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #333;">
        <h2 style="color: #d97757; margin-bottom: 16px;">北斗星AI</h2>
        <p>您好，您正在登录北斗星AI，验证码如下：</p>
        <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
          <span style="font-size: 28px; font-weight: 600; letter-spacing: 4px; color: #141413;">${code}</span>
        </div>
        <p style="color: #666; font-size: 14px;">验证码 5 分钟内有效，请勿泄露给他人。</p>
      </div>
    `,
  })
}

module.exports = { sendEmailCode }
