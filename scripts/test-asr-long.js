/**
 * 复刻 App 场景：连 ASR，发 300 个包（模拟几百次音频），再 finish。
 * 看是否复现 1006 关闭 / 拿不到 isLast。
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const PlanAsrClient = require('../src/services/voice-call/plan-asr-client')

async function main() {
  const apiKey = process.env.ARK_API_KEY
  if (!apiKey) { console.error('未配置 ARK_API_KEY'); process.exit(1) }

  const sampleRate = 16000
  // 生成 100ms 的正弦波块（1600 样本 = 3200 字节）
  const numSamples = sampleRate / 10
  const chunk = Buffer.alloc(numSamples * 2)
  for (let i = 0; i < numSamples; i++) {
    const v = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 16000
    chunk.writeInt16LE(Math.round(v), i * 2)
  }

  let lastText = ''
  const asr = new PlanAsrClient({
    apiKey, sampleRate,
    onText: (t, f) => { lastText = t; console.log(`[onText] isFinal=${f} text="${t}"`) },
    onDone: (t) => console.log(`[onDone] final="${t}"`)
  })

  console.log('连接 ASR...')
  await asr.connect()

  // 发 300 个包（模拟 App 30 秒的高频发送）
  console.log('发 300 个包...')
  for (let i = 0; i < 300; i++) {
    asr.sendAudio(chunk, false)
    await new Promise(r => setTimeout(r, 30)) // 30ms 间隔，比实时快
  }
  console.log(`发完 300 包，当前 seq=${asr.seq}，等 1 秒...`)
  await new Promise(r => setTimeout(r, 1000))

  console.log('finish...')
  asr.finish()
  await new Promise(r => setTimeout(r, 3000))
  console.log(`finish 后 lastText="${lastText}"`)
  await asr.close()
  process.exit(0)
}
main().catch(e => { console.error('ERR:', e); process.exit(1) })
