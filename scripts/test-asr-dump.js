/**
 * 用落盘的 App 真实音频喂方舟 ASR，验证音频能否被识别。
 * 一次性读文件、分块发、finish。复刻正弦波成功模式。
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const fs = require('fs')
const PlanAsrClient = require('../src/services/voice-call/plan-asr-client')

async function main() {
  const apiKey = process.env.ARK_API_KEY
  const file = require('path').join(__dirname, '../tmp_voice_diag.pcm')
  if (!fs.existsSync(file)) { console.error('无落盘音频'); process.exit(1) }
  const pcm = fs.readFileSync(file)
  console.log(`读取 ${pcm.length} 字节 (16k 期望 ${pcm.length/32000}秒, 24k 期望 ${pcm.length/48000}秒)`)

  let lastText = ''
  const asr = new PlanAsrClient({
    apiKey, sampleRate: 16000,
    onText: (t, f) => { lastText = t; console.log(`[onText 16k] isFinal=${f} text="${t}"`) },
    onDone: (t) => console.log(`[onDone 16k] final="${t}"`)
  })
  await asr.connect()
  // 分块发，每块 3200 字节(100ms)
  for (let off = 0; off < pcm.length; off += 3200) {
    asr.sendAudio(pcm.slice(off, off + 3200), false)
    await new Promise(r => setTimeout(r, 100))
  }
  await new Promise(r => setTimeout(r, 500))
  asr.finish()
  await new Promise(r => setTimeout(r, 3000))
  console.log(`16k 最终: "${lastText}"`)
  await asr.close()
  process.exit(0)
}
main().catch(e => { console.error('ERR:', e); process.exit(1) })
