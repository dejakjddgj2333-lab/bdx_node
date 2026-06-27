/**
 * ASR 独立测试：连方舟 ASR，喂本地生成的 16kHz PCM 正弦波（模拟说话），
 * 看方舟是否返回转写结果。用于区分「协议/配置问题」vs「App 音频问题」。
 *
 * 用法：node scripts/test-asr.js
 * 需 .env 的 ARK_API_KEY
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const PlanAsrClient = require('../src/services/voice-call/plan-asr-client')

async function main() {
  const apiKey = process.env.ARK_API_KEY
  if (!apiKey) { console.error('未配置 ARK_API_KEY'); process.exit(1) }

  // 生成 2 秒 16kHz PCM16 mono 正弦波（440Hz，模拟有能量的音频）
  const sampleRate = 16000
  const durationSec = 2
  const numSamples = sampleRate * durationSec
  const buf = Buffer.alloc(numSamples * 2)
  for (let i = 0; i < numSamples; i++) {
    const v = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 16000 // 振幅
    buf.writeInt16LE(Math.round(v), i * 2)
  }

  let lastText = ''
  const asr = new PlanAsrClient({
    apiKey,
    sampleRate,
    onText: (text, isFinal) => { lastText = text; console.log(`[onText] isFinal=${isFinal} text="${text}"`) },
    onDone: (t) => { console.log(`[onDone] final="${t}"`) }
  })

  console.log('连接 ASR...')
  await asr.connect()
  console.log('已连接，开始喂 2 秒正弦波...')

  // 分块喂，每块 3200 字节（100ms）
  const chunkSize = 3200
  for (let off = 0; off < buf.length; off += chunkSize) {
    const chunk = buf.slice(off, off + chunkSize)
    asr.sendAudio(chunk, false)
    await new Promise(r => setTimeout(r, 100)) // 模拟实时
  }

  console.log('喂完，等待转写结果（3秒）...')
  await new Promise(r => setTimeout(r, 3000))
  console.log(`最终 lastText="${lastText}"`)

  // 发结束包
  asr.finish()
  await new Promise(r => setTimeout(r, 2000))
  console.log(`finish 后 lastText="${lastText}"`)
  await asr.close()
  process.exit(0)
}

main().catch(e => { console.error('ERR:', e); process.exit(1) })
